// ==UserScript==
// @name         YouTube Embed Enhancer
// @namespace    https://github.com/jmpatag
// @version      2.0.0
// @description  Enhances YouTube Embeds with custom volume controls, hotkeys, and some optimizations.
// @author       jmpatag
// @license      GPL-3.0
// @match        *://www.youtube.com/embed/*
// @match        *://www.youtube-nocookie.com/embed/*
// @run-at       document-idle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addValueChangeListener
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @updateURL    https://raw.githubusercontent.com/jmpatag/YouTube-Embed-Enhancer/main/youtube-embed-enhancer.user.js
// @downloadURL  https://raw.githubusercontent.com/jmpatag/YouTube-Embed-Enhancer/main/youtube-embed-enhancer.user.js
// ==/UserScript==

(() => {
  "use strict";


  const isControlsDisabled = new URLSearchParams(window.location.search).get("controls") === "0";
  const isPlayButtonMissing = !document.querySelector(".ytp-play-button");

  if (isControlsDisabled || isPlayButtonMissing) {
    const cssTheme = `
      :root {
        --ytee-bg-dark: rgba(15, 15, 15, 0.7);
        --ytee-bg-medium: rgba(25, 25, 25, 0.6);
        --ytee-border-dim: rgba(255, 255, 255, 0.2);
        --ytee-hover-bg: rgba(255, 255, 255, 0.18);
        --ytee-text-white: rgba(255, 255, 255, 0.9);
        
        --ytee-stats-color: #ffd700;
        --ytee-stats-bg: rgba(255, 215, 0, 0.12);
        --ytee-stats-border: rgba(255, 215, 0, 0.6);
        
        --ytee-speed-color: #7df;
        --ytee-speed-bg: rgba(119, 221, 255, 0.1);
        --ytee-speed-border: rgba(119, 221, 255, 0.6);
        
        --ytee-slider-track: rgba(255, 255, 255, 0.4);
        
        --ytee-anim-fast: 0.1s cubic-bezier(0.4, 0, 0.2, 1);
        --ytee-anim-normal: 0.15s cubic-bezier(0.4, 0, 0.2, 1);
        --ytee-anim-slow: 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        --ytee-anim-slider: 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        
        --ytee-border-radius: 5px;
      }
    `;

    document.head.appendChild(
      Object.assign(document.createElement("style"), {
        textContent: cssTheme + `
          player-fullscreen-action-menu {
            display: none !important;
          }

          #custom-vol-overlay,
          #custom-speed-overlay {
            position: fixed;
            top: 140px;
            left: 50%;
            transform: translateX(-50%);
            background: var(--ytee-bg-dark);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            color: white;
            padding: 10px 20px;
            border-radius: 6px;
            font-size: 18px;
            font-family: sans-serif;
            font-weight: bold;
            z-index: 9999;
            opacity: 0;
            pointer-events: none;
            transition: opacity var(--ytee-anim-slow);
            will-change: opacity;
            contain: layout style;
          }

          #custom-vol-overlay.show,
          #custom-speed-overlay.show {
            opacity: 1;
            transition: opacity var(--ytee-anim-fast);
          }

          #custom-speed-overlay {
            top: 190px;
          }

          #custom-mute-btn,
          #custom-vol-slider {
            z-index: 9999;
            position: fixed;
          }

          #custom-btn-group {
            position: fixed;
            bottom: 18px;
            right: 18px;
            display: flex;
            gap: 0px;
            z-index: 9999;
            opacity: 0;
            pointer-events: none;
            transition: opacity var(--ytee-anim-slow);
            will-change: opacity;
            contain: layout style;
          }

          #custom-btn-group.show {
            opacity: 1;
            pointer-events: auto;
          }

          #custom-mute-btn,
          #custom-vol-slider,
          #custom-stats-btn,
          #custom-speed-btn,
          #custom-screenshot-btn,
          #custom-pip-btn,
          #custom-url-btn,
          #custom-wl-btn,
          #custom-settings-btn {
            color: white;
            line-height: 1;
            text-shadow: 0 1px 3px rgba(0, 0, 0, 0.7);
            background: none;
            border: none;
          }

          #custom-stats-btn,
          #custom-speed-btn,
          #custom-screenshot-btn,
          #custom-pip-btn,
          #custom-url-btn,
          #custom-wl-btn {
            padding: 5px 12px;
            font-size: 13px;
            font-family: monospace;
            font-weight: bold;
            letter-spacing: 0.04em;
            color: var(--ytee-text-white);
            background: var(--ytee-bg-medium) !important;
            border: 1px solid var(--ytee-border-dim) !important;
            border-radius: 0px;
            margin-left: -1px;

            cursor: pointer;
            opacity: 0;
            pointer-events: none;
            transition: opacity var(--ytee-anim-slow), background var(--ytee-anim-normal), transform var(--ytee-anim-fast);
            /* No will-change: parent #custom-btn-group is already composited. */
          }

          #custom-wl-btn {
            border-top-left-radius: var(--ytee-border-radius) !important;
            border-bottom-left-radius: var(--ytee-border-radius) !important;
            margin-left: 0;
          }

          #custom-stats-btn {
            border-top-right-radius: var(--ytee-border-radius) !important;
            border-bottom-right-radius: var(--ytee-border-radius) !important;
          }

          #custom-btn-group.show button {
            opacity: 1;
            pointer-events: auto;
          }

          #custom-btn-group.show button:hover {
            background: var(--ytee-hover-bg) !important;
            transform: scale(1.05);
            z-index: 10;
          }

          #custom-stats-btn.active {
            color: var(--ytee-stats-color);
            border-color: var(--ytee-stats-border) !important;
            background: var(--ytee-stats-bg) !important;
          }

          #custom-speed-btn.modified {
            color: var(--ytee-speed-color);
            border-color: var(--ytee-speed-border) !important;
            background: var(--ytee-speed-bg) !important;
          }

          #custom-mute-btn {
            bottom: 18px;
            left: 18px;

            width: 28px;
            height: 28px;

            cursor: pointer;
            background: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>') no-repeat center center;
            background-size: contain;
            opacity: 0;
            pointer-events: none;
            transition: opacity var(--ytee-anim-slow), transform var(--ytee-anim-fast);
            will-change: opacity;
            contain: layout style;
          }

          #custom-mute-btn.show {
            opacity: 1;
            pointer-events: auto;
          }

          #custom-mute-btn.show:hover {
            transform: scale(1.1);
          }

          #custom-mute-btn.muted {
            background: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>') no-repeat center center;
            background-size: contain;
          }

          #custom-vol-slider {
            bottom: 23px;
            left: 55px;

            width: 85px;
            height: 12px;

            cursor: pointer;
            appearance: none;
            background: transparent;
            outline: none;
            opacity: 0;
            pointer-events: none;
            transition: opacity var(--ytee-anim-slow), width var(--ytee-anim-slider);
            will-change: opacity;
            contain: layout style;
          }

          #custom-vol-slider.show {
            opacity: 0.8;
            pointer-events: auto;
          }

          #custom-vol-slider.show:hover {
            opacity: 1;
            width: 100px;
          }

          #custom-vol-slider::-webkit-slider-runnable-track {
            height: 4px;
            border-radius: 2px;
            background: var(--ytee-slider-track);
          }

          #custom-vol-slider::-moz-range-track {
            height: 4px;
            border-radius: 2px;
            background: var(--ytee-slider-track);
          }

          #custom-vol-slider::-webkit-slider-thumb {
            width: 12px;
            height: 12px;
            margin-top: -4px;

            appearance: none;
            border-radius: 50%;
            background: white;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
          }

          #custom-vol-slider::-moz-range-thumb {
            width: 12px;
            height: 12px;

            border-radius: 50%;
            background: white;
            border: none;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
          }

          #custom-settings-btn {
            padding: 5px 12px;
            font-size: 13px;
            font-family: monospace;
            font-weight: bold;
            letter-spacing: 0.04em;
            color: var(--ytee-text-white);
            background: var(--ytee-bg-medium) !important;
            border: 1px solid var(--ytee-border-dim) !important;
            border-radius: 0px;
            margin-left: -1px;

            cursor: pointer;
            opacity: 0;
            pointer-events: none;
            transition: opacity var(--ytee-anim-slow), background var(--ytee-anim-normal), transform var(--ytee-anim-fast);
            /* No will-change: parent #custom-btn-group is already composited. */
          }

          #custom-settings-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            z-index: 10000;
            display: none;
            align-items: center;
            justify-content: center;
          }

          #custom-settings-modal.show {
            display: flex;
          }

          #custom-settings-content {
            background: var(--ytee-bg-dark);
            border: 1px solid var(--ytee-border-dim);
            border-radius: var(--ytee-border-radius);
            padding: 20px;
            max-width: 500px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
            color: white;
            font-family: sans-serif;
          }

          #custom-settings-content h2 {
            margin-top: 0;
            font-size: 20px;
            letter-spacing: 0.02em;
          }

          #custom-settings-content h3.setting-section-title {
            margin: 22px 0 8px;
            font-size: 14px;
            color: rgba(255,255,255,0.8);
            text-transform: uppercase;
            letter-spacing: 0.12em;
          }

          #custom-settings-content .setting-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 10px 0;
            border-bottom: 1px solid rgba(255,255,255,0.08);
          }

          #custom-settings-content .setting-item:last-child {
            border-bottom: none;
          }

          #custom-settings-content .setting-item label {
            flex: 1;
            font-size: 14px;
            min-width: 150px;
          }

          #custom-settings-content .setting-item input[type="checkbox"] {
            margin-right: 10px;
          }

          #custom-settings-content .setting-item input[type="text"],
          #custom-settings-content .setting-item .hk-input {
            width: 110px;
            padding: 8px 10px;
            background: rgba(255,255,255,0.06);
            border: 1px solid rgba(255,255,255,0.12);
            border-radius: 10px;
            color: white;
            font-size: 13px;
            text-transform: lowercase;
          }

          #custom-settings-content .setting-item input[type="text"]:focus,
          #custom-settings-content .setting-item .hk-input:focus {
            outline: none;
            border-color: var(--ytee-hover-bg);
            box-shadow: 0 0 0 2px rgba(255,255,255,0.08);
          }

          #custom-settings-buttons {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            margin-top: 20px;
          }

          #custom-settings-restore,
          #custom-settings-save,
          #custom-settings-cancel {
            padding: 8px 16px;
            background: var(--ytee-bg-medium);
            border: 1px solid var(--ytee-border-dim);
            border-radius: var(--ytee-border-radius);
            color: white;
            cursor: pointer;
            font-size: 14px;
            margin-left: 10px;
          }

          #custom-settings-save:hover,
          #custom-settings-cancel:hover {
            background: var(--ytee-hover-bg);
          }
        `,
      }),
    );


    const waitForVideo = (callback) => {
      const existing = document.querySelector("video");
      if (existing) { callback(existing); return; }

      const observer = new MutationObserver(() => {
        const v = document.querySelector("video");
        if (v) { observer.disconnect(); callback(v); }
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
    };

    const defaultSettings = {
      buttons: {
        wl: true,
        url: true,
        screenshot: true,
        pip: true,
        speed: true,
        stats: true,
      },
      hotkeys: {
        toggleMute: 'm',
        toggleStats: 'shift+s',
        increaseSpeed: '.',
        decreaseSpeed: ',',
        volumeUp: 'arrowup',
        volumeDown: 'arrowdown',
      },
    };

    const loadStoredSettings = () => {
      try {
        if (typeof GM_getValue === 'function') {
          const gmValue = GM_getValue('ytee-settings', null);
          if (gmValue) {
            return typeof gmValue === 'string' ? JSON.parse(gmValue) : gmValue;
          }
        }
      } catch (err) {
        console.warn('GM_getValue failed', err);
      }

      try {
        const raw = localStorage.getItem('ytee-settings');
        if (raw) return JSON.parse(raw);
      } catch (err) {
        console.warn('localStorage read failed', err);
      }

      return null;
    };

    const saveStoredSettings = (settings) => {
      try {
        if (typeof GM_setValue === 'function') {
          GM_setValue('ytee-settings', JSON.stringify(settings));
        }
      } catch (err) {
        console.warn('GM_setValue failed', err);
      }

      try {
        localStorage.setItem('ytee-settings', JSON.stringify(settings));
      } catch (err) {
        console.warn('localStorage write failed', err);
      }
    };

    let currentSettings = loadStoredSettings() || defaultSettings;

    const saveSettings = () => {
      saveStoredSettings(currentSettings);
    };

    const loadSettings = () => {
      currentSettings = loadStoredSettings() || defaultSettings;
    };

    waitForVideo((video) => {
      loadSettings();

      let targetVolume = video.volume;
      let targetMuted = video.muted;

      const uw = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
      let cachedPlayer = null;
      const getPlayer = () => {
        if (cachedPlayer && typeof cachedPlayer.getVideoData === 'function') return cachedPlayer;
        cachedPlayer = uw.document.getElementById("movie_player") || uw.document.querySelector(".html5-video-player");
        return cachedPlayer;
      };

      const originalMuted = Object.getOwnPropertyDescriptor(uw.HTMLMediaElement.prototype, 'muted');
      let isScriptChange = false;

      const setVideoVolume = (v) => {
        isScriptChange = true;
        const p = getPlayer();
        if (p && typeof p.setVolume === 'function') {
          p.setVolume(Math.round(v * 100));
        } else {
          video.volume = v;
        }
        isScriptChange = false;
      };
      const setVideoMuted = (m) => {
        isScriptChange = true;
        const p = getPlayer();
        if (m && p && typeof p.mute === 'function') {
          p.mute();
        } else if (!m && p && typeof p.unMute === 'function') {
          p.unMute();
        } else {
          video.muted = m;
        }
        isScriptChange = false;
      };

      // Volume Adjustment
      const applyVolume = (newVol) => {
        targetVolume = Math.min(1, Math.max(0, Math.round(newVol * 100) / 100));
        targetMuted = targetVolume === 0;
        setVideoMuted(targetMuted);
        setVideoVolume(targetVolume);
        showVolumePercent(targetMuted ? 0 : targetVolume);
      };

      const toggleMute = () => {
        targetMuted = !targetMuted;
        setVideoMuted(targetMuted);
        muteBtn.classList.toggle("muted", targetMuted);
        showVolumePercent(targetMuted ? 0 : targetVolume);
      };

      // Volume & Speed Overlays
      const volPct = Object.assign(document.createElement("div"), {
        id: "custom-vol-overlay"
      });
      let volTimeout;
      const showVolumePercent = (volume) => {
        const text = Math.round(volume * 100) + "%";
        if (volPct.textContent !== text) volPct.textContent = text;
        volPct.classList.add("show");
        clearTimeout(volTimeout);
        volTimeout = setTimeout(() => volPct.classList.remove("show"), 1500);
      };

      const speedOverlay = Object.assign(document.createElement("div"), {
        id: "custom-speed-overlay"
      });
      let speedTimeout;
      const showSpeedOverlay = (rate) => {
        const text = rate + "x";
        if (speedOverlay.textContent !== text) speedOverlay.textContent = text;
        speedOverlay.classList.add("show");
        clearTimeout(speedTimeout);
        speedTimeout = setTimeout(() => speedOverlay.classList.remove("show"), 1500);
      };


      const muteBtn = Object.assign(document.createElement("button"), {
        id: "custom-mute-btn",
      });

      muteBtn.addEventListener("click", toggleMute);

      // Volume Slider Control
      const vol = Object.assign(document.createElement("input"), {
        id: "custom-vol-slider",
        type: "range",
        min: 0,
        max: 1,
        step: 0.01,
        value: video.volume,
      });

      vol.addEventListener("input", () => {
        applyVolume(Number(vol.value));
      });

      video.addEventListener("volumechange", () => {
        if (isScriptChange) return;
        targetMuted = video.muted;
        targetVolume = video.muted ? targetVolume : video.volume;
        muteBtn.classList.toggle("muted", targetMuted);
        const displayVol = targetMuted ? 0 : targetVolume;
        if (Number(vol.value) !== displayVol) {
          vol.value = displayVol;
        }
      });

      let isHoveringSpeedBtn = false;

      window.addEventListener("wheel", (e) => {
        if (isSettingsOpen) {
          e.stopImmediatePropagation();
          e.preventDefault();
          return;
        }
        e.preventDefault();
        if (isHoveringSpeedBtn) {
          const step = e.shiftKey ? SPEED_STEP_FINE : SPEED_STEP;
          applySpeed(targetSpeed + (e.deltaY > 0 ? -step : step));
        } else {
          applyVolume(targetVolume + (e.deltaY > 0 ? -0.05 : 0.05));
        }
      }, { passive: false });

      // Stats for Nerds Toggle
      let isStatsOpen = false;

      const statsBtn = Object.assign(document.createElement("button"), {
        id: "custom-stats-btn",
        title: "Stats for Nerds (Shift+S)",
        textContent: "Stats",
      });

      const toggleStats = () => {
        const p = getPlayer();
        if (!p) return;
        if (isStatsOpen && p.hideVideoInfo) {
          p.hideVideoInfo();
          isStatsOpen = false;
        } else if (p.showVideoInfo) {
          p.showVideoInfo();
          isStatsOpen = true;
        }
        statsBtn.classList.toggle("active", isStatsOpen);
      };

      statsBtn.addEventListener("click", toggleStats);

      // Playback Speed Controls
      const SPEED_MIN = 0.25;
      const SPEED_MAX = 2;
      const SPEED_STEP = 0.1;
      const SPEED_STEP_FINE = 0.05;
      const SPEED_DEFAULT = 1;
      let targetSpeed = Math.round((video.playbackRate || SPEED_DEFAULT) * 100) / 100;

      const speedBtn = Object.assign(document.createElement("button"), {
        id: "custom-speed-btn",
        title: "Playback Speed (slower , or . faster) or scroll wheel. Hold Shift for 0.05x fine adjustment.",
        textContent: targetSpeed + "x",
      });

      const applySpeed = (rate) => {
        targetSpeed = Math.round(Math.min(SPEED_MAX, Math.max(SPEED_MIN, rate)) * 100) / 100;
        if (video.playbackRate !== targetSpeed) video.playbackRate = targetSpeed;

        const text = targetSpeed + "x";
        if (speedBtn.textContent !== text) {
          speedBtn.textContent = text;
          speedBtn.classList.toggle("modified", targetSpeed !== 1);
        }
        showSpeedOverlay(targetSpeed);
      };

      speedBtn.addEventListener("click", (e) => {
        const step = e.shiftKey ? SPEED_STEP_FINE : SPEED_STEP;
        const nextSpeed = targetSpeed + step;
        applySpeed(nextSpeed > SPEED_MAX ? SPEED_MIN : nextSpeed);
      });

      speedBtn.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        applySpeed(SPEED_DEFAULT);
      });

      speedBtn.addEventListener("mouseenter", () => { isHoveringSpeedBtn = true; });
      speedBtn.addEventListener("mouseleave", () => { isHoveringSpeedBtn = false; });

      // Screenshot (Snap)
      const screenshotBtn = Object.assign(document.createElement("button"), {
        id: "custom-screenshot-btn",
        title: "Take Screenshot (Ctrl+Click to save locally)",
        textContent: "📷 Snap",
      });

      screenshotBtn.addEventListener("click", (e) => {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext("2d", { alpha: false }).drawImage(video, 0, 0);

        const timeMs = Math.floor(video.currentTime * 1000);
        const mins = Math.floor(timeMs / 60000).toString().padStart(2, '0');
        const secs = Math.floor((timeMs % 60000) / 1000).toString().padStart(2, '0');
        const ms = (timeMs % 1000).toString().padStart(3, '0');

        let author = "YouTube";
        const p = getPlayer();
        if (p && typeof p.getVideoData === 'function') {
          const data = p.getVideoData();
          if (data && data.author) {
            author = data.author.replace(/[<>:"/\\|?*\x00-\x1F]/g, '').trim();
          }
        }

        canvas.toBlob((blob) => {
          if (!blob) return;

          if (e.ctrlKey) {
            const objUrl = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = objUrl;
            a.download = `${author}_${mins}-${secs}-${ms}.png`;
            a.click();
            URL.revokeObjectURL(objUrl);
          }

          if (navigator.clipboard) {
            if (typeof ClipboardItem !== "undefined") {
              navigator.clipboard.write([new ClipboardItem({ "image/png": blob })])
                .then(() => {
                  screenshotBtn.textContent = e.ctrlKey ? "✅ Saved & Copied!" : "✅ Copied!";
                  setTimeout(() => { screenshotBtn.textContent = "📷 Snap"; }, 1500);
                })
                .catch((err) => {
                  console.error("Clipboard copy failed:", err);
                  screenshotBtn.textContent = "❌ Copy Err";
                  setTimeout(() => { screenshotBtn.textContent = "📷 Snap"; }, 1500);
                });
            } else {
              console.warn("ClipboardItem not supported in this browser.");
              if (!e.ctrlKey) {
                screenshotBtn.textContent = "❌ Not Supported";
                setTimeout(() => { screenshotBtn.textContent = "📷 Snap"; }, 1500);
              }
            }
          }
        }, "image/png");
      });

      // Picture-in-Picture (PiP)
      const pipSupported = document.pictureInPictureEnabled && typeof video.requestPictureInPicture === "function";

      const pipBtn = Object.assign(document.createElement("button"), {
        id: "custom-pip-btn",
        title: "Picture-in-Picture",
        textContent: "🔲 PiP",
      });

      if (pipSupported) {
        pipBtn.addEventListener("click", async () => {
          try {
            if (document.pictureInPictureElement) {
              await document.exitPictureInPicture();
            } else {
              await video.requestPictureInPicture();
            }
          } catch (err) {
            console.error("PiP failed:", err);
          }
        });
      } else {
        pipBtn.style.display = "none";
      }

      // Copy Video URL
      const urlBtn = Object.assign(document.createElement("button"), {
        id: "custom-url-btn",
        title: "Copy Video URL (Ctrl+Click for current time)",
        textContent: "🔗 URL",
      });

      urlBtn.addEventListener("click", async (e) => {
        try {
          let videoId = "";
          const p = getPlayer();
          if (p && typeof p.getVideoData === 'function') {
            const data = p.getVideoData();
            if (data && data.video_id) videoId = data.video_id;
          }
          if (!videoId) videoId = window.location.pathname.split('/').pop();

          let url = `https://youtu.be/${videoId}`;
          if (e.ctrlKey) url += `?t=${Math.floor(video.currentTime)}`;

          if (navigator.clipboard) {
            await navigator.clipboard.writeText(url);
            urlBtn.textContent = "✅ Copied!";
            setTimeout(() => { urlBtn.textContent = "🔗 URL"; }, 1500);
          }
        } catch (err) {
          console.error("Copy URL failed:", err);
        }
      });

      // Save to Watch Later (WL)
      const wlBtn = Object.assign(document.createElement("button"), {
        id: "custom-wl-btn",
        title: "Save to Watch Later",
        textContent: "🕒 WL",
      });

      let cachedApiKey = null;
      let cachedContext = null;

      try {
        if (typeof GM_getValue === 'function') {
          const stored = GM_getValue('ytee-innertube', null);
          if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed.apiKey && parsed.context) {
              cachedApiKey = parsed.apiKey;
              cachedContext = parsed.context;
            }
          }
        }
      } catch (e) { console.warn('InnerTube cache read failed', e); }

      const sha1 = async (str) => {
        const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(str));
        return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
      };

      const getSapisid = () => {
        const m = document.cookie.match(/(?:^|;\s*)(?:__Secure-3PAPISID|SAPISID)=([^;]+)/);
        return m ? m[1] : null;
      };

      const getInnertubeConfig = async (videoId) => {
        if (cachedApiKey && cachedContext) return { apiKey: cachedApiKey, context: cachedContext };

        const uw = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
        const localYtcfg = uw.ytcfg || (uw.yt && uw.yt.config_);
        if (localYtcfg && localYtcfg.get) {
          const key = localYtcfg.get("INNERTUBE_API_KEY");
          const ctx = localYtcfg.get("INNERTUBE_CONTEXT");
          if (key && ctx) {
            cachedApiKey = key;
            cachedContext = ctx;
            try {
              if (typeof GM_setValue === 'function') {
                GM_setValue('ytee-innertube', JSON.stringify({ apiKey: key, context: ctx }));
              }
            } catch (e) { }
            return { apiKey: key, context: ctx };
          }
        }

        return new Promise((resolve, reject) => {
          if (typeof GM_xmlhttpRequest === "undefined") return reject(new Error("GM_xmlhttpRequest unavailable"));
          GM_xmlhttpRequest({
            method: "GET",
            url: `https://www.youtube.com/watch?v=${videoId}`,
            headers: { "Accept-Language": navigator.language || "en-US,en;q=0.9" },
            onload: (res) => {
              const m = res.responseText.match(/ytcfg\.set\s*\(({[\s\S]+?})\s*\)\s*;/);
              if (!m) return reject(new Error("ytcfg block not found in watch page"));
              try {
                const cfg = JSON.parse(m[1]);
                if (!cfg.INNERTUBE_API_KEY) return reject(new Error("INNERTUBE_API_KEY missing"));
                cachedApiKey = cfg.INNERTUBE_API_KEY;
                cachedContext = cfg.INNERTUBE_CONTEXT;
                try {
                  if (typeof GM_setValue === 'function') {
                    GM_setValue('ytee-innertube', JSON.stringify({ apiKey: cachedApiKey, context: cachedContext }));
                  }
                } catch (e) { }
                resolve({ apiKey: cachedApiKey, context: cachedContext });
              } catch (e) { reject(e); }
            },
            onerror: () => reject(new Error("Network error fetching watch page")),
          });
        });
      };

      wlBtn.addEventListener("click", async (e) => {
        try {
          wlBtn.textContent = "⏳...";

          let videoId = "";
          const p = getPlayer();
          if (p && typeof p.getVideoData === 'function') {
            const data = p.getVideoData();
            if (data && data.video_id) videoId = data.video_id;
          }
          if (!videoId) videoId = window.location.pathname.split('/').pop();

          if (!videoId) {
            wlBtn.textContent = "❌ Err";
            setTimeout(() => { wlBtn.textContent = "🕒 WL"; }, 1500);
            return;
          }

          const sapisid = getSapisid();
          if (!sapisid) {
            wlBtn.textContent = "❌ Login";
            setTimeout(() => { wlBtn.textContent = "🕒 WL"; }, 1500);
            return;
          }

          const { apiKey, context } = await getInnertubeConfig(videoId);

          const ts = Math.floor(Date.now() / 1000);
          const hashStr = await sha1(`${ts} ${sapisid} https://www.youtube.com`);
          const sapisidHash = `${ts}_${hashStr}`;

          const payload = {
            context,
            playlistId: "WL",
            actions: [{ addedVideoId: videoId, action: "ACTION_ADD_VIDEO" }]
          };

          const doRequest = () => new Promise((resolve, reject) => {
            if (typeof GM_xmlhttpRequest !== "undefined") {
              GM_xmlhttpRequest({
                method: "POST",
                url: `https://www.youtube.com/youtubei/v1/browse/edit_playlist?key=${apiKey}&prettyPrint=false`,
                headers: {
                  "Content-Type": "application/json",
                  "X-Origin": "https://www.youtube.com",
                  "X-Goog-AuthUser": "0",
                  "Authorization": `SAPISIDHASH ${sapisidHash}`
                },
                data: JSON.stringify(payload),
                onload: (res) => {
                  if (res.status === 200) resolve();
                  else reject(new Error(`HTTP ${res.status}`));
                },
                onerror: () => reject(new Error("Network error"))
              });
            } else {
              console.warn("YTEE: GM_xmlhttpRequest unavailable, Watch Later will likely fail due to CORS.");
              reject(new Error("GM_xmlhttpRequest required for cross-origin Watch Later"));
            }
          });

          await doRequest();

          wlBtn.textContent = "✅ Saved";
          setTimeout(() => { wlBtn.textContent = "🕒 WL"; }, 1500);
        } catch (err) {
          console.error("Watch Later failed:", err);
          wlBtn.textContent = "❌ Err";
          setTimeout(() => { wlBtn.textContent = "🕒 WL"; }, 1500);
        }
      });

      // Settings
      const settingsBtn = Object.assign(document.createElement("button"), {
        id: "custom-settings-btn",
        title: "Settings",
        textContent: "⚙️",
      });

      const settingsModal = document.createElement("div");
      settingsModal.id = "custom-settings-modal";
      let isSettingsOpen = false;

      const settingsContent = document.createElement("div");
      settingsContent.id = "custom-settings-content";

      const settingsTitle = document.createElement("h2");
      settingsTitle.textContent = "Settings";

      const settingsItems = document.createElement("div");
      settingsItems.id = "custom-settings-items";

      const settingsButtons = document.createElement("div");
      settingsButtons.id = "custom-settings-buttons";

      const restoreBtn = document.createElement("button");
      restoreBtn.id = "custom-settings-restore";
      restoreBtn.textContent = "Restore defaults";

      const cancelBtn = document.createElement("button");
      cancelBtn.id = "custom-settings-cancel";
      cancelBtn.textContent = "Cancel";

      const saveBtn = document.createElement("button");
      saveBtn.id = "custom-settings-save";
      saveBtn.textContent = "Save";

      settingsButtons.appendChild(restoreBtn);
      settingsButtons.appendChild(cancelBtn);
      settingsButtons.appendChild(saveBtn);

      settingsContent.appendChild(settingsTitle);
      settingsContent.appendChild(settingsItems);
      settingsContent.appendChild(settingsButtons);

      settingsModal.appendChild(settingsContent);
      document.body.appendChild(settingsModal);

      const showSettingsModal = () => {
        const items = settingsItems;
        while (items.firstChild) {
          items.removeChild(items.firstChild);
        }

        const sectionTitle1 = document.createElement('h3');
        sectionTitle1.className = 'setting-section-title';
        sectionTitle1.textContent = 'Button visibility';
        items.appendChild(sectionTitle1);

        const buttonNames = {
          wl: 'Watch Later',
          url: 'Copy URL',
          screenshot: 'Screenshot',
          pip: 'Picture-in-Picture (Firefox unsupported)',
          speed: 'Playback Speed',
          stats: 'Stats for Nerds',
        };

        Object.keys(buttonNames).forEach(key => {
          const div = document.createElement('div');
          div.className = 'setting-item';

          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.id = `btn-${key}`;
          checkbox.checked = currentSettings.buttons[key];

          const label = document.createElement('label');
          label.htmlFor = `btn-${key}`;
          label.textContent = buttonNames[key];

          div.appendChild(checkbox);
          div.appendChild(label);
          items.appendChild(div);
        });

        const hotkeyNames = {
          toggleMute: 'Toggle Mute',
          toggleStats: 'Toggle Stats',
          increaseSpeed: 'Increase Speed',
          decreaseSpeed: 'Decrease Speed',
          volumeUp: 'Volume Up',
          volumeDown: 'Volume Down',
        };

        const sectionTitle2 = document.createElement('h3');
        sectionTitle2.className = 'setting-section-title';
        sectionTitle2.textContent = 'Hotkeys';
        items.appendChild(sectionTitle2);

        Object.keys(hotkeyNames).forEach(key => {
          const div = document.createElement('div');
          div.className = 'setting-item';

          const input = document.createElement('input');
          input.type = 'text';
          input.id = `hk-${key}`;
          input.value = currentSettings.hotkeys[key];
          input.className = 'hk-input';
          input.addEventListener('blur', () => {
            input.value = sanitizeHotkeyInput(input.value);
          });

          const label = document.createElement('label');
          label.htmlFor = `hk-${key}`;
          label.textContent = hotkeyNames[key];

          div.appendChild(label);
          div.appendChild(input);
          items.appendChild(div);
        });

        settingsModal.classList.add('show');
        isSettingsOpen = true;
      };

      const hideSettingsModal = () => {
        settingsModal.classList.remove('show');
        isSettingsOpen = false;
      };

      settingsBtn.addEventListener('click', showSettingsModal);

      cancelBtn.addEventListener('click', hideSettingsModal);

      restoreBtn.addEventListener('click', () => {
        currentSettings = JSON.parse(JSON.stringify(defaultSettings));
        if (settingsModal.classList.contains('show')) {
          showSettingsModal();
        }
        restoreBtn.textContent = 'Restored!';
        restoreBtn.disabled = true;
        setTimeout(() => {
          restoreBtn.textContent = 'Restore defaults';
          restoreBtn.disabled = false;
        }, 1000);
      });

      saveBtn.addEventListener('click', () => {
        const newSettings = { buttons: {}, hotkeys: {} };

        Object.keys(currentSettings.buttons).forEach(key => {
          newSettings.buttons[key] = document.getElementById(`btn-${key}`).checked;
        });

        Object.keys(currentSettings.hotkeys).forEach(key => {
          newSettings.hotkeys[key] = sanitizeHotkeyInput(document.getElementById(`hk-${key}`).value);
        });

        currentSettings = newSettings;
        saveSettings();
        buildHotkeyMap();

        saveBtn.textContent = 'Saved';
        saveBtn.disabled = true;
        updateButtonVisibility();

        setTimeout(() => {
          hideSettingsModal();
          saveBtn.textContent = 'Save';
          saveBtn.disabled = false;
        }, 350);
      });

      const updateButtonVisibility = () => {
        const buttonMap = {
          wl: wlBtn,
          url: urlBtn,
          screenshot: screenshotBtn,
          pip: pipBtn,
          speed: speedBtn,
          stats: statsBtn,
        };

        muteBtn.style.display = '';
        vol.style.display = '';

        Object.keys(buttonMap).forEach(key => {
          if (currentSettings.buttons[key]) {
            buttonMap[key].style.display = '';
          } else {
            buttonMap[key].style.display = 'none';
          }
        });
      };

      // Hotkeys
      const SHIFTED_SYMBOL_EQUIVALENTS = {
        '>': '.',
        '<': ',',
        '?': '/',
        ':': ';',
        '"': "'",
        '{': '[',
        '}': ']',
        '|': '\\',
        '_': '-',
        '+': '=',
        '!': '1',
        '@': '2',
        '#': '3',
        '$': '4',
        '%': '5',
        '^': '6',
        '&': '7',
        '*': '8',
        '(': '9',
        ')': '0',
        '~': '`',
      };

      const sanitizeHotkeyInput = (value) => {
        if (!value || typeof value !== 'string') return '';
        let cleaned = value.trim().toLowerCase().replace(/\s*\+\s*/g, '+');
        const parts = cleaned.split('+').filter(Boolean);
        const modifiers = [];
        let key = '';

        parts.forEach(part => {
          if (part === 'shift' || part === 'ctrl' || part === 'alt') {
            if (!modifiers.includes(part)) modifiers.push(part);
          } else if (!key) {
            key = part;
          }
        });

        if (SHIFTED_SYMBOL_EQUIVALENTS[key]) {
          key = SHIFTED_SYMBOL_EQUIVALENTS[key];
          if (modifiers.includes('shift')) {
            modifiers.splice(modifiers.indexOf('shift'), 1);
          }
        }

        if (!key) return '';
        return [...modifiers, key].join('+');
      };

      const normalizeHotkey = (hk) => {
        const sanitized = sanitizeHotkeyInput(hk);
        const parts = sanitized.split('+').filter(Boolean);
        const modifiers = {};
        let key = '';
        parts.forEach(part => {
          if (part === 'shift' || part === 'ctrl' || part === 'alt') {
            modifiers[part] = true;
          } else {
            key = part;
          }
        });
        return { key, modifiers };
      };

      const getHotkeyCombos = ({ key, modifiers }) => {
        const combos = [];
        const canonical = `${modifiers.shift ? 'shift+' : ''}${modifiers.ctrl ? 'ctrl+' : ''}${modifiers.alt ? 'alt+' : ''}${key}`;
        combos.push(canonical);

        if (key === '>' && !modifiers.shift) combos.push('shift+.');
        if (key === '<' && !modifiers.shift) combos.push('shift+,');
        if (key === '.' && modifiers.shift) combos.push('>');
        if (key === ',' && modifiers.shift) combos.push('<');

        return combos.filter(Boolean);
      };

      const hotkeyMap = {};
      const buildHotkeyMap = () => {
        Object.keys(hotkeyMap).forEach(k => delete hotkeyMap[k]);
        Object.keys(currentSettings.hotkeys).forEach(action => {
          const comboData = normalizeHotkey(currentSettings.hotkeys[action]);
          getHotkeyCombos(comboData).forEach(combo => {
            hotkeyMap[combo] = action;
          });
        });
      };

      buildHotkeyMap();

      window.addEventListener("keydown", (e) => {
        if (isSettingsOpen) return;
        const rawKey = e.key.toLowerCase();
        const isShiftedSymbol = e.shiftKey && e.key.length === 1 && e.key !== e.key.toLowerCase() && !/[a-z]/i.test(e.key);
        const combo = `${e.shiftKey && !isShiftedSymbol ? 'shift+' : ''}${e.ctrlKey ? 'ctrl+' : ''}${e.altKey ? 'alt+' : ''}${rawKey}`;
        const action = hotkeyMap[combo];
        if (action) {
          e.stopImmediatePropagation();
          e.preventDefault();
          switch (action) {
            case 'toggleMute':
              toggleMute();
              break;
            case 'toggleStats':
              toggleStats();
              break;
            case 'increaseSpeed':
              applySpeed(targetSpeed + (e.shiftKey ? SPEED_STEP_FINE : SPEED_STEP));
              break;
            case 'decreaseSpeed':
              applySpeed(targetSpeed - (e.shiftKey ? SPEED_STEP_FINE : SPEED_STEP));
              break;
            case 'volumeUp':
              applyVolume(targetVolume + 0.05);
              break;
            case 'volumeDown':
              applyVolume(targetVolume - 0.05);
              break;
          }
          showControls();
        }
      }, true);

      const btnGroup = document.createElement("div");
      btnGroup.id = "custom-btn-group";
      btnGroup.append(wlBtn, urlBtn, screenshotBtn, pipBtn, speedBtn, statsBtn, settingsBtn);
      updateButtonVisibility();

      let isHoveringBtnGroup = false;
      btnGroup.addEventListener("mouseenter", () => { isHoveringBtnGroup = true; });
      btnGroup.addEventListener("mouseleave", () => { isHoveringBtnGroup = false; });

      // UI Auto-hide
      const ALL_CONTROLS = [muteBtn, vol, btnGroup];
      let controlsTimeout;
      let controlsVisible = false;
      let lastInteractionTime = 0;

      const checkHideControls = () => {
        const idleTime = Date.now() - lastInteractionTime;
        if (idleTime >= 2000 && !isHoveringBtnGroup) {
          controlsVisible = false;
          ALL_CONTROLS.forEach(el => el.classList.remove("show"));
        } else {
          controlsTimeout = setTimeout(checkHideControls, 2000);
        }
      };

      const showControls = () => {
        lastInteractionTime = Date.now();
        if (!controlsVisible) {
          controlsVisible = true;
          ALL_CONTROLS.forEach(el => el.classList.add("show"));
          clearTimeout(controlsTimeout);
          controlsTimeout = setTimeout(checkHideControls, 2000);
        }
      };

      let rafPending = false;
      window.addEventListener("mousemove", () => {
        if (rafPending) return;
        rafPending = true;
        requestAnimationFrame(() => {
          showControls();
          rafPending = false;
        });
      });
      showControls();

      window.addEventListener("dblclick", (e) => {
        if (isSettingsOpen) return;
        if (e.target.closest("#custom-btn-group, #custom-mute-btn, #custom-vol-slider")) return;

        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => { });
        } else if (document.exitFullscreen) {
          document.exitFullscreen();
        }
      });

      document.body.prepend(volPct, speedOverlay, vol, muteBtn, btnGroup);

      if (typeof GM_addValueChangeListener === 'function') {
        GM_addValueChangeListener('ytee-settings', (name, oldVal, newVal, remote) => {
          if (remote) {
            try {
              currentSettings = typeof newVal === 'string' ? JSON.parse(newVal) : newVal;
              if (typeof updateButtonVisibility === 'function') updateButtonVisibility();
              if (typeof buildHotkeyMap === 'function') buildHotkeyMap();
            } catch (e) { console.warn('Failed to sync settings', e); }
          }
        });
      }
    });

  }
})();