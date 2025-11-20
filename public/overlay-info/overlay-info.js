import { detectLocale, setLocale, t } from "/i18n.js";

const infoBand = document.getElementById("band");
const marquee = document.getElementById("marquee");
const labelText = document.getElementById("labelText");
const payloadEl = document.getElementById("payload");
const textClone = document.getElementById("textClone");

const statusBand = document.getElementById("statusBand");
const statusMarquee = document.getElementById("statusMarquee");
const statusLabelText = document.getElementById("statusLabelText");
const statusPayload = document.getElementById("statusPayload");
const statusTextClone = document.getElementById("statusTextClone");

let source = null;
let infoTimer = null;
let statusTimer = null;

await detectLocale().then(setLocale);

const safeText = (value) => (value ?? "").toString();

const updateStatusBandPosition = () => {
  if (!statusBand) return;
  if (!statusBand.classList.contains("visible")) {
    statusBand.style.top = "0px";
    return;
  }
  const stacked = infoBand && infoBand.classList.contains("visible");
  statusBand.style.top = stacked ? "var(--band-height)" : "0px";
};

const applyMarquee = (container, textEl, cloneEl, marqueeEl) => {
  marqueeEl.classList.remove("scroll");
  marqueeEl.style.removeProperty("--scroll-distance");
  marqueeEl.style.removeProperty("animation-duration");
  cloneEl.textContent = "";
  const distance = textEl.scrollWidth - container.clientWidth + 40;
  if (distance > 0) {
    marqueeEl.style.setProperty("--scroll-distance", `${distance}px`);
    cloneEl.textContent = textEl.textContent;
    const durationSec = Math.max(8, distance / 30);
    marqueeEl.style.animationDuration = `${durationSec}s`;
    marqueeEl.classList.add("scroll");
  }
};

const showBand = (bandEl, timerName) => {
  bandEl.classList.remove("exit-left");
  bandEl.classList.add("visible");
  if (timerName === "info" && infoTimer) clearTimeout(infoTimer);
  if (timerName === "status" && statusTimer) clearTimeout(statusTimer);
  updateStatusBandPosition();
  const timer = setTimeout(() => {
    bandEl.classList.remove("visible");
    bandEl.classList.add("exit-left");
    updateStatusBandPosition();
    setTimeout(() => {
      bandEl.classList.remove("exit-left");
      updateStatusBandPosition();
    }, 260);
  }, 5000);
  if (timerName === "info") infoTimer = timer;
  else statusTimer = timer;
};

const showMessage = (payload) => {
  const level = payload.level ?? "info";
  const isStatus = payload.scope === "status";
  const band = isStatus ? statusBand : infoBand;
  const marqueeEl = isStatus ? statusMarquee : marquee;
  const labelEl = isStatus ? statusLabelText : labelText;
  const textEl = isStatus ? statusPayload : payloadEl;
  const cloneEl = isStatus ? statusTextClone : textClone;

  band.dataset.level = level;
  const titleText = payload.titleKey ? t(payload.titleKey, payload.params) : payload.title ?? "";
  let bodyText = payload.messageKey ? t(payload.messageKey, payload.params) : payload.message ?? "";
  if (payload.stats) {
    const statsLine = renderStats(payload.stats);
    bodyText = statsLine ? `${bodyText ? bodyText + " · " : ""}${statsLine}` : bodyText;
  }
  const fullText = `${bodyText || titleText || ""}`.trim();
  labelEl.textContent = (!isStatus && payload.titleKey === "request_play_title")
    ? t(payload.titleKey, payload.params)
    : "";
  
  if (payload.messageKey === "poll_result_body" && payload.params?.winner) {
    const { yes, no, winner } = payload.params;
    const yesLabel = t("poll_vote_yes");
    const noLabel = t("poll_vote_no");
    const yesClass = winner === "yes" ? "poll-winner" : "";
    const noClass = winner === "no" ? "poll-winner" : "";
    textEl.innerHTML = `<span class="${yesClass}">${yesLabel}: ${yes}%</span> <span class="poll-sep"></span> <span class="${noClass}">${noLabel}: ${no}%</span>`;
  } else {
    textEl.textContent = safeText(fullText);
  }

  textEl.dataset.rawStats = payload.stats ? JSON.stringify(payload.stats) : "";
  applyMarquee(band, textEl, cloneEl, marqueeEl);
  showBand(band, isStatus ? "status" : "info");
};

const renderStats = (stats) => {
  const locale = navigator.language?.toLowerCase().startsWith("ja") ? "ja" : "en";
  const fmtNumber = (n) =>
    typeof n === "number" && Number.isFinite(n) ? n.toLocaleString(locale) : null;
  const parts = [];
  const uploaded = typeof stats.uploadedAt === "number"
    ? new Date(stats.uploadedAt).toLocaleDateString(locale === "ja" ? "ja-JP" : "en-US")
    : null;
  const duration = typeof stats.durationSec === "number" && stats.durationSec > 0
    ? new Date(stats.durationSec * 1000).toISOString().slice(11, 19).replace(/^00:/, "")
    : null;
  const fetched = typeof stats.metaRefreshedAt === "number"
    ? new Date(stats.metaRefreshedAt).toLocaleTimeString(locale === "ja" ? "ja-JP" : "en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    })
    : new Date().toLocaleTimeString(locale === "ja" ? "ja-JP" : "en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    });
  const base = [
    uploaded ? `${t("stat_uploaded")}${uploaded}` : null,
    duration ? `${t("stat_duration")}${duration}` : null,
    fmtNumber(stats.viewCount) ? `${t("stat_views")}${fmtNumber(stats.viewCount)}` : null,
    fmtNumber(stats.commentCount) ? `${t("stat_comments")}${fmtNumber(stats.commentCount)}` : null,
    stats.uploader ? `${t("stat_uploader")}${stats.uploader}` : null,
    fetched ? `${t("stat_fetched")}${fetched}` : null,
  ];
  parts.push(...base.filter(Boolean));
  const site = stats.site ?? "other";
  if ((site === "youtube" || site === "other") && fmtNumber(stats.likeCount)) {
    parts.push(`${t("stat_likes")}${fmtNumber(stats.likeCount)}`);
  }
  if (site === "youtube" && fmtNumber(stats.dislikeCount)) {
    parts.push(`${t("stat_dislikes")}${fmtNumber(stats.dislikeCount)}`);
  }
  if (site === "nicovideo" && fmtNumber(stats.mylistCount)) {
    parts.push(`${t("stat_mylist")}${fmtNumber(stats.mylistCount)}`);
  }
  if (site === "nicovideo" && fmtNumber(stats.favoriteCount)) {
    parts.push(`${t("stat_favorites")}${fmtNumber(stats.favoriteCount)}`);
  }
  if (site === "bilibili" && fmtNumber(stats.danmakuCount)) {
    parts.push(`${t("stat_danmaku")}${fmtNumber(stats.danmakuCount)}`);
  }
  return parts.filter(Boolean).join(" · ");
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

window.addEventListener("resize", () => {
  applyMarquee(infoBand, payloadEl, textClone, marquee);
  applyMarquee(statusBand, statusPayload, statusTextClone, statusMarquee);
  updateStatusBandPosition();
});

connect();
