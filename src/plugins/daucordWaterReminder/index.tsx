/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Daucord contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { get as dsGet, set as dsSet } from "@api/DataStore";
import { showNotification } from "@api/Notifications";
import { definePluginSettings } from "@api/Settings";
import { Button } from "@components/Button";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType, StartAt } from "@utils/types";
import { ColorPicker, showToast } from "@webpack/common";

const POSITION_KEY = "Daucord_waterPosition";
const NEXT_KEY = "Daucord_waterNextAt";

let root: HTMLDivElement | null = null;
let pill: HTMLDivElement | null = null;
let countdownEl: HTMLDivElement | null = null;
let labelEl: HTMLDivElement | null = null;
let interval: number | null = null;
let nextAt = 0;
let position = { x: -1, y: -1 };

const settings = definePluginSettings({
    intervalAmount: {
        type: OptionType.SLIDER,
        description: "Remind me every",
        markers: [1, 5, 10, 15, 20, 30, 45, 60, 90, 120],
        default: 30,
        stickToMarkers: false,
        onChange: resetTimer
    },
    intervalUnit: {
        type: OptionType.SELECT,
        description: "Time unit",
        options: [
            { label: "minutes", value: "minute", default: true },
            { label: "hours", value: "hour" },
            { label: "days", value: "day" }
        ],
        onChange: resetTimer
    },
    displayMode: {
        type: OptionType.SELECT,
        description: "Where the reminder appears",
        options: [
            { label: "Discord only", value: "discord" },
            { label: "Whole desktop (system notification)", value: "desktop" },
            { label: "Both", value: "both", default: true }
        ],
        onChange: applyTheme
    },
    showWidget: {
        type: OptionType.BOOLEAN,
        description: "Show the floating countdown widget",
        default: true,
        onChange: applyTheme
    },
    showCountdown: {
        type: OptionType.BOOLEAN,
        description: "Show time left on the widget",
        default: true,
        onChange: render
    },
    showDrop: {
        type: OptionType.BOOLEAN,
        description: "Show the water drop icon",
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
        default: "#4cc9f0",
        component: AccentColorComponent
    },
    fontSize: {
        type: OptionType.SLIDER,
        description: "Widget font size",
        markers: [10, 12, 14, 16, 18, 22],
        default: 14,
        stickToMarkers: false,
        onChange: applyTheme
    },
    opacity: {
        type: OptionType.SLIDER,
        description: "Widget background opacity",
        markers: [40, 60, 80, 100],
        default: 94,
        stickToMarkers: false,
        onChange: applyTheme
    },
    playSound: {
        type: OptionType.BOOLEAN,
        description: "Play a sound when the timer ends",
        default: true
    },
    sound: {
        type: OptionType.SELECT,
        description: "Reminder sound",
        options: [
            { label: "Water drop", value: "drop", default: true },
            { label: "Chime", value: "chime" },
            { label: "Bell", value: "bell" },
            { label: "My own file", value: "custom" },
            { label: "None", value: "none" }
        ],
        onChange: () => previewSound()
    },
    volume: {
        type: OptionType.SLIDER,
        description: "Sound volume",
        markers: [0, 25, 50, 75, 100],
        default: 60,
        stickToMarkers: false
    },
    customSoundData: {
        type: OptionType.STRING,
        description: "Custom sound (loaded from your PC)",
        default: ""
    },
    uploadSound: {
        type: OptionType.COMPONENT,
        component: UploadSoundComponent
    },
    testReminder: {
        type: OptionType.COMPONENT,
        component: TestReminderComponent
    },
    resetPosition: {
        type: OptionType.COMPONENT,
        component: ResetPositionComponent
    }
});

function getIntervalMs() {
    const { intervalAmount, intervalUnit } = settings.store;
    const amount = Math.max(1, Number(intervalAmount) || 30);
    const factor = intervalUnit === "day" ? 86_400_000 : intervalUnit === "hour" ? 3_600_000 : 60_000;
    return amount * factor;
}

function resetTimer() {
    nextAt = Date.now() + getIntervalMs();
    dsSet(NEXT_KEY, nextAt).catch(() => { });
    render();
}

function hexToRgb(hex: string): [number, number, number] {
    const clean = hex.replace("#", "");
    const full = clean.length === 3 ? clean.split("").map(c => c + c).join("") : clean.padEnd(6, "0");
    const num = parseInt(full.slice(0, 6), 16);
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function shade(hex: string, amount: number): string {
    const [r, g, b] = hexToRgb(hex);
    const mix = (c: number) => Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount);
    return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

function applyTheme() {
    if (!root) return;

    const { theme, accentColor, fontSize, opacity, showWidget, showDrop } = settings.store;
    root.classList.remove("daucord-water--glass", "daucord-water--solid", "daucord-water--accent");
    root.classList.add(`daucord-water--${theme}`);
    root.style.setProperty("--daucord-accent", accentColor);
    root.style.setProperty("--daucord-accent-dark", shade(accentColor, -0.3));
    root.style.setProperty("--daucord-font-size", `${fontSize}px`);
    root.style.setProperty("--daucord-opacity", String(opacity / 100));
    root.style.display = showWidget ? "block" : "none";
    root.classList.toggle("daucord-water--no-drop", !showDrop);
    clampPosition();
}

function formatLeft(ms: number) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const days = Math.floor(total / 86400);
    const hours = Math.floor((total % 86400) / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function render() {
    if (!countdownEl || !labelEl) return;
    const { showCountdown, intervalAmount, intervalUnit } = settings.store;
    countdownEl.textContent = showCountdown ? formatLeft(nextAt - Date.now()) : "";
    countdownEl.style.display = showCountdown ? "block" : "none";
    labelEl.textContent = `water · every ${intervalAmount} ${intervalUnit}${Number(intervalAmount) === 1 ? "" : "s"}`;
}

function clampPosition() {
    if (!root || !pill || root.style.display === "none") return;
    const maxX = Math.max(4, window.innerWidth - pill.offsetWidth - 4);
    const maxY = Math.max(4, window.innerHeight - pill.offsetHeight - 4);
    position.x = Math.max(4, Math.min(position.x, maxX));
    position.y = Math.max(4, Math.min(position.y, maxY));
    root.style.left = `${position.x}px`;
    root.style.top = `${position.y}px`;
}

function savePosition() {
    dsSet(POSITION_KEY, position).catch(() => { });
}

function resetPosition() {
    if (!root || !pill) return;
    position = { x: window.innerWidth - (pill.offsetWidth ?? 150) - 16, y: 12 };
    clampPosition();
    savePosition();
}

function onPointerDown(e: PointerEvent) {
    if (!root) return;
    e.preventDefault();
    root.setPointerCapture(e.pointerId);
    root.classList.add("daucord-water--dragging");

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
        root?.classList.remove("daucord-water--dragging");
        savePosition();
    };

    root.addEventListener("pointermove", move);
    root.addEventListener("pointerup", up);
}

function previewSound() {
    const { sound, playSound } = settings.store;
    if (!playSound || sound === "none") return;
    playSoundNow();
}

function playSoundNow() {
    const { sound, volume, customSoundData } = settings.store;
    if (!settings.store.playSound || sound === "none") return;

    if (sound === "custom") {
        if (!customSoundData) return;
        const audio = new Audio(customSoundData);
        audio.volume = Math.min(1, Math.max(0, volume / 100));
        audio.play().catch(() => { });
        return;
    }

    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx: AudioContext = new AudioCtx();
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.value = Math.min(0.6, Math.max(0, volume / 100 * 0.35));

    const now = ctx.currentTime;
    if (sound === "drop") {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(260, now + 0.22);
        osc.connect(gain);
        osc.start(now);
        osc.stop(now + 0.26);
    } else {
        const notes = sound === "bell" ? [660, 990, 1320] : [784, 1046, 1318];
        notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            osc.type = "sine";
            osc.frequency.value = freq;
            const noteGain = ctx.createGain();
            noteGain.gain.setValueAtTime(0, now + i * 0.14);
            noteGain.gain.linearRampToValueAtTime(1, now + i * 0.14 + 0.02);
            noteGain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.14 + 0.5);
            osc.connect(noteGain);
            noteGain.connect(gain);
            osc.start(now + i * 0.14);
            osc.stop(now + i * 0.14 + 0.52);
        });
    }
    window.setTimeout(() => ctx.close().catch(() => { }), 1400);
}

async function notify() {
    const { displayMode, accentColor } = settings.store;
    const title = "Daucord Water Reminder";
    const body = "Time for a glass of water.";

    if (displayMode !== "discord" && typeof Notification !== "undefined") {
        try {
            if (Notification.permission !== "granted") await Notification.requestPermission();
            if (Notification.permission === "granted") new Notification(title, { body });
        } catch { }
    }

    if (displayMode !== "desktop") {
        showNotification({
            title,
            body,
            color: accentColor,
            onClick: markDrunk
        });
    }

    playSoundNow();
}

function markDrunk() {
    resetTimer();
    showToast({ text: "Water logged. Next reminder scheduled.", variant: "success" });
}

function tick() {
    if (nextAt <= 0) return;
    if (Date.now() >= nextAt) {
        nextAt = Date.now() + getIntervalMs();
        dsSet(NEXT_KEY, nextAt).catch(() => { });
        notify();
    }
    render();
}

export default definePlugin({
    name: "DaucordWaterReminder",
    description: "A draggable water reminder with configurable interval, desktop notifications and custom sounds",
    tags: ["Utility", "Appearance"],
    authors: [Devs.Daucord],
    requiresRestart: false,
    startAt: StartAt.DOMContentLoaded,
    settings,

    async start() {
        root = document.createElement("div");
        root.id = "daucord-water-reminder";
        root.className = "daucord-water";

        pill = document.createElement("div");
        pill.className = "daucord-water__pill";
        pill.title = "Click to log a glass of water";

        const drop = document.createElement("div");
        drop.className = "daucord-water__drop";
        drop.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M12 2.5S5.5 10 5.5 14.5a6.5 6.5 0 0 0 13 0C18.5 10 12 2.5 12 2.5Zm0 17a4 4 0 0 1-4-4c0-2.2 3-5.6 4-7 1 1.4 4 4.8 4 7a4 4 0 0 1-4 4Z"/></svg>';

        const texts = document.createElement("div");
        texts.className = "daucord-water__texts";

        countdownEl = document.createElement("div");
        countdownEl.className = "daucord-water__countdown";

        labelEl = document.createElement("div");
        labelEl.className = "daucord-water__label";

        texts.append(countdownEl, labelEl);
        pill.append(drop, texts);
        root.append(pill);
        document.body.append(root);

        root.addEventListener("pointerdown", onPointerDown);
        pill.addEventListener("click", () => {
            if (!root?.classList.contains("daucord-water--dragging")) markDrunk();
        });
        window.addEventListener("resize", clampPosition);

        const [savedPos, savedNext] = await Promise.all([
            dsGet<typeof position>(POSITION_KEY).catch(() => undefined),
            dsGet<number>(NEXT_KEY).catch(() => undefined)
        ]);
        if (!root) return;

        position = savedPos ?? { x: window.innerWidth - 190, y: 12 };
        nextAt = savedNext && savedNext > Date.now() ? savedNext : Date.now() + getIntervalMs();
        clampPosition();
        applyTheme();
        render();
        interval = window.setInterval(tick, 1000);
    },

    stop() {
        if (interval != null) clearInterval(interval);
        interval = null;
        window.removeEventListener("resize", clampPosition);
        root?.remove();
        root = pill = countdownEl = labelEl = null;
    }
});

function AccentColorComponent() {
    const value = settings.use(["accentColor"]);
    const color = parseInt((value.accentColor || "#4cc9f0").replace("#", ""), 16) || 0x4cc9f0;

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

function UploadSoundComponent() {
    return (
        <div className="daucord-water__upload">
            <input
                type="file"
                accept="audio/*"
                onChange={async e => {
                    const file = e.currentTarget.files?.[0];
                    if (!file) return;
                    if (file.size > 2_000_000) {
                        showToast({ text: "Pick an audio file under 2 MB.", variant: "critical" });
                        return;
                    }
                    const data = await new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(String(reader.result));
                        reader.onerror = () => reject(reader.error);
                        reader.readAsDataURL(file);
                    });
                    settings.store.customSoundData = data;
                    settings.store.sound = "custom";
                    showToast({ text: `Loaded ${file.name}`, variant: "success" });
                }}
            />
            <div className="daucord-water__upload-hint">
                {settings.store.customSoundData ? "Custom sound loaded" : "MP3, WAV, OGG or M4A (max 2 MB)"}
            </div>
        </div>
    );
}

function TestReminderComponent() {
    return (
        <Button onClick={() => { notify(); }}>
            Send a test reminder
        </Button>
    );
}

function ResetPositionComponent() {
    return (
        <Button onClick={resetPosition}>
            Reset widget position
        </Button>
    );
}
