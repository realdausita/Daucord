/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Daucord contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { BadgeListProcessors, BadgePosition, BadgeRarity, type BadgeUserArgs, type ProfileBadge } from "@api/Badges";
import { definePluginSettings } from "@api/Settings";
import { Button } from "@components/Button";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType, StartAt } from "@utils/types";
import { UserProfileStore, UserStore } from "@webpack/common";

import { BADGE_PRESETS, type BadgePreset } from "./badges";

const PREFIX = "daucord_badge_";

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
    selected: {
        type: OptionType.STRING,
        description: "Picked badge keys",
        default: ""
    },
    badgePicker: {
        type: OptionType.COMPONENT,
        component: BadgePickerComponent
    },
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

function selectedKeys(): string[] {
    return settings.store.selected.split(",").map(k => k.trim()).filter(Boolean);
}

function buildBadges(): ProfileBadge[] {
    const s = settings.store;
    const keys = selectedKeys();
    const picked: BadgePreset[] = [];

    for (const badge of BADGE_PRESETS) {
        if (keys.includes(badge.key)) picked.push(badge);
    }
    if (s.custom) {
        picked.push({ key: "custom", label: s.customLabel || "Custom badge", icon: s.customIcon, group: "Custom" });
    }

    const position = s.position === "end" ? BadgePosition.END : BadgePosition.START;

    return picked.map(badge => ({
        id: PREFIX + badge.key,
        key: badge.key,
        name: badge.label,
        description: badge.label,
        detail: badge.label,
        infoLabel: "Daucord",
        iconSrc: badge.icon,
        largeIconSrc: badge.icon,
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
    description: "Change the badges on your own profile, entirely client side. Pick from 79 badges or use your own",
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

function BadgePickerComponent() {
    const value = settings.use(["selected"]);
    const picked = new Set((value.selected || "").split(",").map(k => k.trim()).filter(Boolean));

    const toggle = (key: string) => {
        const next = new Set(picked);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        settings.store.selected = [...next].join(",");
        refresh();
    };

    const groups = [...new Set(BADGE_PRESETS.map(b => b.group))];

    return (
        <div className="dc-badge-picker">
            <div className="dc-badge-picker__tools">
                <Button
                    size="small"
                    onClick={() => {
                        settings.store.selected = BADGE_PRESETS.map(b => b.key).join(",");
                        refresh();
                    }}
                >
                    Select all
                </Button>
                <Button
                    size="small"
                    variant="secondary"
                    onClick={() => {
                        settings.store.selected = "";
                        refresh();
                    }}
                >
                    Clear
                </Button>
                <span className="dc-badge-picker__count">{picked.size} selected</span>
            </div>
            {groups.map(group => (
                <div className="dc-badge-picker__group" key={group}>
                    <div className="dc-badge-picker__group-title">{group}</div>
                    <div className="dc-badge-picker__grid">
                        {BADGE_PRESETS.filter(b => b.group === group).map(badge => (
                            <button
                                key={badge.key}
                                type="button"
                                title={badge.label}
                                className={
                                    "dc-badge-picker__item" +
                                    (picked.has(badge.key) ? " dc-badge-picker__item--on" : "")
                                }
                                onClick={() => toggle(badge.key)}
                            >
                                <img src={badge.icon} alt="" />
                                <span>{badge.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

function RefreshComponent() {
    return (
        <Button onClick={refresh}>
            Refresh profile
        </Button>
    );
}
