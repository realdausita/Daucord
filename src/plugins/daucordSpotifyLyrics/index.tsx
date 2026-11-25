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
import definePlugin, { OptionType, StartAt } from "@utils/types";
import { ColorPicker } from "@webpack/common";

const POSITION_KEY = "Daucord_lyricsPosition";

let root: HTMLDivElement | null = null;
let card: HTMLDivElement | null = null;
let coverEl: HTMLImageElement | null = null;
let titleEl: HTMLDivElement | null = null;
let artistEl: HTMLDivElement | null = null;
let bodyEl: HTMLDivElement | null = null;
let prevEl: HTMLDivElement | null = null;
let currentWrap: HTMLDivElement | null = null;
let currentEl: HTMLDivElement | null = null;
let nextEl: HTMLDivElement | null = null;
let barEl: HTMLDivElement | null = null;
let interval: number | null = null;
let position = { x: -1, y: -1 };

let song: Song | null = null;
let cover = "";
let lines: Line[] | null = null;
let currentIndex = -1;
let lineStart = 0;
let lineEnd = 0;
let chars: HTMLSpanElement[] = [];
let songPosition = 0;
let positionAt = 0;
let playing = false;

const settings = definePluginSettings({
    showWidget: {
        type: OptionType.BOOLEAN,
        description: "Show the floating lyrics widget",
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
        description: "Show the previous and next line",
        default: true,
        onChange: () => { renderLine(true); }
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
        description: "Widget width",
        markers: [240, 300, 360, 420, 480],
        default: 360,
        stickToMarkers: false,
        onChange: applyTheme
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

function clampPosition() {
    if (!root || !card || root.style.display === "none") return;
    const maxX = Math.max(4, window.innerWidth - card.offsetWidth - 4);
    const maxY = Math.max(4, window.innerHeight - card.offsetHeight - 4);
    position.x = Math.max(4, Math.min(position.x, maxX));
    position.y = Math.max(4, Math.min(position.y, maxY));
    root.style.left = `${position.x}px`;
    root.style.top = `${position.y}px`;
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
    if (card) card.style.width = `${s.width}px`;
    const visible = !!song && s.showWidget && (!s.hideWhenPaused || playing);
    root.style.display = visible ? "block" : "none";
    clampPosition();
}

function savePosition() {
    dsSet(POSITION_KEY, position).catch(() => { });
}

function onPointerDown(e: PointerEvent) {
    if (!root) return;
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

function renderLine(force = false) {
    if (!currentEl || !currentWrap || !prevEl || !nextEl || !lines) return;
    const at = clockPosition();
    let idx = -1;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].at <= at) idx = i;
        else break;
    }

    if (idx === currentIndex && !force) return;

    if (currentIndex >= 0 && currentEl.childNodes.length) {
        const ghost = currentEl.cloneNode(true) as HTMLDivElement;
        ghost.className = "daucord-lyrics__ghost";
        ghost.style.setProperty("--dc-font-size", `${settings.store.fontSize}px`);
        bodyEl?.append(ghost);
        window.setTimeout(() => ghost.remove(), 420);
    }

    currentIndex = idx;
    chars = [];
    currentEl.textContent = "";
    if (idx < 0 || !lines[idx]?.text) {
        currentEl.textContent = idx < 0 ? "♪" : "";
        prevEl.textContent = "";
        nextEl.textContent = lines[0]?.text ?? "";
        lineStart = at;
        lineEnd = lines[0]?.at ?? at + 1000;
        return;
    }

    const text = lines[idx].text ?? "";
    chars = Array.from(text).map((ch, i) => {
        const span = document.createElement("span");
        span.className = "daucord-lyrics__ch";
        span.style.setProperty("--i", String(i));
        span.textContent = ch;
        return span;
    });
    currentEl.append(...chars);
    prevEl.textContent = lines[idx - 1]?.text ?? "";
    nextEl.textContent = lines[idx + 1]?.text ?? "";
    lineStart = lines[idx].at;
    lineEnd = lines[idx + 1]?.at ?? lineStart + 4000;

    currentWrap.classList.remove("daucord-lyrics__current--in");
    void currentWrap.offsetWidth;
    currentWrap.classList.add("daucord-lyrics__current--in");
}

function tick() {
    if (!song || !lines) return;
    const at = clockPosition();
    renderLine();

    if (barEl) barEl.style.width = `${Math.min(100, Math.max(0, at / Math.max(1, song.duration) * 100))}%`;

    if (chars.length) {
        const frac = Math.min(1, Math.max(0, (at - lineStart) / Math.max(1, lineEnd - lineStart)));
        const active = Math.min(chars.length - 1, Math.floor(frac * chars.length));
        for (let i = 0; i < chars.length; i++) chars[i].classList.toggle("daucord-lyrics__ch--active", i === active);
    }
}

interface SpotifyTrack {
    id: string | null;
    name: string;
    duration: number;
    album?: { name?: string; image?: { url?: string; }; };
    artists?: { name: string; }[];
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
        prevEl = document.createElement("div");
        prevEl.className = "daucord-lyrics__line daucord-lyrics__line--prev";
        currentWrap = document.createElement("div");
        currentWrap.className = "daucord-lyrics__current";
        currentEl = document.createElement("div");
        currentEl.className = "daucord-lyrics__line daucord-lyrics__line--current";
        currentWrap.append(currentEl);
        nextEl = document.createElement("div");
        nextEl.className = "daucord-lyrics__line daucord-lyrics__line--next";
        bodyEl.append(prevEl, currentWrap, nextEl);

        const progress = document.createElement("div");
        progress.className = "daucord-lyrics__progress";
        barEl = document.createElement("div");
        barEl.className = "daucord-lyrics__progress-bar";
        progress.append(barEl);

        card.append(head, bodyEl, progress);
        root.append(card);
        document.body.append(root);

        root.addEventListener("pointerdown", onPointerDown);
        window.addEventListener("resize", clampPosition);

        const saved = await dsGet<typeof position>(POSITION_KEY).catch(() => undefined);
        if (!root) return;
        position = saved ?? { x: 16, y: 16 };
        applyTheme();
        interval = window.setInterval(tick, 90);
    },

    stop() {
        if (interval != null) clearInterval(interval);
        interval = null;
        window.removeEventListener("resize", clampPosition);
        root?.remove();
        root = card = coverEl = titleEl = artistEl = bodyEl = prevEl = currentWrap = currentEl = nextEl = barEl = null;
        song = null;
        lines = null;
        chars = [];
        currentIndex = -1;
    },

    flux: {
        async SPOTIFY_PLAYER_STATE(e: { track: SpotifyTrack | null; isPlaying: boolean; position?: number; }) {
            if (!root) return;
            const { track } = e;
            songPosition = e.position ?? 0;
            positionAt = now();
            playing = !!e.isPlaying && !!track;

            if (!track?.name) {
                song = null;
                lines = null;
                applyTheme();
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
                currentIndex = -1;
                renderHeader();
                applyTheme();
                try {
                    lines = await findLyrics(next);
                } catch { }
                if (song?.id === next.id) {
                    renderLine(true);
                    tick();
                }
            }
            applyTheme();
            renderHeader();
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
