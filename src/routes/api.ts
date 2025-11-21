import { Hono } from "hono";
import { handleDebugComment, ingestComment } from "../services/commentService.ts";
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
import { getSystemInfo, updateYtDlpBinary, updateYtDlpEjs } from "../services/systemService.ts";
import { DOCK_EVENT, DockEvent, dockEventBus } from "../events/dockEventBus.ts";
import { subscribeInfoOverlay } from "../events/infoOverlayBus.ts";
import { getIntakeStatus, toggleIntakeStatus } from "../services/intakeService.ts";
import {
  addNgUserId,
  clearNgUserIds,
  getNgUserRule,
  getRules,
  removeNgUserId,
  updateRules,
} from "../services/ruleService.ts";
import { emitInfoOverlay } from "../events/infoOverlayBus.ts";

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

export const createApiRouter = (requestService: RequestService, settings: ServerSettings) => {
  const api = new Hono();
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

  const pushDockEvent = async (event: DockEvent) => {
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
    return {
      event: DOCK_EVENT.REQUESTS,
      payload: {
        summary: requestService.summary(),
        list: requestService.list({ statuses: streamStatuses }),
      },
    };
  };

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
        const send = (event: DockEvent) => {
          pushDockEvent(event)
            .then(({ event, payload }) => write(event, payload))
            .catch((err) => console.error("[DockStream] failed to push event", err));
        };
        const unsubscribe = dockEventBus.subscribe((event) => send(event));
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
    emitInfoOverlay({
      level: "info",
      scope: "status",
      titleKey: locale === "auto" ? "locale_auto" : locale === "ja" ? "locale_ja" : "locale_en",
      message: `locale set to ${currentLocale}`,
    });
    return c.json({ ok: true, locale: currentLocale });
  });

  api.get("/requests", (c) => {
    const statusParam = c.req.query("status");
    const statuses = statusParam
      ? statusParam
        .split(",")
        .map((v) => v.trim().toUpperCase() as RequestStatus)
        .filter((status) => REQUEST_STATUS_SET.has(status))
      : undefined;
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
    const data = requestService.list({ statuses, limit: parsedLimit, offset: parsedOffset });
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

  api.get("/rules/ng-users", () => {
    return new Response(JSON.stringify({ ok: true, rule: getNgUserRule() }), {
      headers: { "content-type": "application/json" },
    });
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

  api.post("/system/update/yt-dlp-ejs", async () => {
    try {
      const version = await updateYtDlpEjs();
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

  return api;
};
