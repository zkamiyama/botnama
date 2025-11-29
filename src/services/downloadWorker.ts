import { ensureDirSync } from "@std/fs/ensure-dir";
import { getEffectiveMaxDurationSec } from "./ruleService.ts";
import { join } from "@std/path/join";
import * as posix from "@std/path/posix";
import { extname } from "@std/path/extname";
// removed fromFileUrl usage - using settings.PROJECT_ROOT instead
import { contentType } from "@std/media-types";
import {
  countByStatus,
  listDownloadableRequests,
  listBuckets,
  updateDownloadMetadata,
  updateStatus,
} from "../repositories/requestsRepository.ts";
import { RequestItem, ServerSettings } from "../types.ts";
import { loadServerSettings } from "../settings.ts";
import { fetchVideoMetadata } from "./metadataService.ts";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const MAX_BASE_LENGTH = 240;

type ManifestEntryKind = "container" | "video" | "audio" | "thumbnail";

interface MediaManifestEntry {
  kind: ManifestEntryKind;
  file: string;
  mimeType: string | null;
}

interface MediaManifest {
  version: 1;
  requestId: string;
  sourceUrl: string;
  createdAt: number;
  thumbnail?: string | null; // file name of downloaded thumbnail if any
  entries: MediaManifestEntry[];
}

interface DownloadArtifact {
  name: string;
  absolutePath: string;
  kind: ManifestEntryKind;
}

interface YtDlpMetadata {
  title: string | null;
  duration: number | null;
  uploader: string | null;
  uploadDate: number | null; // ms epoch
  viewCount: number | null;
  likeCount: number | null;
  dislikeCount: number | null;
  commentCount: number | null;
  mylistCount: number | null;
  favoriteCount: number | null;
  danmakuCount: number | null;
  thumbnail: string | null;
}

interface CacheTargets {
  baseName: string;
  fileName: string;
  absolutePath: string;
  relativePath: string;
}

const sanitizeSegment = (value: string | null | undefined, fallback: string) => {
  if (!value) return fallback;
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (!normalized) return fallback;
  return normalized.slice(0, MAX_BASE_LENGTH);
};

const stableHash = (input: string) => {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
};

const buildHostSegment = (rawUrl: string) => {
  try {
    const url = new URL(rawUrl);
    const parts = url.hostname.split(".").filter((part) => part !== "www");
    if (parts.length > 1) {
      parts.pop(); // drop TLD
    }
    const base = parts.join("-") || url.hostname;
    return sanitizeSegment(base, "media");
  } catch (_err) {
    return "media";
  }
};

const deriveBaseName = (request: RequestItem) => {
  const sourceUrl = request.parsed?.normalizedUrl ?? request.url;
  const hostSegment = buildHostSegment(sourceUrl);
  const uniqueSource = request.parsed?.videoId ?? sourceUrl ?? request.url;
  const uniqueSegment = sanitizeSegment(
    request.parsed?.videoId ?? uniqueSource,
    stableHash(uniqueSource),
  );
  const combined = `${hostSegment}_${uniqueSegment}`;
  return combined.slice(0, MAX_BASE_LENGTH);
};

const toRelativePath = (cacheDir: string, fileName: string) =>
  posix.join(cacheDir.replaceAll("\\", "/"), fileName);

import { PROJECT_ROOT } from "../settings.ts";

export class DownloadWorker {
  #running = false;
  #loopPromise: Promise<void> | null = null;

  start() {
    if (this.#running) return;
    this.#running = true;
    this.#loopPromise = this.#runLoop();
  }

  stop() {
    this.#running = false;
  }

  async #runLoop() {
    while (this.#running) {
      try {
        await this.#tick();
      } catch (err) {
        console.error("download worker tick failed", err);
      }
      await delay(2000);
    }
  }

  async #tick() {
    const settings = loadServerSettings();
    const downloading = countByStatus("DOWNLOADING");
    if (downloading >= settings.maxConcurrentDownloads) {
      console.log(
        `[worker] concurrent downloads (${downloading}) reached limit ${settings.maxConcurrentDownloads}`,
      );
      return;
    }
    const availableSlots = Math.max(1, settings.maxConcurrentDownloads - downloading);
    let remaining = availableSlots;
    const queue = listDownloadableRequests(remaining, "queue");
    await Promise.all(queue.map((req) => this.#processRequest(req, settings)));
    remaining = Math.max(0, remaining - queue.length);
    if (remaining === 0) return;
    const buckets = listBuckets().filter((b) => b !== "queue");
    for (const bucket of buckets) {
      if (remaining <= 0) break;
      const list = listDownloadableRequests(remaining, bucket);
      await Promise.all(list.map((req) => this.#processRequest(req, settings)));
      remaining = Math.max(0, remaining - list.length);
    }
  }

  #prepareCacheTargets(request: RequestItem, settings: ServerSettings): CacheTargets {
    const baseName = deriveBaseName(request);
    const fileName = `${baseName}.media.json`;
    const absolutePath = join(settings.cacheDir, fileName);
    const relativePath = toRelativePath(settings.cacheDir, fileName);
    return { baseName, fileName, absolutePath, relativePath };
  }

  async #processRequest(request: RequestItem, settings: ServerSettings) {
    const targets = this.#prepareCacheTargets(request, settings);
    console.log(`[worker] processing ${request.id} (${request.url}) -> ${targets.fileName}`);
    updateStatus(request.id, "VALIDATING");
    const metadata = await fetchVideoMetadata(request.url, settings);
    if (!metadata) {
      updateStatus(request.id, "FAILED", "metadata fetch failed");
      return;
    }
    const effectiveLimit = getEffectiveMaxDurationSec();
    if (metadata.duration && metadata.duration > effectiveLimit) {
      updateStatus(request.id, "REJECTED", `too long (${metadata.duration}s)`);
      return;
    }
    const fetchedAt = Date.now();
    updateDownloadMetadata(request.id, {
      title: metadata.title ?? null,
      durationSec: metadata.duration ?? null,
      uploader: metadata.uploader,
      uploadedAt: metadata.uploadDate,
      viewCount: metadata.viewCount,
      likeCount: metadata.likeCount,
      dislikeCount: metadata.dislikeCount,
      commentCount: metadata.commentCount,
      mylistCount: metadata.mylistCount,
      favoriteCount: metadata.favoriteCount,
      danmakuCount: metadata.danmakuCount,
      metaRefreshedAt: fetchedAt,
      thumbnailUrl: metadata.thumbnail ?? null,
    });

    if (await this.#fileExists(targets.absolutePath)) {
      console.log(`[worker] cache hit for ${targets.fileName}, skipping download`);
      const manifestMeta = await this.#readManifestMetadata(targets.absolutePath, settings);
      updateDownloadMetadata(request.id, {
        fileName: targets.fileName,
        cacheFilePath: targets.relativePath,
        cacheFileSize: manifestMeta?.totalSize ?? null,
      });
      updateStatus(request.id, "READY");
      return;
    }

    updateStatus(request.id, "DOWNLOADING");
    console.log(`[worker] cache miss for ${targets.fileName}, starting yt-dlp`);
    try {
      await this.#downloadVideo(request, settings, targets);
      const manifestMeta = await this.#readManifestMetadata(targets.absolutePath, settings);
      updateDownloadMetadata(request.id, {
        fileName: targets.fileName,
        cacheFilePath: targets.relativePath,
        cacheFileSize: manifestMeta?.totalSize ?? null,
      });
      updateStatus(request.id, "READY");
    } catch (err) {
      console.error("download pipeline failed", err);
      updateStatus(request.id, "FAILED", err instanceof Error ? err.message : String(err));
    }
  }

  async #downloadVideo(request: RequestItem, settings: ServerSettings, targets: CacheTargets) {
    ensureDirSync(settings.cacheDir);
    const outputTemplate = join(settings.cacheDir, `${targets.baseName}.%(ext)s`);
    // instruct yt-dlp to write info json and thumbnail (if available)
    // default to --no-playlist so passing a watch URL with a `list=` parameter
    // does not trigger downloading the entire playlist (can be very large)
    // Sanitize request URL to avoid accidental playlist expansion from watch URLs
    // e.g. https://www.youtube.com/watch?v=ID&list=...&start_radio=1
    // We keep the original request.url in manifest/database but pass a cleaned
    // URL to yt-dlp so it doesn't auto-follow the playlist context.
    // Prefer the parsed normalized URL (clean canonical form) if available
    const baseForSanitize = request.parsed?.normalizedUrl ?? request.url;
    const sanitizedUrl = (() => {
      try {
        const u = new URL(baseForSanitize);
        const params = u.searchParams;
        // remove usual playlist-like params that cause yt-dlp to process a playlist
        params.delete("list");
        params.delete("start_radio");
        params.delete("pp");
        // write back cleaned params
        u.search = params.toString();
        return u.toString();
      } catch (_err) {
        return baseForSanitize;
      }
    })();

    const cookieArgs = this.#buildCookieArgs(settings);
    const baseArgs = [
      "-o",
      outputTemplate,
      "--no-playlist",
      "--write-info-json",
      "--write-thumbnail",
      "--no-part",
      "--force-overwrites",
      "--no-continue",
      "--concurrent-fragments",
      "4",
      "--fragment-retries",
      "3",
      ...this.#buildFfmpegArgs(settings),
      ...this.#buildUserAgentArgs(settings),
      ...this.#buildProxyArgs(settings, request.parsed?.site ?? "other"),
      ...this.#buildBilibiliHeaders(request),
      sanitizedUrl,
    ];
    const buildArgs = (withCookies: boolean, preferNativeHls: boolean) => {
      // Default to native HLS (yt-dlp's own downloader), fall back to ffmpeg if needed
      // Native is more reliable for some sites like Niconico
      const hlsArg = preferNativeHls ? "--hls-prefer-native" : "--hls-prefer-ffmpeg";
      const core = [
        "-o",
        outputTemplate,
        "--no-playlist",
        "--write-info-json",
        "--write-thumbnail",
        "--no-part",
        "--force-overwrites",
        "--no-continue",
        hlsArg,
        "--concurrent-fragments",
        "4",
        "--fragment-retries",
        "3",
        "--socket-timeout",
        "30",
        ...this.#buildFfmpegArgs(settings),
        ...this.#buildUserAgentArgs(settings),
        ...this.#buildProxyArgs(settings, request.parsed?.site ?? "other"),
        ...this.#buildBilibiliHeaders(request),
        sanitizedUrl,
      ];
      return withCookies ? [...core.slice(0, -1), ...cookieArgs, sanitizedUrl] : core;
    };
    const usedCookies = cookieArgs.length > 0;
    const inheritSetting = Boolean((settings as ServerSettings & { ytDlpInheritStdio?: boolean }).ytDlpInheritStdio);
    // Always inherit stdio - capturing output causes deadlocks with large streams
    const shouldInherit = true;

    const runOnce = async (withCookies: boolean, preferNativeHls: boolean) => {
      const args = buildArgs(withCookies, preferNativeHls);
      // Add --newline to force yt-dlp to output each progress update on a new line
      // This prevents buffering issues when stdout is piped
      args.push("--newline");
      console.log(`[worker] invoking yt-dlp ${settings.ytDlpPath} ${args.join(" ")}`);

      const proc = new Deno.Command(settings.ytDlpPath, {
        args,
        stdin: "null",  // Prevent hang on prompts
        stdout: shouldInherit ? "inherit" : "piped",
        stderr: shouldInherit ? "inherit" : "piped",
      }).spawn();
      const stdout = shouldInherit ? undefined : proc.stdout?.readable?.getReader();
      const stderr = shouldInherit ? undefined : proc.stderr?.readable?.getReader();
      const lastActivity = { ts: Date.now() };
      let stderrText = "";
      let stdoutText = "";
      const stallWatch = (async () => {
        // 300 seconds (5 minutes) timeout - generous for cookie extraction and slow connections
        const STALL_MS = 300_000;
        while (!shouldInherit) {
          await delay(10_000);  // Check every 10 seconds
          if (proc.killed) return;
          const idle = Date.now() - lastActivity.ts;
          if (idle > STALL_MS) {
            console.warn(`[yt-dlp] no output for ${Math.floor(idle / 1000)}s; killing process`);
            try {
              proc.kill("SIGTERM");
              await delay(2000);
              if (!proc.killed) {
                proc.kill("SIGKILL");
              }
            } catch {
              // Process already dead
            }
            return;
          }
        }
      })();

      if (!shouldInherit) {
        const wrapRead = async (
          reader: ReadableStreamDefaultReader<Uint8Array> | undefined,
          tag: string,
          collect: "stderr" | "stdout" | false,
        ) => {
          if (!reader) return;
          // Use streaming decoder to handle multi-byte characters correctly
          const decoder = new TextDecoder("utf-8", { fatal: false });
          try {
            while (true) {
              const { value, done } = await reader.read();
              if (done) break;
              if (value && value.length > 0) {
                lastActivity.ts = Date.now();
                // Use streaming mode to handle partial multi-byte sequences
                const text = decoder.decode(value, { stream: true });
                if (text) {
                  // Log all output, even empty lines, to help debugging
                  console.log(`[yt-dlp:${tag}] ${text}`);
                  if (collect === "stderr") stderrText += text;
                  if (collect === "stdout") stdoutText += text;
                }
              }
            }
            // Flush any remaining bytes
            const final = decoder.decode();
            if (final) {
              console.log(`[yt-dlp:${tag}] ${final}`);
              if (collect === "stderr") stderrText += final;
              if (collect === "stdout") stdoutText += final;
            }
          } catch (_err) {
            // ignore
          }
        };
        await Promise.race([
          Promise.all([
            wrapRead(stdout, "out", "stdout"),
            wrapRead(stderr, "err", "stderr"),
          ]).then(async () => {
            const status = await proc.status;
            return { status, stderrText, stdoutText };
          }),
          stallWatch,
        ]);
      }
      const status = await proc.status;
      return { status, stderrText, stdoutText };
    };

    // 1st try: native HLS (yt-dlp's own), with cookies if available
    let attempt = await runOnce(usedCookies, true);
    if (!attempt.status.success) {
      const errText = attempt.stderrText?.trim() ?? "";
      const outText = attempt.stdoutText?.trim() ?? "";
      const statusCode = attempt.status.code;
      const statusSignal = (attempt.status as Deno.CommandStatus & { signal?: string }).signal ?? "none";
      if (errText) {
        console.error("[worker] yt-dlp stderr:", errText.slice(-2000));
      } else if (outText) {
        console.error("[worker] yt-dlp stdout:", outText.slice(-2000));
      } else {
        console.error("[worker] yt-dlp produced no output (code:", statusCode, "signal:", statusSignal, ")");
      }
      const decodeError =
        usedCookies &&
        /'NoneType' object has no attribute 'decode'/i.test(errText);
      const shouldRetryFfmpeg =
        /Error opening input file.*\.m3u8/i.test(errText) ||
        /Invalid data found when processing input/i.test(errText) ||
        /is not in allowed_segment_extensions/i.test(errText) ||
        (!errText && !outText);
      if (shouldRetryFfmpeg) {
        console.warn("[worker] yt-dlp failed with native HLS; retrying with --hls-prefer-ffmpeg.");
        const ffmpegRetry = await runOnce(usedCookies, false);
        if (!ffmpegRetry.status.success) {
          const ffmpegErr = ffmpegRetry.stderrText?.trim() ?? "";
          const ffmpegOut = ffmpegRetry.stdoutText?.trim() ?? "";
          if (ffmpegErr) console.error("[worker] yt-dlp stderr (ffmpeg):", ffmpegErr.slice(-2000));
          else if (ffmpegOut) console.error("[worker] yt-dlp stdout (ffmpeg):", ffmpegOut.slice(-2000));
          // fall through to cookie decode handling / error throw
          attempt = ffmpegRetry;
        } else {
          attempt = ffmpegRetry;
        }
      }
      if (attempt.status.success) {
        // fallback succeeded, continue to cleanup/manifest
      } else if (decodeError || (usedCookies && !errText && !outText)) {
        console.warn(
          "[worker] yt-dlp failed with cookies (or no output captured). Retrying once without --cookies-from-browser.",
        );
        const retry = await runOnce(false, shouldRetryFfmpeg);
        if (!retry.status.success) {
          const retryErr = retry.stderrText?.trim() ?? "";
          const retryOut = retry.stdoutText?.trim() ?? "";
          if (retryErr) console.error("[worker] yt-dlp stderr (retry):", retryErr.slice(-2000));
          else if (retryOut) console.error("[worker] yt-dlp stdout (retry):", retryOut.slice(-2000));
          throw new Error(`yt-dlp exited with code ${retry.status.code}`);
        }
      } else {
        throw new Error(`yt-dlp exited with code ${attempt.status.code}`);
      }
    }
    await this.#cleanupPartials(targets.baseName, settings.cacheDir);
    await this.#writeManifestFromArtifacts(request, settings, targets);
  }

  async #cleanupPartials(baseName: string, cacheDir: string) {
    // rename *.part -> remove .part, best effort
    for await (const entry of Deno.readDir(cacheDir)) {
      if (!entry.isFile) continue;
      if (!entry.name.startsWith(`${baseName}.`) || !entry.name.toLowerCase().endsWith(".part")) continue;
      const src = join(cacheDir, entry.name);
      const dest = src.replace(/\.part$/i, "");
      try {
        await Deno.rename(src, dest);
      } catch (_err) {
        // ignore
      }
    }
    // delete fragment parts
    for await (const entry of Deno.readDir(cacheDir)) {
      const lower = entry.name.toLowerCase();
      if (entry.isFile && entry.name.startsWith(`${baseName}.`) && lower.includes(".part-frag")) {
        try {
          await Deno.remove(join(cacheDir, entry.name));
        } catch (_err) {
          // ignore
        }
      }
    }
  }

  async #findDownloadArtifacts(cacheDir: string, baseName: string) {
    const artifacts: DownloadArtifact[] = [];
    for await (const entry of Deno.readDir(cacheDir)) {
      if (!entry.isFile || !entry.name.startsWith(`${baseName}.`)) continue;
      // Skip yt-dlp's info json files — they are metadata, not media containers
      // Example: <basename>.info.json
      if (entry.name.toLowerCase().endsWith(".info.json")) continue;
      if (entry.name.endsWith(".media.json")) continue;
      const lower = entry.name.toLowerCase();
      let kind: ManifestEntryKind = "container";
      const lowerName = entry.name.toLowerCase();
      if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg") || lowerName.endsWith(".png") || lowerName.endsWith(".webp") || lowerName.endsWith(".bmp") || lowerName.endsWith(".gif")) {
        kind = "thumbnail" as ManifestEntryKind;
      }
      if (lower.includes(".fvideo") || lower.includes(".video")) {
        kind = "video";
      } else if (
        lower.includes(".faudio") || lower.includes(".audio") ||
        lower.endsWith(".m4a") || lower.endsWith(".aac") || lower.endsWith(".mp3") ||
        lower.endsWith(".opus") || lower.endsWith(".weba") || lower.endsWith(".ogg") ||
        lower.endsWith(".wav") || lower.endsWith(".flac")
      ) {
        kind = "audio";
      } else if (
        lower.endsWith(".mp4") || lower.endsWith(".mkv") || lower.endsWith(".webm") ||
        lower.endsWith(".mov")
      ) {
        kind = "video";
      }
      artifacts.push({ name: entry.name, absolutePath: join(cacheDir, entry.name), kind });
    }
    return artifacts;
  }

  async #writeManifestFromArtifacts(
    request: RequestItem,
    settings: ServerSettings,
    targets: CacheTargets,
  ) {
    const artifacts = await this.#findDownloadArtifacts(settings.cacheDir, targets.baseName);
    if (artifacts.length === 0) {
      throw new Error("yt-dlp did not produce any media files");
    }
    const entries = this.#buildManifestEntries(artifacts);
    // find thumbnail artifact (if any)
    const thumb = artifacts.find((a) => a.kind === "thumbnail");
    if (entries.length === 0) {
      throw new Error("No playable media artifacts were found");
    }
    const manifest: MediaManifest = {
      version: 1,
      requestId: request.id,
      sourceUrl: request.url,
      thumbnail: thumb ? thumb.name : null,
      createdAt: Date.now(),
      entries,
    };
    await Deno.writeTextFile(targets.absolutePath, JSON.stringify(manifest, null, 2));
    return manifest;
  }

  #buildCookieArgs(settings: ServerSettings) {
    const browser = settings.ytDlpCookiesFromBrowser;
    if (!browser) return [];
    let spec = browser;
    if (settings.ytDlpCookiesFromBrowserKeyring) {
      spec = `${spec}+${settings.ytDlpCookiesFromBrowserKeyring}`;
    }
    if (settings.ytDlpCookiesFromBrowserProfile) {
      spec = `${spec}:${settings.ytDlpCookiesFromBrowserProfile}`;
    }
    if (settings.ytDlpCookiesFromBrowserContainer) {
      spec = `${spec}::${settings.ytDlpCookiesFromBrowserContainer}`;
    }
    return ["--cookies-from-browser", spec];
  }

  #buildUserAgentArgs(settings: ServerSettings) {
    if (!settings.ytDlpUserAgent) return [];
    return ["--user-agent", settings.ytDlpUserAgent];
  }

  #buildFfmpegArgs(settings: ServerSettings) {
    const configured = settings.ffmpegPath;
    if (!configured) return [];

    const isWinAbsolute = /^[a-zA-Z]:[\\/]/.test(configured) || configured.startsWith("\\\\");
    const isPosixAbsolute = configured.startsWith("/");

    // Prefer project-root relative resolution (config values are stored relative to repo root),
    // fall back to current working directory to keep backwards compatibility with ad‑hoc launches.
    const candidates = [
      isWinAbsolute || isPosixAbsolute ? configured : join(PROJECT_ROOT, configured),
      isWinAbsolute || isPosixAbsolute ? null : join(Deno.cwd(), configured),
    ].filter(Boolean) as string[];

    let resolved: string | null = null;
    for (const path of candidates) {
      try {
        const stat = Deno.statSync(path);
        if (!stat.isFile) continue;
        // Quick sanity check: executable should respond to "-version" within a short time.
        const probe = new Deno.Command(path, { args: ["-version"], stdout: "piped", stderr: "piped" });
        const { success } = probe.outputSync();
        if (!success) continue;
        resolved = path;
        break;
      } catch (_err) {
        // keep trying other candidates
      }
    }

    if (!resolved) {
      console.warn(`[worker] ffmpeg not found at configured path (${configured}); falling back to PATH`);
      return [];
    }

    return ["--ffmpeg-location", resolved];
  }

  #buildProxyArgs(settings: ServerSettings, site: string) {
    if (site === "bilibili" && settings.ytDlpBilibiliProxy) {
      return ["--proxy", settings.ytDlpBilibiliProxy];
    }
    return [];
  }

  #buildBilibiliHeaders(request: RequestItem) {
    const isBili = request.parsed?.site === "bilibili";
    if (!isBili) return [];
    const referer = request.url;
    return ["--add-header", `Referer:${referer}`, "--add-header", "Origin:https://www.bilibili.com"];
  }

  #buildManifestEntries(artifacts: DownloadArtifact[]) {
    const containers = artifacts.filter((item) => item.kind === "container");
    const videos = artifacts.filter((item) => item.kind === "video");
    const audios = artifacts.filter((item) => item.kind === "audio");
    const entries: MediaManifestEntry[] = [];

    const hasExplicitTracks = videos.length > 0 || audios.length > 0;
    if (!hasExplicitTracks) {
      const preferredContainer = this.#selectPreferredArtifact(containers, [
        ".mp4",
        ".webm",
        ".mkv",
        ".mov",
      ]);
      if (!preferredContainer) return [];
      return [{
        kind: "container",
        file: preferredContainer.name,
        mimeType: this.#guessMime(preferredContainer.name, "container"),
      }];
    }

    const preferredVideo = videos.length > 0
      ? this.#selectPreferredArtifact(videos, [".mp4", ".webm", ".mkv", ".mov"])
      : null;
    const preferredAudio = audios.length > 0
      ? this.#selectPreferredArtifact(audios, [
        ".m4a",
        ".mp4",
        ".webm",
        ".aac",
        ".mp3",
        ".opus",
        ".ogg",
        ".weba",
        ".flac",
      ])
      : null;

    if (preferredVideo) {
      entries.push({
        kind: "video",
        file: preferredVideo.name,
        mimeType: this.#guessMime(preferredVideo.name, "video"),
      });
    } else {
      const fallback = this.#selectPreferredArtifact(containers, [
        ".mp4",
        ".webm",
        ".mkv",
        ".mov",
      ]);
      if (fallback) {
        entries.push({
          kind: "video",
          file: fallback.name,
          mimeType: this.#guessMime(fallback.name, "container"),
        });
      }
    }
    if (preferredAudio) {
      entries.push({
        kind: "audio",
        file: preferredAudio.name,
        mimeType: this.#guessMime(preferredAudio.name, "audio"),
      });
    }
    if (entries.length === 0 && containers.length > 0) {
      const fallback = this.#selectPreferredArtifact(containers, [
        ".mp4",
        ".webm",
        ".mkv",
        ".mov",
      ]);
      if (fallback) {
        entries.push({
          kind: "container",
          file: fallback.name,
          mimeType: this.#guessMime(fallback.name, "container"),
        });
      }
    }
    return entries;
  }

  #selectPreferredArtifact(items: DownloadArtifact[], priority: string[]) {
    if (items.length === 0) return null;
    const scores = new Map(priority.map((ext, index) => [ext, priority.length - index]));
    let best = items[0];
    let bestScore = -1;
    for (const item of items) {
      const ext = extname(item.name).toLowerCase();
      const score = scores.get(ext) ?? 0;
      if (score > bestScore) {
        best = item;
        bestScore = score;
      }
    }
    return best;
  }

  #guessMime(fileName: string, kind: ManifestEntryKind) {
    const ext = extname(fileName).toLowerCase();
    if (kind === "audio") {
      if (ext === ".mp4" || ext === ".m4a") return "audio/mp4";
      if (ext === ".webm") return "audio/webm";
      if (ext === ".aac") return "audio/aac";
      if (ext === ".mp3") return "audio/mpeg";
    }
    if (kind === "video" || kind === "container") {
      if (ext === ".mp4") return "video/mp4";
      if (ext === ".webm") return "video/webm";
      if (ext === ".mkv") return "video/x-matroska";
      if (ext === ".mov") return "video/quicktime";
    }
    return contentType(ext) ?? "application/octet-stream";
  }

  async #calculateEntriesSize(entries: MediaManifestEntry[], cacheDir: string) {
    let total = 0;
    for (const entry of entries) {
      if (!entry.file) continue;
      const filePath = join(cacheDir, entry.file);
      try {
        const stat = await Deno.stat(filePath);
        total += stat.size;
      } catch (err) {
        console.warn(`[worker] manifest entry missing file ${entry.file}`, err);
      }
    }
    return total;
  }

  async #readManifestMetadata(manifestPath: string, settings: ServerSettings) {
    try {
      const raw = await Deno.readTextFile(manifestPath);
      const manifest = JSON.parse(raw) as MediaManifest;
      if (!manifest?.entries || !Array.isArray(manifest.entries) || manifest.entries.length === 0) {
        return null;
      }
      const totalSize = await this.#calculateEntriesSize(manifest.entries, settings.cacheDir);
      return { manifest, totalSize };
    } catch (err) {
      console.warn("[worker] failed to read manifest metadata", err);
      return null;
    }
  }

  async #fileExists(path: string) {
    try {
      await Deno.stat(path);
      return true;
    } catch (err) {
      if (err instanceof Deno.errors.NotFound) {
        return false;
      }
      throw err;
    }
  }
}
