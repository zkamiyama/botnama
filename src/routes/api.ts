import { Hono } from "hono";
import {
  handleDebugComment,
  ingestComment,
  markRequestIntakeOpened,
  resetCommentTracking,
} from "../services/commentService.ts";
import { RequestService } from "../services/requestService.ts";
import { Platform, RequestStatus, ServerSettings } from "../types.ts";
import {
  deleteAllComments,
  listRecentComments,
  fetchAllCommentsForExport,
} from "../repositories/requestsRepository.ts";
import {
  clearPlaybackLogs,
  fetchAllPlaybackLogs,
  listPlaybackLogs,
} from "../repositories/playbackLogsRepository.ts";
import { getSystemInfo, updateYtDlpBinary } from "../services/systemService.ts";
import { DOCK_EVENT, DockEvent, dockEventBus, emitDockEvent } from "../events/dockEventBus.ts";
import { subscribeInfoOverlay } from "../events/infoOverlayBus.ts";
import { getIntakeStatus, toggleIntakeStatus } from "../services/intakeService.ts";
import {
  addNgUserId,
  clearNgUserIds,
  getNgUserRule,
  getRules,
  removeNgUserId,
  updateRules,
  initRuleState,
} from "../services/ruleService.ts";
import { emitInfoOverlay } from "../events/infoOverlayBus.ts";
import { TokenStore } from "../services/tokenStore.ts";
import { YouTubeService } from "../services/youtubeService.ts";
import { NiconicoService } from "../services/niconicoService.ts";
import { saveServerSettings } from "../settings.ts";
import { NotificationService } from "../services/notificationService.ts";
import {
  addStockItem,
  createStock,
  listStockNames,
  loadStock,
  saveStock,
  submitStockItems,
} from "../services/stockService.ts";

const REQUEST_STATUS_SET = new Set<RequestStatus>([
  "PENDING",
  "VALIDATING",
  "REJECTED",
  "QUEUED",
  "DOWNLOADING",
  "READY",
  "PLAYING",
  "DONE",
  "FAILED",
  "SUSPEND",
]);

export const createApiRouter = (
  requestService: RequestService,
  settings: ServerSettings,
  deps?: {
    youtubeService?: YouTubeService;
    niconicoService?: NiconicoService;
    tokenStore?: TokenStore;
    notificationService?: NotificationService;
    youtubeCommentPoller?: import("../services/youtubeCommentPoller.ts").YouTubeCommentPoller;
  },
) => {
  const api = new Hono();

  // Initialize services with cookie-based auth
  const tokenStore = deps?.tokenStore ?? new TokenStore(settings.cacheDir);
  const youtubeService = deps?.youtubeService ?? new YouTubeService({}, tokenStore);
  const niconicoService = deps?.niconicoService ?? new NiconicoService({}, tokenStore);
  const youtubeContinuations = new Map<string, string | null>();

  let currentLocale = settings.locale ?? "auto";
  const localeSubscribers = new Set<(locale: string) => void>();
  const encoder = new TextEncoder();
  const streamStatuses: RequestStatus[] = [
    "QUEUED",
    "VALIDATING",
    "DOWNLOADING",
    "READY",
    "PLAYING",
    "FAILED",
    "REJECTED",
    "DONE",
    "SUSPEND",
  ];
  const recentCommentLimit = 30;
  const recentLogLimit = 200;
  const padNumber = (value: number) => value.toString().padStart(2, "0");
  const formatCsvTimestamp = (ms: number) => {
    const date = new Date(ms);
    const year = date.getFullYear();
    const month = padNumber(date.getMonth() + 1);
    const day = padNumber(date.getDate());
    const hour = padNumber(date.getHours());
    const minute = padNumber(date.getMinutes());
    const second = padNumber(date.getSeconds());
    return `${year}/${month}/${day}/${hour}:${minute}:${second}`;
  };
  const escapeCsv = (value: string | number | null | undefined) => {
    const text = value === undefined || value === null ? "" : String(value);
    if (text.includes(",") || text.includes("\"") || text.includes("\n") || text.includes("\r")) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  // Short-lived cache for auth status to avoid duplicate getMyBroadcast calls
  const authStatusCache = new Map<string, { data: any; expiresAt: number }>();
  const AUTH_STATUS_TTL_MS = 5000; // 5s cache window
  const getCachedAuthStatus = (key: string) => {
    const cached = authStatusCache.get(key);
    if (!cached) return null;
    if (Date.now() > cached.expiresAt) {
      authStatusCache.delete(key);
      return null;
    }
    return cached.data;
  };
  const setCachedAuthStatus = (key: string, data: any) => {
    authStatusCache.set(key, { data, expiresAt: Date.now() + AUTH_STATUS_TTL_MS });
  };

  const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    !!value && typeof value === "object" && !Array.isArray(value);

  const getStringOrNull = (value: unknown) => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  };

  const mapSiteTypeToPlatform = (value: string | null): Platform => {
    const normalized = (value ?? "").toLowerCase();
    switch (normalized) {
      case "nicolive":
        return "niconico";
      case "youtubelive":
        return "youtube";
      case "twitch":
        return "twitch";
      case "twicas":
        return "twicas";
      case "mirrativ":
        return "mirrativ";
      case "linelive":
        return "linelive";
      case "openrec":
        return "openrec";
      case "whowatch":
        return "whowatch";
      case "showroom":
        return "showroom";
      case "mildom":
        return "mildom";
      case "bigo":
        return "bigo";
      case "periscope":
        return "periscope";
      case "mixch":
        return "mixch";
      default:
        return "other";
    }
  };

  interface NormalizedMcvPayload {
    commentId: string | null;
    platform: Platform;
    roomId: string | null;
    userId: string | null;
    userName: string | null;
    comment: string;
    timestamp: number;
    allowRequestCreation: boolean;
  }

  type McvNormalizationResult =
    | { payload: NormalizedMcvPayload }
    | { skipReason: string }
    | null;

  const normalizeMcvPayload = (value: unknown): McvNormalizationResult => {
    if (!isPlainObject(value)) return null;
    const commentSource = typeof value.comment === "string"
      ? value.comment
      : typeof value.message === "string"
        ? value.message
        : null;
    if (!commentSource) return null;
    const comment = commentSource.trim();
    if (!comment) return null;

    const metadataValue = value.metadata;
    const metadata = isPlainObject(metadataValue) ? metadataValue : {};
    const includeNgUsers = value.includeNgUsers === true;
    const includeInitialComments = value.includeInitialComments === true;
    const isNgUser = metadata.isNgUser === true || metadata.isSiteNgUser === true;
    if (isNgUser && !includeNgUsers) {
      return { skipReason: "ng-user" };
    }
    const isInitialComment = metadata.isInitialComment === true || metadata.isFirstComment === true;
    if (isInitialComment && !includeInitialComments) {
      return { skipReason: "initial-comment" };
    }

    const timestamp = typeof value.timestamp === "number" && Number.isFinite(value.timestamp)
      ? value.timestamp
      : Date.now();

    return {
      payload: {
        commentId: getStringOrNull(value.messageId),
        platform: mapSiteTypeToPlatform(typeof value.siteType === "string" ? value.siteType : null),
        roomId: getStringOrNull(value.roomId),
        userId: getStringOrNull(value.userId),
        userName: getStringOrNull(value.userName),
        comment,
        timestamp,
        allowRequestCreation: value.allowRequestCreation === false ? false : true,
      },
    };
  };

  const pushDockEvent = async (event: DockEvent, data?: unknown) => {
    if (event === DOCK_EVENT.SYSTEM) {
      const info = await getSystemInfo(settings);
      return { event, payload: info };
    }
    if (event === DOCK_EVENT.COMMENTS) {
      const items = listRecentComments(recentCommentLimit);
      return { event, payload: { items } };
    }
    if (event === DOCK_EVENT.LOGS) {
      const items = listPlaybackLogs(recentLogLimit);
      return { event, payload: { items } };
    }
    if (event === DOCK_EVENT.RULES) {
      return { event, payload: { rules: getRules() } };
    }
    // DOCK_EVENT.REQUESTS
    const bucket = (isPlainObject(data) && typeof data.bucket === "string") ? data.bucket : undefined;
    // If bucket is specified, we might want to optimize or include it in the payload.
    // For now, we'll just include it in the payload so the client knows which bucket updated.
    // But wait, the client expects { summary, list } for REQUESTS event.
    // If we change the payload structure, we might break the client.
    // However, the client uses `loadRequests` which fetches the list.
    // The payload sent here is used by the client to update its state immediately without fetching, 
    // OR the client just uses the event as a signal to refetch.

    // Let's check dock.js again.
    // The client receives the event.
    // eventSource.onmessage = (e) => { ... }
    // It parses the data.
    // If event is "requests", it calls handleRequestsUpdate(data).

    // We need to check how handleRequestsUpdate uses the data.

    return {
      event: DOCK_EVENT.REQUESTS,
      payload: {
        summary: requestService.summary(),
        list: requestService.list({ statuses: streamStatuses }),
        bucket, // Add bucket info
      },
    };
  };

  // YouTube OAuth Authentication
  api.get("/auth/youtube/login", (c) => {
    const state = crypto.randomUUID();
    const authUrl = youtubeService.getAuthorizationUrl(state);
    return c.redirect(authUrl);
  });

  api.get("/auth/youtube/callback", async (c) => {
    const code = c.req.query("code");
    if (!code) {
      return c.json({ ok: false, message: "No authorization code" }, 400);
    }

    try {
      await youtubeService.exchangeCodeForTokens(code);
      // Redirect to a success page or close window
      return c.html(`
        <html>
          <body>
            <h1>YouTube Authentication Successful!</h1>
            <p>You can close this window now.</p>
            <script>window.close();</script>
          </body>
        </html>
      `);
    } catch (err) {
      return c.json({ ok: false, message: err instanceof Error ? err.message : String(err) }, 500);
    }
  });

  api.get("/auth/youtube/status", async (c) => {
    const refresh = (c.req.query("refresh") ?? "").toLowerCase();
    const forceRefresh = refresh === "1" || refresh === "true";
    const cacheKey = `youtube:${forceRefresh}`;
    console.log(`[API] YouTube status request: forceRefresh=${forceRefresh} referer=${c.req.header("referer") ?? "unknown"}`);
    // If not forcing refresh, return cached value when available
    if (!forceRefresh) {
      const cached = getCachedAuthStatus(cacheKey);
      if (cached) {
        console.debug(`[API] YouTube auth status cache hit (referer=${c.req.header("referer") ?? "unknown"})`);
        return c.json(cached);
      }
    }
    console.debug(`[API] YouTube auth status fetch (referer=${c.req.header("referer") ?? "unknown"})`);
    const isAuth = await youtubeService.isAuthenticated(forceRefresh);
    const [channelUrl, broadcastId] = isAuth
      ? await Promise.all([
        // Do not force-refresh again for channelUrl/broadcast to avoid double cookie extraction
        youtubeService.getMyChannelUrl(false),
        youtubeService.getMyBroadcast(false),
      ])
      : [null, null];
    const data = {
      ok: true,
      authenticated: isAuth,
      lastRefreshedAt: youtubeService.getLastCookieFetchedAt(),
      channelUrl,
      broadcastId,
    };
    setCachedAuthStatus(cacheKey, data);
    return c.json(data);
  });

  api.post("/auth/youtube/logout", async (c) => {
    await youtubeService.logout();
    return c.json({ ok: true });
  });

  api.get("/youtube/comments/:videoId", async (c) => {
    const videoId = c.req.param("videoId");
    const pageToken = youtubeContinuations.get(videoId) ?? undefined;

    try {
      const { items, nextPageToken } = await youtubeService.getChatMessages(videoId, pageToken);
      youtubeContinuations.set(videoId, nextPageToken ?? null);
      return c.json({ ok: true, comments: items ?? [] });
    } catch (err) {
      console.error("[API] YouTube comments failed:", err);
      return c.json({ ok: false, message: err instanceof Error ? err.message : String(err) }, 500);
    }
  });

  // Niconico Session Authentication
  api.post("/auth/niconico/login", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const username = typeof body.username === "string" ? body.username : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!username || !password) {
      return c.json({ ok: false, message: "Username and password required" }, 400);
    }

    try {
      await niconicoService.login(username, password);
      return c.json({ ok: true });
    } catch (err) {
      return c.json({ ok: false, message: err instanceof Error ? err.message : String(err) }, 500);
    }
  });

  api.get("/auth/niconico/status", async (c) => {
    const refresh = (c.req.query("refresh") ?? "").toLowerCase();
    const forceRefresh = refresh === "1" || refresh === "true";
    const cacheKey = `niconico:${forceRefresh}`;
    console.log(`[API] Niconico status request: forceRefresh=${forceRefresh} referer=${c.req.header("referer") ?? "unknown"}`);
    if (!forceRefresh) {
      const cached = getCachedAuthStatus(cacheKey);
      if (cached) {
        console.debug(`[API] Niconico auth status cache hit (referer=${c.req.header("referer") ?? "unknown"})`);
        return c.json(cached);
      }
    }
    console.debug(`[API] Niconico auth status fetch (referer=${c.req.header("referer") ?? "unknown"})`);
    const isAuth = await niconicoService.isAuthenticated(forceRefresh);
    const [userPageUrl, broadcastId] = isAuth
      ? await Promise.all([
        niconicoService.getUserPageUrl(false),
        niconicoService.getMyBroadcast(false),
      ])
      : [null, null];
    const data = {
      ok: true,
      authenticated: isAuth,
      lastRefreshedAt: niconicoService.getLastCookieFetchedAt(),
      userPageUrl,
      broadcastId,
    };
    setCachedAuthStatus(cacheKey, data);
    return c.json(data);
  });

  api.post("/auth/niconico/logout", async (c) => {
    await niconicoService.logout();
    return c.json({ ok: true });
  });

  // YouTube Live API
  api.get("/youtube/broadcasts", async (c) => {
    try {
      const cacheKey = `youtube:false`;
      const cached = getCachedAuthStatus(cacheKey);
      if (cached && cached.broadcastId) {
        return c.json({ ok: true, broadcastId: cached.broadcastId });
      }
      const broadcastId = await youtubeService.getMyBroadcast();
      return c.json({ ok: true, broadcastId });
    } catch (err) {
      return c.json({ ok: false, message: err instanceof Error ? err.message : String(err) }, 500);
    }
  });

  api.post("/youtube/poller/start", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const broadcastId = typeof body?.broadcastId === "string" ? body.broadcastId : undefined;
    try {
      deps?.youtubeCommentPoller?.activate(broadcastId);
      return c.json({ ok: true, started: true });
    } catch (err) {
      return c.json({ ok: false, message: err instanceof Error ? err.message : String(err) }, 500);
    }
  });

  api.post("/youtube/poller/stop", async (c) => {
    try {
      deps?.youtubeCommentPoller?.deactivate();
      return c.json({ ok: true, stopped: true });
    } catch (err) {
      return c.json({ ok: false, message: err instanceof Error ? err.message : String(err) }, 500);
    }
  });

  api.get("/youtube/chat/:liveChatId", async (c) => {
    const liveChatId = c.req.param("liveChatId");
    const pageToken = c.req.query("pageToken");

    try {
      const result = await youtubeService.getChatMessages(liveChatId, pageToken);
      return c.json({ ok: true, ...result });
    } catch (err) {
      return c.json({ ok: false, message: err instanceof Error ? err.message : String(err) }, 500);
    }
  });

  api.post("/youtube/chat/:liveChatId", async (c) => {
    const liveChatId = c.req.param("liveChatId");
    const body = await c.req.json().catch(() => ({}));
    const message = typeof body.message === "string" ? body.message : "";

    if (!message) {
      return c.json({ ok: false, message: "Message required" }, 400);
    }

    try {
      console.log(`[API] Sending YouTube message to ${liveChatId}: ${message}`);
      await youtubeService.sendChatMessage(liveChatId, message);
      return c.json({ ok: true });
    } catch (err) {
      console.error(`[API] YouTube send failed:`, err);
      return c.json({ ok: false, message: err instanceof Error ? err.message : String(err) }, 500);
    }
  });

  // Niconico Live API
  api.get("/niconico/broadcasts", async (c) => {
    try {
      const cacheKey = `niconico:false`;
      const cached = getCachedAuthStatus(cacheKey);
      if (cached && cached.broadcastId) {
        return c.json({ ok: true, broadcastId: cached.broadcastId });
      }
      const broadcastId = await niconicoService.getMyBroadcast();
      return c.json({ ok: true, broadcastId });
    } catch (err) {
      return c.json({ ok: false, message: err instanceof Error ? err.message : String(err) }, 500);
    }
  });

  api.get("/niconico/broadcast/:liveId", async (c) => {
    const liveId = c.req.param("liveId");

    try {
      const broadcast = await niconicoService.getBroadcast(liveId);
      return c.json({ ok: true, broadcast });
    } catch (err) {
      return c.json({ ok: false, message: err instanceof Error ? err.message : String(err) }, 500);
    }
  });

  api.get("/niconico/comments/:liveId", async (c) => {
    const liveId = c.req.param("liveId");

    try {
      const comments = await niconicoService.getComments(liveId);
      return c.json({ ok: true, comments });
    } catch (err) {
      return c.json({ ok: false, message: err instanceof Error ? err.message : String(err) }, 500);
    }
  });

  api.post("/niconico/comments/:liveId", async (c) => {
    const liveId = c.req.param("liveId");
    const body = await c.req.json().catch(() => ({}));
    const message = typeof body.message === "string" ? body.message : "";

    if (!message) {
      return c.json({ ok: false, message: "Message required" }, 400);
    }

    try {
      console.log(`[API] Sending Niconico comment to ${liveId}: ${message}`);
      await niconicoService.sendComment(liveId, message);
      return c.json({ ok: true });
    } catch (err) {
      console.error(`[API] Niconico send failed:`, err);
      return c.json({ ok: false, message: err instanceof Error ? err.message : String(err) }, 500);
    }
  });

  api.post("/debug/comments", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const message = String(body.message ?? "").trim();
    if (!message) {
      return c.json({ error: "message is required" }, 400);
    }
    const response = handleDebugComment({ message, userName: body.userName ?? null });
    return c.json(response);
  });

  api.post("/hooks/mcv/comments", async (c) => {
    if (settings.mcvAccessToken) {
      const token = c.req.header("x-botnama-mcv-token") ?? "";
      if (token !== settings.mcvAccessToken) {
        return c.json({ ok: false, message: "invalid token" }, 401);
      }
    }
    const body = await c.req.json().catch(() => null);
    const normalized = normalizeMcvPayload(body);
    if (!normalized) {
      return c.json({ ok: false, message: "invalid payload" }, 400);
    }
    if ("skipReason" in normalized) {
      return c.json({ ok: true, skipped: normalized.skipReason });
    }
    try {
      const result = ingestComment({
        commentId: normalized.payload.commentId ?? undefined,
        platform: normalized.payload.platform,
        message: normalized.payload.comment,
        userId: normalized.payload.userId ?? undefined,
        userName: normalized.payload.userName ?? undefined,
        roomId: normalized.payload.roomId ?? undefined,
        timestamp: normalized.payload.timestamp,
        allowRequestCreation: normalized.payload.allowRequestCreation,
      });
      return c.json({ ok: true, result });
    } catch (err) {
      return c.json(
        { ok: false, message: err instanceof Error ? err.message : String(err) },
        400,
      );
    }
  });

  // Internal ingest endpoint (no token required, for internal UI use)
  api.post("/comments/ingest", async (c) => {
    const body = await c.req.json().catch(() => null);
    const normalized = normalizeMcvPayload(body);
    if (!normalized) {
      return c.json({ ok: false, message: "invalid payload" }, 400);
    }
    if ("skipReason" in normalized) {
      return c.json({ ok: true, skipped: normalized.skipReason });
    }
    try {
      const result = ingestComment({
        commentId: normalized.payload.commentId ?? undefined,
        platform: normalized.payload.platform,
        message: normalized.payload.comment,
        userId: normalized.payload.userId ?? undefined,
        userName: normalized.payload.userName ?? undefined,
        roomId: normalized.payload.roomId ?? undefined,
        timestamp: normalized.payload.timestamp,
        allowRequestCreation: normalized.payload.allowRequestCreation,
      });
      return c.json({ ok: true, result });
    } catch (err) {
      return c.json(
        { ok: false, message: err instanceof Error ? err.message : String(err) },
        400,
      );
    }
  });

  api.get("/stream", (c) => {
    let closeStream: (() => void) | null = null;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        let closed = false;
        const write = (event: string, data: unknown) => {
          if (closed) return;
          const chunk = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(chunk));
        };
        const send = (event: DockEvent, data?: unknown) => {
          pushDockEvent(event, data)
            .then(({ event, payload }) => write(event, payload))
            .catch((err) => console.error("[DockStream] failed to push event", err));
        };
        const unsubscribe = dockEventBus.subscribe((event, data) => send(event, data));
        const heartbeat = setInterval(() => write("heartbeat", { now: Date.now() }), 15000);
        send(DOCK_EVENT.REQUESTS);
        send(DOCK_EVENT.COMMENTS);
        send(DOCK_EVENT.LOGS);
        send(DOCK_EVENT.SYSTEM);
        send(DOCK_EVENT.RULES);

        const close = () => {
          if (closed) return;
          closed = true;
          clearInterval(heartbeat);
          unsubscribe();
          try {
            controller.close();
          } catch {
            // ignore
          }
        };
        closeStream = close;

        c.req.raw.signal.addEventListener("abort", close);
      },
      cancel() {
        closeStream?.();
      },
    });
    return new Response(stream, {
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-store",
        connection: "keep-alive",
      },
    });
  });

  api.get("/overlay-info/stream", (c) => {
    let closeStream: (() => void) | null = null;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const closed = { value: false };
        const write = (payload: unknown) => {
          if (closed.value) return;
          const chunk = `data: ${JSON.stringify(payload)}\n\n`;
          controller.enqueue(encoder.encode(chunk));
        };
        const unsubscribe = subscribeInfoOverlay((event) =>
          write({ event: "notify", payload: event })
        );
        const localeSink = (locale: string) => write({ event: "locale", locale });
        localeSubscribers.add(localeSink);
        const heartbeat = setInterval(() => write({ event: "heartbeat", now: Date.now() }), 15000);
        write({ event: "ready", now: Date.now() });

        const close = () => {
          if (closed.value) return;
          closed.value = true;
          clearInterval(heartbeat);
          unsubscribe();
          localeSubscribers.delete(localeSink);
          try {
            controller.close();
          } catch {
            // ignore
          }
        };
        closeStream = close;
        c.req.raw.signal.addEventListener("abort", close);
      },
      cancel() {
        closeStream?.();
      },
    });

    return new Response(stream, {
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-store",
        connection: "keep-alive",
      },
    });
  });

  api.get("/locale", () => {
    return new Response(JSON.stringify({ ok: true, locale: currentLocale }), {
      headers: { "content-type": "application/json" },
    });
  });

  api.post("/locale", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const locale = typeof body.locale === "string" ? body.locale.toLowerCase() : "auto";
    if (!["ja", "en", "auto"].includes(locale)) {
      return c.json({ ok: false, message: "invalid locale" }, 400);
    }
    currentLocale = locale;
    // notify overlay-info subscribers
    for (const notify of Array.from(localeSubscribers)) {
      try {
        notify(currentLocale);
      } catch (err) {
        console.error("locale notify failed", err);
      }
    }
    // Do not emit an overlay/info event for locale changes — this prevents
    // unintended telop/comment relay in NotificationService when the language
    // is switched by the UI or API client.
    return c.json({ ok: true, locale: currentLocale });
  });

  // Notification settings (telop relay)
  api.get("/notifications/settings", (c) => {
    const rules = getRules();
    return c.json({
      ok: true,
      notifyTelopEnabled: rules.notifyTelopEnabled ?? settings.notifyTelopEnabled ?? false,
      notifyTelopNiconico: rules.notifyTelopNiconico ?? settings.notifyTelopNiconico ?? true,
      notifyTelopYoutube: rules.notifyTelopYoutube ?? settings.notifyTelopYoutube ?? true,
      notifyTelopDelayMs: rules.notifyTelopDelayMs ?? settings.notifyTelopDelayMs ?? 5000,
    });
  });

  api.post("/notifications/settings", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const enabled = body.notifyTelopEnabled !== undefined ? Boolean(body.notifyTelopEnabled) : settings.notifyTelopEnabled ?? false;
    const nico = body.notifyTelopNiconico !== undefined ? Boolean(body.notifyTelopNiconico) : settings.notifyTelopNiconico ?? true;
    const yt = body.notifyTelopYoutube !== undefined ? Boolean(body.notifyTelopYoutube) : settings.notifyTelopYoutube ?? true;
    const delay = typeof body.notifyTelopDelayMs === "number" && Number.isFinite(body.notifyTelopDelayMs)
      ? Math.max(0, body.notifyTelopDelayMs)
      : settings.notifyTelopDelayMs ?? 5000;

    settings.notifyTelopEnabled = enabled;
    settings.notifyTelopNiconico = nico;
    settings.notifyTelopYoutube = yt;
    settings.notifyTelopDelayMs = delay;
    updateRules({
      notifyTelopEnabled: enabled,
      notifyTelopNiconico: nico,
      notifyTelopYoutube: yt,
      notifyTelopDelayMs: delay,
    });
    deps?.notificationService?.updateSettings(settings);
    try {
      saveServerSettings(settings);
    } catch (err) {
      console.warn("[Notifications] failed to persist settings", err);
    }
    return c.json({
      ok: true,
      notifyTelopEnabled: settings.notifyTelopEnabled,
      notifyTelopNiconico: settings.notifyTelopNiconico,
      notifyTelopYoutube: settings.notifyTelopYoutube,
      notifyTelopDelayMs: settings.notifyTelopDelayMs,
    });
  });

  api.get("/requests", (c) => {
    const statusParam = c.req.query("status");
    const statuses = statusParam
      ? statusParam
        .split(",")
        .map((v) => v.trim().toUpperCase() as RequestStatus)
        .filter((status) => REQUEST_STATUS_SET.has(status))
      : undefined;
    const bucket = c.req.query("bucket") ?? "queue";
    const limit = c.req.query("limit");
    const offset = c.req.query("offset");
    const parsedLimit = limit ? Number(limit) : undefined;
    const parsedOffset = offset ? Number(offset) : undefined;
    if (
      (parsedLimit !== undefined && Number.isNaN(parsedLimit)) ||
      (parsedOffset !== undefined && Number.isNaN(parsedOffset))
    ) {
      return c.json({ error: "limit/offset must be numbers" }, 400);
    }
    const data = requestService.list({ statuses, limit: parsedLimit, offset: parsedOffset, bucket });
    return c.json(data);
  });

  api.get("/requests/summary", (c) => {
    const summary = requestService.summary();
    return c.json(summary);
  });

  api.get("/rules", () => {
    return new Response(JSON.stringify({ ok: true, rules: getRules() }), {
      headers: { "content-type": "application/json" },
    });
  });

  api.post("/rules", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const updated = updateRules({
      maxDurationEnabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
      maxDurationMinutes: typeof body.maxDurationMinutes === "number"
        ? body.maxDurationMinutes
        : undefined,
      disallowDuplicates: typeof body.disallowDuplicates === "boolean"
        ? body.disallowDuplicates
        : undefined,
      cooldownMinutes: typeof body.cooldownMinutes === "number" ? body.cooldownMinutes : undefined,
      pollEnabled: typeof body.pollEnabled === "boolean" ? body.pollEnabled : undefined,
      pollIntervalSec: typeof body.pollIntervalSec === "number" ? body.pollIntervalSec : undefined,
      pollWindowSec: typeof body.pollWindowSec === "number" ? body.pollWindowSec : undefined,
      pollStopDelaySec: typeof body.pollStopDelaySec === "number"
        ? body.pollStopDelaySec
        : undefined,
      allowYoutube: typeof body.allowYoutube === "boolean" ? body.allowYoutube : undefined,
      allowNicovideo: typeof body.allowNicovideo === "boolean" ? body.allowNicovideo : undefined,
      allowBilibili: typeof body.allowBilibili === "boolean" ? body.allowBilibili : undefined,
      customSites: Array.isArray(body.customSites) ? body.customSites : undefined,
      concurrentLimitEnabled: typeof body.concurrentLimitEnabled === "boolean"
        ? body.concurrentLimitEnabled
        : undefined,
      concurrentLimitCount: typeof body.concurrentLimitCount === "number"
        ? body.concurrentLimitCount
        : undefined,
      ngUserBlockingEnabled: typeof body.ngUserBlockingEnabled === "boolean"
        ? body.ngUserBlockingEnabled
        : undefined,
      ngUserIds: Array.isArray(body.ngUserIds) ? body.ngUserIds : undefined,
    });
    return new Response(JSON.stringify({ ok: true, rules: updated }), {
      headers: { "content-type": "application/json" },
    });
  });

  api.post("/rules/reload", () => {
    initRuleState();
    emitDockEvent(DOCK_EVENT.RULES);
    return new Response(JSON.stringify({ ok: true, rules: getRules() }), {
      headers: { "content-type": "application/json" },
    });
  });

  api.get("/rules/ng-users", () => {
    return new Response(JSON.stringify({ ok: true, rule: getNgUserRule() }), {
      headers: { "content-type": "application/json" },
    });
  });

  // Stock lists
  api.get("/stocks", () => {
    const names = listStockNames();
    return new Response(JSON.stringify({ ok: true, names }), {
      headers: { "content-type": "application/json" },
    });
  });

  api.post("/stocks", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const rawName = typeof body.name === "string" ? body.name : "default";
    const name = createStock(rawName);
    emitDockEvent(DOCK_EVENT.REQUESTS); // notify dock to refresh stock names
    return new Response(JSON.stringify({ ok: true, name }), {
      headers: { "content-type": "application/json" },
    });
  });

  api.get("/stocks/:name", (c) => {
    const name = c.req.param("name");
    const items = loadStock(name);
    emitDockEvent(DOCK_EVENT.REQUESTS, { bucket: name });
    return new Response(JSON.stringify({ ok: true, name, items }), {
      headers: { "content-type": "application/json" },
    });
  });

  api.post("/stocks/:name/save", (c) => {
    const name = c.req.param("name");
    const path = saveStock(name);
    emitDockEvent(DOCK_EVENT.REQUESTS, { bucket: name });
    return new Response(JSON.stringify({ ok: true, path }), {
      headers: { "content-type": "application/json" },
    });
  });

  api.post("/stocks/:name/add", async (c) => {
    const name = c.req.param("name");
    const body = await c.req.json().catch(() => ({}));
    const message = typeof body.message === "string" ? body.message : "";
    const priority = typeof body.priority === "number" ? body.priority : null;
    if (!message.trim()) {
      return c.json({ ok: false, message: "message required" }, 400);
    }
    try {
      const item = addStockItem({ bucket: name, message, priority });
      emitDockEvent(DOCK_EVENT.REQUESTS, { bucket: name });
      return new Response(JSON.stringify({ ok: true, item }), {
        headers: { "content-type": "application/json" },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return c.json({ ok: false, message: msg }, 400);
    }
  });

  api.post("/stocks/:name/submit", async (c) => {
    const name = c.req.param("name");
    const body = await c.req.json().catch(() => ({}));
    const ids = Array.isArray(body.ids) ? body.ids.filter((id: unknown) => typeof id === "string") : [];
    const asSuspend = body.suspend === true;
    if (ids.length === 0) {
      return c.json({ ok: false, message: "ids required" }, 400);
    }
    try {
      const items = submitStockItems({ bucket: name, ids, asSuspend });
      // This submits to queue, so emit for both stock bucket and queue
      emitDockEvent(DOCK_EVENT.REQUESTS, { bucket: name });
      emitDockEvent(DOCK_EVENT.REQUESTS, { bucket: "queue" });
      return new Response(JSON.stringify({ ok: true, items }), {
        headers: { "content-type": "application/json" },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return c.json({ ok: false, message: msg }, 400);
    }
  });

  api.post("/rules/ng-users", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const value = typeof body.userId === "string" ? body.userId.trim() : "";
    if (!value) {
      return c.json({ ok: false, message: "userId is required" }, 400);
    }
    if (body.enable === true) {
      updateRules({ ngUserBlockingEnabled: true });
    }
    const rule = addNgUserId(value);
    return c.json({ ok: true, rule });
  });

  api.delete("/rules/ng-users/:userId", (c) => {
    const raw = c.req.param("userId") ?? "";
    let decoded = raw;
    try {
      decoded = decodeURIComponent(raw);
    } catch (_err) {
      // fallback to raw string
    }
    if (!decoded) {
      return c.json({ ok: false, message: "userId is required" }, 400);
    }
    const rule = removeNgUserId(decoded);
    return c.json({ ok: true, rule });
  });

  api.post("/rules/ng-users/clear", () => {
    const rule = clearNgUserIds();
    return new Response(JSON.stringify({ ok: true, rule }), {
      headers: { "content-type": "application/json" },
    });
  });

  api.post("/requests/:id/play", async (c) => {
    const id = c.req.param("id");
    try {
      const request = await requestService.play(id);
      return c.json({ ok: true, request });
    } catch (err) {
      return c.json({ ok: false, message: err instanceof Error ? err.message : String(err) }, 400);
    }
  });

  api.post("/requests/:id/skip", (c) => {
    const id = c.req.param("id");
    try {
      const request = requestService.skip(id);
      return c.json({ ok: true, request });
    } catch (err) {
      return c.json({ ok: false, message: err instanceof Error ? err.message : String(err) }, 400);
    }
  });

  api.post("/requests/:id/delete", (c) => {
    const id = c.req.param("id");
    const removed = requestService.delete(id);
    return c.json({ ok: true, removed });
  });

  api.post("/requests/:id/reorder", async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json().catch(() => ({}));
    const position = Number(body.position);
    if (!Number.isFinite(position) || position < 1) {
      return c.json({ ok: false, message: "position must be >= 1" }, 400);
    }
    try {
      const request = requestService.reorderQueue(id, Math.floor(position));
      return c.json({ ok: true, request });
    } catch (err) {
      return c.json({ ok: false, message: err instanceof Error ? err.message : String(err) }, 400);
    }
  });

  api.post("/requests/suspend", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const ids = Array.isArray(body.ids)
      ? body.ids.filter((id: unknown) => typeof id === "string")
      : [];
    if (ids.length === 0) {
      return c.json({ ok: false, message: "ids must include at least one id" }, 400);
    }
    const updated = requestService.suspendRequests(ids);
    return c.json({ ok: true, updated: updated.length });
  });

  api.post("/requests/resume", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const ids = Array.isArray(body.ids)
      ? body.ids.filter((id: unknown) => typeof id === "string")
      : [];
    if (ids.length === 0) {
      return c.json({ ok: false, message: "ids must include at least one id" }, 400);
    }
    const updated = requestService.resumeRequests(ids);
    return c.json({ ok: true, updated: updated.length });
  });

  api.post("/requests/clear", () => {
    requestService.clearAll();
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "content-type": "application/json" },
    });
  });

  api.post("/requests/intake/toggle", () => {
    const status = toggleIntakeStatus();
    if (!status.paused) {
      markRequestIntakeOpened();
    }
    return new Response(JSON.stringify({ ok: true, paused: status.paused }), {
      headers: { "content-type": "application/json" },
    });
  });

  api.get("/requests/intake/status", () => {
    const status = getIntakeStatus();
    return new Response(JSON.stringify({ ok: true, paused: status.paused }), {
      headers: { "content-type": "application/json" },
    });
  });

  api.post("/overlay/stop", (c) => {
    const stopped = requestService.stopPlayback();
    return c.json({ ok: true, stopped: Boolean(stopped) });
  });

  api.post("/overlay/autoplay", () => {
    const paused = requestService.toggleAutoplay();
    return new Response(JSON.stringify({ ok: true, paused }), {
      headers: { "content-type": "application/json" },
    });
  });

  api.post("/overlay/shuffle", () => {
    const mode = requestService.cycleShuffleMode();
    return new Response(JSON.stringify({ ok: true, mode }), {
      headers: { "content-type": "application/json" },
    });
  });

  api.post("/overlay/pause", () => {
    const state = requestService.pauseOverlay();
    return new Response(JSON.stringify({ ok: true, state }), {
      headers: { "content-type": "application/json" },
    });
  });

  api.post("/overlay/resume", () => {
    const state = requestService.resumeOverlay();
    return new Response(JSON.stringify({ ok: true, state }), {
      headers: { "content-type": "application/json" },
    });
  });

  api.post("/overlay/seek", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const rawPosition = body.positionSec;
    const rawDelta = body.deltaSec;
    if (rawPosition === undefined && rawDelta === undefined) {
      return c.json({ ok: false, message: "positionSec or deltaSec required" }, 400);
    }
    let targetPosition = typeof rawPosition === "number" ? rawPosition : undefined;
    if (typeof rawDelta === "number") {
      const playback = requestService.summary().currentPlayback;
      if (!playback) {
        return c.json({ ok: false, message: "no track is playing" }, 400);
      }
      targetPosition = (targetPosition ?? playback.positionSec) + rawDelta;
    }
    if (typeof targetPosition !== "number" || Number.isNaN(targetPosition)) {
      return c.json({ ok: false, message: "positionSec must be a number" }, 400);
    }
    try {
      const state = requestService.seekPlayback(targetPosition);
      return c.json({ ok: true, state });
    } catch (err) {
      return c.json({ ok: false, message: err instanceof Error ? err.message : String(err) }, 400);
    }
  });

  api.get("/comments", (c) => {
    const limitParam = c.req.query("limit");
    const limit = limitParam ? Number(limitParam) : 50;
    const items = listRecentComments(Number.isNaN(limit) ? 50 : limit);
    return c.json({ items });
  });

  api.post("/comments/clear", (c) => {
    deleteAllComments();
    resetCommentTracking();
    return c.json({ ok: true });
  });

  api.get("/comments/export", () => {
    const rows = fetchAllCommentsForExport();
    const lines = ["timestamp,user,message"];
    for (const row of rows) {
      lines.push([
        escapeCsv(formatCsvTimestamp(row.timestamp)),
        escapeCsv(row.userName ?? row.userId ?? ""),
        escapeCsv(row.message),
      ].join(","));
    }
    const payload = lines.join("\r\n");
    return new Response(payload, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": "attachment; filename=comments.csv",
      },
    });
  });

  api.get("/logs", (c) => {
    const limitParam = c.req.query("limit");
    const limit = limitParam ? Number(limitParam) : recentLogLimit;
    const items = listPlaybackLogs(Number.isNaN(limit) ? recentLogLimit : limit);
    return c.json({ items });
  });

  api.post("/logs/clear", (c) => {
    clearPlaybackLogs();
    return c.json({ ok: true });
  });

  api.get("/logs/export", () => {
    const rows = fetchAllPlaybackLogs();
    const lines = ["played_at,title,url"];
    for (const row of rows) {
      lines.push([
        escapeCsv(formatCsvTimestamp(row.playedAt)),
        escapeCsv(row.title ?? ""),
        escapeCsv(row.url),
      ].join(","));
    }
    const payload = lines.join("\r\n");
    return new Response(payload, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": "attachment; filename=playback_logs.csv",
      },
    });
  });

  api.get("/system/info", async () => {
    const info = await getSystemInfo(settings);
    return new Response(JSON.stringify(info), { headers: { "content-type": "application/json" } });
  });

  api.post("/system/update/yt-dlp", async () => {
    try {
      const version = await updateYtDlpBinary(settings);
      const info = await getSystemInfo(settings);
      return new Response(JSON.stringify({ ok: true, version, info }), {
        headers: { "content-type": "application/json" },
      });
    } catch (err) {
      return new Response(
        JSON.stringify({ ok: false, message: err instanceof Error ? err.message : String(err) }),
        { status: 500, headers: { "content-type": "application/json" } },
      );
    }
  });

  // Duplicate status endpoints were removed earlier; the handlers are defined above in this router.

  return api;
};
