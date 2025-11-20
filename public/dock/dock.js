import { detectLocale, getLocale, setLocale, t } from "/i18n.js";

const summaryMetricsEl = document.getElementById("summaryMetrics");
const queueListEl = document.getElementById("queueList");
const refreshButton = document.getElementById("refreshButton");
const clearButton = document.getElementById("clearButton");
const queueCounterEl = document.getElementById("queueCounter");
const statusAreaEl = document.getElementById("statusArea");
const tabButtons = document.querySelectorAll(".tab-button");
const tabPanels = {
  list: document.getElementById("tabList"),
  debug: document.getElementById("tabDebug"),
  comments: document.getElementById("tabComments"),
  system: document.getElementById("tabSystem"),
  rules: document.getElementById("tabRules"),
};
const stopButton = document.getElementById("stopButton");
const autoButton = document.getElementById("autoButton");
const intakeButton = document.getElementById("intakeButton");
const skipButton = document.getElementById("skipButton");
const commentForm = document.getElementById("commentForm");
const commentInput = document.getElementById("commentInput");
const userNameInput = document.getElementById("userNameInput");
const formStatus = document.getElementById("formStatus");
const commentTableBody = document.getElementById("commentTableBody");
const updateYtDlpButton = document.getElementById("updateYtDlpButton");
const refreshYtDlpEjsButton = document.getElementById("refreshYtDlpEjsButton");
const systemMessageEl = document.getElementById("systemMessage");
const playbackControlsEl = document.getElementById("playbackControls");
const playbackSeekEl = document.getElementById("playbackSeek");
const playbackCurrentEl = document.getElementById("playbackCurrent");
const playbackDurationEl = document.getElementById("playbackDuration");
const seekBackwardButton = document.getElementById("seekBackwardButton");
const seekForwardButton = document.getElementById("seekForwardButton");
const pauseButton = document.getElementById("pauseButton");
const ruleEnableToggle = document.getElementById("ruleEnableToggle");
const ruleMaxDurationInput = document.getElementById("ruleMaxDuration");
const ruleNoDuplicateToggle = document.getElementById("ruleNoDuplicateToggle");
const ruleCooldownMinutesInput = document.getElementById("ruleCooldownMinutes");
const ruleCooldownHint = document.getElementById("ruleCooldownHint");
const rulePollEnableToggle = document.getElementById("rulePollEnableToggle");
const rulePollIntervalInput = document.getElementById("rulePollInterval");
const rulePollWindowInput = document.getElementById("rulePollWindow");
const rulePollStopDelayInput = document.getElementById("rulePollStopDelay");
const ruleSaveButton = document.getElementById("ruleSaveButton");
const ruleStatus = document.getElementById("ruleStatus");
const localeSelect = document.getElementById("localeSelect");

const configureLocale = async () => {
  const locale = await detectLocale();
  setLocale(locale);
  if (localeSelect) localeSelect.value = locale ?? "auto";
  const tabs = Array.from(tabButtons);
  if (tabs[0]) tabs[0].textContent = t("tab_list");
  if (tabs[1]) tabs[1].textContent = t("tab_debug");
  if (tabs[2]) tabs[2].textContent = t("tab_comments");
  if (tabs[3]) tabs[3].textContent = t("tab_system");
  if (tabs[4]) tabs[4].textContent = t("tab_rules");
  const localeOptions = localeSelect?.querySelectorAll("option");
  if (localeOptions?.[0]) localeOptions[0].textContent = t("locale_auto");
  if (localeOptions?.[1]) localeOptions[1].textContent = t("locale_ja");
  if (localeOptions?.[2]) localeOptions[2].textContent = t("locale_en");
  if (ruleEnableToggle?.parentElement) {
    const parent = ruleEnableToggle.parentElement;
    parent.innerHTML = "";
    parent.appendChild(ruleEnableToggle);
    const label = document.createElement("span");
    label.textContent = t("rule_enable");
    parent.appendChild(label);
  }
  if (rulePollEnableToggle?.parentElement) {
    const parent = rulePollEnableToggle.parentElement;
    parent.innerHTML = "";
    parent.appendChild(rulePollEnableToggle);
    const label = document.createElement("span");
    label.textContent = t("rule_poll_enable");
    parent.appendChild(label);
  }
  const maxLabel = document.querySelector("label[for='ruleMaxDuration']");
  if (maxLabel) maxLabel.textContent = t("rule_max");
  const pollIntervalLabel = document.querySelector("label[for='rulePollInterval']");
  if (pollIntervalLabel) pollIntervalLabel.textContent = t("rule_poll_interval");
  const pollWindowLabel = document.querySelector("label[for='rulePollWindow']");
  if (pollWindowLabel) pollWindowLabel.textContent = t("rule_poll_window");
  const pollStopDelayLabel = document.querySelector("label[for='rulePollStopDelay']");
  if (pollStopDelayLabel) pollStopDelayLabel.textContent = t("rule_poll_stop_delay");
  if (ruleNoDuplicateToggle?.parentElement) {
    const parent = ruleNoDuplicateToggle.parentElement;
    parent.innerHTML = "";
    parent.appendChild(ruleNoDuplicateToggle);
    const label = document.createElement("span");
    label.textContent = t("rule_no_duplicate");
    parent.appendChild(label);
  }
  const cooldownLabel = document.querySelector("label[for='ruleCooldownMinutes']");
  if (cooldownLabel) cooldownLabel.textContent = t("rule_cooldown");
  if (ruleCooldownHint) ruleCooldownHint.textContent = t("rule_cooldown_hint");
  if (ruleSaveButton) ruleSaveButton.textContent = t("rule_save");
  const headerRow = document.querySelector(".comment-table-header");
  if (headerRow) {
    const spans = headerRow.querySelectorAll("span");
    if (spans[0]) spans[0].textContent = t("comments_header_time");
    if (spans[1]) spans[1].textContent = t("comments_header_user");
    if (spans[2]) spans[2].textContent = t("comments_header_body");
  }
  const inUse = document.getElementById("ytDlpInUseLabel");
  if (inUse) inUse.textContent = t("system_in_use");
  const latest = document.getElementById("ytDlpLatestLabel");
  if (latest) latest.textContent = t("system_latest");
  const ejs = document.getElementById("ytDlpEjsLabel");
  if (ejs) ejs.textContent = t("system_ejs");
  // buttons
  stopButton?.setAttribute("title", t("btn_stop"));
  autoButton?.setAttribute("title", t("btn_auto"));
  intakeButton?.setAttribute("title", t("btn_intake"));
  skipButton?.setAttribute("title", t("btn_skip"));
  refreshButton?.setAttribute("title", t("btn_refresh"));
  if (stopButtonIcon) stopButtonIcon.alt = t("btn_stop");
  if (autoButtonIcon) autoButtonIcon.alt = t("btn_auto");
  if (intakeButtonIcon) intakeButtonIcon.alt = t("btn_intake");
  if (skipButton?.firstElementChild instanceof HTMLImageElement) {
    skipButton.firstElementChild.alt = t("btn_skip");
  }
  clearButton.textContent = t("btn_clear");
  seekBackwardButton.textContent = t("seek_back");
  seekForwardButton.textContent = t("seek_forward");
  if (updateYtDlpButton) updateYtDlpButton.textContent = t("system_update_btn");
  if (refreshYtDlpEjsButton) refreshYtDlpEjsButton.textContent = t("system_refresh_ejs_btn");
  if (commentFormLabel) commentFormLabel.textContent = t("comment_label");
  if (commentInput) commentInput.placeholder = t("comment_placeholder");
  if (userNameLabel) userNameLabel.textContent = t("user_label");
  if (userNameInput) userNameInput.placeholder = t("user_placeholder");
  if (commentSubmitButton) commentSubmitButton.textContent = t("comment_submit");
  const suspendButton = contextMenu.querySelector("[data-action='suspend']");
  const resumeButton = contextMenu.querySelector("[data-action='resume']");
  if (suspendButton) suspendButton.textContent = t("ctx_suspend");
  if (resumeButton) resumeButton.textContent = t("ctx_resume");
  const copyLinkBtn = itemMenu.querySelector("[data-action='copy-link']");
  const copyTitleBtn = itemMenu.querySelector("[data-action='copy-title']");
  if (copyLinkBtn) copyLinkBtn.textContent = t("copy_link");
  if (copyTitleBtn) copyTitleBtn.textContent = t("copy_title");
};

let currentPlayingId = null;
let queueItemsSnapshot = [];
let lastSelectedId = null;
const selectedRequestIds = new Set();
const stopButtonIcon = stopButton.querySelector("img");
const autoButtonIcon = autoButton?.querySelector("img");
const intakeButtonIcon = intakeButton?.querySelector("img");
let playbackState = null;
let playbackAnimationId = null;
let playbackLastUpdate = 0;
let isUserSeeking = false;

const updateAutoplayButtonState = (paused) => {
  if (!autoButton) return;
  autoButton.classList.toggle("paused", paused);
  autoButton.setAttribute("aria-pressed", paused ? "true" : "false");
  autoButton.title = t("btn_auto");
  if (autoButtonIcon) {
    autoButtonIcon.src = paused ? "/icons/play_arrow.svg" : "/icons/auto_mode.svg";
    autoButtonIcon.alt = t("btn_auto");
  }
};

const updateIntakeButtonState = (paused) => {
  if (!intakeButton) return;
  intakeButton.classList.toggle("paused", paused);
  intakeButton.setAttribute("aria-pressed", paused ? "true" : "false");
  intakeButton.title = t("btn_intake");
  if (intakeButtonIcon) {
    intakeButtonIcon.src = paused ? "/icons/block.svg" : "/icons/block.svg";
    intakeButtonIcon.alt = t("btn_intake");
  }
};

const contextMenu = document.createElement("div");
contextMenu.id = "queueContextMenu";
contextMenu.className = "context-menu hidden";
contextMenu.innerHTML = `
  <button type="button" data-action="suspend">${t("ctx_suspend")}</button>
  <button type="button" data-action="resume">${t("ctx_resume")}</button>
`;
document.body.appendChild(contextMenu);

const itemMenu = document.createElement("div");
itemMenu.id = "itemContextMenu";
itemMenu.className = "context-menu hidden";
itemMenu.innerHTML = `
  <button type="button" data-action="copy-link">${t("copy_link") ?? "Copy link"}</button>
  <button type="button" data-action="copy-title">${t("copy_title") ?? "Copy title"}</button>
`;
document.body.appendChild(itemMenu);
let itemMenuTarget = null;

contextMenu.addEventListener("click", (event) => {
  const button = event.target;
  if (!(button instanceof HTMLButtonElement)) return;
  const action = button.dataset.action;
  hideContextMenu();
  if (action === "suspend") {
    applySelectionAction("suspend");
  } else if (action === "resume") {
    applySelectionAction("resume");
  }
});

const hideContextMenu = () => {
  contextMenu.classList.add("hidden");
};
const hideItemMenu = () => {
  itemMenu.classList.add("hidden");
  itemMenuTarget = null;
};

const updateContextMenuButtons = () => {
  const suspendButton = contextMenu.querySelector('[data-action="suspend"]');
  const resumeButton = contextMenu.querySelector('[data-action="resume"]');
  const items = getSelectedItems();
  if (items.length === 0) {
    suspendButton?.classList.add("hidden");
    resumeButton?.classList.add("hidden");
    return false;
  }
  const suspendCount = items.filter((item) => item.status === "SUSPEND").length;
  const activeCount = items.length - suspendCount;
  suspendButton?.classList.toggle("hidden", activeCount === 0);
  resumeButton?.classList.toggle("hidden", suspendCount === 0);
  const suspendVisible = suspendButton && !suspendButton.classList.contains("hidden");
  const resumeVisible = resumeButton && !resumeButton.classList.contains("hidden");
  return Boolean(suspendVisible || resumeVisible);
};

const openContextMenu = (x, y) => {
  if (!updateContextMenuButtons()) {
    hideContextMenu();
    return;
  }
  contextMenu.style.left = `${x}px`;
  contextMenu.style.top = `${y}px`;
  contextMenu.classList.remove("hidden");
};

const openItemMenu = (x, y, item) => {
  hideContextMenu();
  if (!item) return;
  itemMenuTarget = item;
  itemMenu.style.left = `${x}px`;
  itemMenu.style.top = `${y}px`;
  itemMenu.classList.remove("hidden");
};

document.addEventListener("click", (event) => {
  if (!contextMenu.contains(event.target)) {
    hideContextMenu();
  }
  if (!itemMenu.contains(event.target)) {
    hideItemMenu();
  }
});
document.addEventListener("scroll", () => {
  hideContextMenu();
  hideItemMenu();
}, true);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") hideContextMenu();
  if (event.key === "Escape") hideItemMenu();
});
globalThis.addEventListener("resize", () => {
  hideContextMenu();
  hideItemMenu();
});

const disablePlaybackControls = () => {
  if (!playbackControlsEl) return;
  playbackControlsEl.classList.add("disabled");
  if (playbackSeekEl) {
    playbackSeekEl.disabled = true;
    playbackSeekEl.value = "0";
    playbackSeekEl.max = "1";
  }
  if (playbackCurrentEl) playbackCurrentEl.textContent = "--:--";
  if (playbackDurationEl) playbackDurationEl.textContent = "--:--";
  seekBackwardButton?.setAttribute("disabled", "true");
  seekForwardButton?.setAttribute("disabled", "true");
  pauseButton?.setAttribute("disabled", "true");
};

disablePlaybackControls();

const formatTimeLabel = (value) => formatDuration(value || 0);

const updatePlaybackSeekDisplay = (position) => {
  if (!playbackSeekEl || isUserSeeking) return;
  playbackSeekEl.value = String(position);
  if (playbackCurrentEl) playbackCurrentEl.textContent = formatTimeLabel(position);
};

const applyPlaybackState = (state) => {
  if (!playbackControlsEl || !playbackSeekEl) return;
  playbackState = state;
  if (!state) {
    disablePlaybackControls();
    stopPlaybackAnimation();
    return;
  }
  playbackControlsEl.classList.toggle("disabled", false);
  const duration = state.durationSec ?? 0;
  playbackSeekEl.disabled = !(duration > 0);
  playbackSeekEl.max = String(Math.max(duration, 1));
  playbackDurationEl.textContent = duration > 0 ? formatTimeLabel(duration) : "--:--";
  playbackLastUpdate = performance.now();
  updatePlaybackSeekDisplay(state.positionSec);
  seekBackwardButton?.removeAttribute("disabled");
  seekForwardButton?.removeAttribute("disabled");
  pauseButton?.removeAttribute("disabled");
  pauseButton?.classList.toggle("paused", !state.isPlaying);
  if (pauseButton?.firstElementChild instanceof HTMLImageElement) {
    pauseButton.firstElementChild.src = state.isPlaying ? "/icons/pause.svg" : "/icons/play_arrow.svg";
    pauseButton.firstElementChild.alt = state.isPlaying ? t("btn_pause") : t("btn_resume");
  }
  if (state.isPlaying) {
    startPlaybackAnimation();
  } else {
    stopPlaybackAnimation();
  }
};

const startPlaybackAnimation = () => {
  if (playbackAnimationId || !playbackState) return;
  const step = () => {
    if (!playbackState || !playbackState.isPlaying) {
      playbackAnimationId = null;
      return;
    }
    if (!isUserSeeking) {
      const now = performance.now();
      const delta = (now - playbackLastUpdate) / 1000;
      playbackLastUpdate = now;
      const duration = playbackState.durationSec ?? Number.POSITIVE_INFINITY;
      playbackState.positionSec = Math.min(duration, playbackState.positionSec + delta);
      updatePlaybackSeekDisplay(playbackState.positionSec);
    }
    playbackAnimationId = requestAnimationFrame(step);
  };
  playbackAnimationId = requestAnimationFrame(step);
};

const stopPlaybackAnimation = () => {
  if (playbackAnimationId) {
    cancelAnimationFrame(playbackAnimationId);
    playbackAnimationId = null;
  }
};

const sendSeekRequest = async (payload) => {
  if (!playbackState) return;
  try {
    await fetchJSON("/api/overlay/seek", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  } catch (err) {
    formStatus.textContent = t("msg_seek_fail", err.message);
  }
};

if (playbackSeekEl) {
  playbackSeekEl.addEventListener("pointerdown", () => {
    isUserSeeking = true;
  });
  playbackSeekEl.addEventListener("pointerup", () => {
    isUserSeeking = false;
  });
  playbackSeekEl.addEventListener("input", () => {
    if (!playbackCurrentEl) return;
    isUserSeeking = true;
    playbackCurrentEl.textContent = formatTimeLabel(Number(playbackSeekEl.value));
  });
  playbackSeekEl.addEventListener("change", () => {
    isUserSeeking = false;
    const target = Number(playbackSeekEl.value);
    if (Number.isFinite(target)) {
      sendSeekRequest({ positionSec: target });
    }
  });
}

seekBackwardButton?.addEventListener("click", () => sendSeekRequest({ deltaSec: -10 }));
seekForwardButton?.addEventListener("click", () => sendSeekRequest({ deltaSec: 10 }));
pauseButton?.addEventListener("click", async () => {
  if (!playbackState) return;
  pauseButton.disabled = true;
  try {
    const endpoint = playbackState.isPlaying ? "/api/overlay/pause" : "/api/overlay/resume";
    const result = await fetchJSON(endpoint, { method: "POST" });
    if (result?.state) {
      applyPlaybackState({
        ...playbackState,
        positionSec: result.state.positionSec ?? playbackState.positionSec,
        durationSec: result.state.durationSec ?? playbackState.durationSec,
        isPlaying: Boolean(result.state.isPlaying),
      });
    } else {
      playbackState.isPlaying = !playbackState.isPlaying;
      applyPlaybackState(playbackState);
    }
  } catch (err) {
    formStatus.textContent = t("msg_pause_fail", err.message);
  } finally {
    pauseButton.disabled = false;
    refreshAll();
  }
});

const statusLabel = (status) => {
  const key = `status_label_${status.toLowerCase()}`;
  return t(key);
};

const PLAYABLE_STATUSES = new Set(["READY", "DONE"]);
const DELETABLE_STATUSES = new Set(["QUEUED", "READY", "DONE", "FAILED", "REJECTED", "SUSPEND"]);
const REORDERABLE_STATUSES = new Set([
  "QUEUED",
  "VALIDATING",
  "DOWNLOADING",
  "READY",
  "DONE",
  "SUSPEND",
]);

const formatDuration = (value) => {
  if (!Number.isFinite(value)) return "--";
  const total = Math.floor(value);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n) => n.toString().padStart(2, "0");
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  return `${minutes}:${pad(seconds)}`;
};

const fetchJSON = async (url, options = {}) => {
  const res = await fetch(url, {
    headers: options.method && options.method !== "GET"
      ? { "content-type": "application/json", ...(options.headers ?? {}) }
      : options.headers,
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "request failed");
  }
  return res.json();
};

const renderSummary = (data) => {
  const duration = formatDuration(data.totalDurationSecPending || 0);
  const items = data.totalPendingItems ?? 0;
  summaryMetricsEl.innerHTML = `
    <div class="metric">
      <span class="metric-label">${t("summary_items")}</span>
      <span class="metric-value">${t("pending_items", items)}</span>
      <span class="metric-count">(${duration})</span>
    </div>
  `;
  queueCounterEl.textContent = t("queue_count", data.totalItems ?? 0);
  statusAreaEl.innerHTML = `
    <span class="status-dot ${data.overlayConnected ? "online" : "offline"}"></span>
    <span>${data.overlayConnected ? t("status_overlay_connected") : t("status_overlay_disconnected")}</span>
    <span class="status-text-inline">${t("status_downloading", data.downloadingCount ?? 0)}</span>
    <span class="status-text-inline">${t("status_autoplay", !data.autoplayPaused)}</span>
    <span class="status-text-inline">${t("status_intake", !data.intakePaused)}</span>
  `;
  updateAutoplayButtonState(Boolean(data.autoplayPaused));
  updateIntakeButtonState(Boolean(data.intakePaused));
  applyPlaybackState(data.currentPlayback ?? null);
};

const renderEmptyState = () => {
  const empty = document.createElement("div");
  empty.className = "queue-card";
  empty.textContent = t("queue_empty");
  queueListEl.appendChild(empty);
};

const createStatusChip = (item) => {
  const chip = document.createElement("span");
  chip.className = `status-chip ${item.status.toLowerCase()}`;
  const label = document.createElement("span");
  label.className = "status-label";
  label.textContent = statusLabel(item.status) ?? item.status;
  chip.appendChild(label);

  return chip;
};

const createPriorityCell = (item) => {
  const cell = document.createElement("span");
  cell.className = "queue-priority-cell";
  if (item.status === "SUSPEND") {
    cell.classList.add("suspend");
  }
  const input = document.createElement("input");
  input.type = "number";
  input.inputMode = "numeric";
  input.min = "1";
  input.step = "1";
  input.className = "priority-input";
  const hasNumericPosition = Number.isFinite(item.queuePosition);
  const currentValue = hasNumericPosition ? item.queuePosition : "";
  if (currentValue === "") {
    input.placeholder = "--";
  } else {
    input.value = String(currentValue);
  }
  input.dataset.currentOrder = hasNumericPosition ? String(currentValue) : "";
  if (REORDERABLE_STATUSES.has(item.status)) {
    input.addEventListener("change", () => {
      if (input.dataset.skipNextChange === "true") {
        delete input.dataset.skipNextChange;
        return;
      }
      handleOrderChange(item.id, input);
    });
    input.addEventListener("focus", () => input.select());
    input.addEventListener("mousedown", (event) => event.stopPropagation());
    input.addEventListener("click", (event) => event.stopPropagation());
    input.addEventListener("input", (event) => {
      const spinnerEvent = event.inputType === "insertReplacementText" ||
        (event.inputType === "insertText" && event.data === null);
      if (!spinnerEvent) return;
      const previous = Number(input.dataset.currentOrder ?? "1");
      const rawNext = Number(input.value || previous);
      const delta = rawNext - previous;
      if (delta === 0) return;
      const adjusted = Math.max(1, previous - delta);
      input.value = String(adjusted);
      input.dataset.currentOrder = String(adjusted);
      input.dataset.skipNextChange = "true";
      handleOrderChange(item.id, input);
    });
  } else {
    input.readOnly = true;
    input.tabIndex = -1;
    input.classList.add("static");
  }
  cell.appendChild(input);
  return cell;
};

const createDurationCell = (item) => {
  const cell = document.createElement("span");
  cell.className = "queue-duration-cell";
  if (item.status === "PLAYING") {
    cell.textContent = formatDuration(item.durationSec ?? 0);
  } else if (Number.isFinite(item.durationSec)) {
    cell.textContent = formatDuration(item.durationSec);
  } else {
    cell.textContent = "--";
  }
  return cell;
};

const createActionButton = (
  label,
  handler,
  { disabled = false, className = "", icon = null } = {},
) => {
  const button = document.createElement("button");
  button.type = "button";
  if (icon) {
    const img = document.createElement("img");
    img.src = icon;
    img.alt = label ?? "";
    button.appendChild(img);
  } else {
    button.textContent = label;
  }
  if (className) button.classList.add(className);
  button.disabled = disabled;
  button.addEventListener("click", async (event) => {
    event.stopPropagation();
    try {
      await handler(event);
    } catch (err) {
      console.error(err);
      if (formStatus) {
        const actionLabel = label ?? "";
        const msg = err instanceof Error ? err.message : String(err);
        formStatus.textContent = t("msg_action_fail", { label: actionLabel, msg });
      }
    }
  });
  return button;
};

const resetRowAnimations = () => {
  queueListEl.querySelectorAll(".queue-row").forEach((row) => {
    row.style.transition = "";
    row.style.transform = "";
    row.getBoundingClientRect();
  });
};

const captureRowPositions = () => {
  const rects = new Map();
  queueListEl.querySelectorAll(".queue-row").forEach((row) => {
    const id = row.dataset.id;
    if (id) rects.set(id, { top: row.offsetTop, left: row.offsetLeft });
  });
  return rects;
};

const animateRowTransitions = (previousRects) => {
  requestAnimationFrame(() => {
    queueListEl.querySelectorAll(".queue-row").forEach((row) => {
      const id = row.dataset.id;
      if (!id) return;
      const previous = previousRects.get(id);
      if (!previous) return;
      const deltaX = previous.left - row.offsetLeft;
      const deltaY = previous.top - row.offsetTop;
      if (deltaX === 0 && deltaY === 0) return;
      row.style.transition = "none";
      row.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
      requestAnimationFrame(() => {
        row.style.transition = "transform 0.3s linear";
        row.style.transform = "";
        const handleEnd = () => {
          row.style.transition = "";
          row.removeEventListener("transitionend", handleEnd);
        };
        row.addEventListener("transitionend", handleEnd);
      });
    });
  });
};

const renderQueue = (items) => {
  resetRowAnimations();
  const previousRects = captureRowPositions();
  hideContextMenu();
  queueItemsSnapshot = items.slice();
  queueListEl.innerHTML = "";
  currentPlayingId = null;
  if (!items.length) {
    renderEmptyState();
    stopButton.disabled = true;
    skipButton.disabled = true;
    clearButton.disabled = true;
    return;
  }
  stopButton.disabled = false;
  for (const id of Array.from(selectedRequestIds)) {
    if (!queueItemsSnapshot.some((item) => item.id === id)) {
      selectedRequestIds.delete(id);
      if (lastSelectedId === id) {
        lastSelectedId = null;
      }
    }
  }
  clearButton.disabled = false;
  items.forEach((item, index) => {
    if (item.status === "PLAYING") {
      currentPlayingId = item.id;
    }
    const row = document.createElement("article");
    row.className = "queue-row";
    row.dataset.id = item.id;
    row.dataset.index = String(index);
    if (item.status === "PLAYING") row.classList.add("playing");
    if (item.status === "DONE") row.classList.add("done");
    if (item.status === "SUSPEND") {
      row.classList.add("suspend");
      if (item.statusReason) {
        const label = statusLabel(item.statusReason) || item.statusReason;
        row.title = t("tooltip_suspend_origin", { reason: label });
      } else {
        row.title = t("tooltip_suspend_plain");
      }
    } else if (item.statusReason) {
      row.title = item.statusReason;
    }

    const playButton = createActionButton(t("action_play"), async () => {
      await fetchJSON(`/api/requests/${item.id}/play`, { method: "POST" });
      refreshAll();
    }, { disabled: !PLAYABLE_STATUSES.has(item.status), icon: "/icons/play_arrow.svg" });

    const deleteButton = createActionButton(t("action_delete"), async () => {
      if (!confirm(t("confirm_delete"))) return;
      await fetchJSON(`/api/requests/${item.id}/delete`, { method: "POST" });
      refreshAll();
    }, {
      disabled: !DELETABLE_STATUSES.has(item.status),
      className: "delete",
      icon: "/icons/delete.svg",
    });

    const statusCell = createStatusChip(item);
    const priorityCell = createPriorityCell(item);
    const durationCell = createDurationCell(item);
    const titleLink = document.createElement("span");
    titleLink.className = "queue-title-link unselectable";
    titleLink.textContent = item.title ?? t("queue_title_loading");
    titleLink.dataset.url = item.url;
    titleLink.title = item.url;

    row.appendChild(playButton);
    row.appendChild(statusCell);
    row.appendChild(priorityCell);
    row.appendChild(durationCell);
    row.appendChild(titleLink);
    row.appendChild(deleteButton);
    row.addEventListener("click", (event) => handleRowClick(event, item.id));
    row.addEventListener("contextmenu", (event) => handleRowContextMenu(event, item.id));
    queueListEl.appendChild(row);
  });
  updateRowSelectionStyles();
  animateRowTransitions(previousRects);
  const hasPlaying = Boolean(currentPlayingId);
  stopButton.disabled = !hasPlaying;
  skipButton.disabled = !hasPlaying;
};

const getIndexById = (requestId) => queueItemsSnapshot.findIndex((item) => item.id === requestId);
const getSelectedItems = () => queueItemsSnapshot.filter((item) => selectedRequestIds.has(item.id));

const updateRowSelectionStyles = () => {
  const rows = queueListEl.querySelectorAll(".queue-row");
  rows.forEach((row) => {
    const id = row.dataset.id;
    row.classList.toggle("selected", Boolean(id && selectedRequestIds.has(id)));
  });
};

const handleRowClick = (event, requestId) => {
  hideContextMenu();
  const index = getIndexById(requestId);
  if (index === -1) return;
  if (event.shiftKey && lastSelectedId) {
    const lastIndex = getIndexById(lastSelectedId);
    if (lastIndex !== -1) {
      selectedRequestIds.clear();
      const [start, end] = index < lastIndex ? [index, lastIndex] : [lastIndex, index];
      for (let i = start; i <= end; i++) {
        selectedRequestIds.add(queueItemsSnapshot[i].id);
      }
    } else {
      selectedRequestIds.clear();
      selectedRequestIds.add(requestId);
    }
  } else if (event.metaKey || event.ctrlKey) {
    if (selectedRequestIds.has(requestId)) {
      selectedRequestIds.delete(requestId);
    } else {
      selectedRequestIds.add(requestId);
    }
  } else {
    selectedRequestIds.clear();
    selectedRequestIds.add(requestId);
  }
  lastSelectedId = requestId;
  updateRowSelectionStyles();
};

const handleRowContextMenu = (event, requestId) => {
  event.preventDefault();
  const index = getIndexById(requestId);
  if (index === -1) return;
  if (!selectedRequestIds.has(requestId)) {
    selectedRequestIds.clear();
    selectedRequestIds.add(requestId);
    lastSelectedId = requestId;
  }
  updateRowSelectionStyles();
  const item = queueItemsSnapshot.find((req) => req.id === requestId) ?? null;
  if (selectedRequestIds.size === 1 && item) {
    openItemMenu(event.pageX, event.pageY, item);
  } else {
    openContextMenu(event.pageX, event.pageY);
  }
};

const applySelectionAction = async (action) => {
  if (selectedRequestIds.size === 0) {
    formStatus.textContent = t("msg_selection_none");
    return;
  }
  const ids = Array.from(selectedRequestIds);
  const endpoint = action === "suspend" ? "/api/requests/suspend" : "/api/requests/resume";
  try {
    await fetchJSON(endpoint, {
      method: "POST",
      body: JSON.stringify({ ids }),
    });
    formStatus.textContent = action === "suspend"
      ? t("msg_suspend_done", ids.length)
      : t("msg_resume_done", ids.length);
    selectedRequestIds.clear();
    lastSelectedId = null;
    updateRowSelectionStyles();
    refreshAll();
  } catch (err) {
    formStatus.textContent = t("msg_action_fail", {
      label: action === "suspend" ? t("ctx_suspend") : t("ctx_resume"),
      msg: err.message,
    });
  }
};

const refreshAll = async () => {
  refreshButton.disabled = true;
  try {
    const [summary, list, comments, versionInfo, rules] = await Promise.all([
      fetchJSON("/api/requests/summary"),
      fetchJSON(
        `/api/requests?status=${
          encodeURIComponent(
            "QUEUED,VALIDATING,DOWNLOADING,READY,PLAYING,FAILED,REJECTED,DONE,SUSPEND",
          )
        }`,
      ),
      fetchJSON("/api/comments?limit=30"),
      fetchJSON("/api/system/info"),
      fetchJSON("/api/rules"),
    ]);
    renderSummary(summary);
    renderQueue(list.items ?? []);
    renderComments(comments.items ?? []);
    renderSystem(versionInfo);
    renderRules(rules?.rules);
  } catch (err) {
    console.error(err);
    formStatus.textContent = t("msg_update_fail", err.message);
  } finally {
    refreshButton.disabled = false;
  }
};

const handleOrderChange = async (requestId, input) => {
  const parsed = Number(input.value);
  const currentLabel = input.dataset.currentOrder ?? "";
  const current = Number(currentLabel || "0");
  if (!Number.isFinite(parsed) || parsed < 1) {
    input.value = currentLabel || "";
    return;
  }
  const desired = Math.floor(parsed);
  if (currentLabel && desired === current) {
    input.value = currentLabel;
    return;
  }
  input.disabled = true;
  try {
    await fetchJSON(`/api/requests/${requestId}/reorder`, {
      method: "POST",
      body: JSON.stringify({ position: desired }),
    });
    input.value = String(desired);
    input.dataset.currentOrder = String(desired);
  } catch (err) {
    console.error(err);
    formStatus.textContent = t("msg_reorder_fail", err.message);
    input.value = currentLabel || "";
  } finally {
    input.disabled = false;
  }
};

const parseSseData = (event) => {
  try {
    return JSON.parse(event.data);
  } catch (err) {
    console.error(t("msg_parse_fail"), err);
    return null;
  }
};

const connectDockStream = () => {
  if (!("EventSource" in window)) {
    console.warn(t("msg_eventsource_fallback"));
    setInterval(refreshAll, 6000);
    return;
  }
  let retryDelay = 2000;
  const maxDelay = 30000;
  const connect = () => {
    const source = new EventSource("/api/stream");
    source.addEventListener("requests", (event) => {
      const payload = parseSseData(event);
      if (!payload) return;
      if (payload.summary) renderSummary(payload.summary);
      if (payload.list) renderQueue(payload.list.items ?? []);
    });
    source.addEventListener("comments", (event) => {
      const payload = parseSseData(event);
      if (!payload) return;
      renderComments(payload.items ?? []);
    });
    source.addEventListener("system", (event) => {
      const payload = parseSseData(event);
      if (!payload) return;
      renderSystem(payload);
    });
    source.onopen = () => {
      retryDelay = 2000;
    };
    source.onerror = () => {
      console.warn(t("msg_stream_retry"));
      source.close();
      setTimeout(connect, retryDelay);
      retryDelay = Math.min(retryDelay * 2, maxDelay);
    };
  };
  connect();
};

stopButton.addEventListener("click", async () => {
  stopButton.disabled = true;
  try {
    await fetchJSON("/api/overlay/stop", { method: "POST" });
  } catch (err) {
    formStatus.textContent = t("msg_stop_fail", err.message);
  } finally {
    stopButton.disabled = false;
    refreshAll();
  }
});

itemMenu.addEventListener("click", async (event) => {
  const button = event.target;
  if (!(button instanceof HTMLButtonElement)) return;
  const action = button.dataset.action;
  hideItemMenu();
  if (!itemMenuTarget) return;
  const { url, title } = itemMenuTarget;
  if (!navigator.clipboard) {
    formStatus.textContent = t("msg_send_fail", "clipboard unsupported");
    return;
  }
  try {
    if (action === "copy-link") {
      await navigator.clipboard.writeText(url || "");
      formStatus.textContent = t("copied_link");
    } else if (action === "copy-title") {
      await navigator.clipboard.writeText(title ?? url ?? "");
      formStatus.textContent = t("copied_title");
    }
  } catch (err) {
    formStatus.textContent = t("msg_send_fail", err.message);
  }
});

autoButton?.addEventListener("click", async () => {
  autoButton.disabled = true;
  try {
    const result = await fetchJSON("/api/overlay/autoplay", { method: "POST" });
    updateAutoplayButtonState(Boolean(result?.paused));
  } catch (err) {
    formStatus.textContent = t("msg_auto_fail", err.message);
  } finally {
    autoButton.disabled = false;
    refreshAll();
  }
});

intakeButton?.addEventListener("click", async () => {
  intakeButton.disabled = true;
  try {
    const result = await fetchJSON("/api/requests/intake/toggle", { method: "POST" });
    updateIntakeButtonState(Boolean(result?.paused));
  } catch (err) {
    formStatus.textContent = t("msg_intake_fail", err.message);
  } finally {
    intakeButton.disabled = false;
    refreshAll();
  }
});

skipButton.addEventListener("click", async () => {
  if (!currentPlayingId) return;
  skipButton.disabled = true;
  try {
    await fetchJSON(`/api/requests/${currentPlayingId}/skip`, { method: "POST" });
  } catch (err) {
    formStatus.textContent = t("msg_skip_fail", err.message);
  } finally {
    refreshAll();
  }
});

refreshButton.addEventListener("click", refreshAll);

clearButton.addEventListener("click", async () => {
  if (!confirm(t("confirm_delete_all"))) return;
  clearButton.disabled = true;
  try {
    await fetchJSON("/api/requests/clear", { method: "POST" });
  } catch (err) {
    formStatus.textContent = t("msg_clear_fail", err.message);
  } finally {
    refreshAll();
  }
});

const setActiveTab = (tab) => {
  tabButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });
  Object.entries(tabPanels).forEach(([key, panel]) => {
    panel.classList.toggle("active", key === tab);
  });
};

tabButtons.forEach((button) => {
  button.addEventListener("click", () => setActiveTab(button.dataset.tab));
});

setActiveTab("list");

commentForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = commentInput.value.trim();
  if (!message) {
    formStatus.textContent = t("msg_comment_required");
    return;
  }
  try {
    const payload = { message, userName: userNameInput.value.trim() || undefined };
    const result = await fetchJSON("/api/debug/comments", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    formStatus.textContent = result.warning
      ? result.warning
      : result.request
      ? t("msg_request_registered", result.request.id)
      : t("msg_comment_saved");
    commentInput.value = "";
    refreshAll();
  } catch (err) {
    formStatus.textContent = t("msg_send_fail", err.message);
  }
});

const init = async () => {
  await configureLocale();
  await refreshAll();
  connectDockStream();
  localeSelect?.addEventListener("change", async () => {
    const value = localeSelect.value;
    if (value && value !== "auto") {
      setLocale(value);
    } else {
      const nav = navigator.language || navigator.userLanguage || "en";
      setLocale(nav);
    }
    try {
      await fetch("/locale", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ locale: value }),
      });
    } catch (_) {
      // ignore server failure; client still switches
    }
    await configureLocale();
    await refreshAll();
  });
};

init();

const renderComments = (items) => {
  commentTableBody.innerHTML = "";
  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "comment-row empty";
    empty.textContent = t("comments_empty");
    commentTableBody.appendChild(empty);
    return;
  }
  for (const item of items) {
    const row = document.createElement("div");
    row.className = "comment-row";
    const locale = getLocale();
    const timestamp = new Date(item.timestamp).toLocaleTimeString(
      locale === "ja" ? "ja-JP" : "en-US",
      { hour12: false },
    );
    const displayUser = item.userId ?? item.userName ?? t("anonymous_user");
    const columns = [timestamp, displayUser, item.message];
    columns.forEach((text, index) => {
      const span = document.createElement("span");
      span.textContent = text ?? "";
      if (index === 1 && item.userName && item.userId && item.userName !== item.userId) {
        span.title = item.userName;
      }
      row.appendChild(span);
    });
    commentTableBody.appendChild(row);
  }
};

const renderSystem = (info) => {
  const versionLabel = document.getElementById("ytDlpVersion");
  const latestLabel = document.getElementById("ytDlpLatest");
  const ejsLabel = document.getElementById("ytDlpEjsStatus");
  versionLabel.textContent = info.ytDlp.current ?? "--";
  latestLabel.textContent = info.ytDlp.latest ?? "--";
  ejsLabel.textContent = info.ytDlpEjs?.version ?? "--";
  updateYtDlpButton.disabled = !(info.ytDlp.updateAvailable);
  refreshYtDlpEjsButton.disabled = false;
};

const renderRules = (rules) => {
  if (!rules) return;
  if (ruleEnableToggle) ruleEnableToggle.checked = Boolean(rules.maxDurationEnabled);
  if (ruleMaxDurationInput && typeof rules.maxDurationMinutes === "number") {
    ruleMaxDurationInput.value = String(rules.maxDurationMinutes);
  }
  if (ruleNoDuplicateToggle && typeof rules.disallowDuplicates === "boolean") {
    ruleNoDuplicateToggle.checked = rules.disallowDuplicates;
  }
  if (ruleCooldownMinutesInput && typeof rules.cooldownMinutes === "number") {
    ruleCooldownMinutesInput.value = String(rules.cooldownMinutes);
  }
  if (rulePollEnableToggle) rulePollEnableToggle.checked = Boolean(rules.pollEnabled);
  if (rulePollIntervalInput && typeof rules.pollIntervalSec === "number") {
    rulePollIntervalInput.value = String(rules.pollIntervalSec);
  }
  if (rulePollWindowInput && typeof rules.pollWindowSec === "number") {
    rulePollWindowInput.value = String(rules.pollWindowSec);
  }
  if (rulePollStopDelayInput && typeof rules.pollStopDelaySec === "number") {
    rulePollStopDelayInput.value = String(rules.pollStopDelaySec);
  }
};

ruleSaveButton?.addEventListener("click", async () => {
  ruleSaveButton.disabled = true;
  ruleStatus.textContent = "";
  try {
    const payload = {
      enabled: ruleEnableToggle?.checked ?? true,
      maxDurationMinutes: Number(ruleMaxDurationInput?.value ?? 0),
      disallowDuplicates: ruleNoDuplicateToggle?.checked ?? true,
      cooldownMinutes: Number(ruleCooldownMinutesInput?.value ?? 0),
      pollEnabled: rulePollEnableToggle?.checked ?? false,
      pollIntervalSec: Number(rulePollIntervalInput?.value ?? 90),
      pollWindowSec: Number(rulePollWindowInput?.value ?? 20),
      pollStopDelaySec: Number(rulePollStopDelayInput?.value ?? 10),
    };
    const result = await fetchJSON("/api/rules", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    renderRules(result?.rules);
    ruleStatus.textContent = t("rule_saved");
  } catch (err) {
    ruleStatus.textContent = `${t("rule_save_failed")}: ${err.message}`;
  } finally {
    ruleSaveButton.disabled = false;
  }
});

updateYtDlpButton.addEventListener("click", async () => {
  updateYtDlpButton.disabled = true;
  systemMessageEl.textContent = t("system_update_btn");
  try {
    const result = await fetchJSON("/api/system/update/yt-dlp", { method: "POST" });
    systemMessageEl.textContent = result.ok
      ? `${t("system_in_use")} ${result.version ?? ""}`
      : result.message ?? t("msg_update_fail", "");
  } catch (err) {
    systemMessageEl.textContent = t("msg_update_fail", err.message);
  } finally {
    refreshAll();
  }
});

refreshYtDlpEjsButton.addEventListener("click", async () => {
  refreshYtDlpEjsButton.disabled = true;
  systemMessageEl.textContent = t("system_refresh_ejs_btn");
  try {
    const result = await fetchJSON("/api/system/update/yt-dlp-ejs", { method: "POST" });
    systemMessageEl.textContent = result.ok
      ? `${t("system_ejs")} updated`
      : result.message ?? t("msg_update_fail", "");
  } catch (err) {
    systemMessageEl.textContent = t("msg_update_fail", err.message);
  } finally {
    refreshAll();
    refreshYtDlpEjsButton.disabled = false;
  }
});
