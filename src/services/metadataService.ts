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
  const args = ["--dump-json", "--skip-download", ...buildCookieArgs(settings), url];
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
    const data = JSON.parse(text);
    const uploadDateStr = typeof data.upload_date === "string" ? data.upload_date : null;
    const uploadDate = uploadDateStr && /^\d{8}$/.test(uploadDateStr)
      ? Date.UTC(
        Number(uploadDateStr.slice(0, 4)),
        Number(uploadDateStr.slice(4, 6)) - 1,
        Number(uploadDateStr.slice(6, 8)),
      )
      : null;
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
    };
  } catch (err) {
    console.error("[metadata] parse failed", err);
    return null;
  }
};
