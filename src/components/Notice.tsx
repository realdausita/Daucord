/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Daucord contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Compatibility wrapper for Endcord plugins.
import { ErrorCard } from "./ErrorCard";

export const Notice = {
    Warning: ErrorCard,
    Success: ErrorCard,
    Info: ErrorCard,
    Error: ErrorCard
};
