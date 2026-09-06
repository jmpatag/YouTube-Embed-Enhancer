# 🎬 YouTube Embed Enhancer

Restores volume control and adds a versatile toolkit for real-time diagnostics, video clipping, screenshots, and persistent playback customization to YouTube embeds.

---

## Table of Contents

- [What's New](#whats-new)
- [Features](#features)
  - [Playback](#playback)
  - [Recording & Capture](#recording--capture)
  - [Interface & Display](#interface--display)
  - [Utilities](#utilities)
- [Installation](#installation)
- [Credits & License](#credits--license)

---

## What's New

<details open>
<summary><strong>v3.2.0</strong></summary>

### ✨ New Features

- **Notes** — The new `🔖` button lets you bookmark a moment in a video and give it a name. Click a saved note any time to jump right back to that spot, or rename and delete notes whenever you like. (Right-click the button to save a note without opening the panel, or set a hotkey for it.)
- Your notes are saved and synced along with the rest of your history.
- **Sleep Timer** — pauses the video after a set time — pick a preset (15 minutes to 4 hours), type your own number of minutes, or have it stop at the end of the video. A small countdown chip shows the time left, the timer keeps going even if the video reloads.

### ⚙️ Changes and Improvements

- **Smaller script** — the bundled Mediabunny library is trimmed to just the parts Clip/Replay uses, ~300 KB off the file. Still fully self-contained. Updated to Mediabunny 1.55.6; build tooling in [`tools/mediabunny/`](tools/mediabunny/).
- **Faster and lighter** — The History tab now opens instantly even with hundreds of saved videos, and starring or deleting a video only updates that one row.
- **Auto-shrinking toolbar** — On very small embeds the toolbar automatically hides button labels (and tucks itself away if space is still tight).

</details>

<details>
<summary><strong>v3.1.0</strong></summary>

### ✨ New Features

- **Favorites** — Star any video in the History tab to pin it. Filter the whole list down to just favorites with one click. Favorites sync with Gist and JSON import/export like the rest of your history.

### ⚙️ Changes and Improvements

- Performance improvements
- Faster page load: the Mediabunny library and the Settings window are now only built the first time you actually need them (opening Settings, using Clip/Replay), instead of unconditionally on every embed.
- Removed the Thumbnail and Profile Picture toolbar buttons. Both are still available in history tab.

### 🐛 Bug Fixes

- A possible fullscreen fixes

</details>

<details>
<summary><strong>v3.0.0</strong></summary>

### ✨ New Features

- **History Tab** — Ever started a livestream but had to sleep, go to work, or do something else before finishing it? Instead of using Watch Later or writing down a timestamp, find it here. Browse your watched videos with thumbnails, titles, channel names, and quick actions like Copy Link, Download Thumbnail/PFP, Open in Holodex, Delete and list/grid view.
- **Video Cache (Playback Position Cache)** — Watching a 6–12 hour stream or archive and YouTube forgets your progress—or you forgot to copy the timestamp before closing the page? This feature remembers where you left off, so you can continue watching later (up to the last 200 videos).
- **GitHub Gist Sync** — Using multiple devices? Sync your watch history across all of them using a private GitHub Gist with configurable sync intervals.
- **JSON Import/Export** — You can manually import and export your history.
- **Persistent Mini Stats** — Keep Mini Stats enabled by default across every video.
- **Settings Fullscreen** — Added a button to expand the Settings window, useful for small embeds.

### ⚙️ Changes and Improvements

- Improved UI with a cleaner, more polished Settings window.
- Major Performance improvements.
- Initial Volume can now be set to 0%.
- Video thumbnail and channel profile picture downloads have been moved from the Tools tab to the History tab. You can still add them back as toolbar buttons from the Interface tab, though they may be removed in a future update.
- Restore Defaults and Clear Cache now use a two-click confirmation to help prevent accidental clicks.
- Added possible compatibility with the HyperChat browser extension.
- Updated mediabunny to 1.50.9

### 🐛 Bug Fixes

- Fixed double-clicking Mini Stats not resetting its position to the bottom-left corner.
- Fixed various stability issues and minor bugs.

</details>

<details>
<summary><strong>v2.8.0</strong></summary>

- **Toggleable Volume Cache**: You can now enable or disable the volume cache in Settings → General. Disabling it clears saved volumes instantly.
- **Bug Fixes**: Fixed an issue with volume control and resolved a bug where double-clicking caused UI issues in fullscreen mode.

</details>

<details>
<summary><strong>v2.7.0</strong></summary>

- **No More External Dependency**: The Mediabunny library is now bundled inside the script — no extra downloads, better security, and works even if the source goes down.
- **Snap Is Now Instant**: The screenshot (Snap) button now copies or saves your frame immediately when you click it, instead of waiting in the background.

</details>

<details>
<summary><strong>v2.6.0</strong></summary>

- **UI & Settings Revamp**: Fresh new design and an easy-to-navigate tabbed layout.
- **NexusMods Fullscreen Support**: Double-clicking to fullscreen or using the native YouTube fullscreen button now works on NexusMods. (Let me know if you want other sites added)
- **Media Asset Tools**: Added thumbnail and profile picture downloaders.
- **Holodex Volume Sync Fix**: Fixed broken volume syncing between Holodex media controls and YouTube.
- **Recording Improvements**: Added bitrate presets for Instant Replay (Very Low → Very High). Note: Higher bitrate increases quality and file size, but uses more system resources.

</details>

<details>
<summary><strong>v2.5.0</strong></summary>

- **Instant Replay**: New Feature. Similar to AMD Relive and Nvidia Shadowplay but for YouTube embeds. Allows you to save the last X (configurable) seconds of the video that you can share with your friends/groups.
- **Global Initial Volume**: New Feature. Allows you to set the initial volume of the video.
- **Volume Step**: New Feature. Allows you to set the step of the volume.
- **Clip**: Saves as MP4 format instead of WebM for better compatibility.
- **Fix**: Bugs and performance fixes.

</details>

<details>
<summary><strong>v2.4.0</strong></summary>

- **Persistent and draggable Mini Stats**: Now remembers for your last 10 videos if it's visible and its position.
- **Connection speed**: Mini Stats now displays your connection speed from YouTube's Stats for Nerds.
- **Better Latency, Dropped Frames & Buffer**: Now gets stats from YouTube's Stats for Nerds instead of the old method.
- **Live Viewer Count (Holodex only)**: Added real-time "Watching" stats directly to the Mini Stats overlay. In Holodex, there's no way to see the current number of live viewers without closing the embed — now you can see it at a glance.

</details>

<details>
<summary><strong>v2.3.0</strong></summary>

- **Persistent Volume**: Now remembers the volume for your last 10 videos, so you won't need to re-adjust after a tab refresh.
- **Playback speed**: Changed playback speed to be more precise.
- **Volume Control Visibility**: Can now be toggled on/off in the settings menu.
- **Color-Coded Dropped Frames**: Mini Stats overlay now color-codes dropped frames (Blue to Red).
- **Button Visibility Fix**: Fixed an issue where the PiP and Stats buttons wouldn't hide when disabled in settings.

</details>

---

## Features

### Playback

- **Volume Control** — Scroll over the video, or use Arrow Up / Down (configurable).
- **Volume Boost** — Amplify audio up to 3× in Settings → General.
- **Playback Speed** — Click to cycle; Shift+Click for fine steps (0.01×); right-click to reset to 1×.
- **Preferred Quality** — Set a default resolution that applies to all embeds.
- **Initial Volume** — Set a default starting volume for all embeds in Settings → General.
- **Persistent Volume** — Volume is remembered per video across sessions. If you hit refresh, you won't need to adjust the volume again — especially useful in Holodex multiview.
- **Sleep Timer** — Auto-pause after a set time (15 min – 4 hours, a custom minute count, or the video's end) via the `😴` toolbar button or Settings → Tools. Survives player reloads, shows a `😴` countdown chip, optionally fades the audio out, and offers snooze buttons when it fires.
- **Notes** — Click `🔖` (or the *Add Note* hotkey) to drop named timestamps on a video and jump back to them. They live in the History tab's Notes view, sync with Gist, and export as a chapter list.

### Recording & Capture

- **Screenshot** — Click **Snap** to copy the current frame to clipboard. Ctrl+Click to also save as PNG.
- **Clip** — Click **Clip** to start recording; Ctrl+Click for a longer clip (up to 5 min); right-click to cancel.
- **Instant Replay** — Click **Replay** to start buffering; click again to save the last X seconds as MP4.

> **Note:** Higher resolutions, longer durations, and higher replay bitrates use more CPU and RAM.

### Interface & Display

- **Mini Stats overlay** — Ctrl+Click **Stats** to show speed, buffer, latency, dropped frames, and live viewer count. Draggable and position is saved per video.
- **Stats for Nerds** — Click **Stats** (or Shift+S) to toggle YouTube's native diagnostics panel.
- **Compact mode** — Icons only, no text labels (Settings → Interface).
- **High Contrast UI** — Solid buttons for visibility against busy backgrounds (Settings → Interface).
- **Collapse UI** — Click **`>`** to hide all buttons except Settings.
- **Picture-in-Picture** — Click **PiP** to pop the video into a floating window.

### Utilities

- **Copy URL** — Click **URL** to copy the video link. Ctrl+Click to include the current timestamp.
- **Watch Later** — Click **WL** to add the video to your YouTube Watch Later list. *(Requires YouTube login.)*
- **Thumbnail** — Download the max-resolution thumbnail via Settings → Tools, or enable the **Thumb** toolbar button.
- **Profile Picture** — Download the channel avatar via Settings → Tools, or enable the **PFP** toolbar button.
- **Hotkeys** — Fully configurable in Settings → Hotkeys.
- **Button visibility** — Show or hide any button in Settings → Interface.

---

## Installation

**1. Install a userscript manager**

- [Violentmonkey](https://violentmonkey.github.io/) — Chrome, Firefox, Edge
- [Greasemonkey](https://www.greasespot.net/) — Firefox

**2. Install the script**

Click below — your userscript manager will prompt you to install:

**[➤ Install YouTube Embed Enhancer](https://update.greasyfork.org/scripts/572481/YouTube%20Embed%20Enhancer.user.js)**

Or find it on [Greasy Fork](https://greasyfork.org/scripts/572481) or [GitHub](https://github.com/jmpatag/YouTube-Embed-Enhancer).

---

## Building from source

The script is stitched from the modules in [`src/`](src/). `youtube-embed-enhancer.user.js`
in the repo root is the built output.

**Requirements:** Node (LTS). All commands run from the repo root.

```
npm run build            # -> youtube-embed-enhancer.user.js
npm run check            # node --check on the built file
```

Rollup bundles `src/` into one file (the script itself is never minified) with the
`// ==UserScript==` banner from `src/_banner.txt` on top — `@version` lives there.

**Mediabunny** (the MP4 remux library for Clip / Instant Replay) is vendored as a
trimmed, minified `src/mediabunny.js`. To regenerate or update it:

```
npm run build:mediabunny     # rebuild at the pinned version, then re-stitch
npm run upgrade:mediabunny    # pull mediabunny@latest, rebuild, re-stitch
```

Both finish by re-running `npm run build`, so the userscript is always current.

**CI:** `.github/workflows/build-check.yml` rebuilds on every PR and fails if the
committed `youtube-embed-enhancer.user.js` is stale.
`mediabunny-upgrade.yml` runs monthly and opens a PR when a newer Mediabunny ships.

---

## Credits & License

- Media processing powered by [Mediabunny](https://github.com/Vanilagy/mediabunny) (MPL-2.0), bundled tree-shaken — see [`tools/mediabunny/`](tools/mediabunny/)
- Licensed under the **[GNU General Public License v3.0](LICENSE)**