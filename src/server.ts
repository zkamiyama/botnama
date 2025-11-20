import { Hono } from "hono";
import { serveStatic } from "hono/deno";
import { createApiRouter } from "./routes/api.ts";
import { OverlayHub } from "./websocket/overlayHub.ts";
import { RequestService } from "./services/requestService.ts";
import { DownloadWorker } from "./services/downloadWorker.ts";
import { loadServerSettings } from "./settings.ts";
import { bootstrapEnvironment } from "./bootstrap.ts";
import { initRuleState } from "./services/ruleService.ts";
import { join } from "@std/path/join";
import { extname } from "@std/path/extname";
import { contentType } from "@std/media-types";

const settings = loadServerSettings();
await bootstrapEnvironment(settings);
initRuleState(settings.maxVideoDurationSec);
const resolvedLocale = (() => {
  const envLocale = Deno.env.get("BOTNAMA_LOCALE");
  if (envLocale && envLocale.trim().length > 0) return envLocale.trim();
  if (settings.locale && settings.locale !== "auto") return settings.locale;
  return "auto";
})();

const overlayHub = new OverlayHub();
const requestService = new RequestService(overlayHub, { cacheDir: settings.cacheDir });
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
const api = createApiRouter(requestService, settings);

app.route("/api", api);

app.get("/", (c) => c.redirect("/dock/"));

app.get("/ws/overlay", (c) => {
  const { response, socket } = Deno.upgradeWebSocket(c.req.raw);
  overlayHub.register(socket);
  return response;
});

app.get("/healthz", () => new Response("ok"));

app.get("/dock", (c) => c.redirect("/dock/"));
app.get("/dock/", serveStatic({ path: "./public/dock/index.html" }));
app.get("/overlay/", serveStatic({ path: "./public/overlay/index.html" }));
app.get("/overlay", (c) => c.redirect("/overlay/"));
app.get("/overlay-info/", serveStatic({ path: "./public/overlay-info/index.html" }));
app.get("/overlay-info", (c) => c.redirect("/overlay-info/"));
app.get("/favicon.ico", serveStatic({ path: "./public/favicon.ico" }));
app.use("/dock/*", serveStatic({ root: "./public" }));
app.use("/overlay/*", serveStatic({ root: "./public" }));
app.use("/overlay-info/*", serveStatic({ root: "./public" }));
app.get("/i18n.js", serveStatic({ path: "./public/i18n.js" }));
app.use(
  "/icons/*",
  serveStatic({
    root: "./public",
    rewriteRequestPath: (path) => path,
  }),
);
app.use("/vendor/*", serveStatic({ root: "./public" }));
app.use("/static/*", serveStatic({ root: "./public" }));

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
