import { ParsedUrl } from "../types.ts";

const urlRegex = /(https?:\/\/[^\s]+)/i;
const YOUTUBE_ID_REGEXES = [
  /watch\?v=([A-Za-z0-9_-]{11})/i,
  /youtu\.be\/([A-Za-z0-9_-]{11})/i,
  /shorts\/([A-Za-z0-9_-]+)/i,
  /live\/([A-Za-z0-9_-]+)/i,
];
const NICOVIDEO_ID_REGEX = /\b((?:sm|nm|so)\d+)\b/i;

const shorten = (url: string) => {
  if (url.length <= 60) return url;
  return `${url.slice(0, 40)}...${url.slice(-8)}`;
};

const normalizeYoutubeId = (url: URL) => {
  const hostname = url.hostname.toLowerCase();
  const pathSegments = url.pathname.split("/").filter(Boolean);
  const isYoutubeHost = hostname === "youtube.com" || hostname.endsWith(".youtube.com");

  if (isYoutubeHost) {
    const id = url.searchParams.get("v");
    if (id) return id;
    if (pathSegments[0] === "shorts" && pathSegments[1]) {
      return pathSegments[1];
    }
    if (pathSegments[0] === "live" && pathSegments[1]) {
      return pathSegments[1];
    }
  }
  if (hostname === "youtu.be") {
    const id = pathSegments[0];
    return id && id.length > 0 ? id : null;
  }
  return null;
};

export const parseRequestUrl = (message: string): ParsedUrl | null => {
  const match = message.match(urlRegex);
  if (match) {
    const rawUrl = match[1];
    const parsed = buildParsedUrlFromFullUrl(rawUrl);
    if (parsed) return parsed;
  }

  const fallbackYoutube = extractYoutubeFromPlainText(message);
  if (fallbackYoutube) {
    return fallbackYoutube;
  }

  const fallbackNico = extractNicoFromPlainText(message);
  if (fallbackNico) {
    return fallbackNico;
  }

  return null;
};

const buildParsedUrlFromFullUrl = (rawUrl: string): ParsedUrl | null => {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    const hostname = url.hostname.toLowerCase();
    if (hostname.includes("youtube.com") || hostname === "youtu.be") {
      const videoId = normalizeYoutubeId(url);
      if (!videoId) return null;
      return {
        rawUrl,
        normalizedUrl: `https://www.youtube.com/watch?v=${videoId}`,
        videoId,
        site: "youtube",
      };
    }
    if (hostname.includes("nicovideo.jp") || hostname.includes("niconico.com")) {
      return {
        rawUrl,
        normalizedUrl: url.toString(),
        videoId: url.pathname.split("/").filter(Boolean).pop() ?? url.toString(),
        site: "nicovideo",
      };
    }
    return {
      rawUrl,
      normalizedUrl: url.toString(),
      videoId: url.toString(),
      site: "other",
    };
  } catch (_err) {
    return null;
  }
};

const extractYoutubeFromPlainText = (message: string): ParsedUrl | null => {
  for (const regex of YOUTUBE_ID_REGEXES) {
    const found = message.match(regex);
    if (found && found[1]) {
      const videoId = found[1];
      const normalizedUrl = `https://www.youtube.com/watch?v=${videoId}`;
      return {
        rawUrl: normalizedUrl,
        normalizedUrl,
        videoId,
        site: "youtube",
      };
    }
  }
  return null;
};

const extractNicoFromPlainText = (message: string): ParsedUrl | null => {
  const match = message.match(NICOVIDEO_ID_REGEX);
  if (!match || !match[1]) return null;
  const id = match[1].toLowerCase();
  let normalizedId = id;
  if (id.startsWith("nm") || id.startsWith("so")) {
    normalizedId = `sm${id.replace(/^(nm|so)/, "")}`;
  }
  const normalizedUrl = `https://www.nicovideo.jp/watch/${normalizedId}`;
  return {
    rawUrl: normalizedUrl,
    normalizedUrl,
    videoId: normalizedId,
    site: "nicovideo",
  };
};

export const formatUrlForDisplay = (url: string) => shorten(url);
