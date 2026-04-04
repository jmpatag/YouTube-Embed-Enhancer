// ==UserScript==
// @name         YouTube Embed Enhancer
// @namespace    https://github.com/jmpatag
// @version      1.0.0
// @description  Enhances YouTube Embeds with custom volume controls, hotkeys, and some optimizations.
// @author       jmpatag
// @license      MIT
// @match        *://www.youtube.com/embed/*
// @match        *://www.youtube-nocookie.com/embed/*
// @run-at       document-idle
// ==/UserScript==

(() => {
  "use strict";


  if (!document.querySelector(".ytp-play-button")) {
    document.head.appendChild(
      Object.assign(document.createElement("style"), {
        textContent: `
          player-fullscreen-action-menu {
            display: none !important;
          }

          #custom-vol-overlay {
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
          }

          #custom-vol-overlay.show {
            opacity: 1;
            transition: opacity 0.1s;
          }


          #custom-mute-btn,
          #custom-vol-slider {
            z-index: 9999;
            position: fixed;

            color: white;
            line-height: 1;
            text-shadow: 0 1px 3px rgba(0, 0, 0, 0.7);
            background: none;
            border: none;
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
            bottom: 26px;
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
      get() {
        return originalVolume.get.call(this);
      },
      set(newVol) {
        if (!isScriptChange) return;
        originalVolume.set.call(this, newVol);
      }
    });

    Object.defineProperty(video, 'muted', {
      get() {
        return originalMuted.get.call(this);
      },
      set(newMuted) {
        if (!isScriptChange) return;
        originalMuted.set.call(this, newMuted);
      }
    });

    const setVideoVolume = (v) => { isScriptChange = true; video.volume = v; isScriptChange = false; };
    const setVideoMuted = (m) => { isScriptChange = true; video.muted = m; isScriptChange = false; };

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


    // Mute button.
    const muteBtn = Object.assign(document.createElement("button"), {
      id: "custom-mute-btn",
    });

    muteBtn.addEventListener("click", () => {
      targetMuted = !video.muted;
      setVideoMuted(targetMuted);
      muteBtn.classList.toggle("muted", video.muted);
      showVolumePercent(video.muted ? 0 : targetVolume);
    });

    video.addEventListener("volumechange", () => {
      muteBtn.classList.toggle("muted", video.muted);
    });

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
      targetVolume = Number(vol.value);
      targetMuted = targetVolume === 0;
      if (targetMuted) setVideoMuted(true);
      setVideoVolume(targetVolume);
      if (!targetMuted) setVideoMuted(false);
      showVolumePercent(targetMuted ? 0 : targetVolume);
    });

    // Mouse wheel volume anywhere on the player.
    window.addEventListener("wheel", (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.05 : 0.05;
      targetVolume = Math.min(1, Math.max(0, Math.round((video.volume + delta) * 100) / 100));
      targetMuted = targetVolume === 0;
      if (targetMuted) setVideoMuted(true);
      setVideoVolume(targetVolume);
      if (!targetMuted) setVideoMuted(false);
      showVolumePercent(targetMuted ? 0 : targetVolume);
    }, { passive: false });

    // Volume control by arrow keys.
    window.addEventListener(
      "keydown",
      function (e) {
        if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
        e.stopImmediatePropagation();
        e.preventDefault();
        targetVolume = Math.min(
          1,
          Math.max(0, Math.round((video.volume + (e.key === "ArrowUp" ? 0.05 : -0.05)) * 100) / 100),
        );
        targetMuted = targetVolume === 0;
        if (targetMuted) setVideoMuted(true);
        setVideoVolume(targetVolume);
        if (!targetMuted) setVideoMuted(false);
        showVolumePercent(targetMuted ? 0 : targetVolume);
      },
      true,
    );

    // Stats for nerds toggle (Shift + S)
    let isStatsOpen = false;
    window.addEventListener(
      "keydown",
      function (e) {
        if (e.key === "S" && e.shiftKey) {
          e.stopImmediatePropagation();
          e.preventDefault();
          const player = document.getElementById("movie_player") || document.querySelector(".html5-video-player");
          if (player) {
            if (isStatsOpen && player.hideVideoInfo) {
              player.hideVideoInfo();
              isStatsOpen = false;
            } else if (player.showVideoInfo) {
              player.showVideoInfo();
              isStatsOpen = true;
            }
          }
        }
      },
      true
    );

    // Update slider and mute icon.
    video.addEventListener("volumechange", () => {
      muteBtn.classList.toggle("muted", video.muted);
      vol.value = video.muted ? 0 : video.volume;
    });

    // Auto-hide controls logic
    let controlsTimeout;
    const hideControls = () => {
      muteBtn.classList.remove("show");
      vol.classList.remove("show");
    };
    const showControls = () => {
      muteBtn.classList.add("show");
      vol.classList.add("show");
      clearTimeout(controlsTimeout);
      controlsTimeout = setTimeout(hideControls, 2000);
    };

    window.addEventListener("mousemove", showControls);
    window.addEventListener("keydown", showControls, { passive: true });
    window.addEventListener("wheel", showControls, { passive: true });
    showControls(); // Show immediately on load

    // Add all elements.
    document.body.prepend(volPct, vol, muteBtn);


  }
})();
