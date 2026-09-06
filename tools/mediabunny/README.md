# Mediabunny bundle

Clip and Instant Replay remux to MP4 with [Mediabunny](https://github.com/Vanilagy/mediabunny).
`entry.js` lists the exports we use; `build.mjs` bundles just those with esbuild
(minified, tree-shaken — ~400 KB vs ~700 KB) and writes `src/mediabunny.js`.

It's loaded lazily via `__ytee_loadMediabunny()`, so it's only parsed in full the
first time Clip runs.

## Build

Needs Node. Run from the repo root:

```
npm run build:mediabunny      # rebuild at the pinned version, then re-stitch
npm run upgrade:mediabunny     # bump to mediabunny@latest, rebuild, re-stitch
```

`build.mjs` only touches `src/mediabunny.js` (and bumps the `@version` patch in
`src/_banner.txt` when the bundle changed). Both root scripts finish by re-running
`npm run build`, which regenerates the userscript. Prints `no change` and writes
nothing if the bundle is identical.

Mediabunny's API shifts between versions — test a Clip and an Instant Replay in a
real embed before committing an upgrade.

## Automation

- `mediabunny-upgrade.yml` — monthly (or manual): rebuild, re-stitch, open a PR if
  there's a newer version. Never auto-merges.
- `build-check.yml` — on PRs touching `src/` or `tools/`: fails if the committed
  `youtube-embed-enhancer.user.js` is stale.

## Notes

- New `MediaRecorder` container (not webm/mp4)? Add its `*InputFormat` to `entry.js`.
- Tracked: `entry.js`, `build.mjs`, `package*.json`, generated `src/mediabunny.js`.
  `node_modules/` is gitignored.
