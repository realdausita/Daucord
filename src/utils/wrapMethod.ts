/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Daucord contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Compatibility stub for plugins ported from Endcord.
export default function defaultWrap<T extends object>(obj: T, name: keyof T, fn: (original: any, ...args: any[]) => any) {
    const original = obj[name];
    (obj as any)[name] = function (...args: any[]) { return fn(original, ...args); };
    return () => { (obj as any)[name] = original; };
}

export const wrapMethod = defaultWrap;
export const Unwrap: any = (...args: any[]) => ({});

export type Unwrap<T> = T;
