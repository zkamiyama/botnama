// Cookie extraction is delegated to yt-dlp; this file provides a thin wrapper to
// call the yt-dlp binary and parse Cookie headers from the traffic output.
import { loadServerSettings } from "../settings.ts";
import { join } from "@std/path/join";
import { ensureDir } from "@std/fs/ensure-dir";
import { exists } from "@std/fs/exists";

export interface Cookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
}

const buildYtDlpCookieSpec = (browser: string | null, profile?: string): string | null => {
  if (!browser) return null;
  let spec = browser;
  if (profile && profile.length > 0) spec = `${spec}:${profile}`;
  return spec;
};

const parseNetscapeCookieFile = (fileText: string, domain?: string): Cookie[] => {
  if (!fileText) return [];
  const lines = fileText.split(/\r?\n/);
  const res: Cookie[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    // Netscape cookie format: domain \t includeSubdomains \t path \t secure \t expires \t name \t value
    const parts = trimmed.split(/\s+/);
    if (parts.length < 7) continue;
    let cookieDomain = parts[0];
    // normalize domain
    if (cookieDomain.startsWith(".")) cookieDomain = cookieDomain.slice(1);
    // If cookie domain is not the requested domain or a subdomain, skip
    if (domain && !(cookieDomain === domain || cookieDomain.endsWith("." + domain))) continue;
    const path = parts[2] ?? "/";
    const secure = parts[3].toUpperCase() === "TRUE";
    const expires = Number(parts[4]) || 0;
    const name = parts[5] ?? "";
    const value = parts.slice(6).join(" ") ?? "";
    res.push({
      name,
      value,
      domain: cookieDomain,
      path,
      expires,
      httpOnly: false,
      secure,
    });
  }
  return res;
};

const parseCookieHeader = (raw: string, domain: string): Cookie[] => {
  if (!raw) return [];
  const lines = raw.split(/\r?\n/);
  const cookies: Cookie[] = [];
  for (const line of lines) {
    const idx = line.indexOf("Cookie:");
    if (idx === -1) continue;
    const header = line.slice(idx + "Cookie:".length).trim();
    if (!header) continue;
    const pairs = header.split(";").map((p) => p.trim()).filter(Boolean);
    for (const pair of pairs) {
      const eq = pair.indexOf("=");
      const name = eq === -1 ? pair : pair.slice(0, eq);
      const val = eq === -1 ? "" : pair.slice(eq + 1);
      cookies.push({ name, value: val, domain, path: "/", expires: 0, httpOnly: false, secure: false });
    }
  }
  return cookies;
};

// Streaming approach removed - we always use a file-based yt-dlp extraction.

// Map to dedupe concurrent extractions for the same browser/profile/domain
const _inflightExtractions = new Map<string, Promise<Cookie[]>>();
// Separate map to dedupe per-domain yt-dlp processes internally (avoids cycle with wrapper-level inflight map)
const _inflightDomainExtractions = new Map<string, Promise<Cookie[]>>();
// Track whether we've already attempted a file-based fallback (per domain) in this runtime to avoid repeated file-based work.
// We store the timestamp (ms) of the last attempt and compare to TTL to allow retries.
const _fileFallbackAttempted = new Map<string, number>();
// Track whether we've already attempted a single-file (spec) fallback for this browser/profile spec so we don't spawn multiple full extracts.
// We store the timestamp (ms) of the last attempt and compare to TTL to allow retries.
const _fileFallbackSpecAttempted = new Map<string, number>();
const _fileFallbackSpecInFlight = new Map<string, Promise<Cookie[]>>();

const FILE_FALLBACK_TTL_MS = 5 * 60 * 1000; // 5 minutes
const FORCE_REFRESH_DEBOUNCE_MS = 5000; // 5 seconds

export async function getBrowserCookies(browser: string, domain: string, profile?: string, forceRefresh = false): Promise<Cookie[]> {
  const settings = loadServerSettings();
  console.debug(`[CookieExtractor] getBrowserCookies called for ${browser}/${domain} profile=${profile ?? '(none)'} forceRefresh=${forceRefresh}`);
  const spec = buildYtDlpCookieSpec(browser, profile);
  if (!spec) return [];
  const key = `${spec}:${domain}:${profile ?? ""}`;
  const existing = _inflightExtractions.get(key);
  if (existing) {
    console.debug(`[CookieExtractor] Reusing inflight extraction for ${key}`);
    return await existing;
  }
  const extractionPromise = (async () => {
    const lastAttempt = _fileFallbackAttempted.get(key);
    const ttl = forceRefresh ? FORCE_REFRESH_DEBOUNCE_MS : FILE_FALLBACK_TTL_MS;
    if (lastAttempt && Date.now() - lastAttempt < ttl) {
      console.debug(`[CookieExtractor] Skipping file fallback for ${key} because already attempted ${Date.now() - lastAttempt}ms ago (return empty)`);
      return [];
    }
    try {
      const res = await getBrowserCookiesForDomains(browser, [domain], profile, forceRefresh);
      return res[domain] ?? [];
    } catch (e) {
      console.warn(`[CookieExtractor] getBrowserCookies batch call failed for ${domain}: ${e}`);
      return [];
    }
  })();
  _inflightExtractions.set(key, extractionPromise);
  try { return await extractionPromise; } finally { _inflightExtractions.delete(key); }
}

// Per-domain parallel extraction using yt-dlp when file-based fallback is required.
export async function getBrowserCookiesForDomains(browser: string, domains: string[], profile?: string, forceRefresh = false): Promise<Record<string, Cookie[]>> {
  const settings = loadServerSettings();
  const spec = buildYtDlpCookieSpec(browser, profile);
  if (!spec) return {};
  // sort domains for stable key
  const domainsSorted = [...domains].sort();
  const fileFallbackKey = `${spec}:${profile ?? ""}`;
  const cacheDir = settings.cacheDir ?? "cache";
  try { await ensureDir(cacheDir); } catch (_e) { }
  // First attempt: single spec-based yt-dlp run that writes a cookie file for the profile
  const specKey = `${spec}:${profile ?? ""}`;
  const specLastAttempt = _fileFallbackSpecAttempted.get(specKey);
  const ttl = forceRefresh ? FORCE_REFRESH_DEBOUNCE_MS : FILE_FALLBACK_TTL_MS;
  if (specLastAttempt && Date.now() - specLastAttempt < ttl) {
    console.debug(`[CookieExtractor] Skipping single-spec yt-dlp extraction for ${specKey} because previously attempted ${Date.now() - specLastAttempt}ms ago.`);
    return {};
  } else {
    const inflight = _fileFallbackSpecInFlight.get(specKey);
    if (inflight) {
      try {
        const allCookies = await inflight;
        // Map to the requested domains
        const out: Record<string, Cookie[]> = {};
        for (const d of domainsSorted) {
          out[d] = allCookies.filter((c) => c.domain === d || c.domain.endsWith(`.${d}`));
        }
        if (domainsSorted.every((d) => (out[d] ?? []).length > 0)) {
          for (const d of domainsSorted) _fileFallbackAttempted.set(`${spec}:${d}:${profile ?? ""}`, Date.now());
          return out;
        }
        // else continue to per-domain fallback below
      } catch (e) {
        console.debug(`[CookieExtractor] inflight single-spec extraction failed for ${specKey}: ${e}`);
      }
    } else {
      // Launch single-spec attempt and store inflight
      const runSingle = (async () => {
        const tempDir = await Deno.makeTempDir({ dir: cacheDir, prefix: `botnama-ytdlp-${spec.replace(/[^a-z0-9]/gi, "_")}-` });
        const cookieFile = join(tempDir, "cookies.txt");
        // Use a neutral, fast-loading target to avoid site-specific timeouts
        // (some sites, especially YouTube, have heavy client-side work and can cause
        //  yt-dlp to wait or time out). Using example.com is sufficient for writing
        //  a cookie file from the browser profile via --cookies-from-browser.
        const targetUrl = "https://example.com/";
        const args = ["--no-warnings", "-q", "--no-playlist", "--skip-download", "--simulate", "--cookies", cookieFile, "--cookies-from-browser", spec, targetUrl];
        if (settings.ytDlpUserAgent) args.unshift("--user-agent", settings.ytDlpUserAgent);
        try {
          console.debug(`[CookieExtractor] single-spec targetUrl=${targetUrl} args=${args.join(" ")}`);
          const cmd = new Deno.Command(settings.ytDlpPath, { args, stdout: "piped", stderr: "piped", stdin: "null" });
          const child = cmd.spawn();
          console.debug(`[CookieExtractor] single-spec yt-dlp spawn pid=${(child as any).pid ?? '(unknown)'} spec=${specKey}`);
          const dec = new TextDecoder();
          let stdoutText = ""; let stderrText = "";
          const consume = async (stream: ReadableStream<Uint8Array> | null, isStdout = true) => {
            if (!stream) return;
            const r = stream.getReader();
            try {
              while (true) {
                const { value, done } = await r.read();
                if (done) break;
                const chunk = dec.decode(value);
                if (isStdout) stdoutText += chunk; else stderrText += chunk;
              }
            } finally { r.releaseLock(); }
          };
          const outP = consume(child.stdout ?? null, true);
          const errP = consume(child.stderr ?? null, false);
          const statusPromise = child.status;
          const timeoutMs = settings.ytDlpYouTubeTimeoutMs ?? 120000;
          const finished = await Promise.race([statusPromise, new Promise((resolve) => setTimeout(() => resolve({ timedOut: true }), timeoutMs))]);
          if ((finished as any)?.timedOut) {
            console.warn(`[CookieExtractor] single-spec yt-dlp timed out after ${timeoutMs}ms for ${specKey}. Killing.`);
            try { child.kill("SIGTERM"); } catch (_e) { try { child.kill(); } catch { } }
            try { await statusPromise; } catch (_) { }
          } else { await outP; await errP; }
          // Read cookie file
          try {
            const fileText = await Deno.readTextFile(cookieFile);
            // parse all cookies (no domain filter)
            return parseNetscapeCookieFile(fileText);
          } finally {
            try { await secureDeleteFile(cookieFile); } catch (_e) { try { await Deno.remove(cookieFile); } catch { } }
            try { await Deno.remove(tempDir, { recursive: true }); } catch (_e) { }
          }
        } catch (e) {
          console.warn(`[CookieExtractor] single-spec yt-dlp failed for ${specKey}: ${e}`);
          throw e;
        }
      })();
      _fileFallbackSpecInFlight.set(specKey, runSingle);
      try {
        const allCookies = await runSingle;
        _fileFallbackSpecAttempted.set(specKey, Date.now());
        _fileFallbackSpecInFlight.delete(specKey);

        const out: Record<string, Cookie[]> = {};
        for (const d of domainsSorted) {
          out[d] = allCookies.filter((c) => c.domain === d || c.domain.endsWith(`.${d}`));
        }
        if (domainsSorted.every((d) => (out[d] ?? []).length > 0)) {
          for (const d of domainsSorted) _fileFallbackAttempted.set(`${spec}:${d}:${profile ?? ""}`, Date.now());
          return out;
        }
        // else fallback to per-domain
      } catch (e) {
        _fileFallbackSpecAttempted.set(specKey, Date.now());
        _fileFallbackSpecInFlight.delete(specKey);
        console.debug(`[CookieExtractor] single-spec extraction failed or timed out for ${specKey}: ${e}`);
      }
    }
  }

  // Launch per-domain yt-dlp processes serially (each uses its own temp file)
  const interDomainDelayMs = 300; // ms between serial domain attempts to avoid lock contention
  const perResults: Array<{ domain: string; cookies: Cookie[] }> = [];
  for (const d of domainsSorted) {
    // Deduplicate per-domain concurrent calls
    const key = `${spec}:${d}:${profile ?? ""}`;
    const existing = _inflightDomainExtractions.get(key);
    if (existing) {
      console.debug(`[CookieExtractor] Reusing inflight per-domain extraction for ${key} (serial)`);
      const arr = await existing;
      perResults.push({ domain: d, cookies: arr });
      // slight delay to avoid immediate subsequent contention
      await new Promise((resolve) => setTimeout(resolve, interDomainDelayMs));
      continue;
    }
    const promise = (async () => {
      const key = `${spec}:${d}:${profile ?? ""}`;
      // Deduplicate per-domain concurrent calls
      const existing = _inflightDomainExtractions.get(key);
      if (existing) {
        console.debug(`[CookieExtractor] Reusing inflight per-domain extraction for ${key}`);
        const arr = await existing;
        return { domain: d, cookies: arr } as { domain: string; cookies: Cookie[] };
      }
      const promise = (async () => {
        const perTempDir = await Deno.makeTempDir({ dir: cacheDir, prefix: `botnama-ytdlp-${d.replace(/[^a-zA-Z0-9]/g, "_")}-` });
        const perCookieFile = join(perTempDir, "cookies.txt");
        // Use a neutral fast target for per-domain extraction as well, because
        // yt-dlp's --cookies-from-browser can read the browser's cookie DB even
        // if the target URL is unrelated. This helps avoid extra wait/timeouts.
        const hostUrl = "https://example.com/";
        const perArgs = ["--no-warnings", "-q", "--no-playlist", "--skip-download", "--simulate", "--cookies", perCookieFile, "--cookies-from-browser", spec, hostUrl];
        console.debug(`[CookieExtractor] per-domain targetUrl=${hostUrl} domain=${d} args=${perArgs.join(" ")}`);
        if (settings.ytDlpUserAgent) perArgs.unshift("--user-agent", settings.ytDlpUserAgent);
        const attempts = d.includes("youtube.com") ? 2 : 1;
        for (let attempt = 1; attempt <= attempts; attempt++) {
          try {
            const cmd = new Deno.Command(settings.ytDlpPath, { args: perArgs, stdout: "piped", stderr: "piped", stdin: "null" });
            const startTs = Date.now();
            const child = cmd.spawn();
            console.debug(`[CookieExtractor] serial yt-dlp spawn pid=${(child as any).pid ?? '(unknown)'} target=${d} attempt=${attempt}/${attempts} startTs=${startTs}`);
            const decoder = new TextDecoder();
            let stdoutText = "";
            let stderrText = "";
            const consume = async (stream: ReadableStream<Uint8Array> | null, isStdout = true) => {
              if (!stream) return;
              const reader = stream.getReader();
              try {
                while (true) {
                  const { value, done } = await reader.read();
                  if (done) break;
                  const chunk = decoder.decode(value);
                  if (isStdout) stdoutText += chunk; else stderrText += chunk;
                }
              } finally { reader.releaseLock(); }
            };
            const outP = consume(child.stdout ?? null, true);
            const errP = consume(child.stderr ?? null, false);
            const statusPromise = child.status;
            let maxWaitMs = settings.ytDlpPerDomainTimeoutMs ?? 15000;
            if (d.includes("youtube.com")) maxWaitMs = settings.ytDlpYouTubeTimeoutMs ?? 120000;
            const finished = await Promise.race([
              statusPromise,
              new Promise((resolve) => setTimeout(() => resolve({ timedOut: true }), maxWaitMs)),
            ]);
            if ((finished as any)?.timedOut) {
              console.warn(`[CookieExtractor] parallel yt-dlp timed out after ${maxWaitMs}ms for ${d}. Killing process.`);
              if (stdoutText) console.debug(`[CookieExtractor] yt-dlp stdout sample:${stdoutText.substring(0, 200)}`);
              if (stderrText) console.debug(`[CookieExtractor] yt-dlp stderr sample:${stderrText.substring(0, 200)}`);
              try { child.kill("SIGTERM"); } catch (_e) { try { child.kill(); } catch { } }
              try { await statusPromise; } catch (_) { }
            } else {
              await outP; await errP;
            }
            // Read cookie file for this domain
            try {
              const fileText = await Deno.readTextFile(perCookieFile);
              const cookies = parseNetscapeCookieFile(fileText, d);
              if (cookies && cookies.length > 0) {
                console.debug(`[CookieExtractor] per-domain success for ${d}: found ${cookies.length} cookies in ${Date.now() - startTs}ms`);
                try { _fileFallbackAttempted.set(`${spec}:${d}:${profile ?? ""}`, Date.now()); } catch (_e) { }
                return { domain: d, cookies };
              }
              // no cookies - if more attempts remain, continue; else break and return empty
              if (attempt < attempts) {
                console.debug(`[CookieExtractor] no cookies found for ${d} on attempt ${attempt}; retrying...`);
                try { console.debug(`[CookieExtractor] yt-dlp stderr sample for ${d}: ${stderrText?.substring(0, 1000)}`); } catch (_e) { }
                try { console.debug(`[CookieExtractor] yt-dlp stdout sample for ${d}: ${stdoutText?.substring(0, 1000)}`); } catch (_e) { }
                try { await secureDeleteFile(perCookieFile); } catch (_e) { try { await Deno.remove(perCookieFile); } catch { } }
                try { await Deno.remove(perTempDir, { recursive: true }); } catch (_e) { }
                continue;
              }
              try { _fileFallbackAttempted.set(`${spec}:${d}:${profile ?? ""}`, Date.now()); } catch (_e) { }
              return { domain: d, cookies: [] };
            } catch (e) {
              if (attempt < attempts) {
                console.debug(`[CookieExtractor] Failed to read per-domain cookie file for ${d} on attempt ${attempt}: ${e}; retrying.`);
                try { console.debug(`[CookieExtractor] yt-dlp stderr sample for ${d}: ${stderrText?.substring(0, 1000)}`); } catch (_e) { }
                try { console.debug(`[CookieExtractor] yt-dlp stdout sample for ${d}: ${stdoutText?.substring(0, 1000)}`); } catch (_e) { }
                try { await secureDeleteFile(perCookieFile); } catch (_e) { try { await Deno.remove(perCookieFile); } catch { } }
                try { await Deno.remove(perTempDir, { recursive: true }); } catch (_e) { }
                continue;
              }
              try { _fileFallbackAttempted.set(`${spec}:${d}:${profile ?? ""}`, Date.now()); } catch (_e) { }
              try { console.debug(`[CookieExtractor] yt-dlp stderr sample for ${d}: ${stderrText?.substring(0, 1000)}`); } catch (_e) { }
              try { console.debug(`[CookieExtractor] yt-dlp stdout sample for ${d}: ${stdoutText?.substring(0, 1000)}`); } catch (_e) { }
              console.warn(`[CookieExtractor] Failed to read per-domain cookie file for ${d}: ${e}`);
              console.debug(`[CookieExtractor] per-domain attempt for ${d} ended in ${Date.now() - startTs}ms`);
              return { domain: d, cookies: [] };
            } finally {
              try { await secureDeleteFile(perCookieFile); } catch (_e) { try { await Deno.remove(perCookieFile); } catch { } }
              try { await Deno.remove(perTempDir, { recursive: true }); } catch (_e) { }
            }
          } catch (e) {
            // failure launching or setup; if more attempts remain, retry, else set attempted and return empty
            console.warn(`[CookieExtractor] per-domain attempt for ${d} failed on attempt: ${e}`);
            if (attempt < attempts) {
              continue;
            }
            try { _fileFallbackAttempted.set(`${spec}:${d}:${profile ?? ""}`, Date.now()); } catch (_e) { }
            return { domain: d, cookies: [] };
          }
        }
        // Shouldn't reach here, but return empty as fallback
        try { _fileFallbackAttempted.set(`${spec}:${d}:${profile ?? ""}`, Date.now()); } catch (_e) { }
        return { domain: d, cookies: [] };
      })();
      _inflightDomainExtractions.set(key, promise.then((p) => p.cookies));
      try {
        const p = await promise;
        return p;
      } finally {
        _inflightDomainExtractions.delete(key);
      }
    })();
    _inflightDomainExtractions.set(key, promise.then((p) => p.cookies));
    try {
      const p = await promise;
      perResults.push(p);
    } finally {
      _inflightDomainExtractions.delete(key);
    }
    await new Promise((resolve) => setTimeout(resolve, interDomainDelayMs));
  }
  const result: Record<string, Cookie[]> = {};
  for (const r of perResults) result[r.domain] = r.cookies;
  // We intentionally set per-domain attempt in per-domain logic below so wrapper will be skipped next time.
  return result;
}

export async function getCookieValue(browser: string, domain: string, cookieName: string, profile?: string, forceRefresh = false): Promise<string | null> {
  const cookies = await getBrowserCookies(browser, domain, profile, forceRefresh);
  const cookie = cookies.find((c) => c.name === cookieName);
  return cookie?.value ?? null;
}

export function cookiesToHeader(cookies: Cookie[]): string {
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

async function secureDeleteFile(path: string) {
  try {
    // If path doesn't exist, nothing to do
    if (!(await exists(path))) return;
    const stat = await Deno.stat(path);
    const size = stat.size ?? 0;
    if (size > 0) {
      // Cap the buffer size to avoid excessive memory use
      const MAX_CHUNK = 1024 * 1024; // 1MiB
      const bufferSize = Math.min(MAX_CHUNK, size);
      const buf = new Uint8Array(bufferSize);
      // One pass overwrite with random data
      // Fill buffer with random via Web Crypto API
      try { crypto.getRandomValues(buf); } catch (_e) { for (let i = 0; i < buf.length; i++) buf[i] = 0; }
      const file = await Deno.open(path, { write: true });
      try {
        let written = 0;
        while (written < size) {
          const toWrite = Math.min(bufferSize, size - written);
          await file.write(buf.subarray(0, toWrite));
          written += toWrite;
        }
        try { await file.sync(); } catch (_) { }
      } finally {
        file.close();
      }
    }
    await Deno.remove(path);
  } catch (e) {
    console.warn(`[CookieExtractor] secureDeleteFile failed: ${e}`);
  }
}

export async function cleanupOldTempFiles() {
  const settings = loadServerSettings();
  const cacheDir = settings.cacheDir ?? "cache";
  try {
    if (!(await exists(cacheDir))) return;
    for await (const entry of Deno.readDir(cacheDir)) {
      if (entry.isDirectory && entry.name.startsWith("botnama-ytdlp-")) {
        const path = join(cacheDir, entry.name);
        try {
          console.debug(`[CookieExtractor] Cleaning up old temp dir: ${path}`);
          await Deno.remove(path, { recursive: true });
        } catch (e) {
          console.warn(`[CookieExtractor] Failed to cleanup old temp dir ${path}: ${e}`);
        }
      }
    }
  } catch (e) {
    console.warn(`[CookieExtractor] cleanupOldTempFiles failed: ${e}`);
  }
}

