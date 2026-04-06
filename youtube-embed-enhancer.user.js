// ==UserScript==
// @name         YouTube Embed Enhancer
// @namespace    https://github.com/jmpatag
// @version      1.4.0
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


  // Inject custom controls tightly if natively disabled via URL parameters (controls=0),
  // or as a fallback if the standard player UI simply fails to render into the DOM.
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
          #custom-vol-slider,
          #custom-stats-btn,
          #custom-speed-btn {
            z-index: 9999;
            position: fixed;

            color: white;
            line-height: 1;
            text-shadow: 0 1px 3px rgba(0, 0, 0, 0.7);
            background: none;
            border: none;
          }

          #custom-stats-btn,
          #custom-speed-btn {
            bottom: 18px;

            padding: 5px 12px;
            font-size: 13px;
            font-family: monospace;
            font-weight: bold;
            letter-spacing: 0.04em;
            color: rgba(255, 255, 255, 0.9);
            background: rgba(0, 0, 0, 0.5) !important;
            border: 1px solid rgba(255, 255, 255, 0.35) !important;
            border-radius: 5px;

            cursor: pointer;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.3s, background 0.15s, transform 0.1s;
            will-change: opacity;
          }

          #custom-stats-btn {
            right: 18px;
          }

          #custom-speed-btn {
            right: 80px;
          }

          #custom-stats-btn.show,
          #custom-speed-btn.show {
            opacity: 1;
            pointer-events: auto;
          }

          #custom-stats-btn.show:hover,
          #custom-speed-btn.show:hover {
            background: rgba(255, 255, 255, 0.18) !important;
            transform: scale(1.05);
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


    const video = document.querySelector("video");

    let targetVolume = video.volume;
    let targetMuted = video.muted;

    const originalVolume = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'volume');
    const originalMuted = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'muted');
    let isScriptChange = false;

    Object.defineProperty(video, 'volume', {
      get() { return originalVolume.get.call(this); },
      set(newVol) {
        if (!isScriptChange) return;
        originalVolume.set.call(this, newVol);
      }
    });

    Object.defineProperty(video, 'muted', {
      get() { return originalMuted.get.call(this); },
      set(newMuted) {
        if (!isScriptChange) return;
        originalMuted.set.call(this, newMuted);
      }
    });

    const setVideoVolume = (v) => { isScriptChange = true; video.volume = v; isScriptChange = false; };
    const setVideoMuted = (m) => { isScriptChange = true; video.muted = m; isScriptChange = false; };

    // Apply a volume change using targetVolume as the source of truth.
    const applyVolume = (newVol) => {
      targetVolume = Math.min(1, Math.max(0, Math.round(newVol * 100) / 100));
      targetMuted = targetVolume === 0;
      // Single muted call covers both mute and unmute.
      setVideoMuted(targetMuted);
      setVideoVolume(targetVolume);
      showVolumePercent(targetMuted ? 0 : targetVolume);
    };

    // Shared mute toggle — avoids a synthetic DOM click event.
    const toggleMute = () => {
      targetMuted = !video.muted;
      setVideoMuted(targetMuted);
      muteBtn.classList.toggle("muted", video.muted);
      showVolumePercent(video.muted ? 0 : targetVolume);
    };

    // Volume overlay UI
    const volPct = Object.assign(document.createElement("div"), {
      id: "custom-vol-overlay"
    });
    let volTimeout;
    const showVolumePercent = (volume) => {
      volPct.textContent = Math.round(volume * 100) + "%";
      volPct.classList.add("show");
      clearTimeout(volTimeout);
      volTimeout = setTimeout(() => volPct.classList.remove("show"), 1500);
    };

    // Speed overlay UI
    const speedOverlay = Object.assign(document.createElement("div"), {
      id: "custom-speed-overlay"
    });
    let speedTimeout;
    const showSpeedOverlay = (rate) => {
      speedOverlay.textContent = rate + "x";
      speedOverlay.classList.add("show");
      clearTimeout(speedTimeout);
      speedTimeout = setTimeout(() => speedOverlay.classList.remove("show"), 1500);
    };


    // Mute button.
    const muteBtn = Object.assign(document.createElement("button"), {
      id: "custom-mute-btn",
    });

    muteBtn.addEventListener("click", toggleMute);

    // Volume slider.
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

    // Sync slider and mute icon on any external volumechange.
    // Guard with isScriptChange so our own writes don't trigger unnecessary DOM updates.
    video.addEventListener("volumechange", () => {
      if (isScriptChange) return;
      muteBtn.classList.toggle("muted", video.muted);
      vol.value = video.muted ? 0 : video.volume;
    });

    // Mouse wheel: scroll on speed button → change speed; anywhere else → change volume.
    let isHoveringSpeedBtn = false;

    window.addEventListener("wheel", (e) => {
      e.preventDefault();
      if (isHoveringSpeedBtn) {
        applySpeed(speedIndex + (e.deltaY > 0 ? -1 : 1));
      } else {
        applyVolume(targetVolume + (e.deltaY > 0 ? -0.05 : 0.05));
      }
    }, { passive: false });

    // Stats for nerds toggle (Shift + S or stats button)
    let isStatsOpen = false;

    // Cache player element once — it never changes after load.
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

    // Playback speed (< / > keys, or speed button)
    const SPEED_STEPS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
    const SPEED_LAST_INDEX = SPEED_STEPS.length - 1;
    const SPEED_DEFAULT_INDEX = 3; // index of 1x — compile-time constant
    let speedIndex = SPEED_DEFAULT_INDEX;

    const speedBtn = Object.assign(document.createElement("button"), {
      id: "custom-speed-btn",
      title: "Playback Speed (< slower / > faster) or scroll wheel",
      textContent: "1x",
    });

    const applySpeed = (index) => {
      speedIndex = Math.max(0, Math.min(SPEED_LAST_INDEX, index));
      const rate = SPEED_STEPS[speedIndex];
      video.playbackRate = rate;
      speedBtn.textContent = rate + "x";
      speedBtn.classList.toggle("modified", rate !== 1);
      showSpeedOverlay(rate);
    };

    speedBtn.addEventListener("click", () => {
      // Cycle forward; wrap back to 0 after the last step
      applySpeed(speedIndex < SPEED_LAST_INDEX ? speedIndex + 1 : 0);
    });

    // Reset to 1x on right-click
    speedBtn.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      applySpeed(SPEED_DEFAULT_INDEX);
    });

    // Track hover so the wheel handler knows which mode to use
    speedBtn.addEventListener("mouseenter", () => { isHoveringSpeedBtn = true; });
    speedBtn.addEventListener("mouseleave", () => { isHoveringSpeedBtn = false; });

    // Merged keydown handler — one listener, covers all shortcuts + triggers showControls.
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
      // Always show controls on any keypress (passive keydown listener removed).
      showControls();
    }, true);

    // Auto-hide controls logic.
    // mousemove throttle: only reset the hide-timer at most once per animation frame.
    const ALL_CONTROLS = [muteBtn, vol, statsBtn, speedBtn];
    let controlsTimeout;
    let controlsVisible = false;
    let rafPending = false;

    const hideControls = () => {
      controlsVisible = false;
      ALL_CONTROLS.forEach(el => el.classList.remove("show"));
    };
    const showControls = () => {
      if (!controlsVisible) {
        controlsVisible = true;
        ALL_CONTROLS.forEach(el => el.classList.add("show"));
      }
      clearTimeout(controlsTimeout);
      controlsTimeout = setTimeout(hideControls, 2000);
    };
    const onMouseMove = () => {
      if (rafPending) return;
      rafPending = true;
      requestAnimationFrame(() => {
        rafPending = false;
        showControls();
      });
    };

    window.addEventListener("mousemove", onMouseMove);
    // wheel already calls showControls() inline via the wheel handler above.
    showControls(); // Show immediately on load

    // Double click to fullscreen
    window.addEventListener("dblclick", (e) => {
      if (e.target.closest("#custom-mute-btn, #custom-vol-slider, #custom-stats-btn, #custom-speed-btn")) return;

      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => { });
      } else if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    });

    // Add all elements.
    document.body.prepend(volPct, speedOverlay, vol, muteBtn, statsBtn, speedBtn);


  }
})();