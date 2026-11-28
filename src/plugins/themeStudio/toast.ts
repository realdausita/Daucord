/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Daucord contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Toasts } from "@webpack/common";

/** Endcord-style toast helper: showToast(message, type?, options?). */
export function showToast(message: string, type = Toasts.Type.SUCCESS, options?: any) {
    Toasts.show({ message, type, options } as any);
}
