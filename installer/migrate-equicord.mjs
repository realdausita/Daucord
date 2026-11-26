#!/usr/bin/env node
/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Daucord contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/*
 * Daucord ayar aktarımı — Equicord/Vencord ayarlarını Daucord'a kopyalar.
 *
 * ÖNEMLİ: Kaynak klasör (Equicord/Vencord) SADECE OKUNUR.
 * Hiçbir dosya silinmez, değiştirilmez veya taşınmaz.
 *
 * Aktarılanlar:
 *   settings\settings.json        -> eklenti ayarları (açık/kapalı eklentiler), temalar, QuickCSS ayarı
 *   settings\quickCss.css         -> QuickCSS
 *   settings\native-settings.json -> yerel (native) ayarlar
 *   themes\*.css                  -> yerel tema dosyaları
 *
 * Usage:
 *   node migrate-equicord.mjs            -> Equicord'dan Daucord'a aktar
 *   node migrate-equicord.mjs --dry-run  -> sadece göster, hiçbir şey yazma
 *   node migrate-equicord.mjs --from "%APPDATA%\Vencord" --to "%APPDATA%\Daucord"
 */

import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync } from "fs";
import { join, resolve } from "path";
import { fileURLToPath } from "url";

const APPDATA = process.env.APPDATA ?? "";

/** En son kullanılan Equicord/Vencord ayar klasörünü bulur. */
export function detectSource() {
    let best;
    let bestTime = -1;

    for (const name of ["Equicord", "Vencord"]) {
        const dir = join(APPDATA, name);
        const file = join(dir, "settings", "settings.json");
        if (!existsSync(file)) continue;

        const time = statSync(file).mtimeMs;
        if (time > bestTime) {
            bestTime = time;
            best = dir;
        }
    }

    return best;
}

function countEnabledPlugins(file) {
    try {
        const settings = JSON.parse(readFileSync(file, "utf8"));
        return Object.values(settings.plugins ?? {}).filter(p => p?.enabled).length;
    } catch {
        return 0;
    }
}

/**
 * Ayarları tek yönlü kopyalar. Kaynak klasöre asla yazmaz.
 * @returns {boolean} en az bir dosya aktarıldıysa true
 */
export function migrateSettings({ from, to, dryRun = false, log = console.log } = {}) {
    const source = from ?? detectSource();
    const target = to ?? join(APPDATA, "Daucord");

    if (!source || !existsSync(source)) {
        log("Equicord/Vencord ayar klasörü bulunamadı.");
        return false;
    }

    log("Kaynak : " + source + "  (salt okunur)");
    log("Hedef  : " + target);

    const srcSettings = join(source, "settings");
    const dstSettings = join(target, "settings");
    if (!dryRun) {
        mkdirSync(dstSettings, { recursive: true });
        mkdirSync(join(target, "themes"), { recursive: true });
    }

    const dstJson = join(dstSettings, "settings.json");
    if (existsSync(dstJson)) {
        const stamp = new Date().toISOString().replace(/[:.]/g, "-");
        const backup = join(dstSettings, `settings.json.bak-${stamp}`);
        if (!dryRun) copyFileSync(dstJson, backup);
        log("Mevcut Daucord ayarları yedeklendi: " + backup);
    }

    let copied = 0;

    const copyFile = (relPath, label) => {
        const src = join(source, relPath);
        if (!existsSync(src)) {
            log(`  - ${label}: kaynakta yok, atlandı`);
            return;
        }

        if (!dryRun) {
            copyFileSync(src, join(target, relPath));
        }

        log(`  + ${label}`);
        copied++;
    };

    const srcJson = join(srcSettings, "settings.json");
    const enabled = existsSync(srcJson) ? countEnabledPlugins(srcJson) : 0;

    copyFile(join("settings", "settings.json"), `eklenti ayarları (${enabled} etkin eklenti)`);
    copyFile(join("settings", "quickCss.css"), "QuickCSS");
    copyFile(join("settings", "native-settings.json"), "native ayarlar");

    const themesSrc = join(source, "themes");
    if (existsSync(themesSrc)) {
        const themes = readdirSync(themesSrc).filter(f => f.endsWith(".css"));
        if (!themes.length) log("  - temalar: .css dosyası yok, atlandı");
        for (const f of themes) copyFile(join("themes", f), "tema: " + f);
    } else {
        log("  - temalar: klasör yok, atlandı");
    }

    return copied > 0;
}

// ---------- CLI ----------

function isDirectRun() {
    return process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isDirectRun()) {
    const args = process.argv.slice(2);
    const flag = name => {
        const i = args.indexOf(name);
        return i !== -1 && i + 1 < args.length ? args[i + 1] : undefined;
    };

    const dryRun = args.includes("--dry-run");

    console.log("Daucord ayar aktarımı");
    console.log("");
    if (dryRun) console.log("Mod    : DRY-RUN (hiçbir şey yazılmaz)");
    console.log("");

    const ok = migrateSettings({
        from: flag("--from"),
        to: flag("--to"),
        dryRun
    });

    console.log("");
    if (!ok) {
        console.log("Aktarılacak ayar bulunamadı. Equicord/Vencord kurulu mu?");
        process.exit(1);
    }

    if (dryRun) {
        console.log("Dry-run tamamlandı. Gerçekten aktarmak için --dry-run olmadan çalıştırın.");
    } else {
        console.log("Tamamlandı. Kaynak klasör olduğu gibi duruyor; hiçbir şey silinmedi.");
        console.log("Daucord'u ilk açılışta bu ayarlarla başlar.");
    }
}
