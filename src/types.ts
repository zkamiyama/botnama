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

export type ShuffleMode = "off" | "priority" | "any";

export interface RawCommentEvent {
  id: string;
  platform: Platform;
  roomId: string | null;
  userId: string | null;
  userName: string | null;
  message: string;
  timestamp: number;
  requestId: string | null;
  requestStatus: RequestStatus | null;
  requestStatusReason: string | null;
}

export interface ParsedUrl {
  rawUrl: string;
  normalizedUrl: string;
  videoId: string;
  site: "youtube" | "nicovideo" | "bilibili" | "other";
}

export interface RequestItem {
  id: string;
  createdAt: number;
  updatedAt: number;
  bucket: string;
  commentId: string | null;
  platform: Platform;
  userId: string | null;
  userName: string | null;
  originalMessage: string;
  url: string;
  parsed: ParsedUrl | null;
  title: string | null;
  durationSec: number | null;
  fileName: string | null;
  cacheFilePath: string | null;
  metaRefreshedAt: number | null;
  uploadedAt: number | null;
  viewCount: number | null;
  likeCount: number | null;
  dislikeCount: number | null;
  commentCount: number | null;
  mylistCount: number | null;
  favoriteCount: number | null;
  danmakuCount: number | null;
  uploader: string | null;
  thumbnailUrl?: string | null;
  status: RequestStatus;
  statusReason: string | null;
  queuePosition: number | null;
  playStartedAt: number | null;
  playEndedAt: number | null;
  cacheFileSize: number | null;
}

export interface PlaybackLogItem {
  id: string;
  requestId: string | null;
  title: string | null;
  url: string;
  playedAt: number;
}

export interface QueueSummary {
  totalItems: number;
  totalPendingItems: number;
  totalDurationSecPending: number;
}

export interface ServerSettings {
  httpPort: number;
  cacheDir: string;
  maxConcurrentDownloads: number;
  ytDlpPath: string;
  denoPath: string;
  ffmpegPath: string | null;
  mcvAccessToken: string | null;
  ytDlpCookiesFromBrowser: string | null;
  ytDlpCookiesFromBrowserProfile: string | null;
  ytDlpCookiesFromBrowserKeyring: string | null;
  ytDlpCookiesFromBrowserContainer: string | null;
  ytDlpInheritStdio?: boolean;
  ytDlpBilibiliProxy?: string | null;
  ytDlpUserAgent?: string | null;
  globalCookiesFromBrowser?: string | null;
  globalCookiesFromBrowserProfile?: string | null;
  youtubeCookiesFrom?: string | null;
  youtubeCookiesProfile?: string | null;
  niconicoCookiesFrom?: string | null;
  niconicoCookiesProfile?: string | null;
  locale: string;
  ytDlpPerDomainTimeoutMs: number;
  ytDlpYouTubeTimeoutMs: number;
  // Notification settings (exposed via rules.json / UI)
  notifyTelopEnabled?: boolean;
  notifyTelopNiconico?: boolean;
  notifyTelopYoutube?: boolean;
  notifyTelopDelayMs?: number;
  // Other flags used through services
  notifyComment?: boolean;
}

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
  notifyComment?: boolean;
  notifyTelop?: boolean;
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

export interface OverlaySeekMessage {
  type: "seek";
  positionSec: number;
}

export type OverlayInboundMessage =
  | OverlayPlayMessage
  | OverlayStopMessage
  | OverlayPauseMessage
  | OverlayResumeMessage
  | OverlaySeekMessage;

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
  comment: RawCommentEvent | null;
  request: RequestItem | null;
  warning?: string;
}

export type DebugCommentResponse = CommentIngestResult;

export interface ApiListResponse<T> {
  items: T[];
  total: number;
}
