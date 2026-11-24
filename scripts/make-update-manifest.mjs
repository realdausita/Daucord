#!/usr/bin/env node
/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Daucord contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { execFileSync } from "child_process";
import { createHash } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join, resolve } from "path";

const ROOT = resolve(process.argv[1], "..", "..");
const args = process.argv.slice(2);
const getFlag = name => {
    const i = args.indexOf(name);
    return i !== -1 && i + 1 < args.length ? args[i + 1] : undefined;
};

const baseUrl = getFlag("--base-url") || "";
const outPath = resolve(ROOT, getFlag("--out") || "updates/manifest.json");
const version = getFlag("--version") || JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).version;
const distDir = resolve(ROOT, getFlag("--dist") || "dist");

if (!baseUrl) {
    console.error("ERROR: --base-url is required (e.g. https://example.com/daucord/1.0.1)");
    process.exit(1);
}

const FILES = ["patcher.js", "preload.js", "renderer.js", "renderer.css"];

const files = {};
for (const name of FILES) {
    const p = join(distDir, name);
    if (!existsSync(p)) {
        console.error("ERROR: dist file not found:", p);
        process.exit(1);
    }
    const buf = readFileSync(p);
    files[name] = {
        url: `${baseUrl.replace(/\/$/, "")}/${name}`,
        sha256: createHash("sha256").update(buf).digest("hex")
    };
}

let base = "";
try {
    base = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim();
} catch { }

const manifest = { version, base, files };
mkdirSync(resolve(outPath, ".."), { recursive: true });
writeFileSync(outPath, JSON.stringify(manifest, null, 2));
console.log("Manifest written:", outPath);
console.log(JSON.stringify(manifest, null, 2));
