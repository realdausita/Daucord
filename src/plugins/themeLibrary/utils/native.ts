/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Daucord contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/** Web-safe replacement for Endcord's native.openExternal helper. */
export function openExternal(url: string) {
    window.open(url, "_blank", "noopener,noreferrer");
}
