// Token storage for OAuth tokens
import { join } from "@std/path/join";
import { ensureDir } from "@std/fs";

interface TokenData {
    access_token: string;
    refresh_token?: string;
    expires_at?: number; // Unix timestamp
    scope?: string;
}

export class TokenStore {
    private cacheDir: string;

    constructor(cacheDir: string) {
        this.cacheDir = cacheDir;
    }

    private async getTokenPath(platform: "youtube" | "niconico") {
        await ensureDir(this.cacheDir);
        return join(this.cacheDir, `${platform}_tokens.json`);
    }

    async saveTokens(platform: "youtube" | "niconico", tokens: TokenData): Promise<void> {
        const tokenPath = await this.getTokenPath(platform);
        await Deno.writeTextFile(tokenPath, JSON.stringify(tokens, null, 2));
    }

    async getTokens(platform: "youtube" | "niconico"): Promise<TokenData | null> {
        try {
            const tokenPath = await this.getTokenPath(platform);
            const text = await Deno.readTextFile(tokenPath);
            return JSON.parse(text);
        } catch {
            return null;
        }
    }

    async deleteTokens(platform: "youtube" | "niconico"): Promise<void> {
        try {
            const tokenPath = await this.getTokenPath(platform);
            await Deno.remove(tokenPath);
        } catch {
            // Ignore if file doesn't exist
        }
    }

    async isTokenValid(platform: "youtube" | "niconico"): Promise<boolean> {
        const tokens = await this.getTokens(platform);
        if (!tokens || !tokens.access_token) {
            return false;
        }

        // Check if token is expired (with 5 minute buffer)
        if (tokens.expires_at) {
            const now = Date.now() / 1000;
            return tokens.expires_at > (now + 300);
        }

        return true;
    }
}
