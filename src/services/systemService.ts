import { ServerSettings } from "../types.ts";
import { ensureYtDlpBinary, resolveProjectPath } from "../bootstrap.ts";
import { DOCK_EVENT, emitDockEvent } from "../events/dockEventBus.ts";

const VERSION_CACHE_SUCCESS_TTL_MS = 60 * 60 * 1000; // 1 hour for successful lookups
const VERSION_CACHE_ERROR_TTL_MS = 5 * 60 * 1000; // retry failed lookups sooner

interface VersionCacheEntry {
  value: string | null;
  expiresAt: number;
}

const versionCache = new Map<string, VersionCacheEntry>();

const GITHUB_API_HEADERS = {
  "user-agent": "botnama-app",
  accept: "application/vnd.github+json",
};

const GITHUB_HTML_HEADERS = {
  "user-agent": GITHUB_API_HEADERS["user-agent"],
  accept: "text/html,application/xhtml+xml",
};

const PYPI_HEADERS = {
  "user-agent": GITHUB_API_HEADERS["user-agent"],
  accept: "application/json",
};

const getCachedVersion = (key: string): string | null | undefined => {
  const entry = versionCache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    versionCache.delete(key);
    return undefined;
  }
  return entry.value;
};

const setCachedVersion = (key: string, value: string | null) => {
  const ttl = value ? VERSION_CACHE_SUCCESS_TTL_MS : VERSION_CACHE_ERROR_TTL_MS;
  versionCache.set(key, { value, expiresAt: Date.now() + ttl });
};

const runCommand = async (cmdPath: string, args: string[]) => {
  try {
    const command = new Deno.Command(cmdPath, {
      args,
      stdout: "piped",
      stderr: "piped",
    });
    const output = await command.output();
    if (output.code !== 0) return null;
    return new TextDecoder().decode(output.stdout).trim();
  } catch (_err) {
    return null;
  }
};

const extractTagFromUrl = (target: string) => {
  try {
    const url = new URL(target);
    const segments = url.pathname.split("/");
    const idx = segments.indexOf("tag");
    if (idx >= 0 && segments[idx + 1]) {
      return decodeURIComponent(segments[idx + 1]);
    }
  } catch (_err) {
    // ignore parse errors
  }
  return null;
};

const fetchGithubApiReleaseTag = async (repo: string) => {
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
      headers: GITHUB_API_HEADERS,
    });
    if (!res.ok) return null;
    const json = await res.json();
    return typeof json.tag_name === "string" ? json.tag_name : null;
  } catch (_err) {
    return null;
  }
};

const fetchGithubHtmlReleaseTag = async (repo: string) => {
  try {
    const res = await fetch(`https://github.com/${repo}/releases/latest`, {
      headers: GITHUB_HTML_HEADERS,
      redirect: "follow",
    });
    if (!res.ok) return null;
    const redirectedTag = extractTagFromUrl(res.url);
    if (redirectedTag) {
      return redirectedTag;
    }
    const body = await res.text();
    const match = body.match(/releases\/tag\/([^"'>]+)/i);
    return match?.[1] ?? null;
  } catch (_err) {
    return null;
  }
};

const fetchPypiVersion = async (packageName: string) => {
  try {
    const res = await fetch(`https://pypi.org/pypi/${packageName}/json`, {
      headers: PYPI_HEADERS,
    });
    if (!res.ok) return null;
    const json = await res.json();
    const version = json?.info?.version;
    return typeof version === "string" ? version : null;
  } catch (_err) {
    return null;
  }
};

const fetchLatestVersion = async (
  cacheKey: string,
  sources: Array<() => Promise<string | null>>,
) => {
  const cached = getCachedVersion(cacheKey);
  if (cached !== undefined) {
    return cached;
  }
  for (const source of sources) {
    const value = await source();
    if (value) {
      setCachedVersion(cacheKey, value);
      return value;
    }
  }
  setCachedVersion(cacheKey, null);
  return null;
};

const normalizeTag = (value: string | null | undefined) => value?.replace(/^v/i, "") ?? null;

export const getSystemInfo = async (settings: ServerSettings) => {
  const ytDlpPath = resolveProjectPath(settings.ytDlpPath);
  const [current, ytLatestRaw] = await Promise.all([
    runCommand(ytDlpPath, ["--version"]),
    fetchLatestVersion("yt-dlp", [
      () => fetchGithubApiReleaseTag("yt-dlp/yt-dlp"),
      () => fetchGithubHtmlReleaseTag("yt-dlp/yt-dlp"),
      () => fetchPypiVersion("yt-dlp"),
    ]),
  ]);
  const latest = normalizeTag(ytLatestRaw);
  return {
    ytDlp: {
      current,
      latest,
      updateAvailable: Boolean(current && latest && current !== latest),
    },
  };
};

export const updateYtDlpBinary = async (settings: ServerSettings) => {
  await ensureYtDlpBinary(settings, true);
  emitDockEvent(DOCK_EVENT.SYSTEM);
  return runCommand(resolveProjectPath(settings.ytDlpPath), ["--version"]);
};

