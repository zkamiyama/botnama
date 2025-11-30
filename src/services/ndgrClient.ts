// NDGR Client for Niconico Live comments
// TypeScript port of https://github.com/tsukumijima/NDGRClient and N-Air implementation

import protobuf from "protobufjs";
import { PROJECT_ROOT } from "../settings.ts";
import { ProtobufStreamReader } from "./protobufStreamReader.ts";

// Proto descriptor is now embedded as a TypeScript module that exports the pre-generated JSON descriptor.
import protoDescriptor from "./nicolive-proto.ts";

export interface NiconicoComment {
    id: string;
    userId: string;
    userName: string;
    message: string;
    timestamp: number;
    vpos: number; // Video position in 10ms units
    premium: boolean;
    commands: string[]; // Mail commands like ["184", "red", "big"]
}

export class NDGRClient {
    private userSession: string | null;
    private protoRoot: protobuf.Root | null = null;
    private abortController: AbortController | null = null;
    private chatSocket: WebSocket | null = null;
    private watchSocket: WebSocket | null = null;
    // Keepseat interval handler for watch websocket (startWatching)
    private watchSeatInterval: ReturnType<typeof setInterval> | null = null;
    private watchSeatIntervalSec: number | null = null;
    private chatHeartbeat: ReturnType<typeof setInterval> | null = null;
    private frontendId: number | null = null;
    private frontendVersion: string | null = null;
    private watchAudienceToken: string | null = null;
    private verbose = false; // set true when detailed logs are needed

    // Resolve messageServer / threadId using multiple anonymous endpoints (best-effort)
    private async resolveAnonymousMessageServer(liveId: string | undefined, audienceToken: string | null) {
        const fid = this.frontendId ?? 9;
        const fver = this.frontendVersion ?? "618.0.0";
        const headersBase = {
            ...this.HTTP_HEADERS,
            "accept": "application/json",
            "origin": "https://live.nicovideo.jp",
            "referer": "https://live.nicovideo.jp/",
            "x-frontend-id": String(fid),
            "x-frontend-version": String(fver),
        };

        const trySeat = async (url: string, label: string) => {
            try {
                const res = await fetch(url, { headers: headersBase });
                if (res.ok) {
                    const json = await res.json();
                    const msUri = json?.data?.messageServer?.uri ?? json?.messageServer?.uri;
                    const threadId = json?.data?.threadId ?? json?.threadId;
                    if (msUri && threadId) {
                        this.logDebug(`[NDGRClient] messageServer resolved via ${label}`);
                        return { msUri, threadId };
                    }
                } else {
                    await this.logResponseSnippet(`[NDGRClient] ${label} body`, res);
                }
            } catch (e) {
                this.logDebug(`[NDGRClient] ${label} error:`, e);
            }
            return null;
        };

        // Seat with audience_token (v1 / v2)
        if (audienceToken) {
            const encoded = encodeURIComponent(audienceToken);
            const endpoints = [
                { url: `https://a.live2.nicovideo.jp/api/v2/guest/seat?audience_token=${encoded}`, label: "seat v2 audience" },
                { url: `https://a.live2.nicovideo.jp/api/v1/guest/seat?audience_token=${encoded}`, label: "seat v1 audience" },
            ];
            for (const ep of endpoints) {
                const hit = await trySeat(ep.url, ep.label);
                if (hit) return hit;
            }
        }

        // Seat with liveId
        if (liveId) {
            const endpointsId = [
                { url: `https://api.live2.nicovideo.jp/api/v2/guest/seat/${liveId}?frontendId=${fid}&frontendVersion=${encodeURIComponent(fver)}`, label: "seat v2 liveId" },
                { url: `https://api.live2.nicovideo.jp/api/v1/guest/seat/${liveId}?frontendId=${fid}&frontendVersion=${encodeURIComponent(fver)}`, label: "seat v1 liveId" },
            ];
            for (const ep of endpointsId) {
                const hit = await trySeat(ep.url, ep.label);
                if (hit) return hit;
            }
        }

        return null;
    }
    private async logResponseSnippet(label: string, res: Response) {
        if (!this.verbose) return;
        try {
            const text = await res.text();
            const snippet = text.length > 500 ? text.slice(0, 500) + "..." : text;
            console.warn(label, res.status, res.statusText, snippet);
        } catch (_) {
            console.warn(label, res.status, res.statusText, "<body read error>");
        }
    }

    private logDebug(...args: unknown[]) {
        if (this.verbose) console.log(...args);
    }

    // HTTP Headers mimicking Chrome
    private readonly HTTP_HEADERS = {
        "accept": "*/*",
        "accept-encoding": "gzip, deflate, br",
        "accept-language": "ja",
        "origin": "https://live.nicovideo.jp",
        "referer": "https://live.nicovideo.jp/",
        "sec-ch-ua": '"Chromium";v="126", "Google Chrome";v="126"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-site",
        "user-agent":
            "Mozilla/5.0 (Windows NT 15.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    };

    constructor(userSession?: string | null) {
        this.userSession = userSession ?? null;
    }

    setVerbose(enabled: boolean) {
        this.verbose = enabled;
    }

    /**
     * Load Protobuf definitions from embedded JSON descriptor
     */
    private async loadProto(): Promise<void> {
        if (this.protoRoot) return;

        try {
            // Create root from embedded JSON descriptor (generated by scripts/generate-proto-descriptor.ts)
            this.protoRoot = protobuf.Root.fromJSON(protoDescriptor as any);
        } catch (error) {
            console.error("Failed to load protobuf definitions:", error);
            throw new Error(
                "Protobuf JSON descriptor not found. Run 'deno run -A scripts/generate-proto-descriptor.ts' to generate it.",
            );
        }
    }

    /**
     * Disconnect and stop streaming
     */
    disconnect() {
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
        // Ensure keepSeat interval is cleared
        try {
            if (this.watchSeatInterval) {
                clearInterval(this.watchSeatInterval);
                this.watchSeatInterval = null;
                this.watchSeatIntervalSec = null;
            }
        } catch (_) { /* ignore */ }
    }

    /**
     * Get View API URI
     * Tries programinfo API first (for authenticated users/broadcasters), then falls back to scraping watch page.
     */
    async getViewApiUri(liveId: string): Promise<string> {
        // 1. Try programinfo API (Broadcaster/Authenticated)
        if (this.userSession) {
            try {
                const programInfoUrl = `https://live2.nicovideo.jp/watch/${liveId}/programinfo`;
                const response = await fetch(programInfoUrl, {
                    headers: {
                        ...this.HTTP_HEADERS,
                        "cookie": `user_session=${this.userSession}`,
                    },
                    signal: this.abortController?.signal,
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.data?.rooms?.[0]?.viewUri) {
                        this.logDebug("[NDGRClient] Retrieved View URI from programinfo API");
                        return data.data.rooms[0].viewUri;
                    }
                }
            } catch (e) {
                this.logDebug("[NDGRClient] Failed to fetch programinfo, falling back to scraping:", e);
            }
        } else {
            this.logDebug("[NDGRClient] No user_session; skipping programinfo API");
        }

        // 2. Fallback: Scrape watch page (Viewer/Anonymous)
        const watchUrl = `https://live.nicovideo.jp/watch/${liveId}`;
        const fetchHtml = async (url: string) => {
            const res = await fetch(url, {
                headers: {
                    ...this.HTTP_HEADERS,
                    ...(this.userSession ? { "cookie": `user_session=${this.userSession}` } : {}),
                },
                signal: this.abortController?.signal,
            });
            if (!res.ok) return null;
            return res.text();
        };

        const candidates = [
            `https://live2.nicovideo.jp/watch/${liveId}`,
            watchUrl,
        ];

        let viewApiUri: string | null = null;

        for (const url of candidates) {
            const html = await fetchHtml(url);
            if (!html) continue;

            // extract all data-props attributes that contain webSocketUrl
            const props: string[] = [];
            const reAll = /data-props=("([^"]+)"|'([^']+)')/g;
            let mAll: RegExpExecArray | null;
            while ((mAll = reAll.exec(html)) !== null) {
                const val = mAll[2] ?? mAll[3] ?? "";
                if (val.includes("webSocketUrl")) props.push(val);
            }

            for (const p of props) {
                const decoded = p.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
                try {
                    const embeddedData = JSON.parse(decoded);
                    const socketUrl = embeddedData?.site?.relive?.webSocketUrl;
                    viewApiUri = socketUrl && socketUrl.length > 0 ? socketUrl : null;
                    this.watchAudienceToken = embeddedData?.site?.relive?.audienceToken ?? this.watchAudienceToken;
                    this.frontendId = embeddedData.site?.frontendId ?? this.frontendId;
                    this.frontendVersion = embeddedData.site?.frontendVersion ?? this.frontendVersion;
                    if (viewApiUri) break;
                } catch (_) {
                    continue;
                }
            }

            if (!viewApiUri) {
                // search literal webSocketUrl
                let m = html.match(/webSocketUrl":"(wss:[^"]+)"/);
                if (m) viewApiUri = m[1].replace(/\\u0026/g, "&");
                if (!viewApiUri) {
                    const m2 = html.match(/webSocketUrl":"(wss:\\\\\/\\\\\/[^"]+)"/);
                    if (m2) viewApiUri = m2[1].replace(/\\\\\//g, "/").replace(/\\u0026/g, "&");
                }
            }

            if (viewApiUri) break;
        }

        if (!viewApiUri) {
            throw new Error("Could not extract View API URI from embedded data");
        }

        return viewApiUri;
    }

    /**
     * Parse chat data from Niconico protobuf
     */
    private parseChat(chat: any): NiconicoComment {
        const normalizeId = (value: unknown): string | null => {
            if (value === null || value === undefined) return null;
            const text = typeof value === "object" && typeof (value as { toString: () => string }).toString === "function"
                ? (value as { toString: () => string }).toString()
                : String(value);
            const trimmed = text.trim();
            // raw_user_id is 0 for viewers; ignore zeros/empty
            if (!trimmed || trimmed === "0") return null;
            return trimmed;
        };

        const rawUserId = normalizeId(chat.raw_user_id);
        const hashedUserId = normalizeId(chat.hashed_user_id);
        const fallbackUserId = normalizeId(chat.user_id);

        // Prefer broadcaster raw ID, then hashed (viewer), then any remaining id
        const userId = rawUserId ?? hashedUserId ?? fallbackUserId ?? "anonymous";

        // Prefer display name if present, otherwise fall back to stable ID
        const userName = typeof chat.name === "string" && chat.name.trim().length > 0
            ? chat.name.trim()
            : typeof chat.account_name === "string" && chat.account_name.trim().length > 0
                ? chat.account_name.trim()
                : userId;

        // Parse mail commands
        const mailString = chat.mail || "";
        const commands = mailString ? mailString.split(/\s+/).filter((cmd: string) => cmd.length > 0) : [];

        return {
            id: String(chat.no || Date.now()),
            userId,
            userName,
            message: chat.content || "",
            timestamp: Math.floor(Date.now() / 1000),
            vpos: chat.vpos || 0,
            premium: chat.premium === 1 || chat.account_status === 3,
            commands,
        };
    }

    /**
     * Fetch and process messages from a segment URI
     */
    private async processSegment(segmentUri: string, onComment: (c: NiconicoComment) => void) {
        try {
            await this.loadProto();
            const ChunkedMessage = this.protoRoot!.lookupType("dwango.nicolive.chat.service.edge.ChunkedMessage");

            const response = await fetch(segmentUri, {
                headers: {
                    ...this.HTTP_HEADERS,
                    ...(this.userSession ? { "cookie": `user_session=${this.userSession}` } : {}),
                },
                signal: this.abortController?.signal,
            });

            if (!response.ok || !response.body) return;

            const reader = new ProtobufStreamReader(response.body);
            for await (const messageBytes of reader.readMessages()) {
                if (this.abortController?.signal.aborted) break;
                const chunkedMessage = ChunkedMessage.decode(messageBytes) as any;

                if (chunkedMessage.payload === "message" && chunkedMessage.message?.chat) {
                    const comment = this.parseChat(chunkedMessage.message.chat);
                    onComment(comment);
                }
            }
        } catch (err) {
            if (err instanceof Error && err.name === 'AbortError') return;
            console.error("Segment fetch error:", err);
        }
    }

    /**
     * Process a packed segment (backward history)
     */
    private async processPackedSegment(segmentUri: string, onComment: (c: NiconicoComment) => void) {
        try {
            await this.loadProto();
            const PackedSegment = this.protoRoot!.lookupType("dwango.nicolive.chat.service.edge.PackedSegment");

            const response = await fetch(segmentUri, {
                headers: {
                    ...this.HTTP_HEADERS,
                    ...(this.userSession ? { "cookie": `user_session=${this.userSession}` } : {}),
                },
                signal: this.abortController?.signal,
            });

            if (!response.ok) return;

            const buffer = await response.arrayBuffer();
            const packed = PackedSegment.decode(new Uint8Array(buffer)) as any;

            if (packed.messages) {
                for (const msg of packed.messages) {
                    if (msg.message?.chat) {
                        onComment(this.parseChat(msg.message.chat));
                    }
                }
            }
        } catch (err) {
            if (err instanceof Error && err.name === 'AbortError') return;
            console.error("Packed segment fetch error:", err);
        }
    }

    /**
     * Stream comments using HTTP Long Polling (N-Air style)
     */
    private async streamCommentsHttp(
        viewUri: string,
        onComment: (comment: NiconicoComment) => void,
        onError?: (error: Error) => void
    ) {
        let nextAt: string | number = "now";
        const ChunkedEntry = this.protoRoot!.lookupType("dwango.nicolive.chat.service.edge.ChunkedEntry");

        while (this.abortController && !this.abortController.signal.aborted) {
            try {
                const fetchUri = `${viewUri}?at=${nextAt}`;
                // this.logDebug(`[NDGRClient] Polling: ${fetchUri}`);

                const response = await fetch(fetchUri, {
                    headers: {
                        ...this.HTTP_HEADERS,
                        ...(this.userSession ? { "cookie": `user_session=${this.userSession}` } : {}),
                    },
                    signal: this.abortController?.signal,
                });

                if (!response.ok) {
                    throw new Error(`Polling failed: ${response.status} ${response.statusText}`);
                }

                if (!response.body) continue;

                const reader = new ProtobufStreamReader(response.body);
                let nextFound = false;

                for await (const entryBytes of reader.readMessages()) {
                    if (this.abortController?.signal.aborted) break;

                    const entry = ChunkedEntry.decode(entryBytes) as any;

                    if (entry.entry === "segment" && entry.segment) {
                        // Fetch segment content (Stream of ChunkedMessages)
                        this.processSegment(entry.segment.uri, onComment);
                    } else if (entry.entry === "next" && entry.next) {
                        nextAt = entry.next.at;
                        nextFound = true;
                    } else if (entry.entry === "backward" && entry.backward) {
                        // Handle backward (PackedSegment)
                        this.processPackedSegment(entry.backward.segment.uri, onComment);
                    }
                }

                if (!nextFound) {
                    // If no next, wait a bit and retry (shouldn't happen in normal stream)
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }

            } catch (e) {
                if (e instanceof Error && e.name === 'AbortError') return;
                console.error("[NDGRClient] Polling error:", e);
                if (onError) onError(e instanceof Error ? e : new Error(String(e)));
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }
    }

    // Connect to messageServer websocket and stream chat (JSON)
    private async streamMessageServer(
        messageServerUri: string,
        threadId: string,
        onComment: (comment: NiconicoComment) => void,
        onError?: (error: Error) => void,
    ) {
        return new Promise<void>((resolve) => {
            try {
                const ws = new WebSocket(messageServerUri, ["msg.nicovideo.jp#json"]);
                this.chatSocket = ws;

                ws.onopen = () => {
                    // heartbeat every second (sends empty string)
                    this.chatHeartbeat = setInterval(() => {
                        try { ws.send(""); } catch { /* ignore */ }
                    }, 1000);

                    const payload = [
                        { ping: { content: "rs:0" } },
                        { ping: { content: "ps:0" } },
                        {
                            thread: {
                                thread: threadId,
                                version: "20061206",
                                user_id: this.userSession ? "owner" : "guest",
                                res_from: -150,
                                with_global: 1,
                                scores: 1,
                                nicoru: 0,
                            },
                        },
                        { ping: { content: "pf:0" } },
                        { ping: { content: "rf:0" } },
                    ];
                    ws.send(JSON.stringify(payload));
                };

                ws.onmessage = (event) => {
                    if (this.abortController?.signal.aborted) return;
                    try {
                        const msg = JSON.parse(typeof event.data === "string" ? event.data : new TextDecoder().decode(event.data));
                        if (msg.thread) {
                            this.logDebug("[NDGRClient] chat thread ack");
                        }
                        if (msg.ping) return;
                        if (msg.chat) {
                            const chat = msg.chat;
                            const userId = chat.user_id ?? "anonymous";
                            const userName = chat.name ?? userId;
                            const comment: NiconicoComment = {
                                id: String(chat.no ?? Date.now()),
                                userId,
                                userName,
                                message: chat.content ?? "",
                                timestamp: typeof chat.date === "number" ? chat.date : Math.floor(Date.now() / 1000),
                                vpos: chat.vpos ?? 0,
                                premium: chat.premium === 1,
                                commands: chat.mail ? String(chat.mail).split(/\s+/).filter((s: string) => s.length > 0) : [],
                            };
                            onComment(comment);
                        }
                    } catch (e) {
                        console.error("[NDGRClient] chat WS parse error:", e);
                    }
                };

                ws.onclose = () => {
                    if (this.chatHeartbeat) {
                        clearInterval(this.chatHeartbeat);
                        this.chatHeartbeat = null;
                    }
                    resolve();
                };

                ws.onerror = (err) => {
                    console.error("[NDGRClient] chat WS error:", err);
                    if (onError) onError(err instanceof Error ? err : new Error(String(err)));
                };

                this.abortController?.signal.addEventListener("abort", () => {
                    try { ws.close(); } catch (_) { /* ignore */ }
                });
            } catch (e) {
                console.error("[NDGRClient] Failed to open messageServer WS:", e);
                if (onError) onError(e instanceof Error ? e : new Error(String(e)));
                resolve();
            }
        });
    }

    // Connect to watch WebSocket, obtain room info, then connect to message server
    private async streamCommentsWs(
        viewUri: string,
        onComment: (comment: NiconicoComment) => void,
        onError?: (error: Error) => void,
        liveId?: string
    ) {
        return new Promise<void>((resolve) => {
            try {
                const ws = new WebSocket(viewUri);
                this.watchSocket = ws;

                ws.onopen = () => {
                    const audienceToken = (() => {
                        try {
                            const url = new URL(viewUri);
                            return url.searchParams.get("audience_token");
                        } catch {
                            return null;
                        }
                    })();
                    const startPayload = {
                        type: "startWatching",
                        data: {
                            stream: { quality: "abr", protocol: "hls", latency: "low", chasePlay: false },
                            room: {
                                protocol: "webSocket",
                                commentable: true,
                                ...(audienceToken ? { audienceToken } : {}),
                            },
                            reconnect: false,
                        },
                    };
                    this.logDebug("[NDGRClient] watch -> startWatching");
                    ws.send(JSON.stringify(startPayload));
                };

                ws.onmessage = async (event) => {
                    if (this.abortController?.signal.aborted) return;
                    try {
                        const msg = JSON.parse(event.data as string);
                        this.logDebug("[NDGRClient] watch message", msg.type, msg.data ? JSON.stringify(msg.data).slice(0, 200) : "");
                        if (msg.type === "ping") {
                            ws.send(JSON.stringify({ type: "pong" }));
                            return;
                        }
                        // seat: server asks the client to keep a seat by periodically sending keepSeat
                        if (msg.type === "seat") {
                            try {
                                const keepIntervalSec = Number(msg.data?.keepIntervalSec ?? msg.data?.keep_interval_sec ?? 0);
                                if (!Number.isNaN(keepIntervalSec) && keepIntervalSec > 0) {
                                    this.logDebug("[NDGRClient] Received seat; keepIntervalSec=", keepIntervalSec);
                                    // Clear any existing interval and start a new one
                                    if (this.watchSeatInterval) {
                                        clearInterval(this.watchSeatInterval);
                                    }
                                    this.watchSeatIntervalSec = keepIntervalSec;
                                    // Fire once immediately and then at the configured interval
                                    try { ws.send(JSON.stringify({ type: "keepSeat" })); } catch (_) { /* ignore */ }
                                    this.watchSeatInterval = setInterval(() => {
                                        try { ws.send(JSON.stringify({ type: "keepSeat" })); } catch (e) { /* ignore */ }
                                    }, keepIntervalSec * 1000);
                                } else {
                                    // If no interval provided, clear any existing keepSeat handling
                                    if (this.watchSeatInterval) {
                                        clearInterval(this.watchSeatInterval);
                                        this.watchSeatInterval = null;
                                        this.watchSeatIntervalSec = null;
                                    }
                                }
                            } catch (e) {
                                this.logDebug("[NDGRClient] seat handling error:", e);
                            }
                            return;
                        }
                        if (msg.type === "room" && msg.data?.messageServer?.uri && msg.data?.threadId) {
                            // Connect to message server for comments
                            await this.streamMessageServer(msg.data.messageServer.uri, msg.data.threadId, onComment, onError);
                            return;
                        }
                        if (msg.type === "messageServer") {
                            // Pattern A: direct uri + threadId (rare)
                            if (msg.data?.uri && (msg.data.threadId || msg.data.thread)) {
                                const threadId = msg.data.threadId ?? msg.data.thread;
                                await this.streamMessageServer(msg.data.uri, threadId, onComment, onError);
                                return;
                            }
                            // Pattern B: viewUri (common). Resolve via POST to get messageServer.uri + threadId.
                            if (msg.data?.viewUri) {
                                // New-style HTTP comment stream (mpn.live.nicovideo.jp/api/view/v4)
                                if (msg.data.viewUri.includes("mpn.live.nicovideo.jp/api/view/")) {
                                    this.logDebug("[NDGRClient] messageServer resolved via HTTP polling viewUri");
                                    await this.streamCommentsHttp(msg.data.viewUri, onComment, onError);
                                    return;
                                }
                                try {
                                    const fid = this.frontendId ?? 9;
                                    const fver = this.frontendVersion ?? "618.0.0";
                                    const headers = {
                                        ...this.HTTP_HEADERS,
                                        "content-type": "application/json",
                                        "origin": "https://live.nicovideo.jp",
                                        "referer": "https://live.nicovideo.jp/",
                                        "x-frontend-id": String(fid),
                                        "x-frontend-version": String(fver),
                                    };
                                    const body = JSON.stringify({ frontendId: fid, frontendVersion: fver });
                                    const res = await fetch(msg.data.viewUri, { method: "POST", headers, body });
                                    if (res.ok) {
                                        const view = await res.json();
                                        const msUri = view?.data?.messageServer?.uri ?? view?.messageServer?.uri;
                                        const threadId = view?.data?.threadId ?? view?.threadId ?? null;
                                        if (msUri && threadId) {
                                            this.logDebug("[NDGRClient] messageServer resolved via viewUri POST");
                                            await this.streamMessageServer(msUri, threadId, onComment, onError);
                                            return;
                                        }
                                        this.logDebug("[NDGRClient] viewUri POST ok but missing uri/threadId");
                                    } else {
                                        this.logDebug("[NDGRClient] viewUri POST failed", res.status);
                                        await this.logResponseSnippet("[NDGRClient] viewUri POST body", res);
                                    }
                                } catch (e) {
                                    this.logDebug("[NDGRClient] viewUri POST error:", e);
                                }
                            }
                            // Pattern A2: resolve via multiple anonymous seat/watch endpoints (only if viewUri path failed)
                            const resolved = await this.resolveAnonymousMessageServer(liveId, this.watchAudienceToken);
                            if (resolved) {
                                await this.streamMessageServer(resolved.msUri, resolved.threadId, onComment, onError);
                                return;
                            }
                            // Pattern C: fallback to watch API (a.live2) using liveId
                            try {
                                const fid = this.frontendId ?? 9;
                                const fver = this.frontendVersion ?? "618.0.0";
                                if (!liveId) throw new Error("missing liveId for fallback");
                                const url = `https://api.live2.nicovideo.jp/api/v1/programs/${liveId}/watch?frontendId=${fid}&frontendVersion=${encodeURIComponent(fver)}`;
                                const res = await fetch(url, {
                                    headers: {
                                        ...this.HTTP_HEADERS,
                                        ...(this.userSession ? { "cookie": `user_session=${this.userSession}` } : {}),
                                        "accept": "application/json",
                                    },
                                });
                                if (res.ok) {
                                    const json = await res.json();
                                    const msUri = json?.data?.messageServer?.uri;
                                    const threadId = json?.data?.threadId;
                                    if (msUri && threadId) {
                                        this.logDebug("[NDGRClient] messageServer resolved via watch API");
                                        await this.streamMessageServer(msUri, threadId, onComment, onError);
                                        return;
                                    }
                                } else {
                                    this.logDebug("[NDGRClient] watch API fallback failed", res.status);
                                    await this.logResponseSnippet("[NDGRClient] watch API body", res);
                                }
                            } catch (e) {
                                this.logDebug("[NDGRClient] watch API fallback error:", e);
                            }

                            // Pattern E: liveedge seat endpoint hinted in articles
                            try {
                                if (!liveId) throw new Error("missing liveId for liveedge");
                                const urlSeat = `https://api.live2.nicovideo.jp/api/v2/guest/seat/${liveId}`;
                                const resSeat = await fetch(urlSeat, {
                                    headers: { ...this.HTTP_HEADERS, "accept": "application/json" },
                                });
                                if (resSeat.ok) {
                                    const seat = await resSeat.json();
                                    const msUri = seat?.data?.messageServer?.uri;
                                    const threadId = seat?.data?.threadId;
                                    if (msUri && threadId) {
                                        this.logDebug("[NDGRClient] messageServer resolved via guest seat");
                                        await this.streamMessageServer(msUri, threadId, onComment, onError);
                                        return;
                                    }
                                } else {
                                    this.logDebug("[NDGRClient] guest seat failed", resSeat.status);
                                    await this.logResponseSnippet("[NDGRClient] guest seat body", resSeat);
                                }
                            } catch (e) {
                                this.logDebug("[NDGRClient] guest seat error:", e);
                            }
                        }
                    } catch (e) {
                        this.logDebug("[NDGRClient] watch WS parse error:", e);
                    }
                };

                ws.onerror = (err) => {
                    console.error("[NDGRClient] watch WS error:", err);
                    if (onError) onError(err instanceof Error ? err : new Error(String(err)));
                };
                ws.onclose = () => {
                    // Stop watch keepSeat interval on close
                    try {
                        if (this.watchSeatInterval) {
                            clearInterval(this.watchSeatInterval);
                            this.watchSeatInterval = null;
                            this.watchSeatIntervalSec = null;
                        }
                    } catch (_) { /* ignore */ }
                    resolve();
                };

                // ws.onclose is handled above with cleanup and resolve

                this.abortController?.signal.addEventListener("abort", () => {
                    try { ws.close(); } catch (_) { /* ignore */ }
                });
            } catch (e) {
                console.error("[NDGRClient] Failed to open watch WS:", e);
                if (onError) onError(e instanceof Error ? e : new Error(String(e)));
                resolve();
            }
        });
    }

    /**
     * Main entry point: Stream comments from a Niconico live broadcast
     */
    async streamComments(
        liveId: string,
        onComment: (comment: NiconicoComment) => void,
        onError?: (error: Error) => void
    ): Promise<void> {
        this.abortController = new AbortController();

        try {
            await this.loadProto();
            let viewApiUri: string | null = null;

            try {
                viewApiUri = await this.getViewApiUri(liveId);
                try {
                    const url = new URL(viewApiUri);
                    this.watchAudienceToken = url.searchParams.get("audience_token");
                } catch (_) {
                    // keep any audienceToken extracted from embedded data
                }
            } catch (err) {
                // If View API URI cannot be obtained, try seat/watch fallbacks directly
                const resolved = await this.resolveAnonymousMessageServer(liveId, this.watchAudienceToken);
                if (resolved) {
                    this.logDebug("[NDGRClient] Bypassing watch WS; connecting to messageServer via seat/watch fallback");
                    await this.streamMessageServer(resolved.msUri, resolved.threadId, onComment, onError);
                    return;
                }
                throw err;
            }

            if (!viewApiUri) throw new Error("View API URI missing after scraping");

            // Handle mpn (HTTP polling) endpoints
            if (viewApiUri.includes("mpn.live.nicovideo.jp/api/view/")) {
                this.logDebug("[NDGRClient] Using HTTP polling (mpn)");
                const httpUri = viewApiUri.replace(/^wss:/, "https:");
                await this.streamCommentsHttp(httpUri, onComment, onError);
                return;
            }

            this.logDebug("[NDGRClient] Using WebSocket");
            await this.streamCommentsWs(viewApiUri, onComment, onError, liveId);
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error("[NDGRClient] streamComments error:", message);
            if (onError) onError(err instanceof Error ? err : new Error(message));
        }
    }


}
