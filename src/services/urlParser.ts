import { ParsedUrl } from "../types.ts";

const urlRegex = /(https?:\/\/[^\s]+)/gi;
const YOUTUBE_ID_REGEXES = [
  /watch\?v=([A-Za-z0-9_-]{11})/i,
  /youtu\.be\/([A-Za-z0-9_-]{11})/i,
  /shorts\/([A-Za-z0-9_-]+)/i,
  /live\/([A-Za-z0-9_-]+)/i,
];
const NICOVIDEO_ID_REGEX = /\b((?:sm|nm|so)\d+)\b/i;
// For URL path parsing, validate that the extracted ID is a supported video id
const NICOVIDEO_VIDEOID_PATH_REGEX = /^(?:sm|nm|so)\d+$/i;
const BILIBILI_BVID_INLINE_REGEX = /\b(BV[0-9A-Za-z]{10})\b/i;
const BILIBILI_AVID_INLINE_REGEX = /\b(av\d+)\b/i;
const BILIBILI_BVID_EXACT_REGEX = /^BV[0-9A-Za-z]{10}$/i;
const BILIBILI_AVID_EXACT_REGEX = /^av\d+$/i;
const BILIBILI_BVID_QUERY_REGEX = /bvid=(BV[0-9A-Za-z]{10})/i;

const matchesDomain = (hostname: string, domain: string) =>
  hostname === domain || hostname.endsWith(`.${domain}`);

const isYoutubeHostname = (hostname: string) => matchesDomain(hostname, "youtube.com");
const isYoutubeShortHostname = (hostname: string) => hostname === "youtu.be";
const isNicovideoHostname = (hostname: string) =>
  matchesDomain(hostname, "nicovideo.jp") || matchesDomain(hostname, "niconico.com");
const isNicovideoShortHostname = (hostname: string) => hostname === "nico.ms";
const isBilibiliHostname = (hostname: string) =>
  matchesDomain(hostname, "bilibili.com") || matchesDomain(hostname, "bilibili.tv");

const isWhitelistedHost = (hostname: string) =>
  isYoutubeHostname(hostname) ||
  isYoutubeShortHostname(hostname) ||
  isNicovideoHostname(hostname) ||
  isNicovideoShortHostname(hostname) ||
  isBilibiliHostname(hostname);
const shorten = (url: string) => {
  if (url.length <= 60) return url;
  return `${url.slice(0, 40)}...${url.slice(-8)}`;
};

const normalizeYoutubeId = (url: URL) => {
  const hostname = url.hostname.toLowerCase();
  const pathSegments = url.pathname.split("/").filter(Boolean);
  const isYoutubeHost = isYoutubeHostname(hostname);

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

const normalizeBilibiliVideoId = (value: string | null) => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (BILIBILI_BVID_EXACT_REGEX.test(trimmed)) {
    // Preserve original casing except force leading "BV"
    return trimmed.replace(/^bv/, "BV");
  }
  if (BILIBILI_AVID_EXACT_REGEX.test(trimmed)) {
    return `av${trimmed.slice(2)}`;
  }
  return null;
};

const buildBilibiliParsedUrl = (videoId: string | null, rawUrl?: string): ParsedUrl | null => {
  const normalizedId = normalizeBilibiliVideoId(videoId);
  if (!normalizedId) return null;
  const normalizedUrl = `https://www.bilibili.com/video/${normalizedId}`;
  return {
    rawUrl: rawUrl ?? normalizedUrl,
    normalizedUrl,
    videoId: normalizedId,
    site: "bilibili",
  };
};

const findBilibiliVideoId = (text: string | null) => {
  if (!text) return null;
  const bvMatch = text.match(BILIBILI_BVID_INLINE_REGEX);
  if (bvMatch && bvMatch[1]) {
    return bvMatch[1];
  }
  const bvidQueryMatch = text.match(BILIBILI_BVID_QUERY_REGEX);
  if (bvidQueryMatch && bvidQueryMatch[1]) {
    return bvidQueryMatch[1];
  }
  const avMatch = text.match(BILIBILI_AVID_INLINE_REGEX);
  if (avMatch && avMatch[1]) {
    return avMatch[1];
  }
  return null;
};

const buildAvidCandidate = (value: string | null) => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return /^av/i.test(trimmed) ? trimmed : `av${trimmed}`;
};

export const parseRequestUrl = (message: string): ParsedUrl | null => {
  const matches = message.match(urlRegex);
  if (matches) {
    for (const rawUrl of matches) {
      if (!rawUrl) continue;
      const parsed = buildParsedUrlFromFullUrl(rawUrl);
      if (parsed) return parsed;
    }
  }

  const fallbackYoutube = extractYoutubeFromPlainText(message);
  if (fallbackYoutube) {
    return fallbackYoutube;
  }

  const fallbackBilibili = extractBilibiliFromPlainText(message);
  if (fallbackBilibili) {
    return fallbackBilibili;
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
    if (!isWhitelistedHost(hostname)) {
      return null;
    }
    if (isYoutubeHostname(hostname) || isYoutubeShortHostname(hostname)) {
      const videoId = normalizeYoutubeId(url);
      if (!videoId) return null;
      return {
        rawUrl,
        normalizedUrl: `https://www.youtube.com/watch?v=${videoId}`,
        videoId,
        site: "youtube",
      };
    }
    if (isBilibiliHostname(hostname)) {
      const bilibiliCandidates = [
        findBilibiliVideoId(url.pathname),
        url.searchParams.get("bvid"),
        url.searchParams.get("bvids"),
        buildAvidCandidate(url.searchParams.get("avid")),
        buildAvidCandidate(url.searchParams.get("aid")),
      ];
      for (const candidate of bilibiliCandidates) {
        const parsed = buildBilibiliParsedUrl(candidate, rawUrl);
        if (parsed) return parsed;
      }
      return null;
    }
    if (isNicovideoHostname(hostname) || isNicovideoShortHostname(hostname)) {
      const videoId = url.pathname.split("/").filter(Boolean).pop();
      if (!videoId) return null;
      // Ensure only supported nicovideo video IDs are accepted (sm/nm/so).
      // Reject live IDs like `lv...` explicitly to avoid misclassification.
      if (!NICOVIDEO_VIDEOID_PATH_REGEX.test(videoId)) return null;
      const normalizedUrl = isNicovideoShortHostname(hostname)
        ? `https://www.nicovideo.jp/watch/${videoId}`
        : url.toString();
      return {
        rawUrl,
        normalizedUrl,
        videoId,
        site: "nicovideo",
      };
    }
    return null;
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

const extractBilibiliFromPlainText = (message: string): ParsedUrl | null => {
  const candidate = findBilibiliVideoId(message);
  if (!candidate) return null;
  return buildBilibiliParsedUrl(candidate);
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
