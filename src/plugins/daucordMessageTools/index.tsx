/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Daucord contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { findGroupChildrenByChildId, NavContextMenuPatchCallback } from "@api/ContextMenu";
import { definePluginSettings } from "@api/Settings";
import { ClockIcon } from "@components/Icons";
import { Devs } from "@utils/constants";
import { copyWithToast } from "@utils/discord";
import definePlugin, { OptionType } from "@utils/types";
import type { Message } from "@vencord/discord-types";
import { Menu, SnowflakeUtils } from "@webpack/common";

const settings = definePluginSettings({
    format: {
        type: OptionType.SELECT,
        description: "Format used when copying a message's creation time",
        options: [
            { label: "Local time", value: "local", default: true },
            { label: "ISO 8601 (UTC)", value: "iso" },
            { label: "Unix timestamp (seconds)", value: "unix" },
            { label: "Discord timestamp markup", value: "markup" }
        ]
    }
});

function formatTimestamp(date: Date): string {
    switch (settings.store.format) {
        case "iso": return date.toISOString();
        case "unix": return String(Math.floor(date.getTime() / 1000));
        case "markup": return `<t:${Math.floor(date.getTime() / 1000)}:F>`;
        default: return date.toLocaleString();
    }
}

const messageContextPatch: NavContextMenuPatchCallback = (children, props: { message?: Message; }) => {
    const message = props?.message;
    if (!message?.id) return;

    const group = findGroupChildrenByChildId(`devmode-copy-id-${message.id}`, children) ?? children;

    group.splice(-1, 0,
        <Menu.MenuItem
            id="daucord-copy-timestamp"
            label="Copy Creation Time"
            icon={ClockIcon}
            leadingAccessory={{ type: "icon", icon: ClockIcon }}
            action={() => {
                const date = new Date(SnowflakeUtils.extractTimestamp(message.id));
                copyWithToast(formatTimestamp(date), "Creation time copied!");
            }}
        />
    );
};

export default definePlugin({
    name: "DaucordMessageTools",
    description: "Adds a 'Copy Creation Time' option to the message context menu (local, ISO, Unix or Discord markup)",
    tags: ["Chat", "Utility"],
    authors: [Devs.Daucord],
    enabledByDefault: true,
    requiresRestart: false,
    settings,

    contextMenus: {
        "message": messageContextPatch
    }
});
