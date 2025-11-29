import { Hono } from "hono";
import { serveStatic } from "hono/deno";
import { createApiRouter } from "./routes/api.ts";
import { OverlayHub } from "./websocket/overlayHub.ts";
import { RequestService } from "./services/requestService.ts";
import { DownloadWorker } from "./services/downloadWorker.ts";
import { loadServerSettings } from "./settings.ts";
import { bootstrapEnvironment } from "./bootstrap.ts";
import { initRuleState } from "./services/ruleService.ts";
import { NotificationService } from "./services/notificationService.ts";
import { getRules } from "./services/ruleService.ts";
import { TokenStore } from "./services/tokenStore.ts";
import { YouTubeService } from "./services/youtubeService.ts";
import { YouTubeCommentPoller } from "./services/youtubeCommentPoller.ts";
import { NiconicoService } from "./services/niconicoService.ts";
import { getBrowserCookiesForDomains, getBrowserCookies, cookiesToHeader, cleanupOldTempFiles } from "./services/cookieExtractor.ts";
import { join } from "@std/path/join";
import { PROJECT_ROOT } from "./settings.ts";
import { extname } from "@std/path/extname";
import { contentType } from "@std/media-types";
import { ensureStockDir, ensureDefaultStockFile } from "./services/stockService.ts";

const settings = loadServerSettings();
console.info(`[server] Loaded settings: ytDlpPath=${settings.ytDlpPath}, ytDlpCookiesFromBrowser=${settings.ytDlpCookiesFromBrowser ?? "(none)"}, youtubeCookiesFrom=${settings.youtubeCookiesFrom ?? "(none)"}, niconicoCookiesFrom=${settings.niconicoCookiesFrom ?? "(none)"}`);
console.info(`[server] PROJECT_ROOT: ${PROJECT_ROOT}`);
console.info(`[server] dirs: bin=${join(PROJECT_ROOT, "bin")}, config=${join(PROJECT_ROOT, "config")}, db=${join(PROJECT_ROOT, "db", "app.sqlite")}`);
await bootstrapEnvironment(settings);
await cleanupOldTempFiles(); // Clean up leftovers from previous runs
initRuleState();
ensureStockDir();
ensureDefaultStockFile();
// Sync notification settings from rules.json if present
try {
  const ruleSnapshot = getRules();
  settings.notifyTelopEnabled = ruleSnapshot.notifyTelopEnabled ?? settings.notifyTelopEnabled;
  settings.notifyTelopNiconico = ruleSnapshot.notifyTelopNiconico ?? settings.notifyTelopNiconico;
  settings.notifyTelopYoutube = ruleSnapshot.notifyTelopYoutube ?? settings.notifyTelopYoutube;
  settings.notifyTelopDelayMs = ruleSnapshot.notifyTelopDelayMs ?? settings.notifyTelopDelayMs;
} catch (err) {
  console.warn("[server] failed to sync notification settings from rules.json", err);
}
const resolvedLocale = (() => {
  const envLocale = Deno.env.get("BOTNAMA_LOCALE");
  if (envLocale && envLocale.trim().length > 0) return envLocale.trim();
  if (settings.locale && settings.locale !== "auto") return settings.locale;
  return "auto";
})();

const tokenStore = new TokenStore(settings.cacheDir);
const youtubeService = new YouTubeService({}, tokenStore);
const niconicoService = new NiconicoService({}, tokenStore);
const overlayHub = new OverlayHub();
const requestService = new RequestService(overlayHub, { cacheDir: settings.cacheDir });
const notificationService = new NotificationService(settings, niconicoService, youtubeService);
const youtubeCommentPoller = new YouTubeCommentPoller(youtubeService, { activeIntervalMs: 2000, idleIntervalMs: 5000, initialDelayMs: 3000 });

const logAuthStatus = async () => {
  const formatTs = (ts: number | null) =>
    ts ? new Date(ts).toISOString() : "never";
  // If both services use the same browser cookie source & profile, try to extract both domains' cookies in a single yt-dlp invocation.
  try {
    const settings = loadServerSettings();
    const ytFrom = settings.youtubeCookiesFrom ?? "";
    const niFrom = settings.niconicoCookiesFrom ?? "";
    const ytProfile = settings.youtubeCookiesProfile ?? undefined;
    const niProfile = settings.niconicoCookiesProfile ?? undefined;
    let ytOk = false;
    let niOk = false;
    // Extract cookies individually per-domain (no batch multi-target invocation).
    if (ytFrom || niFrom) {
      const fetchPromises: Array<Promise<void>> = [];
      // If both services use the exact same browser & profile, we can attempt a single-spec extraction for both domains.
      if (ytFrom && niFrom && ytFrom === niFrom && (ytProfile ?? "") === (niProfile ?? "")) {
        try {
          console.debug("[server] Attempting single-spec cookie extraction for both YouTube and Niconico");
          const res = await getBrowserCookiesForDomains(ytFrom, ["nicovideo.jp", "youtube.com"], ytProfile);
          const ytCookies = res["youtube.com"] ?? [];
          const niCookies = res["nicovideo.jp"] ?? [];
          if (ytCookies.length > 0) {
            youtubeService.setCachedCookieHeader(cookiesToHeader(ytCookies));
            ytOk = true;
            console.debug(`[server] set YouTube cached cookie header length=${(cookiesToHeader(ytCookies) || "").length}`);
          }
          if (niCookies.length > 0) {
            niconicoService.setCachedCookieHeader(cookiesToHeader(niCookies));
            niOk = true;
            console.debug(`[server] set Niconico cached cookie header length=${(cookiesToHeader(niCookies) || "").length}`);
          }
        } catch (err) {
          console.warn("[server] single-spec extraction failed; falling back to individual extractions", err);
        }
      }
      // fallback to per-domain extraction for services that were not set/failed above
      if (!ytOk && ytFrom) {
        fetchPromises.push((async () => {
          try {
            const cookies = await getBrowserCookies(ytFrom, "youtube.com", ytProfile);
            if (cookies.length > 0) {
              youtubeService.setCachedCookieHeader(cookiesToHeader(cookies));
              ytOk = true;
              console.debug(`[server] set YouTube cached cookie header length=${cookiesToHeader(cookies).length}`);
            } else {
              ytOk = false;
            }
          } catch (err) {
            ytOk = false;
            console.warn("[server] Failed to fetch YouTube cookies:", err);
          }
        })());
      }
      if (!niOk && niFrom) {
        fetchPromises.push((async () => {
          try {
            const cookies = await getBrowserCookies(niFrom, "nicovideo.jp", niProfile);
            if (cookies.length > 0) {
              niconicoService.setCachedCookieHeader(cookiesToHeader(cookies));
              niOk = true;
              console.debug(`[server] set Niconico cached cookie header length=${cookiesToHeader(cookies).length}`);
            } else {
              niOk = false;
            }
          } catch (err) {
            niOk = false;
            console.warn("[server] Failed to fetch Niconico cookies:", err);
          }
        })());
      }
      await Promise.all(fetchPromises);
    } else {
      // fallback: run separate checks
      try {
        ytOk = await youtubeService.isAuthenticated(true);
      } catch (err) {
        console.warn("[auth] YouTube cookie auth error:", err);
      }
      try {
        niOk = await niconicoService.isAuthenticated(true);
      } catch (err) {
        console.warn("[auth] Niconico cookie auth error:", err);
      }
    }
    console.log(
      `[auth] YouTube cookie auth: ${ytOk ? "OK" : "NG"} (last: ${formatTs(youtubeService.getLastCookieFetchedAt())})`,
    );
    console.log(
      `[auth] Niconico cookie auth: ${niOk ? "OK" : "NG"} (last: ${formatTs(niconicoService.getLastCookieFetchedAt())})`,
    );
  } catch (err) {
    console.warn("[auth] cookie auth error:", err);
  }
};
// Start initial authentication & cookie checks in the background so the server can start immediately.
logAuthStatus().catch((err) => console.warn("[auth] initial check failed (background):", err));

overlayHub.setHandlers({
  onEnded: (message) => {
    if (message.type === "ended") {
      requestService.handleOverlayEnded(message.requestId);
    }
  },
  onError: (message) => {
    if (message.type === "error") {
      requestService.handleOverlayError(message.requestId, message.reason);
    }
  },
});

const downloadWorker = new DownloadWorker();
downloadWorker.start();

// Start YouTubeCommentPoller immediately; it will delay first tick via initialDelayMs
// and will automatically detect broadcasts in its tick loop.
youtubeCommentPoller.start();

const autoplayIntervalMs = 3000;
const autoplayTick = () => {
  try {
    requestService.playNextReady();
  } catch (err) {
    console.error("autoplay tick failed", err);
  }
};
autoplayTick();
setInterval(autoplayTick, autoplayIntervalMs);

const app = new Hono();
const api = createApiRouter(requestService, settings, {
  youtubeService,
  niconicoService,
  tokenStore,
  notificationService,
  youtubeCommentPoller,
});

app.route("/api", api);

app.get("/", (c) => c.redirect("/dock/"));

app.get("/ws/overlay", (c) => {
  const { response, socket } = Deno.upgradeWebSocket(c.req.raw);
  overlayHub.register(socket);
  return response;
});

app.get("/healthz", () => new Response("ok"));

app.get("/dock", (c) => c.redirect("/dock/"));
const PUBLIC_ROOT = join(PROJECT_ROOT, "public");

async function tryReadPublicFile(relPath: string) {
  // Try disk path first
  try {
    const filePath = join(PUBLIC_ROOT, relPath);
    const stat = await Deno.stat(filePath);
    if (stat.isFile) {
      return await Deno.readFile(filePath);
    }
  } catch (_err) {
    // ignore
  }
  // Try embedded asset via URL
  try {
    const url = new URL(`../public/${relPath}`, import.meta.url);
    return await Deno.readFile(url);
  } catch (_err) {
    return null;
  }
}

function servePublicFileResponse(bytes: Uint8Array | null, fileName: string | null) {
  if (!bytes) return new Response(null, { status: 404 });
  const headers = new Headers({ 'cache-control': 'no-cache', 'content-type': guessMediaMime(fileName ?? '') });
  return new Response(bytes, { headers });
}

app.get("/dock/", async (c) => servePublicFileResponse(await tryReadPublicFile("dock/index.html"), "dock/index.html"));
app.get("/overlay/", async (c) => servePublicFileResponse(await tryReadPublicFile("overlay/index.html"), "overlay/index.html"));
app.get("/overlay", (c) => c.redirect("/overlay/"));
app.get("/overlay-info/", async (c) => servePublicFileResponse(await tryReadPublicFile("overlay-info/index.html"), "overlay-info/index.html"));
app.get("/overlay-info", (c) => c.redirect("/overlay-info/"));
app.get(
  "/favicon.ico",
  async (c) =>
    // Prefer icons/boicon.ico if present, fallback to favicon.ico
    servePublicFileResponse(
      (await tryReadPublicFile("icons/boicon.ico")) ?? (await tryReadPublicFile("favicon.ico")),
      "favicon.ico",
    ),
);
app.use("/dock/*", async (c, next) => {
  const rel = c.req.path.replace(/^(\/dock\/)/, "");
  const bytes = await tryReadPublicFile(join("dock", rel));
  if (bytes) return servePublicFileResponse(bytes, rel);
  return next();
});
app.use("/overlay/*", async (c, next) => {
  const rel = c.req.path.replace(/^(\/overlay\/)/, "");
  const bytes = await tryReadPublicFile(join("overlay", rel));
  if (bytes) return servePublicFileResponse(bytes, rel);
  return next();
});
app.use("/overlay-info/*", async (c, next) => {
  const rel = c.req.path.replace(/^(\/overlay-info\/)/, "");
  const bytes = await tryReadPublicFile(join("overlay-info", rel));
  if (bytes) return servePublicFileResponse(bytes, rel);
  return next();
});
app.get("/i18n.js", async (c) => servePublicFileResponse(await tryReadPublicFile("i18n.js"), "i18n.js"));
app.use("/icons/*", async (c, next) => {
  const rel = c.req.path.replace(/^(\/icons\/)/, "");
  const bytes = await tryReadPublicFile(join("icons", rel));
  if (bytes) return servePublicFileResponse(bytes, rel);
  return next();
});
app.use("/vendor/*", async (c, next) => {
  const rel = c.req.path.replace(/^(\/vendor\/)/, "");
  const bytes = await tryReadPublicFile(join("vendor", rel));
  if (bytes) return servePublicFileResponse(bytes, rel);
  return next();
});
app.use("/static/*", async (c, next) => {
  const rel = c.req.path.replace(/^(\/static\/)/, "");
  const bytes = await tryReadPublicFile(join("static", rel));
  if (bytes) return servePublicFileResponse(bytes, rel);
  return next();
});

app.get("/api/locale", () =>
  new Response(JSON.stringify({ locale: resolvedLocale }), {
    headers: { "content-type": "application/json" },
  }));

app.get("/media/:file", async (c) => {
  const fileName = c.req.param("file");
  if (fileName.includes("..") || fileName.includes("/") || fileName.includes("\\")) {
    return c.json({ error: "invalid path" }, 400);
  }
  const settings = loadServerSettings();
  const filePath = join(settings.cacheDir, fileName);
  try {
    const stat = await Deno.stat(filePath);
    if (!stat.isFile) {
      return c.json({ error: "media not found" }, 404);
    }
    const rangeHeader = c.req.header("range");
    const file = await Deno.open(filePath, { read: true });
    const fileSize = stat.size;
    const headers = new Headers({
      "cache-control": "no-store",
      "accept-ranges": "bytes",
      "content-type": guessMediaMime(fileName),
    });
    if (rangeHeader) {
      const sanitized = rangeHeader.replace(/\s+/g, "");
      const match = /^bytes=(\d*)-(\d*)$/i.exec(sanitized);
      if (!match) {
        file.close();
        return new Response(null, {
          status: 416,
          headers: new Headers({ "content-range": `bytes */${fileSize}` }),
        });
      }
      const startByte = match[1] ? Number(match[1]) : 0;
      const endByte = match[2] ? Number(match[2]) : fileSize - 1;
      if (
        Number.isNaN(startByte) || Number.isNaN(endByte) || startByte > endByte ||
        endByte >= fileSize
      ) {
        file.close();
        return new Response(null, {
          status: 416,
          headers: new Headers({ "content-range": `bytes */${fileSize}` }),
        });
      }
      await file.seek(startByte, Deno.SeekMode.Start);
      headers.set("content-length", `${endByte - startByte + 1}`);
      headers.set("content-range", `bytes ${startByte}-${endByte}/${fileSize}`);
      let remaining = endByte - startByte + 1;
      const stream = new ReadableStream({
        async pull(controller) {
          if (remaining <= 0) {
            controller.close();
            file.close();
            return;
          }
          const chunk = new Uint8Array(Math.min(64 * 1024, remaining));
          const readBytes = await file.read(chunk);
          if (readBytes === null) {
            controller.close();
            file.close();
            return;
          }
          remaining -= readBytes;
          controller.enqueue(chunk.subarray(0, readBytes));
          if (remaining <= 0) {
            controller.close();
            file.close();
          }
        },
        cancel: () => {
          file.close();
        },
      });
      return new Response(stream, { status: 206, headers });
    }
    headers.set("content-length", `${fileSize}`);
    return new Response(file.readable, { headers });
  } catch (_err) {
    return c.json({ error: "media not found" }, 404);
  }
});

console.log(`Listening on http://localhost:${settings.httpPort}`);

const cleanupAndExit = async () => {
  console.log("\n[server] Shutting down...");
  await cleanupOldTempFiles();
  Deno.exit(0);
};

try {
  Deno.addSignalListener("SIGINT", cleanupAndExit);
} catch (e) {
  console.warn("[server] Failed to add SIGINT listener:", e);
}

if (Deno.build.os !== "windows") {
  try {
    Deno.addSignalListener("SIGTERM", cleanupAndExit);
  } catch (e) {
    console.debug("[server] Failed to add SIGTERM listener:", e);
  }
}

Deno.serve({ port: settings.httpPort }, (req) => app.fetch(req));

function guessMediaMime(fileName: string) {
  const lower = fileName.toLowerCase();
  if (lower.includes(".faudio") && lower.endsWith(".mp4")) return "audio/mp4";
  if (lower.includes(".fvideo") && lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".m4a")) return "audio/mp4";
  if (lower.endsWith(".aac")) return "audio/aac";
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  return contentType(extname(fileName).toLowerCase()) ?? "application/octet-stream";
}





