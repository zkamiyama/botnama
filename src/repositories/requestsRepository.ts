import { getDb, prepare } from "../db.ts";
import { DOCK_EVENT, emitDockEvent } from "../events/dockEventBus.ts";
import { emitInfoOverlay } from "../events/infoOverlayBus.ts";
import {
  ParsedUrl,
  Platform,
  QueueSummary,
  RawCommentEvent,
  RequestItem,
  RequestStatus,
} from "../types.ts";

type RequestRow = {
  id: string;
  created_at: number;
  updated_at: number;
  bucket: string;
  comment_id: string | null;
  platform: string;
  user_id: string | null;
  user_name: string | null;
  original_message: string;
  url: string;
  parsed_site: string | null;
  parsed_video_id: string | null;
  parsed_normalized_url: string | null;
  title: string | null;
  duration_sec: number | null;
  thumbnail_url: string | null;
  uploaded_at: number | null;
  view_count: number | null;
  like_count: number | null;
  dislike_count: number | null;
  comment_count: number | null;
  mylist_count: number | null;
  favorite_count: number | null;
  danmaku_count: number | null;
  uploader: string | null;
  status: RequestStatus;
  status_reason: string | null;
  queue_position: number | null;
  play_started_at: number | null;
  play_ended_at: number | null;
  file_name: string | null;
  cache_file_path: string | null;
  cache_file_size: number | null;
  meta_refreshed_at: number | null;
};

type SqliteValue = string | number | bigint | Uint8Array | null;

const ORDERED_STATUSES: RequestStatus[] = [
  "QUEUED",
  "VALIDATING",
  "DOWNLOADING",
  "READY",
  "DONE",
  "SUSPEND",
];
const ORDERED_STATUS_SQL = ORDERED_STATUSES.map((status) => `'${status}'`).join(", ");
const ORDER_BY_QUEUE = `
  CASE
    WHEN status = 'PLAYING' THEN -1
    WHEN status IN (${ORDERED_STATUS_SQL}) THEN 0
    ELSE 1
  END,
  queue_position IS NULL,
  queue_position ASC,
  created_at ASC
`;

const rowToRequest = (row: RequestRow): RequestItem => ({
  id: row.id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  bucket: (row as RequestRow & { bucket?: string }).bucket ?? "queue",
  commentId: row.comment_id,
  platform: row.platform as Platform,
  userId: row.user_id,
  userName: row.user_name,
  originalMessage: row.original_message,
  url: row.url,
  parsed: row.parsed_site && row.parsed_video_id && row.parsed_normalized_url
    ? {
      rawUrl: row.url,
      normalizedUrl: row.parsed_normalized_url,
      videoId: row.parsed_video_id,
      site: row.parsed_site as ParsedUrl["site"],
    }
    : null,
  title: row.title,
  durationSec: row.duration_sec,
  uploadedAt: row.uploaded_at,
  viewCount: row.view_count,
  likeCount: row.like_count,
  dislikeCount: row.dislike_count,
  commentCount: row.comment_count,
  mylistCount: row.mylist_count,
  favoriteCount: row.favorite_count,
  danmakuCount: row.danmaku_count,
  uploader: row.uploader,
  fileName: row.file_name,
  cacheFilePath: row.cache_file_path,
  metaRefreshedAt: row.meta_refreshed_at ?? null,
  status: row.status,
  statusReason: row.status_reason,
  queuePosition: row.queue_position,
  playStartedAt: row.play_started_at,
  playEndedAt: row.play_ended_at,
  cacheFileSize: row.cache_file_size,
});

export interface CreateRequestInput {
  id: string;
  createdAt: number;
  commentId: string | null;
  platform: string;
  userId: string | null;
  userName: string | null;
  originalMessage: string;
  url: string;
  parsed: ParsedUrl | null;
  status: RequestStatus;
  queuePosition?: number | null;
  bucket?: string;
}

export const insertComment = (input: {
  id: string;
  platform: string;
  roomId: string | null;
  userId: string | null;
  userName: string | null;
  message: string;
  timestamp: number;
}) => {
  const db = getDb();
  const stmt = prepare(db, `
    INSERT INTO comments (id, platform, room_id, user_id, user_name, message, timestamp)
    VALUES (:id, :platform, :roomId, :userId, :userName, :message, :timestamp)
  `);
  stmt.run(input);
  emitDockEvent(DOCK_EVENT.COMMENTS);
};

const updateCommentRequestState = (
  commentId: string,
  state: {
    requestId?: string | null;
    requestStatus?: RequestStatus | null;
    requestStatusReason?: string | null;
  },
) => {
  const db = getDb();
  const patch: Record<string, SqliteValue | undefined> = {};
  if (state.requestId !== undefined) patch.request_id = state.requestId;
  if (state.requestStatus !== undefined) patch.request_status = state.requestStatus;
  if (state.requestStatusReason !== undefined) {
    patch.request_status_reason = state.requestStatusReason;
  }
  const entries = Object.entries(patch).filter(([, value]) => value !== undefined);
  if (entries.length === 0) return;
  const columns = entries.map(([key]) => `${key} = :${key}`).join(", ");
  const bind: Record<string, SqliteValue> = {};
  for (const [key, value] of entries) {
    bind[key] = value ?? null;
  }
  prepare(db, `UPDATE comments SET ${columns} WHERE id = :id`).run({ ...bind, id: commentId });
  emitDockEvent(DOCK_EVENT.COMMENTS);
};

const getNextQueuePosition = () => {
  const db = getDb();
  const row = prepare(db, "SELECT MAX(queue_position) as maxPos FROM requests WHERE queue_position IS NOT NULL")
    .get() as { maxPos: number | null };
  const maxPos = typeof row?.maxPos === "number" && Number.isFinite(row.maxPos) ? row.maxPos : 0;
  return maxPos + 1;
};

export const nextQueuePosition = () => getNextQueuePosition();

export const insertRequest = (input: CreateRequestInput): RequestItem => {
  const db = getDb();
  const queuePosition = input.queuePosition ?? getNextQueuePosition();
  const stmt = prepare(db, `
    INSERT INTO requests (
      id, created_at, updated_at,
      bucket,
      comment_id, platform, user_id, user_name, original_message,
      url, parsed_site, parsed_video_id, parsed_normalized_url,
      title, duration_sec, thumbnail_url,
      uploaded_at, view_count, like_count, dislike_count, comment_count,
      mylist_count, favorite_count, danmaku_count, uploader,
      status, status_reason, queue_position,
      play_started_at, play_ended_at,
      file_name, cache_file_path, cache_file_size, meta_refreshed_at
    ) VALUES (
      :id, :createdAt, :updatedAt,
      :bucket,
      :commentId, :platform, :userId, :userName, :originalMessage,
      :url, :parsedSite, :parsedVideoId, :parsedNormalizedUrl,
      :title, :durationSec, :thumbnailUrl,
      :uploadedAt, :viewCount, :likeCount, :dislikeCount, :commentCount,
      :mylistCount, :favoriteCount, :danmakuCount, :uploader,
      :status, :statusReason, :queuePosition,
      :playStartedAt, :playEndedAt,
      :fileName, :cacheFilePath, :cacheFileSize, :metaRefreshedAt
    )
  `);
  stmt.run({
    id: input.id,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
    commentId: input.commentId,
    bucket: (input as { bucket?: string }).bucket ?? "queue",
    platform: input.platform,
    userId: input.userId,
    userName: input.userName,
    originalMessage: input.originalMessage,
    url: input.url,
    parsedSite: input.parsed?.site ?? null,
    parsedVideoId: input.parsed?.videoId ?? null,
    parsedNormalizedUrl: input.parsed?.normalizedUrl ?? null,
    title: null,
    durationSec: null,
    thumbnailUrl: null,
    uploadedAt: null,
    viewCount: null,
    likeCount: null,
    dislikeCount: null,
    commentCount: null,
    mylistCount: null,
    favoriteCount: null,
    danmakuCount: null,
    uploader: null,
    status: input.status,
    statusReason: null,
    queuePosition,
    playStartedAt: null,
    playEndedAt: null,
    fileName: null,
    cacheFilePath: null,
    cacheFileSize: null,
    metaRefreshedAt: null,
  });
  if (input.commentId) {
    updateCommentRequestState(input.commentId, {
      requestId: input.id,
      requestStatus: input.status,
      requestStatusReason: null,
    });
  }
  const row = getById(input.id);
  if (!row) {
    throw new Error("failed to fetch newly inserted request");
  }
  emitDockEvent(DOCK_EVENT.REQUESTS, { bucket: row.bucket });
  return row;
};

export const updateRequestFields = (
  id: string,
  fields: Record<string, SqliteValue | undefined>,
): RequestItem => {
  const db = getDb();
  const entries = Object.entries(fields).filter((entry): entry is [string, SqliteValue] =>
    entry[1] !== undefined
  );
  if (entries.length === 0) {
    const existing = getById(id);
    if (!existing) {
      throw new Error(`request ${id} not found`);
    }
    return existing;
  }
  const columns = entries
    .map(([key]) => `${key} = :${key}`)
    .join(", ");
  const stmt = prepare(db, `
    UPDATE requests SET ${columns}, updated_at = :updatedAt
    WHERE id = :id
  `);
  const bind: Record<string, SqliteValue> = {};
  for (const [key, value] of entries) {
    bind[key] = value;
  }
  stmt.run({ ...bind, updatedAt: Date.now(), id });
  const updated = getById(id);
  if (!updated) {
    throw new Error(`request ${id} not found after update`);
  }
  emitDockEvent(DOCK_EVENT.REQUESTS, { bucket: updated.bucket });
  return updated;
};

export const updateStatus = (id: string, status: RequestStatus, reason?: string | null) => {
  const before = getById(id);
  const updated = updateRequestFields(id, {
    status,
    status_reason: reason ?? null,
    queue_position: status === "DONE" ? null : undefined,
  });
  const detail = reason ?? updated.statusReason ?? undefined;
  if (updated.commentId) {
    updateCommentRequestState(updated.commentId, {
      requestId: updated.id,
      requestStatus: status,
      requestStatusReason: detail ?? null,
    });
  }
  if (
    status === "READY" &&
    reason !== "STOP" &&
    (!before || before.status !== "READY") &&
    updated.bucket === "queue"
  ) {
    emitInfoOverlay({
      level: "info",
      titleKey: "request_accepted_title",
      messageKey: "request_accepted_full",
      params: { url: updated.url },
      requestId: updated.id,
      userName: updated.userName,
      url: updated.url,
      scope: "info",
    });
  }
  if (status === "REJECTED" || status === "FAILED") {
    const titleKey = status === "FAILED" ? "request_failed_title" : "request_rejected_title";
    const normalizedReason = typeof detail === "string" ? detail.trim() : "";
    const hasReason = normalizedReason.length > 0;
    emitInfoOverlay({
      level: status === "FAILED" ? "error" : "warn",
      titleKey,
      messageKey: hasReason ? "body_with_reason" : "request_rejected_full",
      params: hasReason
        ? { reason: normalizedReason, url: updated.url }
        : { url: updated.url },
      requestId: updated.id,
      userName: updated.userName,
      url: updated.url,
      scope: "status",
    });
  }
  if (status === "REJECTED" || status === "FAILED") {
    deleteRequest(updated.id, { preserveCommentState: true });
  }
  return updated;
};

export const updatePlaybackTimestamps = (id: string, start: number | null, end: number | null) => {
  return updateRequestFields(id, {
    play_started_at: start,
    play_ended_at: end,
  });
};

export const listRequests = (
  params: { statuses?: RequestStatus[]; limit?: number; offset?: number; bucket?: string },
) => {
  const db = getDb();
  const clauses: string[] = [];
  const bucket = params.bucket ?? "queue";
  clauses.push(`bucket = '${bucket.replaceAll("'", "''")}'`);
  if (params.statuses && params.statuses.length > 0) {
    const quoted = params.statuses.map((status) => `'${status}'`).join(", ");
    clauses.push(`status IN (${quoted})`);
  }
  const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  const limitClause = typeof params.limit === "number" && Number.isFinite(params.limit)
    ? `LIMIT ${params.limit}`
    : "";
  const offsetClause = typeof params.offset === "number" && Number.isFinite(params.offset)
    ? `OFFSET ${params.offset}`
    : "";
  const stmt = prepare(db,
    `SELECT * FROM requests ${where} ORDER BY ${ORDER_BY_QUEUE} ${limitClause} ${offsetClause}`,
  );
  const rows = stmt.all() as RequestRow[];
  const totalStmt = prepare(db, `SELECT COUNT(*) as total FROM requests ${where}`);
  const totalRow = totalStmt.get() as { total: number } | undefined;
  return {
    items: rows.map(rowToRequest),
    total: totalRow?.total ?? 0,
  };
};

export const reorderRequestPosition = (id: string, desiredPosition: number): RequestItem => {
  if (!Number.isFinite(desiredPosition)) {
    throw new Error("position must be a number");
  }
  const safePosition = Math.max(1, Math.floor(desiredPosition));
  return updateRequestFields(id, {
    queue_position: safePosition,
  });
};

export const getById = (id: string): RequestItem | null => {
  const db = getDb();
  const row = prepare(db, "SELECT * FROM requests WHERE id = :id").get({ id }) as
    | RequestRow
    | undefined;
  return row ? rowToRequest(row) : null;
};

export const getCurrentPlaying = (): RequestItem | null => {
  const db = getDb();
  const row = prepare(db, "SELECT * FROM requests WHERE status = 'PLAYING' AND bucket = 'queue' LIMIT 1").get() as
    | RequestRow
    | undefined;
  return row ? rowToRequest(row) : null;
};

export const deleteRequest = (id: string, options?: { preserveCommentState?: boolean }) => {
  const db = getDb();
  let commentId: string | null = null;
  const existing = getById(id);
  if (!options?.preserveCommentState) {
    commentId = existing?.commentId ?? null;
  }
  prepare(db, `UPDATE playback_logs SET request_id = NULL WHERE request_id = :id`).run({ id });
  const stmt = prepare(db, `DELETE FROM requests WHERE id = :id`);
  stmt.run({ id });
  if (commentId) {
    updateCommentRequestState(commentId, {
      requestId: null,
      requestStatus: null,
      requestStatusReason: null,
    });
  }
  emitDockEvent(DOCK_EVENT.REQUESTS, { bucket: existing?.bucket });
};

export const deleteAllRequests = () => {
  const db = getDb();
  db.execute(`UPDATE playback_logs SET request_id = NULL`);
  db.execute(`DELETE FROM requests`);
  db.execute(`
    UPDATE comments
    SET request_id = NULL,
        request_status = NULL,
        request_status_reason = NULL
    WHERE request_status IS NULL OR request_status NOT IN ('FAILED','REJECTED')
  `);
  emitDockEvent(DOCK_EVENT.REQUESTS, { bucket: null });
  emitDockEvent(DOCK_EVENT.COMMENTS);
};

export const countActiveRequestsByOwner = (ownerId: string): number => {
  const db = getDb();
  const row = prepare(db, `
    SELECT COUNT(*) as total
    FROM requests
    WHERE status NOT IN ('DONE','FAILED','REJECTED')
      AND (
        user_id = :ownerId
        OR (user_id IS NULL AND user_name = :ownerId)
      )
  `).get({ ownerId }) as { total: number } | undefined;
  return row?.total ?? 0;
};

export const deleteAllComments = () => {
  const db = getDb();
  db.execute(`UPDATE requests SET comment_id = NULL WHERE comment_id IS NOT NULL`);
  db.execute(`DELETE FROM comments`);
  emitDockEvent(DOCK_EVENT.REQUESTS, { bucket: null });
  emitDockEvent(DOCK_EVENT.COMMENTS);
};

export const fetchQueueSummary = (): QueueSummary => {
  const db = getDb();
  const totalRow = prepare(db, `SELECT COUNT(*) as total FROM requests WHERE bucket = 'queue'`).get() as { total: number };
  const pendingRow = prepare(db, `
    SELECT COUNT(*) as pendingItems, COALESCE(SUM(duration_sec), 0) as pendingDuration
    FROM requests
    WHERE bucket = 'queue' AND status IN ('QUEUED','DOWNLOADING','READY') AND duration_sec IS NOT NULL
  `).get() as { pendingItems: number; pendingDuration: number };
  return {
    totalItems: totalRow?.total ?? 0,
    totalPendingItems: pendingRow?.pendingItems ?? 0,
    totalDurationSecPending: pendingRow?.pendingDuration ?? 0,
  };
};

export const countByStatus = (status: RequestStatus, bucket?: string) => {
  const db = getDb();
  const sql = `SELECT COUNT(*) as total FROM requests WHERE status = :status${bucket ? " AND bucket = :bucket" : ""
    }`;
  const params: Record<string, SqliteValue> = { status };
  if (bucket) params.bucket = bucket;
  const row = prepare(db, sql).get(params) as {
    total: number;
  };
  return row?.total ?? 0;
};

export const resetPlayingExcept = (requestId: string | null) => {
  const db = getDb();
  if (requestId) {
    prepare(db, `
      UPDATE requests
      SET status = 'READY', play_started_at = NULL, updated_at = :now
      WHERE status = 'PLAYING' AND bucket = 'queue' AND id != :requestId
    `).run({ now: Date.now(), requestId });
  } else {
    prepare(db, `
      UPDATE requests
      SET status = 'READY', play_started_at = NULL, updated_at = :now
      WHERE status = 'PLAYING' AND bucket = 'queue'
    `).run({ now: Date.now() });
  }
  emitDockEvent(DOCK_EVENT.REQUESTS, { bucket: "queue" });
};

export const listDownloadableRequests = (limit: number, bucket = "queue") => {
  const db = getDb();
  const safeLimit = Math.max(1, limit);
  const stmt = prepare(db, `
    SELECT * FROM requests
    WHERE status = 'QUEUED' AND bucket = :bucket
    ORDER BY queue_position ASC, created_at ASC
    LIMIT ${safeLimit}
  `);
  const rows = stmt.all({ bucket }) as RequestRow[];
  return rows.map(rowToRequest);
};

export const findActiveByVideo = (site: string, videoId: string) => {
  const db = getDb();
  const stmt = prepare(db, `
    SELECT * FROM requests
    WHERE parsed_site = :site
      AND parsed_video_id = :videoId
      AND bucket = 'queue'
      AND status IN ('QUEUED','VALIDATING','DOWNLOADING','READY','PLAYING','SUSPEND')
    ORDER BY created_at ASC
    LIMIT 1
  `);
  const row = stmt.get({ site, videoId }) as RequestRow | undefined;
  return row ? rowToRequest(row) : null;
};

export const findLatestByVideo = (site: string, videoId: string) => {
  const db = getDb();
  const stmt = prepare(db, `
    SELECT * FROM requests
    WHERE parsed_site = :site
      AND parsed_video_id = :videoId
      AND bucket = 'queue'
    ORDER BY
      COALESCE(play_ended_at, updated_at, created_at) DESC
    LIMIT 1
  `);
  const row = stmt.get({ site, videoId }) as RequestRow | undefined;
  return row ? rowToRequest(row) : null;
};

export const updateDownloadMetadata = (
  id: string,
  metadata: {
    title?: string | null;
    durationSec?: number | null;
    uploadedAt?: number | null;
    viewCount?: number | null;
    likeCount?: number | null;
    dislikeCount?: number | null;
    commentCount?: number | null;
    mylistCount?: number | null;
    favoriteCount?: number | null;
    danmakuCount?: number | null;
    uploader?: string | null;
    metaRefreshedAt?: number | null;
    fileName?: string | null;
    cacheFilePath?: string | null;
    cacheFileSize?: number | null;
  },
) => {
  const patch: Record<string, SqliteValue | undefined> = {};
  if (metadata.title !== undefined) patch.title = metadata.title;
  if (metadata.durationSec !== undefined) patch.duration_sec = metadata.durationSec;
  if (metadata.uploadedAt !== undefined) patch.uploaded_at = metadata.uploadedAt;
  if (metadata.viewCount !== undefined) patch.view_count = metadata.viewCount;
  if (metadata.likeCount !== undefined) patch.like_count = metadata.likeCount;
  if (metadata.dislikeCount !== undefined) patch.dislike_count = metadata.dislikeCount;
  if (metadata.commentCount !== undefined) patch.comment_count = metadata.commentCount;
  if (metadata.mylistCount !== undefined) patch.mylist_count = metadata.mylistCount;
  if (metadata.favoriteCount !== undefined) patch.favorite_count = metadata.favoriteCount;
  if (metadata.danmakuCount !== undefined) patch.danmaku_count = metadata.danmakuCount;
  if (metadata.uploader !== undefined) patch.uploader = metadata.uploader;
  if (metadata.thumbnailUrl !== undefined) patch.thumbnail_url = metadata.thumbnailUrl;
  if (metadata.metaRefreshedAt !== undefined) patch.meta_refreshed_at = metadata.metaRefreshedAt;
  if (metadata.fileName !== undefined) patch.file_name = metadata.fileName;
  if (metadata.cacheFilePath !== undefined) patch.cache_file_path = metadata.cacheFilePath;
  if (metadata.cacheFileSize !== undefined) patch.cache_file_size = metadata.cacheFileSize;
  return updateRequestFields(id, patch);
};

export const fetchNextReadyRequest = (bucket = "queue"): RequestItem | null => {
  const db = getDb();
  const stmt = prepare(db, `
    SELECT * FROM requests
    WHERE status = 'READY' AND bucket = :bucket
    ORDER BY queue_position ASC, created_at ASC
    LIMIT 1
  `);
  const row = stmt.get({ bucket }) as RequestRow | undefined;
  return row ? rowToRequest(row) : null;
};

export const listReadyRequests = (bucket = "queue"): RequestItem[] => {
  const db = getDb();
  const rows = prepare(db, `
    SELECT * FROM requests
    WHERE status = 'READY' AND bucket = :bucket
    ORDER BY queue_position ASC, created_at ASC
  `).all({ bucket }) as RequestRow[];
  return rows.map((row) => rowToRequest(row));
};

export const listRecentComments = (limit: number): RawCommentEvent[] => {
  const db = getDb();
  const safeLimit = Math.max(1, Math.min(limit, 200));
  const stmt = prepare(db, `
    SELECT c.id, c.platform, c.room_id, c.user_id, c.user_name, c.message, c.timestamp,
      c.request_id as comment_request_id,
      c.request_status as comment_request_status,
      c.request_status_reason as comment_request_status_reason,
      req_lookup.request_id as fallback_request_id,
      req_detail.status as fallback_request_status,
      req_detail.status_reason as fallback_request_status_reason
    FROM comments c
    LEFT JOIN (
      SELECT comment_id, MIN(id) as request_id
      FROM requests
      WHERE comment_id IS NOT NULL
      GROUP BY comment_id
    ) req_lookup ON req_lookup.comment_id = c.id
    LEFT JOIN requests req_detail ON req_detail.id = req_lookup.request_id
    ORDER BY c.timestamp DESC
    LIMIT :limit
  `);
  const rows = stmt.all({ limit: safeLimit }) as Array<{
    id: string;
    platform: string;
    room_id: string | null;
    user_id: string | null;
    user_name: string | null;
    message: string;
    timestamp: number;
    comment_request_id: string | null;
    comment_request_status: RequestStatus | null;
    comment_request_status_reason: string | null;
    fallback_request_id: string | null;
    fallback_request_status: RequestStatus | null;
    fallback_request_status_reason: string | null;
  }>;
  return rows.map((row) => ({
    id: row.id,
    platform: row.platform as Platform,
    roomId: row.room_id,
    userId: row.user_id,
    userName: row.user_name,
    message: row.message,
    timestamp: row.timestamp,
    requestId: row.comment_request_id ?? row.fallback_request_id ?? null,
    requestStatus: row.comment_request_status ?? row.fallback_request_status ?? null,
    requestStatusReason: row.comment_request_status_reason ?? row.fallback_request_status_reason ?? null,
  }));
};

export const listBuckets = (): string[] => {
  const db = getDb();
  const rows = prepare(db, `SELECT DISTINCT bucket FROM requests`).all() as Array<{ bucket: string }>;
  const names = rows.map((r) => r.bucket).filter(Boolean);
  if (!names.includes("queue")) names.push("queue");
  return names;
};

export const fetchAllCommentsForExport = (): RawCommentEvent[] => {
  const db = getDb();
  const rows = prepare(db, `
    SELECT id, platform, room_id, user_id, user_name, message, timestamp
    FROM comments
    ORDER BY timestamp DESC
  `).all() as Array<{
    id: string;
    platform: string;
    room_id: string | null;
    user_id: string | null;
    user_name: string | null;
    message: string;
    timestamp: number;
  }>;
  return rows.map((row) => ({
    id: row.id,
    platform: row.platform as Platform,
    roomId: row.room_id,
    userId: row.user_id,
    userName: row.user_name,
    message: row.message,
    timestamp: row.timestamp,
    requestId: null,
    requestStatus: null,
    requestStatusReason: null,
  }));
};
