# Security

Daucord collects no usage data and ships no obfuscated code. The installer does not manage Discord processes, and updates are checked before they are used.

## What is in the repository

All source is here. Production builds are minified with esbuild. There is no obfuscation and no embedded binary. `pnpm build --dev` reproduces the output from source.

Dependencies are installed from the lockfile with `pnpm install --frozen-lockfile`.

NoTrack is on by default and blocks Discord's analytics and crash-reporting requests. The installer only touches local files. The client itself talks to Discord's CDN and, if you enable it, the Vencord Cloud backend. Update checks contact GitHub for releases and upstream tags. Anything else is contacted only by a plugin or theme you enabled.

A release manifest carries SHA-256 hashes for every file it replaces, and the downloaded installer is checked against the digest GitHub publishes for the asset. A mismatched download is discarded.

The installer never starts, stops or restarts Discord. It changes the `resources/app.asar` entry point, keeps Discord's original file as `_app.asar`, backs up another mod's injector separately and rolls back its changes if a step fails.

## Check it yourself

```bat
pnpm install --frozen-lockfile
pnpm test:ts
pnpm lint
pnpm build --dev
```

`dist/SHA256SUMS.txt` has the hashes of the packaged installers. You can send them to VirusTotal or any other scanner. If a scanner flags something, the code is here so it can be traced back to a line.

## Report a problem

If you find a security issue, tell the repository owner privately instead of opening a public issue.

## Out of scope

Discord itself is not covered here. Themes and plugins you load from QuickCSS or online theme links are your own responsibility. Only use sources you trust.
