// YouTube browser cookie-based authentication and Live API Service
import { TokenStore } from "./tokenStore.ts";
import { getBrowserCookies, cookiesToHeader } from "./cookieExtractor.ts";
import { loadServerSettings } from "../settings.ts";

interface YouTubeConfig {
    // No config needed for cookie-based auth
}

export interface YouTubeBroadcast {
    id: string;
    title: string;
    description: string;
    channelId: string;
    channelTitle: string;
    scheduledStartTime: string;
    actualStartTime?: string;
    actualEndTime?: string;
    viewerCount?: number;
}

export interface YouTubeComment {
    id: string;
    authorName: string;
    authorChannelId: string;
    text: string;
    publishedAt: string;
}

export class MissingYouTubeCookiesConfigError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "MissingYouTubeCookiesConfigError";
    }
}

export class YouTubeService {
    private tokenStore: TokenStore;
    private cachedCookieHeader: { value: string; fetchedAt: number } | null = null;
    private readonly cookieTtlMs = 15 * 60 * 1000; // 15 minutes
    private cachedChatApiKey: string | null = null;
    private cachedChatContext: any = null;
    private cachedChatVisitor: string | null = null;
    private lastLoggedChannelUrl: string | null = null;
    private lastLoggedBroadcastId: string | null = null;
    private myChannelId: string | null = null;
    private validatedChannelIds = new Set<string>();
    private missingCookiesLoggedAt: number | null = null;

    private async validateChannelId(channelId: string): Promise<boolean> {
        if (!channelId.startsWith("UC") || channelId.length < 10) return false;
        if (this.validatedChannelIds.has(channelId)) return true;
        const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
        try {
            const res = await fetch(feedUrl, { method: "HEAD" });
            if (res.ok) {
                this.validatedChannelIds.add(channelId);
                return true;
            }
        } catch (_err) {
            // ignore network errors; treat as invalid
        }
        return false;
    }

    constructor(_config: YouTubeConfig, tokenStore: TokenStore) {
        this.tokenStore = tokenStore;
    }

    // OAuth stubs for compatibility with legacy routes; the cookie-based service does not support OAuth.
    public getAuthorizationUrl(_state: string): string {
        throw new Error("OAuth login not supported for cookie-based YouTube service");
    }

    public async exchangeCodeForTokens(_code: string): Promise<void> {
        throw new Error("OAuth exchange not supported for cookie-based YouTube service");
    }

    // Allow setting a cached cookie header (used by server bootstrap) to avoid redundant extractions
    public setCachedCookieHeader(value: string | null) {
        if (!value) {
            this.cachedCookieHeader = null;
            return;
        }
        this.cachedCookieHeader = { value, fetchedAt: Date.now() };
    }

    // Get YouTube cookies from browser
    private async getYouTubeCookies(forceRefresh = false, requireAuth = true): Promise<string | null> {
        const now = Date.now();
        if (!forceRefresh && this.cachedCookieHeader && now - this.cachedCookieHeader.fetchedAt < this.cookieTtlMs) {
            return this.cachedCookieHeader.value;
        }

        const settings = loadServerSettings();

        if (!settings.youtubeCookiesFrom) {
            const message =
                "YOUTUBE_COOKIES_FROM is not configured. Set youtubeCookiesFrom in settings.toml or BOTNAMA_YOUTUBE_COOKIES_FROM env.";
            if (!this.missingCookiesLoggedAt || now - this.missingCookiesLoggedAt > this.cookieTtlMs) {
                console.warn("[YouTubeService] youtubeCookiesFrom not set; polling stays disabled until server restart.");
                this.missingCookiesLoggedAt = now;
            }
            if (requireAuth) {
                throw new MissingYouTubeCookiesConfigError(message);
            }
            return null;
        }

        try {
            console.debug(`[YouTubeService] Using cookie source: ${settings.youtubeCookiesFrom} profile:${settings.youtubeCookiesProfile ?? "(none)"} forceRefresh=${forceRefresh}`);
            const cookies = await getBrowserCookies(
                settings.youtubeCookiesFrom,
                "youtube.com",
                settings.youtubeCookiesProfile || undefined,
                forceRefresh,
            );

            if (cookies.length === 0) {
                console.warn(`No YouTube cookies found in ${settings.youtubeCookiesFrom} browser`);
                if (requireAuth) {
                    throw new Error("No YouTube cookies found in browser");
                }
                return null;
            }

            const header = cookiesToHeader(cookies);
            console.debug(`[YouTubeService] Extracted ${cookies.length} cookies; header length=${header.length}`);
            this.cachedCookieHeader = { value: header, fetchedAt: now };
            return header;
        } catch (error) {
            const err = error as Error;
            console.error(`Failed to extract YouTube cookie from browser:`, err);
            if (requireAuth) {
                throw new Error(`Failed to get YouTube cookies: ${err.message}`);
            }
            return null;
        }
    }

    // Get broadcast info (simplified - would use YouTube Live Streaming API)
    async getBroadcast(broadcastId: string, forceRefresh = false): Promise<YouTubeBroadcast> {
        const cookies = await this.getYouTubeCookies(forceRefresh, false);

        // Note: This is simplified. Real implementation would use:
        // YouTube Live Streaming API v3 with cookie-based auth
        // or scrape from the page HTML

        const response = await fetch(`https://www.youtube.com/watch?v=${broadcastId}`, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                ...(cookies ? { "Cookie": cookies } : {}),
            },
        });

        if (!response.ok) {
            throw new Error(`Failed to get broadcast info: ${response.statusText}`);
        }

        // Would parse from HTML or use API
        return {
            id: broadcastId,
            title: "Live Stream",
            description: "",
            channelId: "",
            channelTitle: "",
            scheduledStartTime: new Date().toISOString(),
        };
    }

    // Get chat messages
    async getChatMessages(liveChatIdOrVideoId: string, pageToken?: string): Promise<{ items: YouTubeComment[], nextPageToken?: string }> {
        const cookies = await this.getYouTubeCookies(false, false);
        let continuation: string | null = pageToken ?? null;
        let apiKey: string | null = this.cachedChatApiKey;
        let context: any = this.cachedChatContext;
        let visitorData: string | null = this.cachedChatVisitor;
        let attemptedRefresh = false;

        try {
            const fetchChatPage = async (videoId: string) => {
                const chatUrl = `https://www.youtube.com/live_chat?is_popout=1&v=${videoId}`;
                const chatPageRes = await fetch(chatUrl, {
                    headers: {
                        ...(cookies ? { "Cookie": cookies } : {}),
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                        "Accept-Language": "ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7",
                    },
                });
                if (!chatPageRes.ok) {
                    throw new Error(`Failed to fetch chat page: ${chatPageRes.status}`);
                }
                const html = await chatPageRes.text();
                const parsed = this.parseChatPage(html);
                apiKey = parsed.apiKey ?? apiKey;
                context = parsed.context ?? context;
                visitorData = parsed.visitorData ?? visitorData;
                continuation = parsed.continuation ?? continuation;
                this.cachedChatApiKey = apiKey;
                this.cachedChatContext = context;
                this.cachedChatVisitor = visitorData;
            };

            // If we don't have a continuation token, we need to fetch the initial one from the page
            if (!continuation) {
                const videoId = liveChatIdOrVideoId; // Assume it's a video ID for the first call
                await fetchChatPage(videoId);
            }

            if (!continuation) {
                console.warn("[YouTube] No continuation token found. Stream might be offline or no chat.");
                return { items: [] };
            }

            // If we didn't get apiKey/context/visitor from cache or page, try a quick fetch to homepage
            if (!apiKey || !context) {
                const homeRes = await fetch("https://www.youtube.com", { headers: cookies ? { "Cookie": cookies } : {} });
                const homeHtml = await homeRes.text();
                const parsed = this.parseChatPage(homeHtml);
                apiKey = apiKey ?? parsed.apiKey;
                context = context ?? parsed.context;
                visitorData = visitorData ?? parsed.visitorData;
                this.cachedChatApiKey = apiKey;
                this.cachedChatContext = context;
                this.cachedChatVisitor = visitorData;
            }

            if (!context) {
                context = {
                    client: {
                        clientName: "WEB",
                        clientVersion: "2.20241114.00.00",
                        hl: "ja",
                        gl: "JP",
                        visitorData: visitorData ?? undefined,
                        mainAppWebInfo: { webDisplayMode: "WEB_DISPLAY_MODE_BROWSER" },
                    },
                };
            }
            if (visitorData && context?.client && !context.client.visitorData) {
                context.client.visitorData = visitorData;
            }

            if (!apiKey) throw new Error("Could not find INNERTUBE_API_KEY");

            // Call get_live_chat (with single retry on auth/context failure)
            let data: any = null;
            for (;;) {
                const apiUrl = `https://www.youtube.com/youtubei/v1/live_chat/get_live_chat?key=${apiKey}`;
                const payload = {
                    context: context,
                    continuation: continuation,
                };

                const apiRes = await fetch(apiUrl, {
                    method: "POST",
                    headers: {
                        ...(cookies ? { "Cookie": cookies } : {}),
                        "Content-Type": "application/json",
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                        "Origin": "https://www.youtube.com",
                        "Referer": "https://www.youtube.com",
                        "Accept-Language": "ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7",
                        ...(visitorData ? { "X-Goog-Visitor-Id": visitorData } : {}),
                        ...(context?.client?.clientVersion ? { "X-Youtube-Client-Version": context.client.clientVersion } : {}),
                        "X-Youtube-Client-Name": "1",
                    },
                    body: JSON.stringify(payload),
                });

                if (apiRes.ok) {
                    data = await apiRes.json();
                    break;
                }

                // If auth/context likely stale, clear caches once and retry
                if (!attemptedRefresh && (apiRes.status === 401 || apiRes.status === 403)) {
                    attemptedRefresh = true;
                    this.cachedChatApiKey = null;
                    this.cachedChatContext = null;
                    this.cachedChatVisitor = null;
                    apiKey = null;
                    context = null;
                    visitorData = null;
                    continuation = null;
                    await fetchChatPage(liveChatIdOrVideoId);
                    continue;
                }

                throw new Error(`get_live_chat failed: ${apiRes.status}`);
            }

            // Parse actions
            const items: YouTubeComment[] = [];
            const actions = data.continuationContents?.liveChatContinuation?.actions || [];

            for (const action of actions) {
                const item = action.addChatItemAction?.item;
                if (!item) continue;

                const renderer = item.liveChatTextMessageRenderer || item.liveChatPaidMessageRenderer;
                if (!renderer) continue;

                const text = renderer.message?.runs?.map((r: any) => r.text).join("") || "";
                const authorName = renderer.authorName?.simpleText || "";
                const authorId = renderer.authorExternalChannelId || "";
                const id = renderer.id || "";
                const publishedAt = renderer.timestampUsec ? new Date(Number(renderer.timestampUsec) / 1000).toISOString() : new Date().toISOString();

                items.push({
                    id,
                    authorName,
                    authorChannelId: authorId,
                    text,
                    publishedAt,
                });
            }

            // Get next continuation
            const nextContinuation = data.continuationContents?.liveChatContinuation?.continuations?.[0]?.timedContinuationData?.continuation
                || data.continuationContents?.liveChatContinuation?.continuations?.[0]?.invalidationContinuationData?.continuation
                || data.continuationContents?.liveChatContinuation?.continuations?.[0]?.reloadContinuationData?.continuation
                || data.continuationContents?.liveChatContinuation?.continuations?.[0]?.liveChatReplayContinuationData?.continuation;

            return { items, nextPageToken: nextContinuation };

        } catch (err) {
            console.error("[YouTube] getChatMessages failed:", err);
            return { items: [] };
        }
    }

    // Parse important values from a chat/watch/home HTML page
    private parseChatPage(html: string): { apiKey: string | null; context: any | null; continuation: string | null; visitorData: string | null } {
        const apiKeyMatch = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/);
        const apiKey = apiKeyMatch ? apiKeyMatch[1] : null;

        let context: any = null;
        // ytcfg.set("INNERTUBE_CONTEXT", {...});
        const ytcfgContext = html.match(/ytcfg\.set\("INNERTUBE_CONTEXT",(\{.*?\})\);/s);
        const inlineContext = html.match(/"INNERTUBE_CONTEXT":(\{.*?\}),"INNERTUBE/s);
        const contextSource = ytcfgContext ?? inlineContext;
        if (contextSource) {
            try {
                context = JSON.parse(contextSource[1]);
            } catch (_e) {
                // ignore parse errors and fall back to null
            }
        }

        const visitorMatch = html.match(/"VISITOR_DATA":"([^"]+)"/);
        const visitorData = visitorMatch ? visitorMatch[1] : null;

        // Extract initial continuation token (token or continuation field)
        // Prefer a continuation that sits near liveChatRenderer to avoid grabbing unrelated tokens
        let continuation: string | null = null;
        const nearLive = html.match(/liveChatRenderer[\s\S]{0,500}?"continuation":"([^"]+)"/);
        if (nearLive) continuation = nearLive[1];
        if (!continuation) {
            const match =
                html.match(/"continuation":"([^"]+)"/) ||
                html.match(/"continuationCommand":\s*\{\s*"token":"([^"]+)"/) ||
                html.match(/"reloadContinuationData":\{[^}]*"continuation":"([^"]+)"/);
            continuation = match ? match[1] : null;
        }

        return { apiKey, context, continuation, visitorData };
    }

    private cachedApiKey: string | null = null;
    private cachedContext: any = null;

    getMyChannelId(): string | null {
        return this.myChannelId;
    }

    // Build SAPISIDHASH auth header for YouTube internal APIs
    private async buildAuthHeaders(cookies: string, visitorData: string | null, context: any | null) {
        const origin = "https://www.youtube.com";
        const cookieMap = new Map<string, string>();
        for (const part of cookies.split(";")) {
            const idx = part.indexOf("=");
            if (idx === -1) continue;
            const key = part.slice(0, idx).trim();
            const val = part.slice(idx + 1).trim();
            cookieMap.set(key, val);
        }
        const sapisid =
            cookieMap.get("__Secure-3PAPISID") ??
            cookieMap.get("__Secure-1PAPISID") ??
            cookieMap.get("SAPISID") ??
            null;

        let authorization: string | null = null;
        if (sapisid) {
            const ts = Math.floor(Date.now() / 1000);
            const input = `${ts} ${sapisid} ${origin}`;
            const encoder = new TextEncoder();
            const data = encoder.encode(input);
            const digest = await crypto.subtle.digest("SHA-1", data);
            const hashArray = Array.from(new Uint8Array(digest));
            const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
            authorization = `${ts}_${hashHex}`;
        }

        const headers: Record<string, string> = {
            "Origin": origin,
            "X-Origin": origin,
            "X-Goog-AuthUser": "0",
            "Referer": origin,
            "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Cookie": cookies,
            "Content-Type": "application/json",
            "Accept-Language": "ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7",
            "X-Youtube-Client-Name": "1",
        };

        const clientVersion = context?.client?.clientVersion;
        if (clientVersion) headers["X-Youtube-Client-Version"] = clientVersion;
        if (visitorData) headers["X-Goog-Visitor-Id"] = visitorData;
        if (authorization) headers["Authorization"] = `SAPISIDHASH ${authorization}`;
        return headers;
    }

    // Send chat message (using internal API)
    async sendChatMessage(liveChatIdOrVideoId: string, message: string): Promise<void> {
        const cookies = await this.getYouTubeCookies();
        if (!cookies) {
            throw new Error("YouTube cookies are required to send chat messages.");
        }

        let videoId = liveChatIdOrVideoId;
        if (liveChatIdOrVideoId.length > 11) {
            console.warn("[YouTube] Input looks like a Live Chat ID, but we need a Video ID to fetch context. Attempting to use as Video ID anyway.");
        }

        console.log(`[YouTube] Attempting to send message to video/chat ${videoId}: ${message}`);

        try {
            let apiKey = this.cachedApiKey;
            let context = this.cachedContext;
            let params: string | null = null;
            let visitorData: string | null = this.cachedChatVisitor;
            let attemptedRefresh = false;

            // If we don't have cached values, or we need params (which we always do for now), fetch the page
            // Note: We might be able to cache params too if they are session-based, but for safety we fetch them.
            // However, fetching the page is slow.
            // Let's try to fetch only if we miss something.

            if (!apiKey || !context || !params) {
                const chatUrl = `https://www.youtube.com/live_chat?is_popout=1&v=${videoId}`;
                const chatPageRes = await fetch(chatUrl, {
                    headers: {
                        "Cookie": cookies,
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    },
                });

                if (!chatPageRes.ok) {
                    throw new Error(`Failed to fetch chat page: ${chatPageRes.status}`);
                }

                const html = await chatPageRes.text();

                const parsed = this.parseChatPage(html);
                apiKey = parsed.apiKey ?? apiKey;
                context = parsed.context ?? context;
                visitorData = parsed.visitorData ?? visitorData;
                // 4. Extract params
                const sendActionMatch = html.match(/"sendLiveChatMessageEndpoint":\s*\{\s*"params":\s*"([^"]+)"/);
                params = sendActionMatch ? sendActionMatch[1] : null;

                this.cachedApiKey = apiKey;
                if (context) this.cachedContext = context;
                if (visitorData) this.cachedChatVisitor = visitorData;
            }

            if (!params) throw new Error("Could not extract send message params from chat page");
            if (!apiKey) throw new Error("Could not extract INNERTUBE_API_KEY from chat page");
            if (!context) {
                context = {
                    client: {
                        clientName: "WEB",
                        clientVersion: "2.20231201.00.00",
                    },
                };
            }
            if (visitorData && context.client && !context.client.visitorData) {
                context.client.visitorData = visitorData;
            }

            // 5. Call send_message endpoint
            const sendUrl = `https://www.youtube.com/youtubei/v1/live_chat/send_message?key=${apiKey}`;
            const payload = {
                context: context,
                params: params,
                richMessage: {
                    textSegments: [{ text: message }]
                }
            };

            console.log("[YouTube] Sending message with apiKey:", apiKey);

            const authHeaders = await this.buildAuthHeaders(cookies, visitorData ?? null, context);

            let sendRes: Response;
            for (;;) {
                sendRes = await fetch(sendUrl, {
                    method: "POST",
                    headers: {
                        ...authHeaders,
                        "Referer": `https://www.youtube.com/live_chat?is_popout=1&v=${videoId}`,
                    },
                    body: JSON.stringify(payload),
                });

                if (sendRes.ok) break;

                if (!attemptedRefresh && (sendRes.status === 401 || sendRes.status === 403)) {
                    attemptedRefresh = true;
                    this.cachedApiKey = null;
                    this.cachedContext = null;
                    this.cachedChatVisitor = null;
                    apiKey = null;
                    context = null;
                    visitorData = null;
                    params = null;
                    // refetch chat page to refresh tokens/params
                    const chatUrl = `https://www.youtube.com/live_chat?is_popout=1&v=${videoId}`;
                    const chatPageRes = await fetch(chatUrl, {
                        headers: {
                            "Cookie": cookies,
                            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                        },
                    });
                    if (!chatPageRes.ok) {
                        throw new Error(`Failed to refresh chat page: ${chatPageRes.status}`);
                    }
                    const html = await chatPageRes.text();
                    const parsed = this.parseChatPage(html);
                    apiKey = parsed.apiKey;
                    context = parsed.context;
                    visitorData = parsed.visitorData ?? null;
                    const sendActionMatch = html.match(/"sendLiveChatMessageEndpoint":\s*\{\s*"params":\s*"([^"]+)"/);
                    params = sendActionMatch ? sendActionMatch[1] : null;
                    if (!apiKey || !context || !params) {
                        throw new Error("Failed to refresh chat params/apiKey/context after 401");
                    }
                    this.cachedApiKey = apiKey;
                    this.cachedContext = context;
                    this.cachedChatVisitor = visitorData;
                    payload.context = context;
                    payload.params = params;
                    const newAuth = await this.buildAuthHeaders(cookies, visitorData, context);
                    Object.assign(authHeaders, newAuth);
                    continue;
                }

                const errorText = await sendRes.text();
                throw new Error(`send_message failed (${sendRes.status}): ${errorText}`);
            }

            const data = await sendRes.json();
            console.log("[YouTube] Message sent successfully:", data);

        } catch (err) {
            console.error("[YouTube] sendChatMessage failed:", err);
            throw err;
        }
    }

    // Check if authenticated
    async isAuthenticated(forceRefresh = false): Promise<boolean> {
        try {
            await this.getYouTubeCookies(forceRefresh);
            return true;
        } catch {
            return false;
        }
    }

    async getMyChannelUrl(forceRefresh = false): Promise<string | null> {
        try {
            const cookies = await this.getYouTubeCookies(forceRefresh);
            if (!cookies) return null;

            if (!forceRefresh && this.lastLoggedChannelUrl) {
                return this.lastLoggedChannelUrl;
            }

            const fetchHtml = async (url: string) => {
                const res = await fetch(url, {
                    headers: {
                        "Cookie": cookies,
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    },
                });
                return res.ok ? res.text() : null;
            };

            // Try account_advanced first
            let html = await fetchHtml("https://www.youtube.com/account_advanced");
            if (!html) {
                html = await fetchHtml("https://www.youtube.com");
            }

            if (!html) return null;

            const match = html.match(/(UC[\w-]{22})/);
            if (match && await this.validateChannelId(match[1])) {
                const url = `https://www.youtube.com/channel/${match[1]}`;
                this.lastLoggedChannelUrl = url;
                this.myChannelId = match[1];
                return url;
            }

            return null;
        } catch (err) {
            console.warn("[YouTube] Failed to resolve channel URL", err);
            return null;
        }
    }

    // Logout (not applicable for browser cookies)
    async logout(): Promise<void> {
        // Can't logout from browser cookies - user must manually clear browser cookies
        await this.tokenStore.deleteTokens("youtube");
        this.cachedCookieHeader = null;
    }
    // Get current user's live broadcast
    async getMyBroadcast(forceRefresh = false): Promise<string | null> {
        const cookies = await this.getYouTubeCookies(forceRefresh);
        if (!cookies) return null;
        let channelUrl: string | null = null;

        try {
            // 1. Get Channel ID from /account_advanced
            // This page reliably lists the Channel ID
            const accountRes = await fetch("https://www.youtube.com/account_advanced", {
                headers: {
                    "Cookie": cookies,
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                },
            });

            if (accountRes.ok) {
                const html = await accountRes.text();
                // Look for Channel ID in the HTML. It's usually in a code block or input field.
                // Pattern: "channelId":"UC..." or data-channel-id="UC..." or just UC... in a specific context
                // The advanced account page usually has a "Channel ID" label followed by the ID.

                // Try to find the ID directly
                const match = html.match(/(UC[\w-]{22})/);
                if (match && await this.validateChannelId(match[1])) {
                    channelUrl = `https://www.youtube.com/channel/${match[1]}`;
                    this.myChannelId = match[1];
                } else {
                    console.warn("[YouTube] Could not find Channel ID in account_advanced page.");
                }
            } else {
                console.warn(`[YouTube] Failed to access /account_advanced. Status: ${accountRes.status}`);

                // Fallback to homepage if account_advanced fails
                console.log("[YouTube] Trying homepage fallback...");
                const homeRes = await fetch("https://www.youtube.com", {
                    headers: {
                        "Cookie": cookies,
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    },
                });

                if (homeRes.ok) {
                    const html = await homeRes.text();
                    const match = html.match(/"channelId":"(UC[^"]+)"/);
                    if (match && await this.validateChannelId(match[1])) {
                        channelUrl = `https://www.youtube.com/channel/${match[1]}`;
                        this.myChannelId = match[1];
                    }
                }
            }

            if (!channelUrl) {
                console.warn("[YouTube] Could not determine channel URL.");
                return null;
            }

            if (channelUrl !== this.lastLoggedChannelUrl) {
                console.log(`[YouTube] My Channel URL: ${channelUrl}`);
                this.lastLoggedChannelUrl = channelUrl;
            }

            // 2. Try RSS feed first (most stable for live/upcoming)
            const channelIdMatch = channelUrl.match(/channel\/([\w-]+)/);
            const channelId = channelIdMatch ? channelIdMatch[1] : null;
            if (channelId) {
                const feedVideoId = await this.findLiveFromFeed(channelId);
                if (feedVideoId) {
                    if (feedVideoId !== this.lastLoggedBroadcastId) {
                        console.log(`[YouTube] Found live/upcoming stream via feed: ${feedVideoId}`);
                        this.lastLoggedBroadcastId = feedVideoId;
                    }
                    return feedVideoId;
                }
            }

            // 3. Try channel videos page with live_view filters (501: live, 502: upcoming)
            if (channelId) {
                const videosPageId = await this.findLiveFromChannelVideos(channelId, cookies);
                if (videosPageId) {
                    if (videosPageId !== this.lastLoggedBroadcastId) {
                        console.log(`[YouTube] Found live/upcoming stream via channel videos: ${videosPageId}`);
                        this.lastLoggedBroadcastId = videosPageId;
                    }
                    return videosPageId;
                }
            }

            // 4. Check /live endpoint of the channel
            // If live, it redirects to /watch?v=VIDEO_ID
            const liveUrl = `${channelUrl}/live`;

            // Use follow redirect to see where it lands
            const liveRes = await fetch(liveUrl, {
                headers: {
                    "Cookie": cookies,
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                },
                redirect: "follow"
            });

            if (liveRes.ok) {
                // Case 1: traditional redirect to /watch?v=VIDEO_ID
                if (liveRes.url.includes("/watch?v=")) {
                    const url = new URL(liveRes.url);
                    const videoId = url.searchParams.get("v");
                    if (videoId) {
                        if (videoId !== this.lastLoggedBroadcastId) {
                            console.log(`[YouTube] Found live/upcoming stream via redirect: ${videoId}`);
                            this.lastLoggedBroadcastId = videoId;
                        }
                        return videoId;
                    }
                }

                // Case 2: /live serves HTML without redirect (common since late 2024)
                const html = await liveRes.text();
                const videoId = this.extractLiveVideoId(html);
                if (videoId) {
                    if (videoId !== this.lastLoggedBroadcastId) {
                        console.log(`[YouTube] Found live/upcoming stream via HTML: ${videoId}`);
                        this.lastLoggedBroadcastId = videoId;
                    }
                    return videoId;
                }
            }

            return null;
        } catch (err) {
            console.error("[YouTube] Failed to get my broadcast:", err);
            return null;
        }
    }

    // Fetch channel RSS feed and find live/upcoming entry
    private async findLiveFromFeed(channelId: string): Promise<string | null> {
        const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
        try {
            const res = await fetch(feedUrl, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                },
            });
            if (!res.ok) {
                console.warn(`[YouTube] Feed fetch failed (${res.status})`);
                return null;
            }
            const xml = await res.text();
            const liveMatch = xml.match(/<entry>[\s\S]*?<yt:videoId>([^<]+)<\/yt:videoId>[\s\S]*?<yt:liveBroadcastContent>(live|upcoming)<\/yt:liveBroadcastContent>/);
            return liveMatch ? liveMatch[1] : null;
        } catch (err) {
            console.warn("[YouTube] Feed fetch error:", err);
            return null;
        }
    }

    // Fetch channel videos page with live_view filters to find live/upcoming stream
    private async findLiveFromChannelVideos(channelId: string, cookies: string): Promise<string | null> {
        const liveViews = [501, 502]; // 501: live now, 502: upcoming
        for (const liveView of liveViews) {
            const url = "https://www.youtube.com/channel/" + channelId + "/videos?view=2&live_view=" + liveView;
            try {
                const res = await fetch(url, {
                    headers: {
                        "Cookie": cookies,
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    },
                });
                if (!res.ok) {
                    console.warn("[YouTube] channel videos live_view=" + liveView + " fetch failed (" + res.status + ")");
                    continue;
                }
                const html = await res.text();
                const videoId = this.extractLiveVideoId(html);
                if (videoId) return videoId;
            } catch (err) {
                console.warn("[YouTube] channel videos live_view=" + liveView + " error:", err);
            }
        }
        return null;
    }

    // Some channels no longer redirect /live to /watch. Extract live/upcoming videoId from HTML instead.
    private extractLiveVideoId(html: string): string | null {
        // Targeted patterns first
        const patterns = [
            /"videoId":"([\w-]{11})"[\s\S]{0,400}?"isLiveNow":true/,
            /"videoId":"([\w-]{11})"[\s\S]{0,400}?"style":"LIVE"/,
            /"videoId":"([\w-]{11})"[\s\S]{0,400}?"style":"UPCOMING"/,
            /"videoId":"([\w-]{11})"[\s\S]{0,400}?upcomingEventData/,
            /"thumbnailOverlayTimeStatusRenderer":{[\s\S]{0,200}?"text":{[\s\S]{0,120}?"runs":[{"text":"LIVE"}][\s\S]{0,200}?"videoId":"([\w-]{11})"/,
        ];
        for (const pattern of patterns) {
            const m = html.match(pattern);
            if (m) return m[1];
        }

        // Wider scan with context window as a last resort
        const matches = [...html.matchAll(/"videoId":"([\w-]{11})"/g)];
        for (const m of matches) {
            const idx = m.index ?? 0;
            const ctx = html.slice(Math.max(0, idx - 400), Math.min(html.length, idx + 400));
            const isLive = ctx.includes("\"isLiveNow\":true")
                || ctx.includes("\"style\":\"LIVE\"")
                || ctx.includes("\"label\":\"LIVE\"")
                || ctx.includes("\"liveBadge\"")
                || ctx.includes("\u30e9\u30a4\u30d6\u914d\u4fe1\u4e2d");
            const isUpcoming = ctx.includes("\"style\":\"UPCOMING\"") || ctx.includes("upcomingEventData");
            if (isLive || isUpcoming) return m[1];
        }

        // Fallback: first watchEndpoint
        const fallback = html.match(/"watchEndpoint":{"videoId":"([\w-]{11})"/);
        return fallback ? fallback[1] : null;
    }

    getLastCookieFetchedAt(): number | null {
        return this.cachedCookieHeader?.fetchedAt ?? null;
    }
}


