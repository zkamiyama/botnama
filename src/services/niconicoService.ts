// Niconico browser cookie-based authentication and Live API Service
import { TokenStore } from "./tokenStore.ts";
import { type NiconicoComment } from "./ndgrClient.ts";
import { loadServerSettings } from "../settings.ts";

export { type NiconicoComment };

interface NiconicoConfig {
    // No specific config needed for cookie-based auth
}

interface NiconicoBroadcast {
    id: string;
    title: string;
    description: string;
    status: string;
    viewerCount: number;
}

export class NiconicoService {
    private tokenStore: TokenStore;
    private activeClient: any | null = null; // Type as any to avoid import issues in signature, cast internally
    private activeLiveId: string | null = null;
    private commentBuffer: NiconicoComment[] = [];
    private lastAccessTime: number = 0;
    private cleanupTimer: number | null = null;
    private cachedCookieHeader: { value: string; fetchedAt: number } | null = null;
    private readonly cookieTtlMs = 15 * 60 * 1000; // 15 minutes
    private verbose = false;
    // Keep UA in sync with NDGRClient's HTTP_HEADERS (Chrome 126)
    private readonly NICONICO_USER_AGENT =
        "Mozilla/5.0 (Windows NT 15.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

    constructor(_config: NiconicoConfig, tokenStore: TokenStore) {
        this.tokenStore = tokenStore;
    }

    // Allow setting cached cookie header (server bootstrap can use this to avoid duplicate work)
    public setCachedCookieHeader(value: string | null) {
        if (!value) {
            this.cachedCookieHeader = null;
            return;
        }
        this.cachedCookieHeader = { value, fetchedAt: Date.now() };
    }

    setVerbose(enabled: boolean) {
        this.verbose = enabled;
    }

    private logDebug(...args: unknown[]) {
        if (this.verbose) console.log(...args);
    }

    // Get cookies header from browser or token store
    private async getNiconicoCookies(forceRefresh = false, requireAuth = true): Promise<string | null> {
        const now = Date.now();
        if (!forceRefresh && this.cachedCookieHeader && now - this.cachedCookieHeader.fetchedAt < this.cookieTtlMs) {
            return this.cachedCookieHeader.value;
        }

        const settings = loadServerSettings();

        // Try to get from browser cookies first
        if (settings.niconicoCookiesFrom) {
            try {
                // Import dynamically to avoid circular dependencies if any
                const { getBrowserCookies, cookiesToHeader } = await import("./cookieExtractor.ts");
                console.debug(`[NiconicoService] Using cookie source: ${settings.niconicoCookiesFrom} profile:${settings.niconicoCookiesProfile ?? "(none)"} forceRefresh=${forceRefresh}`);
                const cookies = await getBrowserCookies(
                    settings.niconicoCookiesFrom,
                    "nicovideo.jp",
                    settings.niconicoCookiesProfile || undefined,
                    forceRefresh,
                );

                if (cookies.length > 0) {
                    const header = cookiesToHeader(cookies);
                    this.cachedCookieHeader = { value: header, fetchedAt: now };
                    console.debug(`[NiconicoService] Extracted ${cookies.length} cookies; header length=${header.length}`);
                    return header;
                }
            } catch (error) {
                console.warn("Failed to extract Niconico cookies from browser:", error);
            }
        }

        // Fallback to token store (if manually set)
        const tokens = await this.tokenStore.getTokens("niconico");
        if (tokens?.access_token) {
            const header = `user_session=${tokens.access_token}`;
            this.cachedCookieHeader = { value: header, fetchedAt: now };
            return header;
        }

        if (requireAuth) {
            throw new Error(
                "Not authenticated. Please set NICONICO_COOKIES_FROM in settings or login manually.",
            );
        }

        return null;
    }

    // Get broadcast info
    async getBroadcast(liveId: string, forceRefresh = false): Promise<NiconicoBroadcast> {
        const cookies = await this.getNiconicoCookies(forceRefresh, false);

        const response = await fetch(`https://live.nicovideo.jp/watch/${liveId}`, {
            headers: {
                "User-Agent": this.NICONICO_USER_AGENT,
                ...(cookies ? { "Cookie": cookies } : {}),
            },
        });

        if (!response.ok) {
            throw new Error(`Failed to get broadcast info: ${response.statusText}`);
        }

        // Parse embedded data from HTML
        // This is where NDGR server info would be extracted
        // For now, return mock data as this requires complex parsing
        return {
            id: liveId,
            title: "Live Stream", // Would parse from HTML
            description: "",
            status: "active",
            viewerCount: 0,
        };
    }

    // Stop current stream
    private stopCurrentStream() {
        if (this.activeClient) {
            console.log(`[Niconico] Stopping stream for ${this.activeLiveId} due to inactivity or switch`);
            try {
                this.activeClient.disconnect();
            } catch (e) {
                console.error("[Niconico] Error disconnecting client:", e);
            }
            this.activeClient = null;
        }
        this.activeLiveId = null;
        this.commentBuffer = [];
        if (this.cleanupTimer) {
            clearTimeout(this.cleanupTimer);
            this.cleanupTimer = null;
        }
    }

    // Schedule cleanup if inactive
    private scheduleCleanup() {
        if (this.cleanupTimer) return;

        this.cleanupTimer = setTimeout(() => {
            const now = Date.now();
            if (now - this.lastAccessTime > 30000) { // 30 seconds timeout
                this.stopCurrentStream();
            } else {
                this.cleanupTimer = null;
                this.scheduleCleanup();
            }
        }, 10000) as unknown as number; // Check every 10s
    }

    // Get comments using NDGR client (Stateful / Buffered)
    async getComments(liveId: string): Promise<NiconicoComment[]> {
        this.lastAccessTime = Date.now();
        this.scheduleCleanup();

        // If switching live ID, stop previous stream
        if (this.activeLiveId !== liveId) {
            this.stopCurrentStream();
        }

        // If no active client, start one
        if (!this.activeClient) {
            this.logDebug(`[Niconico] Starting new stream for ${liveId}`);
            const cookies = await this.getNiconicoCookies(false, false);
            const match = cookies?.match(/user_session=([^;]+)/);
            const userSessionValue = match ? match[1] : null;

            try {
                const { NDGRClient } = await import("./ndgrClient.ts");
                this.activeClient = new NDGRClient(userSessionValue);
                this.activeLiveId = liveId;
                if (userSessionValue) {
                    this.logDebug("[Niconico] Using authenticated session for comment stream");
                } else {
                    this.logDebug("[Niconico] No cookie found; using anonymous comment stream");
                }

                // Start streaming in background
                this.activeClient.streamComments(
                    liveId,
                    (comment: NiconicoComment) => {
                        // console.log(`[Niconico] Buffer push: ${comment.message}`);
                        this.commentBuffer.push(comment);
                        // Keep buffer size reasonable
                        if (this.commentBuffer.length > 1000) {
                            this.commentBuffer.shift();
                        }
                    },
                    (error: Error) => {
                        console.error(`[Niconico] Stream error: ${error?.message ?? String(error)}`);
                    }
                ).catch((err: any) => {
                    const message = err?.message ?? String(err);
                    console.error(`[Niconico] streamComments threw: ${message}`);
                    this.stopCurrentStream();
                });

            } catch (err) {
                console.error("[Niconico] Failed to initialize NDGRClient:", err);
                return [];
            }
        }

        // Return buffered comments and clear buffer
        // This effectively gives "new comments since last poll"
        const comments = [...this.commentBuffer];
        this.commentBuffer = [];

        if (comments.length > 0) {
            this.logDebug(`[Niconico] Returning ${comments.length} buffered comments`);
        }

        return comments;
    }

    // Start streaming comments (exposed for other uses if needed, but getComments handles it now)
    async startCommentStream(
        liveId: string,
        onComment: (comment: NiconicoComment) => void,
        onError?: (error: Error) => void,
    ): Promise<void> {
        // This method is less useful now that we have internal buffering for polling,
        // but we can keep it as a direct pass-through if needed, bypassing the internal buffer.
        // However, to avoid multiple clients for the same ID, we should probably warn or handle it.
        console.warn("[Niconico] startCommentStream called directly. This creates a separate client instance.");

        const cookies = await this.getNiconicoCookies();
        const match = cookies.match(/user_session=([^;]+)/);
        const userSessionValue = match ? match[1] : "";

        const { NDGRClient } = await import("./ndgrClient.ts");
        const ndgrClient = new NDGRClient(userSessionValue);
        return ndgrClient.streamComments(liveId, onComment, onError);
    }

    // Send broadcaster comment via operator_comment endpoint (owner comment)
    async sendComment(liveId: string, message: string): Promise<void> {
        const cookies = await this.getNiconicoCookies();

        // Extract user_session for X-niconico-session header
        const userSessionMatch = cookies.match(/user_session=([^;]+)/);
        const userSession = userSessionMatch ? userSessionMatch[1] : "";

        const url = `https://live2.nicovideo.jp/watch/${liveId}/operator_comment`;

        console.log(`[Niconico] Posting broadcaster comment to ${liveId}: ${message}`);

        try {
            const response = await fetch(url, {
                method: "PUT",
                headers: {
                    "Cookie": cookies,
                    "Content-Type": "application/json",
                    "User-Agent": this.NICONICO_USER_AGENT,
                    "X-Frontend-Id": "134",
                    "X-Frontend-Version": "v5.00.0",
                    "X-niconico-session": userSession,
                },
                body: JSON.stringify({
                    text: message,
                    isPermCommand: false,
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(
                    `[Niconico] Failed to post broadcaster comment. Status: ${response.status}, Body: ${errorText}`,
                );
                throw new Error(`Niconico API Error: ${response.status} ${response.statusText} - ${errorText}`);
            }

            console.log("[Niconico] Broadcaster comment posted successfully");
        } catch (err) {
            console.error("[Niconico] Error posting broadcaster comment:", err);
            throw err;
        }
    }

    // Check authentication status
    async isAuthenticated(forceRefresh = false): Promise<boolean> {
        try {
            await this.getNiconicoCookies(forceRefresh, true);
            return true;
        } catch {
            return false;
        }
    }

    // Get current user's live broadcast
    async getMyBroadcast(forceRefresh = false): Promise<string | null> {
        let cookies: string | null = null;
        try {
            cookies = await this.getNiconicoCookies(forceRefresh, false);
        } catch (err) {
            console.warn("[Niconico] getMyBroadcast skipped (auth missing):", err);
            return null;
        }

        if (!cookies) {
            return null;
        }

        try {
            // Extract user_session value from cookies
            const userSessionMatch = cookies.match(/user_session=([^;]+)/);
            if (!userSessionMatch) {
                console.warn("[Niconico] user_session cookie not found");
                return null;
            }
            const userSession = userSessionMatch[1];

            // Use the same API endpoint that N-Air uses for getting current user broadcast
            // Reference: N-Air NicoliveClient.ts uses /unama/tool/v2/onairs/user
            const apiUrl = "https://live2.nicovideo.jp/unama/tool/v2/onairs/user";
            this.logDebug(`[Niconico] Fetching current broadcast from: ${apiUrl}`);

            const response = await fetch(apiUrl, {
                headers: {
                    "Cookie": cookies,
                    "X-niconico-session": userSession,
                    "User-Agent": this.NICONICO_USER_AGENT,
                    "Accept": "application/json",
                },
            });

            if (!response.ok) {
                console.warn(`[Niconico] API request failed. Status: ${response.status}`);
                const text = await response.text();
                console.warn(`[Niconico] Response: ${text.slice(0, 500)}`);
                return null;
            }

            const data = await response.json();
            this.logDebug(`[Niconico] API response: ${JSON.stringify(data).slice(0, 500)}`);

            // The actual response structure: { meta: {...}, data: { programId: "lv..." } }
            if (data?.data?.programId) {
                const programId = data.data.programId;
                this.logDebug(`[Niconico] Found current broadcast: ${programId}`);
                return programId;
            }

            // Fallback: check if there's a direct id field
            if (data?.id) {
                const programId = data.id;
                this.logDebug(`[Niconico] Found current broadcast: ${programId}`);
                return programId;
            }

            // Another fallback: nicoliveProgramId field
            if (data?.nicoliveProgramId) {
                const programId = data.nicoliveProgramId;
                console.log(`[Niconico] Found current broadcast: ${programId}`);
                return programId;
            }

            this.logDebug("[Niconico] No active broadcast found.");
            return null;
        } catch (err) {
            console.error("[Niconico] Failed to get current broadcast:", err);
            return null;
        }
    }

    async getUserPageUrl(forceRefresh = false): Promise<string | null> {
        try {
            const cookies = await this.getNiconicoCookies(forceRefresh, false);
            if (!cookies) return null;
            const match = cookies.match(/user_session_([0-9]+)/);
            if (match && match[1]) {
                return `https://www.nicovideo.jp/user/${match[1]}`;
            }
            return null;
        } catch (err) {
            console.warn("[Niconico] Failed to resolve user page", err);
            return null;
        }
    }

    // Logout (clear token store only, browser cookies remain)
    async logout(): Promise<void> {
        await this.tokenStore.deleteTokens("niconico");
        this.cachedCookieHeader = null;
    }

    getLastCookieFetchedAt(): number | null {
        return this.cachedCookieHeader?.fetchedAt ?? null;
    }
}
