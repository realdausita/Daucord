/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Daucord contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Compatibility layer for plugins ported from Endcord. Daucord keeps its UI in
// English, so messages pass through with only {placeholders} substituted.

export type EndcordLang = "en" | "tr" | "ru" | "es" | "fr";

export interface LanguageOption {
    value: EndcordLang;
    label: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
    { value: "en", label: "English" },
    { value: "tr", label: "Türkçe" },
    { value: "ru", label: "Русский" },
    { value: "es", label: "Español" },
    { value: "fr", label: "Français" }
];

export function normalizeLang(value: string | undefined | null): EndcordLang {
    const lang = String(value ?? "en").split("-")[0].toLowerCase();
    return SUPPORTED_LANGUAGES.some(item => item.value === lang) ? lang as EndcordLang : "en";
}

let currentLang: EndcordLang = "en";

export function getCurrentLang(): EndcordLang {
    return currentLang;
}

export function setEndcordLanguage(value: string) {
    currentLang = normalizeLang(value);
}

export function t(message: any, values?: Record<string, string | number>): any {
    if (typeof message !== "string") return message;
    if (!values) return message;
    return message.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));
}

export const translateText = t;

export function tPluginDesc(_name: string, fallback: string): string {
    return fallback;
}

export function useI18n() {
    return {
        lang: currentLang,
        t,
        tPluginDesc,
        setLanguage: setEndcordLanguage
    };
}
