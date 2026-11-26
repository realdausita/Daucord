/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Daucord contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { managedStyleRootNode } from "@api/Styles";
import { Devs } from "@utils/constants";
import { createAndAppendStyle } from "@utils/css";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType } from "@utils/types";

import { DaucordTheme, DaucordThemeList } from "./themes";

const logger = new Logger("DaucordThemes", "#8b5cf6");

let style: HTMLStyleElement | null = null;
let cachedStyles: string | null = null;

const settings = definePluginSettings({
    theme: {
        type: OptionType.SELECT,
        description: "Built-in Daucord theme. Applied instantly, no restart needed",
        options: [
            { label: "None (Discord default)", value: "none", default: true },
            ...Object.entries(DaucordThemeList).map(([value, { label }]) => ({ label, value }))
        ],
        onChange: () => applyTheme()
    }
});

async function getDiscordStyles(): Promise<string> {
    if (cachedStyles != null) return cachedStyles;

    const styleLinkNodes = document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]');
    const cssTexts = await Promise.all(Array.from(styleLinkNodes, node =>
        node.href ? fetch(node.href).then(res => res.text()).catch(() => null) : null
    ));

    cachedStyles = cssTexts.filter(Boolean).join("\n");
    return cachedStyles;
}

function extractLightness(styles: string, prefix: "neutral" | "brand"): Record<string, number> {
    const regex = new RegExp(`(--${prefix}-\\d{1,3}-hsl):.+?([\\d.]+?)%;`, "g");
    const result: Record<string, number> = {};

    for (const [, name, lightness] of styles.matchAll(regex)) {
        result[name] = parseFloat(lightness);
    }

    return result;
}

function generateVars(lightnessMap: Record<string, number>, baseLightness: number, hue: number, saturation: number, themeBase: number): string {
    return Object.entries(lightnessMap).map(([name, lightness]) => {
        const offset = lightness - baseLightness;
        const sign = offset >= 0 ? "+" : "-";
        return `${name}: ${hue} ${saturation}% calc(${themeBase}% ${sign} ${Math.abs(offset).toFixed(2)}%);`;
    }).join("\n");
}

function classicFallback({ hue, saturation, baseLightness, accentHue, accentSaturation }: DaucordTheme): string {
    const bg = (l: number) => `hsl(${hue} ${saturation}% ${Math.max(0, l)}%)`;

    return `
        .theme-dark, .theme-light {
            --background-primary: ${bg(baseLightness)};
            --background-secondary: ${bg(baseLightness - 2)};
            --background-secondary-alt: ${bg(baseLightness - 3)};
            --background-tertiary: ${bg(baseLightness - 4)};
            --background-floating: ${bg(baseLightness + 4)};
            --channeltextarea-background: ${bg(baseLightness + 3)};
            --background-modifier-hover: hsl(${hue} ${saturation}% ${baseLightness + 6}% / 0.4);
            --background-modifier-active: hsl(${hue} ${saturation}% ${baseLightness + 8}% / 0.5);
            --background-modifier-selected: hsl(${hue} ${saturation}% ${baseLightness + 10}% / 0.6);
            --brand-experiment: hsl(${accentHue} ${accentSaturation}% 60%);
            --brand-experiment-560: hsl(${accentHue} ${accentSaturation}% 52%);
        }
    `;
}

async function applyTheme() {
    if (!style) return;

    const theme = DaucordThemeList[String(settings.store.theme)];
    if (!theme) {
        style.textContent = "";
        return;
    }

    let css = classicFallback(theme);

    try {
        const styles = await getDiscordStyles();
        const neutrals = extractLightness(styles, "neutral");
        const darkBase = neutrals["--neutral-69-hsl"];
        const lightBase = neutrals["--neutral-2-hsl"];

        if (darkBase != null && lightBase != null) {
            css += `\n.theme-dark {\n${generateVars(neutrals, darkBase, theme.hue, theme.saturation, theme.baseLightness)}\n}`;
            css += `\n.theme-light {\n${generateVars(neutrals, lightBase, theme.hue, Math.min(theme.saturation, 12), 96)}\n}`;
        }

        const brands = extractLightness(styles, "brand");
        const brandBase = brands["--brand-500-hsl"];
        if (brandBase != null) {
            css += `\n.theme-dark, .theme-light {\n${generateVars(brands, brandBase, theme.accentHue, theme.accentSaturation, brandBase)}\n}`;
        }
    } catch (err) {
        logger.error("Failed to extract Discord colors, using fallback palette", err);
    }

    style.textContent = css;
}

export default definePlugin({
    name: "DaucordThemes",
    description: "Built-in Daucord themes (Midnight, AMOLED, Ocean, Forest, Sakura) with instant switching",
    tags: ["Appearance", "Customisation"],
    authors: [Devs.Daucord],
    enabledByDefault: true,
    requiresRestart: false,
    settings,

    start() {
        style = createAndAppendStyle("DaucordThemes", managedStyleRootNode);
        applyTheme();
    },

    stop() {
        style?.remove();
        style = null;
    }
});
