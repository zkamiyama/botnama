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
};
const stopButton = document.getElementById("stopButton");
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

let currentPlayingId = null;
let queueItemsSnapshot = [];
let lastSelectedId = null;
const selectedRequestIds = new Set();
const stopButtonIcon = stopButton.querySelector("img");
let playbackState = null;
let playbackAnimationId = null;
let playbackLastUpdate = 0;
let isUserSeeking = false;

const updateStopButtonState = (paused) => {
  stopButton.classList.toggle("paused", paused);
  stopButton.setAttribute("aria-pressed", paused ? "true" : "false");
  stopButton.title = paused
    ? "自動再生: 停止中（クリックで再開）"
    : "自動再生: 稼働中（クリックで停止）";
  if (stopButtonIcon) {
    stopButtonIcon.src = paused ? "/icons/play_arrow.svg" : "/icons/stop.svg";
    stopButtonIcon.alt = paused ? "再開" : "停止";
  }
};

const contextMenu = document.createElement("div");
contextMenu.id = "queueContextMenu";
contextMenu.className = "context-menu hidden";
contextMenu.innerHTML = `
  <button type="button" data-action="suspend">選択を保留にする</button>
  <button type="button" data-action="resume">選択の保留を解除</button>
`;
document.body.appendChild(contextMenu);

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

document.addEventListener("click", (event) => {
  if (!contextMenu.contains(event.target)) {
    hideContextMenu();
  }
});
document.addEventListener("scroll", () => hideContextMenu(), true);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") hideContextMenu();
});
globalThis.addEventListener("resize", hideContextMenu);

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
    formStatus.textContent = `シークに失敗: ${err.message}`;
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

const STATUS_LABEL = {
  QUEUED: "待機中",
  DOWNLOADING: "DL中",
  READY: "準備完了",
  PLAYING: "再生中",
  DONE: "再生済",
  FAILED: "エラー",
  REJECTED: "拒否",
  VALIDATING: "検証中",
  SUSPEND: "保留",
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
  summaryMetricsEl.innerHTML = `
    <div class="metric">
      <span>残り時間</span>
      <span>${duration}</span>
      <span>${data.totalPendingItems ?? 0}件</span>
    </div>
  `;
  queueCounterEl.textContent = `リスト ${data.totalItems ?? 0}件`;
  statusAreaEl.innerHTML = `
    <span class="status-dot ${data.overlayConnected ? "online" : "offline"}"></span>
    <span>${data.overlayConnected ? "Overlay接続中" : "Overlay未接続"}</span>
    <span class="status-text-inline">DL中: ${data.downloadingCount ?? 0}</span>
    <span class="status-text-inline">自動再生: ${data.autoplayPaused ? "停止中" : "稼働中"}</span>
  `;
  updateStopButtonState(Boolean(data.autoplayPaused));
  applyPlaybackState(data.currentPlayback ?? null);
};

const renderEmptyState = () => {
  const empty = document.createElement("div");
  empty.className = "queue-card";
  empty.textContent = "キューは空です";
  queueListEl.appendChild(empty);
};

const createStatusChip = (item) => {
  const chip = document.createElement("span");
  chip.className = `status-chip ${item.status.toLowerCase()}`;
  const label = document.createElement("span");
  label.className = "status-label";
  label.textContent = STATUS_LABEL[item.status] ?? item.status;
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
    await handler(event);
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
        const label = STATUS_LABEL[item.statusReason] ?? item.statusReason;
        row.title = `保留中 (元: ${label})`;
      } else {
        row.title = "保留中";
      }
    } else if (item.statusReason) {
      row.title = item.statusReason;
    }

    const playButton = createActionButton("再生", async () => {
      await fetchJSON(`/api/requests/${item.id}/play`, { method: "POST" });
      refreshAll();
    }, { disabled: !PLAYABLE_STATUSES.has(item.status), icon: "/icons/play_arrow.svg" });

    const deleteButton = createActionButton("削除", async () => {
      if (!confirm("このリクエストを削除しますか？")) return;
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
    const titleLink = document.createElement("a");
    titleLink.className = "queue-title-link";
    titleLink.href = item.url;
    titleLink.target = "_blank";
    titleLink.rel = "noreferrer";
    titleLink.textContent = item.title ?? "タイトル取得中";

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
  openContextMenu(event.pageX, event.pageY);
};

const applySelectionAction = async (action) => {
  if (selectedRequestIds.size === 0) {
    formStatus.textContent = "対象を選択してください";
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
      ? `${ids.length}件を保留にしました`
      : `${ids.length}件の保留を解除しました`;
    selectedRequestIds.clear();
    lastSelectedId = null;
    updateRowSelectionStyles();
    refreshAll();
  } catch (err) {
    formStatus.textContent = `操作に失敗しました: ${err.message}`;
  }
};

const refreshAll = async () => {
  refreshButton.disabled = true;
  try {
    const [summary, list, comments, versionInfo] = await Promise.all([
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
    ]);
    renderSummary(summary);
    renderQueue(list.items ?? []);
    renderComments(comments.items ?? []);
    renderSystem(versionInfo);
  } catch (err) {
    console.error(err);
    formStatus.textContent = `更新に失敗しました: ${err.message}`;
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
    formStatus.textContent = `順番変更に失敗: ${err.message}`;
    input.value = currentLabel || "";
  } finally {
    input.disabled = false;
  }
};

const parseSseData = (event) => {
  try {
    return JSON.parse(event.data);
  } catch (err) {
    console.error("ライブ更新データの解析に失敗しました", err);
    return null;
  }
};

const connectDockStream = () => {
  if (!("EventSource" in window)) {
    console.warn("EventSource が未対応のため、ポーリングにフォールバックします");
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
      console.warn("ライブ更新ストリームから切断されました。再接続します...");
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
    const result = await fetchJSON("/api/overlay/stop", { method: "POST" });
    updateStopButtonState(Boolean(result?.paused));
  } catch (err) {
    formStatus.textContent = `停止に失敗: ${err.message}`;
  } finally {
    stopButton.disabled = false;
    refreshAll();
  }
});

skipButton.addEventListener("click", async () => {
  if (!currentPlayingId) return;
  skipButton.disabled = true;
  try {
    await fetchJSON(`/api/requests/${currentPlayingId}/skip`, { method: "POST" });
  } catch (err) {
    formStatus.textContent = `スキップに失敗: ${err.message}`;
  } finally {
    refreshAll();
  }
});

refreshButton.addEventListener("click", refreshAll);

clearButton.addEventListener("click", async () => {
  if (!confirm("再生リストをすべて削除しますか？")) return;
  clearButton.disabled = true;
  try {
    await fetchJSON("/api/requests/clear", { method: "POST" });
  } catch (err) {
    formStatus.textContent = `全削除に失敗: ${err.message}`;
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
    formStatus.textContent = "コメントを入力してください";
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
      ? `登録しました: ${result.request.id}`
      : "コメントを保存しました";
    commentInput.value = "";
    refreshAll();
  } catch (err) {
    formStatus.textContent = `送信失敗: ${err.message}`;
  }
});

refreshAll();
connectDockStream();

const renderComments = (items) => {
  commentTableBody.innerHTML = "";
  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "comment-row empty";
    empty.textContent = "コメントはありません";
    commentTableBody.appendChild(empty);
    return;
  }
  for (const item of items) {
    const row = document.createElement("div");
    row.className = "comment-row";
    const timestamp = new Date(item.timestamp).toLocaleTimeString("ja-JP", { hour12: false });
    const displayUser = item.userId ?? item.userName ?? "匿名";
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

updateYtDlpButton.addEventListener("click", async () => {
  updateYtDlpButton.disabled = true;
  systemMessageEl.textContent = "yt-dlp を更新中...";
  try {
    const result = await fetchJSON("/api/system/update/yt-dlp", { method: "POST" });
    systemMessageEl.textContent = result.ok
      ? `yt-dlp を ${result.version ?? ""} に更新しました`
      : result.message ?? "更新に失敗しました";
  } catch (err) {
    systemMessageEl.textContent = `更新失敗: ${err.message}`;
  } finally {
    refreshAll();
  }
});

refreshYtDlpEjsButton.addEventListener("click", async () => {
  refreshYtDlpEjsButton.disabled = true;
  systemMessageEl.textContent = "yt-dlp-ejs を更新中...";
  try {
    const result = await fetchJSON("/api/system/update/yt-dlp-ejs", { method: "POST" });
    systemMessageEl.textContent = result.ok
      ? "yt-dlp-ejs を更新しました"
      : result.message ?? "更新に失敗しました";
  } catch (err) {
    systemMessageEl.textContent = `更新失敗: ${err.message}`;
  } finally {
    refreshAll();
    refreshYtDlpEjsButton.disabled = false;
  }
});
