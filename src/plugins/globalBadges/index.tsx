/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { addProfileBadge, BadgePosition, BadgeRarity, ProfileBadge, removeProfileBadge } from "@api/Badges";
import { Button } from "@components/Button";
import { Devs } from "@utils/constants";
import { openInviteModal } from "@utils/discord";
import definePlugin from "@utils/types";
import { showToast } from "@webpack/common";

import { settings } from "./settings";
import { cl, GlobalBadges, INVITE_LINK, loadBadges } from "./utils";
const t = (msg: any, values?: any): string => {
    const text = typeof msg === "string" ? msg : String(msg);
    return values ? text.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? "")) : text;
};


let intervalId: any;

function getGlobalBadges(userId: string): ProfileBadge[] {
    const badges = GlobalBadges[userId];
    if (!badges?.length) return [];

    return badges.map((badge, idx) => {
        return {
            id: `global_badges_badge_${idx}`,
            iconSrc: badge.badge,
            description: badge.tooltip,
            name: badge.key,
            rarity: BadgeRarity.COMMON,
            position: BadgePosition.START,
            props: {
                style: {
                    borderRadius: "50%",
                    transform: "scale(0.9)"
                }
            },
        } satisfies ProfileBadge;
    });
}

const GlobalBadge: ProfileBadge = {
    id: "global_badges",
    position: BadgePosition.START,
    getBadges: ({ userId }) => getGlobalBadges(userId)
};

export default definePlugin({
    name: "GlobalBadges",
    description: "Adds global badges from other client mods",
    tags: ["Appearance"],
    authors: [Devs.Daucord],
    settings,
    settingsAboutComponent: () => (
        <>
            <Button
                variant="link"
                className={cl("settings-button")}
                onClick={() => openInviteModal(INVITE_LINK)}
            >
                {t("Join GlobalBadges Server")}</Button>
        </>
    ),
    async start() {
        // The badges were loaded but never handed to profiles, so none ever showed
        addProfileBadge(GlobalBadge);
        await loadBadges();
        clearInterval(intervalId);
        intervalId = setInterval(loadBadges, 1000 * 60 * 30);
    },
    async stop() {
        removeProfileBadge(GlobalBadge);
        clearInterval(intervalId);
    },
    toolboxActions: {
        "Refetch Global Badges": async function() {
            await loadBadges();
            showToast({ text: "Successfully refetched global badges!", variant: "success" });
        }
    },
    get GlobalBadges() {
        return GlobalBadges;
    },
    getGlobalBadges
});
