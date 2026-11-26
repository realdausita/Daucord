/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Daucord contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { React } from "@webpack/common";

export * from "./Icons";

function safeIcon(inner: any) {
    if (typeof inner === "function" || typeof inner === "string") {
        const Inner: any = inner;
        return (props: any) => <Inner {...props} />;
    }
    return (props: any) => (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true" {...props}>
            <circle cx="12" cy="12" r="7" />
        </svg>
    );
}

export const RobotIcon = safeIcon(() => null);
export const EndcordMark = safeIcon(() => null);

export const filled = (render: any) => safeIcon(render);
export const pixelIcon = (_pattern: any, inner?: any) => safeIcon(inner);
export const SOFT: any = 0.75;
