/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2022 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { fetchBuffer, fetchJson } from "@main/utils/http";
import { IpcEvents } from "@shared/IpcEvents";
import { VENCORD_USER_AGENT } from "@shared/vencordUserAgent";
import { createHash } from "crypto";
import { ipcMain } from "electron";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { join } from "path";

import { serializeErrors } from "./common";

interface ManifestFile {
    url: string;
    sha256: string;
}

interface Manifest {
    version: string;
    base?: string;
    files: Record<string, ManifestFile>;
}

interface UpstreamRelease {
    name: string;
    tag: string;
    url: string;
    isNew: boolean;
}

const DIST_DIR = __dirname;
const DATA_DIR = join(process.env.APPDATA || "", "Daucord");
const UPDATES_DIR = join(DATA_DIR, "updates");
const MANIFEST_URL_FILE = join(UPDATES_DIR, "manifest.url");
const UPSTREAM_FILE = join(UPDATES_DIR, "upstream.json");
const DEFAULT_MANIFEST_URL = "https://github.com/realdausita/Daucord/releases/latest/download/manifest.json";

const UPSTREAM_REPOS: Array<[string, string]> = [
    ["Vencord", "Vendicated/Vencord"],
    ["Equicord", "Equicord/Equicord"]
];

let pending: Array<{ name: string; url: string; sha256: string }> = [];

function ensureDir(dir: string) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function readManifestUrl(): string {
    if (process.env.DAUCORD_UPDATE_URL) return process.env.DAUCORD_UPDATE_URL.trim();
    try {
        const custom = readFileSync(MANIFEST_URL_FILE, "utf8").trim();
        if (custom) return custom;
    } catch { }
    return DEFAULT_MANIFEST_URL;
}

function readUpstreamState(): Record<string, string> {
    try {
        return JSON.parse(readFileSync(UPSTREAM_FILE, "utf8"));
    } catch {
        return {};
    }
}

function writeUpstreamState(state: Record<string, string>) {
    ensureDir(UPDATES_DIR);
    writeFileSync(UPSTREAM_FILE, JSON.stringify(state, null, 2));
}

function parseVersion(v: string): number[] {
    return v.replace(/^v/i, "").split(".").map(n => {
        const m = n.match(/^\d+/);
        return m ? parseInt(m[0], 10) : 0;
    });
}

function isNewerVersion(a: string, b: string): boolean {
    const pa = parseVersion(a);
    const pb = parseVersion(b);
    const len = Math.max(pa.length, pb.length);
    for (let i = 0; i < len; i++) {
        const x = pa[i] ?? 0;
        const y = pb[i] ?? 0;
        if (x !== y) return x > y;
    }
    return false;
}

function sha256(buf: Buffer): string {
    return createHash("sha256").update(buf).digest("hex");
}

async function githubGet<T = any>(repo: string, endpoint: string): Promise<T> {
    const { checkedFetch } = await import("@main/utils/http");
    const res = await checkedFetch(`https://api.github.com/repos/${repo}${endpoint}`, {
        headers: {
            Accept: "application/vnd.github+json",
            "User-Agent": VENCORD_USER_AGENT
        }
    });
    return res.json() as Promise<T>;
}

async function fetchManifest(url: string): Promise<Manifest> {
    if (url.startsWith("file://")) {
        return JSON.parse(readFileSync(url.slice(7), "utf8"));
    }
    return fetchJson<Manifest>(url, {
        headers: { "User-Agent": VENCORD_USER_AGENT }
    });
}

async function calculateGitChanges() {
    const url = readManifestUrl();
    if (!url) return [];

    let manifest: Manifest;
    try {
        manifest = await fetchManifest(url);
    } catch {
        return [];
    }

    if (!manifest?.version || !isNewerVersion(manifest.version, VERSION)) {
        pending = [];
        return [];
    }

    pending = Object.entries(manifest.files || {}).map(([name, info]) => ({
        name,
        url: info.url,
        sha256: info.sha256
    }));

    return [{
        hash: manifest.version,
        author: "Daucord",
        message: `Daucord ${manifest.version} is available${manifest.base ? ` (base: ${manifest.base})` : ""}`
    }];
}

async function fetchUpdates() {
    if (!pending.length) await calculateGitChanges();
    return pending.length > 0;
}

async function applyUpdates() {
    if (!pending.length) await calculateGitChanges();
    if (!pending.length) return false;

    // download + verify
    const downloads = await Promise.all(pending.map(async item => {
        const buf = await fetchBuffer(item.url);
        const hash = sha256(buf);
        if (item.sha256 && hash.toLowerCase() !== item.sha256.toLowerCase()) {
            throw new Error(`Hash mismatch for ${item.name}: expected ${item.sha256}, got ${hash}`);
        }
        return { name: item.name, buf };
    }));

    const stamp = Date.now();
    for (const { name, buf } of downloads) {
        const target = join(DIST_DIR, name);
        if (existsSync(target)) {
            try { renameSync(target, `${target}.bak-${stamp}`); } catch { /* best effort */ }
        }
        writeFileSync(target, buf);
    }

    pending = [];
    return true;
}

async function getRepo() {
    return "https://github.com/realdausita/Daucord";
}

async function checkUpstream(): Promise<UpstreamRelease[]> {
    const state = readUpstreamState();
    const out: UpstreamRelease[] = [];

    for (const [name, repo] of UPSTREAM_REPOS) {
        try {
            const data: any = await githubGet(repo, "/releases/latest");
            const tag = data?.tag_name || data?.name;
            const isNew = !!tag && tag !== state[name];
            out.push({
                name,
                tag: tag || "unknown",
                url: data?.html_url || `https://github.com/${repo}`,
                isNew
            });
        } catch {
            out.push({ name, tag: "unknown", url: `https://github.com/${repo}`, isNew: false });
        }
    }

    // persist seen tags so we only notify once
    const newState: Record<string, string> = { ...state };
    for (const u of out) if (u.tag !== "unknown") newState[u.name] = u.tag;
    try { writeUpstreamState(newState); } catch { /* ignore */ }

    return out;
}

ipcMain.handle(IpcEvents.GET_REPO, serializeErrors(getRepo));
ipcMain.handle(IpcEvents.GET_UPDATES, serializeErrors(calculateGitChanges));
ipcMain.handle(IpcEvents.UPDATE, serializeErrors(fetchUpdates));
ipcMain.handle(IpcEvents.BUILD, serializeErrors(applyUpdates));

ipcMain.handle(IpcEvents.DAUCORD_UPSTREAM, serializeErrors(checkUpstream));
