export type Platform =
  | "debug"
  | "niconico"
  | "youtube"
  | "twitch"
  | "twicas"
  | "mirrativ"
  | "linelive"
  | "openrec"
  | "whowatch"
  | "showroom"
  | "mildom"
  | "bigo"
  | "periscope"
  | "mixch"
  | "other";

export type RequestStatus =
  | "PENDING"
  | "VALIDATING"
  | "REJECTED"
  | "QUEUED"
  | "DOWNLOADING"
  | "READY"
  | "PLAYING"
  | "DONE"
  | "FAILED"
  | "SUSPEND";

export interface RawCommentEvent {
  id: string;
  platform: Platform;
  roomId: string | null;
  userId: string | null;
  userName: string | null;
  message: string;
  timestamp: number;
}

export interface ParsedUrl {
  rawUrl: string;
  normalizedUrl: string;
  videoId: string;
  site: "youtube" | "nicovideo" | "other";
}

export interface RequestItem {
  id: string;
  createdAt: number;
  updatedAt: number;
  commentId: string | null;
  platform: Platform;
  userName: string | null;
  originalMessage: string;
  url: string;
  parsed: ParsedUrl | null;
  title: string | null;
  durationSec: number | null;
  fileName: string | null;
  cacheFilePath: string | null;
  status: RequestStatus;
  statusReason: string | null;
  queuePosition: number | null;
  playStartedAt: number | null;
  playEndedAt: number | null;
  cacheFileSize: number | null;
}

export interface QueueSummary {
  totalItems: number;
  totalPendingItems: number;
  totalDurationSecPending: number;
}

export interface ServerSettings {
  httpPort: number;
  cacheDir: string;
  maxVideoDurationSec: number;
  maxConcurrentDownloads: number;
  ytDlpPath: string;
  denoPath: string;
  ffmpegPath: string | null;
  ytDlpInstallPath: string | null;
  mcvAccessToken: string | null;
}

export interface OverlayPlayMessage {
  type: "play";
  requestId: string;
  url: string;
  title: string | null;
  requester: string | null;
  volume: number;
  loop: boolean;
}

export interface OverlayStopMessage {
  type: "stop";
  fadeMs: number;
}

export interface OverlayPauseMessage {
  type: "pause";
}

export interface OverlayResumeMessage {
  type: "resume";
}

export type OverlayInboundMessage =
  | OverlayPlayMessage
  | OverlayStopMessage
  | OverlayPauseMessage
  | OverlayResumeMessage;

export interface OverlayEndedMessage {
  type: "ended";
  requestId: string;
}

export interface OverlayErrorMessage {
  type: "error";
  requestId: string;
  reason: string;
}

export type OverlayOutboundMessage = OverlayEndedMessage | OverlayErrorMessage;

export interface CommentIngestResult {
  comment: RawCommentEvent;
  request: RequestItem | null;
  warning?: string;
}

export type DebugCommentResponse = CommentIngestResult;

export interface ApiListResponse<T> {
  items: T[];
  total: number;
}
