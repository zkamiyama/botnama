import { detectLocale, setLocale, t } from "../i18n.js";

const bandStack = document.getElementById("bandStack");
const bandTemplate = document.getElementById("bandTemplate");

if (!(bandStack instanceof HTMLElement) || !(bandTemplate instanceof HTMLTemplateElement)) {
  throw new Error("[InfoOverlay] overlay root elements are missing");
}

let source = null;

const BAND_ANIM_IN_CLASS = "band-anim-in";
const BAND_ANIM_OUT_CLASS = "band-anim-out";
const BAND_ANIM_DURATION_MS = 360;
const STACK_REORDER_DURATION_MS = 1000;
const MARQUEE_STATIC_MS = 3000;
const MARQUEE_SPEED_PX_PER_SEC = 135;
const MARQUEE_MIN_SCROLL_SEC = 3;
const MARQUEE_TILING_GAP_FALLBACK = 32;
const MARQUEE_TILING_COPIES = 2;

const marqueeAnimations = new WeakMap();
const activeBands = new Set();

await detectLocale().then(setLocale);

const getTilingGapPx = () => {
  try {
    const rootStyles = getComputedStyle(document.documentElement);
    const raw = rootStyles.getPropertyValue("--marquee-tiling-gap");
    const parsed = Number.parseFloat(raw);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  } catch (_) {
    // ignore
  }
  return MARQUEE_TILING_GAP_FALLBACK;
};

const safeText = (value) => (value ?? "").toString();
const DEFAULT_DURATION_MS = 5000;

const resolveDuration = (durationMs) => {
  if (typeof durationMs === "number" && Number.isFinite(durationMs) && durationMs > 0) {
    return durationMs;
  }
  return DEFAULT_DURATION_MS;
};

const shouldDisplayPayload = (payload) => {
  if (!payload) return false;
  if (payload.scope === "info" && payload.messageKey === "body_url_only") {
    return false;
  }
  return true;
};

const createBandEntry = (scope) => {
  const base = bandTemplate.content.firstElementChild?.cloneNode(true);
  if (!(base instanceof HTMLElement)) {
    throw new Error("[InfoOverlay] band template is invalid");
  }
  const marqueeEl = base.querySelector('[data-role="marquee"]');
  const labelWrap = base.querySelector('[data-role="label"]');
  const labelTextEl = base.querySelector('[data-role="labelText"]');
  const payloadEl = base.querySelector('[data-role="payload"]');
  const textCloneEl = base.querySelector('[data-role="textClone"]');
  if (!marqueeEl || !labelWrap || !labelTextEl || !payloadEl || !textCloneEl) {
    throw new Error("[InfoOverlay] band template missing required nodes");
  }
  base.dataset.scope = scope;
  return {
    scope,
    band: base,
    marqueeEl,
    labelWrap,
    labelText: labelTextEl,
    payloadEl,
    textClone: textCloneEl,
    timerId: null,
    kind: null,
    meta: {
      requestId: null,
      messageKey: null,
      titleKey: null,
    },
  };
};

const triggerBandAnimation = (bandEl, className) => {
  if (!bandEl) return;
  bandEl.classList.remove(BAND_ANIM_IN_CLASS, BAND_ANIM_OUT_CLASS);
  void bandEl.offsetWidth;
  bandEl.classList.add(className);
  setTimeout(() => {
    bandEl.classList.remove(className);
  }, BAND_ANIM_DURATION_MS);
};

const updateLabelVisibility = (wrapEl, visible) => {
  if (!wrapEl) return;
  wrapEl.style.display = visible ? "inline-flex" : "none";
};

const stopMarqueeAnimation = (marqueeEl) => {
  const anim = marqueeAnimations.get(marqueeEl);
  if (anim) {
    anim.cancel();
    marqueeAnimations.delete(marqueeEl);
  }
};

const applyMarquee = (container, textEl, cloneEl, marqueeEl) => {
  stopMarqueeAnimation(marqueeEl);
  marqueeEl.classList.remove("scroll");
  marqueeEl.style.removeProperty("--scroll-distance");
  marqueeEl.style.removeProperty("animation-duration");
  marqueeEl.style.removeProperty("animation-delay");
  cloneEl.innerHTML = "";
  cloneEl.classList.remove("tiling-clone");
  cloneEl.style.removeProperty("margin-left");

  const textWidth = textEl.scrollWidth;
  const containerWidth = container.clientWidth;
  if (textWidth <= containerWidth) {
    return;
  }

  const tilingGap = getTilingGapPx();
  cloneEl.classList.add("tiling-clone");
  cloneEl.style.marginLeft = `${tilingGap}px`;
  const tilingCopies = Math.max(1, MARQUEE_TILING_COPIES);
  cloneEl.innerHTML = "";
  for (let i = 0; i < tilingCopies; i++) {
    const chunk = document.createElement("span");
    chunk.className = "tiling-chunk";
    chunk.innerHTML = textEl.innerHTML;
    if (i > 0) {
      chunk.style.marginLeft = `${tilingGap}px`;
    }
    cloneEl.append(chunk);
  }
  const cloneWidth = cloneEl.scrollWidth;
  const shiftDistance = textWidth + tilingGap + cloneWidth;
  marqueeEl.style.setProperty("--scroll-distance", `${shiftDistance}px`);

  const baseDurationSec = Math.max(MARQUEE_MIN_SCROLL_SEC, shiftDistance / MARQUEE_SPEED_PX_PER_SEC);
  const totalDurationMs = baseDurationSec * 1000 + MARQUEE_STATIC_MS;
  const holdRatio = Math.min(0.8, MARQUEE_STATIC_MS / totalDurationMs);
  if (typeof marqueeEl.animate === "function") {
    const keyframes = [
      { transform: "translateX(0)" },
      { transform: "translateX(0)", offset: holdRatio },
      { transform: `translateX(-${shiftDistance}px)` },
    ];
    const animation = marqueeEl.animate(keyframes, {
      duration: totalDurationMs,
      iterations: Infinity,
      easing: "linear",
    });
    marqueeAnimations.set(marqueeEl, animation);
  } else {
    marqueeEl.style.animationDuration = `${totalDurationMs / 1000}s`;
    marqueeEl.style.animationDelay = `${MARQUEE_STATIC_MS / 1000}s`;
    marqueeEl.classList.add("scroll");
  }
};

const cleanupBand = (entry) => {
  stopMarqueeAnimation(entry.marqueeEl);
  entry.band.remove();
};

const hideBand = (entry, options = {}) => {
  const { immediate = false } = options;
  if (entry.timerId) {
    clearTimeout(entry.timerId);
    entry.timerId = null;
  }
  if (!activeBands.has(entry)) {
    cleanupBand(entry);
    return;
  }
  activeBands.delete(entry);
  if (immediate) {
    // Remove immediately (other bands will move up instantly with no animation)
    cleanupBand(entry);
    return;
  }
  entry.band.classList.remove("visible");
  entry.band.classList.add("exit-left");
  triggerBandAnimation(entry.band, BAND_ANIM_OUT_CLASS);
  setTimeout(() => {
    // after exit animation, remove element — other bands reflow immediately
    cleanupBand(entry);
  }, BAND_ANIM_DURATION_MS);
};

const showBand = (entry, durationMs) => {
  if (!entry.band.isConnected) {
    bandStack.appendChild(entry.band);
  }
  entry.band.classList.remove("exit-left");
  activeBands.add(entry);
  requestAnimationFrame(() => {
    entry.band.classList.add("visible");
    triggerBandAnimation(entry.band, BAND_ANIM_IN_CLASS);
  });
  if (entry.timerId) {
    clearTimeout(entry.timerId);
  }
  entry.timerId = setTimeout(() => hideBand(entry), resolveDuration(durationMs));
};

const classifyPayloadKind = (payload) => {
  if (!payload) return null;
  if (payload.messageKey === "poll_question_body") {
    return "poll-question";
  }
  if (payload.messageKey === "poll_result_body") {
    return "poll-result";
  }
  const hasRequest = typeof payload.requestId === "string" && payload.requestId.length > 0;
  const hasKeys = Boolean(payload.messageKey || payload.titleKey);
  if (hasRequest && payload.scope === "info" && !hasKeys && !payload.stats) {
    return "playback-info";
  }
  if (hasRequest && payload.scope === "status" && payload.stats) {
    return "playback-stats";
  }
  return null;
};

const removeBandsByKind = (
  kinds,
  { immediate = false, excludeRequestId = null, collectAnchor = false } = {},
) => {
  if (!Array.isArray(kinds) || kinds.length === 0) return;
  const anchors = [];
  for (const entry of Array.from(activeBands)) {
    if (entry.kind && kinds.includes(entry.kind)) {
      if (excludeRequestId && entry.meta?.requestId === excludeRequestId) continue;
      if (collectAnchor && entry.band.isConnected) {
        anchors.push(entry.band.nextElementSibling ?? null);
      }
      hideBand(entry, { immediate });
    }
  }
  return anchors;
};

const enforceExclusivity = (kind, payload) => {
  const context = { anchorNode: null };
  if (!kind) return context;
  if (kind === "playback-info" || kind === "playback-stats") {
    const currentRequestId = typeof payload?.requestId === "string" ? payload.requestId : null;
    removeBandsByKind(["playback-info", "playback-stats"], {
      immediate: true,
      excludeRequestId: currentRequestId,
    });
    return context;
  }
  if (kind === "poll-result") {
    const anchors = removeBandsByKind(["poll-question"], {
      immediate: true,
      collectAnchor: true,
    }) || [];
    context.anchorNode = anchors.find((node) => node instanceof Element) ?? null;
  }
  return context;
};

// no stack animation — removed animated reflow helpers so DOM reflow is immediate

const showMessage = (payload) => {
  if (!shouldDisplayPayload(payload)) return;
  const level = payload.level ?? "info";
  const scope = payload.scope === "status" ? "status" : "info";
  const kind = classifyPayloadKind({ ...payload, scope });
  // we intentionally do not capture or animate stack positions here
  const { anchorNode } = enforceExclusivity(kind, payload);
  const entry = createBandEntry(scope);
  const { band, marqueeEl, labelText: labelEl, labelWrap: wrapEl, payloadEl, textClone } = entry;
  entry.kind = kind;
  entry.meta = {
    requestId: typeof payload.requestId === "string" ? payload.requestId : null,
    messageKey: payload.messageKey ?? null,
    titleKey: payload.titleKey ?? null,
  };

  band.dataset.level = level;
  band.dataset.scope = scope;

  const titleText = payload.titleKey ? t(payload.titleKey, payload.params) : payload.title ?? "";
  const bodyText = payload.messageKey ? t(payload.messageKey, payload.params) : payload.message ?? "";
  const statsText = payload.stats ? renderStats(payload.stats) : "";
  const bodyLine = `${bodyText || titleText || ""}`.trim();

  labelEl.textContent = (scope === "info" && payload.titleKey === "request_play_title")
    ? t(payload.titleKey, payload.params)
    : "";
  updateLabelVisibility(wrapEl, Boolean(labelEl.textContent?.trim()));

  if (payload.messageKey === "poll_result_body" && payload.params?.winner) {
    const { yes, no, winner } = payload.params;
    const yesLabel = t("poll_vote_yes");
    const noLabel = t("poll_vote_no");
    const yesClass = winner === "yes" ? "poll-winner" : "";
    const noClass = winner === "no" ? "poll-winner" : "";
    const pollHtml = `<span class="${yesClass}">${yesLabel}: ${yes}%</span> <span class="poll-sep"></span> <span class="${noClass}">${noLabel}: ${no}%</span>`;
    payloadEl.innerHTML = pollHtml.trim();
    payloadEl.classList.add("poll-result");
    textClone.classList.add("poll-result");
    textClone.innerHTML = payloadEl.innerHTML;
  } else {
    payloadEl.textContent = "";
    payloadEl.classList.remove("poll-result");
    textClone.classList.remove("poll-result");
    textClone.innerHTML = "";
    if (bodyLine) {
      const bodySpan = document.createElement("span");
      bodySpan.className = "band-body";
      bodySpan.textContent = safeText(bodyLine);
      payloadEl.append(bodySpan);
    }
    if (statsText) {
      if (bodyLine) {
        const sep = document.createElement("span");
        sep.className = "stats-sep";
        sep.textContent = " · ";
        payloadEl.append(sep);
      }
      const statsSpan = document.createElement("span");
      statsSpan.className = "band-stats";
      statsSpan.textContent = safeText(statsText);
      payloadEl.append(statsSpan);
    }
    if (!bodyLine && !statsText) {
      payloadEl.textContent = "";
    }
  }

  payloadEl.dataset.rawStats = payload.stats ? JSON.stringify(payload.stats) : "";
  if (!band.isConnected) {
    const insertTarget = (anchorNode && anchorNode.isConnected && anchorNode.parentElement === bandStack)
      ? anchorNode
      : null;
    if (insertTarget) {
      bandStack.insertBefore(band, insertTarget);
    } else {
      bandStack.appendChild(band);
    }
  }
  applyMarquee(band, payloadEl, textClone, marqueeEl);
  showBand(entry, payload.durationMs);
};

const formatYmd = (ts) => {
  if (typeof ts !== "number" || !Number.isFinite(ts)) return null;
  const date = new Date(ts);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}/${month}/${day}`;
};

const formatDurationSec = (seconds) => {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds < 0) return null;
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const pad = (value) => value.toString().padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${pad(minutes)}:${pad(secs)}`;
};

const renderStats = (stats) => {
  const locale = navigator.language?.toLowerCase().startsWith("ja") ? "ja" : "en";
  const fmtNumber = (n) =>
    typeof n === "number" && Number.isFinite(n) ? n.toLocaleString(locale) : null;
  const parts = [];
  const uploaded = formatYmd(stats.uploadedAt);
  const duration = typeof stats.durationSec === "number" && stats.durationSec > 0
    ? new Date(stats.durationSec * 1000).toISOString().slice(11, 19).replace(/^00:/, "")
    : null;
  const formatEntry = (key, value) => value ? `【${t(key)}】 ${value}` : null;
  const base = [
    uploaded ? formatEntry("stat_uploaded", uploaded) : null,
    duration ? formatEntry("stat_duration", duration) : null,
    fmtNumber(stats.viewCount) ? formatEntry("stat_views", fmtNumber(stats.viewCount)) : null,
    fmtNumber(stats.commentCount) ? formatEntry("stat_comments", fmtNumber(stats.commentCount)) : null,
    stats.uploader ? formatEntry("stat_uploader", stats.uploader) : null,
  ];
  parts.push(...base.filter(Boolean));
  const site = stats.site ?? "other";
  if ((site === "youtube" || site === "other") && fmtNumber(stats.likeCount)) {
    parts.push(formatEntry("stat_likes", fmtNumber(stats.likeCount)));
  }
  if (site === "youtube" && fmtNumber(stats.dislikeCount)) {
    parts.push(formatEntry("stat_dislikes", fmtNumber(stats.dislikeCount)));
  }
  if (site === "nicovideo" && fmtNumber(stats.mylistCount)) {
    parts.push(formatEntry("stat_mylist", fmtNumber(stats.mylistCount)));
  }
  if (site === "nicovideo" && fmtNumber(stats.favoriteCount)) {
    parts.push(formatEntry("stat_favorites", fmtNumber(stats.favoriteCount)));
  }
  if (site === "bilibili" && fmtNumber(stats.danmakuCount)) {
    parts.push(formatEntry("stat_danmaku", fmtNumber(stats.danmakuCount)));
  }
  const fetchedYmd = formatYmd(stats.metaRefreshedAt ?? Date.now());
  if (fetchedYmd) {
    parts.push(formatEntry("stat_fetched", fetchedYmd));
  }
  const remainingCount = typeof stats.pendingItems === "number" ? stats.pendingItems : null;
  if (remainingCount !== null) {
    const remainingDuration = formatDurationSec(stats.pendingDurationSec ?? null) ?? "--:--";
    const remainingValue = t("stat_remaining_summary_value", { count: remainingCount, duration: remainingDuration });
    parts.push(formatEntry("stat_remaining_summary", remainingValue));
  }
  return parts.filter(Boolean).join(" ");
};

const connect = () => {
  if (source) source.close();
  source = new EventSource("/api/overlay-info/stream");

  source.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data?.event === "locale" && data.locale) {
        if (data.locale === "auto") {
          const nav = navigator.language || navigator.userLanguage || "en";
          setLocale(nav);
        } else {
          setLocale(data.locale);
        }
        return;
      }
      if (data?.event === "notify" && data.payload) {
        showMessage(data.payload);
        return;
      }
    } catch (err) {
      console.error("[InfoOverlay] failed to handle message", err);
    }
  };

  source.onerror = () => {
    source?.close();
    source = null;
    setTimeout(connect, 2000);
  };
};

globalThis.addEventListener("resize", () => {
  for (const entry of activeBands) {
    applyMarquee(entry.band, entry.payloadEl, entry.textClone, entry.marqueeEl);
  }
});

connect();
