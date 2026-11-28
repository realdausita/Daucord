/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Daucord contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { get as dsGet, set as dsSet } from "@api/DataStore";
import { definePluginSettings } from "@api/Settings";
import { Button } from "@components/Button";
import { SpotifyStore } from "@plugins/spotifyControls/SpotifyStore";
import { findLyrics, type Line, type Song } from "@plugins/spotifyLyricsStatus/lyrics";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType, PluginNative, StartAt } from "@utils/types";
import { findByPropsLazy } from "@webpack";
import { ColorPicker, showToast } from "@webpack/common";

const
    POSITION_KEY = "Daucord_lyricsPosition",
    STAGE_POS_KEY = "Daucord_lyricsStagePosition",
    CACHE_KEY = "Daucord_lyricsCache",
    CACHE_LIMIT = 40,
    DiscordSpotify = findByPropsLazy("getActiveSocketAndDevice", "getActivity");

const ICONS = {
    play: "M8 5v14l11-7z",
    pause: "M6 5h4v14H6zm8 0h4v14h-4z",
    prev: "M6 6h2v12H6zm3.5 6 8.5 6V6z",
    next: "M16 6h2v12h-2zM6 6l8.5 6L6 18z",
    shuffle: "M10.59 9.17 5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z",
    repeat: "M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z",
    close: "M18.3 5.71 12 12.01l-6.3-6.3-1.41 1.41 6.3 6.3-6.3 6.3 1.41 1.41 6.3-6.3 6.3 6.3 1.41-1.41-6.3-6.3 6.3-6.3z",
    expand: "M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z",
    compact: "M5 10h14v2H5zm0 4h9v2H5z"
};

function icon(path: string) {
    return `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="${path}"/></svg>`;
}

function formatTime(ms: number) {
    const seconds = Math.floor(Math.max(0, ms) / 1000);
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

interface CachedLyrics {
    [id: string]: { at: number; lines: Line[]; };
}

let cache: CachedLyrics | null = null;
let cacheReady: Promise<void> | null = null;

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
let dockObserver: MutationObserver | null = null;
let lastPlayer: HTMLElement | null = null;

let expanded = false;
let dragMoved = false;
let stage: HTMLDivElement | null = null;
let stageMount: HTMLDivElement | null = null;
let stageBackdrop: HTMLImageElement | null = null;
let stageCover: HTMLImageElement | null = null;
let stageTitle: HTMLDivElement | null = null;
let stageArtist: HTMLDivElement | null = null;
let stageBar: HTMLDivElement | null = null;
let stageCurrent: HTMLSpanElement | null = null;
let stageDuration: HTMLSpanElement | null = null;
let stagePlay: HTMLButtonElement | null = null;
let stageShuffle: HTMLButtonElement | null = null;
let stageRepeat: HTMLButtonElement | null = null;
let stagePos = { x: -1, y: -1 };
let clearedSurfaces: { el: HTMLElement; props: [string, string, string][]; }[] = [];
let stageCoverSrc = "";
let stagePlayingIcon: boolean | null = null;
let lastStageTick = 0;

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
    expandLyrics: {
        type: OptionType.COMPONENT,
        component: ExpandLyricsComponent
    },
    dockToPlayer: {
        type: OptionType.BOOLEAN,
        description: "Show the lyrics inside the SpotifyControls player instead of a floating window",
        default: true,
        onChange: applyTheme
    },
    defaultView: {
        type: OptionType.SELECT,
        description: "Which lyrics view to use: compact in the player, enlarged window, or the old floating card",
        options: [
            { label: "Compact (inside the player)", value: "compact", default: true },
            { label: "Enlarged window", value: "large" },
            { label: "Floating card", value: "floating" }
        ],
        onChange: applyViewSetting
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
    timingOffset: {
        type: OptionType.SLIDER,
        description: "Fine-tune the timing on top of the built-in 150 ms lead. Positive moves lyrics earlier, negative later",
        markers: [-1500, -1000, -500, -250, 0, 250, 500, 1000, 1500],
        min: -3000,
        max: 3000,
        default: 0,
        stickToMarkers: false
    },
    lyricsSource: {
        type: OptionType.SELECT,
        description: "Where to get synced lyrics from",
        options: [
            { label: "Auto: Spotify, NetEase, LRCLIB, QQ Music, Apple Music", value: "auto", default: true },
            { label: "Spotify (the signed-in account)", value: "spotify" },
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

const now = () => performance.now();

// Discord forwards Spotify's player state a fraction of a second after it was sampled.
// Leading the clock keeps words in step with the audio instead of trailing it.
const STATE_LEAD_MS = 150;

function clockPosition() {
    const at = playing ? songPosition + (now() - positionAt) : songPosition;
    return at + STATE_LEAD_MS + settings.store.timingOffset;
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

/** Every surface around the player that paints its own colour, so the theme behind it can show through */
function clearSurface(el: HTMLElement) {
    if (clearedSurfaces.some(s => s.el === el)) return;
    const props: [string, string, string][] = ["background", "background-image", "backdrop-filter", "-webkit-backdrop-filter", "box-shadow"].map(prop => [
        prop,
        el.style.getPropertyValue(prop),
        el.style.getPropertyPriority(prop)
    ]);
    clearedSurfaces.push({ el, props });
    el.classList.add("daucord-lyrics-flat");
    el.style.setProperty("background", "transparent", "important");
    el.style.setProperty("background-image", "none", "important");
    el.style.setProperty("backdrop-filter", "none", "important");
    el.style.setProperty("-webkit-backdrop-filter", "none", "important");
    el.style.setProperty("box-shadow", "none", "important");
}

function clearPlayerBox(player: HTMLElement) {
    let el: HTMLElement | null = player;
    for (let depth = 0; el && depth < 4; depth++, el = el.parentElement) {
        if (el !== player) {
            const cls = typeof el.className === "string" ? el.className : "";
            if (el === document.body || /sidebar/i.test(cls)) break;
            if (el.getBoundingClientRect().width >= 500) break;
        }
        clearSurface(el);
        const cls = typeof el.className === "string" ? el.className : "";
        if (el !== player && /panels/i.test(cls)) break;
    }
}

function restoreSurfaces() {
    for (const { el, props } of clearedSurfaces) {
        el.classList.remove("daucord-lyrics-flat");
        for (const [prop, value, priority] of props) {
            if (value) el.style.setProperty(prop, value, priority);
            else el.style.removeProperty(prop);
        }
    }
    clearedSurfaces = [];
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
    if (expanded) {
        // An explicit pixel height keeps the active line centred inside the stage
        bodyEl.style.height = stageMount ? `${stageMount.clientHeight}px` : "";
        return;
    }
    const s = settings.store;
    const factor = isDocked() ? 4.4 : (s.showNeighbours ? 4.6 : 1.5);
    bodyEl.style.height = `${Math.round(s.fontSize * 1.3 * factor + 14)}px`;
}

/** Lives inside the SpotifyControls player, which grows upward to fit the lyrics */
function syncDock() {
    if (!root || !card || expanded) return;
    const player = settings.store.dockToPlayer ? document.getElementById("vc-spotify-player") : null;
    const wasDocked = root.classList.contains("daucord-lyrics--docked");

    if (player) {
        root.classList.add("daucord-lyrics--docked");
        if (root.parentElement !== player) player.insertBefore(root, player.firstChild);
        root.style.removeProperty("left");
        root.style.removeProperty("top");
        root.style.removeProperty("bottom");
        card.style.width = "";
        card.style.setProperty("background", "transparent", "important");
        clearPlayerBox(player);
    } else {
        card.style.removeProperty("background");
        restoreSurfaces();
        root.classList.remove("daucord-lyrics--docked");
        if (root.parentElement !== document.body) document.body.append(root);
        card.style.width = `${settings.store.width}px`;
        clampPosition();
    }

    if (wasDocked !== !!player) applyBodyHeight();
    updateVisibility();
}

/** Never fall back to the floating card while docked: the player may not exist yet on startup */
function updateVisibility() {
    if (!root) return;
    const s = settings.store;
    const canShow = expanded || !s.dockToPlayer || !!document.getElementById("vc-spotify-player");
    const visible = !!song && s.showWidget && canShow && (expanded || !s.hideWhenPaused || playing);
    root.style.display = visible ? "block" : "none";
    if (visible) {
        requestAnimationFrame(() => centerRow(rows[Math.max(0, currentIndex)]));
        startTicking();
    }
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
    syncDock();
    updateVisibility();
}

function watchDock() {
    dockObserver?.disconnect();
    lastPlayer = document.getElementById("vc-spotify-player");
    dockObserver = new MutationObserver(() => {
        const player = document.getElementById("vc-spotify-player");
        if (player === lastPlayer) return;
        lastPlayer = player;
        syncDock();
    });
    dockObserver.observe(document.body, { childList: true, subtree: true });
}

function togglePlayback() {
    if (!song) return;
    // Apply locally first: waiting for Spotify's reply makes the UI feel frozen
    const at = clockPosition();
    playing = !playing;
    songPosition = at;
    positionAt = now();
    stagePlayingIcon = null;
    updateStage();
    applyTheme();
    void SpotifyStore.setPlaying(playing);
}

function toggleShuffle() {
    const next = !SpotifyStore.shuffle;
    SpotifyStore.shuffle = next;
    stageShuffle?.classList.toggle("is-on", next);
    void SpotifyStore.setShuffle(next);
}

function toggleRepeat() {
    const order = ["off", "context", "track"] as const;
    const current = (SpotifyStore.repeat ?? "off") as typeof order[number];
    const next = order[(order.indexOf(current) + 1) % order.length];
    SpotifyStore.repeat = next;
    stageRepeat?.classList.toggle("is-on", next !== "off");
    void SpotifyStore.setRepeat(next);
}

function makeControl(path: string, onClick: () => void) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "daucord-lyrics-stage__icon-btn";
    button.innerHTML = icon(path);
    button.addEventListener("click", e => {
        e.stopPropagation();
        onClick();
    });
    return button;
}

function onStagePointerDown(e: PointerEvent) {
    if (!stage) return;
    e.preventDefault();
    const rect = stage.getBoundingClientRect();
    stage.style.left = `${rect.left}px`;
    stage.style.top = `${rect.top}px`;
    stage.style.transform = "none";

    const startX = e.clientX - rect.left;
    const startY = e.clientY - rect.top;
    const move = (ev: PointerEvent) => {
        if (!stage) return;
        stage.style.left = `${Math.max(4, Math.min(window.innerWidth - rect.width - 4, ev.clientX - startX))}px`;
        stage.style.top = `${Math.max(4, Math.min(window.innerHeight - rect.height - 4, ev.clientY - startY))}px`;
    };
    const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        if (!stage) return;
        stagePos = { x: parseFloat(stage.style.left), y: parseFloat(stage.style.top) };
        void dsSet(STAGE_POS_KEY, stagePos).catch(() => { });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
}

function buildStage() {
    stage = document.createElement("div");
    stage.id = "daucord-spotify-lyrics-stage";
    stage.className = "daucord-lyrics-stage";

    const backdrop = document.createElement("div");
    backdrop.className = "daucord-lyrics-stage__backdrop";
    stageBackdrop = document.createElement("img");
    stageBackdrop.alt = "";
    backdrop.append(stageBackdrop);

    const scrim = document.createElement("div");
    scrim.className = "daucord-lyrics-stage__scrim";

    const top = document.createElement("div");
    top.className = "daucord-lyrics-stage__top";
    const compact = makeControl(ICONS.compact, () => setExpanded(false));
    compact.setAttribute("aria-label", "Back to compact lyrics");
    compact.title = "Back to compact lyrics";
    const close = makeControl(ICONS.close, () => setExpanded(false));
    close.setAttribute("aria-label", "Close");
    top.append(compact, close);
    top.addEventListener("pointerdown", onStagePointerDown);

    const main = document.createElement("div");
    main.className = "daucord-lyrics-stage__main";
    const meta = document.createElement("div");
    meta.className = "daucord-lyrics-stage__meta";
    stageCover = document.createElement("img");
    stageCover.className = "daucord-lyrics-stage__cover";
    stageCover.alt = "";
    const texts = document.createElement("div");
    stageTitle = document.createElement("div");
    stageTitle.className = "daucord-lyrics-stage__title";
    stageArtist = document.createElement("div");
    stageArtist.className = "daucord-lyrics-stage__artist";
    texts.append(stageTitle, stageArtist);
    meta.append(stageCover, texts);

    stageMount = document.createElement("div");
    stageMount.className = "daucord-lyrics-stage__lyrics";
    main.append(stageMount);

    const bottom = document.createElement("div");
    bottom.className = "daucord-lyrics-stage__bottom";
    const seek = document.createElement("div");
    seek.className = "daucord-lyrics-stage__seek";
    const seekTrack = document.createElement("div");
    seekTrack.className = "daucord-lyrics-stage__seek-track";
    stageBar = document.createElement("div");
    stageBar.className = "daucord-lyrics-stage__seek-bar";
    seekTrack.append(stageBar);
    seekTrack.addEventListener("pointerdown", e => {
        if (!song) return;
        const rect = seekTrack.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width)));
        SpotifyStore.seek(ratio * song.duration);
    });
    const times = document.createElement("div");
    times.className = "daucord-lyrics-stage__times";
    stageCurrent = document.createElement("span");
    stageDuration = document.createElement("span");
    times.append(stageCurrent, stageDuration);
    seek.append(seekTrack, times);

    const controls = document.createElement("div");
    controls.className = "daucord-lyrics-stage__controls";
    stageShuffle = makeControl(ICONS.shuffle, toggleShuffle);
    const prev = makeControl(ICONS.prev, () => void SpotifyStore.prev());
    stagePlay = makeControl(ICONS.pause, togglePlayback);
    stagePlay.classList.add("daucord-lyrics-stage__play");
    const next = makeControl(ICONS.next, () => void SpotifyStore.next());
    stageRepeat = makeControl(ICONS.repeat, toggleRepeat);
    controls.append(stageShuffle, prev, stagePlay, next, stageRepeat);

    bottom.append(meta, seek, controls);
    stage.append(backdrop, scrim, top, main, bottom);
    document.body.append(stage);
}

function updateStage() {
    if (!stage || !stageCover || !stageBackdrop) return;
    if (cover !== stageCoverSrc) {
        stageCoverSrc = cover;
        if (cover) {
            stageCover.src = cover;
            stageBackdrop.src = cover;
            stageCover.style.display = "block";
        } else {
            stageCover.removeAttribute("src");
            stageBackdrop.removeAttribute("src");
            stageCover.style.display = "none";
        }
    }
    if (stageTitle) stageTitle.textContent = song?.name ?? "";
    if (stageArtist) stageArtist.textContent = song?.artists.join(", ") ?? "";
    if (stageCurrent) stageCurrent.textContent = formatTime(clockPosition());
    if (stageDuration) stageDuration.textContent = formatTime(song?.duration ?? 0);
    if (stageBar) {
        stageBar.style.width = `${Math.min(100, Math.max(0, clockPosition() / Math.max(1, song?.duration ?? 1) * 100))}%`;
    }
    if (stagePlay && stagePlayingIcon !== playing) {
        stagePlayingIcon = playing;
        stagePlay.innerHTML = icon(playing ? ICONS.pause : ICONS.play);
    }
    if (stageShuffle) stageShuffle.classList.toggle("is-on", !!SpotifyStore.shuffle);
    if (stageRepeat) stageRepeat.classList.toggle("is-on", (SpotifyStore.repeat ?? "off") !== "off");
}

function setExpanded(next: boolean) {
    if (!root || !card || !stage || !stageMount || expanded === next) return;
    expanded = next;
    if (expanded) {
        root.classList.remove("daucord-lyrics--docked");
        root.classList.add("daucord-lyrics--expanded");
        stageMount.append(root);
        stage.style.display = "flex";
        if (stagePos.x >= 0) {
            stage.style.left = `${stagePos.x}px`;
            stage.style.top = `${stagePos.y}px`;
            stage.style.transform = "none";
        }
        updateStage();
    } else {
        root.classList.remove("daucord-lyrics--expanded");
        stage.style.display = "none";
        syncDock();
    }
    applyBodyHeight();
    updateVisibility();
    requestAnimationFrame(() => {
        applyBodyHeight();
        centerRow(rows[Math.max(0, currentIndex)]);
    });
}

function applyViewSetting() {
    const view = settings.store.defaultView;
    settings.store.dockToPlayer = view !== "floating";
    if (view === "large") setExpanded(true);
    else if (expanded) setExpanded(false);
    applyTheme();
}

function onResize() {
    syncDock();
    applyBodyHeight();
    centerRow(rows[Math.max(0, currentIndex)]);
}

function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape" && expanded) setExpanded(false);
}

function onRootClick() {
    if (!expanded && !dragMoved) setExpanded(true);
}

function savePosition() {
    dsSet(POSITION_KEY, position).catch(() => { });
}

function onPointerDown(e: PointerEvent) {
    if (!root || expanded) return;
    dragMoved = false;
    if (isDocked()) return;
    e.preventDefault();
    root.setPointerCapture(e.pointerId);
    root.classList.add("daucord-lyrics--dragging");
    const startX = e.clientX - position.x;
    const startY = e.clientY - position.y;
    const move = (ev: PointerEvent) => {
        dragMoved = true;
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

function preloadCache() {
    cacheReady ??= dsGet<CachedLyrics>(CACHE_KEY)
        .then(value => { cache = value ?? {}; })
        .catch(() => { cache = {}; });
    return cacheReady;
}

/** Synchronous: memory is already populated by the time a track usually starts */
function cachedLines(song: Song) {
    const hit = cache?.[`${song.id}|${settings.store.lyricsSource}`];
    if (hit?.lines?.length) {
        hit.at = Date.now();
        return hit.lines;
    }
    return null;
}

async function loadLyrics(song: Song) {
    const s = settings.store;
    const key = `${song.id}|${s.lyricsSource}`;

    const immediate = cachedLines(song);
    if (immediate) return immediate;

    await preloadCache();

    const hit = cache?.[key];
    if (hit?.lines?.length) {
        hit.at = Date.now();
        return hit.lines;
    }

    let lines: Line[] | null = null;
    if (Native) {
        let spotifyToken = "";
        try {
            spotifyToken = DiscordSpotify.getActiveSocketAndDevice()?.socket?.accessToken ?? "";
        } catch { }
        const found = await Native.fetchLyrics(song, s.lyricsSource, {
            developerToken: s.appleDeveloperToken,
            userToken: s.appleUserToken || undefined,
            storefront: s.appleStorefront || "us"
        }, spotifyToken).catch(() => null);
        lines = found?.lines ?? null;
    } else {
        // The browser build cannot reach NetEase or QQ Music: neither sends CORS headers
        lines = await findLyrics(song).catch(() => null);
    }

    if (lines?.length) {
        cache![key] = { at: Date.now(), lines };
        const ids = Object.keys(cache!);
        if (ids.length > CACHE_LIMIT) {
            ids.sort((a, b) => cache![a].at - cache![b].at);
            for (const id of ids.slice(0, ids.length - CACHE_LIMIT)) delete cache![id];
        }
        void dsSet(CACHE_KEY, cache).catch(() => { });
    }
    return lines;
}

/** Rough singing speed of this song, in milliseconds per character, from its typical lines */
function lyricPace(all: Line[]) {
    const samples: number[] = [];
    for (let i = 0; i < all.length - 1; i++) {
        const { text, at } = all[i];
        const { at: nextAt } = all[i + 1];
        const chars = text ? text.replace(/\s+/g, "").length : 0;
        const gap = nextAt - at;
        if (chars < 8 || gap < 800) continue;
        samples.push(gap / chars);
    }
    if (!samples.length) return 70;
    samples.sort((a, b) => a - b);
    return Math.min(150, Math.max(35, samples[Math.floor(samples.length / 2)]));
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

    const all = lines;
    const pace = lyricPace(all);

    for (let index = 0; index < all.length; index++) {
        const line = all[index];
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
            // No word timing: sing it at the song's own pace, then let the last word hold the tail
            const words = line.text.split(/\s+/).filter(Boolean);
            const chars = words.reduce((sum, word) => sum + word.length, 0) || 1;
            const nextAt = all[index + 1]?.at ?? (song?.duration ?? line.at + chars * pace + 4000);
            const gap = Math.max(500, nextAt - line.at);
            const natural = chars * pace;
            const sung = Math.min(gap - 120, natural * 1.1);
            const linger = Math.min(1400, Math.max(0, gap - 120 - sung));
            let passed = 0;
            words.forEach((word, wordIndex) => {
                const el = document.createElement("span");
                el.className = "daucord-lyrics__word";
                el.textContent = wordIndex === words.length - 1 ? word : `${word} `;
                el.style.setProperty("--wp", "0");
                row.append(el);
                const start = line.at + (passed / chars) * sung;
                passed += word.length;
                const end = wordIndex === words.length - 1
                    ? line.at + sung + linger
                    : line.at + (passed / chars) * sung;
                spans.push({ el, start, end: Math.max(end, start + 80) });
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
    frame = 0;
    if (!song || !root || root.style.display === "none") return;
    renderActive();
    if (barEl) barEl.style.width = `${Math.min(100, Math.max(0, clockPosition() / Math.max(1, song.duration) * 100))}%`;
    if (expanded && now() - lastStageTick > 200) {
        updateStage();
        lastStageTick = now();
    }
    frame = requestAnimationFrame(tick);
}

function startTicking() {
    if (!frame && song && root && root.style.display !== "none") frame = requestAnimationFrame(tick);
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

function trackId(track: SpotifyTrack) {
    return track.id ?? `${track.name}|${(track.artists ?? []).map(a => a.name).join(",")}`;
}

async function applyTrack(track: SpotifyTrack | null, positionMs: number, isPlaying: boolean) {
    if (!root) return;
    const perfNow = now();
    const nextId = track?.name ? trackId(track) : null;
    const newSong = !!nextId && nextId !== song?.id;
    const wasPlaying = playing;

    if (newSong || !nextId) {
        // Anchor the clock to the reported position once per track
        songPosition = positionMs;
        positionAt = perfNow;
    } else {
        const local = wasPlaying ? songPosition + (perfNow - positionAt) : songPosition;
        const delta = positionMs - local;

        if (isPlaying !== wasPlaying && !isPlaying) {
            // Pause freezes the local clock
            songPosition = local;
        } else if (Math.abs(delta) > 3000) {
            // A seek or a clearly stale report
            songPosition = positionMs;
        } else if (Math.abs(delta) > 150) {
            // Keep converging towards Spotify instead of drifting apart all song
            songPosition = local + delta * 0.6;
        } else {
            songPosition = local;
        }
        positionAt = perfNow;
    }
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
        id: nextId!,
        name: track.name,
        artists: (track.artists ?? []).map(a => a.name).filter(Boolean),
        album: track.album?.name ?? "",
        duration: track.duration
    };
    cover = track.album?.image?.url ?? "";

    if (newSong) {
        // Show cached lyrics synchronously so switching tracks never blanks the panel
        const cached = cachedLines(next);
        song = next;
        lines = cached;
        loading = !cached;
        currentIndex = -1;
        buildRows();
        renderHeader();
        applyTheme();
        centerRow(rows[0]);
        renderActive();
        if (!cached) {
            const found = await loadLyrics(next);
            if (song?.id !== next.id) return;
            loading = false;
            lines = found;
            buildRows();
            centerRow(rows[0]);
            renderActive();
        }
    }
    applyTheme();
    renderHeader();
    updateStage();
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
        }, Date.now() - start, true);
    } catch { }
}

export default definePlugin({
    name: "DaucordSpotifyLyrics",
    description: "Animated karaoke lyrics for Spotify, docked in the player or enlarged in a draggable window",
    tags: ["Media", "Appearance"],
    authors: [Devs.Daucord],
    dependencies: ["SpotifyControls"],
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

        const expand = document.createElement("button");
        expand.type = "button";
        expand.className = "daucord-lyrics__expand";
        expand.title = "Open enlarged lyrics";
        expand.setAttribute("aria-label", "Open enlarged lyrics");
        expand.innerHTML = icon(ICONS.expand);
        expand.addEventListener("click", e => {
            e.stopPropagation();
            setExpanded(true);
        });

        card.append(head, bodyEl, progress, expand);
        root.append(card);
        document.body.append(root);
        buildStage();

        root.addEventListener("pointerdown", onPointerDown);
        root.addEventListener("click", onRootClick);
        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("resize", onResize);

        const [saved, savedStage] = await Promise.all([
            dsGet<typeof position>(POSITION_KEY).catch(() => undefined),
            dsGet<typeof stagePos>(STAGE_POS_KEY).catch(() => undefined)
        ]);
        if (!root) return;
        position = saved ?? { x: 16, y: 16 };
        stagePos = savedStage ?? { x: -1, y: -1 };
        void preloadCache();
        watchDock();
        applyTheme();
        readCurrentActivity();
        if (settings.store.defaultView === "large") setExpanded(true);
    },

    stop() {
        cancelAnimationFrame(frame);
        frame = 0;
        dockObserver?.disconnect();
        dockObserver = null;
        lastPlayer = null;
        restoreSurfaces();
        expanded = false;
        window.removeEventListener("resize", onResize);
        window.removeEventListener("keydown", onKeyDown);
        root?.removeEventListener("click", onRootClick);
        root?.remove();
        stage?.remove();
        stage = stageMount = stageBackdrop = stageCover = stageTitle = stageArtist = null;
        stageBar = stageCurrent = stageDuration = stagePlay = stageShuffle = stageRepeat = null;
        stagePos = { x: -1, y: -1 };
        stageCoverSrc = "";
        stagePlayingIcon = null;
        lastStageTick = 0;
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

function ExpandLyricsComponent() {
    return (
        <Button onClick={() => setExpanded(true)}>
            Open enlarged lyrics
        </Button>
    );
}
