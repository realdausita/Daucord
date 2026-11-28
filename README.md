<p align="center">
  <img src="branding/daucord-256.png" width="120" alt="Daucord logo">
</p>

# Daucord

Daucord is a Discord client mod forked from Vencord. It uses Vencord's plugin system and adds bundled themes, a Windows installer, an updater and a handful of small widgets.

The source is in this repository under GPL-3.0. Builds are minified with esbuild, not obfuscated.

## Install

Get `DaucordInstaller.exe` from Releases, run it, choose Install, and restart Discord yourself when it finishes. The installer never closes Discord.

You need Windows 10 or 11 and the Discord desktop app (Stable, PTB, Canary or Development). The exe carries its own payload and uses the .NET Framework already on Windows, so there is no Node.js, no admin prompt and no network access during installation.

If Vencord or Equicord is installed, their injector is moved to `app.asar.backup-<timestamp>`. Discord's own file is kept as `_app.asar`, and uninstall puts it back.

![Daucord installer](branding/installer-preview.png)

The GUI also has Uninstall, Repair, Status and Migrate. The small link at the bottom ("already installed?") updates what is installed: it applies the build in the exe, checks GitHub for a newer release, verifies SHA-256 and runs the newer installer quietly.

Same operations from the CLI:

```bat
DaucordInstallerCli.exe status --branch all
DaucordInstallerCli.exe install [--branch all] [--dry-run]
DaucordInstallerCli.exe repair
DaucordInstallerCli.exe uninstall [--force]
DaucordInstallerCli.exe migrate [--from <path>]
DaucordInstallerCli.exe install --discord-dir "D:\Discord"
```

Both executables are compiled with the `csc.exe` that ships with Windows. To build them yourself, run `pnpm build` followed by `pnpm buildInstaller`.

## Settings from Vencord or Equicord

Daucord keeps its files in `%APPDATA%\Daucord`. It does not touch Vencord's or Equicord's folders.

On first install, if Daucord has no settings yet, the installer copies `settings.json`, `quickCss.css`, `native-settings.json` and the files in `themes/` from Vencord or Equicord. Existing Daucord settings are backed up before anything is overwritten. You can run the same copy later from Migrate in the GUI or with `DaucordInstallerCli.exe migrate`.

Settings for Equicord-only plugins are ignored.

## Updates

Daucord checks GitHub when Discord starts. If a newer release exists, you get a notification. The files are downloaded, checked against the SHA-256 in the manifest and written to `%APPDATA%\Daucord\dist`. Discord restarts only when you click the restart notification. There is also an Update Now button under Settings → Daucord → Updater.

To publish a release, bump the version in `package.json`, push the commit, tag it `v<version>` and create a GitHub release. The workflow attaches the dist files, the generated manifest and the installer executables. A plain commit does not notify users.

## Plugins

All Vencord plugins are here, plus 11 Daucord ones:

| Plugin | What it does | Default |
| --- | --- | --- |
| DaucordPerf | Turns off animations and effects that cost CPU/GPU and memory | on |
| DaucordThemes | Five built-in themes that apply without a restart | on, theme: None |
| DaucordClock | Draggable clock widget that remembers its position | off |
| DaucordMessageTools | Adds "Copy Creation Time" to the message context menu | on |
| GlobalBadges | Shows cross-mod profile badges from the GlobalBadges service to users who have the plugin | off |
| DaucordWaterReminder | Draggable water reminder with interval, desktop notification and custom sound settings | off |
| DaucordBadgeChanger | Client-side badge picker for your own profile, 79 presets plus a custom image and tooltip | off |
| DaucordSpotifyLyrics | Spotify lyrics in the player or in a draggable window; word timing, cache and a timing offset | off |
| DaucordSnowy | Winter theme with lightweight canvas snowfall that keeps working when animations are disabled | off |
| AntiNickname | Automatically resets a nickname someone assigned to you in a server | off |
| DmReadReceipt | Shows a Seen indicator on your DM messages | off |

Another 305 plugins were adapted from [Endcord](https://github.com/Endcord/Endcord) and 16 from [Equicord](https://github.com/Equicord/Equicord), both GPL-3.0. Nine Endcord plugins are still left out because they need Endcord's native module, FFmpeg/WASM or npm packages Daucord does not ship. The ported ones are under `src/plugins`, and their settings are in the Daucord section of Discord's settings.

Endcord header bar buttons are mapped to Vencord's chat bar buttons, so ported plugins still have working controls.

The NEW badge follows plugin code: it shows on first launch for new plugins and after an update only for plugins whose code changed.

## Themes

Pick one of the five built-in themes in DaucordThemes. They recolour Discord's CSS variables live, with no restart. QuickCSS and online theme links work as they do in Vencord, and the raw CSS files are in `themes/`.

## Branding

The logo source is `branding/daucord-logo.svg`, with PNG sizes from 16 to 1024 and a multi-size `daucord.ico` next to it. To regenerate the icon set:

```bat
powershell -ExecutionPolicy Bypass -File branding/make-icons.ps1
```

## Building from source

```bat
pnpm install --frozen-lockfile
pnpm build --dev
pnpm test:ts
pnpm lint
```

The output goes into `dist/`, which is where the installer reads `patcher.js` from. `dist/SHA256SUMS.txt` holds the checksums of the packaged installers.

## Security

See [SECURITY.md](SECURITY.md). Short version: no telemetry, no obfuscated code, the installer does not manage Discord processes, and updates are verified before they are applied.

## Licence

GPL-3.0-or-later, same as Vencord. Vencord's copyright headers are preserved: Vencord, Copyright (c) 2022 Vendicated and contributors. Daucord changes, Copyright (c) 2026 Daucord contributors.

Discord is a trademark of Discord Inc. This project is not affiliated with Discord Inc. Client mods may violate Discord's Terms of Service; use at your own risk.
