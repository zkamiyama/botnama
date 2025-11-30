import { type InfoOverlayEvent } from "../events/infoOverlayBus.ts";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - import bundled i18n mapping from public folder; this should resolve with an embedded asset when compiled.
const { translations } = await import(new URL("../../public/i18n.js", import.meta.url).href);

const t = (key: string, locale: string, params?: Record<string, unknown> | null) => {
  const dict = (translations?.[locale] ?? translations?.ja ?? translations?.en) as Record<string, any> | undefined;
  const tpl = dict ? dict[key] : undefined;
  if (!tpl) return key;
  if (typeof tpl === "function") {
    try {
      return tpl(params ?? {});
    } catch {
      return key;
    }
  }
  return tpl.replace(/\{([^}]+)\}/g, (_: string, name: string) => {
    const v = params?.[name];
    return v === undefined || v === null ? "" : String(v);
  });
};

const formatYmd = (ts: number | null | undefined) => {
  if (typeof ts !== "number" || !Number.isFinite(ts)) return null;
  const date = new Date(ts);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}/${month}/${day}`;
};

const formatDurationClock = (seconds: number | null | undefined) => {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds < 0) return null;
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const pad = (value: number) => value.toString().padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${pad(minutes)}:${pad(secs)}`;
};

const fmtNumber = (n: unknown, locale: string) =>
  typeof n === "number" && Number.isFinite(n) ? n.toLocaleString(locale.startsWith("ja") ? "ja-JP" : "en-US") : null;

export const formatInfoOverlayForComment = (
  event: InfoOverlayEvent,
  locale: string,
): string | null => {
  const loc = locale || "ja";

  // 1) plain text if already present
  const primary = [event.title, event.message]
    .filter((s) => typeof s === "string" && s.trim().length > 0)
    .join(" ")
    .trim();
  if (primary.length > 0) return primary;

  // 2) translate keys
  const parts: string[] = [];
  const title = event.titleKey ? t(event.titleKey, loc, event.params) : null;
  const body = event.messageKey ? t(event.messageKey, loc, event.params) : null;
  if (title) parts.push(title);
  if (body) parts.push(body);
  const uniq = parts
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .filter((p, i, a) => a.indexOf(p) === i);
  if (uniq.length > 0) {
    if (uniq.length === 2 && uniq[1].includes(uniq[0])) return uniq[1];
    return uniq.join(" / ");
  }

  // 3) stats formatting identical to overlay-info
  if (event.stats && typeof event.stats === "object") {
    const s = event.stats as Record<string, unknown>;
    const partsStats: Array<string | null> = [];
    const formatEntry = (key: string, value: string | number | null) =>
      value !== null && value !== undefined && String(value).length > 0 ? `【${t(key, loc)}】 ${value}` : null;

    const uploaded = formatYmd(s.uploadedAt as number);
    const duration = typeof s.durationSec === "number" && s.durationSec > 0
      ? formatDurationClock(s.durationSec)
      : null;

    partsStats.push(formatEntry("stat_uploaded", uploaded));
    partsStats.push(formatEntry("stat_duration", duration));
    partsStats.push(formatEntry("stat_views", fmtNumber(s.viewCount, loc)));
    partsStats.push(formatEntry("stat_comments", fmtNumber(s.commentCount, loc)));
    partsStats.push(formatEntry("stat_uploader", (s.uploader as string) ?? null));

    const site = (s.site as string) ?? "other";
    if ((site === "youtube" || site === "other") && fmtNumber(s.likeCount, loc)) {
      partsStats.push(formatEntry("stat_likes", fmtNumber(s.likeCount, loc)));
    }
    if (site === "youtube" && fmtNumber(s.dislikeCount, loc)) {
      partsStats.push(formatEntry("stat_dislikes", fmtNumber(s.dislikeCount, loc)));
    }
    if (site === "nicovideo" && fmtNumber(s.mylistCount, loc)) {
      partsStats.push(formatEntry("stat_mylist", fmtNumber(s.mylistCount, loc)));
    }
    if (site === "nicovideo" && fmtNumber(s.favoriteCount, loc)) {
      partsStats.push(formatEntry("stat_favorites", fmtNumber(s.favoriteCount, loc)));
    }
    if (site === "bilibili" && fmtNumber(s.danmakuCount, loc)) {
      partsStats.push(formatEntry("stat_danmaku", fmtNumber(s.danmakuCount, loc)));
    }

    const fetched = formatYmd((s.metaRefreshedAt as number) ?? Date.now());
    partsStats.push(formatEntry("stat_fetched", fetched));

    const remainingCount = typeof s.pendingItems === "number" ? s.pendingItems : null;
    if (remainingCount !== null) {
      const remainingDuration = formatDurationClock((s.pendingDurationSec as number) ?? null) ?? "--:--";
      // Use i18n to format the value (keep unit localized on the value side)
      // translation key: stat_remaining_summary_value -> should return e.g. "{count}件 ({duration})" / "{count} ({duration})"
      const remainingValue = t("stat_remaining_summary_value", loc, {
        count: remainingCount,
        duration: remainingDuration,
      });
      partsStats.push(formatEntry("stat_remaining_summary", remainingValue));
    }

    const filtered = partsStats.filter((v): v is string => typeof v === "string" && v.length > 0);
    if (filtered.length > 0) {
      const titleValue = (s.title ?? event.title) as string | undefined;
      // 統計テロップでは URL は表示しない（破損防止＆スパム防止）
      const head = [titleValue].filter((v) => typeof v === "string" && v.trim().length > 0).join(" ");
      return head ? `${head}\n${filtered.join(" ")}` : filtered.join(" ");
    }
  }

  return null;
};
