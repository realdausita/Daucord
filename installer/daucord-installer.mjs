#!/usr/bin/env node
/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Daucord contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/*
 * Daucord Installer — lightweight, dependency-free installer for Daucord (a Vencord fork).
 * It patches Discord's resources/app.asar entry point, keeping a backup
 * of the original files so everything can be undone cleanly.
 *
 * It NEVER starts, stops or restarts Discord. Restart Discord yourself
 * after installing/uninstalling to apply the changes.
 *
 * Usage:
 *   node daucord-installer.mjs                 -> interactive menu (Turkish)
 *   node daucord-installer.mjs install         -> install into Discord Stable
 *   node daucord-installer.mjs install --branch all
 *   node daucord-installer.mjs uninstall [--branch all]
 *   node daucord-installer.mjs status [--branch all]
 *   node daucord-installer.mjs repair          -> re-write the injector
 *   Flags: --dry-run (show what would happen, change nothing),
 *          --discord-dir <path> (custom Discord base dir),
 *          --force (uninstall even if the injector is not Daucord's),
 *          --no-migrate (do not import Equicord/Vencord settings)
 *
 * On first install it automatically imports the settings, enabled plugins and
 * themes of an existing Equicord/Vencord installation (one-way copy; the
 * source folder is never modified).
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { createInterface } from "readline";
import { fileURLToPath } from "url";

import { migrateSettings } from "./migrate-equicord.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PATCHER = join(ROOT, "dist", "patcher.js");
const MARKER = "Daucord";

const BRANCHES = {
    stable: { name: "Discord Stable", dir: "Discord" },
    ptb: { name: "Discord PTB", dir: "DiscordPTB" },
    canary: { name: "Discord Canary", dir: "DiscordCanary" },
    dev: { name: "Discord Development", dir: "DiscordDevelopment" }
};

const args = process.argv.slice(2);
const command = args.find(a => !a.startsWith("--")) ?? "menu";
const dryRun = args.includes("--dry-run");
const force = args.includes("--force");
const noMigrate = args.includes("--no-migrate");
const branchArg = getFlagValue("--branch") ?? "stable";
const customDir = getFlagValue("--discord-dir");

const DAUCORD_SETTINGS = join(process.env.APPDATA ?? "", "Daucord", "settings", "settings.json");

function getFlagValue(flag) {
    const i = args.indexOf(flag);
    return i !== -1 ? args[i + 1] : undefined;
}

function log(msg) { console.log(msg); }
function ok(msg) { console.log("  [OK] " + msg); }
function warn(msg) { console.log("  [!] " + msg); }
function fail(msg) { console.error("  [HATA] " + msg); }

// ---------- discovery ----------

function compareVersions(a, b) {
    const pa = a.slice(4).split(".").map(Number);
    const pb = b.slice(4).split(".").map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const d = (pa[i] ?? 0) - (pb[i] ?? 0);
        if (d !== 0) return d;
    }
    return 0;
}

function findInstalls() {
    const localAppData = process.env.LOCALAPPDATA;
    if (!localAppData && !customDir) {
        fail("LOCALAPPDATA bulunamadı. Windows dışında bu yükleyiciyi --discord-dir ile kullanın.");
        process.exit(1);
    }

    const wanted = branchArg === "all" ? Object.keys(BRANCHES) : [branchArg];
    const installs = [];

    for (const key of wanted) {
        const branch = BRANCHES[key];
        if (!branch) {
            fail(`Bilinmeyen dal: ${key}. Seçenekler: stable, ptb, canary, dev, all`);
            process.exit(1);
        }

        const base = customDir ?? join(localAppData, branch.dir);
        if (!existsSync(base)) continue;

        let versions;
        try {
            versions = readdir(base).filter(d => d.startsWith("app-") && statSync(join(base, d)).isDirectory());
        } catch { continue; }

        if (!versions.length) continue;
        versions.sort(compareVersions);
        const latest = versions[versions.length - 1];
        const resources = join(base, latest, "resources");
        if (!existsSync(resources)) continue;

        installs.push({ key, branch: branch.name, base, version: latest, resources });
    }

    return installs;
}

function readdir(dir) {
    return readdirSync(dir);
}

// ---------- state ----------

function inspect(install) {
    const appAsar = join(install.resources, "app.asar");
    const backupAsar = join(install.resources, "_app.asar");
    const state = { appAsar, backupAsar, kind: "vanilla", injector: null, isDaucord: false };

    if (!existsSync(appAsar)) {
        state.kind = "missing";
        return state;
    }

    if (statSync(appAsar).isDirectory()) {
        state.kind = "folder";
        try {
            state.injector = readFileSync(join(appAsar, "index.js"), "utf-8");
        } catch { /* empty folder */ }
    } else {
        state.kind = "file";
        if (existsSync(backupAsar)) state.injector = "(asar archive)";
    }

    // the injector stores the path JSON-escaped (double backslashes on Windows)
    const escapedPatcher = JSON.stringify(PATCHER).slice(1, -1);
    state.isDaucord = !!state.injector && (state.injector.includes(escapedPatcher) || state.injector.includes(PATCHER));

    state.isPatched = state.kind === "folder" || (state.kind === "file" && existsSync(backupAsar));
    return state;
}

// ---------- patch / unpatch ----------

function writeInjector(appAsarDir) {
    mkdirSync(appAsarDir, { recursive: true });
    const indexJs = `// ${MARKER} injector - https://github.com/Vendicated/Vencord (fork)\nrequire(${JSON.stringify(PATCHER)});\n`;
    const packageJson = JSON.stringify({ name: "discord", main: "index.js" }, null, 2) + "\n";

    if (dryRun) {
        log(`  [dry-run] yazılacak: ${join(appAsarDir, "index.js")}`);
        log(`  [dry-run] içerik: ${indexJs.trim()}`);
        return;
    }

    writeFileSync(join(appAsarDir, "index.js"), indexJs);
    writeFileSync(join(appAsarDir, "package.json"), packageJson);
}

function install(install, repair = false) {
    log(`\n>> ${install.branch} (${install.version})`);
    const s = inspect(install);

    if (s.kind === "missing") {
        fail("app.asar bulunamadı, bu kurulum tanınmıyor.");
        return false;
    }

    if (s.isDaucord && !repair) {
        ok("Daucord zaten kurulu. Yeniden yazmak için: repair");
        return true;
    }

    if (!existsSync(PATCHER)) {
        fail("dist/patcher.js bulunamadı. Önce derleyin: pnpm build");
        return false;
    }

    const renames = [];
    try {
        if (s.kind === "file" && !existsSync(s.backupAsar)) {
            // vanilla Discord: keep the original asar as _app.asar
            log("  yedekleniyor: app.asar -> _app.asar");
            if (!dryRun) {
                renameSync(s.appAsar, s.backupAsar);
                renames.push([s.appAsar, s.backupAsar]);
            }
        } else if (s.isPatched && !s.isDaucord) {
            // another mod (Vencord/Equicord/...) is installed: back up its injector
            const backupName = `app.asar.backup-${Date.now()}`;
            const backupPath = join(install.resources, backupName);
            warn(`Başka bir mod kurulu. Enjektörü yedekleniyor: ${backupName}`);
            if (!dryRun) {
                renameSync(s.appAsar, backupPath);
                renames.push([s.appAsar, backupPath]);
            }
            if (!existsSync(s.backupAsar)) {
                fail("_app.asar (orijinal Discord) bulunamadı. Güvenlik için işlem durduruldu.");
                throw new Error("missing original");
            }
        } else if (s.isDaucord && repair) {
            log("  mevcut Daucord enjektörü yeniden yazılıyor");
            if (!dryRun) rmSync(s.appAsar, { recursive: true, force: true });
        }

        writeInjector(s.appAsar);
        ok(repair ? "Daucord onarıldı." : "Daucord kuruldu.");
        log("  Discord'u KENDİNİZ yeniden başlatınca etkin olacak.");
        return true;
    } catch (err) {
        fail(err.message);
        if (isBusyError(err)) {
            warn("Dosyalar Discord tarafından kilitli olabilir. Discord'u kapatıp tekrar deneyin.");
        }
        // undo partial changes
        for (const [from, to] of renames.reverse()) {
            try { if (!dryRun && existsSync(to)) renameSync(to, from); } catch { /* best effort */ }
        }
        return false;
    }
}

// Daucord ilk kez kuruluyorsa Equicord/Vencord ayarlarını otomatik devralır.
function autoMigrate() {
    if (noMigrate) {
        log("\n  Ayar aktarımı --no-migrate ile atlandı.");
        return;
    }

    if (dryRun) {
        log("\n  [dry-run] Equicord/Vencord ayarları (varsa) Daucord'a aktarılacak.");
        return;
    }

    if (existsSync(DAUCORD_SETTINGS)) {
        log("\n  Daucord ayarları zaten var; otomatik aktarım atlandı.");
        return;
    }

    log("\n  Equicord/Vencord ayarları aranıyor...");
    try {
        const migrated = migrateSettings({ log: msg => log("  " + msg) });
        if (migrated) {
            log("  Ayarlar Daucord'a aktarıldı (kaynak klasör değişmedi).");
        }
    } catch (err) {
        warn("Ayar aktarımı başarısız oldu: " + err.message);
    }
}

function uninstall(install) {
    log(`\n>> ${install.branch} (${install.version})`);
    const s = inspect(install);

    if (!s.isPatched) {
        ok("Bu kurulum zaten temiz (mod yok).");
        return true;
    }

    if (!s.isDaucord && !force) {
        warn("Kurulu enjektör Daucord'a ait değil. Kaldırmak için --force kullanın.");
        return false;
    }

    if (!existsSync(s.backupAsar)) {
        fail("_app.asar yedeği bulunamadı. Elle düzeltmek gerekebilir; işlem durduruldu.");
        return false;
    }

    const tmp = join(install.resources, `app.asar.tmp-${Date.now()}`);
    try {
        if (!dryRun) {
            renameSync(s.appAsar, tmp);
            renameSync(s.backupAsar, s.appAsar);
            rmSync(tmp, { recursive: true, force: true });
        } else {
            log("  [dry-run] enjektör kaldırılıp orijinal app.asar geri getirilecek");
        }
        ok("Daucord kaldırıldı, orijinal Discord geri yüklendi.");
        log("  Discord'u KENDİNİZ yeniden başlatınca etkin olacak.");

        const backups = readdir(install.resources).filter(f => f.startsWith("app.asar.backup-"));
        if (backups.length) {
            warn(`Önceki modun yedeği duruyor: ${backups.join(", ")}`);
            log("  Önceki modu geri yüklemek için onun yükleyicisini tekrar çalıştırabilirsiniz.");
        }
        return true;
    } catch (err) {
        fail(err.message);
        if (isBusyError(err)) {
            warn("Dosyalar Discord tarafından kilitli olabilir. Discord'u kapatıp tekrar deneyin.");
        }
        return false;
    }
}

function status(install) {
    const s = inspect(install);
    let label;
    if (s.kind === "missing") label = "tanınmıyor (app.asar yok)";
    else if (s.isDaucord) label = "DAUCORD KURULU";
    else if (s.isPatched) label = "başka bir mod kurulu" + (s.injector && s.kind === "folder" ? ` (${s.injector.trim().split("\n").pop()})` : "");
    else label = "temiz (mod yok)";

    log(`  ${install.branch.padEnd(22)} ${install.version.padEnd(14)} ${label}`);
}

function isBusyError(err) {
    return ["EBUSY", "EPERM", "EACCES"].includes(err?.code);
}

// ---------- interactive menu ----------

async function menu() {
    log("");
    log("  ╔══════════════════════════════════════╗");
    log("  ║           DAUCORD YÜKLEYİCİ          ║");
    log("  ╚══════════════════════════════════════╝");
    log("");

    const installs = findInstalls();
    if (!installs.length) {
        fail("Discord kurulumu bulunamadı.");
        process.exit(1);
    }

    log("  Bulunan kurulumlar:");
    for (const i of installs) status(i);
    log("");
    log("  1) Daucord kur (Discord Stable)");
    log("  2) Daucord kur (bulunan TÜM dallar)");
    log("  3) Durumu göster");
    log("  4) Daucord kaldır");
    log("  5) Onar (enjektörü yeniden yaz)");
    log("  6) Çıkış");
    log("");
    log("  Not: Bu yükleyici Discord'u kapatmaz/yeniden başlatmaz.");
    log("  Kurulumdan sonra Discord'u kendiniz yeniden başlatın.");
    log("");

    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise(r => rl.question("  Seçim (1-6): ", r));
    rl.close();

    const target = answer.trim() === "2" ? installs : installs.filter(i => i.key === "stable");
    const list = target.length ? target : installs;

    switch (answer.trim()) {
        case "1": case "2": {
            let any = false;
            for (const i of list) any = install(i) || any;
            if (any) autoMigrate();
            break;
        }
        case "3":
            for (const i of installs) status(i);
            break;
        case "4":
            for (const i of list) uninstall(i);
            break;
        case "5": {
            let any = false;
            for (const i of list) any = install(i, true) || any;
            if (any) autoMigrate();
            break;
        }
        default:
            log("  Çıkılıyor.");
    }
}

// ---------- main ----------

if (command === "menu") {
    await menu();
} else {
    const installs = findInstalls();
    if (!installs.length) {
        fail("Discord kurulumu bulunamadı." + (customDir ? "" : " --discord-dir ile deneyebilirsiniz."));
        process.exit(1);
    }

    let success = true;
    let installedAny = false;
    for (const i of installs) {
        switch (command) {
            case "install":
                if (install(i)) installedAny = true;
                else success = false;
                break;
            case "repair":
                if (install(i, true)) installedAny = true;
                else success = false;
                break;
            case "uninstall": success = uninstall(i) && success; break;
            case "status": status(i); break;
            default:
                fail(`Bilinmeyen komut: ${command}`);
                process.exit(1);
        }
    }

    if (installedAny && (command === "install" || command === "repair")) autoMigrate();
    process.exit(success ? 0 : 1);
}
