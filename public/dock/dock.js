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
  log: document.getElementById("tabLog"),
  comments: document.getElementById("tabComments"),
  system: document.getElementById("tabSystem"),
  rules: document.getElementById("tabRules"),
};
const tabSwitcher = document.getElementById("tabSwitcher");
const tabPanelContainer = document.querySelector(".tab-shell");
const stopButton = document.getElementById("stopButton");
const autoButton = document.getElementById("autoButton");
const intakeButton = document.getElementById("intakeButton");
const skipButton = document.getElementById("skipButton");
const commentForm = document.getElementById("commentForm");
const commentInput = document.getElementById("commentInput");
const userNameInput = document.getElementById("userNameInput");
const formStatus = document.getElementById("formStatus");
const commentTableBody = document.getElementById("commentTableBody");
const commentTableEl = document.querySelector(".comment-table");
const columnResizers = document.querySelectorAll(".column-resizer");
const updateYtDlpButton = document.getElementById("updateYtDlpButton");
const refreshYtDlpEjsButton = document.getElementById("refreshYtDlpEjsButton");
const systemMessageEl = document.getElementById("systemMessage");
const ytDlpCombinedLabel = document.getElementById("ytDlpCombinedLabel");
const ytDlpCombinedValue = document.getElementById("ytDlpCombinedValue");
const ytDlpEjsLabel = document.getElementById("ytDlpEjsLabel");
const ytDlpEjsStatus = document.getElementById("ytDlpEjsStatus");
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
const ruleConcurrentToggle = document.getElementById("ruleConcurrentToggle");
const ruleConcurrentGroup = document.getElementById("ruleConcurrentGroup");
const ruleConcurrentMaxInput = document.getElementById("ruleConcurrentMax");
const ruleConcurrentLabel = document.getElementById("ruleConcurrentLabel");
const ruleConcurrentMaxLabel = document.getElementById("ruleConcurrentMaxLabel");
const rulePollEnableToggle = document.getElementById("rulePollEnableToggle");
const rulePollIntervalInput = document.getElementById("rulePollInterval");
const rulePollWindowInput = document.getElementById("rulePollWindow");
const rulePollStopDelayInput = document.getElementById("rulePollStopDelay");
const ruleSaveButton = document.getElementById("ruleSaveButton");
const ruleStatus = document.getElementById("ruleStatus");
const ruleNgSectionLabel = document.getElementById("ruleNgSectionLabel");
const ruleNgUserToggle = document.getElementById("ruleNgUserToggle");
const ruleNgUserToggleLabel = document.getElementById("ruleNgUserToggleLabel");
const ruleNgUserGroup = document.getElementById("ruleNgUserGroup");
const ruleNgUserInputLabel = document.getElementById("ruleNgUserInputLabel");
const ruleNgUserInput = document.getElementById("ruleNgUserInput");
const ruleNgUserAddButton = document.getElementById("ruleNgUserAddButton");
const ruleNgUserList = document.getElementById("ruleNgUserList");
const ruleNgUserClearButton = document.getElementById("ruleNgUserClearButton");
const ruleNgUserHint = document.getElementById("ruleNgUserHint");
const localeSelect = document.getElementById("localeSelect");
const ruleSiteSectionLabel = document.getElementById("ruleSiteSectionLabel");
const ruleSiteYoutubeToggle = document.getElementById("ruleSiteYoutubeToggle");
const ruleSiteNicovideoToggle = document.getElementById("ruleSiteNicovideoToggle");
const ruleSiteBilibiliToggle = document.getElementById("ruleSiteBilibiliToggle");
const ruleCustomSiteLabel = document.getElementById("ruleCustomSiteLabel");
const ruleCustomSiteList = document.getElementById("ruleCustomSiteList");
const ruleCustomSiteAddButton = document.getElementById("ruleCustomSiteAddButton");
const logTableBody = document.getElementById("logTableBody");
const logCsvButton = document.getElementById("logCsvButton");
const logCopyButton = document.getElementById("logCopyButton");
const logClearButton = document.getElementById("logClearButton");
const logStatus = document.getElementById("logStatus");
const commentCsvButton = document.getElementById("commentCsvButton");
const commentCopyButton = document.getElementById("commentCopyButton");
const commentClearButton = document.getElementById("commentClearButton");
const commentStatus = document.getElementById("commentStatus");

const supportsAsyncClipboard = () =>
  typeof navigator !== "undefined" &&
  Boolean(navigator.clipboard && typeof navigator.clipboard.writeText === "function");

const fallbackCopyText = (text) =>
  new Promise((resolve, reject) => {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "absolute";
    textarea.style.left = "-9999px";
    textarea.style.top = `${window.scrollY || 0}px`;
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    try {
      const ok = document.execCommand("copy");
      if (!ok) {
        reject(new Error("copy command not supported"));
      } else {
        resolve(true);
      }
    } catch (err) {
      reject(err);
    } finally {
      document.body.removeChild(textarea);
    }
  });

const copyTextToClipboard = async (text) => {
  if (supportsAsyncClipboard()) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn("[dock] async clipboard failed, falling back", err);
    }
  }
  await fallbackCopyText(text);
  return true;
};

const TAB_ORDER_STORAGE_KEY = "dock_tab_order";
const DEFAULT_TAB_ORDER = ["list", "log", "comments", "rules", "system", "debug"];
const TAB_LABEL_KEYS = {
  list: "tab_list",
  log: "tab_log",
  comments: "tab_comments",
  rules: "tab_rules",
  system: "tab_system",
  debug: "tab_debug",
};

const tabButtonMap = new Map();
tabButtons.forEach((button) => {
  const key = button.dataset.tab;
  if (key) {
    tabButtonMap.set(key, button);
  }
});

const ensureTabOrderComplete = (order) => {
  const seen = new Set();
  const normalized = [];
  const source = Array.isArray(order) ? order : [];
  for (const key of source) {
    if (tabButtonMap.has(key) && !seen.has(key)) {
      seen.add(key);
      normalized.push(key);
    }
  }
  Object.keys(tabPanels).forEach((key) => {
    if (!seen.has(key) && tabButtonMap.has(key)) {
      seen.add(key);
      normalized.push(key);
    }
  });
  return normalized;
};

const loadTabOrder = () => {
  try {
    const stored = localStorage.getItem(TAB_ORDER_STORAGE_KEY);
    if (!stored) return ensureTabOrderComplete(DEFAULT_TAB_ORDER);
    const parsed = JSON.parse(stored);
    return ensureTabOrderComplete(parsed);
  } catch (_err) {
    return ensureTabOrderComplete(DEFAULT_TAB_ORDER);
  }
};

let currentTabOrder = loadTabOrder();

const applyTabOrder = (order) => {
  const normalized = ensureTabOrderComplete(order);
  currentTabOrder = normalized;
  if (tabSwitcher) {
    const fragment = document.createDocumentFragment();
    normalized.forEach((key) => {
      const button = tabButtonMap.get(key);
      if (button) fragment.appendChild(button);
    });
    tabSwitcher.appendChild(fragment);
  }
  if (tabPanelContainer) {
    const fragment = document.createDocumentFragment();
    normalized.forEach((key) => {
      const panel = tabPanels[key];
      if (panel) fragment.appendChild(panel);
    });
    tabPanelContainer.appendChild(fragment);
  }
};

applyTabOrder(currentTabOrder);

const saveTabOrder = () => {
  try {
    localStorage.setItem(TAB_ORDER_STORAGE_KEY, JSON.stringify(currentTabOrder));
  } catch (_err) {
    // ignore storage errors
  }
};

const reorderTabs = (sourceKey, targetKey, insertAfter = false) => {
  if (!sourceKey || !targetKey || sourceKey === targetKey) return;
  const base = currentTabOrder.filter((key) => key !== sourceKey);
  const targetIndex = base.indexOf(targetKey);
  if (targetIndex === -1) return;
  const insertIndex = insertAfter ? targetIndex + 1 : targetIndex;
  base.splice(insertIndex, 0, sourceKey);
  applyTabOrder(base);
  saveTabOrder();
};

let draggingTabKey = null;

const clearTabDragHints = () => {
  tabButtons.forEach((button) => button.classList.remove("drag-over"));
};

const setupTabDragAndDrop = () => {
  tabButtons.forEach((button) => {
    const tabKey = button.dataset.tab;
    if (!tabKey) return;
    button.setAttribute("draggable", "true");
    button.addEventListener("dragstart", (event) => {
      draggingTabKey = tabKey;
      button.classList.add("dragging");
      try {
        event.dataTransfer?.setData("text/plain", tabKey);
        event.dataTransfer?.setDragImage(button, button.offsetWidth / 2, button.offsetHeight / 2);
      } catch (_err) {
        // ignore unsupported drag image
      }
    });
    button.addEventListener("dragend", () => {
      button.classList.remove("dragging");
      draggingTabKey = null;
      clearTabDragHints();
    });
    button.addEventListener("dragover", (event) => {
      if (!draggingTabKey || draggingTabKey === tabKey) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      button.classList.add("drag-over");
    });
    button.addEventListener("dragleave", () => {
      button.classList.remove("drag-over");
    });
    button.addEventListener("drop", (event) => {
      if (!draggingTabKey || draggingTabKey === tabKey) return;
      event.preventDefault();
      button.classList.remove("drag-over");
      const rect = button.getBoundingClientRect();
      const insertAfter = event.clientX > rect.left + rect.width / 2;
      reorderTabs(draggingTabKey, tabKey, insertAfter);
    });
  });
};

setupTabDragAndDrop();

const setNgUserListPlaceholder = () => {
  if (ruleNgUserList) {
    ruleNgUserList.setAttribute("data-empty-label", t("rule_ng_empty"));
  }
};

function renderNgUserList(ids = []) {
  if (!ruleNgUserList) return;
  setNgUserListPlaceholder();
  ruleNgUserList.innerHTML = "";
  const entries = Array.isArray(ids) ? ids : [];
  if (entries.length === 0) {
    ruleNgUserList.classList.add("empty");
    return;
  }
  ruleNgUserList.classList.remove("empty");
  entries.forEach((userId) => {
    const chip = document.createElement("span");
    chip.className = "ng-user-chip";
    chip.dataset.userId = userId;
    const label = document.createElement("span");
    label.textContent = userId;
    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.innerHTML = "&times;";
    const removeLabel = t("rule_custom_remove");
    removeButton.setAttribute("aria-label", removeLabel);
    removeButton.title = removeLabel;
    removeButton.addEventListener("click", () => removeNgUserEntry(userId));
    chip.append(label, removeButton);
    ruleNgUserList.appendChild(chip);
  });
}

const COLUMN_WIDTH_STORAGE_KEY = "dock_comment_column_widths";
const COLUMN_MIN_WIDTH = { time: 60, user: 100, body: 160 };
let commentColumnWidths = null;
let latestRules = null;

const configureLocale = async () => {
  const locale = await detectLocale();
  setLocale(locale);
  if (localeSelect) localeSelect.value = locale ?? "auto";
  tabButtons.forEach((button) => {
    const labelKey = TAB_LABEL_KEYS[button.dataset.tab];
    if (labelKey) {
      button.textContent = t(labelKey);
    }
  });
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
  if (ruleConcurrentLabel) ruleConcurrentLabel.textContent = t("rule_concurrent_enable");
  if (ruleConcurrentMaxLabel) ruleConcurrentMaxLabel.textContent = t("rule_concurrent_max");
  if (ruleSiteSectionLabel) ruleSiteSectionLabel.textContent = t("rule_site_section");
  const siteToggleMap = [
    [ruleSiteYoutubeToggle, "rule_site_youtube"],
    [ruleSiteNicovideoToggle, "rule_site_nicovideo"],
    [ruleSiteBilibiliToggle, "rule_site_bilibili"],
  ];
  for (const [toggle, key] of siteToggleMap) {
    if (toggle?.parentElement) {
      const parent = toggle.parentElement;
      parent.innerHTML = "";
      parent.appendChild(toggle);
      const label = document.createElement("span");
      label.textContent = t(key);
      parent.appendChild(label);
    }
  }
  if (ruleCustomSiteLabel) ruleCustomSiteLabel.textContent = t("rule_custom_section");
  if (ruleCustomSiteAddButton) {
    ruleCustomSiteAddButton.textContent = "+";
    const label = t("rule_custom_add");
    ruleCustomSiteAddButton.setAttribute("aria-label", label);
    ruleCustomSiteAddButton.title = label;
  }
  if (ruleNgSectionLabel) ruleNgSectionLabel.textContent = t("rule_ng_section");
  if (ruleNgUserToggleLabel) ruleNgUserToggleLabel.textContent = t("rule_ng_enable");
  if (ruleNgUserInputLabel) ruleNgUserInputLabel.textContent = t("rule_ng_input_label");
  if (ruleNgUserInput) ruleNgUserInput.placeholder = t("rule_ng_placeholder");
  if (ruleNgUserHint) ruleNgUserHint.textContent = t("rule_ng_hint");
  if (ruleNgUserAddButton) ruleNgUserAddButton.textContent = t("rule_ng_add");
  if (ruleNgUserClearButton) ruleNgUserClearButton.textContent = t("rule_ng_clear");
  if (ruleNgUserList) ruleNgUserList.setAttribute("data-empty-label", t("rule_ng_empty"));
  renderNgUserList(latestRules?.ngUserIds ?? []);
  refreshCustomSitePlaceholders();
  const headerRow = document.querySelector(".comment-table-header");
  if (headerRow) {
    const titles = headerRow.querySelectorAll(".column-title");
    if (titles?.[0]) titles[0].textContent = t("comments_header_time");
    if (titles?.[1]) titles[1].textContent = t("comments_header_user");
    if (titles?.[2]) titles[2].textContent = t("comments_header_body");
  }
  const logHeaders = document.querySelectorAll("#tabLog .log-column");
  logHeaders.forEach((node) => {
    const column = node.dataset.column;
    if (column === "time") node.textContent = t("log_header_time");
    if (column === "title") node.textContent = t("log_header_title");
    if (column === "url") node.textContent = t("log_header_url");
  });
  if (logCsvButton) logCsvButton.textContent = t("csv_button_label");
  if (logCopyButton) logCopyButton.textContent = t("action_copy");
  if (logClearButton) logClearButton.textContent = t("log_clear");
  if (commentCsvButton) commentCsvButton.textContent = t("csv_button_label");
  if (commentCopyButton) commentCopyButton.textContent = t("action_copy");
  if (commentClearButton) commentClearButton.textContent = t("comments_clear");
  if (ytDlpCombinedLabel) ytDlpCombinedLabel.textContent = t("system_ytdlp_combined");
  if (ytDlpEjsLabel) ytDlpEjsLabel.textContent = t("system_ejs");
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
  const commentCopyBtn = commentContextMenu.querySelector("[data-action='copy-comment']");
  const commentCopyUserBtn = commentContextMenu.querySelector("[data-action='copy-user']");
  const commentNgBtn = commentContextMenu.querySelector("[data-action='add-ng-user']");
  if (commentCopyBtn) commentCopyBtn.textContent = t("comment_action_copy_comment");
  if (commentCopyUserBtn) commentCopyUserBtn.textContent = t("comment_action_copy_user");
  if (commentNgBtn) commentNgBtn.textContent = t("comment_action_add_ng");
};

const COLUMN_KEYS = ["time", "user", "body"];
const LOG_FETCH_LIMIT = 200;
let pendingRulesReload = null;

const loadCommentColumnWidths = () => {
  const base = { time: null, user: null, body: null };
  try {
    const stored = localStorage.getItem(COLUMN_WIDTH_STORAGE_KEY);
    if (!stored) return base;
    const parsed = JSON.parse(stored);
    for (const key of COLUMN_KEYS) {
      const value = Number(parsed?.[key]);
      base[key] = Number.isFinite(value) ? Math.max(COLUMN_MIN_WIDTH[key] ?? 40, value) : null;
    }
  } catch (_) {
    // ignore parse errors
  }
  return base;
};

const saveCommentColumnWidths = () => {
  if (!commentColumnWidths) return;
  try {
    const payload = {};
    for (const key of COLUMN_KEYS) {
      const value = commentColumnWidths[key];
      if (typeof value === "number" && Number.isFinite(value)) {
        payload[key] = value;
      }
    }
    localStorage.setItem(COLUMN_WIDTH_STORAGE_KEY, JSON.stringify(payload));
  } catch (_) {
    // ignore storage errors
  }
};

const applyCommentColumnWidths = () => {
  if (!commentTableEl || !commentColumnWidths) return;
  for (const key of COLUMN_KEYS) {
    const value = commentColumnWidths[key];
    const cssVar = `--comment-col-${key}`;
    if (typeof value === "number" && Number.isFinite(value)) {
      commentTableEl.style.setProperty(cssVar, `${value}px`);
    } else {
      commentTableEl.style.removeProperty(cssVar);
    }
  }
};

const setupCommentColumnResizers = () => {
  if (!columnResizers?.length || !commentTableEl) return;
  columnResizers.forEach((handle) => {
    handle.addEventListener("pointerdown", (event) => {
      const column = handle.dataset.column;
      if (!column) return;
      event.preventDefault();
      const headerCell = handle.closest(".comment-header-cell");
      if (!headerCell) return;
      if (!commentColumnWidths) {
        commentColumnWidths = loadCommentColumnWidths();
      }
      const startX = event.clientX;
      const currentWidth = typeof commentColumnWidths[column] === "number" &&
          Number.isFinite(commentColumnWidths[column])
        ? commentColumnWidths[column]
        : headerCell.getBoundingClientRect().width;
      const minWidth = COLUMN_MIN_WIDTH[column] ?? 40;
      const previousUserSelect = document.body.style.userSelect;
      document.body.style.userSelect = "none";
      handle.classList.add("active");
      const onMove = (moveEvent) => {
        const delta = moveEvent.clientX - startX;
        const nextWidth = Math.max(minWidth, currentWidth + delta);
        commentColumnWidths[column] = nextWidth;
        applyCommentColumnWidths();
      };
      const onUp = () => {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        document.removeEventListener("pointercancel", onUp);
        handle.classList.remove("active");
        document.body.style.userSelect = previousUserSelect;
        saveCommentColumnWidths();
      };
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
      document.addEventListener("pointercancel", onUp);
    });
  });
};

const initializeCommentColumnSizing = () => {
  if (!commentTableEl) return;
  commentColumnWidths = loadCommentColumnWidths();
  applyCommentColumnWidths();
  setupCommentColumnResizers();
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
let seekPointerActive = false;
let seekPointerStartValue = null;
let pendingSeekRequest = null;

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

const commentContextMenu = document.createElement("div");
commentContextMenu.id = "commentContextMenu";
commentContextMenu.className = "context-menu hidden";
commentContextMenu.innerHTML = `
  <button type="button" data-action="copy-comment">${t("comment_action_copy_comment")}</button>
  <button type="button" data-action="copy-user">${t("comment_action_copy_user")}</button>
  <button type="button" data-action="add-ng-user">${t("comment_action_add_ng")}</button>
`;
document.body.appendChild(commentContextMenu);
let commentMenuTarget = null;

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
const hideCommentMenu = () => {
  commentContextMenu.classList.add("hidden");
  commentMenuTarget = null;
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

const getCommentOwnerId = (target) => {
  if (!target) return null;
  return target.ownerId ?? target.userId ?? target.userName ?? null;
};

const updateCommentMenuButtons = () => {
  const hasUser = Boolean(getCommentOwnerId(commentMenuTarget));
  const copyUserBtn = commentContextMenu.querySelector('[data-action="copy-user"]');
  const addNgBtn = commentContextMenu.querySelector('[data-action="add-ng-user"]');
  copyUserBtn?.classList.toggle("hidden", !hasUser);
  addNgBtn?.classList.toggle("hidden", !hasUser);
};

const openContextMenu = (x, y) => {
  if (!updateContextMenuButtons()) {
    hideContextMenu();
    return;
  }
  hideCommentMenu();
  contextMenu.style.left = `${x}px`;
  contextMenu.style.top = `${y}px`;
  contextMenu.classList.remove("hidden");
};

const openItemMenu = (x, y, item) => {
  hideContextMenu();
  hideCommentMenu();
  if (!item) return;
  itemMenuTarget = item;
  itemMenu.style.left = `${x}px`;
  itemMenu.style.top = `${y}px`;
  itemMenu.classList.remove("hidden");
};

const openCommentMenu = (x, y, target) => {
  hideContextMenu();
  hideItemMenu();
  commentMenuTarget = target;
  updateCommentMenuButtons();
  commentContextMenu.style.left = `${x}px`;
  commentContextMenu.style.top = `${y}px`;
  commentContextMenu.classList.remove("hidden");
};

document.addEventListener("click", (event) => {
  if (!contextMenu.contains(event.target)) {
    hideContextMenu();
  }
  if (!itemMenu.contains(event.target)) {
    hideItemMenu();
  }
  if (!commentContextMenu.contains(event.target)) {
    hideCommentMenu();
  }
});
document.addEventListener("scroll", () => {
  hideContextMenu();
  hideItemMenu();
  hideCommentMenu();
}, true);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") hideContextMenu();
  if (event.key === "Escape") hideItemMenu();
  if (event.key === "Escape") hideCommentMenu();
});
globalThis.addEventListener("resize", () => {
  hideContextMenu();
  hideItemMenu();
  hideCommentMenu();
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
    pauseButton.firstElementChild.src = state.isPlaying
      ? "/icons/pause.svg"
      : "/icons/play_arrow.svg";
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

const sendSeekRequest = (payload) => {
  if (!playbackState) return null;
  const request = fetchJSON("/api/overlay/seek", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  request.catch((err) => {
    formStatus.textContent = t("msg_seek_fail", err.message);
  });
  return request;
};

const finishSeekInteraction = () => {
  if (seekPointerActive || pendingSeekRequest) return;
  isUserSeeking = false;
  seekPointerStartValue = null;
};

if (playbackSeekEl) {
  playbackSeekEl.addEventListener("pointerdown", () => {
    seekPointerActive = true;
    seekPointerStartValue = playbackSeekEl.value;
    isUserSeeking = true;
  });
  const handlePointerFinish = () => {
    if (!seekPointerActive) return;
    seekPointerActive = false;
    if (seekPointerStartValue !== null && seekPointerStartValue === playbackSeekEl.value) {
      finishSeekInteraction();
    }
  };
  playbackSeekEl.addEventListener("pointerup", handlePointerFinish);
  playbackSeekEl.addEventListener("pointercancel", handlePointerFinish);
  playbackSeekEl.addEventListener("pointerleave", (event) => {
    if (event.pointerType === "mouse") return;
    handlePointerFinish();
  });
  playbackSeekEl.addEventListener("input", () => {
    if (!playbackCurrentEl) return;
    isUserSeeking = true;
    playbackCurrentEl.textContent = formatTimeLabel(Number(playbackSeekEl.value));
  });
  playbackSeekEl.addEventListener("change", () => {
    const target = Number(playbackSeekEl.value);
    if (Number.isFinite(target)) {
      const pending = sendSeekRequest({ positionSec: target });
      if (pending && typeof pending.finally === "function") {
        pendingSeekRequest = pending;
        pending.finally(() => {
          pendingSeekRequest = null;
          finishSeekInteraction();
        });
      } else {
        finishSeekInteraction();
      }
    } else {
      finishSeekInteraction();
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
const COMMENT_ERROR_STATUSES = new Set(["FAILED", "REJECTED"]);

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

const formatFullTimestamp = (value) => {
  if (!Number.isFinite(value)) return "--/--/-- --:--:--";
  const date = new Date(value);
  const pad = (n) => n.toString().padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hour = pad(date.getHours());
  const minute = pad(date.getMinutes());
  const second = pad(date.getSeconds());
  return `${year}/${month}/${day}/${hour}:${minute}:${second}`;
};

const fetchCsvResponse = async (url) => {
  const res = await fetch(url);
  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || "download failed");
  }
  return res;
};

const downloadCsvFile = async (url, filename) => {
  const res = await fetchCsvResponse(url);
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
};

const copyCsvToClipboard = async (url) => {
  const res = await fetchCsvResponse(url);
  const text = await res.text();
  await copyTextToClipboard(text);
  return text.length;
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

async function toggleNgUserRule(enabled) {
  updateRuleUiState();
  try {
    await fetchJSON("/api/rules", {
      method: "POST",
      body: JSON.stringify({ ngUserBlockingEnabled: enabled }),
    });
    if (!latestRules) latestRules = {};
    latestRules.ngUserBlockingEnabled = enabled;
    if (ruleStatus) ruleStatus.textContent = t("rule_saved");
  } catch (err) {
    if (ruleStatus) ruleStatus.textContent = t("ng_user_action_fail", err.message);
    if (ruleNgUserToggle) ruleNgUserToggle.checked = !enabled;
  } finally {
    updateRuleUiState();
  }
}

async function addNgUserEntry(userId, { ensureEnabled = false, button, silent = false } = {}) {
  const value = (userId ?? "").trim();
  if (!value) return false;
  if (button) button.disabled = true;
  try {
    const result = await fetchJSON("/api/rules/ng-users", {
      method: "POST",
      body: JSON.stringify({ userId: value, enable: ensureEnabled }),
    });
    applyNgRulePatch(result?.rule ?? null);
    await reloadRulesFromServer();
    if (!silent && ruleStatus) {
      ruleStatus.textContent = t("ng_user_add_done", { user: value });
    }
    return true;
  } catch (err) {
    if (!silent && ruleStatus) ruleStatus.textContent = t("ng_user_action_fail", err.message);
    throw err;
  } finally {
    if (button) button.disabled = false;
  }
}

async function removeNgUserEntry(userId, { silent = false } = {}) {
  const value = (userId ?? "").trim();
  if (!value) return false;
  try {
    const result = await fetchJSON(`/api/rules/ng-users/${encodeURIComponent(value)}`, {
      method: "DELETE",
    });
    applyNgRulePatch(result?.rule ?? null);
    await reloadRulesFromServer();
    if (!silent && ruleStatus) {
      ruleStatus.textContent = t("ng_user_remove_done", { user: value });
    }
    return true;
  } catch (err) {
    if (!silent && ruleStatus) ruleStatus.textContent = t("ng_user_action_fail", err.message);
    throw err;
  }
}

async function clearNgUserEntries({ button, silent = false } = {}) {
  if (button) button.disabled = true;
  try {
    const result = await fetchJSON("/api/rules/ng-users/clear", { method: "POST" });
    applyNgRulePatch(result?.rule ?? null);
    await reloadRulesFromServer();
    if (!silent && ruleStatus) {
      ruleStatus.textContent = t("ng_user_clear_done");
    }
    return true;
  } catch (err) {
    if (!silent && ruleStatus) ruleStatus.textContent = t("ng_user_action_fail", err.message);
    throw err;
  } finally {
    if (button) button.disabled = false;
  }
}

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
    <span>${
    data.overlayConnected ? t("status_overlay_connected") : t("status_overlay_disconnected")
  }</span>
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

const handleCommentContextMenu = (event, item) => {
  event.preventDefault();
  if (!item) return;
  hideContextMenu();
  hideItemMenu();
  const ownerId = item.userId ?? item.userName ?? null;
  openCommentMenu(event.pageX, event.pageY, {
    id: item.id ?? null,
    userId: item.userId ?? null,
    userName: item.userName ?? null,
    ownerId,
    message: item.message ?? "",
  });
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
    const [summary, list, comments, versionInfo, rules, logs] = await Promise.all([
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
      fetchJSON(`/api/logs?limit=${LOG_FETCH_LIMIT}`),
    ]);
    renderSummary(summary);
    renderQueue(list.items ?? []);
    renderComments(comments.items ?? []);
    renderSystem(versionInfo);
    renderRules(rules?.rules);
    renderLogs(logs.items ?? []);
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
    source.addEventListener("rules", (event) => {
      const payload = parseSseData(event);
      if (!payload) return;
      renderRules(payload.rules ?? payload);
    });
    source.addEventListener("logs", (event) => {
      const payload = parseSseData(event);
      if (!payload) return;
      renderLogs(payload.items ?? []);
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
  const target = itemMenuTarget;
  hideItemMenu();
  if (!target) return;
  const { url, title } = target;
  try {
    if (action === "copy-link") {
      await copyTextToClipboard(url || "");
      formStatus.textContent = t("copied_link");
    } else if (action === "copy-title") {
      await copyTextToClipboard(title ?? url ?? "");
      formStatus.textContent = t("copied_title");
    }
  } catch (err) {
    formStatus.textContent = t("msg_send_fail", err.message);
  }
});

commentContextMenu.addEventListener("click", async (event) => {
  const button = event.target;
  if (!(button instanceof HTMLButtonElement)) return;
  const action = button.dataset.action;
  const target = commentMenuTarget;
  hideCommentMenu();
  if (!target) return;
  const targetUserId = getCommentOwnerId(target);
  try {
    if (action === "copy-comment") {
      await copyTextToClipboard(target.message ?? "");
      if (commentStatus) commentStatus.textContent = t("single_comment_copy_done");
    } else if (action === "copy-user" && targetUserId) {
      await copyTextToClipboard(targetUserId);
      if (commentStatus) commentStatus.textContent = t("user_id_copy_done");
    } else if (action === "add-ng-user" && targetUserId) {
      await addNgUserEntry(targetUserId, { ensureEnabled: true, silent: true });
      if (commentStatus) {
        commentStatus.textContent = t("ng_user_add_done", { user: targetUserId });
      }
    }
  } catch (err) {
    if (!commentStatus) return;
    if (action === "add-ng-user") {
      commentStatus.textContent = t("ng_user_action_fail", err.message);
    } else {
      commentStatus.textContent = t("comments_copy_fail", err.message);
    }
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

logClearButton?.addEventListener("click", async () => {
  if (!confirm(t("confirm_delete_logs"))) return;
  logClearButton.disabled = true;
  if (logStatus) logStatus.textContent = "";
  try {
    await fetchJSON("/api/logs/clear", { method: "POST" });
    if (logStatus) logStatus.textContent = t("log_clear_done");
    await refreshAll();
  } catch (err) {
    if (logStatus) logStatus.textContent = t("log_clear_fail", err.message);
  } finally {
    logClearButton.disabled = false;
  }
});

logCsvButton?.addEventListener("click", async () => {
  logCsvButton.disabled = true;
  if (logStatus) logStatus.textContent = "";
  try {
    await downloadCsvFile("/api/logs/export", "playback_logs.csv");
  } catch (err) {
    if (logStatus) logStatus.textContent = t("log_download_fail", err.message);
  } finally {
    logCsvButton.disabled = false;
  }
});

logCopyButton?.addEventListener("click", async () => {
  logCopyButton.disabled = true;
  if (logStatus) logStatus.textContent = "";
  try {
    await copyCsvToClipboard("/api/logs/export");
    if (logStatus) logStatus.textContent = t("log_copy_done");
  } catch (err) {
    if (logStatus) logStatus.textContent = t("log_copy_fail", err.message);
  } finally {
    logCopyButton.disabled = false;
  }
});

commentCsvButton?.addEventListener("click", async () => {
  commentCsvButton.disabled = true;
  if (commentStatus) commentStatus.textContent = "";
  try {
    await downloadCsvFile("/api/comments/export", "comments.csv");
  } catch (err) {
    if (commentStatus) commentStatus.textContent = t("comments_download_fail", err.message);
  } finally {
    commentCsvButton.disabled = false;
  }
});

commentCopyButton?.addEventListener("click", async () => {
  commentCopyButton.disabled = true;
  if (commentStatus) commentStatus.textContent = "";
  try {
    await copyCsvToClipboard("/api/comments/export");
    if (commentStatus) commentStatus.textContent = t("comments_copy_done");
  } catch (err) {
    if (commentStatus) commentStatus.textContent = t("comments_copy_fail", err.message);
  } finally {
    commentCopyButton.disabled = false;
  }
});

commentClearButton?.addEventListener("click", async () => {
  if (!confirm(t("confirm_delete_comments"))) return;
  commentClearButton.disabled = true;
  if (commentStatus) commentStatus.textContent = "";
  try {
    await fetchJSON("/api/comments/clear", { method: "POST" });
    if (commentStatus) commentStatus.textContent = t("comments_clear_done");
    await refreshAll();
  } catch (err) {
    if (commentStatus) commentStatus.textContent = t("comments_clear_fail", err.message);
  } finally {
    commentClearButton.disabled = false;
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

initializeCommentColumnSizing();
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
    row.dataset.commentId = item.id ?? "";
    row.dataset.userId = item.userId ?? "";
    row.dataset.userName = item.userName ?? "";
    const hasRequest = Boolean(item.requestId);
    const status = typeof item.requestStatus === "string" ? item.requestStatus : null;
    const statusReason = typeof item.requestStatusReason === "string"
      ? item.requestStatusReason
      : null;
    if (hasRequest) {
      row.classList.add("request-detected");
    }
    let tooltip = "";
    if (status && COMMENT_ERROR_STATUSES.has(status)) {
      row.classList.add("request-error");
      const key = status === "FAILED" ? "comments_request_failed" : "comments_request_rejected";
      tooltip = t(key, { reason: statusReason ?? "" });
    } else if (status) {
      const label = statusLabel(status) ?? status;
      tooltip = statusReason ? `${label}: ${statusReason}` : label;
    } else if (hasRequest) {
      tooltip = t("comments_request_detected");
    }
    if (tooltip) {
      row.title = tooltip;
    }
    const timestamp = formatFullTimestamp(item.timestamp);
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
    row.addEventListener("contextmenu", (event) => handleCommentContextMenu(event, item));
    commentTableBody.appendChild(row);
  }
};

const renderLogs = (items) => {
  if (!logTableBody) return;
  logTableBody.innerHTML = "";
  if (!items || items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "log-row empty";
    empty.textContent = t("log_empty");
    logTableBody.appendChild(empty);
    return;
  }
  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "log-row";
    const timeSpan = document.createElement("span");
    timeSpan.textContent = formatFullTimestamp(item.playedAt);
    const titleSpan = document.createElement("span");
    titleSpan.textContent = item.title ?? t("log_title_unknown");
    const urlLink = document.createElement("a");
    const safeUrl = typeof item.url === "string" && item.url.length > 0 ? item.url : "";
    if (safeUrl) {
      urlLink.href = safeUrl;
    } else {
      urlLink.href = "#";
      urlLink.classList.add("disabled");
      urlLink.setAttribute("tabindex", "-1");
    }
    urlLink.target = "_blank";
    urlLink.rel = "noreferrer";
    urlLink.textContent = item.url ?? "";
    row.append(timeSpan, titleSpan, urlLink);
    logTableBody.appendChild(row);
  });
};

const renderSystem = (info) => {
  const currentVersion = info?.ytDlp?.current ?? "--";
  const latestVersion = info?.ytDlp?.latest ?? "--";
  if (ytDlpCombinedValue) {
    ytDlpCombinedValue.textContent = `${currentVersion} (${latestVersion})`;
  }
  const ejsCurrent = info?.ytDlpEjs?.version ?? "--";
  const ejsLatest = info?.ytDlpEjs?.latest ?? "--";
  if (ytDlpEjsStatus) {
    ytDlpEjsStatus.textContent = `${ejsCurrent} (${ejsLatest})`;
  }
  if (updateYtDlpButton) {
    updateYtDlpButton.disabled = !(info?.ytDlp?.updateAvailable);
  }
  if (refreshYtDlpEjsButton) {
    refreshYtDlpEjsButton.disabled = !(info?.ytDlpEjs?.updateAvailable);
  }
};

const updateRuleUiState = () => {
  const maxGroup = document.getElementById("ruleMaxDurationGroup");
  if (maxGroup && ruleEnableToggle) {
    maxGroup.classList.toggle("disabled", !ruleEnableToggle.checked);
  }
  const pollGroup = document.getElementById("rulePollGroup");
  if (pollGroup && rulePollEnableToggle) {
    pollGroup.classList.toggle("disabled", !rulePollEnableToggle.checked);
  }
  const dupGroup = document.getElementById("ruleDuplicateGroup");
  if (dupGroup && ruleNoDuplicateToggle) {
    dupGroup.classList.toggle("disabled", !ruleNoDuplicateToggle.checked);
  }
  if (ruleConcurrentGroup && ruleConcurrentToggle) {
    ruleConcurrentGroup.classList.toggle("disabled", !ruleConcurrentToggle.checked);
  }
  if (ruleNgUserGroup && ruleNgUserToggle) {
    ruleNgUserGroup.classList.toggle("disabled", !ruleNgUserToggle.checked);
  }
};

function applyNgRulePatch(rule) {
  if (!rule) return;
  if (!latestRules) latestRules = {};
  if (typeof rule.enabled === "boolean") {
    latestRules.ngUserBlockingEnabled = rule.enabled;
    if (ruleNgUserToggle) {
      ruleNgUserToggle.checked = rule.enabled;
    }
  }
  if (Array.isArray(rule.userIds)) {
    latestRules.ngUserIds = rule.userIds.slice();
    renderNgUserList(latestRules.ngUserIds);
  }
  updateRuleUiState();
}

ruleEnableToggle?.addEventListener("change", updateRuleUiState);
rulePollEnableToggle?.addEventListener("change", updateRuleUiState);
ruleNoDuplicateToggle?.addEventListener("change", updateRuleUiState);
ruleConcurrentToggle?.addEventListener("change", updateRuleUiState);
ruleNgUserToggle?.addEventListener("change", () => toggleNgUserRule(ruleNgUserToggle.checked));

const generateCustomSiteId = () =>
  typeof crypto?.randomUUID === "function"
    ? crypto.randomUUID()
    : `custom-${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;

const refreshCustomSitePlaceholders = () => {
  const patternPlaceholder = t("rule_custom_pattern_placeholder");
  document.querySelectorAll(".custom-site-pattern").forEach((input) => {
    input.setAttribute("placeholder", patternPlaceholder);
  });
  document.querySelectorAll(".custom-site-remove").forEach((button) => {
    button.setAttribute("aria-label", t("rule_custom_remove"));
    button.title = t("rule_custom_remove");
  });
};

const createCustomSiteRow = (entry = {}) => {
  if (!ruleCustomSiteList) return null;
  const wrapper = document.createElement("div");
  wrapper.className = "custom-site-row";
  const idValue = typeof entry.id === "string" && entry.id.length > 0
    ? entry.id
    : generateCustomSiteId();
  wrapper.dataset.id = idValue;

  const patternInput = document.createElement("input");
  patternInput.type = "text";
  patternInput.className = "custom-site-pattern";
  if (typeof entry.pattern === "string") patternInput.value = entry.pattern;

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "custom-site-remove";
  removeButton.innerHTML = "&times;";
  removeButton.addEventListener("click", () => wrapper.remove());

  wrapper.append(patternInput, removeButton);
  ruleCustomSiteList.appendChild(wrapper);
  refreshCustomSitePlaceholders();
  return wrapper;
};

const renderCustomSiteRows = (rows) => {
  if (!ruleCustomSiteList) return;
  ruleCustomSiteList.innerHTML = "";
  if (Array.isArray(rows) && rows.length > 0) {
    rows.forEach((row) => createCustomSiteRow(row));
    return;
  }
  createCustomSiteRow();
};

const collectCustomSiteRows = () => {
  if (!ruleCustomSiteList) return [];
  const entries = [];
  ruleCustomSiteList.querySelectorAll(".custom-site-row").forEach((row) => {
    const patternInput = row.querySelector(".custom-site-pattern");
    const pattern = patternInput?.value?.trim();
    if (!pattern) return;
    const idValue = row.dataset.id && row.dataset.id.trim().length > 0
      ? row.dataset.id.trim()
      : generateCustomSiteId();
    entries.push({
      id: idValue,
      pattern,
    });
  });
  return entries;
};

function collectNgUserIds() {
  if (!ruleNgUserList) return [];
  const ids = [];
  ruleNgUserList.querySelectorAll(".ng-user-chip").forEach((chip) => {
    const value = chip.dataset.userId;
    if (value) {
      ids.push(value);
    }
  });
  return ids;
}

ruleCustomSiteAddButton?.addEventListener("click", () => {
  createCustomSiteRow();
});

ruleNgUserAddButton?.addEventListener("click", async () => {
  if (!ruleNgUserInput) return;
  const value = ruleNgUserInput.value.trim();
  if (!value) return;
  try {
    await addNgUserEntry(value, {
      ensureEnabled: ruleNgUserToggle?.checked ?? false,
      button: ruleNgUserAddButton,
    });
    ruleNgUserInput.value = "";
  } catch (_err) {
    // errors handled in addNgUserEntry
  }
});

ruleNgUserInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.isComposing) {
    event.preventDefault();
    ruleNgUserAddButton?.click();
  }
});

ruleNgUserClearButton?.addEventListener("click", async () => {
  if (!confirm(t("confirm_clear_ng_users"))) return;
  try {
    await clearNgUserEntries({ button: ruleNgUserClearButton });
  } catch (_err) {
    // status already updated inside helper
  }
});

const renderRules = (rules) => {
  if (!rules) return;
  latestRules = {
    ...rules,
    customSites: Array.isArray(rules.customSites)
      ? rules.customSites.map((entry) => ({ ...entry }))
      : [],
    ngUserIds: Array.isArray(rules.ngUserIds) ? rules.ngUserIds.slice() : [],
  };
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
  if (ruleSiteYoutubeToggle) {
    ruleSiteYoutubeToggle.checked = typeof rules.allowYoutube === "boolean"
      ? rules.allowYoutube
      : true;
  }
  if (ruleSiteNicovideoToggle) {
    ruleSiteNicovideoToggle.checked = typeof rules.allowNicovideo === "boolean"
      ? rules.allowNicovideo
      : true;
  }
  if (ruleSiteBilibiliToggle) {
    ruleSiteBilibiliToggle.checked = typeof rules.allowBilibili === "boolean"
      ? rules.allowBilibili
      : true;
  }
  if (ruleConcurrentToggle) {
    ruleConcurrentToggle.checked = Boolean(rules.concurrentLimitEnabled);
  }
  if (ruleConcurrentMaxInput && typeof rules.concurrentLimitCount === "number") {
    ruleConcurrentMaxInput.value = String(rules.concurrentLimitCount);
  }
  applyNgRulePatch({
    enabled: Boolean(rules.ngUserBlockingEnabled),
    userIds: rules.ngUserIds ?? [],
  });
  renderCustomSiteRows(rules.customSites ?? []);
  updateRuleUiState();
};

async function reloadRulesFromServer() {
  if (!pendingRulesReload) {
    pendingRulesReload = (async () => {
      try {
        const fresh = await fetchJSON("/api/rules");
        renderRules(fresh?.rules ?? fresh);
      } catch (err) {
        console.warn("[dock] failed to reload rules", err);
      } finally {
        pendingRulesReload = null;
      }
    })();
  }
  return pendingRulesReload;
}

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
      allowYoutube: ruleSiteYoutubeToggle?.checked ?? true,
      allowNicovideo: ruleSiteNicovideoToggle?.checked ?? true,
      allowBilibili: ruleSiteBilibiliToggle?.checked ?? true,
      customSites: collectCustomSiteRows(),
      concurrentLimitEnabled: ruleConcurrentToggle?.checked ?? false,
      concurrentLimitCount: Number(ruleConcurrentMaxInput?.value ?? 5),
      ngUserBlockingEnabled: ruleNgUserToggle?.checked ?? false,
      ngUserIds: collectNgUserIds(),
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
