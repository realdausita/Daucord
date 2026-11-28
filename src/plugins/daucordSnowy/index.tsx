/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Daucord contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType, StartAt } from "@utils/types";

interface Flake {
    x: number;
    y: number;
    r: number;
    vy: number;
    vx: number;
    phase: number;
    sway: number;
    alpha: number;
}

const settings = definePluginSettings({
    snowfall: {
        type: OptionType.BOOLEAN,
        description: "Let snow fall over Discord",
        default: true,
        onChange: apply
    },
    winterTheme: {
        type: OptionType.BOOLEAN,
        description: "Add a cool winter tint to the interface",
        default: true,
        onChange: apply
    },
    density: {
        type: OptionType.SLIDER,
        description: "Number of snowflakes on screen",
        markers: [20, 50, 90, 140, 200],
        min: 10,
        max: 300,
        default: 90,
        stickToMarkers: false
    },
    speed: {
        type: OptionType.SLIDER,
        description: "How fast the snow falls",
        markers: [30, 60, 100, 160, 240],
        min: 20,
        max: 400,
        default: 60,
        stickToMarkers: false
    },
    size: {
        type: OptionType.SLIDER,
        description: "Snowflake size",
        markers: [2, 4, 6, 9, 13],
        min: 1,
        max: 20,
        default: 6,
        stickToMarkers: false
    }
});

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let frame = 0;
let lastTime = 0;
let width = 0;
let height = 0;
let flakes: Flake[] = [];

function random(min: number, max: number) {
    return min + Math.random() * (max - min);
}

function respawn(flake: Flake, fromTop = true) {
    const s = settings.store;
    flake.r = random(s.size * 0.5, s.size * 1.5);
    flake.x = random(-20, width + 20);
    flake.y = fromTop ? -flake.r - Math.random() * height * 0.2 : random(-height, height);
    flake.vy = random(0.6, 1.5) * Math.max(0.5, flake.r / s.size);
    flake.vx = random(-0.25, 0.25);
    flake.sway = random(0.15, 0.6);
    flake.phase = random(0, Math.PI * 2);
    flake.alpha = random(0.35, 0.9);
}

function resize() {
    if (!canvas || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function syncFlakeCount() {
    const target = settings.store.density;
    while (flakes.length < target) {
        const flake = {} as Flake;
        respawn(flake, false);
        flakes.push(flake);
    }
    if (flakes.length > target) flakes.length = target;
}

function draw(time: number) {
    frame = 0;
    if (!ctx || document.hidden) return;

    const dt = Math.min(48, time - lastTime || 16);
    lastTime = time;
    const step = dt / 16.67;
    const speed = settings.store.speed / 60;

    syncFlakeCount();
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#ffffff";

    for (const flake of flakes) {
        flake.phase += dt * 0.0015;
        flake.y += flake.vy * speed * step;
        flake.x += (flake.vx + Math.sin(flake.phase) * flake.sway) * step;

        if (flake.y - flake.r > height || flake.x < -40 || flake.x > width + 40) respawn(flake);

        ctx.globalAlpha = flake.alpha;
        ctx.beginPath();
        ctx.arc(flake.x, flake.y, flake.r, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;

    frame = requestAnimationFrame(draw);
}

function startLoop() {
    if (!frame && !document.hidden && settings.store.snowfall) {
        lastTime = 0;
        frame = requestAnimationFrame(draw);
    }
}

function stopLoop() {
    cancelAnimationFrame(frame);
    frame = 0;
}

function onVisibility() {
    if (document.hidden) stopLoop();
    else startLoop();
}

function apply() {
    document.body.classList.toggle("daucord-snowy", !!settings.store.winterTheme);

    if (!settings.store.snowfall) {
        stopLoop();
        window.removeEventListener("resize", resize);
        document.removeEventListener("visibilitychange", onVisibility);
        canvas?.remove();
        canvas = null;
        ctx = null;
        flakes = [];
        return;
    }

    if (!canvas) {
        canvas = document.createElement("canvas");
        canvas.id = "daucord-snowy-canvas";
        document.body.append(canvas);
        ctx = canvas.getContext("2d");
        window.addEventListener("resize", resize);
        document.addEventListener("visibilitychange", onVisibility);
    }
    resize();
    syncFlakeCount();
    startLoop();
}

export default definePlugin({
    name: "DaucordSnowy",
    description: "Winter theme with lightweight snowfall over Discord",
    tags: ["Appearance"],
    authors: [Devs.Daucord],
    enabledByDefault: false,
    requiresRestart: false,
    startAt: StartAt.DOMContentLoaded,
    settings,

    start: apply,

    stop() {
        stopLoop();
        canvas?.remove();
        canvas = null;
        ctx = null;
        flakes = [];
        document.body.classList.remove("daucord-snowy");
        window.removeEventListener("resize", resize);
        document.removeEventListener("visibilitychange", onVisibility);
    }
});
