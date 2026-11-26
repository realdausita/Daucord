/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Daucord contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export interface DaucordTheme {
    label: string;
    /** Hue of the neutral (background) palette */
    hue: number;
    /** Saturation of the neutral palette, in percent */
    saturation: number;
    /** Lightness of the darkest main background, in percent */
    baseLightness: number;
    /** Hue of the accent (brand) palette */
    accentHue: number;
    /** Saturation of the accent palette, in percent */
    accentSaturation: number;
}

export const DaucordThemeList: Record<string, DaucordTheme> = {
    midnight: {
        label: "Daucord Midnight",
        hue: 235,
        saturation: 24,
        baseLightness: 11,
        accentHue: 250,
        accentSaturation: 70
    },
    amoled: {
        label: "Daucord AMOLED",
        hue: 240,
        saturation: 4,
        baseLightness: 3,
        accentHue: 250,
        accentSaturation: 65
    },
    ocean: {
        label: "Daucord Ocean",
        hue: 210,
        saturation: 34,
        baseLightness: 12,
        accentHue: 195,
        accentSaturation: 75
    },
    forest: {
        label: "Daucord Forest",
        hue: 150,
        saturation: 18,
        baseLightness: 11,
        accentHue: 145,
        accentSaturation: 55
    },
    sakura: {
        label: "Daucord Sakura",
        hue: 330,
        saturation: 20,
        baseLightness: 13,
        accentHue: 325,
        accentSaturation: 60
    }
};
