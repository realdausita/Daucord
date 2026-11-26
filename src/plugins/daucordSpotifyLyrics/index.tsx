/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Daucord contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { get as dsGet, set as dsSet } from "@api/DataStore";
import { definePluginSettings } from "@api/Settings";
import { Button } from "@components/Button";
import { findLyrics, type Line, type Song } from "@plugins/spotifyLyricsStatus/lyrics";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType, PluginNative, StartAt } from "@utils/types";
import { findByPropsLazy } from "@webpack";
import { ColorPicker, showToast } from "@webpack/common";

const
    POSITION_KEY = "Daucord_lyricsPosition",
    DiscordSpotify = findByPropsLazy("getActiveSocketAndDevice", "getActivity");

const Native = IS_WEB
    ? null
    : VencordNative.pluginHelpers.DaucordSpotifyLyrics as PluginNative<typeof import("./native")> | undefined;

let root: HTMLDivElement | null = null;
let card: HTMLDivElement | null = null;
let coverEl: HTMLImageElement | null = null;
let titleEl: HTMLDivElement | null = null;
let artistEl: HTMLDivElement | null = null;
let bodyEl: HTMLDivElement | null = null;
let stackEl: HTMLDivElement | null = null;
let barEl: HTMLDivElement | null = null;
let frame = 0;
let position = { x: -1, y: -1 };

let song: Song | null = null;
let cover = "";
let lines: Line[] | null = null;
let loading = false;
let currentIndex = -1;
let activeWord = -1;
let songPosition = 0;
let positionAt = 0;
let playing = false;
let lastDockSync = 0;

interface Row {
    el: HTMLDivElement;
    words: { el: HTMLSpanElement; start: number; end: number; }[];
}

let rows: Row[] = [];

const settings = definePluginSettings({
    showWidget: {
        type: OptionType.BOOLEAN,
        description: "Show the lyrics widget",
        default: true,
        onChange: applyTheme
    },
    dockToPlayer: {
        type: OptionType.BOOLEAN,
        description: "Show the lyrics inside the SpotifyControls player instead of a floating window",
        default: true,
        onChange: applyTheme
    },
    hideWhenPaused: {
        type: OptionType.BOOLEAN,
        description: "Hide the widget when playback is paused",
        default: false,
        onChange: applyTheme
    },
    showCover: {
        type: OptionType.BOOLEAN,
        description: "Show the album cover",
        default: true,
        onChange: applyTheme
    },
    showNeighbours: {
        type: OptionType.BOOLEAN,
        description: "Show the lines around the current one",
        default: true,
        onChange: applyTheme
    },
    theme: {
        type: OptionType.SELECT,
        description: "Widget style",
        options: [
            { label: "Glass", value: "glass", default: true },
            { label: "Solid", value: "solid" },
            { label: "Accent gradient", value: "accent" }
        ],
        onChange: applyTheme
    },
    accentColor: {
        type: OptionType.COMPONENT,
        default: "#1ed760",
        component: AccentColorComponent
    },
    fontSize: {
        type: OptionType.SLIDER,
        description: "Lyrics font size",
        markers: [12, 14, 16, 18, 20, 24],
        default: 16,
        stickToMarkers: false,
        onChange: applyTheme
    },
    opacity: {
        type: OptionType.SLIDER,
        description: "Widget background opacity",
        markers: [40, 60, 80, 100],
        default: 92,
        stickToMarkers: false,
        onChange: applyTheme
    },
    width: {
        type: OptionType.SLIDER,
        description: "Widget width, ignored while docked",
        markers: [240, 300, 360, 420, 480],
        default: 380,
        stickToMarkers: false,
        onChange: applyTheme
    },
    lyricsSource: {
        type: OptionType.SELECT,
        description: "Where to get synced lyrics from",
        options: [
            { label: "Auto: LRCLIB, then NetEase, QQ Music, Apple Music", value: "auto", default: true },
            { label: "LRCLIB only", value: "lrclib" },
            { label: "NetEase Cloud Music", value: "netease" },
            { label: "QQ Music", value: "qq" },
            { label: "Apple Music only (needs a token)", value: "apple" }
        ],
        onChange: reloadLyrics
    },
    appleDeveloperToken: {
        type: OptionType.STRING,
        description: "Apple Music developer token (JWT), only needed for the Apple source",
        default: "",
        sensitive: true
    },
    appleUserToken: {
        type: OptionType.STRING,
        description: "Music user token, if required by your setup",
        default: "",
        sensitive: true
    },
    appleStorefront: {
        type: OptionType.STRING,
        description: "Apple Music storefront code",
        default: "us"
    },
    testLyrics: {
        type: OptionType.COMPONENT,
        component: TestLyricsComponent
    },
    resetPosition: {
        type: OptionType.COMPONENT,
        component: ResetPositionComponent
    }
});

const now = () => Date.now();

function clockPosition() {
    return playing ? songPosition + (now() - positionAt) : songPosition;
}

function shade(hex: string, amount: number): string {
    const clean = hex.replace("#", "");
    const full = clean.length === 3 ? clean.split("").map(c => c + c).join("") : clean.padEnd(6, "0");
    const num = parseInt(full.slice(0, 6), 16) || 0x1ed760;
    const ch = (shift: number) => (num >> shift) & 255;
    const mix = (c: number) => Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount);
    return `rgb(${mix(ch(16))}, ${mix(ch(8))}, ${mix(ch(0))})`;
}

function isDocked() {
    return !!settings.store.dockToPlayer && !!document.getElementById("vc-spotify-player");
}

function clampPosition() {
    if (!root || !card || root.style.display === "none" || isDocked()) return;
    const maxX = Math.max(4, window.innerWidth - card.offsetWidth - 4);
    const maxY = Math.max(4, window.innerHeight - card.offsetHeight - 4);
    position.x = Math.max(4, Math.min(position.x, maxX));
    position.y = Math.max(4, Math.min(position.y, maxY));
    root.style.left = `${position.x}px`;
    root.style.top = `${position.y}px`;
    root.style.bottom = "auto";
}

function applyBodyHeight() {
    if (!bodyEl) return;
    const s = settings.store;
    const factor = isDocked() ? 3.4 : (s.showNeighbours ? 4.6 : 1.5);
    bodyEl.style.height = `${Math.round(s.fontSize * 1.3 * factor + 14)}px`;
}

/** Lives inside the SpotifyControls player, which grows upward to fit the lyrics */
function syncDock() {
    if (!root || !card) return;
    const player = settings.store.dockToPlayer ? document.getElementById("vc-spotify-player") : null;
    const wasDocked = root.classList.contains("daucord-lyrics--docked");

    if (player) {
        root.classList.add("daucord-lyrics--docked");
        if (root.parentElement !== player) player.insertBefore(root, player.firstChild);
        root.style.removeProperty("left");
        root.style.removeProperty("top");
        root.style.removeProperty("bottom");
        card.style.width = "";
    } else {
        root.classList.remove("daucord-lyrics--docked");
        if (root.parentElement !== document.body) document.body.append(root);
        card.style.width = `${settings.store.width}px`;
        clampPosition();
    }

    if (wasDocked !== !!player) applyBodyHeight();
    lastDockSync = now();
}

function applyTheme() {
    if (!root) return;
    const s = settings.store;
    root.classList.remove("daucord-lyrics--glass", "daucord-lyrics--solid", "daucord-lyrics--accent");
    root.classList.add(`daucord-lyrics--${s.theme}`);
    root.classList.toggle("daucord-lyrics--no-cover", !s.showCover);
    root.classList.toggle("daucord-lyrics--no-neighbours", !s.showNeighbours);
    root.classList.toggle("daucord-lyrics--paused", !playing);
    root.style.setProperty("--dc-accent", s.accentColor);
    root.style.setProperty("--dc-accent-soft", shade(s.accentColor, 0.25));
    root.style.setProperty("--dc-accent-dark", shade(s.accentColor, -0.3));
    root.style.setProperty("--dc-font-size", `${s.fontSize}px`);
    root.style.setProperty("--dc-opacity", String(s.opacity / 100));
    applyBodyHeight();
    const visible = !!song && s.showWidget && (!s.hideWhenPaused || playing);
    root.style.display = visible ? "block" : "none";
    if (visible) requestAnimationFrame(() => centerRow(rows[Math.max(0, currentIndex)]));
    syncDock();
}

function savePosition() {
    dsSet(POSITION_KEY, position).catch(() => { });
}

function onPointerDown(e: PointerEvent) {
    if (!root || isDocked()) return;
    e.preventDefault();
    root.setPointerCapture(e.pointerId);
    root.classList.add("daucord-lyrics--dragging");
    const startX = e.clientX - position.x;
    const startY = e.clientY - position.y;
    const move = (ev: PointerEvent) => {
        position.x = ev.clientX - startX;
        position.y = ev.clientY - startY;
        clampPosition();
    };
    const up = () => {
        root?.removeEventListener("pointermove", move);
        root?.removeEventListener("pointerup", up);
        root?.classList.remove("daucord-lyrics--dragging");
        savePosition();
    };
    root.addEventListener("pointermove", move);
    root.addEventListener("pointerup", up);
}

function renderHeader() {
    if (!coverEl || !titleEl || !artistEl || !song) return;
    titleEl.textContent = song.name;
    artistEl.textContent = song.artists.join(", ") || "Unknown artist";
    if (cover) {
        coverEl.src = cover;
        coverEl.style.display = "block";
    } else {
        coverEl.removeAttribute("src");
        coverEl.style.display = "none";
    }
}

async function loadLyrics(song: Song) {
    const s = settings.store;
    if (Native) {
        const found = await Native.fetchLyrics(song, s.lyricsSource, {
            developerToken: s.appleDeveloperToken,
            userToken: s.appleUserToken || undefined,
            storefront: s.appleStorefront || "us"
        }).catch(() => null);
        return found?.lines ?? null;
    }
    // The browser build cannot reach NetEase or QQ Music: neither sends CORS headers
    return findLyrics(song).catch(() => null);
}

/** Words get their own span so spaces never collapse and only words light up */
function buildRows() {
    if (!stackEl) return;
    stackEl.textContent = "";
    rows = [];

    if (!lines) {
        const note = document.createElement("div");
        note.className = "daucord-lyrics__row daucord-lyrics__row--gap";
        note.textContent = loading ? "Searching lyrics…" : "No synced lyrics found";
        stackEl.append(note);
        rows.push({ el: note, words: [] });
        return;
    }

    for (const line of lines) {
        const row = document.createElement("div");
        row.className = "daucord-lyrics__row";

        if (!line.text) {
            row.classList.add("daucord-lyrics__row--gap");
            row.textContent = "♪";
            rows.push({ el: row, words: [] });
            stackEl.append(row);
            continue;
        }

        const spans: Row["words"] = [];
        if (line.words?.length) {
            // Real word timing from the provider
            for (const word of line.words) {
                const el = document.createElement("span");
                el.className = "daucord-lyrics__word";
                el.textContent = word.text;
                el.style.setProperty("--wp", "0");
                row.append(el);
                spans.push({ el, start: word.at, end: Math.max(word.end, word.at + 40) });
            }
        } else {
            // No word timing: spread the line evenly over its characters
            const words = line.text.split(/\s+/).filter(Boolean);
            const total = words.reduce((sum, word) => sum + word.length, 0) || 1;
            const nextAt = lines![lines!.indexOf(line) + 1]?.at ?? line.at + 4000;
            let passed = 0;
            words.forEach((word, i) => {
                const el = document.createElement("span");
                el.className = "daucord-lyrics__word";
                el.textContent = i === words.length - 1 ? word : `${word} `;
                el.style.setProperty("--wp", "0");
                row.append(el);
                const start = line.at + (passed / total) * (nextAt - line.at);
                passed += word.length;
                spans.push({
                    el,
                    start,
                    end: line.at + (passed / total) * (nextAt - line.at)
                });
            });
        }

        rows.push({ el: row, words: spans });
        stackEl.append(row);
    }
}

function centerRow(row: Row | undefined) {
    if (!stackEl || !bodyEl || !row) return;
    const offset = bodyEl.clientHeight / 2 - (row.el.offsetTop + row.el.offsetHeight / 2);
    stackEl.style.transform = `translateY(${offset}px)`;
}

function resetWipe(row: Row | undefined) {
    row?.words.forEach(word => word.el.style.setProperty("--wp", "0"));
}

function renderActive() {
    if (!lines) {
        currentIndex = -1;
        return;
    }
    if (!rows.length) {
        currentIndex = -1;
        return;
    }
    const at = clockPosition();
    let index = -1;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].at <= at) index = i;
        else break;
    }

    if (index !== currentIndex) {
        resetWipe(rows[currentIndex]);

        currentIndex = index;
        activeWord = -1;
        const target = rows[Math.max(0, index)];
        rows.forEach((row, i) => {
            row.el.classList.toggle("is-active", i === index);
            row.el.classList.toggle("is-past", i < index);
        });
        centerRow(target);
    }

    const row = rows[index];
    if (!row || !row.words.length) return;

    // A continuous fill instead of switching words on and off
    let word = -1;
    for (let i = 0; i < row.words.length; i++) {
        if (at >= row.words[i].start) word = i;
        else break;
    }

    if (word !== activeWord) {
        row.words.forEach((item, i) => item.el.style.setProperty("--wp", i < word ? "100" : "0"));
        activeWord = word;
    }

    const current = row.words[word];
    if (current) {
        const local = Math.min(1, Math.max(0, (at - current.start) / Math.max(1, current.end - current.start)));
        current.el.style.setProperty("--wp", String(local * 100));
    }
}

function tick() {
    if (song && root?.style.display !== "none") {
        renderActive();
        if (barEl) barEl.style.width = `${Math.min(100, Math.max(0, clockPosition() / Math.max(1, song.duration) * 100))}%`;
    }
    if (settings.store.dockToPlayer && now() - lastDockSync > 800) syncDock();
    frame = requestAnimationFrame(tick);
}

async function reloadLyrics() {
    if (!song) return;
    const current = song;
    lines = null;
    loading = true;
    currentIndex = -1;
    buildRows();
    applyTheme();
    centerRow(rows[0]);
    const found = await loadLyrics(current);
    if (song?.id !== current.id) return;
    loading = false;
    lines = found;
    buildRows();
    centerRow(rows[0]);
    renderActive();
}

interface SpotifyTrack {
    id: string | null;
    name: string;
    duration: number;
    album?: { name?: string; image?: { url?: string; }; };
    artists?: { name: string; }[];
}

async function applyTrack(track: SpotifyTrack | null, positionMs: number, isPlaying: boolean) {
    if (!root) return;
    songPosition = positionMs;
    positionAt = now();
    playing = !!isPlaying && !!track;

    if (!track?.name) {
        song = null;
        lines = null;
        loading = false;
        buildRows();
        applyTheme();
        centerRow(rows[0]);
        return;
    }

    const next: Song = {
        id: track.id ?? `${track.name}|${(track.artists ?? []).map(a => a.name).join(",")}`,
        name: track.name,
        artists: (track.artists ?? []).map(a => a.name).filter(Boolean),
        album: track.album?.name ?? "",
        duration: track.duration
    };
    cover = track.album?.image?.url ?? "";

    if (next.id !== song?.id) {
        song = next;
        lines = null;
        loading = true;
        currentIndex = -1;
        buildRows();
        renderHeader();
        applyTheme();
        centerRow(rows[0]);
        const found = await loadLyrics(next);
        if (song?.id !== next.id) return;
        loading = false;
        lines = found;
        buildRows();
        centerRow(rows[0]);
        renderActive();
    }
    applyTheme();
    renderHeader();
}

function readCurrentActivity() {
    try {
        const activity: any = DiscordSpotify.getActivity();
        const { start, end } = activity?.timestamps ?? {};
        if (!activity?.details || !start || !end) return;
        void applyTrack({
            id: activity.sync_id ?? activity.details,
            name: activity.details,
            duration: end - start,
            album: { name: activity.assets?.large_text ?? "" },
            artists: String(activity.state ?? "").split("; ").filter(Boolean).map(name => ({ name }))
        }, now() - start, true);
    } catch { }
}

export default definePlugin({
    name: "DaucordSpotifyLyrics",
    description: "A floating, animated karaoke-style lyrics widget synced to Spotify",
    tags: ["Media", "Appearance"],
    authors: [Devs.Daucord],
    requiresRestart: false,
    startAt: StartAt.DOMContentLoaded,
    settings,

    async start() {
        root = document.createElement("div");
        root.id = "daucord-spotify-lyrics";
        root.className = "daucord-lyrics";

        card = document.createElement("div");
        card.className = "daucord-lyrics__card";

        const head = document.createElement("div");
        head.className = "daucord-lyrics__head";

        coverEl = document.createElement("img");
        coverEl.className = "daucord-lyrics__cover";
        coverEl.alt = "";

        const texts = document.createElement("div");
        texts.className = "daucord-lyrics__meta";
        titleEl = document.createElement("div");
        titleEl.className = "daucord-lyrics__title";
        artistEl = document.createElement("div");
        artistEl.className = "daucord-lyrics__artist";
        texts.append(titleEl, artistEl);

        const eq = document.createElement("div");
        eq.className = "daucord-lyrics__eq";
        eq.innerHTML = "<i></i><i></i><i></i><i></i>";

        head.append(coverEl, texts, eq);

        bodyEl = document.createElement("div");
        bodyEl.className = "daucord-lyrics__body";
        stackEl = document.createElement("div");
        stackEl.className = "daucord-lyrics__stack";
        bodyEl.append(stackEl);

        const progress = document.createElement("div");
        progress.className = "daucord-lyrics__progress";
        barEl = document.createElement("div");
        barEl.className = "daucord-lyrics__progress-bar";
        progress.append(barEl);

        card.append(head, bodyEl, progress);
        root.append(card);
        document.body.append(root);

        root.addEventListener("pointerdown", onPointerDown);
        window.addEventListener("resize", syncDock);

        const saved = await dsGet<typeof position>(POSITION_KEY).catch(() => undefined);
        if (!root) return;
        position = saved ?? { x: 16, y: 16 };
        applyTheme();
        readCurrentActivity();
        frame = requestAnimationFrame(tick);
    },

    stop() {
        cancelAnimationFrame(frame);
        window.removeEventListener("resize", syncDock);
        root?.remove();
        root = card = coverEl = titleEl = artistEl = bodyEl = stackEl = barEl = null;
        song = null;
        lines = null;
        rows = [];
        currentIndex = -1;
        activeWord = -1;
    },

    flux: {
        SPOTIFY_PLAYER_STATE(e: { track: SpotifyTrack | null; isPlaying: boolean; position?: number; }) {
            void applyTrack(e.track, e.position ?? 0, !!e.isPlaying);
        }
    }
});

function AccentColorComponent() {
    const value = settings.use(["accentColor"]);
    const color = parseInt((value.accentColor || "#1ed760").replace("#", ""), 16) || 0x1ed760;
    return (
        <div style={{ display: "flex", justifyContent: "center" }}>
            <ColorPicker
                color={color}
                onChange={newColor => {
                    if (newColor == null) return;
                    settings.store.accentColor = `#${newColor.toString(16).padStart(6, "0")}`;
                    applyTheme();
                }}
                showEyeDropper={false}
            />
        </div>
    );
}

function TestLyricsComponent() {
    return (
        <Button onClick={async () => {
            if (!song) {
                showToast({ text: "Play a song first.", variant: "critical" });
                return;
            }
            const found = await loadLyrics(song);
            showToast({
                text: found ? `${found.length} timed lines loaded` : "No timed lyrics found with the selected source",
                variant: found ? "success" : "critical"
            });
        }}>
            Test lyrics lookup
        </Button>
    );
}

function ResetPositionComponent() {
    return (
        <Button onClick={() => {
            if (!root || !card) return;
            position = { x: 16, y: 16 };
            clampPosition();
            savePosition();
        }}>
            Reset lyrics position
        </Button>
    );
}
