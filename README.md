# 🎬 YouTube Embed Enhancer

The latest YouTube embed UI update removed proper volume control, limiting users to a simple mute/unmute toggle. This makes it difficult to balance audio—especially on platforms like Holodex where multiple streams (POVs) are played at the same time.

**YouTube Embed Enhancer** restores missing controls and adds powerful new features for a smoother, more flexible viewing experience.

---

## ✨ New in v2.4.0

**Persistent and draggable Mini stats**: now remembers for your last 10 videos if its visible and its position.
- **Connection speed**: Mini Stats now displays your connection speed from youtube's stats for nerds.
- **Better Latency, dropped frames & Buffer**: now gets stats from youtube's stats for nerds instead of doing it with my old way.
- **Live Viewer Count (Holodex only)**: Added real-time "Watching" stats directly to the Mini Stats overlay. In Holodex, there's no way to see the current number of live viewers without closing the embed to check the mini icon or viewing the stream directly on YouTube.

---

## ✨ New in v2.3.0

- **Persistent Volume**: now remembers the volume for your last 10 videos, so you won't need to re-adjust after a tab refresh.
- **playback speed**: changed playback speed to be more precise.
- **Volume Control Visibility**: can now be toggled on/off on settings menu.
- **Color-Coded Dropped Frames**: Mini Stats overlay now color-codes dropped frames (Blue to Red)
- **Button Visibility Fix**: Fixed an issue where the PiP and Stats buttons wouldn't hide when disabled in settings.

---

## 🚀 Features

### ⚙️ Settings Menu
- Click the **Settings button** (⚙️) to open the configuration menu.
- **Show/hide individual buttons** (WL, URL, Snap, PiP, Speed, Stats) to declutter your interface.
- **Configure hotkeys** for each action.
- Settings are saved automatically in your browser.

### 🔊 Volume Control
- Use **Arrow Up / Arrow Down keys** (configurable).
- Or **scroll your mouse wheel** while hovering over the video.
- **Visual feedback overlay** showing exact volume percentage.

### 🔊 Volume Boost
- **Boost volume up to 3x** in settings.
- Good for quiet streams or balancing audio.

### 🕒 Watch Later
- Click the **WL button** to save the video to your YouTube Watch Later list.
- Works even in embeds where the native button is hidden.
*Note: Requires being logged into YouTube.*

### ⏩ Playback Speed Control
- **Click** the speed button to cycle (0.25x → 2x).
- **Shift + Click** (or scroll) for **fine adjustment (0.05x)**.
- **Right-click** to reset to **1x**.
- Use **. and , keys** or **scroll wheel** while hovering over the button (configurable).

### 📸 Screenshot Tool
- Click the **Snap button** to copy the current frame to clipboard.
- **Ctrl + Click** → Save locally as PNG and copy to clipboard.
- **Smart Filenames**: Automatically named as `ChannelName_MM-SS-mmm.png`.

### 🎬 Video Clipping
- **Record WebM clips** from the video.
- **Ctrl + Click** for longer clips (5 minutes).
- Duration is configurable in settings.
- *Note: Higher resolutions require more system resources.*

### 🖼️ Picture-in-Picture (PiP)
- Click the **PiP button** (bottom-right corner) to pop the video out.

### 🌓 Appearance Settings
- **High Contrast**: Solid buttons for better visibility against bright or busy video backgrounds.
- **Compact Mode**: Toggle between text labels or icons only.
- **Hide/Expand Toggle**: Click the `>` button to collapse the UI (hides everything except Settings).

### 🔗 Copy Video URL
- Click the **URL button** to copy the video link.
- **Ctrl + Click** → Copy link with the **current timestamp** included.

### 📊 Advanced (Stats for Nerds)
- Press **Shift + S** or click the **Stats button**.
- **Ctrl + Click** for a tiny overlay showing connection speed, buffer, latency, dropped frames, and live viewer info.

---

## 🛠️ Installation

### 1. Install a Userscript Manager
Choose one of the following:

- [Tampermonkey](https://www.tampermonkey.net/) *(Recommended for Chrome, Edge, Safari)*
- [Violentmonkey](https://violentmonkey.github.io/) *(Open-source alternative)*
- [Greasemonkey](https://www.greasespot.net/) *(Firefox)*

### 2. Install the Script
- Open the [youtube-embed-enhancer.user.js](https://raw.githubusercontent.com/jmpatag/YouTube-Embed-Enhancer/main/youtube-embed-enhancer.user.js) file.
- Click raw.
- Your userscript manager will prompt you → click **Install**.

---

## 📜 License

This project is licensed under the **GNU General Public License v3.0**.  
See the [LICENSE](LICENSE) file for details.
