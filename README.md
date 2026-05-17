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

## Credits & License

- Media processing powered by [Mediabunny](https://github.com/Vanilagy/mediabunny) (MIT License)
- Licensed under the **[GNU General Public License v3.0](LICENSE)**