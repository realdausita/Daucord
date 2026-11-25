# Daucord security policy

"Zero virus" is not a slogan here. It is a property you can check yourself.

## How it is built

All source is in this repository. Production builds are minified with esbuild, with no obfuscation and no embedded binaries. `pnpm build --dev` reproduces the output from source.

Daucord collects no usage data and sends no telemetry. The NoTrack plugin is on by default and blocks Discord's own analytics and crash-reporting requests.

The Node installer makes no network requests; it only touches local files. The client itself talks to Discord's CDN, and optionally to the Vencord Cloud backend if you enable that feature. Update checks contact GitHub for releases and upstream tags. Nothing else is contacted without a plugin or theme you enabled yourself.

Updates are verified. A release manifest carries SHA-256 hashes for every file it replaces, and the downloaded installer is checked against the digest GitHub publishes for the asset. A mismatched download is discarded.

The installer never starts, stops or restarts Discord. It only changes the `resources/app.asar` entry point, keeps the original as `_app.asar`, backs up any other mod's injector separately, and rolls back its changes if a step fails.

Dependencies are installed from the lockfile with `pnpm install --frozen-lockfile`.

## Checking it yourself

```bat
pnpm install --frozen-lockfile
pnpm test:ts
pnpm lint
pnpm build --dev
```

`dist/SHA256SUMS.txt` has the hashes of the packaged installers. You can send them to VirusTotal or any other scanner. Since the code is open, anything a scanner flags can be traced back to a line in this repository.

## Reporting a problem

If you find a security issue, tell the repository owner privately instead of opening a public issue. The code is GPL-3.0, so anyone can review and fix it.

## Out of scope

The security of Discord itself is not covered here. Third-party themes and plugins loaded from QuickCSS or online theme links are your responsibility; only use sources you trust.
