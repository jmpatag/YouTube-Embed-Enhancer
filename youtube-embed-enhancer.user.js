// ==UserScript==
// @name         YouTube Embed Enhancer
// @namespace    https://github.com/jmpatag
// @version      3.3.0
// @description  Makes watching YouTube on embeds effortless. Upgrades barebones players (Holodex, multiview, forums) with a volume slider & boost, clip recording, PiP, Watch Later, sleep timer, synced history, and custom hotkeys.
// @author       jmpatag
// @license      GPL-3.0
// @match        *://www.youtube.com/embed/*
// @match        *://www.youtube-nocookie.com/embed/*
// @match        *://www.nexusmods.com/*
// @run-at       document-idle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addValueChangeListener
// @grant        GM_xmlhttpRequest
// @connect      holodex.net
// @connect      www.youtube.com
// @connect      api.github.com
// @connect      img.youtube.com
// @grant        unsafeWindow
// @downloadURL https://update.greasyfork.org/scripts/572481/YouTube%20Embed%20Enhancer.user.js
// @updateURL https://update.greasyfork.org/scripts/572481/YouTube%20Embed%20Enhancer.meta.js
// ==/UserScript==
(function () {
  'use strict';

  // Debug logging — enable with localStorage.ytee_debug = "1" to surface diagnostics. (delete with delete localStorage.ytee_debug)
  const YTEE_DEBUG = (() => { try { return localStorage.getItem("ytee_debug") === "1"; } catch (e) { return false; } })();
  const yteeWarn = (...a) => { if (YTEE_DEBUG) console.warn(...a); };
  const yteeLog = (...a) => { if (YTEE_DEBUG) console.log(...a); };

  const runTopFrameFixes = () => {
    const fixIframes = () => {
      document.querySelectorAll('iframe[src*="youtube.com/embed"]').forEach(iframe => {
        if (!iframe.hasAttribute('allowfullscreen')) iframe.setAttribute('allowfullscreen', '');
        const allow = iframe.getAttribute('allow') || '';
        if (!allow.includes('fullscreen')) iframe.setAttribute('allow', (allow ? allow + '; ' : '') + 'fullscreen');
      });
    };
    fixIframes();
    let fixIframesTimer = null;
    const fixIframesObs = new MutationObserver((mutations) => {
      let relevant = false;
      for (const m of mutations) {
        for (const n of m.addedNodes) {
          if (n.nodeType === 1 && (n.tagName === 'IFRAME' || n.querySelector?.('iframe'))) { relevant = true; break; }
        }
        if (relevant) break;
      }
      if (!relevant) return;
      clearTimeout(fixIframesTimer);
      fixIframesTimer = setTimeout(fixIframes, 150);
    });
    fixIframesObs.observe(document.documentElement, { childList: true, subtree: true });
    const stopFixIframesObs = () => setTimeout(() => fixIframesObs.disconnect(), 15000);
    if (document.readyState === 'complete') stopFixIframesObs();
    else window.addEventListener('load', stopFixIframesObs, { once: true });

    window.addEventListener('message', (e) => {
      if (e.data?.type === 'YTEE_REQUEST_FULLSCREEN') {
        const iframes = document.querySelectorAll('iframe');
        for (const f of iframes) {
          if (f.contentWindow === e.source) {
            if (document.fullscreenElement) document.exitFullscreen().catch(() => { });
            else f.requestFullscreen().catch(err => yteeWarn('YTEE: Parent fullscreen failed', err));
            break;
          }
        }
      }
    });

    return;
  };

  const computeIsChat = () => {
    const href = window.location.href.toLowerCase();
    if (href.includes('live_chat') || href.includes('livechat') || href.includes('chat_replay') || href.includes('is_chat=1')) return true;
    if (document.querySelector('yt-live-chat-renderer, yt-live-chat-app, #chat-messages, #live-chat-frame')) return true;
    if (document.documentElement.classList.contains('yt-live-chat-app') || (window.name && window.name.toLowerCase().includes('chat'))) return true;

    // Block HyperChat
    if (href.includes('hyperchat_embed')) return true;
    if (window.name && window.name.toLowerCase().includes('hyperchat')) return true;
    if (window.frameElement?.id === 'hyperchat') return true;

    return false;
  };

  let __isChatCached = false;
  const isChat = () => (__isChatCached ||= computeIsChat());

  const YTEE_CRITICAL_CSS = `
          :root {
            --ytee-ew: 800px;
            --ytee-btn-size: clamp(28px, calc(var(--ytee-ew) * 0.046), 37.5px);
            --ytee-icon-size: clamp(16px, calc(var(--ytee-ew) * 0.026), 21px);
            --ytee-font-size: clamp(11px, calc(var(--ytee-ew) * 0.019), 15px);
            --ytee-gap: clamp(2.5px, calc(var(--ytee-ew) * 0.00375), 5px);
            --ytee-pad-h: clamp(6px, calc(var(--ytee-ew) * 0.008), 14px);
            --ytee-pad-v: clamp(6px, 1vh, 18px);
            --ytee-thumb-size: clamp(10px, calc(var(--ytee-ew) * 0.013), 14px);
            --ytee-bg-dark: rgba(15,15,15,0.95);
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
            --ytee-btn-bg: rgba(10,10,10,0.82);
            --ytee-btn-border: rgba(255,255,255,0.28);
            --ytee-btn-hover: rgba(30,30,30,0.95);
            --ytee-text: #fff;
          }
          player-fullscreen-action-menu { display: none !important; }

          /* Shared overlay base */
          .ytee-overlay {
          position: fixed;
          left: 50%;
          transform: translateX(-50%);
          border-radius: 6px;
          font-weight: bold;
          z-index: 9999;
          opacity: 0;
          pointer-events: none;
          transition: opacity var(--ytee-anim-slow);
          }
          .ytee-overlay.show { opacity: 1; transition: opacity var(--ytee-anim-fast); }

          #custom-vol-overlay,
          #custom-speed-overlay {
          top: clamp(60px,10vh,140px);
          background: var(--ytee-bg-dark);
          color: var(--ytee-text);
          padding: clamp(5px,calc(var(--ytee-ew)*0.008),10px) clamp(10px,calc(var(--ytee-ew)*0.016),20px);
          font-size: clamp(13px,calc(var(--ytee-ew)*0.018),20px);
          font-family: sans-serif;
          }
          #custom-speed-overlay { top: clamp(95px,16vh,190px); }
          #custom-clip-overlay {
          top: clamp(125px,22vh,240px);
          background: rgba(180,0,0,0.78);
          color: white;
          padding: clamp(4px,calc(var(--ytee-ew)*0.005),7px) clamp(10px,calc(var(--ytee-ew)*0.014),18px);
          font-size: clamp(11px,calc(var(--ytee-ew)*0.014),16px);
          font-family: monospace;
          }
          #custom-replay-overlay {
          top: clamp(160px,28vh,300px);
          background: rgba(80,0,160,0.82);
          color: white;
          padding: clamp(4px,calc(var(--ytee-ew)*0.005),7px) clamp(10px,calc(var(--ytee-ew)*0.014),18px);
          font-size: clamp(11px,calc(var(--ytee-ew)*0.014),16px);
          font-family: monospace;
          }
          #custom-sleep-overlay {
          top: clamp(195px,34vh,360px);
          background: rgba(28,28,60,0.86);
          color: white;
          padding: clamp(4px,calc(var(--ytee-ew)*0.005),7px) clamp(10px,calc(var(--ytee-ew)*0.014),18px);
          font-size: clamp(11px,calc(var(--ytee-ew)*0.014),16px);
          font-family: sans-serif;
          }
          #custom-sleep-overlay.show { pointer-events: auto; cursor: pointer; }

          #custom-mini-stats {
          position: fixed;
          bottom: 45px;
          left: 10px;
          background: rgba(10,10,10,0.82);
          color: rgba(255,255,255,0.6);
          padding: 4px 10px;
          border-radius: 6px;
          font-family: ui-monospace,'Cascadia Code',monospace;
          font-size: 10.5px;
          z-index: 9999;
          border: 1px solid rgba(255,255,255,0.08);
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
          #custom-mini-stats b { color: rgba(255,255,255,0.3); font-weight: normal; margin-right: 4px; }

          #custom-mute-btn {
          position: fixed;
          bottom: var(--ytee-pad-v);
          left: var(--ytee-pad-h);
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
          }
          #custom-mute-btn.show { opacity: 1; pointer-events: auto; }
          #custom-mute-btn.show:hover { transform: scale(1.1); }
          #custom-mute-btn.muted {
          background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>');
          opacity: 0.5;
          }
          #custom-mute-btn.show.muted { opacity: 0.5; }

          #custom-vol-slider {
          position: fixed;
          bottom: calc(var(--ytee-pad-v) + var(--ytee-btn-size)/2 - 6px);
          left: calc(var(--ytee-pad-h) + var(--ytee-btn-size) + clamp(3px,calc(var(--ytee-ew)*0.004),7px));
          z-index: 9999;
          width: clamp(52px,calc(var(--ytee-ew)*0.072),90px);
          height: 12px;
          cursor: pointer;
          -webkit-appearance: none;
          appearance: none;
          background: transparent;
          border: none;
          padding: 0;
          margin: 0;
          outline: none;
          opacity: 0;
          pointer-events: none;
          transition: opacity var(--ytee-anim-slow), width var(--ytee-anim-normal);
          }
          #custom-vol-slider.show { opacity: 0.75; pointer-events: auto; }
          #custom-vol-slider.show:hover { opacity: 1; width: clamp(68px,calc(var(--ytee-ew)*0.092),110px); }
          #custom-vol-slider::-webkit-slider-runnable-track { -webkit-appearance: none; height: 3px; border-radius: 2px; background: rgba(255,255,255,0.35); border: none; }
          #custom-vol-slider::-moz-range-track { height: 3px; border-radius: 2px; background: rgba(255,255,255,0.35); border: none; }
          #custom-vol-slider::-webkit-slider-thumb {
          width: var(--ytee-thumb-size); height: var(--ytee-thumb-size);
          margin-top: calc((var(--ytee-thumb-size) / -2) + 1.5px);
          appearance: none; border-radius: 50%; background: white;
          box-shadow: 0 1px 3px rgba(0,0,0,0.5);
          }
          #custom-vol-slider::-moz-range-thumb {
          width: var(--ytee-thumb-size); height: var(--ytee-thumb-size);
          border-radius: 50%; background: white; border: none;
          box-shadow: 0 1px 3px rgba(0,0,0,0.5);
          }

          #custom-btn-group {
          position: fixed;
          bottom: var(--ytee-pad-v);
          right: var(--ytee-pad-h);
          display: flex;
          align-items: center;
          gap: var(--ytee-gap);
          z-index: 9999;
          opacity: 0;
          pointer-events: none;
          transition: opacity var(--ytee-anim-slow);
          }
          #custom-btn-group.show { opacity: 1; pointer-events: auto; }
          #custom-btn-group.collapsed .ytee-collapsible { display: none; }
          #custom-btn-group.collapsed { gap: 4px; }

          .ytee-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
            cursor: pointer;
            color: var(--ytee-text);
            background: var(--ytee-btn-bg);
            border: 1px solid var(--ytee-btn-border);
            border-radius: var(--ytee-radius);
            font-size: var(--ytee-font-size);
            font-family: ui-monospace,'Cascadia Code',monospace;
            font-weight: 700;
            letter-spacing: 0.03em;
            line-height: 1;
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
          .ytee-btn:hover { background: var(--ytee-btn-hover); transform: scale(1.08); z-index: 10; }
          .ytee-btn:focus-visible, #custom-mute-btn:focus-visible, #custom-vol-slider:focus-visible {
            outline: 2px solid var(--ytee-accent); outline-offset: 2px; z-index: 12;
          }
          .ytee-btn:focus:not(:focus-visible) { outline: none; }
          #custom-speed-btn { width: auto; min-width: var(--ytee-btn-size); padding: 0 clamp(3px,calc(var(--ytee-ew)*0.004),7px); }
          .ytee-btn .ytee-icon { display: flex; }
          .ytee-btn .ytee-label { display: none; }

          /* Tooltip — use display:none so hidden tooltips cost nothing */
          .ytee-btn::after { display: none; }
          .ytee-btn[data-tip]:not([data-tip=""]):hover::after {
            content: attr(data-tip);
            display: block;
            position: absolute;
            bottom: calc(100% + 7.5px);
            right: 0;
            background: rgba(10,10,10,0.92);
            color: rgba(255,255,255,0.92);
            font-size: 12.5px;
            font-family: system-ui,sans-serif;
            font-weight: 500;
            white-space: nowrap;
            padding: 3.75px 10px;
            border-radius: 5px;
            border: 1.25px solid rgba(255,255,255,0.1);
            pointer-events: none;
            letter-spacing: 0;
            z-index: 11;
          }

          [data-ytee-labels="1"] .ytee-btn { width: auto; padding: 0 clamp(6px,calc(var(--ytee-ew)*0.009),13px); }
          [data-ytee-labels="1"] .ytee-btn .ytee-label { display: inline; }
          [data-ytee-labels="1"] .ytee-btn .ytee-icon { display: flex; }
          #custom-settings-btn, #custom-toggle-btn { width: var(--ytee-btn-size); padding: 0; }
          #custom-settings-btn .ytee-label, #custom-toggle-btn .ytee-label { display: none; }

          #custom-stats-btn.active { color: var(--ytee-stats-color); background: var(--ytee-stats-bg); border-color: var(--ytee-stats-border); }
          #custom-stats-btn.active svg { fill: var(--ytee-stats-color); }
          #custom-stats-btn.nerds-active { color: #7ddeff; background: rgba(119,221,255,0.12); border-color: rgba(119,221,255,0.55); }
          #custom-stats-btn.nerds-active svg { fill: #7ddeff; }
          #custom-stats-btn.active.nerds-active { background: var(--ytee-stats-bg); border-color: #7ddeff; color: #7ddeff; }
          #custom-stats-btn.active.nerds-active svg { fill: #7ddeff; }
          #custom-speed-btn.modified { color: var(--ytee-speed-color); background: var(--ytee-speed-bg); border-color: var(--ytee-speed-border); }
          #custom-speed-btn.modified svg { fill: var(--ytee-speed-color); }
          #custom-sleep-btn.active { color: var(--ytee-speed-color); background: var(--ytee-speed-bg); border-color: var(--ytee-speed-border); }
          #custom-sleep-btn.active svg { fill: var(--ytee-speed-color); }

          @keyframes ytee-rec-pulse {
            0%,100% { outline: 2px solid rgba(255,60,60,0); outline-offset: 0px; }
            50%      { outline: 2px solid rgba(255,60,60,0.7); outline-offset: 3px; }
          }
          #custom-clip-btn.recording { color: #ff4444; background: var(--ytee-rec-bg); border-color: var(--ytee-rec-border); animation: ytee-rec-pulse 1.1s ease-in-out infinite; }
          #custom-clip-btn.recording svg { fill: #ff4444; }
          @keyframes ytee-replay-pulse {
            0%,100% { outline: 2px solid rgba(160,80,255,0); outline-offset: 0px; }
            50%      { outline: 2px solid rgba(160,80,255,0.7); outline-offset: 3px; }
          }
          #custom-replay-btn.buffering { color: #c084fc; background: rgba(160,80,255,0.15); border-color: rgba(160,80,255,0.65); animation: ytee-replay-pulse 2s ease-in-out infinite; }
          #custom-replay-btn.buffering svg { fill: #c084fc; }

          @keyframes ytee-btn-bounce {
            0%,100% { transform: scale(1); }
            40%      { transform: scale(1.25); }
            60%      { transform: scale(0.95); }
          }
          .ytee-btn.success { color: #2ecc71; background: rgba(46,204,113,0.2); border-color: rgba(46,204,113,0.6); animation: ytee-btn-bounce 0.45s cubic-bezier(0.34,1.56,0.64,1); z-index: 20; }
          .ytee-btn.success svg { fill: #2ecc71; }
          .ytee-btn.error { color: #ff4444; background: rgba(255,68,68,0.2); border-color: rgba(255,68,68,0.6); animation: ytee-btn-bounce 0.45s cubic-bezier(0.34,1.56,0.64,1); z-index: 20; }
          .ytee-btn.error svg { fill: #ff4444; }

          #custom-sleep-overlay { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
          .ytee-sleep-snooze {
            background: rgba(255,255,255,0.14); color: #fff;
            border: 1px solid rgba(255,255,255,0.25); border-radius: 5px;
            padding: 3px 9px; font: 600 11px sans-serif; cursor: pointer;
          }
          .ytee-sleep-snooze:hover { background: rgba(255,255,255,0.26); }
          #ytee-sleep-chip {
            position: fixed; top: 8px; left: 8px; z-index: 9999;
            background: rgba(20,20,45,0.72); color: rgba(255,255,255,0.65);
            font: 600 10.5px ui-monospace,'Cascadia Code',monospace;
            padding: 3px 9px; border-radius: 999px;
            border: 1px solid rgba(255,255,255,0.12);
            opacity: 0; pointer-events: none; cursor: pointer;
            transition: opacity var(--ytee-anim-slow);
          }
          #ytee-sleep-chip.show { opacity: 0.8; pointer-events: auto; }
          #ytee-sleep-chip:hover { opacity: 1; }

          #ytee-annot-panel {
            position: fixed;
            bottom: calc(var(--ytee-pad-v) + var(--ytee-btn-size) + 10px);
            right: var(--ytee-pad-h);
            width: clamp(260px, calc(var(--ytee-ew) * 0.42), 320px);
            max-height: min(60vh, 420px);
            display: flex;
            flex-direction: column;
            background: rgba(18,18,20,0.97);
            border: 1px solid rgba(255,255,255,0.14);
            border-radius: 10px;
            box-shadow: 0 14px 40px rgba(0,0,0,0.55);
            color: rgba(255,255,255,0.92);
            font-family: system-ui, sans-serif;
            font-size: 12px;
            z-index: 10000;
            opacity: 0;
            pointer-events: none;
            transform: translateY(6px);
            transition: opacity var(--ytee-anim-normal), transform var(--ytee-anim-normal);
          }
          #ytee-annot-panel.show { opacity: 1; pointer-events: auto; transform: translateY(0); }
          #ytee-annot-panel .ytee-annot-head {
            display: flex; align-items: center; justify-content: space-between;
            padding: 9px 11px; border-bottom: 1px solid rgba(255,255,255,0.1);
            font-weight: 600; font-size: 11px; letter-spacing: 0.04em; text-transform: uppercase;
            color: rgba(255,255,255,0.55);
          }
          #ytee-annot-panel .ytee-annot-x {
            background: none; border: none; color: rgba(255,255,255,0.5);
            font-size: 15px; line-height: 1; cursor: pointer; padding: 0 2px;
          }
          #ytee-annot-panel .ytee-annot-x:hover { color: #fff; }
          #ytee-annot-panel .ytee-annot-body { padding: 10px 11px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; }
          #ytee-annot-panel .ytee-annot-add {
            width: 100%; text-align: left; display: flex; align-items: center; gap: 7px;
            font: 600 11.5px system-ui, sans-serif; cursor: pointer;
            padding: 8px 9px; border-radius: 7px;
            border: 1px dashed rgba(245,181,61,0.7); background: rgba(245,181,61,0.13); color: #f5b53d;
          }
          #ytee-annot-panel .ytee-annot-add:hover { background: rgba(245,181,61,0.2); }
          #ytee-annot-panel .ytee-annot-add .ytee-annot-now { margin-left: auto; font-family: ui-monospace, monospace; opacity: 0.85; }
          #ytee-annot-panel .ytee-annot-marks { display: flex; flex-direction: column; gap: 1px; overflow-y: auto; }
          #ytee-annot-panel .ytee-annot-mark {
            display: grid; grid-template-columns: auto 1fr auto auto; gap: 8px; align-items: center;
            padding: 5px 6px; border-radius: 6px;
          }
          #ytee-annot-panel .ytee-annot-mark:hover { background: rgba(255,255,255,0.06); }
          #ytee-annot-panel .ytee-annot-mark .ytee-annot-ts { font-family: ui-monospace, monospace; font-size: 10.5px; color: #f5b53d; cursor: pointer; }
          #ytee-annot-panel .ytee-annot-mark .ytee-annot-lbl { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer; }
          #ytee-annot-panel .ytee-annot-mark input {
            font: inherit; width: 100%; background: rgba(255,255,255,0.1);
            border: 1px solid #f5b53d; border-radius: 4px; color: #fff; padding: 3px 5px;
          }
          #ytee-annot-panel .ytee-annot-mark button {
            background: none; border: none; cursor: pointer; color: rgba(255,255,255,0.45); font-size: 12px; padding: 2px 3px;
          }
          #ytee-annot-panel .ytee-annot-mark button:hover { color: #ff6b6b; }
          #ytee-annot-panel .ytee-annot-empty { color: rgba(255,255,255,0.4); font-size: 11px; padding: 2px 2px 4px; }
          #ytee-annot-panel .ytee-annot-foot { font-size: 9.5px; line-height: 1.45; color: rgba(255,255,255,0.32); margin-top: 4px; }
          #custom-annot-btn.active { color: #f5b53d; background: rgba(245,181,61,0.14); border-color: rgba(245,181,61,0.55); }
          #custom-annot-btn.active svg { fill: #f5b53d; }
`;

    const YTEE_SETTINGS_CSS = `
          @keyframes ytee-modal-in {
            from { opacity: 0; transform: scale(0.97) translateY(6px); }
            to   { opacity: 1; transform: scale(1) translateY(0); }
          }
          @keyframes ytee-tab-in {
            from { opacity: 0; transform: translateY(4px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          #custom-settings-modal {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.78);
          
          backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
          z-index: 10000; display: none;
          align-items: center; justify-content: center;
          }
          #custom-settings-modal.show { display: flex; }
          #custom-settings-modal:fullscreen {
          background: #0a0a0a;
          display: flex; align-items: center; justify-content: center;
          }
          #custom-settings-content {
          background: #181818;
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: clamp(10px, calc(var(--ytee-ew) * 0.022), 20px);
          padding: 0;
          position: relative;
          width: clamp(320px, min(calc(var(--ytee-ew) * 0.92), 94vw), 860px);
          max-height: clamp(400px, min(85vh, calc(var(--ytee-ew) * 1.1)), 800px);
          display: flex; flex-direction: column;
          overflow: hidden;
          color: white;
          font-family: system-ui, -apple-system, sans-serif;
          box-shadow: 0 0 0 1px rgba(255,255,255,0.04) inset, 0 32px 80px rgba(0,0,0,0.9), 0 8px 24px rgba(0,0,0,0.5);
          animation: ytee-modal-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) both;
          }

          .ytee-compact #custom-settings-content {
            width: min(98vw, 760px) !important;
            max-height: 88vh !important;  /* was clamping to 400px+ which overflows 290px */
            border-radius: 10px !important;
          }
          .ytee-compact #ytee-settings-header {
            padding: 8px 10px 6px !important;
          }
          .ytee-compact #ytee-settings-header h2 {
            font-size: 12px !important;
          }
          .ytee-compact #ytee-settings-subtitle {
            font-size: 9px !important;
          }
          .ytee-compact .ytee-tabs {
            padding: 4px 6px !important;
            gap: 1px !important;
          }
          .ytee-compact .ytee-tab {
            padding: 4px 6px !important;
            font-size: 9px !important;
          }
          .ytee-compact .ytee-tab .ytee-icon svg {
            width: 9px !important; height: 9px !important;
          }
          .ytee-compact #custom-settings-items {
            padding: 6px 8px !important;
          }
          .ytee-compact .setting-row {
            padding: 5px 8px !important;
            gap: 4px !important;
            margin-bottom: 2px !important;
          }
          .ytee-compact .setting-title { font-size: 9px !important; }
          .ytee-compact .setting-desc { font-size: 8px !important; }
          .ytee-compact .ytee-section-title { font-size: 8px !important; margin: 8px 0 4px !important; }
          .ytee-compact #custom-settings-buttons {
            padding: 5px 8px !important;
          }
          .ytee-compact #custom-settings-save,
          .ytee-compact #custom-settings-cancel,
          .ytee-compact #custom-settings-restore,
          .ytee-compact #custom-settings-reset-hotkeys,
          .ytee-compact #custom-settings-clear-data {
            font-size: 9px !important;
            padding: 4px 8px !important;
          }

          /* Header */
          #ytee-settings-header {
          padding: clamp(12px, calc(var(--ytee-ew) * 0.022), 20px) clamp(14px, calc(var(--ytee-ew) * 0.03), 26px) clamp(10px, calc(var(--ytee-ew) * 0.015), 14px);
          display: flex; justify-content: space-between; align-items: center;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          }
          #ytee-settings-header div:first-child { flex: 1; }
          #custom-settings-content h2 {
          margin: 0; font-size: clamp(13px, calc(var(--ytee-ew) * 0.022), 17px);
          font-weight: 700; color: #fff; letter-spacing: -0.02em;
          }
          #ytee-settings-subtitle {
          font-size: clamp(9px, calc(var(--ytee-ew) * 0.013), 11px);
          color: rgba(255,255,255,0.35); margin: 2px 0 0; letter-spacing: 0.01em;
          }
          .ytee-header-actions { display: flex; gap: 6px; align-items: center; }

          /* Tab bar — pill style */
          #ytee-settings-tabs {
          display: flex; padding: clamp(6px, calc(var(--ytee-ew) * 0.01), 10px) clamp(8px, calc(var(--ytee-ew) * 0.02), 18px);
          gap: clamp(2px, calc(var(--ytee-ew) * 0.005), 4px);
          background: #181818;
          flex-shrink: 0;
          overflow-x: auto; scrollbar-width: none;
          position: sticky; top: 0; z-index: 2;
          }
          #ytee-settings-tabs::-webkit-scrollbar { display: none; }
          .ytee-tab {
            padding: clamp(5px, calc(var(--ytee-ew) * 0.01), 8px) clamp(8px, calc(var(--ytee-ew) * 0.018), 14px);
            font-size: clamp(10px, calc(var(--ytee-ew) * 0.015), 12.5px); font-weight: 600;
            color: rgba(255,255,255,0.38);
            cursor: pointer; border-radius: 8px;
            transition: color 0.18s, background 0.18s;
            user-select: none; display: flex; align-items: center;
            gap: clamp(3px, calc(var(--ytee-ew) * 0.007), 6px);
            white-space: nowrap; border: none; position: relative;
          }
          .ytee-tab .ytee-icon svg { width: clamp(10px, calc(var(--ytee-ew) * 0.016), 13px); height: clamp(10px, calc(var(--ytee-ew) * 0.016), 13px); }
          .ytee-tab .ytee-icon { opacity: 0.5; transition: opacity 0.18s; }
          .ytee-tab:hover { color: rgba(255,255,255,0.75); background: rgba(255,255,255,0.06); }
          .ytee-tab:hover .ytee-icon { opacity: 0.75; }
          .ytee-tab.active {
            color: var(--ytee-accent);
            background: rgba(16,185,129,0.12);
          }
          .ytee-tab.active .ytee-icon { opacity: 1; }

          /* Content area */
          #custom-settings-items {
          flex: 1; overflow-y: auto;
          padding: clamp(10px, calc(var(--ytee-ew) * 0.018), 16px) clamp(12px, calc(var(--ytee-ew) * 0.03), 26px);
          scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.1) transparent;
          }
          #custom-settings-items::-webkit-scrollbar { width: 4px; }
          #custom-settings-items::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 99px; }
          .ytee-tab-content { display: none; }
          .ytee-tab-content.active { display: block; animation: ytee-tab-in 0.2s ease-out; }

          /* Section titles — left accent bar, no all-caps */
          #custom-settings-content h3.setting-section-title {
          margin: 16px 0 8px; font-size: clamp(9px, calc(var(--ytee-ew) * 0.013), 11px);
          font-weight: 700; color: rgba(255,255,255,0.45);
          text-transform: uppercase; letter-spacing: 0.1em;
          display: flex; align-items: center; gap: 8px;
          }
          #custom-settings-content h3.setting-section-title::before {
          content: ''; display: block; width: 3px; height: 12px;
          background: var(--ytee-accent); border-radius: 99px; flex-shrink: 0;
          }
          #custom-settings-content h3.setting-section-title:first-child { margin-top: 4px; }

          /* Setting rows */
          #custom-settings-content .setting-item {
          display: flex; align-items: center; justify-content: space-between;
          gap: clamp(6px, calc(var(--ytee-ew) * 0.015), 12px);
          padding: clamp(8px, calc(var(--ytee-ew) * 0.016), 13px) clamp(10px, calc(var(--ytee-ew) * 0.02), 16px);
          margin-bottom: clamp(3px, calc(var(--ytee-ew) * 0.008), 6px);
          border-radius: clamp(8px, calc(var(--ytee-ew) * 0.015), 12px);
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.05);
          transition: background 0.15s, border-color 0.15s;
          }
          #custom-settings-content .setting-item:hover {
          background: rgba(255,255,255,0.055); border-color: rgba(255,255,255,0.09);
          }
          .setting-text { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
          .setting-title { font-size: clamp(10px, calc(var(--ytee-ew) * 0.016), 13px); font-weight: 600; color: rgba(255,255,255,0.9); cursor: pointer; }
          .setting-desc { font-size: clamp(9px, calc(var(--ytee-ew) * 0.012), 10.5px); color: rgba(255,255,255,0.32); line-height: 1.4; }
          .ytee-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 6px; }
          .ytee-grid-2 .setting-item { margin-bottom: 0; }

          /* Toggle — squish effect on thumb */
          .ytee-toggle-wrap { position: relative; width: 44px; height: 24px; flex-shrink: 0; }
          .ytee-toggle-wrap input { opacity: 0; width: 0; height: 0; position: absolute; }
          .ytee-toggle-track {
            position: absolute; inset: 0; border-radius: 99px;
            background: rgba(255,255,255,0.1); transition: background 0.22s ease; cursor: pointer;
          }
          .ytee-toggle-thumb {
            position: absolute; top: 4px; left: 4px;
            width: 16px; height: 16px; border-radius: 50%;
            background: #fff;
            transition: transform 0.25s cubic-bezier(0.23, 1, 0.32, 1),
                        width 0.12s ease, left 0.12s ease;
            box-shadow: 0 1px 4px rgba(0,0,0,0.35), 0 0 0 1px rgba(0,0,0,0.1);
          }
          .ytee-toggle-track:active .ytee-toggle-thumb { width: 20px; }
          .ytee-toggle-wrap input:checked ~ .ytee-toggle-track { background: var(--ytee-accent); }
          .ytee-toggle-wrap input:checked ~ .ytee-toggle-track .ytee-toggle-thumb { transform: translateX(20px); }
          .ytee-toggle-wrap input:checked ~ .ytee-toggle-track:active .ytee-toggle-thumb { transform: translateX(16px); width: 20px; }

          /* Inputs */
          #custom-settings-content .hk-input, #custom-settings-content .ytee-quality-select {
          width: 110px; padding: 7px 11px;
          background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px; color: rgba(255,255,255,0.9); font-size: 12px; font-weight: 600;
          font-family: ui-monospace, monospace; transition: border-color 0.15s, box-shadow 0.15s; text-align: right;
          }
          /* Selects size to their content instead of clipping at a fixed width */
          #custom-settings-content .ytee-quality-select {
          width: auto; min-width: 96px; max-width: 100%;
          text-align: left; text-align-last: left;
          }
          #custom-settings-content .setting-control { min-width: 0; max-width: 100%; }
          #custom-settings-content .hk-input[type="number"] { -moz-appearance: textfield; appearance: textfield; }
          #custom-settings-content .hk-input[type="number"]::-webkit-outer-spin-button,
          #custom-settings-content .hk-input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
          #custom-settings-content .hk-input:focus, #custom-settings-content .ytee-quality-select:focus {
          outline: none; border-color: rgba(16,185,129,0.6);
          box-shadow: 0 0 0 3px rgba(16,185,129,0.12);
          }
          /* hotkey capture field */
          #custom-settings-content .ytee-hk-field { display: flex; align-items: center; gap: 4px; }
          /* Hotkey fields read as keycaps: dashed pill when unset, solid accent chip when bound */
          #custom-settings-content .ytee-hk-field .hk-input {
          width: auto; min-width: 92px; max-width: 150px; cursor: pointer; text-align: center;
          border-style: dashed; border-color: rgba(255,255,255,0.28); background: rgba(255,255,255,0.05);
          }
          #custom-settings-content .ytee-hk-field .hk-input:not(:placeholder-shown) {
          border-style: solid; border-color: rgba(16,185,129,0.5);
          background: rgba(16,185,129,0.12); color: var(--ytee-accent); text-transform: uppercase;
          }
          #custom-settings-content .hk-input.ytee-hk-capturing,
          #custom-settings-content .hk-input.ytee-hk-capturing:not(:placeholder-shown) {
          color: var(--ytee-accent); border-style: solid; border-color: rgba(16,185,129,0.6);
          background: rgba(16,185,129,0.08);
          }
          #custom-settings-content .hk-input.ytee-hk-dupe { border-color: rgba(245,181,61,0.8); box-shadow: 0 0 0 3px rgba(245,181,61,0.18); }
          #custom-settings-content .ytee-hk-field .hk-input::placeholder { color: rgba(255,255,255,0.35); font-weight: 500; }
          #custom-settings-content .ytee-hk-clear {
          cursor: pointer; border: none; background: transparent; color: rgba(255,255,255,0.4);
          font-size: 15px; line-height: 1; padding: 2px 5px; border-radius: 4px;
          }
          #custom-settings-content .ytee-hk-clear:hover { color: rgba(255,255,255,0.9); background: rgba(255,255,255,0.1); }

          /* Range slider */
          #custom-settings-content input[type="range"] {
          -webkit-appearance: none; appearance: none; height: 3px; border-radius: 99px;
          background: rgba(255,255,255,0.1); outline: none; cursor: pointer; width: 130px;
          }
          #custom-settings-content input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none; width: 15px; height: 15px; border-radius: 50%;
          background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.4); transition: transform 0.12s;
          }
          #custom-settings-content input[type="range"]:hover::-webkit-slider-thumb { transform: scale(1.2); }
          .ytee-slider-value { font-size: 12px; font-weight: 700; color: rgba(255,255,255,0.5); min-width: 34px; text-align: right; }

          /* Footer */
          #custom-settings-buttons {
          display: flex; align-items: center; justify-content: flex-end;
          gap: clamp(5px, calc(var(--ytee-ew) * 0.01), 8px); flex-wrap: wrap;
          padding: clamp(10px, calc(var(--ytee-ew) * 0.018), 14px) clamp(12px, calc(var(--ytee-ew) * 0.03), 26px);
          background: rgba(0,0,0,0.2); border-top: 1px solid rgba(255,255,255,0.05);
          }
          #custom-settings-restore, #custom-settings-reset-hotkeys, #custom-settings-clear-data {
          display: inline-flex; align-items: center; gap: 5px;
          padding: clamp(5px, calc(var(--ytee-ew) * 0.009), 7px) clamp(8px, calc(var(--ytee-ew) * 0.015), 12px);
          background: transparent; border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px; color: rgba(255,255,255,0.4); cursor: pointer;
          font-size: clamp(10px, calc(var(--ytee-ew) * 0.014), 12px); font-weight: 600;
          transition: background 0.15s, color 0.15s, border-color 0.15s;
          }
          #custom-settings-clear-data { color: rgba(255,100,100,0.5); border-color: rgba(255,100,100,0.15); }
          #custom-settings-restore:hover, #custom-settings-reset-hotkeys:hover { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.8); border-color: rgba(255,255,255,0.15); }
          #custom-settings-clear-data:hover { background: rgba(255,60,60,0.08); color: rgba(255,100,100,0.9); border-color: rgba(255,100,100,0.3); }
          #custom-settings-restore:disabled { opacity: 0.6; cursor: default; }
          #custom-settings-restore.confirm, #custom-settings-reset-hotkeys.confirm {
          border-color: #f59e0b !important; color: #f59e0b !important; background: rgba(245,158,11,0.06) !important;
          }
          #custom-settings-restore.success, #custom-settings-reset-hotkeys.success {
          border-color: var(--ytee-accent) !important; color: var(--ytee-accent) !important; background: rgba(16,185,129,0.06) !important;
          }

          /* Clear data picker overlay */
          #ytee-cleardata-overlay {
          position: absolute; inset: 0; z-index: 6; border-radius: inherit;
          background: rgba(0,0,0,0.6); display: none;
          align-items: center; justify-content: center; padding: 16px;
          }
          #ytee-cleardata-overlay.show { display: flex; }
          #ytee-cleardata-panel {
          background: #1f1f1f; border: 1px solid rgba(255,255,255,0.12); border-radius: 12px;
          padding: 16px 18px; width: min(360px, 100%); max-height: 100%; overflow-y: auto;
          box-shadow: 0 20px 60px rgba(0,0,0,0.6); color: #fff;
          font-family: system-ui, -apple-system, sans-serif;
          }
          .ytee-clr-title { font-size: 14px; font-weight: 700; }
          .ytee-clr-sub { font-size: 11px; color: rgba(255,255,255,0.4); margin-top: 3px; }
          .ytee-clr-head { font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.06em; color: rgba(255,255,255,0.35); margin: 13px 0 3px; }
          .ytee-clr-row { display: flex; align-items: center; gap: 9px; padding: 6px 4px; border-radius: 6px; cursor: pointer; font-size: 12.5px; color: rgba(255,255,255,0.85); }
          .ytee-clr-row:hover { background: rgba(255,255,255,0.05); }
          .ytee-clr-row.empty { opacity: 0.4; cursor: default; }
          .ytee-clr-row input { cursor: pointer; accent-color: #ff6b6b; flex-shrink: 0; }
          .ytee-clr-row.empty input { cursor: default; }
          .ytee-clr-name { flex: 1; }
          .ytee-clr-count { font: 600 11px ui-monospace, monospace; color: rgba(255,255,255,0.4); }
          .ytee-clr-foot { display: flex; gap: 8px; justify-content: flex-end; margin-top: 15px; }
          .ytee-clr-foot button { padding: 6px 14px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; border: 1px solid transparent; transition: background 0.15s, border-color 0.15s; }
          .ytee-clr-cancel { background: transparent; border-color: rgba(255,255,255,0.15); color: rgba(255,255,255,0.6); }
          .ytee-clr-cancel:hover { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.85); }
          .ytee-clr-go { background: rgba(255,60,60,0.15); border-color: rgba(255,80,80,0.4); color: #ff6b6b; }
          .ytee-clr-go:hover { background: rgba(255,60,60,0.25); }
          .ytee-clr-foot button:disabled { opacity: 0.55; cursor: default; }
          #custom-settings-cancel, #custom-settings-save {
          padding: clamp(6px, calc(var(--ytee-ew) * 0.011), 9px) clamp(14px, calc(var(--ytee-ew) * 0.025), 20px);
          border-radius: 9px; font-size: clamp(11px, calc(var(--ytee-ew) * 0.016), 13.5px);
          font-weight: 700; cursor: pointer; transition: background 0.15s, color 0.15s, opacity 0.15s, transform 0.15s, box-shadow 0.15s;
          }
          #custom-settings-cancel {
          background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);
          color: rgba(255,255,255,0.7);
          }
          #custom-settings-cancel:hover { background: rgba(255,255,255,0.09); color: #fff; border-color: rgba(255,255,255,0.14); }
          #custom-settings-save {
          background: var(--ytee-accent); border: none; color: #000;
          box-shadow: 0 2px 12px rgba(16,185,129,0.3);
          }
          #custom-settings-save:hover { opacity: 0.88; transform: translateY(-1px); box-shadow: 0 4px 16px rgba(16,185,129,0.4); }

          /* Quality select */
          .ytee-quality-select {
          cursor: pointer; appearance: none; -webkit-appearance: none;
          background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' fill='rgba(255,255,255,0.35)'><path d='M0 0l5 6 5-6z'/></svg>");
          background-repeat: no-repeat; background-position: right 12px center; padding-right: 32px !important;
          }
          .ytee-quality-select option { background: #181818; color: white; }
          .ytee-quality-select:focus { outline: none; background-color: rgba(16,185,129,0.06); border-color: rgba(16,185,129,0.5); box-shadow: 0 0 0 3px rgba(16,185,129,0.1); }
          .ytee-quality-note { display: block; font-size: 11px; color: rgba(255,255,255,0.25); margin: 4px 12px 10px; line-height: 1.4; font-style: italic; }

          /* Info button — larger, easier to tap */
          .ytee-info-btn {
            display: flex; align-items: center; justify-content: center;
            width: 26px; height: 26px; border-radius: 8px;
            background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);
            color: rgba(255,255,255,0.35); cursor: pointer; transition: color 0.15s, background 0.15s, border-color 0.15s;
            flex-shrink: 0;
          }
          .ytee-info-btn:hover { background: rgba(119,221,255,0.1); border-color: rgba(119,221,255,0.25); color: #7ddeff; }
          .ytee-info-btn svg { width: 14px; height: 14px; }

          /* Info box */
          .ytee-info-box {
            margin: 0 0 12px; padding: 14px 16px;
            background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07);
            border-left: 3px solid rgba(119,221,255,0.4);
            border-radius: 0 10px 10px 0;
            font-size: 11.5px; line-height: 1.65; color: rgba(255,255,255,0.5);
            display: none; animation: ytee-tab-in 0.18s ease-out;
          }
          .ytee-info-box.show { display: block; }
          .ytee-info-box strong { color: rgba(119,221,255,0.85); font-weight: 700; margin-right: 4px; font-family: ui-monospace, monospace; }
          .ytee-info-box p { margin: 0 0 8px; }
          .ytee-info-box p:last-child { margin-bottom: 0; }
          .ytee-info-link { display: inline-block; color: #7ddeff; text-decoration: none; font-size: 10px; opacity: 0.45; transition: opacity 0.15s; margin-top: 6px; }
          .ytee-info-link:hover { opacity: 0.85; text-decoration: underline; }
          .ytee-info-title {
            font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.5);
            text-transform: uppercase; letter-spacing: 0.08em;
            margin-bottom: 8px;
          }
          .ytee-info-links {
            display: flex; gap: 10px; margin-top: 12px;
          }

          #ytee-settings-header { margin-bottom: 2px; }

          .setting-note { font-size: 12px; color: rgba(255,255,255,0.4); padding: 6px 2px; line-height: 1.5; }

          /* History rows/cards — hover handled in CSS so re-renders don't register thousands of JS listeners */
          .ytee-hist-list:hover { background: rgba(255,255,255,0.06) !important; border-color: rgba(255,255,255,0.12) !important; }
          .ytee-hist-list .ytee-hist-actions { opacity: 0; transition: opacity 0.15s; }
          .ytee-hist-list:hover .ytee-hist-actions { opacity: 1; }
          .ytee-hist-card:hover { border-color: rgba(255,255,255,0.18) !important; box-shadow: 0 4px 24px rgba(0,0,0,0.35); }
          .ytee-hist-card .ytee-hist-overlay { opacity: 0; pointer-events: none; transition: opacity 0.18s; }
          .ytee-hist-card:hover .ytee-hist-overlay { opacity: 1; pointer-events: auto; }
          /* Skip rendering off-screen history entries — big CPU/GPU/compositing win on long lists.
             contain-intrinsic-size keeps the scrollbar stable; the auto keyword remembers real size after first paint. */
          .ytee-hist-list { content-visibility: auto; contain-intrinsic-size: auto 61px; }
          .ytee-hist-card { content-visibility: auto; contain-intrinsic-size: auto 210px; }
          .ytee-hist-link:hover { color: #fff !important; text-decoration: underline; }
          .ytee-hist-sublink:hover { color: rgba(255,255,255,0.65) !important; text-decoration: underline; }

          /* Action buttons — hover in CSS instead of per-button JS listeners */
          .ytee-abtn { cursor: pointer; flex-shrink: 0; border: 1px solid transparent; font-family: inherit; }
          .ytee-abtn-circle { width: 28px; height: 28px; padding: 0; font-size: 15px; line-height: 1; display: inline-flex; align-items: center; justify-content: center; border-radius: 50%; border-color: rgba(255,255,255,0.12); color: rgba(255,255,255,0.85); background: rgba(255,255,255,0.06); transition: background 0.15s ease; }
          .ytee-abtn-circle:hover { background: rgba(255,255,255,0.12); }
          .ytee-abtn-pill { padding: 4px 7px; font-size: 11px; border-radius: 4px; border-color: rgba(255,255,255,0.12); color: rgba(255,255,255,0.7); background: rgba(255,255,255,0.07); }
          .ytee-abtn-overlay { padding: 5px 9px; font-size: 11px; font-weight: 600; backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); white-space: nowrap; border-radius: 6px; border-color: rgba(255,255,255,0.18); color: rgba(255,255,255,0.9); background: rgba(15,15,15,0.82); transition: background 0.12s, transform 0.1s; }
          .ytee-abtn-overlay:hover { background: rgba(40,40,40,0.95); transform: scale(1.06); }
          .ytee-abtn-strip { padding: 4px 8px; font-size: 10.5px; font-weight: 600; white-space: nowrap; border-radius: 6px; border-color: rgba(255,255,255,0.11); color: rgba(255,255,255,0.75); background: rgba(255,255,255,0.07); transition: background 0.12s, transform 0.1s; }
          .ytee-abtn-strip:hover { background: rgba(255,255,255,0.13); transform: scale(1.05); }
          .ytee-bkmk-row:hover { background: rgba(255,255,255,0.05); }

          /* Narrow embeds: one-column button grid, selects drop onto their own line.
             .ytee-compact is JS-toggled below YTEE_BP.COMPACT_W (w) or YTEE_BP.SHORT_H (h). */
          .ytee-compact .ytee-grid-2 { grid-template-columns: 1fr; }
          .ytee-compact #custom-settings-content .setting-item:has(.ytee-quality-select) { flex-wrap: wrap; }
          .ytee-compact #custom-settings-content .setting-item:has(.ytee-quality-select) .setting-control {
          width: 100%; display: flex; justify-content: flex-end;
          }
          .ytee-compact #custom-settings-content .setting-item {
          padding-top: clamp(6px, calc(var(--ytee-ew) * 0.012), 11px);
          padding-bottom: clamp(6px, calc(var(--ytee-ew) * 0.012), 11px);
          }

          /* Footer "Advanced" disclosure keeps the destructive actions away from Save */
          #custom-settings-buttons .ytee-adv { margin-right: auto; position: relative; }
          #custom-settings-buttons .ytee-adv > summary {
          list-style: none; cursor: pointer;
          font-size: clamp(10px, calc(var(--ytee-ew) * 0.014), 12px); font-weight: 600;
          color: rgba(255,255,255,0.4);
          border: 1px solid rgba(255,255,255,0.08); border-radius: 8px;
          padding: clamp(5px, calc(var(--ytee-ew) * 0.009), 7px) clamp(8px, calc(var(--ytee-ew) * 0.015), 12px);
          transition: color 0.15s, border-color 0.15s;
          }
          #custom-settings-buttons .ytee-adv > summary::-webkit-details-marker { display: none; }
          #custom-settings-buttons .ytee-adv > summary::before { content: '▸ '; opacity: 0.6; }
          #custom-settings-buttons .ytee-adv[open] > summary::before { content: '▾ '; }
          #custom-settings-buttons .ytee-adv > summary:hover,
          #custom-settings-buttons .ytee-adv[open] > summary { color: rgba(255,255,255,0.75); border-color: rgba(255,255,255,0.15); }
          #custom-settings-buttons .ytee-adv-tray { display: none; }
          #custom-settings-buttons .ytee-adv[open] .ytee-adv-tray {
          display: flex; flex-direction: column; gap: 6px; align-items: stretch;
          position: absolute; bottom: calc(100% + 6px); left: 0; white-space: nowrap;
          padding: 8px; border-radius: 10px;
          background: #1f1f1f; border: 1px solid rgba(255,255,255,0.1);
          z-index: 3; box-shadow: 0 8px 24px rgba(0,0,0,0.55);
          }
          #custom-settings-buttons .ytee-adv[open] .ytee-adv-tray > button { margin: 0; justify-content: center; }

          /* Blur effects toggled off (Interface > Blur effects) — drop GPU-compositing blur passes */
          :root[data-ytee-blur="0"] #custom-settings-modal { backdrop-filter: none; -webkit-backdrop-filter: none; background: rgba(0,0,0,0.9); }
          :root[data-ytee-blur="0"] .ytee-abtn-overlay { backdrop-filter: none; -webkit-backdrop-filter: none; background: rgba(15,15,15,0.94); }`;

  let yteeSettingsCSSInjected = false;
  const ensureSettingsCSS = () => {
    if (yteeSettingsCSSInjected) return;
    yteeSettingsCSSInjected = true;
    document.head.appendChild(Object.assign(document.createElement('style'), { textContent: YTEE_SETTINGS_CSS }));
  };

  const injectCriticalCSS = () => {
    document.head.appendChild(Object.assign(document.createElement('style'), { textContent: YTEE_CRITICAL_CSS }));
  };

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
    wl: () => mkSvgEl({ tag: 'path', attrs: { d: 'M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z' } }),
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
    general: () => mkSvgEl({ tag: 'path', attrs: { d: 'M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z' } }),
    tools: () => mkSvgEl({ tag: 'path', attrs: { d: 'M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.5 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z' } }),
    interface: () => mkSvgEl({ tag: 'path', attrs: { d: 'M4 11h5V5H4v6zm0 7h5v-6H4v6zm6 0h5v-6h-5v6zm6 0h5v-6h-5v6zm-6-7h5V5h-5v6zm6-6v6h5V5h-5z' } }),
    hotkeys: () => mkSvgEl({ tag: 'path', attrs: { d: 'M20 5H4c-1.1 0-1.99.9-1.99 2L2 17c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-9 3h2v2h-2V8zm0 3h2v2h-2v-2zM8 8h2v2H8V8zm0 3h2v2H8v-2zm-1 2H5v-2h2v2zm0-3H5V8h2v2zm9 7H8v-2h8v2zm0-4h-2v-2h2v2zm0-3h-2V8h2v2zm3 3h-2v-2h2v2zm0-3h-2V8h2v2z' } }),
    download: () => mkSvgEl({ tag: 'path', attrs: { d: 'M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z' } }),
    fullscreen: () => mkSvgEl({ tag: 'path', attrs: { d: 'M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z' } }),
    history: () => mkSvgEl({ tag: 'path', attrs: { d: 'M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z' } }),
    sleep: () => mkSvgEl({ tag: 'path', attrs: { d: 'M9.27 4.49C6.24 5.66 4 8.57 4 12c0 4.42 3.58 8 8 8 3.43 0 6.34-2.24 7.51-5.27-.86.32-1.8.49-2.77.49-4.42 0-8-3.58-8-8 0-.97.18-1.91.53-2.74z' } }),
    annot: () => mkSvgEl({ tag: 'path', attrs: { d: 'M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z' } }),
  };

  const mkBtn = (id, iconKey, labelText, tipText, titleText, isCollapsible = true) => {
    const btn = document.createElement('button');
    btn.id = id;
    btn.className = 'ytee-btn' + (isCollapsible ? ' ytee-collapsible' : '');
    const accessibleName = labelText || tipText || titleText || id;
    btn.title = titleText || tipText || labelText;
    btn.dataset.tip = tipText || labelText;
    btn.dataset.defaultLabel = labelText;
    btn.dataset.defaultTip = tipText || labelText;
    btn.setAttribute('aria-label', accessibleName);
    btn.type = 'button';
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

  const setBtnLabel = (btn, text, tipText) => {
    const label = btn.querySelector('.ytee-label');
    if (label) label.textContent = (text !== undefined && text !== null) ? text : btn.dataset.defaultLabel;
    btn.dataset.tip = (tipText !== undefined && tipText !== null) ? tipText : btn.dataset.defaultTip;
  };

  const flashBtnState = (btn, state, duration = 1500) => {
    btn.classList.add(state);
    setTimeout(() => btn.classList.remove(state), duration);
  };

  const flashBtnResult = (btn, label, state, holdMs = 1500) => {
    setBtnLabel(btn, label);
    if (state) flashBtnState(btn, state, holdMs);
    setTimeout(() => setBtnLabel(btn), holdMs);
  };

  const waitForVideo = (callback) => {
    const existing = document.querySelector("video");
    if (existing) { callback(existing); return; }
    let timer = null;
    const obs = new MutationObserver(() => {
      const v = document.querySelector("video");
      if (v) { obs.disconnect(); clearTimeout(timer); callback(v); }
    });
    obs.observe(document.body || document.documentElement, { childList: true, subtree: true });
    timer = setTimeout(() => {
      obs.disconnect();
      yteeWarn('YTEE: video element never appeared');
    }, 15000);
  };

  const formatClock = (totalSecs) => {
    totalSecs = Math.max(0, Math.floor(totalSecs || 0));
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;
    return h > 0
      ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
      : `${m}:${s.toString().padStart(2, '0')}`;
  };

  const getVideoAuthor = (player) => {
    if (player && typeof player.getVideoData === 'function') {
      const data = player.getVideoData();
      if (data?.author) return data.author.replace(/[<>:"/\\|?*\x00-\x1F]/g, '').trim();
    }
    const authorEl = document.querySelector('.ytp-title-channel-name, .ytp-title-expanded-title .ytp-title-link');
    if (authorEl && authorEl.textContent) return authorEl.textContent.replace(/[<>:"/\\|?*\x00-\x1F]/g, '').trim();
    return '';
  };

  // For filenames
  const getVideoAuthorForFile = (player) => getVideoAuthor(player) || 'YouTube';

  const getVideoTitle = (player) => {
    if (player && typeof player.getVideoData === 'function') {
      const data = player.getVideoData();
      if (data?.title) return data.title.replace(/[<>:"/\\|?*\x00-\x1F]/g, '').trim();
    }
    return '';
  };

  const formatTimestamp = (currentTime) => {
    const timeMs = Math.floor(currentTime * 1000);
    const mins = Math.floor(timeMs / 60000).toString().padStart(2, '0');
    const secs = Math.floor((timeMs % 60000) / 1000).toString().padStart(2, '0');
    const ms = (timeMs % 1000).toString().padStart(3, '0');
    return `${mins}-${secs}-${ms}`;
  };

  const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
  const getVideoId = (p) => {
    if (p && typeof p.getVideoData === 'function') {
      const id = p.getVideoData()?.video_id;
      if (id && VIDEO_ID_RE.test(id)) return id;
    }
    const fromPath = window.location.pathname.split('/').pop().split('?')[0].split('#')[0];
    if (VIDEO_ID_RE.test(fromPath)) return fromPath;
    const fromQuery = new URLSearchParams(window.location.search).get('v');
    return (fromQuery && VIDEO_ID_RE.test(fromQuery)) ? fromQuery : '';
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

  // Settings
  const defaultSettings = {
    buttons: { wl: true, url: true, screenshot: true, clip: true, replay: true, pip: true, speed: true, stats: true, sleep: true, annot: true, vol: true },
    hotkeys: {
      toggleMute: 'm', toggleStats: 'shift+s', toggleMiniStats: 'alt+s',
      increaseSpeed: '.', decreaseSpeed: ',', increaseSpeedFine: 'shift+.', decreaseSpeedFine: 'shift+,',
      volumeUp: 'arrowup', volumeDown: 'arrowdown', toggleSettings: 'q', toggleFullscreen: 'f',
      cycleSleepTimer: '', addBookmark: '',
      screenshot: '', clip: '', replay: '', pip: '', copyUrl: '', watchLater: '', toggleCollapse: '',
    },
    volumeBoostLevel: 1, enableVolumeBoost: false, enableScrollVolume: true, enableVolumeCache: false,
    volumeStep: 5, initialVolume: 100, clipDuration: 5, clipDurationCtrl: 300,
    instantReplayDuration: 30, instantReplayQuality: 'medium', preferredQuality: 'auto',
    sleepTimer: 'off', sleepTimerReset: 'playback', sleepTimerFadeOut: false, sleepTimerCustom: 120,
    compactMode: false, isCollapsed: false, highContrastUI: false, enableBlur: true,
    volumeCache: {}, miniStatsCache: {}, miniStatsPos: null, alwaysShowMiniStats: false,
    enablePositionCache: false, enableGistSync: false, historyViewMode: 'list',
    gistToken: '', gistId: '', gistSyncLastTime: 0, gistSyncInterval: 180, positionCache: {},
    favoritesCache: {}, annotationsCache: {},
  };

  let __ytee_gmStorageBroken = false;
  let __ytee_gmVerified = false;
  const isGmStorageBroken = () => __ytee_gmStorageBroken;

  // Obfuscates the token to keep raw ghp_... strings out of DevTools, dumps, and settings exports.
  // Note: Plain obfuscation, not encryptionn
  const __YTEE_TK_KEY = 'ytee§gist§fallback§v1';
  const __ytee_scrambleToken = (str) => {
    try {
      if (!str) return '';
      let out = '';
      for (let i = 0; i < str.length; i++) out += String.fromCharCode(str.charCodeAt(i) ^ __YTEE_TK_KEY.charCodeAt(i % __YTEE_TK_KEY.length));
      return btoa(out);
    } catch (e) { return ''; }
  };
  const __ytee_unscrambleToken = (enc) => {
    try {
      if (!enc) return '';
      const raw = atob(enc);
      let out = '';
      for (let i = 0; i < raw.length; i++) out += String.fromCharCode(raw.charCodeAt(i) ^ __YTEE_TK_KEY.charCodeAt(i % __YTEE_TK_KEY.length));
      return out;
    } catch (e) { return ''; }
  };

  const loadStoredSettings = () => {
    let gmVal = null;
    let gmAvailable = typeof GM_getValue === 'function';
    try {
      if (gmAvailable) gmVal = GM_getValue('ytee-settings', null);
    } catch (e) { yteeWarn('GM_getValue failed', e); gmAvailable = false; }

    let lsVal = null;
    try { lsVal = localStorage.getItem('ytee-settings'); } catch (e) { }

    if (gmAvailable && gmVal == null && lsVal != null) __ytee_gmStorageBroken = true;

    let settings = null;
    if (gmVal) { try { settings = typeof gmVal === 'string' ? JSON.parse(gmVal) : gmVal; } catch (e) { } }
    if (settings === null && lsVal) { try { settings = JSON.parse(lsVal); } catch (e) { } }
    if (settings === null) return null;

    let restored = false;
    if (settings && typeof settings === 'object' && !settings.gistToken) {
      try {
        const enc = localStorage.getItem('ytee-gist-tk');
        if (enc) { settings.gistToken = __ytee_unscrambleToken(enc); restored = !!settings.gistToken; }
      } catch (e) { }
    }
    yteeLog('YTEE load: gmAvailable=', gmAvailable, 'gmValPresent=', gmVal != null, 'lsValPresent=', lsVal != null,
      'broken=', __ytee_gmStorageBroken, 'tokenFromGM=', !!(settings && settings.gistToken && !restored), 'tokenRestoredFromKey=', restored);
    return settings;
  };

  const SAVE_DEBOUNCE = 400;
  let __ytee_save_timer = null;
  let __ytee_pending_settings = null;
  let __ytee_last_settings = null;
  let __ytee_last_payload = null;

  const __ytee_flushStoredSettings = (finalize = false) => {
    const s = __ytee_pending_settings || (finalize ? __ytee_last_settings : null);
    if (!s) return;
    __ytee_last_settings = s;
    const hasGM = typeof GM_setValue === 'function';
    let payload = null;
    try { payload = JSON.stringify(s); } catch (e) { payload = null; }
    if (payload !== null) {
      try { if (hasGM && payload !== __ytee_last_payload) { GM_setValue('ytee-settings', payload); __ytee_last_payload = payload; } } catch (e) { }
      if (hasGM && !__ytee_gmVerified) {
        try {
          const rb = GM_getValue('ytee-settings', null);
          const rbStr = rb == null ? null : (typeof rb === 'string' ? rb : JSON.stringify(rb));
          __ytee_gmVerified = rbStr === payload;
        } catch (e) { }
        if (!__ytee_gmVerified) __ytee_gmStorageBroken = true;
      }
      yteeLog('YTEE save: hasGM=', hasGM, 'gmVerified=', __ytee_gmVerified, 'broken=', __ytee_gmStorageBroken, 'tokenLen=', (s.gistToken || '').length);
      if (!hasGM || finalize) {
        try {
          let safePayload = payload;
          const prevToken = s.gistToken;
          if (prevToken) {
            s.gistToken = '';
            try { safePayload = JSON.stringify(s); } finally { s.gistToken = prevToken; }
          }
          localStorage.setItem('ytee-settings', safePayload);
        } catch (e) { }
        try {
          if (s.gistToken) {
            localStorage.setItem('ytee-gist-tk', __ytee_scrambleToken(s.gistToken));
            yteeLog('YTEE save: wrote ytee-gist-tk fallback');
          } else {
            localStorage.removeItem('ytee-gist-tk');
          }
        } catch (e) { }
      }
    }
    __ytee_pending_settings = null;
    if (__ytee_save_timer) { clearTimeout(__ytee_save_timer); __ytee_save_timer = null; }
  };

  const saveStoredSettings = (s, opts = {}) => {
    __ytee_pending_settings = s;
    __ytee_last_settings = s;
    if (opts.immediate) { __ytee_flushStoredSettings(true); return; }
    if (__ytee_save_timer) clearTimeout(__ytee_save_timer);
    __ytee_save_timer = setTimeout(__ytee_flushStoredSettings, SAVE_DEBOUNCE);
  };

  const registerSettingsFlush = () => {
  try {
    const __ytee_finalizeSave = () => __ytee_flushStoredSettings(true);
    window.addEventListener('beforeunload', __ytee_finalizeSave, { passive: true });
    window.addEventListener('pagehide', __ytee_finalizeSave, { passive: true });
  } catch (e) { }
  };

  const parseCache = (rawCache, enabled = true) => {
    if (!enabled || !rawCache || typeof rawCache !== 'object') return {};
    const clean = {};
    for (const k in rawCache) {
      const item = rawCache[k];
      if (item !== null && item !== undefined) {
        if (typeof item === 'object' && 'v' in item) {
          if (typeof item.title === 'string' && typeof item.channel === 'string' && typeof item.t === 'number') {
            clean[k] = item;
          } else {
            clean[k] = { v: item.v, title: item.title || "", channel: item.channel || "", t: item.t || 0 };
          }
        } else if (typeof item === 'object') {
          clean[k] = { v: item.v, title: "", channel: "", t: 0 };
        } else {
          clean[k] = { v: item, title: "", channel: "", t: 0 };
        }
      }
    }
    return clean;
  };

  const ANNOT_LABEL_MAX = 200, ANNOT_MARKS_MAX = 500;

  const parseAnnotationsCache = (raw) => {
    if (!raw || typeof raw !== 'object') return {};
    const clean = {};
    for (const k in raw) {
      const it = raw[k];
      if (!it || typeof it !== 'object') continue;
      const marks = Array.isArray(it.marks)
        ? it.marks
          .filter(m => m && typeof m === 'object' && typeof m.s === 'number' && isFinite(m.s) && m.s >= 0)
          .map(m => ({ s: Math.round(m.s), label: (typeof m.label === 'string' ? m.label : '').slice(0, ANNOT_LABEL_MAX) }))
          .sort((a, b) => a.s - b.s)
          .slice(0, ANNOT_MARKS_MAX)
        : [];
      if (marks.length === 0) continue;
      clean[k] = { marks, title: it.title || '', channel: it.channel || '', t: it.t || 0 };
    }
    return clean;
  };

  const _bool = (v, d) => typeof v === 'boolean' ? v : d;
  const _str = (v, d) => typeof v === 'string' ? v : d;
  const _num = (v, d, lo, hi) => (typeof v === 'number' && !Number.isNaN(v))
    ? (lo === undefined ? v : Math.min(hi, Math.max(lo, v))) : d;
  const _oneOf = (v, list, d) => list.includes(v) ? v : d;

  const normalizeSettings = (s) => {
    if (!s || typeof s !== 'object') return structuredClone(defaultSettings);
    const D = defaultSettings;
    const enableVolumeCache = _bool(s.enableVolumeCache, D.enableVolumeCache);
    const enablePositionCache = _bool(s.enablePositionCache, D.enablePositionCache);
    const rs = {
      buttons: Object.assign({}, D.buttons, s.buttons),
      hotkeys: Object.assign({}, D.hotkeys, s.hotkeys),
      volumeBoostLevel: _num(s.volumeBoostLevel, s.volumeBoost === true ? 1.5 : D.volumeBoostLevel),
      enableVolumeBoost: _bool(s.enableVolumeBoost, D.enableVolumeBoost),
      enableScrollVolume: _bool(s.enableScrollVolume, D.enableScrollVolume),
      enableVolumeCache,
      initialVolume: _num(s.initialVolume, D.initialVolume, 0, 100),
      volumeStep: _num(s.volumeStep, D.volumeStep, 1, 100),
      clipDuration: _num(s.clipDuration, D.clipDuration, 1, 300),
      clipDurationCtrl: _num(s.clipDurationCtrl, D.clipDurationCtrl, 1, 300),
      instantReplayDuration: _num(s.instantReplayDuration, D.instantReplayDuration, 1, 60),
      instantReplayQuality: _str(s.instantReplayQuality, D.instantReplayQuality),
      preferredQuality: _str(s.preferredQuality, D.preferredQuality),
      sleepTimer: _oneOf(s.sleepTimer, ['off', '15', '30', '45', '60', '90', '120', '180', '240', 'end', 'custom'], 'off'),
      sleepTimerCustom: _num(s.sleepTimerCustom, D.sleepTimerCustom, 1, 1440),
      sleepTimerReset: _oneOf(s.sleepTimerReset, ['off', 'activity', 'playback'],
        (typeof s.sleepTimerResetOnActivity === 'boolean' ? (s.sleepTimerResetOnActivity ? 'activity' : 'off') : D.sleepTimerReset)),
      sleepTimerFadeOut: _bool(s.sleepTimerFadeOut, D.sleepTimerFadeOut),
      compactMode: _bool(s.compactMode, typeof s.labelMode === 'boolean' ? !s.labelMode : D.compactMode),
      isCollapsed: _bool(s.isCollapsed, D.isCollapsed),
      highContrastUI: _bool(s.highContrastUI, D.highContrastUI),
      enableBlur: _bool(s.enableBlur, D.enableBlur),
      volumeCache: parseCache(s.volumeCache, enableVolumeCache),
      miniStatsCache: parseCache(s.miniStatsCache),
      miniStatsPos: s.miniStatsPos || D.miniStatsPos,
      alwaysShowMiniStats: _bool(s.alwaysShowMiniStats, D.alwaysShowMiniStats),
      enablePositionCache,
      enableGistSync: _bool(s.enableGistSync, D.enableGistSync),
      historyViewMode: _oneOf(s.historyViewMode, ['list', 'grid'], 'list'),
      gistToken: _str(s.gistToken, ''),
      gistId: typeof s.gistId === 'string' ? s.gistId.trim() : '',
      gistSyncLastTime: _num(s.gistSyncLastTime, 0),
      gistSyncInterval: _oneOf(s.gistSyncInterval, [30, 60, 120, 180, 360], 180),
      positionCache: parseCache(s.positionCache, enablePositionCache),
      favoritesCache: parseCache(s.favoritesCache),
      annotationsCache: parseAnnotationsCache(s.annotationsCache),
    };
    for (const [cacheKey, limit] of [['volumeCache', 200], ['miniStatsCache', 200], ['positionCache', 200], ['favoritesCache', 200], ['annotationsCache', 500]]) {
      const keys = Object.keys(rs[cacheKey]).filter(k => cacheKey !== 'favoritesCache' || rs[cacheKey][k]?.v);
      if (keys.length > limit) {
        keys.sort((a, b) => (rs[cacheKey][a]?.t || 0) - (rs[cacheKey][b]?.t || 0))
          .slice(0, keys.length - limit)
          .forEach(k => delete rs[cacheKey][k]);
      }
    }
    return rs;
  };

  // Mediabunny — used to remux clips to MP4. It's big, so we only load it the first
  // time someone actually uses Clip or Instant Replay.
  // ==[Mediabunny start:]==
  /*!
   * Mediabunny 1.56.2 — MPL-2.0 — https://github.com/Vanilagy/mediabunny
   * Trimmed build, generated by tools/mediabunny/build.mjs. Don't edit by hand.
   *
   * This Source Code Form is subject to the terms of the Mozilla Public
   * License, v. 2.0. If a copy of the MPL was not distributed with this
   * file, You can obtain one at https://mozilla.org/MPL/2.0/.
   */
  let Mediabunny = null, __ytee_mediabunnyFailed = false;
  const __ytee_loadMediabunny = () => {
    if (Mediabunny) return Mediabunny;
    if (__ytee_mediabunnyFailed) return null;
    try {
      Mediabunny = (()=>{var Yn=Object.defineProperty;var xc=Object.getOwnPropertyDescriptor;var _c=Object.getOwnPropertyNames;var Cc=Object.prototype.hasOwnProperty;var Ec=(t,e)=>{for(var r in e)Yn(t,r,{get:e[r],enumerable:!0});},vc=(t,e,r,i)=>{if(e&&typeof e=="object"||typeof e=="function")for(let n of _c(e))!Cc.call(t,n)&&n!==r&&Yn(t,n,{get:()=>e[n],enumerable:!(i=xc(e,n))||i.enumerable});return t};var Pc=t=>vc(Yn({},"__esModule",{value:!0}),t);var $u={};Ec($u,{BlobSource:()=>mi,BufferTarget:()=>Vt,Conversion:()=>Mi,Input:()=>dr,MatroskaInputFormat:()=>Or,Mp4InputFormat:()=>gi,Mp4OutputFormat:()=>Zt,Output:()=>Yt,QuickTimeInputFormat:()=>wi,WebMInputFormat:()=>yi});function g(t){if(!t)throw new Error("Assertion failed.")}var kt=t=>{let e=(t%360+360)%360;if(e===0||e===90||e===180||e===270)return e;throw new Error(`Invalid rotation ${t}.`)},ge=t=>t&&t[t.length-1],lt=t=>t>=0&&t<2**32,mo=t=>t>=-(2**31)&&t<2**31,D=t=>{let e=0;for(;t.readBits(1)===0&&e<32;)e++;if(e>=32)throw new Error("Invalid exponential-Golomb code.");return (1<<e)-1+t.readBits(e)},Jt=(t,e)=>{let r=e+1,i=Math.floor(Math.log2(r));t.writeBits(i,0),t.writeBits(1,1),t.writeBits(i,r-2**i);},ut=t=>{let e=D(t);return (e&1)===0?-(e>>1):e+1>>1};var _e=t=>t.constructor===Uint8Array?t:ArrayBuffer.isView(t)?new Uint8Array(t.buffer,t.byteOffset,t.byteLength):new Uint8Array(t),oe=t=>t.constructor===DataView?t:ArrayBuffer.isView(t)?new DataView(t.buffer,t.byteOffset,t.byteLength):new DataView(t),Ke=new TextDecoder,He=new TextEncoder;var rs=t=>Object.fromEntries(Object.entries(t).map(([e,r])=>[r,e])),St={bt709:1,bt470bg:5,smpte170m:6,bt2020:9,smpte432:12},dt=rs(St),xt={bt709:1,smpte170m:6,linear:8,"iec61966-2-1":13,pq:16,hlg:18},ft=rs(xt),_t={rgb:0,bt709:1,bt470bg:5,smpte170m:6,"bt2020-ncl":9},ht=rs(_t),wr=t=>!!t&&!!t.primaries&&!!t.transfer&&!!t.matrix&&t.fullRange!==void 0,po=t=>!t||t.primaries==null&&t.transfer==null&&t.matrix==null&&t.fullRange==null,Oi={primaries:void 0,transfer:void 0,matrix:void 0,fullRange:void 0},yr=t=>t instanceof ArrayBuffer||typeof SharedArrayBuffer<"u"&&t instanceof SharedArrayBuffer||ArrayBuffer.isView(t),gr=class{constructor(){this.currentPromise=Promise.resolve(),this.pending=0;}async acquire(){let e,r=new Promise(n=>{let s=!1;e=()=>{s||(n(),this.pending--,s=!0);};}),i=this.currentPromise;return this.currentPromise=r,this.pending++,await i,e}},go=/^[0-9a-fA-F]+$/,Wt=t=>[...t].map(e=>e.toString(16).padStart(2,"0")).join(""),wo=t=>{g(t.length%2===0);let e=new Uint8Array(t.length/2);for(let r=0;r<t.length;r+=2)e[r/2]=parseInt(t.slice(r,r+2),16);return e},is=t=>(t=t>>1&1431655765|(t&1431655765)<<1,t=t>>2&858993459|(t&858993459)<<2,t=t>>4&252645135|(t&252645135)<<4,t=t>>8&16711935|(t&16711935)<<8,t=t>>16&65535|(t&65535)<<16,t>>>0),ns=(t,e,r)=>{let i=0,n=t.length-1,s=-1;for(;i<=n;){let o=i+n>>1,a=r(t[o]);a===e?(s=o,n=o-1):a<e?i=o+1:n=o-1;}return s},de=(t,e,r)=>{let i=0,n=t.length-1,s=-1;for(;i<=n;){let o=i+(n-i+1)/2|0;r(t[o])<=e?(s=o,i=o+1):n=o-1;}return s},ss=(t,e,r)=>{let i=de(t,r(e),r);t.splice(i+1,0,e);},we=()=>{let t,e;return {promise:new Promise((i,n)=>{t=i,e=n;}),resolve:t,reject:e}},Gr=(t,e)=>{let r=t.indexOf(e);r!==-1&&t.splice(r,1);};var zi=(t,e)=>{for(let r=t.length-1;r>=0;r--)if(e(t[r]))return r;return -1},yo=async function*(t){Symbol.iterator in t?yield*t[Symbol.iterator]():yield*t[Symbol.asyncIterator]();},bo=t=>{if(!(Symbol.iterator in t)&&!(Symbol.asyncIterator in t))throw new TypeError("Argument must be an iterable or async iterable.")},ve=t=>{throw new Error(`Unexpected value: ${t}`)},er=(t,e,r)=>{let i=t.getUint8(e),n=t.getUint8(e+1),s=t.getUint8(e+2);return r?i|n<<8|s<<16:i<<16|n<<8|s},To=(t,e,r)=>er(t,e,r)<<8>>8,$r=(t,e,r,i)=>{r=r>>>0,r=r&16777215,i?(t.setUint8(e,r&255),t.setUint8(e+1,r>>>8&255),t.setUint8(e+2,r>>>16&255)):(t.setUint8(e,r>>>16&255),t.setUint8(e+1,r>>>8&255),t.setUint8(e+2,r&255));},Ao=(t,e,r,i)=>{r=fe(r,-8388608,8388607),r<0&&(r=r+16777216&16777215),$r(t,e,r,i);};var fe=(t,e,r)=>Math.max(e,Math.min(r,t)),ko=(t,e,r)=>t+(e-t)*r;var qt="und",Ui=t=>{let e=Math.round(t);return Math.abs(t/e-1)<10*Number.EPSILON?e:t},Xr=(t,e)=>Math.round(t/e)*e,Zr=(t,e)=>Math.round(t*e)/e;var os=(t,e)=>Math.floor(t*e)/e;var Vi=t=>{let e=0;for(;t!==0;)t&=t-1,e++;return e},Ic=/^[a-z]{3}$/,Ct=t=>Ic.test(t),mt=1e6*(1+Number.EPSILON);var So=(t,e)=>{let r=t<0?-1:1;t=Math.abs(t);let i=0,n=1,s=1,o=0,a=t;for(;;){let c=Math.floor(a),u=c*s+i,l=c*o+n;if(l>e)return {num:r*s,den:o};if(i=s,n=o,s=u,o=l,a=1/(a-c),!isFinite(a))break}return {num:r*s,den:o}},Nt=class{constructor(){this.currentPromise=Promise.resolve();}call(e){return this.currentPromise=this.currentPromise.then(e)}},Jn=null,Et=()=>Jn!==null?Jn:Jn=!!(typeof navigator<"u"&&(navigator.vendor?.match(/apple/i)||/AppleWebKit/.test(navigator.userAgent)&&!/Chrome/.test(navigator.userAgent)||/\b(iPad|iPhone|iPod)\b/.test(navigator.userAgent))),es=null,Yr=()=>es!==null?es:es=typeof navigator<"u"&&navigator.userAgent?.includes("Firefox"),ts=null,Jr=()=>ts!==null?ts:ts=!!(typeof navigator<"u"&&(navigator.vendor?.includes("Google Inc")||/Chrome/.test(navigator.userAgent)));var br=t=>typeof globalThis.isSecureContext<"u"&&!globalThis.isSecureContext?`${t} is not available in this environment; this may be because this page is running in an insecure context. Try serving your page over HTTPS or use localhost.`:`${t} is not available in this environment.`,Rc=(async()=>{})().constructor,U=t=>t instanceof Rc||t instanceof Promise?!0:typeof t?.then=="function";var Ni=(t,e,r,i)=>t<=i&&r<=e,Wi=function*(t){for(let e in t){let r=t[e];r!==void 0&&(yield {key:e,value:r});}};var xo=(t,e)=>{if(t.length!==e.length)return !1;for(let r=0;r<t.length;r++)if(t[r]!==e[r])return !1;return !0},Tr=()=>{Symbol.dispose??(Symbol.dispose=Symbol("Symbol.dispose"));},et=t=>typeof t=="number"&&!Number.isNaN(t);var _o=(t,e)=>{let r=0;for(let i=0;i<t.length;i++)e(t[i])&&r++;return r},qi=(t,e)=>{let r=-1,i=1/0;for(let n=0;n<t.length;n++){let s=e(t[n]);s<i&&(i=s,r=n);}return r};var Lt=t=>{g(Number.isInteger(t.num)),g(Number.isInteger(t.den)),g(t.den!==0);let e=Math.abs(t.num),r=Math.abs(t.den);for(;r!==0;){let n=e%r;e=r,r=n;}let i=e||1;return {num:t.num/i,den:t.den/i}},Li=(t,e)=>{if(typeof t!="object"||!t)throw new TypeError(`${e} must be an object.`);if(!Number.isInteger(t.left)||t.left<0)throw new TypeError(`${e}.left must be a non-negative integer.`);if(!Number.isInteger(t.top)||t.top<0)throw new TypeError(`${e}.top must be a non-negative integer.`);if(!Number.isInteger(t.width)||t.width<0)throw new TypeError(`${e}.width must be a non-negative integer.`);if(!Number.isInteger(t.height)||t.height<0)throw new TypeError(`${e}.height must be a non-negative integer.`)};var as=t=>new Promise(e=>setTimeout(e,t));var Hi=t=>Array.isArray(t)?t:[t],Qe=class{constructor(){this._listeners=new Map;}on(e,r,i){this._listeners.has(e)||this._listeners.set(e,new Set);let n={fn:r,once:i?.once??!1};return this._listeners.get(e).add(n),()=>{this._listeners.get(e)?.delete(n);}}_emit(...e){let[r,i]=e,n=this._listeners.get(r);if(n)for(let s of n){try{s.fn(i);}catch(o){console.error(o);}s.once&&n.delete(s);}}},tr=t=>Math.ceil(t/2)*2;var Co=t=>t!==null&&typeof t=="object"&&Object.getPrototypeOf(t)===Object.prototype&&Object.values(t).every(e=>typeof e=="string");var pt;(function(t){t[t.Silent=0]="Silent",t[t.Errors=1]="Errors",t[t.Warnings=2]="Warnings",t[t.Info=3]="Info";})(pt||(pt={}));var $=class t{constructor(){}static get level(){return t._level}static set level(e){if(e!==pt.Silent&&e!==pt.Errors&&e!==pt.Warnings&&e!==pt.Info)throw new TypeError("Invalid log level. Use one of the values of the LogLevel enum.");t._level=e;}static get _emitter(){return t._emitterInstance??(t._emitterInstance=new Qe)}static on(e,r,i){return t._emitter.on(e,r,i)}static _error(...e){t._emitter._emit("error",e),t._level>=pt.Errors&&console.error(...e);}static _warn(...e){t._emitter._emit("warn",e),t._level>=pt.Warnings&&console.warn(...e);}static _info(...e){t._emitter._emit("info",e),t._level>=pt.Info&&console.info(...e);}};$._level=pt.Info;$._emitterInstance=null;var tt=class{constructor(e,r){if(this.data=e,this.mimeType=r,!(e instanceof Uint8Array))throw new TypeError("data must be a Uint8Array.");if(typeof r!="string")throw new TypeError("mimeType must be a string.")}},ei=class{constructor(e,r,i,n){if(this.data=e,this.mimeType=r,this.name=i,this.description=n,!(e instanceof Uint8Array))throw new TypeError("data must be a Uint8Array.");if(r!==void 0&&typeof r!="string")throw new TypeError("mimeType, when provided, must be a string.");if(i!==void 0&&typeof i!="string")throw new TypeError("name, when provided, must be a string.");if(n!==void 0&&typeof n!="string")throw new TypeError("description, when provided, must be a string.")}},ti=t=>{if(!t||typeof t!="object")throw new TypeError("tags must be an object.");if(t.title!==void 0&&typeof t.title!="string")throw new TypeError("tags.title, when provided, must be a string.");if(t.description!==void 0&&typeof t.description!="string")throw new TypeError("tags.description, when provided, must be a string.");if(t.artist!==void 0&&typeof t.artist!="string")throw new TypeError("tags.artist, when provided, must be a string.");if(t.album!==void 0&&typeof t.album!="string")throw new TypeError("tags.album, when provided, must be a string.");if(t.albumArtist!==void 0&&typeof t.albumArtist!="string")throw new TypeError("tags.albumArtist, when provided, must be a string.");if(t.trackNumber!==void 0&&(!Number.isInteger(t.trackNumber)||t.trackNumber<=0))throw new TypeError("tags.trackNumber, when provided, must be a positive integer.");if(t.tracksTotal!==void 0&&(!Number.isInteger(t.tracksTotal)||t.tracksTotal<=0))throw new TypeError("tags.tracksTotal, when provided, must be a positive integer.");if(t.discNumber!==void 0&&(!Number.isInteger(t.discNumber)||t.discNumber<=0))throw new TypeError("tags.discNumber, when provided, must be a positive integer.");if(t.discsTotal!==void 0&&(!Number.isInteger(t.discsTotal)||t.discsTotal<=0))throw new TypeError("tags.discsTotal, when provided, must be a positive integer.");if(t.genre!==void 0&&typeof t.genre!="string")throw new TypeError("tags.genre, when provided, must be a string.");if(t.date!==void 0&&(!(t.date instanceof Date)||Number.isNaN(t.date.getTime())))throw new TypeError("tags.date, when provided, must be a valid Date.");if(t.lyrics!==void 0&&typeof t.lyrics!="string")throw new TypeError("tags.lyrics, when provided, must be a string.");if(t.images!==void 0){if(!Array.isArray(t.images))throw new TypeError("tags.images, when provided, must be an array.");for(let e of t.images){if(!e||typeof e!="object")throw new TypeError("Each image in tags.images must be an object.");if(!(e.data instanceof Uint8Array))throw new TypeError("Each image.data must be a Uint8Array.");if(typeof e.mimeType!="string")throw new TypeError("Each image.mimeType must be a string.");if(!["coverFront","coverBack","unknown"].includes(e.kind))throw new TypeError("Each image.kind must be 'coverFront', 'coverBack', or 'unknown'.")}}if(t.comment!==void 0&&typeof t.comment!="string")throw new TypeError("tags.comment, when provided, must be a string.");if(t.raw!==void 0){if(!t.raw||typeof t.raw!="object")throw new TypeError("tags.raw, when provided, must be an object.");for(let e of Object.values(t.raw))if(e!==null&&typeof e!="string"&&!(Array.isArray(e)&&e.every(r=>typeof r=="string"))&&!(e instanceof Uint8Array)&&!(e instanceof tt)&&!(e instanceof ei)&&!Co(e))throw new TypeError("Each value in tags.raw must be a string, string array, Uint8Array, RichImageData, AttachedFile, Record<string, string>, or null.")}};var ji={default:!0,primary:!0,forced:!1,original:!1,commentary:!1,hearingImpaired:!1,visuallyImpaired:!1},Eo=t=>{if(!t||typeof t!="object")throw new TypeError("disposition must be an object.");if(t.default!==void 0&&typeof t.default!="boolean")throw new TypeError("disposition.default must be a boolean.");if(t.primary!==void 0&&typeof t.primary!="boolean")throw new TypeError("disposition.primary must be a boolean.");if(t.forced!==void 0&&typeof t.forced!="boolean")throw new TypeError("disposition.forced must be a boolean.");if(t.original!==void 0&&typeof t.original!="boolean")throw new TypeError("disposition.original must be a boolean.");if(t.commentary!==void 0&&typeof t.commentary!="boolean")throw new TypeError("disposition.commentary must be a boolean.");if(t.hearingImpaired!==void 0&&typeof t.hearingImpaired!="boolean")throw new TypeError("disposition.hearingImpaired must be a boolean.");if(t.visuallyImpaired!==void 0&&typeof t.visuallyImpaired!="boolean")throw new TypeError("disposition.visuallyImpaired must be a boolean.")};var ue=class t{constructor(e){this.bytes=e,this.pos=0;}seekToByte(e){this.pos=8*e;}readBit(){let e=Math.floor(this.pos/8),r=this.bytes[e]??0,i=7-(this.pos&7),n=(r&1<<i)>>i;return this.pos++,n}readBits(e){if(e===1)return this.readBit();let r=0;for(let i=0;i<e;i++)r<<=1,r|=this.readBit();return r}writeBits(e,r){let i=this.pos+e;for(let n=this.pos;n<i;n++){let s=Math.floor(n/8),o=this.bytes[s],a=7-(n&7);o&=~(1<<a),o|=(r&1<<i-n-1)>>i-n-1<<a,this.bytes[s]=o;}this.pos=i;}copyBits(e,r){let i=0;for(i;i<e-7;i+=8)this.writeBits(8,r.readBits(8));let n=e-i;n>0&&this.writeBits(n,r.readBits(n));}readAlignedByte(){if(this.pos%8!==0)throw new Error("Bitstream is not byte-aligned.");let e=this.pos/8,r=this.bytes[e]??0;return this.pos+=8,r}skipBits(e){this.pos+=e;}getBitsLeft(){return this.bytes.length*8-this.pos}clone(){let e=new t(this.bytes);return e.pos=this.pos,e}};var ri=[96e3,88200,64e3,48e3,44100,32e3,24e3,22050,16e3,12e3,11025,8e3,7350],Qi=[-1,1,2,3,4,5,6,8],Ar=t=>{if(!t||t.byteLength<2)throw new TypeError("AAC description must be at least 2 bytes long.");let e=new ue(t),r=cs(e),{frequencyIndex:i,sampleRate:n}=ls(e),s=e.readBits(4),o=null;s>=1&&s<=7&&(o=Qi[s]);let a=r,c=!1,u=n;if(r===5||r===29)c=r===29,u=ls(e).sampleRate,a=cs(e),a===22&&e.skipBits(4);else for(;e.getBitsLeft()>15;){let l=e.pos;if(e.readBits(11)!==695){e.pos=l+1;continue}cs(e)===5&&e.readBits(1)&&(u=ls(e).sampleRate,e.getBitsLeft()>11&&e.readBits(11)===1352&&(c=!!e.readBits(1)));break}return o!==null&&o>1&&(c=!1),{objectType:r,coreObjectType:a,frequencyIndex:i,channelConfiguration:s,outputSampleRate:u,outputNumberOfChannels:c&&o===1?2:o}},cs=t=>{let e=t.readBits(5);return e===31?32+t.readBits(6):e},ls=t=>{let e=t.readBits(4);return e===15?{frequencyIndex:e,sampleRate:t.readBits(24)}:{frequencyIndex:e,sampleRate:e<ri.length?ri[e]:null}},Ki=t=>{let e=t.objectType===5||t.objectType===29,r=t.objectType===29,i=e?t.outputSampleRate/2:t.outputSampleRate,n=r?1:t.outputNumberOfChannels,s=Qi.indexOf(n);if(s===-1)throw new TypeError(`Unsupported number of channels: ${t.outputNumberOfChannels}`);let o=16;t.objectType>=32&&(o+=6),us(i)===15&&(o+=24),e&&(o+=9,us(t.outputSampleRate)===15&&(o+=24));let a=Math.ceil(o/8),c=new Uint8Array(a),u=new ue(c);return vo(u,t.objectType),Po(u,i),u.writeBits(4,s),e&&(Po(u,t.outputSampleRate),vo(u,2)),u.writeBits(3,0),c},vo=(t,e)=>{e<32?t.writeBits(5,e):(t.writeBits(5,31),t.writeBits(6,e-32));},Po=(t,e)=>{let r=us(e);t.writeBits(4,r),r===15&&t.writeBits(24,e);},us=t=>{let e=ri.indexOf(t);return e===-1?15:e};var ii=[48e3,44100,32e3],ds=[24e3,22050,16e3];var Ge;(function(t){t[t.NON_IDR_SLICE=1]="NON_IDR_SLICE",t[t.SLICE_DPA=2]="SLICE_DPA",t[t.SLICE_DPB=3]="SLICE_DPB",t[t.SLICE_DPC=4]="SLICE_DPC",t[t.IDR=5]="IDR",t[t.SEI=6]="SEI",t[t.SPS=7]="SPS",t[t.PPS=8]="PPS",t[t.AUD=9]="AUD",t[t.SPS_EXT=13]="SPS_EXT";})(Ge||(Ge={}));var Ie;(function(t){t[t.RASL_N=8]="RASL_N",t[t.RASL_R=9]="RASL_R",t[t.BLA_W_LP=16]="BLA_W_LP",t[t.RSV_IRAP_VCL23=23]="RSV_IRAP_VCL23",t[t.VPS_NUT=32]="VPS_NUT",t[t.SPS_NUT=33]="SPS_NUT",t[t.PPS_NUT=34]="PPS_NUT",t[t.AUD_NUT=35]="AUD_NUT",t[t.PREFIX_SEI_NUT=39]="PREFIX_SEI_NUT",t[t.SUFFIX_SEI_NUT=40]="SUFFIX_SEI_NUT";})(Ie||(Ie={}));var Sr=function*(t){let e=0,r=-1;for(;e<t.length-2;){let i=t.indexOf(0,e);if(i===-1||i>=t.length-2)break;e=i;let n=0;if(e+3<t.length&&t[e+1]===0&&t[e+2]===0&&t[e+3]===1?n=4:t[e+1]===0&&t[e+2]===1&&(n=3),n===0){e++;continue}r!==-1&&e>r&&(yield {offset:r,length:e-r}),r=e+n,e=r;}r!==-1&&r<t.length&&(yield {offset:r,length:t.length-r});},Bo=function*(t,e){let r=0,i=new DataView(t.buffer,t.byteOffset,t.byteLength);for(;r+e<=t.length;){let n;e===1?n=i.getUint8(r):e===2?n=i.getUint16(r,!1):e===3?n=er(i,r,!1):(g(e===4),n=i.getUint32(r,!1)),r+=e,yield {offset:r,length:n},r+=n;}},hs=(t,e)=>{if(e.description){let n=(_e(e.description)[4]&3)+1;return Bo(t,n)}else return Sr(t)},oi=t=>t&31,Xi=t=>{let e=[],r=t.length;for(let i=0;i<r;i++)i+2<r&&t[i]===0&&t[i+1]===0&&t[i+2]===3?(e.push(0,0),i+=2):e.push(t[i]);return new Uint8Array(e)},Bc=t=>{let e=[],r=0;for(let i of t)r===2&&i<=3&&(e.push(3),r=0),e.push(i),r=i===0?r+1:0;return new Uint8Array(e)},fs=new Uint8Array([0,0,0,1]),Mo=t=>{let e=t.reduce((n,s)=>n+fs.byteLength+s.byteLength,0),r=new Uint8Array(e),i=0;for(let n of t)r.set(fs,i),i+=fs.byteLength,r.set(n,i),i+=n.byteLength;return r},Zi=(t,e)=>{let r=t.reduce((s,o)=>s+e+o.byteLength,0),i=new Uint8Array(r),n=0;for(let s of t){let o=new DataView(i.buffer,i.byteOffset,i.byteLength);switch(e){case 1:o.setUint8(n,s.byteLength);break;case 2:o.setUint16(n,s.byteLength,!1);break;case 3:$r(o,n,s.byteLength,!1);break;case 4:o.setUint32(n,s.byteLength,!1);break}n+=e,i.set(s,n),n+=s.byteLength;}return i},Do=(t,e)=>{if(e.description){let n=(_e(e.description)[4]&3)+1;return Zi(t,n)}else return Mo(t)},xr=t=>{try{let e=[],r=[],i=[];for(let a of Sr(t)){let c=t.subarray(a.offset,a.offset+a.length),u=oi(c[0]);u===Ge.SPS?e.push(c):u===Ge.PPS?r.push(c):u===Ge.SPS_EXT&&i.push(c);}if(e.length===0||r.length===0)return null;let n=e[0],s=_r(n);g(s!==null);let o=s.profileIdc===100||s.profileIdc===110||s.profileIdc===122||s.profileIdc===144;return {configurationVersion:1,avcProfileIndication:s.profileIdc,profileCompatibility:s.constraintFlags,avcLevelIndication:s.levelIdc,lengthSizeMinusOne:3,sequenceParameterSets:e,pictureParameterSets:r,chromaFormat:o?s.chromaFormatIdc:null,bitDepthLumaMinus8:o?s.bitDepthLumaMinus8:null,bitDepthChromaMinus8:o?s.bitDepthChromaMinus8:null,sequenceParameterSetExt:o?i:null}}catch(e){return $._error("Error building AVC Decoder Configuration Record:",e),null}},Yi=t=>{let e=[];e.push(t.configurationVersion),e.push(t.avcProfileIndication),e.push(t.profileCompatibility),e.push(t.avcLevelIndication),e.push(252|t.lengthSizeMinusOne&3),e.push(224|t.sequenceParameterSets.length&31);for(let r of t.sequenceParameterSets){let i=r.byteLength;e.push(i>>8),e.push(i&255);for(let n=0;n<i;n++)e.push(r[n]);}e.push(t.pictureParameterSets.length);for(let r of t.pictureParameterSets){let i=r.byteLength;e.push(i>>8),e.push(i&255);for(let n=0;n<i;n++)e.push(r[n]);}if((t.avcProfileIndication===100||t.avcProfileIndication===110||t.avcProfileIndication===122||t.avcProfileIndication===144)&&t.chromaFormat!==null){g(t.bitDepthLumaMinus8!==null),g(t.bitDepthChromaMinus8!==null),g(t.sequenceParameterSetExt!==null),e.push(252|t.chromaFormat&3),e.push(248|t.bitDepthLumaMinus8&7),e.push(248|t.bitDepthChromaMinus8&7),e.push(t.sequenceParameterSetExt.length);for(let r of t.sequenceParameterSetExt){let i=r.byteLength;e.push(i>>8),e.push(i&255);for(let n=0;n<i;n++)e.push(r[n]);}}return new Uint8Array(e)},Ji=t=>{try{let e=oe(t),r=0,i=e.getUint8(r++),n=e.getUint8(r++),s=e.getUint8(r++),o=e.getUint8(r++),a=e.getUint8(r++)&3,c=e.getUint8(r++)&31,u=[];for(let m=0;m<c;m++){let p=e.getUint16(r,!1);r+=2,u.push(t.subarray(r,r+p)),r+=p;}let l=e.getUint8(r++),d=[];for(let m=0;m<l;m++){let p=e.getUint16(r,!1);r+=2,d.push(t.subarray(r,r+p)),r+=p;}let f={configurationVersion:i,avcProfileIndication:n,profileCompatibility:s,avcLevelIndication:o,lengthSizeMinusOne:a,sequenceParameterSets:u,pictureParameterSets:d,chromaFormat:null,bitDepthLumaMinus8:null,bitDepthChromaMinus8:null,sequenceParameterSetExt:null};if((n===100||n===110||n===122||n===144)&&r+4<=t.length){let m=e.getUint8(r++)&3,p=e.getUint8(r++)&7,b=e.getUint8(r++)&7,y=e.getUint8(r++);f.chromaFormat=m,f.bitDepthLumaMinus8=p,f.bitDepthChromaMinus8=b;let w=[];for(let T=0;T<y;T++){let A=e.getUint16(r,!1);r+=2,w.push(t.subarray(r,r+A)),r+=A;}f.sequenceParameterSetExt=w;}return f}catch(e){return $._error("Error deserializing AVC Decoder Configuration Record:",e),null}},Oo={1:{num:1,den:1},2:{num:12,den:11},3:{num:10,den:11},4:{num:16,den:11},5:{num:40,den:33},6:{num:24,den:11},7:{num:20,den:11},8:{num:32,den:11},9:{num:80,den:33},10:{num:18,den:11},11:{num:15,den:11},12:{num:64,den:33},13:{num:160,den:99},14:{num:4,den:3},15:{num:3,den:2},16:{num:2,den:1}},_r=t=>{try{let e=Xi(t),r=new ue(e);if(r.skipBits(1),r.skipBits(2),r.readBits(5)!==7)return null;let n=r.readAlignedByte(),s=r.readAlignedByte(),o=r.readAlignedByte();D(r);let a=1,c=0,u=0,l=0;if((n===100||n===110||n===122||n===244||n===44||n===83||n===86||n===118||n===128)&&(a=D(r),a===3&&(l=r.readBits(1)),c=D(r),u=D(r),r.skipBits(1),r.readBits(1))){for(let ie=0;ie<(a!==3?8:12);ie++)if(r.readBits(1)){let le=ie<6?16:64,ne=8,se=8;for(let xe=0;xe<le;xe++){if(se!==0){let Te=ut(r);se=(ne+Te+256)%256;}ne=se===0?ne:se;}}}D(r);let d=D(r);if(d===0)D(r);else if(d===1){r.skipBits(1),ut(r),ut(r);let G=D(r);for(let ie=0;ie<G;ie++)ut(r);}D(r),r.skipBits(1);let f=D(r),m=D(r),p=16*(f+1),b=16*(m+1),y=p,w=b,T=r.readBits(1);if(T||r.skipBits(1),r.skipBits(1),r.readBits(1)){let G=D(r),ie=D(r),te=D(r),le=D(r),ne,se;if((l===0?a:0)===0)ne=1,se=2-T;else {let Te=a===3?1:2,h=a===1?2:1;ne=Te,se=h*(2-T);}y-=ne*(G+ie),w-=se*(te+le);}let E=2,P=2,I=2,v=0,k={num:1,den:1},C=null,M=null,q=null,N=null,L=r.pos;if(r.readBits(1)){if(r.readBits(1)){let Te=r.readBits(8);if(Te===255)k={num:r.readBits(16),den:r.readBits(16)};else {let h=Oo[Te];h&&(k=h);}}r.readBits(1)&&r.skipBits(1),r.readBits(1)&&(r.skipBits(3),v=r.readBits(1),r.readBits(1)&&(E=r.readBits(8),P=r.readBits(8),I=r.readBits(8))),r.readBits(1)&&(D(r),D(r)),r.readBits(1)&&(r.skipBits(32),r.skipBits(32),r.skipBits(1));let se=r.readBits(1);se&&Io(r);let xe=r.readBits(1);xe&&Io(r),(se||xe)&&r.skipBits(1),r.skipBits(1),q=r.pos,N=r.readBits(1),N&&(r.skipBits(1),D(r),D(r),D(r),D(r),C=D(r),M=D(r));}if(C===null){g(M===null);let G=s&16;if((n===44||n===86||n===100||n===110||n===122||n===244)&&G)C=0,M=0;else {let ie=f+1,te=m+1,le=(2-T)*te,ne=si.find(xe=>xe.level>=o)??ge(si),se=Math.min(Math.floor(ne.maxDpbMbs/(ie*le)),16);C=se,M=se;}}return g(M!==null),{emulationUnpreventedBytes:e,profileIdc:n,constraintFlags:s,levelIdc:o,frameMbsOnlyFlag:T,chromaFormatIdc:a,bitDepthLumaMinus8:c,bitDepthChromaMinus8:u,codedWidth:p,codedHeight:b,displayWidth:y,displayHeight:w,pixelAspectRatio:k,colourPrimaries:E,matrixCoefficients:I,transferCharacteristics:P,fullRangeFlag:v,numReorderFrames:C,maxDecFrameBuffering:M,vuiParametersFlagBitOffset:L,bitstreamRestrictionFlagBitOffset:q,bitstreamRestrictionFlag:N}}catch(e){return $._error("Error parsing AVC SPS:",e),null}},Io=t=>{let e=D(t);t.skipBits(4),t.skipBits(4);for(let r=0;r<=e;r++)D(t),D(t),t.skipBits(1);t.skipBits(5),t.skipBits(5),t.skipBits(5),t.skipBits(5);},ms=t=>{g(t.bitstreamRestrictionFlag!==1);let e=new Uint8Array(t.emulationUnpreventedBytes.byteLength+64),r=new ue(t.emulationUnpreventedBytes),i=new ue(e);t.bitstreamRestrictionFlag===null?(i.copyBits(t.vuiParametersFlagBitOffset,r),i.writeBits(1,1),i.writeBits(1,0),i.writeBits(1,0),i.writeBits(1,0),i.writeBits(1,0),i.writeBits(1,0),i.writeBits(1,0),i.writeBits(1,0),i.writeBits(1,0)):(g(t.bitstreamRestrictionFlagBitOffset!==null),i.copyBits(t.bitstreamRestrictionFlagBitOffset,r)),i.writeBits(1,1),i.writeBits(1,1),Jt(i,2),Jt(i,1),Jt(i,16),Jt(i,16),Jt(i,t.numReorderFrames),Jt(i,t.maxDecFrameBuffering),i.writeBits(1,1),i.writeBits((8-i.pos%8)%8,0);let n=i.pos/8;return g(Number.isInteger(n)),Bc(e.subarray(0,n))},Mc=(t,e)=>{if(e.description){let n=(_e(e.description)[21]&3)+1;return Zi(t,n)}else return Mo(t)},ni=(t,e)=>{if(e.description){let n=(_e(e.description)[21]&3)+1;return Bo(t,n)}else return Sr(t)},kr=t=>t>>1&63,ps=t=>{try{let e=new ue(Xi(t));e.skipBits(16),e.readBits(4);let r=e.readBits(3),i=e.readBits(1),{general_profile_space:n,general_tier_flag:s,general_profile_idc:o,general_profile_compatibility_flags:a,general_constraint_indicator_flags:c,general_level_idc:u}=Dc(e,r);D(e);let l=D(e),d=0;l===3&&(d=e.readBits(1));let f=D(e),m=D(e),p=f,b=m;if(e.readBits(1)){let N=D(e),L=D(e),ae=D(e),G=D(e),ie=1,te=1,le=d===0?l:0;le===1?(ie=2,te=2):le===2&&(ie=2,te=1),p-=(N+L)*ie,b-=(ae+G)*te;}let y=D(e),w=D(e);D(e);let A=e.readBits(1)?0:r,E=0;for(let N=A;N<=r;N++)D(e),E=D(e),D(e);D(e),D(e),D(e),D(e),D(e),D(e),e.readBits(1)&&e.readBits(1)&&Oc(e),e.skipBits(1),e.skipBits(1),e.readBits(1)&&(e.skipBits(4),e.skipBits(4),D(e),D(e),e.skipBits(1));let P=D(e);if(zc(e,P),e.readBits(1)){let N=D(e);for(let L=0;L<N;L++)D(e),e.skipBits(1);}e.skipBits(1),e.skipBits(1);let I=2,v=2,k=2,C=0,M=0,q={num:1,den:1};if(e.readBits(1)){let N=Vc(e,r);q=N.pixelAspectRatio,I=N.colourPrimaries,v=N.transferCharacteristics,k=N.matrixCoefficients,C=N.fullRangeFlag,M=N.minSpatialSegmentationIdc;}return {displayWidth:p,displayHeight:b,pixelAspectRatio:q,colourPrimaries:I,transferCharacteristics:v,matrixCoefficients:k,fullRangeFlag:C,maxDecFrameBuffering:E+1,spsMaxSubLayersMinus1:r,spsTemporalIdNestingFlag:i,generalProfileSpace:n,generalTierFlag:s,generalProfileIdc:o,generalProfileCompatibilityFlags:a,generalConstraintIndicatorFlags:c,generalLevelIdc:u,chromaFormatIdc:l,bitDepthLumaMinus8:y,bitDepthChromaMinus8:w,minSpatialSegmentationIdc:M}}catch(e){return $._error("Error parsing HEVC SPS:",e),null}},Cr=t=>{try{let e=[],r=[],i=[],n=[];for(let u of Sr(t)){let l=t.subarray(u.offset,u.offset+u.length),d=kr(l[0]);d===Ie.VPS_NUT?e.push(l):d===Ie.SPS_NUT?r.push(l):d===Ie.PPS_NUT?i.push(l):(d===Ie.PREFIX_SEI_NUT||d===Ie.SUFFIX_SEI_NUT)&&n.push(l);}if(r.length===0||i.length===0)return null;let s=ps(r[0]);if(!s)return null;let o=0;if(i.length>0){let u=i[0],l=new ue(Xi(u));l.skipBits(16),D(l),D(l),l.skipBits(1),l.skipBits(1),l.skipBits(3),l.skipBits(1),l.skipBits(1),D(l),D(l),ut(l),l.skipBits(1),l.skipBits(1),l.readBits(1)&&D(l),ut(l),ut(l),l.skipBits(1),l.skipBits(1),l.skipBits(1),l.skipBits(1);let d=l.readBits(1),f=l.readBits(1);!d&&!f?o=0:d&&!f?o=2:!d&&f?o=3:o=0;}let a=[...e.length?[{arrayCompleteness:1,nalUnitType:Ie.VPS_NUT,nalUnits:e}]:[],...r.length?[{arrayCompleteness:1,nalUnitType:Ie.SPS_NUT,nalUnits:r}]:[],...i.length?[{arrayCompleteness:1,nalUnitType:Ie.PPS_NUT,nalUnits:i}]:[],...n.length?[{arrayCompleteness:1,nalUnitType:kr(n[0][0]),nalUnits:n}]:[]];return {configurationVersion:1,generalProfileSpace:s.generalProfileSpace,generalTierFlag:s.generalTierFlag,generalProfileIdc:s.generalProfileIdc,generalProfileCompatibilityFlags:s.generalProfileCompatibilityFlags,generalConstraintIndicatorFlags:s.generalConstraintIndicatorFlags,generalLevelIdc:s.generalLevelIdc,minSpatialSegmentationIdc:s.minSpatialSegmentationIdc,parallelismType:o,chromaFormatIdc:s.chromaFormatIdc,bitDepthLumaMinus8:s.bitDepthLumaMinus8,bitDepthChromaMinus8:s.bitDepthChromaMinus8,avgFrameRate:0,constantFrameRate:0,numTemporalLayers:s.spsMaxSubLayersMinus1+1,temporalIdNested:s.spsTemporalIdNestingFlag,lengthSizeMinusOne:3,arrays:a}}catch(e){return $._error("Error building HEVC Decoder Configuration Record:",e),null}},Dc=(t,e)=>{let r=t.readBits(2),i=t.readBits(1),n=t.readBits(5),s=0;for(let l=0;l<32;l++)s=s<<1|t.readBits(1);let o=new Uint8Array(6);for(let l=0;l<6;l++)o[l]=t.readBits(8);let a=t.readBits(8),c=[],u=[];for(let l=0;l<e;l++)c.push(t.readBits(1)),u.push(t.readBits(1));if(e>0)for(let l=e;l<8;l++)t.skipBits(2);for(let l=0;l<e;l++)c[l]&&t.skipBits(88),u[l]&&t.skipBits(8);return {general_profile_space:r,general_tier_flag:i,general_profile_idc:n,general_profile_compatibility_flags:s,general_constraint_indicator_flags:o,general_level_idc:a}},Oc=t=>{for(let e=0;e<4;e++)for(let r=0;r<(e===3?2:6);r++)if(!t.readBits(1))D(t);else {let n=Math.min(64,1<<4+(e<<1));e>1&&ut(t);for(let s=0;s<n;s++)ut(t);}},zc=(t,e)=>{let r=[];for(let i=0;i<e;i++)r[i]=Uc(t,i,e,r);},Uc=(t,e,r,i)=>{let n=0,s=0,o=0;if(e!==0&&(s=t.readBits(1)),s){if(e===r){let c=D(t);o=e-(c+1);}else o=e-1;t.readBits(1),D(t);let a=i[o]??0;for(let c=0;c<=a;c++)t.readBits(1)||t.readBits(1);n=i[o];}else {let a=D(t),c=D(t);for(let u=0;u<a;u++)D(t),t.readBits(1);for(let u=0;u<c;u++)D(t),t.readBits(1);n=a+c;}return n},Vc=(t,e)=>{let r=2,i=2,n=2,s=0,o=0,a={num:1,den:1};if(t.readBits(1)){let c=t.readBits(8);if(c===255)a={num:t.readBits(16),den:t.readBits(16)};else {let u=Oo[c];u&&(a=u);}}return t.readBits(1)&&t.readBits(1),t.readBits(1)&&(t.readBits(3),s=t.readBits(1),t.readBits(1)&&(r=t.readBits(8),i=t.readBits(8),n=t.readBits(8))),t.readBits(1)&&(D(t),D(t)),t.readBits(1),t.readBits(1),t.readBits(1),t.readBits(1)&&(D(t),D(t),D(t),D(t)),t.readBits(1)&&(t.readBits(32),t.readBits(32),t.readBits(1)&&D(t),t.readBits(1)&&Nc(t,!0,e)),t.readBits(1)&&(t.readBits(1),t.readBits(1),t.readBits(1),o=D(t),D(t),D(t),D(t),D(t)),{pixelAspectRatio:a,colourPrimaries:r,transferCharacteristics:i,matrixCoefficients:n,fullRangeFlag:s,minSpatialSegmentationIdc:o}},Nc=(t,e,r)=>{let i=!1,n=!1,s=!1;e&&(i=t.readBits(1)===1,n=t.readBits(1)===1,(i||n)&&(s=t.readBits(1)===1,s&&(t.readBits(8),t.readBits(5),t.readBits(1),t.readBits(5)),t.readBits(4),t.readBits(4),s&&t.readBits(4),t.readBits(5),t.readBits(5),t.readBits(5)));for(let o=0;o<=r;o++){let a=t.readBits(1)===1,c=!0;a||(c=t.readBits(1)===1);let u=!1;c?D(t):u=t.readBits(1)===1;let l=1;u||(l=D(t)+1),i&&Ro(t,l,s),n&&Ro(t,l,s);}},Ro=(t,e,r)=>{for(let i=0;i<e;i++)D(t),D(t),r&&(D(t),D(t)),t.readBits(1);},zo=t=>{let e=[];e.push(t.configurationVersion),e.push((t.generalProfileSpace&3)<<6|(t.generalTierFlag&1)<<5|t.generalProfileIdc&31),e.push(t.generalProfileCompatibilityFlags>>>24&255),e.push(t.generalProfileCompatibilityFlags>>>16&255),e.push(t.generalProfileCompatibilityFlags>>>8&255),e.push(t.generalProfileCompatibilityFlags&255),e.push(...t.generalConstraintIndicatorFlags),e.push(t.generalLevelIdc&255),e.push(240|t.minSpatialSegmentationIdc>>8&15),e.push(t.minSpatialSegmentationIdc&255),e.push(252|t.parallelismType&3),e.push(252|t.chromaFormatIdc&3),e.push(248|t.bitDepthLumaMinus8&7),e.push(248|t.bitDepthChromaMinus8&7),e.push(t.avgFrameRate>>8&255),e.push(t.avgFrameRate&255),e.push((t.constantFrameRate&3)<<6|(t.numTemporalLayers&7)<<3|(t.temporalIdNested&1)<<2|t.lengthSizeMinusOne&3),e.push(t.arrays.length&255);for(let r of t.arrays){e.push((r.arrayCompleteness&1)<<7|0|r.nalUnitType&63),e.push(r.nalUnits.length>>8&255),e.push(r.nalUnits.length&255);for(let i of r.nalUnits){e.push(i.length>>8&255),e.push(i.length&255);for(let n=0;n<i.length;n++)e.push(i[n]);}}return new Uint8Array(e)},Uo=t=>{try{let e=oe(t),r=0,i=e.getUint8(r++),n=e.getUint8(r++),s=n>>6&3,o=n>>5&1,a=n&31,c=e.getUint32(r,!1);r+=4;let u=t.subarray(r,r+6);r+=6;let l=e.getUint8(r++),d=(e.getUint8(r++)&15)<<8|e.getUint8(r++),f=e.getUint8(r++)&3,m=e.getUint8(r++)&3,p=e.getUint8(r++)&7,b=e.getUint8(r++)&7,y=e.getUint16(r,!1);r+=2;let w=e.getUint8(r++),T=w>>6&3,A=w>>3&7,E=w>>2&1,P=w&3,I=e.getUint8(r++),v=[];for(let k=0;k<I;k++){let C=e.getUint8(r++),M=C>>7&1,q=C&63,N=e.getUint16(r,!1);r+=2;let L=[];for(let ae=0;ae<N;ae++){let G=e.getUint16(r,!1);r+=2,L.push(t.subarray(r,r+G)),r+=G;}v.push({arrayCompleteness:M,nalUnitType:q,nalUnits:L});}return {configurationVersion:i,generalProfileSpace:s,generalTierFlag:o,generalProfileIdc:a,generalProfileCompatibilityFlags:c,generalConstraintIndicatorFlags:u,generalLevelIdc:l,minSpatialSegmentationIdc:d,parallelismType:f,chromaFormatIdc:m,bitDepthLumaMinus8:p,bitDepthChromaMinus8:b,avgFrameRate:y,constantFrameRate:T,numTemporalLayers:A,temporalIdNested:E,lengthSizeMinusOne:P,arrays:v}}catch(e){return $._error("Error deserializing HEVC Decoder Configuration Record:",e),null}},Fe;(function(t){t[t.audAllowed=0]="audAllowed",t[t.beforeFirstVcl=1]="beforeFirstVcl",t[t.afterFirstVcl=2]="afterFirstVcl",t[t.eoBitstreamAllowed=3]="eoBitstreamAllowed",t[t.noMoreDataAllowed=4]="noMoreDataAllowed";})(Fe||(Fe={}));var Vo=(t,e)=>{let r=new Set,i=Fe.audAllowed;for(let s of ni(t,e)){if(i===Fe.noMoreDataAllowed){r.add(s.offset);continue}let o=kr(t[s.offset]);if(i===Fe.eoBitstreamAllowed&&o!==37){r.add(s.offset);continue}let a=!1;o===35?i>Fe.audAllowed?a=!0:i=Fe.beforeFirstVcl:o<=31?i>Fe.afterFirstVcl?a=!0:i=Fe.afterFirstVcl:o===36?i!==Fe.afterFirstVcl?a=!0:i=Fe.eoBitstreamAllowed:o===37?i<Fe.afterFirstVcl?a=!0:i=Fe.noMoreDataAllowed:o===32||o===33||o===34||o===39||o>=41&&o<=44||o>=48&&o<=55?i>Fe.beforeFirstVcl?a=!0:i=Fe.beforeFirstVcl:(o===38||o===40||o>=45&&o<=47||o>=56&&o<=63)&&i<Fe.afterFirstVcl&&(a=!0),a&&r.add(s.offset);}if(r.size===0)return null;let n=[];for(let s of ni(t,e))r.has(s.offset)||n.push(t.subarray(s.offset,s.offset+s.length));return Mc(n,e)},Wc={1:{colourPrimaries:5,transferCharacteristics:6,matrixCoefficients:5},2:{colourPrimaries:1,transferCharacteristics:1,matrixCoefficients:1},3:{colourPrimaries:6,transferCharacteristics:6,matrixCoefficients:6},4:{colourPrimaries:7,transferCharacteristics:7,matrixCoefficients:7},5:{colourPrimaries:9,transferCharacteristics:14,matrixCoefficients:9},7:{colourPrimaries:1,transferCharacteristics:13,matrixCoefficients:0}},en=t=>{let e=new ue(t);if(e.readBits(2)!==2)return null;let i=e.readBits(1),s=(e.readBits(1)<<1)+i;if(s===3&&e.skipBits(1),e.readBits(1)===1||e.readBits(1)!==0||(e.skipBits(2),e.readBits(24)!==4817730))return null;let u=8;s>=2&&(u=e.readBits(1)?12:10);let l=e.readBits(3),d=0,f=0;if(l!==7)if(f=e.readBits(1),s===1||s===3){let k=e.readBits(1),C=e.readBits(1);d=!k&&!C?3:k&&!C?2:1,e.skipBits(1);}else d=1;else d=3,f=1;let m=e.readBits(16),p=e.readBits(16),b=m+1,y=p+1,w=b*y,T=ge(vt).level;for(let v of vt)if(w<=v.maxPictureSize){T=v.level;break}let A=Wc[l],E=A?.colourPrimaries??2,P=A?.transferCharacteristics??2,I=A?.matrixCoefficients??2;return {profile:s,level:T,bitDepth:u,chromaSubsampling:d,videoFullRangeFlag:f,colourPrimaries:E,transferCharacteristics:P,matrixCoefficients:I}},No=t=>t.colourPrimaries!==2||t.transferCharacteristics!==2||t.matrixCoefficients!==2,Wo=function*(t){let e=new ue(t),r=()=>{let i=0;for(let n=0;n<8;n++){let s=e.readAlignedByte();if(i+=(s&127)*2**(n*7),!(s&128))break;if(n===7&&s&128)return null}return i>2**32-1?null:i};for(;e.getBitsLeft()>=8;){e.skipBits(1);let i=e.readBits(4),n=e.readBits(1),s=e.readBits(1);e.skipBits(1),n&&e.skipBits(8);let o;if(s){let a=r();if(a===null)return;o=a;}else o=Math.floor(e.getBitsLeft()/8);g(e.pos%8===0),yield {type:i,data:t.subarray(e.pos/8,e.pos/8+o)},e.skipBits(o*8);}},ai=t=>{for(let{type:e,data:r}of Wo(t)){if(e!==1)continue;let i=new ue(r),n=i.readBits(3),s=i.readBits(1),o=i.readBits(1),a=0,c=0,u=0;if(o)a=i.readBits(5);else {let M=i.readBits(1),q=0;if(M){if(i.skipBits(32),i.skipBits(32),i.readBits(1)){let G=0;for(;G<32&&!i.readBits(1);)G++;G<32&&i.skipBits(G);}q=i.readBits(1),q&&(u=i.readBits(5),i.skipBits(32),i.skipBits(5),i.skipBits(5));}let N=i.readBits(1),L=i.readBits(5);for(let ae=0;ae<=L;ae++){i.skipBits(12);let G=i.readBits(5);if(ae===0&&(a=G),G>7){let ie=i.readBits(1);ae===0&&(c=ie);}if(q&&i.readBits(1)){let te=u+1;i.skipBits(te),i.skipBits(te),i.skipBits(1);}N&&i.readBits(1)&&i.skipBits(4);}}let l=i.readBits(4),d=i.readBits(4),f=l+1;i.skipBits(f);let m=d+1;i.skipBits(m);let p=0;if(o?p=0:p=i.readBits(1),p&&(i.skipBits(4),i.skipBits(3)),i.skipBits(1),i.skipBits(1),i.skipBits(1),!o){i.skipBits(1),i.skipBits(1),i.skipBits(1),i.skipBits(1);let M=i.readBits(1);M&&(i.skipBits(1),i.skipBits(1));let q=i.readBits(1),N=0;q?N=2:N=i.readBits(1),N>0&&(i.readBits(1)||i.skipBits(1)),M&&i.skipBits(3);}i.skipBits(1),i.skipBits(1),i.skipBits(1);let b=i.readBits(1),y=8;n===2&&b?y=i.readBits(1)?12:10:n<=2&&(y=b?10:8);let w=0;n!==1&&(w=i.readBits(1));let T=2,A=2,E=2;i.readBits(1)&&(T=i.readBits(8),A=i.readBits(8),E=i.readBits(8));let I=0,v=1,k=1,C=0;return w?I=i.readBits(1):T===1&&A===13&&E===0?(I=1,v=0,k=0):(I=i.readBits(1),n===0?(v=1,k=1):n===1?(v=0,k=0):y===12?(v=i.readBits(1),k=v?i.readBits(1):0):(v=1,k=0),v&&k&&(C=i.readBits(2))),{profile:n,level:a,tier:c,bitDepth:y,monochrome:w,chromaSubsamplingX:v,chromaSubsamplingY:k,chromaSamplePosition:C,videoFullRangeFlag:I,colourPrimaries:T,transferCharacteristics:A,matrixCoefficients:E}}return null},qo=t=>t.colourPrimaries!==2||t.transferCharacteristics!==2||t.matrixCoefficients!==2,tn=t=>{if(t.length<36)return null;let r=oe(t);return r.getUint32(4)!==1768124518||r.getUint16(8)<28?null:{fullRange:!1,colourPrimaries:r.getUint8(22),transferCharacteristics:r.getUint8(23),matrixCoefficients:r.getUint8(24)}},Lo=t=>{let e=oe(t),r=e.getUint8(9),i=e.getUint16(10,!0),n=e.getUint32(12,!0),s=e.getInt16(16,!0),o=e.getUint8(18),a=null;return o&&(a=t.subarray(19,21+r)),{outputChannelCount:r,preSkip:i,inputSampleRate:n,outputGain:s,channelMappingFamily:o,channelMappingTable:a}};var Er=(t,e,r)=>{switch(t){case "avc":{for(let i of hs(r,e)){let n=r[i.offset],s=oi(n);if(s>=Ge.NON_IDR_SLICE&&s<=Ge.SLICE_DPC)return "delta";if(s===Ge.IDR)return "key";if(s===Ge.SEI&&!Jr()){let o=r.subarray(i.offset,i.offset+i.length),a=Xi(o),c=1;do{let u=0;for(;;){let f=a[c++];if(f===void 0||(u+=f,f<255))break}let l=0;for(;;){let f=a[c++];if(f===void 0||(l+=f,f<255))break}if(u===6){let f=new ue(a);f.pos=8*c;let m=D(f),p=f.readBits(1);if(m===0&&p===1)return "key"}c+=l;}while(c<a.length-1)}}return "delta"}case "hevc":{for(let i of ni(r,e)){let n=kr(r[i.offset]);if(n<Ie.BLA_W_LP)return "delta";if(n<=Ie.RSV_IRAP_VCL23)return "key"}return "delta"}case "vp8":return (r[0]&1)===0?"key":"delta";case "vp9":{let i=new ue(r);if(i.readBits(2)!==2)return null;let n=i.readBits(1);return (i.readBits(1)<<1)+n===3&&i.skipBits(1),i.readBits(1)?null:i.readBits(1)===0?"key":"delta"}case "av1":{let i=!1;for(let{type:n,data:s}of Wo(r))if(n===1){let o=new ue(s);o.skipBits(4),i=!!o.readBits(1);}else if(n===3||n===6||n===7){if(i)return "key";let o=new ue(s);return o.readBits(1)?null:o.readBits(2)===0?"key":"delta"}return null}case "prores":return "key";default:ve(t),g(!1);}},Gi;(function(t){t[t.STREAMINFO=0]="STREAMINFO",t[t.VORBIS_COMMENT=4]="VORBIS_COMMENT",t[t.PICTURE=6]="PICTURE";})(Gi||(Gi={}));var gs=[2,1,2,3,3,4,4,5],Ho=t=>{if(t.length<7||t[0]!==11||t[1]!==119)return null;let e=new ue(t);e.skipBits(16),e.skipBits(16);let r=e.readBits(2);if(r===3)return null;let i=e.readBits(6),n=e.readBits(5);if(n>8)return null;let s=e.readBits(3),o=e.readBits(3);(o&1)!==0&&o!==1&&e.skipBits(2),(o&4)!==0&&e.skipBits(2),o===2&&e.skipBits(2);let a=e.readBits(1),c=Math.floor(i/2);return {fscod:r,bsid:n,bsmod:s,acmod:o,lfeon:a,bitRateCode:c}},fd=[128,138,192,128,140,192,160,174,240,160,176,240,192,208,288,192,210,288,224,242,336,224,244,336,256,278,384,256,280,384,320,348,480,320,350,480,384,416,288*2,384,418,288*2,448,486,336*2,448,488,336*2,256*2,278*2,384*2,256*2,279*2,384*2,320*2,348*2,480*2,320*2,349*2,480*2,384*2,417*2,576*2,384*2,418*2,576*2,448*2,487*2,672*2,448*2,488*2,672*2,512*2,557*2,768*2,512*2,558*2,768*2,640*2,696*2,960*2,640*2,697*2,960*2,768*2,835*2,1152*2,768*2,836*2,1152*2,896*2,975*2,1344*2,896*2,976*2,1344*2,1024*2,1114*2,1536*2,1024*2,1115*2,1536*2,1152*2,1253*2,1728*2,1152*2,1254*2,1728*2,1280*2,1393*2,1920*2,1280*2,1394*2,1920*2];var hd=new Uint8Array([5,4,65,67,45,51]),md=new Uint8Array([5,4,69,65,67,51]),qc=[1,2,3,6],jo=t=>{if(t.length<6||t[0]!==11||t[1]!==119)return null;let e=new ue(t);e.skipBits(16);let r=e.readBits(2);if(e.skipBits(3),r!==0&&r!==2)return null;let i=e.readBits(11),n=e.readBits(2),s=0,o;n===3?(s=e.readBits(2),o=3):o=e.readBits(2);let a=e.readBits(3),c=e.readBits(1),u=e.readBits(5);if(u<11||u>16)return null;let l=qc[o],d;return n<3?d=ii[n]/1e3:d=ds[s]/1e3,{dataRate:Math.round((i+1)*d/(l*16)),substreams:[{fscod:n,fscod2:s,bsid:u,bsmod:0,acmod:a,lfeon:c,numDepSub:0,chanLoc:0}]}},Qo=t=>{if(t.length<2)return null;let e=new ue(t),r=e.readBits(13),i=e.readBits(3),n=[];for(let s=0;s<=i&&!(Math.ceil(e.pos/8)+3>t.length);s++){let o=e.readBits(2),a=e.readBits(5);e.skipBits(1),e.skipBits(1);let c=e.readBits(3),u=e.readBits(3),l=e.readBits(1);e.skipBits(3);let d=e.readBits(4),f=0;d>0?f=e.readBits(9):e.skipBits(1),n.push({fscod:o,fscod2:null,bsid:a,bsmod:c,acmod:u,lfeon:l,numDepSub:d,chanLoc:f});}return n.length===0?null:{dataRate:r,substreams:n}},Ko=t=>{let e=t.substreams[0];return g(e),e.fscod<3?ii[e.fscod]:e.fscod2!==null&&e.fscod2<3?ds[e.fscod2]:null},Go=t=>{let e=t.substreams[0];g(e);let r=gs[e.acmod]+e.lfeon;if(e.numDepSub>0){let i=[2,2,1,1,2,2,2,1,1];for(let n=0;n<9;n++)e.chanLoc&1<<8-n&&(r+=i[n]);}return r};var Lc=1683496997,Hc=18,jc=10;var Fo=32,rn=20,Qc=8,Kc=[0,8e3,16e3,32e3,0,0,11025,22050,44100,0,0,12e3,24e3,48e3,96e3,192e3],Gc=[32e3,56e3,64e3,96e3,112e3,128e3,192e3,224e3,256e3,32e4,384e3,448e3,512e3,576e3,64e4,768e3,96e4,1024e3,1152e3,128e4,1344e3,1408e3,1411200,1472e3,1536e3,192e4,2048e3,3072e3,384e4,0,0,0],$c=[16,16,20,20,0,24,24,0],$i=[1,2,2,2,2,3,3,4,4,5,6,6,6,7,8,8],Xc=[1,2,2,2,2,3,18,19,6,7,518,323,83,519,582,535],Zc=8,Yc=44646,Jc=[32e3,44100,48e3,0],el=[8e3,16e3,32e3,64e3,128e3,22050,44100,88200,176400,352800,12e3,24e3,48e3,96e3,192e3,384e3],$o=[512,1024,2048,4096],ws=t=>{let e=tl(t),r=oe(t),i=e?Math.ceil(e.frameSize/4)*4:0,n=null;for(;i+4<=t.length&&r.getUint32(i)===Lc;){let o=rl(t.subarray(i));if(!o)break;n??(n=o),i+=o.frameSize;}if(e)return {frameSize:n?i:e.frameSize,sampleRate:e.sampleRate,numberOfChannels:e.numberOfChannels,sampleCount:e.sampleCount,channelLayout:e.channelLayout,pcmResolution:e.pcmResolution,bitRate:e.bitRate,core:e,hasExtensions:n!==null};if(!n?.asset)return null;let{asset:s}=n;return {frameSize:i,sampleRate:s.sampleRate,numberOfChannels:s.numberOfChannels,sampleCount:s.sampleCount,channelLayout:s.channelLayout,pcmResolution:s.pcmResolution,bitRate:0,core:null,hasExtensions:!0}},nn=t=>{let e=ws(t);return e?.core?e.hasExtensions?"dtsh":"dtsc":null},tl=t=>{if(t.length<Hc||t[0]!==127||t[1]!==254||t[2]!==128||t[3]!==1)return null;let e=new ue(t);if(e.skipBits(32),e.skipBits(1),e.readBits(5)!==Fo-1)return null;let r=e.readBits(1),i=e.readBits(7)+1;if(i%Qc!==0)return null;let n=e.readBits(14)+1;if(n<96)return null;let s=e.readBits(6);if(s>=$i.length)return null;let o=Kc[e.readBits(4)];if(o===0)return null;let a=Gc[e.readBits(5)];if(e.readBits(1)!==0)return null;e.skipBits(4),e.skipBits(5);let c=e.readBits(2);if(c===3)return null;e.skipBits(1),r&&e.skipBits(16),e.skipBits(7);let u=$c[e.readBits(3)];if(u===0)return null;let l=c!==0;return {frameSize:n,sampleRate:o,numberOfChannels:$i[s]+(l?1:0),sampleCount:i*Fo,channelLayout:Xc[s]|(l?Zc:0),amode:s,lfePresent:l,bitRate:a,pcmResolution:u}},rl=t=>{if(t.length<jc||t[0]!==100||t[1]!==88||t[2]!==32||t[3]!==37)return null;let e=new ue(t);e.skipBits(32),e.skipBits(8);let r=e.readBits(2),i=e.readBits(1),n=8+4*i,s=16+4*i;e.skipBits(n);let o=e.readBits(s)+1,a={frameSize:o,asset:null};if(!e.readBits(1))return a;let c=Jc[e.readBits(2)],u=512*(e.readBits(3)+1);e.readBits(1)&&e.skipBits(36);let l=e.readBits(3)+1,d=e.readBits(3)+1,f=[];for(let w=0;w<l;w++)f.push(e.readBits(r+1));for(let w of f)e.skipBits(8*Vi(w));if(e.readBits(1)){e.skipBits(2);let w=e.readBits(2)+1<<2,T=e.readBits(2)+1;e.skipBits(T*w);}for(let w=0;w<d;w++)e.skipBits(s);e.skipBits(9),e.skipBits(3),e.readBits(1)&&e.skipBits(4),e.readBits(1)&&e.skipBits(24),e.readBits(1)&&e.skipBits(8*(e.readBits(10)+1));let m=e.readBits(5)+1,p=el[e.readBits(4)],b=e.readBits(8)+1,y=0;if(e.readBits(1)&&(b>2&&e.skipBits(1),b>6&&e.skipBits(1),e.readBits(1))){let w=e.readBits(2)+1<<2;y=e.readBits(w);}return c===0||e.getBitsLeft()<0?a:{frameSize:o,asset:{sampleRate:p,numberOfChannels:b,sampleCount:Math.round(u*p/c),channelLayout:y,pcmResolution:m}}},Xo=t=>{if(t.length<rn)return null;let e=oe(t),r=e.getUint32(0);if(r===0)return null;let i=new ue(t);i.seekToByte(13);let n=i.readBits(2);i.skipBits(5);let s=i.readBits(1),o=i.readBits(6);i.skipBits(14),i.skipBits(1),i.skipBits(3);let a=i.readBits(16),c=null;return a!==0?c=il(a):o<$i.length&&(c=$i[o]+s),{sampleRate:r,maxBitrate:e.getUint32(4),avgBitrate:e.getUint32(8),pcmSampleDepth:t[12],sampleCount:$o[n],channelLayout:a,numberOfChannels:c}},Zo=t=>{let e=new Uint8Array(rn),r=oe(e);r.setUint32(0,t.sampleRate),r.setUint32(4,t.bitRate),r.setUint32(8,t.bitRate),e[12]=t.pcmResolution;let i=t.core&&!t.hasExtensions?1:0,n=new ue(e);return n.seekToByte(13),n.writeBits(2,Math.max($o.indexOf(t.sampleCount),0)),n.writeBits(5,i),n.writeBits(1,t.core?.lfePresent?1:0),n.writeBits(6,t.core?.amode??0),n.writeBits(14,t.core?t.core.frameSize-1:0),n.writeBits(1,0),n.writeBits(3,0),n.writeBits(16,t.channelLayout),n.writeBits(1,0),n.writeBits(1,0),n.writeBits(1,0),n.writeBits(5,0),e},il=t=>Vi(t)+Vi(t&Yc);var Oe=["avc","hevc","vp9","av1","vp8","prores"],Se=["pcm-s16","pcm-s16be","pcm-s24","pcm-s24be","pcm-s32","pcm-s32be","pcm-f32","pcm-f32be","pcm-f64","pcm-f64be","pcm-u8","pcm-s8","ulaw","alaw"],It=["aac","opus","mp3","vorbis","flac","ac3","eac3","dts"],Ue=[...It,...Se],Ht=["webvtt"],si=[{maxMacroblocks:99,maxBitrate:64e3,maxDpbMbs:396,level:10},{maxMacroblocks:396,maxBitrate:192e3,maxDpbMbs:900,level:11},{maxMacroblocks:396,maxBitrate:384e3,maxDpbMbs:2376,level:12},{maxMacroblocks:396,maxBitrate:768e3,maxDpbMbs:2376,level:13},{maxMacroblocks:396,maxBitrate:2e6,maxDpbMbs:2376,level:20},{maxMacroblocks:792,maxBitrate:4e6,maxDpbMbs:4752,level:21},{maxMacroblocks:1620,maxBitrate:4e6,maxDpbMbs:8100,level:22},{maxMacroblocks:1620,maxBitrate:1e7,maxDpbMbs:8100,level:30},{maxMacroblocks:3600,maxBitrate:14e6,maxDpbMbs:18e3,level:31},{maxMacroblocks:5120,maxBitrate:2e7,maxDpbMbs:20480,level:32},{maxMacroblocks:8192,maxBitrate:2e7,maxDpbMbs:32768,level:40},{maxMacroblocks:8192,maxBitrate:5e7,maxDpbMbs:32768,level:41},{maxMacroblocks:8704,maxBitrate:5e7,maxDpbMbs:34816,level:42},{maxMacroblocks:22080,maxBitrate:135e6,maxDpbMbs:110400,level:50},{maxMacroblocks:36864,maxBitrate:24e7,maxDpbMbs:184320,level:51},{maxMacroblocks:36864,maxBitrate:24e7,maxDpbMbs:184320,level:52},{maxMacroblocks:139264,maxBitrate:24e7,maxDpbMbs:696320,level:60},{maxMacroblocks:139264,maxBitrate:48e7,maxDpbMbs:696320,level:61},{maxMacroblocks:139264,maxBitrate:8e8,maxDpbMbs:696320,level:62}],Yo=[{maxPictureSize:36864,maxBitrate:128e3,tier:"L",level:30},{maxPictureSize:122880,maxBitrate:15e5,tier:"L",level:60},{maxPictureSize:245760,maxBitrate:3e6,tier:"L",level:63},{maxPictureSize:552960,maxBitrate:6e6,tier:"L",level:90},{maxPictureSize:983040,maxBitrate:1e7,tier:"L",level:93},{maxPictureSize:2228224,maxBitrate:12e6,tier:"L",level:120},{maxPictureSize:2228224,maxBitrate:3e7,tier:"H",level:120},{maxPictureSize:2228224,maxBitrate:2e7,tier:"L",level:123},{maxPictureSize:2228224,maxBitrate:5e7,tier:"H",level:123},{maxPictureSize:8912896,maxBitrate:25e6,tier:"L",level:150},{maxPictureSize:8912896,maxBitrate:1e8,tier:"H",level:150},{maxPictureSize:8912896,maxBitrate:4e7,tier:"L",level:153},{maxPictureSize:8912896,maxBitrate:16e7,tier:"H",level:153},{maxPictureSize:8912896,maxBitrate:6e7,tier:"L",level:156},{maxPictureSize:8912896,maxBitrate:24e7,tier:"H",level:156},{maxPictureSize:35651584,maxBitrate:6e7,tier:"L",level:180},{maxPictureSize:35651584,maxBitrate:24e7,tier:"H",level:180},{maxPictureSize:35651584,maxBitrate:12e7,tier:"L",level:183},{maxPictureSize:35651584,maxBitrate:48e7,tier:"H",level:183},{maxPictureSize:35651584,maxBitrate:24e7,tier:"L",level:186},{maxPictureSize:35651584,maxBitrate:8e8,tier:"H",level:186}],vt=[{maxPictureSize:36864,maxBitrate:2e5,level:10},{maxPictureSize:73728,maxBitrate:8e5,level:11},{maxPictureSize:122880,maxBitrate:18e5,level:20},{maxPictureSize:245760,maxBitrate:36e5,level:21},{maxPictureSize:552960,maxBitrate:72e5,level:30},{maxPictureSize:983040,maxBitrate:12e6,level:31},{maxPictureSize:2228224,maxBitrate:18e6,level:40},{maxPictureSize:2228224,maxBitrate:3e7,level:41},{maxPictureSize:8912896,maxBitrate:6e7,level:50},{maxPictureSize:8912896,maxBitrate:12e7,level:51},{maxPictureSize:8912896,maxBitrate:18e7,level:52},{maxPictureSize:35651584,maxBitrate:18e7,level:60},{maxPictureSize:35651584,maxBitrate:24e7,level:61},{maxPictureSize:35651584,maxBitrate:48e7,level:62}],Jo=[{maxPictureSize:147456,maxBitrate:15e5,tier:"M",level:0},{maxPictureSize:278784,maxBitrate:3e6,tier:"M",level:1},{maxPictureSize:665856,maxBitrate:6e6,tier:"M",level:4},{maxPictureSize:1065024,maxBitrate:1e7,tier:"M",level:5},{maxPictureSize:2359296,maxBitrate:12e6,tier:"M",level:8},{maxPictureSize:2359296,maxBitrate:3e7,tier:"H",level:8},{maxPictureSize:2359296,maxBitrate:2e7,tier:"M",level:9},{maxPictureSize:2359296,maxBitrate:5e7,tier:"H",level:9},{maxPictureSize:8912896,maxBitrate:3e7,tier:"M",level:12},{maxPictureSize:8912896,maxBitrate:1e8,tier:"H",level:12},{maxPictureSize:8912896,maxBitrate:4e7,tier:"M",level:13},{maxPictureSize:8912896,maxBitrate:16e7,tier:"H",level:13},{maxPictureSize:8912896,maxBitrate:6e7,tier:"M",level:14},{maxPictureSize:8912896,maxBitrate:24e7,tier:"H",level:14},{maxPictureSize:35651584,maxBitrate:6e7,tier:"M",level:15},{maxPictureSize:35651584,maxBitrate:24e7,tier:"H",level:15},{maxPictureSize:35651584,maxBitrate:6e7,tier:"M",level:16},{maxPictureSize:35651584,maxBitrate:24e7,tier:"H",level:16},{maxPictureSize:35651584,maxBitrate:1e8,tier:"M",level:17},{maxPictureSize:35651584,maxBitrate:48e7,tier:"H",level:17},{maxPictureSize:35651584,maxBitrate:16e7,tier:"M",level:18},{maxPictureSize:35651584,maxBitrate:8e8,tier:"H",level:18},{maxPictureSize:35651584,maxBitrate:16e7,tier:"M",level:19},{maxPictureSize:35651584,maxBitrate:8e8,tier:"H",level:19}],ea=".01.01.01.01.00",ta=".0.110.01.01.01.0",Pt=["ap4x","ap4h","apch","apcn","apcs","apco"],ci=["dtsc","dtsh","dtsl","dtse"],nl=[{fourCc:"apco",bitrate:45e6,alpha:!1},{fourCc:"apcs",bitrate:102e6,alpha:!1},{fourCc:"apcn",bitrate:147e6,alpha:!1},{fourCc:"apch",bitrate:22e7,alpha:!1},{fourCc:"ap4h",bitrate:33e7,alpha:!0},{fourCc:"ap4x",bitrate:5e8,alpha:!0}],ra=(t,e,r,i,n)=>{if(t==="avc"){let o=Math.ceil(e/16)*Math.ceil(r/16),a=si.find(f=>o<=f.maxMacroblocks&&i<=f.maxBitrate)??ge(si),c=a?a.level:0,u="64".padStart(2,"0"),l="00",d=c.toString(16).padStart(2,"0");return `avc1.${u}${l}${d}`}else if(t==="hevc"){let c=e*r,u=Yo.find(d=>c<=d.maxPictureSize&&i<=d.maxBitrate)??ge(Yo);return `hev1.1.6.${u.tier}${u.level}.B0`}else {if(t==="vp8")return "vp8";if(t==="vp9"){let o=e*r;return `vp09.00.${(vt.find(u=>o<=u.maxPictureSize&&i<=u.maxBitrate)??ge(vt)).level.toString().padStart(2,"0")}.08`}else if(t==="av1"){let o=e*r,a=Jo.find(l=>o<=l.maxPictureSize&&i<=l.maxBitrate)??ge(Jo);return `av01.0.${a.level.toString().padStart(2,"0")}${a.tier}.08`}else if(t==="prores"){let o=Math.pow(e*r/2073600,.95),a=nl.filter(l=>l.alpha===n),c=a[0].fourCc,u=1/0;for(let{fourCc:l,bitrate:d}of a){let f=Math.abs(d*o-i);f<u&&(u=f,c=l);}return c}else ve(t);}throw new TypeError(`Unhandled codec '${String(t)}'.`)};var ia=t=>{let e=t.split("."),n=(1<<7)+1,s=Number(e[1]),o=e[2],a=Number(o.slice(0,-1)),c=(s<<5)+a,u=o.slice(-1)==="H"?1:0,l=Number(e[3]),d=l===8?0:1,f=l===12?1:0,m=e[4]?Number(e[4]):0,p=e[5]?Number(e[5][0]):1,b=e[5]?Number(e[5][1]):1,y=e[5]?Number(e[5][2]):0,w=(u<<7)+(d<<6)+(f<<5)+(m<<4)+(p<<3)+(b<<2)+y;return [n,c,w,0]},sn=t=>{let{codec:e,codecDescription:r,colorSpace:i,avcCodecInfo:n,hevcCodecInfo:s,vp9CodecInfo:o,av1CodecInfo:a,proresFormat:c}=t;if(e==="avc"){if(g(t.avcType!==null),n){let u=new Uint8Array([n.avcProfileIndication,n.profileCompatibility,n.avcLevelIndication]);return `avc${t.avcType}.${Wt(u)}`}if(!r||r.byteLength<4)throw new TypeError("AVC decoder description is not provided or is not at least 4 bytes long.");return `avc${t.avcType}.${Wt(r.subarray(1,4))}`}else if(e==="hevc"){let u,l,d,f,m,p;if(s)u=s.generalProfileSpace,l=s.generalProfileIdc,d=is(s.generalProfileCompatibilityFlags),f=s.generalTierFlag,m=s.generalLevelIdc,p=[...s.generalConstraintIndicatorFlags];else {if(!r||r.byteLength<23)throw new TypeError("HEVC decoder description is not provided or is not at least 23 bytes long.");let y=oe(r),w=y.getUint8(1);u=w>>6&3,l=w&31,d=is(y.getUint32(2)),f=w>>5&1,m=y.getUint8(12),p=[];for(let T=0;T<6;T++)p.push(y.getUint8(6+T));}let b="hev1.";for(b+=["","A","B","C"][u]+l,b+=".",b+=d.toString(16).toUpperCase(),b+=".",b+=f===0?"L":"H",b+=m;p.length>0&&p[p.length-1]===0;)p.pop();return p.length>0&&(b+=".",b+=p.map(y=>y.toString(16).toUpperCase()).join(".")),b}else {if(e==="vp8")return "vp8";if(e==="vp9"){if(!o){let T=t.width*t.height,A=ge(vt).level;for(let E of vt)if(T<=E.maxPictureSize){A=E.level;break}return `vp09.00.${A.toString().padStart(2,"0")}.08`}let u=o.profile.toString().padStart(2,"0"),l=o.level.toString().padStart(2,"0"),d=o.bitDepth.toString().padStart(2,"0"),f=o.chromaSubsampling.toString().padStart(2,"0"),m=o.colourPrimaries.toString().padStart(2,"0"),p=o.transferCharacteristics.toString().padStart(2,"0"),b=o.matrixCoefficients.toString().padStart(2,"0"),y=o.videoFullRangeFlag.toString().padStart(2,"0"),w=`vp09.${u}.${l}.${d}.${f}`;return w+=`.${m}.${p}.${b}.${y}`,w.endsWith(ea)&&(w=w.slice(0,-ea.length)),w}else if(e==="av1"){if(!a){let E=t.width*t.height,P=ge(vt).level;for(let I of vt)if(E<=I.maxPictureSize){P=I.level;break}return `av01.0.${P.toString().padStart(2,"0")}M.08`}let u=a.profile,l=a.level.toString().padStart(2,"0"),d=a.tier?"H":"M",f=a.bitDepth.toString().padStart(2,"0"),m=a.monochrome?"1":"0",p=100*a.chromaSubsamplingX+10*a.chromaSubsamplingY+1*(a.chromaSubsamplingX&&a.chromaSubsamplingY?a.chromaSamplePosition:0),b=i?.primaries?St[i.primaries]:1,y=i?.transfer?xt[i.transfer]:1,w=i?.matrix?_t[i.matrix]:1,T=i?.fullRange?1:0,A=`av01.${u}.${l}${d}.${f}`;return A+=`.${m}.${p.toString().padStart(3,"0")}`,A+=`.${b.toString().padStart(2,"0")}`,A+=`.${y.toString().padStart(2,"0")}`,A+=`.${w.toString().padStart(2,"0")}`,A+=`.${T}`,A.endsWith(ta)&&(A=A.slice(0,-ta.length)),A}else {if(e==="prores")return c??"apch";e!==null&&ve(e);}}throw new TypeError(`Unhandled codec '${e}'.`)},on=t=>{switch(t.codec){case "avc":{let e=t.avcCodecInfo?.sequenceParameterSets[0];if(!e&&t.codecDescription&&(e=Ji(t.codecDescription)?.sequenceParameterSets[0]),e){let r=_r(e);if(r)return {primaries:dt[r.colourPrimaries],transfer:ft[r.transferCharacteristics],matrix:ht[r.matrixCoefficients],fullRange:!!r.fullRangeFlag}}}break;case "hevc":{let e=t.hevcCodecInfo?.arrays.find(r=>r.nalUnitType===Ie.SPS_NUT)?.nalUnits[0];if(!e&&t.codecDescription&&(e=Uo(t.codecDescription)?.arrays.find(r=>r.nalUnitType===Ie.SPS_NUT)?.nalUnits[0]),e){let r=ps(e);if(r)return {primaries:dt[r.colourPrimaries],transfer:ft[r.transferCharacteristics],matrix:ht[r.matrixCoefficients],fullRange:!!r.fullRangeFlag}}}break;case "vp8":break;case "vp9":if(t.vp9CodecInfo)return {primaries:dt[t.vp9CodecInfo.colourPrimaries],transfer:ft[t.vp9CodecInfo.transferCharacteristics],matrix:ht[t.vp9CodecInfo.matrixCoefficients],fullRange:!!t.vp9CodecInfo.videoFullRangeFlag};break;case "av1":if(t.av1CodecInfo)return {primaries:dt[t.av1CodecInfo.colourPrimaries],transfer:ft[t.av1CodecInfo.transferCharacteristics],matrix:ht[t.av1CodecInfo.matrixCoefficients],fullRange:!!t.av1CodecInfo.videoFullRangeFlag};break;case "prores":if(t.proresCodecInfo)return {primaries:dt[t.proresCodecInfo.colourPrimaries],transfer:ft[t.proresCodecInfo.transferCharacteristics],matrix:ht[t.proresCodecInfo.matrixCoefficients],fullRange:t.proresCodecInfo.fullRange};break}return {primaries:void 0,transfer:void 0,matrix:void 0,fullRange:void 0}},na=(t,e,r)=>{if(t==="aac")return e>=2&&r<=24e3?"mp4a.40.29":r<=24e3?"mp4a.40.5":"mp4a.40.2";if(t==="mp3")return "mp3";if(t==="opus")return "opus";if(t==="vorbis")return "vorbis";if(t==="flac")return "flac";if(t==="ac3")return "ac-3";if(t==="eac3")return "ec-3";if(t==="dts")return "dtsc";if(Se.includes(t))return t;throw new TypeError(`Unhandled codec '${t}'.`)},an=t=>{let{codec:e,codecDescription:r,aacCodecInfo:i,dtsFormat:n}=t;if(e==="aac"){if(!i)throw new TypeError("AAC codec info must be provided.");if(i.isMpeg2)return "mp4a.67";{let s;return i.objectType!==null?s=i.objectType:s=Ar(r).objectType,`mp4a.40.${s}`}}else {if(e==="mp3")return "mp3";if(e==="opus")return "opus";if(e==="vorbis")return "vorbis";if(e==="flac")return "flac";if(e==="ac3")return "ac-3";if(e==="eac3")return "ec-3";if(e==="dts")return n??"dtsc";if(e&&Se.includes(e))return e}throw new TypeError(`Unhandled codec '${e}'.`)};var cn=48e3,sa=/^pcm-([usf])(\d+)(be)?$/,Ve=t=>{if(g(Se.includes(t)),t==="ulaw")return {dataType:"ulaw",sampleSize:1,littleEndian:!0,silentValue:255};if(t==="alaw")return {dataType:"alaw",sampleSize:1,littleEndian:!0,silentValue:213};let e=sa.exec(t);g(e);let r;e[1]==="u"?r="unsigned":e[1]==="s"?r="signed":r="float";let i=Number(e[2])/8,n=e[3]!=="be",s=t==="pcm-u8"?2**7:0;return {dataType:r,sampleSize:i,littleEndian:n,silentValue:s}},li=t=>t.startsWith("avc1")||t.startsWith("avc3")?"avc":t.startsWith("hev1")||t.startsWith("hvc1")?"hevc":t==="vp8"?"vp8":t.startsWith("vp09")?"vp9":t.startsWith("av01")?"av1":Pt.includes(t)?"prores":t==="mp3"||t==="mp4a.69"||t==="mp4a.6B"||t==="mp4a.6b"||t==="mp4a.40.34"?"mp3":t.startsWith("mp4a.40.")||t==="mp4a.67"?"aac":t==="opus"?"opus":t==="vorbis"?"vorbis":t==="flac"?"flac":t==="ac-3"||t==="ac3"?"ac3":t==="ec-3"||t==="eac3"?"eac3":ci.includes(t)?"dts":t==="ulaw"?"ulaw":t==="alaw"?"alaw":sa.test(t)?t:t==="webvtt"?"webvtt":null,oa=t=>t==="avc"?{avc:{format:"avc"}}:t==="hevc"?{hevc:{format:"hevc"}}:{},aa=t=>t==="aac"?{aac:{format:"aac"}}:t==="opus"?{opus:{format:"opus"}}:{},sl=["avc1","avc3","hev1","hvc1","vp8","vp09","av01",...Pt],ol=/^(avc1|avc3)\.[0-9a-fA-F]{6}$/,al=/^(hev1|hvc1)\.(?:[ABC]?\d+)\.[0-9a-fA-F]{1,8}\.[LH]\d+(?:\.[0-9a-fA-F]{1,2}){0,6}$/,cl=/^vp09(?:\.\d{2}){3}(?:(?:\.\d{2}){5})?$/,ll=/^av01\.\d\.\d{2}[MH]\.\d{2}(?:\.\d\.\d{3}\.\d{2}\.\d{2}\.\d{2}\.\d)?$/,ln=(t,e)=>{if(!t)throw new TypeError("Video chunk metadata must be provided.");if(typeof t!="object")throw new TypeError("Video chunk metadata must be an object.");if(!t.decoderConfig)throw new TypeError("Video chunk metadata must include a decoder configuration.");if(typeof t.decoderConfig!="object")throw new TypeError("Video chunk metadata decoder configuration must be an object.");if(typeof t.decoderConfig.codec!="string")throw new TypeError("Video chunk metadata decoder configuration must specify a codec string.");if(!sl.some(r=>t.decoderConfig.codec.startsWith(r)))throw new TypeError("Video chunk metadata decoder configuration codec string must be a valid video codec string as specified in the Mediabunny Codec Registry.");if(!Number.isInteger(t.decoderConfig.codedWidth)||t.decoderConfig.codedWidth<=0)throw new TypeError("Video chunk metadata decoder configuration must specify a valid codedWidth (positive integer).");if(!Number.isInteger(t.decoderConfig.codedHeight)||t.decoderConfig.codedHeight<=0)throw new TypeError("Video chunk metadata decoder configuration must specify a valid codedHeight (positive integer).");if(t.decoderConfig.displayAspectWidth!==void 0&&(!Number.isInteger(t.decoderConfig.displayAspectWidth)||t.decoderConfig.displayAspectWidth<=0))throw new TypeError("Video chunk metadata decoder configuration displayAspectWidth, when defined, must be a positive integer.");if(t.decoderConfig.displayAspectHeight!==void 0&&(!Number.isInteger(t.decoderConfig.displayAspectHeight)||t.decoderConfig.displayAspectHeight<=0))throw new TypeError("Video chunk metadata decoder configuration displayAspectHeight, when defined, must be a positive integer.");if(t.decoderConfig.displayAspectWidth!==void 0!=(t.decoderConfig.displayAspectHeight!==void 0))throw new TypeError("Video chunk metadata decoder configuration must specify both displayAspectWidth and displayAspectHeight, or neither.");if(t.decoderConfig.description!==void 0&&!yr(t.decoderConfig.description))throw new TypeError("Video chunk metadata decoder configuration description, when defined, must be an ArrayBuffer or an ArrayBuffer view.");if(t.decoderConfig.colorSpace!==void 0){let{colorSpace:r}=t.decoderConfig;if(typeof r!="object")throw new TypeError("Video chunk metadata decoder configuration colorSpace, when provided, must be an object.");let i=Object.keys(St);if(r.primaries!=null&&!i.includes(r.primaries))throw new TypeError(`Video chunk metadata decoder configuration colorSpace primaries, when defined, must be one of ${i.join(", ")}.`);let n=Object.keys(xt);if(r.transfer!=null&&!n.includes(r.transfer))throw new TypeError(`Video chunk metadata decoder configuration colorSpace transfer, when defined, must be one of ${n.join(", ")}.`);let s=Object.keys(_t);if(r.matrix!=null&&!s.includes(r.matrix))throw new TypeError(`Video chunk metadata decoder configuration colorSpace matrix, when defined, must be one of ${s.join(", ")}.`);if(r.fullRange!=null&&typeof r.fullRange!="boolean")throw new TypeError("Video chunk metadata decoder configuration colorSpace fullRange, when defined, must be a boolean.")}if(t.decoderConfig.codec.startsWith("avc1")||t.decoderConfig.codec.startsWith("avc3")){if(!ol.test(t.decoderConfig.codec))throw new TypeError("Video chunk metadata decoder configuration codec string for AVC must be a valid AVC codec string as specified in Section 3.4 of RFC 6381.")}else if(t.decoderConfig.codec.startsWith("hev1")||t.decoderConfig.codec.startsWith("hvc1")){if(!al.test(t.decoderConfig.codec))throw new TypeError("Video chunk metadata decoder configuration codec string for HEVC must be a valid HEVC codec string as specified in Section E.3 of ISO 14496-15.")}else if(t.decoderConfig.codec.startsWith("vp8")){if(t.decoderConfig.codec!=="vp8")throw new TypeError('Video chunk metadata decoder configuration codec string for VP8 must be "vp8".')}else if(t.decoderConfig.codec.startsWith("vp09")){if(!cl.test(t.decoderConfig.codec))throw new TypeError('Video chunk metadata decoder configuration codec string for VP9 must be a valid VP9 codec string as specified in Section "Codecs Parameter String" of https://www.webmproject.org/vp9/mp4/.')}else if(t.decoderConfig.codec.startsWith("av01")){if(!ll.test(t.decoderConfig.codec))throw new TypeError('Video chunk metadata decoder configuration codec string for AV1 must be a valid AV1 codec string as specified in Section "Codecs Parameter String" of https://aomediacodec.github.io/av1-isobmff/.')}else if(Pt.some(r=>t.decoderConfig.codec.startsWith(r))&&!Pt.some(r=>t.decoderConfig.codec===r))throw new TypeError(`Video chunk metadata decoder configuration codec string for ProRes must be one of the valid ProRes four-character codes: ${Pt.join(", ")}.`);if(e!==null&&li(t.decoderConfig.codec)!==e)throw new TypeError(`Video chunk metadata decoder configuration codec string '${t.decoderConfig.codec}' does not fit to the track codec '${e}'.`)},ul=["mp4a","mp3","opus","vorbis","flac","ulaw","alaw","pcm","ac-3","ec-3","dts"],un=(t,e)=>{if(!t)throw new TypeError("Audio chunk metadata must be provided.");if(typeof t!="object")throw new TypeError("Audio chunk metadata must be an object.");if(!t.decoderConfig)throw new TypeError("Audio chunk metadata must include a decoder configuration.");if(typeof t.decoderConfig!="object")throw new TypeError("Audio chunk metadata decoder configuration must be an object.");if(typeof t.decoderConfig.codec!="string")throw new TypeError("Audio chunk metadata decoder configuration must specify a codec string.");if(!ul.some(r=>t.decoderConfig.codec.startsWith(r)))throw new TypeError("Audio chunk metadata decoder configuration codec string must be a valid audio codec string as specified in the Mediabunny Codec Registry.");if(!Number.isInteger(t.decoderConfig.sampleRate)||t.decoderConfig.sampleRate<=0)throw new TypeError("Audio chunk metadata decoder configuration must specify a valid sampleRate (positive integer).");if(!Number.isInteger(t.decoderConfig.numberOfChannels)||t.decoderConfig.numberOfChannels<=0)throw new TypeError("Audio chunk metadata decoder configuration must specify a valid numberOfChannels (positive integer).");if(t.decoderConfig.description!==void 0&&!yr(t.decoderConfig.description))throw new TypeError("Audio chunk metadata decoder configuration description, when defined, must be an ArrayBuffer or an ArrayBuffer view.");if(t.decoderConfig.codec.startsWith("mp4a")&&t.decoderConfig.codec!=="mp4a.69"&&t.decoderConfig.codec!=="mp4a.6B"&&t.decoderConfig.codec!=="mp4a.6b"){if(!["mp4a.40.2","mp4a.40.02","mp4a.40.5","mp4a.40.05","mp4a.40.29","mp4a.67"].includes(t.decoderConfig.codec))throw new TypeError("Audio chunk metadata decoder configuration codec string for AAC must be a valid AAC codec string as specified in https://www.w3.org/TR/webcodecs-aac-codec-registration/.")}else if(t.decoderConfig.codec.startsWith("mp3")||t.decoderConfig.codec.startsWith("mp4a")){if(t.decoderConfig.codec!=="mp3"&&t.decoderConfig.codec!=="mp4a.69"&&t.decoderConfig.codec!=="mp4a.6B"&&t.decoderConfig.codec!=="mp4a.6b")throw new TypeError('Audio chunk metadata decoder configuration codec string for MP3 must be "mp3", "mp4a.69" or "mp4a.6B".')}else if(t.decoderConfig.codec.startsWith("opus")){if(t.decoderConfig.codec!=="opus")throw new TypeError('Audio chunk metadata decoder configuration codec string for Opus must be "opus".');if(t.decoderConfig.description&&t.decoderConfig.description.byteLength<18)throw new TypeError("Audio chunk metadata decoder configuration description, when specified, is expected to be an Identification Header as specified in Section 5.1 of RFC 7845.")}else if(t.decoderConfig.codec.startsWith("vorbis")){if(t.decoderConfig.codec!=="vorbis")throw new TypeError('Audio chunk metadata decoder configuration codec string for Vorbis must be "vorbis".');if(!t.decoderConfig.description)throw new TypeError("Audio chunk metadata decoder configuration for Vorbis must include a description, which is expected to adhere to the format described in https://www.w3.org/TR/webcodecs-vorbis-codec-registration/.")}else if(t.decoderConfig.codec.startsWith("flac")){if(t.decoderConfig.codec!=="flac")throw new TypeError('Audio chunk metadata decoder configuration codec string for FLAC must be "flac".');if(!t.decoderConfig.description||t.decoderConfig.description.byteLength<42)throw new TypeError("Audio chunk metadata decoder configuration for FLAC must include a description, which is expected to adhere to the format described in https://www.w3.org/TR/webcodecs-flac-codec-registration/.")}else if(t.decoderConfig.codec.startsWith("ac-3")||t.decoderConfig.codec.startsWith("ac3")){if(t.decoderConfig.codec!=="ac-3")throw new TypeError('Audio chunk metadata decoder configuration codec string for AC-3 must be "ac-3".')}else if(t.decoderConfig.codec.startsWith("ec-3")||t.decoderConfig.codec.startsWith("eac3")){if(t.decoderConfig.codec!=="ec-3")throw new TypeError('Audio chunk metadata decoder configuration codec string for EC-3 must be "ec-3".')}else if(t.decoderConfig.codec.startsWith("dts")){if(!ci.includes(t.decoderConfig.codec))throw new TypeError(`Audio chunk metadata decoder configuration codec string for DTS must be one of the following four-character codes: ${ci.join(", ")}.`)}else if((t.decoderConfig.codec.startsWith("pcm")||t.decoderConfig.codec.startsWith("ulaw")||t.decoderConfig.codec.startsWith("alaw"))&&!Se.includes(t.decoderConfig.codec))throw new TypeError(`Audio chunk metadata decoder configuration codec string for PCM must be one of the supported PCM codecs (${Se.join(", ")}).`);if(e!==null&&li(t.decoderConfig.codec)!==e)throw new TypeError(`Audio chunk metadata decoder configuration codec string '${t.decoderConfig.codec}' does not fit to the track codec '${e}'.`)},ca=t=>{if(!t)throw new TypeError("Subtitle metadata must be provided.");if(typeof t!="object")throw new TypeError("Subtitle metadata must be an object.");if(!t.config)throw new TypeError("Subtitle metadata must include a config object.");if(typeof t.config!="object")throw new TypeError("Subtitle metadata config must be an object.");if(typeof t.config.description!="string")throw new TypeError("Subtitle metadata config description must be a string.")};var vr=class{constructor(e){this.input=e;}dispose(){}};var jt=new Uint8Array(0),me=class t{constructor(e,r,i,n,s=-1,o,a){if(this.data=e,this.type=r,this.timestamp=i,this.duration=n,this.sequenceNumber=s,e===jt&&o===void 0)throw new Error("Internal error: byteLength must be explicitly provided when constructing metadata-only packets.");if(o===void 0&&(o=e.byteLength),!(e instanceof Uint8Array))throw new TypeError("data must be a Uint8Array.");if(r!=="key"&&r!=="delta")throw new TypeError('type must be either "key" or "delta".');if(!Number.isFinite(i))throw new TypeError("timestamp must be a number.");if(!Number.isFinite(n)||n<0)throw new TypeError("duration must be a non-negative number.");if(!Number.isFinite(s))throw new TypeError("sequenceNumber must be a number.");if(!Number.isInteger(o)||o<0)throw new TypeError("byteLength must be a non-negative integer.");if(a!==void 0&&(typeof a!="object"||!a))throw new TypeError("sideData, when provided, must be an object.");if(a?.alpha!==void 0&&!(a.alpha instanceof Uint8Array))throw new TypeError("sideData.alpha, when provided, must be a Uint8Array.");if(a?.alphaByteLength!==void 0&&(!Number.isInteger(a.alphaByteLength)||a.alphaByteLength<0))throw new TypeError("sideData.alphaByteLength, when provided, must be a non-negative integer.");this.byteLength=o,this.sideData=a??{},this.sideData.alpha&&this.sideData.alphaByteLength===void 0&&(this.sideData.alphaByteLength=this.sideData.alpha.byteLength);}get isMetadataOnly(){return this.data===jt}get microsecondTimestamp(){return Math.trunc(mt*this.timestamp)}get microsecondDuration(){return Math.trunc(mt*this.duration)}toEncodedVideoChunk(){if(this.isMetadataOnly)throw new TypeError("Metadata-only packets cannot be converted to a video chunk.");if(typeof EncodedVideoChunk>"u")throw new Error("EncodedVideoChunk is not available in this environment.");return new EncodedVideoChunk({data:this.data,type:this.type,timestamp:this.microsecondTimestamp,duration:this.microsecondDuration})}alphaToEncodedVideoChunk(e=this.type){if(!this.sideData.alpha)throw new TypeError("This packet does not contain alpha side data.");if(this.isMetadataOnly)throw new TypeError("Metadata-only packets cannot be converted to a video chunk.");if(typeof EncodedVideoChunk>"u")throw new Error("EncodedVideoChunk is not available in this environment.");return new EncodedVideoChunk({data:this.sideData.alpha,type:e,timestamp:this.microsecondTimestamp,duration:this.microsecondDuration})}toEncodedAudioChunk(){if(this.isMetadataOnly)throw new TypeError("Metadata-only packets cannot be converted to an audio chunk.");if(typeof EncodedAudioChunk>"u")throw new Error("EncodedAudioChunk is not available in this environment.");return new EncodedAudioChunk({data:this.data,type:this.type,timestamp:this.microsecondTimestamp,duration:this.microsecondDuration})}static fromEncodedChunk(e,r){if(!(e instanceof EncodedVideoChunk||e instanceof EncodedAudioChunk))throw new TypeError("chunk must be an EncodedVideoChunk or EncodedAudioChunk.");let i=new Uint8Array(e.byteLength);return e.copyTo(i),new t(i,e.type,e.timestamp/1e6,(e.duration??0)/1e6,void 0,void 0,r)}clone(e){if(e!==void 0&&(typeof e!="object"||e===null))throw new TypeError("options, when provided, must be an object.");if(e?.data!==void 0&&!(e.data instanceof Uint8Array))throw new TypeError("options.data, when provided, must be a Uint8Array.");if(e?.type!==void 0&&e.type!=="key"&&e.type!=="delta")throw new TypeError('options.type, when provided, must be either "key" or "delta".');if(e?.timestamp!==void 0&&!Number.isFinite(e.timestamp))throw new TypeError("options.timestamp, when provided, must be a number.");if(e?.duration!==void 0&&!Number.isFinite(e.duration))throw new TypeError("options.duration, when provided, must be a number.");if(e?.sequenceNumber!==void 0&&!Number.isFinite(e.sequenceNumber))throw new TypeError("options.sequenceNumber, when provided, must be a number.");if(e?.sideData!==void 0&&(typeof e.sideData!="object"||e.sideData===null))throw new TypeError("options.sideData, when provided, must be an object.");return new t(e?.data??this.data,e?.type??this.type,e?.timestamp??this.timestamp,e?.duration??this.duration,e?.sequenceNumber??this.sequenceNumber,this.byteLength,e?.sideData??this.sideData)}};var dn=t=>{let r=(t.hasVideo?"video/":t.hasAudio?"audio/":"application/")+(t.isQuickTime?"quicktime":"mp4");if(t.codecStrings.length>0){let i=[...new Set(t.codecStrings)];r+=`; codecs="${i.join(", ")}"`;}return r},la=t=>{let e=oe(t),r=0,i=e.getUint8(r);r+=1,r+=3;let n=Wt(t.subarray(r,r+16));r+=16;let s=null;if(i>0){let a=e.getUint32(r);if(r+=4,a>0){s=[];for(let c=0;c<a;c++)s.push(Wt(t.subarray(r,r+16))),r+=16;}}let o=e.getUint32(r);return r+=4,{systemId:n,keyIds:s,data:t.slice(r,r+o)}},ua=(t,e)=>t.systemId===e.systemId&&xo(t.data,e.data);var rt=8,Rt=16,Ft=t=>{let e=O(t),r=Ne(t,4),i=8;e===1&&(e=Be(t),i=16);let s=e-i;return s<0?null:{name:r,totalSize:e,headerSize:i,contentSize:s}},Qt=t=>Bt(t)/65536,fn=t=>Bt(t)/1073741824,hn=t=>{let e=0;for(let r=0;r<4;r++){e<<=7;let i=K(t);if(e|=i&127,(i&128)===0)break}return e},it=t=>{let e=Pe(t);return t.skip(2),e=Math.min(e,t.remainingLength),Ke.decode(ee(t,e))},da=t=>{let e=Ft(t);if(!e||e.name!=="data"||t.remainingLength<8)return null;let r=O(t);t.skip(4);let i=ee(t,e.contentSize-8);switch(r){case 1:return Ke.decode(i);case 2:return new TextDecoder("utf-16be").decode(i);case 13:return new tt(i,"image/jpeg");case 14:return new tt(i,"image/png");case 27:return new tt(i,"image/bmp");default:return i}};var ys=16,Mt=new Uint32Array(256),Pr=new Uint32Array(256),Ir=new Uint32Array(256),Rr=new Uint32Array(256),Fr=new Uint32Array(256),Re=new Uint32Array(256),fa=new Uint32Array(10),ha=!1,dl=()=>{let t=new Uint8Array(256),e=new Uint8Array(256),r=new Uint8Array(256);for(let s=0,o=1;s<256;s++)r[s]=o,e[o]=s,o=o^o<<1^(o&128?283:0);let i=(s,o)=>s&&o?r[(e[s]+e[o])%255]:0;t[0]=99;for(let s=1;s<256;s++){let o=r[255-e[s]],a=o^o<<1^o<<2^o<<3^o<<4;a=a>>>8^a&255^99,t[s]=a;}for(let s=0;s<256;s++){let o=t[s],a=t.indexOf(s);Mt[s]=o<<24|o<<16|o<<8|o,Re[s]=a<<24|a<<16|a<<8|a;let c=i(a,14),u=i(a,9),l=i(a,13),d=i(a,11),f=c<<24|u<<16|l<<8|d;Pr[s]=f,Ir[s]=f>>>8|f<<24,Rr[s]=f>>>16|f<<16,Fr[s]=f>>>24|f<<8;}let n=1;for(let s=0;s<10;s++)fa[s]=n<<24,n=n<<1^(n&128?283:0);ha=!0;},mn=class{constructor(){this.roundkey=new Uint32Array(44),this.iv=new Uint32Array(ys/Uint32Array.BYTES_PER_ELEMENT),this.in=new Uint8Array(ys),this.out=new Uint8Array(ys),this.inView=new DataView(this.in.buffer),this.outView=new DataView(this.out.buffer);}init({key:e,iv:r}){g(e.byteLength===16),g(r.byteLength===16),ha||dl();let i=new DataView(e.buffer,e.byteOffset,e.byteLength),n=new DataView(r.buffer,r.byteOffset,r.byteLength);this.roundkey[0]=i.getUint32(0,!1),this.roundkey[1]=i.getUint32(4,!1),this.roundkey[2]=i.getUint32(8,!1),this.roundkey[3]=i.getUint32(12,!1),this.iv[0]=n.getUint32(0,!1),this.iv[1]=n.getUint32(4,!1),this.iv[2]=n.getUint32(8,!1),this.iv[3]=n.getUint32(12,!1);for(let s=4;s<44;s+=4){let o=this.roundkey[s-1];this.roundkey[s]=this.roundkey[s-4]^Mt[o>>>16&255]&4278190080^Mt[o>>>8&255]&16711680^Mt[o>>>0&255]&65280^Mt[o>>>24&255]&255^fa[s/4-1],this.roundkey[s+1]=this.roundkey[s-3]^this.roundkey[s],this.roundkey[s+2]=this.roundkey[s-2]^this.roundkey[s+1],this.roundkey[s+3]=this.roundkey[s-1]^this.roundkey[s+2];}for(let s=0,o=40;s<o;s+=4,o-=4)for(let a=0;a<4;a++){let c=this.roundkey[s+a];this.roundkey[s+a]=this.roundkey[o+a],this.roundkey[o+a]=c;}for(let s=4;s<40;s+=4)for(let o=0;o<4;o++){let a=this.roundkey[s+o];this.roundkey[s+o]=Pr[Mt[a>>>24&255]&255]^Ir[Mt[a>>>16&255]&255]^Rr[Mt[a>>>8&255]&255]^Fr[Mt[a>>>0&255]&255];}}decrypt(){let e=this.inView.getUint32(0,!1)^this.roundkey[0],r=this.inView.getUint32(4,!1)^this.roundkey[1],i=this.inView.getUint32(8,!1)^this.roundkey[2],n=this.inView.getUint32(12,!1)^this.roundkey[3],s=this.inView.getUint32(0,!1),o=this.inView.getUint32(4,!1),a=this.inView.getUint32(8,!1),c=this.inView.getUint32(12,!1),u,l,d,f;for(let w=1;w<10;w++){let T=w*4;u=Pr[e>>>24]^Ir[n>>>16&255]^Rr[i>>>8&255]^Fr[r&255]^this.roundkey[T],l=Pr[r>>>24]^Ir[e>>>16&255]^Rr[n>>>8&255]^Fr[i&255]^this.roundkey[T+1],d=Pr[i>>>24]^Ir[r>>>16&255]^Rr[e>>>8&255]^Fr[n&255]^this.roundkey[T+2],f=Pr[n>>>24]^Ir[i>>>16&255]^Rr[r>>>8&255]^Fr[e&255]^this.roundkey[T+3],e=u,r=l,i=d,n=f;}let m=Re[e>>>24&255]&4278190080^Re[n>>>16&255]&16711680^Re[i>>>8&255]&65280^Re[r>>>0&255]&255^this.roundkey[40],p=Re[r>>>24&255]&4278190080^Re[e>>>16&255]&16711680^Re[n>>>8&255]&65280^Re[i>>>0&255]&255^this.roundkey[41],b=Re[i>>>24&255]&4278190080^Re[r>>>16&255]&16711680^Re[e>>>8&255]&65280^Re[n>>>0&255]&255^this.roundkey[42],y=Re[n>>>24&255]&4278190080^Re[i>>>16&255]&16711680^Re[r>>>8&255]&65280^Re[e>>>0&255]&255^this.roundkey[43];this.outView.setUint32(0,m^this.iv[0],!1),this.outView.setUint32(4,p^this.iv[1],!1),this.outView.setUint32(8,b^this.iv[2],!1),this.outView.setUint32(12,y^this.iv[3],!1),this.iv[0]=s,this.iv[1]=o,this.iv[2]=a,this.iv[3]=c;}};var pn=class t extends vr{constructor(e){super(e),this.moovSlice=null,this.currentTrack=null,this.tracks=[],this.metadataPromise=null,this.movieTimescale=-1,this.movieDurationInTimescale=-1,this.isQuickTime=!1,this.metadataTags={},this.currentMetadataKeys=null,this.isFragmented=!1,this.fragmentTrackDefaults=[],this.psshBoxes=[],this.currentFragment=null,this.lastReadFragment=null,this.decryptionKeyCache=new Map,this.reader=e._reader;}async getTrackBackings(){return await this.readMetadata(),this.tracks.map(e=>e.trackBacking)}async getMimeType(){await this.readMetadata();let e=await this.getTrackBackings(),r=await Promise.all(e.map(i=>i.getDecoderConfig().then(n=>n?.codec??null)));return dn({isQuickTime:this.isQuickTime,hasVideo:this.tracks.some(i=>i.info?.type==="video"),hasAudio:this.tracks.some(i=>i.info?.type==="audio"),codecStrings:r.filter(Boolean)})}async getMetadataTags(){return await this.readMetadata(),this.metadataTags}readMetadata(){return this.metadataPromise??(this.metadataPromise=(async()=>{let e=0,r=!1,i=!1;for(;;){let n=this.reader.requestSliceRange(e,rt,Rt);if(U(n)&&(n=await n),!n)break;let s=e,o=Ft(n);if(!o)break;if(o.name==="ftyp"||o.name==="styp"){let a=Ne(n,4);this.isQuickTime=a==="qt  ";}else if(o.name==="moov"){let a=this.reader.requestSlice(n.filePos,o.contentSize);if(U(a)&&(a=await a),!a)break;this.moovSlice=a,this.readContiguousBoxes(this.moovSlice);for(let c of this.tracks){let u=c.editListPreviousSegmentDurations/this.movieTimescale;c.editListOffset-=Math.round(u*c.timescale);}r=this.isFragmented&&this.reader.fileSize!==null&&this.reader.fileSize>s+o.totalSize,i=!0;break}else if(o.name==="moof"){if(!this.input._initInput)throw new Error('"moof" box encountered with no "moov" box present; this file is likely a Segment as described in ISO/IEC 14496-12 Section 8.16. A separate init file that contains a "moov" box is required to read this file, please provide it using InputOptions.initInput.');await this.copyMetadataFromInitInput(this.input._initInput),r=!1,i=!0;break}e=s+o.totalSize;}if(!i&&this.input._initInput&&await this.copyMetadataFromInitInput(this.input._initInput),r){g(this.reader.fileSize!==null);let n=this.reader.requestSlice(this.reader.fileSize-4,4);U(n)&&(n=await n),g(n);let s=O(n),o=this.reader.fileSize-s;if(o>=0&&o<=this.reader.fileSize-Rt){let a=this.reader.requestSliceRange(o,rt,Rt);if(U(a)&&(a=await a),a){let c=Ft(a);if(c&&c.name==="mfra"){let u=this.reader.requestSlice(a.filePos,c.contentSize);U(u)&&(u=await u),u&&this.readContiguousBoxes(u);}}}}})())}async copyMetadataFromInitInput(e){let r=await e._getDemuxer();if(r.constructor!==t)throw new Error("Init input must match the input's format.");await r.readMetadata(),this.movieTimescale=r.movieTimescale,this.movieDurationInTimescale=r.movieDurationInTimescale,this.metadataTags=r.metadataTags,this.isFragmented=!0,this.fragmentTrackDefaults=r.fragmentTrackDefaults,this.psshBoxes=r.psshBoxes;for(let i of r.tracks){let n={id:i.id,demuxer:this,trackBacking:null,disposition:i.disposition,timescale:i.timescale,durationInMediaTimescale:i.durationInMediaTimescale,durationInMovieTimescale:i.durationInMovieTimescale,rotation:i.rotation,internalCodecId:i.internalCodecId,name:i.name,languageCode:i.languageCode,sampleTableByteOffset:null,sampleTable:null,fragmentLookupTable:[],currentFragmentState:null,fragmentPositionCache:[],editListPreviousSegmentDurations:i.editListPreviousSegmentDurations,editListOffset:i.editListOffset,encryptionInfo:i.encryptionInfo,encryptionAuxInfo:null,frmaCodecString:null,info:i.info};if(i.trackBacking){if(g(n.info),n.info.type==="video"&&n.info.width!==-1){let s=n;n.trackBacking=new wn(s),this.tracks.push(n);}else if(n.info.type==="audio"&&n.info.numberOfChannels!==-1){let s=n;n.trackBacking=new yn(s),this.tracks.push(n);}}}}getSampleTableForTrack(e){if(e.sampleTable)return e.sampleTable;let r={sampleTimingEntries:[],sampleCompositionTimeOffsets:[],sampleSizes:[],keySampleIndices:null,chunkOffsets:[],sampleToChunk:[],presentationTimestamps:null,presentationTimestampIndexMap:null};if(e.sampleTable=r,e.sampleTableByteOffset===null)return r;g(this.moovSlice);let i=this.moovSlice.slice(e.sampleTableByteOffset);if(this.currentTrack=e,this.traverseBox(i),this.currentTrack=null,e.info?.type==="audio"&&e.info.codec&&Se.includes(e.info.codec)&&r.sampleCompositionTimeOffsets.length===0){g(e.info?.type==="audio");let s=Ve(e.info.codec),o=[],a=[];for(let c=0;c<r.sampleToChunk.length;c++){let u=r.sampleToChunk[c],l=r.sampleToChunk[c+1],d=(l?l.startChunkIndex:r.chunkOffsets.length)-u.startChunkIndex;for(let f=0;f<d;f++){let m=u.startSampleIndex+f*u.samplesPerChunk,p=m+u.samplesPerChunk,b=de(r.sampleTimingEntries,m,k=>k.startIndex),y=r.sampleTimingEntries[b],w=de(r.sampleTimingEntries,p,k=>k.startIndex),T=r.sampleTimingEntries[w],A=y.startDecodeTimestamp+(m-y.startIndex)*y.delta,P=T.startDecodeTimestamp+(p-T.startIndex)*T.delta-A,I=ge(o);I&&I.delta===P?I.count++:o.push({startIndex:u.startChunkIndex+f,startDecodeTimestamp:A,count:1,delta:P});let v=u.samplesPerChunk*s.sampleSize*e.info.numberOfChannels;a.push(v);}u.startSampleIndex=u.startChunkIndex,u.samplesPerChunk=1;}r.sampleTimingEntries=o,r.sampleSizes=a;}if(r.sampleCompositionTimeOffsets.length>0){r.presentationTimestamps=[];for(let s of r.sampleTimingEntries)for(let o=0;o<s.count;o++)r.presentationTimestamps.push({presentationTimestamp:s.startDecodeTimestamp+o*s.delta,sampleIndex:s.startIndex+o});for(let s of r.sampleCompositionTimeOffsets)for(let o=0;o<s.count;o++){let a=s.startIndex+o,c=r.presentationTimestamps[a];c&&(c.presentationTimestamp+=s.offset);}r.presentationTimestamps.sort((s,o)=>s.presentationTimestamp-o.presentationTimestamp),r.presentationTimestampIndexMap=Array(r.presentationTimestamps.length).fill(-1);for(let s=0;s<r.presentationTimestamps.length;s++)r.presentationTimestampIndexMap[r.presentationTimestamps[s].sampleIndex]=s;}return r}async readFragment(e){if(this.lastReadFragment?.moofOffset===e)return this.lastReadFragment;let r=this.reader.requestSliceRange(e,rt,Rt);U(r)&&(r=await r),g(r);let i=Ft(r);g(i?.name==="moof");let n=this.reader.requestSlice(e,i.totalSize);U(n)&&(n=await n),g(n),this.traverseBox(n);let s=this.lastReadFragment;g(s&&s.moofOffset===e);for(let[,o]of s.trackData){let a=o.track,{fragmentPositionCache:c}=a;if(!o.startTimestampIsFinal){let l=a.fragmentLookupTable.find(d=>d.moofOffset===s.moofOffset);if(l)bs(o,l.timestamp);else {let d=de(c,s.moofOffset-1,f=>f.moofOffset);if(d!==-1){let f=c[d];bs(o,f.endTimestamp);}}o.startTimestampIsFinal=!0;}let u=de(c,o.startTimestamp,l=>l.startTimestamp);if((u===-1||c[u].moofOffset!==s.moofOffset)&&c.splice(u+1,0,{moofOffset:s.moofOffset,startTimestamp:o.startTimestamp,endTimestamp:o.endTimestamp}),o.encryptionAuxInfo&&a.encryptionInfo){let l=await ya(this.reader,a.encryptionInfo,o.encryptionAuxInfo);for(let d=0;d<Math.min(o.samples.length,l.length);d++){let f=l[d];o.samples[d].encryption=f;}}}return s}readContiguousBoxes(e){let r=e.filePos;for(;e.filePos-r<=e.length-rt&&this.traverseBox(e););}*iterateContiguousBoxes(e){let r=e.filePos;for(;e.filePos-r<=e.length-rt;){let i=e.filePos,n=Ft(e);if(!n)break;yield {boxInfo:n,slice:e},e.filePos=i+n.totalSize;}}traverseBox(e){var o,a,c,u,l,d,f,m,p,b,y,w,T,A,E,P,I,v,k,C,M,q,N,L,ae,G,ie,te,le,ne,se,xe,Te;let r=e.filePos,i=Ft(e);if(!i)return !1;let n=e.filePos,s=r+i.totalSize;switch(i.name){case "mdia":case "minf":case "dinf":case "mfra":case "edts":case "sinf":case "schi":this.readContiguousBoxes(e.slice(n,i.contentSize));break;case "mvhd":{let h=K(e);e.skip(3),h===1?(e.skip(16),this.movieTimescale=O(e),this.movieDurationInTimescale=Be(e)):(e.skip(8),this.movieTimescale=O(e),this.movieDurationInTimescale=O(e));}break;case "trak":{let h={id:-1,demuxer:this,trackBacking:null,disposition:{...ji,primary:!1},info:null,timescale:-1,durationInMovieTimescale:-1,durationInMediaTimescale:-1,rotation:0,internalCodecId:null,name:null,languageCode:qt,sampleTableByteOffset:-1,sampleTable:null,fragmentLookupTable:[],currentFragmentState:null,fragmentPositionCache:[],editListPreviousSegmentDurations:0,editListOffset:0,encryptionInfo:null,encryptionAuxInfo:null,frmaCodecString:null};if(this.currentTrack=h,this.readContiguousBoxes(e.slice(n,i.contentSize)),h.id!==-1&&h.timescale!==-1&&h.info!==null){if(h.info.type==="video"&&h.info.width!==-1){let x=h;h.trackBacking=new wn(x),this.tracks.push(h);}else if(h.info.type==="audio"&&h.info.numberOfChannels!==-1){let x=h;h.trackBacking=new yn(x),this.tracks.push(h);}}this.currentTrack=null;}break;case "tkhd":{let h=this.currentTrack;if(!h)break;let x=K(e),R=!!(Dt(e)&1);if(h.disposition.default=R,x===0)e.skip(8),h.id=O(e),e.skip(4),h.durationInMovieTimescale=O(e);else if(x===1)e.skip(16),h.id=O(e),e.skip(4),h.durationInMovieTimescale=Be(e);else throw new Error(`Incorrect track header version ${x}.`);e.skip(16);let z=[Qt(e),Qt(e),fn(e),Qt(e),Qt(e),fn(e),Qt(e),Qt(e),fn(e)],F=kt(Xr(pl(z),90));g(F===0||F===90||F===180||F===270),h.rotation=F;}break;case "elst":{let h=this.currentTrack;if(!h)break;let x=K(e);e.skip(3);let S=!1,R=0,z=O(e);for(let F=0;F<z;F++){let V=x===1?Be(e):O(e),Q=x===1?Ta(e):Bt(e),X=Qt(e);if(S){$._warn("Unsupported edit list: multiple edits are not currently supported. Only using first edit.");break}if(Q===-1){R+=V;continue}if(X!==1){$._warn("Unsupported edit list entry: media rate must be 1.");break}h.editListPreviousSegmentDurations=R,h.editListOffset=Q,S=!0;}}break;case "mdhd":{let h=this.currentTrack;if(!h)break;let x=K(e);e.skip(3),x===0?(e.skip(8),h.timescale=O(e),h.durationInMediaTimescale=O(e)):x===1&&(e.skip(16),h.timescale=O(e),h.durationInMediaTimescale=Be(e));let S=Pe(e);if(S>0){h.languageCode="";for(let R=0;R<3;R++)h.languageCode=String.fromCharCode(96+(S&31))+h.languageCode,S>>=5;Ct(h.languageCode)||(h.languageCode=qt);}}break;case "hdlr":{let h=this.currentTrack;if(!h)break;e.skip(8);let x=Ne(e,4);x==="vide"?h.info={type:"video",width:-1,height:-1,squarePixelWidth:-1,squarePixelHeight:-1,codec:null,codecDescription:null,colorSpace:{...Oi},avcType:null,avcCodecInfo:null,hevcCodecInfo:null,vp9CodecInfo:null,av1CodecInfo:null,proresCodecInfo:null,proresFormat:null}:x==="soun"&&(h.info={type:"audio",numberOfChannels:-1,sampleRate:-1,codec:null,codecDescription:null,aacCodecInfo:null,dtsFormat:null,pcmLittleEndian:!1,pcmSampleSize:null});}break;case "stbl":{let h=this.currentTrack;if(!h)break;h.sampleTableByteOffset=r,this.readContiguousBoxes(e.slice(n,i.contentSize));}break;case "stsd":{let h=this.currentTrack;if(!h||h.info===null||h.sampleTable)break;let x=K(e);e.skip(3);let S=O(e);for(let R=0;R<S;R++){let z=e.filePos,F=Ft(e);if(!F)break;h.internalCodecId=F.name;let V=F.name.toLowerCase();if(h.info.type==="video"){e.skip(24),h.info.width=Pe(e),h.info.height=Pe(e),h.info.squarePixelWidth=h.info.width,h.info.squarePixelHeight=h.info.height,e.skip(50),h.frmaCodecString=null,this.readContiguousBoxes(e.slice(e.filePos,z+F.totalSize-e.filePos));let Q=V==="encv"?h.frmaCodecString:V;h.frmaCodecString=null,Q==="avc1"||Q==="avc3"?(h.info.codec="avc",h.info.avcType=Q==="avc1"?1:3):Q==="hvc1"||Q==="hev1"?h.info.codec="hevc":Q==="vp08"?h.info.codec="vp8":Q==="vp09"?h.info.codec="vp9":Q==="av01"?h.info.codec="av1":Pt.includes(V)?(h.info.codec="prores",h.info.proresFormat=V):Q===null?$._warn("Unknown encrypted video codec due to missing frma box."):$._warn(`Unsupported video codec (sample entry type '${F.name}').`);}else {e.skip(8);let Q=Pe(e);e.skip(6);let X=Pe(e),Z=Pe(e);e.skip(4);let Ae=O(e)/65536,ye=null;x===0&&Q>0&&(Q===1?(e.skip(4),Z=8*O(e),e.skip(8)):Q===2&&(e.skip(4),Ae=bn(e),X=O(e),e.skip(4),Z=O(e),ye=O(e),e.skip(8))),h.info.numberOfChannels=X,h.info.sampleRate=Ae,h.frmaCodecString=null,this.readContiguousBoxes(e.slice(e.filePos,z+F.totalSize-e.filePos));let H=V==="enca"?h.frmaCodecString:V;if(h.frmaCodecString=null,H!=="mp4a")if(H==="opus")h.info.codec="opus",h.info.sampleRate=cn;else if(H==="flac")h.info.codec="flac";else if(H==="ulaw")h.info.codec="ulaw";else if(H==="alaw")h.info.codec="alaw";else if(H==="ac-3")h.info.codec="ac3";else if(H==="ec-3")h.info.codec="eac3";else if(ci.includes(H))h.info.codec="dts",h.info.dtsFormat=H;else if(H==="twos")Z===8?h.info.codec="pcm-s8":Z===16?h.info.codec=h.info.pcmLittleEndian?"pcm-s16":"pcm-s16be":($._warn(`Unsupported sample size ${Z} for codec 'twos'.`),h.info.codec=null);else if(H==="sowt")Z===8?h.info.codec="pcm-s8":Z===16?h.info.codec="pcm-s16":($._warn(`Unsupported sample size ${Z} for codec 'sowt'.`),h.info.codec=null);else if(H==="raw ")h.info.codec="pcm-u8";else if(H==="in24")h.info.codec=h.info.pcmLittleEndian?"pcm-s24":"pcm-s24be";else if(H==="in32")h.info.codec=h.info.pcmLittleEndian?"pcm-s32":"pcm-s32be";else if(H==="fl32")h.info.codec=h.info.pcmLittleEndian?"pcm-f32":"pcm-f32be";else if(H==="fl64")h.info.codec=h.info.pcmLittleEndian?"pcm-f64":"pcm-f64be";else if(H==="ipcm"){let re=h.info.pcmSampleSize;h.info.pcmLittleEndian?re===16?h.info.codec="pcm-s16":re===24?h.info.codec="pcm-s24":re===32?h.info.codec="pcm-s32":($._warn(`Invalid ipcm sample size ${re}.`),h.info.codec=null):re===16?h.info.codec="pcm-s16be":re===24?h.info.codec="pcm-s24be":re===32?h.info.codec="pcm-s32be":($._warn(`Invalid ipcm sample size ${re}.`),h.info.codec=null);}else if(H==="fpcm"){let re=h.info.pcmSampleSize;h.info.pcmLittleEndian?re===32?h.info.codec="pcm-f32":re===64?h.info.codec="pcm-f64":($._warn(`Invalid fpcm sample size ${re}.`),h.info.codec=null):re===32?h.info.codec="pcm-f32be":re===64?h.info.codec="pcm-f64be":($._warn(`Invalid fpcm sample size ${re}.`),h.info.codec=null);}else if(H==="lpcm"&&ye!==null){let re=Z+7>>3,De=!!(ye&1),At=!!(ye&2),pr=ye&4?-1:0;Z>0&&Z<=64&&(De?Z===32&&(h.info.codec=At?"pcm-f32be":"pcm-f32"):pr&1<<re-1?re===1?h.info.codec="pcm-s8":re===2?h.info.codec=At?"pcm-s16be":"pcm-s16":re===3?h.info.codec=At?"pcm-s24be":"pcm-s24":re===4&&(h.info.codec=At?"pcm-s32be":"pcm-s32"):re===1&&(h.info.codec="pcm-u8")),h.info.codec===null&&$._warn("Unsupported PCM format.");}else H===null?$._warn("Unknown encrypted audio codec due to missing frma box."):$._warn(`Unsupported audio codec (sample entry type '${F.name}').`);}e.filePos=z+F.totalSize;}}break;case "frma":{let h=this.currentTrack;if(!h)break;let S=Ne(e,4).toLowerCase();h.frmaCodecString=S;}break;case "schm":{let h=this.currentTrack;if(!h)break;e.skip(4);let x=Ne(e,4);x==="cenc"||x==="cens"||x==="cbcs"?h.encryptionInfo={scheme:x,defaultKid:null,defaultIsProtected:null,defaultPerSampleIvSize:null,defaultConstantIv:null,defaultCryptByteBlock:null,defaultSkipByteBlock:null}:$._warn(`Unsupported encryption scheme '${x}'.`);}break;case "tenc":{let h=this.currentTrack;if(!h||!h.encryptionInfo)break;let x=K(e);e.skip(3),e.skip(1);let S=K(e);if(x>0?(h.encryptionInfo.defaultCryptByteBlock=S>>4,h.encryptionInfo.defaultSkipByteBlock=S&15):(h.encryptionInfo.defaultCryptByteBlock=0,h.encryptionInfo.defaultSkipByteBlock=0),h.encryptionInfo.defaultIsProtected=K(e)!==0,h.encryptionInfo.defaultPerSampleIvSize=K(e),h.encryptionInfo.defaultKid=Wt(ee(e,16)),h.encryptionInfo.defaultIsProtected&&h.encryptionInfo.defaultPerSampleIvSize===0){let R=K(e),z=new Uint8Array(16);z.set(ee(e,R),0),h.encryptionInfo.defaultConstantIv=z;}}break;case "avcC":{let h=this.currentTrack;if(!h||(g(h.info),i.contentSize===0))break;h.info.codecDescription=ee(e,i.contentSize);}break;case "hvcC":{let h=this.currentTrack;if(!h||(g(h.info),i.contentSize===0))break;h.info.codecDescription=ee(e,i.contentSize);}break;case "vpcC":{let h=this.currentTrack;if(!h)break;g(h.info?.type==="video"),e.skip(4);let x=K(e),S=K(e),R=K(e),z=R>>4,F=R>>1&7,V=R&1,Q=K(e),X=K(e),Z=K(e);h.info.vp9CodecInfo={profile:x,level:S,bitDepth:z,chromaSubsampling:F,videoFullRangeFlag:V,colourPrimaries:Q,transferCharacteristics:X,matrixCoefficients:Z};}break;case "av1C":{let h=this.currentTrack;if(!h)break;g(h.info?.type==="video"),e.skip(1);let x=K(e),S=x>>5,R=x&31,z=K(e),F=z>>7,V=z>>6&1,Q=z>>5&1,X=z>>4&1,Z=z>>3&1,Ae=z>>2&1,ye=z&3,H=S===2&&V?Q?12:10:V?10:8;e.skip(1);let re=ee(e,i.contentSize-4),De=ai(re);h.info.av1CodecInfo={profile:S,level:R,tier:F,bitDepth:H,monochrome:X,chromaSubsamplingX:Z,chromaSubsamplingY:Ae,chromaSamplePosition:ye,videoFullRangeFlag:De?.videoFullRangeFlag??0,colourPrimaries:De?.colourPrimaries??2,transferCharacteristics:De?.transferCharacteristics??2,matrixCoefficients:De?.matrixCoefficients??2};}break;case "colr":{let h=this.currentTrack;if(!h)break;g(h.info?.type==="video");let x=Ne(e,4);if(x!=="nclx"&&x!=="nclc")break;let S=Pe(e),R=Pe(e),z=Pe(e),F;x==="nclx"&&(F=!!(K(e)&128)),h.info.colorSpace={primaries:dt[S],transfer:ft[R],matrix:ht[z],fullRange:F};}break;case "pasp":{let h=this.currentTrack;if(!h)break;g(h.info?.type==="video");let x=O(e),S=O(e);x>0&&S>0&&(x>S?h.info.squarePixelWidth=Math.round(h.info.width*x/S):h.info.squarePixelHeight=Math.round(h.info.height*S/x));}break;case "wave":this.readContiguousBoxes(e.slice(n,i.contentSize));break;case "esds":{let h=this.currentTrack;if(!h||h.info?.type!=="audio")break;e.skip(4);let x=K(e);g(x===3),hn(e),e.skip(2);let S=K(e),R=(S&128)!==0,z=(S&64)!==0,F=(S&32)!==0;if(R&&e.skip(2),z){let Ae=K(e);e.skip(Ae);}F&&e.skip(2);let V=K(e);g(V===4);let Q=hn(e),X=e.filePos,Z=K(e);if(Z===64||Z===103?(h.info.codec="aac",h.info.aacCodecInfo={isMpeg2:Z===103,objectType:null}):Z===105||Z===107?h.info.codec="mp3":Z===221?h.info.codec="vorbis":Z===169?h.info.codec="dts":$._warn(`Unsupported audio codec (objectTypeIndication ${Z}) - discarding track.`),e.skip(12),Q>e.filePos-X){let Ae=K(e);g(Ae===5);let ye=hn(e);if(h.info.codecDescription=ee(e,ye),h.info.codec==="aac"){let H=Ar(h.info.codecDescription);H.outputNumberOfChannels!==null&&(h.info.numberOfChannels=H.outputNumberOfChannels),H.outputSampleRate!==null&&(h.info.sampleRate=H.outputSampleRate);}}}break;case "enda":{let h=this.currentTrack;if(!h)break;g(h.info?.type==="audio"),h.info.pcmLittleEndian=!!(Pe(e)&255);}break;case "pcmC":{let h=this.currentTrack;if(!h)break;g(h.info?.type==="audio"),e.skip(4);let x=K(e);h.info.pcmLittleEndian=!!(x&1),h.info.pcmSampleSize=K(e);}break;case "dOps":{let h=this.currentTrack;if(!h)break;g(h.info?.type==="audio"),e.skip(1);let x=K(e),S=Pe(e),R=O(e),z=ui(e),F=K(e),V;F!==0?V=ee(e,2+x):V=new Uint8Array(0);let Q=new Uint8Array(19+V.byteLength),X=new DataView(Q.buffer);X.setUint32(0,1332770163,!1),X.setUint32(4,1214603620,!1),X.setUint8(8,1),X.setUint8(9,x),X.setUint16(10,S,!0),X.setUint32(12,R,!0),X.setInt16(16,z,!0),X.setUint8(18,F),Q.set(V,19),h.info.codecDescription=Q,h.info.numberOfChannels=x;}break;case "dfLa":{let h=this.currentTrack;if(!h)break;g(h.info?.type==="audio"),e.skip(4);let x=127,S=128,R=e.filePos;for(;e.filePos<s;){let X=K(e),Z=Dt(e);if((X&x)===Gi.STREAMINFO){e.skip(10);let ye=O(e),H=ye>>>12,re=(ye>>9&7)+1;h.info.sampleRate=H,h.info.numberOfChannels=re,e.skip(20);}else e.skip(Z);if(X&S)break}let z=e.filePos;e.filePos=R;let F=ee(e,z-R),V=new Uint8Array(4+F.byteLength);new DataView(V.buffer).setUint32(0,1716281667,!1),V.set(F,4),h.info.codecDescription=V;}break;case "dac3":{let h=this.currentTrack;if(!h)break;g(h.info?.type==="audio");let x=ee(e,3),S=new ue(x),R=S.readBits(2);S.skipBits(8);let z=S.readBits(3),F=S.readBits(1);R<3&&(h.info.sampleRate=ii[R]),h.info.numberOfChannels=gs[z]+F;}break;case "dec3":{let h=this.currentTrack;if(!h)break;g(h.info?.type==="audio");let x=ee(e,i.contentSize),S=Qo(x);if(!S){$._warn("Invalid dec3 box contents, ignoring.");break}let R=Ko(S);R!==null&&(h.info.sampleRate=R),h.info.numberOfChannels=Go(S);}break;case "ddts":{let h=this.currentTrack;if(!h)break;g(h.info?.type==="audio");let x=ee(e,Math.min(i.contentSize,rn)),S=Xo(x);if(!S){$._warn("Invalid ddts box contents, ignoring.");break}h.info.sampleRate=S.sampleRate,S.numberOfChannels!==null&&(h.info.numberOfChannels=S.numberOfChannels);}break;case "stts":{let h=this.currentTrack;if(!h||!h.sampleTable)break;e.skip(4);let x=O(e),S=0,R=0;for(let z=0;z<x;z++){let F=O(e),V=O(e);h.sampleTable.sampleTimingEntries.push({startIndex:S,startDecodeTimestamp:R,count:F,delta:V}),S+=F,R+=F*V;}}break;case "ctts":{let h=this.currentTrack;if(!h||!h.sampleTable)break;e.skip(4);let x=O(e),S=0;for(let R=0;R<x;R++){let z=O(e),F=Bt(e);h.sampleTable.sampleCompositionTimeOffsets.push({startIndex:S,count:z,offset:F}),S+=z;}}break;case "stsz":{let h=this.currentTrack;if(!h||!h.sampleTable)break;e.skip(4);let x=O(e),S=O(e);if(x===0)for(let R=0;R<S;R++){let z=O(e);h.sampleTable.sampleSizes.push(z);}else h.sampleTable.sampleSizes.push(x);}break;case "stz2":{let h=this.currentTrack;if(!h||!h.sampleTable)break;e.skip(4),e.skip(3);let x=K(e),S=O(e),R=ee(e,Math.ceil(S*x/8)),z=new ue(R);for(let F=0;F<S;F++){let V=z.readBits(x);h.sampleTable.sampleSizes.push(V);}}break;case "stss":{let h=this.currentTrack;if(!h||!h.sampleTable)break;e.skip(4),h.sampleTable.keySampleIndices=[];let x=O(e);for(let S=0;S<x;S++){let R=O(e)-1;h.sampleTable.keySampleIndices.push(R);}h.sampleTable.keySampleIndices[0]!==0&&h.sampleTable.keySampleIndices.unshift(0);}break;case "stsc":{let h=this.currentTrack;if(!h||!h.sampleTable)break;e.skip(4);let x=O(e);for(let R=0;R<x;R++){let z=O(e)-1,F=O(e),V=O(e);h.sampleTable.sampleToChunk.push({startSampleIndex:-1,startChunkIndex:z,samplesPerChunk:F,sampleDescriptionIndex:V});}let S=0;for(let R=0;R<h.sampleTable.sampleToChunk.length;R++)if(h.sampleTable.sampleToChunk[R].startSampleIndex=S,R<h.sampleTable.sampleToChunk.length-1){let F=h.sampleTable.sampleToChunk[R+1].startChunkIndex-h.sampleTable.sampleToChunk[R].startChunkIndex;S+=F*h.sampleTable.sampleToChunk[R].samplesPerChunk;}}break;case "stco":{let h=this.currentTrack;if(!h||!h.sampleTable)break;e.skip(4);let x=O(e);for(let S=0;S<x;S++){let R=O(e);h.sampleTable.chunkOffsets.push(R);}}break;case "co64":{let h=this.currentTrack;if(!h||!h.sampleTable)break;e.skip(4);let x=O(e);for(let S=0;S<x;S++){let R=Be(e);h.sampleTable.chunkOffsets.push(R);}}break;case "mvex":this.isFragmented=!0,this.readContiguousBoxes(e.slice(n,i.contentSize));break;case "mehd":{let h=K(e);e.skip(3);let x=h===1?Be(e):O(e);this.movieDurationInTimescale=x;}break;case "trex":{e.skip(4);let h=O(e),x=O(e),S=O(e),R=O(e),z=O(e);this.fragmentTrackDefaults.push({trackId:h,defaultSampleDescriptionIndex:x,defaultSampleDuration:S,defaultSampleSize:R,defaultSampleFlags:z});}break;case "tfra":{let h=K(e);e.skip(3);let x=O(e),S=this.tracks.find(H=>H.id===x);if(!S)break;let R=O(e),z=(R&48)>>4,F=(R&12)>>2,V=R&3,Q=[K,Pe,Dt,O],X=Q[z],Z=Q[F],Ae=Q[V],ye=O(e);for(let H=0;H<ye;H++){let re=h===1?Be(e):O(e),De=h===1?Be(e):O(e);X(e),Z(e),Ae(e),S.fragmentLookupTable.push({timestamp:re,moofOffset:De});}S.fragmentLookupTable.sort((H,re)=>H.timestamp-re.timestamp);for(let H=0;H<S.fragmentLookupTable.length-1;H++){let re=S.fragmentLookupTable[H],De=S.fragmentLookupTable[H+1];re.timestamp===De.timestamp&&(S.fragmentLookupTable.splice(H+1,1),H--);}}break;case "moof":this.currentFragment={moofOffset:r,moofSize:i.totalSize,implicitBaseDataOffset:r,trackData:new Map,psshBoxes:[]},this.readContiguousBoxes(e.slice(n,i.contentSize)),this.lastReadFragment=this.currentFragment,this.currentFragment=null;break;case "traf":if(g(this.currentFragment),this.readContiguousBoxes(e.slice(n,i.contentSize)),this.currentTrack){let h=this.currentFragment.trackData.get(this.currentTrack.id);e:if(h){if(h.samples.length===0){this.currentFragment.trackData.delete(this.currentTrack.id);break e}h.presentationTimestamps=h.samples.map((z,F)=>({presentationTimestamp:z.presentationTimestamp,sampleIndex:F})).sort((z,F)=>z.presentationTimestamp-F.presentationTimestamp);for(let z=0;z<h.presentationTimestamps.length;z++){let F=h.presentationTimestamps[z],V=h.samples[F.sampleIndex];if(h.firstKeyFrameTimestamp===null&&V.isKeyFrame&&(h.firstKeyFrameTimestamp=V.presentationTimestamp),z<h.presentationTimestamps.length-1){let X=h.presentationTimestamps[z+1].presentationTimestamp-F.presentationTimestamp;V.duration=X;}}let x=h.samples[h.presentationTimestamps[0].sampleIndex],S=h.samples[ge(h.presentationTimestamps).sampleIndex];h.startTimestamp=x.presentationTimestamp,h.endTimestamp=S.presentationTimestamp+S.duration;let{currentFragmentState:R}=this.currentTrack;g(R),R.startTimestamp!==null&&(bs(h,R.startTimestamp),h.startTimestampIsFinal=!0),R.encryptionAuxInfo&&!h.samples[0].encryption&&(h.encryptionAuxInfo=R.encryptionAuxInfo);}this.currentTrack.currentFragmentState=null,this.currentTrack=null;}break;case "pssh":{if(this.input._formatOptions.isobmff?._suppressPsshParsing)break;let h=la(ee(e,i.contentSize));this.currentFragment?this.currentFragment.psshBoxes.push(h):this.currentTrack||this.psshBoxes.push(h);}break;case "tfhd":{g(this.currentFragment),e.skip(1);let h=Dt(e),x=!!(h&1),S=!!(h&2),R=!!(h&8),z=!!(h&16),F=!!(h&32),V=!!(h&65536),Q=!!(h&131072),X=O(e),Z=this.tracks.find(ye=>ye.id===X);if(!Z)break;let Ae=this.fragmentTrackDefaults.find(ye=>ye.trackId===X);this.currentTrack=Z,Z.currentFragmentState={baseDataOffset:this.currentFragment.implicitBaseDataOffset,sampleDescriptionIndex:Ae?.defaultSampleDescriptionIndex??null,defaultSampleDuration:Ae?.defaultSampleDuration??null,defaultSampleSize:Ae?.defaultSampleSize??null,defaultSampleFlags:Ae?.defaultSampleFlags??null,startTimestamp:null,encryptionAuxInfo:null},x?Z.currentFragmentState.baseDataOffset=Be(e):Q&&(Z.currentFragmentState.baseDataOffset=this.currentFragment.moofOffset),S&&(Z.currentFragmentState.sampleDescriptionIndex=O(e)),R&&(Z.currentFragmentState.defaultSampleDuration=O(e)),z&&(Z.currentFragmentState.defaultSampleSize=O(e)),F&&(Z.currentFragmentState.defaultSampleFlags=O(e)),V&&(Z.currentFragmentState.defaultSampleDuration=0);}break;case "tfdt":{let h=this.currentTrack;if(!h)break;g(h.currentFragmentState);let x=K(e);e.skip(3);let S=x===0?O(e):Be(e);h.currentFragmentState.startTimestamp=S;}break;case "trun":{let h=this.currentTrack;if(!h)break;g(this.currentFragment),g(h.currentFragmentState);let x=K(e),S=Dt(e),R=!!(S&1),z=!!(S&4),F=!!(S&256),V=!!(S&512),Q=!!(S&1024),X=!!(S&2048),Z=O(e),Ae=null;R&&(Ae=Bt(e));let ye=null;z&&(ye=O(e));let H;this.currentFragment.trackData.has(h.id)?(H=this.currentFragment.trackData.get(h.id),Ae!==null&&(H.currentOffset=h.currentFragmentState.baseDataOffset+Ae)):(H={track:h,currentTimestamp:0,currentOffset:h.currentFragmentState.baseDataOffset+(Ae??0),startTimestamp:0,endTimestamp:0,firstKeyFrameTimestamp:null,samples:[],presentationTimestamps:[],startTimestampIsFinal:!1,encryptionAuxInfo:null},this.currentFragment.trackData.set(h.id,H));for(let re=0;re<Z;re++){let De;F?De=O(e):(g(h.currentFragmentState.defaultSampleDuration!==null),De=h.currentFragmentState.defaultSampleDuration);let At;V?At=O(e):(g(h.currentFragmentState.defaultSampleSize!==null),At=h.currentFragmentState.defaultSampleSize);let pr;Q?pr=O(e):(g(h.currentFragmentState.defaultSampleFlags!==null),pr=h.currentFragmentState.defaultSampleFlags),re===0&&ye!==null&&(pr=ye);let Zn=0;X&&(x===0?Zn=O(e):Zn=Bt(e));let Sc=!(pr&65536);H.samples.push({presentationTimestamp:H.currentTimestamp+Zn,duration:De,byteOffset:H.currentOffset,byteSize:At,isKeyFrame:Sc,encryption:null}),H.currentOffset+=At,H.currentTimestamp+=De;}this.currentFragment.implicitBaseDataOffset=H.currentOffset;}break;case "saiz":{let h=this.currentTrack;if(!h||!h.encryptionInfo)break;if(e.skip(1),Dt(e)&1){let V=Ne(e,4),Q=O(e);if(V!==h.encryptionInfo.scheme||Q!==0)break}let S=K(e),R=O(e),z=null;S===0&&R>0&&(z=ee(e,R));let F=pa(h);F.defaultSampleInfoSize=S,F.sampleSizes=z,F.sampleCount=R;}break;case "saio":{let h=this.currentTrack;if(!h||!h.encryptionInfo)break;let x=K(e);if(Dt(e)&1){let V=Ne(e,4),Q=O(e);if(V!==h.encryptionInfo.scheme||Q!==0)break}let R=O(e);if(R===0)break;R>1&&$._warn("Multiple saio entries are not supported; using the first offset only.");let z=x===0?O(e):Number(Be(e));this.currentFragment&&(z+=this.currentFragment.moofOffset);let F=pa(h);F.offset=z;}break;case "senc":{let h=this.currentTrack;if(!h||!h.encryptionInfo)break;g(this.currentFragment);let x=this.currentFragment.trackData.get(h.id);if(!x)break;e.skip(1);let R=!!(Dt(e)&2),z=O(e),F=h.encryptionInfo.defaultPerSampleIvSize;g(F!==null);for(let V=0;V<Math.min(z,x.samples.length);V++){let Q=new Uint8Array(16);F>0?Q.set(ee(e,F),0):Q.set(h.encryptionInfo.defaultConstantIv,0);let X=null;if(R){let Ae=Pe(e);X=[];for(let ye=0;ye<Ae;ye++){let H=Pe(e),re=O(e);X.push({clearLen:H,protectedLen:re});}}let Z=x.samples[V];Z.encryption={iv:Q,subsamples:X};}}break;case "udta":{let h=this.iterateContiguousBoxes(e.slice(n,i.contentSize));for(let{boxInfo:x,slice:S}of h){if(x.name!=="meta"&&!this.currentTrack){let R=S.filePos;(o=this.metadataTags).raw??(o.raw={}),x.name[0]==="\xA9"?(a=this.metadataTags.raw)[c=x.name]??(a[c]=it(S)):(u=this.metadataTags.raw)[l=x.name]??(u[l]=ee(S,x.contentSize)),S.filePos=R;}switch(x.name){case "meta":S.skip(-x.headerSize),this.traverseBox(S);break;case "\xA9nam":case "name":this.currentTrack?this.currentTrack.name=Ke.decode(ee(S,x.contentSize)):(d=this.metadataTags).title??(d.title=it(S));break;case "\xA9des":this.currentTrack||((f=this.metadataTags).description??(f.description=it(S)));break;case "\xA9ART":this.currentTrack||((m=this.metadataTags).artist??(m.artist=it(S)));break;case "\xA9alb":this.currentTrack||((p=this.metadataTags).album??(p.album=it(S)));break;case "albr":this.currentTrack||((b=this.metadataTags).albumArtist??(b.albumArtist=it(S)));break;case "\xA9gen":this.currentTrack||((y=this.metadataTags).genre??(y.genre=it(S)));break;case "\xA9day":if(!this.currentTrack){let R=new Date(it(S));Number.isNaN(R.getTime())||((w=this.metadataTags).date??(w.date=R));}break;case "\xA9cmt":this.currentTrack||((T=this.metadataTags).comment??(T.comment=it(S)));break;case "\xA9lyr":this.currentTrack||((A=this.metadataTags).lyrics??(A.lyrics=it(S)));break}}}break;case "meta":{if(this.currentTrack)break;let x=O(e)!==0;this.currentMetadataKeys=new Map,x?this.readContiguousBoxes(e.slice(n,i.contentSize)):this.readContiguousBoxes(e.slice(n+4,i.contentSize-4)),this.currentMetadataKeys=null;}break;case "keys":{if(!this.currentMetadataKeys)break;e.skip(4);let h=O(e);for(let x=0;x<h;x++){let S=O(e);e.skip(4);let R=Ke.decode(ee(e,S-8));this.currentMetadataKeys.set(x+1,R);}}break;case "ilst":{if(!this.currentMetadataKeys)break;let h=this.iterateContiguousBoxes(e.slice(n,i.contentSize));for(let{boxInfo:x,slice:S}of h){let R=x.name,z=(R.charCodeAt(0)<<24)+(R.charCodeAt(1)<<16)+(R.charCodeAt(2)<<8)+R.charCodeAt(3);this.currentMetadataKeys.has(z)&&(R=this.currentMetadataKeys.get(z));let F=da(S);switch((E=this.metadataTags).raw??(E.raw={}),(P=this.metadataTags.raw)[R]??(P[R]=F),R){case "\xA9nam":case "titl":case "com.apple.quicktime.title":case "title":typeof F=="string"&&((I=this.metadataTags).title??(I.title=F));break;case "\xA9des":case "desc":case "dscp":case "com.apple.quicktime.description":case "description":typeof F=="string"&&((v=this.metadataTags).description??(v.description=F));break;case "\xA9ART":case "com.apple.quicktime.artist":case "artist":typeof F=="string"&&((k=this.metadataTags).artist??(k.artist=F));break;case "\xA9alb":case "albm":case "com.apple.quicktime.album":case "album":typeof F=="string"&&((C=this.metadataTags).album??(C.album=F));break;case "aART":case "album_artist":typeof F=="string"&&((M=this.metadataTags).albumArtist??(M.albumArtist=F));break;case "\xA9cmt":case "com.apple.quicktime.comment":case "comment":typeof F=="string"&&((q=this.metadataTags).comment??(q.comment=F));break;case "\xA9gen":case "gnre":case "com.apple.quicktime.genre":case "genre":typeof F=="string"&&((N=this.metadataTags).genre??(N.genre=F));break;case "\xA9lyr":case "lyrics":typeof F=="string"&&((L=this.metadataTags).lyrics??(L.lyrics=F));break;case "\xA9day":case "rldt":case "com.apple.quicktime.creationdate":case "date":if(typeof F=="string"){let V=new Date(F);Number.isNaN(V.getTime())||((ae=this.metadataTags).date??(ae.date=V));}break;case "covr":case "com.apple.quicktime.artwork":F instanceof tt?((G=this.metadataTags).images??(G.images=[]),this.metadataTags.images.push({data:F.data,kind:"coverFront",mimeType:F.mimeType})):F instanceof Uint8Array&&((ie=this.metadataTags).images??(ie.images=[]),this.metadataTags.images.push({data:F,kind:"coverFront",mimeType:"image/*"}));break;case "track":if(typeof F=="string"){let V=F.split("/"),Q=Number.parseInt(V[0],10),X=V[1]&&Number.parseInt(V[1],10);Number.isInteger(Q)&&Q>0&&((te=this.metadataTags).trackNumber??(te.trackNumber=Q)),X&&Number.isInteger(X)&&X>0&&((le=this.metadataTags).tracksTotal??(le.tracksTotal=X));}break;case "trkn":if(F instanceof Uint8Array&&F.length>=6){let V=oe(F),Q=V.getUint16(2,!1),X=V.getUint16(4,!1);Q>0&&((ne=this.metadataTags).trackNumber??(ne.trackNumber=Q)),X>0&&((se=this.metadataTags).tracksTotal??(se.tracksTotal=X));}break;case "disc":case "disk":if(F instanceof Uint8Array&&F.length>=6){let V=oe(F),Q=V.getUint16(2,!1),X=V.getUint16(4,!1);Q>0&&((xe=this.metadataTags).discNumber??(xe.discNumber=Q)),X>0&&((Te=this.metadataTags).discsTotal??(Te.discsTotal=X));}break}}}break}return e.filePos=s,!0}},gn=class{constructor(e){this.internalTrack=e,this.packetToSampleIndex=new WeakMap,this.packetToFragmentLocation=new WeakMap;}getId(){return this.internalTrack.id}getNumber(){let e=this.internalTrack.demuxer,r=this.internalTrack.trackBacking.getType(),i=0;for(let n of e.tracks)if(n.trackBacking.getType()===r&&i++,n===this.internalTrack)break;return i}getCodec(){throw new Error("Not implemented on base class.")}getInternalCodecId(){return this.internalTrack.internalCodecId}getName(){return this.internalTrack.name}getLanguageCode(){return this.internalTrack.languageCode}getTimeResolution(){return this.internalTrack.timescale}isRelativeToUnixEpoch(){return !1}getUnixTimeForTimestamp(){return null}getDisposition(){return this.internalTrack.disposition}getPairingMask(){return 1n}getBitrate(){return null}getAverageBitrate(){return null}async getDurationFromMetadata(){let e=this.internalTrack;return e.durationInMediaTimescale<=0?null:(g(e.trackBacking),((await e.trackBacking.getFirstPacket({metadataOnly:!0}))?.timestamp??0)+e.durationInMediaTimescale/e.timescale)}async getLiveRefreshInterval(){return null}async getFirstPacket(e){let r=await this.fetchPacketForSampleIndex(0,e);return r||!this.internalTrack.demuxer.isFragmented?r:this.performFragmentedLookup(null,i=>i.trackData.get(this.internalTrack.id)?{sampleIndex:0,correctSampleFound:!0}:{sampleIndex:-1,correctSampleFound:!1},-1/0,1/0,e)}mapTimestampIntoTimescale(e){return Ui(e*this.internalTrack.timescale)+this.internalTrack.editListOffset}async getPacket(e,r){let i=this.mapTimestampIntoTimescale(e),n=this.internalTrack.demuxer.getSampleTableForTrack(this.internalTrack),s=Ts(n,i),o=await this.fetchPacketForSampleIndex(s,r);return !ma(n)||!this.internalTrack.demuxer.isFragmented?o:this.performFragmentedLookup(null,a=>{let c=a.trackData.get(this.internalTrack.id);if(!c)return {sampleIndex:-1,correctSampleFound:!1};let u=de(c.presentationTimestamps,i,f=>f.presentationTimestamp),l=u!==-1?c.presentationTimestamps[u].sampleIndex:-1,d=u!==-1&&i<c.endTimestamp;return {sampleIndex:l,correctSampleFound:d}},i,i,r)}async getNextPacket(e,r){let i=this.packetToSampleIndex.get(e);if(i!==void 0)return this.fetchPacketForSampleIndex(i+1,r);let n=this.packetToFragmentLocation.get(e);if(n===void 0)throw new Error("Packet was not created from this track.");return this.performFragmentedLookup(n.fragment,s=>{if(s===n.fragment){let o=s.trackData.get(this.internalTrack.id);if(n.sampleIndex+1<o.samples.length)return {sampleIndex:n.sampleIndex+1,correctSampleFound:!0}}else if(s.trackData.get(this.internalTrack.id))return {sampleIndex:0,correctSampleFound:!0};return {sampleIndex:-1,correctSampleFound:!1}},-1/0,1/0,r)}async getKeyPacket(e,r){let i=this.mapTimestampIntoTimescale(e),n=this.internalTrack.demuxer.getSampleTableForTrack(this.internalTrack),s=fl(n,i),o=await this.fetchPacketForSampleIndex(s,r);return !ma(n)||!this.internalTrack.demuxer.isFragmented?o:this.performFragmentedLookup(null,a=>{let c=a.trackData.get(this.internalTrack.id);if(!c)return {sampleIndex:-1,correctSampleFound:!1};let u=zi(c.presentationTimestamps,f=>c.samples[f.sampleIndex].isKeyFrame&&f.presentationTimestamp<=i),l=u!==-1?c.presentationTimestamps[u].sampleIndex:-1,d=u!==-1&&i<c.endTimestamp;return {sampleIndex:l,correctSampleFound:d}},i,i,r)}async getNextKeyPacket(e,r){let i=this.packetToSampleIndex.get(e);if(i!==void 0){let s=this.internalTrack.demuxer.getSampleTableForTrack(this.internalTrack),o=ml(s,i);return this.fetchPacketForSampleIndex(o,r)}let n=this.packetToFragmentLocation.get(e);if(n===void 0)throw new Error("Packet was not created from this track.");return this.performFragmentedLookup(n.fragment,s=>{if(s===n.fragment){let a=s.trackData.get(this.internalTrack.id).samples.findIndex((c,u)=>c.isKeyFrame&&u>n.sampleIndex);if(a!==-1)return {sampleIndex:a,correctSampleFound:!0}}else {let o=s.trackData.get(this.internalTrack.id);if(o&&o.firstKeyFrameTimestamp!==null){let a=o.samples.findIndex(c=>c.isKeyFrame);return g(a!==-1),{sampleIndex:a,correctSampleFound:!0}}}return {sampleIndex:-1,correctSampleFound:!1}},-1/0,1/0,r)}async fetchPacketForSampleIndex(e,r){if(e===-1)return null;let i=this.internalTrack.demuxer.getSampleTableForTrack(this.internalTrack),n=hl(i,e);if(!n)return null;let s;if(r.metadataOnly)s=jt;else {let u=this.internalTrack.demuxer.reader.requestSlice(n.sampleOffset,n.sampleSize);if(U(u)&&(u=await u),!u)return null;if(s=ee(u,n.sampleSize),this.internalTrack.encryptionInfo){let l=null;if(this.internalTrack.encryptionAuxInfo){let d=await ya(this.internalTrack.demuxer.reader,this.internalTrack.encryptionInfo,this.internalTrack.encryptionAuxInfo);e<d.length&&(l=d[e]);}l??(l=ga(this.internalTrack.encryptionInfo)),l&&(s=await wa(this.internalTrack,l,s,null));}}let o=(n.presentationTimestamp-this.internalTrack.editListOffset)/this.internalTrack.timescale,a=n.duration/this.internalTrack.timescale,c=new me(s,n.isKeyFrame?"key":"delta",o,a,e,n.sampleSize);return this.packetToSampleIndex.set(c,e),c}async fetchPacketInFragment(e,r,i){if(r===-1)return null;let s=e.trackData.get(this.internalTrack.id).samples[r];g(s);let o;if(i.metadataOnly)o=jt;else {let l=this.internalTrack.demuxer.reader.requestSlice(s.byteOffset,s.byteSize);if(U(l)&&(l=await l),!l)return null;if(o=ee(l,s.byteSize),this.internalTrack.encryptionInfo){let d=s.encryption??ga(this.internalTrack.encryptionInfo);d&&(o=await wa(this.internalTrack,d,o,e));}}let a=(s.presentationTimestamp-this.internalTrack.editListOffset)/this.internalTrack.timescale,c=s.duration/this.internalTrack.timescale,u=new me(o,s.isKeyFrame?"key":"delta",a,c,e.moofOffset+r,s.byteSize);return this.packetToFragmentLocation.set(u,{fragment:e,sampleIndex:r}),u}async performFragmentedLookup(e,r,i,n,s){let o=this.internalTrack.demuxer,a=null,c=null,u=-1;if(e){let{sampleIndex:y,correctSampleFound:w}=r(e);if(w)return this.fetchPacketInFragment(e,y,s);y!==-1&&(c=e,u=y);}let l=de(this.internalTrack.fragmentLookupTable,i,y=>y.timestamp),d=l!==-1?this.internalTrack.fragmentLookupTable[l]:null,f=de(this.internalTrack.fragmentPositionCache,i,y=>y.startTimestamp),m=f!==-1?this.internalTrack.fragmentPositionCache[f]:null,p=Math.max(d?.moofOffset??0,m?.moofOffset??0)||null,b;for(e?p===null||e.moofOffset>=p?(b=e.moofOffset+e.moofSize,a=e):b=p:b=p??0;;){if(a){let A=a.trackData.get(this.internalTrack.id);if(A&&A.startTimestamp>n)break}let y=o.reader.requestSliceRange(b,rt,Rt);if(U(y)&&(y=await y),!y)break;let w=b,T=Ft(y);if(!T)break;if(T.name==="moof"){a=await o.readFragment(w);let{sampleIndex:A,correctSampleFound:E}=r(a);if(E)return this.fetchPacketInFragment(a,A,s);A!==-1&&(c=a,u=A);}b=w+T.totalSize;}if(d&&(!c||c.moofOffset<d.moofOffset)){let y=this.internalTrack.fragmentLookupTable[l-1];g(!y||y.timestamp<d.timestamp);let w=y?.timestamp??-1/0;return this.performFragmentedLookup(null,r,w,n,s)}return c?this.fetchPacketInFragment(c,u,s):null}},wn=class extends gn{constructor(e){super(e),this.decoderConfigPromise=null,this.internalTrack=e;}getType(){return "video"}getCodec(){return this.internalTrack.info.codec}getCodedWidth(){return this.internalTrack.info.width}getCodedHeight(){return this.internalTrack.info.height}getSquarePixelWidth(){return this.internalTrack.info.squarePixelWidth}getSquarePixelHeight(){return this.internalTrack.info.squarePixelHeight}getRotation(){return this.internalTrack.rotation}async getColorSpace(){let e=await this.getDecoderConfig();return e?{primaries:e.colorSpace?.primaries,transfer:e.colorSpace?.transfer,matrix:e.colorSpace?.matrix,fullRange:e.colorSpace?.fullRange}:this.internalTrack.info.colorSpace}async canBeTransparent(){return this.internalTrack.info.codec==="prores"&&(this.internalTrack.info.proresFormat==="ap4h"||this.internalTrack.info.proresFormat==="ap4x")}async getDecoderConfig(){return this.internalTrack.info.codec?this.decoderConfigPromise??(this.decoderConfigPromise=(async()=>{var r,i,n,s;if(this.internalTrack.info.codec==="avc"&&!this.internalTrack.info.codecDescription){let o=await this.getFirstPacket({});this.internalTrack.info.avcCodecInfo=o&&xr(o.data);}else if(this.internalTrack.info.codec==="hevc"&&!this.internalTrack.info.codecDescription){let o=await this.getFirstPacket({});this.internalTrack.info.hevcCodecInfo=o&&Cr(o.data);}else if(this.internalTrack.info.codec==="vp9"&&(!this.internalTrack.info.vp9CodecInfo||!No(this.internalTrack.info.vp9CodecInfo))){let o=await this.getFirstPacket({}),a=o&&en(o.data);a&&(this.internalTrack.info.vp9CodecInfo={...this.internalTrack.info.vp9CodecInfo??a,videoFullRangeFlag:a.videoFullRangeFlag,colourPrimaries:a.colourPrimaries,transferCharacteristics:a.transferCharacteristics,matrixCoefficients:a.matrixCoefficients});}else if(this.internalTrack.info.codec==="av1"&&(!this.internalTrack.info.av1CodecInfo||!qo(this.internalTrack.info.av1CodecInfo))){let o=await this.getFirstPacket({}),a=o&&ai(o.data);a&&(this.internalTrack.info.av1CodecInfo=a);}else if(this.internalTrack.info.codec==="prores"&&!this.internalTrack.info.proresCodecInfo){let o=await this.getFirstPacket({});this.internalTrack.info.proresCodecInfo=o&&tn(o.data);}if(!wr(this.internalTrack.info.colorSpace)){let o=on(this.internalTrack.info);(r=this.internalTrack.info.colorSpace).primaries??(r.primaries=o.primaries),(i=this.internalTrack.info.colorSpace).transfer??(i.transfer=o.transfer),(n=this.internalTrack.info.colorSpace).matrix??(n.matrix=o.matrix),(s=this.internalTrack.info.colorSpace).fullRange??(s.fullRange=o.fullRange);}let e={codec:sn(this.internalTrack.info),codedWidth:this.internalTrack.info.width,codedHeight:this.internalTrack.info.height,description:this.internalTrack.info.codecDescription??void 0,colorSpace:this.internalTrack.info.colorSpace};return (this.internalTrack.info.width!==this.internalTrack.info.squarePixelWidth||this.internalTrack.info.height!==this.internalTrack.info.squarePixelHeight)&&(e.displayAspectWidth=this.internalTrack.info.squarePixelWidth,e.displayAspectHeight=this.internalTrack.info.squarePixelHeight),e})()):null}},yn=class extends gn{constructor(e){super(e),this.decoderConfigPromise=null,this.internalTrack=e;}getType(){return "audio"}getCodec(){return this.internalTrack.info.codec}getNumberOfChannels(){return this.internalTrack.info.numberOfChannels}getSampleRate(){return this.internalTrack.info.sampleRate}async getDecoderConfig(){return this.internalTrack.info.codec?this.decoderConfigPromise??(this.decoderConfigPromise=(async()=>{if(this.internalTrack.info.codec==="dts"&&!this.internalTrack.info.dtsFormat){let e=await this.getFirstPacket({});this.internalTrack.info.dtsFormat=e&&nn(e.data);}return {codec:an(this.internalTrack.info),numberOfChannels:this.internalTrack.info.numberOfChannels,sampleRate:this.internalTrack.info.sampleRate,description:this.internalTrack.info.codecDescription??void 0}})()):null}},Ts=(t,e)=>{if(t.presentationTimestamps){let r=de(t.presentationTimestamps,e,i=>i.presentationTimestamp);return r===-1?-1:t.presentationTimestamps[r].sampleIndex}else {let r=de(t.sampleTimingEntries,e,n=>n.startDecodeTimestamp);if(r===-1)return -1;let i=t.sampleTimingEntries[r];return i.startIndex+Math.min(Math.floor((e-i.startDecodeTimestamp)/i.delta),i.count-1)}},fl=(t,e)=>{if(!t.keySampleIndices)return Ts(t,e);if(t.presentationTimestamps){let r=de(t.presentationTimestamps,e,i=>i.presentationTimestamp);if(r===-1)return -1;for(let i=r;i>=0;i--){let n=t.presentationTimestamps[i].sampleIndex;if(ns(t.keySampleIndices,n,o=>o)!==-1)return n}return -1}else {let r=Ts(t,e),i=de(t.keySampleIndices,r,n=>n);return t.keySampleIndices[i]??-1}},hl=(t,e)=>{let r=de(t.sampleTimingEntries,e,w=>w.startIndex),i=t.sampleTimingEntries[r];if(!i||i.startIndex+i.count<=e)return null;let s=i.startDecodeTimestamp+(e-i.startIndex)*i.delta,o=de(t.sampleCompositionTimeOffsets,e,w=>w.startIndex),a=t.sampleCompositionTimeOffsets[o];a&&e-a.startIndex<a.count&&(s+=a.offset);let c=t.sampleSizes[Math.min(e,t.sampleSizes.length-1)],u=de(t.sampleToChunk,e,w=>w.startSampleIndex),l=t.sampleToChunk[u];g(l);let d=l.startChunkIndex+Math.floor((e-l.startSampleIndex)/l.samplesPerChunk),f=t.chunkOffsets[d],m=l.startSampleIndex+(d-l.startChunkIndex)*l.samplesPerChunk,p=0,b=f;if(t.sampleSizes.length===1)b+=c*(e-m),p+=c*l.samplesPerChunk;else for(let w=m;w<m+l.samplesPerChunk;w++){let T=t.sampleSizes[w];w<e&&(b+=T),p+=T;}let y=i.delta;if(t.presentationTimestamps){let w=t.presentationTimestampIndexMap[e];g(w!==void 0),w<t.presentationTimestamps.length-1&&(y=t.presentationTimestamps[w+1].presentationTimestamp-s);}return {presentationTimestamp:s,duration:y,sampleOffset:b,sampleSize:c,chunkOffset:f,chunkSize:p,isKeyFrame:t.keySampleIndices?ns(t.keySampleIndices,e,w=>w)!==-1:!0}},ml=(t,e)=>{if(!t.keySampleIndices)return e+1;let r=de(t.keySampleIndices,e,i=>i);return t.keySampleIndices[r+1]??-1},bs=(t,e)=>{t.startTimestamp+=e,t.endTimestamp+=e;for(let r of t.samples)r.presentationTimestamp+=e;for(let r of t.presentationTimestamps)r.presentationTimestamp+=e;},pl=t=>{let[e,r]=t,i=Math.atan2(r,e);return Number.isFinite(i)?i*(180/Math.PI):0},ma=t=>t.sampleSizes.length===0,pa=t=>{var e;return t.currentFragmentState?(e=t.currentFragmentState).encryptionAuxInfo??(e.encryptionAuxInfo={defaultSampleInfoSize:0,sampleSizes:null,sampleCount:0,offset:null,resolved:null}):t.encryptionAuxInfo??(t.encryptionAuxInfo={defaultSampleInfoSize:0,sampleSizes:null,sampleCount:0,offset:null,resolved:null})},ya=async(t,e,r)=>{if(r.resolved)return r.resolved;if(r.offset===null||r.sampleCount===0)throw new Error("Incomplete saiz/saio info; cannot resolve encryption data.");let i=0;if(r.defaultSampleInfoSize>0)i=r.defaultSampleInfoSize*r.sampleCount;else {g(r.sampleSizes);for(let a=0;a<r.sampleCount;a++)i+=r.sampleSizes[a];}let n=t.requestSlice(r.offset,i);if(U(n)&&(n=await n),!n)throw new Error("Failed to read auxiliary encryption info.");let s=e.defaultPerSampleIvSize;g(s!==null);let o=[];for(let a=0;a<r.sampleCount;a++){let c=r.defaultSampleInfoSize>0?r.defaultSampleInfoSize:r.sampleSizes[a],u=new Uint8Array(16);s>0?u.set(ee(n,s),0):u.set(e.defaultConstantIv,0);let l=null;if(c>s){let d=Pe(n);l=[];for(let f=0;f<d;f++){let m=Pe(n),p=O(n);l.push({clearLen:m,protectedLen:p});}}o.push({iv:u,subsamples:l});}return r.resolved=o,o},ga=t=>t.defaultConstantIv?{iv:t.defaultConstantIv,subsamples:null}:null,wa=async(t,e,r,i)=>{g(t.encryptionInfo);let n=t.encryptionInfo;g(n.defaultKid!==null);let s=n.defaultKid,o,a=t.demuxer.decryptionKeyCache.get(s);if(a)o=await a;else {if(!t.demuxer.input._formatOptions.isobmff?.resolveKeyId)throw new Error("Encrypted media samples encountered. To decrypt them, please provide a callback for InputOptions.formatOptions.isobmff.resolveKeyId.");let c=(async()=>{let u=t.demuxer.psshBoxes;if(i){u=[...u,...i.psshBoxes].filter(d=>d.keyIds===null||d.keyIds.includes(s));for(let d=0;d<u.length-1;d++)for(let f=d+1;f<u.length;f++)ua(u[d],u[f])&&(u.splice(f,1),f--);}let l=await t.demuxer.input._formatOptions.isobmff.resolveKeyId({keyId:s,psshBoxes:u});if(!(typeof l=="string"&&l.length===32&&go.test(l)||l instanceof Uint8Array&&l.byteLength===16))throw new TypeError("resolveKeyId must return a 32-character hex string or a 16-byte Uint8Array containing the decryption key.");return l instanceof Uint8Array?l:wo(l)})();t.demuxer.decryptionKeyCache.set(s,c),o=await c;}return n.scheme==="cenc"||n.scheme==="cens"?gl(o,n,e,r):wl(o,n,e,r)},gl=async(t,e,r,i)=>{let n=new Uint8Array(16);n.set(r.iv,0);let s=await crypto.subtle.importKey("raw",t,{name:"AES-CTR"},!1,["decrypt"]),o=async p=>{let b=await crypto.subtle.decrypt({name:"AES-CTR",counter:n,length:64},s,p);return new Uint8Array(b)};if(!r.subsamples)return o(i);g(e.defaultCryptByteBlock!==null&&e.defaultSkipByteBlock!==null);let a=ba(r.subsamples,e.defaultCryptByteBlock,e.defaultSkipByteBlock),c=0;for(let p of a)for(let b of p.perSubsample)c+=b.length;let u=new Uint8Array(c),l=0;for(let p of a)for(let b of p.perSubsample)u.set(i.subarray(b.offset,b.offset+b.length),l),l+=b.length;let d=await o(u),f=new Uint8Array(i),m=0;for(let p of a)for(let b of p.perSubsample)f.set(d.subarray(m,m+b.length),b.offset),m+=b.length;return f},wl=(t,e,r,i)=>{let n=new mn;n.init({key:t,iv:r.iv});let s=e.defaultCryptByteBlock,o=e.defaultSkipByteBlock;if(g(s!==null&&o!==null),!r.subsamples){let l=new Uint8Array(i),d=Math.floor(i.length/16);for(let f=0;f<d;f++){let m=f*16;n.in.set(i.subarray(m,m+16)),n.decrypt(),l.set(n.out,m);}return l}if(s===0&&o===0)throw new Error("cbcs with subsamples requires pattern encryption.");let a=new Uint8Array(i),c=ba(r.subsamples,s,o),u=new DataView(r.iv.buffer,r.iv.byteOffset,16);for(let l of c){n.iv[0]=u.getUint32(0,!1),n.iv[1]=u.getUint32(4,!1),n.iv[2]=u.getUint32(8,!1),n.iv[3]=u.getUint32(12,!1);for(let d of l.perSubsample){let f=d.length/16;for(let m=0;m<f;m++){let p=d.offset+m*16;n.in.set(i.subarray(p,p+16)),n.decrypt(),a.set(n.out,p);}}}return a},ba=(t,e,r)=>{let i=[],n=e!==0||r!==0,s=0;for(let o of t){s+=o.clearLen;let a=[];if(!n)o.protectedLen>0&&a.push({offset:s,length:o.protectedLen}),s+=o.protectedLen;else {let c=o.protectedLen,u=s;for(;c>0&&!(c<16*e);){let l=16*e;a.push({offset:u,length:l}),u+=l,c-=l;let d=Math.min(16*r,c);u+=d,c-=d;}s+=o.protectedLen;}i.push({perSubsample:a});}return i};var _;(function(t){t[t.EBML=440786851]="EBML",t[t.EBMLVersion=17030]="EBMLVersion",t[t.EBMLReadVersion=17143]="EBMLReadVersion",t[t.EBMLMaxIDLength=17138]="EBMLMaxIDLength",t[t.EBMLMaxSizeLength=17139]="EBMLMaxSizeLength",t[t.DocType=17026]="DocType",t[t.DocTypeVersion=17031]="DocTypeVersion",t[t.DocTypeReadVersion=17029]="DocTypeReadVersion",t[t.Void=236]="Void",t[t.Segment=408125543]="Segment",t[t.SeekHead=290298740]="SeekHead",t[t.Seek=19899]="Seek",t[t.SeekID=21419]="SeekID",t[t.SeekPosition=21420]="SeekPosition",t[t.Duration=17545]="Duration",t[t.Info=357149030]="Info",t[t.TimestampScale=2807729]="TimestampScale",t[t.MuxingApp=19840]="MuxingApp",t[t.WritingApp=22337]="WritingApp",t[t.Tracks=374648427]="Tracks",t[t.TrackEntry=174]="TrackEntry",t[t.TrackNumber=215]="TrackNumber",t[t.TrackUID=29637]="TrackUID",t[t.TrackType=131]="TrackType",t[t.FlagEnabled=185]="FlagEnabled",t[t.FlagDefault=136]="FlagDefault",t[t.FlagForced=21930]="FlagForced",t[t.FlagOriginal=21934]="FlagOriginal",t[t.FlagHearingImpaired=21931]="FlagHearingImpaired",t[t.FlagVisualImpaired=21932]="FlagVisualImpaired",t[t.FlagCommentary=21935]="FlagCommentary",t[t.FlagLacing=156]="FlagLacing",t[t.Name=21358]="Name",t[t.Language=2274716]="Language",t[t.LanguageBCP47=2274717]="LanguageBCP47",t[t.CodecID=134]="CodecID",t[t.CodecPrivate=25506]="CodecPrivate",t[t.CodecDelay=22186]="CodecDelay",t[t.SeekPreRoll=22203]="SeekPreRoll",t[t.DefaultDuration=2352003]="DefaultDuration",t[t.Video=224]="Video",t[t.PixelWidth=176]="PixelWidth",t[t.PixelHeight=186]="PixelHeight",t[t.DisplayWidth=21680]="DisplayWidth",t[t.DisplayHeight=21690]="DisplayHeight",t[t.DisplayUnit=21682]="DisplayUnit",t[t.AlphaMode=21440]="AlphaMode",t[t.Audio=225]="Audio",t[t.SamplingFrequency=181]="SamplingFrequency",t[t.Channels=159]="Channels",t[t.BitDepth=25188]="BitDepth",t[t.SimpleBlock=163]="SimpleBlock",t[t.BlockGroup=160]="BlockGroup",t[t.Block=161]="Block",t[t.BlockAdditions=30113]="BlockAdditions",t[t.BlockMore=166]="BlockMore",t[t.BlockAdditional=165]="BlockAdditional",t[t.BlockAddID=238]="BlockAddID",t[t.BlockDuration=155]="BlockDuration",t[t.ReferenceBlock=251]="ReferenceBlock",t[t.Cluster=524531317]="Cluster",t[t.Timestamp=231]="Timestamp",t[t.Cues=475249515]="Cues",t[t.CuePoint=187]="CuePoint",t[t.CueTime=179]="CueTime",t[t.CueTrackPositions=183]="CueTrackPositions",t[t.CueTrack=247]="CueTrack",t[t.CueClusterPosition=241]="CueClusterPosition",t[t.Colour=21936]="Colour",t[t.MatrixCoefficients=21937]="MatrixCoefficients",t[t.TransferCharacteristics=21946]="TransferCharacteristics",t[t.Primaries=21947]="Primaries",t[t.Range=21945]="Range",t[t.Projection=30320]="Projection",t[t.ProjectionType=30321]="ProjectionType",t[t.ProjectionPoseRoll=30325]="ProjectionPoseRoll",t[t.Attachments=423732329]="Attachments",t[t.AttachedFile=24999]="AttachedFile",t[t.FileDescription=18046]="FileDescription",t[t.FileName=18030]="FileName",t[t.FileMediaType=18016]="FileMediaType",t[t.FileData=18012]="FileData",t[t.FileUID=18094]="FileUID",t[t.Chapters=272869232]="Chapters",t[t.Tags=307544935]="Tags",t[t.Tag=29555]="Tag",t[t.Targets=25536]="Targets",t[t.TargetTypeValue=26826]="TargetTypeValue",t[t.TargetType=25546]="TargetType",t[t.TagTrackUID=25541]="TagTrackUID",t[t.TagEditionUID=25545]="TagEditionUID",t[t.TagChapterUID=25540]="TagChapterUID",t[t.TagAttachmentUID=25542]="TagAttachmentUID",t[t.SimpleTag=26568]="SimpleTag",t[t.TagName=17827]="TagName",t[t.TagLanguage=17530]="TagLanguage",t[t.TagString=17543]="TagString",t[t.TagBinary=17541]="TagBinary",t[t.ContentEncodings=28032]="ContentEncodings",t[t.ContentEncoding=25152]="ContentEncoding",t[t.ContentEncodingOrder=20529]="ContentEncodingOrder",t[t.ContentEncodingScope=20530]="ContentEncodingScope",t[t.ContentCompression=20532]="ContentCompression",t[t.ContentCompAlgo=16980]="ContentCompAlgo",t[t.ContentCompSettings=16981]="ContentCompSettings",t[t.ContentEncryption=20533]="ContentEncryption";})(_||(_={}));var yl=[_.EBML,_.Segment],Br=[_.SeekHead,_.Info,_.Cluster,_.Tracks,_.Cues,_.Attachments,_.Chapters,_.Tags],di=[...yl,...Br];var As=8,We=2,nt=2*As,ks=t=>{if(t.remainingLength<1)return null;let e=K(t);if(t.skip(-1),e===0)return null;let r=1,i=128;for(;(e&i)===0;)r++,i>>=1;return t.remainingLength<r?null:r},Mr=t=>{if(t.remainingLength<1)return null;let e=K(t);if(e===0)return null;let r=1,i=128;for(;(e&i)===0;)r++,i>>=1;if(t.remainingLength<r-1)return null;let n=e&i-1;for(let s=1;s<r;s++)n*=256,n+=K(t);return n},Y=(t,e)=>{if(e<1||e>8)throw new Error("Bad unsigned int size "+e);let r=0;for(let i=0;i<e;i++)r*=256,r+=K(t);return r},Aa=(t,e)=>{if(e<1)throw new Error("Bad unsigned int size "+e);let r=0n;for(let i=0;i<e;i++)r<<=8n,r+=BigInt(K(t));return r};var Tn=t=>{let e=ks(t);return e===null||t.remainingLength<e?null:Y(t,e)},Ss=t=>{if(t.remainingLength<1)return null;if(K(t)===255)return;t.skip(-1);let r=Mr(t);if(r===null)return null;if(r!==72057594037927940)return r},st=t=>{g(t.remainingLength>=We);let e=Tn(t);if(e===null)return null;let r=Ss(t);return r===null?null:{id:e,size:r}},Kt=(t,e)=>{let r=ee(t,e),i=0;for(;i<e&&r[i]!==0;)i+=1;return String.fromCharCode(...r.subarray(0,i))},Dr=(t,e)=>{let r=ee(t,e),i=0;for(;i<e&&r[i]!==0;)i+=1;return Ke.decode(r.subarray(0,i))},An=(t,e)=>{if(e===0)return 0;if(e!==4&&e!==8)throw new Error("Bad float size "+e);return e===4?ka(t):bn(t)},kn=async(t,e,r,i)=>{let n=new Set(r),s=e;for(;i===null||s<i;){let o=t.requestSliceRange(s,We,nt);if(U(o)&&(o=await o),!o)break;let a=st(o);if(!a)break;if(n.has(a.id))return {pos:s,found:!0};Ot(a.size),s=o.filePos+a.size;}return {pos:i!==null&&i>s?i:s,found:!1}},xs=async(t,e,r,i)=>{let s=new Set(r),o=e;for(;o<i;){let a=t.requestSliceRange(o,0,Math.min(65536,i-o));if(U(a)&&(a=await a),!a||a.length<As)break;for(let c=0;c<a.length-As;c++){a.filePos=o;let u=Tn(a);if(u!==null&&s.has(u))return o;o++;}}return null},ze={avc:"V_MPEG4/ISO/AVC",hevc:"V_MPEGH/ISO/HEVC",vp8:"V_VP8",vp9:"V_VP9",av1:"V_AV1",prores:"V_PRORES",aac:"A_AAC",mp3:"A_MPEG/L3",opus:"A_OPUS",vorbis:"A_VORBIS",flac:"A_FLAC",ac3:"A_AC3",eac3:"A_EAC3",dts:"A_DTS","pcm-u8":"A_PCM/INT/LIT","pcm-s16":"A_PCM/INT/LIT","pcm-s16be":"A_PCM/INT/BIG","pcm-s24":"A_PCM/INT/LIT","pcm-s24be":"A_PCM/INT/BIG","pcm-s32":"A_PCM/INT/LIT","pcm-s32be":"A_PCM/INT/BIG","pcm-f32":"A_PCM/FLOAT/IEEE","pcm-f64":"A_PCM/FLOAT/IEEE",webvtt:"S_TEXT/WEBVTT"};function Ot(t){if(t===void 0)throw new Error("Undefined element size is used in a place where it is not supported.")}var Sa=t=>{let r=(t.hasVideo?"video/":t.hasAudio?"audio/":"application/")+(t.isWebM?"webm":"x-matroska");if(t.codecStrings.length>0){let i=[...new Set(t.codecStrings.filter(Boolean))];r+=`; codecs="${i.join(", ")}"`;}return r};var zt;(function(t){t[t.None=0]="None",t[t.Xiph=1]="Xiph",t[t.FixedSize=2]="FixedSize",t[t.Ebml=3]="Ebml";})(zt||(zt={}));var Sn;(function(t){t[t.Block=1]="Block",t[t.Private=2]="Private",t[t.Next=4]="Next";})(Sn||(Sn={}));var fi;(function(t){t[t.Zlib=0]="Zlib",t[t.Bzlib=1]="Bzlib",t[t.lzo1x=2]="lzo1x",t[t.HeaderStripping=3]="HeaderStripping";})(fi||(fi={}));var _s=[{id:_.SeekHead,flag:"seekHeadSeen"},{id:_.Info,flag:"infoSeen"},{id:_.Tracks,flag:"tracksSeen"},{id:_.Cues,flag:"cuesSeen"}],xa=10*2**20,xn=class extends vr{constructor(e){super(e),this.readMetadataPromise=null,this.segments=[],this.currentSegment=null,this.currentTrack=null,this.currentCluster=null,this.currentBlock=null,this.currentBlockAdditional=null,this.currentCueTime=null,this.currentDecodingInstruction=null,this.currentTagTargetIsMovie=!0,this.currentSimpleTagName=null,this.currentAttachedFile=null,this.isWebM=!1,this.reader=e._reader;}async getTrackBackings(){return await this.readMetadata(),this.segments.flatMap(e=>e.tracks.map(r=>r.trackBacking))}async getMimeType(){await this.readMetadata();let e=await this.getTrackBackings(),r=await Promise.all(e.map(i=>i.getDecoderConfig().then(n=>n?.codec??null)));return Sa({isWebM:this.isWebM,hasVideo:this.segments.some(i=>i.tracks.some(n=>n.info?.type==="video")),hasAudio:this.segments.some(i=>i.tracks.some(n=>n.info?.type==="audio")),codecStrings:r.filter(Boolean)})}async getMetadataTags(){await this.readMetadata();for(let r of this.segments)r.metadataTagsCollected||(this.reader.fileSize!==null&&await this.loadSegmentMetadata(r),r.metadataTagsCollected=!0);let e={};for(let r of this.segments)e={...e,...r.metadataTags};return e}readMetadata(){return this.readMetadataPromise??(this.readMetadataPromise=(async()=>{let e=0;for(;;){let r=this.reader.requestSliceRange(e,We,nt);if(U(r)&&(r=await r),!r)break;let i=st(r);if(!i)break;let n=i.id,s=i.size,o=r.filePos;if(n===_.EBML){Ot(s);let a=this.reader.requestSlice(o,s);if(U(a)&&(a=await a),!a)break;this.readContiguousElements(a);}else if(n===_.Segment){if(await this.readSegment(o,s),s===void 0||this.reader.fileSize===null)break}else if(n===_.Cluster){if(this.reader.fileSize===null)break;s===void 0&&(s=(await kn(this.reader,o,di,this.reader.fileSize)).pos-o);let a=ge(this.segments);a&&(a.elementEndPos=o+s);}Ot(s),e=o+s;}})())}async readSegment(e,r){this.currentSegment={seekHeadSeen:!1,infoSeen:!1,tracksSeen:!1,cuesSeen:!1,tagsSeen:!1,attachmentsSeen:!1,timestampScale:-1,timestampFactor:-1,duration:-1,seekEntries:[],tracks:[],cuePoints:[],dataStartPos:e,elementEndPos:r===void 0?null:e+r,clusterSeekStartPos:e,lastReadCluster:null,metadataTags:{},metadataTagsCollected:!1},this.segments.push(this.currentSegment);let i=e;for(;this.currentSegment.elementEndPos===null||i<this.currentSegment.elementEndPos;){let a=this.reader.requestSliceRange(i,We,nt);if(U(a)&&(a=await a),!a)break;let c=i,u=st(a);if(!u||!Br.includes(u.id)&&u.id!==_.Void){let p=await xs(this.reader,c,Br,Math.min(this.currentSegment.elementEndPos??1/0,c+xa));if(p){i=p;continue}else break}let{id:l,size:d}=u,f=a.filePos,m=_s.findIndex(p=>p.id===l);if(m!==-1){let p=_s[m].flag;this.currentSegment[p]=!0,Ot(d);let b=this.reader.requestSlice(f,d);U(b)&&(b=await b),b&&this.readContiguousElements(b);}else if(l===_.Tags||l===_.Attachments){l===_.Tags?this.currentSegment.tagsSeen=!0:this.currentSegment.attachmentsSeen=!0,Ot(d);let p=this.reader.requestSlice(f,d);U(p)&&(p=await p),p&&this.readContiguousElements(p);}else if(l===_.Cluster){this.currentSegment.clusterSeekStartPos=c;break}if(d===void 0)break;i=f+d;}if(this.currentSegment.seekEntries.sort((a,c)=>a.segmentPosition-c.segmentPosition),this.reader.fileSize!==null)for(let a of this.currentSegment.seekEntries){let c=_s.find(p=>p.id===a.id);if(!c||this.currentSegment[c.flag])continue;let u=this.reader.requestSliceRange(e+a.segmentPosition,We,nt);if(U(u)&&(u=await u),!u)continue;let l=st(u);if(!l)continue;let{id:d,size:f}=l;if(d!==c.id)continue;Ot(f),this.currentSegment[c.flag]=!0;let m=this.reader.requestSlice(u.filePos,f);U(m)&&(m=await m),m&&this.readContiguousElements(m);}this.currentSegment.timestampScale===-1&&(this.currentSegment.timestampScale=1e6,this.currentSegment.timestampFactor=1e9/1e6);for(let a of this.currentSegment.tracks)a.defaultDurationNs!==null&&(a.defaultDuration=this.currentSegment.timestampFactor*a.defaultDurationNs/1e9);let n=new Map(this.currentSegment.tracks.map(a=>[a.id,a]));for(let a of this.currentSegment.cuePoints){let c=n.get(a.trackId);c&&c.cuePoints.push(a);}for(let a of this.currentSegment.tracks){a.cuePoints.sort((c,u)=>c.time-u.time);for(let c=0;c<a.cuePoints.length-1;c++){let u=a.cuePoints[c],l=a.cuePoints[c+1];u.time===l.time&&(a.cuePoints.splice(c+1,1),c--);}}let s=null,o=-1/0;for(let a of this.currentSegment.tracks)a.cuePoints.length>o&&(o=a.cuePoints.length,s=a);for(let a of this.currentSegment.tracks)a.cuePoints.length===0&&(a.cuePoints=s.cuePoints);this.currentSegment=null;}async readCluster(e,r){if(r.lastReadCluster?.elementStartPos===e)return r.lastReadCluster;let i=this.reader.requestSliceRange(e,We,nt);U(i)&&(i=await i),g(i);let n=e,s=st(i);g(s);let o=s.id;g(o===_.Cluster);let a=s.size,c=i.filePos;a===void 0&&(a=(await kn(this.reader,c,di,r.elementEndPos)).pos-c);let u=this.reader.requestSlice(c,a);U(u)&&(u=await u);let l={segment:r,elementStartPos:n,elementEndPos:c+a,dataStartPos:c,timestamp:-1,trackData:new Map};if(this.currentCluster=l,u){let d=this.readContiguousElements(u,di);l.elementEndPos=d;}for(let[,d]of l.trackData){let f=d.track;g(d.blocks.length>0);let m=!1;for(let w=0;w<d.blocks.length;w++){let T=d.blocks[w];T.timestamp+=l.timestamp,m||(m=T.lacing!==zt.None);}d.presentationTimestamps=d.blocks.map((w,T)=>({timestamp:w.timestamp,blockIndex:T})).sort((w,T)=>w.timestamp-T.timestamp);for(let w=0;w<d.presentationTimestamps.length;w++){let T=d.presentationTimestamps[w],A=d.blocks[T.blockIndex];if(d.firstKeyFrameTimestamp===null&&A.isKeyFrame&&(d.firstKeyFrameTimestamp=A.timestamp),w<d.presentationTimestamps.length-1){let E=d.presentationTimestamps[w+1];A.duration=E.timestamp-A.timestamp;}else A.duration===0&&f.defaultDuration!=null&&A.lacing===zt.None&&(A.duration=f.defaultDuration);}m&&(this.expandLacedBlocks(d.blocks,f),d.presentationTimestamps=d.blocks.map((w,T)=>({timestamp:w.timestamp,blockIndex:T})).sort((w,T)=>w.timestamp-T.timestamp));let p=d.blocks[d.presentationTimestamps[0].blockIndex],b=d.blocks[ge(d.presentationTimestamps).blockIndex];d.startTimestamp=p.timestamp,d.endTimestamp=b.timestamp+b.duration;let y=de(f.clusterPositionCache,d.startTimestamp,w=>w.startTimestamp);(y===-1||f.clusterPositionCache[y].elementStartPos!==n)&&f.clusterPositionCache.splice(y+1,0,{elementStartPos:l.elementStartPos,startTimestamp:d.startTimestamp});}return r.lastReadCluster=l,l}getTrackDataInCluster(e,r){let i=e.trackData.get(r);if(!i){let n=e.segment.tracks.find(s=>s.id===r);if(!n)return null;i={track:n,startTimestamp:0,endTimestamp:0,firstKeyFrameTimestamp:null,blocks:[],presentationTimestamps:[]},e.trackData.set(r,i);}return i}expandLacedBlocks(e,r){for(let i=0;i<e.length;i++){let n=e[i];if(n.lacing===zt.None)continue;n.decoded||(n.data=this.decodeBlockData(r,n.data),n.decoded=!0);let s=ot.tempFromBytes(n.data),o=[],a=K(s)+1;switch(n.lacing){case zt.Xiph:{let u=0;for(let l=0;l<a-1;l++){let d=0;for(;s.bufferPos<s.length;){let f=K(s);if(d+=f,f<255){o.push(d),u+=d;break}}}o.push(s.length-(s.bufferPos+u));}break;case zt.FixedSize:{let u=s.length-1,l=Math.floor(u/a);for(let d=0;d<a;d++)o.push(l);}break;case zt.Ebml:{let u=Mr(s);g(u!==null);let l=u;o.push(l);let d=l;for(let f=1;f<a-1;f++){let m=s.bufferPos,p=Mr(s);g(p!==null);let b=p,w=(1<<(s.bufferPos-m)*7-1)-1,T=b-w;l+=T,o.push(l),d+=l;}o.push(s.length-(s.bufferPos+d));}break;default:g(!1);}g(o.length===a),e.splice(i,1);let c=n.duration||a*(r.defaultDuration??0);for(let u=0;u<a;u++){let l=o[u],d=ee(s,l),f=n.timestamp+c*u/a,m=c/a;e.splice(i+u,0,{timestamp:f,duration:m,isKeyFrame:n.isKeyFrame,data:d,lacing:zt.None,decoded:!0,postProcessed:!1,mainAdditional:n.mainAdditional});}i+=a,i--;}}async loadSegmentMetadata(e){for(let r of e.seekEntries){if(!(r.id===_.Tags&&!e.tagsSeen)){if(!(r.id===_.Attachments&&!e.attachmentsSeen))continue}let i=this.reader.requestSliceRange(e.dataStartPos+r.segmentPosition,We,nt);if(U(i)&&(i=await i),!i)continue;let n=st(i);if(!n||n.id!==r.id)continue;let{size:s}=n;Ot(s),g(!this.currentSegment),this.currentSegment=e;let o=this.reader.requestSlice(i.filePos,s);U(o)&&(o=await o),o&&this.readContiguousElements(o),this.currentSegment=null,r.id===_.Tags?e.tagsSeen=!0:r.id===_.Attachments&&(e.attachmentsSeen=!0);}}readContiguousElements(e,r){for(;e.remainingLength>=We;){let i=e.filePos;if(!this.traverseElement(e,r))return i}return e.filePos}traverseElement(e,r){let i=st(e);if(!i||r&&r.includes(i.id))return !1;let{id:n,size:s}=i,o=e.filePos;switch(Ot(s),n){case _.DocType:this.isWebM=Kt(e,s)==="webm";break;case _.Seek:{if(!this.currentSegment)break;let a={id:-1,segmentPosition:-1};this.currentSegment.seekEntries.push(a),this.readContiguousElements(e.slice(o,s)),(a.id===-1||a.segmentPosition===-1)&&this.currentSegment.seekEntries.pop();}break;case _.SeekID:{let a=this.currentSegment?.seekEntries[this.currentSegment.seekEntries.length-1];if(!a)break;a.id=Y(e,s);}break;case _.SeekPosition:{let a=this.currentSegment?.seekEntries[this.currentSegment.seekEntries.length-1];if(!a)break;a.segmentPosition=Y(e,s);}break;case _.TimestampScale:{if(!this.currentSegment)break;this.currentSegment.timestampScale=Y(e,s),this.currentSegment.timestampFactor=1e9/this.currentSegment.timestampScale;}break;case _.Duration:{if(!this.currentSegment)break;this.currentSegment.duration=An(e,s);}break;case _.TrackEntry:{if(!this.currentSegment||(this.currentTrack={id:-1,segment:this.currentSegment,demuxer:this,clusterPositionCache:[],cuePoints:[],disposition:{...ji,primary:!1},trackBacking:null,codecId:null,codecPrivate:null,defaultDuration:null,defaultDurationNs:null,name:null,languageCode:"eng",hasLanguageBcp47:!1,decodingInstructions:[],info:null},this.readContiguousElements(e.slice(o,s)),!this.currentTrack))break;if(this.currentTrack.decodingInstructions.some(a=>a.data?.type!=="decompress"||a.scope!==Sn.Block||a.data.algorithm!==fi.HeaderStripping)&&($._warn(`Track #${this.currentTrack.id} has an unsupported content encoding; dropping.`),this.currentTrack=null),this.currentTrack&&this.currentTrack.id!==-1&&this.currentTrack.codecId&&this.currentTrack.info){let a=this.currentTrack.codecId.indexOf("/"),c=a===-1?this.currentTrack.codecId:this.currentTrack.codecId.slice(0,a);if(this.currentTrack.info.type==="video"&&this.currentTrack.info.width!==-1&&this.currentTrack.info.height!==-1){if(this.currentTrack.info.squarePixelWidth=this.currentTrack.info.width,this.currentTrack.info.squarePixelHeight=this.currentTrack.info.height,this.currentTrack.info.displayWidth!==null&&this.currentTrack.info.displayHeight!==null){let l=this.currentTrack.info.displayWidth*this.currentTrack.info.height,d=this.currentTrack.info.displayHeight*this.currentTrack.info.width;l>0&&d>0&&(l>d?this.currentTrack.info.squarePixelWidth=Math.round(this.currentTrack.info.width*l/d):this.currentTrack.info.squarePixelHeight=Math.round(this.currentTrack.info.height*d/l));}if(this.currentTrack.codecId===ze.avc)this.currentTrack.info.codec="avc",this.currentTrack.info.codecDescription=this.currentTrack.codecPrivate;else if(this.currentTrack.codecId===ze.hevc)this.currentTrack.info.codec="hevc",this.currentTrack.info.codecDescription=this.currentTrack.codecPrivate;else if(c===ze.vp8)this.currentTrack.info.codec="vp8";else if(c===ze.vp9)this.currentTrack.info.codec="vp9";else if(c===ze.av1)this.currentTrack.info.codec="av1";else if(c===ze.prores){let l=this.currentTrack.codecPrivate?Ke.decode(this.currentTrack.codecPrivate):"";Pt.includes(l)&&(this.currentTrack.info.codec="prores",this.currentTrack.info.proresFormat=l);}let u=this.currentTrack;this.currentTrack.trackBacking=new Cs(u),this.currentSegment.tracks.push(this.currentTrack);}else if(this.currentTrack.info.type==="audio"){c===ze.aac?(this.currentTrack.info.codec="aac",this.currentTrack.info.aacCodecInfo={isMpeg2:this.currentTrack.codecId.includes("MPEG2"),objectType:null},this.currentTrack.info.codecDescription=this.currentTrack.codecPrivate):this.currentTrack.codecId===ze.mp3?this.currentTrack.info.codec="mp3":c===ze.opus?(this.currentTrack.info.codec="opus",this.currentTrack.info.codecDescription=this.currentTrack.codecPrivate,this.currentTrack.info.sampleRate=cn):c===ze.vorbis?(this.currentTrack.info.codec="vorbis",this.currentTrack.info.codecDescription=this.currentTrack.codecPrivate):c===ze.flac?(this.currentTrack.info.codec="flac",this.currentTrack.info.codecDescription=this.currentTrack.codecPrivate):c===ze.ac3?(this.currentTrack.info.codec="ac3",this.currentTrack.info.codecDescription=this.currentTrack.codecPrivate):c===ze.eac3?(this.currentTrack.info.codec="eac3",this.currentTrack.info.codecDescription=this.currentTrack.codecPrivate):c===ze.dts?(this.currentTrack.info.codec="dts",this.currentTrack.codecId==="A_DTS/EXPRESS"?this.currentTrack.info.dtsFormat="dtse":this.currentTrack.codecId==="A_DTS/LOSSLESS"&&(this.currentTrack.info.dtsFormat="dtsl")):this.currentTrack.codecId==="A_PCM/INT/LIT"?this.currentTrack.info.bitDepth===8?this.currentTrack.info.codec="pcm-u8":this.currentTrack.info.bitDepth===16?this.currentTrack.info.codec="pcm-s16":this.currentTrack.info.bitDepth===24?this.currentTrack.info.codec="pcm-s24":this.currentTrack.info.bitDepth===32&&(this.currentTrack.info.codec="pcm-s32"):this.currentTrack.codecId==="A_PCM/INT/BIG"?this.currentTrack.info.bitDepth===8?this.currentTrack.info.codec="pcm-u8":this.currentTrack.info.bitDepth===16?this.currentTrack.info.codec="pcm-s16be":this.currentTrack.info.bitDepth===24?this.currentTrack.info.codec="pcm-s24be":this.currentTrack.info.bitDepth===32&&(this.currentTrack.info.codec="pcm-s32be"):this.currentTrack.codecId==="A_PCM/FLOAT/IEEE"&&(this.currentTrack.info.bitDepth===32?this.currentTrack.info.codec="pcm-f32":this.currentTrack.info.bitDepth===64&&(this.currentTrack.info.codec="pcm-f64"));let u=this.currentTrack;this.currentTrack.trackBacking=new Es(u),this.currentSegment.tracks.push(this.currentTrack);}}this.currentTrack=null;}break;case _.TrackNumber:{if(!this.currentTrack)break;this.currentTrack.id=Y(e,s);}break;case _.TrackType:{if(!this.currentTrack)break;let a=Y(e,s);a===1?this.currentTrack.info={type:"video",width:-1,height:-1,displayWidth:null,displayHeight:null,displayUnit:null,squarePixelWidth:-1,squarePixelHeight:-1,rotation:0,codec:null,codecDescription:null,colorSpace:{...Oi},alphaMode:!1,proresFormat:null}:a===2&&(this.currentTrack.info={type:"audio",numberOfChannels:1,sampleRate:8e3,bitDepth:-1,codec:null,codecDescription:null,aacCodecInfo:null,dtsFormat:null});}break;case _.FlagEnabled:{if(!this.currentTrack)break;Y(e,s)||(this.currentTrack=null);}break;case _.FlagDefault:{if(!this.currentTrack)break;this.currentTrack.disposition.default=!!Y(e,s);}break;case _.FlagForced:{if(!this.currentTrack)break;this.currentTrack.disposition.forced=!!Y(e,s);}break;case _.FlagOriginal:{if(!this.currentTrack)break;this.currentTrack.disposition.original=!!Y(e,s);}break;case _.FlagHearingImpaired:{if(!this.currentTrack)break;this.currentTrack.disposition.hearingImpaired=!!Y(e,s);}break;case _.FlagVisualImpaired:{if(!this.currentTrack)break;this.currentTrack.disposition.visuallyImpaired=!!Y(e,s);}break;case _.FlagCommentary:{if(!this.currentTrack)break;this.currentTrack.disposition.commentary=!!Y(e,s);}break;case _.CodecID:{if(!this.currentTrack)break;this.currentTrack.codecId=Kt(e,s);}break;case _.CodecPrivate:{if(!this.currentTrack)break;this.currentTrack.codecPrivate=ee(e,s);}break;case _.DefaultDuration:{if(!this.currentTrack)break;this.currentTrack.defaultDurationNs=Y(e,s);}break;case _.Name:{if(!this.currentTrack)break;this.currentTrack.name=Dr(e,s);}break;case _.Language:{if(!this.currentTrack||this.currentTrack.hasLanguageBcp47)break;this.currentTrack.languageCode=Kt(e,s),Ct(this.currentTrack.languageCode)||(this.currentTrack.languageCode=qt);}break;case _.LanguageBCP47:{if(!this.currentTrack)break;let c=Kt(e,s).split("-")[0];c?this.currentTrack.languageCode=c:this.currentTrack.languageCode=qt,this.currentTrack.hasLanguageBcp47=!0;}break;case _.Video:{if(this.currentTrack?.info?.type!=="video")break;this.readContiguousElements(e.slice(o,s));}break;case _.PixelWidth:{if(this.currentTrack?.info?.type!=="video")break;this.currentTrack.info.width=Y(e,s);}break;case _.PixelHeight:{if(this.currentTrack?.info?.type!=="video")break;this.currentTrack.info.height=Y(e,s);}break;case _.DisplayWidth:{if(this.currentTrack?.info?.type!=="video")break;this.currentTrack.info.displayWidth=Y(e,s);}break;case _.DisplayHeight:{if(this.currentTrack?.info?.type!=="video")break;this.currentTrack.info.displayHeight=Y(e,s);}break;case _.DisplayUnit:{if(this.currentTrack?.info?.type!=="video")break;this.currentTrack.info.displayUnit=Y(e,s);}break;case _.AlphaMode:{if(this.currentTrack?.info?.type!=="video")break;this.currentTrack.info.alphaMode=Y(e,s)===1;}break;case _.Colour:{if(this.currentTrack?.info?.type!=="video")break;this.readContiguousElements(e.slice(o,s));}break;case _.MatrixCoefficients:{if(this.currentTrack?.info?.type!=="video")break;let a=Y(e,s),c=ht[a];this.currentTrack.info.colorSpace.matrix=c;}break;case _.Range:{if(this.currentTrack?.info?.type!=="video")break;let a=Y(e,s);this.currentTrack.info.colorSpace.fullRange=a===1||a===2?a===2:void 0;}break;case _.TransferCharacteristics:{if(this.currentTrack?.info?.type!=="video")break;let a=Y(e,s),c=ft[a];this.currentTrack.info.colorSpace.transfer=c;}break;case _.Primaries:{if(this.currentTrack?.info?.type!=="video")break;let a=Y(e,s),c=dt[a];this.currentTrack.info.colorSpace.primaries=c;}break;case _.Projection:{if(this.currentTrack?.info?.type!=="video")break;this.readContiguousElements(e.slice(o,s));}break;case _.ProjectionPoseRoll:{if(this.currentTrack?.info?.type!=="video")break;let c=-An(e,s);try{this.currentTrack.info.rotation=kt(c);}catch{}}break;case _.Audio:{if(this.currentTrack?.info?.type!=="audio")break;this.readContiguousElements(e.slice(o,s));}break;case _.SamplingFrequency:{if(this.currentTrack?.info?.type!=="audio")break;this.currentTrack.info.sampleRate=An(e,s);}break;case _.Channels:{if(this.currentTrack?.info?.type!=="audio")break;this.currentTrack.info.numberOfChannels=Y(e,s);}break;case _.BitDepth:{if(this.currentTrack?.info?.type!=="audio")break;this.currentTrack.info.bitDepth=Y(e,s);}break;case _.CuePoint:{if(!this.currentSegment)break;this.readContiguousElements(e.slice(o,s)),this.currentCueTime=null;}break;case _.CueTime:this.currentCueTime=Y(e,s);break;case _.CueTrackPositions:{if(this.currentCueTime===null)break;g(this.currentSegment);let a={time:this.currentCueTime,trackId:-1,clusterPosition:-1};this.currentSegment.cuePoints.push(a),this.readContiguousElements(e.slice(o,s)),(a.trackId===-1||a.clusterPosition===-1)&&this.currentSegment.cuePoints.pop();}break;case _.CueTrack:{let a=this.currentSegment?.cuePoints[this.currentSegment.cuePoints.length-1];if(!a)break;a.trackId=Y(e,s);}break;case _.CueClusterPosition:{let a=this.currentSegment?.cuePoints[this.currentSegment.cuePoints.length-1];if(!a)break;g(this.currentSegment),a.clusterPosition=this.currentSegment.dataStartPos+Y(e,s);}break;case _.Timestamp:{if(!this.currentCluster)break;this.currentCluster.timestamp=Y(e,s);}break;case _.SimpleBlock:{if(!this.currentCluster)break;let a=Mr(e);if(a===null)break;let c=this.getTrackDataInCluster(this.currentCluster,a);if(!c)break;let u=ui(e),l=K(e),d=l>>1&3,f=!!(l&128);c.track.info?.type==="audio"&&c.track.info.codec&&(f=!0);let m=ee(e,s-(e.filePos-o)),p=c.track.decodingInstructions.length>0;c.blocks.push({timestamp:u,duration:0,isKeyFrame:f,data:m,lacing:d,decoded:!p,postProcessed:!1,mainAdditional:null});}break;case _.BlockGroup:{if(!this.currentCluster)break;this.readContiguousElements(e.slice(o,s)),this.currentBlock=null;}break;case _.Block:{if(!this.currentCluster)break;let a=Mr(e);if(a===null)break;let c=this.getTrackDataInCluster(this.currentCluster,a);if(!c)break;let u=ui(e),d=K(e)>>1&3,f=ee(e,s-(e.filePos-o)),m=c.track.decodingInstructions.length>0;this.currentBlock={timestamp:u,duration:0,isKeyFrame:!0,data:f,lacing:d,decoded:!m,postProcessed:!1,mainAdditional:null},c.blocks.push(this.currentBlock);}break;case _.BlockAdditions:this.readContiguousElements(e.slice(o,s));break;case _.BlockMore:{if(!this.currentBlock)break;this.currentBlockAdditional={addId:1,data:null},this.readContiguousElements(e.slice(o,s)),this.currentBlockAdditional.data&&this.currentBlockAdditional.addId===1&&(this.currentBlock.mainAdditional=this.currentBlockAdditional.data),this.currentBlockAdditional=null;}break;case _.BlockAdditional:{if(!this.currentBlockAdditional)break;this.currentBlockAdditional.data=ee(e,s);}break;case _.BlockAddID:{if(!this.currentBlockAdditional)break;this.currentBlockAdditional.addId=Y(e,s);}break;case _.BlockDuration:{if(!this.currentBlock)break;this.currentBlock.duration=Y(e,s);}break;case _.ReferenceBlock:{if(!this.currentBlock)break;this.currentBlock.isKeyFrame=!1;}break;case _.Tag:this.currentTagTargetIsMovie=!0,this.readContiguousElements(e.slice(o,s));break;case _.Targets:this.readContiguousElements(e.slice(o,s));break;case _.TargetTypeValue:Y(e,s)!==50&&(this.currentTagTargetIsMovie=!1);break;case _.TagTrackUID:case _.TagEditionUID:case _.TagChapterUID:case _.TagAttachmentUID:this.currentTagTargetIsMovie=!1;break;case _.SimpleTag:{if(!this.currentTagTargetIsMovie)break;this.currentSimpleTagName=null,this.readContiguousElements(e.slice(o,s));}break;case _.TagName:this.currentSimpleTagName=Dr(e,s);break;case _.TagString:{if(!this.currentSimpleTagName)break;let a=Dr(e,s);this.processTagValue(this.currentSimpleTagName,a);}break;case _.TagBinary:{if(!this.currentSimpleTagName)break;let a=ee(e,s);this.processTagValue(this.currentSimpleTagName,a);}break;case _.AttachedFile:{if(!this.currentSegment)break;this.currentAttachedFile={fileUid:null,fileName:null,fileMediaType:null,fileData:null,fileDescription:null},this.readContiguousElements(e.slice(o,s));let a=this.currentSegment.metadataTags;if(this.currentAttachedFile.fileUid&&this.currentAttachedFile.fileData&&(a.raw??(a.raw={}),a.raw[this.currentAttachedFile.fileUid.toString()]=new ei(this.currentAttachedFile.fileData,this.currentAttachedFile.fileMediaType??void 0,this.currentAttachedFile.fileName??void 0,this.currentAttachedFile.fileDescription??void 0)),this.currentAttachedFile.fileMediaType?.startsWith("image/")&&this.currentAttachedFile.fileData){let c=this.currentAttachedFile.fileName,u="unknown";if(c){let l=c.toLowerCase();l.startsWith("cover.")?u="coverFront":l.startsWith("back.")&&(u="coverBack");}a.images??(a.images=[]),a.images.push({data:this.currentAttachedFile.fileData,mimeType:this.currentAttachedFile.fileMediaType,kind:u,name:this.currentAttachedFile.fileName??void 0,description:this.currentAttachedFile.fileDescription??void 0});}this.currentAttachedFile=null;}break;case _.FileUID:{if(!this.currentAttachedFile)break;this.currentAttachedFile.fileUid=Aa(e,s);}break;case _.FileName:{if(!this.currentAttachedFile)break;this.currentAttachedFile.fileName=Dr(e,s);}break;case _.FileMediaType:{if(!this.currentAttachedFile)break;this.currentAttachedFile.fileMediaType=Kt(e,s);}break;case _.FileData:{if(!this.currentAttachedFile)break;this.currentAttachedFile.fileData=ee(e,s);}break;case _.FileDescription:{if(!this.currentAttachedFile)break;this.currentAttachedFile.fileDescription=Dr(e,s);}break;case _.ContentEncodings:{if(!this.currentTrack)break;this.readContiguousElements(e.slice(o,s)),this.currentTrack.decodingInstructions.sort((a,c)=>c.order-a.order);}break;case _.ContentEncoding:this.currentDecodingInstruction={order:0,scope:Sn.Block,data:null},this.readContiguousElements(e.slice(o,s)),this.currentDecodingInstruction.data&&this.currentTrack.decodingInstructions.push(this.currentDecodingInstruction),this.currentDecodingInstruction=null;break;case _.ContentEncodingOrder:{if(!this.currentDecodingInstruction)break;this.currentDecodingInstruction.order=Y(e,s);}break;case _.ContentEncodingScope:{if(!this.currentDecodingInstruction)break;this.currentDecodingInstruction.scope=Y(e,s);}break;case _.ContentCompression:{if(!this.currentDecodingInstruction)break;this.currentDecodingInstruction.data={type:"decompress",algorithm:fi.Zlib,settings:null},this.readContiguousElements(e.slice(o,s));}break;case _.ContentCompAlgo:{if(this.currentDecodingInstruction?.data?.type!=="decompress")break;this.currentDecodingInstruction.data.algorithm=Y(e,s);}break;case _.ContentCompSettings:{if(this.currentDecodingInstruction?.data?.type!=="decompress")break;this.currentDecodingInstruction.data.settings=ee(e,s);}break;case _.ContentEncryption:{if(!this.currentDecodingInstruction)break;this.currentDecodingInstruction.data={type:"decrypt"};}break}return e.filePos=o+s,!0}decodeBlockData(e,r){g(e.decodingInstructions.length>0);let i=r;for(let n of e.decodingInstructions)switch(g(n.data),n.data.type){case "decompress":switch(n.data.algorithm){case fi.HeaderStripping:if(n.data.settings&&n.data.settings.length>0){let s=n.data.settings,o=new Uint8Array(s.length+i.length);o.set(s,0),o.set(i,s.length),i=o;}break;default:}break;default:}return i}processTagValue(e,r){var n;if(!this.currentSegment?.metadataTags)return;let i=this.currentSegment.metadataTags;if(i.raw??(i.raw={}),(n=i.raw)[e]??(n[e]=r),typeof r=="string")switch(e.toLowerCase()){case "title":i.title??(i.title=r);break;case "description":i.description??(i.description=r);break;case "artist":i.artist??(i.artist=r);break;case "album":i.album??(i.album=r);break;case "album_artist":i.albumArtist??(i.albumArtist=r);break;case "genre":i.genre??(i.genre=r);break;case "comment":i.comment??(i.comment=r);break;case "lyrics":i.lyrics??(i.lyrics=r);break;case "date":{let s=new Date(r);Number.isNaN(s.getTime())||(i.date??(i.date=s));}break;case "track_number":case "part_number":{let s=r.split("/"),o=Number.parseInt(s[0],10),a=s[1]&&Number.parseInt(s[1],10);Number.isInteger(o)&&o>0&&(i.trackNumber??(i.trackNumber=o)),a&&Number.isInteger(a)&&a>0&&(i.tracksTotal??(i.tracksTotal=a));}break;case "disc_number":case "disc":{let s=r.split("/"),o=Number.parseInt(s[0],10),a=s[1]&&Number.parseInt(s[1],10);Number.isInteger(o)&&o>0&&(i.discNumber??(i.discNumber=o)),a&&Number.isInteger(a)&&a>0&&(i.discsTotal??(i.discsTotal=a));}break}}async getDurationFromMetadata(e){if(e.duration<=0)return null;let r=null;for(let n of e.tracks){g(n.trackBacking);let s=await n.trackBacking.getFirstPacket({metadataOnly:!0});s&&(r=Math.min(r??1/0,s.timestamp));}let i=e.duration/e.timestampFactor;return i+=r??0,i}},_n=class{constructor(e){this.internalTrack=e,this.packetToClusterLocation=new WeakMap;}getId(){return this.internalTrack.id}getNumber(){let e=this.internalTrack.demuxer,r=this.internalTrack.trackBacking.getType(),i=0;for(let n of e.segments)for(let s of n.tracks)if(s.trackBacking.getType()===r&&i++,s===this.internalTrack)break;return i}getCodec(){throw new Error("Not implemented on base class.")}getInternalCodecId(){return this.internalTrack.codecId}getName(){return this.internalTrack.name}getLanguageCode(){return this.internalTrack.languageCode}getTimeResolution(){return this.internalTrack.segment.timestampFactor}isRelativeToUnixEpoch(){return !1}getUnixTimeForTimestamp(){return null}getDisposition(){return this.internalTrack.disposition}getPairingMask(){return 1n}getBitrate(){return null}getAverageBitrate(){return null}async getDurationFromMetadata(){return this.internalTrack.demuxer.getDurationFromMetadata(this.internalTrack.segment)}async getLiveRefreshInterval(){return null}async getFirstPacket(e){return this.performClusterLookup(null,r=>r.trackData.get(this.internalTrack.id)?{blockIndex:0,correctBlockFound:!0}:{blockIndex:-1,correctBlockFound:!1},-1/0,1/0,e)}intoTimescale(e){return Ui(e*this.internalTrack.segment.timestampFactor)}async getPacket(e,r){let i=this.intoTimescale(e);return this.performClusterLookup(null,n=>{let s=n.trackData.get(this.internalTrack.id);if(!s)return {blockIndex:-1,correctBlockFound:!1};let o=de(s.presentationTimestamps,i,u=>u.timestamp),a=o!==-1?s.presentationTimestamps[o].blockIndex:-1,c=o!==-1&&i<s.endTimestamp;return {blockIndex:a,correctBlockFound:c}},i,i,r)}async getNextPacket(e,r){let i=this.packetToClusterLocation.get(e);if(i===void 0)throw new Error("Packet was not created from this track.");return this.performClusterLookup(i.cluster,n=>{if(n===i.cluster){let s=n.trackData.get(this.internalTrack.id);if(i.blockIndex+1<s.blocks.length)return {blockIndex:i.blockIndex+1,correctBlockFound:!0}}else if(n.trackData.get(this.internalTrack.id))return {blockIndex:0,correctBlockFound:!0};return {blockIndex:-1,correctBlockFound:!1}},-1/0,1/0,r)}async getKeyPacket(e,r){let i=this.intoTimescale(e);return this.performClusterLookup(null,n=>{let s=n.trackData.get(this.internalTrack.id);if(!s)return {blockIndex:-1,correctBlockFound:!1};let o=zi(s.presentationTimestamps,u=>s.blocks[u.blockIndex].isKeyFrame&&u.timestamp<=i),a=o!==-1?s.presentationTimestamps[o].blockIndex:-1,c=o!==-1&&i<s.endTimestamp;return {blockIndex:a,correctBlockFound:c}},i,i,r)}async getNextKeyPacket(e,r){let i=this.packetToClusterLocation.get(e);if(i===void 0)throw new Error("Packet was not created from this track.");return this.performClusterLookup(i.cluster,n=>{if(n===i.cluster){let o=n.trackData.get(this.internalTrack.id).blocks.findIndex((a,c)=>a.isKeyFrame&&c>i.blockIndex);if(o!==-1)return {blockIndex:o,correctBlockFound:!0}}else {let s=n.trackData.get(this.internalTrack.id);if(s&&s.firstKeyFrameTimestamp!==null){let o=s.blocks.findIndex(a=>a.isKeyFrame);return g(o!==-1),{blockIndex:o,correctBlockFound:!0}}}return {blockIndex:-1,correctBlockFound:!1}},-1/0,1/0,r)}async fetchPacketInCluster(e,r,i){if(r===-1)return null;let s=e.trackData.get(this.internalTrack.id).blocks[r];if(g(s),s.decoded||(s.data=this.internalTrack.demuxer.decodeBlockData(this.internalTrack,s.data),s.decoded=!0),!s.postProcessed){if(this.internalTrack.info?.codec==="prores"&&!(s.data.length>=8&&s.data[4]===105&&s.data[5]===99&&s.data[6]===112&&s.data[7]===102)){let f=new Uint8Array(s.data.length+8);oe(f).setUint32(0,f.length,!1),f[4]=105,f[5]=99,f[6]=112,f[7]=102,f.set(s.data,8),s.data=f;}s.postProcessed=!0;}let o=i.metadataOnly?jt:s.data,a=s.timestamp/this.internalTrack.segment.timestampFactor,c=s.duration/this.internalTrack.segment.timestampFactor,u={};s.mainAdditional&&this.internalTrack.info?.type==="video"&&this.internalTrack.info.alphaMode&&(u.alpha=i.metadataOnly?jt:s.mainAdditional,u.alphaByteLength=s.mainAdditional.byteLength);let l=new me(o,s.isKeyFrame?"key":"delta",a,c,e.dataStartPos+r,s.data.byteLength,u);return this.packetToClusterLocation.set(l,{cluster:e,blockIndex:r}),l}async performClusterLookup(e,r,i,n,s){let{demuxer:o,segment:a}=this.internalTrack,c=null,u=null,l=-1;if(e){let{blockIndex:w,correctBlockFound:T}=r(e);if(T)return this.fetchPacketInCluster(e,w,s);w!==-1&&(u=e,l=w);}let d=de(this.internalTrack.cuePoints,i,w=>w.time),f=d!==-1?this.internalTrack.cuePoints[d]:null,m=de(this.internalTrack.clusterPositionCache,i,w=>w.startTimestamp),p=m!==-1?this.internalTrack.clusterPositionCache[m]:null,b=Math.max(f?.clusterPosition??0,p?.elementStartPos??0)||null,y;for(e?b===null||e.elementStartPos>=b?(y=e.elementEndPos,c=e):y=b:y=b??a.clusterSeekStartPos;a.elementEndPos===null||y<=a.elementEndPos-We;){if(c){let k=c.trackData.get(this.internalTrack.id);if(k&&k.startTimestamp>n)break}let w=o.reader.requestSliceRange(y,We,nt);if(U(w)&&(w=await w),!w)break;let T=y,A=st(w);if(!A||!Br.includes(A.id)&&A.id!==_.Void){let k=await xs(o.reader,T,Br,Math.min(a.elementEndPos??1/0,T+xa));if(k){y=k;continue}else break}let E=A.id,P=A.size,I=w.filePos;if(E===_.Cluster){c=await o.readCluster(T,a),P=c.elementEndPos-I;let{blockIndex:k,correctBlockFound:C}=r(c);if(C)return this.fetchPacketInCluster(c,k,s);k!==-1&&(u=c,l=k);}P===void 0&&(g(E!==_.Cluster),P=(await kn(o.reader,I,di,a.elementEndPos)).pos-I);let v=I+P;if(a.elementEndPos===null){let k=o.reader.requestSliceRange(v,We,nt);if(U(k)&&(k=await k),!k)break;if(Tn(k)===_.Segment){a.elementEndPos=v;break}}y=v;}if(f&&(!u||u.elementStartPos<f.clusterPosition)){let w=this.internalTrack.cuePoints[d-1];g(!w||w.time<f.time);let T=w?.time??-1/0;return this.performClusterLookup(null,r,T,n,s)}return u?this.fetchPacketInCluster(u,l,s):null}},Cs=class extends _n{constructor(e){super(e),this.decoderConfigPromise=null,this.internalTrack=e;}getType(){return "video"}getCodec(){return this.internalTrack.info.codec}getCodedWidth(){return this.internalTrack.info.width}getCodedHeight(){return this.internalTrack.info.height}getSquarePixelWidth(){return this.internalTrack.info.squarePixelWidth}getSquarePixelHeight(){return this.internalTrack.info.squarePixelHeight}getRotation(){return this.internalTrack.info.rotation}async getColorSpace(){let e=await this.getDecoderConfig();return e?{primaries:e.colorSpace?.primaries,transfer:e.colorSpace?.transfer,matrix:e.colorSpace?.matrix,fullRange:e.colorSpace?.fullRange}:this.internalTrack.info.colorSpace}async canBeTransparent(){return this.internalTrack.info.alphaMode||this.internalTrack.info.codec==="prores"&&(this.internalTrack.info.proresFormat==="ap4h"||this.internalTrack.info.proresFormat==="ap4x")}async getDecoderConfig(){return this.internalTrack.info.codec?this.decoderConfigPromise??(this.decoderConfigPromise=(async()=>{var s,o,a,c;let e=null;(this.internalTrack.info.codec==="vp9"||this.internalTrack.info.codec==="av1"||this.internalTrack.info.codec==="prores"||this.internalTrack.info.codec==="avc"&&!this.internalTrack.info.codecDescription||this.internalTrack.info.codec==="hevc"&&!this.internalTrack.info.codecDescription)&&(e=await this.getFirstPacket({}));let i={width:this.internalTrack.info.width,height:this.internalTrack.info.height,codec:this.internalTrack.info.codec,codecDescription:this.internalTrack.info.codecDescription,colorSpace:this.internalTrack.info.colorSpace,avcType:1,avcCodecInfo:this.internalTrack.info.codec==="avc"&&e?xr(e.data):null,hevcCodecInfo:this.internalTrack.info.codec==="hevc"&&e?Cr(e.data):null,vp9CodecInfo:this.internalTrack.info.codec==="vp9"&&e?en(e.data):null,av1CodecInfo:this.internalTrack.info.codec==="av1"&&e?ai(e.data):null,proresCodecInfo:this.internalTrack.info.codec==="prores"&&e?tn(e.data):null,proresFormat:this.internalTrack.info.proresFormat};if(!wr(this.internalTrack.info.colorSpace)){let u=on(i);(s=this.internalTrack.info.colorSpace).primaries??(s.primaries=u.primaries),(o=this.internalTrack.info.colorSpace).transfer??(o.transfer=u.transfer),(a=this.internalTrack.info.colorSpace).matrix??(a.matrix=u.matrix),(c=this.internalTrack.info.colorSpace).fullRange??(c.fullRange=u.fullRange);}let n={codec:sn(i),codedWidth:this.internalTrack.info.width,codedHeight:this.internalTrack.info.height,description:this.internalTrack.info.codecDescription??void 0,colorSpace:this.internalTrack.info.colorSpace};return (this.internalTrack.info.width!==this.internalTrack.info.squarePixelWidth||this.internalTrack.info.height!==this.internalTrack.info.squarePixelHeight)&&(n.displayAspectWidth=this.internalTrack.info.squarePixelWidth,n.displayAspectHeight=this.internalTrack.info.squarePixelHeight),n})()):null}},Es=class extends _n{constructor(e){super(e),this.decoderConfigPromise=null,this.internalTrack=e;}getType(){return "audio"}getCodec(){return this.internalTrack.info.codec}getNumberOfChannels(){return this.internalTrack.info.numberOfChannels}getSampleRate(){return this.internalTrack.info.sampleRate}async getDecoderConfig(){return this.internalTrack.info.codec?this.decoderConfigPromise??(this.decoderConfigPromise=(async()=>{if(this.internalTrack.info.codec==="dts"&&!this.internalTrack.info.dtsFormat){let e=await this.getFirstPacket({});this.internalTrack.info.dtsFormat=e&&nn(e.data);}return {codec:an({codec:this.internalTrack.info.codec,codecDescription:this.internalTrack.info.codecDescription,aacCodecInfo:this.internalTrack.info.aacCodecInfo,dtsFormat:this.internalTrack.info.dtsFormat}),numberOfChannels:this.internalTrack.info.numberOfChannels,sampleRate:this.internalTrack.info.sampleRate,description:this.internalTrack.info.codecDescription??void 0}})()):null}};var _a=7,Ca=9,vs=t=>{let e=t.filePos,r=ee(t,9),i=new ue(r);if(i.readBits(12)!==4095||(i.skipBits(1),i.readBits(2)!==0))return null;let o=i.readBits(1),a=i.readBits(2)+1,c=i.readBits(4);if(c===15)return null;i.skipBits(1);let u=i.readBits(3);if(u===0)throw new Error("ADTS frames with channel configuration 0 are not supported.");i.skipBits(1),i.skipBits(1),i.skipBits(1),i.skipBits(1);let l=i.readBits(13);i.skipBits(11);let d=i.readBits(2)+1;if(d!==1)throw new Error("ADTS frames with more than one AAC frame are not supported.");let f=null;return o===1?t.filePos-=2:f=i.readBits(16),{objectType:a,samplingFrequencyIndex:c,channelConfiguration:u,frameLength:l,numberOfAacFrames:d,crcCheck:f,startPos:e}};Tr();var Is=0,Rs=1/0,bl=null;typeof FinalizationRegistry<"u"&&(bl=new FinalizationRegistry(t=>{t();}));var $e=class extends Qe{constructor(){super(),this._disposed=!1,this._refCount=0,this._usedForHls=!1,this._refFinalizationRegistry=null,this._sizePromise=null,this.onread=null,typeof FinalizationRegistry<"u"&&(this._refFinalizationRegistry=new FinalizationRegistry(e=>{e._decrementRefCount();}));}async getSizeOrNull(){if(this._disposed)throw new Ce;return this._sizePromise??(this._sizePromise=(async()=>{let e=this._getFileSize();return e!==void 0||(await this._read(0,1,Is,Rs),e=this._getFileSize(),g(e!==void 0)),e})())}async getSize(){if(this._disposed)throw new Ce;let e=await this.getSizeOrNull();if(e===null)throw new Error("Cannot determine the size of an unsized source.");return e}slice(e,r){if(!Number.isInteger(e)||e<0)throw new TypeError("offset must be a non-negative integer.");if(r!==void 0&&(!Number.isInteger(r)||r<0))throw new TypeError("length, when provided, must be a non-negative integer.");return new Cn(this,e,r)}_dispatchRead(e,r){this.onread?.(e,r),this._emit("read",{start:e,end:r});}ref(){return new rr(this)}_incrementRefCount(){this._refCount++;}_decrementRefCount(){this._refCount--,this._refCount===0&&(this._dispose(),this._disposed=!0);}},rr=class{constructor(e){if(this._freed=!1,e._disposed)throw new Error("Cannot ref a disposed source.");e._incrementRefCount(),e._refFinalizationRegistry?.register(this,e,this),this._source=e;}get source(){if(!this._source)throw new Error("Can't get source; ref has already been freed.");return this._source}get freed(){return this._freed}free(){if(this._freed)throw new Error("Illegal operation: double free on SourceRef.");let e=this.source;g(e._refCount>0),e._decrementRefCount(),e._refFinalizationRegistry?.unregister(this),this._freed=!0,this._source=null;}[Symbol.dispose](){this.freed||this.free();}},hi=class extends $e{constructor(e,r){if(typeof e!="string")throw new TypeError("rootPath must be a string.");if(typeof r!="function")throw new TypeError("requestHandler must be a function.");super(),this.rootPath=e,this.requestHandler=r;}_resolveRequest(e){let r=this.requestHandler(e),i=n=>{var o;if(!(n instanceof $e||n instanceof rr))throw new TypeError("requestHandler must return or resolve to a Source or SourceRef.");let s=n instanceof $e?n.ref():n;return (o=s.source)._usedForHls||(o._usedForHls=this._usedForHls),s};return U(r)?r.then(i):i(r)}},Fs=(t,e)=>t.path===e.path;var Ea=typeof FinalizationRegistry<"u"?new FinalizationRegistry(t=>{t.cancel().catch(()=>{});}):null,mi=class extends $e{constructor(e,r={}){if(!(e instanceof Blob))throw new TypeError("blob must be a Blob.");if(!r||typeof r!="object")throw new TypeError("options must be an object.");if(r.maxCacheSize!==void 0&&(!et(r.maxCacheSize)||r.maxCacheSize<0))throw new TypeError("options.maxCacheSize, when provided, must be a non-negative number.");if(r.useStreamReader!==void 0&&typeof r.useStreamReader!="boolean")throw new TypeError("options.useStreamReader, when provided, must be a boolean.");if(r.handleUnhandledError!==void 0&&typeof r.handleUnhandledError!="function")throw new TypeError("options.handleUnhandledError, when provided, must be a function.");super(),this._readers=new WeakMap,this._blob=e,this._options=r,this._orchestrator=new Ps({maxCacheSize:r.maxCacheSize??8*2**20,maxWorkerCount:4,runWorker:this._runWorker.bind(this),onIdleWorkerRemoved:i=>{let n=this._readers.get(i);n&&(this._readers.delete(i),Ea?.unregister(i),n.cancel().catch(()=>{}));},prefetchProfile:Al.fileSystem,handleUnhandledError:r.handleUnhandledError}),this._orchestrator.fileSize=e.size;}_getFileSize(){return this._orchestrator.fileSize}_read(e,r,i,n){return this._orchestrator.read(e,r,i,n)}async _runWorker(e){g(e.strictTarget);let r=this._readers.get(e);for(r===void 0&&("stream"in this._blob&&!Et()&&this._options.useStreamReader!==!1?(r=this._blob.slice(e.currentPos).stream().getReader(),Ea?.register(e,r,e)):r=null,this._readers.set(e,r));e.currentPos<e.targetPos&&!e.aborted;)if(r){let{done:i,value:n}=await r.read();if(i)throw this._orchestrator.onWorkerFinished(e),new Error("Blob reader stopped unexpectedly before all requested data was read.");if(e.aborted)break;this._dispatchRead(e.currentPos,e.currentPos+n.length),this._orchestrator.supplyWorkerData(e,n);}else {let i=await this._blob.slice(e.currentPos,e.targetPos).arrayBuffer();if(e.aborted)break;this._dispatchRead(e.currentPos,e.currentPos+i.byteLength),this._orchestrator.supplyWorkerData(e,new Uint8Array(i));}this._orchestrator.signalWorkerStoppedRunning(e),e.aborted&&await r?.cancel();}_dispose(){this._orchestrator.dispose();}},Tl=.5*2**20;var Al={none:(t,e)=>({start:t,end:e}),fileSystem:(t,e)=>(t=Math.floor((t-65536)/65536)*65536,e=Math.ceil((e+65536)/65536)*65536,{start:t,end:e}),network:(t,e,r)=>{t=Math.max(0,Math.floor((t-65536)/65536)*65536);for(let n of r){let o=Math.max((n.startPos+n.targetPos)/2,n.targetPos-8388608);if(Ni(t,e,o,n.targetPos)){let a=n.targetPos-n.startPos,c=Math.ceil((a+1)/8388608)*8388608,u=2**Math.ceil(Math.log2(a+1)),l=Math.min(u,c);e=Math.max(e,n.startPos+l);}}return e=Math.max(e,t+Tl),{start:t,end:e}}},Ps=class{constructor(e){this.options=e,this.fileSize=null,this.nextAge=0,this.workers=[],this.cache=[],this.currentCacheSize=0,this.disposed=!1,this.queuedReads=[];}read(e,r,i,n){g(!this.disposed);let s=this.options.prefetchProfile(e,r,this.workers),o=Math.max(s.start,i),a=Math.min(s.end,this.fileSize??1/0,n);g(o<=e&&r<=a);let c=null,u=de(this.cache,e,P=>P.start),l=u!==-1?this.cache[u]:null;l&&l.start<=e&&r<=l.end&&(l.age=this.nextAge++,c={bytes:l.bytes,view:l.view,offset:l.start});let d=de(this.cache,o,P=>P.start),f=c?null:new Uint8Array(r-e),m=0,p=o,b=[];if(d!==-1){for(let P=d;P<this.cache.length;P++){let I=this.cache[P];if(I.start>=a)break;if(I.end<=o)continue;let v=Math.max(o,I.start),k=Math.min(a,I.end);if(g(v<=k),p<v&&b.push({start:p,end:v}),p=k,f){let C=Math.max(e,I.start),M=Math.min(r,I.end);if(C<M){let q=C-e;f.set(I.bytes.subarray(C-I.start,M-I.start),q),q===m&&(m=M-e);}}I.age=this.nextAge++;}p<a&&b.push({start:p,end:a});}else b.push({start:o,end:a});if(f&&m>=f.length&&(c={bytes:f,view:oe(f),offset:e}),b.length===0)return g(c),c;let{promise:y,resolve:w,reject:T}=we(),A=[];for(let P of b){let I=Math.max(e,P.start),v=Math.min(r,P.end);I===P.start&&v===P.end?A.push(P):I<v&&A.push({start:I,end:v});}let E=f&&{start:e,bytes:f,holes:A,resolve:w,reject:T};e:for(let P of b){for(let k of this.workers)if(this.checkHoleAgainstWorker(k,P,E?[E]:[])){this.checkQueuedReadsAgainstWorker(k);continue e}let I=P.end<a||this.fileSize!==null,v=this.createWorker(P.start,P.end,I);if(v)E&&(v.pendingSlices=[E]),this.runWorker(v);else {let k=de(this.queuedReads,P.start,M=>M.hole.start),C=k!==-1?this.queuedReads[k]:null;for(C&&P.start<=C.hole.end?(C.hole.end=Math.max(C.hole.end,P.end),C.strictTarget&&(C.strictTarget=I),E&&C.pendingSlices.push(E)):(k++,C={hole:{start:P.start,end:P.end},strictTarget:I,pendingSlices:E?[E]:[],age:this.nextAge++},this.queuedReads.splice(k,0,C));k+1<this.queuedReads.length;){let M=this.queuedReads[k+1];if(M.hole.start>C.hole.end)break;C.hole.end=Math.max(C.hole.end,M.hole.end),C.pendingSlices.push(...M.pendingSlices),C.strictTarget&&(C.strictTarget=M.strictTarget),C.age=Math.min(C.age,M.age),this.queuedReads.splice(k+1,1);}}}return c?y.catch(P=>{if(!this.disposed)if(this.options.handleUnhandledError)this.options.handleUnhandledError(P);else throw P}):(g(f),c=y.then(P=>P&&{bytes:P,view:oe(P),offset:e})),c}checkHoleAgainstWorker(e,r,i){if(Ni(r.start-131072,r.start,e.currentPos,e.targetPos)){e.targetPos=Math.max(e.targetPos,r.end);for(let s=0;s<i.length;s++){let o=i[s];e.pendingSlices.includes(o)||e.pendingSlices.push(o);}return e.running||this.runWorker(e),!0}return !1}checkQueuedReadsAgainstWorker(e){let r=!1;for(let i=0;i<this.queuedReads.length;i++){let n=this.queuedReads[i];if(this.checkHoleAgainstWorker(e,n.hole,n.pendingSlices))this.queuedReads.splice(i,1),i--,r=!0;else if(r)break}}createWorker(e,r,i){if(this.workers.length>=this.options.maxWorkerCount){let s=null,o=null;for(let a=0;a<this.workers.length;a++){let c=this.workers[a];!c.running&&c.pendingSlices.length===0&&(!s||c.age<s.age)&&(o=a,s=c);}if(s)g(o!==null),g(s.pendingSlices.length===0),this.workers.splice(o,1),this.options.onIdleWorkerRemoved?.(s);else return null}let n={startPos:e,currentPos:e,targetPos:r,strictTarget:i,running:!1,aborted:this.disposed,pendingSlices:[],age:this.nextAge++};return this.workers.push(n),n}runWorker(e){g(!e.running),g(e.currentPos<e.targetPos),e.running=!0,e.age=this.nextAge++,this.options.runWorker(e).catch(r=>{if(e.running=!1,e.pendingSlices.length>0)e.pendingSlices.forEach(i=>i.reject(r)),e.pendingSlices.length=0;else if(!e.aborted&&!this.disposed)if(this.options.handleUnhandledError)this.options.handleUnhandledError(r);else throw r}).finally(()=>{if(!e.running&&this.queuedReads.length>0){let r=0;for(let s=1;s<this.queuedReads.length;s++)this.queuedReads[s].age<this.queuedReads[r].age&&(r=s);let i=this.queuedReads[r],n=this.createWorker(i.hole.start,i.hole.end,i.strictTarget);if(!n)return;this.queuedReads.splice(r,1),n.pendingSlices=i.pendingSlices,this.runWorker(n);}});}supplyWorkerData(e,r){g(!e.aborted);let i=e.currentPos,n=i+r.length;this.insertIntoCache({start:i,end:n,bytes:r,view:oe(r),age:this.nextAge++}),e.currentPos+=r.length,e.currentPos>e.targetPos&&(e.targetPos=e.currentPos,this.checkQueuedReadsAgainstWorker(e));for(let s=0;s<e.pendingSlices.length;s++){let o=e.pendingSlices[s],a=Math.max(i,o.start),c=Math.min(n,o.start+o.bytes.length);a<c&&o.bytes.set(r.subarray(a-i,c-i),a-o.start);for(let u=0;u<o.holes.length;u++){let l=o.holes[u];i<=l.start&&n>l.start&&(l.start=n),l.end<=l.start&&(o.holes.splice(u,1),u--);}o.holes.length===0&&(o.resolve(o.bytes),e.pendingSlices.splice(s,1),s--);}for(let s=0;s<this.workers.length;s++){let o=this.workers[s];e===o||o.running||Ni(i,n,o.currentPos,o.targetPos)&&(this.workers.splice(s,1),this.options.onIdleWorkerRemoved?.(o),s--);}}supplyFileSize(e){g(this.fileSize===null),this.fileSize=e;for(let r of this.workers){r.targetPos=Math.min(r.targetPos,e),r.strictTarget=!0;for(let i=0;i<r.pendingSlices.length;i++){let n=r.pendingSlices[i];for(let s of n.holes)if(s.end>e){n.resolve(null),r.pendingSlices.splice(i,1),i--;break}}}for(let r=0;r<this.queuedReads.length;r++){let i=this.queuedReads[r];if(i.hole.start>=e){for(let n of i.pendingSlices)n.resolve(null);this.queuedReads.splice(r,1),r--;}else if(i.hole.end>e){i.hole.end=e,i.strictTarget=!0;for(let n=0;n<i.pendingSlices.length;n++){let s=i.pendingSlices[n];s.start>=e&&(s.resolve(null),i.pendingSlices.splice(n,1),n--);}}}}signalWorkerStoppedRunning(e){e.running=!1,e.aborted||(e.pendingSlices.length=0);}onWorkerFinished(e){let r=this.workers.indexOf(e);g(r!==-1),e.running=!1,this.workers.splice(r,1),this.options.onIdleWorkerRemoved?.(e),this.fileSize===null&&this.supplyFileSize(e.currentPos);for(let i of e.pendingSlices)i.resolve(null);}insertIntoCache(e){if(this.options.maxCacheSize===0)return;let r=de(this.cache,e.start,i=>i.start)+1;if(r>0){let i=this.cache[r-1];if(i.end>=e.end)return;if(i.end>e.start){let n=new Uint8Array(e.end-i.start);n.set(i.bytes,0),n.set(e.bytes,e.start-i.start),this.currentCacheSize+=e.end-i.end,i.bytes=n,i.view=oe(n),i.end=e.end,r--,e=i;}else this.cache.splice(r,0,e),this.currentCacheSize+=e.bytes.length;}else this.cache.splice(r,0,e),this.currentCacheSize+=e.bytes.length;for(let i=r+1;i<this.cache.length;i++){let n=this.cache[i];if(e.end<=n.start)break;if(e.end>=n.end){this.cache.splice(i,1),this.currentCacheSize-=n.bytes.length,i--;continue}let s=new Uint8Array(n.end-e.start);s.set(e.bytes,0),s.set(n.bytes,n.start-e.start),this.currentCacheSize-=e.end-n.start,e.bytes=s,e.view=oe(s),e.end=n.end,this.cache.splice(i,1);break}for(;this.currentCacheSize>this.options.maxCacheSize;){let i=0,n=this.cache[0];for(let s=1;s<this.cache.length;s++){let o=this.cache[s];o.age<n.age&&(i=s,n=o);}if(this.currentCacheSize-n.bytes.length<=this.options.maxCacheSize)break;this.cache.splice(i,1),this.currentCacheSize-=n.bytes.length;}}dispose(){for(let e of this.workers){for(let r of e.pendingSlices)r.reject(new Ce);e.pendingSlices.length=0,e.aborted=!0,e.running||this.options.onIdleWorkerRemoved?.(e);}for(let e of this.queuedReads)for(let r of e.pendingSlices)r.reject(new Ce);this.workers.length=0,this.cache.length=0,this.queuedReads.length=0,this.disposed=!0;}};var Cn=class extends $e{constructor(e,r,i){if(super(),this._ref=null,e._disposed)throw new Error("Cannot create a slice of a disposed source.");this._baseSource=e,this._offset=r,this._length=i??null;}_getFileSize(){let e=this._baseSource._getFileSize();return e===void 0?this._length!==null?this._length:void 0:e===null?this._length!==null?this._length:null:fe(e-this._offset,0,this._length??1/0)}_read(e,r,i,n){if(this._length!==null&&r>this._length)return null;let s=this._baseSource._read(this._offset+e,this._offset+r,this._offset+i,this._offset+n),o=a=>a?(a.offset-=this._offset,a):null;return U(s)?s.then(o):o(s)}_dispose(){this._ref?.free();}ref(){return this._ref??(this._ref=this._baseSource.ref()),super.ref()}};var ir=class{constructor(){this._isIsobmff=!1;}},pi=class extends ir{constructor(){super(...arguments),this._isIsobmff=!0;}async _getMajorBrand(e){let r=e._reader.requestSlice(0,12);if(U(r)&&(r=await r),!r)return null;r.skip(4);let i=Ne(r,4);return i!=="ftyp"&&i!=="styp"?null:Ne(r,4)}_createDemuxer(e){return new pn(e)}},gi=class extends pi{async _canReadInput(e){let r=await this._getMajorBrand(e);if(r!==null)return r!=="qt  ";let i=0;for(let n=0;n<10;n++){let s=e._reader.requestSlice(i,8);if(U(s)&&(s=await s),!s)return !1;let o=O(s),a=8;if(o===1){let u=e._reader.requestSlice(i+8,8);if(U(u)&&(u=await u),!u)return !1;o=Be(u),a=16;}if(o<a)return !1;let c=Ne(s,4);if(c==="moof"||c==="sidx")return !0;if(c==="emsg"||c==="prft"||c==="free")i+=o;else return !1}return !1}get name(){return "MP4"}get mimeType(){return "video/mp4"}},wi=class extends pi{async _canReadInput(e){return await this._getMajorBrand(e)==="qt  "}get name(){return "QuickTime File Format"}get mimeType(){return "video/quicktime"}},Or=class extends ir{async isSupportedEBMLOfDocType(e,r){let i=e._reader.requestSlice(0,nt);if(U(i)&&(i=await i),!i)return !1;let n=ks(i);if(n===null||n<1||n>8||Y(i,n)!==_.EBML)return !1;let o=Ss(i);if(typeof o!="number")return !1;let a=e._reader.requestSlice(i.filePos,o);if(U(a)&&(a=await a),!a)return !1;let c=i.filePos;for(;a.filePos<=c+o-We;){let u=st(a);if(!u)break;let{id:l,size:d}=u,f=a.filePos;if(d===void 0)return !1;switch(l){case _.EBMLVersion:if(Y(a,d)!==1)return !1;break;case _.EBMLReadVersion:if(Y(a,d)!==1)return !1;break;case _.DocType:if(Kt(a,d)!==r)return !1;break;case _.DocTypeVersion:if(Y(a,d)>4)return !1;break}a.filePos=f+d;}return !0}_canReadInput(e){return this.isSupportedEBMLOfDocType(e,"matroska")}_createDemuxer(e){return new xn(e)}get name(){return "Matroska"}get mimeType(){return "video/x-matroska"}},yi=class extends Or{_canReadInput(e){return this.isSupportedEBMLOfDocType(e,"webm")}get name(){return "WebM"}get mimeType(){return "video/webm"}};var va=(t,e)=>{if(!t||typeof t!="object")throw new TypeError(`${e}, when provided, must be an object.`);if(t.isobmff!==void 0){if(!t.isobmff||typeof t.isobmff!="object")throw new TypeError(`${e}.isobmff, when provided, must be an object.`);if(t.isobmff.resolveKeyId!==void 0&&typeof t.isobmff.resolveKeyId!="function")throw new TypeError(`${e}.isobmff.resolveKeyId, when provided, must be a function.`)}if(t.hls!==void 0){if(!t.hls||typeof t.hls!="object")throw new TypeError(`${e}.hls, when provided, must be an object.`);if(t.hls.offsetTimestampsByDateTime!==void 0&&typeof t.hls.offsetTimestampsByDateTime!="boolean")throw new TypeError(`${e}.hls.offsetTimestampsByDateTime, when provided, must be a boolean.`)}};var kl=function(t,e,r){if(e!=null){if(typeof e!="object"&&typeof e!="function")throw new TypeError("Object expected.");var i,n;if(r){if(!Symbol.asyncDispose)throw new TypeError("Symbol.asyncDispose is not defined.");i=e[Symbol.asyncDispose];}if(i===void 0){if(!Symbol.dispose)throw new TypeError("Symbol.dispose is not defined.");i=e[Symbol.dispose],r&&(n=i);}if(typeof i!="function")throw new TypeError("Object not disposable.");n&&(i=function(){try{n.call(this);}catch(s){return Promise.reject(s)}}),t.stack.push({value:e,dispose:i,async:r});}else r&&t.stack.push({async:!0});return e},Sl=(function(t){return function(e){function r(o){e.error=e.hasError?new t(o,e.error,"An error was suppressed during disposal."):o,e.hasError=!0;}var i,n=0;function s(){for(;i=e.stack.pop();)try{if(!i.async&&n===1)return n=0,e.stack.push(i),Promise.resolve().then(s);if(i.dispose){var o=i.dispose.call(i.value);if(i.async)return n|=2,Promise.resolve(o).then(s,function(a){return r(a),s()})}else n|=1;}catch(a){r(a);}if(n===1)return e.hasError?Promise.reject(e.error):Promise.resolve();if(e.hasError)throw e.error}return s()}})(typeof SuppressedError=="function"?SuppressedError:function(t,e,r){var i=new Error(r);return i.name="SuppressedError",i.error=t,i.suppressed=e,i});Tr();var Pa=-1/0,Ia=-1/0,Si=null;typeof FinalizationRegistry<"u"&&(Si=new FinalizationRegistry(t=>{let e=performance.now();t.type==="video"?(e-Pa>=1e3&&($._error("A VideoSample was garbage collected without first being closed. For proper resource management, make sure to call close() on all your VideoSamples as soon as you're done using them."),Pa=e),typeof VideoFrame<"u"&&t.data instanceof VideoFrame&&t.data.close()):(e-Ia>=1e3&&($._error("An AudioSample was garbage collected without first being closed. For proper resource management, make sure to call close() on all your AudioSamples as soon as you're done using them."),Ia=e),typeof AudioData<"u"&&t.data instanceof AudioData&&t.data.close());}));var Ut=class{constructor(){this._referenceCount=0,this._lastAllocationBuffer=null;}},Bs=["I420","I420P10","I420P12","I420A","I420AP10","I420AP12","I422","I422P10","I422P12","I422A","I422AP10","I422AP12","I444","I444P10","I444P12","I444A","I444AP10","I444AP12","NV12","RGBA","RGBX","BGRA","BGRX"],xl=new Set(Bs),Xe=class t{get codedWidth(){return this.visibleRect.width}get codedHeight(){return this.visibleRect.height}get displayWidth(){return this.rotation%180===0?this.squarePixelWidth:this.squarePixelHeight}get displayHeight(){return this.rotation%180===0?this.squarePixelHeight:this.squarePixelWidth}get microsecondTimestamp(){return Math.trunc(mt*this.timestamp)}get microsecondDuration(){return Math.trunc(mt*this.duration)}get hasAlpha(){return this.format&&this.format.includes("A")}constructor(e,r){if(this._closed=!1,e instanceof ArrayBuffer||typeof SharedArrayBuffer<"u"&&e instanceof SharedArrayBuffer||ArrayBuffer.isView(e)){if(!r||typeof r!="object")throw new TypeError("init must be an object.");if(r.format===void 0||!xl.has(r.format))throw new TypeError("init.format must be one of: "+Bs.join(", "));if(!Number.isInteger(r.codedWidth)||r.codedWidth<=0)throw new TypeError("init.codedWidth must be a positive integer.");if(!Number.isInteger(r.codedHeight)||r.codedHeight<=0)throw new TypeError("init.codedHeight must be a positive integer.");if(r.rotation!==void 0&&![0,90,180,270].includes(r.rotation))throw new TypeError("init.rotation, when provided, must be 0, 90, 180, or 270.");if(!Number.isFinite(r.timestamp))throw new TypeError("init.timestamp must be a number.");if(r.duration!==void 0&&(!Number.isFinite(r.duration)||r.duration<0))throw new TypeError("init.duration, when provided, must be a non-negative number.");if(r.layout!==void 0){if(!Array.isArray(r.layout))throw new TypeError("init.layout, when provided, must be an array.");for(let s of r.layout){if(!s||typeof s!="object"||Array.isArray(s))throw new TypeError("Each entry in init.layout must be an object.");if(!Number.isInteger(s.offset)||s.offset<0)throw new TypeError("plane.offset must be a non-negative integer.");if(!Number.isInteger(s.stride)||s.stride<0)throw new TypeError("plane.stride must be a non-negative integer.")}}if(r.visibleRect!==void 0&&Li(r.visibleRect,"init.visibleRect"),r.displayWidth!==void 0&&(!Number.isInteger(r.displayWidth)||r.displayWidth<=0))throw new TypeError("init.displayWidth, when provided, must be a positive integer.");if(r.displayHeight!==void 0&&(!Number.isInteger(r.displayHeight)||r.displayHeight<=0))throw new TypeError("init.displayHeight, when provided, must be a positive integer.");if(r.displayWidth!==void 0!=(r.displayHeight!==void 0))throw new TypeError("init.displayWidth and init.displayHeight must be either both provided or both omitted.");this.format=r.format,this.rotation=r.rotation??0,this.timestamp=r.timestamp,this.duration=r.duration??0;let i=r.layout??El(r.format,r.codedWidth,r.codedHeight),n=r.colorSpace??null;n===null&&(this.format==="RGBA"||this.format==="RGBX"||this.format==="BGRA"||this.format==="BGRX"?n={primaries:"bt709",transfer:"iec61966-2-1",matrix:"rgb",fullRange:!0}:n={primaries:"bt709",transfer:"bt709",matrix:"bt709",fullRange:!1}),this.visibleRect={left:r.visibleRect?.left??0,top:r.visibleRect?.top??0,width:r.visibleRect?.width??r.codedWidth,height:r.visibleRect?.height??r.codedHeight},r.displayWidth!==void 0?(this.squarePixelWidth=this.rotation%180===0?r.displayWidth:r.displayHeight,this.squarePixelHeight=this.rotation%180===0?r.displayHeight:r.displayWidth):(this.squarePixelWidth=this.visibleRect.width,this.squarePixelHeight=this.visibleRect.height),this._data=r._doNotCopy?_e(e):_e(e).slice(),this._layout=i,this.colorSpace=new ki(n);}else if(typeof VideoFrame<"u"&&e instanceof VideoFrame){if(r?.rotation!==void 0&&![0,90,180,270].includes(r.rotation))throw new TypeError("init.rotation, when provided, must be 0, 90, 180, or 270.");if(r?.timestamp!==void 0&&!Number.isFinite(r?.timestamp))throw new TypeError("init.timestamp, when provided, must be a number.");if(r?.duration!==void 0&&(!Number.isFinite(r.duration)||r.duration<0))throw new TypeError("init.duration, when provided, must be a non-negative number.");r?.visibleRect!==void 0&&Li(r.visibleRect,"init.visibleRect"),this._data=e,this._layout=null,this.format=e.format,this.visibleRect={left:e.visibleRect?.x??0,top:e.visibleRect?.y??0,width:e.visibleRect?.width??e.codedWidth,height:e.visibleRect?.height??e.codedHeight},this.rotation=r?.rotation??0,this.squarePixelWidth=e.displayWidth,this.squarePixelHeight=e.displayHeight,this.timestamp=r?.timestamp??e.timestamp/1e6,this.duration=r?.duration??(e.duration??0)/1e6,this.colorSpace=new ki(e.colorSpace);}else if(typeof HTMLImageElement<"u"&&e instanceof HTMLImageElement||typeof SVGImageElement<"u"&&e instanceof SVGImageElement||typeof ImageBitmap<"u"&&e instanceof ImageBitmap||typeof HTMLVideoElement<"u"&&e instanceof HTMLVideoElement||typeof HTMLCanvasElement<"u"&&e instanceof HTMLCanvasElement||typeof OffscreenCanvas<"u"&&e instanceof OffscreenCanvas){if(!r||typeof r!="object")throw new TypeError("init must be an object.");if(r.rotation!==void 0&&![0,90,180,270].includes(r.rotation))throw new TypeError("init.rotation, when provided, must be 0, 90, 180, or 270.");if(!Number.isFinite(r.timestamp))throw new TypeError("init.timestamp must be a number.");if(r.duration!==void 0&&(!Number.isFinite(r.duration)||r.duration<0))throw new TypeError("init.duration, when provided, must be a non-negative number.");if(r.visibleRect!==void 0&&Li(r.visibleRect,"init.visibleRect"),typeof VideoFrame<"u")return new t(new VideoFrame(e,{timestamp:Math.trunc(r.timestamp*mt),duration:Math.trunc((r.duration??0)*mt)||void 0,visibleRect:r.visibleRect&&{x:r.visibleRect.left,y:r.visibleRect.top,width:r.visibleRect.width,height:r.visibleRect.height}}),r);let i=0,n=0;if("naturalWidth"in e?(i=e.naturalWidth,n=e.naturalHeight):"videoWidth"in e?(i=e.videoWidth,n=e.videoHeight):"width"in e&&(i=Number(e.width),n=Number(e.height)),!i||!n)throw new TypeError("Could not determine dimensions.");let s=r.visibleRect??{left:0,top:0,width:i,height:n},o=new OffscreenCanvas(s.width,s.height),a=o.getContext("2d",{alpha:Yr(),willReadFrequently:!0});if(!a)throw new Error("OffscreenCanvas must have support for the '2d' context in order to create a VideoSample from this data.");a.drawImage(e,-s.left,-s.top),this._data=o,this._layout=null,this.format="RGBX",this.visibleRect={left:0,top:0,width:s.width,height:s.height},this.squarePixelWidth=s.width,this.squarePixelHeight=s.height,this.rotation=r.rotation??0,this.timestamp=r.timestamp,this.duration=r.duration??0,this.colorSpace=new ki({matrix:"rgb",primaries:"bt709",transfer:"iec61966-2-1",fullRange:!0});}else if(e instanceof Ut){if(!r||typeof r!="object")throw new TypeError("init must be an object.");if(r.rotation!==void 0&&![0,90,180,270].includes(r.rotation))throw new TypeError("init.rotation, when provided, must be 0, 90, 180, or 270.");if(!Number.isFinite(r.timestamp))throw new TypeError("init.timestamp must be a number.");if(r.duration!==void 0&&(!Number.isFinite(r.duration)||r.duration<0))throw new TypeError("init.duration, when provided, must be a non-negative number.");if(this._data=e,e._referenceCount++,this.format=e.getFormat(),this.format!==null&&!Bs.includes(this.format))throw new TypeError("getFormat() must return a VideoSamplePixelFormat or null.");if(this.visibleRect={left:0,top:0,width:e.getCodedWidth(),height:e.getCodedHeight()},!Number.isInteger(this.visibleRect.width)||this.visibleRect.width<=0)throw new TypeError("getCodedWidth() must return a positive integer.");if(!Number.isInteger(this.visibleRect.height)||this.visibleRect.height<=0)throw new TypeError("getCodedHeight() must return a positive integer.");if(this.squarePixelWidth=e.getSquarePixelWidth(),!Number.isInteger(this.squarePixelWidth)||this.squarePixelWidth<=0)throw new TypeError("getSquarePixelWidth() must return a positive integer.");if(this.squarePixelHeight=e.getSquarePixelHeight(),!Number.isInteger(this.squarePixelHeight)||this.squarePixelHeight<=0)throw new TypeError("getSquarePixelHeight() must return a positive integer.");this.rotation=r.rotation??0,this.timestamp=r.timestamp,this.duration=r.duration??0,this.colorSpace=e.getColorSpace();}else throw new TypeError("Invalid data type: Must be a BufferSource, CanvasImageSource, or VideoSampleResource.");this.encodeOptions=r?.encodeOptions??{},this.pixelAspectRatio=Lt({num:this.squarePixelWidth*this.codedHeight,den:this.squarePixelHeight*this.codedWidth}),Si?.register(this,{type:"video",data:this._data},this);}clone(){if(this._closed)throw new Error("VideoSample is closed.");return g(this._data!==null),this._data instanceof Ut?new t(this._data,{timestamp:this.timestamp,duration:this.duration,rotation:this.rotation,encodeOptions:this.encodeOptions}):Ti(this._data)?new t(this._data.clone(),{timestamp:this.timestamp,duration:this.duration,rotation:this.rotation,encodeOptions:this.encodeOptions}):this._data instanceof Uint8Array?(g(this._layout),new t(this._data,{format:this.format,layout:this._layout,codedWidth:this.codedWidth,codedHeight:this.codedHeight,timestamp:this.timestamp,duration:this.duration,colorSpace:this.colorSpace,rotation:this.rotation,visibleRect:this.visibleRect,displayWidth:this.displayWidth,displayHeight:this.displayHeight,encodeOptions:this.encodeOptions,_doNotCopy:!0})):new t(this._data,{format:this.format,codedWidth:this.codedWidth,codedHeight:this.codedHeight,timestamp:this.timestamp,duration:this.duration,colorSpace:this.colorSpace,rotation:this.rotation,visibleRect:this.visibleRect,displayWidth:this.displayWidth,displayHeight:this.displayHeight,encodeOptions:this.encodeOptions})}close(){this._closed||(Si?.unregister(this),this._data instanceof Ut?(this._data._referenceCount--,this._data._referenceCount===0&&this._data.close()):Ti(this._data)?this._data.close():this._data=null,this._closed=!0);}allocationSize(e={}){if(Ba(e),this._closed)throw new Error("VideoSample is closed.");if((e.format??this.format)==null)throw new Error("Cannot get allocation size when format is null.");return Ti(this._data)?this._data.allocationSize(e):Ma(this,e).allocationSize}async copyTo(e,r={}){if(!yr(e))throw new TypeError("destination must be an ArrayBuffer or an ArrayBuffer view.");if(Ba(r),this._closed)throw new Error("VideoSample is closed.");if((r.format??this.format)==null)throw new Error("Cannot copy video sample data when format is null.");if(g(this._data!==null),Ti(this._data))return this._data.copyTo(e,r);if(r.format&&!["RGBA","RGBX","BGRA","BGRX"].includes(this.format)&&["RGBA","RGBX","BGRA","BGRX"].includes(r.format))if(this._data instanceof Ut){let u={stack:[],error:void 0,hasError:!1};try{let l=kl(u,await this._data.toRgbSample({timestamp:this.timestamp,duration:this.duration,rotation:this.rotation},r.colorSpace??"srgb"),!1);if(!(l instanceof t))throw new TypeError("toRgbSample() must return a VideoSample.");if(!["RGBA","RGBX","BGRA","BGRX"].includes(l.format))throw new Error(`Sample returned by toRgbSample was expected to have an RGB format, got '${l.format}' instead.`);return await l.copyTo(e,r)}catch(l){u.error=l,u.hasError=!0;}finally{Sl(u);}}else {if(typeof VideoFrame>"u")throw new Error("For this sample, converting from a non-RGB to an RGB format requires VideoFrame to be defined.");let u=this.toVideoFrame(),l=await u.copyTo(e,r);return u.close(),l}let i=Ma(this,r);g(this.format);let n=_e(e);if(n.byteLength<i.allocationSize)throw new TypeError(`Destination buffer too small. Required: ${i.allocationSize}, Available: ${n.byteLength}`);let s=vn(this.format),o;if(this._data instanceof Ut){let u=this._data.getDataPlanes();if(U(u)&&(u=await u),!Array.isArray(u)||u.some(l=>!(l.data instanceof Uint8Array)||!Number.isInteger(l.stride)||l.stride<0))throw new TypeError('getDataPlanes() must return an array of objects with a Uint8Array "data" property and a non-negative integer "stride" property.');o=u;}else if(this._data instanceof Uint8Array)g(this._layout),g(this._layout.length===s.length),o=this._layout.map((u,l)=>{let d=Math.ceil(this.codedHeight/s[l].heightDivisor);return {data:this._data.subarray(u.offset,u.offset+u.stride*d),stride:u.stride}});else {let l=this._data.getContext("2d");g(l);let d=l.getImageData(0,0,this.codedWidth,this.codedHeight);o=[{data:_e(d.data),stride:4*this.codedWidth}];}let a=[],c=s.length;for(let u=0;u<c;u++){let l=i.computedLayouts[u],d=o[u].stride,f=o[u].data,m=l.sourceTop*d;m+=l.sourceLeftBytes;let p=l.destinationOffset,b=l.sourceWidthBytes,y={offset:p,stride:l.destinationStride};for(let w=0;w<l.sourceHeight;w++){if(m+b>f.byteLength)throw new Error("Source buffer OOB read.");if(p+b>n.byteLength)throw new Error("Destination buffer OOB write.");let T=f.subarray(m,m+b);n.set(T,p),m+=d,p+=l.destinationStride;}a.push(y);}if(r.format!==void 0){let u=this.format.startsWith("RGB")!==r.format.startsWith("RGB"),l=this.format.includes("X")&&r.format.includes("A");if(u||l)for(let d=0;d<i.allocationSize;d+=4){if(u){let f=n[d],m=n[d+2];n[d]=m,n[d+2]=f;}l&&(n[d+3]=255);}}return a}toVideoFrame(){if(this._closed)throw new Error("VideoSample is closed.");if(g(this._data!==null),this._data instanceof Ut){if(this.format===null)throw new Error("Cannot convert a VideoSampleResource-backed VideoSample to VideoFrame if format is null.");let e=this._data.getDataPlanes();if(U(e))throw new Error("Cannot convert a VideoSampleResource-backed VideoSample to VideoFrame if getDataPlanes() returns a promise.");let r=e.reduce((o,a)=>o+a.data.byteLength,0),i=new Uint8Array(r),n=0,s=[];for(let o of e)i.set(o.data,n),s.push(n),n+=o.data.byteLength;return new VideoFrame(i,{format:this.format,layout:e.map((o,a)=>({offset:s[a],stride:o.stride})),codedWidth:this.codedWidth,codedHeight:this.codedHeight,timestamp:this.microsecondTimestamp,duration:this.microsecondDuration,colorSpace:this.colorSpace,visibleRect:this.visibleRect,displayWidth:this.squarePixelWidth,displayHeight:this.squarePixelHeight})}else return Ti(this._data)?new VideoFrame(this._data,{timestamp:this.microsecondTimestamp,duration:this.microsecondDuration||void 0}):this._data instanceof Uint8Array?(g(this._layout),new VideoFrame(this._data,{format:this.format,codedWidth:this.codedWidth,codedHeight:this.codedHeight,layout:this._layout,timestamp:this.microsecondTimestamp,duration:this.microsecondDuration||void 0,colorSpace:this.colorSpace,visibleRect:this.visibleRect,displayWidth:this.squarePixelWidth,displayHeight:this.squarePixelHeight})):new VideoFrame(this._data,{timestamp:this.microsecondTimestamp,duration:this.microsecondDuration||void 0})}draw(e,r,i,n,s,o,a,c,u){let l=0,d=0,f=this.displayWidth,m=this.displayHeight,p=0,b=0,y=this.displayWidth,w=this.displayHeight;if(o!==void 0?(l=r,d=i,f=n,m=s,p=o,b=a,c!==void 0?(y=c,w=u):(y=f,w=m)):(p=r,b=i,n!==void 0&&(y=n,w=s)),!(typeof CanvasRenderingContext2D<"u"&&e instanceof CanvasRenderingContext2D||typeof OffscreenCanvasRenderingContext2D<"u"&&e instanceof OffscreenCanvasRenderingContext2D))throw new TypeError("context must be a CanvasRenderingContext2D or OffscreenCanvasRenderingContext2D.");if(!Number.isFinite(l))throw new TypeError("sx must be a number.");if(!Number.isFinite(d))throw new TypeError("sy must be a number.");if(!Number.isFinite(f)||f<0)throw new TypeError("sWidth must be a non-negative number.");if(!Number.isFinite(m)||m<0)throw new TypeError("sHeight must be a non-negative number.");if(!Number.isFinite(p))throw new TypeError("dx must be a number.");if(!Number.isFinite(b))throw new TypeError("dy must be a number.");if(!Number.isFinite(y)||y<0)throw new TypeError("dWidth must be a non-negative number.");if(!Number.isFinite(w)||w<0)throw new TypeError("dHeight must be a non-negative number.");if(this._closed)throw new Error("VideoSample is closed.");({sx:l,sy:d,sWidth:f,sHeight:m}=this._rotateSourceRegion(l,d,f,m,this.rotation));let T=this.toCanvasImageSource();e.save();let A=p+y/2,E=b+w/2;e.translate(A,E),e.rotate(this.rotation*Math.PI/180);let P=this.rotation%180===0?1:y/w;e.scale(1/P,P),e.drawImage(T,l,d,f,m,-y/2,-w/2,y,w),e.restore();}drawWithFit(e,r){if(!(typeof CanvasRenderingContext2D<"u"&&e instanceof CanvasRenderingContext2D||typeof OffscreenCanvasRenderingContext2D<"u"&&e instanceof OffscreenCanvasRenderingContext2D))throw new TypeError("context must be a CanvasRenderingContext2D or OffscreenCanvasRenderingContext2D.");if(!r||typeof r!="object")throw new TypeError("options must be an object.");if(!["fill","contain","cover"].includes(r.fit))throw new TypeError("options.fit must be 'fill', 'contain', or 'cover'.");if(r.rotation!==void 0&&![0,90,180,270].includes(r.rotation))throw new TypeError("options.rotation, when provided, must be 0, 90, 180, or 270.");r.crop!==void 0&&or(r.crop,"options.");let i=e.canvas.width,n=e.canvas.height,s=r.rotation??this.rotation,[o,a]=s%180===0?[this.squarePixelWidth,this.squarePixelHeight]:[this.squarePixelHeight,this.squarePixelWidth],c=r.crop;c&&(c=xi(c,o,a));let u,l,d,f,{sx:m,sy:p,sWidth:b,sHeight:y}=this._rotateSourceRegion(r.crop?.left??0,r.crop?.top??0,r.crop?.width??o,r.crop?.height??a,s);if(r.fit==="fill")u=0,l=0,d=i,f=n;else {let[T,A]=r.crop?[r.crop.width,r.crop.height]:[o,a],E=r.fit==="contain"?Math.min(i/T,n/A):Math.max(i/T,n/A);d=T*E,f=A*E,u=(i-d)/2,l=(n-f)/2;}e.save();let w=s%180===0?1:d/f;e.translate(i/2,n/2),e.rotate(s*Math.PI/180),e.scale(1/w,w),e.translate(-i/2,-n/2),e.drawImage(this.toCanvasImageSource(),m,p,b,y,u,l,d,f),e.restore();}_rotateSourceRegion(e,r,i,n,s){return s===90?[e,r,i,n]=[r,this.squarePixelHeight-e-i,n,i]:s===180?[e,r]=[this.squarePixelWidth-e-i,this.squarePixelHeight-r-n]:s===270&&([e,r,i,n]=[this.squarePixelWidth-r-n,e,n,i]),{sx:e,sy:r,sWidth:i,sHeight:n}}_drawWithFitAndMipmapping(e,r,i){let n=e.width,s=e.height,[o,a]=i.rotation%180===0?[this.squarePixelWidth,this.squarePixelHeight]:[this.squarePixelHeight,this.squarePixelWidth],c=i.crop?i.crop.width:o,u=i.crop?i.crop.height:a,l=0;2*n<c&&2*s<u&&(l=Math.floor(Math.log2(Math.min(c/n,u/s))));let d=n*2**l,f=s*2**l,{canvas:m,context:p,isNew:b}=l>0?Fa(d,f):{canvas:e,context:r,isNew:i.targetIsFresh};p.imageSmoothingQuality="high",i.fillBlack?(p.fillStyle="black",p.fillRect(0,0,d,f)):b||p.clearRect(0,0,d,f),this.drawWithFit(p,{fit:i.fit,rotation:i.rotation,crop:i.crop}),p.globalCompositeOperation="copy";for(let y=l;y>1;y--){let w=n*2**y,T=s*2**y;p.drawImage(m,0,0,w,T,0,0,w/2,T/2);}p.globalCompositeOperation="source-over",l>0&&(r.imageSmoothingQuality="high",r.globalCompositeOperation="copy",r.drawImage(m,0,0,2*n,2*s,0,0,n,s),r.globalCompositeOperation="source-over");}toCanvasImageSource(){if(this._closed)throw new Error("VideoSample is closed.");if(g(this._data!==null),this._data instanceof Ut||this._data instanceof Uint8Array){let e=this.toVideoFrame();return queueMicrotask(()=>e.close()),e}else return this._data}async transform(e){if(!e||typeof e!="object")throw new TypeError("options must be an object.");if(e.width!==void 0&&(!Number.isInteger(e.width)||e.width<=0))throw new TypeError("options.width, when provided, must be a positive integer.");if(e.height!==void 0&&(!Number.isInteger(e.height)||e.height<=0))throw new TypeError("options.height, when provided, must be a positive integer.");if(e.roundDimensionsTo!==void 0&&(!Number.isInteger(e.roundDimensionsTo)||e.roundDimensionsTo<=0))throw new TypeError("options.roundDimensionsTo, when provided, must be a positive integer.");if(e.fit!==void 0&&!["fill","contain","cover"].includes(e.fit))throw new TypeError('options.fit, when provided, must be one of "fill", "contain", or "cover".');if(e.width!==void 0&&e.height!==void 0&&e.fit===void 0)throw new TypeError("When both options.width and options.height are provided, options.fit must also be provided.");if(e.rotate!==void 0&&![0,90,180,270].includes(e.rotate))throw new TypeError("options.rotate, when provided, must be 0, 90, 180 or 270.");if(e.crop!==void 0&&or(e.crop,"options."),e.alpha!==void 0&&!["keep","discard"].includes(e.alpha))throw new TypeError("options.alpha, when provided, must be 'keep' or 'discard'.");let r=kt(this.rotation+(e.rotate??0)),[i,n]=r%180===0?[this.squarePixelWidth,this.squarePixelHeight]:[this.squarePixelHeight,this.squarePixelWidth],s=e.crop;s&&(s=xi(s,i,n));let o=s?s.width:i,a=s?s.height:n,c=o/a,u,l;e.width!==void 0&&e.height===void 0?(u=e.width,l=u/c):e.width===void 0&&e.height!==void 0?(l=e.height,u=l*c):e.width!==void 0&&e.height!==void 0?(u=e.width,l=e.height):(u=o,l=a),u=Xr(u,e.roundDimensionsTo??1),l=Xr(l,e.roundDimensionsTo??1);let d={width:u,height:l,fit:e.fit??"fill",rotation:r,crop:s??{left:0,top:0,width:i,height:n},alpha:e.alpha??"keep"};for(let b of _l){let y=b(this,d);if(U(y)&&(y=await y),y!==null)return y}let{canvas:f,context:m,isNew:p}=Fa(d.width,d.height);return this._drawWithFitAndMipmapping(f,m,{fit:d.fit,rotation:d.rotation,crop:d.crop,targetIsFresh:p,fillBlack:d.alpha==="discard"}),new t(f,{timestamp:this.timestamp,duration:this.duration,rotation:0})}setRotation(e){if(![0,90,180,270].includes(e))throw new TypeError("newRotation must be 0, 90, 180, or 270.");this.rotation=e;}setTimestamp(e){if(!Number.isFinite(e))throw new TypeError("newTimestamp must be a number.");this.timestamp=e;}setDuration(e){if(!Number.isFinite(e)||e<0)throw new TypeError("newDuration must be a non-negative number.");this.duration=e;}setEncodeOptions(e){if(!e||typeof e!="object")throw new TypeError("newEncodeOptions must be an object.");this.encodeOptions=e;}[Symbol.dispose](){this.close();}},_l=[];var Cl=3,bi=[],Ra=0,Fa=(t,e)=>{for(let n of bi)if(n.canvas.width===t&&n.canvas.height===e)return n.age=Ra++,{canvas:n.canvas,context:n.context,isNew:!1};let r;if(typeof OffscreenCanvas<"u")r=new OffscreenCanvas(t,e);else {if(typeof window>"u"||typeof document>"u")throw new Error("Cannot transform VideoSamples in this environment. Either run in an environment with OffscreenCanvas or HTMLCanvasElement, or supply a custom VideoSample transformer using registerVideoSampleTransformer().");r=document.createElement("canvas"),r.width=t,r.height=e;}let i=r.getContext("2d",{alpha:!0,willReadFrequently:!1});if(!i)throw new Error("The '2d' canvas context is required to transform VideoSamples. Register a custom transformer using registerVideoSampleTransformer to work around this limitation.");return bi.length>=Cl&&bi.splice(qi(bi,n=>n.age),1),bi.push({canvas:r,context:i,age:Ra++}),{canvas:r,context:i,isNew:!0}},ki=class{constructor(e){if(e!==void 0){if(!e||typeof e!="object")throw new TypeError("init.colorSpace, when provided, must be an object.");let r=Object.keys(St);if(e.primaries!=null&&!r.includes(e.primaries))throw new TypeError(`init.colorSpace.primaries, when provided, must be one of ${r.join(", ")}.`);let i=Object.keys(xt);if(e.transfer!=null&&!i.includes(e.transfer))throw new TypeError(`init.colorSpace.transfer, when provided, must be one of ${i.join(", ")}.`);let n=Object.keys(_t);if(e.matrix!=null&&!n.includes(e.matrix))throw new TypeError(`init.colorSpace.matrix, when provided, must be one of ${n.join(", ")}.`);if(e.fullRange!=null&&typeof e.fullRange!="boolean")throw new TypeError("init.colorSpace.fullRange, when provided, must be a boolean.")}this.primaries=e?.primaries??null,this.transfer=e?.transfer??null,this.matrix=e?.matrix??null,this.fullRange=e?.fullRange??null;}toJSON(){return {primaries:this.primaries,transfer:this.transfer,matrix:this.matrix,fullRange:this.fullRange}}},Ti=t=>typeof VideoFrame<"u"&&t instanceof VideoFrame,xi=(t,e,r)=>{let i=Math.min(t.left,e),n=Math.min(t.top,r),s=Math.min(t.width,e-i),o=Math.min(t.height,r-n);return g(s>=0),g(o>=0),{left:i,top:n,width:s,height:o}},or=(t,e)=>{if(!t||typeof t!="object")throw new TypeError(e+"crop, when provided, must be an object.");if(!Number.isInteger(t.left)||t.left<0)throw new TypeError(e+"crop.left must be a non-negative integer.");if(!Number.isInteger(t.top)||t.top<0)throw new TypeError(e+"crop.top must be a non-negative integer.");if(!Number.isInteger(t.width)||t.width<0)throw new TypeError(e+"crop.width must be a non-negative integer.");if(!Number.isInteger(t.height)||t.height<0)throw new TypeError(e+"crop.height must be a non-negative integer.")},Ba=t=>{if(!t||typeof t!="object")throw new TypeError("options must be an object.");if(t.colorSpace!==void 0&&!["display-p3","srgb"].includes(t.colorSpace))throw new TypeError("options.colorSpace, when provided, must be 'display-p3' or 'srgb'.");if(t.format!==void 0&&typeof t.format!="string")throw new TypeError("options.format, when provided, must be a string.");if(t.layout!==void 0){if(!Array.isArray(t.layout))throw new TypeError("options.layout, when provided, must be an array.");for(let e of t.layout){if(!e||typeof e!="object")throw new TypeError("Each entry in options.layout must be an object.");if(!Number.isInteger(e.offset)||e.offset<0)throw new TypeError("plane.offset must be a non-negative integer.");if(!Number.isInteger(e.stride)||e.stride<0)throw new TypeError("plane.stride must be a non-negative integer.")}}if(t.rect!==void 0){if(!t.rect||typeof t.rect!="object")throw new TypeError("options.rect, when provided, must be an object.");if(t.rect.x!==void 0&&(!Number.isInteger(t.rect.x)||t.rect.x<0))throw new TypeError("options.rect.x, when provided, must be a non-negative integer.");if(t.rect.y!==void 0&&(!Number.isInteger(t.rect.y)||t.rect.y<0))throw new TypeError("options.rect.y, when provided, must be a non-negative integer.");if(t.rect.width!==void 0&&(!Number.isInteger(t.rect.width)||t.rect.width<0))throw new TypeError("options.rect.width, when provided, must be a non-negative integer.");if(t.rect.height!==void 0&&(!Number.isInteger(t.rect.height)||t.rect.height<0))throw new TypeError("options.rect.height, when provided, must be a non-negative integer.")}},El=(t,e,r)=>{let i=vn(t),n=[],s=0;for(let o of i){let a=Math.ceil(e/o.widthDivisor),c=Math.ceil(r/o.heightDivisor),u=a*o.sampleBytes,l=u*c;n.push({offset:s,stride:u}),s+=l;}return n},vn=t=>{let e=(r,i,n,s,o)=>{let a=[{sampleBytes:r,widthDivisor:1,heightDivisor:1},{sampleBytes:i,widthDivisor:n,heightDivisor:s},{sampleBytes:i,widthDivisor:n,heightDivisor:s}];return o&&a.push({sampleBytes:r,widthDivisor:1,heightDivisor:1}),a};switch(t){case "I420":return e(1,1,2,2,!1);case "I420P10":case "I420P12":return e(2,2,2,2,!1);case "I420A":return e(1,1,2,2,!0);case "I420AP10":case "I420AP12":return e(2,2,2,2,!0);case "I422":return e(1,1,2,1,!1);case "I422P10":case "I422P12":return e(2,2,2,1,!1);case "I422A":return e(1,1,2,1,!0);case "I422AP10":case "I422AP12":return e(2,2,2,1,!0);case "I444":return e(1,1,1,1,!1);case "I444P10":case "I444P12":return e(2,2,1,1,!1);case "I444A":return e(1,1,1,1,!0);case "I444AP10":case "I444AP12":return e(2,2,1,1,!0);case "NV12":return [{sampleBytes:1,widthDivisor:1,heightDivisor:1},{sampleBytes:2,widthDivisor:2,heightDivisor:2}];case "RGBA":case "RGBX":case "BGRA":case "BGRX":return [{sampleBytes:4,widthDivisor:1,heightDivisor:1}];default:ve(t),g(!1);}},Ma=(t,e)=>{let r={left:0,top:0,width:t.codedWidth,height:t.codedHeight},i=e.rect,n=vl(r,i,t.codedWidth,t.codedHeight,t.format),s=e.layout,o;if(!e.format||e.format===t.format)o=t.format;else if(["RGBA","RGBX","BGRA","BGRX"].includes(e.format))o=e.format;else throw new Error("NotSupportedError: Invalid destination format.");return Il(n,o,s)},vl=(t,e,r,i,n)=>{let s={...t};if(e!==void 0){if(e.width===0||e.height===0)throw new TypeError("visibleRect dimensions cannot be zero.");if((e.x||0)+(e.width||0)>r)throw new TypeError("visibleRect exceeds codedWidth.");if((e.y||0)+(e.height||0)>i)throw new TypeError("visibleRect exceeds codedHeight.");s.x=e.x||0,s.y=e.y||0,s.width=e.width||0,s.height=e.height||0;}if(!Pl(n,s))throw new TypeError("visibleRect alignment is invalid for the format.");return s},Pl=(t,e)=>{if(t===null)return !0;let r=vn(t);for(let i=0;i<r.length;i++){let n=r[i],s=n.widthDivisor,o=n.heightDivisor;if((e.x||0)%s!==0||(e.y||0)%o!==0)return !1}return !0},Il=(t,e,r)=>{let i=vn(e),n=i.length;if(r!==void 0&&r.length!==n)throw new TypeError(`Layout must have ${n} planes.`);let s=0,o=[],a=[];for(let c=0;c<n;c++){let u=i[c],l=u.sampleBytes,d=u.widthDivisor,f=u.heightDivisor,m={destinationOffset:0,destinationStride:0,sourceTop:0,sourceHeight:0,sourceLeftBytes:0,sourceWidthBytes:0};if(m.sourceTop=Math.ceil(Math.trunc(t.y||0)/f),m.sourceHeight=Math.ceil(Math.trunc(t.height||0)/f),m.sourceLeftBytes=Math.floor(Math.trunc(t.x||0)/d)*l,m.sourceWidthBytes=Math.floor(Math.trunc(t.width||0)/d)*l,r!==void 0){let y=r[c];if(y.stride<m.sourceWidthBytes)throw new TypeError(`Stride for plane ${c} is too small.`);m.destinationOffset=y.offset,m.destinationStride=y.stride;}else m.destinationOffset=s,m.destinationStride=m.sourceWidthBytes;let b=m.destinationStride*m.sourceHeight+m.destinationOffset;if(b>4294967295)throw new TypeError("Allocation size exceeds limit.");a.push(b),s=Math.max(s,b);for(let y=0;y<c;y++){let w=o[y];if(!(a[c]<=w.destinationOffset||a[y]<=m.destinationOffset))throw new TypeError("Planes overlap.")}o.push(m);}return {allocationSize:s,computedLayouts:o}},En=new Set(["f32","f32-planar","s16","s16-planar","s32","s32-planar","u8","u8-planar"]),nr=class{constructor(){this._referenceCount=0;}},Me=class t{get microsecondTimestamp(){return Math.trunc(mt*this.timestamp)}get microsecondDuration(){return Math.trunc(mt*this.duration)}constructor(e){if(this._closed=!1,Ai(e)){if(e.format===null)throw new TypeError("AudioData with null format is not supported.");this._data=e,this.format=e.format,this.sampleRate=e.sampleRate,this.numberOfFrames=e.numberOfFrames,this.numberOfChannels=e.numberOfChannels,this.timestamp=e.timestamp/1e6,this.duration=e.numberOfFrames/e.sampleRate;}else if(e instanceof nr){if(this._data=e,e._referenceCount++,this.format=e.getFormat(),!En.has(this.format))throw new TypeError("getFormat() must return an AudioSampleFormat.");if(this.sampleRate=e.getSampleRate(),!Number.isInteger(this.sampleRate)||this.sampleRate<=0)throw new TypeError("getSampleRate() must return a positive integer.");if(this.numberOfFrames=e.getNumberOfFrames(),!Number.isInteger(this.numberOfFrames)||this.numberOfFrames<0)throw new TypeError("getNumberOfFrames() must return a non-negative integer.");if(this.numberOfChannels=e.getNumberOfChannels(),!Number.isInteger(this.numberOfChannels)||this.numberOfChannels<=0)throw new TypeError("getNumberOfChannels() must return a positive integer.");if(this.timestamp=e.getTimestamp(),!Number.isFinite(this.timestamp))throw new TypeError("getTimestamp() must return a finite number.");this.duration=this.numberOfFrames/this.sampleRate;}else {if(!e||typeof e!="object")throw new TypeError("Invalid AudioDataInit: must be an object.");if(!En.has(e.format))throw new TypeError("Invalid AudioDataInit: invalid format.");if(!Number.isFinite(e.sampleRate)||e.sampleRate<=0)throw new TypeError("Invalid AudioDataInit: sampleRate must be > 0.");if(!Number.isInteger(e.numberOfChannels)||e.numberOfChannels===0)throw new TypeError("Invalid AudioDataInit: numberOfChannels must be an integer > 0.");if(!Number.isFinite(e?.timestamp))throw new TypeError("init.timestamp must be a number.");let r=e.data.byteLength/(gt(e.format)*e.numberOfChannels);if(!Number.isInteger(r))throw new TypeError("Invalid AudioDataInit: data size is not a multiple of frame size.");this.format=e.format,this.sampleRate=e.sampleRate,this.numberOfFrames=r,this.numberOfChannels=e.numberOfChannels,this.timestamp=e.timestamp,this.duration=r/e.sampleRate;let i;if(e.data instanceof ArrayBuffer)i=new Uint8Array(e.data);else if(ArrayBuffer.isView(e.data))i=new Uint8Array(e.data.buffer,e.data.byteOffset,e.data.byteLength);else throw new TypeError("Invalid AudioDataInit: data is not a BufferSource.");let n=this.numberOfFrames*this.numberOfChannels*gt(this.format);if(i.byteLength<n)throw new TypeError("Invalid AudioDataInit: insufficient data size.");this._data=i;}Si?.register(this,{type:"audio",data:this._data},this);}allocationSize(e){if(!e||typeof e!="object")throw new TypeError("options must be an object.");if(!Number.isInteger(e.planeIndex)||e.planeIndex<0)throw new TypeError("planeIndex must be a non-negative integer.");if(e.format!==void 0&&!En.has(e.format))throw new TypeError("Invalid format.");if(e.frameOffset!==void 0&&(!Number.isInteger(e.frameOffset)||e.frameOffset<0))throw new TypeError("frameOffset must be a non-negative integer.");if(e.frameCount!==void 0&&(!Number.isInteger(e.frameCount)||e.frameCount<0))throw new TypeError("frameCount must be a non-negative integer.");if(this._closed)throw new Error("AudioSample is closed.");let r=e.format??this.format,i=e.frameOffset??0;if(i>=this.numberOfFrames)throw new RangeError("frameOffset out of range");let n=e.frameCount!==void 0?e.frameCount:this.numberOfFrames-i;if(n>this.numberOfFrames-i)throw new RangeError("frameCount out of range");let s=gt(r),o=sr(r);if(o&&e.planeIndex>=this.numberOfChannels)throw new RangeError("planeIndex out of range");if(!o&&e.planeIndex!==0)throw new RangeError("planeIndex out of range");return (o?n:n*this.numberOfChannels)*s}copyTo(e,r){if(!yr(e))throw new TypeError("destination must be an ArrayBuffer or an ArrayBuffer view.");if(!r||typeof r!="object")throw new TypeError("options must be an object.");if(!Number.isInteger(r.planeIndex)||r.planeIndex<0)throw new TypeError("planeIndex must be a non-negative integer.");if(r.format!==void 0&&!En.has(r.format))throw new TypeError("Invalid format.");if(r.frameOffset!==void 0&&(!Number.isInteger(r.frameOffset)||r.frameOffset<0))throw new TypeError("frameOffset must be a non-negative integer.");if(r.frameCount!==void 0&&(!Number.isInteger(r.frameCount)||r.frameCount<0))throw new TypeError("frameCount must be a non-negative integer.");if(this._closed)throw new Error("AudioSample is closed.");let{format:i,frameCount:n,frameOffset:s}=r,{planeIndex:o}=r,a=this.format,c=i??this.format;if(!c)throw new Error("Destination format not determined");let u=this.numberOfFrames,l=this.numberOfChannels,d=s??0;if(d>=u)throw new RangeError("frameOffset out of range");let f=n!==void 0?n:u-d;if(f>u-d)throw new RangeError("frameCount out of range");let m=gt(c),p=sr(c);if(p&&o>=l)throw new RangeError("planeIndex out of range");if(!p&&o!==0)throw new RangeError("planeIndex out of range");let y=(p?f:f*l)*m;if(e.byteLength<y)throw new RangeError("Destination buffer is too small");let w=oe(e),T=Oa(c);if(Ai(this._data))if(Et()&&l>2&&c!==a){Rl(this._data,w,a,c,l,o,d,f);return}else try{this._data.copyTo(e,{planeIndex:o,frameOffset:d,frameCount:f,format:c});return}catch(k){if(c==="f32-planar")throw k;a="f32-planar";}let A=Da(a),E=gt(a),P=sr(a),I;if(this._data instanceof nr){let k=C=>{let M=this._data.getDataPlane(C);if(!(M instanceof Uint8Array))throw new TypeError("getDataPlane() must return a Uint8Array.");let q=u*E*(P?1:l);if(M.byteLength!==q)throw new TypeError(`Data plane ${C} has invalid size. Expected exactly ${q} bytes, got ${M.byteLength} bytes.`);return M};if(P)if(p)I=k(o),o=0;else {I=new Uint8Array(u*E*l);for(let C=0;C<l;C++){let M=k(C);I.set(M,C*u*E);}}else I=k(0);}else if(this._data instanceof Uint8Array)I=this._data;else if(g(a==="f32-planar"),p)I=new Uint8Array(this._data.allocationSize({format:"f32-planar",planeIndex:o})),this._data.copyTo(I,{format:"f32-planar",planeIndex:o}),o=0;else {I=new Uint8Array(this._data.allocationSize({format:"f32-planar",planeIndex:0})*l);for(let k=0;k<l;k++)this._data.copyTo(I.subarray(k*u*E,(k+1)*u*E),{format:"f32-planar",planeIndex:k});}let v=oe(I);for(let k=0;k<f;k++)if(p){let C=k*m,M;P?M=(o*u+(k+d))*E:M=((k+d)*l+o)*E;let q=A(v,M);T(w,C,q);}else for(let C=0;C<l;C++){let q=(k*l+C)*m,N;P?N=(C*u+(k+d))*E:N=((k+d)*l+C)*E;let L=A(v,N);T(w,q,L);}}clone(){if(this._closed)throw new Error("AudioSample is closed.");if(this._data instanceof nr){let e=new t(this._data);return e.setTimestamp(this.timestamp),e}else if(Ai(this._data)){let e=new t(this._data.clone());return e.setTimestamp(this.timestamp),e}else return new t({format:this.format,sampleRate:this.sampleRate,numberOfFrames:this.numberOfFrames,numberOfChannels:this.numberOfChannels,timestamp:this.timestamp,data:this._data})}trim(e,r=this.numberOfFrames){if(!Number.isInteger(e)||e<0)throw new TypeError("startFrame must be a non-negative integer.");if(!Number.isInteger(r)||r<0)throw new TypeError("endFrame must be a non-negative integer.");if(e>this.numberOfFrames)throw new RangeError("startFrame out of range.");if(r>this.numberOfFrames)throw new RangeError("endFrame out of range.");if(r<e)throw new RangeError("endFrame must not be less than startFrame.");if(this._closed)throw new Error("AudioSample is closed.");let i=r-e,n=gt(this.format),s;if(sr(this.format)){let o=i*n;if(s=new Uint8Array(o*this.numberOfChannels),i>0)for(let a=0;a<this.numberOfChannels;a++)this.copyTo(s.subarray(a*o,(a+1)*o),{planeIndex:a,format:this.format,frameOffset:e,frameCount:i});}else s=new Uint8Array(i*this.numberOfChannels*n),i>0&&this.copyTo(s,{planeIndex:0,format:this.format,frameOffset:e,frameCount:i});return new t({data:s,format:this.format,sampleRate:this.sampleRate,numberOfChannels:this.numberOfChannels,timestamp:this.timestamp+e/this.sampleRate})}close(){this._closed||(Si?.unregister(this),this._data instanceof nr?(this._data._referenceCount--,this._data._referenceCount===0&&this._data.close()):Ai(this._data)?this._data.close():this._data=new Uint8Array(0),this._closed=!0);}toAudioData(){if(this._closed)throw new Error("AudioSample is closed.");return this._data instanceof nr?this._createAudioDataFromData():Ai(this._data)?this._data.timestamp===this.microsecondTimestamp?this._data.clone():this._createAudioDataFromData():new AudioData({format:this.format,sampleRate:this.sampleRate,numberOfFrames:this.numberOfFrames,numberOfChannels:this.numberOfChannels,timestamp:this.microsecondTimestamp,data:this._data.buffer instanceof ArrayBuffer?this._data.buffer:this._data.slice()})}_createAudioDataFromData(){if(sr(this.format)){let e=this.allocationSize({planeIndex:0,format:this.format}),r=new ArrayBuffer(e*this.numberOfChannels);for(let i=0;i<this.numberOfChannels;i++)this.copyTo(new Uint8Array(r,i*e,e),{planeIndex:i,format:this.format});return new AudioData({format:this.format,sampleRate:this.sampleRate,numberOfFrames:this.numberOfFrames,numberOfChannels:this.numberOfChannels,timestamp:this.microsecondTimestamp,data:r})}else {let e=new ArrayBuffer(this.allocationSize({planeIndex:0,format:this.format}));return this.copyTo(e,{planeIndex:0,format:this.format}),new AudioData({format:this.format,sampleRate:this.sampleRate,numberOfFrames:this.numberOfFrames,numberOfChannels:this.numberOfChannels,timestamp:this.microsecondTimestamp,data:e})}}toAudioBuffer(){if(this._closed)throw new Error("AudioSample is closed.");let e=new AudioBuffer({numberOfChannels:this.numberOfChannels,length:this.numberOfFrames,sampleRate:this.sampleRate}),r=new Float32Array(this.allocationSize({planeIndex:0,format:"f32-planar"})/4);for(let i=0;i<this.numberOfChannels;i++)this.copyTo(r,{planeIndex:i,format:"f32-planar"}),e.copyToChannel(r,i);return e}setTimestamp(e){if(!Number.isFinite(e))throw new TypeError("newTimestamp must be a number.");this.timestamp=e;}[Symbol.dispose](){this.close();}static*_fromAudioBuffer(e,r){if(!(e instanceof AudioBuffer))throw new TypeError("audioBuffer must be an AudioBuffer.");let i=48e3*5,n=e.numberOfChannels,s=e.sampleRate,o=e.length,a=Math.floor(i/n),c=0,u=o;for(;u>0;){let l=Math.min(a,u),d=new Float32Array(n*l);for(let f=0;f<n;f++)e.copyFromChannel(d.subarray(f*l,(f+1)*l),f,c);yield new t({format:"f32-planar",sampleRate:s,numberOfFrames:l,numberOfChannels:n,timestamp:r+c/s,data:d}),c+=l,u-=l;}}static fromAudioBuffer(e,r){if(!(e instanceof AudioBuffer))throw new TypeError("audioBuffer must be an AudioBuffer.");let i=48e3*5,n=e.numberOfChannels,s=e.sampleRate,o=e.length,a=Math.floor(i/n),c=0,u=o,l=[];for(;u>0;){let d=Math.min(a,u),f=new Float32Array(n*d);for(let p=0;p<n;p++)e.copyFromChannel(f.subarray(p*d,(p+1)*d),p,c);let m=new t({format:"f32-planar",sampleRate:s,numberOfFrames:d,numberOfChannels:n,timestamp:r+c/s,data:f});l.push(m),c+=d,u-=d;}return l}},gt=t=>{switch(t){case "u8":case "u8-planar":return 1;case "s16":case "s16-planar":return 2;case "s32":case "s32-planar":return 4;case "f32":case "f32-planar":return 4;default:throw new Error("Unknown AudioSampleFormat")}},sr=t=>{switch(t){case "u8-planar":case "s16-planar":case "s32-planar":case "f32-planar":return !0;default:return !1}},Da=t=>{switch(t){case "u8":case "u8-planar":return (e,r)=>(e.getUint8(r)-128)/128;case "s16":case "s16-planar":return (e,r)=>e.getInt16(r,!0)/32768;case "s32":case "s32-planar":return (e,r)=>e.getInt32(r,!0)/2147483648;case "f32":case "f32-planar":return (e,r)=>e.getFloat32(r,!0)}},Oa=t=>{switch(t){case "u8":case "u8-planar":return (e,r,i)=>e.setUint8(r,fe((i+1)*127.5,0,255));case "s16":case "s16-planar":return (e,r,i)=>e.setInt16(r,fe(Math.round(i*32767),-32768,32767),!0);case "s32":case "s32-planar":return (e,r,i)=>e.setInt32(r,fe(Math.round(i*2147483647),-2147483648,2147483647),!0);case "f32":case "f32-planar":return (e,r,i)=>e.setFloat32(r,i,!0)}},Ai=t=>typeof AudioData<"u"&&t instanceof AudioData,za=t=>{switch(t){case "u8-planar":return "u8";case "s16-planar":return "s16";case "s32-planar":return "s32";case "f32-planar":return "f32";default:return t}},Rl=(t,e,r,i,n,s,o,a)=>{let c=Da(r),u=Oa(i),l=gt(r),d=gt(i),f=sr(r);if(sr(i))if(f){let p=new ArrayBuffer(a*l),b=oe(p);t.copyTo(p,{planeIndex:s,frameOffset:o,frameCount:a,format:r});for(let y=0;y<a;y++){let w=y*l,T=y*d,A=c(b,w);u(e,T,A);}}else {let p=new ArrayBuffer(a*n*l),b=oe(p);t.copyTo(p,{planeIndex:0,frameOffset:o,frameCount:a,format:r});for(let y=0;y<a;y++){let w=(y*n+s)*l,T=y*d,A=c(b,w);u(e,T,A);}}else if(f){let p=a*l,b=new ArrayBuffer(p),y=oe(b);for(let w=0;w<n;w++){t.copyTo(b,{planeIndex:w,frameOffset:o,frameCount:a,format:r});for(let T=0;T<a;T++){let A=T*l,E=(T*n+w)*d,P=c(y,A);u(e,E,P);}}}else {let p=new ArrayBuffer(a*n*l),b=oe(p);t.copyTo(p,{planeIndex:0,frameOffset:o,frameCount:a,format:r});for(let y=0;y<a;y++)for(let w=0;w<n;w++){let T=y*n+w,A=T*l,E=T*d,P=c(b,A);u(e,E,P);}}},Ua=(t,e)=>{let r=t.allocationSize({format:e,planeIndex:0}),i=new ArrayBuffer(r);return t.copyTo(i,{format:e,planeIndex:0}),new Me({data:i,format:e,numberOfChannels:t.numberOfChannels,sampleRate:t.sampleRate,timestamp:t.timestamp,duration:t.duration})};var Va=new Map,Na=new Map,La=t=>{if(!t||typeof t!="object")throw new TypeError("Encoding config must be an object.");if(!Oe.includes(t.codec))throw new TypeError(`Invalid video codec '${t.codec}'. Must be one of: ${Oe.join(", ")}.`);let e=t.bitrate;if(t.quality===void 0&&e===void 0)throw new TypeError("config.quality must be provided.");if(t.quality!==void 0&&e!==void 0)throw new TypeError("config.quality and config.bitrate cannot both be provided.");if(t.quality!==void 0&&!(t.quality instanceof Ee))throw new TypeError("config.quality, when provided, must be a Quality.");if(e!==void 0&&!(e instanceof Ee)&&(!Number.isInteger(e)||e<=0))throw new TypeError("config.bitrate, when provided, must be a positive integer or a quality.");if(t.keyFrameInterval!==void 0&&(!Number.isFinite(t.keyFrameInterval)||t.keyFrameInterval<0))throw new TypeError("config.keyFrameInterval, when provided, must be a non-negative number.");if(t.sizeChangeBehavior!==void 0&&!["deny","passThrough","fill","contain","cover"].includes(t.sizeChangeBehavior))throw new TypeError("config.sizeChangeBehavior, when provided, must be 'deny', 'passThrough', 'fill', 'contain' or 'cover'.");if(t.transform!==void 0){if(typeof t.transform!="object"||!t.transform)throw new TypeError("config.transform, when provided, must be an object.");if(t.transform.width!==void 0&&(!Number.isInteger(t.transform.width)||t.transform.width<=0))throw new TypeError("config.transform.width, when provided, must be a positive integer.");if(t.transform.height!==void 0&&(!Number.isInteger(t.transform.height)||t.transform.height<=0))throw new TypeError("config.transform.height, when provided, must be a positive integer.");if(t.transform.fit!==void 0&&!["fill","contain","cover"].includes(t.transform.fit))throw new TypeError('config.transform.fit, when provided, must be one of "fill", "contain", or "cover".');if(t.transform.width!==void 0&&t.transform.height!==void 0&&t.transform.fit===void 0&&!["fill","contain","cover"].includes(t.sizeChangeBehavior))throw new TypeError("When both config.transform.width and config.transform.height are provided, config.transform.fit must also be provided.");if(t.transform.fit!==void 0&&["fill","contain","cover"].includes(t.sizeChangeBehavior)&&t.transform.fit!==t.sizeChangeBehavior)throw new TypeError("config.transform.fit, when provided, cannot differ from config.sizeChangeBehavior when config.sizeChangeBehavior is 'fill', 'contain' or 'cover', as sizeChangeBehavior already determines the fitting algorithm.");if(t.transform.rotate!==void 0&&![0,90,180,270].includes(t.transform.rotate))throw new TypeError("config.transform.rotate, when provided, must be 0, 90, 180 or 270.");if(t.transform.crop!==void 0&&or(t.transform.crop,"config.transform."),t.transform.process!==void 0&&typeof t.transform.process!="function")throw new TypeError("config.transform.process, when provided, must be a function.");if(t.transform.frameRate!==void 0&&(!Number.isFinite(t.transform.frameRate)||t.transform.frameRate<=0))throw new TypeError("config.transform.frameRate, when provided, must be a finite positive number.");if(t.transform.force!==void 0&&typeof t.transform.force!="boolean")throw new TypeError("config.transform.force, when provided, must be a boolean.")}if(t.onEncodedPacket!==void 0&&typeof t.onEncodedPacket!="function")throw new TypeError("config.onEncodedPacket, when provided, must be a function.");if(t.onEncoderConfig!==void 0&&typeof t.onEncoderConfig!="function")throw new TypeError("config.onEncoderConfig, when provided, must be a function.");if(t.onEncodedSample!==void 0&&typeof t.onEncodedSample!="function")throw new TypeError("config.onEncodedSample, when provided, must be a function.");Ha(t.codec,t);},Ha=(t,e)=>{if(!e||typeof e!="object")throw new TypeError("Encoding options must be an object.");if(e.alpha!==void 0&&!["discard","keep"].includes(e.alpha))throw new TypeError("options.alpha, when provided, must be 'discard' or 'keep'.");let r=e.bitrateMode;if(r!==void 0&&!["constant","variable"].includes(r))throw new TypeError("bitrateMode, when provided, must be 'constant' or 'variable'.");if(e.latencyMode!==void 0&&!["quality","realtime"].includes(e.latencyMode))throw new TypeError("latencyMode, when provided, must be 'quality' or 'realtime'.");if(e.fullCodecString!==void 0&&typeof e.fullCodecString!="string")throw new TypeError("fullCodecString, when provided, must be a string.");if(e.fullCodecString!==void 0&&li(e.fullCodecString)!==t)throw new TypeError(`fullCodecString, when provided, must be a string that matches the specified codec (${t}).`);if(e.hardwareAcceleration!==void 0&&!["no-preference","prefer-hardware","prefer-software"].includes(e.hardwareAcceleration))throw new TypeError("hardwareAcceleration, when provided, must be 'no-preference', 'prefer-hardware' or 'prefer-software'.");if(e.scalabilityMode!==void 0&&typeof e.scalabilityMode!="string")throw new TypeError("scalabilityMode, when provided, must be a string.");if(e.contentHint!==void 0&&typeof e.contentHint!="string")throw new TypeError("contentHint, when provided, must be a string.")},Ds=t=>{let e=t.bitrateMode,r=t.quality._toVideoRateControl(t.codec,t.width,t.height,e),i=(s,o,a)=>({codec:t.fullCodecString??ra(t.codec,t.width,t.height,a,t.alpha==="keep"),width:t.width,height:t.height,displayWidth:t.squarePixelWidth,displayHeight:t.squarePixelHeight,bitrate:s,bitrateMode:o,alpha:t.alpha??"discard",framerate:t.framerate,latencyMode:t.latencyMode,hardwareAcceleration:t.hardwareAcceleration,scalabilityMode:t.scalabilityMode,contentHint:t.contentHint,...oa(t.codec)}),n=[];return r.quantizer!==null&&n.push({config:i(void 0,"quantizer",r.bitrate),quantizer:r.quantizer}),r.bitrateMode!=="quantizer"&&n.push({config:i(r.bitrate,r.bitrateMode,r.bitrate),quantizer:null}),g(n.length>0),n},ja=t=>{if(!t||typeof t!="object")throw new TypeError("Encoding config must be an object.");if(!Ue.includes(t.codec))throw new TypeError(`Invalid audio codec '${t.codec}'. Must be one of: ${Ue.join(", ")}.`);let e=t.bitrate;if(t.quality===void 0&&e===void 0&&!(Se.includes(t.codec)||t.codec==="flac"))throw new TypeError("config.quality must be provided for compressed audio codecs.");if(t.quality!==void 0&&e!==void 0)throw new TypeError("config.quality and config.bitrate cannot both be provided.");if(t.quality!==void 0&&!(t.quality instanceof Ee))throw new TypeError("config.quality, when provided, must be a Quality.");if(e!==void 0&&!(e instanceof Ee)&&(!Number.isInteger(e)||e<=0))throw new TypeError("config.bitrate, when provided, must be a positive integer or a quality.");if(t.transform!==void 0){if(typeof t.transform!="object"||!t.transform)throw new TypeError("config.transform, when provided, must be an object.");if(t.transform.numberOfChannels!==void 0&&(!Number.isInteger(t.transform.numberOfChannels)||t.transform.numberOfChannels<=0))throw new TypeError("config.transform.numberOfChannels, when provided, must be a positive integer.");if(t.transform.sampleRate!==void 0&&(!Number.isInteger(t.transform.sampleRate)||t.transform.sampleRate<=0))throw new TypeError("config.transform.sampleRate, when provided, must be a positive integer.");if(t.transform.sampleFormat!==void 0&&!["u8","s16","s32","f32"].includes(t.transform.sampleFormat))throw new TypeError("config.transform.sampleFormat, when provided, must be one of: u8, s16, s32, f32.");if(t.transform.process!==void 0&&typeof t.transform.process!="function")throw new TypeError("config.transform.process, when provided, must be a function.")}if(t.onEncodedPacket!==void 0&&typeof t.onEncodedPacket!="function")throw new TypeError("config.onEncodedPacket, when provided, must be a function.");if(t.onEncoderConfig!==void 0&&typeof t.onEncoderConfig!="function")throw new TypeError("config.onEncoderConfig, when provided, must be a function.");if(t.onEncodedSample!==void 0&&typeof t.onEncodedSample!="function")throw new TypeError("config.onEncodedSample, when provided, must be a function.");Qa(t.codec,t);},Qa=(t,e)=>{if(!e||typeof e!="object")throw new TypeError("Encoding options must be an object.");let r=e.bitrateMode;if(r!==void 0&&!["constant","variable"].includes(r))throw new TypeError("bitrateMode, when provided, must be 'constant' or 'variable'.");if(e.fullCodecString!==void 0&&typeof e.fullCodecString!="string")throw new TypeError("fullCodecString, when provided, must be a string.");if(e.fullCodecString!==void 0&&li(e.fullCodecString)!==t)throw new TypeError(`fullCodecString, when provided, must be a string that matches the specified codec (${t}).`)},Os=t=>{let e=t.bitrateMode;return {codec:t.fullCodecString??na(t.codec,t.numberOfChannels,t.sampleRate),numberOfChannels:t.numberOfChannels,sampleRate:t.sampleRate,bitrate:t.quality?._toAudioBitrate(t.codec),bitrateMode:t.quality?._bitrateMode??e,...aa(t.codec)}},Ee=class{constructor(e){if((typeof e=="number"||typeof e=="string")&&(e={quality:e}),!e||typeof e!="object")throw new TypeError("options must be an object.");if(e.bitrateMode!==void 0&&!["constant","variable"].includes(e.bitrateMode))throw new TypeError("options.bitrateMode, when provided, must be 'constant' or 'variable'.");if("quality"in e){if(typeof e.quality=="string"?!(e.quality in Wa):typeof e.quality!="number"||Number.isNaN(e.quality))throw new TypeError("options.quality must be a number, or one of 'very-low', 'low', 'medium', 'high' or 'very-high'.");if(e.preferBitrate!==void 0&&typeof e.preferBitrate!="boolean")throw new TypeError("options.preferBitrate, when provided, must be a boolean.");if("bitrate"in e||"quantizer"in e)throw new TypeError("options.quality cannot be combined with options.bitrate or options.quantizer.");this._quality=typeof e.quality=="string"?Wa[e.quality]:e.quality,this._preferBitrate=e.preferBitrate??!1,this._bitrate=void 0,this._quantizer=void 0;}else {if(e.bitrate!==void 0&&(!Number.isInteger(e.bitrate)||e.bitrate<=0))throw new TypeError("options.bitrate, when provided, must be a positive integer.");if(e.quantizer!==void 0&&(!Number.isInteger(e.quantizer)||e.quantizer<0))throw new TypeError("options.quantizer, when provided, must be a non-negative integer.");if(e.bitrate===void 0&&e.quantizer===void 0)throw new TypeError("At least one of options.bitrate or options.quantizer must be set.");if("preferBitrate"in e)throw new TypeError("options.preferBitrate can only be combined with options.quality.");this._quality=void 0,this._preferBitrate=!1,this._bitrate=e.bitrate,this._quantizer=e.quantizer;}this._bitrateMode=e.bitrateMode;}_toVideoRateControl(e,r,i,n){let s=Fl[e],o=null,a=this._bitrateMode??n??"variable";if(this._quantizer!==void 0){if(s)if(this._quantizer<s.min||this._quantizer>s.max){if(this._bitrate===void 0)throw new Error(`Quantizer ${this._quantizer} is out of range for codec '${e}'; must be between ${s.min} and ${s.max}.`)}else o=this._quantizer,this._bitrate===void 0&&(a="quantizer");else if(this._bitrate===void 0)throw new Error(`Codec '${e}' does not support quantizer-based encoding. Provide a bitrate in the Quality to define a fallback.`)}else this._bitrate===void 0&&s&&!this._preferBitrate&&(g(this._quality!==void 0),o=fe(Math.round(ko(s.worst,s.best,this._quality)),s.min,s.max));let c;if(this._bitrate!==void 0)c=this._bitrate;else {let u=this._quality;u===void 0&&(g(o!==null&&s),u=fe((o-s.worst)/(s.best-s.worst),0,1)),c=qa(e,r,i,Ms(u));}return {quantizer:o,bitrate:c,bitrateMode:a}}_toVideoBitrate(e,r,i){return this._bitrate!==void 0?this._bitrate:(g(this._quality!==void 0),qa(e,r,i,Ms(this._quality)))}_toAudioBitrate(e){if(Se.includes(e)||e==="flac")return;if(this._bitrate!==void 0)return this._bitrate;if(this._quality===void 0)throw new Error("This Quality defines neither a quality level nor a bitrate and therefore cannot be used for audio encoding.");let r=Ms(this._quality),n={aac:128e3,opus:64e3,mp3:16e4,vorbis:64e3,ac3:384e3,eac3:192e3,dts:768e3}[e];if(!n)throw new Error(`Unhandled codec: ${e}`);let s=n*r;return e==="aac"?s=[96e3,128e3,16e4,192e3].reduce((a,c)=>Math.abs(c-s)<Math.abs(a-s)?c:a):e==="opus"||e==="vorbis"?s=Math.max(6e3,s):e==="mp3"&&(s=[8e3,16e3,24e3,32e3,4e4,48e3,64e3,8e4,96e3,112e3,128e3,16e4,192e3,224e3,256e3,32e4].reduce((a,c)=>Math.abs(c-s)<Math.abs(a-s)?c:a)),Math.round(s/1e3)*1e3}},Wa={"very-low":0,low:.25,medium:.5,high:.75,"very-high":1},Fl={avc:{min:0,max:51,worst:41,best:16},hevc:{min:0,max:51,worst:41,best:16},vp9:{min:0,max:63,worst:52,best:20},av1:{min:0,max:255,worst:208,best:80}},Ms=t=>.3*Math.exp(2.5538*t),qa=(t,e,r,i)=>{let n=e*r,s=1920*1080,o=3e6,a=Math.pow(n/s,.95),c=o*a,u={avc:1,hevc:.6,vp9:.6,av1:.4,vp8:1.2,prores:22e7/o},d=c*u[t]*i;return Math.ceil(d/1e3)*1e3},zs=(t,e)=>{if(t==="avc")return {avc:{quantizer:e}};if(t==="hevc")return {hevc:{quantizer:e}};if(t==="vp9")return {vp9:{quantizer:e}};if(t==="av1")return {av1:{quantizer:e}};g(!1);};var Bl=async(t,e={})=>{let{width:r=1280,height:i=720,quality:n,bitrate:s,...o}=e;if(!Oe.includes(t))return !1;if(!Number.isInteger(r)||r<=0)throw new TypeError("width must be a positive integer.");if(!Number.isInteger(i)||i<=0)throw new TypeError("height must be a positive integer.");if(n!==void 0&&!(n instanceof Ee))throw new TypeError("quality, when provided, must be a Quality.");if(n!==void 0&&s!==void 0)throw new TypeError("quality and bitrate cannot both be provided.");if(s!==void 0&&!(s instanceof Ee)&&(!Number.isInteger(s)||s<=0))throw new TypeError("bitrate must be a positive integer or a quality.");Ha(t,o);let a=Gt(n,s)??new Ee("medium"),c;try{c=Ds({codec:t,width:r,height:i,quality:a,framerate:void 0,...o,alpha:"discard"});}catch{return !1}let u=JSON.stringify(c),l=Va.get(u);if(l)return l;let d=(async()=>{for(let{config:m}of c)if(Pn.some(p=>p.supports(t,m)))return !0;if(typeof VideoEncoder>"u"||(r%2===1||i%2===1)&&(t==="avc"||t==="hevc"))return !1;for(let{config:m,quantizer:p}of c){try{if(!(await VideoEncoder.isConfigSupported(m)).supported)continue}catch{continue}if(!Yr()||await new Promise(async y=>{try{let w=new VideoEncoder({output:()=>{},error:()=>y(!1)});w.configure(m);let T=new Uint8Array(r*i*4),A=new VideoFrame(T,{format:"RGBA",codedWidth:r,codedHeight:i,timestamp:0});w.encode(A,p!==null?zs(t,p):void 0),A.close(),await w.flush(),y(!0);}catch{y(!1);}}))return !0}return !1})();return Va.set(u,d),d},Ml=async(t,e={})=>{let{numberOfChannels:r=2,sampleRate:i=48e3,quality:n,bitrate:s,...o}=e;if(!Ue.includes(t))return !1;if(!Number.isInteger(r)||r<=0)throw new TypeError("numberOfChannels must be a positive integer.");if(!Number.isInteger(i)||i<=0)throw new TypeError("sampleRate must be a positive integer.");if(n!==void 0&&!(n instanceof Ee))throw new TypeError("quality, when provided, must be a Quality.");if(n!==void 0&&s!==void 0)throw new TypeError("quality and bitrate cannot both be provided.");if(s!==void 0&&!(s instanceof Ee)&&(!Number.isInteger(s)||s<=0))throw new TypeError("bitrate must be a positive integer.");Qa(t,o);let a=Gt(n,s)??new Ee("medium"),c=Os({codec:t,numberOfChannels:r,sampleRate:i,quality:a,...o}),u=JSON.stringify(c),l=Na.get(u);if(l)return l;let d=(async()=>{if(In.some(f=>f.supports(t,c))||Se.includes(t))return !0;if(typeof AudioEncoder>"u")return !1;try{return (await AudioEncoder.isConfigSupported(c)).supported===!0}catch{return !1}})();return Na.set(u,d),d},Gt=(t,e)=>{if(t!==void 0)return t;if(e!==void 0)return e instanceof Ee?e:new Ee({bitrate:e})};var Us=async(t=Ue,e)=>{let r=await Promise.all(t.map(i=>Ml(i,e)));return t.filter((i,n)=>r[n])};var Ka=async(t,e)=>{for(let r of t)if(await Bl(r,e))return r;return null};var Rn=[],Fn=[],Pn=[],In=[];var Ga=t=>{let i=t,n=4096,s=0,o=12,a=0;for(i<0&&(i=-i,s=128),i+=33,i>8191&&(i=8191);(i&n)!==n&&o>=5;)n>>=1,o--;return a=i>>o-4&15,~(s|o-5<<4|a)&255},$a=t=>{let r=0,i=0,n=~t;n&128&&(n&=-129,r=-1),i=((n&240)>>4)+5;let s=(1<<i|(n&15)<<i-4|1<<i-5)-33;return r===0?s:-s},Xa=t=>{let r=2048,i=0,n=11,s=0,o=t;for(o<0&&(o=-o,i=128),o>4095&&(o=4095);(o&r)!==r&&n>=5;)r>>=1,n--;return s=o>>(n===4?1:n-4)&15,(i|n-4<<4|s)^85},Za=t=>{let e=0,r=0,i=t^85;i&128&&(i&=-129,e=-1),r=((i&240)>>4)+4;let n=0;return r!==4?n=1<<r|(i&15)<<r-4|1<<r-5:n=i<<1|1,e===0?n:-n};var ar=t=>{if(!t||typeof t!="object")throw new TypeError("options must be an object.");if(t.metadataOnly!==void 0&&typeof t.metadataOnly!="boolean")throw new TypeError("options.metadataOnly, when defined, must be a boolean.");if(t.verifyKeyPackets!==void 0&&typeof t.verifyKeyPackets!="boolean")throw new TypeError("options.verifyKeyPackets, when defined, must be a boolean.");if(t.verifyKeyPackets&&t.metadataOnly)throw new TypeError("options.verifyKeyPackets and options.metadataOnly cannot be enabled together.");if(t.skipLiveWait!==void 0&&typeof t.skipLiveWait!="boolean")throw new TypeError("options.skipLiveWait, when defined, must be a boolean.")},cr=t=>{if(!et(t))throw new TypeError("timestamp must be a number.")},Vs=(t,e,r)=>r.verifyKeyPackets?e.then(async i=>{if(!i||i.type==="delta")return i;let n=await t.determinePacketType(i);return n&&(i.type=n),i}):e,Ze=class{constructor(e){if(!(e instanceof zr))throw new TypeError("track must be an InputTrack.");this._track=e;}async getFirstPacket(e={}){if(ar(e),this._track.input._disposed)throw new Ce;return Vs(this._track,this._track._backing.getFirstPacket(e),e)}async getFirstKeyPacket(e={}){ar(e);let r=await this.getFirstPacket(e);return r?r.type==="key"?r:this.getNextKeyPacket(r,e):null}async getPacket(e,r={}){if(cr(e),ar(r),this._track.input._disposed)throw new Ce;return Vs(this._track,this._track._backing.getPacket(e,r),r)}async getNextPacket(e,r={}){if(!(e instanceof me))throw new TypeError("packet must be an EncodedPacket.");if(ar(r),this._track.input._disposed)throw new Ce;return Vs(this._track,this._track._backing.getNextPacket(e,r),r)}async getKeyPacket(e,r={}){if(cr(e),ar(r),this._track.input._disposed)throw new Ce;if(!r.verifyKeyPackets)return this._track._backing.getKeyPacket(e,r);let i=await this._track._backing.getKeyPacket(e,r);return i&&(g(i.type==="key"),await this._track.determinePacketType(i)==="delta"?this.getKeyPacket(i.timestamp-1/await this._track.getTimeResolution(),r):i)}async getNextKeyPacket(e,r={}){if(!(e instanceof me))throw new TypeError("packet must be an EncodedPacket.");if(ar(r),this._track.input._disposed)throw new Ce;if(!r.verifyKeyPackets)return this._track._backing.getNextKeyPacket(e,r);let i=await this._track._backing.getNextKeyPacket(e,r);return i&&(g(i.type==="key"),await this._track.determinePacketType(i)==="delta"?this.getNextKeyPacket(i,r):i)}packets(e,r,i={}){if(e!==void 0&&!(e instanceof me))throw new TypeError("startPacket must be an EncodedPacket.");if(e!==void 0&&e.isMetadataOnly&&!i?.metadataOnly)throw new TypeError("startPacket can only be metadata-only if options.metadataOnly is enabled.");if(r!==void 0&&!(r instanceof me))throw new TypeError("endPacket must be an EncodedPacket.");if(ar(i),this._track.input._disposed)throw new Ce;let n=[],{promise:s,resolve:o}=we(),{promise:a,resolve:c}=we(),u=!1,l=!1,d=null,f=!1,m=[],p=()=>Math.max(2,m.length);(async()=>{let y=e??await this.getFirstPacket(i);for(;y&&!l&&!this._track.input._disposed&&!(r&&y.sequenceNumber>=r?.sequenceNumber);){if(n.length>p()){(({promise:a,resolve:c}=we())),await a;continue}n.push(y),o(),{promise:s,resolve:o}=we(),y=await this.getNextPacket(y,i);}u=!0,o();})().catch(y=>{f||(d=y,f=!0,o());});let b=this._track;return {async next(){for(;;){if(b.input._disposed)throw new Ce;if(l)return {value:void 0,done:!0};if(f)throw d;if(n.length>0){let y=n.shift(),w=performance.now();for(m.push(w);m.length>0&&w-m[0]>=1e3;)m.shift();return c(),{value:y,done:!1}}else {if(u)return {value:void 0,done:!0};await s;}}},async return(){return l=!0,c(),o(),{value:void 0,done:!0}},async throw(y){throw y},[Symbol.asyncIterator](){return this}}}},_i=class{constructor(e,r){this.onSample=e,this.onError=r;}},Bn=class{mediaSamplesInRange(e=-1/0,r=1/0,i){cr(e),cr(r);let n=[],s=!1,o=null,{promise:a,resolve:c}=we(),{promise:u,resolve:l}=we(),d=!1,f=!1,m=!1,p=null,b=null,y=!1,w={...i,verifyKeyPackets:!0,metadataOnly:!1};(async()=>{p=await this._createDecoder(C=>{if(l(),C.timestamp>=r&&(f=!0),f){C.close();return}o&&(C.timestamp>e?(n.push(o),s=!0):o.close()),C.timestamp>=e&&(n.push(C),s=!0),o=s?null:C,n.length>0&&(c(),{promise:a,resolve:c}=we());},C=>{y||(b=C,y=!0,c());});let E=this._createPacketSink(),P=await E.getKeyPacket(e,w)??await E.getFirstKeyPacket(w),I=P,k=E.packets(P??void 0,void 0,w);for(await k.next();I&&!f&&!this._track.input._disposed;){let C=Ya(n.length);if(n.length+p.getDecodeQueueSize()>C){(({promise:u,resolve:l}=we())),await u;continue}p.decode(I);let M=await k.next();if(M.done)break;I=M.value;}await k.return(),!m&&!this._track.input._disposed&&await p.flush(),!s&&o&&n.push(o),d=!0,c();})().catch(E=>{y||(b=E,y=!0,c());}).finally(()=>{p?.close();});let T=this._track,A=()=>{o?.close();for(let E of n)E.close();};return {async next(){for(;;){if(T.input._disposed)throw m=!0,f=!0,A(),new Ce;if(m)return {value:void 0,done:!0};if(y)throw m=!0,f=!0,A(),b;if(n.length>0){let E=n.shift();return l(),{value:E,done:!1}}else if(!d)await a;else return {value:void 0,done:!0}}},async return(){return m=!0,f=!0,l(),c(),A(),{value:void 0,done:!0}},async throw(E){throw E},[Symbol.asyncIterator](){return this}}}mediaSamplesAtTimestamps(e,r){bo(e);let i=yo(e),n=[],s=[],{promise:o,resolve:a}=we(),{promise:c,resolve:u}=we(),l=!1,d=!1,f=null,m=null,p=!1,b=A=>{s.push(A),a(),{promise:o,resolve:a}=we();},y={...r,verifyKeyPackets:!0,metadataOnly:!1};(async()=>{f=await this._createDecoder(C=>{if(u(),d){C.close();return}let M=0;for(;n.length>0&&C.timestamp-n[0]>-1e-10;)M++,n.shift();if(M>0)for(let q=0;q<M;q++)b(q<M-1?C.clone():C);else C.close();},C=>{p||(m=C,p=!0,a());});let A=this._createPacketSink(),E=null,P=null,I=-1,v=async()=>{g(P),g(f);let C=P;for(f.decode(C);C.sequenceNumber<I;){let M=Ya(s.length);for(;s.length+f.getDecodeQueueSize()>M&&!d;)(({promise:c,resolve:u}=we())),await c;if(d)break;let q=await A.getNextPacket(C,y);g(q),f.decode(q),C=q;}I=-1;},k=async()=>{g(f),await f.flush();for(let C=0;C<n.length;C++)b(null);n.length=0;};for await(let C of i){if(cr(C),d||this._track.input._disposed)break;let M=await A.getPacket(C,y),q=M&&await A.getKeyPacket(C,y);if(!q){I!==-1&&(await v(),await k()),b(null),E=null;continue}E&&(q.sequenceNumber!==P.sequenceNumber||M.timestamp<E.timestamp)&&(await v(),await k()),n.push(M.timestamp),I=Math.max(M.sequenceNumber,I),E=M,P=q;}!d&&!this._track.input._disposed&&(I!==-1&&await v(),await k()),l=!0,a();})().catch(A=>{p||(m=A,p=!0,a());}).finally(()=>{f?.close();});let w=this._track,T=()=>{for(let A of s)A?.close();};return {async next(){for(;;){if(w.input._disposed)throw d=!0,T(),new Ce;if(d)return {value:void 0,done:!0};if(p)throw d=!0,T(),m;if(s.length>0){let A=s.shift();return g(A!==void 0),u(),{value:A,done:!1}}else if(!l)await o;else return {value:void 0,done:!0}}},async return(){return d=!0,u(),a(),T(),{value:void 0,done:!0}},async throw(A){throw A},[Symbol.asyncIterator](){return this}}}},Ya=t=>t===0?40:8,Ws=class extends _i{constructor(e,r,i,n,s,o){super(e,r),this.codec=i,this.decoderConfig=n,this.rotation=s,this.timeResolution=o,this.decoder=null,this.customDecoder=null,this.customDecoderCallSerializer=new Nt,this.customDecoderQueueSize=0,this.inputTimestamps=[],this.sampleQueue=[],this.currentPacketIndex=0,this.raslSkipped=!1,this.alphaDecoder=null,this.alphaHadKeyframe=!1,this.colorQueue=[],this.alphaQueue=[],this.merger=null,this.decodedAlphaChunkCount=0,this.alphaDecoderQueueSize=0,this.nullAlphaFrameQueue=[],this.currentAlphaPacketIndex=0,this.alphaRaslSkipped=!1,this.finalSamples=[],this.mergeAlphaPromises=[];let a=Rn.find(c=>c.supports(i,n));if(a)this.customDecoder=new a,this.customDecoder.codec=i,this.customDecoder.config=n,this.customDecoder.onSample=c=>{if(!(c instanceof Xe))throw new TypeError("The argument passed to onSample must be a VideoSample.");this.finalizeAndEmitSample(c);},this.customDecoder.onError=c=>{r(c);},this.customDecoderCallSerializer.call(()=>this.customDecoder.init()).catch(c=>r(c));else {let c=l=>{if(this.alphaQueue.length>0){let d=this.alphaQueue.shift();g(d!==void 0),this.mergeAlpha(l,d);}else this.colorQueue.push(l);};if(Jr()){if(i==="avc"&&this.decoderConfig.description){let l=Ji(_e(this.decoderConfig.description));if(l&&l.sequenceParameterSets.length>0){let d=_r(l.sequenceParameterSets[0]);d&&(d.frameMbsOnlyFlag===0&&(this.decoderConfig={...this.decoderConfig,hardwareAcceleration:"prefer-software"}),d.maxDecFrameBuffering!==0&&d.bitstreamRestrictionFlag!==1&&(l.sequenceParameterSets[0]=ms(d),this.decoderConfig={...this.decoderConfig,description:Yi(l)}));}}wr(this.decoderConfig.colorSpace)||(this.decoderConfig={...this.decoderConfig,colorSpace:{primaries:this.decoderConfig.colorSpace?.primaries??"bt709",matrix:this.decoderConfig.colorSpace?.matrix??"bt709",transfer:this.decoderConfig.colorSpace?.transfer??"bt709",fullRange:this.decoderConfig.colorSpace?.fullRange??!1}});}let u=new Error("Decoding error").stack;this.decoder=new VideoDecoder({output:l=>{try{c(l);}catch(d){this.onError(d);}},error:l=>{l.stack=u,this.onError(l);}}),this.decoder.configure(this.decoderConfig);}}getDecodeQueueSize(){return this.customDecoder?this.customDecoderQueueSize:(g(this.decoder),Math.max(this.decoder.decodeQueueSize,this.alphaDecoder?.decodeQueueSize??0))}decode(e){if(this.codec==="hevc"&&this.currentPacketIndex>0&&!this.raslSkipped){if(this.hasHevcRaslPicture(e.data))return;this.raslSkipped=!0;}if(this.customDecoder)this.customDecoderQueueSize++,this.customDecoderCallSerializer.call(()=>this.customDecoder.decode(e)).catch(r=>this.onError(r)).finally(()=>this.customDecoderQueueSize--);else {if(g(this.decoder),Et()||ss(this.inputTimestamps,e.timestamp,r=>r),Jr()&&this.currentPacketIndex===0){if(this.codec==="avc"){let r=[],i=!1;for(let s of hs(e.data,this.decoderConfig)){let o=oi(e.data[s.offset]);if(i||(i=o>=1&&o<=5),o===Ge.AUD){if(i)break;r.length=0;}o>=20&&o<=31||r.push(e.data.subarray(s.offset,s.offset+s.length));}if(!this.decoderConfig.description)for(let s=0;s<r.length;s++){let o=r[s];if(oi(o[0])!==Ge.SPS)continue;let a=_r(o);a&&a.maxDecFrameBuffering!==0&&a.bitstreamRestrictionFlag!==1&&(r[s]=ms(a));break}let n=Do(r,this.decoderConfig);e=new me(n,e.type,e.timestamp,e.duration);}else if(this.codec==="hevc"){let r=Vo(e.data,this.decoderConfig);r&&(e=new me(r,e.type,e.timestamp,e.duration));}}this.decoder.decode(e.toEncodedVideoChunk()),this.decodeAlphaData(e);}this.currentPacketIndex++;}decodeAlphaData(e){if(!e.sideData.alpha){this.pushNullAlphaFrame();return}if(this.merger||(this.merger=new qs),!this.alphaDecoder){let i=s=>{if(this.colorQueue.length>0){let o=this.colorQueue.shift();g(o!==void 0),this.mergeAlpha(o,s);}else this.alphaQueue.push(s);for(this.decodedAlphaChunkCount++;this.nullAlphaFrameQueue.length>0&&this.nullAlphaFrameQueue[0]===this.decodedAlphaChunkCount;)if(this.nullAlphaFrameQueue.shift(),this.colorQueue.length>0){let o=this.colorQueue.shift();g(o!==void 0),this.mergeAlpha(o,null);}else this.alphaQueue.push(null);this.alphaDecoderQueueSize--;},n=new Error("Decoding error").stack;this.alphaDecoder=new VideoDecoder({output:s=>{try{i(s);}catch(o){this.onError(o);}},error:s=>{s.stack=n,this.onError(s);}}),this.alphaDecoder.configure(this.decoderConfig);}let r=Er(this.codec,this.decoderConfig,e.sideData.alpha);if(this.alphaHadKeyframe||(this.alphaHadKeyframe=r==="key"),this.alphaHadKeyframe){if(this.codec==="hevc"&&this.currentAlphaPacketIndex>0&&!this.alphaRaslSkipped){if(this.hasHevcRaslPicture(e.sideData.alpha)){this.pushNullAlphaFrame();return}this.alphaRaslSkipped=!0;}this.currentAlphaPacketIndex++,this.alphaDecoder.decode(e.alphaToEncodedVideoChunk(r??e.type)),this.alphaDecoderQueueSize++;}else this.pushNullAlphaFrame();}pushNullAlphaFrame(){this.alphaDecoderQueueSize===0?this.alphaQueue.push(null):this.nullAlphaFrameQueue.push(this.decodedAlphaChunkCount+this.alphaDecoderQueueSize);}hasHevcRaslPicture(e){for(let r of ni(e,this.decoderConfig)){let i=kr(e[r.offset]);if(i===Ie.RASL_N||i===Ie.RASL_R)return !0}return !1}sampleHandler(e){if(Et()){if(this.sampleQueue.length>0&&e.timestamp>=ge(this.sampleQueue).timestamp){for(let r of this.sampleQueue)this.finalizeAndEmitSample(r);this.sampleQueue.length=0;}ss(this.sampleQueue,e,r=>r.timestamp);}else {let r=this.inputTimestamps.shift();g(r!==void 0),e.setTimestamp(r),this.finalizeAndEmitSample(e);}}finalizeAndEmitSample(e){e.setTimestamp(Math.round(e.timestamp*this.timeResolution)/this.timeResolution),e.setDuration(Math.round(e.duration*this.timeResolution)/this.timeResolution),e.setRotation(this.rotation),this.onSample(e);}async mergeAlpha(e,r){let i=we();this.mergeAlphaPromises.push(i.promise);let n={sample:null};this.finalSamples.push(n);try{if(!r)n.sample=new Xe(e);else {g(this.merger);let s=await this.merger.merge(e,r);n.sample=new Xe(s);}for(;this.finalSamples.length>0&&this.finalSamples[0].sample!==null;){let s=this.finalSamples.shift();this.sampleHandler(s.sample);}}catch(s){Gr(this.finalSamples,n),this.onError(s);}finally{Gr(this.mergeAlphaPromises,i.promise),i.resolve();}}async flush(){if(this.customDecoder?await this.customDecoderCallSerializer.call(()=>this.customDecoder.flush()):(g(this.decoder),await Promise.all([this.decoder.flush(),this.alphaDecoder?.flush()]),await Promise.all(this.mergeAlphaPromises),this.colorQueue.forEach(e=>e.close()),this.colorQueue.length=0,this.alphaQueue.forEach(e=>e?.close()),this.alphaQueue.length=0,this.alphaHadKeyframe=!1,this.decodedAlphaChunkCount=0,this.alphaDecoderQueueSize=0,this.nullAlphaFrameQueue.length=0,this.currentAlphaPacketIndex=0,this.alphaRaslSkipped=!1),Et()){for(let e of this.sampleQueue)this.finalizeAndEmitSample(e);this.sampleQueue.length=0;}this.currentPacketIndex=0,this.raslSkipped=!1;}close(){this.customDecoder?this.customDecoderCallSerializer.call(()=>this.customDecoder.close()):(g(this.decoder),this.decoder.state!=="closed"&&this.decoder.close(),this.alphaDecoder&&this.alphaDecoder.state!=="closed"&&this.alphaDecoder.close(),this.colorQueue.forEach(e=>e.close()),this.colorQueue.length=0,this.alphaQueue.forEach(e=>e?.close()),this.alphaQueue.length=0,this.merger?.close());for(let e of this.sampleQueue)e.close();this.sampleQueue.length=0;}},Ns=null,qs=class{constructor(){this.workers=[],this.nextWorkerIndex=0,this.pendingRequests=new Map,this.nextRequestId=0;}merge(e,r){if(this.workers.length===0){if(!Ns){let a=new Blob([`(${Dl.toString()})()`],{type:"application/javascript"});Ns=URL.createObjectURL(a);}let o=fe(navigator.hardwareConcurrency,1,4);for(let a=0;a<o;a++){let c=new Worker(Ns);c.addEventListener("message",u=>{let l=u.data,d=this.pendingRequests.get(l.id);d&&(this.pendingRequests.delete(l.id),"error"in l?d.reject(new Error(l.error)):d.resolve(l.frame));}),c.addEventListener("error",u=>{let l=new Error(u.message||"Color/alpha merge worker error.");for(let d of this.pendingRequests.values())d.reject(l);this.pendingRequests.clear();}),this.workers.push(c);}}let i=this.nextRequestId++,n=we();this.pendingRequests.set(i,n);let s=this.workers[this.nextWorkerIndex];return this.nextWorkerIndex=(this.nextWorkerIndex+1)%this.workers.length,s.postMessage({id:i,color:e,alpha:r},{transfer:[e,r]}),n.promise}close(){for(let r of this.workers)r.terminate();this.workers.length=0;let e=new Error("Color/alpha merger closed.");for(let r of this.pendingRequests.values())r.reject(e);this.pendingRequests.clear();}},Dl=()=>{let t=null,e=null,r=Promise.resolve();self.addEventListener("message",c=>{let{id:u,color:l,alpha:d}=c.data;r=r.then(async()=>{try{let f=await i(l,d);self.postMessage({id:u,frame:f},{transfer:[f]});}catch(f){self.postMessage({id:u,error:f.message});}finally{l.close(),d.close();}});});let i=async(c,u)=>{let l=c.format,d=u.format;if(!l||!d)throw new Error("CPU color/alpha merging requires a known VideoFrame format.");let f=l.includes("P10"),m=l.includes("P12"),p=d.includes("P10"),b=d.includes("P12");if(p!==f||b!==m)throw new Error(`CPU color/alpha merging requires the alpha frame to have the same bit depth as the color frame (color: '${l}', alpha: '${d}').`);if(l==="RGBX"||l==="RGBA"||l==="BGRX"||l==="BGRA")return await n(c,u,l);if(l==="I420"||l==="I420P10"||l==="I420P12"||l==="I422"||l==="I422P10"||l==="I422P12"||l==="I444"||l==="I444P10"||l==="I444P12")return await s(c,u,l);if(l==="NV12")return await o(c,u);throw new Error(`CPU color/alpha merging does not support format '${l}'.`)},n=async(c,u,l)=>{let d=c.visibleRect?.width??c.codedWidth,f=c.visibleRect?.height??c.codedHeight,m=d*f,p=new Uint8Array(m*4);await c.copyTo(p);let b=await a(u,d,f,1);for(let T=0,A=3;T<m;T++,A+=4)p[A]=b[T];let w={format:l==="RGBX"||l==="RGBA"?"RGBA":"BGRA",codedWidth:d,codedHeight:f,timestamp:c.timestamp,duration:c.duration??void 0,transfer:[p.buffer]};return new VideoFrame(p,w)},s=async(c,u,l)=>{let d=c.visibleRect?.width??c.codedWidth,f=c.visibleRect?.height??c.codedHeight,m=l.includes("P10"),p=l.includes("P12"),b=m||p?2:1,y,w;l.startsWith("I420")?(y=Math.ceil(d/2),w=Math.ceil(f/2)):l.startsWith("I422")?(y=Math.ceil(d/2),w=f):(y=d,w=f);let T=d*f,A=y*w,E=T*b,P=A*b,I=T*b,v=E+2*P+I,k=new Uint8Array(v);await c.copyTo(k);let C=await a(u,d,f,b),M=E+2*P;k.set(C,M);let N={format:l.slice(0,4)+"A"+l.slice(4),codedWidth:d,codedHeight:f,timestamp:c.timestamp,duration:c.duration??void 0,transfer:[k.buffer]};return new VideoFrame(k,N)},o=async(c,u)=>{let l=c.visibleRect?.width??c.codedWidth,d=c.visibleRect?.height??c.codedHeight,f=l*d,m=Math.ceil(l/2),p=Math.ceil(d/2),b=m*p,y=c.allocationSize();(!e||e.byteLength!==y)&&(e=new Uint8Array(y)),await c.copyTo(e);let w=new Uint8Array(f+2*b+f);w.set(e.subarray(0,f),0);let T=f,A=f+b,E=f;for(let v=0;v<b;v++)w[T+v]=e[E+v*2],w[A+v]=e[E+v*2+1];let P=await a(u,l,d,1);w.set(P,f+2*b);let I={format:"I420A",codedWidth:l,codedHeight:d,timestamp:c.timestamp,duration:c.duration??void 0,transfer:[w.buffer]};return new VideoFrame(w,I)},a=async(c,u,l,d)=>{let f=c.allocationSize();(!t||t.byteLength!==f)&&(t=new Uint8Array(f)),await c.copyTo(t);let m=c.format;if(m==="RGBA"||m==="BGRA"||m==="RGBX"||m==="BGRX"){let p=m==="RGBA"||m==="RGBX"?0:2,b=u*l;for(let y=0;y<b;y++)t[y]=t[y*4+p];return t.subarray(0,b)}else return t.subarray(0,u*l*d)};},Ol=t=>{if(!t||typeof t!="object")throw new TypeError("decoderOptions must be an object.");if(t.hardwareAcceleration!==void 0&&!["no-preference","prefer-hardware","prefer-software"].includes(t.hardwareAcceleration))throw new TypeError("decoderOptions.hardwareAcceleration, when provided, must be 'no-preference', 'prefer-hardware' or 'prefer-software'.");if(t.optimizeForLatency!==void 0&&typeof t.optimizeForLatency!="boolean")throw new TypeError("decoderOptions.optimizeForLatency, when provided, must be a boolean.")},Ci=class extends Bn{constructor(e,r={}){if(!(e instanceof lr))throw new TypeError("videoTrack must be an InputVideoTrack.");Ol(r),super(),this._track=e,this._decoderOptions=r;}async _createDecoder(e,r){if(!await this._track.canDecode())throw typeof VideoDecoder>"u"?new Error(br("VideoDecoder")):new Error("This video track cannot be decoded in this environment. Make sure to check decodability before using a track.");let i=await this._track.getCodec(),n=await this._track.getRotation(),s=await this._track.getDecoderConfig(),o=await this._track.getTimeResolution();return g(i&&s),s={...s,hardwareAcceleration:this._decoderOptions.hardwareAcceleration,optimizeForLatency:this._decoderOptions.optimizeForLatency},new Ws(e,r,i,s,n,o)}_createPacketSink(){return new Ze(this._track)}async getSample(e,r={}){cr(e);for await(let i of this.mediaSamplesAtTimestamps([e],r))return i;throw new Error("Internal error: Iterator returned nothing.")}samples(e,r,i={}){return this.mediaSamplesInRange(e,r,i)}samplesAtTimestamps(e,r={}){return this.mediaSamplesAtTimestamps(e,r)}};var Ls=class extends _i{constructor(e,r,i,n){super(e,r),this.decoder=null,this.customDecoder=null,this.customDecoderCallSerializer=new Nt,this.customDecoderQueueSize=0,this.currentTimestamp=null,this.expectedFirstTimestamp=null,this.timestampOffset=0;let s=a=>{let c=a.timestamp;this.expectedFirstTimestamp!==null&&this.currentTimestamp===null&&(this.timestampOffset=this.expectedFirstTimestamp-c),c+=this.timestampOffset,(this.currentTimestamp===null||Math.abs(c-this.currentTimestamp)>=a.duration)&&(this.currentTimestamp=c);let u=this.currentTimestamp;if(this.currentTimestamp+=a.duration,a.numberOfFrames===0){a.close();return}let l=n.sampleRate;a.setTimestamp(Math.round(u*l)/l),e(a);},o=Fn.find(a=>a.supports(i,n));if(o)this.customDecoder=new o,this.customDecoder.codec=i,this.customDecoder.config=n,this.customDecoder.onSample=a=>{if(!(a instanceof Me))throw new TypeError("The argument passed to onSample must be an AudioSample.");s(a);},this.customDecoder.onError=a=>{r(a);},this.customDecoderCallSerializer.call(()=>this.customDecoder.init()).catch(a=>r(a));else {let a=new Error("Decoding error").stack;this.decoder=new AudioDecoder({output:c=>{try{s(new Me(c));}catch(u){this.onError(u);}},error:c=>{c.stack=a,this.onError(c);}}),this.decoder.configure(n);}}getDecodeQueueSize(){return this.customDecoder?this.customDecoderQueueSize:(g(this.decoder),this.decoder.decodeQueueSize)}decode(e){this.customDecoder?(this.customDecoderQueueSize++,this.customDecoderCallSerializer.call(()=>this.customDecoder.decode(e)).catch(r=>this.onError(r)).finally(()=>this.customDecoderQueueSize--)):(g(this.decoder),this.expectedFirstTimestamp??(this.expectedFirstTimestamp=e.timestamp),this.decoder.decode(e.toEncodedAudioChunk()));}async flush(){this.customDecoder?await this.customDecoderCallSerializer.call(()=>this.customDecoder.flush()):(g(this.decoder),await this.decoder.flush()),this.currentTimestamp=null,this.expectedFirstTimestamp=null,this.timestampOffset=0;}close(){this.customDecoder?this.customDecoderCallSerializer.call(()=>this.customDecoder.close()):(g(this.decoder),this.decoder.state!=="closed"&&this.decoder.close());}},Hs=class extends _i{constructor(e,r,i){super(e,r),this.decoderConfig=i,this.currentTimestamp=null,g(Se.includes(i.codec)),this.codec=i.codec;let{dataType:n,sampleSize:s,littleEndian:o}=Ve(this.codec);switch(this.inputSampleSize=s,s){case 1:n==="unsigned"?this.readInputValue=(a,c)=>a.getUint8(c)-2**7:n==="signed"?this.readInputValue=(a,c)=>a.getInt8(c):n==="ulaw"?this.readInputValue=(a,c)=>$a(a.getUint8(c)):n==="alaw"?this.readInputValue=(a,c)=>Za(a.getUint8(c)):g(!1);break;case 2:n==="unsigned"?this.readInputValue=(a,c)=>a.getUint16(c,o)-2**15:n==="signed"?this.readInputValue=(a,c)=>a.getInt16(c,o):g(!1);break;case 3:n==="unsigned"?this.readInputValue=(a,c)=>er(a,c,o)-2**23:n==="signed"?this.readInputValue=(a,c)=>To(a,c,o):g(!1);break;case 4:n==="unsigned"?this.readInputValue=(a,c)=>a.getUint32(c,o)-2**31:n==="signed"?this.readInputValue=(a,c)=>a.getInt32(c,o):n==="float"?this.readInputValue=(a,c)=>a.getFloat32(c,o):g(!1);break;case 8:n==="float"?this.readInputValue=(a,c)=>a.getFloat64(c,o):g(!1);break;default:ve(s),g(!1);}switch(s){case 1:n==="ulaw"||n==="alaw"?(this.outputSampleSize=2,this.outputFormat="s16",this.writeOutputValue=(a,c,u)=>a.setInt16(c,u,!0)):(this.outputSampleSize=1,this.outputFormat="u8",this.writeOutputValue=(a,c,u)=>a.setUint8(c,u+2**7));break;case 2:this.outputSampleSize=2,this.outputFormat="s16",this.writeOutputValue=(a,c,u)=>a.setInt16(c,u,!0);break;case 3:this.outputSampleSize=4,this.outputFormat="s32",this.writeOutputValue=(a,c,u)=>a.setInt32(c,u<<8,!0);break;case 4:this.outputSampleSize=4,n==="float"?(this.outputFormat="f32",this.writeOutputValue=(a,c,u)=>a.setFloat32(c,u,!0)):(this.outputFormat="s32",this.writeOutputValue=(a,c,u)=>a.setInt32(c,u,!0));break;case 8:this.outputSampleSize=4,this.outputFormat="f32",this.writeOutputValue=(a,c,u)=>a.setFloat32(c,u,!0);break;default:ve(s),g(!1);}}getDecodeQueueSize(){return 0}decode(e){let r=oe(e.data),i=e.byteLength/this.decoderConfig.numberOfChannels/this.inputSampleSize,n=i*this.decoderConfig.numberOfChannels*this.outputSampleSize,s=new ArrayBuffer(n),o=new DataView(s);for(let l=0;l<i*this.decoderConfig.numberOfChannels;l++){let d=l*this.inputSampleSize,f=l*this.outputSampleSize,m=this.readInputValue(r,d);this.writeOutputValue(o,f,m);}let a=i/this.decoderConfig.sampleRate;(this.currentTimestamp===null||Math.abs(e.timestamp-this.currentTimestamp)>=a)&&(this.currentTimestamp=e.timestamp);let c=this.currentTimestamp;this.currentTimestamp+=a;let u=new Me({format:this.outputFormat,data:s,numberOfChannels:this.decoderConfig.numberOfChannels,sampleRate:this.decoderConfig.sampleRate,numberOfFrames:i,timestamp:c});this.onSample(u);}async flush(){}close(){}},Mn=class extends Bn{constructor(e){if(!(e instanceof ur))throw new TypeError("audioTrack must be an InputAudioTrack.");super(),this._track=e;}async _createDecoder(e,r){if(!await this._track.canDecode())throw typeof AudioDecoder>"u"?new Error(br("AudioDecoder")):new Error("This audio track cannot be decoded in this environment. Make sure to check decodability before using a track.");let i=await this._track.getCodec(),n=await this._track.getDecoderConfig();return g(i&&n),Se.includes(n.codec)?new Hs(e,r,n):new Ls(e,r,i,n)}_createPacketSink(){return new Ze(this._track)}async getSample(e,r={}){cr(e);for await(let i of this.mediaSamplesAtTimestamps([e],r))return i;throw new Error("Internal error: Iterator returned nothing.")}samples(e,r,i={}){return this.mediaSamplesInRange(e,r,i)}samplesAtTimestamps(e,r={}){return this.mediaSamplesAtTimestamps(e,r)}};var zr=class t{constructor(e,r){this.input=e,this._backing=r;}isVideoTrack(){return this instanceof lr}isAudioTrack(){return this instanceof ur}get id(){return this._backing.getId()}get number(){return this._backing.getNumber()}async getInternalCodecId(){return this._backing.getInternalCodecId()}get internalCodecId(){return be(this._backing.getInternalCodecId(),"internalCodecId","getInternalCodecId")}async getLanguageCode(){return this._backing.getLanguageCode()}get languageCode(){return be(this._backing.getLanguageCode(),"languageCode","getLanguageCode")}async getName(){return this._backing.getName()}get name(){return be(this._backing.getName(),"name","getName")}async getTimeResolution(){return this._backing.getTimeResolution()}get timeResolution(){return be(this._backing.getTimeResolution(),"timeResolution","getTimeResolution")}async isRelativeToUnixEpoch(){return this._backing.isRelativeToUnixEpoch()}async getUnixTimeForTimestamp(e){return this._backing.getUnixTimeForTimestamp(e)}async hasUnixTimeMapping(){return await this._backing.getUnixTimeForTimestamp(await this.getFirstTimestamp())!==null}async getDisposition(){return this._backing.getDisposition()}get disposition(){return be(this._backing.getDisposition(),"disposition","getDisposition")}async getBitrate(){return this._backing.getBitrate()}async getAverageBitrate(){return this._backing.getAverageBitrate()}async getFirstTimestamp(){return (await this._backing.getFirstPacket({metadataOnly:!0}))?.timestamp??0}async computeDuration(e){let r=await this._backing.getPacket(1/0,{metadataOnly:!0,...e}),i=(r?.timestamp??0)+(r?.duration??0);return Zr(i,await this.getTimeResolution())}async getDurationFromMetadata(e={}){return this._backing.getDurationFromMetadata(e)}async computePacketStats(e=1/0,r){let i=new Ze(this),n=1/0,s=-1/0,o=0,a=0;for await(let c of i.packets(void 0,void 0,{metadataOnly:!0,...r})){if(o>=e&&c.timestamp>=s)break;n=Math.min(n,c.timestamp),s=Math.max(s,c.timestamp+c.duration),o++,a+=c.byteLength;}return {packetCount:o,averagePacketRate:o?Number((o/(s-n)).toPrecision(16)):0,averageBitrate:o?Number((8*a/(s-n)).toPrecision(16)):0}}async isLive(){return await this._backing.getLiveRefreshInterval()!==null}async getLiveRefreshInterval(){return this._backing.getLiveRefreshInterval()}canBePairedWith(e){if(!(e instanceof t))throw new TypeError("other must be an InputTrack.");return this.input!==e.input||this===e?!1:(this._backing.getPairingMask()&e._backing.getPairingMask())!==0n}async getPairableTracks(e){return this.input.getTracks($t({filter:r=>r.canBePairedWith(this)},e))}async getPairableVideoTracks(e){return this.input.getVideoTracks($t({filter:r=>r.canBePairedWith(this)},e))}async getPairableAudioTracks(e){return this.input.getAudioTracks($t({filter:r=>r.canBePairedWith(this)},e))}async getPrimaryPairableVideoTrack(e){return this.input.getPrimaryVideoTrack($t({filter:r=>r.canBePairedWith(this)},e))}async getPrimaryPairableAudioTrack(e){return this.input.getPrimaryAudioTrack($t({filter:r=>r.canBePairedWith(this)},e))}async hasPairableTrack(e){e&&(e=js(e));let r=await this.input.getTracks();for(let i of r)if(this.canBePairedWith(i)&&(!e||await e(i)))return !0;return !1}hasPairableVideoTrack(e){return e&&(e=js(e)),this.hasPairableTrack(async r=>r.isVideoTrack()&&(!e||await e(r)))}hasPairableAudioTrack(e){return e&&(e=js(e)),this.hasPairableTrack(async r=>r.isAudioTrack()&&(!e||await e(r)))}},be=(t,e,r)=>{if(U(t))throw new Error(`'${e}' is deprecated and not available synchronously for this track. Use the preferred '${r}()' instead.`);return t},js=t=>{if(t!==void 0&&typeof t!="function")throw new TypeError("predicate, when provided, must be a function.");return t?e=>{let r=n=>{if(typeof n!="boolean")throw new TypeError("predicate must return or resolve to a boolean value.");return n},i=t(e);return U(i)?i.then(r):r(i)}:void 0},lr=class extends zr{constructor(e,r){super(e,r),this._pixelAspectRatioCache=null,this._backing=r;}get type(){return "video"}async getCodec(){return this._backing.getCodec()}get codec(){return be(this._backing.getCodec(),"codec","getCodec")}async hasOnlyKeyPackets(){return await this._backing.getHasOnlyKeyPackets?.()??await this._backing.getCodec()==="prores"}async getCodedWidth(){return this._backing.getCodedWidth()}get codedWidth(){return be(this._backing.getCodedWidth(),"codedWidth","getCodedWidth")}async getCodedHeight(){return this._backing.getCodedHeight()}get codedHeight(){return be(this._backing.getCodedHeight(),"codedHeight","getCodedHeight")}async getRotation(){return this._backing.getRotation()}get rotation(){return be(this._backing.getRotation(),"rotation","getRotation")}async getSquarePixelWidth(){return this._backing.getSquarePixelWidth()}get squarePixelWidth(){return be(this._backing.getSquarePixelWidth(),"squarePixelWidth","getSquarePixelWidth")}async getSquarePixelHeight(){return this._backing.getSquarePixelHeight()}get squarePixelHeight(){return be(this._backing.getSquarePixelHeight(),"squarePixelHeight","getSquarePixelHeight")}async getPixelAspectRatio(){return this._pixelAspectRatioCache??(this._pixelAspectRatioCache=Lt({num:await this.getSquarePixelWidth()*await this.getCodedHeight(),den:await this.getSquarePixelHeight()*await this.getCodedWidth()}))}get pixelAspectRatio(){return this._pixelAspectRatioCache??(this._pixelAspectRatioCache=Lt({num:be(this._backing.getSquarePixelWidth(),"pixelAspectRatio","getPixelAspectRatio")*be(this._backing.getCodedHeight(),"pixelAspectRatio","getPixelAspectRatio"),den:be(this._backing.getSquarePixelHeight(),"pixelAspectRatio","getPixelAspectRatio")*be(this._backing.getCodedWidth(),"pixelAspectRatio","getPixelAspectRatio")}))}async getDisplayWidth(){let e=await this._backing.getMetadataDisplayWidth?.();return e??(await this.getRotation()%180===0?this.getSquarePixelWidth():this.getSquarePixelHeight())}get displayWidth(){let e=this._backing.getMetadataDisplayWidth?.();if(e!==void 0){let n=be(e,"displayWidth","getDisplayWidth");if(n!==null)return n}let i=be(this._backing.getRotation(),"displayWidth","getDisplayWidth")%180===0?this._backing.getSquarePixelWidth():this._backing.getSquarePixelHeight();return be(i,"displayWidth","getDisplayWidth")}async getDisplayHeight(){let e=await this._backing.getMetadataDisplayHeight?.();return e??(await this.getRotation()%180===0?this.getSquarePixelHeight():this.getSquarePixelWidth())}get displayHeight(){let e=this._backing.getMetadataDisplayHeight?.();if(e!==void 0){let n=be(e,"displayHeight","getDisplayHeight");if(n!==null)return n}let i=be(this._backing.getRotation(),"displayHeight","getDisplayHeight")%180===0?this._backing.getSquarePixelHeight():this._backing.getSquarePixelWidth();return be(i,"displayHeight","getDisplayHeight")}async getColorSpace(){return this._backing.getColorSpace()}async hasHighDynamicRange(){let e=await this._backing.getColorSpace();return e.primaries==="bt2020"||e.primaries==="smpte432"||e.transfer==="pq"||e.transfer==="hlg"||e.matrix==="bt2020-ncl"}async canBeTransparent(){return this._backing.canBeTransparent()}async getDecoderConfig(){return this._backing.getDecoderConfig()}async getCodecParameterString(){let e=await this._backing.getMetadataCodecParameterString?.();return e??(await this._backing.getDecoderConfig())?.codec??null}async canDecode(){try{let e=await this._backing.getDecoderConfig();if(!e)return !1;let r=await this._backing.getCodec();return g(r!==null),Rn.some(n=>n.supports(r,e))?!0:typeof VideoDecoder>"u"?!1:(await VideoDecoder.isConfigSupported(e)).supported===!0}catch(e){return $._error("Error during decodability check:",e),!1}}async determinePacketType(e){if(!(e instanceof me))throw new TypeError("packet must be an EncodedPacket.");if(e.isMetadataOnly)throw new TypeError("packet must not be metadata-only to determine its type.");let r=await this.getCodec();if(r===null)return null;let i=await this.getDecoderConfig();return g(i),Er(r,i,e.data)}async computeFrameRateMetrics(e={}){if(!e||typeof e!="object")throw new TypeError("options must be an object.");if(e.targetPacketCount!==void 0&&(!et(e.targetPacketCount)||e.targetPacketCount<0))throw new TypeError("options.targetPacketCount must be a non-negative number.");let r=await this.getTimeResolution(),i=e.targetPacketCount??256,n=new Ze(this),s=[],o=-1/0,a=0;for await(let M of n.packets(void 0,void 0,{metadataOnly:!0})){if(s.length>=i&&M.timestamp>=o)break;s.push(M.timestamp),o=Math.max(o,M.timestamp),a++;}let c=new Float64Array(s.length);for(let M=0;M<s.length;M++)c[M]=Math.round(s[M]*r);c.sort();let u=1;for(let M=1;M<c.length;M++)c[M]!==c[u-1]&&(c[u++]=c[M]);if(u<2)return {underlyingFrameRate:null,bestGuessFrameRate:r,minFrameRate:r,maxFrameRate:r,averageFrameRate:r,medianFrameRate:r,frameRateIsConstant:!0,probedPacketCount:a};let l=c.subarray(0,u),d=zl(l,r),f=d??r,m=d!==null?r/d:null,p=new Map,b=1/0,y=-1/0,w=0;for(let M=1;M<u;M++){let q=l[M]-l[M-1],N=m!==null?Math.max(1,Math.round(q/m)):q;p.set(N,(p.get(N)??0)+1),b=Math.min(b,N),y=Math.max(y,N),w+=N;}let T=u-1,A=[...p.keys()].sort((M,q)=>M-q),E=T-1>>1,P=T>>1,I=0,v=0,k=0;for(let M of A)if(k+=p.get(M),I===0&&k>E&&(I=M),k>P){v=M;break}let C=(f/I+f/v)/2;return {underlyingFrameRate:d,bestGuessFrameRate:d!==null?d:Ul(C),minFrameRate:f/y,maxFrameRate:f/b,averageFrameRate:f*T/w,medianFrameRate:C,frameRateIsConstant:d!==null&&b===1&&y===1,probedPacketCount:a}}},ur=class extends zr{constructor(e,r){super(e,r),this._backing=r;}get type(){return "audio"}async getCodec(){return this._backing.getCodec()}get codec(){return be(this._backing.getCodec(),"codec","getCodec")}async hasOnlyKeyPackets(){return await this._backing.getHasOnlyKeyPackets?.()??!0}async getNumberOfChannels(){return this._backing.getNumberOfChannels()}get numberOfChannels(){return be(this._backing.getNumberOfChannels(),"numberOfChannels","getNumberOfChannels")}async getSampleRate(){return this._backing.getSampleRate()}get sampleRate(){return be(this._backing.getSampleRate(),"sampleRate","getSampleRate")}async getDecoderConfig(){return this._backing.getDecoderConfig()}async getCodecParameterString(){let e=await this._backing.getMetadataCodecParameterString?.();return e??(await this._backing.getDecoderConfig())?.codec??null}async canDecode(){try{let e=await this._backing.getDecoderConfig();if(!e)return !1;let r=await this._backing.getCodec();return g(r!==null),Fn.some(i=>i.supports(r,e))||e.codec.startsWith("pcm-")?!0:typeof AudioDecoder>"u"?!1:(await AudioDecoder.isConfigSupported(e)).supported===!0}catch(e){return $._error("Error during decodability check:",e),!1}}async determinePacketType(e){if(!(e instanceof me))throw new TypeError("packet must be an EncodedPacket.");return await this.getCodec()===null?null:"key"}};var Qs=t=>-(t??-1/0),Ur=t=>-t,Vr=t=>{if(typeof t!="object"||!t)throw new TypeError("query must be an object.");if(t.filter!==void 0&&typeof t.filter!="function")throw new TypeError("query.filter, when provided, must be a function.");if(t.sortBy!==void 0&&typeof t.sortBy!="function")throw new TypeError("query.sortBy, when provided, must be a function.");return {filter:t.filter?e=>{let r=n=>{if(typeof n!="boolean")throw new TypeError("query.filter must return or resolve to a boolean.");return n},i=t.filter(e);return U(i)?i.then(r):r(i)}:void 0,sortBy:t.sortBy?e=>{let r=n=>{if(typeof n!="number"&&(!Array.isArray(n)||!n.every(s=>typeof s=="number")))throw new TypeError("query.sortBy must return or resolve to a number or an array of numbers.");return n},i=t.sortBy(e);return U(i)?i.then(r):r(i)}:void 0}},$t=(t,e)=>({filter:t?.filter||e?.filter?r=>{let i=t?.filter?.(r)??!0,n=s=>s===!1?!1:e?.filter?.(r)??!0;return U(i)?i.then(n):n(i)}:void 0,sortBy:t?.sortBy||e?.sortBy?r=>{let i=t?.sortBy?.(r)??[],n=e?.sortBy?.(r)??[],s=(o,a)=>[...Array.isArray(o)?o:[o],...Array.isArray(a)?a:[a]];return U(i)||U(n)?Promise.all([i,n]).then(([o,a])=>s(o,a)):s(i,n)}:void 0}),Dn=async(t,e)=>{let r=t;if(e?.filter){let o=t.map(c=>e.filter(c));if(o.some(c=>U(c))){let c=await Promise.all(o);r=t.filter((u,l)=>c[l]);}else r=t.filter((c,u)=>o[u]);}if(!e?.sortBy)return r;let i=r.map(o=>e.sortBy(o)),s=i.some(o=>U(o))?await Promise.all(i):i;return r.map((o,a)=>({track:o,sortValue:s[a]})).sort((o,a)=>{let c=Array.isArray(o.sortValue)?o.sortValue:[o.sortValue],u=Array.isArray(a.sortValue)?a.sortValue:[a.sortValue],l=Math.max(c.length,u.length);for(let d=0;d<l;d++){let f=c[d]??0,m=u[d]??0;if(f!==m)return f-m}return 0}).map(o=>o.track)},zl=(t,e)=>{let n=1.000000001,s=1e3,o=[12,15,20,24e3/1001,24,25,3e4/1001,30,48,50,6e4/1001,60,100,12e4/1001,120,144,240];if(t.length<2)return null;let a=new Float64Array(t.length-1);for(let v=1;v<t.length;v++){let k=t[v]-t[v-1];if(!(k>0))return null;a[v-1]=k;}let c=a.slice();c.sort();let u=c[Math.floor(c.length*.05)];for(let v=0;v<6;v++){let k=0,C=0;for(let q of a){let N=Math.max(1,Math.round(q/u));Math.abs(q-N*u)>=n||(k+=q,C+=N);}if(C===0)return null;let M=k/C;if(Math.abs(M-u)<=1e-12*Math.max(1,u)){u=M;break}u=M;}let l=0,d=0,f=0;for(let v of a){let k=Math.max(1,Math.round(v/u));Math.abs(v-k*u)>=n||(l++,d+=v,f+=k);}if(l/a.length<.98)return null;u=d/f;let m=1/Math.min(f,s),p=Math.max(Number.EPSILON,u-m),b=u+m,y=e/b,w=e/p,T=e/u,A=null,E=1/0;for(let v of o){if(v<y||v>w)continue;let k=Math.abs(v/T-1);k<E&&(A=v,E=k);}if(A===null){let v=Ja(p,b,1e6),k=Ja(y,w,1e6);if(k&&(!v||k.den<v.den||k.den===v.den&&k.num<=v.num))A=k.num/k.den;else if(v)A=e*v.den/v.num;else return null}let P=e/A,I=0;for(let v of a){let k=Math.max(1,Math.round(v/P));Math.abs(v-k*P)<n&&I++;}return I/a.length<.98?null:A},Ja=(t,e,r)=>{for(let i=1;i<=r;i++){let n=Math.floor(t*i)+1;if(n/i<e)return Lt({num:n,den:i})}return null},Ul=t=>{let e=[23.976023976023978,29.970029970029973,59.940059940059946,119.88011988011989],r=[12,15,20,24,25,30,48,50,60,100,120,144,240],i=5e-4,n=.025;for(let a of e)if(Math.abs(a/t-1)<=i)return a;let s=t,o=1/0;for(let a of r){let c=Math.abs(a/t-1);c<=n&&c<o&&(s=a,o=c);}return s};Tr();var Vl=1;var dr=class t extends Qe{get disposed(){return this._disposed}constructor(e){if(super(),this._demuxerPromise=null,this._format=null,this._trackBackingsCache=null,this._backingToTrack=new Map,this._disposed=!1,this._nextSourceCacheAge=0,this._sourceRefs=[],this._sourceCache=[],this._sourceCachePromises=[],this._onFormatDetermined=null,!e||typeof e!="object")throw new TypeError("options must be an object.");if(!Array.isArray(e.formats)||e.formats.some(r=>!(r instanceof ir)))throw new TypeError("options.formats must be an array of InputFormat.");if(!(e.source instanceof $e||e.source instanceof rr))throw new TypeError("options.source must be a Source or SourceRef.");if(e.source instanceof $e&&e.source._disposed)throw new TypeError("options.source must not be a disposed Source.");if(e.initInput!==void 0&&!(e.initInput instanceof t))throw new TypeError("options.initInput, when provided, must be an Input.");e.formatOptions!==void 0&&va(e.formatOptions,"formatOptions"),this._formats=e.formats,this._initInput=e.initInput??null,this._formatOptions=e.formatOptions??{},e.source instanceof $e?this._rootRef=e.source.ref():this._rootRef=e.source,this._sourceRefs.push(this._rootRef);}get _rootSource(){return this._rootRef.source}async _getSourceUncached(e){g(this._rootSource instanceof hi);let r=await this._rootSource._resolveRequest(e);return this._emit("source",{source:r.source,request:e,isRoot:e.isRoot}),r}_getSourceCached(e,r=Vl){let i=this._sourceCache.find(o=>o.cacheGroup===r&&Fs(o.request,e));if(i)return i.age++,Promise.resolve(i.sourceRef.source.ref());let n=this._sourceCachePromises.find(o=>o.cacheGroup===r&&Fs(o.request,e));if(n)return n.promise.then(o=>o.sourceRef.source.ref());let s=(async()=>{let o=await this._getSourceUncached(e);if(_o(this._sourceCache,d=>d.cacheGroup===r&&d.sourceRef.source._refCount===1)>=4){let d=qi(this._sourceCache,m=>m.cacheGroup===r&&m.sourceRef.source._refCount===1?m.age:1/0);g(d!==-1);let f=this._sourceCache[d];this._sourceCache.splice(d,1),f.sourceRef.free(),Gr(this._sourceRefs,f.sourceRef);}this._sourceRefs.push(o);let u=this._sourceCachePromises.findIndex(d=>d.request===e);return g(u!==-1),this._sourceCachePromises.splice(u,1),{request:e,sourceRef:o,age:this._nextSourceCacheAge++,cacheGroup:r}})();return this._sourceCachePromises.push({request:e,cacheGroup:r,promise:s}),s.then(o=>{let a=o.sourceRef.source.ref();return this._sourceCache.push(o),a})}_getDemuxer(){return this._demuxerPromise??(this._demuxerPromise=(async()=>{this._reader=new On(this._rootSource),this._emit("source",{source:this._rootSource,request:null,isRoot:!0});for(let e of this._formats)if(await e._canReadInput(this))return this._format=e,this._onFormatDetermined?.(e),e._createDemuxer(this);throw new Ei})())}get source(){return this._rootSource}async getFormat(){return await this._getDemuxer(),g(this._format),this._format}async canRead(){try{return await this._getDemuxer(),!0}catch(e){if(e instanceof Ei)return !1;throw e}}async getFirstTimestamp(e){e??(e=await this.getTracks());let r=e.filter(s=>s!==null);if(r.length===0)return 0;let i=await Promise.all(r.map(s=>s._backing.getFirstPacket({metadataOnly:!0}))),n=Math.min(...i.map(s=>s?.timestamp??1/0));return n===1/0?0:n}async computeDuration(e,r){e??(e=await this.getTracks());let i=e.filter(s=>s!==null);if(i.length===0)return 0;let n=await Promise.all(i.map(s=>s.computeDuration(r)));return Math.max(...n)}async getDurationFromMetadata(e,r){e??(e=await this.getTracks());let i=e.filter(o=>o!==null),s=(await Promise.all(i.map(o=>o.getDurationFromMetadata(r)))).filter(o=>o!==null);return s.length===0?null:Math.max(...s)}async getTracks(e){e&&(e=Vr(e));let i=(await this._getTrackBackings()).map(n=>this._wrapBackingAsTrack(n));return Dn(i,e)}async getVideoTracks(e){e&&(e=Vr(e));let i=(await this.getTracks()).filter(n=>n.isVideoTrack());return Dn(i,e)}async getAudioTracks(e){e&&(e=Vr(e));let i=(await this.getTracks()).filter(n=>n.isAudioTrack());return Dn(i,e)}async getPrimaryVideoTrack(e){e&&(e=Vr(e));let r=$t(e,{sortBy:async n=>[Ur((await n.getDisposition()).default),Ur(await n.hasPairableAudioTrack()),Ur(!await n.hasOnlyKeyPackets()),Qs(await n.getBitrate())]});return (await this.getVideoTracks(r))[0]??null}async getPrimaryAudioTrack(e){e&&(e=Vr(e));let r=await this.getPrimaryVideoTrack(),i=$t(e,{sortBy:async s=>[Ur(!r||s.canBePairedWith(r)),Ur((await s.getDisposition()).default),Qs(await s.getBitrate())]});return (await this.getAudioTracks(i))[0]??null}async _getTrackBackings(){let e=await this._getDemuxer();return this._trackBackingsCache??(this._trackBackingsCache=await e.getTrackBackings())}_wrapBackingAsTrack(e){let r=this._backingToTrack.get(e);if(r)return r;let n=e.getType()==="video"?new lr(this,e):new ur(this,e);return this._backingToTrack.set(e,n),n}async getMimeType(){return (await this._getDemuxer()).getMimeType()}async getMetadataTags(){return (await this._getDemuxer()).getMetadataTags()}dispose(){if(!this._disposed){this._disposed=!0;for(let e of this._sourceRefs)e.free();this._sourceRefs.length=0,this._demuxerPromise&&this._demuxerPromise.then(e=>e.dispose()).catch(()=>{});}}[Symbol.dispose](){this.dispose();}},Ei=class extends Error{constructor(e="Input has an unsupported or unrecognizable format."){super(e),this.name="UnsupportedInputFormatError";}},Ce=class extends Error{constructor(e="Input has been disposed."){super(e),this.name="InputDisposedError";}};var On=class{constructor(e){this.source=e;}get fileSize(){let e=this.source._getFileSize();if(e===void 0)throw new Error("Reading file size too early; read required first.");return e}get fileSizeNonStrict(){return this.source._getFileSize()??null}requestSlice(e,r){if(this.source._disposed)throw new Ce;if(e<0||this.fileSizeNonStrict!==null&&e+r>this.fileSizeNonStrict)return null;if(r===0){let s=new Uint8Array(0);return new ot(s,oe(s),0,e,e)}let i=e+r,n=this.source._read(e,i,Is,Rs);return U(n)?n.then(s=>s?new ot(s.bytes,s.view,s.offset,e,i):null):n?new ot(n.bytes,n.view,n.offset,e,i):null}requestSliceRange(e,r,i){if(this.source._disposed)throw new Ce;if(e<0)return null;if(this.fileSizeNonStrict!==null)return this.requestSlice(e,fe(this.fileSizeNonStrict-e,r,i));{let n=this.requestSlice(e,i),s=o=>o||(g(this.fileSizeNonStrict!==null),this.requestSlice(e,fe(this.fileSizeNonStrict-e,r,i)));return U(n)?n.then(s):s(n)}}requestEntireFile(){if(this.fileSizeNonStrict!==null)return this.requestSlice(0,this.fileSizeNonStrict);let e=1024;return (async()=>{let r=[],i=0;for(;;){if(r.length===1&&this.fileSizeNonStrict!==null)return this.requestSlice(0,this.fileSizeNonStrict);let o=this.requestSliceRange(i,0,e);if(U(o)&&(o=await o),!o||o.length===0)break;let a=ee(o,o.length);r.push(a),i+=o.length;}let n=new Uint8Array(i),s=0;for(let o of r)n.set(o,s),s+=o.length;return new ot(n,oe(n),0,0,i)})()}},ot=class t{constructor(e,r,i,n,s){this.bytes=e,this.view=r,this.offset=i,this.start=n,this.end=s,this.bufferPos=n-i;}static tempFromBytes(e){return new t(e,oe(e),0,0,e.length)}get length(){return this.end-this.start}get filePos(){return this.offset+this.bufferPos}set filePos(e){this.bufferPos=e-this.offset;}get remainingLength(){return Math.max(this.end-this.filePos,0)}skip(e){this.bufferPos+=e;}slice(e,r=this.end-e){if(e<this.start||e+r>this.end)throw new RangeError("Slicing outside of original slice.");return new t(this.bytes,this.view,this.offset,e,e+r)}},wt=(t,e)=>{if(t.filePos<t.start||t.filePos+e>t.end)throw new RangeError(`Tried reading [${t.filePos}, ${t.filePos+e}), but slice is [${t.start}, ${t.end}). This is likely an internal error, please report it alongside the file that caused it.`)},ee=(t,e)=>{wt(t,e);let r=t.bytes.subarray(t.bufferPos,t.bufferPos+e);return t.bufferPos+=e,r},K=t=>(wt(t,1),t.view.getUint8(t.bufferPos++));var Pe=t=>{wt(t,2);let e=t.view.getUint16(t.bufferPos,!1);return t.bufferPos+=2,e},Dt=t=>{wt(t,3);let e=er(t.view,t.bufferPos,!1);return t.bufferPos+=3,e},ui=t=>{wt(t,2);let e=t.view.getInt16(t.bufferPos,!1);return t.bufferPos+=2,e};var O=t=>{wt(t,4);let e=t.view.getUint32(t.bufferPos,!1);return t.bufferPos+=4,e};var Bt=t=>{wt(t,4);let e=t.view.getInt32(t.bufferPos,!1);return t.bufferPos+=4,e};var Be=t=>{let e=O(t),r=O(t);return e*4294967296+r},Ta=t=>{let e=Bt(t),r=O(t);return e*4294967296+r};var ka=t=>{wt(t,4);let e=t.view.getFloat32(t.bufferPos,!1);return t.bufferPos+=4,e},bn=t=>{wt(t,8);let e=t.view.getFloat64(t.bufferPos,!1);return t.bufferPos+=8,e},Ne=(t,e)=>{wt(t,e);let r="";for(let i=0;i<e;i++)r+=String.fromCharCode(t.bytes[t.bufferPos++]);return r};var zn=class{constructor(e){this.mutex=new gr,this.trackTimestampInfo=new WeakMap,this.output=e;}onTrackClose(e){}validateTimestamp(e,r,i){let n=this.trackTimestampInfo.get(e);if(n){if(i&&(n.maxTimestampBeforeLastKeyPacket=n.maxTimestamp),n.maxTimestampBeforeLastKeyPacket!==null&&r<n.maxTimestampBeforeLastKeyPacket)throw new Error(`Timestamps cannot be smaller than the largest timestamp of the previous GOP (a GOP begins with a key packet and ends right before the next key packet). Got ${r}s, but largest timestamp is ${n.maxTimestampBeforeLastKeyPacket}s.`);n.maxTimestamp=Math.max(n.maxTimestamp,r);}else {if(!i)throw new Error("First packet must be a key packet.");n={maxTimestamp:r,maxTimestampBeforeLastKeyPacket:null},this.trackTimestampInfo.set(e,n);}}};var Ks=/<(?:(\d{2}):)?(\d{2}):(\d{2}).(\d{3})>/g;var ec=t=>{let e=Math.floor(t/36e5),r=Math.floor(t%(3600*1e3)/(60*1e3)),i=Math.floor(t%(60*1e3)/1e3),n=t%1e3;return e.toString().padStart(2,"0")+":"+r.toString().padStart(2,"0")+":"+i.toString().padStart(2,"0")+"."+n.toString().padStart(3,"0")};var fr=class{constructor(e){this.writer=e,this.helper=new Uint8Array(8),this.helperView=new DataView(this.helper.buffer),this.offsets=new WeakMap;}writeU32(e){this.helperView.setUint32(0,e,!1),this.writer.write(this.helper.subarray(0,4));}writeU64(e){this.helperView.setUint32(0,Math.floor(e/2**32),!1),this.helperView.setUint32(4,e,!1),this.writer.write(this.helper.subarray(0,8));}writeAscii(e){for(let r=0;r<e.length;r++)this.helperView.setUint8(r%8,e.charCodeAt(r)),r%8===7&&this.writer.write(this.helper);e.length%8!==0&&this.writer.write(this.helper.subarray(0,e.length%8));}writeBox(e){if(this.offsets.set(e,this.writer.getPos()),e.contents&&!e.children)this.writeBoxHeader(e,e.size??e.contents.byteLength+8),this.writer.write(e.contents);else {let r=this.writer.getPos();if(this.writeBoxHeader(e,0),e.contents&&this.writer.write(e.contents),e.children)for(let s of e.children)s&&this.writeBox(s);let i=this.writer.getPos(),n=e.size??i-r;this.writer.seek(r),this.writeBoxHeader(e,n),this.writer.seek(i);}}writeBoxHeader(e,r){this.writeU32(e.largeSize?1:r),this.writeAscii(e.type),e.largeSize&&this.writeU64(r);}measureBoxHeader(e){return 8+(e.largeSize?8:0)}patchBox(e){let r=this.offsets.get(e);g(r!==void 0);let i=this.writer.getPos();this.writer.seek(r),this.writeBox(e),this.writer.seek(i);}measureBox(e){if(e.contents&&!e.children)return this.measureBoxHeader(e)+e.contents.byteLength;{let r=this.measureBoxHeader(e);if(e.contents&&(r+=e.contents.byteLength),e.children)for(let i of e.children)i&&(r+=this.measureBox(i));return r}}},J=new Uint8Array(8),Je=new DataView(J.buffer),ke=t=>[(t%256+256)%256],j=t=>(Je.setUint16(0,t,!1),[J[0],J[1]]),Zs=t=>(Je.setInt16(0,t,!1),[J[0],J[1]]),nc=t=>(Je.setUint32(0,t,!1),[J[1],J[2],J[3]]),B=t=>(Je.setUint32(0,t,!1),[J[0],J[1],J[2],J[3]]),Tt=t=>(Je.setInt32(0,t,!1),[J[0],J[1],J[2],J[3]]),ct=t=>(Je.setUint32(0,Math.floor(t/2**32),!1),Je.setUint32(4,t,!1),[J[0],J[1],J[2],J[3],J[4],J[5],J[6],J[7]]),tc=t=>(Je.setInt32(0,Math.floor(t/2**32),!1),Je.setUint32(4,t,!1),[J[0],J[1],J[2],J[3],J[4],J[5],J[6],J[7]]),sc=t=>(Je.setInt16(0,2**8*t,!1),[J[0],J[1]]),Ye=t=>(Je.setInt32(0,2**16*t,!1),[J[0],J[1],J[2],J[3]]),Gs=t=>(Je.setInt32(0,2**30*t,!1),[J[0],J[1],J[2],J[3]]),$s=(t,e)=>{let r=[],i=t;do{let n=i&127;i>>=7,r.length>0&&(n|=128),r.push(n),e!==void 0&&e--;}while(i>0||e);return r.reverse()},he=(t,e=!1)=>{let r=Array(t.length).fill(null).map((i,n)=>t.charCodeAt(n));return e&&r.push(0),r},oc=t=>{let e=t*(Math.PI/180),r=Math.round(Math.cos(e)),i=Math.round(Math.sin(e));return [r,i,0,-i,r,0,0,0,1]},ac=oc(0),cc=t=>[Ye(t[0]),Ye(t[1]),Gs(t[2]),Ye(t[3]),Ye(t[4]),Gs(t[5]),Ye(t[6]),Ye(t[7]),Gs(t[8])],W=(t,e,r)=>({type:t,contents:e&&new Uint8Array(e.flat(10)),children:r}),ce=(t,e,r,i,n)=>W(t,[ke(e),nc(r),i??[]],n),lc=t=>t.isQuickTime?W("ftyp",[he("qt  "),B(512),he("qt  ")]):t.fragmented?t.cmaf?W("ftyp",[he("iso5"),B(512),he("iso5"),he("iso6"),he("mp41"),he("cmfc"),he("dash")]):W("ftyp",[he("iso5"),B(512),he("iso5"),he("iso6"),he("mp41")]):W("ftyp",[he("isom"),B(512),he("isom"),t.holdsAvc?he("avc1"):[],he("mp41")]),Ys=()=>W("styp",[he("iso5"),B(0),he("iso5"),he("iso6"),he("mp41"),he("cmfc"),he("dash")]),Js=(t,e)=>{let r=Math.max(0,t.minWrittenTimestamp),i=Math.max(0,t.maxWrittenEndTimestamp-r);return Number.isFinite(i)||(i=0),ce("sidx",1,0,[B(1),B(qe),ct(pe(r,qe)),ct(0),j(0),j(1),B(e&2147483647),B(pe(i,qe)),B(0)])},Pi=t=>({type:"mdat",largeSize:t}),uc=t=>({type:"free",size:t}),Nr=t=>W("moov",void 0,[Nl(t.creationTime,t.trackDatas),...t.trackDatas.map(e=>Wl(e,t.creationTime)),t.isFragmented?Eu(t.trackDatas):null,Ou(t)]),Nl=(t,e)=>{let r=Math.max(0,...e.map(o=>Math.max(0,pe(vi(o),qe)+pe(o.startTimestampOffset??0,qe)))),i=Math.max(0,...e.map(o=>o.track.id))+1,n=!lt(t)||!lt(r),s=n?ct:B;return ce("mvhd",+n,0,[s(t),s(t),B(qe),s(r),Ye(1),sc(1),Array(10).fill(0),cc(ac),Array(24).fill(0),B(i)])},vi=t=>{if(t.samples.length===0)return 0;let e=1/0,r=-1/0;for(let i=0;i<t.samples.length;i++){let n=t.samples[i];n.timestamp<e&&(e=n.timestamp),n.timestamp+n.duration>r&&(r=n.timestamp+n.duration);}return e===1/0?0:r-e},Wl=(t,e)=>{let r=bc(t),i=t.startTimestampOffset!==null&&t.startTimestampOffset!==0;return W("trak",void 0,[ql(t,e),i?Ll(t):null,Hl(t,e),r.name!==void 0?W("udta",void 0,[W("name",[...He.encode(r.name)])]):null])},ql=(t,e)=>{let r=Math.max(0,pe(vi(t),qe)+pe(t.startTimestampOffset??0,qe)),i=!lt(e)||!lt(r),n=i?ct:B,s;if(t.type==="video"){let c=t.track.metadata.rotation;s=oc(c??0);}else s=ac;let o=2;t.track.metadata.disposition?.default!==!1&&(o|=1);let a=t.type==="video"?0:t.type==="audio"?1:t.type==="subtitle"?2:ve(t);return ce("tkhd",+i,o,[n(e),n(e),B(t.track.id),B(0),n(r),Array(8).fill(0),j(0),j(a),sc(t.type==="audio"?1:0),j(0),cc(s),Ye(t.type==="video"?t.info.width:0),Ye(t.type==="video"?t.info.height:0)])},Ll=t=>{let e=t.startTimestampOffset;if(g(e!==null),e>0){let r=pe(e,qe),i=pe(vi(t),qe),n=!lt(r)||!lt(i),s=n?ct:B,o=n?tc:Tt;return W("edts",void 0,[ce("elst",n?1:0,0,[B(2),s(r),o(-1),Ye(1),s(i),o(0),Ye(1)])])}else {let r=pe(-e,t.timescale),i=Math.max(0,pe(vi(t),qe)+pe(e,qe)),n=!mo(r)||!lt(i),s=n?ct:B,o=n?tc:Tt;return W("edts",void 0,[ce("elst",n?1:0,0,[B(1),s(i),o(r),Ye(1)])])}},Hl=(t,e)=>W("mdia",void 0,[jl(t,e),eo(!0,Ql[t.type],Kl[t.type]),Gl(t)]),jl=(t,e)=>{let r=pe(vi(t),t.timescale),i=!lt(e)||!lt(r),n=i?ct:B;return ce("mdhd",+i,0,[n(e),n(e),B(t.timescale),n(r),j(yc(t.track.metadata.languageCode??qt)),j(0)])},Ql={video:"vide",audio:"soun",subtitle:"text"},Kl={video:"MediabunnyVideoHandler",audio:"MediabunnySoundHandler",subtitle:"MediabunnyTextHandler"},eo=(t,e,r,i="\0\0\0\0")=>ce("hdlr",0,0,[t?he("mhlr"):B(0),he(e),he(i),B(0),B(0),he(r,!0)]),Gl=t=>W("minf",void 0,[Yl[t.type](),Jl(),ru(t)]),$l=()=>ce("vmhd",0,1,[j(0),j(0),j(0),j(0)]),Xl=()=>ce("smhd",0,0,[j(0),j(0)]),Zl=()=>ce("nmhd",0,0),Yl={video:$l,audio:Xl,subtitle:Zl},Jl=()=>W("dinf",void 0,[eu()]),eu=()=>ce("dref",0,0,[B(1)],[tu()]),tu=()=>ce("url ",0,1),ru=t=>{let e=t.compositionTimeOffsetTable.length>1||t.compositionTimeOffsetTable.some(r=>r.sampleCompositionTimeOffset!==0);return W("stbl",void 0,[iu(t),Tu(t),e?_u(t):null,e?Cu(t):null,ku(t),Su(t),xu(t),Au(t)])},iu=t=>{let e;if(t.type==="video")e=nu(Nu(t.track.source._codec,t.info.decoderConfig.codec),t);else if(t.type==="audio"){let r=wc(t.track.source._codec,t.info.decoderConfig.codec,t.muxer.isQuickTime);g(r),e=uu(r,t);}else t.type==="subtitle"&&(e=yu(Lu[t.track.source._codec],t));return g(e),ce("stsd",0,0,[B(1)],[e])},nu=(t,e)=>W(t,[Array(6).fill(0),j(1),j(0),j(0),Array(12).fill(0),j(e.info.width),j(e.info.height),B(4718592),B(4718592),B(0),j(1),ke(10),he("Mediabunny"),Array(21).fill(0),j(e.info.hasAlphaChannel?32:24),Zs(65535)],[Wu[e.track.source._codec]?.(e)??null,su(e),po(e.info.decoderConfig.colorSpace)?null:ou(e)]),su=t=>t.info.pixelAspectRatio.num===t.info.pixelAspectRatio.den?null:W("pasp",[B(t.info.pixelAspectRatio.num),B(t.info.pixelAspectRatio.den)]),ou=t=>{let e=t.info.decoderConfig.colorSpace;return W("colr",[he(t.muxer.isQuickTime?"nclc":"nclx"),j(e?.primaries!=null?St[e.primaries]:2),j(e?.transfer!=null?xt[e.transfer]:2),j(e?.matrix!=null?_t[e.matrix]:2),t.muxer.isQuickTime?[]:ke((e?.fullRange?1:0)<<7)])},au=t=>t.info.decoderConfig&&W("avcC",[..._e(t.info.decoderConfig.description)]),cu=t=>t.info.decoderConfig&&W("hvcC",[..._e(t.info.decoderConfig.description)]),rc=t=>{if(!t.info.decoderConfig)return null;let e=t.info.decoderConfig,r=e.codec.split("."),i=Number(r[1]),n=Number(r[2]),s=Number(r[3]),o=r[4]?Number(r[4]):1,a=r[8]?Number(r[8]):Number(e.colorSpace?.fullRange??0),c=(s<<4)+(o<<1)+a,u=r[5]?Number(r[5]):e.colorSpace?.primaries?St[e.colorSpace.primaries]:1,l=r[6]?Number(r[6]):e.colorSpace?.transfer?xt[e.colorSpace.transfer]:1,d=r[7]?Number(r[7]):e.colorSpace?.matrix?_t[e.colorSpace.matrix]:1;return ce("vpcC",1,0,[ke(i),ke(n),ke(c),ke(u),ke(l),ke(d),j(0)])},lu=t=>W("av1C",ia(t.info.decoderConfig.codec)),uu=(t,e)=>{let r=0,i,n=16,s=Se.includes(e.track.source._codec);if(s){let o=e.track.source._codec,{sampleSize:a}=Ve(o);n=8*a,n>16&&(r=1);}if(e.muxer.isQuickTime&&(r=1),r===0)i=[Array(6).fill(0),j(1),j(r),j(0),B(0),j(e.info.numberOfChannels),j(n),j(0),j(0),j(e.info.sampleRate<2**16?e.info.sampleRate:0),j(0)];else {let o=s?0:-2;i=[Array(6).fill(0),j(1),j(r),j(0),B(0),j(e.info.numberOfChannels),j(Math.min(n,16)),Zs(o),j(0),j(e.info.sampleRate<2**16?e.info.sampleRate:0),j(0),s?[B(1),B(n/8),B(e.info.numberOfChannels*n/8)]:[B(0),B(0),B(0)],B(2)];}return W(t,i,[qu(e.track.source._codec,e.muxer.isQuickTime)?.(e)??null])},Xs=t=>{let e;switch(t.track.source._codec){case "aac":e=64;break;case "mp3":e=107;break;case "vorbis":e=221;break;default:throw new Error(`Unhandled audio codec: ${t.track.source._codec}`)}let r=[...ke(e),...ke(21),...nc(0),...B(0),...B(0)];if(t.info.decoderConfig.description){let i=_e(t.info.decoderConfig.description);r=[...r,...ke(5),...$s(i.byteLength),...i];}return r=[...j(1),...ke(0),...ke(4),...$s(r.length),...r,...ke(6),...ke(1),...ke(2)],r=[...ke(3),...$s(r.length),...r],ce("esds",0,0,r)},Xt=t=>W("wave",void 0,[du(t),fu(t),W("\0\0\0\0")]),du=t=>W("frma",[he(wc(t.track.source._codec,t.info.decoderConfig.codec,t.muxer.isQuickTime))]),fu=t=>{let{littleEndian:e}=Ve(t.track.source._codec);return W("enda",[j(+e)])},hu=t=>{let e=t.info.numberOfChannels,r=3840,i=t.info.sampleRate,n=0,s=0,o=new Uint8Array(0),a=t.info.decoderConfig?.description;if(a){g(a.byteLength>=18);let c=_e(a),u=Lo(c);e=u.outputChannelCount,r=u.preSkip,i=u.inputSampleRate,n=u.outputGain,s=u.channelMappingFamily,u.channelMappingTable&&(o=u.channelMappingTable);}return W("dOps",[ke(0),ke(e),j(r),B(i),Zs(n),ke(s),...o])},mu=t=>{let e=t.info.decoderConfig?.description;g(e);let r=_e(e);return ce("dfLa",0,0,[...r.subarray(4)])},yt=t=>{let{littleEndian:e,sampleSize:r}=Ve(t.track.source._codec),i=+e;return ce("pcmC",0,0,[ke(i),ke(8*r)])},pu=t=>{g(t.info.primingPacket);let e=Ho(t.info.primingPacket.data);if(!e)throw new Error("Couldn't extract AC-3 frame info from the audio packet. Ensure the packets contain valid AC-3 sync frames (as specified in ETSI TS 102 366).");let r=new Uint8Array(3),i=new ue(r);return i.writeBits(2,e.fscod),i.writeBits(5,e.bsid),i.writeBits(3,e.bsmod),i.writeBits(3,e.acmod),i.writeBits(1,e.lfeon),i.writeBits(5,e.bitRateCode),i.writeBits(5,0),W("dac3",[...r])},gu=t=>{g(t.info.primingPacket);let e=jo(t.info.primingPacket.data);if(!e)throw new Error("Couldn't extract E-AC-3 frame info from the audio packet. Ensure the packets contain valid E-AC-3 sync frames (as specified in ETSI TS 102 366).");let r=16;for(let o of e.substreams)r+=23,o.numDepSub>0?r+=9:r+=1;let i=Math.ceil(r/8),n=new Uint8Array(i),s=new ue(n);s.writeBits(13,e.dataRate),s.writeBits(3,e.substreams.length-1);for(let o of e.substreams)s.writeBits(2,o.fscod),s.writeBits(5,o.bsid),s.writeBits(1,0),s.writeBits(1,0),s.writeBits(3,o.bsmod),s.writeBits(3,o.acmod),s.writeBits(1,o.lfeon),s.writeBits(3,0),s.writeBits(4,o.numDepSub),o.numDepSub>0?s.writeBits(9,o.chanLoc):s.writeBits(1,0);return W("dec3",[...n])},wu=t=>{g(t.info.primingPacket);let e=ws(t.info.primingPacket.data);if(!e)throw new Error("Couldn't extract DTS frame info from the audio packet. Ensure the packets contain valid DTS frames as specified in ETSI TS 102 114.");return W("ddts",[...Zo(e)])},yu=(t,e)=>W(t,[Array(6).fill(0),j(1)],[Hu[e.track.source._codec](e)]),bu=t=>W("vttC",[...He.encode(t.info.config.description)]);var Tu=t=>ce("stts",0,0,[B(t.timeToSampleTable.length),t.timeToSampleTable.map(e=>[B(e.sampleCount),B(e.sampleDelta)])]),Au=t=>{if(t.samples.every(r=>r.type==="key"))return null;let e=[...t.samples.entries()].filter(([,r])=>r.type==="key");return ce("stss",0,0,[B(e.length),e.map(([r])=>B(r+1))])},ku=t=>ce("stsc",0,0,[B(t.compactlyCodedChunkTable.length),t.compactlyCodedChunkTable.map(e=>[B(e.firstChunk),B(e.samplesPerChunk),B(1)])]),Su=t=>{if(t.type==="audio"&&t.info.requiresPcmTransformation){let{sampleSize:e}=Ve(t.track.source._codec);return ce("stsz",0,0,[B(e*t.info.numberOfChannels),B(t.samples.reduce((r,i)=>r+pe(i.duration,t.timescale),0))])}return ce("stsz",0,0,[B(0),B(t.samples.length),t.samples.map(e=>B(e.size))])},xu=t=>t.finalizedChunks.length>0&&ge(t.finalizedChunks).offset>=2**32?ce("co64",0,0,[B(t.finalizedChunks.length),t.finalizedChunks.map(e=>ct(e.offset))]):ce("stco",0,0,[B(t.finalizedChunks.length),t.finalizedChunks.map(e=>B(e.offset))]),_u=t=>ce("ctts",1,0,[B(t.compositionTimeOffsetTable.length),t.compositionTimeOffsetTable.map(e=>[B(e.sampleCount),Tt(e.sampleCompositionTimeOffset)])]),Cu=t=>{let e=1/0,r=-1/0,i=1/0,n=-1/0;g(t.compositionTimeOffsetTable.length>0),g(t.samples.length>0);for(let o=0;o<t.compositionTimeOffsetTable.length;o++){let a=t.compositionTimeOffsetTable[o];e=Math.min(e,a.sampleCompositionTimeOffset),r=Math.max(r,a.sampleCompositionTimeOffset);}for(let o=0;o<t.samples.length;o++){let a=t.samples[o];i=Math.min(i,pe(a.timestamp,t.timescale)),n=Math.max(n,pe(a.timestamp+a.duration,t.timescale));}let s=Math.max(-e,0);return n>=2**31?null:ce("cslg",0,0,[Tt(s),Tt(e),Tt(r),Tt(i),Tt(n)])},Eu=t=>W("mvex",void 0,t.map(vu)),vu=t=>ce("trex",0,0,[B(t.track.id),B(1),B(0),B(0),B(0)]),to=(t,e)=>W("moof",void 0,[Pu(t),...e.map(Iu)]),Pu=t=>ce("mfhd",0,0,[B(t)]),dc=t=>{let e=0,r=0,i=0,n=0,s=t.type==="delta";return r|=+s,s?e|=1:e|=2,e<<24|r<<16|i<<8|n},Iu=t=>W("traf",void 0,[Ru(t),Fu(t),Bu(t)]),Ru=t=>{g(t.currentChunk);let e=0;e|=8,e|=16,e|=32,e|=131072;let r=t.currentChunk.samples[1]??t.currentChunk.samples[0],i={duration:r.timescaleUnitsToNextSample,size:r.size,flags:dc(r)};return ce("tfhd",0,e,[B(t.track.id),B(i.duration),B(i.size),B(i.flags)])},Fu=t=>(g(t.currentChunk),ce("tfdt",1,0,[ct(pe(t.currentChunk.startTimestamp,t.timescale))])),Bu=t=>{g(t.currentChunk);let e=t.currentChunk.samples.map(b=>b.timescaleUnitsToNextSample),r=t.currentChunk.samples.map(b=>b.size),i=t.currentChunk.samples.map(dc),n=t.currentChunk.samples.map(b=>pe(b.timestamp-b.decodeTimestamp,t.timescale)),s=new Set(e),o=new Set(r),a=new Set(i),c=new Set(n),u=a.size===2&&i[0]!==i[1],l=s.size>1,d=o.size>1,f=!u&&a.size>1,m=c.size>1||[...c].some(b=>b!==0),p=0;return p|=1,p|=4*+u,p|=256*+l,p|=512*+d,p|=1024*+f,p|=2048*+m,ce("trun",1,p,[B(t.currentChunk.samples.length),B(t.currentChunk.offset-t.currentChunk.moofOffset||0),u?B(i[0]):[],t.currentChunk.samples.map((b,y)=>[l?B(e[y]):[],d?B(r[y]):[],f?B(i[y]):[],m?Tt(n[y]):[]])])},fc=t=>W("mfra",void 0,[...t.map(Mu),Du()]),Mu=t=>ce("tfra",1,0,[B(t.track.id),B(63),B(t.finalizedChunks.length),t.finalizedChunks.map(r=>[ct(pe(r.samples[0].timestamp,t.timescale)),ct(r.moofOffset),B(r.trafIndex+1),B(1),B(1)])]),Du=()=>ce("mfro",0,0,[B(0)]),hc=()=>W("vtte"),mc=(t,e,r,i,n)=>W("vttc",void 0,[n!==null?W("vsid",[Tt(n)]):null,r!==null?W("iden",[...He.encode(r)]):null,e!==null?W("ctim",[...He.encode(ec(e))]):null,i!==null?W("sttg",[...He.encode(i)]):null,W("payl",[...He.encode(t)])]),pc=t=>W("vtta",[...He.encode(t)]),Ou=t=>{let e=[],r=t.format._options.metadataFormat??"auto",i=t.output._metadataTags;if(r==="mdir"||r==="auto"&&!t.isQuickTime){let n=Uu(i);n&&e.push(n);}else if(r==="mdta"){let n=Vu(i);n&&e.push(n);}else (r==="udta"||r==="auto"&&t.isQuickTime)&&zu(e,t.output._metadataTags);return e.length===0?null:W("udta",void 0,e)},zu=(t,e)=>{for(let{key:r,value:i}of Wi(e))switch(r){case "title":t.push(bt("\xA9nam",i));break;case "description":t.push(bt("\xA9des",i));break;case "artist":t.push(bt("\xA9ART",i));break;case "album":t.push(bt("\xA9alb",i));break;case "albumArtist":t.push(bt("albr",i));break;case "genre":t.push(bt("\xA9gen",i));break;case "date":t.push(bt("\xA9day",i.toISOString().slice(0,10)));break;case "comment":t.push(bt("\xA9cmt",i));break;case "lyrics":t.push(bt("\xA9lyr",i));break;case "raw":break;case "discNumber":case "discsTotal":case "trackNumber":case "tracksTotal":case "images":break;default:ve(r);}if(e.raw)for(let r in e.raw){let i=e.raw[r];i==null||r.length!==4||t.some(n=>n.type===r)||(typeof i=="string"?t.push(bt(r,i)):i instanceof Uint8Array&&t.push(W(r,Array.from(i))));}},bt=(t,e)=>{let r=He.encode(e);return W(t,[j(r.length),j(yc("und")),Array.from(r)])},ic={"image/jpeg":13,"image/png":14,"image/bmp":27},gc=(t,e)=>{let r=[];for(let{key:i,value:n}of Wi(t))switch(i){case "title":r.push({key:e?"title":"\xA9nam",value:at(n)});break;case "description":r.push({key:e?"description":"\xA9des",value:at(n)});break;case "artist":r.push({key:e?"artist":"\xA9ART",value:at(n)});break;case "album":r.push({key:e?"album":"\xA9alb",value:at(n)});break;case "albumArtist":r.push({key:e?"album_artist":"aART",value:at(n)});break;case "comment":r.push({key:e?"comment":"\xA9cmt",value:at(n)});break;case "genre":r.push({key:e?"genre":"\xA9gen",value:at(n)});break;case "lyrics":r.push({key:e?"lyrics":"\xA9lyr",value:at(n)});break;case "date":r.push({key:e?"date":"\xA9day",value:at(n.toISOString().slice(0,10))});break;case "images":for(let s of n)s.kind==="coverFront"&&r.push({key:"covr",value:W("data",[B(ic[s.mimeType]??0),B(0),Array.from(s.data)])});break;case "trackNumber":if(e){let s=t.tracksTotal!==void 0?`${n}/${t.tracksTotal}`:n.toString();r.push({key:"track",value:at(s)});}else r.push({key:"trkn",value:W("data",[B(0),B(0),j(0),j(n),j(t.tracksTotal??0),j(0)])});break;case "discNumber":e||r.push({key:"disc",value:W("data",[B(0),B(0),j(0),j(n),j(t.discsTotal??0),j(0)])});break;case "tracksTotal":case "discsTotal":break;case "raw":break;default:ve(i);}if(t.raw)for(let i in t.raw){let n=t.raw[i];n==null||!e&&i.length!==4||r.some(s=>s.key===i)||(typeof n=="string"?r.push({key:i,value:at(n)}):n instanceof Uint8Array?r.push({key:i,value:W("data",[B(0),B(0),Array.from(n)])}):n instanceof tt&&r.push({key:i,value:W("data",[B(ic[n.mimeType]??0),B(0),Array.from(n.data)])}));}return r},Uu=t=>{let e=gc(t,!1);return e.length===0?null:ce("meta",0,0,void 0,[eo(!1,"mdir","","appl"),W("ilst",void 0,e.map(r=>W(r.key,void 0,[r.value])))])},Vu=t=>{let e=gc(t,!0);return e.length===0?null:W("meta",void 0,[eo(!1,"mdta",""),ce("keys",0,0,[B(e.length)],e.map(r=>W("mdta",[...He.encode(r.key)]))),W("ilst",void 0,e.map((r,i)=>{let n=String.fromCharCode(...B(i+1));return W(n,void 0,[r.value])}))])},at=t=>W("data",[B(1),B(0),...He.encode(t)]),Nu=(t,e)=>{switch(t){case "avc":return e.startsWith("avc3")?"avc3":"avc1";case "hevc":return "hvc1";case "vp8":return "vp08";case "vp9":return "vp09";case "av1":return "av01";case "prores":return e}},Wu={avc:au,hevc:cu,vp8:rc,vp9:rc,av1:lu,prores:null},wc=(t,e,r)=>{switch(t){case "aac":return "mp4a";case "mp3":return "mp4a";case "opus":return "Opus";case "vorbis":return "mp4a";case "flac":return "fLaC";case "ulaw":return "ulaw";case "alaw":return "alaw";case "pcm-u8":return "raw ";case "pcm-s8":return "sowt";case "ac3":return "ac-3";case "eac3":return "ec-3";case "dts":return e}if(r)switch(t){case "pcm-s16":return "sowt";case "pcm-s16be":return "twos";case "pcm-s24":return "in24";case "pcm-s24be":return "in24";case "pcm-s32":return "in32";case "pcm-s32be":return "in32";case "pcm-f32":return "fl32";case "pcm-f32be":return "fl32";case "pcm-f64":return "fl64";case "pcm-f64be":return "fl64"}else switch(t){case "pcm-s16":return "ipcm";case "pcm-s16be":return "ipcm";case "pcm-s24":return "ipcm";case "pcm-s24be":return "ipcm";case "pcm-s32":return "ipcm";case "pcm-s32be":return "ipcm";case "pcm-f32":return "fpcm";case "pcm-f32be":return "fpcm";case "pcm-f64":return "fpcm";case "pcm-f64be":return "fpcm"}},qu=(t,e)=>{switch(t){case "aac":return Xs;case "mp3":return Xs;case "opus":return hu;case "vorbis":return Xs;case "flac":return mu;case "ac3":return pu;case "eac3":return gu;case "dts":return wu}if(e)switch(t){case "pcm-s24":return Xt;case "pcm-s24be":return Xt;case "pcm-s32":return Xt;case "pcm-s32be":return Xt;case "pcm-f32":return Xt;case "pcm-f32be":return Xt;case "pcm-f64":return Xt;case "pcm-f64be":return Xt}else switch(t){case "pcm-s16":return yt;case "pcm-s16be":return yt;case "pcm-s24":return yt;case "pcm-s24be":return yt;case "pcm-s32":return yt;case "pcm-s32be":return yt;case "pcm-f32":return yt;case "pcm-f32be":return yt;case "pcm-f64":return yt;case "pcm-f64be":return yt}return null},Lu={webvtt:"wvtt"},Hu={webvtt:bu},yc=t=>{g(t.length===3);let e=0;for(let r=0;r<3;r++)e<<=5,e+=t.charCodeAt(r)-96;return e};var hr=class{constructor(e,r){if(this.finalized=!1,this.started=!1,this.pos=0,this.trackedWrites=null,this.trackedStart=-1,this.trackedEnd=-1,e._writerAcquired)throw new Error("Can't have multiple Writers for the same Target.");this.target=e,e._setMonotonicity(r),e._writerAcquired=!0;}start(){g(!this.started),this.target._start(),this.started=!0;}write(e){g(this.started&&!this.finalized),this.maybeTrackWrites(e),this.target._write(e,this.pos),this.pos+=e.byteLength;}seek(e){this.pos=e;}getPos(){return this.pos}async flush(){return g(this.started&&!this.finalized),this.target._flush()}async finalize(){g(this.started&&!this.finalized),await this.target._finalize(),this.finalized=!0;}maybeTrackWrites(e){if(!this.trackedWrites)return;let r=this.getPos();if(r<this.trackedStart){if(r+e.byteLength<=this.trackedStart)return;e=e.subarray(this.trackedStart-r),r=0;}let i=r+e.byteLength-this.trackedStart,n=this.trackedWrites.byteLength;for(;n<i;)n*=2;if(n!==this.trackedWrites.byteLength){let s=new Uint8Array(n);s.set(this.trackedWrites,0),this.trackedWrites=s;}this.trackedWrites.set(e,r-this.trackedStart),this.trackedEnd=Math.max(this.trackedEnd,r+e.byteLength);}startTrackingWrites(){this.trackedWrites=new Uint8Array(2**10),this.trackedStart=this.getPos(),this.trackedEnd=this.trackedStart;}stopTrackingWrites(){if(!this.trackedWrites)throw new Error("Internal error: Can't get tracked writes since nothing was tracked.");let r={data:this.trackedWrites.subarray(0,this.trackedEnd-this.trackedStart),start:this.trackedStart,end:this.trackedEnd};return this.trackedWrites=null,r}};var Le=class extends Qe{constructor(){super(...arguments),this._writerAcquired=!1,this._monotonicity=null,this.onwrite=null;}_setMonotonicity(e){this._monotonicity!==!1&&(this._monotonicity=e);}_dispatchWrite(e,r){this.onwrite?.(e,r),this._emit("write",{start:e,end:r});}slice(e){if(!Number.isInteger(e)||e<0)throw new TypeError("offset must be a non-negative integer.");return new Un(this,e)}},ro=2**16,io=2**32,Vt=class extends Le{constructor(e={}){if(super(),this.buffer=null,this._maxPos=0,!e||typeof e!="object")throw new TypeError("BufferTarget options, when provided, must be an object.");if(e.onFinalize!==void 0&&typeof e.onFinalize!="function")throw new TypeError("options.onFinalize, when provided, must be a function.");if(this._options=e,this._supportsResize="resize"in new ArrayBuffer(0),this._supportsResize)try{this._buffer=new ArrayBuffer(ro,{maxByteLength:io});}catch{this._buffer=new ArrayBuffer(ro),this._supportsResize=!1;}else this._buffer=new ArrayBuffer(ro);this._bytes=new Uint8Array(this._buffer);}_ensureSize(e){let r=this._buffer.byteLength;for(;r<e;)r*=2;if(r!==this._buffer.byteLength){if(r>io)throw new Error(`ArrayBuffer exceeded maximum size of ${io} bytes. Please consider using another target.`);if(this._supportsResize)this._buffer.resize(r);else {let i=new ArrayBuffer(r),n=new Uint8Array(i);n.set(this._bytes,0),this._buffer=i,this._bytes=n;}}}_start(){}_write(e,r){this._ensureSize(r+e.byteLength),this._bytes.set(e,r),this._maxPos=Math.max(this._maxPos,r+e.byteLength),this._dispatchWrite(r,r+e.byteLength);}async _flush(){}async _finalize(){this.buffer=this._buffer.slice(0,this._maxPos),this._options.onFinalize&&await this._options.onFinalize(this.buffer),this._emit("finalized");}async _close(){}_getSlice(e,r){return this._bytes.slice(e,r)}},Ah=2**24;var Ii=class extends Le{_start(){}_write(e,r){this._dispatchWrite(r,r+e.byteLength);}async _flush(){}async _finalize(){this._emit("finalized");}async _close(){}},Un=class extends Le{constructor(e,r){super(),this._baseTarget=e,this._offset=r;}_start(){}_write(e,r){this._baseTarget._write(e,this._offset+r),this._dispatchWrite(r,r+e.byteLength);}_flush(){return this._baseTarget._flush()}async _finalize(){this._emit("finalized");}async _close(){}_setMonotonicity(e){super._setMonotonicity(e),this._baseTarget._setMonotonicity(e);}},mr=class{constructor(e,r){if(this.rootPath=e,this.getTarget=r,typeof e!="string")throw new TypeError("rootPath must be a string.");if(typeof r!="function")throw new TypeError("getTarget must be a function.")}};var qe=57600,ju=2082844800,bc=t=>{let e={},r=t.track;return r.metadata.name!==void 0&&(e.name=r.metadata.name),e},pe=(t,e,r=!0)=>{let i=t*e;return r?Math.round(i):i},Vn=class extends zn{constructor(e,r){super(e),this.writer=null,this.boxWriter=null,this.initWriter=null,this.initBoxWriter=null,this.auxTarget=new Vt,this.auxWriter=new hr(this.auxTarget,!1),this.auxBoxWriter=new fr(this.auxWriter),this.mdat=null,this.ftypSize=null,this.trackDatas=[],this.allTracksKnown=we(),this.creationTime=Math.floor(Date.now()/1e3)+ju,this.finalizedChunks=[],this.wroteFragmentedHeader=!1,this.nextFragmentNumber=1,this.maxWrittenTimestamp=-1/0,this.minWrittenTimestamp=1/0,this.maxWrittenEndTimestamp=-1/0,this.segmentHeaderSize=null,this.format=r,this.formatOptions={...r._options},this.isQuickTime=r instanceof qr,this.isCmaf=r instanceof Wr,this.minimumFragmentDuration=this.formatOptions.minimumFragmentDuration??(r instanceof Wr?1/0:1),this.auxWriter.start();}async start(){let e=await this.mutex.acquire();if(this.isCmaf?(this.fastStart="fragmented",this.isFragmented=!0):(this.writer=await this.output._getRootWriter(i=>this.formatOptions.fastStart!==void 0?this.formatOptions.fastStart==="fragmented":i instanceof Vt),this.boxWriter=new fr(this.writer),this.fastStart=this.formatOptions.fastStart??(this.writer.target instanceof Vt?"in-memory":!1),this.isFragmented=this.fastStart==="fragmented"),this.isCmaf){if(!this.output._hasInitTarget())throw new Error("CMAF outputs require the initTarget field in OutputOptions to be set; the init segment will be written to it.");let i=await this.output._getInitTarget(),n=new hr(i,!0);n.start(),this.initWriter=n,this.initBoxWriter=new fr(n);}let r=this.output.tracks.some(i=>i.isVideoTrack()&&i.source._codec==="avc");{let i=this.initBoxWriter??this.boxWriter;if(g(i),this.formatOptions.onFtyp&&i.writer.startTrackingWrites(),i.writeBox(lc({isQuickTime:this.isQuickTime,holdsAvc:r,fragmented:this.isFragmented,cmaf:this.isCmaf})),this.formatOptions.onFtyp){let{data:n,start:s}=i.writer.stopTrackingWrites();this.formatOptions.onFtyp(n,s);}this.ftypSize=i.writer.getPos(),this.isCmaf&&await this.initWriter.flush();}if(this.fastStart!=="in-memory")if(this.fastStart==="reserve"){for(let i of this.output.tracks)if(i.metadata.maximumPacketCount===void 0)throw new Error("All tracks must specify maximumPacketCount in their metadata when using fastStart: 'reserve'.")}else this.isFragmented||(g(this.writer),g(this.boxWriter),this.formatOptions.onMdat&&this.writer.startTrackingWrites(),this.mdat=Pi(!0),this.boxWriter.writeBox(this.mdat));await this.writer?.flush();for(let i of this.output.tracks)i.isVideoTrack()&&i.metadata.decoderConfig?this.getVideoTrackData(i,i.metadata.primingPacket??null,{decoderConfig:i.metadata.decoderConfig}):i.isAudioTrack()&&i.metadata.decoderConfig&&this.getAudioTrackData(i,i.metadata.primingPacket??null,{decoderConfig:i.metadata.decoderConfig});e();}allTracksAreKnown(){for(let e of this.output.tracks)if(!e.source._closed&&!this.trackDatas.some(r=>r.track===e))return !1;return !0}async getMimeType(){await this.allTracksKnown.promise;let e=this.trackDatas.map(r=>r.type==="video"||r.type==="audio"?r.info.decoderConfig.codec:{webvtt:"wvtt"}[r.track.source._codec]);return dn({isQuickTime:this.isQuickTime,hasVideo:this.trackDatas.some(r=>r.type==="video"),hasAudio:this.trackDatas.some(r=>r.type==="audio"),codecStrings:e})}getVideoTrackData(e,r,i){let n=this.trackDatas.find(m=>m.track===e);if(n)return n;ln(i,e.source._codec),g(i),g(i.decoderConfig);let s={...i.decoderConfig};g(s.codedWidth!==void 0),g(s.codedHeight!==void 0);let o=!1;if(e.source._codec==="avc"&&!s.description){if(!r)throw new Error("No AVC description provided; you must therefore provide a priming packet.");let m=xr(r.data);if(!m)throw new Error("Couldn't extract an AVCDecoderConfigurationRecord from the AVC packet. Make sure the packets are in Annex B format (as specified in ITU-T-REC-H.264) when not providing a description, or provide a description (must be an AVCDecoderConfigurationRecord as specified in ISO 14496-15) and ensure the packets are in AVCC format.");s.description=Yi(m),o=!0;}else if(e.source._codec==="hevc"&&!s.description){if(!r)throw new Error("No HEVC description provided; you must therefore provide a priming packet.");let m=Cr(r.data);if(!m)throw new Error("Couldn't extract an HEVCDecoderConfigurationRecord from the HEVC packet. Make sure the packets are in Annex B format (as specified in ITU-T-REC-H.265) when not providing a description, or provide a description (must be an HEVCDecoderConfigurationRecord as specified in ISO 14496-15) and ensure the packets are in HEVC format.");s.description=zo(m),o=!0;}let a=So(1/(e.metadata.frameRate??qe),1e6).den,c=s.displayAspectWidth,u=s.displayAspectHeight,l=c===void 0||u===void 0?{num:1,den:1}:Lt({num:c*s.codedHeight,den:u*s.codedWidth}),d=s.codec==="ap4h"||s.codec==="ap4x",f={muxer:this,track:e,type:"video",info:{width:s.codedWidth,height:s.codedHeight,pixelAspectRatio:l,decoderConfig:s,requiresAnnexBTransformation:o,hasAlphaChannel:d},timescale:a,samples:[],sampleQueue:[],timestampProcessingQueue:[],timeToSampleTable:[],compositionTimeOffsetTable:[],lastTimescaleUnits:null,lastSample:null,startTimestampOffset:null,finalizedChunks:[],currentChunk:null,compactlyCodedChunkTable:[],closed:!1};return this.trackDatas.push(f),this.trackDatas.sort((m,p)=>m.track.id-p.track.id),this.allTracksAreKnown()&&this.allTracksKnown.resolve(),f}getAudioTrackData(e,r,i){let n=this.trackDatas.find(c=>c.track===e);if(n)return n;un(i,e.source._codec),g(i),g(i.decoderConfig);let s={...i.decoderConfig},o=!1;if(e.source._codec==="aac"&&!s.description){if(!r)throw new Error("No AAC description provided; you must therefore provide a priming packet.");let c=vs(ot.tempFromBytes(r.data));if(!c)throw new Error("Couldn't parse ADTS header from the AAC packet. Make sure the packets are in ADTS format (as specified in ISO 13818-7) when not providing a description, or provide a description (must be an AudioSpecificConfig as specified in ISO 14496-3) and ensure the packets are raw AAC data.");let u=ri[c.samplingFrequencyIndex],l=Qi[c.channelConfiguration];if(u===void 0||l===void 0)throw new Error("Invalid ADTS frame header.");s.description=Ki({objectType:c.objectType,outputSampleRate:u,outputNumberOfChannels:l}),o=!0;}if(!r){if(e.source._codec==="ac3"||e.source._codec==="eac3")throw new Error("AC-3/E-AC-3 require a priming packet.");if(e.source._codec==="dts")throw new Error("DTS requires a priming packet.")}let a={muxer:this,track:e,type:"audio",info:{numberOfChannels:i.decoderConfig.numberOfChannels,sampleRate:i.decoderConfig.sampleRate,decoderConfig:s,requiresPcmTransformation:!this.isFragmented&&Se.includes(e.source._codec),expectedNextPcmPacketTimestamp:null,requiresAdtsStripping:o,primingPacket:r},timescale:s.sampleRate,samples:[],sampleQueue:[],timestampProcessingQueue:[],timeToSampleTable:[],compositionTimeOffsetTable:[],lastTimescaleUnits:null,lastSample:null,startTimestampOffset:null,finalizedChunks:[],currentChunk:null,compactlyCodedChunkTable:[],closed:!1};return this.trackDatas.push(a),this.trackDatas.sort((c,u)=>c.track.id-u.track.id),this.allTracksAreKnown()&&this.allTracksKnown.resolve(),a}getSubtitleTrackData(e,r){let i=this.trackDatas.find(s=>s.track===e);if(i)return i;ca(r),g(r),g(r.config);let n={muxer:this,track:e,type:"subtitle",info:{config:r.config},timescale:1e3,samples:[],sampleQueue:[],timestampProcessingQueue:[],timeToSampleTable:[],compositionTimeOffsetTable:[],lastTimescaleUnits:null,lastSample:null,startTimestampOffset:null,finalizedChunks:[],currentChunk:null,compactlyCodedChunkTable:[],closed:!1,lastCueEndTimestamp:null,cueQueue:[],nextSourceId:0,cueToSourceId:new WeakMap};return this.trackDatas.push(n),this.trackDatas.sort((s,o)=>s.track.id-o.track.id),this.allTracksAreKnown()&&this.allTracksKnown.resolve(),n}async addEncodedVideoPacket(e,r,i){let n=await this.mutex.acquire();try{let s=this.getVideoTrackData(e,r,i),o=r.data;if(s.info.requiresAnnexBTransformation){let c=[...Sr(o)].map(u=>o.subarray(u.offset,u.offset+u.length));if(c.length===0)throw new Error("Failed to transform packet data. Make sure all packets are provided in Annex B format, as specified in ITU-T-REC-H.264 and ITU-T-REC-H.265.");o=Zi(c,4);}this.validateTimestamp(s.track,r.timestamp,r.type==="key");let a=this.createSampleForTrack(s,o,r.timestamp,r.duration,r.type);await this.registerSample(s,a);}finally{n();}}async addEncodedAudioPacket(e,r,i){let n=await this.mutex.acquire();try{let s=this.getAudioTrackData(e,r,i),o=r.data;if(s.info.requiresAdtsStripping){let l=vs(ot.tempFromBytes(o));if(!l)throw new Error("Expected ADTS frame, didn't get one.");let d=l.crcCheck===null?_a:Ca;o=o.subarray(d);}this.validateTimestamp(s.track,r.timestamp,r.type==="key");let a=r.timestamp,c=r.duration;if(s.info.requiresPcmTransformation){let d=Ve(s.info.decoderConfig.codec).sampleSize*s.info.numberOfChannels;if(c=o.byteLength/d/s.info.sampleRate,s.info.expectedNextPcmPacketTimestamp!==null){let f=a-s.info.expectedNextPcmPacketTimestamp;if(f<.01)a=s.info.expectedNextPcmPacketTimestamp;else {let m=await this.padWithSilence(s,s.info.expectedNextPcmPacketTimestamp,f);a=s.info.expectedNextPcmPacketTimestamp+m;}}s.info.expectedNextPcmPacketTimestamp=a+c;}let u=this.createSampleForTrack(s,o,a,c,r.type);await this.registerSample(s,u);}finally{n();}}async padWithSilence(e,r,i){let n=pe(i,e.timescale);if(i=n/e.timescale,n>0){let{sampleSize:s,silentValue:o}=Ve(e.info.decoderConfig.codec),a=n*e.info.numberOfChannels,c=new Uint8Array(s*a).fill(o),u=this.createSampleForTrack(e,new Uint8Array(c.buffer),r,i,"key");await this.registerSample(e,u);}return i}async addSubtitleCue(e,r,i){let n=await this.mutex.acquire();try{let s=this.getSubtitleTrackData(e,i);this.validateTimestamp(s.track,r.timestamp,!0),e.source._codec==="webvtt"&&(s.cueQueue.push(r),await this.processWebVTTCues(s,r.timestamp));}finally{n();}}async processWebVTTCues(e,r){for(;e.cueQueue.length>0;){e.lastCueEndTimestamp??(e.lastCueEndTimestamp=Math.min(0,e.cueQueue[0].timestamp));let i=new Set([]);for(let u of e.cueQueue)g(u.timestamp<=r),g(e.lastCueEndTimestamp<=u.timestamp+u.duration),i.add(Math.max(u.timestamp,e.lastCueEndTimestamp)),i.add(u.timestamp+u.duration);let n=[...i].sort((u,l)=>u-l),s=n[0],o=n[1]??s;if(r<o)break;if(e.lastCueEndTimestamp<s){this.auxWriter.seek(0);let u=hc();this.auxBoxWriter.writeBox(u);let l=this.auxTarget._getSlice(0,this.auxWriter.getPos()),d=this.createSampleForTrack(e,l,e.lastCueEndTimestamp,s-e.lastCueEndTimestamp,"key");await this.registerSample(e,d),e.lastCueEndTimestamp=s;}this.auxWriter.seek(0);for(let u=0;u<e.cueQueue.length;u++){let l=e.cueQueue[u];if(l.timestamp>=o)break;Ks.lastIndex=0;let d=Ks.test(l.text),f=l.timestamp+l.duration,m=e.cueToSourceId.get(l);if(m===void 0&&o<f&&(m=e.nextSourceId++,e.cueToSourceId.set(l,m)),l.notes){let b=pc(l.notes);this.auxBoxWriter.writeBox(b);}let p=mc(l.text,d?s:null,l.identifier??null,l.settings??null,m??null);this.auxBoxWriter.writeBox(p),f===o&&e.cueQueue.splice(u--,1);}let a=this.auxTarget._getSlice(0,this.auxWriter.getPos()),c=this.createSampleForTrack(e,a,s,o-s,"key");await this.registerSample(e,c),e.lastCueEndTimestamp=o;}}createSampleForTrack(e,r,i,n,s){return {timestamp:i,decodeTimestamp:i,duration:n,data:r,size:r.byteLength,type:s,timescaleUnitsToNextSample:pe(n,e.timescale)}}processTimestamps(e,r){if(e.timestampProcessingQueue.length===0)return;if(e.type==="audio"&&e.info.requiresPcmTransformation){g(!this.isFragmented),e.startTimestampOffset??(e.startTimestampOffset=e.timestampProcessingQueue[0].timestamp);let n=0;for(let s=0;s<e.timestampProcessingQueue.length;s++){let o=e.timestampProcessingQueue[s],a=pe(o.duration,e.timescale);n+=a;}if(e.timeToSampleTable.length===0)e.timeToSampleTable.push({sampleCount:n,sampleDelta:1});else {let s=ge(e.timeToSampleTable);s.sampleCount+=n;}e.timestampProcessingQueue.length=0;return}let i=e.timestampProcessingQueue.map(n=>n.timestamp).sort((n,s)=>n-s);this.isFragmented?e.startTimestampOffset??(e.startTimestampOffset=Math.min(i[0],0)):e.startTimestampOffset??(e.startTimestampOffset=i[0]);for(let n=0;n<e.timestampProcessingQueue.length;n++){let s=e.timestampProcessingQueue[n];s.decodeTimestamp=i[n];let o=pe(s.timestamp-s.decodeTimestamp,e.timescale),a=pe(s.duration,e.timescale);if(e.lastTimescaleUnits!==null){g(e.lastSample);let c=pe(s.decodeTimestamp,e.timescale,!1),u=Math.round(c-e.lastTimescaleUnits);if(g(u>=0),e.lastTimescaleUnits+=u,e.lastSample.timescaleUnitsToNextSample=u,!this.isFragmented){let l=ge(e.timeToSampleTable);if(g(l),l.sampleCount===1){l.sampleDelta=u;let f=e.timeToSampleTable[e.timeToSampleTable.length-2];f&&f.sampleDelta===u&&(f.sampleCount++,e.timeToSampleTable.pop(),l=f);}else l.sampleDelta!==u&&(l.sampleCount--,e.timeToSampleTable.push(l={sampleCount:1,sampleDelta:u}));l.sampleDelta===a?l.sampleCount++:e.timeToSampleTable.push({sampleCount:1,sampleDelta:a});let d=ge(e.compositionTimeOffsetTable);g(d),d.sampleCompositionTimeOffset===o?d.sampleCount++:e.compositionTimeOffsetTable.push({sampleCount:1,sampleCompositionTimeOffset:o});}}else e.lastTimescaleUnits=pe(s.decodeTimestamp,e.timescale,!1),this.isFragmented||(e.timeToSampleTable.push({sampleCount:1,sampleDelta:a}),e.compositionTimeOffsetTable.push({sampleCount:1,sampleCompositionTimeOffset:o}));e.lastSample=s;}if(e.timestampProcessingQueue.length=0,g(e.lastSample),g(e.lastTimescaleUnits!==null),r!==void 0&&e.lastSample.timescaleUnitsToNextSample===0){g(r.type==="key");let n=pe(r.timestamp,e.timescale,!1),s=Math.round(n-e.lastTimescaleUnits);e.lastSample.timescaleUnitsToNextSample=s;}}async registerSample(e,r){r.type==="key"&&this.processTimestamps(e,r),e.timestampProcessingQueue.push(r),this.isFragmented?(e.sampleQueue.push(r),await this.interleaveSamples()):this.fastStart==="reserve"?await this.registerSampleFastStartReserve(e,r):await this.addSampleToTrack(e,r);}async addSampleToTrack(e,r){if(!this.isFragmented&&(e.samples.push(r),this.fastStart==="reserve")){let n=e.track.metadata.maximumPacketCount;if(g(n!==void 0),e.samples.length>n)throw new Error(`Track #${e.track.id} has already reached the maximum packet count (${n}). Either add less packets or increase the maximum packet count.`)}let i=!1;if(!e.currentChunk)i=!0;else {e.currentChunk.startTimestamp=Math.min(e.currentChunk.startTimestamp,r.timestamp);let n=r.timestamp-e.currentChunk.startTimestamp;if(this.isFragmented){let s=this.trackDatas.every(o=>{if(e===o)return r.type==="key";let a=o.sampleQueue[0];return a?a.type==="key":o.closed});n>=this.minimumFragmentDuration&&s&&r.timestamp>this.maxWrittenTimestamp&&(i=!0,await this.finalizeFragment());}else i=n>=.5;}i&&(e.currentChunk&&await this.finalizeCurrentChunk(e),e.currentChunk={startTimestamp:r.timestamp,samples:[],offset:null,moofOffset:null,trafIndex:null}),g(e.currentChunk),e.currentChunk.samples.push(r),this.isFragmented&&(this.maxWrittenTimestamp=Math.max(this.maxWrittenTimestamp,r.timestamp),this.maxWrittenEndTimestamp=Math.max(this.maxWrittenEndTimestamp,r.timestamp+r.duration),this.minWrittenTimestamp=Math.min(this.minWrittenTimestamp,r.timestamp));}async finalizeCurrentChunk(e){if(g(!this.isFragmented),g(this.writer),!e.currentChunk)return;e.finalizedChunks.push(e.currentChunk),this.finalizedChunks.push(e.currentChunk);let r=e.currentChunk.samples.length;if(e.type==="audio"&&e.info.requiresPcmTransformation&&(r=e.currentChunk.samples.reduce((i,n)=>i+pe(n.duration,e.timescale),0)),(e.compactlyCodedChunkTable.length===0||ge(e.compactlyCodedChunkTable).samplesPerChunk!==r)&&e.compactlyCodedChunkTable.push({firstChunk:e.finalizedChunks.length,samplesPerChunk:r}),this.fastStart==="in-memory"){e.currentChunk.offset=0;return}e.currentChunk.offset=this.writer.getPos();for(let i of e.currentChunk.samples)g(i.data),this.writer.write(i.data),i.data=null;await this.writer.flush();}async interleaveSamples(e=!1){if(g(this.isFragmented),!(!e&&!this.allTracksAreKnown()))e:for(;;){let r=null,i=1/0;for(let s of this.trackDatas){if(!e&&s.sampleQueue.length===0&&!s.closed)break e;s.sampleQueue.length>0&&s.sampleQueue[0].timestamp<i&&(r=s,i=s.sampleQueue[0].timestamp);}if(!r)break;let n=r.sampleQueue.shift();await this.addSampleToTrack(r,n);}}async finalizeFragment(e=!this.isCmaf){if(g(this.isFragmented),!this.wroteFragmentedHeader){this.wroteFragmentedHeader=!0;let m=this.initBoxWriter??this.boxWriter;g(m),this.formatOptions.onMoov&&m.writer.startTrackingWrites(),this.ensureOneEnabledTrack();let p=Nr(this);if(m.writeBox(p),this.formatOptions.onMoov){let{data:b,start:y}=m.writer.stopTrackingWrites();this.formatOptions.onMoov(b,y);}if(this.isCmaf){g(this.initWriter),await this.initWriter.flush(),await this.initWriter.finalize(),this.writer=await this.output._getRootWriter(!0),this.boxWriter=new fr(this.writer);let b=this.boxWriter.measureBox(Ys()),y=this.boxWriter.measureBox(Js(this,0));this.segmentHeaderSize=b+y,this.writer.seek(this.segmentHeaderSize);}}g(this.writer),g(this.boxWriter);let r=this.trackDatas.filter(m=>m.currentChunk);if(r.length===0){e&&await this.writer.flush();return}let i=this.nextFragmentNumber++,n=to(i,r),s=this.writer.getPos(),o=s+this.boxWriter.measureBox(n),a=o+rt,c=1/0;for(let m=0;m<r.length;m++){let p=r[m];g(p.currentChunk),g(p.startTimestampOffset!==null),p.currentChunk.offset=a,p.currentChunk.moofOffset=s,p.currentChunk.trafIndex=m,p.currentChunk.startTimestamp-=p.startTimestampOffset;for(let b of p.currentChunk.samples)a+=b.size,b.timestamp-=p.startTimestampOffset,b.decodeTimestamp-=p.startTimestampOffset;c=Math.min(c,p.currentChunk.startTimestamp);}let u=a-o,l=u>=2**32;if(l)for(let m of r)m.currentChunk.offset+=Rt-rt;this.formatOptions.onMoof&&this.writer.startTrackingWrites();let d=to(i,r);if(this.boxWriter.writeBox(d),this.formatOptions.onMoof){let{data:m,start:p}=this.writer.stopTrackingWrites();this.formatOptions.onMoof(m,p,c);}g(this.writer.getPos()===o),this.formatOptions.onMdat&&this.writer.startTrackingWrites();let f=Pi(l);f.size=u,this.boxWriter.writeBox(f),this.writer.seek(o+(l?Rt:rt));for(let m of r)for(let p of m.currentChunk.samples)this.writer.write(p.data),p.data=null;if(this.formatOptions.onMdat){let{data:m,start:p}=this.writer.stopTrackingWrites();this.formatOptions.onMdat(m,p);}for(let m of r)m.finalizedChunks.push(m.currentChunk),this.finalizedChunks.push(m.currentChunk),m.currentChunk=null;e&&await this.writer.flush();}async registerSampleFastStartReserve(e,r){this.allTracksAreKnown()?(this.mdat||await this.createFastStartReserveMdat(),await this.addSampleToTrack(e,r)):e.sampleQueue.push(r);}async createFastStartReserveMdat(){g(this.writer),g(this.boxWriter),this.ensureOneEnabledTrack();let e=Nr(this),i=this.boxWriter.measureBox(e)+this.computeSampleTableSizeUpperBound()+4096;g(this.ftypSize!==null),this.writer.seek(this.ftypSize+i),this.formatOptions.onMdat&&this.writer.startTrackingWrites(),this.mdat=Pi(!0),this.boxWriter.writeBox(this.mdat);for(let n of this.trackDatas){for(let s of n.sampleQueue)await this.addSampleToTrack(n,s);n.sampleQueue.length=0;}}computeSampleTableSizeUpperBound(){g(this.fastStart==="reserve");let e=0;for(let r of this.trackDatas){let i=r.track.metadata.maximumPacketCount;g(i!==void 0),e+=8*Math.ceil(2/3*i),e+=4*i,e+=8*Math.ceil(2/3*i),e+=12*Math.ceil(2/3*i),e+=4*i,e+=8*i;}return e}async onTrackClose(e){let r=await this.mutex.acquire(),i=this.trackDatas.find(n=>n.track===e);i&&(i.closed=!0,i.type==="subtitle"&&e.source._codec==="webvtt"&&await this.processWebVTTCues(i,1/0),this.processTimestamps(i)),this.allTracksAreKnown()&&this.allTracksKnown.resolve(),this.isFragmented&&await this.interleaveSamples(),r();}ensureOneEnabledTrack(){for(let e of ["video","audio","subtitle"]){let r=this.trackDatas.filter(n=>n.type===e);if(r.length===0)continue;if(!r.some(n=>n.track.metadata.disposition?.default!==!1)){let n=r[0];n.track.metadata.disposition={...n.track.metadata.disposition,default:!0};}}}async forceFragmentFinalization(){g(this.isFragmented);let e=await this.mutex.acquire();try{for(let r of this.trackDatas)r.type==="subtitle"&&r.track.source._codec==="webvtt"&&await this.processWebVTTCues(r,1/0),this.processTimestamps(r);await this.interleaveSamples(!0),await this.finalizeFragment();}finally{e();}}async finalize(){let e=await this.mutex.acquire();this.allTracksKnown.resolve(),this.ensureOneEnabledTrack(),!this.mdat&&this.fastStart==="reserve"&&await this.createFastStartReserveMdat();for(let r of this.trackDatas)r.closed=!0,r.type==="subtitle"&&r.track.source._codec==="webvtt"&&await this.processWebVTTCues(r,1/0),this.processTimestamps(r);if(this.isFragmented)await this.interleaveSamples(!0),await this.finalizeFragment(!1);else for(let r of this.trackDatas)if(await this.finalizeCurrentChunk(r),r.startTimestampOffset!==null)for(let i=0;i<r.samples.length;i++){let n=r.samples[i];n.timestamp-=r.startTimestampOffset,n.decodeTimestamp-=r.startTimestampOffset;}if(g(this.writer),g(this.boxWriter),this.fastStart==="in-memory"){this.mdat=Pi(!1);let r;for(let n=0;n<2;n++){let s=Nr(this),o=this.boxWriter.measureBox(s);r=this.boxWriter.measureBox(this.mdat);let a=this.writer.getPos()+o+r;for(let c of this.finalizedChunks){c.offset=a;for(let{data:u}of c.samples)g(u),a+=u.byteLength,r+=u.byteLength;}if(a<2**32)break;r>=2**32&&(this.mdat.largeSize=!0);}this.formatOptions.onMoov&&this.writer.startTrackingWrites();let i=Nr(this);if(this.boxWriter.writeBox(i),this.formatOptions.onMoov){let{data:n,start:s}=this.writer.stopTrackingWrites();this.formatOptions.onMoov(n,s);}this.formatOptions.onMdat&&this.writer.startTrackingWrites(),this.mdat.size=r,this.boxWriter.writeBox(this.mdat);for(let n of this.finalizedChunks)for(let s of n.samples)g(s.data),this.writer.write(s.data),s.data=null;if(this.formatOptions.onMdat){let{data:n,start:s}=this.writer.stopTrackingWrites();this.formatOptions.onMdat(n,s);}}else if(this.isFragmented)if(this.isCmaf){let r=this.segmentHeaderSize!==null?this.writer.getPos()-this.segmentHeaderSize:0;this.writer.seek(0),this.boxWriter.writeBox(Ys()),this.boxWriter.writeBox(Js(this,r));}else {let r=this.writer.getPos(),i=fc(this.trackDatas);this.boxWriter.writeBox(i);let n=this.writer.getPos()-r;this.writer.seek(this.writer.getPos()-4),this.boxWriter.writeU32(n);}else {g(this.mdat);let r=this.boxWriter.offsets.get(this.mdat);g(r!==void 0);let i=this.writer.getPos()-r;if(this.mdat.size=i,this.mdat.largeSize=i>=2**32,this.boxWriter.patchBox(this.mdat),this.formatOptions.onMdat){let{data:s,start:o}=this.writer.stopTrackingWrites();this.formatOptions.onMdat(s,o);}let n=Nr(this);if(this.fastStart==="reserve"){g(this.ftypSize!==null),this.writer.seek(this.ftypSize),this.formatOptions.onMoov&&this.writer.startTrackingWrites(),this.boxWriter.writeBox(n);let s=this.boxWriter.offsets.get(this.mdat)-this.writer.getPos();this.boxWriter.writeBox(uc(s));}else this.formatOptions.onMoov&&this.writer.startTrackingWrites(),this.boxWriter.writeBox(n);if(this.formatOptions.onMoov){let{data:s,start:o}=this.writer.stopTrackingWrites();this.formatOptions.onMoov(s,o);}}e();}};var Nn=class{constructor(e){this.sourceSampleRate=null,this.sourceNumberOfChannels=null,this.startTime=null,this.bufferStartFrame=0,this.maxWrittenFrame=null,this.targetSampleRate=e.targetSampleRate,this.targetNumberOfChannels=e.targetNumberOfChannels,this.onSample=e.onSample,this.bufferSizeInFrames=Math.floor(this.targetSampleRate*5),this.bufferSizeInSamples=this.bufferSizeInFrames*this.targetNumberOfChannels,this.outputBuffer=new Float32Array(this.bufferSizeInSamples);}doChannelMixerSetup(){g(this.sourceNumberOfChannels!==null);let e=this.sourceNumberOfChannels,r=this.targetNumberOfChannels;e===1&&r===2?this.channelMixer=(i,n)=>i[n*e]:e===1&&r===4?this.channelMixer=(i,n,s)=>i[n*e]*+(s<2):e===1&&r===6?this.channelMixer=(i,n,s)=>i[n*e]*+(s===2):e===2&&r===1?this.channelMixer=(i,n)=>{let s=n*e;return .5*(i[s]+i[s+1])}:e===2&&r===4?this.channelMixer=(i,n,s)=>s<2?i[n*e+s]:0:e===2&&r===6?this.channelMixer=(i,n,s)=>s<2?i[n*e+s]:0:e===4&&r===1?this.channelMixer=(i,n)=>{let s=n*e;return .25*(i[s]+i[s+1]+i[s+2]+i[s+3])}:e===4&&r===2?this.channelMixer=(i,n,s)=>{let o=n*e;return .5*(i[o+s]+i[o+s+2])}:e===4&&r===6?this.channelMixer=(i,n,s)=>{let o=n*e;return s<2?i[o+s]:s===2||s===3?0:i[o+s-2]}:e===6&&r===1?this.channelMixer=(i,n)=>{let s=n*e;return Math.SQRT1_2*(i[s]+i[s+1])+i[s+2]+.5*(i[s+4]+i[s+5])}:e===6&&r===2?this.channelMixer=(i,n,s)=>{let o=n*e;return i[o+s]+Math.SQRT1_2*(i[o+2]+i[o+s+4])}:e===6&&r===4?this.channelMixer=(i,n,s)=>{let o=n*e;return s<2?i[o+s]+Math.SQRT1_2*i[o+2]:i[o+s+2]}:this.channelMixer=(i,n,s)=>s<e?i[n*e+s]:0;}ensureTempBufferSize(e){let r=this.tempSourceBuffer.length;for(;r<e;)r*=2;if(r!==this.tempSourceBuffer.length){let i=new Float32Array(r);i.set(this.tempSourceBuffer),this.tempSourceBuffer=i;}}async add(e){this.sourceSampleRate===null&&(this.sourceSampleRate=e.sampleRate,this.sourceNumberOfChannels=e.numberOfChannels,this.startTime=e.timestamp,this.tempSourceBuffer=new Float32Array(this.sourceSampleRate*this.sourceNumberOfChannels),this.doChannelMixerSetup()),g(this.startTime!==null);let r=e.numberOfFrames*e.numberOfChannels;this.ensureTempBufferSize(r);let i=e.allocationSize({planeIndex:0,format:"f32"}),n=new Float32Array(this.tempSourceBuffer.buffer,0,i/4);e.copyTo(n,{planeIndex:0,format:"f32"});let s=e.timestamp-this.startTime,o=s+e.duration,a=Math.floor((s-1/this.sourceSampleRate)*this.targetSampleRate)+1,c=Math.ceil(o*this.targetSampleRate);for(let u=a;u<c;u++){if(u<this.bufferStartFrame)continue;for(;u>=this.bufferStartFrame+this.bufferSizeInFrames;)await this.finalizeCurrentBuffer(),this.bufferStartFrame+=this.bufferSizeInFrames;let l=u-this.bufferStartFrame;g(l<this.bufferSizeInFrames);let m=(u/this.targetSampleRate-s)*this.sourceSampleRate,p=Math.floor(m),b=Math.ceil(m),y=m-p;for(let w=0;w<this.targetNumberOfChannels;w++){let T=0,A=0;p>=0&&p<e.numberOfFrames&&(T=this.channelMixer(n,p,w)),b>=0&&b<e.numberOfFrames&&(A=this.channelMixer(n,b,w));let E=T+y*(A-T),P=l*this.targetNumberOfChannels+w;this.outputBuffer[P]+=E;}this.maxWrittenFrame===null?this.maxWrittenFrame=l:this.maxWrittenFrame=Math.max(this.maxWrittenFrame,l);}}async finalizeCurrentBuffer(){if(this.maxWrittenFrame===null)return;g(this.startTime!==null);let e=(this.maxWrittenFrame+1)*this.targetNumberOfChannels,r=new Float32Array(e);r.set(this.outputBuffer.subarray(0,e));let i=new Me({format:"f32",sampleRate:this.targetSampleRate,numberOfChannels:this.targetNumberOfChannels,timestamp:this.startTime+this.bufferStartFrame/this.targetSampleRate,data:r});await this.onSample(i),this.outputBuffer.fill(0),this.maxWrittenFrame=null;}finalize(){return this.finalizeCurrentBuffer()}};var Qu=function(t,e,r){if(e!=null){if(typeof e!="object"&&typeof e!="function")throw new TypeError("Object expected.");var i,n;if(r){if(!Symbol.asyncDispose)throw new TypeError("Symbol.asyncDispose is not defined.");i=e[Symbol.asyncDispose];}if(i===void 0){if(!Symbol.dispose)throw new TypeError("Symbol.dispose is not defined.");i=e[Symbol.dispose],r&&(n=i);}if(typeof i!="function")throw new TypeError("Object not disposable.");n&&(i=function(){try{n.call(this);}catch(s){return Promise.reject(s)}}),t.stack.push({value:e,dispose:i,async:r});}else r&&t.stack.push({async:!0});return e},Ku=(function(t){return function(e){function r(o){e.error=e.hasError?new t(o,e.error,"An error was suppressed during disposal."):o,e.hasError=!0;}var i,n=0;function s(){for(;i=e.stack.pop();)try{if(!i.async&&n===1)return n=0,e.stack.push(i),Promise.resolve().then(s);if(i.dispose){var o=i.dispose.call(i.value);if(i.async)return n|=2,Promise.resolve(o).then(s,function(a){return r(a),s()})}else n|=1;}catch(a){r(a);}if(n===1)return e.hasError?Promise.reject(e.error):Promise.resolve();if(e.hasError)throw e.error}return s()}})(typeof SuppressedError=="function"?SuppressedError:function(t,e,r){var i=new Error(r);return i.name="SuppressedError",i.error=t,i.suppressed=e,i}),Ri=class{constructor(){this._connectedTrack=null,this._closingPromise=null,this._closed=!1;}_ensureValidAdd(){if(!this._connectedTrack)throw new Error("Source is not connected to an output track.");if(this._connectedTrack.output.state==="canceled")throw new Error("Output has been canceled.");if(this._connectedTrack.output.state==="finalizing"||this._connectedTrack.output.state==="finalized")throw new Error("Output has been finalized.");if(this._connectedTrack.output.state==="pending")throw new Error("Output has not started.");if(this._closed)throw new Error("Source is closed.")}async _start(){}async _flushAndClose(e){}close(){if(this._closingPromise)return;let e=this._connectedTrack;if(!e)throw new Error("Cannot call close without connecting the source to an output track.");if(e.output.state==="pending")throw new Error("Cannot call close before output has been started.");this._closingPromise=(async()=>{await this._flushAndClose(!1),this._closed=!0,!(e.output.state==="finalizing"||e.output.state==="finalized")&&e.output._muxer.onTrackClose(e);})();}async _flushOrWaitForOngoingClose(e){return this._closingPromise??(this._closingPromise=(async()=>{await this._flushAndClose(e),this._closed=!0;})())}},Lr=class extends Ri{constructor(e){if(super(),this._connectedTrack=null,!Oe.includes(e))throw new TypeError(`Invalid video codec '${e}'. Must be one of: ${Oe.join(", ")}.`);this._codec=e;}},so=(t,e)=>{if(t.metadata.hasOnlyKeyPackets&&e.type!=="key")throw new Error("Cannot add non-key packets to a hasOnlyKeyPackets video track.")},Wn=class extends Lr{constructor(e){super(e);}add(e,r){if(!(e instanceof me))throw new TypeError("packet must be an EncodedPacket.");if(e.isMetadataOnly)throw new TypeError("Metadata-only packets cannot be added.");if(r!==void 0&&(!r||typeof r!="object"))throw new TypeError("meta, when provided, must be an object.");return this._ensureValidAdd(),so(this._connectedTrack,e),this._connectedTrack.output._muxer.addEncodedVideoPacket(this._connectedTrack,e,r)}},oo=class{setError(e){this.errorSet||(this.error=e,this.errorSet=!0);}constructor(e,r){this.source=e,this.encodingConfig=r,this.ensureEncoderPromise=null,this.encoderInitialized=!1,this.encoder=null,this.muxer=null,this.lastMultipleOfKeyFrameInterval=-1,this.emittedEncoderPackets=0,this.codedWidth=null,this.codedHeight=null,this.outputWidth=null,this.outputHeight=null,this.frameRateLastSample=null,this.frameRateLastTimestamp=null,this.frameRateLastEndTimestamp=null,this.preciseTimings=[],this.customEncoder=null,this.customEncoderCallSerializer=new Nt,this.customEncoderQueueSize=0,this.defaultEncodeOptions={},this.alphaEncoder=null,this.splitter=null,this.splitterCreationFailed=!1,this.alphaFrameQueue=[],this.error=null,this.errorSet=!1,this.lastMuxerPromise=Promise.resolve(),this.closed=!1;}async add(e,r,i){let n=e;try{this.checkForEncoderError(),this.source._ensureValidAdd();let s=this.encodingConfig,o=s.sizeChangeBehavior??"deny",a=!1;if(this.codedWidth!==null&&this.codedHeight!==null){if((e.codedWidth!==this.codedWidth||e.codedHeight!==this.codedHeight)&&(a=!0,o==="deny"))throw new Error(`Video sample size must remain constant. Expected ${this.codedWidth}x${this.codedHeight}, got ${e.codedWidth}x${e.codedHeight}. To allow the sample size to change over time, set \`sizeChangeBehavior\` to a value other than 'deny' in the encoding options.`)}else this.codedWidth=e.codedWidth,this.codedHeight=e.codedHeight;if(s.transform?.width!==void 0||s.transform?.height!==void 0||s.transform?.rotate!==void 0||s.transform?.crop!==void 0||s.transform?.force===!0||a&&o!=="passThrough"){let d=s.transform?.width,f=s.transform?.height,m=s.transform?.fit??"fill";a&&o!=="passThrough"&&(g(this.outputWidth),g(this.outputHeight),g(o!=="deny"),d=this.outputWidth,f=this.outputHeight,m=o);let p=await e.transform({width:d,height:f,roundDimensionsTo:2,crop:s.transform?.crop,rotate:s.transform?.rotate,fit:m,alpha:s.alpha});(this.outputWidth===null||this.outputHeight===null)&&(this.outputWidth=p.displayWidth,this.outputHeight=p.displayHeight),r&&e.close(),e=p,r=!0;}else (this.outputWidth===null||this.outputHeight===null)&&(this.outputWidth=e.codedWidth,this.outputHeight=e.codedHeight);let l=s.transform?.frameRate;if(l!==void 0){let d=e.timestamp+e.duration,f=os(e.timestamp,l);if(this.frameRateLastSample!==null)if(f<=this.frameRateLastTimestamp){this.frameRateLastSample.close(),this.frameRateLastSample=e.clone(),this.frameRateLastEndTimestamp=d;return}else await this.padFrameRate(f,i);e===n&&(e=e.clone(),r=!0),e.setTimestamp(f),e.setDuration(1/l),this.frameRateLastSample?.close(),this.frameRateLastSample=e.clone(),this.frameRateLastTimestamp=f,this.frameRateLastEndTimestamp=d;}await this.processAndEncode(e,i);}finally{r&&e.close();}}async processAndEncode(e,r){let i=this.encodingConfig,n;if(i.transform?.process){let s=i.transform.process(e);if(U(s)&&(s=await s),s===null)return;Array.isArray(s)||(s=[s]);let o=[];try{for(let a of s)a instanceof Xe?o.push(a):typeof VideoFrame<"u"&&a instanceof VideoFrame?o.push(new Xe(a)):o.push(new Xe(a,{timestamp:e.timestamp,duration:e.duration}));}catch(a){for(let c of o)c!==e&&c.close();for(let c of s)(c instanceof Xe&&c!==e||typeof VideoFrame<"u"&&c instanceof VideoFrame)&&c.close();throw a}n=o;}else n=[e];try{for(let s of n){if(this.encoderInitialized||(this.ensureEncoderPromise||this.ensureEncoder(s),this.encoderInitialized||await this.ensureEncoderPromise),g(this.encoderInitialized),this.closed)break;let o=this.encodingConfig.keyFrameInterval??2,a=Math.floor(s.timestamp/o),c={...this.defaultEncodeOptions,...s.encodeOptions,...r},u={...c,keyFrame:c.keyFrame!==void 0?c.keyFrame:o===0||a!==this.lastMultipleOfKeyFrameInterval};if(this.lastMultipleOfKeyFrameInterval=a,this.encodingConfig.onEncodedSample?.(s),this.customEncoder){this.customEncoderQueueSize++;let l=s.clone(),d=this.customEncoderCallSerializer.call(()=>this.customEncoder.encode(l,u)).catch(f=>this.setError(f)).finally(()=>{this.customEncoderQueueSize--,l.close();});this.customEncoderQueueSize>=4&&await d;}else {g(this.encoder);let l=s.toVideoFrame(),d=de(this.preciseTimings,l.timestamp,m=>m.microsecondTimestamp),f=d!==-1?this.preciseTimings[d]:null;if(f&&f.microsecondTimestamp===l.timestamp?(f.timestamp!==s.timestamp&&(f.timestampIsValid=!1),f.duration!==s.duration&&(f.durationIsValid=!1)):(this.preciseTimings.splice(d+1,0,{microsecondTimestamp:l.timestamp,timestamp:s.timestamp,duration:s.duration,timestampIsValid:!0,durationIsValid:!0}),this.preciseTimings.length>128&&this.preciseTimings.shift()),this.alphaEncoder)if(!!l.format&&!l.format.includes("A")||this.splitterCreationFailed){this.alphaFrameQueue.push(null);try{this.encoder.encode(l,u);}finally{l.close();}}else {this.splitter||(this.splitter=new ao);let{colorFrame:p,alphaFrame:b}=await this.splitter.split(l);this.alphaFrameQueue.push(b);try{this.encoder.encode(p,u);}finally{p.close();}}else try{this.encoder.encode(l,u);}finally{l.close();}this.encoder.encodeQueueSize>=4&&await new Promise(m=>this.encoder.addEventListener("dequeue",m,{once:!0}));}await this.lastMuxerPromise;}}finally{for(let s of n)s!==e&&s.close();}}async padFrameRate(e,r){let i=this.encodingConfig.transform.frameRate;g(this.frameRateLastSample);let n=Math.round((e-this.frameRateLastTimestamp)*i);for(let s=1;s<n;s++){let o={stack:[],error:void 0,hasError:!1};try{let a=Qu(o,this.frameRateLastSample.clone(),!1);a.setTimestamp(this.frameRateLastTimestamp+s/i),a.setDuration(1/i),await this.processAndEncode(a,r);}catch(a){o.error=a,o.hasError=!0;}finally{Ku(o);}}}ensureEncoder(e){this.ensureEncoderPromise=(async()=>{let r=Gt(this.encodingConfig.quality,this.encodingConfig.bitrate);g(r!==void 0);let i=Ds({...this.encodingConfig,quality:r,width:e.codedWidth,height:e.codedHeight,squarePixelWidth:e.squarePixelWidth,squarePixelHeight:e.squarePixelHeight,framerate:this.source._connectedTrack?.metadata.frameRate}),n=null,s;for(let a of i){let c=a.config;if(this.encodingConfig.onEncoderConfig?.(c),s=Pn.find(l=>l.supports(this.encodingConfig.codec,c)),s){n=a;break}if(typeof VideoEncoder>"u")continue;if(c.alpha="discard",this.encodingConfig.alpha==="keep"&&(c.latencyMode="quality"),(c.width%2===1||c.height%2===1)&&(this.encodingConfig.codec==="avc"||this.encodingConfig.codec==="hevc"))throw new Error(`The dimensions ${c.width}x${c.height} are not supported for codec '${this.encodingConfig.codec}'; both width and height must be even numbers. Make sure to round your dimensions to the nearest even number.`);try{if((await VideoEncoder.isConfigSupported(c)).supported){n=a;break}}catch{}}if(!n){if(typeof VideoEncoder>"u")throw new Error(br("VideoEncoder"));let a=i[0].config,c=i.map(({config:u,quantizer:l})=>l!==null?`quantizer ${l}`:`${u.bitrate} bps`);throw new Error(`This specific encoder configuration (${a.codec}, ${c.join(" / ")}, ${a.width}x${a.height}, hardware acceleration: ${a.hardwareAcceleration??"no-preference"}) is not supported in this environment. Consider using another codec or changing your video parameters.`)}let o=n.config;if(n.quantizer!==null&&(this.defaultEncodeOptions=zs(this.encodingConfig.codec,n.quantizer)),s)this.customEncoder=new s,this.customEncoder.codec=this.encodingConfig.codec,this.customEncoder.config=o,this.customEncoder.onPacket=(a,c)=>{if(!(a instanceof me))throw new TypeError("The first argument passed to onPacket must be an EncodedPacket.");if(c!==void 0&&(!c||typeof c!="object"))throw new TypeError("The second argument passed to onPacket must be an object or undefined.");so(this.source._connectedTrack,a),this.encodingConfig.onEncodedPacket?.(a,c),this.lastMuxerPromise=this.muxer.addEncodedVideoPacket(this.source._connectedTrack,a,c).catch(u=>{this.setError(u);});},this.customEncoder.onError=a=>{this.setError(a);},await this.customEncoder.init();else {let a=[],c=[],u=0,l=0,d=(m,p,b)=>{let y={};if(p){let P=new Uint8Array(p.byteLength);p.copyTo(P),y.alpha=P;}let w=me.fromEncodedChunk(m,y),T=de(this.preciseTimings,m.timestamp,P=>P.microsecondTimestamp),A=T!==-1?this.preciseTimings[T]:null,E=null;this.emittedEncoderPackets===0&&w.type==="delta"&&b?.decoderConfig&&(E=Er(this.encodingConfig.codec,b.decoderConfig,w.data)),(A&&A.microsecondTimestamp===m.timestamp||E!==null)&&(w=w.clone({timestamp:A?.timestampIsValid?A.timestamp:void 0,duration:A?.durationIsValid?A.duration:void 0,type:E??void 0})),so(this.source._connectedTrack,w),this.encodingConfig.onEncodedPacket?.(w,b),this.lastMuxerPromise=this.muxer.addEncodedVideoPacket(this.source._connectedTrack,w,b).catch(P=>{this.setError(P);}),this.emittedEncoderPackets++;},f=new Error("Encoding error").stack;if(this.encoder=new VideoEncoder({output:(m,p)=>{if(!this.alphaEncoder){d(m,null,p);return}let b=this.alphaFrameQueue.shift();g(b!==void 0),b?(this.alphaEncoder.encode(b,{...this.defaultEncodeOptions,keyFrame:m.type==="key"}),l++,b.close(),a.push({chunk:m,meta:p})):l===0?d(m,null,p):(c.push(u+l),a.push({chunk:m,meta:p}));},error:m=>{m.stack=f,this.setError(m);}}),this.encoder.configure(o),this.encodingConfig.alpha==="keep"){let m=new Error("Encoding error").stack;this.alphaEncoder=new VideoEncoder({output:(p,b)=>{l--;let y=a.shift();for(g(y!==void 0),d(y.chunk,p,y.meta),u++;c.length>0&&c[0]===u;){c.shift();let w=a.shift();g(w!==void 0),d(w.chunk,null,w.meta);}},error:p=>{p.stack=m,this.setError(p);}}),this.alphaEncoder.configure(o);}}g(this.source._connectedTrack),this.muxer=this.source._connectedTrack.output._muxer,this.encoderInitialized=!0;})();}async flushAndClose(e){try{if(!e&&(this.checkForEncoderError(),this.frameRateLastSample)){let r=this.encodingConfig.transform.frameRate,i=os(this.frameRateLastEndTimestamp,r);await this.padFrameRate(i);}this.closed=!0,e||(this.customEncoder?this.customEncoderCallSerializer.call(()=>this.customEncoder.flush()):this.encoder&&(await this.encoder.flush(),await this.alphaEncoder?.flush(),await as(25)));}finally{this.closed=!0,this.frameRateLastSample?.close(),this.frameRateLastSample=null,this.customEncoder?await this.customEncoderCallSerializer.call(()=>this.customEncoder.close()).catch(r=>this.setError(r)):this.encoder&&(this.encoder.state!=="closed"&&this.encoder.close(),this.alphaEncoder&&this.alphaEncoder.state!=="closed"&&this.alphaEncoder.close(),this.alphaFrameQueue.forEach(r=>r?.close()),this.alphaFrameQueue.length=0,this.splitter?.close());}e||this.checkForEncoderError();}getQueueSize(){return this.customEncoder?this.customEncoderQueueSize:this.encoder?.encodeQueueSize??0}checkForEncoderError(){if(this.errorSet)throw this.error}},no=null,ao=class{constructor(){this.worker=null,this.pendingRequests=new Map,this.nextRequestId=0;}split(e){if(!this.worker){if(!no){let n=new Blob([`(${Gu.toString()})()`],{type:"application/javascript"});no=URL.createObjectURL(n);}this.worker=new Worker(no),this.worker.addEventListener("message",n=>{let s=n.data,o=this.pendingRequests.get(s.id);o&&(this.pendingRequests.delete(s.id),"error"in s?o.reject(new Error(s.error)):o.resolve({colorFrame:s.colorFrame,alphaFrame:s.alphaFrame}));}),this.worker.addEventListener("error",n=>{let s=new Error(n.message||"Color/alpha splitter worker error.");for(let o of this.pendingRequests.values())o.reject(s);this.pendingRequests.clear();});}let r=this.nextRequestId++,i=we();return this.pendingRequests.set(r,i),this.worker.postMessage({id:r,sourceFrame:e},{transfer:[e]}),i.promise}close(){this.worker?.terminate(),this.worker=null;let e=new Error("Color/alpha splitter closed.");for(let r of this.pendingRequests.values())r.reject(e);this.pendingRequests.clear();}},Gu=()=>{let t=null,e=Promise.resolve();self.addEventListener("message",s=>{let{id:o,sourceFrame:a}=s.data;e=e.then(async()=>{try{let{colorFrame:c,alphaFrame:u}=await r(a);self.postMessage({id:o,colorFrame:c,alphaFrame:u},{transfer:[c,u]});}catch(c){self.postMessage({id:o,error:c.message});}finally{a.close();}});});let r=async s=>{let o=s.format;if(!o)throw new Error("CPU color/alpha splitting requires a known VideoFrame format.");let a=s.allocationSize();if((!t||t.byteLength!==a)&&(t=new Uint8Array(a)),await s.copyTo(t),o==="RGBA"||o==="BGRA")return i(t,o,s);if(o==="I420A"||o==="I420AP10"||o==="I420AP12"||o==="I422A"||o==="I422AP10"||o==="I422AP12"||o==="I444A"||o==="I444AP10"||o==="I444AP12")return n(t,o,s);throw new Error(`CPU color/alpha splitting does not support format '${o}'.`)},i=(s,o,a)=>{let c=a.visibleRect?.width??a.codedWidth,u=a.visibleRect?.height??a.codedHeight,l=c*u,d=Math.ceil(c/2),f=Math.ceil(u/2),m=l+d*f*2,p=new Uint8Array(m);for(let T=0,A=3;T<l;T++,A+=4)p[T]=s[A];p.fill(128,l);let b=new VideoFrame(s,{format:o==="RGBA"?"RGBX":"BGRX",codedWidth:c,codedHeight:u,timestamp:a.timestamp,duration:a.duration??void 0}),y={format:"I420",codedWidth:c,codedHeight:u,timestamp:a.timestamp,duration:a.duration??void 0,transfer:[p.buffer]},w=new VideoFrame(p,y);return {colorFrame:b,alphaFrame:w}},n=(s,o,a)=>{let c=a.visibleRect?.width??a.codedWidth,u=a.visibleRect?.height??a.codedHeight,l=o.includes("P10"),d=o.includes("P12"),f=l||d?2:1,m,p;o.startsWith("I420")?(m=Math.ceil(c/2),p=Math.ceil(u/2)):o.startsWith("I422")?(m=Math.ceil(c/2),p=u):(m=c,p=u);let b=c*u,y=m*p,w=b*f,T=y*f,A=b*f,E=w+T*2,P=o.replace("A",""),I=Math.ceil(c/2),v=Math.ceil(u/2),k=I*v,C=k*f,M=A+2*C,q=new Uint8Array(M),N=E;q.set(s.subarray(N,N+A),0);let L=A,ae=l?512:d?2048:128;f===1?q.fill(ae,L):new Uint16Array(q.buffer,L,2*k).fill(ae);let G=l?"I420P10":d?"I420P12":"I420",ie=new VideoFrame(s.subarray(0,E),{format:P,codedWidth:c,codedHeight:u,timestamp:a.timestamp,duration:a.duration??void 0}),te={format:G,codedWidth:c,codedHeight:u,timestamp:a.timestamp,duration:a.duration??void 0,transfer:[q.buffer]},le=new VideoFrame(q,te);return {colorFrame:ie,alphaFrame:le}};},Fi=class extends Lr{constructor(e){La(e),super(e.codec),this._encoder=new oo(this,e);}add(e,r){if(!(e instanceof Xe))throw new TypeError("videoSample must be a VideoSample.");return this._encoder.add(e,!1,r)}_flushAndClose(e){return this._encoder.flushAndClose(e)}};var Hr=class extends Ri{constructor(e){if(super(),this._connectedTrack=null,!Ue.includes(e))throw new TypeError(`Invalid audio codec '${e}'. Must be one of: ${Ue.join(", ")}.`);this._codec=e;}},qn=class extends Hr{constructor(e){super(e);}add(e,r){if(!(e instanceof me))throw new TypeError("packet must be an EncodedPacket.");if(e.isMetadataOnly)throw new TypeError("Metadata-only packets cannot be added.");if(r!==void 0&&(!r||typeof r!="object"))throw new TypeError("meta, when provided, must be an object.");return this._ensureValidAdd(),this._connectedTrack.output._muxer.addEncodedAudioPacket(this._connectedTrack,e,r)}},co=class{setError(e){this.errorSet||(this.error=e,this.errorSet=!0);}constructor(e,r){this.source=e,this.encodingConfig=r,this.ensureEncoderPromise=null,this.encoderInitialized=!1,this.encoder=null,this.muxer=null,this.lastNumberOfChannels=null,this.lastSampleRate=null,this.isPcmEncoder=!1,this.outputSampleSize=null,this.writeOutputValue=null,this.customEncoder=null,this.customEncoderCallSerializer=new Nt,this.customEncoderQueueSize=0,this.lastEndSampleIndex=null,this.resampler=null,this.error=null,this.errorSet=!1,this.lastMuxerPromise=Promise.resolve(),this.closed=!1;}async add(e,r){try{if(this.checkForEncoderError(),this.source._ensureValidAdd(),this.lastNumberOfChannels!==null&&this.lastSampleRate!==null){if(e.numberOfChannels!==this.lastNumberOfChannels||e.sampleRate!==this.lastSampleRate)throw new Error(`Audio parameters must remain constant. Expected ${this.lastNumberOfChannels} channels at ${this.lastSampleRate} Hz, got ${e.numberOfChannels} channels at ${e.sampleRate} Hz.`)}else this.lastNumberOfChannels=e.numberOfChannels,this.lastSampleRate=e.sampleRate;let i=this.encodingConfig;i.transform?.numberOfChannels!==void 0||i.transform?.sampleRate!==void 0?(this.resampler||(this.resampler=new Nn({targetNumberOfChannels:i.transform.numberOfChannels??e.numberOfChannels,targetSampleRate:i.transform.sampleRate??e.sampleRate,onSample:async s=>{await this.processAndEncode(s,!0);}})),await this.resampler.add(e)):await this.processAndEncode(e,r);}finally{r&&e.close();}}async processAndEncode(e,r){let i=this.encodingConfig;if(i.transform?.sampleFormat!==void 0&&za(e.format)!==i.transform.sampleFormat){let n=Ua(e,i.transform.sampleFormat);r&&e.close(),e=n,r=!0;}if(i.transform?.process)try{let n=i.transform.process(e);if(U(n)&&(n=await n),n===null)return;Array.isArray(n)||(n=[n]);try{for(let s of n)if(!(s instanceof Me))throw new TypeError("The audio process function must return an AudioSample, null, or an array of AudioSamples.");for(let s of n)await this.encodeSample(s,!0);}finally{for(let s of n)s instanceof Me&&s.close();}}finally{r&&e.close();}else await this.encodeSample(e,r);}async encodeSample(e,r){try{if(this.encoderInitialized||(this.ensureEncoderPromise||this.ensureEncoder(e),this.encoderInitialized||await this.ensureEncoderPromise),g(this.encoderInitialized),this.closed)return;{let i=Math.round(e.timestamp*e.sampleRate),n=Math.round((e.timestamp+e.duration)*e.sampleRate);if(this.lastEndSampleIndex===null)this.lastEndSampleIndex=n;else {let s=i-this.lastEndSampleIndex;if(s>=64){let o=new Me({data:new Float32Array(s*e.numberOfChannels),format:"f32-planar",sampleRate:e.sampleRate,numberOfChannels:e.numberOfChannels,numberOfFrames:s,timestamp:this.lastEndSampleIndex/e.sampleRate});await this.encodeSample(o,!0);}this.lastEndSampleIndex+=e.numberOfFrames;}}if(this.encodingConfig.onEncodedSample?.(e),this.customEncoder){this.customEncoderQueueSize++;let i=e.clone(),n=this.customEncoderCallSerializer.call(()=>this.customEncoder.encode(i)).catch(s=>this.setError(s)).finally(()=>{this.customEncoderQueueSize--,i.close();});this.customEncoderQueueSize>=4&&await n,await this.lastMuxerPromise;}else if(this.isPcmEncoder)await this.doPcmEncoding(e,r);else {g(this.encoder);let i=e.toAudioData();this.encoder.encode(i),i.close(),r&&e.close(),this.encoder.encodeQueueSize>=4&&await new Promise(n=>this.encoder.addEventListener("dequeue",n,{once:!0})),await this.lastMuxerPromise;}}finally{r&&e.close();}}async doPcmEncoding(e,r){g(this.outputSampleSize),g(this.writeOutputValue);let{numberOfChannels:i,numberOfFrames:n,sampleRate:s,timestamp:o}=e,a=2048,c=[];for(let f=0;f<n;f+=a){let m=Math.min(a,e.numberOfFrames-f),p=m*i*this.outputSampleSize,b=new ArrayBuffer(p),y=new DataView(b);c.push({frameCount:m,view:y});}let u=e.allocationSize({planeIndex:0,format:"f32-planar"}),l=new Float32Array(u/Float32Array.BYTES_PER_ELEMENT);for(let f=0;f<i;f++){e.copyTo(l,{planeIndex:f,format:"f32-planar"});for(let m=0;m<c.length;m++){let{frameCount:p,view:b}=c[m];for(let y=0;y<p;y++)this.writeOutputValue(b,(y*i+f)*this.outputSampleSize,l[m*a+y]);}}r&&e.close();let d={decoderConfig:{codec:this.encodingConfig.codec,numberOfChannels:i,sampleRate:s}};for(let f=0;f<c.length;f++){let{frameCount:m,view:p}=c[f],b=p.buffer,y=f*a,w=new me(new Uint8Array(b),"key",o+y/s,m/s);this.encodingConfig.onEncodedPacket?.(w,d),await this.muxer.addEncodedAudioPacket(this.source._connectedTrack,w,d);}}ensureEncoder(e){this.ensureEncoderPromise=(async()=>{let{numberOfChannels:r,sampleRate:i}=e,n=Gt(this.encodingConfig.quality,this.encodingConfig.bitrate),s=Os({numberOfChannels:r,sampleRate:i,...this.encodingConfig,quality:n});this.encodingConfig.onEncoderConfig?.(s);let o=In.find(a=>a.supports(this.encodingConfig.codec,s));if(o)this.customEncoder=new o,this.customEncoder.codec=this.encodingConfig.codec,this.customEncoder.config=s,this.customEncoder.onPacket=(a,c)=>{if(!(a instanceof me))throw new TypeError("The first argument passed to onPacket must be an EncodedPacket.");if(c!==void 0&&(!c||typeof c!="object"))throw new TypeError("The second argument passed to onPacket must be an object or undefined.");this.encodingConfig.onEncodedPacket?.(a,c),this.lastMuxerPromise=this.muxer.addEncodedAudioPacket(this.source._connectedTrack,a,c).catch(u=>{this.setError(u);});},this.customEncoder.onError=a=>{this.setError(a);},await this.customEncoder.init();else if(Se.includes(this.encodingConfig.codec))this.initPcmEncoder();else {if(typeof AudioEncoder>"u")throw new Error(br("AudioEncoder"));let a;try{a=(await AudioEncoder.isConfigSupported(s)).supported??!1;}catch{a=!1;}if(!a)throw new Error(`This specific encoder configuration (${s.codec}, ${s.bitrate} bps, ${s.numberOfChannels} channels, ${s.sampleRate} Hz) is not supported in this environment. Consider using another codec or changing your audio parameters.`);let c=new Error("Encoding error").stack;this.encoder=new AudioEncoder({output:(u,l)=>{if(this.encodingConfig.codec==="aac"&&l?.decoderConfig){let f=!1;if(!l.decoderConfig.description||l.decoderConfig.description.byteLength<2?f=!0:f=Ar(_e(l.decoderConfig.description)).objectType===0,f){let m=Number(ge(s.codec.split(".")));l.decoderConfig.description=Ki({objectType:m,outputNumberOfChannels:l.decoderConfig.numberOfChannels,outputSampleRate:l.decoderConfig.sampleRate});}}let d=me.fromEncodedChunk(u);d=d.clone({timestamp:Zr(d.timestamp,s.sampleRate),duration:u.duration!=null?Zr(d.duration,s.sampleRate):void 0}),this.encodingConfig.onEncodedPacket?.(d,l),this.lastMuxerPromise=this.muxer.addEncodedAudioPacket(this.source._connectedTrack,d,l).catch(f=>{this.setError(f);});},error:u=>{u.stack=c,this.setError(u);}}),this.encoder.configure(s);}g(this.source._connectedTrack),this.muxer=this.source._connectedTrack.output._muxer,this.encoderInitialized=!0;})();}initPcmEncoder(){this.isPcmEncoder=!0;let e=this.encodingConfig.codec,{dataType:r,sampleSize:i,littleEndian:n}=Ve(e);switch(this.outputSampleSize=i,i){case 1:r==="unsigned"?this.writeOutputValue=(s,o,a)=>s.setUint8(o,fe((a+1)*127.5,0,255)):r==="signed"?this.writeOutputValue=(s,o,a)=>{s.setInt8(o,fe(Math.round(a*128),-128,127));}:r==="ulaw"?this.writeOutputValue=(s,o,a)=>{let c=fe(Math.floor(a*32767),-32768,32767);s.setUint8(o,Ga(c));}:r==="alaw"?this.writeOutputValue=(s,o,a)=>{let c=fe(Math.floor(a*32767),-32768,32767);s.setUint8(o,Xa(c));}:g(!1);break;case 2:r==="unsigned"?this.writeOutputValue=(s,o,a)=>s.setUint16(o,fe((a+1)*32767.5,0,65535),n):r==="signed"?this.writeOutputValue=(s,o,a)=>s.setInt16(o,fe(Math.round(a*32767),-32768,32767),n):g(!1);break;case 3:r==="unsigned"?this.writeOutputValue=(s,o,a)=>$r(s,o,fe((a+1)*83886075e-1,0,16777215),n):r==="signed"?this.writeOutputValue=(s,o,a)=>Ao(s,o,fe(Math.round(a*8388607),-8388608,8388607),n):g(!1);break;case 4:r==="unsigned"?this.writeOutputValue=(s,o,a)=>s.setUint32(o,fe((a+1)*21474836475e-1,0,4294967295),n):r==="signed"?this.writeOutputValue=(s,o,a)=>s.setInt32(o,fe(Math.round(a*2147483647),-2147483648,2147483647),n):r==="float"?this.writeOutputValue=(s,o,a)=>s.setFloat32(o,a,n):g(!1);break;case 8:r==="float"?this.writeOutputValue=(s,o,a)=>s.setFloat64(o,a,n):g(!1);break;default:ve(i),g(!1);}}async flushAndClose(e){try{e||(this.checkForEncoderError(),this.resampler&&await this.resampler.finalize()),this.closed=!0,e||(this.customEncoder?this.customEncoderCallSerializer.call(()=>this.customEncoder.flush()):this.encoder&&await this.encoder.flush());}finally{this.closed=!0,this.resampler=null,this.customEncoder?await this.customEncoderCallSerializer.call(()=>this.customEncoder.close()).catch(r=>this.setError(r)):this.encoder&&this.encoder.state!=="closed"&&this.encoder.close();}e||this.checkForEncoderError();}getQueueSize(){return this.customEncoder?this.customEncoderQueueSize:this.isPcmEncoder?0:this.encoder?.encodeQueueSize??0}checkForEncoderError(){if(this.errorSet)throw this.error}},Ln=class extends Hr{constructor(e){ja(e),super(e.codec),this._encoder=new co(this,e);}add(e){if(!(e instanceof Me))throw new TypeError("audioSample must be an AudioSample.");return this._encoder.add(e,!1)}_flushAndClose(e){return this._encoder.flushAndClose(e)}};var Hn=class extends Ri{constructor(e){if(super(),this._connectedTrack=null,!Ht.includes(e))throw new TypeError(`Invalid subtitle codec '${e}'. Must be one of: ${Ht.join(", ")}.`);this._codec=e;}};var jr=class{getSupportedVideoCodecs(){return this.getSupportedCodecs().filter(e=>Oe.includes(e))}getSupportedAudioCodecs(){return this.getSupportedCodecs().filter(e=>Ue.includes(e))}getSupportedSubtitleCodecs(){return this.getSupportedCodecs().filter(e=>Ht.includes(e))}_codecUnsupportedHint(e){return ""}_isFragmentedIsobmff(){return !1}},Qr=class extends jr{constructor(e={}){if(!e||typeof e!="object")throw new TypeError("options must be an object.");if(e.fastStart!==void 0&&![!1,"in-memory","reserve","fragmented"].includes(e.fastStart))throw new TypeError("options.fastStart, when provided, must be false, 'in-memory', 'reserve', or 'fragmented'.");if(e.minimumFragmentDuration!==void 0&&(!et(e.minimumFragmentDuration)||e.minimumFragmentDuration<0))throw new TypeError("options.minimumFragmentDuration, when provided, must be a non-negative number.");if(e.onFtyp!==void 0&&typeof e.onFtyp!="function")throw new TypeError("options.onFtyp, when provided, must be a function.");if(e.onMoov!==void 0&&typeof e.onMoov!="function")throw new TypeError("options.onMoov, when provided, must be a function.");if(e.onMdat!==void 0&&typeof e.onMdat!="function")throw new TypeError("options.onMdat, when provided, must be a function.");if(e.onMoof!==void 0&&typeof e.onMoof!="function")throw new TypeError("options.onMoof, when provided, must be a function.");if(e.metadataFormat!==void 0&&!["mdir","mdta","udta","auto"].includes(e.metadataFormat))throw new TypeError("options.metadataFormat, when provided, must be either 'auto', 'mdir', 'mdta', or 'udta'.");super(),this._options=e;}getSupportedTrackCounts(){return {video:{min:0,max:4294967295},audio:{min:0,max:4294967295},subtitle:{min:0,max:4294967295},total:{min:0,max:4294967295}}}get supportsVideoRotationMetadata(){return !0}get supportsTimestampedMediaData(){return !0}get negativeTimestampSupport(){return "full"}_createMuxer(e){return new Vn(e,this)}_isFragmentedIsobmff(){return this._options.fastStart==="fragmented"}},Zt=class extends Qr{constructor(e){super(e);}get _name(){return "MP4"}get fileExtension(){return ".mp4"}get mimeType(){return "video/mp4"}getSupportedCodecs(){return [...Oe,...It,"pcm-s16","pcm-s16be","pcm-s24","pcm-s24be","pcm-s32","pcm-s32be","pcm-f32","pcm-f32be","pcm-f64","pcm-f64be",...Ht]}_codecUnsupportedHint(e){return new qr().getSupportedCodecs().includes(e)?" Switching to MOV will grant support for this codec.":""}},Wr=class extends Qr{constructor(e){super(e);}get _name(){return "CMAF"}get fileExtension(){return ".m4s"}get mimeType(){return "video/mp4"}getSupportedCodecs(){return [...Oe,...It,"pcm-s16","pcm-s16be","pcm-s24","pcm-s24be","pcm-s32","pcm-s32be","pcm-f32","pcm-f32be","pcm-f64","pcm-f64be",...Ht]}},qr=class extends Qr{constructor(e){super(e);}get _name(){return "MOV"}get fileExtension(){return ".mov"}get mimeType(){return "video/quicktime"}getSupportedCodecs(){return [...Oe,...Ue]}_codecUnsupportedHint(e){return new Zt().getSupportedCodecs().includes(e)?" Switching to MP4 will grant support for this codec.":""}};var Tc=["video","audio","subtitle"],Kr=class t{constructor(e,r,i,n,s){this.id=e,this.output=r,this.type=i,this.source=n,this.metadata=s;}isVideoTrack(){return this.type==="video"}isAudioTrack(){return this.type==="audio"}isSubtitleTrack(){return this.type==="subtitle"}canBePairedWith(e){if(!(e instanceof t))throw new TypeError("other must be an OutputTrack.");if(this===e)return !1;let r=Hi(this.metadata.group),i=Hi(e.metadata.group);for(let n of r)if(this.type!==e.type&&i.some(a=>n===a)||i.some(a=>n._pairedGroups.has(a)))return !0;return !1}},jn=class extends Kr{constructor(e,r,i,n){super(e,r,"video",i,n);}},Qn=class extends Kr{constructor(e,r,i,n){super(e,r,"audio",i,n);}},Kn=class extends Kr{constructor(e,r,i,n){super(e,r,"subtitle",i,n);}},je=class t{constructor(){this._pairedGroups=new Set;}pairWith(e){if(!(e instanceof t))throw new TypeError("other must be an OutputTrackGroup.");if(this===e)throw new TypeError("Cannot pair a group with itself.");this._pairedGroups.add(e),e._pairedGroups.add(this);}},lo=t=>{if(!t||typeof t!="object")throw new TypeError("metadata must be an object.");if(t.languageCode!==void 0&&!Ct(t.languageCode))throw new TypeError("metadata.languageCode, when provided, must be a three-letter, ISO 639-2/T language code.");if(t.name!==void 0&&typeof t.name!="string")throw new TypeError("metadata.name, when provided, must be a string.");if(t.disposition!==void 0&&Eo(t.disposition),t.maximumPacketCount!==void 0&&(!Number.isInteger(t.maximumPacketCount)||t.maximumPacketCount<0))throw new TypeError("metadata.maximumPacketCount, when provided, must be a non-negative integer.");if(t.group!==void 0&&!(t.group instanceof je)&&(!Array.isArray(t.group)||t.group.some(e=>!(e instanceof je))))throw new TypeError("metadata.group, when provided, must be an OutputTrackGroup instance or an array of OutputTrackGroup instances.")},Yt=class extends Qe{get target(){let e="Output.target cannot be used when using PathedTarget with an async callback. Use the 'target' event instead.";if(this._rootTargetPromise)throw new TypeError(e);let r=this._getRootTarget();if(U(r))throw new TypeError(e);return r}constructor(e){if(super(),this.state="pending",this.defaultTrackGroup=new je,this.tracks=[],this._onFinalize=null,this._unfinalizedTargets=new Set,this._rootWriterPromise=null,this._startPromise=null,this._cancelPromise=null,this._finalizePromise=null,this._mutex=new gr,this._metadataTags={},this._rootTarget=null,this._rootTargetPromise=null,this._firstMediaStreamTimestamp=null,!e||typeof e!="object")throw new TypeError("options must be an object.");if(!(e.format instanceof jr))throw new TypeError("options.format must be an OutputFormat.");if(!(e.target instanceof Le||e.target instanceof mr))throw new TypeError("options.target must be a Target or a PathedTarget.");if(e.target instanceof Le&&this._rememberTarget(e.target),e.initTarget!==void 0&&!(e.initTarget instanceof Le)&&typeof e.initTarget!="function")throw new Error("options.initTarget, when provided, must be a Target or a function that returns or resolves to a Target.");if(e.onFinalize!==void 0&&typeof e.onFinalize!="function")throw new TypeError("options.onFinalize, when provided, must be a function.");this.format=e.format,this._target=e.target,this._onFinalize=e.onFinalize??null,this._initTarget=e.initTarget??null,this._initTarget instanceof Le&&this._rememberTarget(this._initTarget),this._muxer=e.format._createMuxer(this);}_getTargetValidated(e){g(this._target instanceof mr);let r=this._target.getTarget(e),i=n=>{if(!(n instanceof Le))throw new TypeError("getTarget must return a Target.");return n};return U(r)?r.then(i):i(r)}async _getTarget(e){g(this._target instanceof mr);let r=await this._getTargetValidated(e);return this._emit("target",{target:r,request:e,isRoot:e.isRoot}),this.state==="canceled"?await r._close():this._rememberTarget(r),r}_rememberTarget(e){this._unfinalizedTargets.add(e),e.on("finalized",()=>this._unfinalizedTargets.delete(e),{once:!0});}async _getInitTarget(){if(g(this._initTarget!==null),this._initTarget instanceof Le)return this._initTarget;let e=await this._initTarget();return this.state==="canceled"?await e._close():this._rememberTarget(e),e}_hasInitTarget(){return this._initTarget!==null}_getRootTarget(){if(this._rootTarget)return this._rootTarget;if(this._rootTargetPromise)return this._rootTargetPromise;if(this._target instanceof Le)return this._emit("target",{target:this._target,request:null,isRoot:!0}),this._rootTarget=this._target,this._target;let e={path:this._target.rootPath,isRoot:!0,mimeType:this.format.mimeType},r=this._getTargetValidated(e),i=n=>(this.state==="canceled"?n._close():this._rememberTarget(n),this._emit("target",{target:n,request:e,isRoot:!0}),this._rootTarget=n,n);return U(r)?this._rootTargetPromise=r.then(i):i(r)}_getRootWriter(e){return this._rootWriterPromise??(this._rootWriterPromise=(async()=>{let r=await this._getRootTarget(),i=new hr(r,typeof e=="boolean"?e:e(r));return i.start(),i})())}addVideoTrack(e,r={}){if(!(e instanceof Lr))throw new TypeError("source must be a VideoSource.");if(lo(r),r.rotation!==void 0&&![0,90,180,270].includes(r.rotation))throw new TypeError(`Invalid video rotation: ${r.rotation}. Has to be 0, 90, 180 or 270.`);if(!this.format.supportsVideoRotationMetadata&&r.rotation)throw new Error(`${this.format._name} does not support video rotation metadata.`);if(r.frameRate!==void 0&&(!Number.isFinite(r.frameRate)||r.frameRate<=0))throw new TypeError(`Invalid video frame rate: ${r.frameRate}. Must be a positive number.`);if(r.decoderConfig!==void 0&&ln({decoderConfig:r.decoderConfig},e._codec),r.primingPacket!==void 0){if(!(r.primingPacket instanceof me))throw new TypeError("metadata.primingPacket, when provided, must be an EncodedPacket.");if(r.decoderConfig===void 0)throw new TypeError("metadata.primingPacket can only be provided alongside metadata.decoderConfig.")}let i={...r};return i.group??(i.group=this.defaultTrackGroup),this._addTrack(new jn(this.tracks.length+1,this,e,i))}addAudioTrack(e,r={}){if(!(e instanceof Hr))throw new TypeError("source must be an AudioSource.");if(lo(r),r.decoderConfig!==void 0&&un({decoderConfig:r.decoderConfig},e._codec),r.primingPacket!==void 0){if(!(r.primingPacket instanceof me))throw new TypeError("metadata.primingPacket, when provided, must be an EncodedPacket.");if(r.decoderConfig===void 0)throw new TypeError("metadata.primingPacket can only be provided alongside metadata.decoderConfig.")}let i={...r};return i.group??(i.group=this.defaultTrackGroup),this._addTrack(new Qn(this.tracks.length+1,this,e,i))}addSubtitleTrack(e,r={}){if(!(e instanceof Hn))throw new TypeError("source must be a SubtitleSource.");lo(r);let i={...r};return i.group??(i.group=this.defaultTrackGroup),this._addTrack(new Kn(this.tracks.length+1,this,e,i))}setMetadataTags(e){if(ti(e),this.state!=="pending")throw new Error("Cannot set metadata tags after output has been started or canceled.");this._metadataTags=e;}_addTrack(e){if(this.state!=="pending")throw new Error("Cannot add track after output has been started or canceled.");if(e.source._connectedTrack)throw new Error("Source is already used for a track.");let r=this.format.getSupportedTrackCounts(),i=this.tracks.reduce((o,a)=>o+(a.type===e.type?1:0),0),n=r[e.type].max;if(i===n)throw new Error(n===0?`${this.format._name} does not support ${e.type} tracks.`:`${this.format._name} does not support more than ${n} ${e.type} track${n===1?"":"s"}.`);let s=r.total.max;if(this.tracks.length===s)throw new Error(`${this.format._name} does not support more than ${s} tracks${s===1?"":"s"} in total.`);if(e.isVideoTrack()){let o=this.format.getSupportedVideoCodecs();if(o.length===0)throw new Error(`${this.format._name} does not support video tracks.`+this.format._codecUnsupportedHint(e.source._codec));if(!o.includes(e.source._codec))throw new Error(`Codec '${e.source._codec}' cannot be contained within ${this.format._name}. Supported video codecs are: ${o.map(a=>`'${a}'`).join(", ")}.`+this.format._codecUnsupportedHint(e.source._codec))}else if(e.isAudioTrack()){let o=this.format.getSupportedAudioCodecs();if(o.length===0)throw new Error(`${this.format._name} does not support audio tracks.`+this.format._codecUnsupportedHint(e.source._codec));if(!o.includes(e.source._codec))throw new Error(`Codec '${e.source._codec}' cannot be contained within ${this.format._name}. Supported audio codecs are: ${o.map(a=>`'${a}'`).join(", ")}.`+this.format._codecUnsupportedHint(e.source._codec))}else if(e.isSubtitleTrack()){let o=this.format.getSupportedSubtitleCodecs();if(o.length===0)throw new Error(`${this.format._name} does not support subtitle tracks.`+this.format._codecUnsupportedHint(e.source._codec));if(!o.includes(e.source._codec))throw new Error(`Codec '${e.source._codec}' cannot be contained within ${this.format._name}. Supported subtitle codecs are: ${o.map(a=>`'${a}'`).join(", ")}.`+this.format._codecUnsupportedHint(e.source._codec))}return this.tracks.push(e),e.source._connectedTrack=e,e}hasEnoughTracks(){let e=this.format.getSupportedTrackCounts();for(let i of Tc){let n=this.tracks.reduce((o,a)=>o+(a.type===i?1:0),0),s=e[i].min;if(n<s)return !1}let r=e.total.min;return !(this.tracks.length<r)}async start(){let e=this.format.getSupportedTrackCounts();for(let i of Tc){let n=this.tracks.reduce((o,a)=>o+(a.type===i?1:0),0),s=e[i].min;if(n<s)throw new Error(s===e[i].max?`${this.format._name} requires exactly ${s} ${i} track${s===1?"":"s"}.`:`${this.format._name} requires at least ${s} ${i} track${s===1?"":"s"}.`)}let r=e.total.min;if(this.tracks.length<r)throw new Error(r===e.total.max?`${this.format._name} requires exactly ${r} track${r===1?"":"s"}.`:`${this.format._name} requires at least ${r} track${r===1?"":"s"}.`);if(this.state==="canceled")throw new Error("Output has been canceled.");return this._startPromise?($._warn("Output has already been started."),this._startPromise):this._startPromise=(async()=>{this.state="started";let i=this._mutex.acquire();try{await this._muxer.start();let n=this.tracks.map(s=>s.source._start());await Promise.all(n);}finally{(await i)();}})()}getMimeType(){return this._muxer.getMimeType()}async cancel(){if(this._cancelPromise)return $._warn("Output has already been canceled."),this._cancelPromise;if(this.state==="finalizing"||this.state==="finalized"){this.state==="finalized"&&$._warn("Output has already been finalized.");return}return this._cancelPromise=(async()=>{this.state="canceled";let e=await this._mutex.acquire();try{let r=this.tracks.map(i=>i.source._flushOrWaitForOngoingClose(!0));await Promise.all(r),await Promise.all([...this._unfinalizedTargets].map(i=>i._close())),this._unfinalizedTargets.clear();}finally{e();}})()}async finalize(){if(this.state==="pending")throw new Error("Cannot finalize before starting.");if(this.state==="canceled")throw new Error("Cannot finalize after canceling.");return this._finalizePromise?($._warn("Output has already been finalized."),this._finalizePromise):this._finalizePromise=(async()=>{this.state="finalizing";let e=await this._mutex.acquire();try{let r=this.tracks.map(i=>i.source._flushOrWaitForOngoingClose(!1));if(await Promise.all(r),await this._muxer.finalize(),this._rootWriterPromise){let i=await this._rootWriterPromise;i.finalized||(await i.flush(),await i.finalize());}this._onFinalize&&await this._onFinalize(),this.state="finalized";}finally{await Promise.all([...this._unfinalizedTargets].map(r=>r._close().catch(()=>{}))),this._unfinalizedTargets.clear(),e();}})()}};var Bi=function(t,e,r){if(e!=null){if(typeof e!="object"&&typeof e!="function")throw new TypeError("Object expected.");var i,n;if(r){if(!Symbol.asyncDispose)throw new TypeError("Symbol.asyncDispose is not defined.");i=e[Symbol.asyncDispose];}if(i===void 0){if(!Symbol.dispose)throw new TypeError("Symbol.dispose is not defined.");i=e[Symbol.dispose],r&&(n=i);}if(typeof i!="function")throw new TypeError("Object not disposable.");n&&(i=function(){try{n.call(this);}catch(s){return Promise.reject(s)}}),t.stack.push({value:e,dispose:i,async:r});}else r&&t.stack.push({async:!0});return e},Gn=(function(t){return function(e){function r(o){e.error=e.hasError?new t(o,e.error,"An error was suppressed during disposal."):o,e.hasError=!0;}var i,n=0;function s(){for(;i=e.stack.pop();)try{if(!i.async&&n===1)return n=0,e.stack.push(i),Promise.resolve().then(s);if(i.dispose){var o=i.dispose.call(i.value);if(i.async)return n|=2,Promise.resolve(o).then(s,function(a){return r(a),s()})}else n|=1;}catch(a){r(a);}if(n===1)return e.hasError?Promise.reject(e.error):Promise.resolve();if(e.hasError)throw e.error}return s()}})(typeof SuppressedError=="function"?SuppressedError:function(t,e,r){var i=new Error(r);return i.name="SuppressedError",i.error=t,i.suppressed=e,i}),$n=t=>{if(!t||typeof t!="object")throw new TypeError("options.video, when provided, must be an object.");if(t?.discard!==void 0&&typeof t.discard!="boolean")throw new TypeError("options.video.discard, when provided, must be a boolean.");if(t?.forceTranscode!==void 0&&typeof t.forceTranscode!="boolean")throw new TypeError("options.video.forceTranscode, when provided, must be a boolean.");if(t?.codec!==void 0&&!Oe.includes(t.codec))throw new TypeError(`options.video.codec, when provided, must be one of: ${Oe.join(", ")}.`);let e=t?.bitrate;if(t?.quality!==void 0&&!(t.quality instanceof Ee))throw new TypeError("options.video.quality, when provided, must be a Quality.");if(t?.quality!==void 0&&e!==void 0)throw new TypeError("options.video.quality and options.video.bitrate cannot both be provided.");if(e!==void 0&&!(e instanceof Ee)&&(!Number.isInteger(e)||e<=0))throw new TypeError("options.video.bitrate, when provided, must be a positive integer or a quality.");if(t?.width!==void 0&&(!Number.isInteger(t.width)||t.width<=0))throw new TypeError("options.video.width, when provided, must be a positive integer.");if(t?.height!==void 0&&(!Number.isInteger(t.height)||t.height<=0))throw new TypeError("options.video.height, when provided, must be a positive integer.");if(t?.fit!==void 0&&!["fill","contain","cover"].includes(t.fit))throw new TypeError("options.video.fit, when provided, must be one of 'fill', 'contain', or 'cover'.");if(t?.width!==void 0&&t.height!==void 0&&t.fit===void 0)throw new TypeError("When both options.video.width and options.video.height are provided, options.video.fit must also be provided.");if(t?.rotate!==void 0&&![0,90,180,270].includes(t.rotate))throw new TypeError("options.video.rotate, when provided, must be 0, 90, 180 or 270.");if(t?.allowRotationMetadata!==void 0&&typeof t.allowRotationMetadata!="boolean")throw new TypeError("options.video.allowRotationMetadata, when provided, must be a boolean.");if(t?.crop!==void 0&&or(t.crop,"options.video."),t?.frameRate!==void 0&&(!Number.isFinite(t.frameRate)||t.frameRate<=0))throw new TypeError("options.video.frameRate, when provided, must be a finite positive number.");if(t?.alpha!==void 0&&!["discard","keep"].includes(t.alpha))throw new TypeError("options.video.alpha, when provided, must be either 'discard' or 'keep'.");if(t?.keyFrameInterval!==void 0&&(!Number.isFinite(t.keyFrameInterval)||t.keyFrameInterval<0))throw new TypeError("options.video.keyFrameInterval, when provided, must be a non-negative number.");if(t?.process!==void 0&&typeof t.process!="function")throw new TypeError("options.video.process, when provided, must be a function.");if(t?.processedWidth!==void 0&&(!Number.isInteger(t.processedWidth)||t.processedWidth<=0))throw new TypeError("options.video.processedWidth, when provided, must be a positive integer.");if(t?.processedHeight!==void 0&&(!Number.isInteger(t.processedHeight)||t.processedHeight<=0))throw new TypeError("options.video.processedHeight, when provided, must be a positive integer.");if(t?.hardwareAcceleration!==void 0&&!["no-preference","prefer-hardware","prefer-software"].includes(t.hardwareAcceleration))throw new TypeError("options.video.hardwareAcceleration, when provided, must be 'no-preference', 'prefer-hardware' or 'prefer-software'.");if(t?.group!==void 0&&!(t.group instanceof je||Array.isArray(t.group)&&t.group.every(r=>r instanceof je)))throw new TypeError("options.video.group, when provided, must be an OutputTrackGroup or an array of OutputTrackGroups.")},Xn=t=>{if(!t||typeof t!="object")throw new TypeError("options.audio, when provided, must be an object.");if(t?.discard!==void 0&&typeof t.discard!="boolean")throw new TypeError("options.audio.discard, when provided, must be a boolean.");if(t?.forceTranscode!==void 0&&typeof t.forceTranscode!="boolean")throw new TypeError("options.audio.forceTranscode, when provided, must be a boolean.");if(t?.codec!==void 0&&!Ue.includes(t.codec))throw new TypeError(`options.audio.codec, when provided, must be one of: ${Ue.join(", ")}.`);let e=t?.bitrate;if(t?.quality!==void 0&&!(t.quality instanceof Ee))throw new TypeError("options.audio.quality, when provided, must be a Quality.");if(t?.quality!==void 0&&e!==void 0)throw new TypeError("options.audio.quality and options.audio.bitrate cannot both be provided.");if(e!==void 0&&!(e instanceof Ee)&&(!Number.isInteger(e)||e<=0))throw new TypeError("options.audio.bitrate, when provided, must be a positive integer or a quality.");if(t?.numberOfChannels!==void 0&&(!Number.isInteger(t.numberOfChannels)||t.numberOfChannels<=0))throw new TypeError("options.audio.numberOfChannels, when provided, must be a positive integer.");if(t?.sampleRate!==void 0&&(!Number.isInteger(t.sampleRate)||t.sampleRate<=0))throw new TypeError("options.audio.sampleRate, when provided, must be a positive integer.");if(t?.sampleFormat!==void 0&&!["u8","s16","s32","f32"].includes(t.sampleFormat))throw new TypeError("options.audio.sampleFormat, when provided, must be one of: u8, s16, s32, f32.");if(t?.process!==void 0&&typeof t.process!="function")throw new TypeError("options.audio.process, when provided, must be a function.");if(t?.processedNumberOfChannels!==void 0&&(!Number.isInteger(t.processedNumberOfChannels)||t.processedNumberOfChannels<=0))throw new TypeError("options.audio.processedNumberOfChannels, when provided, must be a positive integer.");if(t?.processedSampleRate!==void 0&&(!Number.isInteger(t.processedSampleRate)||t.processedSampleRate<=0))throw new TypeError("options.audio.processedSampleRate, when provided, must be a positive integer.");if(t?.group!==void 0&&!(t.group instanceof je||Array.isArray(t.group)&&t.group.every(r=>r instanceof je)))throw new TypeError("options.audio.group, when provided, must be an OutputTrackGroup or an array of OutputTrackGroups.")},uo=2,fo=48e3,Mi=class t{get state(){return this._state}static async init(e){let r=new t(e);return await r._init(),r}constructor(e){if(this._state="idle",this._timestampOffset=0,this._timestampOffsetAdjusted=!1,this._copyTimestampPossible=new Map,this._copyStartPackets=new Map,this._nextOutputTrackId=0,this._outputTrackIds=[],this._outputOwnTrackGroups=[],this._trackPumps=[],this._composable=!1,this._executed=!1,this._executionUntil=1/0,this._pauseRequested=!1,this._synchronizer=new ho(this),this._totalDuration=null,this._maxTimestamps=new Map,this.onProgress=void 0,this._computeProgress=!1,this._lastProgress=0,this.isValid=!1,this.utilizedTracks=[],this.discardedTracks=[],!e||typeof e!="object")throw new TypeError("options must be an object.");if(!(e.input instanceof dr))throw new TypeError("options.input must be an Input.");if(!(e.output instanceof Yt))throw new TypeError("options.output must be an Output.");if(e.tracks!==void 0&&e.tracks!=="all"&&e.tracks!=="primary")throw new TypeError("options.tracks, when provided, must be either 'all' or 'primary'.");if(e.composable!==void 0&&typeof e.composable!="boolean")throw new TypeError("options.composable, when provided, must be a boolean.");if(e.copy!==void 0&&e.copy!==!1){if(!e.copy||typeof e.copy!="object")throw new TypeError("options.copy, when provided, must be an object or false.");if(e.copy.mode!==void 0&&!["forced","preferred"].includes(e.copy.mode))throw new TypeError("options.copy.mode, when provided, must be 'forced' or 'preferred'.");if(e.copy.shiftTolerance!==void 0&&(!et(e.copy.shiftTolerance)||e.copy.shiftTolerance<0))throw new TypeError("options.copy.shiftTolerance, when provided, must be a non-negative number.");if(e.copy.boundaryPolicy!==void 0&&!["expand","shrink"].includes(e.copy.boundaryPolicy))throw new TypeError("options.copy.boundaryPolicy, when provided, must be 'expand' or 'shrink'.")}let r=e.composable??!1;if(r){if(e.tags!==void 0)throw new TypeError("options.tags cannot be set by a composable conversion; set metadata directly on the output instead.");if(e.output.state!=="pending")throw new TypeError("options.output must not have been started yet.")}else if(e.output.tracks.length>0||Object.keys(e.output._metadataTags).length>0||e.output.state!=="pending")throw new TypeError("options.output must be fresh: no tracks or metadata tags added and not started.");if(e.video!==void 0&&typeof e.video!="function")if(Array.isArray(e.video))for(let i of e.video)$n(i);else $n(e.video);if(e.audio!==void 0&&typeof e.audio!="function")if(Array.isArray(e.audio))for(let i of e.audio)Xn(i);else Xn(e.audio);if(e.trim!==void 0&&(!e.trim||typeof e.trim!="object"))throw new TypeError("options.trim, when provided, must be an object.");if(e.trim?.start!==void 0&&!Number.isFinite(e.trim.start))throw new TypeError("options.trim.start, when provided, must be a finite number.");if(e.trim?.end!==void 0&&!et(e.trim.end))throw new TypeError("options.trim.end, when provided, must be a number.");if(e.trim?.start!==void 0&&e.trim.end!==void 0&&e.trim.start>=e.trim.end)throw new TypeError("options.trim.start must be less than options.trim.end.");if(e.tags!==void 0&&(typeof e.tags!="object"||!e.tags)&&typeof e.tags!="function")throw new TypeError("options.tags, when provided, must be an object or a function.");if(typeof e.tags=="object"&&ti(e.tags),e.showWarnings!==void 0&&typeof e.showWarnings!="boolean")throw new TypeError("options.showWarnings, when provided, must be a boolean.");this._options=e,this._copyMode=e.copy===!1?!1:e.copy?.mode??"preferred",this._copyTimestampShiftTolerance=e.copy===!1?0:e.copy?.shiftTolerance??0,this._copyBoundaryPolicy=e.copy===!1?"expand":e.copy?.boundaryPolicy??"expand",this._composable=r,this.input=e.input,this.output=e.output;}async _init(){let e=await this.input.getFormat(),r,i=this._options.tracks;if(i===void 0&&(i=e.name.includes("(HLS)")?"primary":"all"),i==="all")r=await this.input.getTracks();else if(i==="primary"){let u=await this.input.getPrimaryVideoTrack(),l=await this.input.getPrimaryAudioTrack();r=[u,l].filter(d=>d!==null);}else ve(i),g(!1);let n=this.output.format.getSupportedTrackCounts(),s=1,o=1,a=[],c=[];for(let u of r){let l;if(u.isVideoTrack())if(this._options.video)if(typeof this._options.video=="function"){let m=await this._options.video(u,s)??{};if(Array.isArray(m))for(let p of m)$n(p);else $n(m);l=Array.isArray(m)?m:[m],s++;}else l=Array.isArray(this._options.video)?this._options.video:[this._options.video];else l=[{}];else if(u.isAudioTrack())if(this._options.audio)if(typeof this._options.audio=="function"){let m=await this._options.audio(u,o)??{};if(Array.isArray(m))for(let p of m)Xn(p);else Xn(m);l=Array.isArray(m)?m:[m],o++;}else l=Array.isArray(this._options.audio)?this._options.audio:[this._options.audio];else l=[{}];else g(!1);let d=l.filter(m=>m.discard);for(let m of d)this.discardedTracks.push({track:u,reason:"discarded_by_user",trackOptions:m});if(l.length===d.length){l.length===0&&this.discardedTracks.push({track:u,reason:"discarded_by_user",trackOptions:{}});continue}let f=l.filter(m=>!m.discard);a.push(u),c.push(f);}this._options.trim?.start!==void 0?this._startTimestamp=this._options.trim.start:this._startTimestamp=Math.max(await this.input.getFirstTimestamp(a),0),this._endTimestamp=Math.max(this._options.trim?.end??1/0,this._startTimestamp),this._timestampOffset=-this._startTimestamp;for(let u=0;u<a.length;u++){let l=a[u],d=c[u];for(let f of d){if(this.output.tracks.length===n.total.max){this.discardedTracks.push({track:l,reason:"max_track_count_reached",trackOptions:f});continue}if(this.output.tracks.reduce((b,y)=>b+(y.type===l.type?1:0),0)===n[l.type].max){this.discardedTracks.push({track:l,reason:"max_track_count_of_type_reached",trackOptions:f});continue}let p=this._nextOutputTrackId++;l.isVideoTrack()?await this._processVideoTrack(l,f,p):l.isAudioTrack()?await this._processAudioTrack(l,f,p):g(!1);}}for(let u=0;u<this.utilizedTracks.length-1;u++)for(let l=u+1;l<this.utilizedTracks.length;l++){let d=this.utilizedTracks[u],f=this.utilizedTracks[l],m=this._outputOwnTrackGroups[u],p=this._outputOwnTrackGroups[l];g(m!==void 0),g(p!==void 0),m&&p&&d.canBePairedWith(f)&&m.pairWith(p);}if(!this._composable){let u=await this.input.getMetadataTags(),l;if(this._options.tags){let m=typeof this._options.tags=="function"?await this._options.tags(u):this._options.tags;ti(m),l=m;}else l=u;let d=e.mimeType===this.output.format.mimeType;u.raw===l.raw&&!d&&delete l.raw,this.output.setMetadataTags(l);}if(this._composable?this.isValid=!0:this.isValid=this.output.hasEnoughTracks()&&this.output.tracks.length>0,this._options.showWarnings??!0){let u=[],l=this.discardedTracks.filter(d=>d.reason!=="discarded_by_user");l.length>0&&u.push("Some tracks had to be discarded from the conversion:",l),this.isValid||(u.length>0&&u.push(`

`),u.push(this._getInvalidityExplanation().join(""))),u.length>0&&$._warn(...u);}}_getInvalidityExplanation(){let e=[];if(this.discardedTracks.length===0)e.push("Due to missing tracks, this conversion cannot be executed.");else {let r=this.discardedTracks.every(i=>i.reason==="discarded_by_user"||i.reason==="no_encodable_target_codec")&&this.discardedTracks.some(i=>i.reason==="no_encodable_target_codec");if(e.push("Due to discarded tracks, this conversion cannot be executed."),r){let i=this.discardedTracks.flatMap(s=>{if(s.reason==="discarded_by_user")return [];let o;return s.track.type==="video"?o=this.output.format.getSupportedVideoCodecs():s.track.type==="audio"?o=this.output.format.getSupportedAudioCodecs():o=this.output.format.getSupportedSubtitleCodecs(),o.filter(a=>!s.trackOptions.codec||a===s.trackOptions.codec)}),n=[...new Set(i)];n.length===1?e.push(`
Tracks were discarded because your environment is not able to encode '${n[0]}' with the provided parameters.`):e.push(`
Tracks were discarded because your environment is not able to encode any of the codecs ${n.map(s=>`'${s}'`).join(", ")} with the provided parameters.`),n.includes("mp3")&&e.push(`
The @mediabunny/mp3-encoder extension package provides support for encoding MP3.`),n.includes("aac")&&e.push(`
The @mediabunny/aac-encoder extension package provides support for encoding AAC.`),(n.includes("ac3")||n.includes("eac3"))&&e.push(`
The @mediabunny/ac3 extension package provides support for encoding and decoding AC-3/E-AC-3.`),n.includes("flac")&&e.push(`
The @mediabunny/flac-encoder extension package provides support for encoding FLAC.`);}else e.push(`
Check the discardedTracks field for more info.`);}return e}async execute(e={}){if(!e||typeof e!="object")throw new TypeError("options must be an object.");if(e.until!==void 0&&(typeof e.until!="number"||Number.isNaN(e.until)))throw new TypeError("options.until, when provided, must be a number.");if(e.pauseSignal!==void 0&&!(e.pauseSignal instanceof AbortSignal))throw new TypeError("options.pauseSignal, when provided, must be an AbortSignal.");if(!this.isValid)throw new Error(`Cannot execute this conversion because its output configuration is invalid. Make sure to always check the isValid field before executing a conversion.
`+this._getInvalidityExplanation().join(""));if(this._state==="executing")throw new Error("Cannot call execute() while a previous call to execute() is still running.");if(this._state==="canceled")throw new Di;if(this._state==="done")return;if(this._composable&&this.output.state==="pending")throw new Error("A composable conversion requires the output to be started. Call start() on the output before executing the conversion.");this._state="executing",this._executionUntil=e.until??1/0,this._pauseRequested=e.pauseSignal?.aborted??!1;let r=()=>{this._state==="executing"&&(this._pauseRequested=!0,this._synchronizer.resolveAll());};e.pauseSignal?.addEventListener("abort",r);for(let n of this._trackPumps)n.done||(n.resolvers=we());if(this._executed)for(let n of this._trackPumps)n.wake?.();else {this._executed=!0;for(let n of this._outputTrackIds)this._synchronizer.declareTrack(n);if(this.onProgress){let s=[...new Set(this.utilizedTracks)].map(async a=>await a.isLive()?1/0:await a.getDurationFromMetadata()??await a.computeDuration()),o=Math.max(0,...await Promise.all(s));this._computeProgress=!0,this._totalDuration=Math.min(o-this._startTimestamp,this._endTimestamp-this._startTimestamp);for(let a of this._outputTrackIds)this._maxTimestamps.set(a,0);this.onProgress?.(0,0);}this._composable||await this.output.start();for(let n of this._trackPumps)n.start();}try{await Promise.all(this._trackPumps.map(n=>n.resolvers.promise));}catch(n){throw this._state!=="canceled"&&this.cancel(),n}finally{e.pauseSignal?.removeEventListener("abort",r);}if(this._state==="canceled")throw new Di;let i=this._trackPumps.every(n=>n.done);if(this._state=i?"done":"idle",i&&(this._composable||await this.output.finalize(),this._computeProgress)){let n=Math.min(...this._maxTimestamps.values());this.onProgress?.(1,n);}}async cancel(){if(this._state!=="done"){if(this._state==="canceled"){$._warn("Conversion already canceled.");return}this._state="canceled";for(let e of this._trackPumps)e.wake?.();this._synchronizer.resolveAll(),this._composable||await this.output.cancel();}}async _processVideoTrack(e,r,i){let n=await e.getCodec();if(!n){this.discardedTracks.push({track:e,reason:"unknown_source_codec",trackOptions:r});return}let s,o=await e.getRotation(),a=kt(o+(r.rotate??0)),c=a,u=this.output.format.supportsVideoRotationMetadata&&(r.allowRotationMetadata??!0),l=await e.getSquarePixelWidth(),d=await e.getSquarePixelHeight(),[f,m]=a%180===0?[l,d]:[d,l],p=r.crop;p&&(p=xi(p,f,m));let[b,y]=p?[p.width,p.height]:[f,m],w=b,T=y,A=w/T;r.width!==void 0&&r.height===void 0?(w=tr(r.width),T=tr(Math.round(w/A))):r.width===void 0&&r.height!==void 0?(T=tr(r.height),w=tr(Math.round(T*A))):r.width!==void 0&&r.height!==void 0&&(w=tr(r.width),T=tr(r.height));let E=this.output.format.getSupportedVideoCodecs(),P=r.alpha??"discard",I=!this._copyMode||!!r.forceTranscode||!!r.frameRate||r.keyFrameInterval!==void 0||r.process!==void 0||r.quality!==void 0||r.bitrate!==void 0||!E.includes(n)||r.codec&&r.codec!==n||w!==b||T!==y||a!==0&&!u||!!p,v=null;if(!I){let N=new Ze(e),L=await N.getKeyPacket(this._startTimestamp,{verifyKeyPackets:!0})??await N.getFirstKeyPacket({verifyKeyPackets:!0});if(L&&L.timestamp<this._startTimestamp&&L.timestamp+L.duration<=this._startTimestamp&&this._copyBoundaryPolicy==="shrink"&&(L=await N.getNextKeyPacket(L,{verifyKeyPackets:!0})),v=L,L){let ae=this._copyBoundaryPolicy==="shrink"?Math.max(L.timestamp,this._startTimestamp):L.timestamp;if(this.output.format.supportsTimestampedMediaData){if(this.output.format.negativeTimestampSupport!=="full"&&ae<this._startTimestamp){let G=Math.min(this._startTimestamp-ae,this._copyTimestampShiftTolerance);ae+G>=this._startTimestamp||this.output.format.negativeTimestampSupport==="prefer-non-negative"&&this._copyMode==="forced"?this._timestampOffset=Math.max(this._timestampOffset,-this._startTimestamp+G):I=!0;}}else if(this._timestampOffsetAdjusted)ae+this._timestampOffset===0||(I=!0);else {let G=fe(this._startTimestamp-ae,-this._copyTimestampShiftTolerance,this._copyTimestampShiftTolerance);ae+G===this._startTimestamp?(this._timestampOffset=-this._startTimestamp+G,this._timestampOffsetAdjusted=!0):I=!0;}}}if(I&&this._copyMode==="forced"){this.discardedTracks.push({track:e,reason:"cannot_copy",trackOptions:r});return}if(I){if(!await e.canDecode()){this.discardedTracks.push({track:e,reason:"undecodable_source_codec",trackOptions:r});return}r.codec&&(E=E.filter(ne=>ne===r.codec));let L=Gt(r.quality,r.bitrate)??new Ee("high"),ae=await Ka(E,{width:r.process&&r.processedWidth?r.processedWidth:w,height:r.process&&r.processedHeight?r.processedHeight:T,quality:L});if(!ae){this.discardedTracks.push({track:e,reason:"no_encodable_target_codec",trackOptions:r});return}let G={codec:ae,quality:L,keyFrameInterval:r.keyFrameInterval,sizeChangeBehavior:r.fit??"passThrough",alpha:P,hardwareAcceleration:r.hardwareAcceleration,transform:{}};g(G.transform);let ie=w!==b||T!==y||a!==0&&(!u||r.process!==void 0)||!!p||l!==await e.getCodedWidth()||d!==await e.getCodedHeight();if(!ie){let ne={stack:[],error:void 0,hasError:!1};try{let se=new Yt({format:new Zt,target:new Ii}),xe=new Fi(G);se.addVideoTrack(xe),await se.start();let Te=new Ci(e),h=Bi(ne,await Te.getSample(await e.getFirstTimestamp()),!1);if(h)try{await xe.add(h),h.close(),await se.finalize();}catch(x){$._warn("An error occurred when probing encoder support. Falling back to rerender path.",x),se.cancel(),ie=!0,G.transform.force=!0;}else await se.cancel();}catch(se){ne.error=se,ne.hasError=!0;}finally{Gn(ne);}}r.frameRate&&(G.transform.frameRate=r.frameRate),r.process&&(G.transform.process=r.process),ie&&(c=0,G.transform.width=w,G.transform.height=T,G.transform.fit=r.fit??"fill",G.transform.rotate=kt(a-o),G.transform.crop=p,G.transform.alpha=P);let te=null;G.onEncodedSample=ne=>{te=ne.timestamp;};let le=new Fi(G);s=le,this._registerTrackPump(async ne=>{let se=new Ci(e);for await(let xe of se.samples(this._startTimestamp,this._endTimestamp)){let Te={stack:[],error:void 0,hasError:!1};try{let h=Bi(Te,xe,!1);if(this._state==="canceled")break;let x=Math.max(this._startTimestamp,h.timestamp),S=Math.min(this._endTimestamp,h.timestamp+h.duration);if(x>=S)continue;h.setTimestamp(x+this._timestampOffset),h.setDuration(S-x),this._reportProgress(i,h.timestamp+h.duration),await le.add(h),h.close(),te!==null&&(this._synchronizer.shouldWait(i,te)&&await this._synchronizer.wait(te),await this._checkpoint(ne,te));}catch(h){Te.error=h,Te.hasError=!0;}finally{Gn(Te);}}le.close(),this._synchronizer.closeTrack(i);});}else {let N=new Wn(n);s=N,this._registerTrackPump(async L=>{let ae=new Ze(e),ie={decoderConfig:await e.getDecoderConfig()??void 0};if(v)for await(let te of ae.packets(v,void 0,{verifyKeyPackets:!0})){if(this._state==="canceled")break;if(te.timestamp>=this._endTimestamp){if(this._copyBoundaryPolicy==="shrink")break;{let xe=te,Te=!1,h=6;for(let x=0;x<h;x++){let S=await ae.getNextPacket(xe,{metadataOnly:!0});if(!S)break;if(S.timestamp<this._endTimestamp){Te=!0;break}xe=S;}if(!Te)break}}let le=te.timestamp,ne=te.timestamp+te.duration;this._copyBoundaryPolicy==="shrink"&&(le=Math.max(le,this._startTimestamp),ne=Math.min(ne,this._endTimestamp),ne=Math.max(ne,le)),le+=this._timestampOffset,ne+=this._timestampOffset;let se=te.clone({timestamp:le,duration:ne-le,sideData:P==="discard"?{}:te.sideData});this._reportProgress(i,se.timestamp+se.duration),await N.add(se,ie),this._synchronizer.shouldWait(i,se.timestamp)&&await this._synchronizer.wait(se.timestamp),await this._checkpoint(L,se.timestamp);}N.close(),this._synchronizer.closeTrack(i);});}let k=null;!r.group&&!this._composable&&(k=new je);let C=await e.getLanguageCode(),M=await e.getName(),q=await e.getDisposition();this.output.addVideoTrack(s,{frameRate:r.frameRate,languageCode:Ct(C)?C:void 0,name:M??void 0,disposition:q,rotation:c,group:k??r.group}),this.utilizedTracks.push(e),this._outputTrackIds.push(i),this._outputOwnTrackGroups.push(k);}async _processAudioTrack(e,r,i){let n=await e.getCodec();if(!n){this.discardedTracks.push({track:e,reason:"unknown_source_codec",trackOptions:r});return}let s,o=await e.getNumberOfChannels(),a=await e.getSampleRate(),c=r.numberOfChannels??o,u=r.sampleRate??a,l=this.output.format.getSupportedAudioCodecs(),d=!this._copyMode||!!r.forceTranscode||!!r.quality||!!r.bitrate||c!==o||u!==a||!l.includes(n)||!!r.codec&&r.codec!==n||r.process!==void 0||r.sampleFormat!==void 0,f=null;if(!d){let w=new Ze(e),T=await w.getKeyPacket(this._startTimestamp)??await w.getFirstKeyPacket();T&&(this._copyBoundaryPolicy==="shrink"&&T.timestamp<this._startTimestamp||this._copyBoundaryPolicy==="expand"&&T.timestamp+T.duration<=this._startTimestamp)&&(T=await w.getNextKeyPacket(T));let A=It.includes(n)&&n!=="flac";if(T&&this._copyBoundaryPolicy==="expand"&&A){let E=await w.getKeyPacket(T.timestamp-1/await e.getTimeResolution());E&&(T=E);}if(f=T,T)if(this.output.format.supportsTimestampedMediaData){if(this.output.format.negativeTimestampSupport!=="full"&&T.timestamp<this._startTimestamp){let E=Math.min(this._startTimestamp-T.timestamp,this._copyTimestampShiftTolerance);T.timestamp+E>=this._startTimestamp||this.output.format.negativeTimestampSupport==="prefer-non-negative"&&this._copyMode==="forced"?this._timestampOffset=Math.max(this._timestampOffset,-this._startTimestamp+E):d=!0;}}else if(this._timestampOffsetAdjusted)T.timestamp+this._timestampOffset===0||(d=!0);else {let E=fe(this._startTimestamp-T.timestamp,-this._copyTimestampShiftTolerance,this._copyTimestampShiftTolerance);T.timestamp+E===this._startTimestamp?(this._timestampOffset=-this._startTimestamp+E,this._timestampOffsetAdjusted=!0):d=!0;}}if(d&&this._copyMode==="forced"){this.discardedTracks.push({track:e,reason:"cannot_copy",trackOptions:r});return}if(d){if(!await e.canDecode()){this.discardedTracks.push({track:e,reason:"undecodable_source_codec",trackOptions:r});return}let T=null;r.codec&&(l=l.filter(k=>k===r.codec));let A=Gt(r.quality,r.bitrate)??new Ee("high"),E=await Us(l,{numberOfChannels:r.process&&r.processedNumberOfChannels?r.processedNumberOfChannels:c,sampleRate:r.process&&r.processedSampleRate?r.processedSampleRate:u,quality:A});if(!E.some(k=>It.includes(k))&&l.some(k=>It.includes(k))&&(c!==uo||u!==fo)){let C=(await Us(l,{numberOfChannels:uo,sampleRate:fo,quality:A})).find(M=>It.includes(M));C&&(T=C,c=uo,u=fo);}else T=E[0]??null;if(T===null){this.discardedTracks.push({track:e,reason:"no_encodable_target_codec",trackOptions:r});return}let P={codec:T,quality:A,transform:{sampleFormat:r.sampleFormat,process:r.process}};g(P.transform),c!==o&&(P.transform.numberOfChannels=c),u!==a&&(P.transform.sampleRate=u);let I=null;P.onEncodedSample=k=>{I=k.timestamp;};let v=new Ln(P);s=v,this._registerTrackPump(async k=>{let C=null,M=new Mn(e);for await(let q of M.samples(this._startTimestamp,this._endTimestamp)){let N={stack:[],error:void 0,hasError:!1};try{let L=Bi(N,q,!1);if(this._state==="canceled")break;let ae=0,G=L.numberOfFrames;if(L.timestamp<this._startTimestamp&&(ae=Math.round((this._startTimestamp-L.timestamp)*L.sampleRate)),L.timestamp+L.duration>this._endTimestamp&&(G=Math.round((this._endTimestamp-L.timestamp)*L.sampleRate)),ae>=G){L.close();continue}let ie;if(ae>0||G<L.numberOfFrames){let le=L.trim(ae,G);if(L.close(),ie=le,le.numberOfFrames===0){le.close();continue}}else ie=L;let te=Bi(N,ie,!1);if(te.setTimestamp(te.timestamp+this._timestampOffset),C===null&&(C=te.timestamp>0&&!this.output.format.supportsTimestampedMediaData),C){let le={stack:[],error:void 0,hasError:!1};try{let ne=te.timestamp,se=Math.round(ne*a),xe=gt(L.format),Te=new Uint8Array(xe*se*o);(L.format==="u8"||L.format==="u8-planar")&&Te.fill(2**7);let h=Bi(le,new Me({data:Te,format:L.format,numberOfChannels:o,sampleRate:a,timestamp:0}),!1);await this._registerAudioSample(k,h,v,i,()=>I),C=!1;}catch(ne){le.error=ne,le.hasError=!0;}finally{Gn(le);}}await this._registerAudioSample(k,te,v,i,()=>I);}catch(L){N.error=L,N.hasError=!0;}finally{Gn(N);}}v.close(),this._synchronizer.closeTrack(i);});}else {let w=new qn(n);s=w,this._registerTrackPump(async T=>{let A=new Ze(e),P={decoderConfig:await e.getDecoderConfig()??void 0};if(f)for await(let I of A.packets(f)){if(this._state==="canceled"||I.timestamp>=this._endTimestamp||this._copyBoundaryPolicy==="shrink"&&I.timestamp+I.duration>this._endTimestamp)break;let v=I.clone({timestamp:I.timestamp+this._timestampOffset,duration:I.duration});this._reportProgress(i,v.timestamp+v.duration),await w.add(v,P),this._synchronizer.shouldWait(i,v.timestamp)&&await this._synchronizer.wait(v.timestamp),await this._checkpoint(T,v.timestamp);}w.close(),this._synchronizer.closeTrack(i);});}let m=null;!r.group&&!this._composable&&(m=new je);let p=await e.getLanguageCode(),b=await e.getName(),y=await e.getDisposition();this.output.addAudioTrack(s,{languageCode:Ct(p)?p:void 0,name:b??void 0,disposition:y,group:m??r.group}),this.utilizedTracks.push(e),this._outputTrackIds.push(i),this._outputOwnTrackGroups.push(m);}async _registerAudioSample(e,r,i,n,s){this._reportProgress(n,r.timestamp+r.duration),await i.add(r),r.close();let o=s();o!==null&&(this._synchronizer.shouldWait(n,o)&&await this._synchronizer.wait(o),await this._checkpoint(e,o));}_registerTrackPump(e){let r={done:!1,resolvers:we(),wake:null,start:()=>{e(r).then(()=>{r.done=!0,r.resolvers.resolve();},i=>{r.resolvers.reject(i);});}};this._trackPumps.push(r);}async _checkpoint(e,r){for(;this._state!=="canceled"&&(r>=this._executionUntil||this._pauseRequested);){e.resolvers.resolve();let{promise:i,resolve:n}=we();e.wake=n,await i;}}_reportProgress(e,r){if(!this._computeProgress)return;g(this._totalDuration!==null),this._maxTimestamps.set(e,Math.max(r,this._maxTimestamps.get(e)));let i=Math.min(...this._maxTimestamps.values()),n=fe(i/this._totalDuration,0,1);n!==this._lastProgress&&(this._lastProgress=n,this.onProgress?.(n,i));}},Di=class extends Error{constructor(e="Conversion has been canceled."){super(e),this.name="ConversionCanceledError";}},Ac=1,ho=class{constructor(e){this.maxTimestamps=new Map,this.resolvers=[],this.conversion=e;}declareTrack(e){this.maxTimestamps.set(e,-1/0);}shouldWait(e,r){let i=this.maxTimestamps.get(e);g(i!==void 0),this.maxTimestamps.set(e,Math.max(r,i));let n=this.computeMinAndMaybeResolve();return this.conversion._state==="canceled"||this.conversion._pauseRequested||r>=this.conversion._executionUntil?!1:r-n>Ac}wait(e){let{promise:r,resolve:i}=we();return this.resolvers.push({timestamp:e,resolve:i}),r}closeTrack(e){this.maxTimestamps.delete(e),this.computeMinAndMaybeResolve();}resolveAll(){for(let e of this.resolvers)e.resolve();this.resolvers.length=0;}computeMinAndMaybeResolve(){let e=1/0;for(let[,r]of this.maxTimestamps)e=Math.min(e,r);for(let r=0;r<this.resolvers.length;r++){let i=this.resolvers[r];i.timestamp-e<Ac&&(i.resolve(),this.resolvers.splice(r,1),r--);}return e}};var kc=Symbol.for("mediabunny loaded");globalThis[kc]&&$._error(`[WARNING]
Mediabunny was loaded twice. This will likely cause Mediabunny not to work correctly. Check if multiple dependencies are importing different versions of Mediabunny, or if something is being bundled incorrectly.`);globalThis[kc]=!0;return Pc($u);})();
    } catch (e) {
      console.error('YTEE: Mediabunny failed to initialize', e);
      __ytee_mediabunnyFailed = true;
      return null;
    }
    return Mediabunny;
  };
  // ==[/Mediabunny end]==

  const gmOrFetch = ({ method, url, headers = {}, data, credentials = 'same-origin' }) => {
    const viaFetch = () => fetch(url, { method, headers, body: data, credentials })
      .then((res) => res.text().then((text) => ({ status: res.status, text })));

    const viaGM = () => new Promise((resolve, reject) => {
      let settled = false;
      const ok = (v) => { if (!settled) { settled = true; clearTimeout(to); resolve(v); } };
      const bad = (e) => { if (!settled) { settled = true; clearTimeout(to); reject(e); } };
      const to = setTimeout(() => bad(new Error('GM_xmlhttpRequest timed out')), 15000);
      try {
        const ret = GM_xmlhttpRequest({
          method, url, headers, data,
          onload: (r) => ok({ status: r.status, text: r.responseText }),
          onerror: () => bad(new Error('GM_xmlhttpRequest network error')),
          ontimeout: () => bad(new Error('GM_xmlhttpRequest timed out')),
        });
        if (ret && typeof ret.then === 'function') ret.catch(bad);
      } catch (e) { bad(e); }
    });

    if (typeof GM_xmlhttpRequest === 'function') {
      return viaGM().catch((e) => { yteeWarn('YTEE: request via GM failed, trying fetch', e); return viaFetch(); });
    }
    return viaFetch();
  };

  const createGistSync = ({ getSettings, onBackgroundSynced }) => {

    const gistRequest = (method, gistId, token, bodyObj) => {
      const body = bodyObj ? JSON.stringify(bodyObj) : undefined;
      const headers = { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json' };
      if (body) headers['Content-Type'] = 'application/json';
      return gmOrFetch({ method, url: `https://api.github.com/gists/${gistId}`, headers, data: body });
    };

    const syncGist = (onDone) => {
      const currentSettings = getSettings();
      const token = currentSettings.gistToken;
      const gistId = currentSettings.gistId;
      if (!token || !gistId) { if (onDone) onDone('error'); return; }

      const pushToGist = () => {
        gistRequest('PATCH', gistId, token, {
          files: {
            'ytee-history.json': {
              content: JSON.stringify({
                ytee_history_export: true,
                volumeCache: currentSettings.volumeCache,
                positionCache: currentSettings.positionCache,
                miniStatsCache: currentSettings.miniStatsCache,
                favoritesCache: currentSettings.favoritesCache,
                annotationsCache: currentSettings.annotationsCache
              }, null, 2)
            }
          }
        }).then((pr) => {
          if (pr.status === 200 || pr.status === 201) {
            currentSettings.gistSyncLastTime = Date.now();
            saveStoredSettings(currentSettings, { immediate: true });
            if (onDone) onDone('success');
          } else { if (onDone) onDone('error'); }
        }).catch(() => { if (onDone) onDone('error'); });
      };

      gistRequest('GET', gistId, token).then((r) => {
        if (r.status === 404) { pushToGist(); return; }
        if (r.status !== 200) { if (onDone) onDone('error'); return; }
        try {
          const gistData = JSON.parse(r.text);
          const file = gistData.files?.['ytee-history.json'];
          if (file?.content) {
            const remote = JSON.parse(file.content);
            const mergeCache = (local, rem) => {
              const merged = Object.assign({}, local);
              for (const vid in rem) {
                const rt = rem[vid]?.t || 0;
                const lt = local[vid]?.t || 0;
                if (rt > lt) merged[vid] = rem[vid];
              }
              return merged;
            };
            if (remote.volumeCache) currentSettings.volumeCache = mergeCache(currentSettings.volumeCache, remote.volumeCache);
            if (remote.positionCache) currentSettings.positionCache = mergeCache(currentSettings.positionCache, remote.positionCache);
            if (remote.miniStatsCache) currentSettings.miniStatsCache = mergeCache(currentSettings.miniStatsCache, remote.miniStatsCache);
            if (remote.favoritesCache) currentSettings.favoritesCache = mergeCache(currentSettings.favoritesCache, remote.favoritesCache);
            if (remote.annotationsCache && typeof remote.annotationsCache === 'object') {
              const rem = parseAnnotationsCache(remote.annotationsCache);
              const loc = currentSettings.annotationsCache || {};
              for (const vid in rem) {
                const r2 = rem[vid], l = loc[vid];
                if (!l) { loc[vid] = r2; continue; }
                const markMap = new Map();
                [...l.marks, ...r2.marks].forEach(m => {
                  const prev = markMap.get(m.s);
                  if (!prev || (m.label && m.label.length > prev.label.length)) markMap.set(m.s, m);
                });
                loc[vid] = {
                  marks: [...markMap.values()].sort((a, b) => a.s - b.s).slice(0, ANNOT_MARKS_MAX),
                  title: l.title || r2.title, channel: l.channel || r2.channel,
                  t: Math.max(l.t || 0, r2.t || 0),
                };
              }
              currentSettings.annotationsCache = parseAnnotationsCache(loc);
            }
          }
        } catch (e) { }
        pushToGist();
      }).catch(() => { if (onDone) onDone('error'); });
    };

    const trySyncWithLock = () => {
      const currentSettings = getSettings();
      if (!currentSettings.enableGistSync || !currentSettings.gistToken || !currentSettings.gistId) return;
      const now = Date.now();
      const lock = GM_getValue('ytee-sync-lock', null);
      if (lock && (now - lock) < 30000) return;
      GM_setValue('ytee-sync-lock', now);
      const fresh = loadStoredSettings();
      const intervalMs = (fresh.gistSyncInterval || 180) * 60 * 1000;
      if ((now - (fresh.gistSyncLastTime || 0)) < intervalMs) {
        GM_setValue('ytee-sync-lock', null);
        return;
      }
      syncGist((status) => {
        GM_setValue('ytee-sync-lock', null);
        if (onBackgroundSynced) onBackgroundSynced(status);
      });
    };

    return { gistRequest, syncGist, trySyncWithLock };
  };

  const createHistoryTab = ({
    getSettings, getSettingsModal, isHistoryTabActive, tabContents,
    ensureAnnot, persistAnnot, mkSection, mkNote, mkActionBtn, syncGist,
    setHistoryTabDirty, getHistoryViewMode, setHistoryViewMode,
  }) => {
      let historyRenderTimer = null;
      let historyRenderRaf = 0;
      const scheduleHistoryRender = () => {
        if (!getSettingsModal() || !getSettingsModal().classList.contains('show') || !isHistoryTabActive()) { setHistoryTabDirty(true); return; }
        clearTimeout(historyRenderTimer);
        historyRenderTimer = setTimeout(() => {
          try { renderHistoryTab(); setHistoryTabDirty(false); } catch (e) { }
        }, 500);
      };

      let historySortDescending = true;
      let historyFavOnly = false;
      let historyBookmarkView = false;
      let bookmarkFocusVid = null;
      const bookmarkGroupExpanded = {};
      let pendingRefreshDone = false;

      const updateHistorySortButtonLabel = (button) => {
        button.textContent = historySortDescending ? '\u2193' : '\u2191';
        button.title = historySortDescending ? 'Switch to oldest first' : 'Switch to newest first';
      };

      const renderHistoryTab = () => {
        const currentSettings = getSettings();
        let historyViewMode = getHistoryViewMode();
        const h = tabContents['tab-history'];
        if (!h) return;
        if (historyRenderRaf) { cancelAnimationFrame(historyRenderRaf); historyRenderRaf = 0; }
        while (h.firstChild) h.removeChild(h.firstChild);

        const headerRow = Object.assign(document.createElement('div'), {
          style: 'display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:12px;'
        });
        const mkCtrlBtn = (icon, title) => mkActionBtn('circle', icon, title);

        const refreshBtn = mkCtrlBtn('\u27F3', 'Refresh history list');
        refreshBtn.style.fontSize = '16px';

        if (pendingRefreshDone) {
          pendingRefreshDone = false;
          refreshBtn.textContent = '✓';
          refreshBtn.style.color = '#7ddf7d';
          setTimeout(() => { refreshBtn.textContent = '\u27F3'; refreshBtn.style.color = ''; }, 1200);
        }

        refreshBtn.addEventListener('click', () => {
          if (refreshBtn._spinActive) return;
          refreshBtn._spinActive = true;
          refreshBtn.disabled = true;
          refreshBtn.setAttribute('aria-busy', 'true');
          const spinDuration = 600;
          const start = performance.now();
          let rafId;
          const tick = (ts) => {
            const elapsed = ts - start;
            const angle = (elapsed / spinDuration) * 720;
            refreshBtn.style.transform = `rotate(${angle}deg) scale(0.92)`;
            if (elapsed < spinDuration) rafId = requestAnimationFrame(tick);
            else {
              refreshBtn.style.transform = '';
              refreshBtn.disabled = false;
              refreshBtn.removeAttribute('aria-busy');
              refreshBtn._spinActive = false;
              if (rafId) cancelAnimationFrame(rafId);
            }
          };
          rafId = requestAnimationFrame(tick);
          pendingRefreshDone = true;
          try { renderHistoryTab(); } catch (e) { console.error(e); }
        });

        const sortBtn = mkCtrlBtn(historySortDescending ? '\u2193' : '\u2191', historySortDescending ? 'Switch to oldest first' : 'Switch to newest first');
        sortBtn.addEventListener('click', () => {
          historySortDescending = !historySortDescending;
          updateHistorySortButtonLabel(sortBtn);
          renderHistoryTab();
        });

        const importInput = Object.assign(document.createElement('input'), { type: 'file', accept: '.json', style: 'display:none;' });
        importInput.addEventListener('change', () => {
          const file = importInput.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (ev) => {
            try {
              const data = JSON.parse(ev.target.result);
              if (!data.ytee_history_export) throw new Error('Not a valid YTEE history file');
              if (data.volumeCache) Object.assign(currentSettings.volumeCache, parseCache(data.volumeCache));
              if (data.positionCache) Object.assign(currentSettings.positionCache, parseCache(data.positionCache));
              if (data.miniStatsCache) Object.assign(currentSettings.miniStatsCache, parseCache(data.miniStatsCache));
              if (data.favoritesCache) Object.assign(currentSettings.favoritesCache, parseCache(data.favoritesCache));
              if (data.annotationsCache) Object.assign(currentSettings.annotationsCache, parseAnnotationsCache(data.annotationsCache));
              saveStoredSettings(currentSettings, { immediate: true });
              renderHistoryTab();
              flashBtnState(footerImportBtn, 'success');
            } catch (e) { flashBtnState(footerImportBtn, 'error'); }
          };
          reader.readAsText(file);
          importInput.value = '';
        });

        const controls = Object.assign(document.createElement('div'), { style: 'display:flex; gap:6px; align-items:center;' });

        const favFilterBtn = Object.assign(document.createElement('button'), {
          textContent: '★ Favorites only',
          title: 'Show only favorited videos',
          style: `display:inline-flex; align-items:center; gap:5px; padding:4px 10px; height:28px; font-size:11px; font-weight:600; border-radius:6px; cursor:pointer; flex-shrink:0; transition:background 0.15s, color 0.15s, border-color 0.15s; ${historyFavOnly
            ? 'background:var(--ytee-stats-bg); color:var(--ytee-stats-color); border:1px solid var(--ytee-stats-border);'
            : 'background:transparent; color:rgba(255,255,255,0.5); border:1px solid rgba(255,255,255,0.12);'
          }`
        });
        favFilterBtn.addEventListener('click', () => {
          historyFavOnly = !historyFavOnly;
          renderHistoryTab();
        });

        if (currentSettings.enableGistSync && currentSettings.gistToken && currentSettings.gistId) {
          const syncBtn = Object.assign(document.createElement('button'), {
            title: 'Sync history with GitHub Gist',
            style: 'display:inline-flex; align-items:center; gap:5px; padding:4px 10px; height:28px; font-size:11px; background:rgba(125,222,255,0.1); color:#7ddeff; border:1px solid rgba(125,222,255,0.25); border-radius:5px; cursor:pointer; flex-shrink:0; transition:opacity 0.15s;'
          });
          const syncIcon = Object.assign(document.createElement('span'), { textContent: '\u2601', style: 'font-size:12px;' });
          const syncLabel = Object.assign(document.createElement('span'), { textContent: 'Sync' });
          syncBtn.append(syncIcon, syncLabel);
          syncBtn.addEventListener('click', () => {
            if (syncBtn._syncing) return;
            syncBtn._syncing = true;
            syncLabel.textContent = 'Syncing\u2026';
            syncBtn.style.opacity = '0.6';
            syncGist((status) => {
              syncBtn._syncing = false;
              syncBtn.style.opacity = '';
              if (status === 'success') { syncLabel.textContent = '✓ Synced'; syncBtn.style.color = '#7ddf7d'; syncBtn.style.borderColor = 'rgba(125,223,125,0.25)'; }
              else { syncLabel.textContent = '✗ Failed'; syncBtn.style.color = '#ff5555'; syncBtn.style.borderColor = 'rgba(255,85,85,0.25)'; }
              setTimeout(() => { syncLabel.textContent = 'Sync'; syncBtn.style.color = '#7ddeff'; syncBtn.style.borderColor = 'rgba(125,222,255,0.25)'; }, 2000);
              renderHistoryTab();
            });
          });
          const viewBtnS = mkCtrlBtn(historyViewMode === 'list' ? '\u229E' : '\u2261', historyViewMode === 'list' ? 'Switch to grid view' : 'Switch to list view');
          viewBtnS.addEventListener('click', () => {
            historyViewMode = historyViewMode === 'list' ? 'grid' : 'list';
            setHistoryViewMode(historyViewMode);
            currentSettings.historyViewMode = historyViewMode;
            saveStoredSettings(currentSettings);
            renderHistoryTab();
          });
          controls.append(favFilterBtn, syncBtn, refreshBtn, sortBtn, viewBtnS);
        } else {
          const viewBtnL = mkCtrlBtn(historyViewMode === 'list' ? '\u229E' : '\u2261', historyViewMode === 'list' ? 'Switch to grid view' : 'Switch to list view');
          viewBtnL.addEventListener('click', () => {
            historyViewMode = historyViewMode === 'list' ? 'grid' : 'list';
            setHistoryViewMode(historyViewMode);
            currentSettings.historyViewMode = historyViewMode;
            saveStoredSettings(currentSettings);
            renderHistoryTab();
          });
          controls.append(favFilterBtn, refreshBtn, sortBtn, viewBtnL);
        }

        headerRow.append(mkSection('Saved Video History'), controls);
        h.append(headerRow);

        const subTabs = Object.assign(document.createElement('div'), { style: 'display:inline-flex; gap:2px; padding:3px; background:rgba(0,0,0,0.3); border-radius:8px; margin-bottom:14px;' });
        [['Videos', false], ['Notes', true]].forEach(([label, isBk]) => {
          const b = Object.assign(document.createElement('button'), {
            textContent: label,
            style: `font-size:11.5px; font-weight:600; padding:4px 12px; border:none; border-radius:6px; cursor:pointer; ${historyBookmarkView === isBk ? 'color:#fff; background:rgba(255,255,255,0.09);' : 'color:rgba(255,255,255,0.45); background:transparent;'}`
          });
          b.addEventListener('click', () => {
            if (historyBookmarkView === isBk && !(isBk && bookmarkFocusVid)) return;
            historyBookmarkView = isBk;
            bookmarkFocusVid = null;
            renderHistoryTab();
          });
          subTabs.append(b);
        });
        h.append(subTabs);

        if (currentSettings.enableGistSync && currentSettings.gistSyncLastTime > 0) {
          const lastSyncedRow = Object.assign(document.createElement('div'), {
            style: 'font-size:10px; color:rgba(255,255,255,0.3); margin-top:-6px; margin-bottom:10px;'
          });
          const d = new Date(currentSettings.gistSyncLastTime);
          const diffMs = Date.now() - d;
          const diffMins = Math.floor(diffMs / 60000);
          const diffHrs = Math.floor(diffMs / 3600000);
          const timeStr = diffMins < 1 ? 'just now' : diffMins < 60 ? `${diffMins}m ago` : diffHrs < 24 ? `${diffHrs}h ago` : d.toLocaleDateString();
          const syncedSpan = Object.assign(document.createElement('span'), { textContent: timeStr, style: 'color:#7ddf7d;' });
          lastSyncedRow.append(document.createTextNode('Last synced: '), syncedSpan);
          h.append(lastSyncedRow);
        }

        const allVids = [...new Set([
          ...Object.keys(currentSettings.volumeCache || {}),
          ...Object.keys(currentSettings.positionCache || {}),
          ...Object.keys(currentSettings.miniStatsCache || {}),
          ...Object.keys(currentSettings.favoritesCache || {}).filter(vid => currentSettings.favoritesCache[vid]?.v),
          ...Object.keys(currentSettings.annotationsCache || {})
        ])];

        if (allVids.length === 0) { h.append(mkNote('No history saved yet.')); return; }

        const isFavorited = (vid) => !!(currentSettings.favoritesCache[vid] && currentSettings.favoritesCache[vid].v);

        const getTimestamp = (vid) => {
          const volObj = currentSettings.volumeCache[vid];
          const posObj = currentSettings.positionCache[vid];
          const msObj = currentSettings.miniStatsCache[vid];
          const favObj = currentSettings.favoritesCache[vid];
          const annObj = currentSettings.annotationsCache[vid];
          return Math.max(
            volObj && volObj.t ? volObj.t : 0,
            posObj && posObj.t ? posObj.t : 0,
            msObj && msObj.t ? msObj.t : 0,
            favObj && favObj.t ? favObj.t : 0,
            annObj && annObj.t ? annObj.t : 0
          );
        };

        const tsByVid = new Map(allVids.map(v => [v, getTimestamp(v)]));
        allVids.sort((a, b) => historySortDescending ? tsByVid.get(b) - tsByVid.get(a) : tsByVid.get(a) - tsByVid.get(b));

        const getDateLabel = (timestamp) => {
          if (!timestamp) return null;
          const date = new Date(timestamp);
          const now = new Date();
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const itemDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
          const diffDays = Math.round((today - itemDate) / 86400000);
          if (diffDays === 0) return 'Today';
          if (diffDays === 1) return 'Yesterday';
          return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        };
        const mkDateSeparator = (label) => {
          const sep = Object.assign(document.createElement('div'), {
            style: 'display:flex; align-items:center; gap:10px; margin:10px 0 4px; padding:0 2px;'
          });
          const mkLine = () => Object.assign(document.createElement('div'), { style: 'flex:1; height:1px; background:rgba(255,255,255,0.15);' });
          const text = Object.assign(document.createElement('span'), {
            textContent: label,
            style: 'font-size:10px; color:rgba(255,255,255,0.4); white-space:nowrap; text-transform:uppercase; letter-spacing:0.06em;'
          });
          sep.append(mkLine(), text, mkLine());
          return sep;
        };
        let lastDateLabel = null;

        const bookmarkCount = (vid) => {
          const a = currentSettings.annotationsCache[vid];
          return a && a.marks ? a.marks.length : 0;
        };

        const mkBookmarkBadge = (vid) => {
          const n = bookmarkCount(vid);
          if (!n) return null;
          const b = Object.assign(document.createElement('span'), {
            textContent: '🔖 ' + n,
            title: n + ' note' + (n === 1 ? '' : 's') + ' — jump to this video’s notes',
            style: 'font-size:9.5px; color:rgba(245,181,61,0.9); background:rgba(245,181,61,0.12); border:1px solid rgba(245,181,61,0.3); border-radius:4px; padding:1px 6px; white-space:nowrap; cursor:pointer;'
          });
          b.addEventListener('click', (e) => {
            e.stopPropagation();
            historyBookmarkView = true;
            bookmarkFocusVid = vid;
            bookmarkGroupExpanded[vid] = true;
            renderHistoryTab();
          });
          return b;
        };

        const buildBookmarkGroup = (vid) => {
          const a0 = currentSettings.annotationsCache[vid];
          if (!a0 || !a0.marks.length) return null;
          const titleText = a0.title || currentSettings.volumeCache[vid]?.title || currentSettings.positionCache[vid]?.title
            || currentSettings.favoritesCache[vid]?.title || vid;
          const grp = Object.assign(document.createElement('div'), { style: 'margin-bottom:14px;' });
          const rerender = () => { const n = buildBookmarkGroup(vid); if (n) grp.replaceWith(n); else grp.remove(); };

          const head = Object.assign(document.createElement('div'), {
            style: 'display:flex; align-items:center; flex-wrap:wrap; gap:6px; font-size:12px; font-weight:600; padding:6px 4px; border-bottom:1px solid rgba(255,255,255,0.1); margin-bottom:4px;'
          });
          const miniThumb = Object.assign(document.createElement('img'), {
            src: `https://img.youtube.com/vi/${vid}/mqdefault.jpg`, alt: '', width: 40, height: 22, loading: 'lazy',
            style: 'width:40px; height:22px; border-radius:3px; object-fit:cover; flex-shrink:0;'
          });
          miniThumb.addEventListener('error', () => { miniThumb.style.display = 'none'; });
          const titleLink = Object.assign(document.createElement('span'), {
            textContent: titleText, title: 'Open on YouTube',
            style: 'flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; cursor:pointer; color:rgba(255,255,255,0.9);'
          });
          titleLink.addEventListener('click', () => window.open(`https://youtu.be/${vid}`, '_blank'));
          const cnt = Object.assign(document.createElement('span'), {
            textContent: a0.marks.length,
            style: 'font:600 10px ui-monospace,monospace; color:#f5b53d; background:rgba(245,181,61,0.12); border:1px solid rgba(245,181,61,0.3); border-radius:4px; padding:0 5px;'
          });
          const marks = a0.marks.slice().sort((x, y) => x.s - y.s);
          const focused = bookmarkFocusVid === vid;
          const expanded = focused || !!bookmarkGroupExpanded[vid];

          const toggleBtn = mkActionBtn('strip', (expanded ? '▼ ' : '▶ ') + (expanded ? 'Hide' : 'Show'), expanded ? 'Collapse this video' : 'Expand this video');
          toggleBtn.style.marginLeft = 'auto';
          const chapBtn = mkActionBtn('strip', 'Copy as chapters', 'Copy timestamped lines to clipboard');
          chapBtn.addEventListener('click', () => {
            const text = marks.map(m => `${formatClock(m.s)} ${m.label || 'Untitled mark'}`).join('\n');
            navigator.clipboard.writeText(text).then(() => flashBtnState(chapBtn, 'success')).catch(() => flashBtnState(chapBtn, 'error'));
          });
          const delAllBtn = mkActionBtn('strip', 'Delete all', 'Delete every note for this video', 'rgba(255,80,80,0.7)');
          delAllBtn.style.borderColor = 'rgba(255,80,80,0.2)';
          delAllBtn.addEventListener('mouseenter', () => { delAllBtn.style.background = 'rgba(255,50,50,0.15)'; delAllBtn.style.color = '#ff5555'; });
          delAllBtn.addEventListener('mouseleave', () => { delAllBtn.style.background = 'rgba(255,255,255,0.07)'; delAllBtn.style.color = 'rgba(255,80,80,0.7)'; });
          delAllBtn.addEventListener('click', () => {
            if (delAllBtn.dataset.confirm !== '1') {
              delAllBtn.dataset.confirm = '1';
              delAllBtn.textContent = 'Confirm?';
              setTimeout(() => { if (delAllBtn.isConnected) { delAllBtn.dataset.confirm = '0'; delAllBtn.textContent = 'Delete all'; } }, 3000);
              return;
            }
            delete currentSettings.annotationsCache[vid];
            delete bookmarkGroupExpanded[vid];
            persistAnnot(vid);
            renderHistoryTab();
          });
          if (focused) {
            chapBtn.style.marginLeft = 'auto';
            head.append(miniThumb, titleLink, cnt, chapBtn, delAllBtn);
          } else {
            head.append(miniThumb, titleLink, cnt, toggleBtn, chapBtn, delAllBtn);
          }
          grp.append(head);

          titleLink.style.cursor = 'pointer';
          const setExpanded = (v) => {
            bookmarkGroupExpanded[vid] = v;
            rerender();
          };
          if (!focused) {
            head.style.cursor = 'pointer';
            toggleBtn.addEventListener('click', (e) => { e.stopPropagation(); setExpanded(!expanded); });
            head.addEventListener('click', (e) => {
              if (e.target === head || e.target === miniThumb || e.target === cnt) setExpanded(!expanded);
            });
          } else {
            head.style.cursor = 'default';
          }

          if (!expanded) return grp;

          marks.forEach((mk) => {
            const row = Object.assign(document.createElement('div'), {
              className: 'ytee-bkmk-row',
              style: 'display:grid; grid-template-columns:auto 1fr auto auto; gap:10px; align-items:center; padding:5px 8px; border-radius:6px; font-size:12px;'
            });
            const ts = Object.assign(document.createElement('span'), {
              textContent: formatClock(mk.s), title: 'Open at this time',
              style: 'font:500 11px ui-monospace,monospace; color:#f5b53d; cursor:pointer;'
            });
            ts.addEventListener('click', () => window.open(`https://youtu.be/${vid}?t=${mk.s}`, '_blank'));
            const lbl = Object.assign(document.createElement('span'), {
              textContent: mk.label || 'Untitled mark', title: 'Click to rename',
              style: `overflow:hidden; text-overflow:ellipsis; white-space:nowrap; cursor:pointer; ${mk.label ? 'color:rgba(255,255,255,0.85);' : 'color:rgba(255,255,255,0.4); font-style:italic;'}`
            });
            lbl.addEventListener('click', () => {
              const inp = Object.assign(document.createElement('input'), {
                value: mk.label, maxLength: ANNOT_LABEL_MAX,
                style: 'font:inherit; width:100%; background:rgba(255,255,255,0.1); border:1px solid #f5b53d; border-radius:4px; color:#fff; padding:2px 5px;'
              });
              lbl.replaceWith(inp); inp.focus(); inp.select();
              const commit = () => { mk.label = inp.value.trim().slice(0, ANNOT_LABEL_MAX); persistAnnot(vid); rerender(); };
              inp.addEventListener('blur', commit);
              inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); inp.blur(); } else if (e.key === 'Escape') rerender(); });
            });
            const copyMk = Object.assign(document.createElement('button'), { textContent: '🔗', title: 'Copy link at this time', style: 'background:none; border:none; cursor:pointer; color:rgba(255,255,255,0.45); font-size:11px; padding:2px 3px;' });
            copyMk.addEventListener('click', () => { navigator.clipboard.writeText(`https://youtu.be/${vid}?t=${mk.s}`).then(() => flashBtnState(copyMk, 'success')).catch(() => { }); });
            const delMk = Object.assign(document.createElement('button'), { textContent: '✕', title: 'Delete note', style: 'background:none; border:none; cursor:pointer; color:rgba(255,255,255,0.4); font-size:11px; padding:2px 3px;' });
            delMk.addEventListener('click', () => {
              const cur = ensureAnnot(vid);
              cur.marks = cur.marks.filter(m => m !== mk);
              persistAnnot(vid);
              if (cur.marks.length === 0) renderHistoryTab();
              else rerender();
            });
            row.append(ts, lbl, copyMk, delMk);
            grp.append(row);
          });
          return grp;
        };

        const renderBookmarksView = () => {
          if (bookmarkFocusVid && bookmarkCount(bookmarkFocusVid) === 0) bookmarkFocusVid = null;
          if (bookmarkFocusVid) {
            const backBtn = mkActionBtn('strip', '← All notes', 'Show notes for every video');
            backBtn.style.marginBottom = '10px';
            backBtn.addEventListener('click', () => { bookmarkFocusVid = null; renderHistoryTab(); });
            h.append(backBtn);
            bookmarkGroupExpanded[bookmarkFocusVid] = true;
            const g = buildBookmarkGroup(bookmarkFocusVid);
            if (g) h.append(g);
            return;
          }
          const withMarks = allVids.filter(vid => bookmarkCount(vid) > 0);
          if (withMarks.length === 0) {
            h.append(mkNote('No notes yet — press 🔖 (or the Add Note hotkey) while watching to drop one.'));
            return;
          }
          const anyExpanded = withMarks.some(vid => bookmarkGroupExpanded[vid]);
          const bulkBtn = mkActionBtn('strip', anyExpanded ? 'Collapse all' : 'Expand all', 'Toggle every video group');
          bulkBtn.style.marginBottom = '10px';
          bulkBtn.addEventListener('click', () => {
            withMarks.forEach(vid => { bookmarkGroupExpanded[vid] = !anyExpanded; });
            renderHistoryTab();
          });
          h.append(bulkBtn);
          withMarks.forEach(vid => {
            const g = buildBookmarkGroup(vid);
            if (g) h.append(g);
          });
        };

        if (historyBookmarkView) { renderBookmarksView(); return; }

        let currentGridContainer = null;
        const flushGridContainer = () => {
          if (currentGridContainer && currentGridContainer.children.length > 0) {
            h.append(currentGridContainer);
            currentGridContainer = null;
          }
        };
        const getGridContainer = () => {
          if (!currentGridContainer) {
            currentGridContainer = Object.assign(document.createElement('div'), {
              style: 'display:grid; grid-template-columns:repeat(auto-fill,minmax(clamp(150px,calc(var(--ytee-ew)*0.22),220px),1fr)); gap:10px; margin-bottom:8px;'
            });
          }
          return currentGridContainer;
        };

        const buildCard = (vid) => {
          const cardRef = { el: null };
          let titleText = "";
          const volObj = currentSettings.volumeCache[vid];
          const posObj = currentSettings.positionCache[vid];
          const msObj = currentSettings.miniStatsCache[vid];
          const favObj = currentSettings.favoritesCache[vid];
          const annObj = currentSettings.annotationsCache[vid];

          if (volObj && typeof volObj === 'object' && volObj.title) titleText = volObj.title;
          else if (posObj && typeof posObj === 'object' && posObj.title) titleText = posObj.title;
          else if (msObj && typeof msObj === 'object' && msObj.title) titleText = msObj.title;
          else if (favObj && typeof favObj === 'object' && favObj.title) titleText = favObj.title;
          else if (annObj && annObj.title) titleText = annObj.title;
          if (!titleText) titleText = vid;

          let channelText = "";
          if (volObj && typeof volObj === 'object' && volObj.channel) channelText = volObj.channel;
          else if (posObj && typeof posObj === 'object' && posObj.channel) channelText = posObj.channel;
          else if (msObj && typeof msObj === 'object' && msObj.channel) channelText = msObj.channel;
          else if (favObj && typeof favObj === 'object' && favObj.channel) channelText = favObj.channel;
          else if (annObj && annObj.channel) channelText = annObj.channel;

          const savedParts = [];
          if (volObj !== undefined) {
            const volVal = typeof volObj === 'object' ? volObj.v : volObj;
            savedParts.push(`Volume: ${Math.round(volVal * 100)}%`);
          }
          if (posObj !== undefined) {
            const posVal = typeof posObj === 'object' ? posObj.v : posObj;
            const totalSecs = Math.floor(posVal);
            const h = Math.floor(totalSecs / 3600);
            const m = Math.floor((totalSecs % 3600) / 60);
            const s = totalSecs % 60;
            const posStr = h > 0
              ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
              : `${m}:${s.toString().padStart(2, '0')}`;
            savedParts.push(`Position: ${posStr}`);
          }
          if (msObj !== undefined) {
            const msVal = typeof msObj === 'object' ? msObj.v : msObj;
            if (msVal) savedParts.push(`Mini Stats: Active`);
          }
          const descText = savedParts.join(' | ');

          const downloadThumb = (btn) => {
            const thumbQualities = ['maxresdefault.jpg', 'hqdefault.jpg', 'mqdefault.jpg'];
            const tryThumb = (idx) => {
              if (idx >= thumbQualities.length) { flashBtnState(btn, 'error'); return; }
              const url = `https://img.youtube.com/vi/${vid}/${thumbQualities[idx]}`;
              GM_xmlhttpRequest({
                method: 'HEAD', url,
                onload: (r) => {
                  if (r.status === 200) { downloadUrlAsFile(url, `${titleText}_thumbnail`); flashBtnState(btn, 'success'); }
                  else { tryThumb(idx + 1); }
                },
                onerror: () => tryThumb(idx + 1)
              });
            };
            tryThumb(0);
          };

          const downloadPfp = (btn) => {
            const orig = btn.textContent;
            btn.textContent = '\u2026';
            const done = (ok) => { flashBtnState(btn, ok ? 'success' : 'error'); btn.textContent = orig; };
            const fallbackToYouTube = (vId) => {
              GM_xmlhttpRequest({
                method: 'GET', url: `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${vId}&format=json`,
                onload: (r) => {
                  if (r.status !== 200) { done(false); return; }
                  try {
                    const json = JSON.parse(r.responseText);
                    const authorName = json.author_name || titleText;
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
                            done(true);
                          } else { done(false); }
                        } catch (e) { done(false); }
                      },
                      onerror: () => done(false)
                    });
                  } catch (e) { done(false); }
                },
                onerror: () => done(false)
              });
            };
            GM_xmlhttpRequest({
              method: 'GET', url: `https://holodex.net/api/v2/videos/${vid}?include=live_info`,
              headers: { "Referer": "https://holodex.net/", "Origin": "https://holodex.net" },
              onload: (r) => {
                if (r.status === 200) {
                  try {
                    const json = JSON.parse(r.responseText);
                    const photo = json.channel?.photo;
                    if (photo) {
                      const author = json.channel.name || titleText;
                      downloadUrlAsFile(photo.replace(/=s\d+-c-k-c0x[0-9a-f]+-no-rj/, '=s0'), `${author}_avatar`);
                      done(true);
                      return;
                    }
                  } catch (e) { }
                }
                fallbackToYouTube(vid);
              },
              onerror: () => fallbackToYouTube(vid)
            });
          };

          const copyLink = (btn, withTimestamp) => {
            const baseUrl = `https://youtu.be/${vid}`;
            if (withTimestamp) {
              const posVal = posObj && typeof posObj === 'object' ? posObj.v : (posObj || 0);
              if (!posVal || posVal <= 0) {
                const origTitle = btn.title;
                btn.title = '\u26A0 No timestamp saved for this video';
                flashBtnState(btn, 'error');
                setTimeout(() => { btn.title = origTitle; }, 2500);
                return;
              }
              navigator.clipboard.writeText(`${baseUrl}?t=${Math.floor(posVal)}`)
                .then(() => flashBtnState(btn, 'success'))
                .catch(() => flashBtnState(btn, 'error'));
            } else {
              navigator.clipboard.writeText(baseUrl)
                .then(() => flashBtnState(btn, 'success'))
                .catch(() => flashBtnState(btn, 'error'));
            }
          };

          const deleteFromHistory = () => {
            delete currentSettings.volumeCache[vid];
            delete currentSettings.positionCache[vid];
            delete currentSettings.miniStatsCache[vid];
            if (currentSettings.favoritesCache[vid]?.v) {
              currentSettings.favoritesCache[vid] = {
                v: false, title: titleText, channel: channelText, t: Date.now()
              };
            }
            delete currentSettings.annotationsCache[vid];
            saveStoredSettings(currentSettings, { immediate: true });
            if (cardRef.el && cardRef.el.isConnected) cardRef.el.remove();
            else renderHistoryTab();
          };

          const favActive = isFavorited(vid);
          const gridMode = historyViewMode === 'grid';
          const starBtn = Object.assign(document.createElement('button'), {
            textContent: favActive ? '★' : '☆',
            title: favActive ? 'Remove from favorites' : 'Add to favorites',
          });
          starBtn.style.cssText = `position:absolute; top:${gridMode ? 6 : 2}px; right:${gridMode ? 6 : 2}px; width:${gridMode ? 24 : 16}px; height:${gridMode ? 24 : 16}px; display:flex; align-items:center; justify-content:center; border-radius:50%; background:${favActive ? 'rgba(40,32,0,0.85)' : 'rgba(10,10,10,0.65)'}; border:1px solid ${favActive ? 'var(--ytee-stats-border)' : 'rgba(255,255,255,0.2)'}; color:${favActive ? 'var(--ytee-stats-color)' : 'rgba(255,255,255,0.6)'}; font-size:${gridMode ? 13 : 10}px; line-height:1; cursor:pointer; z-index:3; padding:0; transition:transform 0.12s, background 0.12s, color 0.12s, border-color 0.12s;`;
          starBtn.addEventListener('mouseenter', () => { starBtn.style.transform = 'scale(1.15)'; });
          starBtn.addEventListener('mouseleave', () => { starBtn.style.transform = ''; });
          starBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const nowFav = !favActive;
            if (favActive) {
              currentSettings.favoritesCache[vid] = {
                v: false, title: titleText, channel: channelText, t: Date.now()
              };
            } else {
              currentSettings.favoritesCache[vid] = { v: true, title: titleText, channel: channelText, t: Date.now() };
            }
            saveStoredSettings(currentSettings, { immediate: true });
            if (cardRef.el && cardRef.el.isConnected) {
              if (historyFavOnly && !nowFav) cardRef.el.remove();
              else cardRef.el.replaceWith(buildCard(vid));
            } else {
              renderHistoryTab();
            }
          });

          const openHolodex = (btn) => { window.open(`https://holodex.net/multiview/AAYY${vid}`, '_blank'); flashBtnState(btn, 'success'); };

          const buildThumb = (w, h) => {
            const primary = w > 120 ? 'hqdefault.jpg' : 'mqdefault.jpg';
            const t = Object.assign(document.createElement('img'), { src: `https://img.youtube.com/vi/${vid}/${primary}`, alt: titleText, width: w, height: h, loading: 'lazy' });
            t.style.cssText = `border-radius:6px; object-fit:cover; flex-shrink:0; width:${w}px; height:${h}px;`;
            let tried = primary === 'mqdefault.jpg';
            t.addEventListener('error', () => {
              if (!tried) { tried = true; t.src = `https://img.youtube.com/vi/${vid}/mqdefault.jpg`; }
              else t.style.display = 'none';
            });
            return t;
          };

          if (historyViewMode === 'grid') {
            const overlay = Object.assign(document.createElement('div'), {
              className: 'ytee-hist-overlay',
              style: 'position:absolute; top:0; left:0; right:0; height:clamp(72px,calc(var(--ytee-ew)*0.115),120px); background:linear-gradient(to bottom, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.55) 100%); display:flex; align-items:center; justify-content:center; gap:6px; z-index:2; border-radius:0;'
            });
            const card = Object.assign(document.createElement('div'), {
              className: 'ytee-hist-card',
              style: 'background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:10px; overflow:hidden; display:flex; flex-direction:column; position:relative; transition:border-color 0.18s, box-shadow 0.18s;'
            });
            card.dataset.yteeVid = vid;

            // Thumbnail 2
            const cardThumb = buildThumb(160, 90);
            cardThumb.style.cssText = 'width:100%; height:clamp(72px,calc(var(--ytee-ew)*0.115),120px); object-fit:cover; border-radius:0; flex-shrink:0;';

            const mkOvBtn = (label, title, color) => mkActionBtn('overlay', label, title, color);
            const ovThumb = mkOvBtn('\u2B07', 'Download thumbnail');
            ovThumb.addEventListener('click', (e) => { e.stopPropagation(); downloadThumb(ovThumb); });
            const ovPfp = mkOvBtn('\u{1F464}', 'Download PFP');
            ovPfp.addEventListener('click', (e) => { e.stopPropagation(); downloadPfp(ovPfp); });
            const ovLink = mkOvBtn('\uD83D\uDD17', 'Copy link \u2022 Ctrl+click for timestamp');
            ovLink.addEventListener('click', (e) => { e.stopPropagation(); copyLink(ovLink, e.ctrlKey); });
            const ovHolo = mkOvBtn('Holodex', 'Open in Holodex', '#7ddf7d');
            ovHolo.addEventListener('click', (e) => { e.stopPropagation(); openHolodex(ovHolo); });
            overlay.append(ovThumb, ovPfp, ovLink, ovHolo);

            const cardBody = Object.assign(document.createElement('div'), {
              style: 'padding:9px 10px 7px; flex:1; display:flex; flex-direction:column; gap:3px; min-width:0;'
            });
            const cardTitle = Object.assign(document.createElement('div'), {
              className: 'ytee-hist-link',
              textContent: titleText, title: 'Open on YouTube',
              style: 'font-size:11.5px; color:rgba(255,255,255,0.9); font-weight:600; line-height:1.35; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; cursor:pointer; transition:color 0.12s;'
            });
            cardTitle.addEventListener('click', () => window.open(`https://youtu.be/${vid}`, '_blank'));

            const cardChannel = channelText
              ? Object.assign(document.createElement('div'), {
                className: 'ytee-hist-sublink',
                textContent: channelText, title: 'Open YouTube channel',
                style: 'font-size:10px; color:rgba(255,255,255,0.38); cursor:pointer; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; transition:color 0.12s;'
              })
              : null;
            if (cardChannel) {
              cardChannel.addEventListener('click', () => window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(channelText)}`, '_blank'));
            }

            const cardMeta = Object.assign(document.createElement('div'), {
              textContent: descText,
              style: 'font-size:9.5px; color:rgba(255,255,255,0.28); line-height:1.4; margin-top:2px;'
            });

            // Delete
            const cardDel = Object.assign(document.createElement('button'), {
              textContent: 'Delete', title: 'Delete from history',
              style: 'align-self:flex-end; margin-top:auto; padding:3px 7px; font-size:9.5px; background:transparent; color:rgba(255,80,80,0.45); border:1px solid rgba(255,80,80,0.2); border-radius:4px; cursor:pointer; transition:all 0.15s;'
            });
            cardDel.addEventListener('mouseenter', () => { cardDel.style.background = 'rgba(255,50,50,0.12)'; cardDel.style.color = '#ff5555'; cardDel.style.borderColor = 'rgba(255,80,80,0.5)'; });
            cardDel.addEventListener('mouseleave', () => { cardDel.style.background = 'transparent'; cardDel.style.color = 'rgba(255,80,80,0.45)'; cardDel.style.borderColor = 'rgba(255,80,80,0.2)'; });
            cardDel.addEventListener('click', deleteFromHistory);

            const gridBadge = mkBookmarkBadge(vid);
            if (gridBadge) {
              gridBadge.style.cssText += ' align-self:flex-start; margin-top:4px;';
              cardBody.append(cardTitle, ...(cardChannel ? [cardChannel] : []), cardMeta, gridBadge, cardDel);
            } else {
              cardBody.append(cardTitle, ...(cardChannel ? [cardChannel] : []), cardMeta, cardDel);
            }
            card.append(cardThumb, overlay, starBtn, cardBody);
            cardRef.el = card;
            return card;
          } else {
            // List view
            const listRow = Object.assign(document.createElement('div'), {
              className: 'ytee-hist-list',
              style: 'display:flex; align-items:center; gap:12px; padding:8px 10px; margin-bottom:6px; border-radius:10px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); position:relative; transition:background 0.15s, border-color 0.15s; overflow:hidden;'
            });
            listRow.dataset.yteeVid = vid;

            // Thumbnail 3
            const thumb = buildThumb(80, 45);
            Object.assign(thumb.style, { borderRadius: '6px', width: '100%', height: '100%', display: 'block' });
            const thumbWrap = Object.assign(document.createElement('div'), { style: 'position:relative; flex-shrink:0; width:80px; height:45px;' });
            thumbWrap.append(thumb, starBtn);

            const textBlock = Object.assign(document.createElement('div'), { style: 'flex:1; min-width:0; display:flex; flex-direction:column; gap:2px;' });
            const titleSpan = Object.assign(document.createElement('span'), {
              className: 'ytee-hist-link',
              textContent: titleText, title: 'Open on YouTube',
              style: 'font-size:12px; font-weight:600; color:rgba(255,255,255,0.9); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; cursor:pointer; display:block; transition:color 0.12s;'
            });
            titleSpan.addEventListener('click', () => window.open(`https://youtu.be/${vid}`, '_blank'));
            textBlock.appendChild(titleSpan);

            if (channelText) {
              const channelSpan = Object.assign(document.createElement('span'), {
                className: 'ytee-hist-sublink',
                textContent: channelText, title: 'Open YouTube channel',
                style: 'font-size:10px; color:rgba(255,255,255,0.38); cursor:pointer; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; display:block; transition:color 0.12s;'
              });
              channelSpan.addEventListener('click', () => window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(channelText)}`, '_blank'));
              textBlock.appendChild(channelSpan);
            }

            const metaSpan = Object.assign(document.createElement('span'), {
              style: 'font-size:9.5px; color:rgba(255,255,255,0.25); margin-top:1px; display:flex; gap:6px; align-items:center; flex-wrap:wrap;'
            });
            if (descText) metaSpan.append(document.createTextNode(descText));
            const badge = mkBookmarkBadge(vid);
            if (badge) metaSpan.append(badge);
            textBlock.appendChild(metaSpan);

            // Actionstrip
            const actionStrip = Object.assign(document.createElement('div'), {
              className: 'ytee-hist-actions',
              style: 'display:flex; gap:5px; align-items:center; flex-shrink:0;'
            });
            const mkListAction = (label, title, color) => mkActionBtn('strip', label, title, color);
            const laThumb = mkListAction('\u2B07 Thumb', 'Download thumbnail');
            laThumb.addEventListener('click', () => downloadThumb(laThumb));
            const laPfp = mkListAction('\u2B07 PFP', 'Download PFP');
            laPfp.addEventListener('click', () => downloadPfp(laPfp));
            const laLink = mkListAction('\uD83D\uDD17', 'Copy link \u2022 Ctrl+click for timestamp');
            laLink.addEventListener('click', (e) => copyLink(laLink, e.ctrlKey));
            const laHolo = mkListAction('Holodex', 'Open in Holodex', '#7ddf7d');
            laHolo.addEventListener('click', () => openHolodex(laHolo));
            const laDel = mkListAction('Delete', 'Delete from history', 'rgba(255,80,80,0.7)');
            laDel.style.borderColor = 'rgba(255,80,80,0.2)';
            laDel.addEventListener('mouseenter', () => { laDel.style.background = 'rgba(255,50,50,0.15)'; laDel.style.color = '#ff5555'; });
            laDel.addEventListener('mouseleave', () => { laDel.style.background = 'rgba(255,255,255,0.07)'; laDel.style.color = 'rgba(255,80,80,0.7)'; });
            laDel.addEventListener('click', deleteFromHistory);
            actionStrip.append(laThumb, laPfp, laLink, laHolo, laDel);

            listRow.append(thumbWrap, textBlock, actionStrip);
            cardRef.el = listRow;
            return listRow;
          }
        };

        let visibleVids = historyFavOnly ? allVids.filter(isFavorited) : allVids;

        if (visibleVids.length === 0 && historyFavOnly) {
          h.append(mkNote('No favorites yet — click the ☆ on any video to pin it here.'));
        }

        const footerRow = Object.assign(document.createElement('div'), { style: 'display:flex; gap:8px; align-items:center; justify-content:flex-end; margin-top:14px; padding-top:10px; border-top:1px solid rgba(255,255,255,0.08);' });
        const footerImportBtn = Object.assign(document.createElement('button'), { textContent: 'Import History', title: 'Import history from a JSON file', style: 'padding:5px 12px; font-size:11px; background:rgba(255,255,255,0.07); color:rgba(255,255,255,0.7); border:1px solid rgba(255,255,255,0.15); border-radius:5px; cursor:pointer;' });
        const footerExportBtn = Object.assign(document.createElement('button'), { textContent: 'Export History', title: 'Export history as a JSON file', style: 'padding:5px 12px; font-size:11px; background:rgba(255,255,255,0.07); color:rgba(255,255,255,0.7); border:1px solid rgba(255,255,255,0.15); border-radius:5px; cursor:pointer;' });
        footerImportBtn.addEventListener('click', () => importInput.click());
        footerExportBtn.addEventListener('click', () => {
          try {
            const data = { ytee_history_export: true, volumeCache: currentSettings.volumeCache, positionCache: currentSettings.positionCache, miniStatsCache: currentSettings.miniStatsCache, favoritesCache: currentSettings.favoritesCache, annotationsCache: currentSettings.annotationsCache };
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = Object.assign(document.createElement('a'), { href: url, download: `ytee-history-${new Date().toISOString().slice(0, 10)}.json` });
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            URL.revokeObjectURL(url);
            flashBtnState(footerExportBtn, 'success');
          } catch (e) { flashBtnState(footerExportBtn, 'error'); }
        });
        footerRow.append(footerImportBtn, footerExportBtn);

        let renderIdx = 0;
        const RENDER_BATCH = 18;
        const renderChunk = () => {
          historyRenderRaf = 0;
          const isGrid = historyViewMode === 'grid';
          const frag = isGrid ? null : document.createDocumentFragment();
          const end = Math.min(renderIdx + RENDER_BATCH, visibleVids.length);
          for (; renderIdx < end; renderIdx++) {
            const vid = visibleVids[renderIdx];
            const ts = tsByVid.get(vid) || 0;
            const dateLabel = ts ? getDateLabel(ts) : null;
            if (dateLabel && dateLabel !== lastDateLabel) {
              if (isGrid) { flushGridContainer(); h.append(mkDateSeparator(dateLabel)); }
              else frag.append(mkDateSeparator(dateLabel));
              lastDateLabel = dateLabel;
            }
            const el = buildCard(vid);
            if (isGrid) getGridContainer().append(el);
            else frag.append(el);
          }
          if (!isGrid) h.append(frag);
          if (renderIdx < visibleVids.length) {
            historyRenderRaf = requestAnimationFrame(renderChunk);
          } else {
            if (isGrid) flushGridContainer();
            h.append(footerRow);
          }
        };
        renderChunk();
      };

      const disposeHistoryTab = () => {
        clearTimeout(historyRenderTimer);
        if (historyRenderRaf) { cancelAnimationFrame(historyRenderRaf); historyRenderRaf = 0; }
      };

      return { renderHistoryTab, scheduleHistoryRender, disposeHistoryTab };
  };

  const createBookmarks = ({ video, getPlayer, getSettings, scheduleHistoryRender, showControls }) => {
      const annotBtn = mkBtn('custom-annot-btn', 'annot', 'Notes', 'Notes for this video • right-click drops one');

      const seekTo = (sec) => {
        const p = getPlayer();
        try {
          if (p && typeof p.seekTo === 'function') { p.seekTo(sec, true); return; }
        } catch (e) { }
        try { video.currentTime = sec; } catch (e) { }
      };

      const annotVid = () => { try { return getVideoId(getPlayer()); } catch (e) { return ''; } };

      const getAnnot = (vid) => getSettings().annotationsCache[vid] || null;

      const ensureAnnot = (vid) => {
        const currentSettings = getSettings();
        let a = currentSettings.annotationsCache[vid];
        if (!a) {
          const p = getPlayer();
          a = { marks: [], title: getVideoTitle(p) || '', channel: getVideoAuthor(p) || '', t: Date.now() };
          currentSettings.annotationsCache[vid] = a;
        }
        return a;
      };

      const cleanupAnnot = (vid) => {
        const currentSettings = getSettings();
        const a = currentSettings.annotationsCache[vid];
        if (a && a.marks.length === 0) delete currentSettings.annotationsCache[vid];
      };

      const persistAnnot = (vid) => {
        const currentSettings = getSettings();
        const a = currentSettings.annotationsCache[vid];
        if (a) {
          a.t = Date.now();
          const p = getPlayer();
          if (!a.title) a.title = getVideoTitle(p) || '';
          if (!a.channel) a.channel = getVideoAuthor(p) || '';
        }
        cleanupAnnot(vid);
        saveStoredSettings(currentSettings);
        scheduleHistoryRender();
      };

      let annotPanel = null;
      let annotMarksBox, annotAddBtn;
      let annotPanelOpen = false;
      let annotNowTimer = null;

      const updateAnnotNow = () => {
        if (!annotAddBtn) return;
        const now = annotAddBtn.querySelector('.ytee-annot-now');
        if (now) now.textContent = formatClock(video.currentTime);
      };

      const renderAnnotMarks = () => {
        const vid = annotVid();
        const a = getAnnot(vid);
        annotMarksBox.textContent = '';
        const marks = a ? a.marks.slice().sort((x, y) => x.s - y.s) : [];
        if (marks.length === 0) {
          annotMarksBox.append(Object.assign(document.createElement('div'), { className: 'ytee-annot-empty', textContent: 'No notes yet.' }));
          return;
        }
        marks.forEach((mk) => {
          const row = Object.assign(document.createElement('div'), { className: 'ytee-annot-mark' });
          const ts = Object.assign(document.createElement('span'), { className: 'ytee-annot-ts', textContent: formatClock(mk.s), title: 'Jump here' });
          ts.addEventListener('click', () => { seekTo(mk.s); flashBtnState(annotBtn, 'success', 700); });
          const lbl = Object.assign(document.createElement('span'), { className: 'ytee-annot-lbl', textContent: mk.label || 'Untitled mark', title: 'Click to rename' });
          const startEdit = () => {
            const inp = Object.assign(document.createElement('input'), { value: mk.label, maxLength: ANNOT_LABEL_MAX });
            lbl.replaceWith(inp);
            inp.focus(); inp.select();
            const commit = () => {
              mk.label = inp.value.trim().slice(0, ANNOT_LABEL_MAX);
              persistAnnot(vid);
              renderAnnotMarks();
            };
            inp.addEventListener('blur', commit);
            inp.addEventListener('keydown', (e) => {
              if (e.key === 'Enter') { e.preventDefault(); inp.blur(); }
              else if (e.key === 'Escape') { e.preventDefault(); renderAnnotMarks(); }
            });
          };
          lbl.addEventListener('click', startEdit);
          const copy = Object.assign(document.createElement('button'), { textContent: '🔗', title: 'Copy link at this time' });
          copy.addEventListener('click', () => {
            navigator.clipboard.writeText(`https://youtu.be/${vid}?t=${mk.s}`).then(() => flashBtnState(annotBtn, 'success', 700)).catch(() => { });
          });
          const del = Object.assign(document.createElement('button'), { textContent: '✕', title: 'Delete note' });
          del.addEventListener('click', () => {
            const cur = ensureAnnot(vid);
            cur.marks = cur.marks.filter(m => m !== mk);
            persistAnnot(vid);
            renderAnnotMarks();
          });
          row.append(ts, lbl, copy, del);
          annotMarksBox.append(row);
        });
      };

      const refreshAnnotPanel = () => {
        if (!annotPanel) return;
        updateAnnotNow();
        renderAnnotMarks();
      };

      const buildAnnotPanel = () => {
        if (annotPanel) return;
        annotPanel = Object.assign(document.createElement('div'), { id: 'ytee-annot-panel' });

        const head = Object.assign(document.createElement('div'), { className: 'ytee-annot-head' });
        head.append(document.createTextNode('Notes'));
        const xBtn = Object.assign(document.createElement('button'), { className: 'ytee-annot-x', textContent: '✕', title: 'Close' });
        xBtn.addEventListener('click', () => closeAnnotPanel());
        head.append(xBtn);

        const body = Object.assign(document.createElement('div'), { className: 'ytee-annot-body' });

        annotAddBtn = Object.assign(document.createElement('button'), { className: 'ytee-annot-add', type: 'button' });
        annotAddBtn.append(
          Object.assign(document.createElement('span'), { textContent: '🔖' }),
          document.createTextNode('Add note here'),
          Object.assign(document.createElement('span'), { className: 'ytee-annot-now', textContent: '0:00' })
        );
        annotAddBtn.addEventListener('click', () => addBookmarkAtCurrent(true));

        annotMarksBox = Object.assign(document.createElement('div'), { className: 'ytee-annot-marks' });

        const foot = Object.assign(document.createElement('div'), { className: 'ytee-annot-foot', textContent: 'Click a time to jump. Notes save automatically and appear in Settings → History.' });

        body.append(annotAddBtn, annotMarksBox, foot);
        annotPanel.append(head, body);
        document.body.appendChild(annotPanel);
      };

      const onAnnotOutside = (e) => {
        if (!annotPanelOpen) return;
        if (annotPanel.contains(e.target) || annotBtn.contains(e.target)) return;
        closeAnnotPanel();
      };

      const openAnnotPanel = () => {
        buildAnnotPanel();
        refreshAnnotPanel();
        annotPanel.classList.add('show');
        annotBtn.classList.add('active');
        annotPanelOpen = true;
        showControls();
        clearInterval(annotNowTimer);
        annotNowTimer = setInterval(updateAnnotNow, 250);
        setTimeout(() => document.addEventListener('mousedown', onAnnotOutside, true), 0);
      };

      const closeAnnotPanel = () => {
        if (!annotPanel) return;
        annotPanel.classList.remove('show');
        annotBtn.classList.remove('active');
        annotPanelOpen = false;
        clearInterval(annotNowTimer);
        annotNowTimer = null;
        document.removeEventListener('mousedown', onAnnotOutside, true);
      };

      const toggleAnnotPanel = () => { annotPanelOpen ? closeAnnotPanel() : openAnnotPanel(); };

      const addBookmarkAtCurrent = (openForEdit) => {
        const vid = annotVid();
        if (!vid) return;
        const cur = ensureAnnot(vid);
        if (cur.marks.length >= ANNOT_MARKS_MAX) return;
        const s = Math.round(video.currentTime || 0);
        const mk = { s, label: '' };
        cur.marks.push(mk);
        persistAnnot(vid);
        if (!annotPanelOpen) openAnnotPanel();
        else refreshAnnotPanel();
        renderAnnotMarks();
        if (openForEdit) {
          const rows = annotMarksBox.querySelectorAll('.ytee-annot-mark');
          const sorted = cur.marks.slice().sort((a, b) => a.s - b.s);
          const idx = sorted.indexOf(mk);
          const target = rows[idx];
          if (target) target.querySelector('.ytee-annot-lbl').click();
        } else {
          flashBtnState(annotBtn, 'success', 800);
        }
      };

      annotBtn.addEventListener('click', toggleAnnotPanel);
      annotBtn.addEventListener('contextmenu', (e) => { e.preventDefault(); addBookmarkAtCurrent(false); });

      return {
        annotBtn, ensureAnnot, persistAnnot, addBookmarkAtCurrent, closeAnnotPanel,
        isAnnotPanelOpen: () => annotPanelOpen,
        getAnnotPanel: () => annotPanel,
      };
  };

  const createWatchLater = ({ uw, getPlayer }) => {
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
      } catch (e) { yteeWarn('InnerTube cache read failed', e); }

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
        const res = await gmOrFetch({
          method: 'GET', url: `https://www.youtube.com/watch?v=${videoId}`,
          headers: { 'Accept-Language': navigator.language || 'en-US,en;q=0.9' },
          credentials: 'include',
        });
        const m = res.text.match(/ytcfg\.set\s*\(({[\s\S]+?})\s*\)\s*;/);
        if (!m) throw new Error('ytcfg block not found');
        const cfg = JSON.parse(m[1]);
        if (!cfg.INNERTUBE_API_KEY) throw new Error('INNERTUBE_API_KEY missing');
        cachedApiKey = cfg.INNERTUBE_API_KEY; cachedContext = cfg.INNERTUBE_CONTEXT;
        try { if (typeof GM_setValue === 'function') GM_setValue('ytee-innertube', JSON.stringify({ apiKey: cachedApiKey, context: cachedContext, savedAt: Date.now() })); } catch (e) { }
        return { apiKey: cachedApiKey, context: cachedContext };
      };

      const clearInnertubeCache = () => {
        cachedApiKey = null; cachedContext = null;
        try { if (typeof GM_setValue === 'function') GM_setValue('ytee-innertube', null); } catch (e) { }
      };

      wlBtn.addEventListener("click", async () => {
        try {
          setBtnLabel(wlBtn, '\u2026');
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
            const res = await gmOrFetch({
              method: 'POST',
              url: `https://www.youtube.com/youtubei/v1/browse/edit_playlist?key=${apiKey}&prettyPrint=false`,
              headers: { 'Content-Type': 'application/json', 'X-Origin': 'https://www.youtube.com', 'X-Goog-AuthUser': '0', 'Authorization': `SAPISIDHASH ${sapisidHash}` },
              data: JSON.stringify(payload),
              credentials: 'include',
            });
            return res.status;
          };
          let status = await attemptRequest();
          if (status === 401 || status === 403) { clearInnertubeCache(); status = await attemptRequest(); }
          if (status === 200) { setBtnLabel(wlBtn, '✓ Saved'); flashBtnState(wlBtn, 'success'); } else { throw new Error(`HTTP ${status}`); }
          setTimeout(() => setBtnLabel(wlBtn), 1500);
        } catch (err) { console.error("Watch Later failed:", err); setBtnLabel(wlBtn, '✗ Err'); flashBtnState(wlBtn, 'error'); setTimeout(() => setBtnLabel(wlBtn), 1500); }
      });

      return { wlBtn, clearInnertubeCache };
  };

  const createPipButton = ({ video }) => {
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
      return { pipBtn, pipSupported };
  };

  const createUrlButton = ({ video, getPlayer }) => {
      const urlBtn = mkBtn('custom-url-btn', 'url', 'URL', 'Copy URL (Ctrl+Click = with timestamp) • Middle-Click = Open in YouTube');
      urlBtn.addEventListener("auxclick", (e) => {
        if (e.button === 1) {
          e.preventDefault();
          const videoId = getVideoId(getPlayer());
          if (videoId) {
            let url = `https://youtu.be/${videoId}`;
            if (e.ctrlKey) url += `?t=${Math.floor(video.currentTime)}`;
            window.open(url, '_blank');
          }
        }
      });
      urlBtn.addEventListener("click", async (e) => {
        try {
          const videoId = getVideoId(getPlayer());
          let url = `https://youtu.be/${videoId}`;
          if (e.ctrlKey) url += `?t=${Math.floor(video.currentTime)}`;
          let copied = false;
          if (navigator.clipboard) {
            try { await navigator.clipboard.writeText(url); copied = true; } catch (clipErr) { }
          }
          if (!copied) {
            const ta = document.createElement('textarea');
            ta.value = url;
            ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0;';
            document.body.appendChild(ta);
            ta.focus(); ta.select();
            copied = document.execCommand('copy');
            document.body.removeChild(ta);
          }
          if (copied) {
            flashBtnResult(urlBtn, '✓ Copied!', 'success');
          } else { throw new Error('All copy methods failed'); }
        } catch (err) {
          console.error("Copy URL failed:", err);
          flashBtnState(urlBtn, 'error');
        }
      });
      return { urlBtn };
  };

  const SPEED_STEP = 0.1, SPEED_STEP_FINE = 0.01, SPEED_DEFAULT = 1;

  const createSpeedControl = ({ video, showSpeedOverlay, setHoveringSpeedBtn }) => {
      const SPEED_MIN = 0.1, SPEED_MAX = 16;
      let targetSpeed = Math.round((video.playbackRate || SPEED_DEFAULT) * 100) / 100;
      const speedBtn = mkBtn('custom-speed-btn', 'speed', targetSpeed + 'x', 'Speed', 'Playback Speed');

      const updateSpeedBtnText = (rate) => { setBtnLabel(speedBtn, rate + 'x', `Speed: ${rate}x`); };

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
      speedBtn.addEventListener("mouseenter", () => { setHoveringSpeedBtn(true); });
      speedBtn.addEventListener("mouseleave", () => { setHoveringSpeedBtn(false); });

      return { speedBtn, applySpeed, getTargetSpeed: () => targetSpeed };
  };

  const createStats = ({ video, getPlayer, getSettings, isCurrentlyLive, scheduleHistoryRender }) => {
      let lastHolodexStatus = 'unknown';
      let isStatsOpen = false, isMiniStatsOpen = false, miniStatsTimer = null, miniStatsDelay = 2000;
      const miniStats = Object.assign(document.createElement("div"), { id: "custom-mini-stats" });
      const statsBtn = mkBtn('custom-stats-btn', 'stats', 'Stats', 'Stats (Ctrl = Mini)', 'Stats for Nerds (Shift+S)');

      let isDragging = false, startX, startY, startL, startT;
      miniStats.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        isDragging = true;
        startX = e.clientX; startY = e.clientY;
        const rect = miniStats.getBoundingClientRect();
        startL = rect.left; startT = rect.top;
        miniStats.style.transition = 'none';
        window.addEventListener('mousemove', onMiniStatsDrag, { passive: true });
        window.addEventListener('mouseup', onMiniStatsDragEnd);
        e.preventDefault();
      });
      const onMiniStatsDrag = (e) => {
        if (!isDragging) return;
        const x = startL + (e.clientX - startX);
        const y = startT + (e.clientY - startY);
        miniStats.style.left = x + 'px';
        miniStats.style.top = y + 'px';
        miniStats.style.bottom = 'auto';
      };
      const onMiniStatsDragEnd = () => {
        window.removeEventListener('mousemove', onMiniStatsDrag);
        window.removeEventListener('mouseup', onMiniStatsDragEnd);
        if (!isDragging) return;
        isDragging = false;
        miniStats.style.transition = '';
        const rect = miniStats.getBoundingClientRect();
        const pL = rect.left / window.innerWidth;
        const pT = rect.top / window.innerHeight;
        const currentSettings = getSettings();
        currentSettings.miniStatsPos = { pL, pT };
        saveStoredSettings(currentSettings);
      };
      const applyMiniStatsPos = () => {
        const currentSettings = getSettings();
        if (!currentSettings.miniStatsPos || isDragging) return;
        const { pL, pT } = currentSettings.miniStatsPos;
        const w = window.innerWidth, h = window.innerHeight;
        const rect = miniStats.getBoundingClientRect();
        const x = Math.max(0, Math.min(w - rect.width, pL * w));
        const y = Math.max(0, Math.min(h - rect.height, pT * h));
        Object.assign(miniStats.style, { left: x + 'px', top: y + 'px', bottom: 'auto' });
      };
      applyMiniStatsPos();

      miniStats.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        const currentSettings = getSettings();
        currentSettings.miniStatsPos = null;
        saveStoredSettings(currentSettings);
        miniStats.style.left = '';
        miniStats.style.top = '';
        miniStats.style.bottom = '45px';
        applyMiniStatsPos();
      });

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
      let viewerMissStreak = 0;
      let holodexUnavailable = false;
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
                  const channelName = json.channel?.name || '';
                  resolve({ v: v && v > 0 ? formatViewers(v) : '-', live: lastHolodexStatus === 'live', channelName });
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
          if (!p) {
            miniStatsDelay = 10000;
            return;
          }
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
          const setPart = (el, v) => { const s = String(v); if (el.textContent !== s) el.textContent = s; };
          setPart(miniStatsParts.bandwidth, bandwidth);
          setPart(miniStatsParts.buffer, buffer != null ? buffer + 's' : 'N/A');
          setPart(miniStatsParts.latency, formattedLatency !== 'N/A' ? formattedLatency + 's' : 'N/A');
          setPart(miniStatsParts.dropped, dropped);
          if (miniStatsParts.dropped.style.color !== dColor) miniStatsParts.dropped.style.color = dColor;

          const now = Date.now();
          const viewsText = miniStatsParts.views.textContent.trim();
          const isInitial = viewsText === '-' || viewsText === '';
          const isLiveNow = isCurrentlyLive(p);
          const VIEWER_INTERVAL = isInitial ? 8000 : 90000;
          if (!holodexUnavailable && (isLiveNow || !isInitial) && !isFetchingViewers && now - lastWatcherTime >= VIEWER_INTERVAL) {
            lastWatcherTime = now;
            const videoId = getVideoId(p);
            if (videoId && videoId.length > 5) {
              isFetchingViewers = true;
              fetchViewers(videoId).then(res => {
                const gotViewers = res.v && res.v !== '-';
                if (gotViewers) {
                  miniStatsParts.views.textContent = res.v;
                  viewerMissStreak = 0;
                } else {
                  if (res.live === true) viewerMissStreak = 0;
                  else if (++viewerMissStreak >= 3 || lastHolodexStatus === 'past') holodexUnavailable = true;
                  if (isInitial && !holodexUnavailable) lastWatcherTime = 0;
                }
                if (res.channelName) {
                  const currentSettings = getSettings();
                  let didUpdate = false;
                  ['volumeCache', 'miniStatsCache', 'positionCache'].forEach(key => {
                    if (currentSettings[key]?.[videoId] && !currentSettings[key][videoId].channel) {
                      currentSettings[key][videoId].channel = res.channelName;
                      didUpdate = true;
                    }
                  });
                  if (didUpdate) saveStoredSettings(currentSettings);
                }
                if (miniStatsWrappers.views) {
                  miniStatsWrappers.views.style.display =
                    (isLiveNow && lastHolodexStatus !== 'past') ? '' : 'none';
                }
              }).finally(() => {
                isFetchingViewers = false;
              });
            }
          }

          if (video.paused || document.hidden) {
            miniStatsDelay = 10000;
          } else if (lastHolodexStatus === 'live') {
            miniStatsDelay = 2000;
          } else {
            miniStatsDelay = 4000;
          }
        } catch (e) {
          console.error('YTEE: updateMiniStats failed', e);
        }
      };

      const scheduleMiniStats = () => {
        clearTimeout(miniStatsTimer);
        miniStatsTimer = setTimeout(() => {
          updateMiniStats();
          if (isMiniStatsOpen) scheduleMiniStats();
        }, miniStatsDelay);
      };

      const onVisibilityChange = () => {
        if (!document.hidden && isMiniStatsOpen) {
          miniStatsDelay = 2000;
          scheduleMiniStats();
        }
      };
      document.addEventListener('visibilitychange', onVisibilityChange);

      const toggleMiniStats = () => {
        isMiniStatsOpen = !isMiniStatsOpen;
        miniStats.classList.toggle("show", isMiniStatsOpen);
        statsBtn.classList.toggle("active", isMiniStatsOpen);
        clearTimeout(miniStatsTimer);
        miniStatsTimer = null;
        if (isMiniStatsOpen) {
          lastWatcherTime = 0;
          isFetchingViewers = false;
          viewerMissStreak = 0;
          holodexUnavailable = false;
          updateMiniStats();
          scheduleMiniStats();
        }
        const p = getPlayer();
        const vid = getVideoId(p);
        if (vid) {
          const title = getVideoTitle(p) || "";
          const channel = getVideoAuthor(p) || "";
          const currentSettings = getSettings();
          currentSettings.miniStatsCache[vid] = { v: isMiniStatsOpen, title, channel, t: Date.now() };
          saveStoredSettings(currentSettings);
          scheduleHistoryRender();
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

      const disposeStats = () => {
        clearTimeout(miniStatsTimer);
        window.removeEventListener('mousemove', onMiniStatsDrag);
        window.removeEventListener('mouseup', onMiniStatsDragEnd);
        document.removeEventListener('visibilitychange', onVisibilityChange);
      };

      return { miniStats, statsBtn, toggleStats, toggleMiniStats, applyMiniStatsPos, disposeStats };
  };

  if (window.self === window.top) {
    runTopFrameFixes();

  } else if (!isChat()) {
    injectCriticalCSS();
    registerSettingsFlush();

    let currentSettings = loadStoredSettings() || defaultSettings;

    let __ytee_visibleBtnCount = 10;
    let __ytee_uiSig = null;

    const YTEE_BP = {
      COMPACT_W: 750,  // toolbar may drop labelcollapse, and the settings modal goes dense, below this
      SHORT_H: 400,    // treated as "small" below this height
      TINY_H: 180,     // force-collapse the toolbar below this height
    };

    const applyUIStates = (settings) => {
      const w = document.documentElement.clientWidth || window.innerWidth || 800;
      const h = document.documentElement.clientHeight || window.innerHeight || 600;
      const isSmall = w < YTEE_BP.COMPACT_W || h < YTEE_BP.SHORT_H;

      const group = document.getElementById('custom-btn-group');
      const sig = group ? [
        w, h, !!settings.compactMode, !!settings.isCollapsed, !!settings.highContrastUI,
        settings.enableBlur === false, !!(settings.buttons && settings.buttons.vol), __ytee_visibleBtnCount,
      ].join('|') : null;
      if (sig !== null && sig === __ytee_uiSig) return;
      __ytee_uiSig = sig;

      let labelsOff = !!settings.compactMode;
      let collapsed = !!settings.isCollapsed;

      document.documentElement.dataset.yteeLabels = labelsOff ? '0' : '1';
      document.documentElement.dataset.yteeHighContrast = settings.highContrastUI ? '1' : '0';
      document.documentElement.dataset.yteeBlur = settings.enableBlur === false ? '0' : '1';
      if (group) {
        group.classList.toggle('collapsed', collapsed);

        if (isSmall) {
          const leftReserve = (settings.buttons && settings.buttons.vol) ? 92 : 40;
          const avail = w - leftReserve;
          const SLACK = 24;
          let measured = group.offsetWidth;

          if (measured > 0) {
            if (!labelsOff && measured > avail + SLACK) {
              labelsOff = true;
              document.documentElement.dataset.yteeLabels = '0';
              measured = group.offsetWidth;
            }
            if (!collapsed && (measured > avail + SLACK || h < YTEE_BP.TINY_H)) {
              collapsed = true;
              group.classList.toggle('collapsed', true);
            }
          } else {
            const n = __ytee_visibleBtnCount;
            if (!labelsOff && w < n * 60 + 100) { labelsOff = true; document.documentElement.dataset.yteeLabels = '0'; }
            if (!collapsed && (w < n * 24 + 100 || h < YTEE_BP.TINY_H)) { collapsed = true; group.classList.toggle('collapsed', true); }
          }
        }

        const tBtn = document.getElementById('custom-toggle-btn');
        if (tBtn) {
          const iconSpan = tBtn.querySelector('.ytee-icon');
          if (iconSpan) {
            while (iconSpan.firstChild) iconSpan.removeChild(iconSpan.firstChild);
            iconSpan.appendChild(ICON_DEFS[collapsed ? 'expand' : 'hide']());
          }
          setBtnLabel(tBtn, '', collapsed ? 'Expand UI' : 'Collapse UI');
        }
      }
    };

    currentSettings = normalizeSettings(currentSettings);
    applyUIStates(currentSettings);

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
      let volumeLockUntil = 0;
      const VOLUME_LOCK_MS = 300;

      const uw = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;

      let cachedPlayer = null;
      let playerCacheTime = 0;
      const PLAYER_CACHE_TTL = 1000;

      const getPlayer = () => {
        if (cachedPlayer && cachedPlayer.isConnected) return cachedPlayer;
        const now = Date.now();
        if (!cachedPlayer && now - playerCacheTime < PLAYER_CACHE_TTL) return cachedPlayer;
        playerCacheTime = now;
        cachedPlayer = uw.document.getElementById("movie_player") || uw.document.querySelector(".html5-video-player");
        return cachedPlayer;
      };

      const isCurrentlyLive = (player) => {
        if (player && typeof player.getVideoData === 'function') {
          const data = player.getVideoData();
          return !!data?.isLive;
        }
        return false;
      };

      const QUALITY_LABELS = {
        auto: 'Auto (YouTube decides)', hd2160: '4K (2160p)', hd1440: '1440p',
        hd1080: '1080p', hd720: '720p', large: '480p', medium: '360p', small: '240p', tiny: '144p',
      };
      const QUALITY_ORDER = ['hd2160', 'hd1440', 'hd1080', 'hd720', 'large', 'medium', 'small', 'tiny'];

      // Preferred quality (only applies once)
      let qualityAppliedFor = null;
      let qualityOverriddenFor = null;
      const applyQuality = (force) => {
        const pref = currentSettings.preferredQuality;
        const p = getPlayer();
        if (!p) return;
        const vid = (() => { try { return getVideoId(p); } catch (e) { return null; } })();
        if (force) { qualityAppliedFor = null; qualityOverriddenFor = null; }
        if (!pref || pref === 'auto') return;
        if (vid && qualityOverriddenFor === vid) return;
        if (vid && qualityAppliedFor === vid && !force) return;
        try {
          let applied = false;
          if (typeof p.setPlaybackQualityRange === 'function') { p.setPlaybackQualityRange(pref, pref); applied = true; }
          if (typeof p.setPlaybackQuality === 'function') { p.setPlaybackQuality(pref); applied = true; }
          if (applied && typeof p.getPlaybackQuality === 'function') {
            const cur = p.getPlaybackQuality();
            const curIdx = QUALITY_ORDER.indexOf(cur);
            const prefIdx = QUALITY_ORDER.indexOf(pref);
            if (cur && cur !== 'unknown' && curIdx >= prefIdx) qualityAppliedFor = vid;
          } else if (applied) {
            qualityAppliedFor = vid;
          }
        } catch (e) { yteeWarn('YTEE: applyQuality failed', e); }
      };

      const hookPlayerEvents = () => {
        const p = getPlayer();
        if (!p || typeof p.addEventListener !== 'function') return;
        p.addEventListener('onStateChange', (state) => {
          if (state === 1 || state === 3) applyQuality();
          if (state === 1) sessionStorage.setItem('ytee-reload-count', '0');
        });
        p.addEventListener('onPlaybackQualityChange', (q) => {
          const level = (q && q.data) || q;
          const pref = currentSettings.preferredQuality;
          if (!pref || pref === 'auto') return;
          const vid = (() => { try { return getVideoId(p); } catch (e) { return null; } })();
          if (vid && qualityAppliedFor === vid && typeof level === 'string' && level !== pref
              && QUALITY_ORDER.indexOf(level) > -1
              && QUALITY_ORDER.indexOf(level) < QUALITY_ORDER.indexOf(pref)) {
            qualityOverriddenFor = vid;
          }
        });
      };

      const tryHookQuality = () => {
        const p = getPlayer();
        if (p && typeof p.addEventListener === 'function') {
          hookPlayerEvents();
          applyQuality();
          return;
        }
        let qualityHookTimer = null;
        const qualityObs = new MutationObserver(() => {
          const p2 = getPlayer();
          if (p2 && typeof p2.addEventListener === 'function') {
            qualityObs.disconnect();
            clearTimeout(qualityHookTimer);
            hookPlayerEvents();
            applyQuality();
          }
        });
        qualityObs.observe(document.body || document.documentElement, { childList: true, subtree: true });
        qualityHookTimer = setTimeout(() => qualityObs.disconnect(), 10000);
      };
      tryHookQuality();

      let scriptChangeDepth = 0;
      let playerReady = false;
      setTimeout(() => { playerReady = true; }, 2500);

      const stampVisit = () => {
        const p = getPlayer();
        const vid = getVideoId(p);
        if (!vid || vid.length < 6) return;
        const now = Date.now();
        const title = getVideoTitle(p) || "";
        const channel = getVideoAuthor(p) || "";

        let updated = false;
        if (currentSettings.volumeCache && currentSettings.volumeCache[vid]) {
          currentSettings.volumeCache[vid].t = now;
          currentSettings.volumeCache[vid].title = currentSettings.volumeCache[vid].title || title;
          currentSettings.volumeCache[vid].channel = currentSettings.volumeCache[vid].channel || channel;
          updated = true;
        }
        if (currentSettings.positionCache && currentSettings.positionCache[vid]) {
          currentSettings.positionCache[vid].t = now;
          currentSettings.positionCache[vid].title = currentSettings.positionCache[vid].title || title;
          currentSettings.positionCache[vid].channel = currentSettings.positionCache[vid].channel || channel;
          updated = true;
        }
        if (currentSettings.miniStatsCache && currentSettings.miniStatsCache[vid]) {
          currentSettings.miniStatsCache[vid].t = now;
          currentSettings.miniStatsCache[vid].title = currentSettings.miniStatsCache[vid].title || title;
          currentSettings.miniStatsCache[vid].channel = currentSettings.miniStatsCache[vid].channel || channel;
          updated = true;
        }

        if (!updated && currentSettings.enableVolumeCache) {
          if (!currentSettings.volumeCache) currentSettings.volumeCache = {};
          currentSettings.volumeCache[vid] = { v: targetVolume, title, channel, t: now };
          updated = true;
        }

        if (updated) saveStoredSettings(currentSettings);
      };

      setTimeout(stampVisit, 3000);

      const { gistRequest, syncGist, trySyncWithLock } = createGistSync({
        getSettings: () => currentSettings,
        onBackgroundSynced: () => {
          if (settingsModal && settingsModal.classList.contains('show') && isHistoryTabActive()) { try { renderHistoryTab(); historyTabDirty = false; } catch (e) { } }
          else historyTabDirty = true;
        },
      });

      const startupJitter = Math.floor(Math.random() * 60000);
      let gistSyncStartTimer = null, gistSyncIntervalId = null;
      gistSyncStartTimer = setTimeout(() => {
        const intervalMs = (currentSettings.gistSyncInterval || 180) * 60 * 1000;
        trySyncWithLock();
        gistSyncIntervalId = setInterval(trySyncWithLock, intervalMs);
      }, startupJitter);

      let audioContext = null, gainNode = null, recordingGain = null, mediaSource = null, audioSetupFailed = false;
      let activeStream = null, clipAudioDestination = null, audioHooked = false;
      let volTimeout, speedTimeout, controlsTimeout, clipRafId = null;
      let lastMouseMoveTime = 0;
      const SLEEP_FADE_MS = 20000;
      let sleepFading = false, sleepFadeStartVol = 1;
      const MOUSE_THROTTLE_MS = 100;

      const RecordingState = { IDLE: 'idle', CLIPPING: 'clipping', REPLAYING: 'replaying' };
      let activeRecordingState = RecordingState.IDLE;

      const getBoostLevel = () => currentSettings.enableVolumeBoost ? Math.max(1, Number(currentSettings.volumeBoostLevel) || 1) : 1;

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
          yteeWarn('Web Audio setup failed', e);
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
        volumeLockUntil = Date.now() + VOLUME_LOCK_MS;
        try {
          targetVolume = Math.min(1, Math.max(0, volume));
          targetMuted = muted;
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
          if (currentSettings.enableVolumeBoost && gainNode) setGain();
        } finally { scriptChangeDepth--; }
      };

      const applyVolume = (newVol) => {
        const clamped = Math.min(1, Math.max(0, Math.round(newVol * 100) / 100));
        applyAudioState(clamped, clamped === 0);
        vol.value = clamped;
        showVolumePercent(clamped === 0 ? 0 : clamped);
        const p = getPlayer();
        const vid = getVideoId(p);
        if (vid && currentSettings.enableVolumeCache) {
          const title = getVideoTitle(p) || "";
          const channel = getVideoAuthor(p) || "";
          const existing = currentSettings.volumeCache[vid];
          currentSettings.volumeCache[vid] = { v: clamped, title, channel, t: existing?.t || 0 };
          saveStoredSettings(currentSettings);
          scheduleHistoryRender();
        }
      };

      const toggleMute = () => {
        const newMuted = !targetMuted;
        applyAudioState(targetVolume, newMuted);
        muteBtn.classList.toggle("muted", newMuted);
        showVolumePercent(newMuted ? 0 : targetVolume);
      };

      const volPct = Object.assign(document.createElement("div"), { id: "custom-vol-overlay", className: "ytee-overlay" });
      const showVolumePercent = (volume) => {
        const text = Math.round(volume * 100) + "%";
        if (volPct.textContent !== text) volPct.textContent = text;
        volPct.classList.add("show");
        clearTimeout(volTimeout);
        volTimeout = setTimeout(() => volPct.classList.remove("show"), 1500);
      };

      const speedOverlay = Object.assign(document.createElement("div"), { id: "custom-speed-overlay", className: "ytee-overlay" });
      const showSpeedOverlay = (rate) => {
        const text = rate + "x";
        if (speedOverlay.textContent !== text) speedOverlay.textContent = text;
        speedOverlay.classList.add("show");
        clearTimeout(speedTimeout);
        speedTimeout = setTimeout(() => speedOverlay.classList.remove("show"), 1500);
      };

      const muteBtn = Object.assign(document.createElement("button"), { id: "custom-mute-btn" });
      muteBtn.addEventListener("click", toggleMute);

      const vol = Object.assign(document.createElement("input"), {
        id: "custom-vol-slider", type: "range", min: 0, max: 1, step: 0.01, value: video.volume,
      });
      vol.addEventListener("input", () => applyVolume(Number(vol.value)));

      let __lastSeenVideoVol = -1, __lastSeenVideoMuted = null;
      const onVideoVolumeChange = () => {
        if (sleepFading) return;
        if (scriptChangeDepth > 0) return;
        if (!playerReady) return;
        if (Date.now() < volumeLockUntil) return;
        const newMuted = video.muted;
        const newVol = video.volume;
        if (newMuted === __lastSeenVideoMuted && Math.abs(newVol - __lastSeenVideoVol) < 0.005) return;
        __lastSeenVideoMuted = newMuted;
        __lastSeenVideoVol = newVol;
        targetMuted = newMuted;
        if (!newMuted) targetVolume = newVol;
        muteBtn.classList.toggle("muted", targetMuted);
        const displayVol = targetMuted ? 0 : targetVolume;
        if (Number(vol.value) !== displayVol) vol.value = displayVol;
        if (gainNode) setGain();
        showVolumePercent(displayVol);
        if (currentSettings.enableVolumeCache) {
          const p = getPlayer();
          const vid = getVideoId(p);
          if (vid) {
            const existing = currentSettings.volumeCache[vid];
            if (!existing || Math.round((existing.v || 0) * 100) !== Math.round(targetVolume * 100)) {
              const title = (existing && existing.title) || getVideoTitle(p) || "";
              const channel = (existing && existing.channel) || getVideoAuthor(p) || "";
              currentSettings.volumeCache[vid] = { v: targetVolume, title, channel, t: existing?.t || 0 };
              saveStoredSettings(currentSettings);
              scheduleHistoryRender();
            }
          }
        }
      };
      video.addEventListener('volumechange', onVideoVolumeChange);

      let isHoveringSpeedBtn = false;
      let pendingWheelDelta = 0, wheelRafId = 0, lastWheelShift = false;
      const onWheel = (e) => {
        if (isSettingsOpen) {
          if (settingsContent && settingsContent.contains(e.target)) return;
          e.stopImmediatePropagation(); e.preventDefault(); return;
        }
        if (document.hidden) return;
        if (isAnnotPanelOpen() && getAnnotPanel() && getAnnotPanel().contains(e.target)) return;
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
            applySpeed(getTargetSpeed() + (delta > 0 ? -step : step));
          } else if (shouldHandleVolume) {
            applyVolume(targetVolume + (delta > 0 ? -(currentSettings.volumeStep / 100) : (currentSettings.volumeStep / 100)));
          }
        });
      };
      document.documentElement.addEventListener("wheel", onWheel, { passive: false });

      const { miniStats, statsBtn, toggleStats, toggleMiniStats, applyMiniStatsPos, disposeStats } = createStats({
        video, getPlayer, getSettings: () => currentSettings, isCurrentlyLive,
        scheduleHistoryRender: () => scheduleHistoryRender(),
      });

      const { speedBtn, applySpeed, getTargetSpeed } = createSpeedControl({
        video, showSpeedOverlay,
        setHoveringSpeedBtn: (v) => { isHoveringSpeedBtn = v; },
      });

      // Screenshot
      const screenshotBtn = mkBtn('custom-screenshot-btn', 'screenshot', 'Snap', 'Take Screenshot (Ctrl = Save)');
      screenshotBtn.addEventListener("click", (e) => {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth; canvas.height = video.videoHeight;
        canvas.getContext("2d", { alpha: false }).drawImage(video, 0, 0);
        const author = getVideoAuthorForFile(getPlayer());
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
                flashBtnResult(screenshotBtn, '✓ Saved!', 'success');
              });
          } else {
            if (!e.ctrlKey) download();
            flashBtnResult(screenshotBtn, '✓ Saved!', 'success');
          }
        }, "image/png");
      });

      // Clip
      const clipOverlay = Object.assign(document.createElement('div'), { id: 'custom-clip-overlay', className: 'ytee-overlay' });
      const clipBtn = mkBtn('custom-clip-btn', 'clip', 'Clip', 'Record Clip (Ctrl = Long)');
      let clipRecorder = null;

      const CLIP_BPP_MAP = [
        [426 * 240, 0.250, 0.350], [640 * 360, 0.200, 0.300], [854 * 480, 0.170, 0.250],
        [1280 * 720, 0.140, 0.200], [1920 * 1080, 0.110, 0.160], [2560 * 1440, 0.080, 0.120], [3840 * 2160, 0.060, 0.090],
      ];
      const CLIP_H264_BPP_MAP = [
        [426 * 240, 0.150, 0.210], [640 * 360, 0.120, 0.180], [854 * 480, 0.100, 0.150],
        [1280 * 720, 0.085, 0.120], [1920 * 1080, 0.065, 0.096], [2560 * 1440, 0.048, 0.072], [3840 * 2160, 0.036, 0.054],
      ];

      const remuxToMp4 = async (chunks, mimeType) => {
        const MB = __ytee_loadMediabunny();
        if (!MB) throw new Error('Mediabunny library not loaded');
        const blobs = chunks.map(c => c.data).filter(b => b instanceof Blob && b.size > 0);
        if (blobs.length === 0) throw new Error('remuxToMp4: no valid chunks to remux');
        const rawBlob = new Blob(blobs, { type: mimeType });
        const { Input, Output, Conversion, BlobSource, BufferTarget, Mp4OutputFormat,
          Mp4InputFormat, QuickTimeInputFormat, MatroskaInputFormat, WebMInputFormat } = MB;
        const RECORDING_FORMATS = [
          new Mp4InputFormat(), new QuickTimeInputFormat(),
          new MatroskaInputFormat(), new WebMInputFormat(),
        ];
        const input = new Input({ source: new BlobSource(rawBlob), formats: RECORDING_FORMATS });
        const output = new Output({ format: new Mp4OutputFormat(), target: new BufferTarget() });
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

        const map = isMP4 ? CLIP_H264_BPP_MAP : CLIP_BPP_MAP;
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
            yteeWarn('YTEE: captureStream returned no tracks');
            activeRecordingState = RecordingState.IDLE;
            setBtnLabel(clipBtn, '✗ Not Ready'); setTimeout(() => setBtnLabel(clipBtn), 2000); return;
          }
        } catch (e) {
          yteeWarn('YTEE: captureStream failed', e);
          activeRecordingState = RecordingState.IDLE;
          setBtnLabel(clipBtn, '✗ Error'); setTimeout(() => setBtnLabel(clipBtn), 2000); return;
        }

        const chunks = [];
        let recorder;
        try {
          recorder = new MediaRecorder(activeStream, { mimeType, videoBitsPerSecond, audioBitsPerSecond: 192_000 });
        } catch (e) {
          yteeWarn('YTEE: MediaRecorder init failed', e);
          if (activeStream) activeStream.getTracks().forEach(t => t.stop()); activeStream = null;
          activeRecordingState = RecordingState.IDLE;
          setBtnLabel(clipBtn, '✗ Error'); setTimeout(() => setBtnLabel(clipBtn), 2000); return;
        }

        let clipInitChunk = null;
        recorder.ondataavailable = (ev) => {
          if (!ev.data || ev.data.size === 0) return;
          const chunk = { data: ev.data, time: performance.now() };
          if (!clipInitChunk) { clipInitChunk = chunk; } else { chunks.push(chunk); }
        };
        recorder.onstop = async () => {
          const fullChunks = clipInitChunk ? [clipInitChunk, ...chunks] : chunks;
          if (fullChunks.length === 0) { setBtnLabel(clipBtn, '✗ Empty'); setTimeout(() => setBtnLabel(clipBtn), 1500); return; }
          setBtnLabel(clipBtn, 'Processing...');
          try {
            const mp4Blob = await remuxToMp4(fullChunks, mimeType);
            const author = getVideoAuthorForFile(getPlayer());
            const timestamp = formatTimestamp(video.currentTime);
            const objUrl = URL.createObjectURL(mp4Blob);
            const a = document.createElement('a');
            a.href = objUrl; a.download = `${author}_${timestamp}.mp4`; a.click();
            URL.revokeObjectURL(objUrl);
            setBtnLabel(clipBtn, '✓ Saved!');
          } catch (e) {
            console.error('YTEE: remux failed', e);
            setBtnLabel(clipBtn, '✗ Error');
          }
          setTimeout(() => setBtnLabel(clipBtn), 2000);
        };
        recorder.onerror = (ev) => {
          yteeWarn('YTEE: MediaRecorder error', ev);
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

      // Instant Replay
      const replayOverlay = Object.assign(document.createElement('div'), { id: 'custom-replay-overlay', className: 'ytee-overlay' });
      const replayBtn = mkBtn('custom-replay-btn', 'rewind', 'Replay', 'Instant Replay \u2022 Right-click = stop', 'Instant Replay');

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
        if (keepFrom > 0) replayChunks.splice(0, keepFrom);
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
          video.addEventListener('loadedmetadata', () => { replayWaiting = false; startInstantReplay(); }, { once: true });
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
              yteeLog(`YTEE: Instant Replay waiting for stream tracks (attempt ${replayRetryCount})...`);
              replayWaiting = true;
              setTimeout(() => { replayWaiting = false; startInstantReplay(); }, 1000);
            } else {
              yteeWarn('YTEE: Instant Replay failed to find tracks after multiple attempts.');
            }
            return;
          }
          replayRetryCount = 0;
          const qualityMap = {
            'very low': { v: 1_000_000, a: 96_000 }, 'low': { v: 2_500_000, a: 128_000 },
            'medium': { v: 5_000_000, a: 192_000 }, 'high': { v: 10_000_000, a: 256_000 },
            'very high': { v: 20_000_000, a: 320_000 }
          };
          const q = qualityMap[currentSettings.instantReplayQuality] || qualityMap['medium'];
          replayRecorder = new MediaRecorder(replayStream, { mimeType: replayMimeType, videoBitsPerSecond: q.v, audioBitsPerSecond: q.a });
          replayChunks = [];
          replayInitChunk = null;
          replayRecorder.ondataavailable = (ev) => {
            if (!ev.data || ev.data.size === 0) return;
            const chunk = { data: ev.data, time: performance.now() };
            if (!replayInitChunk) { replayInitChunk = chunk; } else { replayChunks.push(chunk); pruneReplayChunks(); }
          };
          replayRecorder.onerror = (ev) => { yteeWarn('YTEE: Instant Replay recorder error', ev); stopInstantReplay(); };
          replayRecorder.start(1920);
          replayActive = true;
          activeRecordingState = RecordingState.REPLAYING;
          replayBtn.classList.add('buffering');
          yteeLog('YTEE: Instant Replay started');
          setBtnLabel(replayBtn, 'Started');
          setTimeout(() => setBtnLabel(replayBtn), 1500);
        } catch (e) {
          yteeWarn('YTEE: Instant Replay start failed', e);
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
          flashBtnResult(replayBtn, '✗ N/A', 'error');
          return;
        }
        pruneReplayChunks();
        if (!replayInitChunk && replayChunks.length === 0) {
          flashBtnResult(replayBtn, '✗ Empty', 'error');
          return;
        }
        const chunksSnapshot = replayInitChunk ? [replayInitChunk, ...replayChunks] : [...replayChunks];
        const mimeSnapshot = replayMimeType;
        const author = getVideoAuthorForFile(getPlayer());
        const timestamp = formatTimestamp(video.currentTime);
        if (replayRecorder && replayRecorder.state === 'recording') {
          const onFinalChunk = async (ev) => {
            replayRecorder.removeEventListener('dataavailable', onFinalChunk);
            if (ev.data && ev.data.size > 0) chunksSnapshot.push({ data: ev.data, time: performance.now() });
            replayChunks = [];
            await assembleAndDownload(chunksSnapshot, mimeSnapshot, author, timestamp);
          };
          replayRecorder.addEventListener('dataavailable', onFinalChunk);
          try { replayRecorder.requestData(); } catch (e) {
            replayRecorder.removeEventListener('dataavailable', onFinalChunk);
            await assembleAndDownload(chunksSnapshot, mimeSnapshot, author, timestamp);
          }
        } else {
          await assembleAndDownload(chunksSnapshot, mimeSnapshot, author, timestamp);
        }
      };

      const assembleAndDownload = async (chunks, mimeType, author, timestamp) => {
        if (chunks.length === 0) {
          flashBtnResult(replayBtn, '✗ Empty', 'error');
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
        if (!replayActive) { startInstantReplay(); } else { saveInstantReplay(); }
      });
      replayBtn.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (replayActive) { stopInstantReplay(); setBtnLabel(replayBtn, 'Stopped'); setTimeout(() => setBtnLabel(replayBtn), 1500); }
        else { startInstantReplay(); }
      });

      const { pipBtn, pipSupported } = createPipButton({ video });
      const { urlBtn } = createUrlButton({ video, getPlayer });
      const { wlBtn, clearInnertubeCache } = createWatchLater({ uw, getPlayer });

      const toggleBtn = mkBtn('custom-toggle-btn', currentSettings.isCollapsed ? 'expand' : 'hide', '', 'Collapse UI', null, false);
      toggleBtn.addEventListener('click', () => {
        currentSettings.isCollapsed = !currentSettings.isCollapsed;
        saveStoredSettings(currentSettings);
        applyUIStates(currentSettings);
      });

      const { annotBtn, ensureAnnot, persistAnnot, addBookmarkAtCurrent, closeAnnotPanel, isAnnotPanelOpen, getAnnotPanel } = createBookmarks({
        video, getPlayer, getSettings: () => currentSettings,
        scheduleHistoryRender: () => scheduleHistoryRender(),
        showControls: () => showControls(),
      });

      // Settings Modal
      const settingsBtn = mkBtn('custom-settings-btn', 'settings', '', 'Settings', 'Settings Menu', false);
      let settingsModal = null;
      let settingsContent = null;
      let isSettingsOpen = false;
      const tabContents = {};
      let historyTabDirty = false;
      const isHistoryTabActive = () => !!tabContents['tab-history']?.classList.contains('active');

      let settingsShellBuilt = false;
      const buildSettingsShell = () => {
        if (settingsShellBuilt) return;
        settingsShellBuilt = true;

        settingsModal = document.createElement("div");
        settingsModal.id = "custom-settings-modal";

        settingsContent = document.createElement("div");
        settingsContent.id = "custom-settings-content";

        const settingsHeader = Object.assign(document.createElement("div"), { id: "ytee-settings-header" });
        const headerTitleWrap = document.createElement('div');
        const settingsTitle = Object.assign(document.createElement("h2"), { textContent: "YouTube Embed Enhancer" });
        const settingsSubtitle = Object.assign(document.createElement("p"), { id: "ytee-settings-subtitle", textContent: "Customize your experience" });
        headerTitleWrap.append(settingsTitle, settingsSubtitle);

        const infoBtn = Object.assign(document.createElement('div'), { className: 'ytee-info-btn', title: 'Information' });
        infoBtn.appendChild(ICON_DEFS.info());

        const fsBtn = Object.assign(document.createElement('div'), { className: 'ytee-info-btn', title: 'Fullscreen', style: 'margin-left: 8px;' });
        fsBtn.appendChild(ICON_DEFS.fullscreen());
        fsBtn.addEventListener('click', () => {
          if (!document.fullscreenElement) {
            settingsModal.requestFullscreen().catch(err => yteeWarn("Fullscreen request failed", err));
          } else {
            document.exitFullscreen().catch(() => { });
          }
        });

        settingsHeader.append(headerTitleWrap, infoBtn, fsBtn);

        const infoBox = Object.assign(document.createElement('div'), { className: 'ytee-info-box' });
        const mkInfoRow = (title, text) => {
          const p = document.createElement('p');
          const s = Object.assign(document.createElement('strong'), { textContent: title });
          p.append(s, document.createTextNode(' ' + text));
          return p;
        };
        const statsTitle = document.createElement('div');
        statsTitle.className = 'ytee-info-title';
        statsTitle.textContent = 'Mini Stats Info';
        const linksContainer = document.createElement('div');
        linksContainer.className = 'ytee-info-links';
        linksContainer.append(
          Object.assign(document.createElement('a'), {
            href: 'https://github.com/jmpatag/YouTube-Embed-Enhancer',
            target: '_blank', rel: 'noopener noreferrer', className: 'ytee-info-link', textContent: 'GitHub Source'
          }),
          Object.assign(document.createElement('a'), {
            href: 'https://greasyfork.org/en/scripts/572481-youtube-embed-enhancer',
            target: '_blank', rel: 'noopener noreferrer', className: 'ytee-info-link', textContent: 'Greasy Fork'
          })
        );
        infoBox.append(
          statsTitle,
          mkInfoRow('Speed', 'How fast your internet is. Higher = smoother high-quality video.'),
          mkInfoRow('Buffer', "Pre-loaded video 'cushion'. If this hits 0, the video will pause to load."),
          mkInfoRow('Latency', 'Your delay from live. Lower = closer to real-time.'),
          mkInfoRow('Drop', 'If this rises, your PC is struggling and the video will look laggy or stutter.'),
          linksContainer
        );
        infoBtn.addEventListener('click', () => infoBox.classList.toggle('show'));

        // Tabs
        const tabsContainer = Object.assign(document.createElement('div'), { id: 'ytee-settings-tabs' });
        const tabItems = [
          { id: 'tab-general', label: 'General' },
          { id: 'tab-tools', label: 'Tools' },
          { id: 'tab-interface', label: 'Interface' },
          { id: 'tab-hotkeys', label: 'Hotkeys' },
          { id: 'tab-history', label: 'History' }
        ];
        const tabs = {};

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
            const items = document.getElementById('custom-settings-items');
            if (items) items.scrollTop = 0;
            if (item.id === 'tab-history' && historyTabDirty) { renderHistoryTab(); historyTabDirty = false; }
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
        const restoreBtn = Object.assign(document.createElement("button"), {
          id: "custom-settings-restore", textContent: "Restore defaults",
          title: "Reset every option and the Mini Stats window position to defaults. Keeps your saved history (volumes, positions, favorites, notes)."
        });
        const resetHotkeysBtn = Object.assign(document.createElement("button"), {
          id: "custom-settings-reset-hotkeys", textContent: "Reset hotkeys", title: "Restore every key binding to its default"
        });
        const clearDataBtn = Object.assign(document.createElement("button"), {
          id: "custom-settings-clear-data", textContent: "Clear data…",
          title: "Delete saved data by category — volumes, playback positions, favorites, notes, Mini Stats — on this device and optionally your Gist. Also covers the Mini Stats window position and the Watch Later login cache."
        });
        const cancelBtn = Object.assign(document.createElement("button"), { id: "custom-settings-cancel", textContent: "Cancel" });
        const saveBtn = Object.assign(document.createElement("button"), { id: "custom-settings-save", textContent: "Save changes" });
        const advWrap = Object.assign(document.createElement("details"), { className: "ytee-adv" });
        const advTray = Object.assign(document.createElement("div"), { className: "ytee-adv-tray" });
        advTray.append(restoreBtn, resetHotkeysBtn, clearDataBtn);
        advWrap.append(Object.assign(document.createElement("summary"), { textContent: "Advanced" }), advTray);
        settingsButtons.append(advWrap, cancelBtn, saveBtn);

        const clearDataOverlay = Object.assign(document.createElement("div"), { id: "ytee-cleardata-overlay" });
        const clearDataPanel = Object.assign(document.createElement("div"), { id: "ytee-cleardata-panel" });
        clearDataOverlay.appendChild(clearDataPanel);
        const closeClearData = () => clearDataOverlay.classList.remove('show');
        clearDataOverlay.addEventListener('click', (e) => { if (e.target === clearDataOverlay) closeClearData(); });

        const mkClrRow = (key, label, getCount, checked) => {
          const row = Object.assign(document.createElement('label'), { className: 'ytee-clr-row' });
          const cb = Object.assign(document.createElement('input'), { type: 'checkbox', checked });
          cb.dataset.clr = key;
          row.append(cb, Object.assign(document.createElement('span'), { className: 'ytee-clr-name', textContent: label }));
          const n = getCount();
          if (n !== null) {
            row.append(Object.assign(document.createElement('span'), { className: 'ytee-clr-count', textContent: String(n) }));
            if (n === 0) { cb.checked = false; cb.disabled = true; row.classList.add('empty'); }
          }
          return row;
        };

        const buildClearDataPanel = () => {
          clearDataPanel.textContent = '';
          clearDataPanel.append(
            Object.assign(document.createElement('div'), { className: 'ytee-clr-title', textContent: 'Clear saved data' }),
            Object.assign(document.createElement('div'), { className: 'ytee-clr-sub', textContent: 'Ticked items are deleted. This cannot be undone.' }),
            Object.assign(document.createElement('div'), { className: 'ytee-clr-head', textContent: 'History (shown in the History tab)' }),
          );
          [
            ['volumeCache', 'Volumes', () => Object.keys(currentSettings.volumeCache || {}).length],
            ['positionCache', 'Playback positions', () => Object.keys(currentSettings.positionCache || {}).length],
            ['favoritesCache', 'Favorites', () => Object.keys(currentSettings.favoritesCache || {}).length],
            ['annotationsCache', 'Notes', () => Object.keys(currentSettings.annotationsCache || {}).length],
            ['miniStatsCache', 'Mini Stats toggles', () => Object.keys(currentSettings.miniStatsCache || {}).length],
          ].forEach(([k, label, cnt]) => clearDataPanel.append(mkClrRow(k, label, cnt, true)));

          const gistConfigured = currentSettings.enableGistSync && currentSettings.gistToken && currentSettings.gistId;
          if (gistConfigured) {
            const gr = Object.assign(document.createElement('label'), { className: 'ytee-clr-row' });
            const gcb = Object.assign(document.createElement('input'), { type: 'checkbox', checked: true });
            gcb.dataset.clr = 'gist';
            gr.append(gcb, Object.assign(document.createElement('span'), { className: 'ytee-clr-name', textContent: 'Also push the change to your Gist' }));
            clearDataPanel.append(gr);
          }

          clearDataPanel.append(Object.assign(document.createElement('div'), { className: 'ytee-clr-head', textContent: 'Other' }));
          clearDataPanel.append(mkClrRow('miniStatsPos', 'Mini Stats window position', () => currentSettings.miniStatsPos ? 1 : 0, false));
          const wr = Object.assign(document.createElement('label'), { className: 'ytee-clr-row' });
          const wcb = Object.assign(document.createElement('input'), { type: 'checkbox', checked: false });
          wcb.dataset.clr = 'innertube';
          wr.append(wcb, Object.assign(document.createElement('span'), { className: 'ytee-clr-name', textContent: 'Watch Later login cache' }));
          clearDataPanel.append(wr);

          const foot = Object.assign(document.createElement('div'), { className: 'ytee-clr-foot' });
          const cancelSelBtn = Object.assign(document.createElement('button'), { className: 'ytee-clr-cancel', textContent: 'Cancel' });
          const clearSelBtn = Object.assign(document.createElement('button'), { className: 'ytee-clr-go', textContent: 'Clear selected' });
          cancelSelBtn.addEventListener('click', closeClearData);
          clearSelBtn.addEventListener('click', () => {
            const checked = [...clearDataPanel.querySelectorAll('input[data-clr]:checked')].map(c => c.dataset.clr);
            if (checked.length === 0) { closeClearData(); return; }
            ['volumeCache', 'positionCache', 'favoritesCache', 'annotationsCache', 'miniStatsCache'].forEach(k => {
              if (checked.includes(k)) currentSettings[k] = {};
            });
            if (checked.includes('miniStatsPos')) {
              currentSettings.miniStatsPos = null;
              try { if (miniStats && miniStats.style) { miniStats.style.left = ''; miniStats.style.top = ''; miniStats.style.bottom = '45px'; } } catch (e) { }
            }
            if (checked.includes('innertube')) clearInnertubeCache();
            saveStoredSettings(currentSettings, { immediate: true });
            if (isHistoryTabActive()) { try { renderHistoryTab(); } catch (e) { } historyTabDirty = false; } else { historyTabDirty = true; }

            if (checked.includes('gist') && gistConfigured) {
              clearSelBtn.disabled = true; cancelSelBtn.disabled = true;
              clearSelBtn.textContent = 'Updating Gist…';
              gistRequest('PATCH', currentSettings.gistId, currentSettings.gistToken, {
                files: { 'ytee-history.json': { content: JSON.stringify({
                  ytee_history_export: true,
                  volumeCache: currentSettings.volumeCache,
                  positionCache: currentSettings.positionCache,
                  miniStatsCache: currentSettings.miniStatsCache,
                  favoritesCache: currentSettings.favoritesCache,
                  annotationsCache: currentSettings.annotationsCache,
                }, null, 2) } }
              }).then((r) => {
                const ok = r.status === 200 || r.status === 201;
                if (ok) { currentSettings.gistSyncLastTime = Date.now(); saveStoredSettings(currentSettings, { immediate: true }); }
                clearSelBtn.textContent = ok ? 'Cleared ✓' : 'Local done · Gist failed';
                setTimeout(closeClearData, ok ? 650 : 1900);
              }).catch(() => {
                clearSelBtn.textContent = 'Local done · Gist failed';
                setTimeout(closeClearData, 1900);
              });
            } else {
              clearSelBtn.textContent = 'Cleared ✓';
              setTimeout(closeClearData, 550);
            }
          });
          foot.append(cancelSelBtn, clearSelBtn);
          clearDataPanel.append(foot);
        };
        clearDataBtn.addEventListener('click', () => { buildClearDataPanel(); clearDataOverlay.classList.add('show'); });

        settingsContent.append(settingsHeader, tabsContainer, infoBox, settingsItems, settingsButtons, clearDataOverlay);
        settingsModal.appendChild(settingsContent);
        document.body.appendChild(settingsModal);

        cancelBtn.addEventListener('click', hideSettingsModal);

        let restoreConfirmTimeout = null;
        restoreBtn.addEventListener('click', () => {
          if (!restoreBtn.classList.contains('confirm')) {
            restoreBtn.classList.add('confirm');
            restoreBtn.textContent = 'Confirm reset?';
            restoreConfirmTimeout = setTimeout(() => { restoreBtn.classList.remove('confirm'); restoreBtn.textContent = 'Restore defaults'; }, 3000);
            return;
          }
          clearTimeout(restoreConfirmTimeout);
          restoreBtn.classList.remove('confirm');
          const preserved = { volumeCache: currentSettings.volumeCache, positionCache: currentSettings.positionCache, miniStatsCache: currentSettings.miniStatsCache, favoritesCache: currentSettings.favoritesCache, annotationsCache: currentSettings.annotationsCache };
          currentSettings = Object.assign(structuredClone(defaultSettings), preserved);
          saveStoredSettings(currentSettings, { immediate: true });
          try {
            if (miniStats && miniStats.style) { miniStats.style.left = ''; miniStats.style.top = ''; miniStats.style.bottom = '45px'; }
          } catch (e) { }
          applyUIStates(currentSettings);
          restoreBtn.classList.add('success');
          restoreBtn.textContent = 'Restored!'; restoreBtn.disabled = true;
          setTimeout(() => {
            restoreBtn.classList.remove('success');
            restoreBtn.textContent = 'Restore defaults';
            restoreBtn.disabled = false;
            if (settingsModal.classList.contains('show')) showSettingsModal();
          }, 1500);
        });

        let resetHkConfirmTimeout = null;
        resetHotkeysBtn.addEventListener('click', () => {
          if (!resetHotkeysBtn.classList.contains('confirm')) {
            resetHotkeysBtn.classList.add('confirm');
            resetHotkeysBtn.textContent = 'Confirm reset?';
            resetHkConfirmTimeout = setTimeout(() => { resetHotkeysBtn.classList.remove('confirm'); resetHotkeysBtn.textContent = 'Reset hotkeys'; }, 3000);
            return;
          }
          clearTimeout(resetHkConfirmTimeout);
          resetHotkeysBtn.classList.remove('confirm');
          Object.keys(defaultSettings.hotkeys).forEach(k => {
            const el = document.getElementById(`hk-${k}`);
            if (el) el.value = defaultSettings.hotkeys[k];
          });
          refreshHkConflicts();
          resetHotkeysBtn.classList.add('success');
          resetHotkeysBtn.textContent = 'Reset!'; resetHotkeysBtn.disabled = true;
          setTimeout(() => { resetHotkeysBtn.classList.remove('success'); resetHotkeysBtn.textContent = 'Reset hotkeys'; resetHotkeysBtn.disabled = false; }, 1500);
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
          const hotkeysChanged = Object.keys(defaultSettings.hotkeys).some(
            k => (currentSettings.hotkeys[k] || '') !== (newSettings.hotkeys[k] || '')
          );
          if (hotkeysChanged && refreshHkConflicts()) {
            [...document.querySelectorAll('#ytee-settings-tabs .ytee-tab')].find(t => t.textContent.trim() === 'Hotkeys')?.click();
            const prev = saveBtn.textContent;
            saveBtn.textContent = 'Fix hotkey conflicts first';
            saveBtn.style.background = '#ff4444';
            setTimeout(() => { saveBtn.textContent = prev; saveBtn.style.background = ''; }, 2200);
            return;
          }
          newSettings.volumeBoostLevel = Number(document.getElementById('volume-boost-level').value) || 1;
          newSettings.enableVolumeBoost = document.getElementById('ytee-enable-volume-boost').checked;
          newSettings.enableScrollVolume = document.getElementById('ytee-enable-scroll-volume').checked;
          newSettings.enableVolumeCache = document.getElementById('ytee-enable-volume-cache').checked;
          newSettings.enablePositionCache = document.getElementById('ytee-enable-position-cache').checked;
          newSettings.volumeStep = Math.min(100, Math.max(1, Number(document.getElementById('ytee-volume-step').value) || 5));
          const rawVol = document.getElementById('ytee-initial-volume').value;
          const parsedVol = Number(rawVol);
          newSettings.initialVolume = Math.min(100, Math.max(0, rawVol === '' || isNaN(parsedVol) ? 100 : parsedVol));
          newSettings.clipDuration = Math.min(300, Math.max(1, Number(document.getElementById('clip-duration').value) || 5));
          newSettings.clipDurationCtrl = Math.min(300, Math.max(1, Number(document.getElementById('clip-duration-ctrl').value) || 300));
          newSettings.instantReplayDuration = Math.min(60, Math.max(1, Number(document.getElementById('replay-duration').value) || 30));
          newSettings.instantReplayQuality = document.getElementById('replay-quality').value || 'medium';
          newSettings.preferredQuality = document.getElementById('preferred-quality').value || 'auto';
          newSettings.sleepTimer = (() => { const el = document.getElementById('ytee-sleep-timer'); return el ? el.value : 'off'; })();
          newSettings.sleepTimerCustom = (() => { const el = document.getElementById('ytee-sleep-custom'); const n = el ? Math.round(Number(el.value)) : NaN; return (Number.isFinite(n) && n >= 1) ? Math.min(1440, n) : (currentSettings.sleepTimerCustom || 120); })();
          newSettings.sleepTimerReset = (() => { const el = document.getElementById('ytee-sleep-reset'); return el ? el.value : 'playback'; })();
          newSettings.sleepTimerFadeOut = (() => { const el = document.getElementById('ytee-sleep-fade'); return el ? el.checked : false; })();
          newSettings.compactMode = document.getElementById('ytee-compact-mode').checked;
          newSettings.highContrastUI = document.getElementById('ytee-high-contrast').checked;
          newSettings.enableBlur = (() => { const el = document.getElementById('ytee-enable-blur'); return el ? el.checked : true; })();
          newSettings.alwaysShowMiniStats = document.getElementById('ytee-always-show-mini-stats').checked;
          newSettings.enableGistSync = (() => { const el = document.getElementById('ytee-enable-gist-sync'); return el ? el.checked : false; })();
          newSettings.gistToken = (() => { const el = document.getElementById('ytee-gist-token'); return el ? el.value.trim() : ''; })();
          newSettings.gistId = (() => { const el = document.getElementById('ytee-gist-id'); return el ? el.value.trim() : ''; })();
          newSettings.gistSyncLastTime = currentSettings.gistSyncLastTime || 0;
          newSettings.gistSyncInterval = (() => { const el = document.getElementById('ytee-gist-sync-interval'); return el ? Number(el.value) : 180; })();
          newSettings.volumeCache = newSettings.enableVolumeCache ? (currentSettings.volumeCache || {}) : {};
          newSettings.positionCache = newSettings.enablePositionCache ? (currentSettings.positionCache || {}) : {};
          newSettings.miniStatsCache = currentSettings.miniStatsCache || {};
          newSettings.miniStatsPos = currentSettings.miniStatsPos;
          newSettings.favoritesCache = currentSettings.favoritesCache || {};
          newSettings.annotationsCache = currentSettings.annotationsCache || {};
          newSettings.historyViewMode = historyViewMode;
          newSettings.isCollapsed = currentSettings.isCollapsed;
          historyViewMode = newSettings.historyViewMode;
          currentSettings = newSettings;
          saveStoredSettings(currentSettings, { immediate: true });
          buildHotkeyMap();
          applyVolume(targetVolume);
          applyQuality(true);
          armSleepTimer({ fresh: true });
          applyUIStates(currentSettings);
          updateButtonVisibility();
          if (replayActive) { stopInstantReplay(); setTimeout(startInstantReplay, 200); }
          saveBtn.textContent = 'Saved'; saveBtn.disabled = true;
          setTimeout(() => { hideSettingsModal(); saveBtn.textContent = 'Save'; saveBtn.disabled = false; }, 350);
        });
      };

      const mkSection = (title) => Object.assign(document.createElement('h3'), { className: 'setting-section-title', textContent: title });
      const mkNote = (text) => Object.assign(document.createElement('div'), { className: 'setting-note', textContent: text });

      const mkRow = (title, desc, control) => {
        const div = Object.assign(document.createElement('div'), { className: 'setting-item' });
        const textWrap = Object.assign(document.createElement('div'), { className: 'setting-text' });
        const lbl = Object.assign(document.createElement('label'), { className: 'setting-title', textContent: title });
        const ctrlId = control && (control.id || control.querySelector?.('input,select,textarea,button')?.id);
        if (ctrlId) lbl.htmlFor = ctrlId;
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

      const mkActionBtn = (variant, label, title, color) => {
        const b = Object.assign(document.createElement('button'), {
          textContent: label, title, className: 'ytee-abtn ytee-abtn-' + variant,
        });
        if (color) b.style.color = color;
        return b;
      };

      let historyViewMode = currentSettings.historyViewMode || 'list';
      const { renderHistoryTab, scheduleHistoryRender, disposeHistoryTab } = createHistoryTab({
        getSettings: () => currentSettings,
        getSettingsModal: () => settingsModal,
        isHistoryTabActive, tabContents, ensureAnnot, persistAnnot,
        mkSection, mkNote, mkActionBtn, syncGist,
        setHistoryTabDirty: (v) => { historyTabDirty = v; },
        getHistoryViewMode: () => historyViewMode,
        setHistoryViewMode: (v) => { historyViewMode = v; },
      });

      let settingsDomBuilt = false;
      const showSettingsModal = () => {
        closeAnnotPanel();
        ensureSettingsCSS();
        buildSettingsShell();
        if (currentSettings.enableGistSync && currentSettings.gistToken && currentSettings.gistId) {
          const SYNC_COOLDOWN = (currentSettings.gistSyncInterval || 180) * 60 * 1000;
          const jitter = Math.floor(Math.random() * 10000);
          setTimeout(() => {
            const freshSettings = loadStoredSettings();
            const lastSync = freshSettings.gistSyncLastTime || 0;
            if ((Date.now() - lastSync) < SYNC_COOLDOWN) return;
            syncGist(() => {
              if (settingsModal.classList.contains('show') && isHistoryTabActive()) { try { renderHistoryTab(); historyTabDirty = false; } catch (e) { } }
              else historyTabDirty = true;
            });
          }, jitter);
        }
        if (!settingsDomBuilt) {
          Object.values(tabContents).forEach(c => { while (c.firstChild) c.removeChild(c.firstChild); });

          // General tab
          const g = tabContents['tab-general'];
          g.append(mkSection('Playback'));
          const qualitySelect = Object.assign(document.createElement('select'), { id: 'preferred-quality', className: 'ytee-quality-select' });
          g.append(mkRow('Preferred quality', 'Starting quality for each video – you can still change it from YouTube’s menu', qualitySelect));
          g.append(mkRow('Video cache', 'Remember and resume playback position (last 200 videos)', mkToggle('ytee-enable-position-cache', false)));

          g.append(mkSection('Volume Control'));
          g.append(mkRow('Scroll wheel volume', 'Use scroll to adjust volume on hover', mkToggle('ytee-enable-scroll-volume', false)));
          g.append(mkRow('Volume cache', 'Remember the volume level (last 200 videos)', mkToggle('ytee-enable-volume-cache', false)));
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

          g.append(mkSection('History sync \u2014 optional'));
          const syncDesc = Object.assign(document.createElement('p'), {
            textContent: 'Sync your watch history across devices using a private GitHub Gist.',
            style: 'font-size:11px; color:rgba(255,255,255,0.4); margin:0 0 8px 2px; line-height:1.6;'
          });
          g.append(syncDesc);

          const gistSyncToggle = mkToggle('ytee-enable-gist-sync', false);
          g.append(mkRow('Enable sync', 'Push and pull history to your Gist', gistSyncToggle));

          const syncIntervalSelect = Object.assign(document.createElement('select'), {
            id: 'ytee-gist-sync-interval',
            style: 'background:rgba(30,30,30,0.95); border:1px solid rgba(255,255,255,0.12); border-radius:5px; padding:4px 8px; font-size:12px; color:rgba(255,255,255,0.8); cursor:pointer; outline:none; color-scheme:dark;'
          });
          [[30, 'Every 30 minutes'], [60, 'Every hour'], [120, 'Every 2 hours'], [180, 'Every 3 hours'], [360, 'Every 6 hours']].forEach(([val, label]) => {
            const opt = Object.assign(document.createElement('option'), { value: val, textContent: label });
            syncIntervalSelect.append(opt);
          });
          g.append(mkRow('Auto sync frequency', 'How often to auto-sync in the background', syncIntervalSelect));

          const gistTokenInput = Object.assign(document.createElement('input'), {
            id: 'ytee-gist-token', type: 'password', placeholder: 'ghp_xxxxxxxxxxxxxxxxxxxx',
            style: 'width:100%; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); border-radius:5px; padding:5px 9px; font-size:11px; color:rgba(255,255,255,0.8); font-family:monospace; outline:none;'
          });
          const gistTokenRow = mkRow('GitHub token', 'Personal access token \u2014 gist scope only', gistTokenInput);

          const gistIdInput = Object.assign(document.createElement('input'), {
            id: 'ytee-gist-id', type: 'text', placeholder: 'a1b2c3d4e5f6789abcdef...',
            style: 'width:100%; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); border-radius:5px; padding:5px 9px; font-size:11px; color:rgba(255,255,255,0.8); font-family:monospace; outline:none;'
          });
          const gistIdRow = mkRow('Gist ID', 'The ID from your Gist URL', gistIdInput);

          const guideToggleBtn = Object.assign(document.createElement('button'), {
            textContent: '\u25B6 Setup guide',
            style: 'font-size:11px; color:rgba(125,222,255,0.7); background:none; border:none; cursor:pointer; padding:4px 2px; text-align:left; display:block;'
          });
          const guideBox = Object.assign(document.createElement('ol'), {
            style: 'display:none; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:6px; padding:10px 12px 10px 26px; margin:6px 0 0; font-size:11px; color:rgba(255,255,255,0.55); line-height:1.7;'
          });
          [
            'Create a token: github.com \u2192 Settings \u2192 Developer settings \u2192 Personal access tokens \u2192 Tokens (classic) \u2192 Generate new token. Set any name, set expiration to No expiration, tick only the gist checkbox, then click Generate token. Copy the token that starts with ghp_ \u2014 you only see it once.',
            'Create a gist: gist.github.com \u2192 New gist. Set filename to ytee-history.json, put {} as the content, select Secret, then click Create secret gist.',
            'Copy the Gist ID: after creating, look at the URL \u2014 gist.github.com/yourusername/a1b2c3d4... \u2014 the string after your username is the Gist ID.',
            'Paste the token into the GitHub token field and the Gist ID into the Gist ID field, then save and click Sync in the History tab.',
          ].forEach(text => guideBox.append(Object.assign(document.createElement('li'), { textContent: text, style: 'margin-bottom:6px;' })));
          guideToggleBtn.addEventListener('click', () => {
            const open = guideBox.style.display !== 'none';
            guideBox.style.display = open ? 'none' : 'block';
            guideToggleBtn.textContent = open ? '\u25B6 Setup guide' : '\u25BC Setup guide';
          });

          const gistCredentialsWrap = Object.assign(document.createElement('div'), {});
          gistCredentialsWrap.append(gistTokenRow, gistIdRow, guideToggleBtn, guideBox);

          const updateGistVisibility = () => {
            const enabled = gistSyncToggle.querySelector('input')?.checked;
            gistCredentialsWrap.style.display = enabled ? 'block' : 'none';
          };
          gistSyncToggle.querySelector('input')?.addEventListener('change', updateGistVisibility);
          g.append(gistCredentialsWrap);
          updateGistVisibility();

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
          [{ val: 'very low', label: 'Very Low (1 Mbps)' }, { val: 'low', label: 'Low (2.5 Mbps)' }, { val: 'medium', label: 'Medium (5 Mbps)' }, { val: 'high', label: 'High (10 Mbps)' }, { val: 'very high', label: 'Very High (20 Mbps)' }].forEach(q => {
            replayQualitySelect.appendChild(Object.assign(document.createElement('option'), { value: q.val, textContent: q.label }));
          });
          t.append(mkRow('Replay quality', 'Higher quality increases RAM and CPU usage', replayQualitySelect));

          t.append(mkSection('Sleep Timer'));
          const sleepSelect = Object.assign(document.createElement('select'), { id: 'ytee-sleep-timer', className: 'ytee-quality-select' });
          [['off', 'Off'], ['15', '15 minutes'], ['30', '30 minutes'], ['45', '45 minutes'], ['60', '1 hour'], ['90', '1.5 hours'], ['120', '2 hours'], ['180', '3 hours'], ['240', '4 hours'], ['end', 'End of video'], ['custom', 'Custom\u2026']]
            .forEach(([val, label]) => sleepSelect.appendChild(Object.assign(document.createElement('option'), { value: val, textContent: label })));
          t.append(mkRow('Auto-pause after', 'Pauses playback when the timer runs out. \u201cEnd of video\u201d does not apply to live streams.', sleepSelect));
          const sleepCustomInput = Object.assign(document.createElement('input'), { type: 'number', id: 'ytee-sleep-custom', min: '1', max: '1440', className: 'hk-input' });
          const sleepCustomRow = mkRow('Custom minutes', 'Used when \u201cCustom\u2026\u201d is selected above (1\u20131440)', sleepCustomInput);
          t.append(sleepCustomRow);
          const syncSleepCustomRow = () => { sleepCustomRow.style.display = sleepSelect.value === 'custom' ? '' : 'none'; };
          sleepSelect.addEventListener('change', syncSleepCustomRow);
          syncSleepCustomRow();
          const sleepResetSelect = Object.assign(document.createElement('select'), { id: 'ytee-sleep-reset', className: 'ytee-quality-select' });
          [['off', 'Never reset'], ['activity', 'On mouse / key activity'], ['playback', 'On playback actions only']]
            .forEach(([val, label]) => sleepResetSelect.appendChild(Object.assign(document.createElement('option'), { value: val, textContent: label })));
          t.append(mkRow('Reset countdown', 'When to restart the timer. It stops resetting during the final minute either way.', sleepResetSelect));
          t.append(mkRow('Fade out audio', 'Ramp the volume down over the last 20 seconds before pausing', mkToggle('ytee-sleep-fade', false)));

          // Interface tab
          const ui = tabContents['tab-interface'];
          ui.append(mkSection('Appearance'));
          ui.append(mkRow('Compact icon mode', 'Smaller icons', mkToggle('ytee-compact-mode', false)));
          ui.append(mkRow('High contrast UI', 'Make buttons and text stand out more', mkToggle('ytee-high-contrast', false)));
          ui.append(mkRow('Blur effects', 'Frosted-glass blur behind the settings panel and history overlays.', mkToggle('ytee-enable-blur', true)));
          ui.append(mkRow('Persistent Mini Stats', 'Show Mini Stats on every video', mkToggle('ytee-always-show-mini-stats', false)));
          ui.append(mkSection('Button Visibility'));
          const grid = Object.assign(document.createElement('div'), { className: 'ytee-grid-2' });
          const buttonNames = { vol: 'Volume slider', wl: 'Watch later', url: 'Copy URL', screenshot: 'Screenshot', clip: 'Clip', replay: 'Replay', pip: 'PiP', speed: 'Speed', stats: 'Stats', sleep: 'Sleep timer', annot: 'Notes' };
          Object.keys(buttonNames).forEach(key => grid.append(mkRow(buttonNames[key], '', mkToggle(`btn-${key}`, false))));
          ui.append(grid);

          // Hotkey tab
          const hk = tabContents['tab-hotkeys'];
          hk.append(mkSection('Key Bindings'));
          hk.append(Object.assign(document.createElement('div'), {
            id: 'ytee-hk-conflict-warn', className: 'setting-note',
            style: 'display:none; color:#f5b53d;'
          }));
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
            toggleFullscreen: ['Toggle Fullscreen', 'Enter/exit fullscreen'],
            cycleSleepTimer: ['Sleep Timer', 'Cycle off / 15m / 30m / 45m / 1h / 1.5h / 2h / 3h / 4h / end'],
            addBookmark: ['Add Note', 'Drop a note at the current time'],
            screenshot: ['Screenshot', 'Snap the current frame'],
            clip: ['Clip', 'Start / stop a clip recording'],
            replay: ['Instant Replay', 'Start buffering / save the replay'],
            pip: ['Picture-in-Picture', 'Toggle PiP'],
            copyUrl: ['Copy URL', 'Copy the video link'],
            watchLater: ['Watch Later', 'Add to YouTube Watch Later'],
            toggleCollapse: ['Collapse UI', 'Hide / show the toolbar'],
          };

          const mkHotkeyField = (key) => {
            const wrap = Object.assign(document.createElement('div'), { className: 'ytee-hk-field' });
            const input = Object.assign(document.createElement('input'), {
              type: 'text', id: `hk-${key}`, className: 'hk-input', readOnly: true,
              placeholder: 'click to set', spellcheck: false,
            });
            const clearBtn = Object.assign(document.createElement('button'), {
              type: 'button', className: 'ytee-hk-clear', textContent: '×', title: 'Clear', tabIndex: -1,
            });
            const finish = (val) => { input.value = val; input.blur(); refreshHkConflicts(); };
            input.addEventListener('keydown', (e) => {
              if (e.key === 'Tab') return; // let focus move on
              e.preventDefault(); e.stopPropagation();
              if (e.key === 'Escape') { input.blur(); return; }
              if (e.key === 'Backspace' || e.key === 'Delete') { finish(''); return; }
              if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return; // wait for a real key
              const combo = [e.altKey ? 'alt+' : '', e.ctrlKey ? 'ctrl+' : '', e.shiftKey ? 'shift+' : '', hkKeyName(e.key)].join('');
              finish(sanitizeHotkeyInput(combo));
            });
            input.addEventListener('focus', () => { input.classList.add('ytee-hk-capturing'); input.placeholder = 'press keys…'; });
            input.addEventListener('blur', () => { input.classList.remove('ytee-hk-capturing'); input.placeholder = 'click to set'; });
            clearBtn.addEventListener('click', () => finish(''));
            wrap.append(input, clearBtn);
            return wrap;
          };
          Object.keys(hotkeyNames).forEach(key => {
            hk.append(mkRow(hotkeyNames[key][0], hotkeyNames[key][1], mkHotkeyField(key)));
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
        setCb('ytee-enable-volume-cache', currentSettings.enableVolumeCache);
        setCb('ytee-enable-position-cache', currentSettings.enablePositionCache);
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
        setVal('ytee-sleep-timer', currentSettings.sleepTimer);
        setVal('ytee-sleep-custom', currentSettings.sleepTimerCustom);
        { const el = document.getElementById('ytee-sleep-timer'); if (el) el.dispatchEvent(new Event('change')); }
        setVal('ytee-sleep-reset', currentSettings.sleepTimerReset);
        setCb('ytee-sleep-fade', currentSettings.sleepTimerFadeOut);
        Object.keys(currentSettings.hotkeys).forEach(key => setVal(`hk-${key}`, currentSettings.hotkeys[key]));
        refreshHkConflicts();
        setCb('ytee-compact-mode', currentSettings.compactMode);
        setCb('ytee-high-contrast', currentSettings.highContrastUI);
        setCb('ytee-enable-blur', currentSettings.enableBlur !== false);
        setCb('ytee-always-show-mini-stats', currentSettings.alwaysShowMiniStats);
        setCb('ytee-enable-gist-sync', currentSettings.enableGistSync);
        const gistTokEl = document.getElementById('ytee-gist-token');
        if (gistTokEl) gistTokEl.value = currentSettings.gistToken || '';
        const gistIdEl = document.getElementById('ytee-gist-id');
        if (gistIdEl) gistIdEl.value = currentSettings.gistId || '';
        historyViewMode = currentSettings.historyViewMode || 'list';
        const syncIntervalEl = document.getElementById('ytee-gist-sync-interval');
        if (syncIntervalEl) syncIntervalEl.value = currentSettings.gistSyncInterval || 180;
        const gistToggleInput = document.getElementById('ytee-enable-gist-sync');
        if (gistToggleInput) gistToggleInput.dispatchEvent(new Event('change'));
        Object.keys(currentSettings.buttons).forEach(key => setCb(`btn-${key}`, currentSettings.buttons[key]));

        if (isHistoryTabActive()) { renderHistoryTab(); historyTabDirty = false; } else { historyTabDirty = true; }
        settingsModal.classList.add('show');
        isSettingsOpen = true;
      };

      const hideSettingsModal = () => {
        if (document.fullscreenElement === settingsModal) document.exitFullscreen().catch(() => { });
        document.getElementById('ytee-cleardata-overlay')?.classList.remove('show');
        settingsModal.classList.remove('show');
        isSettingsOpen = false;
      };

      settingsBtn.addEventListener('click', showSettingsModal);

      const updateButtonVisibility = () => {
        const buttonMap = { wl: wlBtn, url: urlBtn, screenshot: screenshotBtn, clip: clipBtn, replay: replayBtn, pip: pipBtn, speed: speedBtn, stats: statsBtn, sleep: sleepBtn, annot: annotBtn };
        let anyCollapsibleVisible = false;
        let visibleCount = 0;
        Object.keys(buttonMap).forEach(key => {
          const isVisible = key === 'pip' ? currentSettings.buttons[key] && pipSupported
            : key === 'replay' ? currentSettings.buttons[key] && replaySupported
              : currentSettings.buttons[key];
          buttonMap[key].style.display = isVisible ? '' : 'none';
          if (isVisible) { anyCollapsibleVisible = true; visibleCount++; }
        });
        __ytee_visibleBtnCount = visibleCount;
        const volDisplay = currentSettings.buttons.vol ? '' : 'none';
        if (muteBtn) muteBtn.style.display = volDisplay;
        if (vol) vol.style.display = volDisplay;
        if (toggleBtn) toggleBtn.style.display = anyCollapsibleVisible ? '' : 'none';
        applyUIStates(currentSettings);
      };

      // Hotkeys
      const SHIFTED_SYMBOL_MAP = {
        '!': '1', '@': '2', '#': '3', '$': '4', '%': '5', '^': '6', '&': '7', '*': '8', '(': '9', ')': '0',
        '~': '`', '_': '-', '+': '=', '{': '[', '}': ']', '|': '\\', ':': ';', '"': "'", '<': ',', '>': '.', '?': '/'
      };

      const hkKeyName = (k) => (k === ' ' || k === 'Spacebar') ? 'space' : k.toLowerCase();

      function refreshHkConflicts() {
        const fields = [...document.querySelectorAll('#custom-settings-content .ytee-hk-field input')];
        const byCombo = {};
        fields.forEach(f => {
          f.classList.remove('ytee-hk-dupe');
          const v = sanitizeHotkeyInput(f.value);
          if (v) (byCombo[v] = byCombo[v] || []).push(f);
        });
        const msgs = [];
        Object.keys(byCombo).forEach(v => {
          if (byCombo[v].length < 2) return;
          byCombo[v].forEach(f => f.classList.add('ytee-hk-dupe'));
          const names = byCombo[v].map(f => f.closest('.setting-item')?.querySelector('.setting-title')?.textContent || '?');
          msgs.push(`"${v}" — ${names.join(' & ')}`);
        });
        const warn = document.getElementById('ytee-hk-conflict-warn');
        if (warn) {
          warn.textContent = msgs.length ? '⚠ Same key bound twice: ' + msgs.join('  •  ') : '';
          warn.style.display = msgs.length ? '' : 'none';
        }
        return msgs.length > 0;
      }

      const sanitizeHotkeyInput = (value) => {
        if (!value || typeof value !== 'string') return '';
        let cleaned = value.trim().toLowerCase().replace(/\s*\+\s*/g, '+');
        const parts = cleaned.split('+').filter(Boolean);
        let modifiers = []; let key = '';
        parts.forEach(part => {
          if (['shift', 'ctrl', 'alt'].includes(part)) { if (!modifiers.includes(part)) modifiers.push(part); }
          else if (!key) key = part;
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
        const modifiers = { shift: parts.includes('shift'), ctrl: parts.includes('ctrl'), alt: parts.includes('alt') };
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

      const toggleFullscreen = () => {
        if (document.fullscreenElement) { document.exitFullscreen().catch(() => { }); return; }
        if (!document.fullscreenEnabled) { window.parent.postMessage({ type: 'YTEE_REQUEST_FULLSCREEN' }, '*'); return; }
        document.documentElement.requestFullscreen().catch(() => {
          if (video.requestFullscreen) video.requestFullscreen().catch(() => { });
        });
      };

      // Sleep timer
      const sleepOverlay = Object.assign(document.createElement('div'), { id: 'custom-sleep-overlay', className: 'ytee-overlay' });
      const sleepChip = Object.assign(document.createElement('div'), { id: 'ytee-sleep-chip' });
      const SLEEP_SS_KEY = 'ytee-sleep-state';
      let sleepAt = 0;
      let sleepFired = false;
      let sleepTimerId = null;
      let sleepEndListener = null;
      let sleepExtendHideTimer = null;

      const readSleepState = () => {
        try { const raw = sessionStorage.getItem(SLEEP_SS_KEY); return raw ? JSON.parse(raw) : null; }
        catch (e) { return null; }
      };
      const persistSleepState = () => {
        try {
          if (sleepAt || sleepFired) {
            sessionStorage.setItem(SLEEP_SS_KEY, JSON.stringify({ sleepAt, sleepFired, mode: currentSettings.sleepTimer }));
          } else {
            sessionStorage.removeItem(SLEEP_SS_KEY);
          }
        } catch (e) { }
      };

      const formatSleepRemaining = (ms) => {
        if (ms <= 60000) return Math.max(1, Math.ceil(ms / 1000)) + 's';
        const mins = Math.ceil(ms / 60000);
        if (mins >= 60) return Math.floor(mins / 60) + 'h' + String(mins % 60).padStart(2, '0');
        return mins + 'm';
      };
      const sleepModeMinutes = () => {
        const m = currentSettings.sleepTimer;
        if (m === 'custom') return Math.max(1, Math.round(Number(currentSettings.sleepTimerCustom) || 0));
        const n = Number(m);
        return n > 0 ? n : 0;
      };
      const sleepModeShortLabel = (m) => {
        if (m === 'off') return 'Off';
        if (m === 'end') return 'End of video';
        const n = m === 'custom' ? sleepModeMinutes() : Number(m);
        if (!n) return 'Off';
        if (n % 60 === 0) return (n / 60) + 'h';
        if (n > 60) return Math.floor(n / 60) + 'h ' + (n % 60) + 'm';
        return n + ' min';
      };

      const sleepBtn = mkBtn('custom-sleep-btn', 'sleep', 'Sleep', 'Sleep Timer • click cycles • right-click = off', 'Sleep Timer');
      const updateSleepBtn = () => {
        const mode = currentSettings.sleepTimer;
        sleepBtn.classList.toggle('active', mode !== 'off');
        let label = 'Sleep';
        if (sleepFired) label = 'Paused';
        else if (sleepAt) label = formatSleepRemaining(Math.max(0, sleepAt - Date.now()));
        else if (mode === 'end') label = 'End';
        setBtnLabel(sleepBtn, label, mode === 'off' ? 'Sleep Timer: Off' : 'Sleep Timer: ' + sleepModeShortLabel(mode));
      };

      const updateSleepChip = () => {
        updateSleepBtn();
        if (sleepFired) { sleepChip.textContent = '😴 paused'; sleepChip.classList.add('show'); return; }
        if (!sleepAt) {
          if (currentSettings.sleepTimer === 'end') {
            sleepChip.textContent = '😴 ends with video';
            sleepChip.classList.add('show');
          } else {
            sleepChip.classList.remove('show');
          }
          return;
        }
        sleepChip.textContent = '😴 ' + formatSleepRemaining(Math.max(0, sleepAt - Date.now()));
        sleepChip.classList.add('show');
      };

      const disarmSleepTimer = () => {
        sleepAt = 0;
        if (sleepTimerId) { clearInterval(sleepTimerId); sleepTimerId = null; }
        if (sleepEndListener) { video.removeEventListener('ended', sleepEndListener); sleepEndListener = null; }
        sleepOverlay.classList.remove('show');
        updateSleepChip();
      };

      const restoreFadeVolume = () => {
        if (!sleepFading) return;
        sleepFading = false;
        applyAudioState(sleepFadeStartVol, targetMuted);
      };

      const showSleepPausedOverlay = () => {
        while (sleepOverlay.firstChild) sleepOverlay.removeChild(sleepOverlay.firstChild);
        sleepOverlay.appendChild(document.createTextNode('😴 Paused by sleep timer '));
        const mkSnooze = (label, fn) => {
          const b = Object.assign(document.createElement('button'), { className: 'ytee-sleep-snooze', textContent: label, type: 'button' });
          b.addEventListener('click', (e) => { e.stopPropagation(); fn(); });
          return b;
        };
        sleepOverlay.append(
          mkSnooze('+15 min', () => snoozeSleep(15)),
          mkSnooze('Custom…', () => {
            const raw = prompt('Keep playing for how many more minutes?', '20');
            if (raw === null) return;
            const n = Math.round(Number(raw));
            if (Number.isFinite(n) && n >= 1) snoozeSleep(Math.min(1440, n));
          }),
          mkSnooze('Keep watching', () => snoozeSleep('off')),
        );
        sleepOverlay.classList.add('show');
      };

      const fireSleep = () => {
        sleepFired = true;
        sleepAt = 0;
        if (sleepTimerId) { clearInterval(sleepTimerId); sleepTimerId = null; }
        restoreFadeVolume();
        const p = getPlayer();
        try { if (p && typeof p.pauseVideo === 'function') p.pauseVideo(); else video.pause(); } catch (e) { try { video.pause(); } catch (e2) { } }
        persistSleepState();
        updateSleepChip();
        showSleepPausedOverlay();
      };

      const sleepTick = () => {
        if (!sleepAt) return;
        const remaining = sleepAt - Date.now();
        if (remaining <= 0) { fireSleep(); return; }
        if (currentSettings.sleepTimerFadeOut && !targetMuted && remaining <= SLEEP_FADE_MS) {
          if (!sleepFading) { sleepFading = true; sleepFadeStartVol = targetVolume; }
          const v = Math.max(0, sleepFadeStartVol * (remaining / SLEEP_FADE_MS));
          scriptChangeDepth++;
          try {
            const p = getPlayer();
            if (p && typeof p.setVolume === 'function') p.setVolume(Math.round(v * 100)); else video.volume = v;
          } finally { scriptChangeDepth--; }
          volumeLockUntil = Date.now() + 1500;
        }
        updateSleepChip();
        if (remaining <= 60000) {
          const s = Math.ceil(remaining / 1000);
          sleepOverlay.textContent = `😴 Sleeping in ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
          sleepOverlay.classList.add('show');
        } else {
          sleepOverlay.classList.remove('show');
        }
      };

      const startSleepCountdown = (targetMs) => {
        sleepFired = false;
        sleepAt = targetMs;
        if (sleepTimerId) clearInterval(sleepTimerId);
        sleepTimerId = setInterval(sleepTick, 1000);
        sleepTick();
        persistSleepState();
        updateSleepChip();
      };

      const armSleepTimer = (opts = {}) => {
        disarmSleepTimer();
        const mode = currentSettings.sleepTimer;

        if (!opts.fresh) {
          const st = readSleepState();
          if (st && st.mode === mode && mode && mode !== 'off') {
            if (st.sleepFired) {
              sleepFired = true;
              const p = getPlayer();
              try { if (p && typeof p.pauseVideo === 'function') p.pauseVideo(); else video.pause(); } catch (e) { }
              updateSleepChip();
              showSleepPausedOverlay();
              return;
            }
            if (mode !== 'end' && st.sleepAt) {
              if (st.sleepAt > Date.now()) { startSleepCountdown(st.sleepAt); return; }
              if (Date.now() - st.sleepAt < 12 * 3600 * 1000) { fireSleep(); return; }
            }
          }
        }

        sleepFired = false;
        sleepFading = false;

        if (!mode || mode === 'off') { persistSleepState(); updateSleepChip(); return; }
        if (mode === 'end') {
          sleepEndListener = () => fireSleep();
          video.addEventListener('ended', sleepEndListener);
          persistSleepState();
          updateSleepChip();
          return;
        }
        const mins = sleepModeMinutes();
        if (!mins) { persistSleepState(); updateSleepChip(); return; }
        startSleepCountdown(Date.now() + mins * 60000);
      };

      const snoozeSleep = (arg) => {
        restoreFadeVolume();
        sleepFired = false;
        const p = getPlayer();
        try { if (p && typeof p.playVideo === 'function') p.playVideo(); else video.play(); } catch (e) { }
        while (sleepOverlay.firstChild) sleepOverlay.removeChild(sleepOverlay.firstChild);
        sleepOverlay.classList.remove('show');
        if (arg === 'off') { setSleepMode('off', false); return; }
        disarmSleepTimer();
        startSleepCountdown(Date.now() + arg * 60000);
      };

      const extendSleep = () => {
        if (sleepFired || !sleepAt) return;
        const mins = sleepModeMinutes() || 15;
        sleepAt += mins * 60000;
        persistSleepState();
        updateSleepChip();
        sleepOverlay.textContent = `😴 +${mins} min`;
        sleepOverlay.classList.add('show');
        clearTimeout(sleepExtendHideTimer);
        sleepExtendHideTimer = setTimeout(() => {
          if (!sleepAt || (sleepAt - Date.now()) > 60000) sleepOverlay.classList.remove('show');
        }, 1500);
      };

      const noteSleepActivity = (kind) => {
        if (sleepFired || !sleepAt) return;
        const mode = currentSettings.sleepTimerReset;
        if (mode === 'off') return;
        if (mode === 'playback' && kind !== 'playback') return;
        if (sleepAt - Date.now() <= 60000) return;
        const mins = sleepModeMinutes();
        if (mins) { sleepAt = Date.now() + mins * 60000; persistSleepState(); updateSleepChip(); }
      };

      const onSleepPlaybackActivity = () => noteSleepActivity('playback');
      ['play', 'pause', 'seeked', 'ratechange'].forEach(ev => video.addEventListener(ev, onSleepPlaybackActivity, { passive: true }));

      const SLEEP_CYCLE = ['off', '15', '30', '45', '60', '90', '120', '180', '240', 'end'];
      const setSleepMode = (mode, announce) => {
        currentSettings.sleepTimer = mode;
        saveStoredSettings(currentSettings);
        armSleepTimer({ fresh: true });
        const el = document.getElementById('ytee-sleep-timer');
        if (el) { el.value = mode; el.dispatchEvent(new Event('change')); }
        if (announce) {
          sleepOverlay.textContent = mode === 'off' ? '😴 Sleep timer off' : '😴 Sleep timer: ' + sleepModeShortLabel(mode);
          sleepOverlay.classList.add('show');
          setTimeout(() => { if (!sleepAt || (sleepAt - Date.now()) > 60000) sleepOverlay.classList.remove('show'); }, 1800);
        }
      };
      const cycleSleepTimer = () => {
        const idx = SLEEP_CYCLE.indexOf(currentSettings.sleepTimer);
        setSleepMode(SLEEP_CYCLE[(idx + 1) % SLEEP_CYCLE.length], true);
      };

      sleepChip.addEventListener('click', extendSleep);
      sleepOverlay.addEventListener('click', () => {
        if (sleepFired) return;
        extendSleep();
      });
      sleepBtn.addEventListener('click', cycleSleepTimer);
      sleepBtn.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (currentSettings.sleepTimer !== 'off') setSleepMode('off', true);
      });

      armSleepTimer();

      const hotkeyMap = {};
      const buildHotkeyMap = () => {
        Object.keys(hotkeyMap).forEach(k => delete hotkeyMap[k]);
        Object.keys(currentSettings.hotkeys).forEach(action => {
          getHotkeyCombos(normalizeHotkey(currentSettings.hotkeys[action])).forEach(combo => { hotkeyMap[combo] = action; });
        });
      };
      buildHotkeyMap();

      const onKeyDown = (e) => {
        const ae = document.activeElement;
        if (ae && ae.classList && ae.classList.contains('ytee-hk-capturing')) return;
        const isShiftedSym = e.shiftKey && (e.key in SHIFTED_SYMBOL_MAP);
        const combo = [e.altKey ? 'alt+' : '', e.ctrlKey ? 'ctrl+' : '', e.shiftKey && !isShiftedSym ? 'shift+' : '', hkKeyName(e.key)].join('');
        const action = hotkeyMap[combo];
        noteSleepActivity('activity');
        if (isAnnotPanelOpen() && getAnnotPanel() && getAnnotPanel().contains(e.target)) {
          if (e.key === 'Escape') closeAnnotPanel();
          return;
        }
        if (isAnnotPanelOpen() && e.key === 'Escape') { closeAnnotPanel(); e.preventDefault(); return; }
        if (isSettingsOpen) {
          if (e.key === "Escape") {
            const clr = document.getElementById('ytee-cleardata-overlay');
            if (clr && clr.classList.contains('show')) { clr.classList.remove('show'); e.preventDefault(); e.stopImmediatePropagation(); return; }
          }
          if (e.key === "Escape" || action === 'toggleSettings') {
            hideSettingsModal(); e.preventDefault(); e.stopImmediatePropagation();
          }
          return;
        }
        if (action) {
          e.stopImmediatePropagation(); e.preventDefault();
          switch (action) {
            case 'toggleMute': toggleMute(); break;
            case 'toggleStats': toggleStats(); break;
            case 'toggleMiniStats': toggleMiniStats(); break;
            case 'increaseSpeed': applySpeed(getTargetSpeed() + SPEED_STEP); break;
            case 'decreaseSpeed': applySpeed(getTargetSpeed() - SPEED_STEP); break;
            case 'increaseSpeedFine': applySpeed(getTargetSpeed() + SPEED_STEP_FINE); break;
            case 'decreaseSpeedFine': applySpeed(getTargetSpeed() - SPEED_STEP_FINE); break;
            case 'volumeUp': applyVolume(targetVolume + (currentSettings.volumeStep / 100)); break;
            case 'volumeDown': applyVolume(targetVolume - (currentSettings.volumeStep / 100)); break;
            case 'toggleSettings': showSettingsModal(); break;
            case 'toggleFullscreen': toggleFullscreen(); break;
            case 'cycleSleepTimer': cycleSleepTimer(); break;
            case 'addBookmark': addBookmarkAtCurrent(true); break;
            case 'screenshot': screenshotBtn.click(); break;
            case 'clip': clipBtn.click(); break;
            case 'replay': replayBtn.click(); break;
            case 'pip': pipBtn.click(); break;
            case 'copyUrl': urlBtn.click(); break;
            case 'watchLater': wlBtn.click(); break;
            case 'toggleCollapse': toggleBtn.click(); break;
          }
          showControls();
        }
      };
      window.addEventListener("keydown", onKeyDown, true);

      const btnGroup = document.createElement("div");
      btnGroup.id = "custom-btn-group";
      btnGroup.append(toggleBtn, wlBtn, urlBtn, screenshotBtn, clipBtn, replayBtn, pipBtn, sleepBtn, annotBtn, speedBtn, statsBtn, settingsBtn);
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
        noteSleepActivity('activity');
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

      let lastWakeAt = 0;
      const wakeControls = () => {
        showControls();
        const now = Date.now();
        if (now - lastWakeAt < 400) return;
        lastWakeAt = now;
        const p = getPlayer();
        if (p && typeof p.playVideo === 'function') {
          video.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
        }
      };

      const onFullscreenChange = () => {
        if (document.fullscreenElement) wakeControls();
      };
      document.addEventListener('fullscreenchange', onFullscreenChange);

      const initialVid = getVideoId(getPlayer());
      const cachedVolEntry = initialVid && currentSettings.enableVolumeCache ? currentSettings.volumeCache[initialVid] : undefined;
      const cachedVol = (cachedVolEntry && typeof cachedVolEntry === 'object') ? cachedVolEntry.v : cachedVolEntry;
      const startVolume = (cachedVol !== undefined) ? cachedVol : (currentSettings.initialVolume / 100);

      applyVolume(startVolume);

      const reapplyCount = { n: 0 };
      const reapply = () => {
        if (reapplyCount.n++ < 3 && Math.abs(video.volume - startVolume) > 0.01) applyVolume(startVolume);
      };
      [200, 800, 2000].forEach(ms => setTimeout(reapply, ms));

      if (getTargetSpeed() !== SPEED_DEFAULT) {
        [300, 1200, 2500].forEach(ms => setTimeout(() => {
          if (Math.abs(video.playbackRate - getTargetSpeed()) > 0.01) applySpeed(getTargetSpeed());
        }, ms));
      }

      if (initialVid) {
        const cachedMiniStatsEntry = currentSettings.miniStatsCache[initialVid];
        const cachedMiniStats = (cachedMiniStatsEntry && typeof cachedMiniStatsEntry === 'object') ? cachedMiniStatsEntry.v : cachedMiniStatsEntry;
        if (currentSettings.alwaysShowMiniStats || cachedMiniStats) toggleMiniStats();
      }

      if (initialVid && currentSettings.enablePositionCache) {
        const cachedPosEntry = currentSettings.positionCache[initialVid];
        const cachedPos = (cachedPosEntry && typeof cachedPosEntry === 'object') ? cachedPosEntry.v : cachedPosEntry;
        if (cachedPos !== undefined && cachedPos > 0 && !isCurrentlyLive(getPlayer())) {
          const seekToCachedPos = () => { video.currentTime = cachedPos; };
          if (video.readyState >= 3) { seekToCachedPos(); }
          else { video.addEventListener('canplay', seekToCachedPos, { once: true }); }
        }
      }

      let lastPositionSaveTime = 0;
      const saveCurrentPosition = () => {
        const p = getPlayer();
        const vid = getVideoId(p);
        if (!vid) return;
        const curTime = video.currentTime;
        const duration = video.duration;
        let changed = false;
        if (duration > 30 && curTime > 10 && curTime < duration - 15 && curTime < duration * 0.95) {
          const prev = currentSettings.positionCache[vid];
          const newPos = Math.floor(curTime);
          if (!prev || typeof prev !== 'object' || prev.v !== newPos) {
            const title = getVideoTitle(p) || (prev && prev.title) || "";
            const channel = getVideoAuthor(p) || (prev && prev.channel) || "";
            currentSettings.positionCache[vid] = { v: newPos, title, channel, t: Date.now() };
            changed = true;
          }
        } else if (currentSettings.positionCache[vid] !== undefined) {
          delete currentSettings.positionCache[vid];
          changed = true;
        }
        if (!changed) return;
        saveStoredSettings(currentSettings);
        scheduleHistoryRender();
      };

      const onVideoTimeUpdate = () => {
        if (currentSettings.enablePositionCache) {
          const now = Date.now();
          if (now - lastPositionSaveTime >= 15000) { lastPositionSaveTime = now; saveCurrentPosition(); }
        }
      };
      video.addEventListener('timeupdate', onVideoTimeUpdate);

      const onVideoPause = () => { if (currentSettings.enablePositionCache) saveCurrentPosition(); };
      video.addEventListener('pause', onVideoPause);

      applySpeed(getTargetSpeed());
      showControls();

      const onDblClick = (e) => {
        if (isSettingsOpen) return;
        if (e.target.closest("#custom-btn-group, #custom-mute-btn, #custom-vol-slider")) return;
        toggleFullscreen();
      };
      window.addEventListener("dblclick", onDblClick, { passive: true });

      const initUI = () => {
        document.body.prepend(volPct, speedOverlay, clipOverlay, replayOverlay, sleepOverlay, sleepChip, miniStats, vol, muteBtn, btnGroup);
        applyUIStates(currentSettings);
      };
      initUI();

      let lastEmbedW = 0, lastEmbedH = 0;
      const updateEmbedWidth = () => {
        const w = document.documentElement.clientWidth || window.innerWidth;
        const h = document.documentElement.clientHeight || window.innerHeight;

        if (w === lastEmbedW && h === lastEmbedH) return;
        const prevW = lastEmbedW, prevH = lastEmbedH;
        lastEmbedW = w; lastEmbedH = h;
        document.documentElement.style.setProperty('--ytee-ew', w + 'px');
        document.documentElement.classList.toggle('ytee-compact', w < YTEE_BP.COMPACT_W || h < YTEE_BP.SHORT_H);
        applyMiniStatsPos();
        __ytee_uiSig = null;
        applyUIStates(currentSettings);

        if (!document.fullscreenElement && prevW && prevH &&
          w > prevW * 1.5 && h > prevH * 1.5 &&
          w >= window.screen.width * 0.9 && h >= window.screen.height * 0.9) {
          wakeControls();
        }
      };
      let embedWidthRaf = 0;
      const scheduleEmbedWidth = () => {
        if (embedWidthRaf) return;
        embedWidthRaf = requestAnimationFrame(() => { embedWidthRaf = 0; updateEmbedWidth(); });
      };
      updateEmbedWidth();
      const resizeObs = new ResizeObserver(scheduleEmbedWidth);
      resizeObs.observe(document.documentElement);

      if (typeof GM_addValueChangeListener === 'function') {
        GM_addValueChangeListener('ytee-settings', (name, oldVal, newVal, remote) => {
          if (!remote) return;
          try {
            const next = normalizeSettings(typeof newVal === 'string' ? JSON.parse(newVal) : newVal);
            const diff = (k) => JSON.stringify(next[k]) !== JSON.stringify(currentSettings[k]);
            const uiChanged = ['buttons', 'compactMode', 'highContrastUI', 'enableBlur', 'isCollapsed'].some(diff);
            const hkChanged = diff('hotkeys');
            const qualChanged = diff('preferredQuality');
            const sleepChanged = diff('sleepTimer') || diff('sleepTimerCustom') || diff('sleepTimerReset') || diff('sleepTimerFadeOut');
            currentSettings = next;
            if (uiChanged) { updateButtonVisibility(); applyUIStates(currentSettings); }
            if (hkChanged) buildHotkeyMap();
            if (qualChanged) applyQuality(true);
            if (sleepChanged) armSleepTimer();
          } catch (e) { yteeWarn('Failed to sync settings', e); }
        });
      }

      const cleanup = () => {
        clearTimeout(volTimeout); clearTimeout(speedTimeout); clearTimeout(controlsTimeout);
        disposeStats();
        disposeHistoryTab();
        clearTimeout(gistSyncStartTimer); if (gistSyncIntervalId) clearInterval(gistSyncIntervalId);
        if (clipRafId) cancelAnimationFrame(clipRafId);
        document.documentElement.removeEventListener("wheel", onWheel);
        window.removeEventListener("keydown", onKeyDown, true);
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("dblclick", onDblClick);
        document.removeEventListener('fullscreenchange', onFullscreenChange);
        video.removeEventListener('volumechange', onVideoVolumeChange);
        video.removeEventListener('timeupdate', onVideoTimeUpdate);
        video.removeEventListener('pause', onVideoPause);
        ['play', 'pause', 'seeked', 'ratechange'].forEach(ev => video.removeEventListener(ev, onSleepPlaybackActivity));
        clearTimeout(sleepExtendHideTimer);
        if (wheelRafId) cancelAnimationFrame(wheelRafId);
        if (embedWidthRaf) cancelAnimationFrame(embedWidthRaf);
        clipRafId = null; wheelRafId = 0; embedWidthRaf = 0;
        if (clipRecorder) { try { if (clipRecorder.state !== 'inactive') clipRecorder.stop(); } catch (e) { } clipRecorder = null; }
        if (activeStream) { activeStream.getTracks().forEach(t => t.stop()); activeStream = null; }
        if (clipAudioDestination) {
          if (recordingGain) try { recordingGain.disconnect(clipAudioDestination); } catch (e) { }
          clipAudioDestination = null;
        }
        if (audioContext) audioContext.suspend().catch(() => { });
        stopInstantReplay();
        disarmSleepTimer();
        replayChunks = [];
        replayInitChunk = null;
        cachedPlayer = null;
        resizeObs.disconnect();
        closeAnnotPanel();
        [settingsModal, btnGroup, volPct, speedOverlay, clipOverlay, replayOverlay, sleepOverlay, sleepChip, miniStats, vol, muteBtn, getAnnotPanel()].forEach(el => {
          if (el && el.parentNode) el.remove();
        });
      };
      window.addEventListener('pagehide', cleanup);

    });
  }

})();
