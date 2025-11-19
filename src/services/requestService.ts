import {
  countByStatus,
  deleteAllRequests,
  deleteRequest,
  fetchNextReadyRequest,
  fetchQueueSummary,
  getById,
  listRequests,
  reorderRequestPosition,
  resetPlayingExcept,
  updatePlaybackTimestamps,
  updateRequestFields,
  updateStatus,
} from "../repositories/requestsRepository.ts";
import { ApiListResponse, QueueSummary, RequestItem, RequestStatus } from "../types.ts";
import { OverlayHub } from "../websocket/overlayHub.ts";
import { DOCK_EVENT, emitDockEvent } from "../events/dockEventBus.ts";

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

const toRequestStatus = (value: string | null): RequestStatus | null => {
  if (!value) return null;
  return REQUEST_STATUS_VALUES.includes(value as RequestStatus) ? value as RequestStatus : null;
};

export class RequestService {
  #overlayHub: OverlayHub;
  #currentPlayingId: string | null = null;
  #autoplayPaused = false;

  constructor(overlayHub: OverlayHub) {
    this.#overlayHub = overlayHub;
  }

  list(
    params: { statuses?: RequestStatus[]; limit?: number; offset?: number },
  ): ApiListResponse<RequestItem> {
    return listRequests(params);
  }

  summary(): QueueSummary & {
    overlayConnected: boolean;
    downloadingCount: number;
    currentPlayingId: string | null;
    autoplayPaused: boolean;
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
      currentPlayback,
    };
  }

  play(requestId: string) {
    const request = getById(requestId);
    if (!request) {
      throw new Error("指定したリクエストが存在しません");
    }
    if (!request.fileName) {
      throw new Error("動画がまだキャッシュされていません");
    }
    if (!["READY", "DONE"].includes(request.status)) {
      throw new Error("READY もしくは DONE 状態のリクエストのみ再生できます");
    }
    console.log(`[RequestService] play -> ${requestId} (status=${request.status})`);
    resetPlayingExcept(requestId);
    const updated = updateRequestFields(request.id, {
      status: "PLAYING",
      play_started_at: Date.now(),
      play_ended_at: null,
    });
    if (this.#currentPlayingId && this.#currentPlayingId !== request.id) {
      console.log(
        `[RequestService] stopping previous overlay playback ${this.#currentPlayingId} before ${request.id}`,
      );
      this.#overlayHub.stop(100);
    }
    this.#overlayHub.play(updated);
    this.#currentPlayingId = updated.id;
    console.log(`[RequestService] overlay play signal sent for ${updated.id}`);
    return updated;
  }

  skip(requestId: string) {
    const request = getById(requestId);
    if (!request) throw new Error("対象リクエストが存在しません");
    console.log(`[RequestService] skip -> ${requestId}`);
    const updated = updateStatus(request.id, "DONE");
    updatePlaybackTimestamps(updated.id, updated.playStartedAt, Date.now());
    if (this.#currentPlayingId === request.id) {
      this.#overlayHub.stop(200);
      this.#currentPlayingId = null;
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
    }
    this.playNextReady();
    return request;
  }

  reorderQueue(requestId: string, desiredPosition: number) {
    if (!Number.isFinite(desiredPosition) || desiredPosition < 1) {
      throw new Error("position は 1 以上の数値で指定してください");
    }
    const request = getById(requestId);
    if (!request) {
      throw new Error("指定したリクエストが存在しません");
    }
    if (!ORDER_EDITABLE_STATUSES.has(request.status)) {
      throw new Error("この状態では順番を変更できません");
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
      throw new Error("現在再生中のトラックがありません");
    }
    const request = getById(this.#currentPlayingId);
    if (!request || request.status !== "PLAYING") {
      throw new Error("再生中のトラックが見つかりません");
    }
    const duration = request.durationSec ?? Number.POSITIVE_INFINITY;
    const clamped = Math.max(0, Math.min(duration, positionSec));
    const playStartedAt = Date.now() - clamped * 1000;
    updateRequestFields(request.id, { play_started_at: playStartedAt, play_ended_at: null });
    this.#overlayHub.seek(clamped);
    emitDockEvent(DOCK_EVENT.REQUESTS);
    return { positionSec: clamped, durationSec: request.durationSec ?? null };
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
    for (const requestId of requestIds) {
      const request = getById(requestId);
      if (!request || request.status !== "SUSPEND") continue;
      const previous = toRequestStatus(request.statusReason);
      const fallback: RequestStatus = previous && RESUMABLE_STATUSES.has(previous)
        ? previous
        : "QUEUED";
      const result = updateStatus(request.id, fallback, null);
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
    }
    this.playNextReady();
  }

  handleOverlayError(requestId: string, reason: string) {
    console.error(`[RequestService] overlay error -> ${requestId}: ${reason}`);
    updateStatus(requestId, "FAILED", reason);
    if (this.#currentPlayingId === requestId) {
      this.#currentPlayingId = null;
    }
    this.playNextReady();
  }

  stopPlayback() {
    this.#autoplayPaused = !this.#autoplayPaused;
    console.log(`[RequestService] autoplay ${this.#autoplayPaused ? "paused" : "resumed"}`);
    if (this.#autoplayPaused) {
      this.#overlayHub.stop(200);
      if (this.#currentPlayingId) {
        updateStatus(this.#currentPlayingId, "READY");
        this.#currentPlayingId = null;
      }
      emitDockEvent(DOCK_EVENT.REQUESTS);
      return this.#autoplayPaused;
    }
    this.playNextReady();
    emitDockEvent(DOCK_EVENT.REQUESTS);
    return this.#autoplayPaused;
  }

  playNextReady() {
    if (this.#currentPlayingId || this.#autoplayPaused) return null;
    const next = fetchNextReadyRequest();
    if (!next) return null;
    console.log(`[RequestService] autoplay candidate -> ${next.id}`);
    try {
      return this.play(next.id);
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
  }

  #buildPlaybackInfo() {
    if (!this.#currentPlayingId) return null;
    const request = getById(this.#currentPlayingId);
    if (!request || request.status !== "PLAYING") return null;
    const durationSec = request.durationSec ?? null;
    const startedAt = request.playStartedAt ?? Date.now();
    const elapsed = Math.max(0, (Date.now() - startedAt) / 1000);
    const positionSec = durationSec ? Math.min(durationSec, elapsed) : elapsed;
    return {
      id: request.id,
      title: request.title,
      durationSec,
      positionSec,
      isPlaying: true,
    };
  }
}
