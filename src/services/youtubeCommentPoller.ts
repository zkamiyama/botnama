import { ingestComment } from "./commentService.ts";
import { MissingYouTubeCookiesConfigError, YouTubeService } from "./youtubeService.ts";

interface PollerOptions {
  /** when no continuation token; default 5000ms */
  idleIntervalMs?: number;
  /** when continuation token is present; default 2000ms */
  activeIntervalMs?: number;
  /** initial delay before running first tick after start; default 3000ms */
  initialDelayMs?: number;
}

/**
 * Lightweight poller that pulls YouTube live chat periodically and feeds it to ingestComment.
 * This mimics what external tools (yt-dlp live_chat, MCV plugins) do: keep a continuation token
 * and loop. We stay fully cookie-authenticated via YouTubeService.
 */
export class YouTubeCommentPoller {
  #yt: YouTubeService;
  #options: Required<PollerOptions>;
  #timer: number | null = null;
  #running = false;
  #currentVideoId: string | null = null;
  #nextPageToken: string | null = null;
  #missingConfigLogged = false;
  #disabledUntilRestart = false;

  constructor(yt: YouTubeService, options?: PollerOptions) {
    this.#yt = yt;
    this.#options = {
      idleIntervalMs: options?.idleIntervalMs ?? 5000,
      activeIntervalMs: options?.activeIntervalMs ?? 2000,
      initialDelayMs: options?.initialDelayMs ?? 3000,
    };
  }

  start() {
    if (this.#running || this.#disabledUntilRestart) return;
    this.#running = true;
    // Schedule the initial tick after a short delay to allow startup tasks
    // (e.g., auth/log checks) to complete and avoid simultaneous cookie extractions.
    console.debug(`[YouTubeCommentPoller] starting (initialDelayMs=${this.#options.initialDelayMs})`);
    this.#schedule(this.#options.initialDelayMs);
  }

  stop() {
    this.#running = false;
    if (this.#timer !== null) {
      clearTimeout(this.#timer);
      this.#timer = null;
    }
  }

  // Public API: return whether poller is currently running
  public isRunning(): boolean {
    return this.#running;
  }

  // Public API: set current broadcast ID to monitor; initializes internal state
  public setBroadcastId(broadcastId: string | null) {
    this.#currentVideoId = broadcastId;
    this.#nextPageToken = null;
  }

  // Public API: activate poller with optional broadcast ID
  public activate(broadcastId?: string | null) {
    if (broadcastId !== undefined) this.setBroadcastId(broadcastId ?? null);
    this.start();
  }

  // Public API: deactivate poller
  public deactivate() {
    this.stop();
  }

  async #tick() {
    if (!this.#running) return;
    try {
      const broadcastId = await this.#yt.getMyBroadcast();
      if (!broadcastId) {
        this.#currentVideoId = null;
        this.#nextPageToken = null;
        this.#schedule(this.#options.idleIntervalMs);
        return;
      }
      if (broadcastId !== this.#currentVideoId) {
        this.#currentVideoId = broadcastId;
        this.#nextPageToken = null;
      }

      const { items, nextPageToken } = await this.#yt.getChatMessages(
        this.#currentVideoId,
        this.#nextPageToken ?? undefined,
      );
      this.#nextPageToken = nextPageToken ?? null;
      const ownerChannelId = this.#yt.getMyChannelId();

      for (const item of items) {
        if (ownerChannelId && item.authorChannelId === ownerChannelId) {
          // Skip broadcaster's own auto-comments (e.g., telop relays)
          continue;
        }
        ingestComment({
          platform: "youtube",
          roomId: this.#currentVideoId,
          userId: item.authorChannelId ?? undefined,
          userName: item.authorName ?? undefined,
          message: item.text,
          commentId: item.id ?? undefined,
          timestamp: item.publishedAt ? Date.parse(item.publishedAt) : Date.now(),
          allowRequestCreation: true,
        });
      }

      const delay = this.#nextPageToken ? this.#options.activeIntervalMs : this.#options.idleIntervalMs;
      this.#schedule(delay);
    } catch (err) {
      if (err instanceof MissingYouTubeCookiesConfigError) {
        if (!this.#missingConfigLogged) {
          console.warn(
            "[YouTubeCommentPoller] youtubeCookiesFrom not set; polling stopped until server restart after configuring youtubeCookiesFrom or BOTNAMA_YOUTUBE_COOKIES_FROM.",
          );
          this.#missingConfigLogged = true;
        }
        this.stop();
        this.#disabledUntilRestart = true;
        return;
      }
      console.error("[YouTubeCommentPoller] tick failed", err);
      // reset tokens and retry later
      this.#nextPageToken = null;
      this.#schedule(this.#options.idleIntervalMs * 2);
    }
  }

  #schedule(ms: number) {
    if (!this.#running) return;
    this.#timer = setTimeout(() => this.#tick(), ms) as unknown as number;
  }
}
