import {
  countByStatus,
  deleteAllRequests,
  deleteRequest,
  fetchNextReadyRequest,
  fetchQueueSummary,
  getById,
  nextQueuePosition,
  listReadyRequests,
  listRequests,
  reorderRequestPosition,
  resetPlayingExcept,
  updatePlaybackTimestamps,
  updateRequestFields,
  updateStatus,
} from "../repositories/requestsRepository.ts";
import { insertPlaybackLog } from "../repositories/playbackLogsRepository.ts";
import { ApiListResponse, QueueSummary, RequestItem, RequestStatus, ShuffleMode } from "../types.ts";
import { OverlayHub } from "../websocket/overlayHub.ts";
import { DOCK_EVENT, emitDockEvent } from "../events/dockEventBus.ts";
import { join } from "@std/path/join";
import { resolve } from "@std/path/resolve";
import { isIntakePaused, toggleIntake } from "./requestGate.ts";
import { emitInfoOverlay } from "../events/infoOverlayBus.ts";
import { fetchVideoMetadata } from "./metadataService.ts";
import { loadServerSettings } from "../settings.ts";
import {
  configurePollRules,
  onPlaybackStarted,
  resetPoll,
  setPollRejectHandler,
} from "./pollService.ts";
import { getPollRule } from "./ruleService.ts";

const ORDER_EDITABLE_STATUSES = new Set<RequestStatus>([
  "QUEUED",
  "VALIDATING",
  "DOWNLOADING",
  "READY",
  "DONE",
  "SUSPEND",
]);
const SUSPENDABLE_STATUSES = new Set<RequestStatus>([
  "QUEUED",
  "VALIDATING",
  "DOWNLOADING",
  "READY",
]);
const RESUMABLE_STATUSES = new Set<RequestStatus>([
  "QUEUED",
  "VALIDATING",
  "DOWNLOADING",
  "READY",
  "DONE",
]);
const REQUEST_STATUS_VALUES: RequestStatus[] = [
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
];

const SHUFFLE_MODES: ShuffleMode[] = ["off", "priority", "any"];

const PLAYBACK_BAND_TARGET_MS = 30_000;
const PLAYBACK_BAND_MIN_MS = 5_000;
const PLAYBACK_BAND_HEADROOM_MS = 1_000;

const computePlaybackBandDurationMs = (durationSec: number | null | undefined) => {
  if (typeof durationSec !== "number" || !Number.isFinite(durationSec) || durationSec <= 0) {
    return PLAYBACK_BAND_TARGET_MS;
  }
  const durationMs = durationSec * 1000;
  if (durationMs < PLAYBACK_BAND_TARGET_MS) {
    const candidate = durationMs - PLAYBACK_BAND_HEADROOM_MS;
    return Math.max(PLAYBACK_BAND_MIN_MS, Math.max(candidate, 0));
  }
  return PLAYBACK_BAND_TARGET_MS;
};

const toRequestStatus = (value: string | null): RequestStatus | null => {
  if (!value) return null;
  return REQUEST_STATUS_VALUES.includes(value as RequestStatus) ? value as RequestStatus : null;
};

export class RequestService {
  #overlayHub: OverlayHub;
  #currentPlayingId: string | null = null;
  #autoplayPaused = false;
  #shuffleMode: ShuffleMode = "off";
  #playbackPaused = false;
  #pausedPositionSec = 0;
  #cacheDir: string | null;
  #metaStaleMs = 6 * 60 * 60 * 1000; // 6 hours

  constructor(overlayHub: OverlayHub, options: { cacheDir?: string } = {}) {
    this.#overlayHub = overlayHub;
    this.#cacheDir = options.cacheDir ?? null;
    setPollRejectHandler(() => {
      if (this.#currentPlayingId) {
        try {
          this.skip(this.#currentPlayingId);
        } catch (err) {
          console.error("[RequestService] poll reject skip failed", err);
        }
      } else {
        this.stopPlayback();
      }
    });
  }

  list(
    params: { statuses?: RequestStatus[]; limit?: number; offset?: number; bucket?: string },
  ): ApiListResponse<RequestItem> {
    return listRequests(params);
  }

  summary(): QueueSummary & {
    overlayConnected: boolean;
    downloadingCount: number;
    currentPlayingId: string | null;
    autoplayPaused: boolean;
    intakePaused: boolean;
    shuffleMode: ShuffleMode;
    currentPlayback: {
      id: string;
      title: string | null;
      durationSec: number | null;
      positionSec: number;
      isPlaying: boolean;
    } | null;
  } {
    const base = fetchQueueSummary();
    const currentPlayback = this.#buildPlaybackInfo();
    return {
      ...base,
      overlayConnected: this.#overlayHub.overlayConnected,
      downloadingCount: countByStatus("DOWNLOADING"),
      currentPlayingId: this.#currentPlayingId,
      autoplayPaused: this.#autoplayPaused,
      shuffleMode: this.#shuffleMode,
      intakePaused: isIntakePaused(),
      currentPlayback,
    };
  }

  async play(requestId: string) {
    let request = getById(requestId);
    if (!request) {
      throw new Error("request not found");
    }
    if (!request.fileName) {
      throw new Error("media not cached yet");
    }
    if (!["READY", "DONE"].includes(request.status)) {
      throw new Error("only READY or DONE can be played");
    }
    if (!this.#ensureCachedMediaAvailable(request)) {
      throw new Error("cache missing; re-download started");
    }
    try {
      request = await this.#refreshMetadataIfStale(request);
    } catch (err) {
      console.warn("[RequestService] metadata refresh failed", err);
    }
    // configure poll for this playback
    configurePollRules({
      enabled: getPollRule().enabled,
      intervalSec: getPollRule().intervalSec,
      voteWindowSec: getPollRule().windowSec,
      stopDelaySec: getPollRule().stopDelaySec,
    });
    console.log(`[RequestService] play -> ${requestId} (status=${request.status})`);
    resetPlayingExcept(requestId);
    const updated = updateRequestFields(request.id, {
      status: "PLAYING",
      play_started_at: Date.now(),
      play_ended_at: null,
    });
    this.#playbackPaused = false;
    this.#pausedPositionSec = 0;
    if (this.#currentPlayingId && this.#currentPlayingId !== request.id) {
      console.log(
        `[RequestService] stopping previous overlay playback ${this.#currentPlayingId} before ${request.id}`,
      );
      this.#overlayHub.stop(100);
    }
    this.#overlayHub.play(updated);
    onPlaybackStarted(updated);
    this.#currentPlayingId = updated.id;
    emitDockEvent(DOCK_EVENT.REQUESTS);
    console.log(`[RequestService] overlay play signal sent for ${updated.id}`);
    insertPlaybackLog({
      requestId: updated.id,
      title: updated.title,
      url: updated.url,
      playedAt: Date.now(),
    });
    const playbackOverlayDurationMs = computePlaybackBandDurationMs(updated.durationSec ?? null);
    // 1) タイトル帯（上段）：再生開始ラベルは付けず、タイトルのみ
    const normalizedTitle = (updated.title ?? "").trim();
    const infoSegments = [];
    if (normalizedTitle.length > 0) infoSegments.push(normalizedTitle);
    if (updated.url) infoSegments.push(updated.url);
    const infoMessage = infoSegments.length > 0 ? infoSegments.join(" ") : (updated.url ?? "");
    emitInfoOverlay({
      level: "info",
      message: infoMessage,
      requestId: updated.id,
      userName: updated.userName,
      url: updated.url,
      scope: "info",
      durationMs: playbackOverlayDurationMs,
    });
    // 2) 統計帯（下段）：URL＋統計のみ
    const queueSummary = fetchQueueSummary();
    emitInfoOverlay({
      level: "info",
      message: "",
      requestId: updated.id,
      userName: updated.userName,
      url: updated.url,
      scope: "status",
      durationMs: playbackOverlayDurationMs,
      stats: {
        uploadedAt: updated.uploadedAt ?? null,
        durationSec: updated.durationSec ?? null,
        viewCount: updated.viewCount ?? null,
        likeCount: updated.likeCount ?? null,
        dislikeCount: updated.dislikeCount ?? null,
        commentCount: updated.commentCount ?? null,
        mylistCount: updated.mylistCount ?? null,
        favoriteCount: updated.favoriteCount ?? null,
        danmakuCount: updated.danmakuCount ?? null,
        uploader: updated.uploader ?? null,
        site: updated.parsed?.site ?? "other",
        metaRefreshedAt: updated.metaRefreshedAt ?? Date.now(),
        pendingItems: queueSummary.totalPendingItems ?? null,
        pendingDurationSec: queueSummary.totalDurationSecPending ?? null,
      },
    });
    return updated;
  }

  skip(requestId: string) {
    const request = getById(requestId);
    if (!request) throw new Error("request not found");
    console.log(`[RequestService] skip -> ${requestId}`);
    const updated = updateStatus(request.id, "DONE");
    updatePlaybackTimestamps(updated.id, updated.playStartedAt, Date.now());
    if (this.#currentPlayingId === request.id) {
      this.#overlayHub.stop(200);
      this.#currentPlayingId = null;
      resetPoll();
    }
    this.playNextReady();
    return updated;
  }

  delete(requestId: string) {
    const request = getById(requestId);
    if (!request) return null;
    console.log(`[RequestService] delete -> ${requestId}`);
    deleteRequest(request.id);
    if (this.#currentPlayingId === request.id) {
      this.#overlayHub.stop(200);
      this.#currentPlayingId = null;
      resetPoll();
    }
    this.playNextReady();
    return request;
  }

  reorderQueue(requestId: string, desiredPosition: number) {
    if (!Number.isFinite(desiredPosition) || desiredPosition < 1) {
      throw new Error("position must be >= 1");
    }
    const request = getById(requestId);
    if (!request) {
      throw new Error("request not found");
    }
    if (!ORDER_EDITABLE_STATUSES.has(request.status)) {
      throw new Error("order cannot be changed in this state");
    }
    console.log(`[RequestService] reorder -> ${requestId} -> ${desiredPosition}`);
    const updated = reorderRequestPosition(requestId, desiredPosition);
    if (request.status === "DONE") {
      return updateStatus(requestId, "READY");
    }
    return updated;
  }

  seekPlayback(positionSec: number) {
    if (!this.#currentPlayingId) {
      throw new Error("no track is playing");
    }
    const request = getById(this.#currentPlayingId);
    if (!request || request.status !== "PLAYING") {
      throw new Error("playing track not found");
    }
    const duration = request.durationSec ?? Number.POSITIVE_INFINITY;
    const clamped = Math.max(0, Math.min(duration, positionSec));
    const playStartedAt = this.#playbackPaused ? null : Date.now() - clamped * 1000;
    updateRequestFields(request.id, { play_started_at: playStartedAt, play_ended_at: null });
    this.#pausedPositionSec = clamped;
    this.#overlayHub.seek(clamped);
    emitDockEvent(DOCK_EVENT.REQUESTS);
    return { positionSec: clamped, durationSec: request.durationSec ?? null, isPlaying: !this.#playbackPaused };
  }

  suspendRequests(requestIds: string[]) {
    const updated: RequestItem[] = [];
    for (const requestId of requestIds) {
      const request = getById(requestId);
      if (!request) continue;
      if (!SUSPENDABLE_STATUSES.has(request.status) || request.status === "SUSPEND") continue;
      const result = updateStatus(request.id, "SUSPEND", request.status);
      updated.push(result);
    }
    return updated;
  }

  resumeRequests(requestIds: string[]) {
    const updated: RequestItem[] = [];
    const queuePos = nextQueuePosition();
    const now = Date.now();
    for (const requestId of requestIds) {
      const request = getById(requestId);
      if (!request || request.status !== "SUSPEND") continue;
      const result = updateRequestFields(request.id, {
        status: "READY",
        status_reason: null,
        queue_position: queuePos + updated.length,
        created_at: now,
        updated_at: now,
      });
      updated.push(result);
    }
    return updated;
  }

  handleOverlayEnded(requestId: string) {
    const request = getById(requestId);
    if (!request) return;
    console.log(`[RequestService] overlay ended -> ${requestId}`);
    updateStatus(requestId, "DONE");
    updatePlaybackTimestamps(requestId, request.playStartedAt ?? Date.now(), Date.now());
    if (this.#currentPlayingId === requestId) {
      this.#currentPlayingId = null;
      this.#playbackPaused = false;
      this.#pausedPositionSec = 0;
    }
    resetPoll();
    this.playNextReady();
  }

  handleOverlayError(requestId: string, reason: string) {
    console.error(`[RequestService] overlay error -> ${requestId}: ${reason}`);
    updateStatus(requestId, "FAILED", reason);
    if (this.#currentPlayingId === requestId) {
      this.#currentPlayingId = null;
      this.#playbackPaused = false;
      this.#pausedPositionSec = 0;
    }
    resetPoll();
    this.playNextReady();
  }

  stopPlayback() {
    if (!this.#currentPlayingId) return null;
    const request = getById(this.#currentPlayingId);
    this.#overlayHub.stop(200);
    this.#autoplayPaused = true;
    this.#playbackPaused = false;
    this.#pausedPositionSec = 0;
    if (request) {
      updateStatus(request.id, "READY", "STOP");
      updatePlaybackTimestamps(request.id, null, null);
    }
    resetPoll();
    this.#currentPlayingId = null;
    emitDockEvent(DOCK_EVENT.REQUESTS);
    emitInfoOverlay({
      level: "warn",
      messageKey: "request_stop_full",
      params: { url: request?.url ?? "" },
      scope: "status",
    });
    return request;
  }

  async #refreshMetadataIfStale(request: RequestItem): Promise<RequestItem> {
    const last = request.metaRefreshedAt ?? 0;
    const now = Date.now();
    if (now - last < this.#metaStaleMs) return request;
    const settings = loadServerSettings();
    const meta = await fetchVideoMetadata(request.url, settings);
    if (!meta) return request;
    const updated = updateRequestFields(request.id, {
      title: meta.title ?? request.title,
      duration_sec: meta.duration ?? request.durationSec,
      uploader: meta.uploader ?? request.uploader,
      uploaded_at: meta.uploadDate ?? request.uploadedAt,
      view_count: meta.viewCount ?? request.viewCount,
      like_count: meta.likeCount ?? request.likeCount,
      dislike_count: meta.dislikeCount ?? request.dislikeCount,
      comment_count: meta.commentCount ?? request.commentCount,
      mylist_count: meta.mylistCount ?? request.mylistCount,
      favorite_count: meta.favoriteCount ?? request.favoriteCount,
      danmaku_count: meta.danmakuCount ?? request.danmakuCount,
      meta_refreshed_at: now,
    });
    return updated;
  }

  toggleAutoplay() {
    this.#autoplayPaused = !this.#autoplayPaused;
    console.log(`[RequestService] autoplay ${this.#autoplayPaused ? "paused" : "resumed"}`);
    if (this.#autoplayPaused) {
      this.#overlayHub.stop(200);
      if (this.#currentPlayingId) {
        updateStatus(this.#currentPlayingId, "READY");
        this.#currentPlayingId = null;
      }
      this.#playbackPaused = false;
      this.#pausedPositionSec = 0;
      resetPoll();
      emitDockEvent(DOCK_EVENT.REQUESTS);
      emitInfoOverlay({
        level: "info",
        titleKey: "request_autoplay_paused_title",
        scope: "status",
      });
      return this.#autoplayPaused;
    }
    this.playNextReady();
    emitDockEvent(DOCK_EVENT.REQUESTS);
    emitInfoOverlay({
      level: "info",
      titleKey: "request_autoplay_resumed_title",
      scope: "status",
    });
    return this.#autoplayPaused;
  }

  cycleShuffleMode(): ShuffleMode {
    const currentIndex = SHUFFLE_MODES.indexOf(this.#shuffleMode);
    const next = SHUFFLE_MODES[(currentIndex + 1) % SHUFFLE_MODES.length];
    this.#shuffleMode = next;
    emitDockEvent(DOCK_EVENT.REQUESTS);
    if (!this.#autoplayPaused && !this.#currentPlayingId) {
      this.playNextReady();
    }
    return this.#shuffleMode;
  }

  getShuffleMode(): ShuffleMode {
    return this.#shuffleMode;
  }

  pauseOverlay() {
    if (!this.#currentPlayingId) return null;
    const request = getById(this.#currentPlayingId);
    if (!request) return null;
    const info = this.#buildPlaybackInfo();
    this.#pausedPositionSec = info?.positionSec ?? 0;
    this.#playbackPaused = true;
    updateRequestFields(request.id, { play_started_at: null, play_ended_at: null });
    this.#overlayHub.pause();
    emitDockEvent(DOCK_EVENT.REQUESTS);
    resetPoll();
    return this.#buildPlaybackInfo();
  }

  resumeOverlay() {
    if (!this.#currentPlayingId) return null;
    const request = getById(this.#currentPlayingId);
    if (!request) return null;
    this.#playbackPaused = false;
    updateRequestFields(request.id, {
      play_started_at: Date.now() - this.#pausedPositionSec * 1000,
      play_ended_at: null,
    });
    this.#overlayHub.resume();
    emitDockEvent(DOCK_EVENT.REQUESTS);
    return this.#buildPlaybackInfo();
  }

  toggleIntake() {
    const paused = toggleIntake();
    emitInfoOverlay({
      level: "info",
      title: paused ? "Requests closed" : "Requests reopened",
      scope: "status",
    });
    return paused;
  }

  #pickRandom<T>(items: T[]): T | null {
    if (!Array.isArray(items) || items.length === 0) return null;
    const index = Math.floor(Math.random() * items.length);
    return items[index] ?? null;
  }

  #selectNextReadyRequest(): RequestItem | null {
    if (this.#shuffleMode === "off") {
      return fetchNextReadyRequest("queue");
    }
    const ready = listReadyRequests("queue");
    if (ready.length === 0) return null;
    if (this.#shuffleMode === "priority") {
      const bestPriority = ready.reduce((min, item) => {
        const position = Number.isFinite(item.queuePosition) ? Number(item.queuePosition) : Number.MAX_SAFE_INTEGER;
        return position < min ? position : min;
      }, Number.MAX_SAFE_INTEGER);
      const candidates = ready.filter((item) => {
        const position = Number.isFinite(item.queuePosition) ? Number(item.queuePosition) : Number.MAX_SAFE_INTEGER;
        return position === bestPriority;
      });
      return this.#pickRandom(candidates);
    }
    return this.#pickRandom(ready);
  }

  async playNextReady() {
    if (this.#currentPlayingId || this.#autoplayPaused) return null;
    const next = this.#selectNextReadyRequest();
    if (!next) return null;
    console.log(`[RequestService] autoplay candidate -> ${next.id}`);
    try {
      return await this.play(next.id);
    } catch (err) {
      console.error(`[RequestService] failed to autoplay ${next.id}`, err);
      return null;
    }
  }

  clearAll() {
    console.warn("[RequestService] clearing all requests");
    this.#overlayHub.stop(200);
    deleteAllRequests();
    this.#currentPlayingId = null;
    this.#playbackPaused = false;
    this.#pausedPositionSec = 0;
    resetPoll();
  }

  #ensureCachedMediaAvailable(request: RequestItem) {
    const manifestPath = this.#resolveManifestPath(request);
    if (!manifestPath) {
      return true;
    }
    try {
      Deno.statSync(manifestPath);
      return true;
    } catch (err) {
      if (err instanceof Deno.errors.NotFound) {
        console.warn(`[RequestService] cache missing for ${request.id}, re-queuing download`);
        updateRequestFields(request.id, {
          status: "QUEUED",
          status_reason: null,
          queue_position: request.queuePosition ?? 1,
          file_name: null,
          cache_file_path: null,
          cache_file_size: null,
          play_started_at: null,
          play_ended_at: null,
        });
        return false;
      }
      throw err;
    }
  }

  #resolveManifestPath(request: RequestItem) {
    const candidate = request.cacheFilePath ??
      (this.#cacheDir && request.fileName ? join(this.#cacheDir, request.fileName) : null);
    if (!candidate) {
      return null;
    }
    return resolve(candidate);
  }

  #buildPlaybackInfo() {
    if (!this.#currentPlayingId) return null;
    const request = getById(this.#currentPlayingId);
    if (!request || request.status !== "PLAYING") return null;
    const durationSec = request.durationSec ?? null;
    let positionSec: number;
    if (this.#playbackPaused) {
      positionSec = this.#pausedPositionSec;
    } else {
      const startedAt = request.playStartedAt ?? Date.now();
      const elapsed = Math.max(0, (Date.now() - startedAt) / 1000);
      positionSec = durationSec ? Math.min(durationSec, elapsed) : elapsed;
      this.#pausedPositionSec = positionSec;
    }
    return {
      id: request.id,
      title: request.title,
      durationSec,
      positionSec,
      isPlaying: !this.#playbackPaused,
    };
  }
}
