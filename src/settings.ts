import { ensureDirSync } from "@std/fs/ensure-dir";
import { join } from "@std/path/join";
import { dirname } from "@std/path/dirname";
import { relative } from "@std/path/relative";
import { isAbsolute } from "@std/path/is-absolute";
import { fromFileUrl } from "@std/path/from-file-url";
import { parse, stringify } from "@std/toml";
import { loadSync } from "@std/dotenv";
import { ServerSettings } from "./types.ts";

const _PROJECT_ROOT_FROM_URL = fromFileUrl(new URL("..", import.meta.url));
// If running as a bundled executable, import.meta.url resolves to a temporary
// extraction path (e.g. '.../deno-compile-botnama.exe/...'), which is not writable.
// In that case, prefer an OS-appropriate per-user data directory or user-specified
// override (BOTNAMA_HOME). This ensures files like `config/` and `cache/` are
// created in a writable location when running the compiled executable.
const computeBundledProjectRoot = (): string => {
  // Environment override
  const override = Deno.env.get("BOTNAMA_HOME") ?? Deno.env.get("BOTNAMA_ROOT");
  if (override && override.trim().length > 0) return override;
  // Prefer executable directory if writable (portable behavior)
  try {
    const execPath = Deno.execPath();
    if (execPath) {
      const execDir = dirname(execPath);
      // Try to create a test directory to check writability
      const testPath = join(execDir, ".botnama_test_write");
      try {
        Deno.mkdirSync(testPath, { recursive: true });
        Deno.removeSync(testPath, { recursive: true });
        return execDir;
      } catch (_err) {
        // Not writable; fallthrough
      }
    }
  } catch (_err) {
    // ignore; if execPath not available or not writable, fallthrough
  }
  // OS-specific defaults
  if (Deno.build.os === "windows") {
    const local = Deno.env.get("LOCALAPPDATA") ?? Deno.env.get("APPDATA");
    if (local) return join(local, "botnama");
  }
  if (Deno.build.os === "darwin") {
    const home = Deno.env.get("HOME");
    if (home) return join(home, "Library", "Application Support", "botnama");
  }
  // Linux / *nix fallback
  const xdg = Deno.env.get("XDG_CONFIG_HOME");
  if (xdg) return join(xdg, "botnama");
  const home = Deno.env.get("HOME");
  if (home) return join(home, ".config", "botnama");
  // Best-effort fallback: current working directory
  return join(Deno.cwd(), "botnama");
};

// Use import.meta.url derived project root by default. If that path appears to
// be part of a deno compile extraction directory (contains 'deno-compile'),
// switch to an OS-appropriate, writable directory.
const _isBundled = _PROJECT_ROOT_FROM_URL.includes("deno-compile") || _PROJECT_ROOT_FROM_URL.includes("deno-compile-");
export const PROJECT_ROOT = _isBundled ? computeBundledProjectRoot() : _PROJECT_ROOT_FROM_URL;
const BIN_DIR = join(PROJECT_ROOT, "bin");
const CONFIG_DIR = join(PROJECT_ROOT, "config");
const CONFIG_PATH = join(CONFIG_DIR, "settings.toml");
const ENV_PATH = join(PROJECT_ROOT, ".env");
const DEFAULT_YTDLP_BINARY = join(BIN_DIR, Deno.build.os === "windows" ? "yt-dlp.exe" : "yt-dlp");
const DEFAULT_FFMPEG_BINARY = join(BIN_DIR, Deno.build.os === "windows" ? "ffmpeg.exe" : "ffmpeg");
const DEFAULT_LOCALE = "auto";

export const DEFAULT_SETTINGS: ServerSettings = {
  httpPort: 2101,
  cacheDir: "cache/videos",
  maxConcurrentDownloads: 5,
  ytDlpPath: DEFAULT_YTDLP_BINARY,
  denoPath: "deno",
  ffmpegPath: DEFAULT_FFMPEG_BINARY,
  mcvAccessToken: null,
  ytDlpCookiesFromBrowser: null,
  ytDlpCookiesFromBrowserProfile: null,
  ytDlpCookiesFromBrowserKeyring: null,
  ytDlpCookiesFromBrowserContainer: null,
  ytDlpInheritStdio: true,
  ytDlpBilibiliProxy: null,
  ytDlpUserAgent: null,
  youtubeCookiesFrom: "",
  youtubeCookiesProfile: "",
  niconicoCookiesFrom: "",
  niconicoCookiesProfile: "",
  locale: DEFAULT_LOCALE,
  ytDlpPerDomainTimeoutMs: 15000,
  ytDlpYouTubeTimeoutMs: 120000,
};

const coerceNumber = (value: unknown, fallback: number) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const n = Number(value);
    if (!Number.isNaN(n)) return n;
  }
  return fallback;
};

const coerceString = (value: unknown, fallback: string) => {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  return fallback;
};

const coerceNullableString = (value: unknown, fallback: string | null) => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length > 0) return trimmed;
    return null;
  }
  return fallback;
};

const envString = (key: string) => {
  const value = Deno.env.get(key);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const applyEnvOverride = (current: string | null, envKey: string) => {
  const value = envString(envKey);
  return value ?? current;
};

const normalizePathForConfig = (value: string | null): string | null => {
  if (!value) return value;
  const normalized = value.replace(/\\/g, "/").trim();
  if (normalized.length === 0) return null;
  if (isAbsolute(normalized)) {
    const rel = relative(PROJECT_ROOT, normalized);
    return rel === "" || rel.startsWith("..") ? normalized : rel.replace(/\\/g, "/");
  }
  return normalized;
};

const mergeSettings = (raw: Record<string, unknown>): ServerSettings => {
  const merged: ServerSettings = {
    httpPort: coerceNumber(raw.httpPort, DEFAULT_SETTINGS.httpPort),
    cacheDir: coerceString(raw.cacheDir, DEFAULT_SETTINGS.cacheDir),
    maxConcurrentDownloads: coerceNumber(
      raw.maxConcurrentDownloads,
      DEFAULT_SETTINGS.maxConcurrentDownloads,
    ),
    ytDlpPath: coerceString(raw.ytDlpPath, DEFAULT_SETTINGS.ytDlpPath),
    denoPath: coerceString(raw.denoPath, DEFAULT_SETTINGS.denoPath),
    ffmpegPath: coerceNullableString(raw.ffmpegPath, DEFAULT_SETTINGS.ffmpegPath),
    mcvAccessToken: coerceNullableString(raw.mcvAccessToken, DEFAULT_SETTINGS.mcvAccessToken),
    ytDlpCookiesFromBrowser: coerceNullableString(
      raw.ytDlpCookiesFromBrowser,
      DEFAULT_SETTINGS.ytDlpCookiesFromBrowser,
    ),
    ytDlpCookiesFromBrowserProfile: coerceNullableString(
      raw.ytDlpCookiesFromBrowserProfile,
      DEFAULT_SETTINGS.ytDlpCookiesFromBrowserProfile,
    ),
    ytDlpCookiesFromBrowserKeyring: coerceNullableString(
      raw.ytDlpCookiesFromBrowserKeyring,
      DEFAULT_SETTINGS.ytDlpCookiesFromBrowserKeyring,
    ),
    ytDlpCookiesFromBrowserContainer: coerceNullableString(
      raw.ytDlpCookiesFromBrowserContainer,
      DEFAULT_SETTINGS.ytDlpCookiesFromBrowserContainer,
    ),
    ytDlpInheritStdio: Boolean(raw.ytDlpInheritStdio ?? DEFAULT_SETTINGS.ytDlpInheritStdio),
    ytDlpBilibiliProxy: coerceNullableString(
      raw.ytDlpBilibiliProxy,
      DEFAULT_SETTINGS.ytDlpBilibiliProxy,
    ),
    ytDlpUserAgent: coerceNullableString(raw.ytDlpUserAgent, DEFAULT_SETTINGS.ytDlpUserAgent),
    globalCookiesFromBrowser: coerceNullableString(
      raw.globalCookiesFromBrowser,
      DEFAULT_SETTINGS.globalCookiesFromBrowser,
    ),
    globalCookiesFromBrowserProfile: coerceNullableString(
      raw.globalCookiesFromBrowserProfile,
      DEFAULT_SETTINGS.globalCookiesFromBrowserProfile,
    ),
    youtubeCookiesFrom: coerceNullableString(
      raw.youtubeCookiesFrom,
      DEFAULT_SETTINGS.youtubeCookiesFrom,
    ),
    youtubeCookiesProfile: coerceNullableString(
      raw.youtubeCookiesProfile,
      DEFAULT_SETTINGS.youtubeCookiesProfile,
    ),
    niconicoCookiesFrom: coerceNullableString(
      raw.niconicoCookiesFrom,
      DEFAULT_SETTINGS.niconicoCookiesFrom,
    ),
    niconicoCookiesProfile: coerceNullableString(
      raw.niconicoCookiesProfile,
      DEFAULT_SETTINGS.niconicoCookiesProfile,
    ),
    locale: coerceString(raw.locale, DEFAULT_SETTINGS.locale),
    ytDlpPerDomainTimeoutMs: coerceNumber(raw.ytDlpPerDomainTimeoutMs, DEFAULT_SETTINGS.ytDlpPerDomainTimeoutMs),
    ytDlpYouTubeTimeoutMs: coerceNumber(raw.ytDlpYouTubeTimeoutMs, DEFAULT_SETTINGS.ytDlpYouTubeTimeoutMs),
  };
  merged.ytDlpCookiesFromBrowser = applyEnvOverride(
    merged.ytDlpCookiesFromBrowser,
    "BOTNAMA_YTDLP_COOKIES_BROWSER",
  );
  merged.ytDlpCookiesFromBrowserProfile = applyEnvOverride(
    merged.ytDlpCookiesFromBrowserProfile,
    "BOTNAMA_YTDLP_COOKIES_PROFILE",
  );
  merged.ytDlpCookiesFromBrowserKeyring = applyEnvOverride(
    merged.ytDlpCookiesFromBrowserKeyring,
    "BOTNAMA_YTDLP_COOKIES_KEYRING",
  );
  merged.ytDlpCookiesFromBrowserContainer = applyEnvOverride(
    merged.ytDlpCookiesFromBrowserContainer,
    "BOTNAMA_YTDLP_COOKIES_CONTAINER",
  );
  const inherit = envString("BOTNAMA_YTDLP_INHERIT_STDIO");
  if (inherit !== null) {
    merged.ytDlpInheritStdio = inherit.toLowerCase() === "true";
  }
  merged.ytDlpBilibiliProxy = applyEnvOverride(
    merged.ytDlpBilibiliProxy,
    "BOTNAMA_YTDLP_BILIBILI_PROXY",
  );
  merged.ytDlpUserAgent = applyEnvOverride(merged.ytDlpUserAgent, "BOTNAMA_YTDLP_USER_AGENT");
  merged.globalCookiesFromBrowser = applyEnvOverride(
    merged.globalCookiesFromBrowser,
    "BOTNAMA_GLOBAL_COOKIES_FROM",
  );
  merged.globalCookiesFromBrowserProfile = applyEnvOverride(
    merged.globalCookiesFromBrowserProfile,
    "BOTNAMA_GLOBAL_COOKIES_PROFILE",
  );
  merged.youtubeCookiesFrom = applyEnvOverride(
    merged.youtubeCookiesFrom,
    "BOTNAMA_YOUTUBE_COOKIES_FROM",
  );
  merged.youtubeCookiesProfile = applyEnvOverride(
    merged.youtubeCookiesProfile,
    "BOTNAMA_YOUTUBE_COOKIES_PROFILE",
  );
  merged.niconicoCookiesFrom = applyEnvOverride(
    merged.niconicoCookiesFrom,
    "BOTNAMA_NICONICO_COOKIES_FROM",
  );
  merged.niconicoCookiesProfile = applyEnvOverride(
    merged.niconicoCookiesProfile,
    "BOTNAMA_NICONICO_COOKIES_PROFILE",
  );
  merged.ytDlpPath = normalizePathForConfig(merged.ytDlpPath) ?? DEFAULT_SETTINGS.ytDlpPath;
  merged.ffmpegPath = normalizePathForConfig(merged.ffmpegPath) ?? DEFAULT_SETTINGS.ffmpegPath;
  merged.cacheDir = normalizePathForConfig(merged.cacheDir) ?? DEFAULT_SETTINGS.cacheDir;
  if (!merged.ytDlpCookiesFromBrowser) {
    merged.ytDlpCookiesFromBrowser = merged.globalCookiesFromBrowser;
  }
  if (!merged.ytDlpCookiesFromBrowserProfile) {
    merged.ytDlpCookiesFromBrowserProfile = merged.globalCookiesFromBrowserProfile;
  }
  if (!merged.youtubeCookiesFrom) {
    // If user has configured ytDlpCookiesFromBrowser, make it available for
    // YouTube service consumption by default so users don't need to set both.
    merged.youtubeCookiesFrom = merged.ytDlpCookiesFromBrowser ?? merged.globalCookiesFromBrowser;
  }
  if (!merged.youtubeCookiesProfile) {
     merged.youtubeCookiesProfile = merged.ytDlpCookiesFromBrowserProfile ?? merged.globalCookiesFromBrowserProfile;
  }
  if (!merged.niconicoCookiesFrom) {
    // Also allow yt-dlp cookie browser setting to act as a fallback for
    // Niconico cookies if explicitly not set.
    merged.niconicoCookiesFrom = merged.ytDlpCookiesFromBrowser ?? merged.globalCookiesFromBrowser;
  }
  if (!merged.niconicoCookiesProfile) {
     merged.niconicoCookiesProfile = merged.ytDlpCookiesFromBrowserProfile ?? merged.globalCookiesFromBrowserProfile;
  }
  const envLocale = envString("BOTNAMA_LOCALE");
  if (envLocale) merged.locale = envLocale;
  return merged;
};

let envLoaded = false;
const ensureEnvLoaded = () => {
  if (envLoaded) return;
  envLoaded = true;
  try {
    // 環境変数は任意項目が多いため、空値を許容し例ファイルとの差分エラーを抑制する
    loadSync({
      envPath: ENV_PATH,
      export: true,
      allowEmptyValues: true,
      examplePath: undefined, // .env.example に足りない値があっても起動を止めない
    });
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return;
    if ((error as { name?: string }).name === "MissingEnvVarsError") {
      console.warn(
        "[env] .env is missing optional variables listed in .env.example; proceeding without them.",
      );
      return;
    }
    console.warn("Failed to load .env file", error);
  }
};

export const loadServerSettings = (): ServerSettings => {
  ensureEnvLoaded();
  try {
    const text = Deno.readTextFileSync(CONFIG_PATH);
    const parsed = parse(text) as Record<string, unknown>;
    return mergeSettings(parsed ?? {});
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      saveServerSettings(DEFAULT_SETTINGS);
      return DEFAULT_SETTINGS;
    }
    console.error("Failed to read settings.toml. Using defaults.", error);
    return DEFAULT_SETTINGS;
  }
};

export const saveServerSettings = (settings: ServerSettings) => {
  ensureDirSync(CONFIG_DIR);
  // 設定ファイルには利用者が編集する主要項目のみを書き出す
  const minimalSettings: Partial<ServerSettings> = {
    globalCookiesFromBrowser: settings.globalCookiesFromBrowser ?? "",
    globalCookiesFromBrowserProfile: settings.globalCookiesFromBrowserProfile ?? "",
    httpPort: settings.httpPort,
    cacheDir: normalizePathForConfig(settings.cacheDir) ?? settings.cacheDir,
    maxConcurrentDownloads: settings.maxConcurrentDownloads,
    ytDlpPath: normalizePathForConfig(settings.ytDlpPath) ?? settings.ytDlpPath,
    denoPath: settings.denoPath,
    ffmpegPath: normalizePathForConfig(settings.ffmpegPath) ?? settings.ffmpegPath,
    ytDlpCookiesFromBrowser: settings.ytDlpCookiesFromBrowser ?? "",
    ytDlpCookiesFromBrowserProfile: settings.ytDlpCookiesFromBrowserProfile ?? "",
    ytDlpCookiesFromBrowserKeyring: settings.ytDlpCookiesFromBrowserKeyring ?? "",
    ytDlpCookiesFromBrowserContainer: settings.ytDlpCookiesFromBrowserContainer ?? "",
    ytDlpInheritStdio: settings.ytDlpInheritStdio ?? true,
    ytDlpBilibiliProxy: settings.ytDlpBilibiliProxy ?? "",
    ytDlpUserAgent: settings.ytDlpUserAgent ?? "",
    globalCookiesFromBrowser: settings.globalCookiesFromBrowser ?? "",
    globalCookiesFromBrowserProfile: settings.globalCookiesFromBrowserProfile ?? "",
    youtubeCookiesFrom: settings.youtubeCookiesFrom ?? "",
    youtubeCookiesProfile: settings.youtubeCookiesProfile ?? "",
    niconicoCookiesFrom: settings.niconicoCookiesFrom ?? "",
    niconicoCookiesProfile: settings.niconicoCookiesProfile ?? "",
    locale: settings.locale,
  };
  const serialized = stringify(minimalSettings as Record<string, unknown>);
  Deno.writeTextFileSync(CONFIG_PATH, serialized);
};
