import {
  findActiveByVideo,
  findLatestByVideo,
  getCurrentPlaying,
  insertComment,
  insertRequest,
  countActiveRequestsByOwner,
} from "../repositories/requestsRepository.ts";
import { parseRequestUrl } from "./urlParser.ts";
import { CommentIngestResult, Platform, RawCommentEvent, RequestItem } from "../types.ts";
import { createCommentId, createRequestId, nowMs } from "../utils/ids.ts";
import { isIntakePaused } from "./requestGate.ts";
import { emitInfoOverlay } from "../events/infoOverlayBus.ts";
import {
  compileCustomSiteRegex,
  getCustomSiteRules,
  getDuplicateRule,
  getSiteAllowances,
  getConcurrentLimitRule,
  getNgUserRule,
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

export const ingestComment = (input: IngestCommentInput): CommentIngestResult => {
  const normalizedMessage = input.message.trim();
  if (!normalizedMessage) {
    throw new Error("message is required");
  }
  const intakePaused = isIntakePaused();
  const timestamp = input.timestamp ?? nowMs();
  const commentId = input.commentId ?? createCommentId();

  const comment: RawCommentEvent = {
    id: commentId,
    platform: input.platform,
    roomId: input.roomId ?? null,
    userId: input.userId ?? null,
    userName: input.userName ?? null,
    message: normalizedMessage,
    timestamp,
    requestId: null,
    requestStatus: null,
    requestStatusReason: null,
  };

  insertComment({
    id: comment.id,
    platform: comment.platform,
    roomId: comment.roomId,
    userId: comment.userId,
    userName: comment.userName,
    message: comment.message,
    timestamp: comment.timestamp,
  });

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
      const now = timestamp;
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
          createdAt: timestamp,
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
    const token = (result[1] ?? result[0] ?? rawUrl) ?? rawUrl;
    return {
      rawUrl: normalizedUrl,
      normalizedUrl,
      videoId: `${entry.id}:${token}`,
      site: "other" as const,
    };
  }
  return null;
};
