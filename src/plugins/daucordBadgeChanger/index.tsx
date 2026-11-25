/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Daucord contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { BadgeListProcessors, BadgePosition, BadgeRarity, type BadgeUserArgs, type ProfileBadge } from "@api/Badges";
import { definePluginSettings } from "@api/Settings";
import { Button } from "@components/Button";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType, StartAt } from "@utils/types";
import { UserProfileStore, UserStore } from "@webpack/common";

const PREFIX = "daucord_badge_";

const ICONS = {
    developer: "https://cdn.discordapp.com/badge-icons/6bdc42827a38498929a4920da12695d9.png",
    contributor: "https://cdn.discordapp.com/badge-icons/5e74e9b61934fc1f67c65515d1f7e60d.png",
    donor: "https://cdn.discordapp.com/badge-icons/848f79194d4be5ff5f81505cbd0ce1e6.png",
    bugHunter: "https://cdn.discordapp.com/badge-icons/2717692c7dca7289b35297368a940dd0.png",
    earlySupporter: "https://cdn.discordapp.com/badge-icons/7060786766c9c840eb3019e725d2b358.png",
    oldName: "https://cdn.discordapp.com/badge-icons/6de6d34650760ba5551a79732e98ed60.png"
};

const settings = definePluginSettings({
    replaceBadges: {
        type: OptionType.BOOLEAN,
        description: "Hide your real badges and show only the ones picked here (client side)",
        default: true,
        onChange: refresh
    },
    position: {
        type: OptionType.SELECT,
        description: "Where to put the custom badges",
        options: [
            { label: "Before real badges", value: "start", default: true },
            { label: "After real badges", value: "end" }
        ],
        onChange: refresh
    },
    developer: { type: OptionType.BOOLEAN, description: "Active Developer badge", default: false, onChange: refresh },
    contributor: { type: OptionType.BOOLEAN, description: "Discord Staff badge", default: false, onChange: refresh },
    donor: { type: OptionType.BOOLEAN, description: "Bug Hunter Level 2 badge", default: false, onChange: refresh },
    bugHunter: { type: OptionType.BOOLEAN, description: "Bug Hunter Level 1 badge", default: false, onChange: refresh },
    earlySupporter: { type: OptionType.BOOLEAN, description: "Early Supporter badge", default: false, onChange: refresh },
    oldName: { type: OptionType.BOOLEAN, description: "Old username badge", default: false, onChange: refresh },
    custom: { type: OptionType.BOOLEAN, description: "Use your own badge", default: false, onChange: refresh },
    customIcon: {
        type: OptionType.STRING,
        description: "Custom badge image URL",
        default: "https://raw.githubusercontent.com/realdausita/Daucord/main/branding/daucord-128.png",
        onChange: refresh
    },
    customLabel: {
        type: OptionType.STRING,
        description: "Custom badge tooltip",
        default: "Daucord user",
        onChange: refresh
    },
    refreshNow: {
        type: OptionType.COMPONENT,
        component: RefreshComponent
    }
});

function refresh() {
    try { UserStore.emitChange(); } catch { }
    try { UserProfileStore.emitChange(); } catch { }
}

function buildBadges(): ProfileBadge[] {
    const s = settings.store;
    const selected: Array<[string, string, string]> = [];

    if (s.developer) selected.push(["developer", "Active Developer", ICONS.developer]);
    if (s.contributor) selected.push(["contributor", "Discord Staff", ICONS.contributor]);
    if (s.donor) selected.push(["donor", "Bug Hunter Level 2", ICONS.donor]);
    if (s.bugHunter) selected.push(["bugHunter", "Bug Hunter Level 1", ICONS.bugHunter]);
    if (s.earlySupporter) selected.push(["earlySupporter", "Early Supporter", ICONS.earlySupporter]);
    if (s.oldName) selected.push(["oldName", "Old username", ICONS.oldName]);
    if (s.custom) selected.push(["custom", s.customLabel || "Custom badge", s.customIcon]);

    const position = s.position === "end" ? BadgePosition.END : BadgePosition.START;

    return selected.map(([key, label, icon]) => ({
        id: PREFIX + key,
        key,
        name: label,
        description: label,
        detail: label,
        infoLabel: "Daucord",
        iconSrc: icon,
        largeIconSrc: icon,
        rarity: BadgeRarity.RARE,
        position,
        shouldShow: ({ userId }: BadgeUserArgs) => userId === UserStore.getCurrentUser()?.id,
        props: { style: { borderRadius: "50%" } }
    }));
}

function processBadges(args: BadgeUserArgs, badges: ProfileBadge[]): ProfileBadge[] {
    if (args.userId !== UserStore.getCurrentUser()?.id) return badges;

    const mine = buildBadges();
    if (!mine.length) return badges;

    const otherDaucordBadges = badges.filter(b => String(b.id).startsWith("daucord_") && !String(b.id).startsWith(PREFIX));
    if (settings.store.replaceBadges) return [...mine, ...otherDaucordBadges];
    return [...badges, ...mine];
}

export default definePlugin({
    name: "DaucordBadgeChanger",
    description: "Change the badges on your own profile, entirely client side. Only you can see them",
    tags: ["Appearance", "Customisation"],
    authors: [Devs.Daucord],
    requiresRestart: false,
    startAt: StartAt.DOMContentLoaded,
    settings,

    start() {
        BadgeListProcessors.add(processBadges);
        refresh();
    },

    stop() {
        BadgeListProcessors.delete(processBadges);
        refresh();
    }
});

function RefreshComponent() {
    return (
        <Button onClick={refresh}>
            Refresh profile
        </Button>
    );
}
