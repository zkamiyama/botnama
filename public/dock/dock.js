import { detectLocale, setLocale, t } from "../i18n.js";

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
  rules: document.getElementById("tabRules"),
  stock: document.getElementById("tabStock"),
};
const tabSwitcher = document.getElementById("tabSwitcher");
const tabPanelContainer = document.querySelector(".tab-shell");
const stopButton = document.getElementById("stopButton");
const autoButton = document.getElementById("autoButton");
const shuffleButton = document.getElementById("shuffleButton");
const intakeButton = document.getElementById("intakeButton");
const skipButton = document.getElementById("skipButton");
const stockSaveButton = document.getElementById("stockSaveButton");
const stockSaveStatus = document.getElementById("stockSaveStatus");
const stockSelect = document.getElementById("stockSelect");
const stockAddInput = document.getElementById("stockAddInput");
const stockAddButton = document.getElementById("stockAddButton");
const stockCounterEl = document.getElementById("stockCounter");
const stockDeleteButton = document.getElementById("stockDeleteButton");
const stockListEl = document.getElementById("stockList");
const tabStockPanel = tabPanels.stock;
const commentForm = document.getElementById("commentForm");
const commentInput = document.getElementById("commentInput");
const stockContextMenu = document.getElementById("stockContextMenu");
const userNameInput = document.getElementById("userNameInput");
const commentFormLabel = document.getElementById("commentFormLabel");
const userNameLabel = document.getElementById("userNameLabel");
const commentSubmitButton = document.getElementById("commentSubmitButton");
const commentDestination = document.getElementById("commentDestination");
const commentDestinationLabel = document.getElementById("commentDestinationLabel");
const commentDestDebug = document.getElementById("commentDestDebug");
const commentDestYoutube = document.getElementById("commentDestYoutube");
const commentDestniconico = document.getElementById("commentDestniconico");
const authYoutubeStatus = document.getElementById("authYoutubeStatus");
const authniconicoStatus = document.getElementById("authniconicoStatus");
const refreshAuthButton = document.getElementById("refreshAuthButton");
const localeLabel = document.querySelector("label[for='localeSelect']");
const browserAuthTitle = document.querySelector("[data-i18n='lbl_browser_auth']");
const browserConfigHint = document.querySelector("[data-i18n='lbl_configuration']");
const youtubeBroadcastLabel = document.querySelector("[data-i18n='broadcast_url_label'][data-site='youtube']");
const niconicoBroadcastLabel = document.querySelector("[data-i18n='broadcast_url_label'][data-site='niconico']");
const youtubeUserLink = document.getElementById("youtubeUserLink");
const niconicoUserLink = document.getElementById("niconicoUserLink");
const youtubeBroadcastStatus = document.getElementById("youtubeBroadcastStatus");
const niconicoBroadcastStatus = document.getElementById("niconicoBroadcastStatus");
const formStatus = document.getElementById("formStatus");
const commentTableBody = document.getElementById("commentTableBody");
const commentTableEl = document.querySelector(".comment-table");
const commentColumnResizers = document.querySelectorAll(".comment-column-resizer");
const logTableEl = document.querySelector(".log-table");
const logColumnResizers = document.querySelectorAll(".log-column-resizer");
const updateYtDlpButton = document.getElementById("updateYtDlpButton");
const systemMessageEl = document.getElementById("systemMessage");
const ytDlpCombinedLabel = document.getElementById("ytDlpCombinedLabel");
const ytDlpCombinedValue = document.getElementById("ytDlpCombinedValue");
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
const ruleStatus = document.getElementById("ruleStatus");
const ruleNgSectionLabel = document.getElementById("ruleNgSectionLabel");
const ruleNgUserToggle = document.getElementById("ruleNgUserToggle");
const ruleNgUserToggleLabel = document.getElementById("ruleNgUserToggleLabel");
const ruleNgUserGroup = document.getElementById("ruleNgUserGroup");
const ruleNgUserAddButton = document.getElementById("ruleNgUserAddButton");
const ruleNgUserList = document.getElementById("ruleNgUserList");
const ruleNgUserHint = document.getElementById("ruleNgUserHint");
const localeSelect = document.getElementById("localeSelect");
const ruleSiteSectionLabel = document.getElementById("ruleSiteSectionLabel");
const ruleSiteYoutubeToggle = document.getElementById("ruleSiteYoutubeToggle");
const ruleSiteNicovideoToggle = document.getElementById("ruleSiteNicovideoToggle");
const ruleSiteBilibiliToggle = document.getElementById("ruleSiteBilibiliToggle");
const ruleCustomSiteLabel = document.getElementById("ruleCustomSiteLabel");
const ruleCustomSiteList = document.getElementById("ruleCustomSiteList");
const ruleCustomSiteAddButton = document.getElementById("ruleCustomSiteAddButton");
const ruleSaveButton = document.getElementById("ruleSaveButton");
const logTableBody = document.getElementById("logTableBody");
const logCsvButton = document.getElementById("logCsvButton");
const logCopyButton = document.getElementById("logCopyButton");
const logClearButton = document.getElementById("logClearButton");
const logStatus = document.getElementById("logStatus");
const commentCsvButton = document.getElementById("commentCsvButton");
const commentCopyButton = document.getElementById("commentCopyButton");
const commentClearButton = document.getElementById("commentClearButton");
const commentStatus = document.getElementById("commentStatus");
const notifyEnableToggle = document.getElementById("notifyEnableToggle");
const notifyniconicoToggle = document.getElementById("notifyniconicoToggle");
const notifyYoutubeToggle = document.getElementById("notifyYoutubeToggle");
const notifyDelayMsInput = document.getElementById("notifyDelayMs");
const notifyStatus = document.getElementById("notifyStatus");
const notifyTargetsGroup = document.getElementById("notifyTargetsGroup");
const notifyDelayGroup = document.getElementById("notifyDelayGroup");
const manualInputLinks = document.querySelectorAll("[data-i18n='manual_input_link']");
const manualInputClearButtons = document.querySelectorAll("[data-i18n='manual_input_clear']");
const manualDialogTitle = document.getElementById("manualDialogTitle");
const manualDialogHint = document.getElementById("manualUrlHint");
const manualDialogCancelButton = document.getElementById("manualUrlCancelButton");
const manualDialogSubmitButton = document.getElementById("manualUrlSubmitButton");

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
    textarea.style.top = `${(typeof globalThis !== "undefined" && globalThis.scrollY) ? globalThis.scrollY : 0}px`;
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
const DEFAULT_TAB_ORDER = [
  "list",
  "log",
  "comments",
  "rules",
  "debug",
  "stock",
];
const TAB_LABEL_KEYS = {
  list: "tab_list",
  log: "tab_log",
  comments: "tab_comments",
  rules: "tab_rules",
  debug: "tab_system",
  stock: "tab_stock",
};

const SHUFFLE_MODES = ["off", "priority", "any"];
const NEW_STOCK_VALUE = "__new__";

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

const createNgUserRow = (userId = "", markDirty = true) => {
  if (!ruleNgUserList) return null;
  const wrapper = document.createElement("div");
  wrapper.className = "rule-entry-row ng-user-row";
  const input = document.createElement("input");
  input.type = "text";
  input.className = "rule-entry-input ng-user-field";
  input.autocomplete = "off";
  input.spellcheck = false;
  if (typeof userId === "string") {
    input.value = userId;
  }
  input.addEventListener("input", handleRuleControlDirty);
  const placeholder = t("rule_ng_placeholder");
  if (placeholder) input.placeholder = placeholder;
  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "rule-entry-remove";
  removeButton.innerHTML = "&times;";
  const removeLabel = t("rule_custom_remove");
  removeButton.setAttribute("aria-label", removeLabel);
  removeButton.title = removeLabel;
  removeButton.addEventListener("click", () => {
    wrapper.remove();
    setRulesDirty(true);
  });
  wrapper.append(input, removeButton);
  ruleNgUserList.appendChild(wrapper);
  refreshEditableListPlaceholders();
  if (markDirty) setRulesDirty(true);
  return wrapper;
};

function renderNgUserList(ids = []) {
  if (!ruleNgUserList) return;
  ruleNgUserList.innerHTML = "";
  const entries = Array.isArray(ids) ? ids : [];
  entries.forEach((userId) => createNgUserRow(userId, false));
}

const ensureNgBlockingEnabled = () => {
  if (ruleNgUserToggle && !ruleNgUserToggle.checked) {
    ruleNgUserToggle.checked = true;
    updateRuleUiState();
    setRulesDirty(true);
  }
};

const upsertNgUserValue = (userId) => {
  const value = (userId ?? "").trim();
  if (!value || !ruleNgUserList) return null;
  const existing = Array.from(ruleNgUserList.querySelectorAll(".ng-user-field"))
    .find((input) => input.value.trim() === value);
  if (existing) return existing;
  const row = createNgUserRow(value);
  return row?.querySelector(".ng-user-field") ?? null;
};

const COLUMN_WIDTH_STORAGE_KEY = "dock_comment_column_widths";
const LOG_COLUMN_WIDTH_STORAGE_KEY = "dock_log_column_widths";
// Minimum column widths (px). Kept consistent between comments and logs where applicable.
const COLUMN_MIN_WIDTH = { time: 48, user: 120, body: 220 };
const LOG_COLUMN_MIN_WIDTH = { time: 32, title: 48, url: 64 };
let commentColumnWidths = null;
let logColumnWidths = null;
let latestRules = null;
let rulesDirty = false;

const setButtonPulse = (btn, on) => {
  if (!btn) return;
  btn.classList.toggle("cta-pulse", Boolean(on));
  btn.classList.toggle("cta-pulse-active", Boolean(on));
};

const setRulesDirty = (value = true) => {
  rulesDirty = value;
  if (ruleSaveButton) {
    ruleSaveButton.disabled = !rulesDirty;
    setButtonPulse(ruleSaveButton, rulesDirty);
  }
};

const handleRuleControlDirty = () => setRulesDirty(true);

const wireRuleControlsForDirtyState = () => {
  const controls = [
    ruleEnableToggle,
    ruleMaxDurationInput,
    ruleNoDuplicateToggle,
    ruleCooldownMinutesInput,
    rulePollEnableToggle,
    rulePollIntervalInput,
    rulePollWindowInput,
    rulePollStopDelayInput,
    ruleSiteYoutubeToggle,
    ruleSiteNicovideoToggle,
    ruleSiteBilibiliToggle,
    ruleConcurrentToggle,
    ruleConcurrentMaxInput,
    ruleNgUserToggle,
  ];
  controls.forEach((el) => {
    if (!el) return;
    const eventName = el.tagName === "INPUT" && el.type === "number" ? "input" : "change";
    el.addEventListener(eventName, handleRuleControlDirty);
  });
};

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
  if (localeLabel) localeLabel.textContent = t("lbl_language");
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
  manualInputLinks.forEach((link) => {
    link.textContent = t("manual_input_link");
  });
  manualInputClearButtons.forEach((btn) => {
    btn.textContent = t("manual_input_clear");
  });
  if (manualDialogTitle) manualDialogTitle.textContent = t("manual_dialog_title");
  if (manualDialogHint) manualDialogHint.textContent = t("manual_dialog_hint");
  if (manualDialogCancelButton) manualDialogCancelButton.textContent = t("btn_cancel");
  if (manualDialogSubmitButton) manualDialogSubmitButton.textContent = t("btn_apply");
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
  if (ruleNgUserHint) ruleNgUserHint.textContent = t("rule_ng_hint");
  if (ruleNgUserAddButton) {
    const label = t("rule_ng_add");
    ruleNgUserAddButton.textContent = "+";
    ruleNgUserAddButton.setAttribute("aria-label", label);
    ruleNgUserAddButton.title = label;
  }
  // keep <New stock> option localized
  const newStockOpt = stockSelect?.querySelector(`option[value="${NEW_STOCK_VALUE}"]`);
  if (newStockOpt) newStockOpt.textContent = `<${t("stock_new") ?? "New stock"}>`;
  if (ruleSaveButton) ruleSaveButton.textContent = t("rule_save");
  renderNgUserList(latestRules?.ngUserIds ?? []);
  refreshEditableListPlaceholders();
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
  // buttons
  stopButton?.setAttribute("title", t("btn_stop"));
  autoButton?.setAttribute("title", t("btn_auto"));
  shuffleButton?.setAttribute("title", t("btn_shuffle"));
  intakeButton?.setAttribute("title", t("btn_intake"));
  skipButton?.setAttribute("title", t("btn_skip"));
  refreshButton?.setAttribute("title", t("btn_refresh"));
  if (stopButtonIcon) stopButtonIcon.alt = t("btn_stop");
  if (autoButtonIcon) autoButtonIcon.alt = t("btn_auto");
  if (shuffleButtonIcon) shuffleButtonIcon.alt = t("btn_shuffle");
  if (intakeButtonIcon) intakeButtonIcon.alt = t("btn_intake");
  if (stockSaveButton) stockSaveButton.textContent = t("btn_stock_save") ?? "Save";
  if (stockAddButton) stockAddButton.textContent = t("btn_stock_add") ?? "Add";
  if (stockAddInput) stockAddInput.placeholder = t("stock_add_placeholder") ?? stockAddInput.placeholder;
  if (stockSelect?.previousElementSibling?.classList?.contains("rule-label")) {
    stockSelect.previousElementSibling.textContent = t("stock_label") ?? "Stock";
  }
  if (skipButton?.firstElementChild instanceof HTMLImageElement) {
    skipButton.firstElementChild.alt = t("btn_skip");
  }
  clearButton.textContent = t("btn_clear");
  seekBackwardButton.textContent = t("seek_back");
  seekForwardButton.textContent = t("seek_forward");
  if (updateYtDlpButton) updateYtDlpButton.textContent = t("system_update_btn");
  if (commentFormLabel) commentFormLabel.textContent = t("comment_label");
  if (commentInput) commentInput.placeholder = t("comment_placeholder");
  if (userNameLabel) userNameLabel.textContent = t("user_label");
  if (userNameInput) userNameInput.placeholder = t("user_placeholder");
  if (commentDestinationLabel) commentDestinationLabel.textContent = t("comment_destination_label");
  if (commentDestDebug) commentDestDebug.textContent = t("comment_destination_debug");
  if (commentDestYoutube) commentDestYoutube.textContent = t("comment_destination_youtube");
  if (commentDestniconico) commentDestniconico.textContent = t("comment_destination_niconico");
  if (commentSubmitButton) commentSubmitButton.textContent = t("comment_submit");
  if (refreshAuthButton) refreshAuthButton.textContent = t("btn_refresh");
  if (notifyEnableToggle?.nextElementSibling) {
    notifyEnableToggle.nextElementSibling.textContent = t("notif_enable");
  }
  if (notifyniconicoToggle?.nextElementSibling) {
    notifyniconicoToggle.nextElementSibling.textContent = t("notif_send_nico");
  }
  if (notifyYoutubeToggle?.nextElementSibling) {
    notifyYoutubeToggle.nextElementSibling.textContent = t("notif_send_yt");
  }
  const delayLabel = document.querySelector("label[for='notifyDelayMs']");
  if (delayLabel) delayLabel.textContent = t("notif_delay_label");
  // Save button removed; labels will use inline change saving
  const suspendButton = contextMenu.querySelector("[data-action='suspend']");
  const resumeButton = contextMenu.querySelector("[data-action='resume']");
  if (suspendButton) suspendButton.textContent = t("ctx_suspend");
  if (resumeButton) resumeButton.textContent = t("ctx_resume");
  const copyLinkBtn = itemMenu.querySelector("[data-action='copy-link']");
  const copyTitleBtn = itemMenu.querySelector("[data-action='copy-title']");
  const itemSuspendBtn = itemMenu.querySelector("[data-action='suspend']");
  const itemResumeBtn = itemMenu.querySelector("[data-action='resume']");
  if (copyLinkBtn) copyLinkBtn.textContent = t("copy_link");
  if (copyTitleBtn) copyTitleBtn.textContent = t("copy_title");
  if (itemSuspendBtn) itemSuspendBtn.textContent = t("ctx_suspend");
  if (itemResumeBtn) itemResumeBtn.textContent = t("ctx_resume");
  const commentCopyBtn = commentContextMenu.querySelector("[data-action='copy-comment']");
  const commentCopyUserBtn = commentContextMenu.querySelector("[data-action='copy-user']");
  const commentNgBtn = commentContextMenu.querySelector("[data-action='add-ng-user']");
  if (commentCopyBtn) commentCopyBtn.textContent = t("comment_action_copy_comment");
  if (commentCopyUserBtn) commentCopyUserBtn.textContent = t("comment_action_copy_user");
  if (commentNgBtn) commentNgBtn.textContent = t("comment_action_add_ng");
  const stockSubmitBtn = stockContextMenu?.querySelector('[data-action="submit-stock"]');
  const stockSubmitSuspendBtn = stockContextMenu?.querySelector('[data-action="submit-stock-suspend"]');
  if (stockSubmitBtn) stockSubmitBtn.textContent = t("btn_stock_submit");
  if (stockSubmitSuspendBtn) stockSubmitSuspendBtn.textContent = t("btn_stock_submit_suspend");
  if (browserAuthTitle) browserAuthTitle.textContent = t("lbl_browser_auth");
  if (browserConfigHint) browserConfigHint.textContent = t("lbl_configuration");
  if (youtubeBroadcastLabel) youtubeBroadcastLabel.textContent = t("broadcast_url_label");
  if (niconicoBroadcastLabel) niconicoBroadcastLabel.textContent = t("broadcast_url_label");
  if (authYoutubeStatus) authYoutubeStatus.textContent = t("auth_checking");
  if (authniconicoStatus) authniconicoStatus.textContent = t("auth_checking");
  if (youtubeBroadcastStatus) youtubeBroadcastStatus.textContent = t("msg_stream_not_found") ?? "配信未検出";
  if (niconicoBroadcastStatus) niconicoBroadcastStatus.textContent = t("msg_stream_not_found") ?? "配信未検出";
};

const COLUMN_KEYS = ["time", "user", "body"];
const LOG_COLUMN_KEYS = ["time", "title", "url"];
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
    // 本文列は常に自動伸長させるため保存値を使わない
    base.body = null;
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
      // 本文列は保存しない（常に自動伸長）
      if (key === "body") continue;
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
    if (key === "body") {
      commentTableEl.style.removeProperty(cssVar); // 常にデフォルト(1fr)
      continue;
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      commentTableEl.style.setProperty(cssVar, `${value}px`);
    } else {
      commentTableEl.style.removeProperty(cssVar);
    }
  }
};

const setupCommentColumnResizers = () => {
  if (!commentColumnResizers?.length || !commentTableEl) return;
  commentColumnResizers.forEach((handle) => {
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

const loadLogColumnWidths = () => {
  const base = { time: null, title: null, url: null };
  try {
    const stored = localStorage.getItem(LOG_COLUMN_WIDTH_STORAGE_KEY);
    if (!stored) return base;
    const parsed = JSON.parse(stored);
    for (const key of LOG_COLUMN_KEYS) {
      const value = Number(parsed?.[key]);
      base[key] = Number.isFinite(value) ? Math.max(LOG_COLUMN_MIN_WIDTH[key] ?? 60, value) : null;
    }
  } catch (_) {
    // ignore parse errors
  }
  return base;
};

const saveLogColumnWidths = () => {
  if (!logColumnWidths) return;
  try {
    const payload = {};
    for (const key of LOG_COLUMN_KEYS) {
      const value = logColumnWidths[key];
      if (typeof value === "number" && Number.isFinite(value)) {
        payload[key] = value;
      }
    }
    localStorage.setItem(LOG_COLUMN_WIDTH_STORAGE_KEY, JSON.stringify(payload));
  } catch (_) {
    // ignore storage errors
  }
};

const applyLogColumnWidths = () => {
  if (!logTableEl || !logColumnWidths) return;
  for (const key of LOG_COLUMN_KEYS) {
    const value = logColumnWidths[key];
    const cssVar = `--log-col-${key}`;
    if (typeof value === "number" && Number.isFinite(value)) {
      logTableEl.style.setProperty(cssVar, `${value}px`);
    } else {
      logTableEl.style.removeProperty(cssVar);
    }
  }
};

const setupLogColumnResizers = () => {
  if (!logColumnResizers?.length || !logTableEl) return;
  logColumnResizers.forEach((handle) => {
    handle.addEventListener("pointerdown", (event) => {
      const column = handle.dataset.column;
      if (!column) return;
      event.preventDefault();
      const headerCell = handle.closest(".log-header-cell");
      if (!headerCell) return;
      if (!logColumnWidths) {
        logColumnWidths = loadLogColumnWidths();
      }
      const startX = event.clientX;
      const currentWidth = typeof logColumnWidths[column] === "number" &&
        Number.isFinite(logColumnWidths[column])
        ? logColumnWidths[column]
        : headerCell.getBoundingClientRect().width;
      const minWidth = LOG_COLUMN_MIN_WIDTH[column] ?? 80;
      const previousUserSelect = document.body.style.userSelect;
      document.body.style.userSelect = "none";
      handle.classList.add("active");
      const onMove = (moveEvent) => {
        const delta = moveEvent.clientX - startX;
        const nextWidth = Math.max(minWidth, currentWidth + delta);
        logColumnWidths[column] = nextWidth;
        applyLogColumnWidths();
      };
      const onUp = () => {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        document.removeEventListener("pointercancel", onUp);
        handle.classList.remove("active");
        document.body.style.userSelect = previousUserSelect;
        saveLogColumnWidths();
      };
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
      document.addEventListener("pointercancel", onUp);
    });
  });
};

const initializeLogColumnSizing = () => {
  if (!logTableEl) return;
  logColumnWidths = loadLogColumnWidths();
  applyLogColumnWidths();
  setupLogColumnResizers();
};

let currentPlayingId = null;
let queueItemsSnapshot = [];
let lastSelectedId = null;
let shuffleMode = "off";
let autoToggleSeq = 0;
let shuffleToggleSeq = 0;
let intakeToggleSeq = 0;
let refreshSeq = 0;
let autoTogglePending = false;
let shuffleTogglePending = false;
let intakeTogglePending = false;
let currentStockName = "default";
let stockItemsSnapshot = [];
const selectedStockIds = new Set();
let stockDirty = false;
let lastSelectedStockId = null;
const selectedRequestIds = new Set();
let stockReloadInFlight = false;
let lastStockReloadAt = 0;
let lastStockReloadErrorAt = 0;
let stockAbortController = null;
let pendingStockReload = false;
let pendingStockName = null;
let pendingStockOptions = null;
let stockSubmitInFlight = false;
let stockReloadTimer = null;
const STOCK_RELOAD_DEBOUNCE_MS = 600;
const stockCache = new Map(); // name -> { items }
const stockInvalidated = new Set();
const isTabActive = (key) => tabPanels[key]?.classList.contains("active");

const stopButtonIcon = stopButton.querySelector("img");
const autoButtonIcon = autoButton?.querySelector("img");
const shuffleButtonIcon = shuffleButton?.querySelector("img");
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
  const active = !paused;
  autoButton.classList.toggle("active", active);
  autoButton.classList.remove("paused");
  autoButton.setAttribute("aria-pressed", active ? "true" : "false");
  autoButton.title = t("btn_auto");
  if (autoButtonIcon) {
    autoButtonIcon.src = "/icons/play_arrow.svg";
    autoButtonIcon.alt = t("btn_auto");
  }
};

const updateIntakeButtonState = (paused) => {
  if (!intakeButton) return;
  const active = !paused;
  intakeButton.classList.toggle("active", active);
  intakeButton.classList.remove("paused");
  intakeButton.setAttribute("aria-pressed", active ? "true" : "false");
  intakeButton.title = t("btn_intake");
  if (intakeButtonIcon) {
    intakeButtonIcon.src = "/icons/how_to_vote.svg";
    intakeButtonIcon.alt = t("btn_intake");
  }
};

const updateShuffleButtonState = (mode) => {
  if (!shuffleButton) return;
  const normalized = SHUFFLE_MODES.includes(mode) ? mode : "off";
  shuffleMode = normalized;
  shuffleButton.dataset.mode = normalized;
  shuffleButton.classList.toggle("active", normalized !== "off");
  shuffleButton.classList.toggle("shuffle-priority", normalized === "priority");
  shuffleButton.classList.toggle("shuffle-any", normalized === "any");
  shuffleButton.setAttribute("aria-pressed", normalized !== "off" ? "true" : "false");
  shuffleButton.title = t("btn_shuffle");
  if (shuffleButtonIcon) {
    shuffleButtonIcon.src = "/icons/shuffle.svg";
    shuffleButtonIcon.alt = t("btn_shuffle");
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
  <button type="button" data-action="suspend">${t("ctx_suspend") ?? "Suspend"}</button>
  <button type="button" data-action="resume">${t("ctx_resume") ?? "Resume"}</button>
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

const updateItemMenuButtons = () => {
  const suspendBtn = itemMenu.querySelector('[data-action="suspend"]');
  const resumeBtn = itemMenu.querySelector('[data-action="resume"]');
  const item = itemMenuTarget;
  if (!item) {
    suspendBtn?.classList.add("hidden");
    resumeBtn?.classList.add("hidden");
    return;
  }
  const isSuspended = item.status === "SUSPEND";
  suspendBtn?.classList.toggle("hidden", isSuspended);
  resumeBtn?.classList.toggle("hidden", !isSuspended);
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
  updateItemMenuButtons();
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

const setAuthStatusText = (node, payload) => {
  if (!node) return;
  if (!payload?.ok) {
    node.textContent = t("msg_send_fail", payload?.message ?? "");
    return;
  }
  node.textContent = payload.authenticated
    ? t("auth_status_authenticated")
    : t("auth_status_not_authenticated");
};

const setUserLink = (anchor, url) => {
  if (!anchor) return;
  if (url) {
    anchor.href = url;
    anchor.textContent = url;
    anchor.style.display = "";
    anchor.classList.remove("disabled");
    anchor.removeAttribute("tabindex");
  } else {
    anchor.textContent = t("msg_not_detected") ?? "Not detected";
    anchor.style.display = "";
    anchor.removeAttribute("href");
    anchor.classList.add("disabled");
    anchor.setAttribute("tabindex", "-1");
  }
};

const setBroadcastInfo = (linkEl, statusEl, broadcastId, platform) => {
  const label = t("msg_stream_not_found") ?? "No broadcast detected";
  if (!linkEl || !statusEl) return;
  if (broadcastId) {
    const href = platform === "youtube"
      ? `https://www.youtube.com/watch?v=${broadcastId}`
      : `https://live.nicovideo.jp/watch/${broadcastId}`;
    linkEl.href = href;
    linkEl.textContent = href;
    statusEl.textContent = "";
    linkEl.style.display = "";
  } else {
    statusEl.textContent = label;
    linkEl.textContent = "";
    linkEl.removeAttribute("href");
    linkEl.style.display = "none";
  }
};

const refreshAuthStatuses = async (forceRefresh = false) => {
  const suffix = forceRefresh ? "?refresh=1" : "";

  const pYt = fetchJSON(`/api/auth/youtube/status${suffix}`)
    .then((yt) => {
      setAuthStatusText(authYoutubeStatus, yt);
      setUserLink(youtubeUserLink, yt?.channelUrl ?? null);
      setBroadcastInfo(
        document.getElementById("youtubeLiveIdLink"),
        youtubeBroadcastStatus,
        yt?.broadcastId ?? null,
        "youtube",
      );
    })
    .catch((err) => {
      setAuthStatusText(authYoutubeStatus, { ok: false, message: err.message });
    });

  const pNn = fetchJSON(`/api/auth/niconico/status${suffix}`)
    .then((nn) => {
      setAuthStatusText(authniconicoStatus, nn);
      setUserLink(niconicoUserLink, nn?.userPageUrl ?? null);
      setBroadcastInfo(
        document.getElementById("niconicoLiveIdLink"),
        niconicoBroadcastStatus,
        nn?.broadcastId ?? null,
        "niconico",
      );
    })
    .catch((err) => {
      setAuthStatusText(authniconicoStatus, { ok: false, message: err.message });
    });

  await Promise.all([pYt, pNn]);
};

const loadNotificationSettings = async () => {
  try {
    const data = await fetchJSON("/api/notifications/settings");
    notifyEnableToggle.checked = Boolean(data.notifyTelopEnabled);
    notifyniconicoToggle.checked = Boolean(data.notifyTelopNiconico);
    notifyYoutubeToggle.checked = Boolean(data.notifyTelopYoutube);
    notifyDelayMsInput.value = Number(data.notifyTelopDelayMs ?? 5000);
    notifyStatus.textContent = "";
    updateNotifyUiState();
  } catch (err) {
    notifyStatus.textContent = t("notif_load_fail", err.message);
  }
};

const saveNotificationSettings = async () => {
  try {
    const payload = {
      notifyTelopEnabled: notifyEnableToggle.checked,
      notifyTelopNiconico: notifyniconicoToggle.checked,
      notifyTelopYoutube: notifyYoutubeToggle.checked,
      notifyTelopDelayMs: Number(notifyDelayMsInput.value) || 0,
    };
    const data = await fetchJSON("/api/notifications/settings", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    notifyStatus.textContent = data.ok ? t("notif_saved") : t("notif_save_fail");
  } catch (err) {
    notifyStatus.textContent = t("notif_save_fail");
  }
};

const updateNotifyUiState = () => {
  const enabled = notifyEnableToggle?.checked ?? false;
  [notifyniconicoToggle, notifyYoutubeToggle, notifyDelayMsInput].forEach(
    (el) => {
      if (el) el.disabled = !enabled;
    },
  );
  [notifyTargetsGroup, notifyDelayGroup].forEach((g) => {
    if (g) g.classList.toggle("disabled", !enabled);
  });
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

// NG users now share the editable list UI; entries are persisted via the rule save button.

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
    <span>${data.overlayConnected ? t("status_overlay_connected") : t("status_overlay_disconnected")
    }</span>
    <span class="status-text-inline">${t("status_downloading", data.downloadingCount ?? 0)}</span>
    <span class="status-text-inline">${t("status_autoplay", !data.autoplayPaused)}</span>
    <span class="status-text-inline">${t("status_shuffle", data.shuffleMode ?? "off")}</span>
    <span class="status-text-inline">${t("status_intake", !data.intakePaused)}</span>
  `;
  updateAutoplayButtonState(Boolean(data.autoplayPaused));
  updateShuffleButtonState(data.shuffleMode ?? "off");
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

const createPriorityCell = (item, { forceEditable = false } = {}) => {
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
  input.name = `priority-${item.id}`;
  input.id = `priority-${item.id}`;
  const hasNumericPosition = Number.isFinite(item.queuePosition);
  const currentValue = hasNumericPosition ? item.queuePosition : "";
  if (currentValue === "") {
    input.placeholder = "--";
  } else {
    input.value = String(currentValue);
  }
  input.dataset.currentOrder = hasNumericPosition ? String(currentValue) : "";
  const editable = forceEditable || REORDERABLE_STATUSES.has(item.status);
  if (editable) {
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

// --- Stock helpers ---
const getStockIndexById = (requestId) => stockItemsSnapshot.findIndex((item) => item.id === requestId);
const getSelectedStockItems = () => stockItemsSnapshot.filter((item) => selectedStockIds.has(item.id));

const setStockStatus = (text = "") => {
  if (stockSaveStatus) stockSaveStatus.textContent = text ?? "";
};

const setStockDirty = (dirty) => {
  stockDirty = dirty;
  if (stockSaveButton) stockSaveButton.disabled = !dirty;
  setButtonPulse(stockSaveButton, dirty);
  if (dirty) {
    pendingStockReload = false;
    pendingStockName = null;
    if (stockReloadTimer) {
      clearTimeout(stockReloadTimer);
      stockReloadTimer = null;
    }
  }
};

const updateStockActionStates = () => {
  const hasSelection = selectedStockIds.size > 0;
  if (stockDeleteButton) stockDeleteButton.disabled = !hasSelection;
};

const updateStockSelectionStyles = () => {
  if (!stockListEl) return;
  stockListEl.querySelectorAll(".queue-row").forEach((row) => {
    const id = row.dataset.id;
    row.classList.toggle("selected", Boolean(id && selectedStockIds.has(id)));
  });
  updateStockActionStates();
};

const handleStockRowClick = (event, requestId) => {
  const index = getStockIndexById(requestId);
  if (index === -1) return;
  if (event.shiftKey && lastSelectedStockId) {
    const lastIndex = getStockIndexById(lastSelectedStockId);
    if (lastIndex !== -1) {
      selectedStockIds.clear();
      const [start, end] = index < lastIndex ? [index, lastIndex] : [lastIndex, index];
      for (let i = start; i <= end; i++) {
        selectedStockIds.add(stockItemsSnapshot[i].id);
      }
    } else {
      selectedStockIds.clear();
      selectedStockIds.add(requestId);
    }
  } else if (event.metaKey || event.ctrlKey) {
    if (selectedStockIds.has(requestId)) {
      selectedStockIds.delete(requestId);
    } else {
      selectedStockIds.add(requestId);
    }
  } else {
    selectedStockIds.clear();
    selectedStockIds.add(requestId);
  }
  lastSelectedStockId = requestId;
  updateStockSelectionStyles();
};

const handleStockContextMenu = (event, requestId) => {
  event.preventDefault();
  if (!stockContextMenu) return;
  // ensure selection includes this row
  const idx = getStockIndexById(requestId);
  if (idx !== -1 && !selectedStockIds.has(requestId)) {
    selectedStockIds.clear();
    selectedStockIds.add(requestId);
    updateStockSelectionStyles();
  }
  stockContextMenu.style.left = `${event.clientX}px`;
  stockContextMenu.style.top = `${event.clientY}px`;
  stockContextMenu.classList.remove("hidden");
};

document.addEventListener("click", (e) => {
  if (stockContextMenu && !stockContextMenu.contains(e.target)) {
    stockContextMenu.classList.add("hidden");
  }
});

stockContextMenu?.addEventListener("click", async (event) => {
  const btn = event.target;
  if (!(btn instanceof HTMLButtonElement)) return;
  const action = btn.dataset.action;
  stockContextMenu.classList.add("hidden");
  const ids = Array.from(selectedStockIds);
  if (ids.length === 0) return;
  if (action === "submit-stock") {
    await handleStockSubmit(false);
  } else if (action === "submit-stock-suspend") {
    await handleStockSubmit(true);
  }
});

const createStockRow = (item) => {
  const row = document.createElement("article");
  row.className = "queue-row";
  row.dataset.id = item.id;
  const statusCell = createStatusChip(item);
  const priorityCell = createPriorityCell(item, { forceEditable: true });
  const durationCell = createDurationCell(item);
  const titleLink = document.createElement("span");
  titleLink.className = "queue-title-link unselectable";
  titleLink.textContent = item.title ?? item.url ?? t("queue_title_loading");
  titleLink.dataset.url = item.url;
  titleLink.title = item.url;

  const submitBtn = createActionButton(t("btn_stock_submit") ?? "Submit", async () => {
    selectedStockIds.clear();
    selectedStockIds.add(item.id);
    await handleStockSubmit(false);
  }, { icon: "/icons/send.svg" });

  const deleteBtn = createActionButton(t("action_delete"), async () => {
    if (!confirm(t("confirm_delete"))) return;
    await fetchJSON(`/api/requests/${item.id}/delete`, { method: "POST" });
    await loadStock(currentStockName);
    setStockDirty(true);
  }, { className: "delete", icon: "/icons/delete.svg" });

  row.appendChild(submitBtn);
  row.appendChild(statusCell);
  row.appendChild(priorityCell);
  row.appendChild(durationCell);
  row.appendChild(titleLink);
  row.appendChild(deleteBtn);

  row.addEventListener("click", (event) => handleStockRowClick(event, item.id));
  row.addEventListener("contextmenu", (event) => handleStockContextMenu(event, item.id));
  return row;
};

const renderStock = (items) => {
  if (!stockListEl) return;
  const prevSelected = new Set(selectedStockIds);
  stockItemsSnapshot = items.slice();
  stockListEl.innerHTML = "";
  selectedStockIds.clear();
  items.forEach((item) => {
    if (prevSelected.has(item.id)) selectedStockIds.add(item.id);
  });
  if (lastSelectedStockId && !items.some((i) => i.id === lastSelectedStockId)) {
    lastSelectedStockId = null;
  }
  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "queue-card";
    empty.textContent = t("queue_empty");
    stockListEl.appendChild(empty);
  } else {
    items.forEach((item) => {
      stockListEl.appendChild(createStockRow(item));
    });
  }
  if (stockCounterEl) stockCounterEl.textContent = `${t("queue_count", items.length)}`;
  updateStockSelectionStyles();
  setStockStatus("");
};

const addStockItem = async () => {
  const message = stockAddInput?.value.trim() ?? "";
  if (!message) {
    formStatus.textContent = t("stock_add_required");
    return;
  }
  const priority = 1;
  if (stockAddButton) stockAddButton.disabled = true;
  try {
    console.debug("[stock] adding item:", message, "to", currentStockName);
    const result = await fetchJSON(`/api/stocks/${encodeURIComponent(currentStockName)}/add`, {
      method: "POST",
      body: JSON.stringify({ message, priority }),
    });
    console.debug("[stock] add result:", result);
    if (stockAddInput) stockAddInput.value = "";
    // 直後にリストへ反映しつつ Dirty は維持する
    setStockDirty(true);
    await loadStock(currentStockName, { force: true, preserveDirty: true });
    formStatus.textContent = t("stock_add_done");
  } catch (err) {
    console.error("[stock] add failed:", err);
    formStatus.textContent = t("stock_add_fail", err.message);
  } finally {
    if (stockAddButton) stockAddButton.disabled = false;
  }
};

const deleteSelectedStockItems = async () => {
  const ids = Array.from(selectedStockIds);
  if (ids.length === 0) {
    formStatus.textContent = t("msg_selection_none");
    return;
  }
  if (!confirm(t("confirm_delete"))) {
    return;
  }
  if (stockDeleteButton) stockDeleteButton.disabled = true;
  try {
    await Promise.all(
      ids.map((id) =>
        fetchJSON(`/api/requests/${encodeURIComponent(id)}/delete`, { method: "POST" })
      ),
    );
    formStatus.textContent = t("stock_delete_done", ids.length);
    selectedStockIds.clear();
    // SSE will trigger loadStock automatically
    setStockDirty(true);
  } catch (err) {
    formStatus.textContent = t("stock_delete_fail", err.message);
  } finally {
    updateStockSelectionStyles();
    if (stockDeleteButton) stockDeleteButton.disabled = false;
  }
};

const createStockFromPrompt = async () => {
  const baseName = prompt(t("stock_new_prompt") ?? "New stock name");
  if (baseName === null) return null;
  const trimmed = baseName.trim();
  try {
    const payload = trimmed ? { name: trimmed } : {};
    const data = await fetchJSON("/api/stocks", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const nextName = typeof data?.name === "string" ? data.name : trimmed || "default";
    await loadStockNames();
    await loadStock(nextName);
    formStatus.textContent = t("stock_new_done", { name: nextName });
    if (stockSelect) stockSelect.value = nextName;
    return nextName;
  } catch (err) {
    formStatus.textContent = t("stock_new_fail", err.message);
    return null;
  }
};

updateStockActionStates();
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

const REQUEST_STATUS_QUERY = encodeURIComponent(
  "QUEUED,VALIDATING,DOWNLOADING,READY,PLAYING,FAILED,REJECTED,DONE,SUSPEND",
);

const refreshAll = async () => {
  const seq = ++refreshSeq;
  refreshButton.disabled = true;
  try {
    const [summary, list, comments, versionInfo, rules, logs] = await Promise.all([
      fetchJSON("/api/requests/summary"),
      fetchJSON(`/api/requests?status=${REQUEST_STATUS_QUERY}`),
      fetchJSON("/api/comments?limit=30"),
      fetchJSON("/api/system/info"),
      fetchJSON("/api/rules"),
      fetchJSON(`/api/logs?limit=${LOG_FETCH_LIMIT}`),
    ]);
    if (seq !== refreshSeq) return;
    renderSummary(summary);
    renderQueue(list.items ?? []);
    renderComments(comments.items ?? []);
    renderSystem(versionInfo);
    renderRules(rules?.rules);
    renderLogs(logs.items ?? []);
    // Do not auto refresh stock to avoid overwriting edits
  } catch (err) {
    console.error(err);
    formStatus.textContent = t("msg_update_fail", err.message);
  } finally {
    if (seq === refreshSeq) {
      refreshButton.disabled = false;
    }
  }
};

const reloadQueue = async () => {
  try {
    const list = await fetchJSON(`/api/requests?status=${REQUEST_STATUS_QUERY}`);
    renderQueue(list.items ?? []);
  } catch (err) {
    console.error("[SSE] queue reload failed", err);
    if (formStatus) formStatus.textContent = t("msg_update_fail", err.message);
  }
};

// Stock API helpers
const loadStockNames = async () => {
  try {
    const data = await fetchJSON("/api/stocks");
    const names = Array.isArray(data?.names) ? data.names : ["default"];
    stockCache.clear();
    stockInvalidated.clear();
    stockSelect.innerHTML = "";
    const newOpt = document.createElement("option");
    newOpt.value = NEW_STOCK_VALUE;
    newOpt.dataset.newOption = "true";
    newOpt.textContent = `<${t("stock_new") ?? "New stock"}>`;
    stockSelect.appendChild(newOpt);
    names.forEach((name) => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      stockSelect.appendChild(opt);
    });
    if (names.includes(currentStockName)) {
      stockSelect.value = currentStockName;
    } else {
      currentStockName = names[0] ?? "default";
      stockSelect.value = currentStockName;
    }
    if (names.length === 0) {
      formStatus.textContent = t("stock_list_empty");
    } else {
      formStatus.textContent = "";
    }
  } catch (err) {
    console.warn("[stock] list failed", err);
    stockSelect.innerHTML = "";
    const fallback = document.createElement("option");
    fallback.value = "default";
    fallback.textContent = "default";
    stockSelect.appendChild(fallback);
    stockSelect.value = "default";
    currentStockName = "default";
    formStatus.textContent = t("stock_load_fail");
  }
};

const loadStock = async (name, options = {}) => {
  const target = name ?? currentStockName;
  const { preserveDirty = false, force = false } = options;

  // If a load is already running for the same target, queue a follow-up after it finishes.
  if (stockReloadInFlight && !force) {
    pendingStockReload = true;
    pendingStockName = target;
    pendingStockOptions = options;
    return;
  }

  stockReloadInFlight = true;

  try {
    const data = await fetchJSON(`/api/stocks/${encodeURIComponent(target)}?t=${Date.now()}`);
    const items = Array.isArray(data?.items) ? data.items : [];
    stockCache.set(target, { items });
    stockInvalidated.delete(target);
    renderStock(items);
    currentStockName = target;
    if (stockSelect) stockSelect.value = target;
    if (!preserveDirty) setStockDirty(false);
    selectedStockIds.clear();
    lastSelectedStockId = null;
  } catch (err) {
    console.error("[stock] load failed:", err);
    renderStock([]);
    setStockStatus(t("stock_load_fail"));
    if (formStatus) formStatus.textContent = t("stock_load_fail");
    lastStockReloadErrorAt = Date.now();
  } finally {
    lastStockReloadAt = Date.now();
    stockReloadInFlight = false;
    if (stockReloadTimer) {
      clearTimeout(stockReloadTimer);
      stockReloadTimer = null;
    }
    if (pendingStockReload) {
      const next = pendingStockName ?? currentStockName;
      pendingStockReload = false;
      pendingStockName = null;
      const nextOptions = pendingStockOptions ?? {};
      pendingStockOptions = null;
      loadStock(next, nextOptions);
    }
  }
};

const scheduleStockReload = (name, options = {}) => {
  const target = name ?? currentStockName;
  const { preserveDirty = false, force = false } = options;
  // ユーザー編集中は上書きを避けるが、preserveDirty 指定時は状態更新のみ許容
  if (stockDirty && !preserveDirty && !force) return;
  // Debounce rapid signals (e.g., SSE bursts)
  if (stockReloadTimer) {
    pendingStockReload = true;
    pendingStockName = target;
    pendingStockOptions = options;
    return;
  }
  stockReloadTimer = setTimeout(() => {
    stockReloadTimer = null;
    if (stockReloadInFlight && !force) {
      pendingStockReload = true;
      pendingStockName = target;
      pendingStockOptions = options;
      return;
    }
    loadStock(target, { preserveDirty, force });
  }, STOCK_RELOAD_DEBOUNCE_MS);
};

const saveCurrentStock = async () => {
  try {
    await fetchJSON(`/api/stocks/${encodeURIComponent(currentStockName)}/save`, { method: "POST" });
    setStockDirty(false);
    setStockStatus(t("stock_save_done"));
  } catch (err) {
    setStockStatus(t("stock_save_fail"));
  }
};

const handleStockSubmit = async (asSuspend) => {
  if (stockSubmitInFlight) return;
  const ids = Array.from(selectedStockIds);
  if (ids.length === 0) {
    formStatus.textContent = t("msg_selection_none");
    return;
  }
  try {
    stockSubmitInFlight = true;
    const result = await fetchJSON(`/api/stocks/${encodeURIComponent(currentStockName)}/submit`, {
      method: "POST",
      body: JSON.stringify({ ids, suspend: asSuspend }),
    });
    const doneMsg = t("stock_submit_done", ids.length);
    formStatus.textContent = doneMsg;
    setStockStatus(doneMsg);
    selectedStockIds.clear();
    updateStockSelectionStyles();
    await refreshAll();
    await loadStock(currentStockName, { preserveDirty: true, force: true });
  } catch (err) {
    formStatus.textContent = t("stock_submit_fail", err.message);
  } finally {
    stockSubmitInFlight = false;
  }
};

const handleOrderChange = async (requestId, input) => {
  const parsed = Number(input.value);
  const currentLabel = input.dataset.currentOrder ?? "";
  const current = Number(currentLabel || "0");
  const isStockItem = stockItemsSnapshot.some((item) => item.id === requestId);
  if (!Number.isFinite(parsed) || parsed < 1) {
    input.value = currentLabel || "";
    return;
  }
  const desired = Math.floor(parsed);
  if (currentLabel && desired === current) {
    input.value = currentLabel;
    return;
  }
  const selectedSet = isStockItem ? selectedStockIds : selectedRequestIds;
  const targetIds = selectedSet.has(requestId) && selectedSet.size > 1
    ? Array.from(selectedSet)
    : [requestId];
  const reorderableIds = targetIds.filter((id) => {
    if (isStockItem) return true;
    const item = queueItemsSnapshot.find((q) => q.id === id);
    return item && REORDERABLE_STATUSES.has(item.status);
  });
  if (reorderableIds.length === 0) {
    input.value = currentLabel || "";
    return;
  }
  input.disabled = true;
  const siblingInputs = reorderableIds
    .filter((id) => id !== requestId)
    .map((id) => document.querySelector(`input[name='priority-${id}']`))
    .filter(Boolean);
  siblingInputs.forEach((el) => { el.disabled = true; });
  try {
    await Promise.all(reorderableIds.map((id) => fetchJSON(`/api/requests/${id}/reorder`, {
      method: "POST",
      body: JSON.stringify({ position: desired }),
    })));
    const applyValue = (el) => {
      if (!el) return;
      el.value = String(desired);
      el.dataset.currentOrder = String(desired);
    };
    applyValue(input);
    siblingInputs.forEach(applyValue);
    if (isStockItem) setStockDirty(true);
  } catch (err) {
    console.error(err);
    formStatus.textContent = t("msg_reorder_fail", err.message);
    input.value = currentLabel || "";
  } finally {
    input.disabled = false;
    siblingInputs.forEach((el) => { el.disabled = false; });
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

const handleRequestsEvent = async (payload) => {
  const summary = payload?.summary;
  const list = payload?.list;
  const bucket = typeof payload?.bucket === "string" ? payload.bucket : null;

  if (summary) renderSummary(summary);

  const isQueueBucket = !bucket || bucket === "queue";
  if (isQueueBucket) {
    if (list?.items) {
      renderQueue(list.items);
    } else {
      await reloadQueue();
    }
  }

  const isStockBucket = bucket && bucket !== "queue";
  if (isStockBucket && isTabActive("stock") && bucket === currentStockName) {
    const hasUnready =
      stockItemsSnapshot.length === 0 ||
      stockItemsSnapshot.some((item) => !["READY", "DONE"].includes(item.status));
    if (hasUnready) {
      scheduleStockReload(currentStockName, { preserveDirty: true });
    }
  }
};

const connectDockStream = () => {
  if (!("EventSource" in globalThis)) {
    console.warn(t("msg_eventsource_fallback"));
    setInterval(refreshAll, 6000);
    return;
  }
  let retryDelay = 2000;
  const maxDelay = 30000;
  const connect = () => {
    const source = new EventSource("/api/stream");
    source.addEventListener("requests", async (event) => {
      const data = parseSseData(event);
      if (!data) return;

      try {
        await handleRequestsEvent(data);
      } catch (err) {
        console.error("[SSE] requests handler failed", err);
      }
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
    } else if (action === "suspend") {
      selectedRequestIds.clear();
      if (target.id) selectedRequestIds.add(target.id);
      await applySelectionAction("suspend");
    } else if (action === "resume") {
      selectedRequestIds.clear();
      if (target.id) selectedRequestIds.add(target.id);
      await applySelectionAction("resume");
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
      ensureNgBlockingEnabled();
      upsertNgUserValue(targetUserId);
      try {
        await saveRules({ silent: true });
        if (commentStatus) {
          commentStatus.textContent = t("ng_user_add_done", { user: targetUserId });
        }
      } catch (err) {
        if (commentStatus) {
          commentStatus.textContent = t("ng_user_action_fail", err.message);
        }
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
  if (autoTogglePending) return;
  autoButton.disabled = true;
  autoTogglePending = true;
  const seq = ++autoToggleSeq;
  try {
    const result = await fetchJSON("/api/overlay/autoplay", { method: "POST" });
    if (seq === autoToggleSeq) {
      updateAutoplayButtonState(Boolean(result?.paused));
    }
  } catch (err) {
    formStatus.textContent = t("msg_auto_fail", err.message);
  } finally {
    if (seq === autoToggleSeq) {
      autoButton.disabled = false;
    }
    autoTogglePending = false;
    refreshAll();
  }
});

shuffleButton?.addEventListener("click", async () => {
  if (shuffleTogglePending) return;
  shuffleButton.disabled = true;
  shuffleTogglePending = true;
  const seq = ++shuffleToggleSeq;
  try {
    const result = await fetchJSON("/api/overlay/shuffle", { method: "POST" });
    if (seq === shuffleToggleSeq) {
      updateShuffleButtonState(result?.mode ?? "off");
    }
  } catch (err) {
    formStatus.textContent = t("msg_shuffle_fail", err.message);
  } finally {
    if (seq === shuffleToggleSeq) {
      shuffleButton.disabled = false;
    }
    shuffleTogglePending = false;
    refreshAll();
  }
});

intakeButton?.addEventListener("click", async () => {
  if (intakeTogglePending) return;
  intakeButton.disabled = true;
  intakeTogglePending = true;
  const seq = ++intakeToggleSeq;
  try {
    const result = await fetchJSON("/api/requests/intake/toggle", { method: "POST" });
    if (seq === intakeToggleSeq) {
      updateIntakeButtonState(Boolean(result?.paused));
    }
  } catch (err) {
    formStatus.textContent = t("msg_intake_fail", err.message);
  } finally {
    if (seq === intakeToggleSeq) {
      intakeButton.disabled = false;
    }
    intakeTogglePending = false;
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

stockAddButton?.addEventListener("click", () => addStockItem());
stockAddInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    addStockItem();
  }
});
stockDeleteButton?.addEventListener("click", () => deleteSelectedStockItems());
stockSaveButton?.addEventListener("click", () => saveCurrentStock());
stockSelect?.addEventListener("change", async () => {
  const value = stockSelect.value;
  if (value === NEW_STOCK_VALUE) {
    const created = await createStockFromPrompt();
    // revert selection if creation cancelled or failed
    stockSelect.value = created ?? currentStockName;
  } else {
    if (stockDirty) {
      setStockStatus(t("stock_discard_unsaved") ?? "");
    }
    await loadStock(value);
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
  if (tab === "stock") {
    loadStock(currentStockName, { preserveDirty: true }).catch((err) => console.warn("[stock] load failed", err));
  }
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

  const destination = commentDestination?.value || "debug";

  try {
    if (destination === "youtube") {
      // Send to YouTube Live Chat
      const authStatus = await fetchJSON("/api/auth/youtube/status");
      if (!authStatus?.authenticated) {
        formStatus.textContent = t("msg_youtube_not_authenticated");
        return;
      }

      // Get broadcast and liveChatId
      const broadcast = await fetchJSON("/api/youtube/broadcasts");
      if (!broadcast?.ok || !broadcast?.broadcastId) {
        formStatus.textContent = t("msg_youtube_broadcast_missing");
        return;
      }

      const result = await fetchJSON(`/api/youtube/chat/${broadcast.broadcastId}`, {
        method: "POST",
        body: JSON.stringify({ message }),
      });

      if (result.ok) {
        formStatus.textContent = t("msg_youtube_send_success");
        commentInput.value = "";
      } else {
        formStatus.textContent = t("msg_youtube_error", {
          message: result.message || "Unknown error",
        });
      }
    } else if (destination === "niconico") {
      // Send to niconico Live
      const authStatus = await fetchJSON("/api/auth/niconico/status");
      if (!authStatus?.authenticated) {
        formStatus.textContent = t("msg_niconico_not_authenticated");
        return;
      }

      // Get broadcast ID
      const broadcast = await fetchJSON("/api/niconico/broadcasts");
      if (!broadcast?.ok || !broadcast?.broadcastId) {
        formStatus.textContent = t("msg_niconico_broadcast_missing");
        return;
      }

      const result = await fetchJSON(`/api/niconico/comments/${broadcast.broadcastId}`, {
        method: "POST",
        body: JSON.stringify({ message }),
      });

      if (result.ok) {
        formStatus.textContent = t("msg_niconico_send_success");
        commentInput.value = "";
      } else {
        formStatus.textContent = t("msg_niconico_error", {
          message: result.message || "Unknown error",
        });
      }
    } else {
      // Debug (internal)
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
    }
  } catch (err) {
    formStatus.textContent = t("msg_send_fail", err.message);
  }
});

const init = async () => {
  await configureLocale();
  await loadStockNames();
  await loadStock(currentStockName);
  // 認証状態の初期表示は broadcast.js が行うためここでは呼び出さない
  // await refreshAuthStatuses(false);
  await loadNotificationSettings();
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
      await fetch("/api/locale", {
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
initializeLogColumnSizing();
wireRuleControlsForDirtyState();
init();

refreshAuthButton?.addEventListener("click", () => refreshAuthStatuses(true));
// Save button removed — changes are saved immediately on toggle/input
notifyEnableToggle?.addEventListener("change", updateNotifyUiState);
// Persist notification rules immediately when toggled
notifyEnableToggle?.addEventListener("change", () => {
  saveNotificationSettings();
});
notifyniconicoToggle?.addEventListener("change", () => saveNotificationSettings());
notifyYoutubeToggle?.addEventListener("change", () => saveNotificationSettings());
notifyDelayMsInput?.addEventListener("change", () => saveNotificationSettings());

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
  if (updateYtDlpButton) {
    updateYtDlpButton.disabled = !(info?.ytDlp?.updateAvailable);
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

const refreshEditableListPlaceholders = () => {
  const patternPlaceholder = t("rule_custom_pattern_placeholder");
  document.querySelectorAll(".custom-site-pattern").forEach((input) => {
    input.setAttribute("placeholder", patternPlaceholder);
  });
  const ngPlaceholder = t("rule_ng_placeholder");
  document.querySelectorAll(".ng-user-field").forEach((input) => {
    input.setAttribute("placeholder", ngPlaceholder);
  });
  const aliasPlaceholder = t("rule_custom_alias_placeholder");
  document.querySelectorAll(".custom-site-alias").forEach((input) => {
    input.setAttribute("placeholder", aliasPlaceholder);
  });
  const removeLabel = t("rule_custom_remove");
  document.querySelectorAll(".rule-entry-remove").forEach((button) => {
    button.setAttribute("aria-label", removeLabel);
    button.title = removeLabel;
  });
};

const createCustomSiteRow = (entry = {}, markDirty = true) => {
  if (!ruleCustomSiteList) return null;
  const wrapper = document.createElement("div");
  wrapper.className = "rule-entry-row custom-site-row";
  const idValue = typeof entry.id === "string" && entry.id.length > 0
    ? entry.id
    : generateCustomSiteId();
  wrapper.dataset.id = idValue;

  const patternInput = document.createElement("input");
  patternInput.type = "text";
  patternInput.className = "rule-entry-input custom-site-pattern";
  if (typeof entry.pattern === "string") patternInput.value = entry.pattern;
  patternInput.addEventListener("input", handleRuleControlDirty);

  const aliasInput = document.createElement("input");
  aliasInput.type = "text";
  aliasInput.className = "rule-entry-input custom-site-alias";
  aliasInput.placeholder = "sc";
  aliasInput.style.flex = "0 0 56px";
  if (typeof entry.alias === "string") aliasInput.value = entry.alias;
  aliasInput.addEventListener("input", handleRuleControlDirty);

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "rule-entry-remove custom-site-remove";
  removeButton.innerHTML = "&times;";
  removeButton.addEventListener("click", () => {
    wrapper.remove();
    setRulesDirty(true);
  });

  wrapper.append(patternInput, aliasInput, removeButton);
  ruleCustomSiteList.appendChild(wrapper);
  refreshEditableListPlaceholders();
  if (markDirty) setRulesDirty(true);
  return wrapper;
};

const renderCustomSiteRows = (rows) => {
  if (!ruleCustomSiteList) return;
  ruleCustomSiteList.innerHTML = "";
  if (Array.isArray(rows) && rows.length > 0) {
    rows.forEach((row) => createCustomSiteRow(row, false));
  }
};

const collectCustomSiteRows = () => {
  if (!ruleCustomSiteList) return [];
  const entries = [];
  ruleCustomSiteList.querySelectorAll(".custom-site-row").forEach((row) => {
    const patternInput = row.querySelector(".custom-site-pattern");
    const aliasInput = row.querySelector(".custom-site-alias");
    const pattern = patternInput?.value?.trim();
    if (!pattern) return;
    const idValue = row.dataset.id && row.dataset.id.trim().length > 0
      ? row.dataset.id.trim()
      : generateCustomSiteId();
    entries.push({
      id: idValue,
      pattern,
      alias: aliasInput?.value?.trim() || undefined,
    });
  });
  return entries;
};

function collectNgUserIds() {
  if (!ruleNgUserList) return [];
  const ids = [];
  const seen = new Set();
  ruleNgUserList.querySelectorAll(".ng-user-field").forEach((input) => {
    const value = input.value.trim();
    if (!value || seen.has(value)) return;
    seen.add(value);
    ids.push(value);
  });
  return ids;
}

ruleCustomSiteAddButton?.addEventListener("click", () => {
  createCustomSiteRow();
  setRulesDirty(true);
});

ruleNgUserAddButton?.addEventListener("click", () => {
  const row = createNgUserRow();
  ensureNgBlockingEnabled();
  row?.querySelector(".ng-user-field")?.focus();
  setRulesDirty(true);
});

ruleSaveButton?.addEventListener("click", () => {
  saveRules().catch(() => {
    // errors handled inside saveRules
  });
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
  setRulesDirty(false);
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

function buildRulePayload() {
  return {
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
}

async function saveRules({ silent = false } = {}) {
  if (ruleSaveButton) ruleSaveButton.disabled = true;
  if (!silent && ruleStatus) ruleStatus.textContent = "";
  try {
    const payload = buildRulePayload();
    // check duplicate aliases on client-side
    const aliases = (payload.customSites ?? []).map((s) => (s?.alias ?? "").toLowerCase()).filter(Boolean);
    const dup = aliases.find((a, idx) => aliases.indexOf(a) !== idx);
    if (dup) {
      if (!silent && ruleStatus) {
        ruleStatus.textContent = `${t("rule_save_failed")}: Duplicate alias '${dup}'`;
      }
      throw new Error("duplicate-alias");
    }
    const result = await fetchJSON("/api/rules", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    // 明示リロードでサーバー側のメモリに即反映
    const reloaded = await fetchJSON("/api/rules/reload", { method: "POST" });
    if (reloaded?.rules) {
      renderRules(reloaded.rules);
    } else {
      renderRules(result?.rules);
    }
    setRulesDirty(false);
    if (!silent && ruleStatus) {
      ruleStatus.textContent = t("rule_saved");
    }
    return result;
  } catch (err) {
    if (!silent && ruleStatus) {
      ruleStatus.textContent = `${t("rule_save_failed")}: ${err.message}`;
    }
    throw err;
  } finally {
    if (ruleSaveButton) ruleSaveButton.disabled = !rulesDirty;
  }
}

if (updateYtDlpButton) {
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
}
