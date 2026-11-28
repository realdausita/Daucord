/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Daucord contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { wrapMethod } from "@utils/wrapMethod";
import { GuildMemberStore, GuildStore, RestAPI, showToast, UserStore } from "@webpack/common";

const settings = definePluginSettings({
    showToast: {
        type: OptionType.BOOLEAN,
        description: "Show a notification when a forced nickname is removed",
        default: true
    }
});

const resettingGuilds = new Set<string>();
const lastNick = new Map<string, string | null>();
const ownNicks = new Map<string, string | null>();
const OWN_NICK_PATH = /^\/(?:guilds\/(\d+)\/members\/@me|users\/@me\/guilds\/(\d+)\/profile)(?:\/nick)?$/;
let unwrapPatch: (() => void) | undefined;

async function resetNick(guildId: string, forcedNick: string) {
    if (resettingGuilds.has(guildId)) return;
    resettingGuilds.add(guildId);

    try {
        // The server profile endpoint needs no permission and is what Discord's own reset button uses
        try {
            await RestAPI.patch({
                url: `/users/@me/guilds/${guildId}/profile`,
                body: { nick: null }
            });

            if (settings.store.showToast) {
                showToast({ text: `AntiNickname: nickname "${forcedNick}" removed`, variant: "success" });
            }
            return;
        } catch {
            // Guilds without server profiles
        }

        await RestAPI.patch({
            url: `/guilds/${guildId}/members/@me`,
            body: { nick: "" }
        });

        if (settings.store.showToast) {
            showToast({ text: `AntiNickname: nickname "${forcedNick}" removed`, variant: "success" });
        }
    } catch (err: any) {
        if (settings.store.showToast) {
            showToast({ text: `AntiNickname: failed to reset nickname (${err?.status ?? "?"})`, variant: "critical" });
        }
    } finally {
        setTimeout(() => resettingGuilds.delete(guildId), 2000);
    }
}

export default definePlugin({
    name: "AntiNickname",
    description: "Automatically resets any nickname forcefully assigned to you in a server",
    authors: [Devs.Daucord],
    enabledByDefault: false,
    settings,

    flux: {
        GUILD_MEMBER_UPDATE({ guildId, user, nick }: {
            guildId: string;
            user: { id: string; };
            nick: string | null;
        }) {
            const currentUser = UserStore.getCurrentUser();
            if (!currentUser || user?.id !== currentUser.id) return;

            const known = lastNick.has(guildId);
            const previous = lastNick.get(guildId);
            lastNick.set(guildId, nick || null);
            if (!nick || (known && previous === nick)) return;
            if (ownNicks.get(guildId) === nick) return;

            setTimeout(() => resetNick(guildId, nick), 300);
        }
    },

    start() {
        const me = UserStore.getCurrentUser()?.id;
        if (me) {
            for (const guildId of Object.keys(GuildStore.getGuilds() ?? {})) {
                const member = GuildMemberStore.getMember(guildId, me);
                if (member) lastNick.set(guildId, member.nick || null);
            }
        }
        unwrapPatch = wrapMethod(RestAPI, "patch", function (this: any, original, req) {
            const m = OWN_NICK_PATH.exec(String(req?.url ?? ""));
            const guildId = m?.[1] ?? m?.[2];
            if (guildId && !resettingGuilds.has(guildId) && req?.body && "nick" in req.body) {
                ownNicks.set(guildId, req.body.nick || null);
            }
            return original.call(this, req);
        });
    },

    stop() {
        unwrapPatch?.();
        unwrapPatch = undefined;
        resettingGuilds.clear();
        lastNick.clear();
        ownNicks.clear();
    }
});
