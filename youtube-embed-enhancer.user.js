// ==UserScript==
// @name         YouTube Embed Enhancer
// @namespace    https://github.com/jmpatag
// @version      2.1.0
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

  if (!isControlsDisabled && !isPlayButtonMissing) {
    console.log('YTEE: Normal controls detected, enhancing anyway.');
  }

  document.head.appendChild(
    Object.assign(document.createElement("style"), {
      textContent: `
:root {
  /* Styles */
  --ytee-ew: 800px;

  /* Sizing */
  --ytee-btn-size: clamp(27.5px, calc(var(--ytee-ew) * 0.04), 37.5px);
  --ytee-icon-size: clamp(15px, calc(var(--ytee-ew) * 0.0225), 21px);
  --ytee-font-size: clamp(11px,  calc(var(--ytee-ew) * 0.0175), 15px);
  --ytee-gap: clamp(2.5px,  calc(var(--ytee-ew) * 0.00375), 5px);

  --ytee-bg-dark: rgba(15, 15, 15, 0.75);
  --ytee-bg-medium: rgba(25, 25, 25, 0.65);
  --ytee-btn-bg: rgba(255,255,255,0.08);
  --ytee-btn-border: rgba(255,255,255,0.13);
  --ytee-btn-hover: rgba(255,255,255,0.19);
  --ytee-text: rgba(255,255,255,0.92);

  --ytee-stats-color: #ffd700;
  --ytee-stats-bg: rgba(255,215,0,0.14);
  --ytee-stats-border: rgba(255,215,0,0.55);

  --ytee-speed-color: #7ddeff;
  --ytee-speed-bg: rgba(119,221,255,0.12);
  --ytee-speed-border: rgba(119,221,255,0.55);

  --ytee-rec-bg: rgba(255,68,68,0.15);
  --ytee-rec-border: rgba(255,68,68,0.65);

  --ytee-anim-fast: 0.08s cubic-bezier(0.4,0,0.2,1);
  --ytee-anim-normal: 0.15s cubic-bezier(0.4,0,0.2,1);
  --ytee-anim-slow: 0.25s cubic-bezier(0.4,0,0.2,1);
  --ytee-radius: 5px;
}

[data-ytee-high-contrast="1"] {
  --ytee-btn-bg: rgba(10, 10, 10, 0.82) !important;
  --ytee-btn-border: rgba(255, 255, 255, 0.28) !important;
  --ytee-btn-hover: rgba(30, 30, 30, 0.95) !important;
  --ytee-text: #ffffff !important;
}

player-fullscreen-action-menu { display: none !important; }

/* Overlays */
#custom-vol-overlay,
#custom-speed-overlay {
  position: fixed;
  top: clamp(60px,10vh,140px);
  left: 50%;
  transform: translateX(-50%);
  background: var(--ytee-bg-dark);
  color: var(--ytee-text);
  padding: clamp(5px,calc(var(--ytee-ew) * 0.008),10px) clamp(10px,calc(var(--ytee-ew) * 0.016),20px);
  border-radius: 6px;
  font-size: clamp(13px,calc(var(--ytee-ew) * 0.018),20px);
  font-family: sans-serif;
  font-weight: bold;
  z-index: 9999;
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--ytee-anim-slow);
  will-change: opacity;
}
#custom-vol-overlay.show,
#custom-speed-overlay.show { opacity: 1; transition: opacity var(--ytee-anim-fast); }
#custom-speed-overlay { top: clamp(95px,16vh,190px); }

#custom-clip-overlay {
  position: fixed;
  top: clamp(125px,22vh,240px);
  left: 50%;
  transform: translateX(-50%);
  background: rgba(180,0,0,0.78);
  color: white;
  padding: clamp(4px,calc(var(--ytee-ew) * 0.005),7px) clamp(10px,calc(var(--ytee-ew) * 0.014),18px);
  border-radius: 6px;
  font-size: clamp(11px,calc(var(--ytee-ew) * 0.014),16px);
  font-family: monospace;
  font-weight: bold;
  z-index: 9999;
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--ytee-anim-slow);
  will-change: opacity;
}
#custom-clip-overlay.show { opacity: 1; transition: opacity var(--ytee-anim-fast); }

#custom-mini-stats {
  position: fixed;
  bottom: 45px;
  left: 10px;
  background: rgba(10, 10, 10, 0.7);
  backdrop-filter: blur(4px);
  color: rgba(255, 255, 255, 0.6);
  padding: 4px 10px;
  border-radius: 6px;
  font-family: ui-monospace, 'Cascadia Code', monospace;
  font-size: 10.5px;
  z-index: 9999;
  border: 1px solid rgba(255, 255, 255, 0.08);
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--ytee-anim-slow);
  white-space: nowrap;
  display: flex;
  gap: 12px;
}
#custom-mini-stats.show { opacity: 1; }
#custom-mini-stats span { color: var(--ytee-speed-color); font-weight: bold; }
#custom-mini-stats b { color: rgba(255, 255, 255, 0.3); font-weight: normal; margin-right: 4px; }

/* Mute button */
#custom-mute-btn {
  position: fixed;
  bottom: clamp(6px,1vh,18px);
  left: clamp(6px,calc(var(--ytee-ew) * 0.008),14px);
  width: var(--ytee-btn-size);
  height: var(--ytee-btn-size);
  z-index: 9999;
  cursor: pointer;
  border: none;
  background-color: transparent;
  background-repeat: no-repeat;
  background-position: center;
  background-size: contain;
  background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>');
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--ytee-anim-slow), transform var(--ytee-anim-fast);
  will-change: opacity;
}
#custom-mute-btn.show { opacity: 1; pointer-events: auto; }
#custom-mute-btn.show:hover { transform: scale(1.1); }
#custom-mute-btn.muted {
  background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>');
  opacity: 0.5 !important;
}
#custom-mute-btn.show.muted { opacity: 0.5; }

/* Volume slider */
#custom-vol-slider {
  position: fixed;
  bottom: calc(clamp(6px,1vh,18px) + var(--ytee-btn-size)/2 - 6px);
  left: calc(clamp(6px,calc(var(--ytee-ew) * 0.008),14px) + var(--ytee-btn-size) + clamp(3px,calc(var(--ytee-ew) * 0.004),7px));
  z-index: 9999;
  width: clamp(52px,calc(var(--ytee-ew) * 0.072),90px);
  height: 12px;
  cursor: pointer;
  -webkit-appearance: none;
  appearance: none;
  background: transparent !important;
  border: none !important;
  padding: 0 !important;
  margin: 0 !important;
  outline: none;
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--ytee-anim-slow), width var(--ytee-anim-normal);
  will-change: opacity;
}
#custom-vol-slider.show { opacity: 0.75; pointer-events: auto; }
#custom-vol-slider.show:hover { opacity: 1; width: clamp(68px,calc(var(--ytee-ew) * 0.092),110px); }
#custom-vol-slider::-webkit-slider-runnable-track { -webkit-appearance: none; height: 3px; border-radius: 2px; background: rgba(255,255,255,0.35); border: none; }
#custom-vol-slider::-moz-range-track { height: 3px; border-radius: 2px; background: rgba(255,255,255,0.35); border: none; }
#custom-vol-slider::-webkit-slider-thumb {
  width: clamp(10px,calc(var(--ytee-ew) * 0.013),14px); height: clamp(10px,calc(var(--ytee-ew) * 0.013),14px);
  margin-top: calc(-1*(clamp(10px,calc(var(--ytee-ew) * 0.013),14px)/2 - 1.5px));
  appearance: none; border-radius: 50%; background: white;
  box-shadow: 0 1px 3px rgba(0,0,0,0.5);
}
#custom-vol-slider::-moz-range-thumb {
  width: clamp(10px,calc(var(--ytee-ew) * 0.013),14px); height: clamp(10px,calc(var(--ytee-ew) * 0.013),14px);
  border-radius: 50%; background: white; border: none;
  box-shadow: 0 1px 3px rgba(0,0,0,0.5);
}

/* Button group */
#custom-btn-group {
  position: fixed;
  bottom: clamp(6px,1vh,18px);
  right: clamp(6px,calc(var(--ytee-ew) * 0.008),14px);
  display: flex;
  align-items: center;
  gap: var(--ytee-gap);
  z-index: 9999;
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--ytee-anim-slow);
  will-change: opacity;
}
#custom-btn-group.show { opacity: 1; pointer-events: auto; }

/* Shared button base */
#custom-wl-btn,
#custom-url-btn,
#custom-screenshot-btn,
#custom-clip-btn,
#custom-pip-btn,
#custom-speed-btn,
#custom-stats-btn,
#custom-settings-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  cursor: pointer;
  color: var(--ytee-text);
  background: var(--ytee-btn-bg) !important;
  border: 1px solid var(--ytee-btn-border) !important;
  border-radius: var(--ytee-radius) !important;
  font-size: var(--ytee-font-size);
  font-family: ui-monospace, 'Cascadia Code', monospace;
  font-weight: 700;
  letter-spacing: 0.03em;
  line-height: 1;
  text-shadow: 0 1px 2px rgba(0,0,0,0.6);
  opacity: 0;
  pointer-events: none;
  position: relative;
  overflow: visible;
  white-space: nowrap;
  transition: opacity var(--ytee-anim-slow), background var(--ytee-anim-fast), transform var(--ytee-anim-fast);
}
#custom-btn-group.show #custom-wl-btn,
#custom-btn-group.show #custom-url-btn,
#custom-btn-group.show #custom-screenshot-btn,
#custom-btn-group.show #custom-clip-btn,
#custom-btn-group.show #custom-pip-btn,
#custom-btn-group.show #custom-speed-btn,
#custom-btn-group.show #custom-stats-btn,
#custom-btn-group.show #custom-settings-btn {
  opacity: 1; pointer-events: auto;
}
#custom-btn-group.show #custom-wl-btn:hover,
#custom-btn-group.show #custom-url-btn:hover,
#custom-btn-group.show #custom-screenshot-btn:hover,
#custom-btn-group.show #custom-clip-btn:hover,
#custom-btn-group.show #custom-pip-btn:hover,
#custom-btn-group.show #custom-speed-btn:hover,
#custom-btn-group.show #custom-stats-btn:hover,
#custom-btn-group.show #custom-settings-btn:hover {
  background: var(--ytee-btn-hover) !important;
  transform: scale(1.08);
  z-index: 10;
}

/* Icon mode */
#custom-wl-btn,
#custom-url-btn,
#custom-screenshot-btn,
#custom-clip-btn,
#custom-pip-btn,
#custom-stats-btn,
#custom-settings-btn {
  width: var(--ytee-btn-size);
  height: var(--ytee-btn-size);
  padding: 0;
}
/* Speed keeps auto width for the rate text */
#custom-speed-btn {
  height: var(--ytee-btn-size);
  min-width: var(--ytee-btn-size);
  padding: 0 clamp(3px,calc(var(--ytee-ew) * 0.004),7px);
}

/* SVG icons inside each button */
#custom-wl-btn .ytee-icon,
#custom-url-btn .ytee-icon,
#custom-screenshot-btn .ytee-icon,
#custom-clip-btn .ytee-icon,
#custom-pip-btn .ytee-icon,
#custom-stats-btn .ytee-icon,
#custom-settings-btn .ytee-icon,
#custom-speed-btn .ytee-icon { display: flex; }

/* Label spans — hidden in icon mode */
#custom-wl-btn .ytee-label,
#custom-url-btn .ytee-label,
#custom-screenshot-btn .ytee-label,
#custom-clip-btn .ytee-label,
#custom-pip-btn .ytee-label,
#custom-speed-btn .ytee-label,
#custom-stats-btn .ytee-label,
#custom-settings-btn .ytee-label { display: none; }

/* Tooltips — shown in icon mode only */
#custom-wl-btn::after,
#custom-url-btn::after,
#custom-screenshot-btn::after,
#custom-clip-btn::after,
#custom-pip-btn::after,
#custom-speed-btn::after,
#custom-stats-btn::after,
#custom-settings-btn::after {
  content: attr(data-tip);
  position: absolute;
  bottom: calc(100% + 7.5px);
  right: 0;
  background: rgba(10,10,10,0.92);
  color: rgba(255,255,255,0.92);
  font-size: 12.5px;
  font-family: system-ui, sans-serif;
  font-weight: 500;
  white-space: nowrap;
  padding: 3.75px 10px;
  border-radius: 5px;
  border: 1.25px solid rgba(255,255,255,0.1);
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.12s;
  letter-spacing: 0;
}
#custom-wl-btn:hover::after,
#custom-url-btn:hover::after,
#custom-screenshot-btn:hover::after,
#custom-clip-btn:hover::after,
#custom-pip-btn:hover::after,
#custom-speed-btn:hover::after,
#custom-stats-btn:hover::after,
#custom-settings-btn:hover::after { opacity: 1; }


/* Label mode */
[data-ytee-labels="1"] #custom-wl-btn,
[data-ytee-labels="1"] #custom-url-btn,
[data-ytee-labels="1"] #custom-screenshot-btn,
[data-ytee-labels="1"] #custom-clip-btn,
[data-ytee-labels="1"] #custom-pip-btn,
[data-ytee-labels="1"] #custom-stats-btn {
  width: auto;
  padding: 0 clamp(6px,calc(var(--ytee-ew) * 0.009),13px);
}
[data-ytee-labels="1"] #custom-speed-btn {
  padding: 0 clamp(6px,calc(var(--ytee-ew) * 0.009),13px);
}
[data-ytee-labels="1"] #custom-wl-btn .ytee-label,
[data-ytee-labels="1"] #custom-url-btn .ytee-label,
[data-ytee-labels="1"] #custom-screenshot-btn .ytee-label,
[data-ytee-labels="1"] #custom-clip-btn .ytee-label,
[data-ytee-labels="1"] #custom-pip-btn .ytee-label,
[data-ytee-labels="1"] #custom-speed-btn .ytee-label,
[data-ytee-labels="1"] #custom-stats-btn .ytee-label { display: inline; }

/* In label mode, always show PiP + Stats */
[data-ytee-labels="1"] #custom-pip-btn,
[data-ytee-labels="1"] #custom-stats-btn { display: flex !important; }

/* In label mode, always show icons inside buttons (icon+label together) */
[data-ytee-labels="1"] #custom-wl-btn .ytee-icon,
[data-ytee-labels="1"] #custom-url-btn .ytee-icon,
[data-ytee-labels="1"] #custom-screenshot-btn .ytee-icon,
[data-ytee-labels="1"] #custom-clip-btn .ytee-icon,
[data-ytee-labels="1"] #custom-pip-btn .ytee-icon,
[data-ytee-labels="1"] #custom-speed-btn .ytee-icon,
[data-ytee-labels="1"] #custom-stats-btn .ytee-icon { display: flex; }

/* State colors */
#custom-stats-btn.active {
  color: var(--ytee-stats-color) !important;
  background: var(--ytee-stats-bg) !important;
  border-color: var(--ytee-stats-border) !important;
}
#custom-stats-btn.active svg { fill: var(--ytee-stats-color); }

#custom-speed-btn.modified {
  color: var(--ytee-speed-color) !important;
  background: var(--ytee-speed-bg) !important;
  border-color: var(--ytee-speed-border) !important;
}
#custom-speed-btn.modified svg { fill: var(--ytee-speed-color); }

@keyframes ytee-rec-pulse {
  0%,100% { box-shadow: 0 0 0 0 rgba(255,60,60,0.7); }
  50%      { box-shadow: 0 0 0 5px rgba(255,60,60,0); }
}
#custom-clip-btn.recording {
  color: #ff4444 !important;
  background: var(--ytee-rec-bg) !important;
  border-color: var(--ytee-rec-border) !important;
  animation: ytee-rec-pulse 1.1s ease-in-out infinite;
}
#custom-clip-btn.recording svg { fill: #ff4444; }

/* Feedback States */
@keyframes ytee-btn-bounce {
  0%, 100% { transform: scale(1); }
  40%      { transform: scale(1.25); }
  60%      { transform: scale(0.95); }
}
.ytee-btn.success {
  color: #2ecc71 !important;
  background: rgba(46, 204, 113, 0.2) !important;
  border-color: rgba(46, 204, 113, 0.6) !important;
  animation: ytee-btn-bounce 0.45s cubic-bezier(0.34, 1.56, 0.64, 1);
  z-index: 20;
}
.ytee-btn.success svg { fill: #2ecc71; }

.ytee-btn.error {
  color: #ff4444 !important;
  background: rgba(255, 68, 68, 0.2) !important;
  border-color: rgba(255, 68, 68, 0.6) !important;
  animation: ytee-btn-bounce 0.45s cubic-bezier(0.34, 1.56, 0.64, 1);
  z-index: 20;
}
.ytee-btn.error svg { fill: #ff4444; }

/* Settings Modal */
@keyframes ytee-modal-in {
  from { opacity:0; transform: scale(0.96) translateY(8px); }
  to   { opacity:1; transform: scale(1) translateY(0); }
}
#custom-settings-modal {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.78);
  backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
  z-index: 10000; display: none;
  align-items: center; justify-content: center;
}
#custom-settings-modal.show { display: flex; }
#custom-settings-content {
  background: linear-gradient(160deg,rgba(22,22,28,0.97) 0%,rgba(14,14,18,0.97) 100%);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 14px;
  padding: 16px 18px 14px;
  width: min(480px,96vw);
  max-height: 90vh;
  overflow-y: auto; overflow-x: hidden;
  color: white;
  font-family: system-ui,-apple-system,sans-serif;
  box-shadow: 0 24px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04) inset;
  animation: ytee-modal-in 0.2s cubic-bezier(0.34,1.56,0.64,1) both;
  scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.15) transparent;
}
#custom-settings-content::-webkit-scrollbar { width: 4px; }
#custom-settings-content::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.15); border-radius:99px; }
#custom-settings-content h2 { margin:0 0 2px; font-size:15px; font-weight:700; letter-spacing:-0.01em; color:rgba(255,255,255,0.95); }
#ytee-settings-subtitle { font-size:11px; color:rgba(255,255,255,0.35); margin:0 0 12px; letter-spacing:0.01em; }
#custom-settings-content h3.setting-section-title {
  display:flex; align-items:center; gap:8px;
  margin:14px 0 2px; font-size:10px; font-weight:700;
  color:rgba(255,255,255,0.38); text-transform:uppercase; letter-spacing:0.15em;
}
#custom-settings-content h3.setting-section-title::before {
  content:''; display:block; width:3px; height:14px; border-radius:99px; flex-shrink:0;
  background:linear-gradient(to bottom,rgba(119,221,255,0.9),rgba(119,221,255,0.2));
}
#custom-settings-content h3.setting-section-title::after { content:''; flex:1; height:1px; background:rgba(255,255,255,0.06); }
#custom-settings-content .setting-item {
  display:flex; align-items:center; justify-content:space-between; gap:10px;
  padding:7px 10px; margin:2px 0; border-radius:8px; border:1px solid transparent;
  transition: background 0.15s, border-color 0.15s;
}
#custom-settings-content .setting-item:hover { background:rgba(255,255,255,0.04); border-color:rgba(255,255,255,0.07); }
#custom-settings-content .setting-item label:not(.ytee-toggle-track) {
  flex:1; font-size:13.5px; font-weight:500; color:rgba(255,255,255,0.85); cursor:pointer; user-select:none;
}
.ytee-toggle-wrap { position:relative; width:38px; height:22px; flex:0 0 38px; flex-shrink:0; }
.ytee-toggle-wrap input[type="checkbox"] { opacity:0; width:0; height:0; position:absolute; }
.ytee-toggle-track {
  position:absolute; inset:0; border-radius:99px;
  background:rgba(255,255,255,0.12); border:1px solid rgba(255,255,255,0.12);
  transition: background 0.2s, border-color 0.2s; cursor:pointer;
}
.ytee-toggle-thumb {
  position:absolute; top:3px; left:3px; width:14px; height:14px; border-radius:50%;
  background:rgba(255,255,255,0.5);
  transition: transform 0.2s cubic-bezier(0.34,1.56,0.64,1), background 0.2s;
  pointer-events:none;
}
.ytee-toggle-wrap input:checked ~ .ytee-toggle-track { background:rgba(119,221,255,0.25); border-color:rgba(119,221,255,0.6); }
.ytee-toggle-wrap input:checked ~ .ytee-toggle-track .ytee-toggle-thumb { transform:translateX(16px); background:#7ddeff; }
#custom-settings-content .hk-input {
  width:108px; padding:7px 11px;
  background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1);
  border-radius:8px; color:rgba(255,255,255,0.9);
  font-size:12px; font-family:ui-monospace,'Cascadia Code',monospace;
  font-weight:600; letter-spacing:0.04em; text-transform:lowercase;
  transition: border-color 0.15s, box-shadow 0.15s, background 0.15s; flex-shrink:0;
}
#custom-settings-content .hk-input:focus { outline:none; background:rgba(119,221,255,0.06); border-color:rgba(119,221,255,0.5); box-shadow:0 0 0 3px rgba(119,221,255,0.1); }
#custom-settings-content input[type="range"] { -webkit-appearance:none; appearance:none; height:4px; border-radius:99px; background:rgba(255,255,255,0.12); outline:none; cursor:pointer; flex-shrink:0; }
#custom-settings-content input[type="range"]::-webkit-slider-thumb { -webkit-appearance:none; width:16px; height:16px; border-radius:50%; background:#fff; box-shadow:0 1px 4px rgba(0,0,0,0.4); transition:transform 0.12s,box-shadow 0.12s; }
#custom-settings-content input[type="range"]:hover::-webkit-slider-thumb { transform:scale(1.15); box-shadow:0 2px 8px rgba(0,0,0,0.5); }
#custom-settings-content input[type="range"]::-moz-range-thumb { width:16px; height:16px; border-radius:50%; background:#fff; border:none; box-shadow:0 1px 4px rgba(0,0,0,0.4); }
#custom-settings-content input[type="range"]::-moz-range-track { height:4px; border-radius:99px; background:rgba(255,255,255,0.12); }
.ytee-slider-value { font-size:12px; font-weight:700; font-family:ui-monospace,monospace; color:rgba(255,255,255,0.5); min-width:40px; text-align:right; flex-shrink:0; }
.setting-note { display:block; font-size:11px; color:rgba(255,255,255,0.3); margin:4px 14px 12px; line-height:1.4; font-style:italic; }
#custom-settings-buttons { display:flex; align-items:center; justify-content:flex-end; gap:8px; margin-top:14px; padding-top:10px; border-top:1px solid rgba(255,255,255,0.07); }
#custom-settings-restore { margin-right:auto; padding:8px 14px; background:transparent; border:1px solid rgba(255,80,80,0.3); border-radius:9px; color:rgba(255,110,110,0.8); cursor:pointer; font-size:12.5px; font-weight:600; transition:background 0.15s,border-color 0.15s,color 0.15s; }
#custom-settings-restore:hover { background:rgba(255,60,60,0.1); border-color:rgba(255,80,80,0.6); color:#ff8080; }
#custom-settings-cancel { padding:8px 16px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:9px; color:rgba(255,255,255,0.6); cursor:pointer; font-size:13px; font-weight:600; transition:background 0.15s,color 0.15s; }
#custom-settings-cancel:hover { background:rgba(255,255,255,0.1); color:rgba(255,255,255,0.9); }
#custom-settings-save { padding:8px 20px; background:rgba(119,221,255,0.15); border:1px solid rgba(119,221,255,0.45); border-radius:9px; color:#7ddeff; cursor:pointer; font-size:13px; font-weight:700; letter-spacing:0.01em; transition:background 0.15s,border-color 0.15s,box-shadow 0.15s; }
#custom-settings-save:hover { background:rgba(119,221,255,0.25); border-color:rgba(119,221,255,0.7); box-shadow:0 0 14px rgba(119,221,255,0.15); }
.ytee-quality-select {
  padding:7px 11px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1);
  border-radius:8px; color:rgba(255,255,255,0.9); font-size:12px;
  font-family:ui-monospace,'Cascadia Code',monospace; font-weight:600; letter-spacing:0.04em;
  cursor:pointer; flex-shrink:0; transition:border-color 0.15s,box-shadow 0.15s,background 0.15s;
  appearance:none; -webkit-appearance:none;
  background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6'><path d='M0 0l5 6 5-6z' fill='rgba(255,255,255,0.4)'/></svg>");
  background-repeat:no-repeat; background-position:right 10px center; padding-right:28px;
}
.ytee-quality-select:focus { outline:none; background-color:rgba(119,221,255,0.06); border-color:rgba(119,221,255,0.5); box-shadow:0 0 0 3px rgba(119,221,255,0.1); }
.ytee-quality-select option { background:#1a1a22; color:white; }
.ytee-quality-note { display:block; font-size:11px; color:rgba(255,255,255,0.3); margin:4px 14px 12px; line-height:1.4; font-style:italic; }
`
    })
  );

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const mkSvgEl = (...pathDefs) => {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'currentColor');
    svg.style.cssText = 'width:var(--ytee-icon-size,13px);height:var(--ytee-icon-size,13px);flex-shrink:0;';
    pathDefs.forEach(def => {
      const el = document.createElementNS(SVG_NS, def.tag || 'path');
      Object.entries(def.attrs).forEach(([k, v]) => el.setAttribute(k, v));
      svg.appendChild(el);
    });
    return svg;
  };

  const ICON_DEFS = {
    wl: () => mkSvgEl({ tag: 'path', attrs: { d: 'M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z' } }),
    url: () => mkSvgEl({ tag: 'path', attrs: { d: 'M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z' } }),
    screenshot: () => mkSvgEl({ tag: 'path', attrs: { d: 'M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z' } }),
    clip: () => mkSvgEl({ tag: 'circle', attrs: { cx: '12', cy: '12', r: '7' } }),
    pip: () => mkSvgEl(
      { tag: 'path', attrs: { d: 'M19 7H5c-1.1 0-2 .9-2 2v6c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zm-9 5v-1.5l4 2-4 2V12z' } },
      { tag: 'path', attrs: { d: 'M23 5h-2v14h2V5zM1 5v14h2V5H1z' } }
    ),
    stats: () => mkSvgEl({ tag: 'path', attrs: { d: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 12 6zm7 13H5v-.23c0-.62.28-1.2.76-1.58C7.47 15.82 9.64 15 12 15s4.53.82 6.24 2.19c.48.38.76.97.76 1.58V19z' } }),
    settings: () => mkSvgEl({ tag: 'path', attrs: { d: 'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z' } }),
    speed: () => mkSvgEl({ tag: 'path', attrs: { d: 'M10 8v8l6-4-6-4zm6.5-4.5l-1.5 1.5C16.78 6.76 18 9.24 18 12s-1.22 5.24-3 6.99l1.5 1.5C18.77 18.12 20 15.2 20 12s-1.23-6.12-3.5-8.5zM7.5 5.5L6 4C3.23 6.38 2 9.3 2 12s1.23 5.62 4 8l1.5-1.5C5.22 16.76 4 14.29 4 12s1.22-5.24 3.5-6.5z' } }),
  };

  const mkBtn = (id, iconKey, labelText, tipText, titleText) => {
    const btn = document.createElement('button');
    btn.id = id;
    btn.className = 'ytee-btn';
    btn.title = titleText || labelText;
    btn.dataset.tip = tipText || labelText;
    btn.setAttribute('aria-label', labelText);

    const iconSpan = document.createElement('span');
    iconSpan.className = 'ytee-icon';
    iconSpan.appendChild(ICON_DEFS[iconKey]());

    const labelSpan = document.createElement('span');
    labelSpan.className = 'ytee-label';
    labelSpan.textContent = labelText;

    btn.appendChild(iconSpan);
    btn.appendChild(labelSpan);
    return btn;
  };

  const waitForVideo = (callback, timeoutMs = 15000) => {
    const existing = document.querySelector("video");
    if (existing) { callback(existing); return; }
    const observer = new MutationObserver(() => {
      const v = document.querySelector("video");
      if (v) { observer.disconnect(); clearTimeout(timer); callback(v); }
    });
    const timer = setTimeout(() => { observer.disconnect(); console.warn('YTEE: video element never appeared'); }, timeoutMs);
    observer.observe(document.documentElement, { childList: true, subtree: true });
  };

  // Settings
  const defaultSettings = {
    buttons: { wl: true, url: true, screenshot: true, clip: true, pip: true, speed: true, stats: true },
    hotkeys: {
      toggleMute: 'm',
      toggleStats: 'shift+s',
      increaseSpeed: '.',
      decreaseSpeed: ',',
      increaseSpeedFine: 'shift+.',
      decreaseSpeedFine: 'shift+,',
      volumeUp: 'arrowup',
      volumeDown: 'arrowdown',
    },
    volumeBoostLevel: 1,
    enableVolumeBoost: true,
    clipDuration: 5,
    clipDurationCtrl: 300,
    preferredQuality: 'auto',
    compactMode: false,
    highContrastUI: false,
  };

  const loadStoredSettings = () => {
    try {
      if (typeof GM_getValue === 'function') {
        const v = GM_getValue('ytee-settings', null);
        if (v) return typeof v === 'string' ? JSON.parse(v) : v;
      }
    } catch (e) { console.warn('GM_getValue failed', e); }
    try { const r = localStorage.getItem('ytee-settings'); if (r) return JSON.parse(r); } catch (e) { }
    return null;
  };

  const saveStoredSettings = (s) => {
    try { if (typeof GM_setValue === 'function') GM_setValue('ytee-settings', JSON.stringify(s)); } catch (e) { }
    try { localStorage.setItem('ytee-settings', JSON.stringify(s)); } catch (e) { }
  };

  let currentSettings = loadStoredSettings() || defaultSettings;

  const normalizeSettings = (s) => {
    if (!s || typeof s !== 'object') return JSON.parse(JSON.stringify(defaultSettings));
    return {
      buttons: Object.assign({}, defaultSettings.buttons, s.buttons),
      hotkeys: Object.assign({}, defaultSettings.hotkeys, s.hotkeys),
      volumeBoostLevel: typeof s.volumeBoostLevel === 'number' ? s.volumeBoostLevel
        : s.volumeBoost === true ? 1.5 : defaultSettings.volumeBoostLevel,
      enableVolumeBoost: typeof s.enableVolumeBoost === 'boolean' ? s.enableVolumeBoost : defaultSettings.enableVolumeBoost,
      clipDuration: typeof s.clipDuration === 'number' ? Math.min(300, Math.max(1, s.clipDuration)) : defaultSettings.clipDuration,
      clipDurationCtrl: typeof s.clipDurationCtrl === 'number' ? Math.min(300, Math.max(1, s.clipDurationCtrl)) : defaultSettings.clipDurationCtrl,
      preferredQuality: typeof s.preferredQuality === 'string' ? s.preferredQuality : defaultSettings.preferredQuality,
      compactMode: typeof s.compactMode === 'boolean' ? s.compactMode : (typeof s.labelMode === 'boolean' ? !s.labelMode : defaultSettings.compactMode),
      highContrastUI: typeof s.highContrastUI === 'boolean' ? s.highContrastUI : defaultSettings.highContrastUI,
    };
  };

  const applyUIStates = (settings) => {
    document.documentElement.dataset.yteeLabels = settings.compactMode ? '0' : '1';
    document.documentElement.dataset.yteeHighContrast = settings.highContrastUI ? '1' : '0';
  };

  currentSettings = normalizeSettings(currentSettings);
  applyUIStates(currentSettings);

  const getVideoAuthor = (player) => {
    if (player && typeof player.getVideoData === 'function') {
      const data = player.getVideoData();
      if (data?.author) return data.author.replace(/[<>:"/\\|?*\x00-\x1F]/g, '').trim();
    }
    return 'YouTube';
  };

  const formatTimestamp = (currentTime) => {
    const timeMs = Math.floor(currentTime * 1000);
    const mins = Math.floor(timeMs / 60000).toString().padStart(2, '0');
    const secs = Math.floor((timeMs % 60000) / 1000).toString().padStart(2, '0');
    const ms = (timeMs % 1000).toString().padStart(3, '0');
    return `${mins}-${secs}-${ms}`;
  };

  const setBtnLabel = (btn, text, tipText) => {
    const label = btn.querySelector('.ytee-label');
    if (label) label.textContent = text;
    btn.dataset.tip = tipText ?? text;
  };

  const flashBtnState = (btn, state, duration = 1500) => {
    btn.classList.add(state);
    setTimeout(() => btn.classList.remove(state), duration);
  };

  // Main
  waitForVideo((video) => {
    let targetVolume = video.volume;
    let targetMuted = video.muted;

    const uw = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;

    let cachedPlayer = null;
    const getPlayer = () => {
      if (cachedPlayer && cachedPlayer.isConnected) return cachedPlayer;
      cachedPlayer = uw.document.getElementById("movie_player") || uw.document.querySelector(".html5-video-player");
      return cachedPlayer;
    };

    const QUALITY_LABELS = {
      auto: 'Auto (YouTube decides)', hd2160: '4K (2160p)', hd1440: '1440p',
      hd1080: '1080p', hd720: '720p', large: '480p', medium: '360p', small: '240p', tiny: '144p',
    };
    const QUALITY_ORDER = ['hd2160', 'hd1440', 'hd1080', 'hd720', 'large', 'medium', 'small', 'tiny'];

    const applyQuality = () => {
      const pref = currentSettings.preferredQuality;
      if (!pref || pref === 'auto') return;
      const p = getPlayer();
      if (!p) return;
      try {
        if (typeof p.setPlaybackQualityRange === 'function') p.setPlaybackQualityRange(pref, pref);
        if (typeof p.setPlaybackQuality === 'function') p.setPlaybackQuality(pref);
      } catch (e) { console.warn('YTEE: applyQuality failed', e); }
    };

    const hookPlayerQuality = () => {
      const p = getPlayer();
      if (!p || typeof p.addEventListener !== 'function') return;
      p.addEventListener('onStateChange', (state) => { if (state === 1 || state === 3) applyQuality(); });
    };

    let qualityHookAttempts = 0;
    const tryHookQuality = () => {
      const p = getPlayer();
      if (p && typeof p.addEventListener === 'function') { hookPlayerQuality(); applyQuality(); }
      else if (qualityHookAttempts < 20) { qualityHookAttempts++; setTimeout(tryHookQuality, 500); }
    };
    tryHookQuality();

    let scriptChangeDepth = 0;
    let audioContext = null, gainNode = null, mediaSource = null, virtualMuted = video.muted, audioSetupFailed = false;
    let activeStream = null, rafPending = 0;
    let volTimeout, speedTimeout, controlsTimeout, clipRafId = null;

    const getBoostLevel = () => currentSettings.enableVolumeBoost ? Math.max(1, Number(currentSettings.volumeBoostLevel) || 1) : 1;

    // Volume
    const setupWebAudio = () => {
      if (gainNode || audioSetupFailed || !(window.AudioContext || window.webkitAudioContext)) return;
      try {
        const AudioCtor = window.AudioContext || window.webkitAudioContext;
        audioContext = new AudioCtor();
        mediaSource = audioContext.createMediaElementSource(video);
        gainNode = audioContext.createGain();
        mediaSource.connect(gainNode);
        gainNode.connect(audioContext.destination);
        video.volume = 1;
        if (audioContext.state === 'suspended') audioContext.resume().catch(e => console.warn('AudioContext resume failed', e));
      } catch (e) {
        console.warn('Web Audio setup failed', e);
        audioContext = null; gainNode = null; mediaSource = null; audioSetupFailed = true;
      }
    };

    const setGain = (linearVolume) => {
      if (!gainNode || !audioContext) return;
      if (audioContext.state === 'suspended') audioContext.resume().catch(e => console.warn('AudioContext resume failed', e));
      gainNode.gain.setTargetAtTime(linearVolume * getBoostLevel(), audioContext.currentTime, 0.01);
    };

    const applyAudioState = (volume, muted) => {
      scriptChangeDepth++;
      try {
        targetVolume = Math.min(1, Math.max(0, volume));
        targetMuted = muted;
        virtualMuted = muted;
        if (currentSettings.enableVolumeBoost && !gainNode && getBoostLevel() > 1) setupWebAudio();
        if (currentSettings.enableVolumeBoost && gainNode) {
          setGain(targetMuted ? 0 : targetVolume);
        } else {
          const p = getPlayer();
          if (targetMuted) { if (p && typeof p.mute === 'function') p.mute(); else video.muted = true; }
          else {
            if (p && typeof p.unMute === 'function') p.unMute(); else video.muted = false;
            if (p && typeof p.setVolume === 'function') p.setVolume(Math.round(targetVolume * 100)); else video.volume = targetVolume;
          }
        }
      } finally { scriptChangeDepth--; }
    };

    const applyVolume = (newVol) => {
      const clamped = Math.min(1, Math.max(0, Math.round(newVol * 100) / 100));
      applyAudioState(clamped, clamped === 0);
      vol.value = clamped;
      showVolumePercent(clamped === 0 ? 0 : clamped);
    };

    const toggleMute = () => {
      const newMuted = !targetMuted;
      applyAudioState(targetVolume, newMuted);
      muteBtn.classList.toggle("muted", newMuted);
      showVolumePercent(newMuted ? 0 : targetVolume);
    };

    // Overlays
    const volPct = Object.assign(document.createElement("div"), { id: "custom-vol-overlay" });
    const showVolumePercent = (volume) => {
      const text = Math.round(volume * 100) + "%";
      if (volPct.textContent !== text) volPct.textContent = text;
      volPct.classList.add("show");
      clearTimeout(volTimeout);
      volTimeout = setTimeout(() => volPct.classList.remove("show"), 1500);
    };

    const speedOverlay = Object.assign(document.createElement("div"), { id: "custom-speed-overlay" });
    const showSpeedOverlay = (rate) => {
      const text = rate + "x";
      if (speedOverlay.textContent !== text) speedOverlay.textContent = text;
      speedOverlay.classList.add("show");
      clearTimeout(speedTimeout);
      speedTimeout = setTimeout(() => speedOverlay.classList.remove("show"), 1500);
    };

    // Mute button
    const muteBtn = Object.assign(document.createElement("button"), { id: "custom-mute-btn" });
    muteBtn.addEventListener("click", toggleMute);

    // Volume slider
    const vol = Object.assign(document.createElement("input"), {
      id: "custom-vol-slider", type: "range", min: 0, max: 1, step: 0.01, value: video.volume,
    });
    vol.addEventListener("input", () => applyVolume(Number(vol.value)));

    video.addEventListener("volumechange", () => {
      if (scriptChangeDepth > 0) return;
      if (gainNode) { muteBtn.classList.toggle("muted", video.muted); return; }
      targetMuted = video.muted;
      targetVolume = video.muted ? targetVolume : video.volume;
      muteBtn.classList.toggle("muted", targetMuted);
      const displayVol = targetMuted ? 0 : targetVolume;
      if (Number(vol.value) !== displayVol) vol.value = displayVol;
    });

    let isHoveringSpeedBtn = false;
    let pendingWheelDelta = 0, wheelRafId = 0;
    window.addEventListener("wheel", (e) => {
      if (isSettingsOpen) {
        if (settingsContent.contains(e.target)) return;
        e.stopImmediatePropagation(); e.preventDefault(); return;
      }
      e.preventDefault();
      pendingWheelDelta += e.deltaY;
      if (wheelRafId) return;
      wheelRafId = requestAnimationFrame(() => {
        const delta = pendingWheelDelta;
        pendingWheelDelta = 0;
        wheelRafId = 0;
        if (isHoveringSpeedBtn) {
          applySpeed(targetSpeed + (delta > 0 ? -SPEED_STEP : SPEED_STEP));
        } else {
          applyVolume(targetVolume + (delta > 0 ? -0.05 : 0.05));
        }
      });
    }, { passive: false });

    // Stats
    let isStatsOpen = false, isMiniStatsOpen = false, miniStatsTimer = null;
    const miniStats = Object.assign(document.createElement("div"), { id: "custom-mini-stats" });
    const statsBtn = mkBtn('custom-stats-btn', 'stats', 'Stats', 'Stats (Ctrl = Mini)', 'Stats for Nerds (Shift+S)');

    const miniStatsParts = {};
    (() => {
      const mkPart = (key, label) => {
        const wrap = document.createElement('div');
        const b = document.createElement('b'); b.textContent = label;
        const s = document.createElement('span'); s.textContent = '–';
        wrap.append(b, s);
        miniStats.appendChild(wrap);
        miniStatsParts[key] = s;
      };
      mkPart('buffer', 'Buffer');
      mkPart('latency', 'Latency');
      mkPart('dropped', 'Drop');
    })();

    const updateMiniStats = () => {
      if (!isMiniStatsOpen) return;
      const p = getPlayer();
      if (!p) return;
      const stats = (typeof p.getStatsForNerdsData === 'function') ? p.getStatsForNerdsData() : null;
      const quality = (typeof video.getVideoPlaybackQuality === 'function') ? video.getVideoPlaybackQuality() : null;
      const buffer = stats ? stats.buffer_health : (video.buffered.length > 0 ? (video.buffered.end(video.buffered.length - 1) - video.currentTime).toFixed(2) : '0.00');

      let latency = stats?.latency || stats?.live_latency || stats?.latency_ms;
      if (!latency && stats) {
        for (let k in stats) {
          if (k.toLowerCase().includes('latency')) { latency = stats[k]; break; }
        }
      }
      if (!latency && typeof p.getVideoData === 'function' && p.getVideoData().isLive) {
        const playerDuration = (typeof p.getDuration === 'function') ? p.getDuration() : 0;
        if (playerDuration > 0) latency = Math.max(0, playerDuration - video.currentTime);
      }

      if (typeof latency === 'number') {
        if (latency > 100) latency = latency / 1000;
        latency = latency.toFixed(2);
      }
      const dropped = quality ? quality.droppedVideoFrames : '0';

      miniStatsParts.buffer.textContent = buffer != null ? buffer + 's' : 'N/A';
      miniStatsParts.latency.textContent = latency != null ? latency + 's' : 'N/A';
      miniStatsParts.dropped.textContent = dropped != null ? dropped : 'N/A';

      miniStatsTimer = setTimeout(updateMiniStats, 1000);
    };

    const toggleMiniStats = () => {
      isMiniStatsOpen = !isMiniStatsOpen;
      miniStats.classList.toggle("show", isMiniStatsOpen);
      clearTimeout(miniStatsTimer);
      if (isMiniStatsOpen) updateMiniStats();
    };

    const toggleStats = (e) => {
      if (e && e.ctrlKey) { toggleMiniStats(); return; }
      const p = getPlayer();
      if (!p) return;
      if (isStatsOpen && p.hideVideoInfo) { p.hideVideoInfo(); isStatsOpen = false; }
      else if (p.showVideoInfo) { p.showVideoInfo(); isStatsOpen = true; }
      statsBtn.classList.toggle("active", isStatsOpen);
    };
    statsBtn.addEventListener("click", toggleStats);

    // Speed
    const SPEED_MIN = 0.25, SPEED_MAX = 2, SPEED_STEP = 0.1, SPEED_STEP_FINE = 0.05, SPEED_DEFAULT = 1;
    let targetSpeed = Math.round((video.playbackRate || SPEED_DEFAULT) * 100) / 100;

    const speedBtn = mkBtn('custom-speed-btn', 'speed', targetSpeed + 'x', 'Speed', 'Playback Speed');

    const updateSpeedBtnText = (rate) => {
      setBtnLabel(speedBtn, rate + 'x', `Speed: ${rate}x`);
    };

    const applySpeed = (rate) => {
      targetSpeed = Math.round(Math.min(SPEED_MAX, Math.max(SPEED_MIN, rate)) * 100) / 100;
      if (video.playbackRate !== targetSpeed) video.playbackRate = targetSpeed;
      updateSpeedBtnText(targetSpeed);
      speedBtn.classList.toggle("modified", targetSpeed !== 1);
      showSpeedOverlay(targetSpeed);
    };

    speedBtn.addEventListener("click", (e) => {
      const step = e.shiftKey ? SPEED_STEP_FINE : SPEED_STEP;
      const next = targetSpeed + step;
      applySpeed(next > SPEED_MAX ? SPEED_MIN : next);
    });
    speedBtn.addEventListener("contextmenu", (e) => { e.preventDefault(); applySpeed(SPEED_DEFAULT); });
    speedBtn.addEventListener("mouseenter", () => { isHoveringSpeedBtn = true; });
    speedBtn.addEventListener("mouseleave", () => { isHoveringSpeedBtn = false; });

    // Snap
    const screenshotBtn = mkBtn('custom-screenshot-btn', 'screenshot', 'Snap', 'Snap (Ctrl+Click = save to storage)', 'Take Screenshot');
    screenshotBtn.addEventListener("click", (e) => {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      canvas.getContext("2d", { alpha: false }).drawImage(video, 0, 0);
      const author = getVideoAuthor(getPlayer());
      const timestamp = formatTimestamp(video.currentTime);
      canvas.toBlob((blob) => {
        if (!blob) return;
        if (e.ctrlKey) {
          const objUrl = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = objUrl; a.download = `${author}_${timestamp}.png`; a.click();
          URL.revokeObjectURL(objUrl);
        }
        if (navigator.clipboard) {
          if (typeof ClipboardItem !== "undefined") {
            navigator.clipboard.write([new ClipboardItem({ "image/png": blob })])
              .then(() => {
                setBtnLabel(screenshotBtn, e.ctrlKey ? '✓ Saved!' : '✓ Copied!');
                flashBtnState(screenshotBtn, 'success');
                setTimeout(() => setBtnLabel(screenshotBtn, 'Snap'), 1500);
              })
              .catch(() => {
                setBtnLabel(screenshotBtn, '✗ Error');
                flashBtnState(screenshotBtn, 'error');
                setTimeout(() => setBtnLabel(screenshotBtn, 'Snap'), 1500);
              });
          } else {
            if (!e.ctrlKey) { setBtnLabel(screenshotBtn, '✗ N/A'); setTimeout(() => setBtnLabel(screenshotBtn, 'Snap'), 1500); }
          }
        }
      }, "image/png");
    });

    // Clip
    const clipOverlay = Object.assign(document.createElement('div'), { id: 'custom-clip-overlay' });
    const clipBtn = mkBtn('custom-clip-btn', 'clip', 'Clip', 'Clip (Ctrl = long)', 'Record WebM Clip');
    let clipRecorder = null;

    const stopClip = (cancelled) => {
      if (!clipRecorder) return;
      if (clipRecorder.state !== 'inactive') clipRecorder.stop();
      clipRecorder = null;
      if (activeStream) { activeStream.getTracks().forEach(t => t.stop()); activeStream = null; }
      cancelAnimationFrame(clipRafId); clipRafId = null;
      clipBtn.classList.remove('recording');
      setBtnLabel(clipBtn, cancelled ? '✗ Cancelled' : 'Processing…');
      clipOverlay.classList.remove('show');
      if (cancelled) setTimeout(() => setBtnLabel(clipBtn, 'Clip'), 1500);
    };

    const startClip = (durationSec) => {
      if (clipRecorder) { stopClip(true); return; }
      if (!video.captureStream) { setBtnLabel(clipBtn, '✗ N/A'); setTimeout(() => setBtnLabel(clipBtn, 'Clip'), 2000); return; }

      const mimeType = MediaRecorder.isTypeSupported('video/webm; codecs=vp9,opus')
        ? 'video/webm; codecs=vp9,opus'
        : MediaRecorder.isTypeSupported('video/webm; codecs=vp8,opus')
          ? 'video/webm; codecs=vp8,opus' : 'video/webm';

      // Clip Recording Setup
      const width = video.videoWidth || 1920;
      const height = video.videoHeight || 1080;
      const px = width * height;
      const isVP9 = mimeType.includes('vp9');

      let fps = 30;
      const p = getPlayer();
      if (p && typeof p.getStatsForNerdsData === 'function') {
        const s = p.getStatsForNerdsData();
        if (s && s.resolution) {
          const m = s.resolution.match(/@(\d+)/);
          if (m) fps = parseInt(m[1]);
        }
      }

      const BPP_MAP = [
        [426 * 240, 0.250, 0.350],
        [640 * 360, 0.200, 0.300],
        [854 * 480, 0.170, 0.250],
        [1280 * 720, 0.140, 0.200],
        [1920 * 1080, 0.110, 0.160],
        [2560 * 1440, 0.080, 0.120],
        [3840 * 2160, 0.060, 0.090],
      ];

      const [, vp9bpp, vp8bpp] = BPP_MAP.find(([maxPx]) => px <= maxPx) ?? BPP_MAP.at(-1);
      const videoBitsPerSecond = Math.round(width * height * fps * (isVP9 ? vp9bpp : vp8bpp));

      try {
        activeStream = video.captureStream();
      } catch (e) {
        console.warn('YTEE: captureStream failed', e);
        setBtnLabel(clipBtn, '✗ Error'); setTimeout(() => setBtnLabel(clipBtn, 'Clip'), 2000); return;
      }

      const chunks = [];
      let recorder;
      try {
        recorder = new MediaRecorder(activeStream, {
          mimeType,
          videoBitsPerSecond,
          audioBitsPerSecond: 192_000
        });
      } catch (e) {
        console.warn('YTEE: MediaRecorder init failed', e);
        activeStream.getTracks().forEach(t => t.stop()); activeStream = null;
        setBtnLabel(clipBtn, '✗ Error'); setTimeout(() => setBtnLabel(clipBtn, 'Clip'), 2000); return;
      }

      recorder.ondataavailable = (ev) => { if (ev.data && ev.data.size > 0) chunks.push(ev.data); };
      recorder.onstop = () => {
        if (chunks.length === 0) { setBtnLabel(clipBtn, '✗ Empty'); setTimeout(() => setBtnLabel(clipBtn, 'Clip'), 1500); return; }
        const blob = new Blob(chunks, { type: mimeType });
        const author = getVideoAuthor(getPlayer());
        const timestamp = formatTimestamp(video.currentTime);
        const objUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objUrl; a.download = `${author}_${timestamp}.webm`; a.click();
        URL.revokeObjectURL(objUrl);
        setBtnLabel(clipBtn, '✓ Saved!');
        setTimeout(() => setBtnLabel(clipBtn, 'Clip'), 2000);
      };
      recorder.onerror = (ev) => {
        console.warn('YTEE: MediaRecorder error', ev);
        stopClip(true); setBtnLabel(clipBtn, '✗ Error'); setTimeout(() => setBtnLabel(clipBtn, 'Clip'), 2000);
      };

      clipRecorder = recorder;
      recorder.start(200);
      clipBtn.classList.add('recording');
      setBtnLabel(clipBtn, 'Stop');

      const endTime = performance.now() + durationSec * 1000;
      const tick = () => {
        const remaining = endTime - performance.now();
        if (remaining <= 0) { stopClip(false); return; }
        const text = `REC ${(remaining / 1000).toFixed(1)}s`;
        if (clipOverlay.textContent !== text) clipOverlay.textContent = text;
        clipOverlay.classList.add('show');
        clipRafId = requestAnimationFrame(tick);
      };
      clipRafId = requestAnimationFrame(tick);
    };

    clipBtn.addEventListener('click', (e) => {
      if (clipRecorder) { stopClip(true); return; }
      const dur = e.ctrlKey ? (Number(currentSettings.clipDurationCtrl) || 300) : (Number(currentSettings.clipDuration) || 5);
      startClip(dur);
    });
    clipBtn.addEventListener('contextmenu', (e) => { e.preventDefault(); stopClip(true); });

    // PiP
    const pipSupported = document.pictureInPictureEnabled && typeof video.requestPictureInPicture === "function";
    const pipBtn = mkBtn('custom-pip-btn', 'pip', 'PiP', 'Picture-in-Picture', 'Picture-in-Picture');
    if (pipSupported) {
      pipBtn.addEventListener("click", async () => {
        try {
          if (document.pictureInPictureElement) await document.exitPictureInPicture();
          else await video.requestPictureInPicture();
        } catch (err) { console.error("PiP failed:", err); }
      });
    } else {
      pipBtn.style.display = "none";
    }

    // URL
    const urlBtn = mkBtn('custom-url-btn', 'url', 'URL', 'Copy URL (Ctrl+Click = with timestamp)', 'Copy Video URL');
    urlBtn.addEventListener("click", async (e) => {
      try {
        let videoId = "";
        const p = getPlayer();
        if (p && typeof p.getVideoData === 'function') { const data = p.getVideoData(); if (data && data.video_id) videoId = data.video_id; }
        if (!videoId) videoId = window.location.pathname.split('/').pop();
        let url = `https://youtu.be/${videoId}`;
        if (e.ctrlKey) url += `?t=${Math.floor(video.currentTime)}`;
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(url);
          setBtnLabel(urlBtn, '✓ Copied!');
          flashBtnState(urlBtn, 'success');
          setTimeout(() => setBtnLabel(urlBtn, 'URL', 'Copy URL (Ctrl+Click = with timestamp)'), 1500);
        }
      } catch (err) { console.error("Copy URL failed:", err); flashBtnState(urlBtn, 'error'); }
    });

    // Watch Later
    const wlBtn = mkBtn('custom-wl-btn', 'wl', 'WL', 'Watch Later', 'Save to Watch Later');
    let cachedApiKey = null, cachedContext = null;
    const INNERTUBE_CACHE_TTL = 24 * 60 * 60 * 1000;
    try {
      if (typeof GM_getValue === 'function') {
        const stored = GM_getValue('ytee-innertube', null);
        if (stored) {
          const parsed = JSON.parse(stored);
          const age = Date.now() - (parsed.savedAt || 0);
          if (age < INNERTUBE_CACHE_TTL && parsed.apiKey && parsed.context) { cachedApiKey = parsed.apiKey; cachedContext = parsed.context; }
        }
      }
    } catch (e) { console.warn('InnerTube cache read failed', e); }

    const sha1 = async (str) => {
      const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(str));
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
    };
    const getSapisid = () => { const m = document.cookie.match(/(?:^|;\s*)(?:__Secure-3PAPISID|SAPISID)=([^;]+)/); return m ? m[1] : null; };

    const getInnertubeConfig = async (videoId) => {
      if (cachedApiKey && cachedContext) return { apiKey: cachedApiKey, context: cachedContext };
      const localYtcfg = uw.ytcfg || (uw.yt && uw.yt.config_);
      if (localYtcfg && localYtcfg.get) {
        const key = localYtcfg.get("INNERTUBE_API_KEY"), ctx = localYtcfg.get("INNERTUBE_CONTEXT");
        if (key && ctx) {
          cachedApiKey = key; cachedContext = ctx;
          try { if (typeof GM_setValue === 'function') GM_setValue('ytee-innertube', JSON.stringify({ apiKey: key, context: ctx, savedAt: Date.now() })); } catch (e) { }
          return { apiKey: key, context: ctx };
        }
      }
      return new Promise((resolve, reject) => {
        if (typeof GM_xmlhttpRequest === "undefined") return reject(new Error("GM_xmlhttpRequest unavailable"));
        GM_xmlhttpRequest({
          method: "GET", url: `https://www.youtube.com/watch?v=${videoId}`,
          headers: { "Accept-Language": navigator.language || "en-US,en;q=0.9" },
          onload: (res) => {
            const m = res.responseText.match(/ytcfg\.set\s*\(({[\s\S]+?})\s*\)\s*;/);
            if (!m) return reject(new Error("ytcfg block not found"));
            try {
              const cfg = JSON.parse(m[1]);
              if (!cfg.INNERTUBE_API_KEY) return reject(new Error("INNERTUBE_API_KEY missing"));
              cachedApiKey = cfg.INNERTUBE_API_KEY; cachedContext = cfg.INNERTUBE_CONTEXT;
              try { if (typeof GM_setValue === 'function') GM_setValue('ytee-innertube', JSON.stringify({ apiKey: cachedApiKey, context: cachedContext, savedAt: Date.now() })); } catch (e) { }
              resolve({ apiKey: cachedApiKey, context: cachedContext });
            } catch (e) { reject(e); }
          },
          onerror: () => reject(new Error("Network error")),
        });
      });
    };

    const clearInnertubeCache = () => {
      cachedApiKey = null; cachedContext = null;
      try { if (typeof GM_setValue === 'function') GM_setValue('ytee-innertube', null); } catch (e) { }
    };

    wlBtn.addEventListener("click", async () => {
      try {
        setBtnLabel(wlBtn, '…');
        let videoId = "";
        const p = getPlayer();
        if (p && typeof p.getVideoData === 'function') { const data = p.getVideoData(); if (data && data.video_id) videoId = data.video_id; }
        if (!videoId) videoId = window.location.pathname.split('/').pop();
        if (!videoId) { setBtnLabel(wlBtn, '✗ Err'); setTimeout(() => setBtnLabel(wlBtn, 'WL'), 1500); return; }
        const sapisid = getSapisid();
        if (!sapisid) { setBtnLabel(wlBtn, '✗ Login'); setTimeout(() => setBtnLabel(wlBtn, 'WL'), 1500); return; }
        const attemptRequest = async () => {
          const { apiKey, context } = await getInnertubeConfig(videoId);
          const ts = Math.floor(Date.now() / 1000);
          const hashStr = await sha1(`${ts} ${sapisid} https://www.youtube.com`);
          const sapisidHash = `${ts}_${hashStr}`;
          const payload = { context, playlistId: "WL", actions: [{ addedVideoId: videoId, action: "ACTION_ADD_VIDEO" }] };
          return new Promise((resolve, reject) => {
            if (typeof GM_xmlhttpRequest !== "undefined") {
              GM_xmlhttpRequest({
                method: "POST",
                url: `https://www.youtube.com/youtubei/v1/browse/edit_playlist?key=${apiKey}&prettyPrint=false`,
                headers: { "Content-Type": "application/json", "X-Origin": "https://www.youtube.com", "X-Goog-AuthUser": "0", "Authorization": `SAPISIDHASH ${sapisidHash}` },
                data: JSON.stringify(payload),
                onload: (res) => resolve(res.status),
                onerror: () => reject(new Error("Network error")),
              });
            } else { reject(new Error("GM_xmlhttpRequest required")); }
          });
        };
        let status = await attemptRequest();
        if (status === 401 || status === 403) { clearInnertubeCache(); status = await attemptRequest(); }
        if (status === 200) { setBtnLabel(wlBtn, '✓ Saved'); flashBtnState(wlBtn, 'success'); } else { throw new Error(`HTTP ${status}`); }
        setTimeout(() => setBtnLabel(wlBtn, 'WL'), 1500);
      } catch (err) { console.error("Watch Later failed:", err); setBtnLabel(wlBtn, '✗ Err'); flashBtnState(wlBtn, 'error'); setTimeout(() => setBtnLabel(wlBtn, 'WL'), 1500); }
    });

    // Settings Modal
    const settingsBtn = mkBtn('custom-settings-btn', 'settings', 'Settings', 'Settings', 'Settings');
    const settingsModal = document.createElement("div");
    settingsModal.id = "custom-settings-modal";
    let isSettingsOpen = false;
    const settingsContent = document.createElement("div");
    settingsContent.id = "custom-settings-content";
    const settingsTitle = Object.assign(document.createElement("h2"), { textContent: "YouTube Embed Enhancer" });
    const settingsSubtitle = Object.assign(document.createElement("p"), { id: "ytee-settings-subtitle", textContent: "Customize your embed experience" });
    const settingsItems = Object.assign(document.createElement("div"), { id: "custom-settings-items" });
    const settingsButtons = Object.assign(document.createElement("div"), { id: "custom-settings-buttons" });
    const restoreBtn = Object.assign(document.createElement("button"), { id: "custom-settings-restore", textContent: "Restore defaults" });
    const cancelBtn = Object.assign(document.createElement("button"), { id: "custom-settings-cancel", textContent: "Cancel" });
    const saveBtn = Object.assign(document.createElement("button"), { id: "custom-settings-save", textContent: "Save" });
    settingsButtons.append(restoreBtn, cancelBtn, saveBtn);
    settingsContent.append(settingsTitle, settingsSubtitle, settingsItems, settingsButtons);
    settingsModal.appendChild(settingsContent);
    document.body.appendChild(settingsModal);

    const mkToggleRow = (id, labelText, checked) => {
      const div = Object.assign(document.createElement('div'), { className: 'setting-item' });
      const wrap = Object.assign(document.createElement('div'), { className: 'ytee-toggle-wrap' });
      const cb = Object.assign(document.createElement('input'), { type: 'checkbox', id, checked });
      const track = Object.assign(document.createElement('label'), { className: 'ytee-toggle-track', htmlFor: id });
      track.appendChild(Object.assign(document.createElement('span'), { className: 'ytee-toggle-thumb' }));
      wrap.append(cb, track);
      const label = Object.assign(document.createElement('label'), { htmlFor: id, textContent: labelText });
      div.append(label, wrap);
      return div;
    };

    const showSettingsModal = () => {
      const items = settingsItems;
      while (items.firstChild) items.removeChild(items.firstChild);

      // Playback Quality
      const sectionQ = Object.assign(document.createElement('h3'), { className: 'setting-section-title', textContent: 'Playback Quality' });
      items.appendChild(sectionQ);
      const qualityDiv = Object.assign(document.createElement('div'), { className: 'setting-item' });
      const qualityLabel = Object.assign(document.createElement('label'), { htmlFor: 'preferred-quality', textContent: 'Preferred quality' });
      const qualitySelect = Object.assign(document.createElement('select'), { id: 'preferred-quality', className: 'ytee-quality-select' });
      const p = getPlayer();
      let availableLevels = [];
      if (p && typeof p.getAvailableQualityLevels === 'function') availableLevels = p.getAvailableQualityLevels().filter(q => q !== 'auto' && q !== 'unknown');
      if (availableLevels.length === 0) availableLevels = QUALITY_ORDER.slice();
      qualitySelect.appendChild(Object.assign(document.createElement('option'), { value: 'auto', textContent: QUALITY_LABELS['auto'] }));
      availableLevels.forEach(level => qualitySelect.appendChild(Object.assign(document.createElement('option'), { value: level, textContent: QUALITY_LABELS[level] || level })));
      qualitySelect.value = currentSettings.preferredQuality || 'auto';
      if (!qualitySelect.value) qualitySelect.value = 'auto';
      qualityDiv.append(qualityLabel, qualitySelect);
      items.appendChild(qualityDiv);
      items.appendChild(Object.assign(document.createElement('div'), { className: 'ytee-quality-note', textContent: 'Applies to all embeds instantly. Falls back to closest available level.' }));

      // Volume
      const sectionVol = Object.assign(document.createElement('h3'), { className: 'setting-section-title', textContent: 'Volume' });
      items.appendChild(sectionVol);
      const boostToggleRow = mkToggleRow('ytee-enable-volume-boost', 'Enable volume boost', currentSettings.enableVolumeBoost);
      items.appendChild(boostToggleRow);
      const boostToggleInput = boostToggleRow.querySelector('input');

      const volBoostDiv = Object.assign(document.createElement('div'), { className: 'setting-item' });
      const volBoostLabel = Object.assign(document.createElement('label'), { htmlFor: 'volume-boost-level', textContent: 'Boost level' });
      const volBoostInput = Object.assign(document.createElement('input'), { type: 'range', id: 'volume-boost-level', min: '1.0', max: '3.0', step: '0.1', value: currentSettings.volumeBoostLevel });
      volBoostInput.style.width = '140px';
      const volBoostValue = Object.assign(document.createElement('span'), { className: 'ytee-slider-value', textContent: `${Number(currentSettings.volumeBoostLevel).toFixed(1)}x` });
      volBoostInput.addEventListener('input', () => { volBoostValue.textContent = `${Number(volBoostInput.value).toFixed(1)}x`; });

      const updateBoostState = () => {
        const enabled = boostToggleInput.checked;
        volBoostInput.disabled = !enabled;
        volBoostDiv.style.opacity = enabled ? '1' : '0.4';
        volBoostDiv.style.filter = enabled ? '' : 'grayscale(1)';
        volBoostDiv.style.pointerEvents = enabled ? 'auto' : 'none';
      };
      boostToggleInput.addEventListener('change', updateBoostState);

      volBoostDiv.append(volBoostLabel, volBoostInput, volBoostValue);
      items.appendChild(volBoostDiv);
      updateBoostState();

      // Clip Recording
      const sectionClip = Object.assign(document.createElement('h3'), { className: 'setting-section-title', textContent: 'Clip Recording' });
      items.appendChild(sectionClip);

      const clipDurDiv = Object.assign(document.createElement('div'), { className: 'setting-item' });
      const clipDurLabel = Object.assign(document.createElement('label'), { htmlFor: 'clip-duration', textContent: 'Duration (seconds)' });
      const clipDurInput = Object.assign(document.createElement('input'), { type: 'range', id: 'clip-duration', min: '1', max: '300', step: '1', value: currentSettings.clipDuration });
      clipDurInput.style.width = '140px';
      const clipDurValue = Object.assign(document.createElement('span'), { className: 'ytee-slider-value', textContent: `${currentSettings.clipDuration}s` });
      clipDurInput.addEventListener('input', () => { clipDurValue.textContent = `${clipDurInput.value}s`; });
      clipDurDiv.append(clipDurLabel, clipDurInput, clipDurValue);
      items.appendChild(clipDurDiv);

      const clipCtrlDiv = Object.assign(document.createElement('div'), { className: 'setting-item' });
      const clipCtrlLabel = Object.assign(document.createElement('label'), { htmlFor: 'clip-duration-ctrl', textContent: 'Ctrl+Click duration (seconds)' });
      const clipCtrlInput = Object.assign(document.createElement('input'), { type: 'range', id: 'clip-duration-ctrl', min: '1', max: '300', step: '1', value: currentSettings.clipDurationCtrl });
      clipCtrlInput.style.width = '140px';
      const clipCtrlValue = Object.assign(document.createElement('span'), { className: 'ytee-slider-value', textContent: `${currentSettings.clipDurationCtrl}s` });
      clipCtrlInput.addEventListener('input', () => { clipCtrlValue.textContent = `${clipCtrlInput.value}s`; });
      clipCtrlDiv.append(clipCtrlLabel, clipCtrlInput, clipCtrlValue);
      items.appendChild(clipCtrlDiv);
      items.appendChild(Object.assign(document.createElement('div'), { className: 'setting-note', textContent: 'Higher resolutions require more system resources.' }));

      // Hotkeys
      const hotkeyNames = {
        toggleMute: 'Toggle Mute', toggleStats: 'Toggle Stats',
        increaseSpeed: 'Increase Speed', decreaseSpeed: 'Decrease Speed',
        increaseSpeedFine: 'Increase Speed (fine)', decreaseSpeedFine: 'Decrease Speed (fine)',
        volumeUp: 'Volume Up', volumeDown: 'Volume Down',
      };
      const sectionHK = Object.assign(document.createElement('h3'), { className: 'setting-section-title', textContent: 'Hotkeys' });
      items.appendChild(sectionHK);
      Object.keys(hotkeyNames).forEach(key => {
        const div = Object.assign(document.createElement('div'), { className: 'setting-item' });
        const input = Object.assign(document.createElement('input'), { type: 'text', id: `hk-${key}`, value: currentSettings.hotkeys[key], className: 'hk-input' });
        input.addEventListener('blur', () => { input.value = sanitizeHotkeyInput(input.value); });
        const label = Object.assign(document.createElement('label'), { htmlFor: `hk-${key}`, textContent: hotkeyNames[key] });
        div.append(label, input);
        items.appendChild(div);
      });

      // Appearance
      const sectionUI = Object.assign(document.createElement('h3'), { className: 'setting-section-title', textContent: 'Appearance' });
      items.appendChild(sectionUI);
      items.appendChild(mkToggleRow('ytee-compact-mode', 'Compact icon mode (hides text labels)', currentSettings.compactMode));
      items.appendChild(Object.assign(document.createElement('div'), { className: 'setting-note', textContent: 'Compact mode saves space in multi-stream layouts by hiding text labels.' }));
      items.appendChild(mkToggleRow('ytee-high-contrast', 'High Contrast Mode', currentSettings.highContrastUI));
      items.appendChild(Object.assign(document.createElement('div'), { className: 'setting-note', textContent: 'Uses solid backgrounds for buttons.' }));

      // Button Visibility
      const sectionBtns = Object.assign(document.createElement('h3'), { className: 'setting-section-title', textContent: 'Button Visibility' });
      items.appendChild(sectionBtns);
      const buttonNames = {
        wl: 'Watch Later', url: 'Copy URL', screenshot: 'Screenshot',
        clip: 'Clip', pip: 'Picture-in-Picture (Firefox unsupported)',
        speed: 'Playback Speed', stats: 'Stats for Nerds',
      };
      Object.keys(buttonNames).forEach(key => items.appendChild(mkToggleRow(`btn-${key}`, buttonNames[key], currentSettings.buttons[key])));

      settingsModal.classList.add('show');
      isSettingsOpen = true;
    };

    const hideSettingsModal = () => { settingsModal.classList.remove('show'); isSettingsOpen = false; };

    settingsBtn.addEventListener('click', showSettingsModal);
    cancelBtn.addEventListener('click', hideSettingsModal);

    restoreBtn.addEventListener('click', () => {
      currentSettings = JSON.parse(JSON.stringify(defaultSettings));
      applyUIStates(currentSettings);
      if (settingsModal.classList.contains('show')) showSettingsModal();
      restoreBtn.textContent = 'Restored!'; restoreBtn.disabled = true;
      setTimeout(() => { restoreBtn.textContent = 'Restore defaults'; restoreBtn.disabled = false; }, 1000);
    });

    saveBtn.addEventListener('click', () => {
      const newSettings = { buttons: {}, hotkeys: {} };
      Object.keys(currentSettings.buttons).forEach(key => { newSettings.buttons[key] = document.getElementById(`btn-${key}`).checked; });
      Object.keys(currentSettings.hotkeys).forEach(key => { newSettings.hotkeys[key] = sanitizeHotkeyInput(document.getElementById(`hk-${key}`).value); });
      newSettings.volumeBoostLevel = Number(document.getElementById('volume-boost-level').value) || 1;
      newSettings.enableVolumeBoost = document.getElementById('ytee-enable-volume-boost').checked;
      newSettings.clipDuration = Math.min(300, Math.max(1, Number(document.getElementById('clip-duration').value) || 5));
      newSettings.clipDurationCtrl = Math.min(300, Math.max(1, Number(document.getElementById('clip-duration-ctrl').value) || 300));
      newSettings.preferredQuality = document.getElementById('preferred-quality').value || 'auto';
      newSettings.compactMode = document.getElementById('ytee-compact-mode').checked;
      newSettings.highContrastUI = document.getElementById('ytee-high-contrast').checked;
      currentSettings = newSettings;
      saveStoredSettings(currentSettings);
      buildHotkeyMap();
      applyVolume(targetVolume);
      applyQuality();
      applyUIStates(currentSettings);
      updateButtonVisibility();
      saveBtn.textContent = 'Saved'; saveBtn.disabled = true;
      setTimeout(() => { hideSettingsModal(); saveBtn.textContent = 'Save'; saveBtn.disabled = false; }, 350);
    });

    const updateButtonVisibility = () => {
      const buttonMap = { wl: wlBtn, url: urlBtn, screenshot: screenshotBtn, clip: clipBtn, pip: pipBtn, speed: speedBtn, stats: statsBtn };
      Object.keys(buttonMap).forEach(key => { buttonMap[key].style.display = currentSettings.buttons[key] ? '' : 'none'; });
    };

    // Hotkeys
    const SHIFTED_SYMBOL_MAP = {
      '!': '1', '@': '2', '#': '3', '$': '4', '%': '5', '^': '6', '&': '7', '*': '8', '(': '9', ')': '0',
      '~': '`', '_': '-', '+': '=', '{': '[', '}': ']', '|': '\\', ':': ';', '"': "'", '<': ',', '>': '.', '?': '/'
    };

    const sanitizeHotkeyInput = (value) => {
      if (!value || typeof value !== 'string') return '';
      let cleaned = value.trim().toLowerCase().replace(/\s*\+\s*/g, '+');
      const parts = cleaned.split('+').filter(Boolean);
      let modifiers = []; let key = '';

      parts.forEach(part => {
        if (['shift', 'ctrl', 'alt'].includes(part)) {
          if (!modifiers.includes(part)) modifiers.push(part);
        } else if (!key) key = part;
      });

      if (SHIFTED_SYMBOL_MAP[key]) {
        key = SHIFTED_SYMBOL_MAP[key];
        if (!modifiers.includes('shift')) modifiers.push('shift');
      }

      if (!key) return '';
      return [...modifiers.sort(), key].join('+');
    };

    const normalizeHotkey = (hk) => {
      const sanitized = sanitizeHotkeyInput(hk);
      if (!sanitized) return { key: '', modifiers: { shift: false, ctrl: false, alt: false } };
      const parts = sanitized.split('+');
      const key = parts.pop();
      const modifiers = {
        shift: parts.includes('shift'),
        ctrl: parts.includes('ctrl'),
        alt: parts.includes('alt')
      };
      return { key, modifiers };
    };

    const getHotkeyCombos = ({ key, modifiers }) => {
      const mods = (modifiers.ctrl ? 'ctrl+' : '') + (modifiers.alt ? 'alt+' : '') + (modifiers.shift ? 'shift+' : '');
      const combos = [mods + key];
      if (modifiers.shift) {
        const shiftedKey = Object.keys(SHIFTED_SYMBOL_MAP).find(k => SHIFTED_SYMBOL_MAP[k] === key);
        if (shiftedKey) {
          const baseMods = (modifiers.ctrl ? 'ctrl+' : '') + (modifiers.alt ? 'alt+' : '');
          combos.push(baseMods + shiftedKey);
        }
      }
      return combos;
    };

    const hotkeyMap = {};
    const buildHotkeyMap = () => {
      Object.keys(hotkeyMap).forEach(k => delete hotkeyMap[k]);
      Object.keys(currentSettings.hotkeys).forEach(action => {
        getHotkeyCombos(normalizeHotkey(currentSettings.hotkeys[action])).forEach(combo => {
          hotkeyMap[combo] = action;
        });
      });
    };
    buildHotkeyMap();

    window.addEventListener("keydown", (e) => {
      if (isSettingsOpen) {
        if (e.key === "Escape") { hideSettingsModal(); e.preventDefault(); e.stopImmediatePropagation(); }
        return;
      }
      const isShiftedSym = e.shiftKey && (e.key in SHIFTED_SYMBOL_MAP);
      const combo = [
        e.altKey ? 'alt+' : '',
        e.ctrlKey ? 'ctrl+' : '',
        e.shiftKey && !isShiftedSym ? 'shift+' : '',
        e.key.toLowerCase()
      ].join('');

      const action = hotkeyMap[combo];
      if (action) {
        e.stopImmediatePropagation(); e.preventDefault();
        switch (action) {
          case 'toggleMute': toggleMute(); break;
          case 'toggleStats': toggleStats(); break;
          case 'increaseSpeed': applySpeed(targetSpeed + SPEED_STEP); break;
          case 'decreaseSpeed': applySpeed(targetSpeed - SPEED_STEP); break;
          case 'increaseSpeedFine': applySpeed(targetSpeed + SPEED_STEP_FINE); break;
          case 'decreaseSpeedFine': applySpeed(targetSpeed - SPEED_STEP_FINE); break;
          case 'volumeUp': applyVolume(targetVolume + 0.05); break;
          case 'volumeDown': applyVolume(targetVolume - 0.05); break;
        }
        showControls();
      }
    }, true);

    const btnGroup = document.createElement("div");
    btnGroup.id = "custom-btn-group";
    btnGroup.append(wlBtn, urlBtn, screenshotBtn, clipBtn, pipBtn, speedBtn, statsBtn, settingsBtn);
    updateButtonVisibility();

    let isHoveringBtnGroup = false;
    btnGroup.addEventListener("mouseenter", () => { isHoveringBtnGroup = true; });
    btnGroup.addEventListener("mouseleave", () => { isHoveringBtnGroup = false; });

    const ALL_CONTROLS = [muteBtn, vol, btnGroup];
    let controlsVisible = false, lastInteractionTime = 0;

    const checkHideControls = () => {
      if (Date.now() - lastInteractionTime >= 2000 && !isHoveringBtnGroup) {
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

    window.addEventListener("mousemove", () => {
      if (rafPending) return;
      rafPending = requestAnimationFrame(() => { showControls(); rafPending = 0; });
    });
    showControls();

    window.addEventListener("dblclick", (e) => {
      if (isSettingsOpen) return;
      if (e.target.closest("#custom-btn-group, #custom-mute-btn, #custom-vol-slider")) return;
      if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => { });
      else if (document.exitFullscreen) document.exitFullscreen();
    });

    const initUI = () => {
      document.body.prepend(volPct, speedOverlay, clipOverlay, miniStats, vol, muteBtn, btnGroup);
    };
    initUI();

    // Cleanup
    const updateEmbedWidth = () => {
      const w = document.documentElement.clientWidth || window.innerWidth;
      document.documentElement.style.setProperty('--ytee-ew', w + 'px');
    };
    updateEmbedWidth();
    const resizeObs = new ResizeObserver(updateEmbedWidth);
    resizeObs.observe(document.documentElement);

    if (typeof GM_addValueChangeListener === 'function') {
      GM_addValueChangeListener('ytee-settings', (name, oldVal, newVal, remote) => {
        if (remote) {
          try {
            currentSettings = normalizeSettings(typeof newVal === 'string' ? JSON.parse(newVal) : newVal);
            updateButtonVisibility();
            buildHotkeyMap();
            applyQuality();
            applyUIStates(currentSettings);
          } catch (e) { console.warn('Failed to sync settings', e); }
        }
      });
    }

    const cleanup = () => {
      clearTimeout(volTimeout); clearTimeout(speedTimeout); clearTimeout(controlsTimeout); clearTimeout(miniStatsTimer);
      if (clipRafId) cancelAnimationFrame(clipRafId);
      if (rafPending) cancelAnimationFrame(rafPending);
      if (wheelRafId) cancelAnimationFrame(wheelRafId);
      rafPending = 0; clipRafId = null; wheelRafId = 0;
      if (clipRecorder) { try { if (clipRecorder.state !== 'inactive') clipRecorder.stop(); } catch (e) { } clipRecorder = null; }
      if (activeStream) { activeStream.getTracks().forEach(t => t.stop()); activeStream = null; }
      if (audioContext) { audioContext.close().catch(() => { }); audioContext = null; gainNode = null; mediaSource = null; }
      cachedPlayer = null;
      resizeObs.disconnect();
    };
    window.addEventListener('pagehide', cleanup);

  });
})();