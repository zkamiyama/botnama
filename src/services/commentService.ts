import { insertComment, insertRequest } from "../repositories/requestsRepository.ts";
import { parseRequestUrl } from "./urlParser.ts";
import { CommentIngestResult, Platform, RawCommentEvent, RequestItem } from "../types.ts";
import { createCommentId, createRequestId, nowMs } from "../utils/ids.ts";

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

  if (input.allowRequestCreation !== false) {
    const parsedUrl = parseRequestUrl(normalizedMessage);
    if (parsedUrl) {
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
    } else if (input.warnOnMissingUrl) {
      warning = "URLが見つからないためリクエストは作成されませんでした";
    }
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
    warnOnMissingUrl: true,
  });
