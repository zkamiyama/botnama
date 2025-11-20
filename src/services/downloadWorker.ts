import { ensureDirSync } from "@std/fs/ensure-dir";
import { getEffectiveMaxDurationSec } from "./ruleService.ts";
import { join } from "@std/path/join";
import * as posix from "@std/path/posix";
import { extname } from "@std/path/extname";
import { contentType } from "@std/media-types";
import {
  countByStatus,
  listDownloadableRequests,
  updateDownloadMetadata,
  updateStatus,
} from "../repositories/requestsRepository.ts";
import { RequestItem, ServerSettings } from "../types.ts";
import { loadServerSettings } from "../settings.ts";
import { fetchVideoMetadata } from "./metadataService.ts";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const MAX_BASE_LENGTH = 240;

type ManifestEntryKind = "container" | "video" | "audio";

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
    const queue = listDownloadableRequests(availableSlots);
    for (const request of queue) {
      await this.#processRequest(request, settings);
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
    const args = ["-o", outputTemplate, ...this.#buildCookieArgs(settings), request.url];
    const command = new Deno.Command(settings.ytDlpPath, {
      args,
      stdout: "piped",
      stderr: "piped",
    });
    const result = await command.output();
    if (result.code !== 0) {
      throw new Error(new TextDecoder().decode(result.stderr) || "yt-dlp exited with error");
    }
    await this.#writeManifestFromArtifacts(request, settings, targets);
  }

  async #findDownloadArtifacts(cacheDir: string, baseName: string) {
    const artifacts: DownloadArtifact[] = [];
    for await (const entry of Deno.readDir(cacheDir)) {
      if (!entry.isFile || !entry.name.startsWith(`${baseName}.`)) continue;
      if (entry.name.endsWith(".media.json")) continue;
      const lower = entry.name.toLowerCase();
      let kind: ManifestEntryKind = "container";
      if (lower.includes(".fvideo") || lower.includes(".video")) {
        kind = "video";
      } else if (
        lower.includes(".faudio") || lower.includes(".audio") ||
        lower.endsWith(".m4a") || lower.endsWith(".aac") || lower.endsWith(".mp3")
      ) {
        kind = "audio";
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
    if (entries.length === 0) {
      throw new Error("No playable media artifacts were found");
    }
    const manifest: MediaManifest = {
      version: 1,
      requestId: request.id,
      sourceUrl: request.url,
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

  #buildManifestEntries(artifacts: DownloadArtifact[]) {
    const containers = artifacts.filter((item) => item.kind === "container");
    if (containers.length > 0) {
      const preferred = this.#selectPreferredArtifact(containers, [
        ".mp4",
        ".webm",
        ".mkv",
        ".mov",
      ]);
      if (!preferred) return [];
      return [{
        kind: "container",
        file: preferred.name,
        mimeType: this.#guessMime(preferred.name, "container"),
      }];
    }
    const entries: MediaManifestEntry[] = [];
    const videos = artifacts.filter((item) => item.kind === "video");
    const audios = artifacts.filter((item) => item.kind === "audio");
    const preferredVideo = this.#selectPreferredArtifact(videos, [".mp4", ".webm"]);
    const preferredAudio = this.#selectPreferredArtifact(audios, [
      ".m4a",
      ".mp4",
      ".webm",
      ".aac",
      ".mp3",
    ]);
    if (preferredVideo) {
      entries.push({
        kind: "video",
        file: preferredVideo.name,
        mimeType: this.#guessMime(preferredVideo.name, "video"),
      });
    }
    if (preferredAudio) {
      entries.push({
        kind: "audio",
        file: preferredAudio.name,
        mimeType: this.#guessMime(preferredAudio.name, "audio"),
      });
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
