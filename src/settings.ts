import { ensureDirSync } from "@std/fs/ensure-dir";
import { join } from "@std/path/join";
import { fromFileUrl } from "@std/path/from-file-url";
import { parse, stringify } from "@std/toml";
import { loadSync } from "@std/dotenv";
import { ServerSettings } from "./types.ts";

const PROJECT_ROOT = fromFileUrl(new URL("..", import.meta.url));
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
  maxVideoDurationSec: 600,
  maxConcurrentDownloads: 1,
  ytDlpPath: DEFAULT_YTDLP_BINARY,
  denoPath: "deno",
  ffmpegPath: DEFAULT_FFMPEG_BINARY,
  ytDlpInstallPath: DEFAULT_YTDLP_BINARY,
  mcvAccessToken: null,
  ytDlpCookiesFromBrowser: null,
  ytDlpCookiesFromBrowserProfile: null,
  ytDlpCookiesFromBrowserKeyring: null,
  ytDlpCookiesFromBrowserContainer: null,
  locale: DEFAULT_LOCALE,
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

const mergeSettings = (raw: Record<string, unknown>): ServerSettings => {
  const merged: ServerSettings = {
    httpPort: coerceNumber(raw.httpPort, DEFAULT_SETTINGS.httpPort),
    cacheDir: coerceString(raw.cacheDir, DEFAULT_SETTINGS.cacheDir),
    maxVideoDurationSec: coerceNumber(raw.maxVideoDurationSec, DEFAULT_SETTINGS.maxVideoDurationSec),
    maxConcurrentDownloads: coerceNumber(
      raw.maxConcurrentDownloads,
      DEFAULT_SETTINGS.maxConcurrentDownloads,
    ),
    ytDlpPath: coerceString(raw.ytDlpPath, DEFAULT_SETTINGS.ytDlpPath),
    denoPath: coerceString(raw.denoPath, DEFAULT_SETTINGS.denoPath),
    ffmpegPath: coerceNullableString(raw.ffmpegPath, DEFAULT_SETTINGS.ffmpegPath),
    ytDlpInstallPath: coerceNullableString(
      raw.ytDlpInstallPath,
      DEFAULT_SETTINGS.ytDlpInstallPath,
    ),
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
    locale: coerceString(raw.locale, DEFAULT_SETTINGS.locale),
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
  const envLocale = envString("BOTNAMA_LOCALE");
  if (envLocale) merged.locale = envLocale;
  return merged;
};

let envLoaded = false;
const ensureEnvLoaded = () => {
  if (envLoaded) return;
  envLoaded = true;
  try {
    loadSync({ envPath: ENV_PATH, export: true });
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
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
  const serialized = stringify(settings as Record<string, unknown>);
  Deno.writeTextFileSync(CONFIG_PATH, serialized);
};
