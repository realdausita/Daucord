/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Daucord contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { managedStyleRootNode } from "@api/Styles";
import { Devs } from "@utils/constants";
import { createAndAppendStyle } from "@utils/css";
import definePlugin, { OptionType } from "@utils/types";

let style: HTMLStyleElement | null = null;

const settings = definePluginSettings({
    disableAnimations: {
        type: OptionType.BOOLEAN,
        description: "Disable animations and transitions (less CPU/GPU usage, snappier UI)",
        default: true,
        onChange: setCss
    },
    hideTypingIndicators: {
        type: OptionType.BOOLEAN,
        description: "Hide the 'someone is typing...' indicator (less network-driven re-renders)",
        default: false,
        onChange: setCss
    },
    hideAvatarDecorations: {
        type: OptionType.BOOLEAN,
        description: "Hide animated avatar decorations (less memory and GPU usage)",
        default: false,
        onChange: setCss
    },
    hideProfileEffects: {
        type: OptionType.BOOLEAN,
        description: "Hide profile effects (less memory and GPU usage)",
        default: false,
        onChange: setCss
    }
});

function setCss() {
    if (!style) return;

    const { disableAnimations, hideTypingIndicators, hideAvatarDecorations, hideProfileEffects } = settings.store;
    const rules: string[] = [];

    if (disableAnimations) {
        rules.push(`
            *, *::before, *::after {
                animation-duration: 0s !important;
                animation-delay: 0s !important;
                transition-duration: 0s !important;
                transition-delay: 0s !important;
                scroll-behavior: auto !important;
            }
        `);
    }

    if (hideTypingIndicators) {
        rules.push(`
            div[class*="typing-"] {
                display: none !important;
            }
        `);
    }

    if (hideAvatarDecorations) {
        rules.push(`
            [class*="avatarDecoration"] {
                display: none !important;
            }
        `);
    }

    if (hideProfileEffects) {
        rules.push(`
            [class*="profileEffect"] {
                display: none !important;
            }
        `);
    }

    style.textContent = rules.join("\n");
}

export default definePlugin({
    name: "DaucordPerf",
    description: "Daucord performance mode: trim animations and decorative effects for lower CPU, GPU and RAM usage",
    tags: ["Appearance", "Utility"],
    authors: [Devs.Daucord],
    enabledByDefault: true,
    requiresRestart: false,
    settings,

    start() {
        style = createAndAppendStyle("DaucordPerf", managedStyleRootNode);
        setCss();
    },

    stop() {
        style?.remove();
        style = null;
    }
});
