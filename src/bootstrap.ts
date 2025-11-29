import { ensureDirSync } from "@std/fs/ensure-dir";
import { dirname, isAbsolute, join } from "@std/path";
import { PROJECT_ROOT } from "./settings.ts";
import JSZip from "jszip";
import { ServerSettings } from "./types.ts";


const GITHUB_JSON_HEADERS = {
  "user-agent": "botnama-app",
  accept: "application/vnd.github+json",
};
const GITHUB_BINARY_HEADERS = {
  "user-agent": GITHUB_JSON_HEADERS["user-agent"],
};

const FFMPEG_RELEASE_API = "https://api.github.com/repos/yt-dlp/FFmpeg-Builds/releases/latest";

const YT_DLP_SOURCES: Record<Deno.OS, string | undefined> = {
  windows: "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe",
  linux: "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp",
  darwin: "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp",
};

const toAbsolutePath = (path: string) => {
  if (isAbsolute(path)) return path;
  const candidate = join(PROJECT_ROOT, path);
  try {
    // attempt to create the parent directory to validate writability
    ensureDirSync(dirname(candidate));
    return candidate;
  } catch (err) {
    console.warn(`[bootstrap] could not use project root ${PROJECT_ROOT} for path ${path}:`, err);
    // Fallback: prefer user-specified BOTNAMA_HOME / BOTNAMA_ROOT or current working dir
    const override = Deno.env.get("BOTNAMA_HOME") ?? Deno.env.get("BOTNAMA_ROOT");
    // If project root appears to be a deno-compile temp extraction (or temp dir), avoid using it
    const tmpDir = Deno.env.get("TEMP") ?? Deno.env.get("TMP") ?? "";
    const projectRootIsTmp = String(PROJECT_ROOT).includes("deno-compile") || (tmpDir && String(PROJECT_ROOT).includes(tmpDir));
    let fallbackRoot: string;
    if (override && override.trim().length > 0) {
      fallbackRoot = override;
    } else if (projectRootIsTmp) {
      // try to fall back to known per-user data dir if available
      if (Deno.build.os === "windows") {
        const local = Deno.env.get("LOCALAPPDATA") ?? Deno.env.get("APPDATA");
        fallbackRoot = local ? join(local, "botnama") : Deno.cwd();
      } else if (Deno.build.os === "darwin") {
        const home = Deno.env.get("HOME");
        fallbackRoot = home ? join(home, "Library", "Application Support", "botnama") : Deno.cwd();
      } else {
        const xdg = Deno.env.get("XDG_CONFIG_HOME");
        const home = Deno.env.get("HOME");
        fallbackRoot = xdg ? join(xdg, "botnama") : (home ? join(home, ".config", "botnama") : Deno.cwd());
      }
    } else {
      fallbackRoot = Deno.cwd();
    }
    const fallback = join(fallbackRoot, path);
    try {
      ensureDirSync(dirname(fallback));
      return fallback;
    } catch (_err) {
      // Last-resort: return candidate
      return candidate;
    }
  }
};

const fileExists = async (path: string) => {
  try {
    const stat = await Deno.stat(path);
    return stat.isFile;
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) return false;
    throw err;
  }
};

const fetchBinary = async (url: string, init?: RequestInit) => {
  console.log(`[bootstrap] downloading ${url}`);
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status} ${res.statusText}`);
  return new Uint8Array(await res.arrayBuffer());
};

const downloadFile = async (url: string, destination: string) => {
  const data = await fetchBinary(url);
  ensureDirSync(dirname(destination));
  await Deno.writeFile(destination, data);
};

const downloadBinary = async (url: string, destination: string) => {
  await downloadFile(url, destination);
  if (Deno.build.os !== "windows") {
    await Deno.chmod(destination, 0o755).catch(() => {});
  }
};

interface GithubReleaseAsset {
  name: string;
  browser_download_url: string;
}

interface GithubRelease {
  tag_name?: string;
  assets: GithubReleaseAsset[];
}

const fetchGithubJson = async <T>(url: string): Promise<T> => {
  const res = await fetch(url, { headers: GITHUB_JSON_HEADERS });
  if (!res.ok) {
    throw new Error(`GitHub API request failed for ${url}: ${res.status} ${res.statusText}`);
  }
  return await res.json() as T;
};

type AssetMatcher = (name: string) => boolean;

const containsAll = (...needles: string[]): AssetMatcher => {
  const lowered = needles.map((needle) => needle.toLowerCase());
  return (name: string) => {
    const target = name.toLowerCase();
    return lowered.every((needle) => target.includes(needle));
  };
};

const FFMPEG_ASSET_MATCHERS: Record<Deno.OS, Record<string, AssetMatcher[]>> = {
  windows: {
    x86_64: [
      containsAll("win64", "gpl.zip"),
      containsAll("win64", "gpl-shared.zip"),
    ],
    aarch64: [
      containsAll("winarm64", "gpl.zip"),
      containsAll("winarm64", "gpl-shared.zip"),
    ],
  },
  linux: {
    x86_64: [containsAll("linux64", "gpl.tar.xz")],
    aarch64: [containsAll("linuxarm64", "gpl.tar.xz")],
  },
  darwin: {
    x86_64: [
      containsAll("mac", "x86", "gpl", ".zip"),
      containsAll("mac", "x86", "gpl", ".tar.xz"),
      containsAll("mac", "universal", "gpl", ".zip"),
      containsAll("mac", "gpl", ".zip"),
    ],
    aarch64: [
      containsAll("mac", "arm64", "gpl", ".zip"),
      containsAll("mac", "arm64", "gpl", ".tar.xz"),
      containsAll("mac", "universal", "gpl", ".zip"),
      containsAll("mac", "gpl", ".zip"),
    ],
  },
};

const ensureBinary = async (
  path: string | null,
  sources: Record<Deno.OS, string | undefined>,
  label: string,
  force = false,
) => {
  if (!path) return;
  const absolutePath = toAbsolutePath(path);
  if (!force && await fileExists(absolutePath)) {
    return;
  }
  ensureDirSync(dirname(absolutePath));
  const url = sources[Deno.build.os];
  if (!url) {
    console.warn(`[bootstrap] No download source defined for ${label} on ${Deno.build.os}`);
    return;
  }
  await downloadBinary(url, absolutePath);
  console.log(`[bootstrap] ${label} ready at ${absolutePath}`);
};


const stripArchiveExtension = (name: string) =>
  name.replace(/\.tar\.xz$/i, "").replace(/\.zip$/i, "");

const extractBinaryFromZip = async (archive: Uint8Array, relativePath: string) => {
  const zip = await JSZip.loadAsync(archive);
  const normalized = relativePath.replace(/\\/g, "/");
  let entry = zip.files[normalized];
  if (!entry) {
    entry = Object.values(zip.files).find((file) =>
      !file.dir && file.name.replace(/\\/g, "/").endsWith("/bin/ffmpeg")
    );
  }
  if (!entry && Deno.build.os === "windows") {
    entry = Object.values(zip.files).find((file) =>
      !file.dir && file.name.replace(/\\/g, "/").endsWith("/bin/ffmpeg.exe")
    );
  }
  if (!entry) {
    throw new Error(`Could not locate ffmpeg binary (${relativePath}) inside downloaded archive`);
  }
  return await entry.async("uint8array");
};

const extractBinaryFromTarXz = async (archive: Uint8Array, relativePath: string) => {
  const archivePath = await Deno.makeTempFile({ suffix: ".tar.xz" });
  const extractDir = await Deno.makeTempDir();
  try {
    await Deno.writeFile(archivePath, archive);
    const command = new Deno.Command("tar", {
      args: ["-xJf", archivePath, "-C", extractDir, relativePath],
      stdout: "null",
      stderr: "piped",
    });
    const { code, stderr } = await command.output();
    if (code !== 0) {
      throw new Error(
        `Failed to extract ${relativePath} from archive: ${
          new TextDecoder().decode(stderr).trim()
        }`,
      );
    }
    const binaryPath = join(extractDir, ...relativePath.split("/"));
    return await Deno.readFile(binaryPath);
  } finally {
    await Deno.remove(archivePath).catch(() => {});
    await Deno.remove(extractDir, { recursive: true }).catch(() => {});
  }
};

const selectFfmpegAsset = (assets: GithubReleaseAsset[]): GithubReleaseAsset | null => {
  const osMatchers = FFMPEG_ASSET_MATCHERS[Deno.build.os];
  if (!osMatchers) return null;
  const archMatchers = osMatchers[Deno.build.arch] ?? osMatchers.x86_64 ?? [];
  for (const matcher of archMatchers) {
    const asset = assets.find((candidate) => matcher(candidate.name));
    if (asset) return asset;
  }
  return null;
};

export const bootstrapEnvironment = async (settings: ServerSettings) => {
  const cacheDir = toAbsolutePath(settings.cacheDir);
  ensureDirSync(cacheDir);
  await ensureYtDlpBinary(settings);
  await ensureFfmpegBinary(settings);
};

export const ensureYtDlpBinary = async (settings: ServerSettings, force = false) =>
  await ensureBinary(settings.ytDlpPath, YT_DLP_SOURCES, "yt-dlp", force);

export const ensureFfmpegBinary = async (settings: ServerSettings, force = false) => {
  if (!settings.ffmpegPath) return;
  const absolutePath = toAbsolutePath(settings.ffmpegPath);
  if (!force && await fileExists(absolutePath)) {
    return;
  }

  const release = await fetchGithubJson<GithubRelease>(FFMPEG_RELEASE_API);
  const asset = selectFfmpegAsset(release.assets);
  if (!asset) {
    console.warn(
      `[bootstrap] No FFmpeg asset found for ${Deno.build.os}/${Deno.build.arch} in latest release`,
    );
    return;
  }

  const archiveBytes = await fetchBinary(asset.browser_download_url, {
    headers: GITHUB_BINARY_HEADERS,
  });
  const archiveRoot = stripArchiveExtension(asset.name);
  const binaryName = Deno.build.os === "windows" ? "ffmpeg.exe" : "ffmpeg";
  const binaryPathInArchive = `${archiveRoot}/bin/${binaryName}`;

  let binary: Uint8Array;
  if (asset.name.endsWith(".zip")) {
    binary = await extractBinaryFromZip(archiveBytes, binaryPathInArchive);
  } else if (asset.name.endsWith(".tar.xz")) {
    binary = await extractBinaryFromTarXz(archiveBytes, binaryPathInArchive);
  } else {
    throw new Error(`Unsupported FFmpeg archive format: ${asset.name}`);
  }

  ensureDirSync(dirname(absolutePath));
  await Deno.writeFile(absolutePath, binary);
  if (Deno.build.os !== "windows") {
    await Deno.chmod(absolutePath, 0o755).catch(() => {});
  }
  console.log(`[bootstrap] ffmpeg ready at ${absolutePath}`);
};

export const resolveProjectPath = toAbsolutePath;
