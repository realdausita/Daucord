/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Daucord contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Apple Music API integration. Apple's lyrics endpoint is not part of the
// public Apple Music API documentation; this uses the same catalog endpoint
// the Music web player uses and falls back gracefully when it is unavailable.

import type { Line, Song } from "@plugins/spotifyLyricsStatus/lyrics";

const API = "https://api.music.apple.com";

interface Tokens {
    developerToken: string;
    userToken?: string;
    storefront: string;
}

async function request(path: string, tokens: Tokens): Promise<any> {
    const headers: Record<string, string> = {
        Authorization: `Bearer ${tokens.developerToken}`
    };
    if (tokens.userToken) headers["Music-User-Token"] = tokens.userToken;

    const response = await fetch(API + path, { headers });
    if (!response.ok) throw new Error(`Apple Music API ${response.status}`);
    return response.json();
}

function secondsFrom(value: any): number {
    if (typeof value === "number") return value > 1000 ? value / 1000 : value;
    if (typeof value !== "string") return 0;
    const match = value.match(/(\d+):(\d+(?:\.\d+)?)/);
    if (match) return Number(match[1]) * 60 + Number(match[2]);
    const num = Number(value);
    return Number.isFinite(num) ? (num > 1000 ? num / 1000 : num) : 0;
}

function fromTimedItems(value: any): Line[] | null {
    if (!Array.isArray(value)) return null;
    const items = value.filter(item =>
        item && typeof item === "object" &&
        (item.timestamp != null || item.time != null || item.at != null) &&
        typeof (item.text ?? item.line ?? item.lyric) === "string"
    );
    if (items.length < 2) return null;
    return items.map(item => ({
        at: Math.round(secondsFrom(item.timestamp ?? item.time ?? item.at) * 1000),
        text: String(item.text ?? item.line ?? item.lyric).trim() || null
    })).sort((a, b) => a.at - b.at);
}

function findLrc(value: any): string | null {
    if (typeof value === "string") return value.includes("[") && /\]\S/.test(value) ? value : null;
    if (Array.isArray(value)) {
        for (const item of value) {
            const found = findLrc(item);
            if (found) return found;
        }
        return null;
    }
    if (value && typeof value === "object") {
        for (const key of ["lyrics", "syncedLyrics", "plainLyrics", "content", "text"]) {
            if (!(key in value)) continue;
            const found = findLrc(value[key]);
            if (found) return found;
        }
    }
    return null;
}

function parseAppleLrc(lrc: string): Line[] {
    const lines: Line[] = [];
    for (const raw of lrc.split("\n")) {
        const match = raw.match(/\[(\d+):(\d+(?:\.\d+)?)\]/);
        if (!match) continue;
        const text = raw.replace(/\[\d+:\d+(?:\.\d+)?\]/g, "").trim();
        lines.push({
            at: Math.round((Number(match[1]) * 60 + Number(match[2])) * 1000),
            text: text || null
        });
    }
    return lines.sort((a, b) => a.at - b.at);
}

export async function findAppleLyrics(song: Song, tokens: Tokens): Promise<Line[] | null> {
    if (!tokens.developerToken) return null;

    const term = encodeURIComponent(`${song.name} ${song.artists[0] ?? ""}`);
    const search = await request(
        `/v1/catalog/${encodeURIComponent(tokens.storefront)}/search?term=${term}&types=songs&limit=5`,
        tokens
    );
    const results = search?.results?.songs?.data;
    if (!Array.isArray(results) || !results.length) return null;

    const match = results.find((item: any) =>
        item?.attributes?.name?.toLowerCase() === song.name.toLowerCase()
    ) ?? results[0];
    const id = match?.id;
    if (!id) return null;

    let payload: any;
    try {
        payload = await request(
            `/v1/catalog/${encodeURIComponent(tokens.storefront)}/songs/${encodeURIComponent(id)}/lyrics`,
            tokens
        );
    } catch {
        return null;
    }

    const timed = fromTimedItems(payload);
    if (timed) return timed;

    const lrc = findLrc(payload);
    if (lrc) {
        const lines = parseAppleLrc(lrc);
        if (lines.filter(line => line.text).length >= 2) return lines;
    }

    return null;
}
