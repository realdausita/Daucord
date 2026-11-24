/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Daucord contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { get as dsGet, set as dsSet } from "@api/DataStore";
import { definePluginSettings } from "@api/Settings";
import { Button } from "@components/Button";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType, StartAt } from "@utils/types";
import { ColorPicker } from "@webpack/common";

const POSITION_KEY = "Daucord_clockPosition";

let root: HTMLDivElement | null = null;
let pill: HTMLDivElement | null = null;
let timeEl: HTMLDivElement | null = null;
let dateEl: HTMLDivElement | null = null;
let interval: number | null = null;
let position = { x: -1, y: -1 };

const settings = definePluginSettings({
    format: {
        type: OptionType.SELECT,
        description: "Clock format",
        options: [
            { label: "24 hour", value: "24h", default: true },
            { label: "12 hour (AM/PM)", value: "12h" }
        ],
        onChange: render
    },
    showSeconds: {
        type: OptionType.BOOLEAN,
        description: "Show seconds",
        default: true,
        onChange: render
    },
    showDate: {
        type: OptionType.BOOLEAN,
        description: "Show the date below the clock",
        default: false,
        onChange: render
    },
    theme: {
        type: OptionType.SELECT,
        description: "Clock style",
        options: [
            { label: "Glass", value: "glass", default: true },
            { label: "Solid", value: "solid" },
            { label: "Accent gradient", value: "accent" }
        ],
        onChange: applyTheme
    },
    accentColor: {
        type: OptionType.COMPONENT,
        default: "#7c6cf0",
        component: AccentColorComponent
    },
    fontSize: {
        type: OptionType.SLIDER,
        description: "Clock font size",
        markers: [10, 12, 14, 16, 18, 22],
        default: 14,
        stickToMarkers: false,
        onChange: applyTheme
    },
    opacity: {
        type: OptionType.SLIDER,
        description: "Background opacity",
        markers: [40, 60, 80, 100],
        default: 94,
        stickToMarkers: false,
        onChange: applyTheme
    },
    resetPosition: {
        type: OptionType.COMPONENT,
        component: ResetPositionComponent
    }
});

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

    const { theme, accentColor, fontSize, opacity } = settings.store;

    root.classList.remove("daucord-clock--glass", "daucord-clock--solid", "daucord-clock--accent");
    root.classList.add(`daucord-clock--${theme}`);

    root.style.setProperty("--daucord-accent", accentColor);
    root.style.setProperty("--daucord-accent-dark", shade(accentColor, -0.3));
    root.style.setProperty("--daucord-font-size", `${fontSize}px`);
    root.style.setProperty("--daucord-opacity", String(opacity / 100));
}

function render() {
    if (!timeEl || !dateEl) return;

    const now = new Date();
    const { format, showSeconds, showDate } = settings.store;

    const timeString = now.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: showSeconds ? "2-digit" : undefined,
        hour12: format === "12h"
    });

    const parts = timeString.split(":");
    timeEl.textContent = "";

    if (parts.length >= 3) {
        const [seconds, ...suffix] = parts[2].split(" ");
        timeEl.append(`${parts[0]}:${parts[1]}`);

        const secondsEl = document.createElement("span");
        secondsEl.className = "daucord-clock__seconds";
        secondsEl.textContent = `:${seconds}${suffix.length ? ` ${suffix.join(" ")}` : ""}`;
        timeEl.append(secondsEl);
    } else {
        timeEl.textContent = timeString;
    }

    dateEl.textContent = now.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
    dateEl.style.display = showDate ? "block" : "none";
}

function clampPosition() {
    if (!root || !pill) return;

    const maxX = window.innerWidth - pill.offsetWidth - 4;
    const maxY = window.innerHeight - pill.offsetHeight - 4;
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
    position = { x: window.innerWidth - pill.offsetWidth - 16, y: 12 };
    clampPosition();
    savePosition();
}

function onPointerDown(e: PointerEvent) {
    if (!root) return;

    e.preventDefault();
    root.setPointerCapture(e.pointerId);
    root.classList.add("daucord-clock--dragging");

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
        root?.classList.remove("daucord-clock--dragging");
        savePosition();
    };

    root.addEventListener("pointermove", move);
    root.addEventListener("pointerup", up);
}

export default definePlugin({
    name: "DaucordClock",
    description: "A floating clock widget you can place anywhere. Drag it to reposition",
    tags: ["Utility", "Appearance"],
    authors: [Devs.Daucord],
    requiresRestart: false,
    startAt: StartAt.DOMContentLoaded,
    settings,

    async start() {
        root = document.createElement("div");
        root.id = "daucord-clock";
        root.className = "daucord-clock";

        pill = document.createElement("div");
        pill.className = "daucord-clock__pill";

        timeEl = document.createElement("div");
        timeEl.className = "daucord-clock__time";

        dateEl = document.createElement("div");
        dateEl.className = "daucord-clock__date";

        pill.append(timeEl, dateEl);
        root.append(pill);
        document.body.append(root);

        root.addEventListener("pointerdown", onPointerDown);
        window.addEventListener("resize", clampPosition);

        const saved = await dsGet<typeof position>(POSITION_KEY).catch(() => undefined);
        if (!root) return; // plugin was stopped while loading

        position = saved ?? { x: window.innerWidth - (pill.offsetWidth ?? 120) - 16, y: 12 };
        clampPosition();

        applyTheme();
        render();
        interval = window.setInterval(render, 1000);
    },

    stop() {
        if (interval != null) clearInterval(interval);
        interval = null;

        window.removeEventListener("resize", clampPosition);

        root?.remove();
        root = pill = timeEl = dateEl = null;
    }
});

function AccentColorComponent() {
    const value = settings.use(["accentColor"]);
    const color = parseInt((value.accentColor || "#7c6cf0").replace("#", ""), 16) || 0x7c6cf0;

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
        <Button onClick={resetPosition}>
            Reset clock position
        </Button>
    );
}
