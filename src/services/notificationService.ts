import { subscribeInfoOverlay, type InfoOverlayEvent } from "../events/infoOverlayBus.ts";
import { getById } from "../repositories/requestsRepository.ts";
import { NiconicoService } from "./niconicoService.ts";
import { YouTubeService } from "./youtubeService.ts";
import { ServerSettings } from "../types.ts";
import { formatInfoOverlayForComment } from "../utils/infoOverlayFormatter.ts";

type Targets = { niconico: boolean; youtube: boolean };

export class NotificationService {
  #settings: ServerSettings;
  #niconico: NiconicoService;
  #youtube: YouTubeService;

  constructor(settings: ServerSettings, niconico: NiconicoService, youtube: YouTubeService) {
    this.#settings = settings;
    this.#niconico = niconico;
    this.#youtube = youtube;
    subscribeInfoOverlay((event) => this.handleOverlay(event));
  }

  updateSettings(settings: ServerSettings) {
    this.#settings = settings;
  }

  async handleOverlay(event: InfoOverlayEvent) {
    if (!this.#settings.notifyTelopEnabled) return;
    if (event.requestId) {
      const req = getById(event.requestId);
      if (req && req.bucket !== "queue") return;
    }
    const locale = (this.#settings.locale && this.#settings.locale !== "auto")
      ? this.#settings.locale
      : "ja";
    const message = formatInfoOverlayForComment(event, locale);
    if (!message) return;

    const targets: Targets = {
      niconico: Boolean(this.#settings.notifyTelopNiconico),
      youtube: Boolean(this.#settings.notifyTelopYoutube),
    };
    if (!targets.niconico && !targets.youtube) return;

    const isPlaybackStart = event.requestId !== null && event.scope === "info";
    const delayMs = isPlaybackStart
      ? Math.max(0, this.#settings.notifyTelopDelayMs ?? 0)
      : 0;

    if (delayMs > 0) {
      setTimeout(() => this.dispatchMessage(message, targets).catch(console.error), delayMs);
    } else {
      await this.dispatchMessage(message, targets);
    }
  }

  private formatMessage(event: InfoOverlayEvent): string | null {
    // 1) そのままのタイトル/本文があれば優先（オーバーレイと同じ表示をそのままコメントに）
    const primary = [event.title, event.message]
      .filter((s) => typeof s === "string" && s.trim().length > 0)
      .join(" ")
      .trim();
    if (primary.length > 0) return primary;

    // 2) titleKey / messageKey を i18n で解決
    const parts: string[] = [];
    if (event.titleKey) parts.push(this.renderKey(event.titleKey, event.params));
    if (event.messageKey) parts.push(this.renderKey(event.messageKey, event.params));
    const uniq = parts
      .map((p) => p.trim())
      .filter((p) => p.length > 0)
      .filter((p, i, a) => a.indexOf(p) === i);
    if (uniq.length > 0) {
      if (uniq.length === 2 && uniq[1].includes(uniq[0])) return uniq[1];
      return uniq.join(" / ");
    }

    // 3) stats からテロップ相当の情報を組み立て
    if (event.stats && typeof event.stats === "object") {
      const s = event.stats as Record<string, unknown>;
      const fields: string[] = [];
      const titleValue = (s.title ?? event.title) as string | undefined;
      if (s.durationSec) {
        const dur = this.formatDuration(Number(s.durationSec));
        if (dur) fields.push(`再生時間: ${dur}`);
      }
      if (s.viewCount) fields.push(`再生数: ${s.viewCount}`);
      if (s.likeCount) fields.push(`高評価: ${s.likeCount}`);
      if (s.commentCount) fields.push(`コメント: ${s.commentCount}`);
      if (s.uploader) fields.push(`投稿者: ${s.uploader}`);
      if (s.pendingItems) {
        const pendingDuration = s.pendingDurationSec ? this.formatDuration(Number(s.pendingDurationSec)) : null;
        const value = this.renderKey("stat_remaining_summary_value", { count: s.pendingItems, duration: pendingDuration ?? "--:--" });
        fields.push(`${this.renderKey("stat_remaining_summary")} ${value}`);
      }

      if (fields.length > 0) {
        const titlePrefix = titleValue && titleValue.trim() ? `【${titleValue.trim()}】 ` : "";
        return `${titlePrefix}${fields.join(" / ")}`;
      }
    }

    return null;
  }

  private renderKey(key: string, params?: Record<string, unknown> | null): string {
    const locale = (this.#settings.locale && this.#settings.locale !== "auto")
      ? this.#settings.locale
      : "ja";
    const dict = translations?.[locale] ?? translations?.ja ?? translations?.en;
    const template = dict ? dict[key] : undefined;
    if (!template) return key;
    if (typeof template === "function") {
      try {
        return template(params ?? {});
      } catch (_e) {
        return key;
      }
    }
    return template.replace(/\{([^}]+)\}/g, (_: string, name: string) => {
      const v = (params as Record<string, unknown> | undefined)?.[name];
      return v === undefined || v === null ? "" : String(v);
    });
  }

  private formatDuration(seconds: number): string | null {
    if (!Number.isFinite(seconds) || seconds <= 0) return null;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const parts: string[] = [];
    if (h > 0) parts.push(`${h}時間`);
    if (m > 0) parts.push(`${m}分`);
    if (s > 0 || parts.length === 0) parts.push(`${s}秒`);
    return parts.join("");
  }

  private async dispatchMessage(message: string, targets: Targets) {
    if (targets.niconico) {
      try {
        const liveId = await this.#niconico.getMyBroadcast();
        if (liveId) await this.#niconico.sendComment(liveId, message);
      } catch (err) {
        console.error("[Notify] Niconico send failed", err);
      }
    }
    if (targets.youtube) {
      try {
        const broadcastId = await this.#youtube.getMyBroadcast();
        if (broadcastId) await this.#youtube.sendChatMessage(broadcastId, message);
      } catch (err) {
        console.error("[Notify] YouTube send failed", err);
      }
    }
  }
}
