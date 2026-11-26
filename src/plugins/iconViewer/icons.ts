/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Daucord contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { cache, moduleListeners, search, wreq } from "@webpack";

import type { IconsDef } from "./types";

// Discord keeps most icons in a module that loads them by name. Collect the ones
// that are already loaded, then keep watching for the rest as Discord loads them.
export const iconsModule: IconsDef = {};

const ICON_NAME = /^[A-Z]\w*Icon$/;
const ICON_TABLE_KEY = "./AngleBracketsIcon.web.tsx";

function takeIcons(exports: any) {
    if (exports == null || typeof exports !== "object") return;
    try {
        for (const key in exports) {
            if (key in iconsModule || !ICON_NAME.test(key)) continue;
            const value = exports[key];
            if (typeof value === "function") iconsModule[key] = value;
        }
    } catch { }
}

function findIconTable(): any {
    const isTable = (exports: any) => {
        try {
            return typeof exports === "function" && typeof exports.keys === "function" && exports.keys().includes(ICON_TABLE_KEY);
        } catch {
            return false;
        }
    };

    for (const id in cache) {
        if (isTable(cache[id]?.exports)) return cache[id].exports;
    }

    const id = Object.keys(search(`"${ICON_TABLE_KEY}"`))[0];
    if (id == null) return null;
    const exports = wreq(id as any);
    return isTable(exports) ? exports : null;
}

let collecting = false;
let loadingAll: Promise<IconsDef> | undefined;

export function startCollectingIcons() {
    if (collecting) return;
    collecting = true;
    for (const id in cache) takeIcons(cache[id]?.exports);
    moduleListeners.add(takeIcons);
}

export function stopCollectingIcons() {
    moduleListeners.delete(takeIcons);
    collecting = false;
}

export function loadAllIcons() {
    return loadingAll ??= (async () => {
        const table = findIconTable();
        if (!table) return iconsModule;

        await Promise.all(table.keys().map((key: string) => Promise.resolve(table(key)).then(takeIcons, () => { })));
        return iconsModule;
    })();
}
