import {
  ALL_FORMATS,
  AudioBufferSink,
  CanvasSink,
  Input,
  UrlSource,
} from "../vendor/mediabunny/dist/bundles/mediabunny.min.mjs";

const canvas = document.getElementById("overlayCanvas");
const statusEl = document.getElementById("overlayStatus");
const ctx = canvas?.getContext("2d", { alpha: true });

if (!canvas || !ctx) {
  throw new Error("canvas element is required");
}

const log = (...args) => console.log("[Overlay]", ...args);

let socket;
let currentRequestId = null;
let targetVolume = 1;
let loopPlayback = false;
let pendingGestureHandler = null;
let audioSampleRate = null;

let audioContext = null;
let gainNode = null;

let activeInputs = [];
let videoSink = null;
let audioSink = null;
let videoIterator = null;
let audioIterator = null;
let nextFrame = null;
let iterToken = 0;
const queuedAudioNodes = new Set();

let playbackTimeAtStart = 0;
let audioContextStartTime = 0;
let playing = false;
let totalDuration = 0;
let endedReported = false;
let audioFinished = false;
let videoFinished = false;
let thumbnailUrl = null;
let thumbnailImage = null;

let audioLoopPromise = null;
let stopToken = 0;

const resizeCanvas = () => {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(window.innerWidth * dpr));
  canvas.height = Math.max(1, Math.round(window.innerHeight * dpr));
  canvas.style.width = "100vw";
  canvas.style.height = "100vh";
};
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

const clampVolume = (value) => {
  if (typeof value !== "number" || Number.isNaN(value)) return 1;
  return Math.max(0, Math.min(1, value));
};

const setStatus = (message, level = "info") => {
  if (!statusEl) return;
  if (!message) {
    statusEl.textContent = "";
    statusEl.setAttribute("data-level", "info");
    statusEl.hidden = true;
    return;
  }
  statusEl.hidden = false;
  statusEl.textContent = message;
  statusEl.setAttribute("data-level", level);
};

const clearStatus = () => setStatus("");

const connect = () => {
  const protocol = location.protocol === "https:" ? "wss" : "ws";
  socket = new WebSocket(`${protocol}://${location.host}/ws/overlay`);
  socket.addEventListener("open", () => log("socket connected"));
  socket.addEventListener("message", (event) => {
    try {
      const data = JSON.parse(event.data);
      handleMessage(data);
    } catch (err) {
      console.error("[Overlay] invalid message", err);
    }
  });
  socket.addEventListener("close", () => {
    log("socket closed, retrying in 2s");
    setTimeout(connect, 2000);
  });
};

const handleMessage = async (message) => {
  switch (message.type) {
    case "play":
      await playMedia(message);
      break;
    case "stop":
      await stopPlayback(message.fadeMs ?? 0);
      break;
    case "pause":
      pausePlayback();
      break;
    case "resume":
      await resumePlayback();
      break;
    case "seek":
      await seekPlayback(message.positionSec);
      break;
  }
};

const playMedia = async ({ url, requestId, volume = 1, loop = false }) => {
  ++stopToken;
  try {
    await disposePlayback();
    clearStatus();
    loopPlayback = Boolean(loop);
    targetVolume = clampVolume(volume);
    currentRequestId = requestId;
    endedReported = false;

    const entries = await resolveMediaEntries(url);
    await loadInputs(entries);

    await ensureAudioContext(audioSampleRate);
    applyVolume(targetVolume, true);

    playbackTimeAtStart = 0;
    await startDecodersAt(0);

    log(`play request ${requestId} -> ${url}`);
  } catch (err) {
    console.error("[Overlay] failed to start playback", err);
    failWithError(err);
  }
};

const resolveMediaEntries = async (url) => {
  const absoluteUrl = new URL(url, location.origin).href;
  if (!absoluteUrl.toLowerCase().endsWith(".json")) {
    return [{ kind: "container", url: absoluteUrl }];
  }
  const response = await fetch(absoluteUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to fetch media manifest (${response.status})`);
  }
  const manifest = await response.json();
  if (!manifest || manifest.version !== 1 || !Array.isArray(manifest.entries) || manifest.entries.length === 0) {
    throw new Error("Invalid media manifest format");
  }
  const entries = manifest.entries
    .filter((entry) => {
      // skip malformed entries
      if (!entry || typeof entry.file !== "string") return false;
      // ignore yt-dlp info json files — they are metadata, not playable media
      if (entry.file.toLowerCase().endsWith(".info.json")) return false;
      // defensive: ignore json entries in general
      if ((entry.mimeType || "").toLowerCase().includes("application/json")) return false;
      return true;
    })
    .map((entry) => {
      const filePath = new URL(`/media/${entry.file}`, location.origin).href;
      const kind = entry.kind === "audio" ? "audio" : entry.kind === "video" ? "video" : "container";
      return { kind, url: filePath };
    });
  // if manifest contains top-level thumbnail and there is no video entry,
  // expose it as an image entry so overlay can display it for audio-only files
  // if the manifest has a thumbnail and (after filtering) there are no video tracks,
  // expose the thumbnail as an image entry so overlay can display it for audio-only files
  if (manifest.thumbnail && !entries.some((e) => e.kind === "video")) {
    const thumbPath = new URL(`/media/${manifest.thumbnail}`, location.origin).href;
    entries.unshift({ kind: "image", url: thumbPath });
  }
  return entries;
};

const loadInputs = async (entries) => {
  activeInputs = [];
  videoSink = null;
  audioSink = null;
  thumbnailUrl = null;
  thumbnailImage = null;
  audioSampleRate = null;
  audioFinished = false;
  videoFinished = false;

  let videoTrack = null;
  let audioTrack = null;

  thumbnailUrl = null;
  thumbnailImage = null;
  for (const entry of entries) {
    // image (thumbnail) is handled separately — not via mediabunny Input
    if (entry.kind === "image") {
      thumbnailUrl = entry.url;
      continue;
    }
    const input = new Input({ source: new UrlSource(entry.url), formats: ALL_FORMATS });
    activeInputs.push(input);

    if (!videoTrack) {
      const track = await input.getPrimaryVideoTrack();
      if (track && await track.canDecode()) {
        videoTrack = track;
      }
    }
    if (!audioTrack) {
      const track = await input.getPrimaryAudioTrack();
      if (track && await track.canDecode()) {
        audioTrack = track;
      }
    }
  }

  if (!videoTrack && !audioTrack) {
    throw new Error("No playable audio or video tracks were found");
  }

  const referenceTrack = videoTrack ?? audioTrack;
  try {
    totalDuration = referenceTrack ? await referenceTrack.computeDuration() : 0;
  } catch (_err) {
    totalDuration = 0;
  }

  audioSampleRate = audioTrack ? audioTrack.sampleRate : null;

  if (videoTrack) {
    const transparent = await videoTrack.canBeTransparent().catch(() => false);
    videoSink = new CanvasSink(videoTrack, {
      poolSize: 2,
      fit: "contain",
      alpha: transparent,
    });
  }

  if (audioTrack) {
    audioSink = new AudioBufferSink(audioTrack);
  }
};

const ensureAudioContext = async (sampleRate) => {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    throw new Error("Failed to initialize AudioContext");
  }
  if (!audioContext || (sampleRate && Math.abs(audioContext.sampleRate - sampleRate) > 1)) {
    if (audioContext) {
      try {
        await audioContext.close();
      } catch (_err) {
        // ignore
      }
    }
    audioContext = new AudioContextClass(sampleRate ? { sampleRate } : undefined);
    gainNode = audioContext.createGain();
    gainNode.connect(audioContext.destination);
  } else if (!gainNode) {
    gainNode = audioContext.createGain();
    gainNode.connect(audioContext.destination);
  }
};

const resumeAudioContextIfNeeded = async () => {
  if (!audioContext) return true;
  if (audioContext.state === "running") return true;
  try {
    await audioContext.resume();
    return true;
  } catch (err) {
    if (err?.name === "NotAllowedError") {
      waitForUserGesture();
      return false;
    }
    throw err;
  }
};

const startDecodersAt = async (positionSec) => {
  playbackTimeAtStart = Math.max(0, typeof positionSec === "number" ? positionSec : 0);
  const resumed = await resumeAudioContextIfNeeded();
  if (!resumed) {
    setStatus("Click to enable audio", "warn");
    playing = false;
    return;
  }

  playing = true;
  audioContextStartTime = audioContext ? audioContext.currentTime : 0;
  iterToken++;
  nextFrame = null;
  audioFinished = !audioSink;
  videoFinished = !videoSink;

  if (videoSink) {
    try {
      await videoIterator?.return();
    } catch (_err) {
      // ignore
    }
    videoIterator = videoSink.canvases(playbackTimeAtStart);
    const first = (await videoIterator.next()).value ?? null;
    const second = (await videoIterator.next()).value ?? null;
    if (first) {
      drawFrame(first);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    nextFrame = second;
    void updateNextFrame(iterToken);
  } else {
    // no video track. if we have a thumbnail, draw it now and keep it visible
    if (thumbnailUrl) {
      try {
        thumbnailImage = new Image();
        // ensure CORS allowed for local media served by the app
        thumbnailImage.crossOrigin = "anonymous";
        await new Promise((resolve, reject) => {
          thumbnailImage.onload = resolve;
          thumbnailImage.onerror = reject;
          thumbnailImage.src = thumbnailUrl;
        });
        // draw image sized to contain
        const fitted = fitToContain(thumbnailImage.naturalWidth, thumbnailImage.naturalHeight, canvas.width, canvas.height);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(thumbnailImage, fitted.x, fitted.y, fitted.width, fitted.height);
      } catch (err) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  if (audioSink) {
    try {
      await audioIterator?.return();
    } catch (_err) {
      // ignore
    }
    audioIterator = audioSink.buffers(playbackTimeAtStart);
    audioLoopPromise = runAudioIterator(iterToken);
  }
};

const updateNextFrame = async (token) => {
  if (!videoIterator) return;
  try {
    while (true) {
      const result = await videoIterator.next();
      if (token !== iterToken) return;
      const frame = result.value ?? null;
      if (!frame) {
        if (result.done) {
          videoFinished = true;
          maybeHandleCompletion();
        }
        return;
      }
      if (frame.timestamp <= getPlaybackTime()) {
        drawFrame(frame);
        continue;
      }
      nextFrame = frame;
      return;
    }
  } catch (err) {
    console.error("[Overlay] video iterator failed", err);
    failWithError(err);
  }
};

const runAudioIterator = async (token) => {
  if (!audioIterator || !audioContext || !gainNode) return;
  try {
    for await (const { buffer, timestamp } of audioIterator) {
      if (token !== iterToken) return;
      const node = audioContext.createBufferSource();
      node.buffer = buffer;
      node.connect(gainNode);
      const startTimestamp = audioContextStartTime + timestamp - playbackTimeAtStart;
      const now = audioContext.currentTime;
      if (startTimestamp >= now) {
        node.start(startTimestamp);
      } else {
        node.start(now, Math.max(0, now - startTimestamp));
      }
      queuedAudioNodes.add(node);
      node.onended = () => queuedAudioNodes.delete(node);
      if (timestamp - getPlaybackTime() >= 1) {
        await new Promise((resolve) => {
          const interval = setInterval(() => {
            if (timestamp - getPlaybackTime() < 1 || token !== iterToken) {
              clearInterval(interval);
              resolve();
            }
          }, 100);
        });
      }
    }
    if (token === iterToken) {
      audioFinished = true;
      maybeHandleCompletion();
    }
  } catch (err) {
    if (token === iterToken) {
      console.error("[Overlay] audio iterator failed", err);
      failWithError(err);
    }
  }
};

const drawFrame = (frame) => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const fitted = fitToContain(
    frame.canvas.width,
    frame.canvas.height,
    canvas.width,
    canvas.height,
  );
  ctx.drawImage(frame.canvas, fitted.x, fitted.y, fitted.width, fitted.height);
};

const fitToContain = (contentWidth, contentHeight, containerWidth, containerHeight) => {
  if (!contentWidth || !contentHeight || !containerWidth || !containerHeight) {
    return { x: 0, y: 0, width: containerWidth, height: containerHeight };
  }
  const contentRatio = contentWidth / contentHeight;
  const containerRatio = containerWidth / containerHeight;
  let width;
  let height;
  if (containerRatio > contentRatio) {
    height = containerHeight;
    width = height * contentRatio;
  } else {
    width = containerWidth;
    height = width / contentRatio;
  }
  return {
    x: (containerWidth - width) / 2,
    y: (containerHeight - height) / 2,
    width,
    height,
  };
};

const getPlaybackTime = () => {
  if (!playing || !audioContext) {
    return playbackTimeAtStart;
  }
  return audioContext.currentTime - audioContextStartTime + playbackTimeAtStart;
};

const pausePlayback = () => {
  if (!playing) return;
  playbackTimeAtStart = getPlaybackTime();
  playing = false;
  iterToken++;
  try {
    void audioIterator?.return();
    void videoIterator?.return();
  } catch (_err) {
    // ignore
  }
  audioIterator = null;
  videoIterator = null;
  queuedAudioNodes.forEach((node) => {
    try {
      node.stop();
    } catch (_err) {
      // ignore
    }
  });
  queuedAudioNodes.clear();
};

const resumePlayback = async () => {
  if (!audioContext) return;
  await startDecodersAt(playbackTimeAtStart);
};

const seekPlayback = async (positionSec) => {
  if (typeof positionSec !== "number" || Number.isNaN(positionSec)) return;
  const clamped = totalDuration ? Math.max(0, Math.min(totalDuration, positionSec)) : Math.max(0, positionSec);
  playbackTimeAtStart = clamped;
  await startDecodersAt(clamped);
};

const stopPlayback = async (_fadeMs) => {
  const token = ++stopToken;
  await disposePlayback();
  finalizeStop(token);
};

const finalizeStop = (token) => {
  if (token !== stopToken) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  currentRequestId = null;
  clearStatus();
};

const disposePlayback = async () => {
  iterToken++;
  playing = false;
  nextFrame = null;
  audioFinished = false;
  videoFinished = false;
  if (audioIterator) {
    try {
      await audioIterator.return();
    } catch (_err) {
      // ignore
    }
    audioIterator = null;
  }
  if (videoIterator) {
    try {
      await videoIterator.return();
    } catch (_err) {
      // ignore
    }
    videoIterator = null;
  }
  queuedAudioNodes.forEach((node) => {
    try {
      node.stop();
    } catch (_err) {
      // ignore
    }
  });
  queuedAudioNodes.clear();
  if (audioLoopPromise) {
    audioLoopPromise = null;
  }
  videoSink = null;
  audioSink = null;
  for (const input of activeInputs) {
    try {
      input.dispose();
    } catch (_err) {
      // ignore
    }
  }
  activeInputs = [];
};

const maybeHandleCompletion = () => {
  const audioDone = !audioSink || audioFinished;
  const videoDone = !videoSink || videoFinished;
  if (!audioDone || !videoDone) {
    return;
  }
  if (loopPlayback) {
    void startDecodersAt(0);
    return;
  }
  if (!endedReported && currentRequestId) {
    endedReported = true;
    sendEnded();
  }
};

const applyVolume = (value, immediate = false) => {
  targetVolume = clampVolume(value);
  if (!gainNode || !audioContext) return;
  const now = audioContext.currentTime;
  gainNode.gain.cancelScheduledValues(now);
  if (immediate) {
    gainNode.gain.setValueAtTime(targetVolume, now);
  } else {
    gainNode.gain.setValueAtTime(gainNode.gain.value, now);
    gainNode.gain.linearRampToValueAtTime(targetVolume, now + 0.1);
  }
};

const sendEnded = () => {
  if (currentRequestId && socket?.readyState === WebSocket.OPEN) {
    log(`ended ${currentRequestId}`);
    socket.send(JSON.stringify({ type: "ended", requestId: currentRequestId }));
  }
};

const sendError = (reason) => {
  if (currentRequestId && socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: "error", requestId: currentRequestId, reason }));
  }
};

const failWithError = (err) => {
  ++stopToken;
  setStatus(err?.message ?? "Playback failed", "error");
  sendError(err?.message ?? "playback failed");
  currentRequestId = null;
  void disposePlayback();
};

const waitForUserGesture = () => {
  if (pendingGestureHandler) return;
  const handler = async () => {
    document.removeEventListener("pointerdown", handler);
    pendingGestureHandler = null;
    clearStatus();
    try {
      await resumePlayback();
    } catch (err) {
      console.error("[Overlay] resume after gesture failed", err);
      failWithError(err);
    }
  };
  pendingGestureHandler = handler;
  document.addEventListener("pointerdown", handler, { once: true });
};

const renderLoop = () => {
  if (nextFrame && nextFrame.timestamp <= getPlaybackTime()) {
    drawFrame(nextFrame);
    nextFrame = null;
    void updateNextFrame(iterToken);
  }
  requestAnimationFrame(renderLoop);
};
renderLoop();

connect();
