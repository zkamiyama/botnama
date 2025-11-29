import {
  countActiveRequestsByOwner,
  findActiveByVideo,
  findLatestByVideo,
  getCurrentPlaying,
  insertComment,
  insertRequest,
} from "../repositories/requestsRepository.ts";
import { parseRequestUrl } from "./urlParser.ts";
import { CommentIngestResult, Platform, RawCommentEvent, RequestItem } from "../types.ts";
import { createCommentId, createRequestId, nowMs } from "../utils/ids.ts";
import { isIntakePaused } from "./requestGate.ts";
import { emitInfoOverlay } from "../events/infoOverlayBus.ts";
import {
  compileCustomSiteRegex,
  getConcurrentLimitRule,
  getCustomSiteRules,
  getDuplicateRule,
  getNgUserRule,
  getSiteAllowances,
} from "./ruleService.ts";
import { handleVote } from "./pollService.ts";

interface IngestCommentInput {
  message: string;
  platform: Platform;
  userName?: string | null;
  userId?: string | null;
  roomId?: string | null;
  timestamp?: number;
  commentId?: string | null;
  allowRequestCreation?: boolean;
  warnOnMissingUrl?: boolean;
  queuePosition?: number | null;
}

const BUFFER_WINDOW_MS = 5000;
let requestOpenAt = nowMs();
let lastProcessedAt = 0;
const processedCommentIds = new Map<string, number>();
let buffer: Array<{ input: IngestCommentInput; publishedAt: number; receivedAt: number }> = [];

export const markRequestIntakeOpened = (openedAt = nowMs()) => {
  requestOpenAt = openedAt;
  buffer = [];
};

export const resetCommentTracking = () => {
  processedCommentIds.clear();
  lastProcessedAt = 0;
  buffer = [];
};

type ProcessOutcome = CommentIngestResult | { skipped: string };

const processCore = (
  input: IngestCommentInput,
  publishedAt: number,
): CommentIngestResult => {
  const normalizedMessage = input.message.trim();
  if (!normalizedMessage) {
    throw new Error("message is required");
  }
  const intakePaused = isIntakePaused();
  const commentId = input.commentId ?? createCommentId();

  const comment: RawCommentEvent = {
    id: commentId,
    platform: input.platform,
    roomId: input.roomId ?? null,
    userId: input.userId ?? null,
    userName: input.userName ?? null,
    message: normalizedMessage,
    timestamp: publishedAt,
    requestId: null,
    requestStatus: null,
    requestStatusReason: null,
  };

  try {
    insertComment({
      id: comment.id,
      platform: comment.platform,
      roomId: comment.roomId,
      userId: comment.userId,
      userName: comment.userName,
      message: comment.message,
      timestamp: comment.timestamp,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("UNIQUE constraint failed: comments.id")) {
      return { comment, request: null, warning: "duplicate-comment" };
    }
    throw err;
  }

  let warning: string | undefined;
  let request: RequestItem | null = null;
  const warnOnMissingUrl = input.warnOnMissingUrl ?? false;

  // handle poll votes
  const vote = normalizePollVote(comment.message);
  if (vote) {
    const current = getCurrentPlaying();
    const voter = comment.userId ?? comment.userName ?? comment.platform;
    handleVote(current?.id ?? null, voter ?? "anon", vote);
  }

  if (!intakePaused && input.allowRequestCreation !== false) {
    let parsedUrl = parseRequestUrl(normalizedMessage);
    if (!parsedUrl) {
      parsedUrl = matchCustomSiteUrl(normalizedMessage);
    }
    if (parsedUrl) {
      const ownerId = comment.userId ?? comment.userName ?? null;
      const concurrentRule = getConcurrentLimitRule();
      const ngRule = getNgUserRule();
      const siteRules = getSiteAllowances();
      const siteAllowed = parsedUrl.site === "youtube"
        ? siteRules.youtube
        : parsedUrl.site === "nicovideo"
        ? siteRules.nicovideo
        : parsedUrl.site === "bilibili"
        ? siteRules.bilibili
        : true;
      if (!siteAllowed) {
        warning = "site-disabled";
        emitInfoOverlay({
          level: "warn",
          titleKey: "request_rejected_title",
          messageKey: "reason_site_disabled",
          params: { siteKey: parsedUrl.site },
          userName: comment.userName,
          url: parsedUrl.rawUrl,
          scope: "status",
        });
        return { comment, request, warning };
      }
      const duplicateRule = getDuplicateRule();
      const activeDup = duplicateRule.disallowDuplicates
        ? findActiveByVideo(parsedUrl.site, parsedUrl.videoId)
        : null;
      const lastSeen = findLatestByVideo(parsedUrl.site, parsedUrl.videoId);
      const cooldownMs = Math.max(0, duplicateRule.cooldownMinutes) * 60 * 1000;
      const now = publishedAt;
      const lastPlayedAt = lastSeen?.playEndedAt ??
        (lastSeen?.status === "PLAYING" ? now : null) ??
        lastSeen?.playStartedAt ??
        null;
      const withinCooldown = lastPlayedAt !== null &&
        (cooldownMs === 0 || now - lastPlayedAt < cooldownMs);

      if (activeDup) {
        warning = "duplicate-in-queue";
        emitInfoOverlay({
          level: "warn",
          titleKey: "request_rejected_title",
          messageKey: "reason_duplicate_in_queue",
          params: { url: parsedUrl.rawUrl },
          userName: comment.userName,
          url: parsedUrl.rawUrl,
          scope: "status",
        });
      } else if (withinCooldown) {
        const remainingMs = cooldownMs === 0
          ? Number.POSITIVE_INFINITY
          : cooldownMs - (now - (lastPlayedAt ?? now));
        const remainingMinutes = cooldownMs === 0 ? 0 : Math.max(1, Math.ceil(remainingMs / 60000));
        warning = "cooldown";
        emitInfoOverlay({
          level: "warn",
          titleKey: "request_rejected_title",
          messageKey: "reason_cooldown_wait",
          params: {
            minutes: remainingMinutes,
            url: parsedUrl.rawUrl,
          },
          userName: comment.userName,
          url: parsedUrl.rawUrl,
          scope: "status",
        });
      } else if (ngRule.enabled && ownerId && ngRule.userIds.includes(ownerId)) {
        warning = "ng-user";
        emitInfoOverlay({
          level: "warn",
          titleKey: "request_rejected_title",
          messageKey: "reason_ng_user",
          params: { user: ownerId },
          userName: comment.userName,
          url: parsedUrl.rawUrl,
          scope: "status",
        });
        return { comment, request, warning };
      } else {
        if (concurrentRule.enabled && ownerId) {
          const activeCount = countActiveRequestsByOwner(ownerId);
          if (activeCount >= concurrentRule.maxConcurrent) {
            warning = "concurrent-limit";
            emitInfoOverlay({
              level: "warn",
              titleKey: "request_rejected_title",
              messageKey: "reason_concurrent_limit",
              params: {
                limit: concurrentRule.maxConcurrent,
                user: comment.userName ?? ownerId,
              },
              userName: comment.userName,
              url: parsedUrl.rawUrl,
              scope: "status",
            });
            return { comment, request, warning };
          }
        }
        request = insertRequest({
          id: createRequestId(),
          createdAt: publishedAt,
          commentId: comment.id,
          platform: comment.platform,
          userId: ownerId,
          userName: comment.userName,
          originalMessage: input.message,
          url: parsedUrl.rawUrl,
          parsed: parsedUrl,
          status: "QUEUED",
          queuePosition: input.queuePosition ?? 1,
        });
        comment.requestId = request.id;
        comment.requestStatus = request.status;
        comment.requestStatusReason = request.statusReason ?? null;
      }
    } else if (warnOnMissingUrl) {
      warning = "url-not-found";
      emitInfoOverlay({
        level: "warn",
        titleKey: "request_rejected_title",
        messageKey: "reason_invalid_url",
        params: { url: input.message },
        userName: comment.userName,
        url: input.message,
        scope: "status",
      });
    }
  } else if (intakePaused) {
    warning = "intake-paused";
    emitInfoOverlay({
      level: "warn",
      titleKey: "request_intake_paused_title",
      messageKey: "body_with_reason",
      params: { reason: "Please wait until intake resumes", url: comment.message },
      userName: comment.userName,
      url: comment.message,
      scope: "status",
    });
  }

  return { comment, request, warning };
};

export const handleDebugComment = (
  payload: { message: string; userName?: string | null },
) =>
  ingestComment({
    message: payload.message,
    platform: "debug",
    userId: "debug",
    userName: payload.userName ?? "debug",
    roomId: null,
    warnOnMissingUrl: false,
  });
const normalizePollVote = (text: string): "yes" | "no" | null => {
  const trimmed = text.trim();
  const yesWords = ["いいよ", "延長", "続けて", "go", "yes", "y"];
  const noWords = ["やめよ", "やめよう", "stop", "no", "n", "やめて"];
  if (yesWords.some((w) => trimmed.includes(w))) return "yes";
  if (noWords.some((w) => trimmed.includes(w))) return "no";
  return null;
};

const trimUrlDelimiters = (value: string) => value.replace(/[)\],.;!?]+$/g, "");

const extendUrlMatch = (message: string, value: string) => {
  const trimmed = value.trim();
  if (!trimmed.startsWith("http")) return trimmed;
  const start = message.indexOf(trimmed);
  if (start < 0) return trimmed;
  let end = start + trimmed.length;
  while (end < message.length) {
    const ch = message[end];
    if (/\s/.test(ch)) break;
    end++;
  }
  const expanded = message.slice(start, end);
  return trimUrlDelimiters(expanded.trim());
};

const extractHostFromPattern = (pattern: string): string | null => {
  const trimmed = pattern.trim();
  try {
    if (trimmed.startsWith("/")) {
      const lastSlash = trimmed.lastIndexOf("/");
      const body = trimmed.slice(1, lastSlash);
      const m = body.match(/https?:\\\/\\\/(?:www\\.)?([^\\\/\\)\\s]+)/i);
      if (m) return m[1];
      const hostm = body.match(/([a-z0-9\-]+\\.(?:com|jp|net|io|me|tv|ly|org|co))/i);
      if (hostm) return hostm[1];
      return null;
    }
    if (/^https?:\/\//i.test(trimmed)) {
      try {
        const u = new URL(trimmed);
        return u.hostname;
      } catch (_e) {
        // continue
      }
    }
    // fallback: take until first slash or paren
    const candidate = trimmed.replace(/^https?:\/\//i, "").split(/[/\\(\\s]/)[0];
    return candidate || null;
  } catch (_err) {
    return null;
  }
};

const matchCustomSiteUrl = (message: string) => {
  const rules = getCustomSiteRules();
  for (const entry of rules) {
    const regex = compileCustomSiteRegex(entry.pattern);
    if (!regex) continue;
    const result = regex.exec(message);
    if (!result) continue;
    const fallbackMatched = extendUrlMatch(message, result[0] ?? "");
    const primaryCandidate = extendUrlMatch(message, result[1] ?? "");
    const rawUrl = primaryCandidate || fallbackMatched;
    if (!rawUrl) continue;
    const normalizedUrl = rawUrl.startsWith("http") ? rawUrl : fallbackMatched || rawUrl;
    return {
      rawUrl: normalizedUrl,
      normalizedUrl,
      // Use normalizedUrl itself as the unique key to avoid false duplicates across different links
      videoId: normalizedUrl,
      site: "other" as const,
    };
  }
  // If direct regex patterns didn't match, allow alias-based short form like `sc/ID` if alias is declared
  for (const entry of rules) {
    const alias = typeof entry.alias === "string" && entry.alias.length > 0
      ? entry.alias.toLowerCase()
      : null;
    if (!alias) continue;
    // Match alias/ followed by any non-whitespace characters (path + query allowed)
    const re = new RegExp(`\\b${alias}\\/([^\\s]+)`, "i");
    const m = re.exec(message);
    if (!m) continue;
    let id = m[1];
    // extend using existing helper to capture trailing punctuation-less URL-like fragment
    id = extendUrlMatch(message, id);
    const host = extractHostFromPattern(entry.pattern);
    if (!host) continue;
    // trim trailing punctuation marks from the id
    id = trimUrlDelimiters(id);
    const normalized = `https://${host}/${id}`;
    return {
      rawUrl: normalized,
      normalizedUrl: normalized,
      videoId: normalized,
      site: "other" as const,
    };
  }
  return null;
};

const compareBuffered = (
  a: { publishedAt: number; receivedAt: number },
  b: { publishedAt: number; receivedAt: number },
) => {
  if (a.publishedAt !== b.publishedAt) return a.publishedAt - b.publishedAt;
  return a.receivedAt - b.receivedAt;
};

const shouldSkipByWatermark = (
  commentId: string | null,
  publishedAt: number,
): { skip: boolean; reason?: string } => {
  if (publishedAt < requestOpenAt) {
    return { skip: true, reason: "before-intake-window" };
  }
  if (commentId) {
    const prev = processedCommentIds.get(commentId);
    if (prev !== undefined && publishedAt <= prev) {
      return { skip: true, reason: "duplicate-comment-id" };
    }
  }
  if (publishedAt < lastProcessedAt) {
    return { skip: true, reason: "watermark-old" };
  }
  if (publishedAt === lastProcessedAt && commentId && processedCommentIds.has(commentId)) {
    return { skip: true, reason: "watermark-equal-id" };
  }
  return { skip: false };
};

const finalizeWatermark = (commentId: string | null, publishedAt: number) => {
  if (commentId) {
    processedCommentIds.set(commentId, publishedAt);
  }
  if (publishedAt > lastProcessedAt) lastProcessedAt = publishedAt;
};

const drainBufferIfExpired = (now: number) => {
  if (buffer.length === 0) return [];
  if (now <= requestOpenAt + BUFFER_WINDOW_MS) return [];
  const drained = buffer.slice().sort(compareBuffered);
  buffer = [];
  return drained;
};

const processBatch = (entries: typeof buffer): ProcessOutcome => {
  let latest: ProcessOutcome | null = null;
  for (const entry of entries.sort(compareBuffered)) {
    const commentId = entry.input.commentId ?? null;
    const skip = shouldSkipByWatermark(commentId, entry.publishedAt);
    if (skip.skip) {
      latest = latest ?? { skipped: skip.reason ?? "skipped" };
      continue;
    }
    const result = processCore(entry.input, entry.publishedAt);
    finalizeWatermark(commentId, entry.publishedAt);
    latest = result;
  }
  return latest ?? { skipped: "no-op" };
};

export const ingestComment = (input: IngestCommentInput): CommentIngestResult => {
  const publishedAt = input.timestamp ?? nowMs();
  const receivedAt = nowMs();
  const entry = { input: { ...input, timestamp: publishedAt }, publishedAt, receivedAt };
  const inBufferWindow = publishedAt <= requestOpenAt + BUFFER_WINDOW_MS &&
    publishedAt >= requestOpenAt - BUFFER_WINDOW_MS;

  let batch: typeof buffer = [];
  if (inBufferWindow) {
    buffer.push(entry);
    batch = buffer.slice();
    buffer = [];
  } else {
    const drained = buffer.length > 0 ? buffer.slice().sort(compareBuffered) : [];
    buffer = [];
    batch = [...drained, ...drainBufferIfExpired(receivedAt), entry];
  }

  const outcome = processBatch(batch);
  if ("skipped" in outcome) {
    return {
      comment: null,
      request: null,
      warning: outcome.skipped,
    };
  }
  return outcome;
};

// Export helper for tests
export { matchCustomSiteUrl };
