// ==UserScript==
// @name         YouTube Embed Enhancer
// @namespace    https://github.com/jmpatag
// @version      2.6.1
// @description  Restores volume control and adds a versatile toolkit for real-time diagnostics, video clipping, screenshots, and persistent playback customization.
// @author       jmpatag
// @license      GPL-3.0
// @match        *://www.youtube.com/embed/*
// @match        *://www.youtube-nocookie.com/embed/*
// @match        *://www.nexusmods.com/*
// @run-at       document-idle
// @require      https://cdn.jsdelivr.net/gh/jmpatag/YouTube-Embed-Enhancer@4b37492ff33452b3fa3f4a27cd104c99d4761587/mediabunny.min.js
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addValueChangeListener
// @grant        GM_xmlhttpRequest
// @connect      holodex.net
// @connect      www.youtube.com
// @grant        unsafeWindow
// @downloadURL https://update.greasyfork.org/scripts/572481/YouTube%20Embed%20Enhancer.user.js
// @updateURL https://update.greasyfork.org/scripts/572481/YouTube%20Embed%20Enhancer.meta.js
// ==/UserScript==

(() => {
  "use strict";

  if (window.self === window.top) {
    const fixIframes = () => {
      document.querySelectorAll('iframe[src*="youtube.com/embed"]').forEach(iframe => {
        if (!iframe.hasAttribute('allowfullscreen')) iframe.setAttribute('allowfullscreen', '');
        const allow = iframe.getAttribute('allow') || '';
        if (!allow.includes('fullscreen')) iframe.setAttribute('allow', (allow ? allow + '; ' : '') + 'fullscreen');
      });
    };
    fixIframes();
    new MutationObserver(fixIframes).observe(document.documentElement, { childList: true, subtree: true });

    window.addEventListener('message', (e) => {
      if (e.data?.type === 'YTEE_REQUEST_FULLSCREEN') {
        const iframes = document.querySelectorAll('iframe');
        for (const f of iframes) {
          if (f.contentWindow === e.source) {
            if (document.fullscreenElement) document.exitFullscreen().catch(() => { });
            else f.requestFullscreen().catch(err => console.warn('YTEE: Parent fullscreen failed', err));
            break;
          }
        }
      }
    });

    document.addEventListener('dblclick', (e) => {
      const iframe = e.target.closest('iframe[src*="youtube.com/embed"]')
        ?? document.querySelector('iframe[src*="youtube.com/embed"]');
      if (!iframe) return;
      if (document.fullscreenElement) document.exitFullscreen().catch(() => { });
      else iframe.requestFullscreen().catch(() => { });
    }, { passive: true });
    return;
  }

  const isControlsDisabled = new URLSearchParams(window.location.search).get("controls") === "0";
  const isPlayButtonMissing = !document.querySelector(".ytp-play-button");
  const isChat = () => {
    const href = window.location.href.toLowerCase();
    if (href.includes('live_chat') || href.includes('livechat') || href.includes('chat_replay') || href.includes('is_chat=1')) return true;
    if (document.querySelector('yt-live-chat-renderer, yt-live-chat-app, #chat-messages, #live-chat-frame')) return true;
    if (document.documentElement.classList.contains('yt-live-chat-app') || (window.name && window.name.toLowerCase().includes('chat'))) return true;

    // removing this for now
    // if (window.innerWidth < 400 && window.innerHeight > window.innerWidth) return true;

    return false;
  };

  if (isChat()) return;

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
  --ytee-btn-size: clamp(25.5px, calc(var(--ytee-ew) * 0.04), 37.5px);
  --ytee-icon-size: clamp(15px, calc(var(--ytee-ew) * 0.0225), 21px);
  --ytee-font-size: clamp(11px,  calc(var(--ytee-ew) * 0.0175), 15px);
  --ytee-gap: clamp(2.5px,  calc(var(--ytee-ew) * 0.00375), 5px);

  --ytee-bg-dark: rgba(15, 15, 15, 0.95);
  --ytee-bg-medium: rgba(30, 30, 30, 0.85);
  --ytee-btn-bg: rgba(255,255,255,0.08);
  --ytee-btn-border: rgba(255,255,255,0.13);
  --ytee-btn-hover: rgba(255,255,255,0.19);
  --ytee-text: rgba(255,255,255,0.92);

  --ytee-accent: #10b981;
  --ytee-accent-rgb: 16, 185, 129;
  --ytee-stats-color: #ffd700;
  --ytee-stats-bg: rgba(255,215,0,0.14);
  --ytee-stats-border: rgba(255,215,0,0.55);

  --ytee-speed-color: #7ddeff;
  --ytee-speed-bg: rgba(119,221,255,0.12);
  --ytee-speed-border: rgba(119,221,255,0.55);

  --ytee-rec-bg: rgba(255,68,68,0.15);
  --ytee-rec-border: rgba(255,68,68,0.65);

  --ytee-anim-fast: 0.1s cubic-bezier(0.4,0,0.2,1);
  --ytee-anim-normal: 0.2s cubic-bezier(0.4,0,0.2,1);
  --ytee-anim-slow: 0.3s cubic-bezier(0.4,0,0.2,1);
  --ytee-radius: 12px;
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

/* Instant Replay indicator */
#custom-replay-overlay {
  position: fixed;
  top: clamp(160px,28vh,300px);
  left: 50%;
  transform: translateX(-50%);
  background: rgba(80,0,160,0.82);
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
#custom-replay-overlay.show { opacity: 1; transition: opacity var(--ytee-anim-fast); }

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
  cursor: grab;
  transition: opacity var(--ytee-anim-slow), transform var(--ytee-anim-fast);
  white-space: nowrap;
  display: flex;
  gap: 12px;
}
#custom-mini-stats.show { opacity: 1; pointer-events: auto; }
#custom-mini-stats:active { cursor: grabbing; transform: scale(1.02); }
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
#custom-btn-group.collapsed .ytee-collapsible { display: none !important; }
#custom-btn-group.collapsed { gap: 4px; }

/* Shared button base */
.ytee-btn {
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
  width: var(--ytee-btn-size);
  height: var(--ytee-btn-size);
  padding: 0;
}
#custom-btn-group.show .ytee-btn, #custom-toggle-btn, #custom-settings-btn { opacity: 1; pointer-events: auto; }
.ytee-btn:hover { background: var(--ytee-btn-hover) !important; transform: scale(1.08); z-index: 10; }

/* Speed keeps auto width for the rate text */
#custom-speed-btn { width: auto; min-width: var(--ytee-btn-size); padding: 0 clamp(3px,calc(var(--ytee-ew) * 0.004),7px); }

/* SVG icons inside each button */
.ytee-btn .ytee-icon { display: flex; }

/* Label spans — hidden in icon mode */
.ytee-btn .ytee-label { display: none; }

/* Tooltips — shown in icon mode only */
.ytee-btn:not([data-tip])::after, .ytee-btn[data-tip=""]::after { display: none !important; }
.ytee-btn::after {
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
.ytee-btn:hover::after { opacity: 1; }

/* Label mode */
[data-ytee-labels="1"] .ytee-btn { width: auto; padding: 0 clamp(6px,calc(var(--ytee-ew) * 0.009),13px); }
[data-ytee-labels="1"] .ytee-btn .ytee-label { display: inline; }
[data-ytee-labels="1"] .ytee-btn .ytee-icon { display: flex; }

/* Force icon-only for specific buttons */
#custom-settings-btn, #custom-toggle-btn { width: var(--ytee-btn-size) !important; padding: 0 !important; }
#custom-settings-btn .ytee-label, #custom-toggle-btn .ytee-label { display: none !important; }

/* State colors */
#custom-stats-btn.active {
  color: var(--ytee-stats-color) !important;
  background: var(--ytee-stats-bg) !important;
  border-color: var(--ytee-stats-border) !important;
}
#custom-stats-btn.active svg { fill: var(--ytee-stats-color); }

#custom-stats-btn.nerds-active {
  color: #7ddeff !important;
  background: rgba(119,221,255,0.12) !important;
  border-color: rgba(119,221,255,0.55) !important;
}
#custom-stats-btn.nerds-active svg { fill: #7ddeff; }

/* When both are active, prioritize Mini Stats background but keep blue icon/text for Nerds (or vice-versa) */
#custom-stats-btn.active.nerds-active {
  background: var(--ytee-stats-bg) !important;
  border-color: #7ddeff !important;
  color: #7ddeff !important;
}
#custom-stats-btn.active.nerds-active svg { fill: #7ddeff; }

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

/* Instant Replay button — purple pulse when buffer is filling */
@keyframes ytee-replay-pulse {
  0%,100% { box-shadow: 0 0 0 0 rgba(160,80,255,0.7); }
  50%      { box-shadow: 0 0 0 5px rgba(160,80,255,0); }
}
#custom-replay-btn.buffering {
  color: #c084fc !important;
  background: rgba(160,80,255,0.15) !important;
  border-color: rgba(160,80,255,0.65) !important;
  animation: ytee-replay-pulse 2s ease-in-out infinite;
}
#custom-replay-btn.buffering svg { fill: #c084fc; }

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

#custom-settings-modal {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.82);
  backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  z-index: 10000; display: none;
  align-items: center; justify-content: center;
}
#custom-settings-modal.show { display: flex; }
#custom-settings-content {
  background: #1e1e1e;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 18px;
  padding: 0;
  width: min(560px, 94vw);
  max-height: 85vh;
  display: flex; flex-direction: column;
  overflow: hidden;
  color: white;
  font-family: system-ui, -apple-system, sans-serif;
  box-shadow: 0 40px 100px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.02) inset;
  animation: ytee-modal-in 0.28s cubic-bezier(0.16, 1, 0.3, 1) both;
}

#ytee-settings-header {
  padding: 18px 24px 12px;
  display: flex; justify-content: space-between; align-items: flex-start;
}
#ytee-settings-header div:first-child { flex: 1; }
#custom-settings-content h2 { margin:0; font-size:18px; font-weight:750; color:#fff; letter-spacing:-0.01em; }
#ytee-settings-subtitle { font-size:11.5px; color:rgba(255,255,255,0.45); margin:2px 0 0; }

/* Tabs */
#ytee-settings-tabs {
  display: flex; padding: 0 16px; gap: 4px;
  border-bottom: 1px solid rgba(255,255,255,0.07);
}
.ytee-tab {
  padding: 10px 15px; font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.4);
  cursor: pointer; border-bottom: 3px solid transparent; transition: all 0.25s;
  user-select: none; display: flex; align-items: center; gap: 6px; border-radius: 8px 8px 0 0;
}
.ytee-tab .ytee-icon svg { width: 14px; height: 14px; }
.ytee-tab .ytee-icon { opacity: 0.5; transition: opacity 0.25s; transform: scale(0.9); }
.ytee-tab:hover { color: rgba(255,255,255,0.8); background: rgba(255,255,255,0.04); }
.ytee-tab.active { color: var(--ytee-accent); border-bottom-color: var(--ytee-accent); }
.ytee-tab.active .ytee-icon { opacity: 1; color: var(--ytee-accent); transform: scale(1); }

#custom-settings-items {
  flex: 1; overflow-y: auto; padding: 14px 24px;
  scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.15) transparent;
}
#custom-settings-items::-webkit-scrollbar { width: 5px; }
#custom-settings-items::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.15); border-radius:10px; }

.ytee-tab-content { display: none; }
.ytee-tab-content.active { display: block; animation: ytee-modal-in 0.25s ease-out; }

#custom-settings-content h3.setting-section-title {
  margin: 10px 0 10px; font-size: 10px; font-weight: 800;
  color: rgba(255,255,255,0.3); text-transform: uppercase; letter-spacing: 0.15em;
}

#custom-settings-content .setting-item {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 12px 16px; margin-bottom: 8px; border-radius: 12px;
  background: #282828; border: 1px solid rgba(255,255,255,0.03);
  transition: all 0.2s;
}
#custom-settings-content .setting-item:hover { background: #2d2d2d; border-color: rgba(255,255,255,0.08); }

.setting-text { flex: 1; display: flex; flex-direction: column; gap: 1px; }
.setting-title { font-size: 13.5px; font-weight: 700; color: #fff; cursor: pointer; }
.setting-desc { font-size: 11px; color: rgba(255,255,255,0.4); line-height: 1.3; }

.ytee-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px; }
.ytee-grid-2 .setting-item { margin-bottom: 0; padding: 10px 14px; }

.ytee-toggle-wrap { position:relative; width:44px; height:24px; flex-shrink:0; }
.ytee-toggle-wrap input { opacity:0; width:0; height:0; position:absolute; }
.ytee-toggle-track {
  position:absolute; inset:0; border-radius:99px;
  background:rgba(255,255,255,0.12); transition: all 0.25s ease; cursor:pointer;
}
.ytee-toggle-thumb {
  position:absolute; top:4px; left:4px; width:16px; height:16px; border-radius:50%;
  background:#fff; transition: all 0.25s cubic-bezier(0.23, 1, 0.32, 1);
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}
.ytee-toggle-wrap input:checked ~ .ytee-toggle-track { background: var(--ytee-accent); }
.ytee-toggle-wrap input:checked ~ .ytee-toggle-track .ytee-toggle-thumb { transform:translateX(20px); }

#custom-settings-content .hk-input, #custom-settings-content .ytee-quality-select {
  width: 120px; padding: 8px 12px;
  background: #1a1a1a; border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px; color: #fff; font-size: 12.5px; font-weight: 600;
  font-family: ui-monospace, monospace; transition: all 0.2s; text-align: right;
}
#custom-settings-content .hk-input:focus, #custom-settings-content .ytee-quality-select:focus {
  outline:none; border-color:var(--ytee-accent); background: #222;
  box-shadow: 0 0 0 3px rgba(var(--ytee-accent-rgb), 0.15);
}

#custom-settings-content input[type="range"] {
  -webkit-appearance:none; appearance:none; height:4px; border-radius:99px;
  background:rgba(255,255,255,0.1); outline:none; cursor:pointer; width: 140px;
}
#custom-settings-content input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance:none; width:16px; height:16px; border-radius:50%; background:#fff;
  box-shadow: 0 2px 5px rgba(0,0,0,0.4); transition: transform 0.15s;
}
#custom-settings-content input[type="range"]:hover::-webkit-slider-thumb { transform: scale(1.15); }

.ytee-slider-value { font-size: 13px; font-weight: 700; color: rgba(255,255,255,0.6); min-width: 32px; text-align: right; }

#custom-settings-buttons {
  display:flex; align-items:center; justify-content:flex-end; gap:10px;
  padding:16px 24px; background: rgba(0,0,0,0.15); border-top:1px solid rgba(255,255,255,0.06);
}
#custom-settings-restore {
  margin-right:auto; padding:8px 14px; background:transparent; border:1px solid rgba(255,255,255,0.1);
  border-radius:8px; color:rgba(255,255,255,0.6); cursor:pointer; font-size:12.5px; font-weight:600;
  transition: all 0.2s;
}
#custom-settings-restore:hover { background:rgba(255,255,255,0.05); color:#fff; border-color:rgba(255,255,255,0.2); }

#custom-settings-cancel, #custom-settings-save {
  padding:8px 18px; border-radius:8px; font-size:13.5px; font-weight:700; cursor:pointer; transition: all 0.2s;
}
#custom-settings-cancel { background:rgba(255,255,255,0.06); border:none; color:rgba(255,255,255,0.85); }
#custom-settings-cancel:hover { background:rgba(255,255,255,0.12); color:#fff; }

#custom-settings-save {
  background: var(--ytee-accent); border: none; color: #000;
}
#custom-settings-save:hover { opacity: 0.9; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(var(--ytee-accent-rgb), 0.3); }

.ytee-quality-select { cursor: pointer; appearance: none; -webkit-appearance: none; background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' fill='rgba(255,255,255,0.4)'><path d='M0 0l5 6 5-6z'/></svg>"); background-repeat: no-repeat; background-position: right 14px center; padding-right: 36px !important; }
.ytee-quality-select option { background:#1a1a22; color:white; }
.ytee-quality-select:focus { outline:none; background-color:rgba(119,221,255,0.06); border-color:rgba(119,221,255,0.5); box-shadow:0 0 0 3px rgba(119,221,255,0.1); }
.ytee-quality-select option { background:#1a1a22; color:white; }
.ytee-quality-note { display:block; font-size:11px; color:rgba(255,255,255,0.3); margin:4px 14px 12px; line-height:1.4; font-style:italic; }

/* Info Button and Box */
.ytee-info-btn {
  display: flex; align-items: center; justify-content: center;
  width: 18px; height: 18px; border-radius: 50%;
  background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12);
  color: rgba(255,255,255,0.4); cursor: pointer; transition: all 0.15s;
  flex-shrink: 0;
}
.ytee-info-btn:hover { background: rgba(119,221,255,0.12); border-color: rgba(119,221,255,0.35); color: #7ddeff; }
.ytee-info-box {
  margin: 4px 10px 14px; padding: 12px 14px;
  background: rgba(15, 15, 20, 0.45); border: 1px solid rgba(255,255,255,0.06);
  border-radius: 10px; font-size: 11.5px; line-height: 1.6; color: rgba(255,255,255,0.55);
  display: none; animation: ytee-modal-in 0.2s ease-out;
}
.ytee-info-box.show { display: block; }
.ytee-info-box strong { color: rgba(119,221,255,0.9); font-weight: 700; margin-right: 4px; font-family: ui-monospace, monospace; }
.ytee-info-box p { margin: 0 0 10px; }
.ytee-info-box p:last-child { margin-bottom: 4px; }
.ytee-info-link { display: inline-block; color: #7ddeff; text-decoration: none; font-size: 10px; opacity: 0.5; transition: opacity 0.2s; margin-top: 4px; }
.ytee-info-link:hover { opacity: 0.9; text-decoration: underline; }

#ytee-settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2px;
}
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
    rewind: () => mkSvgEl({ tag: 'path', attrs: { d: 'M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z' } }),
    pip: () => mkSvgEl(
      { tag: 'path', attrs: { d: 'M19 7H5c-1.1 0-2 .9-2 2v6c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zm-9 5v-1.5l4 2-4 2V12z' } },
      { tag: 'path', attrs: { d: 'M23 5h-2v14h2V5zM1 5v14h2V5H1z' } }
    ),
    stats: () => mkSvgEl({ tag: 'path', attrs: { d: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm7 13H5v-.23c0-.62.28-1.2.76-1.58C7.47 15.82 9.64 15 12 15s4.53.82 6.24 2.19c.48.38.76.97.76 1.58V19z' } }),
    settings: () => mkSvgEl({ tag: 'path', attrs: { d: 'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z' } }),
    speed: () => mkSvgEl({ tag: 'path', attrs: { d: 'M10 8v8l6-4-6-4zm6.5-4.5l-1.5 1.5C16.78 6.76 18 9.24 18 12s-1.22 5.24-3 6.99l1.5 1.5C18.77 18.12 20 15.2 20 12s-1.23-6.12-3.5-8.5zM7.5 5.5L6 4C3.23 6.38 2 9.3 2 12s1.23 5.62 4 8l1.5-1.5C5.22 16.76 4 14.29 4 12s1.22-5.24 3.5-6.5z' } }),
    hide: () => mkSvgEl({ tag: 'path', attrs: { d: 'M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z' } }),
    expand: () => mkSvgEl({ tag: 'path', attrs: { d: 'M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z' } }),
    info: () => mkSvgEl({ tag: 'path', attrs: { d: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z' } }),
    thumb: () => mkSvgEl({ tag: 'path', attrs: { d: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zm-5.04-6.71l-2.75 3.54-1.96-2.36L6.5 17h11l-3.54-4.71z' } }),
    avatar: () => mkSvgEl({ tag: 'path', attrs: { d: 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z' } }),
    general: () => mkSvgEl({ tag: 'path', attrs: { d: 'M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z' } }),
    tools: () => mkSvgEl({ tag: 'path', attrs: { d: 'M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.5 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z' } }),
    interface: () => mkSvgEl({ tag: 'path', attrs: { d: 'M4 11h5V5H4v6zm0 7h5v-6H4v6zm6 0h5v-6h-5v6zm6 0h5v-6h-5v6zm-6-7h5V5h-5v6zm6-6v6h5V5h-5z' } }),
    hotkeys: () => mkSvgEl({ tag: 'path', attrs: { d: 'M20 5H4c-1.1 0-1.99.9-1.99 2L2 17c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-9 3h2v2h-2V8zm0 3h2v2h-2v-2zM8 8h2v2H8V8zm0 3h2v2H8v-2zm-1 2H5v-2h2v2zm0-3H5V8h2v2zm9 7H8v-2h8v2zm0-4h-2v-2h2v2zm0-3h-2V8h2v2zm3 3h-2v-2h2v2zm0-3h-2V8h2v2z' } }),
    download: () => mkSvgEl({ tag: 'path', attrs: { d: 'M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z' } }),
  };

  const mkBtn = (id, iconKey, labelText, tipText, titleText, isCollapsible = true) => {
    const btn = document.createElement('button');
    btn.id = id;
    btn.className = 'ytee-btn' + (isCollapsible ? ' ytee-collapsible' : '');
    btn.title = titleText || labelText;
    btn.dataset.tip = tipText || labelText;
    btn.dataset.defaultLabel = labelText;
    btn.dataset.defaultTip = tipText || labelText;
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
    const start = Date.now();
    const interval = setInterval(() => {
      const v = document.querySelector("video");
      if (v) { clearInterval(interval); callback(v); return; }
      if (Date.now() - start >= timeoutMs) {
        clearInterval(interval);
        console.warn('YTEE: video element never appeared');
      }
    }, 200);
  };

  // Settings
  const defaultSettings = {
    buttons: { wl: true, url: true, thumb: false, pfp: false, screenshot: true, clip: true, replay: true, pip: true, speed: true, stats: true, vol: true },
    hotkeys: {
      toggleMute: 'm',
      toggleStats: 'shift+s',
      toggleMiniStats: 'alt+s',
      increaseSpeed: '.',
      decreaseSpeed: ',',
      increaseSpeedFine: 'shift+.',
      decreaseSpeedFine: 'shift+,',
      volumeUp: 'arrowup',
      volumeDown: 'arrowdown',
      toggleSettings: 'q',
    },
    volumeBoostLevel: 1,
    enableVolumeBoost: true,
    enableScrollVolume: true,
    volumeStep: 5,
    initialVolume: 100,
    clipDuration: 5,
    clipDurationCtrl: 300,
    instantReplayDuration: 30,
    instantReplayQuality: 'medium',
    preferredQuality: 'auto',
    compactMode: false,
    isCollapsed: false,
    highContrastUI: false,
    playbackSpeed: 1,
    volumeCache: {},
    miniStatsCache: {},
    miniStatsPos: null,
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
    const rs = {
      buttons: Object.assign({}, defaultSettings.buttons, s.buttons),
      hotkeys: Object.assign({}, defaultSettings.hotkeys, s.hotkeys),
      volumeBoostLevel: typeof s.volumeBoostLevel === 'number' ? s.volumeBoostLevel
        : s.volumeBoost === true ? 1.5 : defaultSettings.volumeBoostLevel,
      enableVolumeBoost: typeof s.enableVolumeBoost === 'boolean' ? s.enableVolumeBoost : defaultSettings.enableVolumeBoost,
      enableScrollVolume: typeof s.enableScrollVolume === 'boolean' ? s.enableScrollVolume : defaultSettings.enableScrollVolume,
      initialVolume: typeof s.initialVolume === 'number' ? Math.min(100, Math.max(0, s.initialVolume)) : defaultSettings.initialVolume,
      volumeStep: typeof s.volumeStep === 'number' ? Math.min(100, Math.max(1, s.volumeStep)) : defaultSettings.volumeStep,
      clipDuration: typeof s.clipDuration === 'number' ? Math.min(300, Math.max(1, s.clipDuration)) : defaultSettings.clipDuration,
      clipDurationCtrl: typeof s.clipDurationCtrl === 'number' ? Math.min(300, Math.max(1, s.clipDurationCtrl)) : defaultSettings.clipDurationCtrl,
      instantReplayDuration: typeof s.instantReplayDuration === 'number' ? Math.min(60, Math.max(1, s.instantReplayDuration)) : defaultSettings.instantReplayDuration,
      instantReplayQuality: typeof s.instantReplayQuality === 'string' ? s.instantReplayQuality : defaultSettings.instantReplayQuality,
      preferredQuality: typeof s.preferredQuality === 'string' ? s.preferredQuality : defaultSettings.preferredQuality,
      compactMode: typeof s.compactMode === 'boolean' ? s.compactMode : (typeof s.labelMode === 'boolean' ? !s.labelMode : defaultSettings.compactMode),
      isCollapsed: typeof s.isCollapsed === 'boolean' ? s.isCollapsed : defaultSettings.isCollapsed,
      highContrastUI: typeof s.highContrastUI === 'boolean' ? s.highContrastUI : defaultSettings.highContrastUI,
      playbackSpeed: typeof s.playbackSpeed === 'number' ? Math.min(16, Math.max(0.1, s.playbackSpeed)) : defaultSettings.playbackSpeed,
      volumeCache: typeof s.volumeCache === 'object' ? s.volumeCache : defaultSettings.volumeCache,
      miniStatsCache: typeof s.miniStatsCache === 'object' ? s.miniStatsCache : defaultSettings.miniStatsCache,
      miniStatsPos: s.miniStatsPos || defaultSettings.miniStatsPos,
    };
    // memory remembers 30
    ['volumeCache', 'miniStatsCache'].forEach(cacheKey => {
      const keys = Object.keys(rs[cacheKey]);
      if (keys.length > 30) {
        keys.slice(0, keys.length - 30).forEach(k => delete rs[cacheKey][k]);
      }
    });
    return rs;
  };

  const applyUIStates = (settings) => {
    document.documentElement.dataset.yteeLabels = settings.compactMode ? '0' : '1';
    document.documentElement.dataset.yteeHighContrast = settings.highContrastUI ? '1' : '0';
    const group = document.getElementById('custom-btn-group');
    if (group) {
      group.classList.toggle('collapsed', !!settings.isCollapsed);
      const tBtn = document.getElementById('custom-toggle-btn');
      if (tBtn) {
        const iconSpan = tBtn.querySelector('.ytee-icon');
        if (iconSpan) {
          while (iconSpan.firstChild) iconSpan.removeChild(iconSpan.firstChild);
          iconSpan.appendChild(ICON_DEFS[settings.isCollapsed ? 'expand' : 'hide']());
        }
        setBtnLabel(tBtn, '', settings.isCollapsed ? 'Expand UI' : 'Collapse UI');
      }
    }
  };

  currentSettings = normalizeSettings(currentSettings);
  applyUIStates(currentSettings);

  // file naming
  const getVideoAuthor = (player) => {
    if (player && typeof player.getVideoData === 'function') {
      const data = player.getVideoData();
      if (data?.author) return data.author.replace(/[<>:"/\\|?*\x00-\x1F]/g, '').trim();
    }
    const authorEl = document.querySelector('.ytp-title-channel-name, .ytp-title-expanded-title .ytp-title-link');
    if (authorEl && authorEl.textContent) return authorEl.textContent.replace(/[<>:"/\\|?*\x00-\x1F]/g, '').trim();
    return 'YouTube';
  };

  const formatTimestamp = (currentTime) => {
    const timeMs = Math.floor(currentTime * 1000);
    const mins = Math.floor(timeMs / 60000).toString().padStart(2, '0');
    const secs = Math.floor((timeMs % 60000) / 1000).toString().padStart(2, '0');
    const ms = (timeMs % 1000).toString().padStart(3, '0');
    return `${mins}-${secs}-${ms}`;
  };

  const getVideoId = (p) => {
    if (p && typeof p.getVideoData === 'function') {
      const id = p.getVideoData()?.video_id;
      if (id) return id;
    }
    return window.location.pathname.split('/').pop().split('?')[0].split('#')[0];
  };

  const setBtnLabel = (btn, text, tipText) => {
    const label = btn.querySelector('.ytee-label');
    if (label) label.textContent = (text !== undefined && text !== null) ? text : btn.dataset.defaultLabel;
    btn.dataset.tip = (tipText !== undefined && tipText !== null) ? tipText : btn.dataset.defaultTip;
  };

  const flashBtnState = (btn, state, duration = 1500) => {
    btn.classList.add(state);
    setTimeout(() => btn.classList.remove(state), duration);
  };

  const downloadUrlAsFile = (url, baseFilename) => {
    if (typeof GM_xmlhttpRequest === 'undefined') { window.open(url, '_blank'); return; }
    GM_xmlhttpRequest({
      method: 'GET', url: url, responseType: 'blob',
      onload: (res) => {
        if (res.status === 200) {
          const blob = res.response;
          const mime = blob.type || '';
          let ext = 'jpg';
          if (mime.includes('png')) ext = 'png';
          else if (mime.includes('webp')) ext = 'webp';
          else if (mime.includes('gif')) ext = 'gif';
          const objUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = objUrl; a.download = `${baseFilename}.${ext}`; a.click();
          URL.revokeObjectURL(objUrl);
        } else { window.open(url, '_blank'); }
      },
      onerror: () => { window.open(url, '_blank'); }
    });
  };

  // Main
  waitForVideo((video) => {
    if (isChat() || (video.offsetWidth === 0 && video.offsetHeight === 0)) return;

    if (!document.fullscreenEnabled && window.self !== window.top) {
      const handleRequest = function () {
        window.parent.postMessage({ type: 'YTEE_REQUEST_FULLSCREEN' }, '*');
        return Promise.resolve();
      };
      const proto = Element.prototype;
      ['requestFullscreen', 'webkitRequestFullscreen', 'mozRequestFullScreen', 'msRequestFullscreen'].forEach(m => {
        if (proto[m]) proto[m] = handleRequest;
      });
      if (HTMLVideoElement.prototype.webkitEnterFullscreen) HTMLVideoElement.prototype.webkitEnterFullscreen = handleRequest;
    }

    let targetVolume = video.volume;
    let targetMuted = video.muted;

    const uw = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;

    let cachedPlayer = null;
    let playerCacheTime = 0;
    const PLAYER_CACHE_TTL = 1000;

    const getPlayer = () => {
      if (cachedPlayer && cachedPlayer.isConnected) return cachedPlayer;
      const now = Date.now();
      if (now - playerCacheTime < PLAYER_CACHE_TTL) return cachedPlayer;
      playerCacheTime = now;
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

    let lastHolodexStatus = 'unknown';

    const hookPlayerEvents = () => {
      const p = getPlayer();
      if (!p || typeof p.addEventListener !== 'function') return;
      p.addEventListener('onStateChange', (state) => {
        if (state === 1 || state === 3) applyQuality();
        if (state === 1) sessionStorage.setItem('ytee-reload-count', '0');
      });
    };

    let qualityHookAttempts = 0;
    const tryHookQuality = () => {
      const p = getPlayer();
      if (p && typeof p.addEventListener === 'function') { hookPlayerEvents(); applyQuality(); }
      else if (qualityHookAttempts < 20) { qualityHookAttempts++; setTimeout(tryHookQuality, 500); }
    };
    tryHookQuality();

    let scriptChangeDepth = 0;
    let playerReady = false;
    setTimeout(() => { playerReady = true; }, 2500);
    let audioContext = null, gainNode = null, recordingGain = null, mediaSource = null, virtualMuted = video.muted, audioSetupFailed = false;
    let activeStream = null, clipAudioDestination = null, audioHooked = false;
    let volTimeout, speedTimeout, controlsTimeout, clipRafId = null;
    let lastMouseMoveTime = 0;
    const MOUSE_THROTTLE_MS = 100;

    const RecordingState = { IDLE: 'idle', CLIPPING: 'clipping', REPLAYING: 'replaying' };
    let activeRecordingState = RecordingState.IDLE;

    const getBoostLevel = () => currentSettings.enableVolumeBoost ? Math.max(1, Number(currentSettings.volumeBoostLevel) || 1) : 1;

    // Volume
    const setupWebAudio = () => {
      if (gainNode || audioSetupFailed || !(window.AudioContext || window.webkitAudioContext)) return;
      if (audioContext && audioContext.state === 'closed') return;

      try {
        const AudioCtor = window.AudioContext || window.webkitAudioContext;
        if (!audioContext) audioContext = new AudioCtor();
        if (!mediaSource) mediaSource = audioContext.createMediaElementSource(video);

        gainNode = audioContext.createGain();
        mediaSource.connect(gainNode);
        gainNode.connect(audioContext.destination);

        recordingGain = audioContext.createGain();
        recordingGain.gain.value = 1.0;
        mediaSource.connect(recordingGain);

        if (audioContext.state === 'suspended') audioContext.resume().catch(() => { });
      } catch (e) {
        console.warn('Web Audio setup failed', e);
        gainNode = null; recordingGain = null;
        audioSetupFailed = true;
      }
    };

    const setGain = () => {
      if (!gainNode || !audioContext) return;
      if (audioContext.state === 'suspended') audioContext.resume().catch(() => { });
      gainNode.gain.setTargetAtTime(getBoostLevel(), audioContext.currentTime, 0.01);
    };

    const applyAudioState = (volume, muted) => {
      if (!audioHooked) {
        audioHooked = true;
        ['click', 'keydown', 'touchstart'].forEach(ev => {
          window.addEventListener(ev, () => {
            if (audioContext && audioContext.state === 'suspended') audioContext.resume().catch(() => { });
          }, { once: true, capture: true });
        });
      }
      scriptChangeDepth++;
      try {
        targetVolume = Math.min(1, Math.max(0, volume));
        targetMuted = muted;
        virtualMuted = muted;
        if (currentSettings.enableVolumeBoost && getBoostLevel() > 1) {
          if (!audioContext || audioContext.state === 'closed') {
            audioSetupFailed = false;
            gainNode = null;
            mediaSource = null;
          }
          if (!gainNode) setupWebAudio();
        }

        const p = getPlayer();
        if (targetMuted) {
          if (p && typeof p.mute === 'function') p.mute(); else video.muted = true;
        } else {
          if (p && typeof p.unMute === 'function') p.unMute(); else video.muted = false;
          if (p && typeof p.setVolume === 'function') p.setVolume(Math.round(targetVolume * 100)); else video.volume = targetVolume;
        }

        if (currentSettings.enableVolumeBoost && gainNode) {
          setGain();
        }
      } finally { scriptChangeDepth--; }
    };

    const applyVolume = (newVol) => {
      const clamped = Math.min(1, Math.max(0, Math.round(newVol * 100) / 100));
      applyAudioState(clamped, clamped === 0);
      vol.value = clamped;
      showVolumePercent(clamped === 0 ? 0 : clamped);

      const vid = getVideoId(getPlayer());
      if (vid) {
        currentSettings.volumeCache[vid] = clamped;
        saveStoredSettings(currentSettings);
      }
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
      if (!playerReady) return;

      const newMuted = video.muted;
      const newVol = video.volume;

      targetMuted = newMuted;
      if (!newMuted) targetVolume = newVol;

      muteBtn.classList.toggle("muted", targetMuted);
      const displayVol = targetMuted ? 0 : targetVolume;
      if (Number(vol.value) !== displayVol) vol.value = displayVol;

      if (gainNode) setGain();

      showVolumePercent(displayVol);

      const vid = getVideoId(getPlayer());
      if (vid) {
        currentSettings.volumeCache[vid] = targetVolume;
        saveStoredSettings(currentSettings);
      }
    });

    let isHoveringSpeedBtn = false;
    let pendingWheelDelta = 0, wheelRafId = 0, lastWheelShift = false;
    const onWheel = (e) => {
      if (isSettingsOpen) {
        if (settingsContent.contains(e.target)) return;
        e.stopImmediatePropagation(); e.preventDefault(); return;
      }

      const shouldHandleSpeed = isHoveringSpeedBtn;
      const shouldHandleVolume = currentSettings.enableScrollVolume && !isHoveringSpeedBtn;

      if (!shouldHandleSpeed && !shouldHandleVolume) return;

      e.preventDefault();
      pendingWheelDelta += e.deltaY;
      lastWheelShift = e.shiftKey;
      if (wheelRafId) return;
      wheelRafId = requestAnimationFrame(() => {
        const delta = pendingWheelDelta;
        const isShift = lastWheelShift;
        pendingWheelDelta = 0;
        wheelRafId = 0;
        if (shouldHandleSpeed) {
          const step = isShift ? SPEED_STEP_FINE : SPEED_STEP;
          applySpeed(targetSpeed + (delta > 0 ? -step : step));
        } else if (shouldHandleVolume) {
          applyVolume(targetVolume + (delta > 0 ? -(currentSettings.volumeStep / 100) : (currentSettings.volumeStep / 100)));
        }
      });
    };
    window.addEventListener("wheel", onWheel, { passive: false });

    // Stats
    let isStatsOpen = false, isMiniStatsOpen = false, miniStatsInterval = null;
    const miniStats = Object.assign(document.createElement("div"), { id: "custom-mini-stats" });
    const statsBtn = mkBtn('custom-stats-btn', 'stats', 'Stats', 'Stats (Ctrl = Mini)', 'Stats for Nerds (Shift+S)');

    // Dragging
    let isDragging = false, startX, startY, startL, startT;
    miniStats.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      isDragging = true;
      startX = e.clientX; startY = e.clientY;
      const rect = miniStats.getBoundingClientRect();
      startL = rect.left; startT = rect.top;
      miniStats.style.transition = 'none';
      e.preventDefault();
    });
    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const x = startL + (e.clientX - startX);
      const y = startT + (e.clientY - startY);
      miniStats.style.left = x + 'px';
      miniStats.style.top = y + 'px';
      miniStats.style.bottom = 'auto';
    }, { passive: true });
    window.addEventListener('mouseup', () => {
      if (!isDragging) return;
      isDragging = false;
      miniStats.style.transition = '';
      const rect = miniStats.getBoundingClientRect();
      const pL = rect.left / window.innerWidth;
      const pT = rect.top / window.innerHeight;
      currentSettings.miniStatsPos = { pL, pT };
      saveStoredSettings(currentSettings);
    });
    const applyMiniStatsPos = () => {
      if (!currentSettings.miniStatsPos || isDragging) return;
      const { pL, pT } = currentSettings.miniStatsPos;
      const w = window.innerWidth, h = window.innerHeight;
      const rect = miniStats.getBoundingClientRect();
      const x = Math.max(0, Math.min(w - rect.width, pL * w));
      const y = Math.max(0, Math.min(h - rect.height, pT * h));
      Object.assign(miniStats.style, { left: x + 'px', top: y + 'px', bottom: 'auto' });
    };
    applyMiniStatsPos();

    const miniStatsParts = {}, miniStatsWrappers = {};
    (() => {
      const mkPart = (key, label) => {
        const wrap = document.createElement('div');
        const b = document.createElement('b'); b.textContent = label;
        const s = document.createElement('span'); s.textContent = '-';
        wrap.append(b, s);
        miniStats.appendChild(wrap);
        miniStatsParts[key] = s;
        miniStatsWrappers[key] = wrap;
      };
      mkPart('bandwidth', 'Speed');
      mkPart('buffer', 'Buffer');
      mkPart('latency', 'Latency');
      mkPart('dropped', 'Drop');
      mkPart('views', 'Watching');
    })();

    let lastWatcherTime = 0;
    let isFetchingViewers = false;
    const formatViewers = (n) => {
      if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
      if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
      return String(n);
    };

    const fetchViewers = (videoId) => {
      const url = `https://holodex.net/api/v2/videos/${videoId}?include=live_info`;
      return new Promise((resolve) => {
        if (typeof GM_xmlhttpRequest === 'undefined') return resolve({ v: '-', live: false });

        GM_xmlhttpRequest({
          method: 'GET', url: url, anonymous: true,
          headers: { "Referer": "https://holodex.net/", "Origin": "https://holodex.net" },
          onload: (r) => {
            if (r.status === 200) {
              try {
                const json = JSON.parse(r.responseText);
                lastHolodexStatus = json.status || 'unknown';
                const v = json.live_viewers;
                resolve({ v: v && v > 0 ? formatViewers(v) : '-', live: lastHolodexStatus === 'live' });
              } catch (e) { resolve({ v: '-', live: false }); }
            } else { resolve({ v: '-', live: false }); }
          },
          onerror: () => resolve({ v: '-', live: false }),
          timeout: 8000
        });
      });
    };

    const updateMiniStats = () => {
      if (!isMiniStatsOpen) return;
      try {
        const p = getPlayer();
        if (!p) return;
        const stats = typeof p.getStatsForNerds === 'function' ? p.getStatsForNerds() : null;

        let buffer = null;
        if (stats?.buffer_health_seconds) {
          buffer = parseFloat(stats.buffer_health_seconds).toFixed(2);
        } else if (video.buffered.length > 0) {
          buffer = (video.buffered.end(video.buffered.length - 1) - video.currentTime).toFixed(2);
        }

        let latency = null;
        if (stats?.live_latency_secs) {
          latency = parseFloat(stats.live_latency_secs);
        }
        if (latency == null || latency > 1000) {
          const isLive = p.getVideoData?.().isLive;
          if (isLive) {
            const seekable = video.seekable;
            if (seekable?.length > 0) {
              const edge = seekable.end(seekable.length - 1);
              if (edge - video.currentTime < 1000) latency = Math.max(0, edge - video.currentTime);
            }
            if (latency == null || latency > 1000) {
              const dur = p.getDuration?.();
              if (dur > 0 && dur - video.currentTime < 1000) latency = Math.max(0, dur - video.currentTime);
            }
          }
        }

        // Dropped frames
        const dropped = video.getVideoPlaybackQuality()?.droppedVideoFrames ?? 0;

        const formattedLatency = latency != null ? latency.toFixed(2) : 'N/A';
        const dCount = Number(dropped);
        let dColor = '';
        if (dCount > 0 && dCount <= 100) dColor = '#3498db';
        else if (dCount > 100 && dCount <= 250) dColor = '#f1c40f';
        else if (dCount > 250 && dCount <= 350) dColor = '#e67e22';
        else if (dCount > 350) dColor = '#e74c3c';

        let bandwidth = 'N/A';
        if (stats?.bandwidth_kbps) {
          const kbps = parseFloat(stats.bandwidth_kbps);
          if (!isNaN(kbps)) {
            bandwidth = kbps >= 1000
              ? (kbps / 1000).toFixed(1) + ' Mbps'
              : Math.round(kbps) + ' Kbps';
          }
        }
        miniStatsParts.bandwidth.textContent = bandwidth;

        miniStatsParts.buffer.textContent = buffer != null ? buffer + 's' : 'N/A';
        miniStatsParts.latency.textContent = formattedLatency !== 'N/A' ? formattedLatency + 's' : 'N/A';
        miniStatsParts.dropped.textContent = dropped;
        miniStatsParts.dropped.style.color = dColor;

        const now = Date.now();
        const viewsText = miniStatsParts.views.textContent.trim();
        const isInitial = viewsText === '-' || viewsText === '';
        if (!isFetchingViewers && now - lastWatcherTime >= (isInitial ? 5000 : 90000)) {
          lastWatcherTime = now;
          const videoId = getVideoId(p);
          if (videoId && videoId.length > 5) {
            isFetchingViewers = true;
            fetchViewers(videoId).then(res => {
              if (res.v && res.v !== '-') miniStatsParts.views.textContent = res.v;
              if (miniStatsWrappers.views) {
                miniStatsWrappers.views.style.display = (lastHolodexStatus === 'past') ? 'none' : '';
              }
            }).finally(() => {
              isFetchingViewers = false;
            });
          }
        }
      } catch (e) {
        console.error('YTEE: updateMiniStats failed', e);
      }
    };

    const toggleMiniStats = () => {
      isMiniStatsOpen = !isMiniStatsOpen;
      miniStats.classList.toggle("show", isMiniStatsOpen);
      statsBtn.classList.toggle("active", isMiniStatsOpen);
      clearInterval(miniStatsInterval);
      miniStatsInterval = null;
      if (isMiniStatsOpen) {
        lastWatcherTime = 0;
        isFetchingViewers = false;
        updateMiniStats();
        miniStatsInterval = setInterval(updateMiniStats, 2000);
      }

      const vid = getVideoId(getPlayer());
      if (vid) {
        currentSettings.miniStatsCache[vid] = isMiniStatsOpen;
        saveStoredSettings(currentSettings);
      }
    };

    const toggleStats = (e) => {
      if (e && e.ctrlKey) { toggleMiniStats(); return; }
      const p = getPlayer();
      if (!p) return;
      if (isStatsOpen && p.hideVideoInfo) { p.hideVideoInfo(); isStatsOpen = false; }
      else if (p.showVideoInfo) { p.showVideoInfo(); isStatsOpen = true; }
      statsBtn.classList.toggle("nerds-active", isStatsOpen);
    };
    statsBtn.addEventListener("click", toggleStats);

    // Speed
    const SPEED_MIN = 0.1, SPEED_MAX = 16, SPEED_STEP = 0.1, SPEED_STEP_FINE = 0.01, SPEED_DEFAULT = 1;
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
      const speedInput = document.getElementById('ytee-precise-speed');
      if (speedInput && parseFloat(speedInput.value) !== targetSpeed) speedInput.value = targetSpeed;
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
    const screenshotBtn = mkBtn('custom-screenshot-btn', 'screenshot', 'Snap', 'Take Screenshot (Ctrl = Save)');
    screenshotBtn.addEventListener("click", (e) => {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      canvas.getContext("2d", { alpha: false }).drawImage(video, 0, 0);
      const author = getVideoAuthor(getPlayer());
      const timestamp = formatTimestamp(video.currentTime);

      canvas.toBlob((blob) => {
        if (!blob) return;

        const download = () => {
          const objUrl = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = objUrl;
          a.download = `${author}_${timestamp}.png`;
          a.click();
          URL.revokeObjectURL(objUrl);
        };

        if (e.ctrlKey) download();

        if (navigator.clipboard && typeof ClipboardItem !== "undefined") {
          navigator.clipboard.write([new ClipboardItem({ "image/png": blob })])
            .then(() => {
              setBtnLabel(screenshotBtn, e.ctrlKey ? '✓ Saved!' : '✓ Copied!');
              flashBtnState(screenshotBtn, 'success');
              setTimeout(() => setBtnLabel(screenshotBtn), 1500);
            })
            .catch(() => {
              if (!e.ctrlKey) download();
              setBtnLabel(screenshotBtn, '✓ Saved!');
              flashBtnState(screenshotBtn, 'success');
              setTimeout(() => setBtnLabel(screenshotBtn), 1500);
            });
        } else {
          if (!e.ctrlKey) download();
          setBtnLabel(screenshotBtn, '✓ Saved!');
          flashBtnState(screenshotBtn, 'success');
          setTimeout(() => setBtnLabel(screenshotBtn), 1500);
        }
      }, "image/png");
    });

    // Clip
    const clipOverlay = Object.assign(document.createElement('div'), { id: 'custom-clip-overlay' });
    const clipBtn = mkBtn('custom-clip-btn', 'clip', 'Clip', 'Record Clip (Ctrl = Long)');
    let clipRecorder = null;

    const remuxToMp4 = async (chunks, mimeType) => {
      if (typeof Mediabunny === 'undefined') {
        throw new Error('Mediabunny library not loaded');
      }

      const blobs = chunks
        .map(c => c.data)
        .filter(b => b instanceof Blob && b.size > 0);

      if (blobs.length === 0) throw new Error('remuxToMp4: no valid chunks to remux');

      const rawBlob = new Blob(blobs, { type: mimeType });

      const { Input, Output, Conversion, BlobSource, BufferTarget, ALL_FORMATS, Mp4OutputFormat } = Mediabunny;

      const input = new Input({
        source: new BlobSource(rawBlob),
        formats: ALL_FORMATS,
      });
      const output = new Output({
        format: new Mp4OutputFormat(),
        target: new BufferTarget(),
      });

      const conversion = await Conversion.init({ input, output });
      await conversion.execute();

      return new Blob([output.target.buffer], { type: 'video/mp4' });
    };

    const stopClip = (cancelled) => {
      if (!clipRecorder) return;
      activeRecordingState = RecordingState.IDLE;
      if (clipRecorder.state !== 'inactive') clipRecorder.stop();
      clipRecorder = null;
      if (activeStream) { activeStream.getTracks().forEach(t => t.stop()); activeStream = null; }
      if (clipAudioDestination) {
        if (recordingGain) try { recordingGain.disconnect(clipAudioDestination); } catch (e) { }
        clipAudioDestination = null;
      }
      cancelAnimationFrame(clipRafId); clipRafId = null;
      clipBtn.classList.remove('recording');
      setBtnLabel(clipBtn, cancelled ? '✗ Cancelled' : 'Processing…');
      clipOverlay.classList.remove('show');
      if (cancelled) setTimeout(() => setBtnLabel(clipBtn), 1500);
    };

    const startClip = (durationSec) => {
      if (clipRecorder) { stopClip(true); return; }
      if (activeRecordingState === RecordingState.CLIPPING) return;
      if (activeRecordingState === RecordingState.REPLAYING) {
        setBtnLabel(clipBtn, '✗ Busy');
        setTimeout(() => setBtnLabel(clipBtn), 1500);
        return;
      }
      if (!video.captureStream) { setBtnLabel(clipBtn, '✗ N/A'); setTimeout(() => setBtnLabel(clipBtn), 2000); return; }
      activeRecordingState = RecordingState.CLIPPING;

      const mimeType = MediaRecorder.isTypeSupported('video/mp4; codecs=avc1,mp4a.40.2')
        ? 'video/mp4; codecs=avc1,mp4a.40.2'
        : MediaRecorder.isTypeSupported('video/webm; codecs=vp9,opus')
          ? 'video/webm; codecs=vp9,opus'
          : MediaRecorder.isTypeSupported('video/webm; codecs=vp8,opus')
            ? 'video/webm; codecs=vp8,opus'
            : 'video/webm';

      // Clip Recording Setup
      const width = video.videoWidth || 1920;
      const height = video.videoHeight || 1080;
      const px = width * height;
      const isMP4 = mimeType.includes('mp4');
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

      const H264_BPP_MAP = [
        [426 * 240, 0.150, 0.210],
        [640 * 360, 0.120, 0.180],
        [854 * 480, 0.100, 0.150],
        [1280 * 720, 0.085, 0.120],
        [1920 * 1080, 0.065, 0.096],
        [2560 * 1440, 0.048, 0.072],
        [3840 * 2160, 0.036, 0.054],
      ];

      const map = isMP4 ? H264_BPP_MAP : BPP_MAP;
      const [, bppHigh, bppLow] = map.find(([maxPx]) => px <= maxPx) ?? map.at(-1);
      const videoBitsPerSecond = Math.round(width * height * fps * (isVP9 ? bppHigh : bppLow));

      try {
        const videoStream = video.captureStream();
        const videoTracks = videoStream.getVideoTracks();
        let audioTracks = videoStream.getAudioTracks();

        if (recordingGain && audioContext) {
          clipAudioDestination = audioContext.createMediaStreamDestination();
          recordingGain.connect(clipAudioDestination);
          audioTracks = clipAudioDestination.stream.getAudioTracks();
        }
        activeStream = new MediaStream([...videoTracks, ...audioTracks]);

        if (activeStream.getTracks().length === 0) {
          console.warn('YTEE: captureStream returned no tracks');
          activeRecordingState = RecordingState.IDLE;
          setBtnLabel(clipBtn, '✗ Not Ready'); setTimeout(() => setBtnLabel(clipBtn), 2000); return;
        }
      } catch (e) {
        console.warn('YTEE: captureStream failed', e);
        activeRecordingState = RecordingState.IDLE;
        setBtnLabel(clipBtn, '✗ Error'); setTimeout(() => setBtnLabel(clipBtn), 2000); return;
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
        if (activeStream) activeStream.getTracks().forEach(t => t.stop()); activeStream = null;
        activeRecordingState = RecordingState.IDLE;
        setBtnLabel(clipBtn, '✗ Error'); setTimeout(() => setBtnLabel(clipBtn), 2000); return;
      }

      let clipInitChunk = null;
      recorder.ondataavailable = (ev) => {
        if (!ev.data || ev.data.size === 0) return;
        const chunk = { data: ev.data, time: performance.now() };
        if (!clipInitChunk) {
          clipInitChunk = chunk;
        } else {
          chunks.push(chunk);
        }
      };
      recorder.onstop = async () => {
        const fullChunks = clipInitChunk ? [clipInitChunk, ...chunks] : chunks;
        if (fullChunks.length === 0) { setBtnLabel(clipBtn, '✗ Empty'); setTimeout(() => setBtnLabel(clipBtn), 1500); return; }

        setBtnLabel(clipBtn, 'Processing...');
        try {
          const mp4Blob = await remuxToMp4(fullChunks, mimeType);
          const author = getVideoAuthor(getPlayer());
          const timestamp = formatTimestamp(video.currentTime);
          const objUrl = URL.createObjectURL(mp4Blob);
          const a = document.createElement('a');
          a.href = objUrl;
          a.download = `${author}_${timestamp}.mp4`;
          a.click();
          URL.revokeObjectURL(objUrl);
          setBtnLabel(clipBtn, '✓ Saved!');
        } catch (e) {
          console.error('YTEE: remux failed', e);
          setBtnLabel(clipBtn, '✗ Error');
        }
        setTimeout(() => setBtnLabel(clipBtn), 2000);
      };
      recorder.onerror = (ev) => {
        console.warn('YTEE: MediaRecorder error', ev);
        stopClip(true); setBtnLabel(clipBtn, '✗ Error'); setTimeout(() => setBtnLabel(clipBtn), 2000);
      };

      clipRecorder = recorder;
      recorder.start(960);
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

    //Instant Replay
    const replayOverlay = Object.assign(document.createElement('div'), { id: 'custom-replay-overlay' });
    const replayBtn = mkBtn('custom-replay-btn', 'rewind', 'Replay', 'Instant Replay • Right-click = stop', 'Instant Replay');

    if (typeof Mediabunny === 'undefined') {
      console.warn('YTEE: Mediabunny not loaded — clip/replay disabled');
      clipBtn.style.display = 'none';
      replayBtn.style.display = 'none';
    }

    let replayRecorder = null;
    let replayStream = null, replayAudioDestination = null;
    let replayChunks = [];
    let replayInitChunk = null;
    let replayMimeType = '';
    let replayActive = false;
    let replayWaiting = false;
    let replayRetryCount = 0;
    let replaySupported = !!video.captureStream && typeof MediaRecorder !== 'undefined';

    const getReplayMimeType = () => {
      if (MediaRecorder.isTypeSupported('video/mp4; codecs=avc1,mp4a.40.2')) return 'video/mp4; codecs=avc1,mp4a.40.2';
      if (MediaRecorder.isTypeSupported('video/webm; codecs=vp9,opus')) return 'video/webm; codecs=vp9,opus';
      if (MediaRecorder.isTypeSupported('video/webm; codecs=vp8,opus')) return 'video/webm; codecs=vp8,opus';
      return 'video/webm';
    };

    const pruneReplayChunks = () => {
      const windowMs = (Number(currentSettings.instantReplayDuration) || 30) * 1000 + 2000;
      const cutoff = performance.now() - windowMs;
      let keepFrom = 0;
      for (let i = 0; i < replayChunks.length - 1; i++) {
        if (replayChunks[i].time >= cutoff) break;
        keepFrom = i + 1;
      }
      if (keepFrom > 0) replayChunks = replayChunks.slice(keepFrom);
    };

    const startInstantReplay = () => {
      if (replayActive || !replaySupported || replayWaiting) return;

      if (activeRecordingState === RecordingState.CLIPPING) {
        const waitAndRetry = () => {
          if (activeRecordingState !== RecordingState.CLIPPING) startInstantReplay();
          else setTimeout(waitAndRetry, 500);
        };
        setTimeout(waitAndRetry, 500);
        return;
      }

      if (video.readyState < 1) {
        replayWaiting = true;
        video.addEventListener('loadedmetadata', () => {
          replayWaiting = false;
          startInstantReplay();
        }, { once: true });
        return;
      }

      try {
        replayMimeType = getReplayMimeType();
        const videoStream = video.captureStream();
        const videoTracks = videoStream.getVideoTracks();
        let audioTracks = videoStream.getAudioTracks();

        if (recordingGain && audioContext) {
          replayAudioDestination = audioContext.createMediaStreamDestination();
          recordingGain.connect(replayAudioDestination);
          audioTracks = replayAudioDestination.stream.getAudioTracks();
        }
        replayStream = new MediaStream([...videoTracks, ...audioTracks]);

        if (replayStream.getTracks().length === 0) {
          if (replayRetryCount < 10) {
            replayRetryCount++;
            console.log(`YTEE: Instant Replay waiting for stream tracks (attempt ${replayRetryCount})...`);
            replayWaiting = true;
            setTimeout(() => { replayWaiting = false; startInstantReplay(); }, 1000);
          } else {
            console.warn('YTEE: Instant Replay failed to find tracks after multiple attempts.');
          }
          return;
        }

        replayRetryCount = 0;

        const qualityMap = {
          'very low': { v: 1_000_000, a: 96_000 },
          'low': { v: 2_500_000, a: 128_000 },
          'medium': { v: 5_000_000, a: 192_000 },
          'high': { v: 10_000_000, a: 256_000 },
          'very high': { v: 20_000_000, a: 320_000 }
        };
        const q = qualityMap[currentSettings.instantReplayQuality] || qualityMap['medium'];

        replayRecorder = new MediaRecorder(replayStream, {
          mimeType: replayMimeType,
          videoBitsPerSecond: q.v,
          audioBitsPerSecond: q.a,
        });
        replayChunks = [];
        replayInitChunk = null;
        replayRecorder.ondataavailable = (ev) => {
          if (!ev.data || ev.data.size === 0) return;
          const chunk = { data: ev.data, time: performance.now() };
          if (!replayInitChunk) {
            replayInitChunk = chunk;
          } else {
            replayChunks.push(chunk);
            pruneReplayChunks();
          }
        };
        replayRecorder.onerror = (ev) => {
          console.warn('YTEE: Instant Replay recorder error', ev);
          stopInstantReplay();
        };
        replayRecorder.start(1920);
        replayActive = true;
        activeRecordingState = RecordingState.REPLAYING;
        replayBtn.classList.add('buffering');
        console.log('YTEE: Instant Replay started');
        setBtnLabel(replayBtn, 'Started');
        setTimeout(() => setBtnLabel(replayBtn), 1500);
      } catch (e) {
        console.warn('YTEE: Instant Replay start failed', e);
        if (e.name === 'NotSupportedError' && !e?.message?.includes?.('tracks')) {
          replaySupported = false;
          replayBtn.style.display = 'none';
        }
      }
    };

    const stopInstantReplay = () => {
      if (!replayActive) return;
      replayActive = false;
      activeRecordingState = RecordingState.IDLE;
      replayRetryCount = 0;
      replayInitChunk = null;
      try { if (replayRecorder && replayRecorder.state !== 'inactive') replayRecorder.stop(); } catch (e) { }
      try { if (replayStream) replayStream.getTracks().forEach(t => t.stop()); } catch (e) { }
      if (replayAudioDestination) {
        if (recordingGain) try { recordingGain.disconnect(replayAudioDestination); } catch (e) { }
        replayAudioDestination = null;
      }
      replayRecorder = null;
      replayStream = null;
      replayBtn.classList.remove('buffering');
    };

    const saveInstantReplay = async () => {
      if (!replaySupported) {
        setBtnLabel(replayBtn, '✗ N/A');
        flashBtnState(replayBtn, 'error');
        setTimeout(() => setBtnLabel(replayBtn), 1500);
        return;
      }

      pruneReplayChunks();

      if (!replayInitChunk && replayChunks.length === 0) {
        setBtnLabel(replayBtn, '✗ Empty');
        flashBtnState(replayBtn, 'error');
        setTimeout(() => setBtnLabel(replayBtn), 1500);
        return;
      }

      const chunksSnapshot = replayInitChunk
        ? [replayInitChunk, ...replayChunks]
        : [...replayChunks];
      const mimeSnapshot = replayMimeType;
      const author = getVideoAuthor(getPlayer());
      const timestamp = formatTimestamp(video.currentTime);

      if (replayRecorder && replayRecorder.state === 'recording') {
        const onFinalChunk = async (ev) => {
          replayRecorder.removeEventListener('dataavailable', onFinalChunk);
          if (ev.data && ev.data.size > 0) chunksSnapshot.push({ data: ev.data, time: performance.now() });

          replayChunks = [];
          await assembleAndDownload(chunksSnapshot, mimeSnapshot, author, timestamp);
        };
        replayRecorder.addEventListener('dataavailable', onFinalChunk);
        try {
          replayRecorder.requestData();
        } catch (e) {
          replayRecorder.removeEventListener('dataavailable', onFinalChunk);
          await assembleAndDownload(chunksSnapshot, mimeSnapshot, author, timestamp);
        }
      } else {
        await assembleAndDownload(chunksSnapshot, mimeSnapshot, author, timestamp);
      }
    };

    const assembleAndDownload = async (chunks, mimeType, author, timestamp) => {
      if (chunks.length === 0) {
        setBtnLabel(replayBtn, '✗ Empty');
        flashBtnState(replayBtn, 'error');
        setTimeout(() => setBtnLabel(replayBtn), 1500);
        return;
      }

      setBtnLabel(replayBtn, 'Processing...');
      try {
        const mp4Blob = await remuxToMp4(chunks, mimeType);
        const objUrl = URL.createObjectURL(mp4Blob);
        const a = document.createElement('a');
        a.href = objUrl;
        a.download = `${author}_instant_replay_${timestamp}.mp4`;
        a.click();
        URL.revokeObjectURL(objUrl);
        setBtnLabel(replayBtn, '✓ Saved!');
        flashBtnState(replayBtn, 'success');
      } catch (e) {
        console.error('YTEE: remux failed', e);
        setBtnLabel(replayBtn, '✗ Remux Error');
        flashBtnState(replayBtn, 'error');
      }
      setTimeout(() => setBtnLabel(replayBtn), 2000);

      replayOverlay.textContent = `✓ Last ~${currentSettings.instantReplayDuration}s saved`;
      replayOverlay.classList.add('show');
      setTimeout(() => replayOverlay.classList.remove('show'), 2000);
    };

    replayBtn.addEventListener('click', () => {
      if (!replayActive) {
        startInstantReplay();
      } else {
        saveInstantReplay();
      }
    });
    replayBtn.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (replayActive) {
        stopInstantReplay();
        setBtnLabel(replayBtn, 'Stopped');
        setTimeout(() => setBtnLabel(replayBtn), 1500);
      } else {
        startInstantReplay();
      }
    });

    // PiP
    const pipSupported = document.pictureInPictureEnabled && typeof video.requestPictureInPicture === "function";
    const pipBtn = mkBtn('custom-pip-btn', 'pip', 'PiP', 'Picture-in-Picture');
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
    const urlBtn = mkBtn('custom-url-btn', 'url', 'URL', 'Copy URL (Ctrl+Click = with timestamp)');
    urlBtn.addEventListener("click", async (e) => {
      try {
        const videoId = getVideoId(getPlayer());
        let url = `https://youtu.be/${videoId}`;
        if (e.ctrlKey) url += `?t=${Math.floor(video.currentTime)}`;

        let copied = false;
        if (navigator.clipboard) {
          try {
            await navigator.clipboard.writeText(url);
            copied = true;
          } catch (clipErr) {

          }
        }

        if (!copied) {
          const ta = document.createElement('textarea');
          ta.value = url;
          ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0;';
          document.body.appendChild(ta);
          ta.focus();
          ta.select();
          copied = document.execCommand('copy');
          document.body.removeChild(ta);
        }

        if (copied) {
          setBtnLabel(urlBtn, '✓ Copied!');
          flashBtnState(urlBtn, 'success');
          setTimeout(() => setBtnLabel(urlBtn), 1500);
        } else {
          throw new Error('All copy methods failed');
        }
      } catch (err) {
        console.error("Copy URL failed:", err);
        flashBtnState(urlBtn, 'error');
      }
    });

    // Thumbnail
    const thumbBtn = mkBtn('custom-thumb-btn', 'thumb', 'Thumb', 'Get Thumbnail (Max Res)');
    thumbBtn.addEventListener("click", () => {
      const videoId = getVideoId(getPlayer());
      if (videoId) {
        window.open(`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`, '_blank');
      }
    });
    // Profile Picture
    const pfpBtn = mkBtn('custom-pfp-btn', 'avatar', 'PFP', 'Get Profile Picture');
    pfpBtn.addEventListener("click", () => {
      const videoId = getVideoId(getPlayer());
      if (!videoId) return;
      setBtnLabel(pfpBtn, '…');
      GM_xmlhttpRequest({
        method: 'GET',
        url: `https://holodex.net/api/v2/videos/${videoId}?include=live_info`,
        headers: { "Referer": "https://holodex.net/", "Origin": "https://holodex.net" },
        onload: (r) => {
          if (r.status === 200) {
            try {
              const json = JSON.parse(r.responseText);
              const photo = json.channel?.photo;
              if (photo) {
                window.open(photo.replace(/=s\d+-c-k-c0x[0-9a-f]+-no-rj/, '=s0'), '_blank');
                setBtnLabel(pfpBtn, '✓');
                flashBtnState(pfpBtn, 'success');
              } else { throw new Error('No photo'); }
            } catch (e) {
              console.error('YTEE: PFP fetch failed', e);
              flashBtnState(pfpBtn, 'error');
            }
          } else {
            flashBtnState(pfpBtn, 'error');
          }
          setTimeout(() => setBtnLabel(pfpBtn), 1500);
        },
        onerror: () => {
          flashBtnState(pfpBtn, 'error');
          setTimeout(() => setBtnLabel(pfpBtn), 1500);
        }
      });
    });

    // Watch Later
    const wlBtn = mkBtn('custom-wl-btn', 'wl', 'WL', 'Watch Later');
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
        const videoId = getVideoId(getPlayer());
        if (!videoId || videoId.length < 5) { setBtnLabel(wlBtn, '✗ Err'); setTimeout(() => setBtnLabel(wlBtn), 1500); return; }
        const sapisid = getSapisid();
        if (!sapisid) { setBtnLabel(wlBtn, '✗ Login'); setTimeout(() => setBtnLabel(wlBtn), 1500); return; }
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
        setTimeout(() => setBtnLabel(wlBtn), 1500);
      } catch (err) { console.error("Watch Later failed:", err); setBtnLabel(wlBtn, '✗ Err'); flashBtnState(wlBtn, 'error'); setTimeout(() => setBtnLabel(wlBtn), 1500); }
    });

    const toggleBtn = mkBtn('custom-toggle-btn', currentSettings.isCollapsed ? 'expand' : 'hide', '', 'Collapse UI', null, false);
    toggleBtn.addEventListener('click', () => {
      currentSettings.isCollapsed = !currentSettings.isCollapsed;
      saveStoredSettings(currentSettings);
      applyUIStates(currentSettings);
    });

    // Settings Modal
    const settingsBtn = mkBtn('custom-settings-btn', 'settings', '', 'Settings', 'Settings Menu', false);
    const settingsModal = document.createElement("div");
    settingsModal.id = "custom-settings-modal";
    let isSettingsOpen = false;

    const settingsContent = document.createElement("div");
    settingsContent.id = "custom-settings-content";

    const settingsHeader = Object.assign(document.createElement("div"), { id: "ytee-settings-header" });
    const headerTitleWrap = document.createElement('div');
    const settingsTitle = Object.assign(document.createElement("h2"), { textContent: "YouTube Embed Enhancer" });
    const settingsSubtitle = Object.assign(document.createElement("p"), { id: "ytee-settings-subtitle", textContent: "Customize your experience" });
    headerTitleWrap.append(settingsTitle, settingsSubtitle);

    const infoBtn = Object.assign(document.createElement('div'), { className: 'ytee-info-btn', title: 'Legend' });
    infoBtn.appendChild(ICON_DEFS.info());
    settingsHeader.append(headerTitleWrap, infoBtn);

    const infoBox = Object.assign(document.createElement('div'), { className: 'ytee-info-box' });
    const mkInfoRow = (title, text) => {
      const p = document.createElement('p');
      const s = Object.assign(document.createElement('strong'), { textContent: title });
      p.append(s, document.createTextNode(' ' + text));
      return p;
    };
    infoBox.append(
      mkInfoRow('Speed', 'How fast your internet is. Higher = smoother high-quality video.'),
      mkInfoRow('Buffer', "Pre-loaded video 'cushion'. If this hits 0, the video will pause to load."),
      mkInfoRow('Latency', 'Your delay from live. Lower = closer to real-time.'),
      mkInfoRow('Drop', 'If this rises, your PC is struggling and the video will look laggy or stutter.'),
      Object.assign(document.createElement('a'), {
        href: 'https://github.com/jmpatag/YouTube-Embed-Enhancer',
        target: '_blank', className: 'ytee-info-link', textContent: 'GitHub Source'
      })
    );
    infoBtn.addEventListener('click', () => infoBox.classList.toggle('show'));

    // Tabs
    const tabsContainer = Object.assign(document.createElement('div'), { id: 'ytee-settings-tabs' });
    const tabItems = [
      { id: 'tab-general', label: 'General' },
      { id: 'tab-tools', label: 'Tools' },
      { id: 'tab-interface', label: 'Interface' },
      { id: 'tab-hotkeys', label: 'Hotkeys' }
    ];
    const tabs = {};
    const tabContents = {};

    tabItems.forEach((item, idx) => {
      const tab = Object.assign(document.createElement('div'), { className: 'ytee-tab' });
      const iconWrap = Object.assign(document.createElement('span'), { className: 'ytee-icon' });
      iconWrap.appendChild(ICON_DEFS[item.id.replace('tab-', '')]());
      tab.append(iconWrap, document.createTextNode(item.label));

      if (idx === 0) tab.classList.add('active');
      tab.addEventListener('click', () => {
        Object.values(tabs).forEach(t => t.classList.remove('active'));
        Object.values(tabContents).forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        tabContents[item.id].classList.add('active');
      });
      tabsContainer.appendChild(tab);
      tabs[item.id] = tab;

      const content = Object.assign(document.createElement('div'), { className: 'ytee-tab-content' });
      if (idx === 0) content.classList.add('active');
      tabContents[item.id] = content;
    });

    const settingsItems = Object.assign(document.createElement("div"), { id: "custom-settings-items" });
    Object.values(tabContents).forEach(c => settingsItems.appendChild(c));

    const settingsButtons = Object.assign(document.createElement("div"), { id: "custom-settings-buttons" });
    const restoreBtn = Object.assign(document.createElement("button"), { id: "custom-settings-restore", textContent: "Restore defaults" });
    const cancelBtn = Object.assign(document.createElement("button"), { id: "custom-settings-cancel", textContent: "Cancel" });
    const saveBtn = Object.assign(document.createElement("button"), { id: "custom-settings-save", textContent: "Save changes" });
    settingsButtons.append(restoreBtn, cancelBtn, saveBtn);

    settingsContent.append(settingsHeader, tabsContainer, infoBox, settingsItems, settingsButtons);
    settingsModal.appendChild(settingsContent);
    document.body.appendChild(settingsModal);


    const mkSection = (title) => Object.assign(document.createElement('h3'), { className: 'setting-section-title', textContent: title });
    const mkNote = (text) => Object.assign(document.createElement('div'), { className: 'setting-note', textContent: text });

    const mkRow = (title, desc, control) => {
      const div = Object.assign(document.createElement('div'), { className: 'setting-item' });
      const textWrap = Object.assign(document.createElement('div'), { className: 'setting-text' });
      const lbl = Object.assign(document.createElement('label'), { className: 'setting-title', textContent: title });
      if (control && control.id) lbl.htmlFor = control.id;
      const d = Object.assign(document.createElement('div'), { className: 'setting-desc', textContent: desc });
      textWrap.append(lbl, d);
      div.append(textWrap);
      if (control) {
        const ctrlWrap = Object.assign(document.createElement('div'), { className: 'setting-control' });
        ctrlWrap.appendChild(control);
        div.append(ctrlWrap);
      }
      return div;
    };

    const mkToggle = (id, checked) => {
      const wrap = Object.assign(document.createElement('div'), { className: 'ytee-toggle-wrap' });
      const cb = Object.assign(document.createElement('input'), { type: 'checkbox', id, checked });
      const track = Object.assign(document.createElement('label'), { className: 'ytee-toggle-track', htmlFor: id });
      track.appendChild(Object.assign(document.createElement('span'), { className: 'ytee-toggle-thumb' }));
      wrap.append(cb, track);
      return wrap;
    };

    let settingsDomBuilt = false;
    const showSettingsModal = () => {
      if (!settingsDomBuilt) {
        Object.values(tabContents).forEach(c => { while (c.firstChild) c.removeChild(c.firstChild); });

        // General tab
        const g = tabContents['tab-general'];
        g.append(mkSection('Playback'));
        const qualitySelect = Object.assign(document.createElement('select'), { id: 'preferred-quality', className: 'ytee-quality-select' });
        g.append(mkRow('Preferred quality', 'Applies instantly to all embeds', qualitySelect));

        g.append(mkSection('Volume Control'));
        g.append(mkRow('Scroll wheel volume', 'Use scroll to adjust volume on hover', mkToggle('ytee-enable-scroll-volume', false)));
        const volInitInput = Object.assign(document.createElement('input'), { type: 'number', id: 'ytee-initial-volume', min: '0', max: '100', className: 'hk-input' });
        g.append(mkRow('Initial volume', 'Default volume for embeds (%)', volInitInput));
        const volStepInput = Object.assign(document.createElement('input'), { type: 'number', id: 'ytee-volume-step', min: '1', max: '100', className: 'hk-input' });
        g.append(mkRow('Volume step', 'Amount changed per scroll tick (%)', volStepInput));

        const boostToggle = mkToggle('ytee-enable-volume-boost', false);
        g.append(mkRow('Volume boost', 'Amplify audio beyond 100%', boostToggle));

        const volBoostInput = Object.assign(document.createElement('input'), { type: 'range', id: 'volume-boost-level', min: '1.0', max: '3.0', step: '0.1' });
        const volBoostValue = Object.assign(document.createElement('span'), { className: 'ytee-slider-value', textContent: '1.0x' });
        volBoostInput.addEventListener('input', () => { volBoostValue.textContent = `${Number(volBoostInput.value).toFixed(1)}x`; });
        const boostSliderWrap = Object.assign(document.createElement('div'), { style: 'display:flex; align-items:center; gap:12px;' });
        boostSliderWrap.append(volBoostInput, volBoostValue);
        const boostLevelRow = mkRow('Boost intensity', 'How much to amplify', boostSliderWrap);
        g.append(boostLevelRow);

        const updateBoostState = () => {
          const enabled = boostToggle.querySelector('input').checked;
          volBoostInput.disabled = !enabled;
          boostLevelRow.style.opacity = enabled ? '1' : '0.4';
          boostLevelRow.style.filter = enabled ? '' : 'grayscale(1)';
          boostLevelRow.style.pointerEvents = enabled ? 'auto' : 'none';
        };
        boostToggle.querySelector('input').addEventListener('change', updateBoostState);

        // Tools tab
        const t = tabContents['tab-tools'];
        t.append(mkSection('Clip Recording'));
        const clipDurInput = Object.assign(document.createElement('input'), { type: 'number', id: 'clip-duration', min: '1', max: '300', className: 'hk-input' });
        t.append(mkRow('Standard duration', 'Default clip length in seconds', clipDurInput));
        const clipCtrlInput = Object.assign(document.createElement('input'), { type: 'number', id: 'clip-duration-ctrl', min: '1', max: '300', className: 'hk-input' });
        t.append(mkRow('Ctrl+click duration', 'Extended clip length in seconds', clipCtrlInput));

        t.append(mkSection('Instant Replay'));
        const replayDurInput = Object.assign(document.createElement('input'), { type: 'number', id: 'replay-duration', min: '1', max: '60', className: 'hk-input' });
        t.append(mkRow('Replay buffer', 'How many seconds to keep in memory', replayDurInput));

        const replayQualitySelect = Object.assign(document.createElement('select'), { id: 'replay-quality', className: 'ytee-quality-select' });
        const qualities = [
          { val: 'very low', label: 'Very Low (1 Mbps)' },
          { val: 'low', label: 'Low (2.5 Mbps)' },
          { val: 'medium', label: 'Medium (5 Mbps)' },
          { val: 'high', label: 'High (10 Mbps)' },
          { val: 'very high', label: 'Very High (20 Mbps)' }
        ];
        qualities.forEach(q => {
          replayQualitySelect.appendChild(Object.assign(document.createElement('option'), { value: q.val, textContent: q.label }));
        });
        t.append(mkRow('Replay quality', 'Higher quality increases RAM and CPU usage', replayQualitySelect));

        t.append(mkSection('Media Assets'));
        const mkDlBtn = () => {
          const b = Object.assign(document.createElement('button'), { className: 'ytee-btn', style: 'opacity:1; pointer-events:auto; width:95px; height:28px; font-size:11px; border-radius:8px !important;' });
          const iconSpan = document.createElement('span'); iconSpan.className = 'ytee-icon'; iconSpan.appendChild(ICON_DEFS.download());
          iconSpan.querySelector('svg').style.width = '14px'; iconSpan.querySelector('svg').style.height = '14px';
          const labelSpan = Object.assign(document.createElement('span'), { className: 'ytee-label', textContent: 'Download' });
          b.append(iconSpan, labelSpan);
          return b;
        };
        const dlThumbBtn = mkDlBtn();
        t.append(mkRow('Video thumbnail', "Download the current video's thumbnail", dlThumbBtn));

        const dlPfpBtn = mkDlBtn();
        t.append(mkRow('Channel profile picture', "Download the channel's avatar", dlPfpBtn));

        dlThumbBtn.addEventListener('click', () => {
          const videoId = getVideoId(getPlayer());
          if (!videoId) return;
          let author = getVideoAuthor(getPlayer());

          const proceed = (auth) => {
            downloadUrlAsFile(`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`, `${auth}_thumbnail`);
            flashBtnState(dlThumbBtn, 'success');
          };

          if (author === 'YouTube') {
            setBtnLabel(dlThumbBtn, '…');
            GM_xmlhttpRequest({
              method: 'GET', url: `https://holodex.net/api/v2/videos/${videoId}?include=live_info`,
              headers: { "Referer": "https://holodex.net/", "Origin": "https://holodex.net" },
              onload: (r) => {
                if (r.status === 200) {
                  try {
                    const json = JSON.parse(r.responseText);
                    author = json.channel?.name || author;
                  } catch (e) { }
                }
                proceed(author);
                setBtnLabel(dlThumbBtn, 'Download');
              },
              onerror: () => { proceed(author); setBtnLabel(dlThumbBtn, 'Download'); }
            });
          } else {
            proceed(author);
          }
        });

        dlPfpBtn.addEventListener('click', () => {
          const videoId = getVideoId(getPlayer());
          if (!videoId) return;
          setBtnLabel(dlPfpBtn, '…');

          const fallbackToYouTube = (vId) => {
            GM_xmlhttpRequest({
              method: 'GET',
              url: `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${vId}&format=json`,
              onload: (r) => {
                if (r.status !== 200) { flashBtnState(dlPfpBtn, 'error'); setBtnLabel(dlPfpBtn, 'Download'); return; }
                try {
                  const json = JSON.parse(r.responseText);
                  const authorName = json.author_name || getVideoAuthor(getPlayer());
                  const channelUrl = json.author_url;
                  GM_xmlhttpRequest({
                    method: 'GET', url: channelUrl,
                    onload: (cr) => {
                      try {
                        const match = cr.responseText.match(/"avatar":\{"thumbnails":\[{"url":"([^"]+)"/);
                        const ogMatch = cr.responseText.match(/<meta property="og:image" content="([^"]+)"/);
                        const photoUrl = match?.[1] || ogMatch?.[1];
                        if (photoUrl) {
                          const cleanUrl = photoUrl.replace(/=s\d+-c-k-c0x[0-9a-f]+-no-rj/, '=s0').replace(/\\u0026/g, '&');
                          downloadUrlAsFile(cleanUrl, `${authorName}_avatar`);
                          flashBtnState(dlPfpBtn, 'success');
                        } else { throw new Error('No avatar found'); }
                      } catch (e) { flashBtnState(dlPfpBtn, 'error'); }
                      setBtnLabel(dlPfpBtn, 'Download');
                    },
                    onerror: () => { flashBtnState(dlPfpBtn, 'error'); setBtnLabel(dlPfpBtn, 'Download'); }
                  });
                } catch (e) { flashBtnState(dlPfpBtn, 'error'); setBtnLabel(dlPfpBtn, 'Download'); }
              },
              onerror: () => { flashBtnState(dlPfpBtn, 'error'); setBtnLabel(dlPfpBtn, 'Download'); }
            });
          };

          GM_xmlhttpRequest({
            method: 'GET', url: `https://holodex.net/api/v2/videos/${videoId}?include=live_info`,
            headers: { "Referer": "https://holodex.net/", "Origin": "https://holodex.net" },
            onload: (r) => {
              if (r.status === 200) {
                try {
                  const json = JSON.parse(r.responseText);
                  const photo = json.channel?.photo;
                  if (photo) {
                    const author = json.channel.name || getVideoAuthor(getPlayer());
                    downloadUrlAsFile(photo.replace(/=s\d+-c-k-c0x[0-9a-f]+-no-rj/, '=s0'), `${author}_avatar`);
                    flashBtnState(dlPfpBtn, 'success');
                    setBtnLabel(dlPfpBtn, 'Download');
                    return;
                  }
                } catch (e) { }
              }
              fallbackToYouTube(videoId);
            },
            onerror: () => fallbackToYouTube(videoId)
          });
        });

        // Interface tab
        const ui = tabContents['tab-interface'];
        ui.append(mkSection('Appearance'));
        ui.append(mkRow('Compact icon mode', 'Smaller icons', mkToggle('ytee-compact-mode', false)));
        ui.append(mkRow('High contrast UI', 'Make buttons and text stand out more', mkToggle('ytee-high-contrast', false)));

        ui.append(mkSection('Button Visibility'));
        const grid = Object.assign(document.createElement('div'), { className: 'ytee-grid-2' });
        const buttonNames = {
          vol: 'Volume slider', wl: 'Watch later', url: 'Copy URL', thumb: 'Thumbnail', pfp: 'Profile picture', screenshot: 'Screenshot',
          clip: 'Clip', replay: 'Replay', pip: 'PiP', speed: 'Speed', stats: 'Stats'
        };
        Object.keys(buttonNames).forEach(key => grid.append(mkRow(buttonNames[key], '', mkToggle(`btn-${key}`, false))));
        ui.append(grid);

        // Hotkey tab
        const hk = tabContents['tab-hotkeys'];
        hk.append(mkSection('Key Bindings'));
        const hotkeyNames = {
          toggleMute: ['Toggle Mute', 'Mute/unmute player'],
          toggleStats: ['Toggle Stats', 'Show/Hide Stats for Nerds'],
          toggleMiniStats: ['Toggle Mini Stats', 'Show/Hide Mini Stats'],
          increaseSpeed: ['Speed Up', 'Increase rate by 0.1x'],
          decreaseSpeed: ['Slow Down', 'Decrease rate by 0.1x'],
          increaseSpeedFine: ['Speed Up (Fine)', 'Increase rate by 0.01x'],
          decreaseSpeedFine: ['Slow Down (Fine)', 'Decrease rate by 0.01x'],
          volumeUp: ['Volume Up', 'Increase volume level'],
          volumeDown: ['Volume Down', 'Decrease volume level'],
          toggleSettings: ['Toggle Settings', 'Open/close settings'],
        };
        Object.keys(hotkeyNames).forEach(key => {
          const input = Object.assign(document.createElement('input'), { type: 'text', id: `hk-${key}`, className: 'hk-input' });
          input.addEventListener('blur', () => { input.value = sanitizeHotkeyInput(input.value); });
          hk.append(mkRow(hotkeyNames[key][0], hotkeyNames[key][1], input));
        });

        settingsDomBuilt = true;
      }

      const p = getPlayer();
      let availableLevels = [];
      if (p && typeof p.getAvailableQualityLevels === 'function') availableLevels = p.getAvailableQualityLevels().filter(q => q !== 'auto' && q !== 'unknown');
      if (availableLevels.length === 0) availableLevels = QUALITY_ORDER.slice();

      const qualitySelect = document.getElementById('preferred-quality');
      if (qualitySelect) {
        while (qualitySelect.firstChild) qualitySelect.removeChild(qualitySelect.firstChild);
        qualitySelect.appendChild(Object.assign(document.createElement('option'), { value: 'auto', textContent: QUALITY_LABELS['auto'] }));
        availableLevels.forEach(level => qualitySelect.appendChild(Object.assign(document.createElement('option'), { value: level, textContent: QUALITY_LABELS[level] || level })));
        qualitySelect.value = currentSettings.preferredQuality || 'auto';
      }

      const setCb = (id, val) => { const el = document.getElementById(id); if (el) el.checked = val; };
      const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };

      setCb('ytee-enable-scroll-volume', currentSettings.enableScrollVolume);
      setVal('ytee-volume-step', currentSettings.volumeStep);
      setVal('ytee-initial-volume', currentSettings.initialVolume);
      setCb('ytee-enable-volume-boost', currentSettings.enableVolumeBoost);
      const bToggle = document.getElementById('ytee-enable-volume-boost');
      if (bToggle) bToggle.dispatchEvent(new Event('change'));

      setVal('volume-boost-level', currentSettings.volumeBoostLevel);
      const bLevel = document.getElementById('volume-boost-level');
      if (bLevel) bLevel.dispatchEvent(new Event('input'));

      setVal('clip-duration', currentSettings.clipDuration);
      setVal('clip-duration-ctrl', currentSettings.clipDurationCtrl);
      setVal('replay-duration', currentSettings.instantReplayDuration);
      setVal('replay-quality', currentSettings.instantReplayQuality);

      Object.keys(currentSettings.hotkeys).forEach(key => setVal(`hk-${key}`, currentSettings.hotkeys[key]));
      setCb('ytee-compact-mode', currentSettings.compactMode);
      setCb('ytee-high-contrast', currentSettings.highContrastUI);
      Object.keys(currentSettings.buttons).forEach(key => setCb(`btn-${key}`, currentSettings.buttons[key]));

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
      Object.keys(defaultSettings.buttons).forEach(key => {
        const el = document.getElementById(`btn-${key}`);
        if (el) newSettings.buttons[key] = el.checked;
      });
      Object.keys(defaultSettings.hotkeys).forEach(key => {
        const el = document.getElementById(`hk-${key}`);
        if (el) newSettings.hotkeys[key] = sanitizeHotkeyInput(el.value);
      });
      newSettings.volumeBoostLevel = Number(document.getElementById('volume-boost-level').value) || 1;
      newSettings.enableVolumeBoost = document.getElementById('ytee-enable-volume-boost').checked;
      newSettings.enableScrollVolume = document.getElementById('ytee-enable-scroll-volume').checked;
      newSettings.volumeStep = Math.min(100, Math.max(1, Number(document.getElementById('ytee-volume-step').value) || 5));
      newSettings.initialVolume = Math.min(100, Math.max(0, Number(document.getElementById('ytee-initial-volume').value) || 100));
      newSettings.clipDuration = Math.min(300, Math.max(1, Number(document.getElementById('clip-duration').value) || 5));
      newSettings.clipDurationCtrl = Math.min(300, Math.max(1, Number(document.getElementById('clip-duration-ctrl').value) || 300));
      newSettings.instantReplayDuration = Math.min(60, Math.max(1, Number(document.getElementById('replay-duration').value) || 30));
      newSettings.instantReplayQuality = document.getElementById('replay-quality').value || 'medium';
      newSettings.preferredQuality = document.getElementById('preferred-quality').value || 'auto';
      newSettings.compactMode = document.getElementById('ytee-compact-mode').checked;
      newSettings.highContrastUI = document.getElementById('ytee-high-contrast').checked;
      newSettings.volumeCache = currentSettings.volumeCache || {};
      newSettings.isCollapsed = currentSettings.isCollapsed;
      currentSettings = newSettings;
      saveStoredSettings(currentSettings);
      buildHotkeyMap();
      applyVolume(targetVolume);
      applyQuality();
      applyUIStates(currentSettings);
      updateButtonVisibility();

      if (replayActive) { stopInstantReplay(); setTimeout(startInstantReplay, 200); }
      saveBtn.textContent = 'Saved'; saveBtn.disabled = true;
      setTimeout(() => { hideSettingsModal(); saveBtn.textContent = 'Save'; saveBtn.disabled = false; }, 350);
    });

    const updateButtonVisibility = () => {
      const buttonMap = { wl: wlBtn, url: urlBtn, thumb: thumbBtn, pfp: pfpBtn, screenshot: screenshotBtn, clip: clipBtn, replay: replayBtn, pip: pipBtn, speed: speedBtn, stats: statsBtn };
      let anyCollapsibleVisible = false;
      Object.keys(buttonMap).forEach(key => {
        const isVisible = key === 'pip'
          ? currentSettings.buttons[key] && pipSupported
          : key === 'replay'
            ? currentSettings.buttons[key] && replaySupported
            : currentSettings.buttons[key];
        buttonMap[key].style.display = isVisible ? '' : 'none';
        if (isVisible) anyCollapsibleVisible = true;
      });
      const volDisplay = currentSettings.buttons.vol ? '' : 'none';
      if (muteBtn) muteBtn.style.display = volDisplay;
      if (vol) vol.style.display = volDisplay;

      if (toggleBtn) toggleBtn.style.display = anyCollapsibleVisible ? '' : 'none';
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

    const onKeyDown = (e) => {
      const isShiftedSym = e.shiftKey && (e.key in SHIFTED_SYMBOL_MAP);
      const combo = [
        e.altKey ? 'alt+' : '',
        e.ctrlKey ? 'ctrl+' : '',
        e.shiftKey && !isShiftedSym ? 'shift+' : '',
        e.key.toLowerCase()
      ].join('');

      const action = hotkeyMap[combo];

      if (isSettingsOpen) {
        if (e.key === "Escape" || action === 'toggleSettings') {
          hideSettingsModal();
          e.preventDefault();
          e.stopImmediatePropagation();
        }
        return;
      }

      if (action) {
        e.stopImmediatePropagation(); e.preventDefault();
        switch (action) {
          case 'toggleMute': toggleMute(); break;
          case 'toggleStats': toggleStats(); break;
          case 'toggleMiniStats': toggleMiniStats(); break;
          case 'increaseSpeed': applySpeed(targetSpeed + SPEED_STEP); break;
          case 'decreaseSpeed': applySpeed(targetSpeed - SPEED_STEP); break;
          case 'increaseSpeedFine': applySpeed(targetSpeed + SPEED_STEP_FINE); break;
          case 'decreaseSpeedFine': applySpeed(targetSpeed - SPEED_STEP_FINE); break;
          case 'volumeUp': applyVolume(targetVolume + (currentSettings.volumeStep / 100)); break;
          case 'volumeDown': applyVolume(targetVolume - (currentSettings.volumeStep / 100)); break;
          case 'toggleSettings': showSettingsModal(); break;
        }
        showControls();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);


    const btnGroup = document.createElement("div");
    btnGroup.id = "custom-btn-group";
    btnGroup.append(toggleBtn, wlBtn, urlBtn, thumbBtn, pfpBtn, screenshotBtn, clipBtn, replayBtn, pipBtn, speedBtn, statsBtn, settingsBtn);
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

    const onMouseMove = () => {
      const now = Date.now();
      if (now - lastMouseMoveTime < MOUSE_THROTTLE_MS) return;
      lastMouseMoveTime = now;
      showControls();
    };
    window.addEventListener("mousemove", onMouseMove, { passive: true });


    // memory 2
    const initialVid = getVideoId(getPlayer());
    if (initialVid) {
      const cachedVol = currentSettings.volumeCache[initialVid];

      if (cachedVol !== undefined) {
        applyVolume(cachedVol);

        const reapplyCount = { n: 0 };
        const reapply = () => {
          if (reapplyCount.n++ < 5 && Math.abs(video.volume - cachedVol) > 0.01) {
            applyVolume(cachedVol);
          }
        };
        [100, 300, 600, 1200, 2000].forEach(ms => setTimeout(reapply, ms));
      } else {
        applyVolume(currentSettings.initialVolume / 100);
      }

      if (currentSettings.miniStatsCache[initialVid]) {
        toggleMiniStats();
      }
    }

    applySpeed(targetSpeed);
    showControls();


    const onDblClick = (e) => {
      if (isSettingsOpen) return;
      if (e.target.closest("#custom-btn-group, #custom-mute-btn, #custom-vol-slider")) return;

      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => { });
        return;
      }

      if (!document.fullscreenEnabled) {
        window.parent.postMessage({ type: 'YTEE_REQUEST_FULLSCREEN' }, '*');
        return;
      }

      const p = getPlayer();
      if (p && typeof p.requestFullscreen === 'function') {
        try { p.requestFullscreen(); return; } catch (e) { }
      }
      if (video.requestFullscreen) {
        video.requestFullscreen().catch(() => { });
        return;
      }
      if (video.webkitEnterFullscreen) {
        try { video.webkitEnterFullscreen(); } catch (e) { }
      }
    };
    window.addEventListener("dblclick", onDblClick, { passive: true });

    const initUI = () => {
      document.body.prepend(volPct, speedOverlay, clipOverlay, replayOverlay, miniStats, vol, muteBtn, btnGroup);
    };
    initUI();

    // Cleanup
    const updateEmbedWidth = () => {
      const w = document.documentElement.clientWidth || window.innerWidth;
      document.documentElement.style.setProperty('--ytee-ew', w + 'px');
      if (typeof applyMiniStatsPos === 'function') applyMiniStatsPos();
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
      clearTimeout(volTimeout); clearTimeout(speedTimeout); clearTimeout(controlsTimeout); clearInterval(miniStatsInterval);
      if (clipRafId) cancelAnimationFrame(clipRafId);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("dblclick", onDblClick);

      if (wheelRafId) cancelAnimationFrame(wheelRafId);
      clipRafId = null; wheelRafId = 0;
      if (clipRecorder) { try { if (clipRecorder.state !== 'inactive') clipRecorder.stop(); } catch (e) { } clipRecorder = null; }
      if (activeStream) { activeStream.getTracks().forEach(t => t.stop()); activeStream = null; }
      if (clipAudioDestination) {
        if (recordingGain) try { recordingGain.disconnect(clipAudioDestination); } catch (e) { }
        clipAudioDestination = null;
      }
      if (audioContext) { audioContext.suspend().catch(() => { }); }
      stopInstantReplay();
      replayChunks = [];
      replayInitChunk = null;
      cachedPlayer = null;
      resizeObs.disconnect();

      [settingsModal, btnGroup, volPct, speedOverlay, clipOverlay, replayOverlay, miniStats, vol, muteBtn].forEach(el => {
        if (el && el.parentNode) el.remove();
      });
    };
    window.addEventListener('pagehide', cleanup);

  });
})();
