// ==UserScript==
// @name         YouTube Embed Enhancer
// @namespace    https://github.com/jmpatag
// @version      1.5.2
// @description  Enhances YouTube Embeds with custom volume controls, hotkeys, and some optimizations.
// @author       jmpatag
// @license      MIT
// @match        *://www.youtube.com/embed/*
// @match        *://www.youtube-nocookie.com/embed/*
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/jmpatag/YouTube-Embed-Enhancer/main/youtube-embed-enhancer.user.js
// @downloadURL  https://raw.githubusercontent.com/jmpatag/YouTube-Embed-Enhancer/main/youtube-embed-enhancer.user.js
// ==/UserScript==

(() => {
  "use strict";


  // Initialize only if native controls are disabled or missing
  const isControlsDisabled = new URLSearchParams(window.location.search).get("controls") === "0";
  const isPlayButtonMissing = !document.querySelector(".ytp-play-button");

  if (isControlsDisabled || isPlayButtonMissing) {
    document.head.appendChild(
      Object.assign(document.createElement("style"), {
        textContent: `
          player-fullscreen-action-menu {
            display: none !important;
          }

          #custom-vol-overlay,
          #custom-speed-overlay {
            position: fixed;
            top: 140px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.7);
            color: white;
            padding: 10px 20px;
            border-radius: 6px;
            font-size: 18px;
            font-family: sans-serif;
            font-weight: bold;
            z-index: 9999;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.3s;
            will-change: opacity;
          }

          #custom-vol-overlay.show,
          #custom-speed-overlay.show {
            opacity: 1;
            transition: opacity 0.1s;
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
            transition: opacity 0.3s;
            will-change: opacity;
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
          #custom-url-btn {
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
          #custom-url-btn {
            padding: 5px 12px;
            font-size: 13px;
            font-family: monospace;
            font-weight: bold;
            letter-spacing: 0.04em;
            color: rgba(255, 255, 255, 0.9);
            background: rgba(0, 0, 0, 0.5) !important;
            border: 1px solid rgba(255, 255, 255, 0.35) !important;
            border-radius: 0px;
            margin-left: -1px;

            cursor: pointer;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.3s, background 0.15s, transform 0.1s;
            /* No will-change: parent #custom-btn-group is already composited. */
          }

          #custom-url-btn {
            border-top-left-radius: 5px !important;
            border-bottom-left-radius: 5px !important;
            margin-left: 0;
          }

          #custom-stats-btn {
            border-top-right-radius: 5px !important;
            border-bottom-right-radius: 5px !important;
          }

          #custom-btn-group.show button {
            opacity: 1;
            pointer-events: auto;
          }

          #custom-btn-group.show button:hover {
            background: rgba(255, 255, 255, 0.18) !important;
            transform: scale(1.05);
            z-index: 10;
          }

          #custom-stats-btn.active {
            color: #ffd700;
            border-color: rgba(255, 215, 0, 0.6) !important;
            background: rgba(255, 215, 0, 0.12) !important;
          }

          #custom-speed-btn.modified {
            color: #7df;
            border-color: rgba(119, 221, 255, 0.6) !important;
            background: rgba(119, 221, 255, 0.1) !important;
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
            transition: opacity 0.3s, transform 0.1s;
            will-change: opacity;
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
            transition: opacity 0.3s, width 0.2s;
            will-change: opacity;
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
            background: rgba(255, 255, 255, 0.4);
          }

          #custom-vol-slider::-moz-range-track {
            height: 4px;
            border-radius: 2px;
            background: rgba(255, 255, 255, 0.4);
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

    waitForVideo((video) => {

      let targetVolume = video.volume;
      let targetMuted = video.muted;

      const originalVolume = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'volume');
      const originalMuted = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'muted');
      let isScriptChange = false;

      Object.defineProperty(video, 'volume', {
        get() { return originalVolume.get.call(this); },
        set(newVol) {
          originalVolume.set.call(this, newVol);
        }
      });

      Object.defineProperty(video, 'muted', {
        get() { return originalMuted.get.call(this); },
        set(newMuted) {
          originalMuted.set.call(this, newMuted);
        }
      });

      const setVideoVolume = (v) => {
        isScriptChange = true;
        if (player && typeof player.setVolume === 'function') {
          player.setVolume(Math.round(v * 100));
        } else {
          video.volume = v;
        }
        isScriptChange = false;
      };
      const setVideoMuted = (m) => {
        isScriptChange = true;
        if (m && player && typeof player.mute === 'function') {
          player.mute();
        } else if (!m && player && typeof player.unMute === 'function') {
          player.unMute();
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
        e.preventDefault();
        if (isHoveringSpeedBtn) {
          applySpeed(speedIndex + (e.deltaY > 0 ? -1 : 1));
        } else {
          applyVolume(targetVolume + (e.deltaY > 0 ? -0.05 : 0.05));
        }
      }, { passive: false });

      // Stats for Nerds Toggle
      let isStatsOpen = false;
      const player = document.getElementById("movie_player") || document.querySelector(".html5-video-player");

      const statsBtn = Object.assign(document.createElement("button"), {
        id: "custom-stats-btn",
        title: "Stats for Nerds (Shift+S)",
        textContent: "Stats",
      });

      const toggleStats = () => {
        if (!player) return;
        if (isStatsOpen && player.hideVideoInfo) {
          player.hideVideoInfo();
          isStatsOpen = false;
        } else if (player.showVideoInfo) {
          player.showVideoInfo();
          isStatsOpen = true;
        }
        statsBtn.classList.toggle("active", isStatsOpen);
      };

      statsBtn.addEventListener("click", toggleStats);

      // Playback Speed Controls
      const SPEED_STEPS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
      const SPEED_LAST_INDEX = SPEED_STEPS.length - 1;
      const SPEED_DEFAULT_INDEX = 3; // 1x
      let speedIndex = SPEED_DEFAULT_INDEX;

      const speedBtn = Object.assign(document.createElement("button"), {
        id: "custom-speed-btn",
        title: "Playback Speed (slower < or > faster) or scroll wheel",
        textContent: "1x",
      });

      const applySpeed = (index) => {
        speedIndex = Math.max(0, Math.min(SPEED_LAST_INDEX, index));
        const rate = SPEED_STEPS[speedIndex];

        if (video.playbackRate !== rate) video.playbackRate = rate;

        const text = rate + "x";
        if (speedBtn.textContent !== text) {
          speedBtn.textContent = text;
          speedBtn.classList.toggle("modified", rate !== 1);
        }
        showSpeedOverlay(rate);
      };

      speedBtn.addEventListener("click", () => {
        applySpeed(speedIndex < SPEED_LAST_INDEX ? speedIndex + 1 : 0);
      });

      speedBtn.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        applySpeed(SPEED_DEFAULT_INDEX);
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

        canvas.toBlob((blob) => {
          if (!blob) return;

          if (e.ctrlKey) {
            const objUrl = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = objUrl;
            a.download = `Screenshot_${mins}-${secs}.png`;
            a.click();
            URL.revokeObjectURL(objUrl);
          }

          if (navigator.clipboard) {
            navigator.clipboard.write([new ClipboardItem({ "image/png": blob })])
              .then(() => {
                const orig = screenshotBtn.textContent;
                screenshotBtn.textContent = e.ctrlKey ? "✅ Saved & Copied!" : "✅ Copied!";
                setTimeout(() => { screenshotBtn.textContent = orig; }, 1500);
              })
              .catch((err) => console.error("Clipboard copy failed:", err));
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
          if (player && typeof player.getVideoData === 'function') {
            const data = player.getVideoData();
            if (data && data.video_id) videoId = data.video_id;
          }
          if (!videoId) videoId = window.location.pathname.split('/').pop();

          let url = `https://youtu.be/${videoId}`;
          if (e.ctrlKey) url += `?t=${Math.floor(video.currentTime)}`;

          if (navigator.clipboard) {
            await navigator.clipboard.writeText(url);
            const originalText = urlBtn.textContent;
            urlBtn.textContent = "✅ Copied!";
            setTimeout(() => { urlBtn.textContent = originalText; }, 1500);
          }
        } catch (err) {
          console.error("Copy URL failed:", err);
        }
      });

      // Hotkeys
      window.addEventListener("keydown", (e) => {
        switch (e.key) {
          case "ArrowUp":
          case "ArrowDown":
            e.stopImmediatePropagation();
            e.preventDefault();
            applyVolume(targetVolume + (e.key === "ArrowUp" ? 0.05 : -0.05));
            break;
          case "S":
            if (e.shiftKey) {
              e.stopImmediatePropagation();
              e.preventDefault();
              toggleStats();
            }
            break;
          case ">":
          case ".":
            e.stopImmediatePropagation();
            e.preventDefault();
            applySpeed(speedIndex + 1);
            break;
          case "<":
          case ",":
            e.stopImmediatePropagation();
            e.preventDefault();
            applySpeed(speedIndex - 1);
            break;
          case "m":
          case "M":
            e.stopImmediatePropagation();
            e.preventDefault();
            toggleMute();
            break;
        }
        showControls();
      }, true);

      const btnGroup = document.createElement("div");
      btnGroup.id = "custom-btn-group";
      btnGroup.append(urlBtn, screenshotBtn, pipBtn, speedBtn, statsBtn);

      // UI Auto-hide
      const ALL_CONTROLS = [muteBtn, vol, btnGroup];
      let controlsTimeout;
      let controlsVisible = false;
      let lastInteractionTime = 0;

      const checkHideControls = () => {
        const idleTime = Date.now() - lastInteractionTime;
        if (idleTime >= 2000) {
          controlsVisible = false;
          ALL_CONTROLS.forEach(el => el.classList.remove("show"));
        } else {
          controlsTimeout = setTimeout(checkHideControls, 2000 - idleTime);
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

      let lastMouseTime = 0;
      window.addEventListener("mousemove", () => {
        const now = Date.now();
        if (now - lastMouseTime < 100) return;
        lastMouseTime = now;
        showControls();
      });
      showControls();

      window.addEventListener("dblclick", (e) => {
        if (e.target.closest("#custom-btn-group, #custom-mute-btn, #custom-vol-slider")) return;

        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => { });
        } else if (document.exitFullscreen) {
          document.exitFullscreen();
        }
      });

      document.body.prepend(volPct, speedOverlay, vol, muteBtn, btnGroup);
    });

  }
})();