/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Daucord contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Runs in the main process so providers without CORS headers can be reached.

import { type Line, parseLrc, type Song, type Word } from "@plugins/spotifyLyricsStatus/lyrics";
import { IpcMainInvokeEvent } from "electron";

export interface AppleTokens {
    developerToken: string;
    userToken?: string;
    storefront: string;
}

export interface LyricsResult {
    source: string;
    lines: Line[];
}

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

async function getJson<T>(url: string, headers?: Record<string, string>): Promise<T | null> {
    try {
        const response = await fetch(url, { headers: { "User-Agent": UA, ...headers } });
        if (!response.ok) return null;
        return await response.json() as T;
    } catch {
        return null;
    }
}

function normalize(value: string) {
    return (value || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function nameScore(candidate: string, wanted: string) {
    const a = normalize(candidate);
    const b = normalize(wanted);
    if (!a || !b) return 0;
    if (a === b) return 100;
    if (a.includes(b) || b.includes(a)) return 50;
    return 0;
}

function songScore(title: string, artists: string[], duration: number, song: Song) {
    let score = nameScore(title, song.name);
    if (artists.some(artist => normalize(artist) === normalize(song.artists[0] ?? ""))) score += 25;
    else if (artists.some(artist => normalize(artist).includes(normalize(song.artists[0] ?? "")))) score += 15;
    const delta = Math.abs(duration - song.duration / 1000);
    score -= Math.min(30, delta / 3);
    if (/cover|karaoke|instrumental|remix/i.test(title)) score -= 20;
    return score;
}

/** Keeps only real timed lines and drops metadata-only uploads */
function clean(lines: Line[] | null): Line[] | null {
    if (!lines) return null;
    return lines.filter(line => line.text).length >= 4 ? lines : null;
}

// ---------------------------------------------------------------- LRCLIB

interface LrcLibSong {
    trackName: string;
    artistName: string;
    duration: number;
    instrumental: boolean;
    syncedLyrics: string | null;
}

async function fromLrclib(song: Song): Promise<Line[] | null> {
    const params = new URLSearchParams({ track_name: song.name, artist_name: song.artists[0] ?? "" });
    const results = await getJson<LrcLibSong[]>(`https://lrclib.net/api/search?${params}`);
    if (!results?.length) return null;

    const ranked = results
        .filter(item => item?.syncedLyrics && !item.instrumental)
        .map(item => ({
            item,
            score: songScore(item.trackName, [item.artistName], item.duration, song)
        }))
        .sort((a, b) => b.score - a.score);

    for (const { item, score } of ranked) {
        if (score < 20) continue;
        const lines = clean(parseLrc(item.syncedLyrics!));
        if (lines) return lines;
    }
    return null;
}

// ---------------------------------------------------------------- NetEase

interface NetEaseSong {
    id: number;
    name: string;
    dt: number;
    ar?: { name: string; }[];
}

async function fromNetEase(song: Song): Promise<Line[] | null> {
    const query = encodeURIComponent(`${song.name} ${song.artists[0] ?? ""}`);
    const search = await getJson<{ result?: { songs?: NetEaseSong[]; }; }>(
        `https://music.163.com/api/cloudsearch/pc?s=${query}&type=1&limit=10`,
        { Referer: "https://music.163.com/" }
    );
    const list = search?.result?.songs;
    if (!list?.length) return null;

    const ranked = list
        .map(item => ({
            item,
            score: songScore(item.name, (item.ar ?? []).map(a => a.name), (item.dt || 0) / 1000, song)
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

    for (const { item, score } of ranked) {
        if (score < 20) continue;
        const payload = await getJson<{
            lrc?: { lyric?: string; };
            yrc?: { lyric?: string; };
        }>(
            `https://music.163.com/api/song/lyric?id=${item.id}&lv=-1&kv=-1&tv=-1&yv=-1`,
            { Referer: "https://music.163.com/" }
        );

        // Word level timing first, it is what makes the karaoke fill exact
        if (payload?.yrc?.lyric) {
            const lines = clean(parseYrc(payload.yrc.lyric));
            if (lines) return lines;
        }
        if (payload?.lrc?.lyric) {
            const lines = clean(parseLrc(payload.lrc.lyric));
            if (lines) return lines;
        }
    }
    return null;
}

const CREDITS = /^[\s\u3000]*(作词|作曲|编曲|制作人?|录音|混音|母带|监制|吉他|贝斯|鼓|和声|弦乐|出品|词|曲|Lyrics|Composed|Written|Produced|Arranged|Mixed|Mastered|Performed|Vocals?|Guitar|Bass|Drums|Piano|Synthesizer)\s*[:：]/i;

/** NetEase YRC: [lineStart,lineDuration](wordStart,wordDuration,?)text... */
function parseYrc(yrc: string): Line[] {
    const lines: Line[] = [];
    for (const raw of yrc.split("\n")) {
        const head = raw.match(/^\[(\d+),(\d+)\](.*)$/);
        if (!head) continue;

        const lineAt = Number(head[1]);
        const body = head[3];
        const words: Word[] = [];
        const segment = /\((\d+),(\d+),-?\d+\)([^()]*)/g;
        let match: RegExpExecArray | null;
        while ((match = segment.exec(body))) {
            const text = match[3];
            const duration = Number(match[2]);
            if (!text || duration <= 0) continue;
            const at = Number(match[1]);
            words.push({ at, end: at + duration, text });
        }
        if (!words.length) continue;

        const text = words.map(word => word.text).join("").trim();
        if (!text || CREDITS.test(text)) continue;
        lines.push({ at: lineAt || words[0].at, text, words });
    }
    return lines.sort((a, b) => a.at - b.at);
}

// ---------------------------------------------------------------- QQ Music

interface QqSong {
    songmid: string;
    songname: string;
    interval: number;
    singer?: { name: string; }[];
}

function decodeEntities(value: string) {
    return value
        .replace(/&#(\d+);/g, (_, dec: string) => String.fromCharCode(Number(dec)))
        .replace(/&#x([\da-f]+);/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, "\"")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&apos;/g, "'");
}

async function fromQq(song: Song): Promise<Line[] | null> {
    const query = encodeURIComponent(`${song.name} ${song.artists[0] ?? ""}`);
    const search = await getJson<{ data?: { song?: { list?: QqSong[]; }; }; }>(
        `https://c.y.qq.com/soso/fcgi-bin/client_search_cp?w=${query}&format=json&n=10&cr=1&t=0`,
        { Referer: "https://y.qq.com/" }
    );
    const list = search?.data?.song?.list;
    if (!list?.length) return null;

    const ranked = list
        .map(item => ({
            item,
            score: songScore(item.songname, (item.singer ?? []).map(a => a.name), item.interval || 0, song)
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

    for (const { item, score } of ranked) {
        if (score < 20) continue;
        const payload = await getJson<{ lyric?: string; }>(
            `https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg?songmid=${encodeURIComponent(item.songmid)}&format=json&nobase64=1`,
            { Referer: "https://y.qq.com/portal/player.html" }
        );
        const lrc = payload?.lyric;
        if (!lrc) continue;
        const lines = clean(parseLrc(decodeEntities(lrc)));
        if (lines) return lines;
    }
    return null;
}

// ---------------------------------------------------------------- Apple Music

const APPLE_API = "https://api.music.apple.com";

function secondsFrom(value: unknown): number {
    if (typeof value === "number") return value > 1000 ? value / 1000 : value;
    if (typeof value !== "string") return 0;
    const match = value.match(/(\d+):(\d+(?:\.\d+)?)/);
    if (match) return Number(match[1]) * 60 + Number(match[2]);
    const num = Number(value);
    return Number.isFinite(num) ? (num > 1000 ? num / 1000 : num) : 0;
}

function fromTimedItems(value: unknown): Line[] | null {
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

function findLrc(value: unknown): string | null {
    if (typeof value === "string") return /\[\d+:\d+/.test(value) ? value : null;
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
            const found = findLrc((value as Record<string, unknown>)[key]);
            if (found) return found;
        }
    }
    return null;
}

async function fromApple(song: Song, tokens: AppleTokens): Promise<Line[] | null> {
    if (!tokens.developerToken) return null;

    const headers: Record<string, string> = { Authorization: `Bearer ${tokens.developerToken}` };
    if (tokens.userToken) headers["Music-User-Token"] = tokens.userToken;
    const storefront = encodeURIComponent(tokens.storefront || "us");

    const term = encodeURIComponent(`${song.name} ${song.artists[0] ?? ""}`);
    const search = await getJson<{ results?: { songs?: { data?: any[]; }; }; }>(
        `${APPLE_API}/v1/catalog/${storefront}/search?term=${term}&types=songs&limit=5`,
        headers
    );
    const results = search?.results?.songs?.data;
    if (!Array.isArray(results) || !results.length) return null;

    const match = results.find(item => normalize(item?.attributes?.name ?? "") === normalize(song.name)) ?? results[0];
    if (!match?.id) return null;

    const payload = await getJson<any>(
        `${APPLE_API}/v1/catalog/${storefront}/songs/${encodeURIComponent(match.id)}/lyrics`,
        headers
    );
    if (!payload) return null;

    const timed = fromTimedItems(payload);
    if (timed) return clean(timed);

    const lrc = findLrc(payload);
    return lrc ? clean(parseLrc(lrc)) : null;
}

// ---------------------------------------------------------------- entry point

const cache = new Map<string, LyricsResult | null>();

export async function fetchLyrics(
    _: IpcMainInvokeEvent,
    song: Song,
    source: string,
    apple: AppleTokens
): Promise<LyricsResult | null> {
    const key = `${source}|${song.id}|${song.duration}|${apple.developerToken.slice(0, 8)}`;
    if (cache.has(key)) return cache.get(key)!;

    let result: LyricsResult | null = null;

    if (source === "auto") {
        // NetEase often has word level timing; a word synced result beats a longer line synced one
        const [netease, lrclib] = await Promise.all([
            fromNetEase(song).catch(() => null),
            fromLrclib(song).catch(() => null)
        ]);
        if (netease?.some(line => line.words?.length)) {
            result = { source: "NetEase", lines: netease };
        } else if (lrclib) {
            result = { source: "LRCLIB", lines: lrclib };
        } else if (netease) {
            result = { source: "NetEase", lines: netease };
        } else {
            const qq = await fromQq(song).catch(() => null);
            if (qq) result = { source: "QQ Music", lines: qq };
            else {
                const appleLines = await fromApple(song, apple).catch(() => null);
                if (appleLines) result = { source: "Apple Music", lines: appleLines };
            }
        }
    } else {
        const providers: [string, () => Promise<Line[] | null>][] = source === "apple"
            ? [["Apple Music", () => fromApple(song, apple)]]
            : source === "netease"
                ? [["NetEase", () => fromNetEase(song)]]
                : source === "qq"
                    ? [["QQ Music", () => fromQq(song)]]
                    : [["LRCLIB", () => fromLrclib(song)]];

        for (const [name, run] of providers) {
            const lines = await run().catch(() => null);
            if (lines) {
                result = { source: name, lines };
                break;
            }
        }
    }

    cache.set(key, result);
    if (cache.size > 60) cache.delete(cache.keys().next().value!);
    return result;
}
