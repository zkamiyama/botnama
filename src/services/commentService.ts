import {
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
import { getDuplicateRule } from "./ruleService.ts";
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
    const parsedUrl = parseRequestUrl(normalizedMessage);
    if (parsedUrl) {
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
      const withinCooldown = lastPlayedAt !== null && (cooldownMs === 0 || now - lastPlayedAt < cooldownMs);

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
        const remainingMs = cooldownMs === 0 ? Number.POSITIVE_INFINITY : cooldownMs - (now - (lastPlayedAt ?? now));
        const remainingMinutes = cooldownMs === 0
          ? 0
          : Math.max(1, Math.ceil(remainingMs / 60000));
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
      } else {
        request = insertRequest({
          id: createRequestId(),
          createdAt: timestamp,
          commentId: comment.id,
          platform: comment.platform,
          userName: comment.userName,
          originalMessage: input.message,
          url: parsedUrl.rawUrl,
          parsed: parsedUrl,
          status: "QUEUED",
          queuePosition: input.queuePosition ?? 1,
        });
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
