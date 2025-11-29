import { ServerSettings } from "../types.ts";
export interface VideoMeta {
  title: string | null;
  duration: number | null;
  uploader: string | null;
  uploadDate: number | null; // ms
  viewCount: number | null;
  likeCount: number | null;
  dislikeCount: number | null;
  commentCount: number | null;
  mylistCount: number | null;
  favoriteCount: number | null;
  danmakuCount: number | null;
  thumbnail: string | null;
}

const buildCookieArgs = (settings: ServerSettings) => {
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
};

export const fetchVideoMetadata = async (
  url: string,
  settings: ServerSettings,
): Promise<VideoMeta | null> => {
  // sanitize URL similar to download worker to avoid resolving playlists
  const sanitizedUrl = (() => {
    try {
      const u = new URL(url);
      const params = u.searchParams;
      params.delete("list");
      params.delete("start_radio");
      params.delete("pp");
      u.search = params.toString();
      return u.toString();
    } catch (_err) {
      return url;
    }
  })();

  const args = ["--dump-json", "--skip-download", "--no-playlist", ...buildCookieArgs(settings), sanitizedUrl];
  const command = new Deno.Command(settings.ytDlpPath, {
    args,
    stdout: "piped",
    stderr: "piped",
  });
  const output = await command.output().catch((err) => {
    console.error("[metadata] yt-dlp failed", err);
    return null;
  });
  if (!output || output.code !== 0) {
    console.error(new TextDecoder().decode(output?.stderr ?? new Uint8Array()));
    return null;
  }
  try {
    const text = new TextDecoder().decode(output.stdout);
    const data = parseFirstJsonObject(text);
    if (!data) throw new Error("metadata json not found");
    const uploadDateStr = typeof data.upload_date === "string" ? data.upload_date : null;
    const uploadDate = uploadDateStr && /^\d{8}$/.test(uploadDateStr)
      ? Date.UTC(
        Number(uploadDateStr.slice(0, 4)),
        Number(uploadDateStr.slice(4, 6)) - 1,
        Number(uploadDateStr.slice(6, 8)),
      )
      : null;
    // determine thumbnail url — prefer 'thumbnails' array largest entry or 'thumbnail'
    let thumbnail: string | null = null;
    try {
      if (Array.isArray(data.thumbnails) && data.thumbnails.length > 0) {
        // pick the largest width if available
        const best = data.thumbnails.reduce((prev: any, cur: any) => {
          const pw = typeof prev?.width === "number" ? prev.width : 0;
          const cw = typeof cur?.width === "number" ? cur.width : 0;
          return cw > pw ? cur : prev;
        });
        thumbnail = best?.url ?? null;
      } else if (typeof data.thumbnail === "string") {
        thumbnail = data.thumbnail;
      }
    } catch (_err) {
      thumbnail = null;
    }

    return {
      title: data.title ?? null,
      duration: typeof data.duration === "number" ? data.duration : null,
      uploader: data.uploader ?? data.channel ?? null,
      uploadDate,
      viewCount: typeof data.view_count === "number" ? data.view_count : null,
      likeCount: typeof data.like_count === "number" ? data.like_count : null,
      dislikeCount: typeof data.dislike_count === "number" ? data.dislike_count : null,
      commentCount: typeof data.comment_count === "number" ? data.comment_count : null,
      mylistCount: typeof data.niconico_mylist_count === "number"
        ? data.niconico_mylist_count
        : null,
      favoriteCount: typeof data.like_count === "number" ? data.like_count : null,
      danmakuCount: typeof data.danmaku_count === "number" ? data.danmaku_count : null,
      thumbnail,
    };
  } catch (err) {
    console.error("[metadata] parse failed", err);
    return null;
  }
};

const parseFirstJsonObject = (raw: string) => {
  if (!raw) return null;
  const trimmed = raw.trimStart();
  const start = trimmed.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === "\\") {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") {
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0) {
        const slice = trimmed.slice(start, i + 1);
        try {
          return JSON.parse(slice);
        } catch (_err) {
          break;
        }
      }
    }
  }
  return null;
};
