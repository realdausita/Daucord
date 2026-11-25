/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Daucord contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { BadgeListProcessors, BadgePosition, BadgeRarity, type BadgeUserArgs, type ProfileBadge } from "@api/Badges";
import { definePluginSettings } from "@api/Settings";
import { Button } from "@components/Button";
import { copyToClipboard } from "@utils/clipboard";
import { Devs } from "@utils/constants";
import { fetchUserProfile } from "@utils/discord";
import definePlugin, { OptionType, StartAt } from "@utils/types";
import { RestAPI, showToast, UserProfileStore, UserStore } from "@webpack/common";

import { BADGE_PRESETS, type BadgePreset } from "./badges";
import { localizeGroup, localizeLabel } from "./i18n";

const PREFIX = "daucord_badge_";
const bioCache = new Map<string, string>();
const catalogNames = new Map<string, { name: string; infoLabel?: string; rarity?: number }>();

async function loadCatalog() {
    try {
        const { body } = await RestAPI.get({ url: "/users/@me/badges" });
        const badges = (body as any)?.badges;
        if (!Array.isArray(badges)) return;
        for (const badge of badges) {
            const icon = badge?.simple_icon_url ?? badge?.complex_icon_static_url ?? badge?.icon;
            if (!icon || !badge?.name) continue;
            catalogNames.set(icon, {
                name: badge.description ?? badge.name,
                infoLabel: badge.info_label,
                rarity: badge.rarity
            });
        }
        refresh();
    } catch { }
}

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
    shareViaBio: {
        type: OptionType.BOOLEAN,
        description: "Add an invisible badge code to your bio so other Daucord users can see them",
        default: false,
        onChange: refresh
    },
    copyBioCode: {
        type: OptionType.COMPONENT,
        component: CopyBioCodeComponent
    },
    showOthers: {
        type: OptionType.BOOLEAN,
        description: "Show badges shared by other Daucord users in their bios",
        default: true,
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

function makeBadges(keys: string[], userId: string): ProfileBadge[] {
    const s = settings.store;
    const picked: BadgePreset[] = [];

    for (const key of keys) {
        const badge = BADGE_PRESETS.find(b => b.key === key);
        if (badge) picked.push(badge);
    }
    if (userId === UserStore.getCurrentUser()?.id && s.custom) {
        picked.push({ key: "custom", label: s.customLabel || "Custom badge", icon: s.customIcon, group: "Custom" });
    }

    const position = s.position === "end" ? BadgePosition.END : BadgePosition.START;

    return picked.map(badge => {
        const catalog = catalogNames.get(badge.icon);
        const name = catalog?.name ?? localizeLabel(badge.label, badge.group);
        return {
            id: PREFIX + badge.key,
            key: badge.key,
            name,
            description: name,
            detail: name,
            infoLabel: catalog?.infoLabel ?? localizeGroup(badge.group),
            iconSrc: badge.icon,
            largeIconSrc: badge.icon,
            rarity: catalog?.rarity ?? BadgeRarity.RARE,
            position,
            shouldShow: ({ userId: id }: BadgeUserArgs) => id === userId,
            props: { style: { borderRadius: "50%" } }
        };
    });
}

function encodeKeys(keys: string[]): string {
    const indices = keys
        .map(k => BADGE_PRESETS.findIndex(b => b.key === k))
        .filter(i => i >= 0)
        .map(i => i.toString(36))
        .join(".");
    const text = `[db:${indices}]`;
    return Array.from(text)
        .map(c => String.fromCodePoint(c.codePointAt(0)! + 0xe0000))
        .join("");
}

function decodeBio(bio: string | undefined): string[] {
    if (!bio) return [];
    let ascii = "";
    for (const ch of bio) {
        const cp = ch.codePointAt(0)!;
        if (cp >= 0xe0000 && cp <= 0xe007f) ascii += String.fromCodePoint(cp - 0xe0000);
    }
    const match = ascii.match(/\[db:([0-9a-z.]+)\]/);
    if (!match) return [];
    return match[1]
        .split(".")
        .filter(Boolean)
        .map(i => BADGE_PRESETS[parseInt(i, 36)]?.key)
        .filter((k): k is string => !!k);
}

function ensureBio(userId: string) {
    if (bioCache.has(userId)) return;
    bioCache.set(userId, "");
    fetchUserProfile(userId)
        .then(profile => {
            bioCache.set(userId, (profile as any)?.bio ?? "");
            refresh();
        })
        .catch(() => { });
}

function processBadges(args: BadgeUserArgs, badges: ProfileBadge[]): ProfileBadge[] {
    const self = UserStore.getCurrentUser()?.id;
    if (args.userId === self) {
        const mine = makeBadges(selectedKeys(), args.userId);
        if (!mine.length) return badges;
        const otherDaucordBadges = badges.filter(b => String(b.id).startsWith("daucord_") && !String(b.id).startsWith(PREFIX));
        return settings.store.replaceBadges ? [...mine, ...otherDaucordBadges] : [...badges, ...mine];
    }

    if (!settings.store.showOthers) return badges;
    ensureBio(args.userId);
    const shared = decodeBio(bioCache.get(args.userId));
    if (!shared.length) return badges;
    return [...badges, ...makeBadges(shared, args.userId)];
}

export default definePlugin({
    name: "DaucordBadgeChanger",
    description: "Change the badges on your own profile, share them with other Daucord users, entirely client side",
    tags: ["Appearance", "Customisation"],
    authors: [Devs.Daucord],
    requiresRestart: false,
    startAt: StartAt.DOMContentLoaded,
    settings,

    start() {
        BadgeListProcessors.add(processBadges);
        loadCatalog();
        refresh();
    },

    stop() {
        BadgeListProcessors.delete(processBadges);
        bioCache.clear();
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
                    <div className="dc-badge-picker__group-title">{localizeGroup(group)}</div>
                    <div className="dc-badge-picker__grid">
                        {BADGE_PRESETS.filter(b => b.group === group).map(badge => (
                            <button
                                key={badge.key}
                                type="button"
                                title={localizeLabel(badge.label, badge.group)}
                                className={
                                    "dc-badge-picker__item" +
                                    (picked.has(badge.key) ? " dc-badge-picker__item--on" : "")
                                }
                                onClick={() => toggle(badge.key)}
                            >
                                <img src={badge.icon} alt="" />
                                <span>{localizeLabel(badge.label, badge.group)}</span>
                            </button>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

function CopyBioCodeComponent() {
    return (
        <div className="dc-badge-picker__tools">
            <Button
                size="small"
                onClick={async () => {
                    const code = encodeKeys(selectedKeys());
                    await copyToClipboard(code);
                    showToast({ text: "Badge code copied. Paste it at the end of your bio.", variant: "success" });
                }}
            >
                Copy badge code for bio
            </Button>
            <span className="dc-badge-picker__hint">Paste once; the code is invisible.</span>
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
