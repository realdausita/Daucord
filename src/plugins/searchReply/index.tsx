/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Daucord contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { findGroupChildrenByChildId, NavContextMenuPatchCallback } from "@api/ContextMenu";
import { ReplyIcon } from "@components/Icons";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import type { Message } from "@vencord/discord-types";
import { findByCodeLazy } from "@webpack";
import { ChannelStore, Menu, PermissionsBits, PermissionStore, SelectedChannelStore } from "@webpack/common";


const replyToMessage = findByCodeLazy(".TEXTAREA_FOCUS)", "showMentionToggle:");

const messageContextMenuPatch: NavContextMenuPatchCallback = (children, { message }: { message: Message; }) => {
    // make sure the message is in the selected channel
    if (SelectedChannelStore.getChannelId() !== message.channel_id) return;
    const channel = ChannelStore.getChannel(message?.channel_id);
    if (!channel) return;
    if (channel.guild_id && !PermissionStore.can(PermissionsBits.SEND_MESSAGES, channel)) return;

    // dms and group chats
    const dmGroup = findGroupChildrenByChildId("pin", children);
    if (dmGroup && !dmGroup.some(child => child?.props?.id === "reply")) {
        const pinIndex = dmGroup.findIndex(c => c?.props.id === "pin");
        dmGroup.splice(pinIndex + 1, 0, (
            <Menu.MenuItem
                id="reply"
                label="Reply"
                icon={ReplyIcon}
                action={(e: React.MouseEvent) => replyToMessage(channel, message, e)}
            />
        ));
        return;
    }

    // servers
    const serverGroup = findGroupChildrenByChildId("mark-unread", children);
    if (serverGroup && !serverGroup.some(child => child?.props?.id === "reply")) {
        serverGroup.unshift((
            <Menu.MenuItem
                id="reply"
                label="Reply"
                icon={ReplyIcon}
                action={(e: React.MouseEvent) => replyToMessage(channel, message, e)}
            />
        ));
        return;
    }
};


export default definePlugin({
    name: "SearchReply",
    description: "Adds a reply button to search results",
    authors: [Devs.Aria],
    contextMenus: {
        "message": messageContextMenuPatch
    }
});
