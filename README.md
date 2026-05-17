# 🎬 YouTube Embed Enhancer

The latest YouTube embed UI update removed proper volume control, limiting users to a simple mute/unmute toggle. This makes it difficult to balance audio—especially on platforms like Holodex where multiple streams (POVs) are played at the same time.

**YouTube Embed Enhancer** restores proper volume control and adds a versatile toolkit for real-time diagnostics, video clipping, screenshots, and persistent playback customization.

---

## ✨ New in v2.6.0

- **UI & Settings Revamp**: Fresh new design and an easy-to-navigate tabbed layout.
- **NexusMods Fullscreen Support**: Double-clicking to fullscreen or using the native YouTube fullscreen button now works on NexusMods. (Let me know if you want other sites added)
- **Media Asset Tools**: Added thumbnail and profile picture downloaders.
- **Holodex Volume Sync Fix**: Fixed broken volume syncing between Holodex media controls and YouTube.
- **Recording Improvements**: Added bitrate presets for Instant Replay (Very Low → Very High). Note: Higher bitrate increases quality and file size, but uses more system resources.
- **Fix**: Bugs.
---

## ✨ New in v2.5.0

- **Instant Replay**: New Feature. Similar to AMD Relive and Nvidia Shadowplay but for youtube embeds. allows you to save the last X(Configurable) seconds of the video that you can share with your friends/groups.
- **Global Initial Volume**: New Feature. allows you to set the initial volume of the video.
- **Volume Step**: New Feature. allows you to set the step of the volume. 
- **clip**: saves as mp4 format instead of webm for better compatibility.
- **Fix**: Bugs and performance fixes.

---

## ✨ New in v2.4.0

- **Persistent and draggable Mini stats**: now remembers for your last 10 videos if its visible and its position.
- **Connection speed**: Mini Stats now displays your connection speed from youtube's stats for nerds.
- **Better Latency, dropped frames & Buffer**: now gets stats from youtube's stats for nerds instead of doing it with my old way.
- **Live Viewer Count (Holodex only)**: Added real-time "Watching" stats directly to the Mini Stats overlay. In Holodex, there's no way to see the current number of live viewers without closing the embed then check the icons at the top or viewing the stream directly on YouTube.

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
- **Shift + Click** (or scroll) for **fine adjustment (0.01x)**.
- **Right-click** to reset to **1x**.
- Use **. and , keys** or **scroll wheel** while hovering over the button.

### ⏪ Instant Replay
- **Save the last X seconds** of the video (configurable, up to 60s).
- Similar to AMD ReLive or Nvidia Shadowplay but for YouTube embeds.
- **Single-click download** or use a hotkey to grab a high-quality clip of what just happened.
- **Adjustable Quality**: Choose between bitrate presets from Very Low to Very High.
 *Note: Higher bitrate increases quality and file size, but uses more system resources.*

### 🎬 Video Clipping
- **Record MP4 clips** directly from the video.
- **Ctrl + Click** for longer clips (up to 5 minutes).
- **Smart Initialization**: Ensures clips have proper metadata (ftyp/moov) for maximum compatibility.
- Duration is configurable in settings.
- *Note: Higher resolutions and durations require more system resources.*

### 📸 Screenshot Tool
- Click the **Snap button** to copy the current frame to clipboard.
- **Ctrl + Click** → Save locally as PNG and copy to clipboard.
- **Smart Filenames**: Automatically named as `ChannelName_Screenshot_MM-SS.png`.

### 🖼️ Media Asset Tools
- **Thumbnail Downloader**: Download the maximum resolution thumbnail of the video.
- **Profile Picture (PFP) Downloader**: Download the channel's high-resolution avatar.
- **How to use**:
  *   Open **Settings (⚙️) → Tools tab** to find direct download buttons.
  *   Alternatively, enable the dedicated **Thumb** and **PFP** buttons in the **Interface tab** to add them to your player toolbar.

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

## 🛠️ Credits

This project uses [Mediabunny](https://github.com/Vanilagy/mediabunny) (MIT License) for media processing.

---

## 📜 License

This project is licensed under the **GNU General Public License v3.0**.  
See the [LICENSE](LICENSE) file for details.
