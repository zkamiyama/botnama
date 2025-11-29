// Broadcast Detection and Comment Streaming (manual URL fallback supported)
import { t } from "../i18n.js";

// Utility: JSON fetch wrapper
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

// DOM references (YouTube)
const authYoutubeStatus = document.getElementById("authYoutubeStatus");
const youtubeBroadcastStatus = document.getElementById("youtubeBroadcastStatus");
const youtubeLiveIdLink = document.getElementById("youtubeLiveIdLink");
const youtubeManualInputLink = document.getElementById("youtubeManualInputLink");
const youtubeManualClearButton = document.getElementById("youtubeManualClearButton");
const connectYoutubeCommentButton = document.getElementById("connectYoutubeCommentButton");

// DOM references (Niconico)
const authNiconicoStatus = document.getElementById("authNiconicoStatus");
const niconicoBroadcastStatus = document.getElementById("niconicoBroadcastStatus");
const niconicoLiveIdLink = document.getElementById("niconicoLiveIdLink");
const niconicoManualInputLink = document.getElementById("niconicoManualInputLink");
const niconicoManualClearButton = document.getElementById("niconicoManualClearButton");
const niconicoConnectStatus = document.getElementById("niconicoConnectStatus");
const youtubeUserLink = document.getElementById("youtubeUserLink");
const niconicoUserLink = document.getElementById("niconicoUserLink");

// Helper to update user profile links
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

// DOM references (manual dialog)
const manualUrlDialog = document.getElementById("manualUrlDialog");
const manualUrlForm = document.getElementById("manualUrlForm");
const manualUrlInput = document.getElementById("manualUrlInput");
const manualUrlError = document.getElementById("manualUrlError");
const manualDialogTitle = document.getElementById("manualDialogTitle");
const manualUrlHint = document.getElementById("manualUrlHint");
const manualUrlCancelButton = document.getElementById("manualUrlCancelButton");

let youtubePollingInterval = null;
let niconicoPollingInterval = null;
let currentYoutubeBroadcast = null;
let currentNiconicoBroadcast = null;
let youtubeBroadcastSource = null; // "auto" | "manual" | null
let niconicoBroadcastSource = null; // "auto" | "manual" | null
let youtubeAuthenticated = false;
let niconicoAuthenticated = false;
let dialogTargetSite = null; // "youtube" | "niconico" | null

const manualStorageKeys = {
    youtube: "manualYoutubeLiveId",
    niconico: "manualNiconicoLiveId",
};

// --- Helpers: storage & parsing -------------------------------------------------
const loadManualSelection = (site) => {
    try {
        return sessionStorage.getItem(manualStorageKeys[site]) || null;
    } catch (_e) {
        return null;
    }
};

const saveManualSelection = (site, id) => {
    try {
        sessionStorage.setItem(manualStorageKeys[site], id);
    } catch (e) {
        console.warn("[Broadcast] Failed to persist manual selection:", e);
    }
};

const clearManualSelection = (site) => {
    try {
        sessionStorage.removeItem(manualStorageKeys[site]);
    } catch (_e) {
        // ignore
    }
};

const extractYoutubeVideoId = (input) => {
    if (!input) return null;
    const text = input.trim();
    const urlMatch = text.match(/(?:v=|\/live\/|youtu\.be\/|\/embed\/)([0-9A-Za-z_-]{11})/);
    if (urlMatch) return urlMatch[1];
    const directMatch = text.match(/^[0-9A-Za-z_-]{11}$/);
    return directMatch ? directMatch[0] : null;
};

const extractNiconicoLiveId = (input) => {
    if (!input) return null;
    const text = input.trim();
    const match = text.match(/lv[0-9]+/i);
    return match ? match[0].toLowerCase() : null;
};

// --- UI renderers ---------------------------------------------------------------
const renderYoutubeUi = () => {
    const hasId = !!currentYoutubeBroadcast;
    if (youtubeLiveIdLink) {
        if (hasId) {
            youtubeLiveIdLink.textContent = currentYoutubeBroadcast;
            youtubeLiveIdLink.href = `https://www.youtube.com/watch?v=${currentYoutubeBroadcast}`;
            youtubeLiveIdLink.style.display = "inline";
        } else {
            youtubeLiveIdLink.textContent = "--";
            youtubeLiveIdLink.href = "#";
            youtubeLiveIdLink.style.display = "none";
        }
    }
    if (youtubeBroadcastStatus) {
        let status = t("msg_stream_not_found");
        if (hasId && youtubeBroadcastSource === "manual") {
            status = t("manual_status_manual");
        } else if (hasId) {
            status = t("auth_status_authenticated");
        } else if (!youtubeAuthenticated) {
            status = t("auth_status_not_authenticated");
        }
        youtubeBroadcastStatus.textContent = status;
    }
    if (youtubeManualInputLink) youtubeManualInputLink.style.display = hasId ? "none" : "inline";
    if (youtubeManualClearButton) youtubeManualClearButton.style.display = youtubeBroadcastSource === "manual" ? "inline" : "none";
};

const renderNiconicoUi = () => {
    const hasId = !!currentNiconicoBroadcast;
    if (niconicoLiveIdLink) {
        if (hasId) {
            niconicoLiveIdLink.textContent = currentNiconicoBroadcast;
            niconicoLiveIdLink.href = `https://live.nicovideo.jp/watch/${currentNiconicoBroadcast}`;
            niconicoLiveIdLink.style.display = "inline";
        } else {
            niconicoLiveIdLink.textContent = "--";
            niconicoLiveIdLink.href = "#";
            niconicoLiveIdLink.style.display = "none";
        }
    }
    if (niconicoBroadcastStatus) {
        let status = t("msg_stream_not_found");
        if (hasId && niconicoBroadcastSource === "manual") {
            status = t("manual_status_manual");
        } else if (hasId) {
            status = t("auth_status_authenticated");
        } else if (!niconicoAuthenticated) {
            status = t("auth_status_not_authenticated");
        }
        niconicoBroadcastStatus.textContent = status;
    }
    if (niconicoManualInputLink) niconicoManualInputLink.style.display = hasId ? "none" : "inline";
    if (niconicoManualClearButton) niconicoManualClearButton.style.display = niconicoBroadcastSource === "manual" ? "inline" : "none";
};

const setYoutubeBroadcast = (broadcastId, source) => {
    currentYoutubeBroadcast = broadcastId;
    youtubeBroadcastSource = source;
    if (authYoutubeStatus) {
        authYoutubeStatus.textContent = youtubeAuthenticated ? t("auth_status_authenticated") : t("auth_status_not_authenticated");
    }
    renderYoutubeUi();
    if (broadcastId) {
        startYoutubePolling();
        if (connectYoutubeCommentButton) connectYoutubeCommentButton.textContent = t("btn_connected");
    } else {
        stopYoutubePolling();
        if (connectYoutubeCommentButton) connectYoutubeCommentButton.textContent = t("btn_connect");
    }
};

const setNiconicoBroadcast = (broadcastId, source) => {
    currentNiconicoBroadcast = broadcastId;
    niconicoBroadcastSource = source;
    if (authNiconicoStatus) {
        authNiconicoStatus.textContent = niconicoAuthenticated ? t("auth_status_authenticated") : t("auth_status_not_authenticated");
    }
    renderNiconicoUi();
    if (broadcastId) {
        startNiconicoPolling();
    } else {
        stopNiconicoPolling();
    }
};

// --- Detection ---------------------------------------------------------------
async function checkYoutubeBroadcast() {
    const manualId = loadManualSelection("youtube");
    let detectedId = null;
    let source = null;
    try {
        const authResp = await fetchJSON("/api/auth/youtube/status");
        youtubeAuthenticated = !!authResp?.authenticated;
        if (authYoutubeStatus) {
            authYoutubeStatus.textContent = youtubeAuthenticated ? t("auth_status_authenticated") : t("auth_status_not_authenticated");
        }
        setUserLink(youtubeUserLink, authResp?.channelUrl ?? null);
        if (authResp?.ok && authResp.broadcastId) {
            detectedId = authResp.broadcastId;
            source = "auto";
        }
    } catch (err) {
        console.error("[Broadcast] YouTube check failed:", err);
        if (authYoutubeStatus) authYoutubeStatus.textContent = t("msg_update_fail", { msg: err.message ?? "error" });
    }

    if (!detectedId && manualId) {
        detectedId = manualId;
        source = "manual";
    } else if (source === "auto") {
        clearManualSelection("youtube");
    }

    setYoutubeBroadcast(detectedId, source);
}

async function checkNiconicoBroadcast() {
    const manualId = loadManualSelection("niconico");
    let detectedId = null;
    let source = null;
    try {
        const authResp = await fetchJSON("/api/auth/niconico/status");
        niconicoAuthenticated = !!authResp?.authenticated;
        if (authNiconicoStatus) {
            authNiconicoStatus.textContent = niconicoAuthenticated ? t("auth_status_authenticated") : t("auth_status_not_authenticated");
        }
        setUserLink(niconicoUserLink, authResp?.userPageUrl ?? null);

        // The status endpoint already returns broadcastId, no need to call /api/niconico/broadcasts
        if (authResp?.ok && authResp.broadcastId) {
            detectedId = authResp.broadcastId;
            source = "auto";
        }
    } catch (err) {
        console.error("[Broadcast] Niconico check failed:", err);
        if (authNiconicoStatus) authNiconicoStatus.textContent = t("msg_update_fail", { msg: err.message ?? "error" });
    }

    if (!detectedId && manualId) {
        detectedId = manualId;
        source = "manual";
    } else if (source === "auto") {
        clearManualSelection("niconico");
    }

    setNiconicoBroadcast(detectedId, source);
}

// --- Polling (YouTube placeholder) --------------------------------------------
async function pollYoutubeComments() {
    if (!currentYoutubeBroadcast) {
        stopYoutubePolling();
        return;
    }
    try {
        const resp = await fetchJSON(`/api/youtube/comments/${currentYoutubeBroadcast}`);
        if (resp?.ok && Array.isArray(resp.comments) && resp.comments.length > 0) {
            console.log(`[YouTube] Received ${resp.comments.length} comments`);
            for (const comment of resp.comments) {
                try {
                    // Skip comments without text (e.g., super chats without messages)
                    if (!comment.text || !comment.text.trim()) {
                        console.log("[YouTube] Skipping comment without text:", comment);
                        continue;
                    }

                    const payload = {
                        siteType: "youtubelive",
                        messageId: comment.id,
                        userId: comment.authorChannelId,
                        userName: comment.authorName,
                        comment: comment.text,
                        timestamp: new Date(comment.publishedAt).getTime(),
                        allowRequestCreation: true,
                    };
                    console.log("[YouTube] Sending comment payload:", payload);
                    await fetchJSON("/api/comments/ingest", {
                        method: "POST",
                        body: JSON.stringify(payload),
                    });
                } catch (err) {
                    console.error("[YouTube] Failed to ingest comment:", comment, err);
                }
            }
        }
    } catch (err) {
        console.error("[YouTube] Comment polling failed:", err);
    }
}

// --- Polling (Niconico) -------------------------------------------------------
async function pollNiconicoComments() {
    if (!currentNiconicoBroadcast) {
        stopNiconicoPolling();
        return;
    }

    try {
        const resp = await fetchJSON(`/api/niconico/comments/${currentNiconicoBroadcast}`);
        if (resp?.ok && Array.isArray(resp.comments) && resp.comments.length > 0) {
            console.log(`[Niconico] Received ${resp.comments.length} comments`);
            for (const comment of resp.comments) {
                try {
                    // Skip comments without message
                    if (!comment.message || !comment.message.trim()) {
                        console.log("[Niconico] Skipping comment without message:", comment);
                        continue;
                    }

                    const payload = {
                        siteType: "nicolive",
                        messageId: comment.id,
                        userId: comment.userId,
                        userName: comment.userName,
                        comment: comment.message,
                        timestamp: comment.timestamp * 1000,
                        allowRequestCreation: true,
                    };
                    console.log("[Niconico] Sending comment payload:", payload);
                    await fetchJSON("/api/comments/ingest", {
                        method: "POST",
                        body: JSON.stringify(payload),
                    });
                } catch (err) {
                    console.error("[Niconico] Failed to ingest comment:", comment, err);
                }
            }
        }
    } catch (err) {
        console.error("[Niconico] Comment polling failed:", err);
    }
}

function startYoutubePolling() {
    if (youtubePollingInterval || !currentYoutubeBroadcast) return;
    console.log("[YouTube] Starting comment polling");
    pollYoutubeComments();
    youtubePollingInterval = setInterval(pollYoutubeComments, 2000);
}

function stopYoutubePolling() {
    if (youtubePollingInterval) {
        clearInterval(youtubePollingInterval);
        youtubePollingInterval = null;
        console.log("[YouTube] Stopped comment polling");
    }
}

function startNiconicoPolling() {
    if (niconicoPollingInterval || !currentNiconicoBroadcast) return;
    console.log("[Niconico] Starting comment polling");
    pollNiconicoComments();
    niconicoPollingInterval = setInterval(pollNiconicoComments, 1000);
}

function stopNiconicoPolling() {
    if (niconicoPollingInterval) {
        clearInterval(niconicoPollingInterval);
        niconicoPollingInterval = null;
        console.log("[Niconico] Stopped comment polling");
    }
}

// --- Manual input handlers ----------------------------------------------------
const openManualDialog = (site) => {
    dialogTargetSite = site;
    if (manualDialogTitle) manualDialogTitle.textContent = t("manual_dialog_title");
    if (manualUrlHint) manualUrlHint.textContent = t("manual_dialog_hint");
    if (manualUrlError) manualUrlError.textContent = "";
    if (manualUrlInput) manualUrlInput.value = "";

    if (manualUrlDialog && typeof manualUrlDialog.showModal === "function") {
        manualUrlDialog.showModal();
    } else {
        const fallback = prompt(t("manual_dialog_prompt"));
        if (fallback) handleManualSubmit(site, fallback);
    }
};

const handleManualSubmit = (site, rawValue) => {
    const value = rawValue?.trim();
    const parser = site === "youtube" ? extractYoutubeVideoId : extractNiconicoLiveId;
    const parsed = parser(value);
    if (!parsed) {
        if (manualUrlError) manualUrlError.textContent = t("manual_input_invalid");
        return false;
    }

    if (site === "youtube") {
        saveManualSelection("youtube", parsed);
        setYoutubeBroadcast(parsed, "manual");
    } else {
        saveManualSelection("niconico", parsed);
        setNiconicoBroadcast(parsed, "manual");
    }
    return true;
};

if (manualUrlForm) {
    manualUrlForm.addEventListener("submit", (event) => {
        event.preventDefault();
        if (!dialogTargetSite) return;
        const ok = handleManualSubmit(dialogTargetSite, manualUrlInput?.value ?? "");
        if (ok && manualUrlDialog?.open) {
            manualUrlDialog.close("submit");
        }
    });
}

manualUrlDialog?.addEventListener("close", () => {
    dialogTargetSite = null;
    if (manualUrlError) manualUrlError.textContent = "";
});

manualUrlCancelButton?.addEventListener("click", () => {
    if (manualUrlDialog?.open) {
        manualUrlDialog.close("cancel");
    }
});

youtubeManualInputLink?.addEventListener("click", (e) => {
    e.preventDefault();
    openManualDialog("youtube");
});
niconicoManualInputLink?.addEventListener("click", (e) => {
    e.preventDefault();
    openManualDialog("niconico");
});

youtubeManualClearButton?.addEventListener("click", () => {
    clearManualSelection("youtube");
    if (youtubeBroadcastSource === "manual") {
        setYoutubeBroadcast(null, null);
        stopYoutubePolling();
    }
});
niconicoManualClearButton?.addEventListener("click", () => {
    clearManualSelection("niconico");
    if (niconicoBroadcastSource === "manual") {
        setNiconicoBroadcast(null, null);
    }
});

// Connect button for YouTube (if present)
if (connectYoutubeCommentButton) {
    connectYoutubeCommentButton.addEventListener("click", () => {
        if (youtubePollingInterval) {
            stopYoutubePolling();
            connectYoutubeCommentButton.textContent = t("btn_connect");
        } else {
            startYoutubePolling();
            connectYoutubeCommentButton.textContent = t("btn_connected");
        }
    });
}

// Kick off detection on page load
checkYoutubeBroadcast();
checkNiconicoBroadcast();
