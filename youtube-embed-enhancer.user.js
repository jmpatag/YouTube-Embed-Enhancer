// ==UserScript==
// @name         YouTube Embed Enhancer
// @namespace    https://github.com/jmpatag
// @version      3.2.0
// @description  Restores volume control and adds a versatile toolkit for real-time diagnostics, video clipping, screenshots, and persistent playback customization.
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

    document.addEventListener('dblclick', (e) => {
      const iframe = e.target.closest('iframe[src*="youtube.com/embed"]')
        ?? document.querySelector('iframe[src*="youtube.com/embed"]');
      if (!iframe) return;
      if (document.fullscreenElement) document.exitFullscreen().catch(() => { });
      else iframe.requestFullscreen().catch(() => { });
    }, { passive: true });
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
          .ytee-compact #custom-settings-clear {
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
          #custom-settings-content .hk-input[type="number"] { -moz-appearance: textfield; appearance: textfield; }
          #custom-settings-content .hk-input[type="number"]::-webkit-outer-spin-button,
          #custom-settings-content .hk-input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
          #custom-settings-content .hk-input:focus, #custom-settings-content .ytee-quality-select:focus {
          outline: none; border-color: rgba(16,185,129,0.6);
          box-shadow: 0 0 0 3px rgba(16,185,129,0.12);
          }

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
          #custom-settings-restore, #custom-settings-clear-cache {
          display: inline-flex; align-items: center; gap: 5px;
          padding: clamp(5px, calc(var(--ytee-ew) * 0.009), 7px) clamp(8px, calc(var(--ytee-ew) * 0.015), 12px);
          background: transparent; border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px; color: rgba(255,255,255,0.4); cursor: pointer;
          font-size: clamp(10px, calc(var(--ytee-ew) * 0.014), 12px); font-weight: 600;
          transition: background 0.15s, color 0.15s, border-color 0.15s;
          }
          #custom-settings-restore { margin-right: 0; }
          #custom-settings-clear-cache { margin-right: auto; color: rgba(255,100,100,0.5); border-color: rgba(255,100,100,0.15); }
          #custom-settings-restore:hover { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.8); border-color: rgba(255,255,255,0.15); }
          #custom-settings-clear-cache:hover { background: rgba(255,60,60,0.08); color: rgba(255,100,100,0.9); border-color: rgba(255,100,100,0.3); }
          #custom-settings-restore.confirm, #custom-settings-clear-cache.confirm {
          border-color: #f59e0b !important; color: #f59e0b !important; background: rgba(245,158,11,0.06) !important;
          }
          #custom-settings-restore.success, #custom-settings-clear-cache.success {
          border-color: var(--ytee-accent) !important; color: var(--ytee-accent) !important; background: rgba(16,185,129,0.06) !important;
          }
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
          .ytee-bkmk-row:hover { background: rgba(255,255,255,0.05); }`;

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
    },
    volumeBoostLevel: 1, enableVolumeBoost: false, enableScrollVolume: true, enableVolumeCache: false,
    volumeStep: 5, initialVolume: 100, clipDuration: 5, clipDurationCtrl: 300,
    instantReplayDuration: 30, instantReplayQuality: 'medium', preferredQuality: 'auto',
    sleepTimer: 'off', sleepTimerReset: 'playback', sleepTimerFadeOut: false, sleepTimerCustom: 120,
    compactMode: false, isCollapsed: false, highContrastUI: false, playbackSpeed: 1,
    volumeCache: {}, miniStatsCache: {}, miniStatsPos: null, alwaysShowMiniStats: false,
    enablePositionCache: false, enableGistSync: false, historyViewMode: 'list',
    gistToken: '', gistId: '', gistSyncLastTime: 0, gistSyncInterval: 180, positionCache: {},
    favoritesCache: {}, annotationsCache: {},
  };

  const loadStoredSettings = () => {
    try {
      if (typeof GM_getValue === 'function') {
        const v = GM_getValue('ytee-settings', null);
        if (v) return typeof v === 'string' ? JSON.parse(v) : v;
      }
    } catch (e) { yteeWarn('GM_getValue failed', e); }
    try { const r = localStorage.getItem('ytee-settings'); if (r) return JSON.parse(r); } catch (e) { }
    return null;
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
      playbackSpeed: _num(s.playbackSpeed, D.playbackSpeed, 0.1, 16),
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
      const keys = Object.keys(rs[cacheKey]);
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
   * Mediabunny 1.55.6 — MPL-2.0 — https://github.com/Vanilagy/mediabunny
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
      Mediabunny = (()=>{var Xn=Object.defineProperty;var Ac=Object.getOwnPropertyDescriptor;var Tc=Object.getOwnPropertyNames;var kc=Object.prototype.hasOwnProperty;var Sc=(t,e)=>{for(var r in e)Xn(t,r,{get:e[r],enumerable:!0});},xc=(t,e,r,i)=>{if(e&&typeof e=="object"||typeof e=="function")for(let s of Tc(e))!kc.call(t,s)&&s!==r&&Xn(t,s,{get:()=>e[s],enumerable:!(i=Ac(e,s))||i.enumerable});return t};var _c=t=>xc(Xn({},"__esModule",{value:!0}),t);var ju={};Sc(ju,{BlobSource:()=>fi,BufferTarget:()=>Ot,Conversion:()=>Ri,Input:()=>lr,MatroskaInputFormat:()=>Mr,Mp4InputFormat:()=>mi,Mp4OutputFormat:()=>Xt,Output:()=>Zt,QuickTimeInputFormat:()=>pi,WebMInputFormat:()=>gi});function g(t){if(!t)throw new Error("Assertion failed.")}var yt=t=>{let e=(t%360+360)%360;if(e===0||e===90||e===180||e===270)return e;throw new Error(`Invalid rotation ${t}.`)},fe=t=>t&&t[t.length-1],bt=t=>t>=0&&t<2**32,D=t=>{let e=0;for(;t.readBits(1)===0&&e<32;)e++;if(e>=32)throw new Error("Invalid exponential-Golomb code.");return (1<<e)-1+t.readBits(e)},st=t=>{let e=D(t);return (e&1)===0?-(e>>1):e+1>>1};var Te=t=>t.constructor===Uint8Array?t:ArrayBuffer.isView(t)?new Uint8Array(t.buffer,t.byteOffset,t.byteLength):new Uint8Array(t),ie=t=>t.constructor===DataView?t:ArrayBuffer.isView(t)?new DataView(t.buffer,t.byteOffset,t.byteLength):new DataView(t),je=new TextDecoder,qe=new TextEncoder;var es=t=>Object.fromEntries(Object.entries(t).map(([e,r])=>[r,e])),At={bt709:1,bt470bg:5,smpte170m:6,bt2020:9,smpte432:12},ot=es(At),Tt={bt709:1,smpte170m:6,linear:8,"iec61966-2-1":13,pq:16,hlg:18},at=es(Tt),kt={rgb:0,bt709:1,bt470bg:5,smpte170m:6,"bt2020-ncl":9},ct=es(kt),gr=t=>!!t&&!!t.primaries&&!!t.transfer&&!!t.matrix&&t.fullRange!==void 0,uo=t=>!t||t.primaries==null&&t.transfer==null&&t.matrix==null&&t.fullRange==null,Bi={primaries:void 0,transfer:void 0,matrix:void 0,fullRange:void 0},wr=t=>t instanceof ArrayBuffer||typeof SharedArrayBuffer<"u"&&t instanceof SharedArrayBuffer||ArrayBuffer.isView(t),pr=class{constructor(){this.currentPromise=Promise.resolve(),this.pending=0;}async acquire(){let e,r=new Promise(s=>{let n=!1;e=()=>{n||(s(),this.pending--,n=!0);};}),i=this.currentPromise;return this.currentPromise=r,this.pending++,await i,e}},fo=/^[0-9a-fA-F]+$/,Vt=t=>[...t].map(e=>e.toString(16).padStart(2,"0")).join(""),ho=t=>{g(t.length%2===0);let e=new Uint8Array(t.length/2);for(let r=0;r<t.length;r+=2)e[r/2]=parseInt(t.slice(r,r+2),16);return e},ts=t=>(t=t>>1&1431655765|(t&1431655765)<<1,t=t>>2&858993459|(t&858993459)<<2,t=t>>4&252645135|(t&252645135)<<4,t=t>>8&16711935|(t&16711935)<<8,t=t>>16&65535|(t&65535)<<16,t>>>0),rs=(t,e,r)=>{let i=0,s=t.length-1,n=-1;for(;i<=s;){let o=i+s>>1,a=r(t[o]);a===e?(n=o,s=o-1):a<e?i=o+1:s=o-1;}return n},ce=(t,e,r)=>{let i=0,s=t.length-1,n=-1;for(;i<=s;){let o=i+(s-i+1)/2|0;r(t[o])<=e?(n=o,i=o+1):s=o-1;}return n},is=(t,e,r)=>{let i=ce(t,r(e),r);t.splice(i+1,0,e);},he=()=>{let t,e;return {promise:new Promise((i,s)=>{t=i,e=s;}),resolve:t,reject:e}},Qr=(t,e)=>{let r=t.indexOf(e);r!==-1&&t.splice(r,1);};var Mi=(t,e)=>{for(let r=t.length-1;r>=0;r--)if(e(t[r]))return r;return -1},mo=async function*(t){Symbol.iterator in t?yield*t[Symbol.iterator]():yield*t[Symbol.asyncIterator]();},po=t=>{if(!(Symbol.iterator in t)&&!(Symbol.asyncIterator in t))throw new TypeError("Argument must be an iterable or async iterable.")},xe=t=>{throw new Error(`Unexpected value: ${t}`)},Yt=(t,e,r)=>{let i=t.getUint8(e),s=t.getUint8(e+1),n=t.getUint8(e+2);return r?i|s<<8|n<<16:i<<16|s<<8|n},go=(t,e,r)=>Yt(t,e,r)<<8>>8,Kr=(t,e,r,i)=>{r=r>>>0,r=r&16777215,i?(t.setUint8(e,r&255),t.setUint8(e+1,r>>>8&255),t.setUint8(e+2,r>>>16&255)):(t.setUint8(e,r>>>16&255),t.setUint8(e+1,r>>>8&255),t.setUint8(e+2,r&255));},wo=(t,e,r,i)=>{r=ue(r,-8388608,8388607),r<0&&(r=r+16777216&16777215),Kr(t,e,r,i);};var ue=(t,e,r)=>Math.max(e,Math.min(r,t)),yo=(t,e,r)=>t+(e-t)*r,Ut="und",Di=t=>{let e=Math.round(t);return Math.abs(t/e-1)<10*Number.EPSILON?e:t},Gr=(t,e)=>Math.round(t/e)*e,$r=(t,e)=>Math.round(t*e)/e;var ns=(t,e)=>Math.floor(t*e)/e;var Oi=t=>{let e=0;for(;t!==0;)t&=t-1,e++;return e},Cc=/^[a-z]{3}$/,St=t=>Cc.test(t),lt=1e6*(1+Number.EPSILON);var bo=(t,e)=>{let r=t<0?-1:1;t=Math.abs(t);let i=0,s=1,n=1,o=0,a=t;for(;;){let c=Math.floor(a),l=c*n+i,u=c*o+s;if(u>e)return {num:r*n,den:o};if(i=n,s=o,n=l,o=u,a=1/(a-c),!isFinite(a))break}return {num:r*n,den:o}},zt=class{constructor(){this.currentPromise=Promise.resolve();}call(e){return this.currentPromise=this.currentPromise.then(e)}},Zn=null,xt=()=>Zn!==null?Zn:Zn=!!(typeof navigator<"u"&&(navigator.vendor?.match(/apple/i)||/AppleWebKit/.test(navigator.userAgent)&&!/Chrome/.test(navigator.userAgent)||/\b(iPad|iPhone|iPod)\b/.test(navigator.userAgent))),Yn=null,Xr=()=>Yn!==null?Yn:Yn=typeof navigator<"u"&&navigator.userAgent?.includes("Firefox"),Jn=null,Zr=()=>Jn!==null?Jn:Jn=!!(typeof navigator<"u"&&(navigator.vendor?.includes("Google Inc")||/Chrome/.test(navigator.userAgent)));var yr=t=>typeof globalThis.isSecureContext<"u"&&!globalThis.isSecureContext?`${t} is not available in this environment; this may be because this page is running in an insecure context. Try serving your page over HTTPS or use localhost.`:`${t} is not available in this environment.`,Ec=(async()=>{})().constructor,U=t=>t instanceof Ec||t instanceof Promise?!0:typeof t?.then=="function";var zi=(t,e,r,i)=>t<=i&&r<=e,Vi=function*(t){for(let e in t){let r=t[e];r!==void 0&&(yield {key:e,value:r});}};var Ao=(t,e)=>{if(t.length!==e.length)return !1;for(let r=0;r<t.length;r++)if(t[r]!==e[r])return !1;return !0},br=()=>{Symbol.dispose??(Symbol.dispose=Symbol("Symbol.dispose"));},Nt=t=>typeof t=="number"&&!Number.isNaN(t);var To=(t,e)=>{let r=0;for(let i=0;i<t.length;i++)e(t[i])&&r++;return r},Ui=(t,e)=>{let r=-1,i=1/0;for(let s=0;s<t.length;s++){let n=e(t[s]);n<i&&(i=n,r=s);}return r};var Wt=t=>{g(Number.isInteger(t.num)),g(Number.isInteger(t.den)),g(t.den!==0);let e=Math.abs(t.num),r=Math.abs(t.den);for(;r!==0;){let s=e%r;e=r,r=s;}let i=e||1;return {num:t.num/i,den:t.den/i}},Ni=(t,e)=>{if(typeof t!="object"||!t)throw new TypeError(`${e} must be an object.`);if(!Number.isInteger(t.left)||t.left<0)throw new TypeError(`${e}.left must be a non-negative integer.`);if(!Number.isInteger(t.top)||t.top<0)throw new TypeError(`${e}.top must be a non-negative integer.`);if(!Number.isInteger(t.width)||t.width<0)throw new TypeError(`${e}.width must be a non-negative integer.`);if(!Number.isInteger(t.height)||t.height<0)throw new TypeError(`${e}.height must be a non-negative integer.`)};var ss=t=>new Promise(e=>setTimeout(e,t));var Wi=t=>Array.isArray(t)?t:[t],He=class{constructor(){this._listeners=new Map;}on(e,r,i){this._listeners.has(e)||this._listeners.set(e,new Set);let s={fn:r,once:i?.once??!1};return this._listeners.get(e).add(s),()=>{this._listeners.get(e)?.delete(s);}}_emit(...e){let[r,i]=e,s=this._listeners.get(r);if(s)for(let n of s){try{n.fn(i);}catch(o){console.error(o);}n.once&&s.delete(n);}}},Jt=t=>Math.ceil(t/2)*2;var ko=t=>t!==null&&typeof t=="object"&&Object.getPrototypeOf(t)===Object.prototype&&Object.values(t).every(e=>typeof e=="string");var ut;(function(t){t[t.Silent=0]="Silent",t[t.Errors=1]="Errors",t[t.Warnings=2]="Warnings",t[t.Info=3]="Info";})(ut||(ut={}));var K=class t{constructor(){}static get level(){return t._level}static set level(e){if(e!==ut.Silent&&e!==ut.Errors&&e!==ut.Warnings&&e!==ut.Info)throw new TypeError("Invalid log level. Use one of the values of the LogLevel enum.");t._level=e;}static get _emitter(){return t._emitterInstance??(t._emitterInstance=new He)}static on(e,r,i){return t._emitter.on(e,r,i)}static _error(...e){t._emitter._emit("error",e),t._level>=ut.Errors&&console.error(...e);}static _warn(...e){t._emitter._emit("warn",e),t._level>=ut.Warnings&&console.warn(...e);}static _info(...e){t._emitter._emit("info",e),t._level>=ut.Info&&console.info(...e);}};K._level=ut.Info;K._emitterInstance=null;var Xe=class{constructor(e,r){if(this.data=e,this.mimeType=r,!(e instanceof Uint8Array))throw new TypeError("data must be a Uint8Array.");if(typeof r!="string")throw new TypeError("mimeType must be a string.")}},Yr=class{constructor(e,r,i,s){if(this.data=e,this.mimeType=r,this.name=i,this.description=s,!(e instanceof Uint8Array))throw new TypeError("data must be a Uint8Array.");if(r!==void 0&&typeof r!="string")throw new TypeError("mimeType, when provided, must be a string.");if(i!==void 0&&typeof i!="string")throw new TypeError("name, when provided, must be a string.");if(s!==void 0&&typeof s!="string")throw new TypeError("description, when provided, must be a string.")}},Jr=t=>{if(!t||typeof t!="object")throw new TypeError("tags must be an object.");if(t.title!==void 0&&typeof t.title!="string")throw new TypeError("tags.title, when provided, must be a string.");if(t.description!==void 0&&typeof t.description!="string")throw new TypeError("tags.description, when provided, must be a string.");if(t.artist!==void 0&&typeof t.artist!="string")throw new TypeError("tags.artist, when provided, must be a string.");if(t.album!==void 0&&typeof t.album!="string")throw new TypeError("tags.album, when provided, must be a string.");if(t.albumArtist!==void 0&&typeof t.albumArtist!="string")throw new TypeError("tags.albumArtist, when provided, must be a string.");if(t.trackNumber!==void 0&&(!Number.isInteger(t.trackNumber)||t.trackNumber<=0))throw new TypeError("tags.trackNumber, when provided, must be a positive integer.");if(t.tracksTotal!==void 0&&(!Number.isInteger(t.tracksTotal)||t.tracksTotal<=0))throw new TypeError("tags.tracksTotal, when provided, must be a positive integer.");if(t.discNumber!==void 0&&(!Number.isInteger(t.discNumber)||t.discNumber<=0))throw new TypeError("tags.discNumber, when provided, must be a positive integer.");if(t.discsTotal!==void 0&&(!Number.isInteger(t.discsTotal)||t.discsTotal<=0))throw new TypeError("tags.discsTotal, when provided, must be a positive integer.");if(t.genre!==void 0&&typeof t.genre!="string")throw new TypeError("tags.genre, when provided, must be a string.");if(t.date!==void 0&&(!(t.date instanceof Date)||Number.isNaN(t.date.getTime())))throw new TypeError("tags.date, when provided, must be a valid Date.");if(t.lyrics!==void 0&&typeof t.lyrics!="string")throw new TypeError("tags.lyrics, when provided, must be a string.");if(t.images!==void 0){if(!Array.isArray(t.images))throw new TypeError("tags.images, when provided, must be an array.");for(let e of t.images){if(!e||typeof e!="object")throw new TypeError("Each image in tags.images must be an object.");if(!(e.data instanceof Uint8Array))throw new TypeError("Each image.data must be a Uint8Array.");if(typeof e.mimeType!="string")throw new TypeError("Each image.mimeType must be a string.");if(!["coverFront","coverBack","unknown"].includes(e.kind))throw new TypeError("Each image.kind must be 'coverFront', 'coverBack', or 'unknown'.")}}if(t.comment!==void 0&&typeof t.comment!="string")throw new TypeError("tags.comment, when provided, must be a string.");if(t.raw!==void 0){if(!t.raw||typeof t.raw!="object")throw new TypeError("tags.raw, when provided, must be an object.");for(let e of Object.values(t.raw))if(e!==null&&typeof e!="string"&&!(e instanceof Uint8Array)&&!(e instanceof Xe)&&!(e instanceof Yr)&&!ko(e))throw new TypeError("Each value in tags.raw must be a string, Uint8Array, RichImageData, AttachedFile, Record<string, string>, or null.")}};var qi={default:!0,primary:!0,forced:!1,original:!1,commentary:!1,hearingImpaired:!1,visuallyImpaired:!1},So=t=>{if(!t||typeof t!="object")throw new TypeError("disposition must be an object.");if(t.default!==void 0&&typeof t.default!="boolean")throw new TypeError("disposition.default must be a boolean.");if(t.primary!==void 0&&typeof t.primary!="boolean")throw new TypeError("disposition.primary must be a boolean.");if(t.forced!==void 0&&typeof t.forced!="boolean")throw new TypeError("disposition.forced must be a boolean.");if(t.original!==void 0&&typeof t.original!="boolean")throw new TypeError("disposition.original must be a boolean.");if(t.commentary!==void 0&&typeof t.commentary!="boolean")throw new TypeError("disposition.commentary must be a boolean.");if(t.hearingImpaired!==void 0&&typeof t.hearingImpaired!="boolean")throw new TypeError("disposition.hearingImpaired must be a boolean.");if(t.visuallyImpaired!==void 0&&typeof t.visuallyImpaired!="boolean")throw new TypeError("disposition.visuallyImpaired must be a boolean.")};var ae=class t{constructor(e){this.bytes=e,this.pos=0;}seekToByte(e){this.pos=8*e;}readBit(){let e=Math.floor(this.pos/8),r=this.bytes[e]??0,i=7-(this.pos&7),s=(r&1<<i)>>i;return this.pos++,s}readBits(e){if(e===1)return this.readBit();let r=0;for(let i=0;i<e;i++)r<<=1,r|=this.readBit();return r}writeBits(e,r){let i=this.pos+e;for(let s=this.pos;s<i;s++){let n=Math.floor(s/8),o=this.bytes[n],a=7-(s&7);o&=~(1<<a),o|=(r&1<<i-s-1)>>i-s-1<<a,this.bytes[n]=o;}this.pos=i;}readAlignedByte(){if(this.pos%8!==0)throw new Error("Bitstream is not byte-aligned.");let e=this.pos/8,r=this.bytes[e]??0;return this.pos+=8,r}skipBits(e){this.pos+=e;}getBitsLeft(){return this.bytes.length*8-this.pos}clone(){let e=new t(this.bytes);return e.pos=this.pos,e}};var ei=[96e3,88200,64e3,48e3,44100,32e3,24e3,22050,16e3,12e3,11025,8e3,7350],Li=[-1,1,2,3,4,5,6,8],Ar=t=>{if(!t||t.byteLength<2)throw new TypeError("AAC description must be at least 2 bytes long.");let e=new ae(t),r=os(e),{frequencyIndex:i,sampleRate:s}=as(e),n=e.readBits(4),o=null;n>=1&&n<=7&&(o=Li[n]);let a=r,c=!1,l=s;if(r===5||r===29)c=r===29,l=as(e).sampleRate,a=os(e),a===22&&e.skipBits(4);else for(;e.getBitsLeft()>15;){let u=e.pos;if(e.readBits(11)!==695){e.pos=u+1;continue}os(e)===5&&e.readBits(1)&&(l=as(e).sampleRate,e.getBitsLeft()>11&&e.readBits(11)===1352&&(c=!!e.readBits(1)));break}return o!==null&&o>1&&(c=!1),{objectType:r,coreObjectType:a,frequencyIndex:i,channelConfiguration:n,outputSampleRate:l,outputNumberOfChannels:c&&o===1?2:o}},os=t=>{let e=t.readBits(5);return e===31?32+t.readBits(6):e},as=t=>{let e=t.readBits(4);return e===15?{frequencyIndex:e,sampleRate:t.readBits(24)}:{frequencyIndex:e,sampleRate:e<ei.length?ei[e]:null}},Hi=t=>{let e=t.objectType===5||t.objectType===29,r=t.objectType===29,i=e?t.outputSampleRate/2:t.outputSampleRate,s=r?1:t.outputNumberOfChannels,n=Li.indexOf(s);if(n===-1)throw new TypeError(`Unsupported number of channels: ${t.outputNumberOfChannels}`);let o=16;t.objectType>=32&&(o+=6),cs(i)===15&&(o+=24),e&&(o+=9,cs(t.outputSampleRate)===15&&(o+=24));let a=Math.ceil(o/8),c=new Uint8Array(a),l=new ae(c);return xo(l,t.objectType),_o(l,i),l.writeBits(4,n),e&&(_o(l,t.outputSampleRate),xo(l,2)),l.writeBits(3,0),c},xo=(t,e)=>{e<32?t.writeBits(5,e):(t.writeBits(5,31),t.writeBits(6,e-32));},_o=(t,e)=>{let r=cs(e);t.writeBits(4,r),r===15&&t.writeBits(24,e);},cs=t=>{let e=ei.indexOf(t);return e===-1?15:e};var ti=[48e3,44100,32e3],ls=[24e3,22050,16e3];var Ze;(function(t){t[t.NON_IDR_SLICE=1]="NON_IDR_SLICE",t[t.SLICE_DPA=2]="SLICE_DPA",t[t.SLICE_DPB=3]="SLICE_DPB",t[t.SLICE_DPC=4]="SLICE_DPC",t[t.IDR=5]="IDR",t[t.SEI=6]="SEI",t[t.SPS=7]="SPS",t[t.PPS=8]="PPS",t[t.AUD=9]="AUD",t[t.SPS_EXT=13]="SPS_EXT";})(Ze||(Ze={}));var Ce;(function(t){t[t.RASL_N=8]="RASL_N",t[t.RASL_R=9]="RASL_R",t[t.BLA_W_LP=16]="BLA_W_LP",t[t.RSV_IRAP_VCL23=23]="RSV_IRAP_VCL23",t[t.VPS_NUT=32]="VPS_NUT",t[t.SPS_NUT=33]="SPS_NUT",t[t.PPS_NUT=34]="PPS_NUT",t[t.AUD_NUT=35]="AUD_NUT",t[t.PREFIX_SEI_NUT=39]="PREFIX_SEI_NUT",t[t.SUFFIX_SEI_NUT=40]="SUFFIX_SEI_NUT";})(Ce||(Ce={}));var kr=function*(t){let e=0,r=-1;for(;e<t.length-2;){let i=t.indexOf(0,e);if(i===-1||i>=t.length-2)break;e=i;let s=0;if(e+3<t.length&&t[e+1]===0&&t[e+2]===0&&t[e+3]===1?s=4:t[e+1]===0&&t[e+2]===1&&(s=3),s===0){e++;continue}r!==-1&&e>r&&(yield {offset:r,length:e-r}),r=e+s,e=r;}r!==-1&&r<t.length&&(yield {offset:r,length:t.length-r});},Io=function*(t,e){let r=0,i=new DataView(t.buffer,t.byteOffset,t.byteLength);for(;r+e<=t.length;){let s;e===1?s=i.getUint8(r):e===2?s=i.getUint16(r,!1):e===3?s=Yt(i,r,!1):(g(e===4),s=i.getUint32(r,!1)),r+=e,yield {offset:r,length:s},r+=s;}},ds=(t,e)=>{if(e.description){let s=(Te(e.description)[4]&3)+1;return Io(t,s)}else return kr(t)},Ki=t=>t&31,Gi=t=>{let e=[],r=t.length;for(let i=0;i<r;i++)i+2<r&&t[i]===0&&t[i+1]===0&&t[i+2]===3?(e.push(0,0),i+=2):e.push(t[i]);return new Uint8Array(e)},us=new Uint8Array([0,0,0,1]),Po=t=>{let e=t.reduce((s,n)=>s+us.byteLength+n.byteLength,0),r=new Uint8Array(e),i=0;for(let s of t)r.set(us,i),i+=us.byteLength,r.set(s,i),i+=s.byteLength;return r},$i=(t,e)=>{let r=t.reduce((n,o)=>n+e+o.byteLength,0),i=new Uint8Array(r),s=0;for(let n of t){let o=new DataView(i.buffer,i.byteOffset,i.byteLength);switch(e){case 1:o.setUint8(s,n.byteLength);break;case 2:o.setUint16(s,n.byteLength,!1);break;case 3:Kr(o,s,n.byteLength,!1);break;case 4:o.setUint32(s,n.byteLength,!1);break}s+=e,i.set(n,s),s+=n.byteLength;}return i},Ro=(t,e)=>{if(e.description){let s=(Te(e.description)[4]&3)+1;return $i(t,s)}else return Po(t)},Sr=t=>{try{let e=[],r=[],i=[];for(let a of kr(t)){let c=t.subarray(a.offset,a.offset+a.length),l=Ki(c[0]);l===Ze.SPS?e.push(c):l===Ze.PPS?r.push(c):l===Ze.SPS_EXT&&i.push(c);}if(e.length===0||r.length===0)return null;let s=e[0],n=ni(s);g(n!==null);let o=n.profileIdc===100||n.profileIdc===110||n.profileIdc===122||n.profileIdc===144;return {configurationVersion:1,avcProfileIndication:n.profileIdc,profileCompatibility:n.constraintFlags,avcLevelIndication:n.levelIdc,lengthSizeMinusOne:3,sequenceParameterSets:e,pictureParameterSets:r,chromaFormat:o?n.chromaFormatIdc:null,bitDepthLumaMinus8:o?n.bitDepthLumaMinus8:null,bitDepthChromaMinus8:o?n.bitDepthChromaMinus8:null,sequenceParameterSetExt:o?i:null}}catch(e){return K._error("Error building AVC Decoder Configuration Record:",e),null}},Fo=t=>{let e=[];e.push(t.configurationVersion),e.push(t.avcProfileIndication),e.push(t.profileCompatibility),e.push(t.avcLevelIndication),e.push(252|t.lengthSizeMinusOne&3),e.push(224|t.sequenceParameterSets.length&31);for(let r of t.sequenceParameterSets){let i=r.byteLength;e.push(i>>8),e.push(i&255);for(let s=0;s<i;s++)e.push(r[s]);}e.push(t.pictureParameterSets.length);for(let r of t.pictureParameterSets){let i=r.byteLength;e.push(i>>8),e.push(i&255);for(let s=0;s<i;s++)e.push(r[s]);}if(t.avcProfileIndication===100||t.avcProfileIndication===110||t.avcProfileIndication===122||t.avcProfileIndication===144){g(t.chromaFormat!==null),g(t.bitDepthLumaMinus8!==null),g(t.bitDepthChromaMinus8!==null),g(t.sequenceParameterSetExt!==null),e.push(252|t.chromaFormat&3),e.push(248|t.bitDepthLumaMinus8&7),e.push(248|t.bitDepthChromaMinus8&7),e.push(t.sequenceParameterSetExt.length);for(let r of t.sequenceParameterSetExt){let i=r.byteLength;e.push(i>>8),e.push(i&255);for(let s=0;s<i;s++)e.push(r[s]);}}return new Uint8Array(e)},Xi=t=>{try{let e=ie(t),r=0,i=e.getUint8(r++),s=e.getUint8(r++),n=e.getUint8(r++),o=e.getUint8(r++),a=e.getUint8(r++)&3,c=e.getUint8(r++)&31,l=[];for(let m=0;m<c;m++){let p=e.getUint16(r,!1);r+=2,l.push(t.subarray(r,r+p)),r+=p;}let u=e.getUint8(r++),d=[];for(let m=0;m<u;m++){let p=e.getUint16(r,!1);r+=2,d.push(t.subarray(r,r+p)),r+=p;}let f={configurationVersion:i,avcProfileIndication:s,profileCompatibility:n,avcLevelIndication:o,lengthSizeMinusOne:a,sequenceParameterSets:l,pictureParameterSets:d,chromaFormat:null,bitDepthLumaMinus8:null,bitDepthChromaMinus8:null,sequenceParameterSetExt:null};if((s===100||s===110||s===122||s===144)&&r+4<=t.length){let m=e.getUint8(r++)&3,p=e.getUint8(r++)&7,b=e.getUint8(r++)&7,y=e.getUint8(r++);f.chromaFormat=m,f.bitDepthLumaMinus8=p,f.bitDepthChromaMinus8=b;let w=[];for(let A=0;A<y;A++){let T=e.getUint16(r,!1);r+=2,w.push(t.subarray(r,r+T)),r+=T;}f.sequenceParameterSetExt=w;}return f}catch(e){return K._error("Error deserializing AVC Decoder Configuration Record:",e),null}},Bo={1:{num:1,den:1},2:{num:12,den:11},3:{num:10,den:11},4:{num:16,den:11},5:{num:40,den:33},6:{num:24,den:11},7:{num:20,den:11},8:{num:32,den:11},9:{num:80,den:33},10:{num:18,den:11},11:{num:15,den:11},12:{num:64,den:33},13:{num:160,den:99},14:{num:4,den:3},15:{num:3,den:2},16:{num:2,den:1}},ni=t=>{try{let e=new ae(Gi(t));if(e.skipBits(1),e.skipBits(2),e.readBits(5)!==7)return null;let i=e.readAlignedByte(),s=e.readAlignedByte(),n=e.readAlignedByte();D(e);let o=1,a=0,c=0,l=0;if((i===100||i===110||i===122||i===244||i===44||i===83||i===86||i===118||i===128)&&(o=D(e),o===3&&(l=e.readBits(1)),a=D(e),c=D(e),e.skipBits(1),e.readBits(1))){for(let N=0;N<(o!==3?8:12);N++)if(e.readBits(1)){let oe=N<6?16:64,Y=8,G=8;for(let ne=0;ne<oe;ne++){if(G!==0){let ge=st(e);G=(Y+ge+256)%256;}Y=G===0?Y:G;}}}D(e);let u=D(e);if(u===0)D(e);else if(u===1){e.skipBits(1),st(e),st(e);let z=D(e);for(let N=0;N<z;N++)st(e);}D(e),e.skipBits(1);let d=D(e),f=D(e),m=16*(d+1),p=16*(f+1),b=m,y=p,w=e.readBits(1);if(w||e.skipBits(1),e.skipBits(1),e.readBits(1)){let z=D(e),N=D(e),Z=D(e),oe=D(e),Y,G;if((l===0?o:0)===0)Y=1,G=2-w;else {let ge=o===3?1:2,Ie=o===1?2:1;Y=ge,G=Ie*(2-w);}b-=Y*(z+N),y-=G*(Z+oe);}let T=2,I=2,v=2,F=0,E={num:1,den:1},k=null,_=null;if(e.readBits(1)){if(e.readBits(1)){let Ie=e.readBits(8);if(Ie===255)E={num:e.readBits(16),den:e.readBits(16)};else {let Be=Bo[Ie];Be&&(E=Be);}}e.readBits(1)&&e.skipBits(1),e.readBits(1)&&(e.skipBits(3),F=e.readBits(1),e.readBits(1)&&(T=e.readBits(8),I=e.readBits(8),v=e.readBits(8))),e.readBits(1)&&(D(e),D(e)),e.readBits(1)&&(e.skipBits(32),e.skipBits(32),e.skipBits(1));let G=e.readBits(1);G&&Co(e);let ne=e.readBits(1);ne&&Co(e),(G||ne)&&e.skipBits(1),e.skipBits(1),e.readBits(1)&&(e.skipBits(1),D(e),D(e),D(e),D(e),k=D(e),_=D(e));}if(k===null){g(_===null);let z=s&16;if((i===44||i===86||i===100||i===110||i===122||i===244)&&z)k=0,_=0;else {let N=d+1,Z=f+1,oe=(2-w)*Z,Y=ii.find(ne=>ne.level>=n)??fe(ii),G=Math.min(Math.floor(Y.maxDpbMbs/(N*oe)),16);k=G,_=G;}}return g(_!==null),{profileIdc:i,constraintFlags:s,levelIdc:n,frameMbsOnlyFlag:w,chromaFormatIdc:o,bitDepthLumaMinus8:a,bitDepthChromaMinus8:c,codedWidth:m,codedHeight:p,displayWidth:b,displayHeight:y,pixelAspectRatio:E,colourPrimaries:T,matrixCoefficients:v,transferCharacteristics:I,fullRangeFlag:F,numReorderFrames:k,maxDecFrameBuffering:_}}catch(e){return K._error("Error parsing AVC SPS:",e),null}},Co=t=>{let e=D(t);t.skipBits(4),t.skipBits(4);for(let r=0;r<=e;r++)D(t),D(t),t.skipBits(1);t.skipBits(5),t.skipBits(5),t.skipBits(5),t.skipBits(5);},Ic=(t,e)=>{if(e.description){let s=(Te(e.description)[21]&3)+1;return $i(t,s)}else return Po(t)},ri=(t,e)=>{if(e.description){let s=(Te(e.description)[21]&3)+1;return Io(t,s)}else return kr(t)},Tr=t=>t>>1&63,fs=t=>{try{let e=new ae(Gi(t));e.skipBits(16),e.readBits(4);let r=e.readBits(3),i=e.readBits(1),{general_profile_space:s,general_tier_flag:n,general_profile_idc:o,general_profile_compatibility_flags:a,general_constraint_indicator_flags:c,general_level_idc:l}=Pc(e,r);D(e);let u=D(e),d=0;u===3&&(d=e.readBits(1));let f=D(e),m=D(e),p=f,b=m;if(e.readBits(1)){let N=D(e),Z=D(e),oe=D(e),Y=D(e),G=1,ne=1,ge=d===0?u:0;ge===1?(G=2,ne=2):ge===2&&(G=2,ne=1),p-=(N+Z)*G,b-=(oe+Y)*ne;}let y=D(e),w=D(e);D(e);let T=e.readBits(1)?0:r,I=0;for(let N=T;N<=r;N++)D(e),I=D(e),D(e);D(e),D(e),D(e),D(e),D(e),D(e),e.readBits(1)&&e.readBits(1)&&Rc(e),e.skipBits(1),e.skipBits(1),e.readBits(1)&&(e.skipBits(4),e.skipBits(4),D(e),D(e),e.skipBits(1));let v=D(e);if(Fc(e,v),e.readBits(1)){let N=D(e);for(let Z=0;Z<N;Z++)D(e),e.skipBits(1);}e.skipBits(1),e.skipBits(1);let F=2,E=2,k=2,_=0,B=0,z={num:1,den:1};if(e.readBits(1)){let N=Mc(e,r);z=N.pixelAspectRatio,F=N.colourPrimaries,E=N.transferCharacteristics,k=N.matrixCoefficients,_=N.fullRangeFlag,B=N.minSpatialSegmentationIdc;}return {displayWidth:p,displayHeight:b,pixelAspectRatio:z,colourPrimaries:F,transferCharacteristics:E,matrixCoefficients:k,fullRangeFlag:_,maxDecFrameBuffering:I+1,spsMaxSubLayersMinus1:r,spsTemporalIdNestingFlag:i,generalProfileSpace:s,generalTierFlag:n,generalProfileIdc:o,generalProfileCompatibilityFlags:a,generalConstraintIndicatorFlags:c,generalLevelIdc:l,chromaFormatIdc:u,bitDepthLumaMinus8:y,bitDepthChromaMinus8:w,minSpatialSegmentationIdc:B}}catch(e){return K._error("Error parsing HEVC SPS:",e),null}},xr=t=>{try{let e=[],r=[],i=[],s=[];for(let l of kr(t)){let u=t.subarray(l.offset,l.offset+l.length),d=Tr(u[0]);d===Ce.VPS_NUT?e.push(u):d===Ce.SPS_NUT?r.push(u):d===Ce.PPS_NUT?i.push(u):(d===Ce.PREFIX_SEI_NUT||d===Ce.SUFFIX_SEI_NUT)&&s.push(u);}if(r.length===0||i.length===0)return null;let n=fs(r[0]);if(!n)return null;let o=0;if(i.length>0){let l=i[0],u=new ae(Gi(l));u.skipBits(16),D(u),D(u),u.skipBits(1),u.skipBits(1),u.skipBits(3),u.skipBits(1),u.skipBits(1),D(u),D(u),st(u),u.skipBits(1),u.skipBits(1),u.readBits(1)&&D(u),st(u),st(u),u.skipBits(1),u.skipBits(1),u.skipBits(1),u.skipBits(1);let d=u.readBits(1),f=u.readBits(1);!d&&!f?o=0:d&&!f?o=2:!d&&f?o=3:o=0;}let a=[...e.length?[{arrayCompleteness:1,nalUnitType:Ce.VPS_NUT,nalUnits:e}]:[],...r.length?[{arrayCompleteness:1,nalUnitType:Ce.SPS_NUT,nalUnits:r}]:[],...i.length?[{arrayCompleteness:1,nalUnitType:Ce.PPS_NUT,nalUnits:i}]:[],...s.length?[{arrayCompleteness:1,nalUnitType:Tr(s[0][0]),nalUnits:s}]:[]];return {configurationVersion:1,generalProfileSpace:n.generalProfileSpace,generalTierFlag:n.generalTierFlag,generalProfileIdc:n.generalProfileIdc,generalProfileCompatibilityFlags:n.generalProfileCompatibilityFlags,generalConstraintIndicatorFlags:n.generalConstraintIndicatorFlags,generalLevelIdc:n.generalLevelIdc,minSpatialSegmentationIdc:n.minSpatialSegmentationIdc,parallelismType:o,chromaFormatIdc:n.chromaFormatIdc,bitDepthLumaMinus8:n.bitDepthLumaMinus8,bitDepthChromaMinus8:n.bitDepthChromaMinus8,avgFrameRate:0,constantFrameRate:0,numTemporalLayers:n.spsMaxSubLayersMinus1+1,temporalIdNested:n.spsTemporalIdNestingFlag,lengthSizeMinusOne:3,arrays:a}}catch(e){return K._error("Error building HEVC Decoder Configuration Record:",e),null}},Pc=(t,e)=>{let r=t.readBits(2),i=t.readBits(1),s=t.readBits(5),n=0;for(let u=0;u<32;u++)n=n<<1|t.readBits(1);let o=new Uint8Array(6);for(let u=0;u<6;u++)o[u]=t.readBits(8);let a=t.readBits(8),c=[],l=[];for(let u=0;u<e;u++)c.push(t.readBits(1)),l.push(t.readBits(1));if(e>0)for(let u=e;u<8;u++)t.skipBits(2);for(let u=0;u<e;u++)c[u]&&t.skipBits(88),l[u]&&t.skipBits(8);return {general_profile_space:r,general_tier_flag:i,general_profile_idc:s,general_profile_compatibility_flags:n,general_constraint_indicator_flags:o,general_level_idc:a}},Rc=t=>{for(let e=0;e<4;e++)for(let r=0;r<(e===3?2:6);r++)if(!t.readBits(1))D(t);else {let s=Math.min(64,1<<4+(e<<1));e>1&&st(t);for(let n=0;n<s;n++)st(t);}},Fc=(t,e)=>{let r=[];for(let i=0;i<e;i++)r[i]=Bc(t,i,e,r);},Bc=(t,e,r,i)=>{let s=0,n=0,o=0;if(e!==0&&(n=t.readBits(1)),n){if(e===r){let c=D(t);o=e-(c+1);}else o=e-1;t.readBits(1),D(t);let a=i[o]??0;for(let c=0;c<=a;c++)t.readBits(1)||t.readBits(1);s=i[o];}else {let a=D(t),c=D(t);for(let l=0;l<a;l++)D(t),t.readBits(1);for(let l=0;l<c;l++)D(t),t.readBits(1);s=a+c;}return s},Mc=(t,e)=>{let r=2,i=2,s=2,n=0,o=0,a={num:1,den:1};if(t.readBits(1)){let c=t.readBits(8);if(c===255)a={num:t.readBits(16),den:t.readBits(16)};else {let l=Bo[c];l&&(a=l);}}return t.readBits(1)&&t.readBits(1),t.readBits(1)&&(t.readBits(3),n=t.readBits(1),t.readBits(1)&&(r=t.readBits(8),i=t.readBits(8),s=t.readBits(8))),t.readBits(1)&&(D(t),D(t)),t.readBits(1),t.readBits(1),t.readBits(1),t.readBits(1)&&(D(t),D(t),D(t),D(t)),t.readBits(1)&&(t.readBits(32),t.readBits(32),t.readBits(1)&&D(t),t.readBits(1)&&Dc(t,!0,e)),t.readBits(1)&&(t.readBits(1),t.readBits(1),t.readBits(1),o=D(t),D(t),D(t),D(t),D(t)),{pixelAspectRatio:a,colourPrimaries:r,transferCharacteristics:i,matrixCoefficients:s,fullRangeFlag:n,minSpatialSegmentationIdc:o}},Dc=(t,e,r)=>{let i=!1,s=!1,n=!1;e&&(i=t.readBits(1)===1,s=t.readBits(1)===1,(i||s)&&(n=t.readBits(1)===1,n&&(t.readBits(8),t.readBits(5),t.readBits(1),t.readBits(5)),t.readBits(4),t.readBits(4),n&&t.readBits(4),t.readBits(5),t.readBits(5),t.readBits(5)));for(let o=0;o<=r;o++){let a=t.readBits(1)===1,c=!0;a||(c=t.readBits(1)===1);let l=!1;c?D(t):l=t.readBits(1)===1;let u=1;l||(u=D(t)+1),i&&Eo(t,u,n),s&&Eo(t,u,n);}},Eo=(t,e,r)=>{for(let i=0;i<e;i++)D(t),D(t),r&&(D(t),D(t)),t.readBits(1);},Mo=t=>{let e=[];e.push(t.configurationVersion),e.push((t.generalProfileSpace&3)<<6|(t.generalTierFlag&1)<<5|t.generalProfileIdc&31),e.push(t.generalProfileCompatibilityFlags>>>24&255),e.push(t.generalProfileCompatibilityFlags>>>16&255),e.push(t.generalProfileCompatibilityFlags>>>8&255),e.push(t.generalProfileCompatibilityFlags&255),e.push(...t.generalConstraintIndicatorFlags),e.push(t.generalLevelIdc&255),e.push(240|t.minSpatialSegmentationIdc>>8&15),e.push(t.minSpatialSegmentationIdc&255),e.push(252|t.parallelismType&3),e.push(252|t.chromaFormatIdc&3),e.push(248|t.bitDepthLumaMinus8&7),e.push(248|t.bitDepthChromaMinus8&7),e.push(t.avgFrameRate>>8&255),e.push(t.avgFrameRate&255),e.push((t.constantFrameRate&3)<<6|(t.numTemporalLayers&7)<<3|(t.temporalIdNested&1)<<2|t.lengthSizeMinusOne&3),e.push(t.arrays.length&255);for(let r of t.arrays){e.push((r.arrayCompleteness&1)<<7|0|r.nalUnitType&63),e.push(r.nalUnits.length>>8&255),e.push(r.nalUnits.length&255);for(let i of r.nalUnits){e.push(i.length>>8&255),e.push(i.length&255);for(let s=0;s<i.length;s++)e.push(i[s]);}}return new Uint8Array(e)},Do=t=>{try{let e=ie(t),r=0,i=e.getUint8(r++),s=e.getUint8(r++),n=s>>6&3,o=s>>5&1,a=s&31,c=e.getUint32(r,!1);r+=4;let l=t.subarray(r,r+6);r+=6;let u=e.getUint8(r++),d=(e.getUint8(r++)&15)<<8|e.getUint8(r++),f=e.getUint8(r++)&3,m=e.getUint8(r++)&3,p=e.getUint8(r++)&7,b=e.getUint8(r++)&7,y=e.getUint16(r,!1);r+=2;let w=e.getUint8(r++),A=w>>6&3,T=w>>3&7,I=w>>2&1,v=w&3,F=e.getUint8(r++),E=[];for(let k=0;k<F;k++){let _=e.getUint8(r++),B=_>>7&1,z=_&63,N=e.getUint16(r,!1);r+=2;let Z=[];for(let oe=0;oe<N;oe++){let Y=e.getUint16(r,!1);r+=2,Z.push(t.subarray(r,r+Y)),r+=Y;}E.push({arrayCompleteness:B,nalUnitType:z,nalUnits:Z});}return {configurationVersion:i,generalProfileSpace:n,generalTierFlag:o,generalProfileIdc:a,generalProfileCompatibilityFlags:c,generalConstraintIndicatorFlags:l,generalLevelIdc:u,minSpatialSegmentationIdc:d,parallelismType:f,chromaFormatIdc:m,bitDepthLumaMinus8:p,bitDepthChromaMinus8:b,avgFrameRate:y,constantFrameRate:A,numTemporalLayers:T,temporalIdNested:I,lengthSizeMinusOne:v,arrays:E}}catch(e){return K._error("Error deserializing HEVC Decoder Configuration Record:",e),null}},Pe;(function(t){t[t.audAllowed=0]="audAllowed",t[t.beforeFirstVcl=1]="beforeFirstVcl",t[t.afterFirstVcl=2]="afterFirstVcl",t[t.eoBitstreamAllowed=3]="eoBitstreamAllowed",t[t.noMoreDataAllowed=4]="noMoreDataAllowed";})(Pe||(Pe={}));var Oo=(t,e)=>{let r=new Set,i=Pe.audAllowed;for(let n of ri(t,e)){if(i===Pe.noMoreDataAllowed){r.add(n.offset);continue}let o=Tr(t[n.offset]);if(i===Pe.eoBitstreamAllowed&&o!==37){r.add(n.offset);continue}let a=!1;o===35?i>Pe.audAllowed?a=!0:i=Pe.beforeFirstVcl:o<=31?i>Pe.afterFirstVcl?a=!0:i=Pe.afterFirstVcl:o===36?i!==Pe.afterFirstVcl?a=!0:i=Pe.eoBitstreamAllowed:o===37?i<Pe.afterFirstVcl?a=!0:i=Pe.noMoreDataAllowed:o===32||o===33||o===34||o===39||o>=41&&o<=44||o>=48&&o<=55?i>Pe.beforeFirstVcl?a=!0:i=Pe.beforeFirstVcl:(o===38||o===40||o>=45&&o<=47||o>=56&&o<=63)&&i<Pe.afterFirstVcl&&(a=!0),a&&r.add(n.offset);}if(r.size===0)return null;let s=[];for(let n of ri(t,e))r.has(n.offset)||s.push(t.subarray(n.offset,n.offset+n.length));return Ic(s,e)},Oc={1:{colourPrimaries:5,transferCharacteristics:6,matrixCoefficients:5},2:{colourPrimaries:1,transferCharacteristics:1,matrixCoefficients:1},3:{colourPrimaries:6,transferCharacteristics:6,matrixCoefficients:6},4:{colourPrimaries:7,transferCharacteristics:7,matrixCoefficients:7},5:{colourPrimaries:9,transferCharacteristics:14,matrixCoefficients:9},7:{colourPrimaries:1,transferCharacteristics:13,matrixCoefficients:0}},Zi=t=>{let e=new ae(t);if(e.readBits(2)!==2)return null;let i=e.readBits(1),n=(e.readBits(1)<<1)+i;if(n===3&&e.skipBits(1),e.readBits(1)===1||e.readBits(1)!==0||(e.skipBits(2),e.readBits(24)!==4817730))return null;let l=8;n>=2&&(l=e.readBits(1)?12:10);let u=e.readBits(3),d=0,f=0;if(u!==7)if(f=e.readBits(1),n===1||n===3){let k=e.readBits(1),_=e.readBits(1);d=!k&&!_?3:k&&!_?2:1,e.skipBits(1);}else d=1;else d=3,f=1;let m=e.readBits(16),p=e.readBits(16),b=m+1,y=p+1,w=b*y,A=fe(_t).level;for(let E of _t)if(w<=E.maxPictureSize){A=E.level;break}let T=Oc[u],I=T?.colourPrimaries??2,v=T?.transferCharacteristics??2,F=T?.matrixCoefficients??2;return {profile:n,level:A,bitDepth:l,chromaSubsampling:d,videoFullRangeFlag:f,colourPrimaries:I,transferCharacteristics:v,matrixCoefficients:F}},zo=t=>t.colourPrimaries!==2||t.transferCharacteristics!==2||t.matrixCoefficients!==2,Vo=function*(t){let e=new ae(t),r=()=>{let i=0;for(let s=0;s<8;s++){let n=e.readAlignedByte();if(i+=(n&127)*2**(s*7),!(n&128))break;if(s===7&&n&128)return null}return i>2**32-1?null:i};for(;e.getBitsLeft()>=8;){e.skipBits(1);let i=e.readBits(4),s=e.readBits(1),n=e.readBits(1);e.skipBits(1),s&&e.skipBits(8);let o;if(n){let a=r();if(a===null)return;o=a;}else o=Math.floor(e.getBitsLeft()/8);g(e.pos%8===0),yield {type:i,data:t.subarray(e.pos/8,e.pos/8+o)},e.skipBits(o*8);}},si=t=>{for(let{type:e,data:r}of Vo(t)){if(e!==1)continue;let i=new ae(r),s=i.readBits(3),n=i.readBits(1),o=i.readBits(1),a=0,c=0,l=0;if(o)a=i.readBits(5);else {let B=i.readBits(1),z=0;if(B){if(i.skipBits(32),i.skipBits(32),i.readBits(1)){let Y=0;for(;Y<32&&!i.readBits(1);)Y++;Y<32&&i.skipBits(Y);}z=i.readBits(1),z&&(l=i.readBits(5),i.skipBits(32),i.skipBits(5),i.skipBits(5));}let N=i.readBits(1),Z=i.readBits(5);for(let oe=0;oe<=Z;oe++){i.skipBits(12);let Y=i.readBits(5);if(oe===0&&(a=Y),Y>7){let G=i.readBits(1);oe===0&&(c=G);}if(z&&i.readBits(1)){let ne=l+1;i.skipBits(ne),i.skipBits(ne),i.skipBits(1);}N&&i.readBits(1)&&i.skipBits(4);}}let u=i.readBits(4),d=i.readBits(4),f=u+1;i.skipBits(f);let m=d+1;i.skipBits(m);let p=0;if(o?p=0:p=i.readBits(1),p&&(i.skipBits(4),i.skipBits(3)),i.skipBits(1),i.skipBits(1),i.skipBits(1),!o){i.skipBits(1),i.skipBits(1),i.skipBits(1),i.skipBits(1);let B=i.readBits(1);B&&(i.skipBits(1),i.skipBits(1));let z=i.readBits(1),N=0;z?N=2:N=i.readBits(1),N>0&&(i.readBits(1)||i.skipBits(1)),B&&i.skipBits(3);}i.skipBits(1),i.skipBits(1),i.skipBits(1);let b=i.readBits(1),y=8;s===2&&b?y=i.readBits(1)?12:10:s<=2&&(y=b?10:8);let w=0;s!==1&&(w=i.readBits(1));let A=2,T=2,I=2;i.readBits(1)&&(A=i.readBits(8),T=i.readBits(8),I=i.readBits(8));let F=0,E=1,k=1,_=0;return w?F=i.readBits(1):A===1&&T===13&&I===0?(F=1,E=0,k=0):(F=i.readBits(1),s===0?(E=1,k=1):s===1?(E=0,k=0):y===12?(E=i.readBits(1),k=E?i.readBits(1):0):(E=1,k=0),E&&k&&(_=i.readBits(2))),{profile:s,level:a,tier:c,bitDepth:y,monochrome:w,chromaSubsamplingX:E,chromaSubsamplingY:k,chromaSamplePosition:_,videoFullRangeFlag:F,colourPrimaries:A,transferCharacteristics:T,matrixCoefficients:I}}return null},Uo=t=>t.colourPrimaries!==2||t.transferCharacteristics!==2||t.matrixCoefficients!==2,Yi=t=>{if(t.length<36)return null;let r=ie(t);return r.getUint32(4)!==1768124518||r.getUint16(8)<28?null:{fullRange:!1,colourPrimaries:r.getUint8(22),transferCharacteristics:r.getUint8(23),matrixCoefficients:r.getUint8(24)}},No=t=>{let e=ie(t),r=e.getUint8(9),i=e.getUint16(10,!0),s=e.getUint32(12,!0),n=e.getInt16(16,!0),o=e.getUint8(18),a=null;return o&&(a=t.subarray(19,21+r)),{outputChannelCount:r,preSkip:i,inputSampleRate:s,outputGain:n,channelMappingFamily:o,channelMappingTable:a}};var _r=(t,e,r)=>{switch(t){case "avc":{for(let i of ds(r,e)){let s=r[i.offset],n=Ki(s);if(n>=Ze.NON_IDR_SLICE&&n<=Ze.SLICE_DPC)return "delta";if(n===Ze.IDR)return "key";if(n===Ze.SEI&&!Zr()){let o=r.subarray(i.offset,i.offset+i.length),a=Gi(o),c=1;do{let l=0;for(;;){let f=a[c++];if(f===void 0||(l+=f,f<255))break}let u=0;for(;;){let f=a[c++];if(f===void 0||(u+=f,f<255))break}if(l===6){let f=new ae(a);f.pos=8*c;let m=D(f),p=f.readBits(1);if(m===0&&p===1)return "key"}c+=u;}while(c<a.length-1)}}return "delta"}case "hevc":{for(let i of ri(r,e)){let s=Tr(r[i.offset]);if(s<Ce.BLA_W_LP)return "delta";if(s<=Ce.RSV_IRAP_VCL23)return "key"}return "delta"}case "vp8":return (r[0]&1)===0?"key":"delta";case "vp9":{let i=new ae(r);if(i.readBits(2)!==2)return null;let s=i.readBits(1);return (i.readBits(1)<<1)+s===3&&i.skipBits(1),i.readBits(1)?null:i.readBits(1)===0?"key":"delta"}case "av1":{let i=!1;for(let{type:s,data:n}of Vo(r))if(s===1){let o=new ae(n);o.skipBits(4),i=!!o.readBits(1);}else if(s===3||s===6||s===7){if(i)return "key";let o=new ae(n);return o.readBits(1)?null:o.readBits(2)===0?"key":"delta"}return null}case "prores":return "key";default:xe(t),g(!1);}},ji;(function(t){t[t.STREAMINFO=0]="STREAMINFO",t[t.VORBIS_COMMENT=4]="VORBIS_COMMENT",t[t.PICTURE=6]="PICTURE";})(ji||(ji={}));var hs=[2,1,2,3,3,4,4,5],Wo=t=>{if(t.length<7||t[0]!==11||t[1]!==119)return null;let e=new ae(t);e.skipBits(16),e.skipBits(16);let r=e.readBits(2);if(r===3)return null;let i=e.readBits(6),s=e.readBits(5);if(s>8)return null;let n=e.readBits(3),o=e.readBits(3);(o&1)!==0&&o!==1&&e.skipBits(2),(o&4)!==0&&e.skipBits(2),o===2&&e.skipBits(2);let a=e.readBits(1),c=Math.floor(i/2);return {fscod:r,bsid:s,bsmod:n,acmod:o,lfeon:a,bitRateCode:c}},cd=[128,138,192,128,140,192,160,174,240,160,176,240,192,208,288,192,210,288,224,242,336,224,244,336,256,278,384,256,280,384,320,348,480,320,350,480,384,416,288*2,384,418,288*2,448,486,336*2,448,488,336*2,256*2,278*2,384*2,256*2,279*2,384*2,320*2,348*2,480*2,320*2,349*2,480*2,384*2,417*2,576*2,384*2,418*2,576*2,448*2,487*2,672*2,448*2,488*2,672*2,512*2,557*2,768*2,512*2,558*2,768*2,640*2,696*2,960*2,640*2,697*2,960*2,768*2,835*2,1152*2,768*2,836*2,1152*2,896*2,975*2,1344*2,896*2,976*2,1344*2,1024*2,1114*2,1536*2,1024*2,1115*2,1536*2,1152*2,1253*2,1728*2,1152*2,1254*2,1728*2,1280*2,1393*2,1920*2,1280*2,1394*2,1920*2];var ld=new Uint8Array([5,4,65,67,45,51]),ud=new Uint8Array([5,4,69,65,67,51]),zc=[1,2,3,6],qo=t=>{if(t.length<6||t[0]!==11||t[1]!==119)return null;let e=new ae(t);e.skipBits(16);let r=e.readBits(2);if(e.skipBits(3),r!==0&&r!==2)return null;let i=e.readBits(11),s=e.readBits(2),n=0,o;s===3?(n=e.readBits(2),o=3):o=e.readBits(2);let a=e.readBits(3),c=e.readBits(1),l=e.readBits(5);if(l<11||l>16)return null;let u=zc[o],d;return s<3?d=ti[s]/1e3:d=ls[n]/1e3,{dataRate:Math.round((i+1)*d/(u*16)),substreams:[{fscod:s,fscod2:n,bsid:l,bsmod:0,acmod:a,lfeon:c,numDepSub:0,chanLoc:0}]}},Lo=t=>{if(t.length<2)return null;let e=new ae(t),r=e.readBits(13),i=e.readBits(3),s=[];for(let n=0;n<=i&&!(Math.ceil(e.pos/8)+3>t.length);n++){let o=e.readBits(2),a=e.readBits(5);e.skipBits(1),e.skipBits(1);let c=e.readBits(3),l=e.readBits(3),u=e.readBits(1);e.skipBits(3);let d=e.readBits(4),f=0;d>0?f=e.readBits(9):e.skipBits(1),s.push({fscod:o,fscod2:null,bsid:a,bsmod:c,acmod:l,lfeon:u,numDepSub:d,chanLoc:f});}return s.length===0?null:{dataRate:r,substreams:s}},Ho=t=>{let e=t.substreams[0];return g(e),e.fscod<3?ti[e.fscod]:e.fscod2!==null&&e.fscod2<3?ls[e.fscod2]:null},jo=t=>{let e=t.substreams[0];g(e);let r=hs[e.acmod]+e.lfeon;if(e.numDepSub>0){let i=[2,2,1,1,2,2,2,1,1];for(let s=0;s<9;s++)e.chanLoc&1<<8-s&&(r+=i[s]);}return r};var Vc=1683496997,Uc=18,Nc=10;var vo=32,Ji=20,Wc=8,qc=[0,8e3,16e3,32e3,0,0,11025,22050,44100,0,0,12e3,24e3,48e3,96e3,192e3],Lc=[32e3,56e3,64e3,96e3,112e3,128e3,192e3,224e3,256e3,32e4,384e3,448e3,512e3,576e3,64e4,768e3,96e4,1024e3,1152e3,128e4,1344e3,1408e3,1411200,1472e3,1536e3,192e4,2048e3,3072e3,384e4,0,0,0],Hc=[16,16,20,20,0,24,24,0],Qi=[1,2,2,2,2,3,3,4,4,5,6,6,6,7,8,8],jc=[1,2,2,2,2,3,18,19,6,7,518,323,83,519,582,535],Qc=8,Kc=44646,Gc=[32e3,44100,48e3,0],$c=[8e3,16e3,32e3,64e3,128e3,22050,44100,88200,176400,352800,12e3,24e3,48e3,96e3,192e3,384e3],Qo=[512,1024,2048,4096],ms=t=>{let e=Xc(t),r=ie(t),i=e?Math.ceil(e.frameSize/4)*4:0,s=null;for(;i+4<=t.length&&r.getUint32(i)===Vc;){let o=Zc(t.subarray(i));if(!o)break;s??(s=o),i+=o.frameSize;}if(e)return {frameSize:s?i:e.frameSize,sampleRate:e.sampleRate,numberOfChannels:e.numberOfChannels,sampleCount:e.sampleCount,channelLayout:e.channelLayout,pcmResolution:e.pcmResolution,bitRate:e.bitRate,core:e,hasExtensions:s!==null};if(!s?.asset)return null;let{asset:n}=s;return {frameSize:i,sampleRate:n.sampleRate,numberOfChannels:n.numberOfChannels,sampleCount:n.sampleCount,channelLayout:n.channelLayout,pcmResolution:n.pcmResolution,bitRate:0,core:null,hasExtensions:!0}},en=t=>{let e=ms(t);return e?.core?e.hasExtensions?"dtsh":"dtsc":null},Xc=t=>{if(t.length<Uc||t[0]!==127||t[1]!==254||t[2]!==128||t[3]!==1)return null;let e=new ae(t);if(e.skipBits(32),e.skipBits(1),e.readBits(5)!==vo-1)return null;let r=e.readBits(1),i=e.readBits(7)+1;if(i%Wc!==0)return null;let s=e.readBits(14)+1;if(s<96)return null;let n=e.readBits(6);if(n>=Qi.length)return null;let o=qc[e.readBits(4)];if(o===0)return null;let a=Lc[e.readBits(5)];if(e.readBits(1)!==0)return null;e.skipBits(4),e.skipBits(5);let c=e.readBits(2);if(c===3)return null;e.skipBits(1),r&&e.skipBits(16),e.skipBits(7);let l=Hc[e.readBits(3)];if(l===0)return null;let u=c!==0;return {frameSize:s,sampleRate:o,numberOfChannels:Qi[n]+(u?1:0),sampleCount:i*vo,channelLayout:jc[n]|(u?Qc:0),amode:n,lfePresent:u,bitRate:a,pcmResolution:l}},Zc=t=>{if(t.length<Nc||t[0]!==100||t[1]!==88||t[2]!==32||t[3]!==37)return null;let e=new ae(t);e.skipBits(32),e.skipBits(8);let r=e.readBits(2),i=e.readBits(1),s=8+4*i,n=16+4*i;e.skipBits(s);let o=e.readBits(n)+1,a={frameSize:o,asset:null};if(!e.readBits(1))return a;let c=Gc[e.readBits(2)],l=512*(e.readBits(3)+1);e.readBits(1)&&e.skipBits(36);let u=e.readBits(3)+1,d=e.readBits(3)+1,f=[];for(let w=0;w<u;w++)f.push(e.readBits(r+1));for(let w of f)e.skipBits(8*Oi(w));if(e.readBits(1)){e.skipBits(2);let w=e.readBits(2)+1<<2,A=e.readBits(2)+1;e.skipBits(A*w);}for(let w=0;w<d;w++)e.skipBits(n);e.skipBits(9),e.skipBits(3),e.readBits(1)&&e.skipBits(4),e.readBits(1)&&e.skipBits(24),e.readBits(1)&&e.skipBits(8*(e.readBits(10)+1));let m=e.readBits(5)+1,p=$c[e.readBits(4)],b=e.readBits(8)+1,y=0;if(e.readBits(1)&&(b>2&&e.skipBits(1),b>6&&e.skipBits(1),e.readBits(1))){let w=e.readBits(2)+1<<2;y=e.readBits(w);}return c===0||e.getBitsLeft()<0?a:{frameSize:o,asset:{sampleRate:p,numberOfChannels:b,sampleCount:Math.round(l*p/c),channelLayout:y,pcmResolution:m}}},Ko=t=>{if(t.length<Ji)return null;let e=ie(t),r=e.getUint32(0);if(r===0)return null;let i=new ae(t);i.seekToByte(13);let s=i.readBits(2);i.skipBits(5);let n=i.readBits(1),o=i.readBits(6);i.skipBits(14),i.skipBits(1),i.skipBits(3);let a=i.readBits(16),c=null;return a!==0?c=Yc(a):o<Qi.length&&(c=Qi[o]+n),{sampleRate:r,maxBitrate:e.getUint32(4),avgBitrate:e.getUint32(8),pcmSampleDepth:t[12],sampleCount:Qo[s],channelLayout:a,numberOfChannels:c}},Go=t=>{let e=new Uint8Array(Ji),r=ie(e);r.setUint32(0,t.sampleRate),r.setUint32(4,t.bitRate),r.setUint32(8,t.bitRate),e[12]=t.pcmResolution;let i=t.core&&!t.hasExtensions?1:0,s=new ae(e);return s.seekToByte(13),s.writeBits(2,Math.max(Qo.indexOf(t.sampleCount),0)),s.writeBits(5,i),s.writeBits(1,t.core?.lfePresent?1:0),s.writeBits(6,t.core?.amode??0),s.writeBits(14,t.core?t.core.frameSize-1:0),s.writeBits(1,0),s.writeBits(3,0),s.writeBits(16,t.channelLayout),s.writeBits(1,0),s.writeBits(1,0),s.writeBits(1,0),s.writeBits(5,0),e},Yc=t=>Oi(t)+Oi(t&Kc);var De=["avc","hevc","vp9","av1","vp8","prores"],Ae=["pcm-s16","pcm-s16be","pcm-s24","pcm-s24be","pcm-s32","pcm-s32be","pcm-f32","pcm-f32be","pcm-f64","pcm-f64be","pcm-u8","pcm-s8","ulaw","alaw"],qt=["aac","opus","mp3","vorbis","flac","ac3","eac3","dts"],ze=[...qt,...Ae],Lt=["webvtt"],ii=[{maxMacroblocks:99,maxBitrate:64e3,maxDpbMbs:396,level:10},{maxMacroblocks:396,maxBitrate:192e3,maxDpbMbs:900,level:11},{maxMacroblocks:396,maxBitrate:384e3,maxDpbMbs:2376,level:12},{maxMacroblocks:396,maxBitrate:768e3,maxDpbMbs:2376,level:13},{maxMacroblocks:396,maxBitrate:2e6,maxDpbMbs:2376,level:20},{maxMacroblocks:792,maxBitrate:4e6,maxDpbMbs:4752,level:21},{maxMacroblocks:1620,maxBitrate:4e6,maxDpbMbs:8100,level:22},{maxMacroblocks:1620,maxBitrate:1e7,maxDpbMbs:8100,level:30},{maxMacroblocks:3600,maxBitrate:14e6,maxDpbMbs:18e3,level:31},{maxMacroblocks:5120,maxBitrate:2e7,maxDpbMbs:20480,level:32},{maxMacroblocks:8192,maxBitrate:2e7,maxDpbMbs:32768,level:40},{maxMacroblocks:8192,maxBitrate:5e7,maxDpbMbs:32768,level:41},{maxMacroblocks:8704,maxBitrate:5e7,maxDpbMbs:34816,level:42},{maxMacroblocks:22080,maxBitrate:135e6,maxDpbMbs:110400,level:50},{maxMacroblocks:36864,maxBitrate:24e7,maxDpbMbs:184320,level:51},{maxMacroblocks:36864,maxBitrate:24e7,maxDpbMbs:184320,level:52},{maxMacroblocks:139264,maxBitrate:24e7,maxDpbMbs:696320,level:60},{maxMacroblocks:139264,maxBitrate:48e7,maxDpbMbs:696320,level:61},{maxMacroblocks:139264,maxBitrate:8e8,maxDpbMbs:696320,level:62}],$o=[{maxPictureSize:36864,maxBitrate:128e3,tier:"L",level:30},{maxPictureSize:122880,maxBitrate:15e5,tier:"L",level:60},{maxPictureSize:245760,maxBitrate:3e6,tier:"L",level:63},{maxPictureSize:552960,maxBitrate:6e6,tier:"L",level:90},{maxPictureSize:983040,maxBitrate:1e7,tier:"L",level:93},{maxPictureSize:2228224,maxBitrate:12e6,tier:"L",level:120},{maxPictureSize:2228224,maxBitrate:3e7,tier:"H",level:120},{maxPictureSize:2228224,maxBitrate:2e7,tier:"L",level:123},{maxPictureSize:2228224,maxBitrate:5e7,tier:"H",level:123},{maxPictureSize:8912896,maxBitrate:25e6,tier:"L",level:150},{maxPictureSize:8912896,maxBitrate:1e8,tier:"H",level:150},{maxPictureSize:8912896,maxBitrate:4e7,tier:"L",level:153},{maxPictureSize:8912896,maxBitrate:16e7,tier:"H",level:153},{maxPictureSize:8912896,maxBitrate:6e7,tier:"L",level:156},{maxPictureSize:8912896,maxBitrate:24e7,tier:"H",level:156},{maxPictureSize:35651584,maxBitrate:6e7,tier:"L",level:180},{maxPictureSize:35651584,maxBitrate:24e7,tier:"H",level:180},{maxPictureSize:35651584,maxBitrate:12e7,tier:"L",level:183},{maxPictureSize:35651584,maxBitrate:48e7,tier:"H",level:183},{maxPictureSize:35651584,maxBitrate:24e7,tier:"L",level:186},{maxPictureSize:35651584,maxBitrate:8e8,tier:"H",level:186}],_t=[{maxPictureSize:36864,maxBitrate:2e5,level:10},{maxPictureSize:73728,maxBitrate:8e5,level:11},{maxPictureSize:122880,maxBitrate:18e5,level:20},{maxPictureSize:245760,maxBitrate:36e5,level:21},{maxPictureSize:552960,maxBitrate:72e5,level:30},{maxPictureSize:983040,maxBitrate:12e6,level:31},{maxPictureSize:2228224,maxBitrate:18e6,level:40},{maxPictureSize:2228224,maxBitrate:3e7,level:41},{maxPictureSize:8912896,maxBitrate:6e7,level:50},{maxPictureSize:8912896,maxBitrate:12e7,level:51},{maxPictureSize:8912896,maxBitrate:18e7,level:52},{maxPictureSize:35651584,maxBitrate:18e7,level:60},{maxPictureSize:35651584,maxBitrate:24e7,level:61},{maxPictureSize:35651584,maxBitrate:48e7,level:62}],Xo=[{maxPictureSize:147456,maxBitrate:15e5,tier:"M",level:0},{maxPictureSize:278784,maxBitrate:3e6,tier:"M",level:1},{maxPictureSize:665856,maxBitrate:6e6,tier:"M",level:4},{maxPictureSize:1065024,maxBitrate:1e7,tier:"M",level:5},{maxPictureSize:2359296,maxBitrate:12e6,tier:"M",level:8},{maxPictureSize:2359296,maxBitrate:3e7,tier:"H",level:8},{maxPictureSize:2359296,maxBitrate:2e7,tier:"M",level:9},{maxPictureSize:2359296,maxBitrate:5e7,tier:"H",level:9},{maxPictureSize:8912896,maxBitrate:3e7,tier:"M",level:12},{maxPictureSize:8912896,maxBitrate:1e8,tier:"H",level:12},{maxPictureSize:8912896,maxBitrate:4e7,tier:"M",level:13},{maxPictureSize:8912896,maxBitrate:16e7,tier:"H",level:13},{maxPictureSize:8912896,maxBitrate:6e7,tier:"M",level:14},{maxPictureSize:8912896,maxBitrate:24e7,tier:"H",level:14},{maxPictureSize:35651584,maxBitrate:6e7,tier:"M",level:15},{maxPictureSize:35651584,maxBitrate:24e7,tier:"H",level:15},{maxPictureSize:35651584,maxBitrate:6e7,tier:"M",level:16},{maxPictureSize:35651584,maxBitrate:24e7,tier:"H",level:16},{maxPictureSize:35651584,maxBitrate:1e8,tier:"M",level:17},{maxPictureSize:35651584,maxBitrate:48e7,tier:"H",level:17},{maxPictureSize:35651584,maxBitrate:16e7,tier:"M",level:18},{maxPictureSize:35651584,maxBitrate:8e8,tier:"H",level:18},{maxPictureSize:35651584,maxBitrate:16e7,tier:"M",level:19},{maxPictureSize:35651584,maxBitrate:8e8,tier:"H",level:19}],Zo=".01.01.01.01.00",Yo=".0.110.01.01.01.0",Ct=["ap4x","ap4h","apch","apcn","apcs","apco"],oi=["dtsc","dtsh","dtsl","dtse"],Jc=[{fourCc:"apco",bitrate:45e6,alpha:!1},{fourCc:"apcs",bitrate:102e6,alpha:!1},{fourCc:"apcn",bitrate:147e6,alpha:!1},{fourCc:"apch",bitrate:22e7,alpha:!1},{fourCc:"ap4h",bitrate:33e7,alpha:!0},{fourCc:"ap4x",bitrate:5e8,alpha:!0}],Jo=(t,e,r,i,s)=>{if(t==="avc"){let o=Math.ceil(e/16)*Math.ceil(r/16),a=ii.find(f=>o<=f.maxMacroblocks&&i<=f.maxBitrate)??fe(ii),c=a?a.level:0,l="64".padStart(2,"0"),u="00",d=c.toString(16).padStart(2,"0");return `avc1.${l}${u}${d}`}else if(t==="hevc"){let c=e*r,l=$o.find(d=>c<=d.maxPictureSize&&i<=d.maxBitrate)??fe($o);return `hev1.1.6.${l.tier}${l.level}.B0`}else {if(t==="vp8")return "vp8";if(t==="vp9"){let o=e*r;return `vp09.00.${(_t.find(l=>o<=l.maxPictureSize&&i<=l.maxBitrate)??fe(_t)).level.toString().padStart(2,"0")}.08`}else if(t==="av1"){let o=e*r,a=Xo.find(u=>o<=u.maxPictureSize&&i<=u.maxBitrate)??fe(Xo);return `av01.0.${a.level.toString().padStart(2,"0")}${a.tier}.08`}else if(t==="prores"){let o=Math.pow(e*r/2073600,.95),a=Jc.filter(u=>u.alpha===s),c=a[0].fourCc,l=1/0;for(let{fourCc:u,bitrate:d}of a){let f=Math.abs(d*o-i);f<l&&(l=f,c=u);}return c}else xe(t);}throw new TypeError(`Unhandled codec '${String(t)}'.`)};var ea=t=>{let e=t.split("."),s=(1<<7)+1,n=Number(e[1]),o=e[2],a=Number(o.slice(0,-1)),c=(n<<5)+a,l=o.slice(-1)==="H"?1:0,u=Number(e[3]),d=u===8?0:1,f=u===12?1:0,m=e[4]?Number(e[4]):0,p=e[5]?Number(e[5][0]):1,b=e[5]?Number(e[5][1]):1,y=e[5]?Number(e[5][2]):0,w=(l<<7)+(d<<6)+(f<<5)+(m<<4)+(p<<3)+(b<<2)+y;return [s,c,w,0]},tn=t=>{let{codec:e,codecDescription:r,colorSpace:i,avcCodecInfo:s,hevcCodecInfo:n,vp9CodecInfo:o,av1CodecInfo:a,proresFormat:c}=t;if(e==="avc"){if(g(t.avcType!==null),s){let l=new Uint8Array([s.avcProfileIndication,s.profileCompatibility,s.avcLevelIndication]);return `avc${t.avcType}.${Vt(l)}`}if(!r||r.byteLength<4)throw new TypeError("AVC decoder description is not provided or is not at least 4 bytes long.");return `avc${t.avcType}.${Vt(r.subarray(1,4))}`}else if(e==="hevc"){let l,u,d,f,m,p;if(n)l=n.generalProfileSpace,u=n.generalProfileIdc,d=ts(n.generalProfileCompatibilityFlags),f=n.generalTierFlag,m=n.generalLevelIdc,p=[...n.generalConstraintIndicatorFlags];else {if(!r||r.byteLength<23)throw new TypeError("HEVC decoder description is not provided or is not at least 23 bytes long.");let y=ie(r),w=y.getUint8(1);l=w>>6&3,u=w&31,d=ts(y.getUint32(2)),f=w>>5&1,m=y.getUint8(12),p=[];for(let A=0;A<6;A++)p.push(y.getUint8(6+A));}let b="hev1.";for(b+=["","A","B","C"][l]+u,b+=".",b+=d.toString(16).toUpperCase(),b+=".",b+=f===0?"L":"H",b+=m;p.length>0&&p[p.length-1]===0;)p.pop();return p.length>0&&(b+=".",b+=p.map(y=>y.toString(16).toUpperCase()).join(".")),b}else {if(e==="vp8")return "vp8";if(e==="vp9"){if(!o){let A=t.width*t.height,T=fe(_t).level;for(let I of _t)if(A<=I.maxPictureSize){T=I.level;break}return `vp09.00.${T.toString().padStart(2,"0")}.08`}let l=o.profile.toString().padStart(2,"0"),u=o.level.toString().padStart(2,"0"),d=o.bitDepth.toString().padStart(2,"0"),f=o.chromaSubsampling.toString().padStart(2,"0"),m=o.colourPrimaries.toString().padStart(2,"0"),p=o.transferCharacteristics.toString().padStart(2,"0"),b=o.matrixCoefficients.toString().padStart(2,"0"),y=o.videoFullRangeFlag.toString().padStart(2,"0"),w=`vp09.${l}.${u}.${d}.${f}`;return w+=`.${m}.${p}.${b}.${y}`,w.endsWith(Zo)&&(w=w.slice(0,-Zo.length)),w}else if(e==="av1"){if(!a){let I=t.width*t.height,v=fe(_t).level;for(let F of _t)if(I<=F.maxPictureSize){v=F.level;break}return `av01.0.${v.toString().padStart(2,"0")}M.08`}let l=a.profile,u=a.level.toString().padStart(2,"0"),d=a.tier?"H":"M",f=a.bitDepth.toString().padStart(2,"0"),m=a.monochrome?"1":"0",p=100*a.chromaSubsamplingX+10*a.chromaSubsamplingY+1*(a.chromaSubsamplingX&&a.chromaSubsamplingY?a.chromaSamplePosition:0),b=i?.primaries?At[i.primaries]:1,y=i?.transfer?Tt[i.transfer]:1,w=i?.matrix?kt[i.matrix]:1,A=i?.fullRange?1:0,T=`av01.${l}.${u}${d}.${f}`;return T+=`.${m}.${p.toString().padStart(3,"0")}`,T+=`.${b.toString().padStart(2,"0")}`,T+=`.${y.toString().padStart(2,"0")}`,T+=`.${w.toString().padStart(2,"0")}`,T+=`.${A}`,T.endsWith(Yo)&&(T=T.slice(0,-Yo.length)),T}else {if(e==="prores")return c??"apch";e!==null&&xe(e);}}throw new TypeError(`Unhandled codec '${e}'.`)},rn=t=>{switch(t.codec){case "avc":{let e=t.avcCodecInfo?.sequenceParameterSets[0];if(!e&&t.codecDescription&&(e=Xi(t.codecDescription)?.sequenceParameterSets[0]),e){let r=ni(e);if(r)return {primaries:ot[r.colourPrimaries],transfer:at[r.transferCharacteristics],matrix:ct[r.matrixCoefficients],fullRange:!!r.fullRangeFlag}}}break;case "hevc":{let e=t.hevcCodecInfo?.arrays.find(r=>r.nalUnitType===Ce.SPS_NUT)?.nalUnits[0];if(!e&&t.codecDescription&&(e=Do(t.codecDescription)?.arrays.find(r=>r.nalUnitType===Ce.SPS_NUT)?.nalUnits[0]),e){let r=fs(e);if(r)return {primaries:ot[r.colourPrimaries],transfer:at[r.transferCharacteristics],matrix:ct[r.matrixCoefficients],fullRange:!!r.fullRangeFlag}}}break;case "vp8":break;case "vp9":if(t.vp9CodecInfo)return {primaries:ot[t.vp9CodecInfo.colourPrimaries],transfer:at[t.vp9CodecInfo.transferCharacteristics],matrix:ct[t.vp9CodecInfo.matrixCoefficients],fullRange:!!t.vp9CodecInfo.videoFullRangeFlag};break;case "av1":if(t.av1CodecInfo)return {primaries:ot[t.av1CodecInfo.colourPrimaries],transfer:at[t.av1CodecInfo.transferCharacteristics],matrix:ct[t.av1CodecInfo.matrixCoefficients],fullRange:!!t.av1CodecInfo.videoFullRangeFlag};break;case "prores":if(t.proresCodecInfo)return {primaries:ot[t.proresCodecInfo.colourPrimaries],transfer:at[t.proresCodecInfo.transferCharacteristics],matrix:ct[t.proresCodecInfo.matrixCoefficients],fullRange:t.proresCodecInfo.fullRange};break}return {primaries:void 0,transfer:void 0,matrix:void 0,fullRange:void 0}},ta=(t,e,r)=>{if(t==="aac")return e>=2&&r<=24e3?"mp4a.40.29":r<=24e3?"mp4a.40.5":"mp4a.40.2";if(t==="mp3")return "mp3";if(t==="opus")return "opus";if(t==="vorbis")return "vorbis";if(t==="flac")return "flac";if(t==="ac3")return "ac-3";if(t==="eac3")return "ec-3";if(t==="dts")return "dtsc";if(Ae.includes(t))return t;throw new TypeError(`Unhandled codec '${t}'.`)},nn=t=>{let{codec:e,codecDescription:r,aacCodecInfo:i,dtsFormat:s}=t;if(e==="aac"){if(!i)throw new TypeError("AAC codec info must be provided.");if(i.isMpeg2)return "mp4a.67";{let n;return i.objectType!==null?n=i.objectType:n=Ar(r).objectType,`mp4a.40.${n}`}}else {if(e==="mp3")return "mp3";if(e==="opus")return "opus";if(e==="vorbis")return "vorbis";if(e==="flac")return "flac";if(e==="ac3")return "ac-3";if(e==="eac3")return "ec-3";if(e==="dts")return s??"dtsc";if(e&&Ae.includes(e))return e}throw new TypeError(`Unhandled codec '${e}'.`)};var sn=48e3,ra=/^pcm-([usf])(\d+)(be)?$/,Ve=t=>{if(g(Ae.includes(t)),t==="ulaw")return {dataType:"ulaw",sampleSize:1,littleEndian:!0,silentValue:255};if(t==="alaw")return {dataType:"alaw",sampleSize:1,littleEndian:!0,silentValue:213};let e=ra.exec(t);g(e);let r;e[1]==="u"?r="unsigned":e[1]==="s"?r="signed":r="float";let i=Number(e[2])/8,s=e[3]!=="be",n=t==="pcm-u8"?2**7:0;return {dataType:r,sampleSize:i,littleEndian:s,silentValue:n}},ai=t=>t.startsWith("avc1")||t.startsWith("avc3")?"avc":t.startsWith("hev1")||t.startsWith("hvc1")?"hevc":t==="vp8"?"vp8":t.startsWith("vp09")?"vp9":t.startsWith("av01")?"av1":Ct.includes(t)?"prores":t==="mp3"||t==="mp4a.69"||t==="mp4a.6B"||t==="mp4a.6b"||t==="mp4a.40.34"?"mp3":t.startsWith("mp4a.40.")||t==="mp4a.67"?"aac":t==="opus"?"opus":t==="vorbis"?"vorbis":t==="flac"?"flac":t==="ac-3"||t==="ac3"?"ac3":t==="ec-3"||t==="eac3"?"eac3":oi.includes(t)?"dts":t==="ulaw"?"ulaw":t==="alaw"?"alaw":ra.test(t)?t:t==="webvtt"?"webvtt":null,ia=t=>t==="avc"?{avc:{format:"avc"}}:t==="hevc"?{hevc:{format:"hevc"}}:{},na=t=>t==="aac"?{aac:{format:"aac"}}:t==="opus"?{opus:{format:"opus"}}:{},el=["avc1","avc3","hev1","hvc1","vp8","vp09","av01",...Ct],tl=/^(avc1|avc3)\.[0-9a-fA-F]{6}$/,rl=/^(hev1|hvc1)\.(?:[ABC]?\d+)\.[0-9a-fA-F]{1,8}\.[LH]\d+(?:\.[0-9a-fA-F]{1,2}){0,6}$/,il=/^vp09(?:\.\d{2}){3}(?:(?:\.\d{2}){5})?$/,nl=/^av01\.\d\.\d{2}[MH]\.\d{2}(?:\.\d\.\d{3}\.\d{2}\.\d{2}\.\d{2}\.\d)?$/,on=(t,e)=>{if(!t)throw new TypeError("Video chunk metadata must be provided.");if(typeof t!="object")throw new TypeError("Video chunk metadata must be an object.");if(!t.decoderConfig)throw new TypeError("Video chunk metadata must include a decoder configuration.");if(typeof t.decoderConfig!="object")throw new TypeError("Video chunk metadata decoder configuration must be an object.");if(typeof t.decoderConfig.codec!="string")throw new TypeError("Video chunk metadata decoder configuration must specify a codec string.");if(!el.some(r=>t.decoderConfig.codec.startsWith(r)))throw new TypeError("Video chunk metadata decoder configuration codec string must be a valid video codec string as specified in the Mediabunny Codec Registry.");if(!Number.isInteger(t.decoderConfig.codedWidth)||t.decoderConfig.codedWidth<=0)throw new TypeError("Video chunk metadata decoder configuration must specify a valid codedWidth (positive integer).");if(!Number.isInteger(t.decoderConfig.codedHeight)||t.decoderConfig.codedHeight<=0)throw new TypeError("Video chunk metadata decoder configuration must specify a valid codedHeight (positive integer).");if(t.decoderConfig.displayAspectWidth!==void 0&&(!Number.isInteger(t.decoderConfig.displayAspectWidth)||t.decoderConfig.displayAspectWidth<=0))throw new TypeError("Video chunk metadata decoder configuration displayAspectWidth, when defined, must be a positive integer.");if(t.decoderConfig.displayAspectHeight!==void 0&&(!Number.isInteger(t.decoderConfig.displayAspectHeight)||t.decoderConfig.displayAspectHeight<=0))throw new TypeError("Video chunk metadata decoder configuration displayAspectHeight, when defined, must be a positive integer.");if(t.decoderConfig.displayAspectWidth!==void 0!=(t.decoderConfig.displayAspectHeight!==void 0))throw new TypeError("Video chunk metadata decoder configuration must specify both displayAspectWidth and displayAspectHeight, or neither.");if(t.decoderConfig.description!==void 0&&!wr(t.decoderConfig.description))throw new TypeError("Video chunk metadata decoder configuration description, when defined, must be an ArrayBuffer or an ArrayBuffer view.");if(t.decoderConfig.colorSpace!==void 0){let{colorSpace:r}=t.decoderConfig;if(typeof r!="object")throw new TypeError("Video chunk metadata decoder configuration colorSpace, when provided, must be an object.");let i=Object.keys(At);if(r.primaries!=null&&!i.includes(r.primaries))throw new TypeError(`Video chunk metadata decoder configuration colorSpace primaries, when defined, must be one of ${i.join(", ")}.`);let s=Object.keys(Tt);if(r.transfer!=null&&!s.includes(r.transfer))throw new TypeError(`Video chunk metadata decoder configuration colorSpace transfer, when defined, must be one of ${s.join(", ")}.`);let n=Object.keys(kt);if(r.matrix!=null&&!n.includes(r.matrix))throw new TypeError(`Video chunk metadata decoder configuration colorSpace matrix, when defined, must be one of ${n.join(", ")}.`);if(r.fullRange!=null&&typeof r.fullRange!="boolean")throw new TypeError("Video chunk metadata decoder configuration colorSpace fullRange, when defined, must be a boolean.")}if(t.decoderConfig.codec.startsWith("avc1")||t.decoderConfig.codec.startsWith("avc3")){if(!tl.test(t.decoderConfig.codec))throw new TypeError("Video chunk metadata decoder configuration codec string for AVC must be a valid AVC codec string as specified in Section 3.4 of RFC 6381.")}else if(t.decoderConfig.codec.startsWith("hev1")||t.decoderConfig.codec.startsWith("hvc1")){if(!rl.test(t.decoderConfig.codec))throw new TypeError("Video chunk metadata decoder configuration codec string for HEVC must be a valid HEVC codec string as specified in Section E.3 of ISO 14496-15.")}else if(t.decoderConfig.codec.startsWith("vp8")){if(t.decoderConfig.codec!=="vp8")throw new TypeError('Video chunk metadata decoder configuration codec string for VP8 must be "vp8".')}else if(t.decoderConfig.codec.startsWith("vp09")){if(!il.test(t.decoderConfig.codec))throw new TypeError('Video chunk metadata decoder configuration codec string for VP9 must be a valid VP9 codec string as specified in Section "Codecs Parameter String" of https://www.webmproject.org/vp9/mp4/.')}else if(t.decoderConfig.codec.startsWith("av01")){if(!nl.test(t.decoderConfig.codec))throw new TypeError('Video chunk metadata decoder configuration codec string for AV1 must be a valid AV1 codec string as specified in Section "Codecs Parameter String" of https://aomediacodec.github.io/av1-isobmff/.')}else if(Ct.some(r=>t.decoderConfig.codec.startsWith(r))&&!Ct.some(r=>t.decoderConfig.codec===r))throw new TypeError(`Video chunk metadata decoder configuration codec string for ProRes must be one of the valid ProRes four-character codes: ${Ct.join(", ")}.`);if(e!==null&&ai(t.decoderConfig.codec)!==e)throw new TypeError(`Video chunk metadata decoder configuration codec string '${t.decoderConfig.codec}' does not fit to the track codec '${e}'.`)},sl=["mp4a","mp3","opus","vorbis","flac","ulaw","alaw","pcm","ac-3","ec-3","dts"],an=(t,e)=>{if(!t)throw new TypeError("Audio chunk metadata must be provided.");if(typeof t!="object")throw new TypeError("Audio chunk metadata must be an object.");if(!t.decoderConfig)throw new TypeError("Audio chunk metadata must include a decoder configuration.");if(typeof t.decoderConfig!="object")throw new TypeError("Audio chunk metadata decoder configuration must be an object.");if(typeof t.decoderConfig.codec!="string")throw new TypeError("Audio chunk metadata decoder configuration must specify a codec string.");if(!sl.some(r=>t.decoderConfig.codec.startsWith(r)))throw new TypeError("Audio chunk metadata decoder configuration codec string must be a valid audio codec string as specified in the Mediabunny Codec Registry.");if(!Number.isInteger(t.decoderConfig.sampleRate)||t.decoderConfig.sampleRate<=0)throw new TypeError("Audio chunk metadata decoder configuration must specify a valid sampleRate (positive integer).");if(!Number.isInteger(t.decoderConfig.numberOfChannels)||t.decoderConfig.numberOfChannels<=0)throw new TypeError("Audio chunk metadata decoder configuration must specify a valid numberOfChannels (positive integer).");if(t.decoderConfig.description!==void 0&&!wr(t.decoderConfig.description))throw new TypeError("Audio chunk metadata decoder configuration description, when defined, must be an ArrayBuffer or an ArrayBuffer view.");if(t.decoderConfig.codec.startsWith("mp4a")&&t.decoderConfig.codec!=="mp4a.69"&&t.decoderConfig.codec!=="mp4a.6B"&&t.decoderConfig.codec!=="mp4a.6b"){if(!["mp4a.40.2","mp4a.40.02","mp4a.40.5","mp4a.40.05","mp4a.40.29","mp4a.67"].includes(t.decoderConfig.codec))throw new TypeError("Audio chunk metadata decoder configuration codec string for AAC must be a valid AAC codec string as specified in https://www.w3.org/TR/webcodecs-aac-codec-registration/.")}else if(t.decoderConfig.codec.startsWith("mp3")||t.decoderConfig.codec.startsWith("mp4a")){if(t.decoderConfig.codec!=="mp3"&&t.decoderConfig.codec!=="mp4a.69"&&t.decoderConfig.codec!=="mp4a.6B"&&t.decoderConfig.codec!=="mp4a.6b")throw new TypeError('Audio chunk metadata decoder configuration codec string for MP3 must be "mp3", "mp4a.69" or "mp4a.6B".')}else if(t.decoderConfig.codec.startsWith("opus")){if(t.decoderConfig.codec!=="opus")throw new TypeError('Audio chunk metadata decoder configuration codec string for Opus must be "opus".');if(t.decoderConfig.description&&t.decoderConfig.description.byteLength<18)throw new TypeError("Audio chunk metadata decoder configuration description, when specified, is expected to be an Identification Header as specified in Section 5.1 of RFC 7845.")}else if(t.decoderConfig.codec.startsWith("vorbis")){if(t.decoderConfig.codec!=="vorbis")throw new TypeError('Audio chunk metadata decoder configuration codec string for Vorbis must be "vorbis".');if(!t.decoderConfig.description)throw new TypeError("Audio chunk metadata decoder configuration for Vorbis must include a description, which is expected to adhere to the format described in https://www.w3.org/TR/webcodecs-vorbis-codec-registration/.")}else if(t.decoderConfig.codec.startsWith("flac")){if(t.decoderConfig.codec!=="flac")throw new TypeError('Audio chunk metadata decoder configuration codec string for FLAC must be "flac".');if(!t.decoderConfig.description||t.decoderConfig.description.byteLength<42)throw new TypeError("Audio chunk metadata decoder configuration for FLAC must include a description, which is expected to adhere to the format described in https://www.w3.org/TR/webcodecs-flac-codec-registration/.")}else if(t.decoderConfig.codec.startsWith("ac-3")||t.decoderConfig.codec.startsWith("ac3")){if(t.decoderConfig.codec!=="ac-3")throw new TypeError('Audio chunk metadata decoder configuration codec string for AC-3 must be "ac-3".')}else if(t.decoderConfig.codec.startsWith("ec-3")||t.decoderConfig.codec.startsWith("eac3")){if(t.decoderConfig.codec!=="ec-3")throw new TypeError('Audio chunk metadata decoder configuration codec string for EC-3 must be "ec-3".')}else if(t.decoderConfig.codec.startsWith("dts")){if(!oi.includes(t.decoderConfig.codec))throw new TypeError(`Audio chunk metadata decoder configuration codec string for DTS must be one of the following four-character codes: ${oi.join(", ")}.`)}else if((t.decoderConfig.codec.startsWith("pcm")||t.decoderConfig.codec.startsWith("ulaw")||t.decoderConfig.codec.startsWith("alaw"))&&!Ae.includes(t.decoderConfig.codec))throw new TypeError(`Audio chunk metadata decoder configuration codec string for PCM must be one of the supported PCM codecs (${Ae.join(", ")}).`);if(e!==null&&ai(t.decoderConfig.codec)!==e)throw new TypeError(`Audio chunk metadata decoder configuration codec string '${t.decoderConfig.codec}' does not fit to the track codec '${e}'.`)},sa=t=>{if(!t)throw new TypeError("Subtitle metadata must be provided.");if(typeof t!="object")throw new TypeError("Subtitle metadata must be an object.");if(!t.config)throw new TypeError("Subtitle metadata must include a config object.");if(typeof t.config!="object")throw new TypeError("Subtitle metadata config must be an object.");if(typeof t.config.description!="string")throw new TypeError("Subtitle metadata config description must be a string.")};var Cr=class{constructor(e){this.input=e;}dispose(){}};var Ht=new Uint8Array(0),de=class t{constructor(e,r,i,s,n=-1,o,a){if(this.data=e,this.type=r,this.timestamp=i,this.duration=s,this.sequenceNumber=n,e===Ht&&o===void 0)throw new Error("Internal error: byteLength must be explicitly provided when constructing metadata-only packets.");if(o===void 0&&(o=e.byteLength),!(e instanceof Uint8Array))throw new TypeError("data must be a Uint8Array.");if(r!=="key"&&r!=="delta")throw new TypeError('type must be either "key" or "delta".');if(!Number.isFinite(i))throw new TypeError("timestamp must be a number.");if(!Number.isFinite(s)||s<0)throw new TypeError("duration must be a non-negative number.");if(!Number.isFinite(n))throw new TypeError("sequenceNumber must be a number.");if(!Number.isInteger(o)||o<0)throw new TypeError("byteLength must be a non-negative integer.");if(a!==void 0&&(typeof a!="object"||!a))throw new TypeError("sideData, when provided, must be an object.");if(a?.alpha!==void 0&&!(a.alpha instanceof Uint8Array))throw new TypeError("sideData.alpha, when provided, must be a Uint8Array.");if(a?.alphaByteLength!==void 0&&(!Number.isInteger(a.alphaByteLength)||a.alphaByteLength<0))throw new TypeError("sideData.alphaByteLength, when provided, must be a non-negative integer.");this.byteLength=o,this.sideData=a??{},this.sideData.alpha&&this.sideData.alphaByteLength===void 0&&(this.sideData.alphaByteLength=this.sideData.alpha.byteLength);}get isMetadataOnly(){return this.data===Ht}get microsecondTimestamp(){return Math.trunc(lt*this.timestamp)}get microsecondDuration(){return Math.trunc(lt*this.duration)}toEncodedVideoChunk(){if(this.isMetadataOnly)throw new TypeError("Metadata-only packets cannot be converted to a video chunk.");if(typeof EncodedVideoChunk>"u")throw new Error("EncodedVideoChunk is not available in this environment.");return new EncodedVideoChunk({data:this.data,type:this.type,timestamp:this.microsecondTimestamp,duration:this.microsecondDuration})}alphaToEncodedVideoChunk(e=this.type){if(!this.sideData.alpha)throw new TypeError("This packet does not contain alpha side data.");if(this.isMetadataOnly)throw new TypeError("Metadata-only packets cannot be converted to a video chunk.");if(typeof EncodedVideoChunk>"u")throw new Error("EncodedVideoChunk is not available in this environment.");return new EncodedVideoChunk({data:this.sideData.alpha,type:e,timestamp:this.microsecondTimestamp,duration:this.microsecondDuration})}toEncodedAudioChunk(){if(this.isMetadataOnly)throw new TypeError("Metadata-only packets cannot be converted to an audio chunk.");if(typeof EncodedAudioChunk>"u")throw new Error("EncodedAudioChunk is not available in this environment.");return new EncodedAudioChunk({data:this.data,type:this.type,timestamp:this.microsecondTimestamp,duration:this.microsecondDuration})}static fromEncodedChunk(e,r){if(!(e instanceof EncodedVideoChunk||e instanceof EncodedAudioChunk))throw new TypeError("chunk must be an EncodedVideoChunk or EncodedAudioChunk.");let i=new Uint8Array(e.byteLength);return e.copyTo(i),new t(i,e.type,e.timestamp/1e6,(e.duration??0)/1e6,void 0,void 0,r)}clone(e){if(e!==void 0&&(typeof e!="object"||e===null))throw new TypeError("options, when provided, must be an object.");if(e?.data!==void 0&&!(e.data instanceof Uint8Array))throw new TypeError("options.data, when provided, must be a Uint8Array.");if(e?.type!==void 0&&e.type!=="key"&&e.type!=="delta")throw new TypeError('options.type, when provided, must be either "key" or "delta".');if(e?.timestamp!==void 0&&!Number.isFinite(e.timestamp))throw new TypeError("options.timestamp, when provided, must be a number.");if(e?.duration!==void 0&&!Number.isFinite(e.duration))throw new TypeError("options.duration, when provided, must be a number.");if(e?.sequenceNumber!==void 0&&!Number.isFinite(e.sequenceNumber))throw new TypeError("options.sequenceNumber, when provided, must be a number.");if(e?.sideData!==void 0&&(typeof e.sideData!="object"||e.sideData===null))throw new TypeError("options.sideData, when provided, must be an object.");return new t(e?.data??this.data,e?.type??this.type,e?.timestamp??this.timestamp,e?.duration??this.duration,e?.sequenceNumber??this.sequenceNumber,this.byteLength,e?.sideData??this.sideData)}};var cn=t=>{let r=(t.hasVideo?"video/":t.hasAudio?"audio/":"application/")+(t.isQuickTime?"quicktime":"mp4");if(t.codecStrings.length>0){let i=[...new Set(t.codecStrings)];r+=`; codecs="${i.join(", ")}"`;}return r},oa=t=>{let e=ie(t),r=0,i=e.getUint8(r);r+=1,r+=3;let s=Vt(t.subarray(r,r+16));r+=16;let n=null;if(i>0){let a=e.getUint32(r);if(r+=4,a>0){n=[];for(let c=0;c<a;c++)n.push(Vt(t.subarray(r,r+16))),r+=16;}}let o=e.getUint32(r);return r+=4,{systemId:s,keyIds:n,data:t.slice(r,r+o)}},aa=(t,e)=>t.systemId===e.systemId&&Ao(t.data,e.data);var Ye=8,Et=16,vt=t=>{let e=O(t),r=Ue(t,4),i=8;e===1&&(e=Re(t),i=16);let n=e-i;return n<0?null:{name:r,totalSize:e,headerSize:i,contentSize:n}},jt=t=>It(t)/65536,ln=t=>It(t)/1073741824,un=t=>{let e=0;for(let r=0;r<4;r++){e<<=7;let i=Q(t);if(e|=i&127,(i&128)===0)break}return e},Je=t=>{let e=_e(t);return t.skip(2),e=Math.min(e,t.remainingLength),je.decode(te(t,e))},ca=t=>{let e=vt(t);if(!e||e.name!=="data"||t.remainingLength<8)return null;let r=O(t);t.skip(4);let i=te(t,e.contentSize-8);switch(r){case 1:return je.decode(i);case 2:return new TextDecoder("utf-16be").decode(i);case 13:return new Xe(i,"image/jpeg");case 14:return new Xe(i,"image/png");case 27:return new Xe(i,"image/bmp");default:return i}};var ps=16,Pt=new Uint32Array(256),Er=new Uint32Array(256),vr=new Uint32Array(256),Ir=new Uint32Array(256),Pr=new Uint32Array(256),ve=new Uint32Array(256),la=new Uint32Array(10),ua=!1,ol=()=>{let t=new Uint8Array(256),e=new Uint8Array(256),r=new Uint8Array(256);for(let n=0,o=1;n<256;n++)r[n]=o,e[o]=n,o=o^o<<1^(o&128?283:0);let i=(n,o)=>n&&o?r[(e[n]+e[o])%255]:0;t[0]=99;for(let n=1;n<256;n++){let o=r[255-e[n]],a=o^o<<1^o<<2^o<<3^o<<4;a=a>>>8^a&255^99,t[n]=a;}for(let n=0;n<256;n++){let o=t[n],a=t.indexOf(n);Pt[n]=o<<24|o<<16|o<<8|o,ve[n]=a<<24|a<<16|a<<8|a;let c=i(a,14),l=i(a,9),u=i(a,13),d=i(a,11),f=c<<24|l<<16|u<<8|d;Er[n]=f,vr[n]=f>>>8|f<<24,Ir[n]=f>>>16|f<<16,Pr[n]=f>>>24|f<<8;}let s=1;for(let n=0;n<10;n++)la[n]=s<<24,s=s<<1^(s&128?283:0);ua=!0;},dn=class{constructor(){this.roundkey=new Uint32Array(44),this.iv=new Uint32Array(ps/Uint32Array.BYTES_PER_ELEMENT),this.in=new Uint8Array(ps),this.out=new Uint8Array(ps),this.inView=new DataView(this.in.buffer),this.outView=new DataView(this.out.buffer);}init({key:e,iv:r}){g(e.byteLength===16),g(r.byteLength===16),ua||ol();let i=new DataView(e.buffer,e.byteOffset,e.byteLength),s=new DataView(r.buffer,r.byteOffset,r.byteLength);this.roundkey[0]=i.getUint32(0,!1),this.roundkey[1]=i.getUint32(4,!1),this.roundkey[2]=i.getUint32(8,!1),this.roundkey[3]=i.getUint32(12,!1),this.iv[0]=s.getUint32(0,!1),this.iv[1]=s.getUint32(4,!1),this.iv[2]=s.getUint32(8,!1),this.iv[3]=s.getUint32(12,!1);for(let n=4;n<44;n+=4){let o=this.roundkey[n-1];this.roundkey[n]=this.roundkey[n-4]^Pt[o>>>16&255]&4278190080^Pt[o>>>8&255]&16711680^Pt[o>>>0&255]&65280^Pt[o>>>24&255]&255^la[n/4-1],this.roundkey[n+1]=this.roundkey[n-3]^this.roundkey[n],this.roundkey[n+2]=this.roundkey[n-2]^this.roundkey[n+1],this.roundkey[n+3]=this.roundkey[n-1]^this.roundkey[n+2];}for(let n=0,o=40;n<o;n+=4,o-=4)for(let a=0;a<4;a++){let c=this.roundkey[n+a];this.roundkey[n+a]=this.roundkey[o+a],this.roundkey[o+a]=c;}for(let n=4;n<40;n+=4)for(let o=0;o<4;o++){let a=this.roundkey[n+o];this.roundkey[n+o]=Er[Pt[a>>>24&255]&255]^vr[Pt[a>>>16&255]&255]^Ir[Pt[a>>>8&255]&255]^Pr[Pt[a>>>0&255]&255];}}decrypt(){let e=this.inView.getUint32(0,!1)^this.roundkey[0],r=this.inView.getUint32(4,!1)^this.roundkey[1],i=this.inView.getUint32(8,!1)^this.roundkey[2],s=this.inView.getUint32(12,!1)^this.roundkey[3],n=this.inView.getUint32(0,!1),o=this.inView.getUint32(4,!1),a=this.inView.getUint32(8,!1),c=this.inView.getUint32(12,!1),l,u,d,f;for(let w=1;w<10;w++){let A=w*4;l=Er[e>>>24]^vr[s>>>16&255]^Ir[i>>>8&255]^Pr[r&255]^this.roundkey[A],u=Er[r>>>24]^vr[e>>>16&255]^Ir[s>>>8&255]^Pr[i&255]^this.roundkey[A+1],d=Er[i>>>24]^vr[r>>>16&255]^Ir[e>>>8&255]^Pr[s&255]^this.roundkey[A+2],f=Er[s>>>24]^vr[i>>>16&255]^Ir[r>>>8&255]^Pr[e&255]^this.roundkey[A+3],e=l,r=u,i=d,s=f;}let m=ve[e>>>24&255]&4278190080^ve[s>>>16&255]&16711680^ve[i>>>8&255]&65280^ve[r>>>0&255]&255^this.roundkey[40],p=ve[r>>>24&255]&4278190080^ve[e>>>16&255]&16711680^ve[s>>>8&255]&65280^ve[i>>>0&255]&255^this.roundkey[41],b=ve[i>>>24&255]&4278190080^ve[r>>>16&255]&16711680^ve[e>>>8&255]&65280^ve[s>>>0&255]&255^this.roundkey[42],y=ve[s>>>24&255]&4278190080^ve[i>>>16&255]&16711680^ve[r>>>8&255]&65280^ve[e>>>0&255]&255^this.roundkey[43];this.outView.setUint32(0,m^this.iv[0],!1),this.outView.setUint32(4,p^this.iv[1],!1),this.outView.setUint32(8,b^this.iv[2],!1),this.outView.setUint32(12,y^this.iv[3],!1),this.iv[0]=n,this.iv[1]=o,this.iv[2]=a,this.iv[3]=c;}};var fn=class t extends Cr{constructor(e){super(e),this.moovSlice=null,this.currentTrack=null,this.tracks=[],this.metadataPromise=null,this.movieTimescale=-1,this.movieDurationInTimescale=-1,this.isQuickTime=!1,this.metadataTags={},this.currentMetadataKeys=null,this.isFragmented=!1,this.fragmentTrackDefaults=[],this.psshBoxes=[],this.currentFragment=null,this.lastReadFragment=null,this.decryptionKeyCache=new Map,this.reader=e._reader;}async getTrackBackings(){return await this.readMetadata(),this.tracks.map(e=>e.trackBacking)}async getMimeType(){await this.readMetadata();let e=await this.getTrackBackings(),r=await Promise.all(e.map(i=>i.getDecoderConfig().then(s=>s?.codec??null)));return cn({isQuickTime:this.isQuickTime,hasVideo:this.tracks.some(i=>i.info?.type==="video"),hasAudio:this.tracks.some(i=>i.info?.type==="audio"),codecStrings:r.filter(Boolean)})}async getMetadataTags(){return await this.readMetadata(),this.metadataTags}readMetadata(){return this.metadataPromise??(this.metadataPromise=(async()=>{let e=0,r=!1,i=!1;for(;;){let s=this.reader.requestSliceRange(e,Ye,Et);if(U(s)&&(s=await s),!s)break;let n=e,o=vt(s);if(!o)break;if(o.name==="ftyp"||o.name==="styp"){let a=Ue(s,4);this.isQuickTime=a==="qt  ";}else if(o.name==="moov"){let a=this.reader.requestSlice(s.filePos,o.contentSize);if(U(a)&&(a=await a),!a)break;this.moovSlice=a,this.readContiguousBoxes(this.moovSlice);for(let c of this.tracks){let l=c.editListPreviousSegmentDurations/this.movieTimescale;c.editListOffset-=Math.round(l*c.timescale);}r=this.isFragmented&&this.reader.fileSize!==null&&this.reader.fileSize>n+o.totalSize,i=!0;break}else if(o.name==="moof"){if(!this.input._initInput)throw new Error('"moof" box encountered with no "moov" box present; this file is likely a Segment as described in ISO/IEC 14496-12 Section 8.16. A separate init file that contains a "moov" box is required to read this file, please provide it using InputOptions.initInput.');await this.copyMetadataFromInitInput(this.input._initInput),r=!1,i=!0;break}e=n+o.totalSize;}if(!i&&this.input._initInput&&await this.copyMetadataFromInitInput(this.input._initInput),r){g(this.reader.fileSize!==null);let s=this.reader.requestSlice(this.reader.fileSize-4,4);U(s)&&(s=await s),g(s);let n=O(s),o=this.reader.fileSize-n;if(o>=0&&o<=this.reader.fileSize-Et){let a=this.reader.requestSliceRange(o,Ye,Et);if(U(a)&&(a=await a),a){let c=vt(a);if(c&&c.name==="mfra"){let l=this.reader.requestSlice(a.filePos,c.contentSize);U(l)&&(l=await l),l&&this.readContiguousBoxes(l);}}}}})())}async copyMetadataFromInitInput(e){let r=await e._getDemuxer();if(r.constructor!==t)throw new Error("Init input must match the input's format.");await r.readMetadata(),this.movieTimescale=r.movieTimescale,this.movieDurationInTimescale=r.movieDurationInTimescale,this.metadataTags=r.metadataTags,this.isFragmented=!0,this.fragmentTrackDefaults=r.fragmentTrackDefaults,this.psshBoxes=r.psshBoxes;for(let i of r.tracks){let s={id:i.id,demuxer:this,trackBacking:null,disposition:i.disposition,timescale:i.timescale,durationInMediaTimescale:i.durationInMediaTimescale,durationInMovieTimescale:i.durationInMovieTimescale,rotation:i.rotation,internalCodecId:i.internalCodecId,name:i.name,languageCode:i.languageCode,sampleTableByteOffset:null,sampleTable:null,fragmentLookupTable:[],currentFragmentState:null,fragmentPositionCache:[],editListPreviousSegmentDurations:i.editListPreviousSegmentDurations,editListOffset:i.editListOffset,encryptionInfo:i.encryptionInfo,encryptionAuxInfo:null,frmaCodecString:null,info:i.info};if(i.trackBacking){if(g(s.info),s.info.type==="video"&&s.info.width!==-1){let n=s;s.trackBacking=new mn(n),this.tracks.push(s);}else if(s.info.type==="audio"&&s.info.numberOfChannels!==-1){let n=s;s.trackBacking=new pn(n),this.tracks.push(s);}}}}getSampleTableForTrack(e){if(e.sampleTable)return e.sampleTable;let r={sampleTimingEntries:[],sampleCompositionTimeOffsets:[],sampleSizes:[],keySampleIndices:null,chunkOffsets:[],sampleToChunk:[],presentationTimestamps:null,presentationTimestampIndexMap:null};if(e.sampleTable=r,e.sampleTableByteOffset===null)return r;g(this.moovSlice);let i=this.moovSlice.slice(e.sampleTableByteOffset);if(this.currentTrack=e,this.traverseBox(i),this.currentTrack=null,e.info?.type==="audio"&&e.info.codec&&Ae.includes(e.info.codec)&&r.sampleCompositionTimeOffsets.length===0){g(e.info?.type==="audio");let n=Ve(e.info.codec),o=[],a=[];for(let c=0;c<r.sampleToChunk.length;c++){let l=r.sampleToChunk[c],u=r.sampleToChunk[c+1],d=(u?u.startChunkIndex:r.chunkOffsets.length)-l.startChunkIndex;for(let f=0;f<d;f++){let m=l.startSampleIndex+f*l.samplesPerChunk,p=m+l.samplesPerChunk,b=ce(r.sampleTimingEntries,m,k=>k.startIndex),y=r.sampleTimingEntries[b],w=ce(r.sampleTimingEntries,p,k=>k.startIndex),A=r.sampleTimingEntries[w],T=y.startDecodeTimestamp+(m-y.startIndex)*y.delta,v=A.startDecodeTimestamp+(p-A.startIndex)*A.delta-T,F=fe(o);F&&F.delta===v?F.count++:o.push({startIndex:l.startChunkIndex+f,startDecodeTimestamp:T,count:1,delta:v});let E=l.samplesPerChunk*n.sampleSize*e.info.numberOfChannels;a.push(E);}l.startSampleIndex=l.startChunkIndex,l.samplesPerChunk=1;}r.sampleTimingEntries=o,r.sampleSizes=a;}if(r.sampleCompositionTimeOffsets.length>0){r.presentationTimestamps=[];for(let n of r.sampleTimingEntries)for(let o=0;o<n.count;o++)r.presentationTimestamps.push({presentationTimestamp:n.startDecodeTimestamp+o*n.delta,sampleIndex:n.startIndex+o});for(let n of r.sampleCompositionTimeOffsets)for(let o=0;o<n.count;o++){let a=n.startIndex+o,c=r.presentationTimestamps[a];c&&(c.presentationTimestamp+=n.offset);}r.presentationTimestamps.sort((n,o)=>n.presentationTimestamp-o.presentationTimestamp),r.presentationTimestampIndexMap=Array(r.presentationTimestamps.length).fill(-1);for(let n=0;n<r.presentationTimestamps.length;n++)r.presentationTimestampIndexMap[r.presentationTimestamps[n].sampleIndex]=n;}return r}async readFragment(e){if(this.lastReadFragment?.moofOffset===e)return this.lastReadFragment;let r=this.reader.requestSliceRange(e,Ye,Et);U(r)&&(r=await r),g(r);let i=vt(r);g(i?.name==="moof");let s=this.reader.requestSlice(e,i.totalSize);U(s)&&(s=await s),g(s),this.traverseBox(s);let n=this.lastReadFragment;g(n&&n.moofOffset===e);for(let[,o]of n.trackData){let a=o.track,{fragmentPositionCache:c}=a;if(!o.startTimestampIsFinal){let u=a.fragmentLookupTable.find(d=>d.moofOffset===n.moofOffset);if(u)gs(o,u.timestamp);else {let d=ce(c,n.moofOffset-1,f=>f.moofOffset);if(d!==-1){let f=c[d];gs(o,f.endTimestamp);}}o.startTimestampIsFinal=!0;}let l=ce(c,o.startTimestamp,u=>u.startTimestamp);if((l===-1||c[l].moofOffset!==n.moofOffset)&&c.splice(l+1,0,{moofOffset:n.moofOffset,startTimestamp:o.startTimestamp,endTimestamp:o.endTimestamp}),o.encryptionAuxInfo&&a.encryptionInfo){let u=await pa(this.reader,a.encryptionInfo,o.encryptionAuxInfo);for(let d=0;d<Math.min(o.samples.length,u.length);d++){let f=u[d];o.samples[d].encryption=f;}}}return n}readContiguousBoxes(e){let r=e.filePos;for(;e.filePos-r<=e.length-Ye&&this.traverseBox(e););}*iterateContiguousBoxes(e){let r=e.filePos;for(;e.filePos-r<=e.length-Ye;){let i=e.filePos,s=vt(e);if(!s)break;yield {boxInfo:s,slice:e},e.filePos=i+s.totalSize;}}traverseBox(e){var o,a,c,l,u,d,f,m,p,b,y,w,A,T,I,v,F,E,k,_,B,z,N,Z,oe,Y,G,ne,ge,Ie,Be,Ee,hr;let r=e.filePos,i=vt(e);if(!i)return !1;let s=e.filePos,n=r+i.totalSize;switch(i.name){case "mdia":case "minf":case "dinf":case "mfra":case "edts":case "sinf":case "schi":this.readContiguousBoxes(e.slice(s,i.contentSize));break;case "mvhd":{let h=Q(e);e.skip(3),h===1?(e.skip(16),this.movieTimescale=O(e),this.movieDurationInTimescale=Re(e)):(e.skip(8),this.movieTimescale=O(e),this.movieDurationInTimescale=O(e));}break;case "trak":{let h={id:-1,demuxer:this,trackBacking:null,disposition:{...qi,primary:!1},info:null,timescale:-1,durationInMovieTimescale:-1,durationInMediaTimescale:-1,rotation:0,internalCodecId:null,name:null,languageCode:Ut,sampleTableByteOffset:-1,sampleTable:null,fragmentLookupTable:[],currentFragmentState:null,fragmentPositionCache:[],editListPreviousSegmentDurations:0,editListOffset:0,encryptionInfo:null,encryptionAuxInfo:null,frmaCodecString:null};if(this.currentTrack=h,this.readContiguousBoxes(e.slice(s,i.contentSize)),h.id!==-1&&h.timescale!==-1&&h.info!==null){if(h.info.type==="video"&&h.info.width!==-1){let C=h;h.trackBacking=new mn(C),this.tracks.push(h);}else if(h.info.type==="audio"&&h.info.numberOfChannels!==-1){let C=h;h.trackBacking=new pn(C),this.tracks.push(h);}}this.currentTrack=null;}break;case "tkhd":{let h=this.currentTrack;if(!h)break;let C=Q(e),P=!!(Rt(e)&1);if(h.disposition.default=P,C===0)e.skip(8),h.id=O(e),e.skip(4),h.durationInMovieTimescale=O(e);else if(C===1)e.skip(16),h.id=O(e),e.skip(4),h.durationInMovieTimescale=Re(e);else throw new Error(`Incorrect track header version ${C}.`);e.skip(16);let V=[jt(e),jt(e),ln(e),jt(e),jt(e),ln(e),jt(e),jt(e),ln(e)],R=yt(Gr(ul(V),90));g(R===0||R===90||R===180||R===270),h.rotation=R;}break;case "elst":{let h=this.currentTrack;if(!h)break;let C=Q(e);e.skip(3);let S=!1,P=0,V=O(e);for(let R=0;R<V;R++){let W=C===1?Re(e):O(e),j=C===1?wa(e):It(e),$=jt(e);if(W!==0){if(S){K._warn("Unsupported edit list: multiple edits are not currently supported. Only using first edit.");break}if(j===-1){P+=W;continue}if($!==1){K._warn("Unsupported edit list entry: media rate must be 1.");break}h.editListPreviousSegmentDurations=P,h.editListOffset=j,S=!0;}}}break;case "mdhd":{let h=this.currentTrack;if(!h)break;let C=Q(e);e.skip(3),C===0?(e.skip(8),h.timescale=O(e),h.durationInMediaTimescale=O(e)):C===1&&(e.skip(16),h.timescale=O(e),h.durationInMediaTimescale=Re(e));let S=_e(e);if(S>0){h.languageCode="";for(let P=0;P<3;P++)h.languageCode=String.fromCharCode(96+(S&31))+h.languageCode,S>>=5;St(h.languageCode)||(h.languageCode=Ut);}}break;case "hdlr":{let h=this.currentTrack;if(!h)break;e.skip(8);let C=Ue(e,4);C==="vide"?h.info={type:"video",width:-1,height:-1,squarePixelWidth:-1,squarePixelHeight:-1,codec:null,codecDescription:null,colorSpace:{...Bi},avcType:null,avcCodecInfo:null,hevcCodecInfo:null,vp9CodecInfo:null,av1CodecInfo:null,proresCodecInfo:null,proresFormat:null}:C==="soun"&&(h.info={type:"audio",numberOfChannels:-1,sampleRate:-1,codec:null,codecDescription:null,aacCodecInfo:null,dtsFormat:null,pcmLittleEndian:!1,pcmSampleSize:null});}break;case "stbl":{let h=this.currentTrack;if(!h)break;h.sampleTableByteOffset=r,this.readContiguousBoxes(e.slice(s,i.contentSize));}break;case "stsd":{let h=this.currentTrack;if(!h||h.info===null||h.sampleTable)break;let C=Q(e);e.skip(3);let S=O(e);for(let P=0;P<S;P++){let V=e.filePos,R=vt(e);if(!R)break;h.internalCodecId=R.name;let W=R.name.toLowerCase();if(h.info.type==="video"){e.skip(24),h.info.width=_e(e),h.info.height=_e(e),h.info.squarePixelWidth=h.info.width,h.info.squarePixelHeight=h.info.height,e.skip(50),h.frmaCodecString=null,this.readContiguousBoxes(e.slice(e.filePos,V+R.totalSize-e.filePos));let j=W==="encv"?h.frmaCodecString:W;h.frmaCodecString=null,j==="avc1"||j==="avc3"?(h.info.codec="avc",h.info.avcType=j==="avc1"?1:3):j==="hvc1"||j==="hev1"?h.info.codec="hevc":j==="vp08"?h.info.codec="vp8":j==="vp09"?h.info.codec="vp9":j==="av01"?h.info.codec="av1":Ct.includes(W)?(h.info.codec="prores",h.info.proresFormat=W):j===null?K._warn("Unknown encrypted video codec due to missing frma box."):K._warn(`Unsupported video codec (sample entry type '${R.name}').`);}else {e.skip(8);let j=_e(e);e.skip(6);let $=_e(e),X=_e(e);e.skip(4);let ye=O(e)/65536,me=null;C===0&&j>0&&(j===1?(e.skip(4),X=8*O(e),e.skip(8)):j===2&&(e.skip(4),ye=gn(e),$=O(e),e.skip(4),X=O(e),me=O(e),e.skip(8))),h.info.numberOfChannels=$,h.info.sampleRate=ye,h.frmaCodecString=null,this.readContiguousBoxes(e.slice(e.filePos,V+R.totalSize-e.filePos));let L=W==="enca"?h.frmaCodecString:W;if(h.frmaCodecString=null,L!=="mp4a")if(L==="opus")h.info.codec="opus",h.info.sampleRate=sn;else if(L==="flac")h.info.codec="flac";else if(L==="ulaw")h.info.codec="ulaw";else if(L==="alaw")h.info.codec="alaw";else if(L==="ac-3")h.info.codec="ac3";else if(L==="ec-3")h.info.codec="eac3";else if(oi.includes(L))h.info.codec="dts",h.info.dtsFormat=L;else if(L==="twos")X===8?h.info.codec="pcm-s8":X===16?h.info.codec=h.info.pcmLittleEndian?"pcm-s16":"pcm-s16be":(K._warn(`Unsupported sample size ${X} for codec 'twos'.`),h.info.codec=null);else if(L==="sowt")X===8?h.info.codec="pcm-s8":X===16?h.info.codec="pcm-s16":(K._warn(`Unsupported sample size ${X} for codec 'sowt'.`),h.info.codec=null);else if(L==="raw ")h.info.codec="pcm-u8";else if(L==="in24")h.info.codec=h.info.pcmLittleEndian?"pcm-s24":"pcm-s24be";else if(L==="in32")h.info.codec=h.info.pcmLittleEndian?"pcm-s32":"pcm-s32be";else if(L==="fl32")h.info.codec=h.info.pcmLittleEndian?"pcm-f32":"pcm-f32be";else if(L==="fl64")h.info.codec=h.info.pcmLittleEndian?"pcm-f64":"pcm-f64be";else if(L==="ipcm"){let re=h.info.pcmSampleSize;h.info.pcmLittleEndian?re===16?h.info.codec="pcm-s16":re===24?h.info.codec="pcm-s24":re===32?h.info.codec="pcm-s32":(K._warn(`Invalid ipcm sample size ${re}.`),h.info.codec=null):re===16?h.info.codec="pcm-s16be":re===24?h.info.codec="pcm-s24be":re===32?h.info.codec="pcm-s32be":(K._warn(`Invalid ipcm sample size ${re}.`),h.info.codec=null);}else if(L==="fpcm"){let re=h.info.pcmSampleSize;h.info.pcmLittleEndian?re===32?h.info.codec="pcm-f32":re===64?h.info.codec="pcm-f64":(K._warn(`Invalid fpcm sample size ${re}.`),h.info.codec=null):re===32?h.info.codec="pcm-f32be":re===64?h.info.codec="pcm-f64be":(K._warn(`Invalid fpcm sample size ${re}.`),h.info.codec=null);}else if(L==="lpcm"&&me!==null){let re=X+7>>3,Me=!!(me&1),wt=!!(me&2),mr=me&4?-1:0;X>0&&X<=64&&(Me?X===32&&(h.info.codec=wt?"pcm-f32be":"pcm-f32"):mr&1<<re-1?re===1?h.info.codec="pcm-s8":re===2?h.info.codec=wt?"pcm-s16be":"pcm-s16":re===3?h.info.codec=wt?"pcm-s24be":"pcm-s24":re===4&&(h.info.codec=wt?"pcm-s32be":"pcm-s32"):re===1&&(h.info.codec="pcm-u8")),h.info.codec===null&&K._warn("Unsupported PCM format.");}else L===null?K._warn("Unknown encrypted audio codec due to missing frma box."):K._warn(`Unsupported audio codec (sample entry type '${R.name}').`);}e.filePos=V+R.totalSize;}}break;case "frma":{let h=this.currentTrack;if(!h)break;let S=Ue(e,4).toLowerCase();h.frmaCodecString=S;}break;case "schm":{let h=this.currentTrack;if(!h)break;e.skip(4);let C=Ue(e,4);C==="cenc"||C==="cens"||C==="cbcs"?h.encryptionInfo={scheme:C,defaultKid:null,defaultIsProtected:null,defaultPerSampleIvSize:null,defaultConstantIv:null,defaultCryptByteBlock:null,defaultSkipByteBlock:null}:K._warn(`Unsupported encryption scheme '${C}'.`);}break;case "tenc":{let h=this.currentTrack;if(!h||!h.encryptionInfo)break;let C=Q(e);e.skip(3),e.skip(1);let S=Q(e);if(C>0?(h.encryptionInfo.defaultCryptByteBlock=S>>4,h.encryptionInfo.defaultSkipByteBlock=S&15):(h.encryptionInfo.defaultCryptByteBlock=0,h.encryptionInfo.defaultSkipByteBlock=0),h.encryptionInfo.defaultIsProtected=Q(e)!==0,h.encryptionInfo.defaultPerSampleIvSize=Q(e),h.encryptionInfo.defaultKid=Vt(te(e,16)),h.encryptionInfo.defaultIsProtected&&h.encryptionInfo.defaultPerSampleIvSize===0){let P=Q(e),V=new Uint8Array(16);V.set(te(e,P),0),h.encryptionInfo.defaultConstantIv=V;}}break;case "avcC":{let h=this.currentTrack;if(!h||(g(h.info),i.contentSize===0))break;h.info.codecDescription=te(e,i.contentSize);}break;case "hvcC":{let h=this.currentTrack;if(!h||(g(h.info),i.contentSize===0))break;h.info.codecDescription=te(e,i.contentSize);}break;case "vpcC":{let h=this.currentTrack;if(!h)break;g(h.info?.type==="video"),e.skip(4);let C=Q(e),S=Q(e),P=Q(e),V=P>>4,R=P>>1&7,W=P&1,j=Q(e),$=Q(e),X=Q(e);h.info.vp9CodecInfo={profile:C,level:S,bitDepth:V,chromaSubsampling:R,videoFullRangeFlag:W,colourPrimaries:j,transferCharacteristics:$,matrixCoefficients:X};}break;case "av1C":{let h=this.currentTrack;if(!h)break;g(h.info?.type==="video"),e.skip(1);let C=Q(e),S=C>>5,P=C&31,V=Q(e),R=V>>7,W=V>>6&1,j=V>>5&1,$=V>>4&1,X=V>>3&1,ye=V>>2&1,me=V&3,L=S===2&&W?j?12:10:W?10:8;e.skip(1);let re=te(e,i.contentSize-4),Me=si(re);h.info.av1CodecInfo={profile:S,level:P,tier:R,bitDepth:L,monochrome:$,chromaSubsamplingX:X,chromaSubsamplingY:ye,chromaSamplePosition:me,videoFullRangeFlag:Me?.videoFullRangeFlag??0,colourPrimaries:Me?.colourPrimaries??2,transferCharacteristics:Me?.transferCharacteristics??2,matrixCoefficients:Me?.matrixCoefficients??2};}break;case "colr":{let h=this.currentTrack;if(!h)break;g(h.info?.type==="video");let C=Ue(e,4);if(C!=="nclx"&&C!=="nclc")break;let S=_e(e),P=_e(e),V=_e(e),R;C==="nclx"&&(R=!!(Q(e)&128)),h.info.colorSpace={primaries:ot[S],transfer:at[P],matrix:ct[V],fullRange:R};}break;case "pasp":{let h=this.currentTrack;if(!h)break;g(h.info?.type==="video");let C=O(e),S=O(e);C>0&&S>0&&(C>S?h.info.squarePixelWidth=Math.round(h.info.width*C/S):h.info.squarePixelHeight=Math.round(h.info.height*S/C));}break;case "wave":this.readContiguousBoxes(e.slice(s,i.contentSize));break;case "esds":{let h=this.currentTrack;if(!h||h.info?.type!=="audio")break;e.skip(4);let C=Q(e);g(C===3),un(e),e.skip(2);let S=Q(e),P=(S&128)!==0,V=(S&64)!==0,R=(S&32)!==0;if(P&&e.skip(2),V){let ye=Q(e);e.skip(ye);}R&&e.skip(2);let W=Q(e);g(W===4);let j=un(e),$=e.filePos,X=Q(e);if(X===64||X===103?(h.info.codec="aac",h.info.aacCodecInfo={isMpeg2:X===103,objectType:null}):X===105||X===107?h.info.codec="mp3":X===221?h.info.codec="vorbis":X===169?h.info.codec="dts":K._warn(`Unsupported audio codec (objectTypeIndication ${X}) - discarding track.`),e.skip(12),j>e.filePos-$){let ye=Q(e);g(ye===5);let me=un(e);if(h.info.codecDescription=te(e,me),h.info.codec==="aac"){let L=Ar(h.info.codecDescription);L.outputNumberOfChannels!==null&&(h.info.numberOfChannels=L.outputNumberOfChannels),L.outputSampleRate!==null&&(h.info.sampleRate=L.outputSampleRate);}}}break;case "enda":{let h=this.currentTrack;if(!h)break;g(h.info?.type==="audio"),h.info.pcmLittleEndian=!!(_e(e)&255);}break;case "pcmC":{let h=this.currentTrack;if(!h)break;g(h.info?.type==="audio"),e.skip(4);let C=Q(e);h.info.pcmLittleEndian=!!(C&1),h.info.pcmSampleSize=Q(e);}break;case "dOps":{let h=this.currentTrack;if(!h)break;g(h.info?.type==="audio"),e.skip(1);let C=Q(e),S=_e(e),P=O(e),V=ci(e),R=Q(e),W;R!==0?W=te(e,2+C):W=new Uint8Array(0);let j=new Uint8Array(19+W.byteLength),$=new DataView(j.buffer);$.setUint32(0,1332770163,!1),$.setUint32(4,1214603620,!1),$.setUint8(8,1),$.setUint8(9,C),$.setUint16(10,S,!0),$.setUint32(12,P,!0),$.setInt16(16,V,!0),$.setUint8(18,R),j.set(W,19),h.info.codecDescription=j,h.info.numberOfChannels=C;}break;case "dfLa":{let h=this.currentTrack;if(!h)break;g(h.info?.type==="audio"),e.skip(4);let C=127,S=128,P=e.filePos;for(;e.filePos<n;){let $=Q(e),X=Rt(e);if(($&C)===ji.STREAMINFO){e.skip(10);let me=O(e),L=me>>>12,re=(me>>9&7)+1;h.info.sampleRate=L,h.info.numberOfChannels=re,e.skip(20);}else e.skip(X);if($&S)break}let V=e.filePos;e.filePos=P;let R=te(e,V-P),W=new Uint8Array(4+R.byteLength);new DataView(W.buffer).setUint32(0,1716281667,!1),W.set(R,4),h.info.codecDescription=W;}break;case "dac3":{let h=this.currentTrack;if(!h)break;g(h.info?.type==="audio");let C=te(e,3),S=new ae(C),P=S.readBits(2);S.skipBits(8);let V=S.readBits(3),R=S.readBits(1);P<3&&(h.info.sampleRate=ti[P]),h.info.numberOfChannels=hs[V]+R;}break;case "dec3":{let h=this.currentTrack;if(!h)break;g(h.info?.type==="audio");let C=te(e,i.contentSize),S=Lo(C);if(!S){K._warn("Invalid dec3 box contents, ignoring.");break}let P=Ho(S);P!==null&&(h.info.sampleRate=P),h.info.numberOfChannels=jo(S);}break;case "ddts":{let h=this.currentTrack;if(!h)break;g(h.info?.type==="audio");let C=te(e,Math.min(i.contentSize,Ji)),S=Ko(C);if(!S){K._warn("Invalid ddts box contents, ignoring.");break}h.info.sampleRate=S.sampleRate,S.numberOfChannels!==null&&(h.info.numberOfChannels=S.numberOfChannels);}break;case "stts":{let h=this.currentTrack;if(!h||!h.sampleTable)break;e.skip(4);let C=O(e),S=0,P=0;for(let V=0;V<C;V++){let R=O(e),W=O(e);h.sampleTable.sampleTimingEntries.push({startIndex:S,startDecodeTimestamp:P,count:R,delta:W}),S+=R,P+=R*W;}}break;case "ctts":{let h=this.currentTrack;if(!h||!h.sampleTable)break;e.skip(4);let C=O(e),S=0;for(let P=0;P<C;P++){let V=O(e),R=It(e);h.sampleTable.sampleCompositionTimeOffsets.push({startIndex:S,count:V,offset:R}),S+=V;}}break;case "stsz":{let h=this.currentTrack;if(!h||!h.sampleTable)break;e.skip(4);let C=O(e),S=O(e);if(C===0)for(let P=0;P<S;P++){let V=O(e);h.sampleTable.sampleSizes.push(V);}else h.sampleTable.sampleSizes.push(C);}break;case "stz2":{let h=this.currentTrack;if(!h||!h.sampleTable)break;e.skip(4),e.skip(3);let C=Q(e),S=O(e),P=te(e,Math.ceil(S*C/8)),V=new ae(P);for(let R=0;R<S;R++){let W=V.readBits(C);h.sampleTable.sampleSizes.push(W);}}break;case "stss":{let h=this.currentTrack;if(!h||!h.sampleTable)break;e.skip(4),h.sampleTable.keySampleIndices=[];let C=O(e);for(let S=0;S<C;S++){let P=O(e)-1;h.sampleTable.keySampleIndices.push(P);}h.sampleTable.keySampleIndices[0]!==0&&h.sampleTable.keySampleIndices.unshift(0);}break;case "stsc":{let h=this.currentTrack;if(!h||!h.sampleTable)break;e.skip(4);let C=O(e);for(let P=0;P<C;P++){let V=O(e)-1,R=O(e),W=O(e);h.sampleTable.sampleToChunk.push({startSampleIndex:-1,startChunkIndex:V,samplesPerChunk:R,sampleDescriptionIndex:W});}let S=0;for(let P=0;P<h.sampleTable.sampleToChunk.length;P++)if(h.sampleTable.sampleToChunk[P].startSampleIndex=S,P<h.sampleTable.sampleToChunk.length-1){let R=h.sampleTable.sampleToChunk[P+1].startChunkIndex-h.sampleTable.sampleToChunk[P].startChunkIndex;S+=R*h.sampleTable.sampleToChunk[P].samplesPerChunk;}}break;case "stco":{let h=this.currentTrack;if(!h||!h.sampleTable)break;e.skip(4);let C=O(e);for(let S=0;S<C;S++){let P=O(e);h.sampleTable.chunkOffsets.push(P);}}break;case "co64":{let h=this.currentTrack;if(!h||!h.sampleTable)break;e.skip(4);let C=O(e);for(let S=0;S<C;S++){let P=Re(e);h.sampleTable.chunkOffsets.push(P);}}break;case "mvex":this.isFragmented=!0,this.readContiguousBoxes(e.slice(s,i.contentSize));break;case "mehd":{let h=Q(e);e.skip(3);let C=h===1?Re(e):O(e);this.movieDurationInTimescale=C;}break;case "trex":{e.skip(4);let h=O(e),C=O(e),S=O(e),P=O(e),V=O(e);this.fragmentTrackDefaults.push({trackId:h,defaultSampleDescriptionIndex:C,defaultSampleDuration:S,defaultSampleSize:P,defaultSampleFlags:V});}break;case "tfra":{let h=Q(e);e.skip(3);let C=O(e),S=this.tracks.find(L=>L.id===C);if(!S)break;let P=O(e),V=(P&48)>>4,R=(P&12)>>2,W=P&3,j=[Q,_e,Rt,O],$=j[V],X=j[R],ye=j[W],me=O(e);for(let L=0;L<me;L++){let re=h===1?Re(e):O(e),Me=h===1?Re(e):O(e);$(e),X(e),ye(e),S.fragmentLookupTable.push({timestamp:re,moofOffset:Me});}S.fragmentLookupTable.sort((L,re)=>L.timestamp-re.timestamp);for(let L=0;L<S.fragmentLookupTable.length-1;L++){let re=S.fragmentLookupTable[L],Me=S.fragmentLookupTable[L+1];re.timestamp===Me.timestamp&&(S.fragmentLookupTable.splice(L+1,1),L--);}}break;case "moof":this.currentFragment={moofOffset:r,moofSize:i.totalSize,implicitBaseDataOffset:r,trackData:new Map,psshBoxes:[]},this.readContiguousBoxes(e.slice(s,i.contentSize)),this.lastReadFragment=this.currentFragment,this.currentFragment=null;break;case "traf":if(g(this.currentFragment),this.readContiguousBoxes(e.slice(s,i.contentSize)),this.currentTrack){let h=this.currentFragment.trackData.get(this.currentTrack.id);e:if(h){if(h.samples.length===0){this.currentFragment.trackData.delete(this.currentTrack.id);break e}h.presentationTimestamps=h.samples.map((V,R)=>({presentationTimestamp:V.presentationTimestamp,sampleIndex:R})).sort((V,R)=>V.presentationTimestamp-R.presentationTimestamp);for(let V=0;V<h.presentationTimestamps.length;V++){let R=h.presentationTimestamps[V],W=h.samples[R.sampleIndex];if(h.firstKeyFrameTimestamp===null&&W.isKeyFrame&&(h.firstKeyFrameTimestamp=W.presentationTimestamp),V<h.presentationTimestamps.length-1){let $=h.presentationTimestamps[V+1].presentationTimestamp-R.presentationTimestamp;W.duration=$;}}let C=h.samples[h.presentationTimestamps[0].sampleIndex],S=h.samples[fe(h.presentationTimestamps).sampleIndex];h.startTimestamp=C.presentationTimestamp,h.endTimestamp=S.presentationTimestamp+S.duration;let{currentFragmentState:P}=this.currentTrack;g(P),P.startTimestamp!==null&&(gs(h,P.startTimestamp),h.startTimestampIsFinal=!0),P.encryptionAuxInfo&&!h.samples[0].encryption&&(h.encryptionAuxInfo=P.encryptionAuxInfo);}this.currentTrack.currentFragmentState=null,this.currentTrack=null;}break;case "pssh":{if(this.input._formatOptions.isobmff?._suppressPsshParsing)break;let h=oa(te(e,i.contentSize));this.currentFragment?this.currentFragment.psshBoxes.push(h):this.currentTrack||this.psshBoxes.push(h);}break;case "tfhd":{g(this.currentFragment),e.skip(1);let h=Rt(e),C=!!(h&1),S=!!(h&2),P=!!(h&8),V=!!(h&16),R=!!(h&32),W=!!(h&65536),j=!!(h&131072),$=O(e),X=this.tracks.find(me=>me.id===$);if(!X)break;let ye=this.fragmentTrackDefaults.find(me=>me.trackId===$);this.currentTrack=X,X.currentFragmentState={baseDataOffset:this.currentFragment.implicitBaseDataOffset,sampleDescriptionIndex:ye?.defaultSampleDescriptionIndex??null,defaultSampleDuration:ye?.defaultSampleDuration??null,defaultSampleSize:ye?.defaultSampleSize??null,defaultSampleFlags:ye?.defaultSampleFlags??null,startTimestamp:null,encryptionAuxInfo:null},C?X.currentFragmentState.baseDataOffset=Re(e):j&&(X.currentFragmentState.baseDataOffset=this.currentFragment.moofOffset),S&&(X.currentFragmentState.sampleDescriptionIndex=O(e)),P&&(X.currentFragmentState.defaultSampleDuration=O(e)),V&&(X.currentFragmentState.defaultSampleSize=O(e)),R&&(X.currentFragmentState.defaultSampleFlags=O(e)),W&&(X.currentFragmentState.defaultSampleDuration=0);}break;case "tfdt":{let h=this.currentTrack;if(!h)break;g(h.currentFragmentState);let C=Q(e);e.skip(3);let S=C===0?O(e):Re(e);h.currentFragmentState.startTimestamp=S;}break;case "trun":{let h=this.currentTrack;if(!h)break;g(this.currentFragment),g(h.currentFragmentState);let C=Q(e),S=Rt(e),P=!!(S&1),V=!!(S&4),R=!!(S&256),W=!!(S&512),j=!!(S&1024),$=!!(S&2048),X=O(e),ye=null;P&&(ye=It(e));let me=null;V&&(me=O(e));let L;this.currentFragment.trackData.has(h.id)?(L=this.currentFragment.trackData.get(h.id),ye!==null&&(L.currentOffset=h.currentFragmentState.baseDataOffset+ye)):(L={track:h,currentTimestamp:0,currentOffset:h.currentFragmentState.baseDataOffset+(ye??0),startTimestamp:0,endTimestamp:0,firstKeyFrameTimestamp:null,samples:[],presentationTimestamps:[],startTimestampIsFinal:!1,encryptionAuxInfo:null},this.currentFragment.trackData.set(h.id,L));for(let re=0;re<X;re++){let Me;R?Me=O(e):(g(h.currentFragmentState.defaultSampleDuration!==null),Me=h.currentFragmentState.defaultSampleDuration);let wt;W?wt=O(e):(g(h.currentFragmentState.defaultSampleSize!==null),wt=h.currentFragmentState.defaultSampleSize);let mr;j?mr=O(e):(g(h.currentFragmentState.defaultSampleFlags!==null),mr=h.currentFragmentState.defaultSampleFlags),re===0&&me!==null&&(mr=me);let $n=0;$&&(C===0?$n=O(e):$n=It(e));let bc=!(mr&65536);L.samples.push({presentationTimestamp:L.currentTimestamp+$n,duration:Me,byteOffset:L.currentOffset,byteSize:wt,isKeyFrame:bc,encryption:null}),L.currentOffset+=wt,L.currentTimestamp+=Me;}this.currentFragment.implicitBaseDataOffset=L.currentOffset;}break;case "saiz":{let h=this.currentTrack;if(!h||!h.encryptionInfo)break;if(e.skip(1),Rt(e)&1){let W=Ue(e,4),j=O(e);if(W!==h.encryptionInfo.scheme||j!==0)break}let S=Q(e),P=O(e),V=null;S===0&&P>0&&(V=te(e,P));let R=fa(h);R.defaultSampleInfoSize=S,R.sampleSizes=V,R.sampleCount=P;}break;case "saio":{let h=this.currentTrack;if(!h||!h.encryptionInfo)break;let C=Q(e);if(Rt(e)&1){let W=Ue(e,4),j=O(e);if(W!==h.encryptionInfo.scheme||j!==0)break}let P=O(e);if(P===0)break;P>1&&K._warn("Multiple saio entries are not supported; using the first offset only.");let V=C===0?O(e):Number(Re(e));this.currentFragment&&(V+=this.currentFragment.moofOffset);let R=fa(h);R.offset=V;}break;case "senc":{let h=this.currentTrack;if(!h||!h.encryptionInfo)break;g(this.currentFragment);let C=this.currentFragment.trackData.get(h.id);if(!C)break;e.skip(1);let P=!!(Rt(e)&2),V=O(e),R=h.encryptionInfo.defaultPerSampleIvSize;g(R!==null);for(let W=0;W<Math.min(V,C.samples.length);W++){let j=new Uint8Array(16);R>0?j.set(te(e,R),0):j.set(h.encryptionInfo.defaultConstantIv,0);let $=null;if(P){let ye=_e(e);$=[];for(let me=0;me<ye;me++){let L=_e(e),re=O(e);$.push({clearLen:L,protectedLen:re});}}let X=C.samples[W];X.encryption={iv:j,subsamples:$};}}break;case "udta":{let h=this.iterateContiguousBoxes(e.slice(s,i.contentSize));for(let{boxInfo:C,slice:S}of h){if(C.name!=="meta"&&!this.currentTrack){let P=S.filePos;(o=this.metadataTags).raw??(o.raw={}),C.name[0]==="\xA9"?(a=this.metadataTags.raw)[c=C.name]??(a[c]=Je(S)):(l=this.metadataTags.raw)[u=C.name]??(l[u]=te(S,C.contentSize)),S.filePos=P;}switch(C.name){case "meta":S.skip(-C.headerSize),this.traverseBox(S);break;case "\xA9nam":case "name":this.currentTrack?this.currentTrack.name=je.decode(te(S,C.contentSize)):(d=this.metadataTags).title??(d.title=Je(S));break;case "\xA9des":this.currentTrack||((f=this.metadataTags).description??(f.description=Je(S)));break;case "\xA9ART":this.currentTrack||((m=this.metadataTags).artist??(m.artist=Je(S)));break;case "\xA9alb":this.currentTrack||((p=this.metadataTags).album??(p.album=Je(S)));break;case "albr":this.currentTrack||((b=this.metadataTags).albumArtist??(b.albumArtist=Je(S)));break;case "\xA9gen":this.currentTrack||((y=this.metadataTags).genre??(y.genre=Je(S)));break;case "\xA9day":if(!this.currentTrack){let P=new Date(Je(S));Number.isNaN(P.getTime())||((w=this.metadataTags).date??(w.date=P));}break;case "\xA9cmt":this.currentTrack||((A=this.metadataTags).comment??(A.comment=Je(S)));break;case "\xA9lyr":this.currentTrack||((T=this.metadataTags).lyrics??(T.lyrics=Je(S)));break}}}break;case "meta":{if(this.currentTrack)break;let C=O(e)!==0;this.currentMetadataKeys=new Map,C?this.readContiguousBoxes(e.slice(s,i.contentSize)):this.readContiguousBoxes(e.slice(s+4,i.contentSize-4)),this.currentMetadataKeys=null;}break;case "keys":{if(!this.currentMetadataKeys)break;e.skip(4);let h=O(e);for(let C=0;C<h;C++){let S=O(e);e.skip(4);let P=je.decode(te(e,S-8));this.currentMetadataKeys.set(C+1,P);}}break;case "ilst":{if(!this.currentMetadataKeys)break;let h=this.iterateContiguousBoxes(e.slice(s,i.contentSize));for(let{boxInfo:C,slice:S}of h){let P=C.name,V=(P.charCodeAt(0)<<24)+(P.charCodeAt(1)<<16)+(P.charCodeAt(2)<<8)+P.charCodeAt(3);this.currentMetadataKeys.has(V)&&(P=this.currentMetadataKeys.get(V));let R=ca(S);switch((I=this.metadataTags).raw??(I.raw={}),(v=this.metadataTags.raw)[P]??(v[P]=R),P){case "\xA9nam":case "titl":case "com.apple.quicktime.title":case "title":typeof R=="string"&&((F=this.metadataTags).title??(F.title=R));break;case "\xA9des":case "desc":case "dscp":case "com.apple.quicktime.description":case "description":typeof R=="string"&&((E=this.metadataTags).description??(E.description=R));break;case "\xA9ART":case "com.apple.quicktime.artist":case "artist":typeof R=="string"&&((k=this.metadataTags).artist??(k.artist=R));break;case "\xA9alb":case "albm":case "com.apple.quicktime.album":case "album":typeof R=="string"&&((_=this.metadataTags).album??(_.album=R));break;case "aART":case "album_artist":typeof R=="string"&&((B=this.metadataTags).albumArtist??(B.albumArtist=R));break;case "\xA9cmt":case "com.apple.quicktime.comment":case "comment":typeof R=="string"&&((z=this.metadataTags).comment??(z.comment=R));break;case "\xA9gen":case "gnre":case "com.apple.quicktime.genre":case "genre":typeof R=="string"&&((N=this.metadataTags).genre??(N.genre=R));break;case "\xA9lyr":case "lyrics":typeof R=="string"&&((Z=this.metadataTags).lyrics??(Z.lyrics=R));break;case "\xA9day":case "rldt":case "com.apple.quicktime.creationdate":case "date":if(typeof R=="string"){let W=new Date(R);Number.isNaN(W.getTime())||((oe=this.metadataTags).date??(oe.date=W));}break;case "covr":case "com.apple.quicktime.artwork":R instanceof Xe?((Y=this.metadataTags).images??(Y.images=[]),this.metadataTags.images.push({data:R.data,kind:"coverFront",mimeType:R.mimeType})):R instanceof Uint8Array&&((G=this.metadataTags).images??(G.images=[]),this.metadataTags.images.push({data:R,kind:"coverFront",mimeType:"image/*"}));break;case "track":if(typeof R=="string"){let W=R.split("/"),j=Number.parseInt(W[0],10),$=W[1]&&Number.parseInt(W[1],10);Number.isInteger(j)&&j>0&&((ne=this.metadataTags).trackNumber??(ne.trackNumber=j)),$&&Number.isInteger($)&&$>0&&((ge=this.metadataTags).tracksTotal??(ge.tracksTotal=$));}break;case "trkn":if(R instanceof Uint8Array&&R.length>=6){let W=ie(R),j=W.getUint16(2,!1),$=W.getUint16(4,!1);j>0&&((Ie=this.metadataTags).trackNumber??(Ie.trackNumber=j)),$>0&&((Be=this.metadataTags).tracksTotal??(Be.tracksTotal=$));}break;case "disc":case "disk":if(R instanceof Uint8Array&&R.length>=6){let W=ie(R),j=W.getUint16(2,!1),$=W.getUint16(4,!1);j>0&&((Ee=this.metadataTags).discNumber??(Ee.discNumber=j)),$>0&&((hr=this.metadataTags).discsTotal??(hr.discsTotal=$));}break}}}break}return e.filePos=n,!0}},hn=class{constructor(e){this.internalTrack=e,this.packetToSampleIndex=new WeakMap,this.packetToFragmentLocation=new WeakMap;}getId(){return this.internalTrack.id}getNumber(){let e=this.internalTrack.demuxer,r=this.internalTrack.trackBacking.getType(),i=0;for(let s of e.tracks)if(s.trackBacking.getType()===r&&i++,s===this.internalTrack)break;return i}getCodec(){throw new Error("Not implemented on base class.")}getInternalCodecId(){return this.internalTrack.internalCodecId}getName(){return this.internalTrack.name}getLanguageCode(){return this.internalTrack.languageCode}getTimeResolution(){return this.internalTrack.timescale}isRelativeToUnixEpoch(){return !1}getUnixTimeForTimestamp(){return null}getDisposition(){return this.internalTrack.disposition}getPairingMask(){return 1n}getBitrate(){return null}getAverageBitrate(){return null}async getDurationFromMetadata(){let e=this.internalTrack;return e.durationInMediaTimescale<=0?null:(g(e.trackBacking),((await e.trackBacking.getFirstPacket({metadataOnly:!0}))?.timestamp??0)+e.durationInMediaTimescale/e.timescale)}async getLiveRefreshInterval(){return null}async getFirstPacket(e){let r=await this.fetchPacketForSampleIndex(0,e);return r||!this.internalTrack.demuxer.isFragmented?r:this.performFragmentedLookup(null,i=>i.trackData.get(this.internalTrack.id)?{sampleIndex:0,correctSampleFound:!0}:{sampleIndex:-1,correctSampleFound:!1},-1/0,1/0,e)}mapTimestampIntoTimescale(e){return Di(e*this.internalTrack.timescale)+this.internalTrack.editListOffset}async getPacket(e,r){let i=this.mapTimestampIntoTimescale(e),s=this.internalTrack.demuxer.getSampleTableForTrack(this.internalTrack),n=ws(s,i),o=await this.fetchPacketForSampleIndex(n,r);return !da(s)||!this.internalTrack.demuxer.isFragmented?o:this.performFragmentedLookup(null,a=>{let c=a.trackData.get(this.internalTrack.id);if(!c)return {sampleIndex:-1,correctSampleFound:!1};let l=ce(c.presentationTimestamps,i,f=>f.presentationTimestamp),u=l!==-1?c.presentationTimestamps[l].sampleIndex:-1,d=l!==-1&&i<c.endTimestamp;return {sampleIndex:u,correctSampleFound:d}},i,i,r)}async getNextPacket(e,r){let i=this.packetToSampleIndex.get(e);if(i!==void 0)return this.fetchPacketForSampleIndex(i+1,r);let s=this.packetToFragmentLocation.get(e);if(s===void 0)throw new Error("Packet was not created from this track.");return this.performFragmentedLookup(s.fragment,n=>{if(n===s.fragment){let o=n.trackData.get(this.internalTrack.id);if(s.sampleIndex+1<o.samples.length)return {sampleIndex:s.sampleIndex+1,correctSampleFound:!0}}else if(n.trackData.get(this.internalTrack.id))return {sampleIndex:0,correctSampleFound:!0};return {sampleIndex:-1,correctSampleFound:!1}},-1/0,1/0,r)}async getKeyPacket(e,r){let i=this.mapTimestampIntoTimescale(e),s=this.internalTrack.demuxer.getSampleTableForTrack(this.internalTrack),n=al(s,i),o=await this.fetchPacketForSampleIndex(n,r);return !da(s)||!this.internalTrack.demuxer.isFragmented?o:this.performFragmentedLookup(null,a=>{let c=a.trackData.get(this.internalTrack.id);if(!c)return {sampleIndex:-1,correctSampleFound:!1};let l=Mi(c.presentationTimestamps,f=>c.samples[f.sampleIndex].isKeyFrame&&f.presentationTimestamp<=i),u=l!==-1?c.presentationTimestamps[l].sampleIndex:-1,d=l!==-1&&i<c.endTimestamp;return {sampleIndex:u,correctSampleFound:d}},i,i,r)}async getNextKeyPacket(e,r){let i=this.packetToSampleIndex.get(e);if(i!==void 0){let n=this.internalTrack.demuxer.getSampleTableForTrack(this.internalTrack),o=ll(n,i);return this.fetchPacketForSampleIndex(o,r)}let s=this.packetToFragmentLocation.get(e);if(s===void 0)throw new Error("Packet was not created from this track.");return this.performFragmentedLookup(s.fragment,n=>{if(n===s.fragment){let a=n.trackData.get(this.internalTrack.id).samples.findIndex((c,l)=>c.isKeyFrame&&l>s.sampleIndex);if(a!==-1)return {sampleIndex:a,correctSampleFound:!0}}else {let o=n.trackData.get(this.internalTrack.id);if(o&&o.firstKeyFrameTimestamp!==null){let a=o.samples.findIndex(c=>c.isKeyFrame);return g(a!==-1),{sampleIndex:a,correctSampleFound:!0}}}return {sampleIndex:-1,correctSampleFound:!1}},-1/0,1/0,r)}async fetchPacketForSampleIndex(e,r){if(e===-1)return null;let i=this.internalTrack.demuxer.getSampleTableForTrack(this.internalTrack),s=cl(i,e);if(!s)return null;let n;if(r.metadataOnly)n=Ht;else {let l=this.internalTrack.demuxer.reader.requestSlice(s.sampleOffset,s.sampleSize);if(U(l)&&(l=await l),!l)return null;if(n=te(l,s.sampleSize),this.internalTrack.encryptionInfo){let u=null;if(this.internalTrack.encryptionAuxInfo){let d=await pa(this.internalTrack.demuxer.reader,this.internalTrack.encryptionInfo,this.internalTrack.encryptionAuxInfo);e<d.length&&(u=d[e]);}u??(u=ha(this.internalTrack.encryptionInfo)),u&&(n=await ma(this.internalTrack,u,n,null));}}let o=(s.presentationTimestamp-this.internalTrack.editListOffset)/this.internalTrack.timescale,a=s.duration/this.internalTrack.timescale,c=new de(n,s.isKeyFrame?"key":"delta",o,a,e,s.sampleSize);return this.packetToSampleIndex.set(c,e),c}async fetchPacketInFragment(e,r,i){if(r===-1)return null;let n=e.trackData.get(this.internalTrack.id).samples[r];g(n);let o;if(i.metadataOnly)o=Ht;else {let u=this.internalTrack.demuxer.reader.requestSlice(n.byteOffset,n.byteSize);if(U(u)&&(u=await u),!u)return null;if(o=te(u,n.byteSize),this.internalTrack.encryptionInfo){let d=n.encryption??ha(this.internalTrack.encryptionInfo);d&&(o=await ma(this.internalTrack,d,o,e));}}let a=(n.presentationTimestamp-this.internalTrack.editListOffset)/this.internalTrack.timescale,c=n.duration/this.internalTrack.timescale,l=new de(o,n.isKeyFrame?"key":"delta",a,c,e.moofOffset+r,n.byteSize);return this.packetToFragmentLocation.set(l,{fragment:e,sampleIndex:r}),l}async performFragmentedLookup(e,r,i,s,n){let o=this.internalTrack.demuxer,a=null,c=null,l=-1;if(e){let{sampleIndex:y,correctSampleFound:w}=r(e);if(w)return this.fetchPacketInFragment(e,y,n);y!==-1&&(c=e,l=y);}let u=ce(this.internalTrack.fragmentLookupTable,i,y=>y.timestamp),d=u!==-1?this.internalTrack.fragmentLookupTable[u]:null,f=ce(this.internalTrack.fragmentPositionCache,i,y=>y.startTimestamp),m=f!==-1?this.internalTrack.fragmentPositionCache[f]:null,p=Math.max(d?.moofOffset??0,m?.moofOffset??0)||null,b;for(e?p===null||e.moofOffset>=p?(b=e.moofOffset+e.moofSize,a=e):b=p:b=p??0;;){if(a){let T=a.trackData.get(this.internalTrack.id);if(T&&T.startTimestamp>s)break}let y=o.reader.requestSliceRange(b,Ye,Et);if(U(y)&&(y=await y),!y)break;let w=b,A=vt(y);if(!A)break;if(A.name==="moof"){a=await o.readFragment(w);let{sampleIndex:T,correctSampleFound:I}=r(a);if(I)return this.fetchPacketInFragment(a,T,n);T!==-1&&(c=a,l=T);}b=w+A.totalSize;}if(d&&(!c||c.moofOffset<d.moofOffset)){let y=this.internalTrack.fragmentLookupTable[u-1];g(!y||y.timestamp<d.timestamp);let w=y?.timestamp??-1/0;return this.performFragmentedLookup(null,r,w,s,n)}return c?this.fetchPacketInFragment(c,l,n):null}},mn=class extends hn{constructor(e){super(e),this.decoderConfigPromise=null,this.internalTrack=e;}getType(){return "video"}getCodec(){return this.internalTrack.info.codec}getCodedWidth(){return this.internalTrack.info.width}getCodedHeight(){return this.internalTrack.info.height}getSquarePixelWidth(){return this.internalTrack.info.squarePixelWidth}getSquarePixelHeight(){return this.internalTrack.info.squarePixelHeight}getRotation(){return this.internalTrack.rotation}async getColorSpace(){let e=await this.getDecoderConfig();return e?{primaries:e.colorSpace?.primaries,transfer:e.colorSpace?.transfer,matrix:e.colorSpace?.matrix,fullRange:e.colorSpace?.fullRange}:this.internalTrack.info.colorSpace}async canBeTransparent(){return this.internalTrack.info.codec==="prores"&&(this.internalTrack.info.proresFormat==="ap4h"||this.internalTrack.info.proresFormat==="ap4x")}async getDecoderConfig(){return this.internalTrack.info.codec?this.decoderConfigPromise??(this.decoderConfigPromise=(async()=>{var r,i,s,n;if(this.internalTrack.info.codec==="avc"&&!this.internalTrack.info.codecDescription){let o=await this.getFirstPacket({});this.internalTrack.info.avcCodecInfo=o&&Sr(o.data);}else if(this.internalTrack.info.codec==="hevc"&&!this.internalTrack.info.codecDescription){let o=await this.getFirstPacket({});this.internalTrack.info.hevcCodecInfo=o&&xr(o.data);}else if(this.internalTrack.info.codec==="vp9"&&(!this.internalTrack.info.vp9CodecInfo||!zo(this.internalTrack.info.vp9CodecInfo))){let o=await this.getFirstPacket({}),a=o&&Zi(o.data);a&&(this.internalTrack.info.vp9CodecInfo={...this.internalTrack.info.vp9CodecInfo??a,videoFullRangeFlag:a.videoFullRangeFlag,colourPrimaries:a.colourPrimaries,transferCharacteristics:a.transferCharacteristics,matrixCoefficients:a.matrixCoefficients});}else if(this.internalTrack.info.codec==="av1"&&(!this.internalTrack.info.av1CodecInfo||!Uo(this.internalTrack.info.av1CodecInfo))){let o=await this.getFirstPacket({}),a=o&&si(o.data);a&&(this.internalTrack.info.av1CodecInfo=a);}else if(this.internalTrack.info.codec==="prores"&&!this.internalTrack.info.proresCodecInfo){let o=await this.getFirstPacket({});this.internalTrack.info.proresCodecInfo=o&&Yi(o.data);}if(!gr(this.internalTrack.info.colorSpace)){let o=rn(this.internalTrack.info);(r=this.internalTrack.info.colorSpace).primaries??(r.primaries=o.primaries),(i=this.internalTrack.info.colorSpace).transfer??(i.transfer=o.transfer),(s=this.internalTrack.info.colorSpace).matrix??(s.matrix=o.matrix),(n=this.internalTrack.info.colorSpace).fullRange??(n.fullRange=o.fullRange);}let e={codec:tn(this.internalTrack.info),codedWidth:this.internalTrack.info.width,codedHeight:this.internalTrack.info.height,description:this.internalTrack.info.codecDescription??void 0,colorSpace:this.internalTrack.info.colorSpace};return (this.internalTrack.info.width!==this.internalTrack.info.squarePixelWidth||this.internalTrack.info.height!==this.internalTrack.info.squarePixelHeight)&&(e.displayAspectWidth=this.internalTrack.info.squarePixelWidth,e.displayAspectHeight=this.internalTrack.info.squarePixelHeight),e})()):null}},pn=class extends hn{constructor(e){super(e),this.decoderConfigPromise=null,this.internalTrack=e;}getType(){return "audio"}getCodec(){return this.internalTrack.info.codec}getNumberOfChannels(){return this.internalTrack.info.numberOfChannels}getSampleRate(){return this.internalTrack.info.sampleRate}async getDecoderConfig(){return this.internalTrack.info.codec?this.decoderConfigPromise??(this.decoderConfigPromise=(async()=>{if(this.internalTrack.info.codec==="dts"&&!this.internalTrack.info.dtsFormat){let e=await this.getFirstPacket({});this.internalTrack.info.dtsFormat=e&&en(e.data);}return {codec:nn(this.internalTrack.info),numberOfChannels:this.internalTrack.info.numberOfChannels,sampleRate:this.internalTrack.info.sampleRate,description:this.internalTrack.info.codecDescription??void 0}})()):null}},ws=(t,e)=>{if(t.presentationTimestamps){let r=ce(t.presentationTimestamps,e,i=>i.presentationTimestamp);return r===-1?-1:t.presentationTimestamps[r].sampleIndex}else {let r=ce(t.sampleTimingEntries,e,s=>s.startDecodeTimestamp);if(r===-1)return -1;let i=t.sampleTimingEntries[r];return i.startIndex+Math.min(Math.floor((e-i.startDecodeTimestamp)/i.delta),i.count-1)}},al=(t,e)=>{if(!t.keySampleIndices)return ws(t,e);if(t.presentationTimestamps){let r=ce(t.presentationTimestamps,e,i=>i.presentationTimestamp);if(r===-1)return -1;for(let i=r;i>=0;i--){let s=t.presentationTimestamps[i].sampleIndex;if(rs(t.keySampleIndices,s,o=>o)!==-1)return s}return -1}else {let r=ws(t,e),i=ce(t.keySampleIndices,r,s=>s);return t.keySampleIndices[i]??-1}},cl=(t,e)=>{let r=ce(t.sampleTimingEntries,e,w=>w.startIndex),i=t.sampleTimingEntries[r];if(!i||i.startIndex+i.count<=e)return null;let n=i.startDecodeTimestamp+(e-i.startIndex)*i.delta,o=ce(t.sampleCompositionTimeOffsets,e,w=>w.startIndex),a=t.sampleCompositionTimeOffsets[o];a&&e-a.startIndex<a.count&&(n+=a.offset);let c=t.sampleSizes[Math.min(e,t.sampleSizes.length-1)],l=ce(t.sampleToChunk,e,w=>w.startSampleIndex),u=t.sampleToChunk[l];g(u);let d=u.startChunkIndex+Math.floor((e-u.startSampleIndex)/u.samplesPerChunk),f=t.chunkOffsets[d],m=u.startSampleIndex+(d-u.startChunkIndex)*u.samplesPerChunk,p=0,b=f;if(t.sampleSizes.length===1)b+=c*(e-m),p+=c*u.samplesPerChunk;else for(let w=m;w<m+u.samplesPerChunk;w++){let A=t.sampleSizes[w];w<e&&(b+=A),p+=A;}let y=i.delta;if(t.presentationTimestamps){let w=t.presentationTimestampIndexMap[e];g(w!==void 0),w<t.presentationTimestamps.length-1&&(y=t.presentationTimestamps[w+1].presentationTimestamp-n);}return {presentationTimestamp:n,duration:y,sampleOffset:b,sampleSize:c,chunkOffset:f,chunkSize:p,isKeyFrame:t.keySampleIndices?rs(t.keySampleIndices,e,w=>w)!==-1:!0}},ll=(t,e)=>{if(!t.keySampleIndices)return e+1;let r=ce(t.keySampleIndices,e,i=>i);return t.keySampleIndices[r+1]??-1},gs=(t,e)=>{t.startTimestamp+=e,t.endTimestamp+=e;for(let r of t.samples)r.presentationTimestamp+=e;for(let r of t.presentationTimestamps)r.presentationTimestamp+=e;},ul=t=>{let[e,r]=t,i=Math.atan2(r,e);return Number.isFinite(i)?i*(180/Math.PI):0},da=t=>t.sampleSizes.length===0,fa=t=>{var e;return t.currentFragmentState?(e=t.currentFragmentState).encryptionAuxInfo??(e.encryptionAuxInfo={defaultSampleInfoSize:0,sampleSizes:null,sampleCount:0,offset:null,resolved:null}):t.encryptionAuxInfo??(t.encryptionAuxInfo={defaultSampleInfoSize:0,sampleSizes:null,sampleCount:0,offset:null,resolved:null})},pa=async(t,e,r)=>{if(r.resolved)return r.resolved;if(r.offset===null||r.sampleCount===0)throw new Error("Incomplete saiz/saio info; cannot resolve encryption data.");let i=0;if(r.defaultSampleInfoSize>0)i=r.defaultSampleInfoSize*r.sampleCount;else {g(r.sampleSizes);for(let a=0;a<r.sampleCount;a++)i+=r.sampleSizes[a];}let s=t.requestSlice(r.offset,i);if(U(s)&&(s=await s),!s)throw new Error("Failed to read auxiliary encryption info.");let n=e.defaultPerSampleIvSize;g(n!==null);let o=[];for(let a=0;a<r.sampleCount;a++){let c=r.defaultSampleInfoSize>0?r.defaultSampleInfoSize:r.sampleSizes[a],l=new Uint8Array(16);n>0?l.set(te(s,n),0):l.set(e.defaultConstantIv,0);let u=null;if(c>n){let d=_e(s);u=[];for(let f=0;f<d;f++){let m=_e(s),p=O(s);u.push({clearLen:m,protectedLen:p});}}o.push({iv:l,subsamples:u});}return r.resolved=o,o},ha=t=>t.defaultConstantIv?{iv:t.defaultConstantIv,subsamples:null}:null,ma=async(t,e,r,i)=>{g(t.encryptionInfo);let s=t.encryptionInfo;g(s.defaultKid!==null);let n=s.defaultKid,o,a=t.demuxer.decryptionKeyCache.get(n);if(a)o=await a;else {if(!t.demuxer.input._formatOptions.isobmff?.resolveKeyId)throw new Error("Encrypted media samples encountered. To decrypt them, please provide a callback for InputOptions.formatOptions.isobmff.resolveKeyId.");let c=(async()=>{let l=t.demuxer.psshBoxes;if(i){l=[...l,...i.psshBoxes].filter(d=>d.keyIds===null||d.keyIds.includes(n));for(let d=0;d<l.length-1;d++)for(let f=d+1;f<l.length;f++)aa(l[d],l[f])&&(l.splice(f,1),f--);}let u=await t.demuxer.input._formatOptions.isobmff.resolveKeyId({keyId:n,psshBoxes:l});if(!(typeof u=="string"&&u.length===32&&fo.test(u)||u instanceof Uint8Array&&u.byteLength===16))throw new TypeError("resolveKeyId must return a 32-character hex string or a 16-byte Uint8Array containing the decryption key.");return u instanceof Uint8Array?u:ho(u)})();t.demuxer.decryptionKeyCache.set(n,c),o=await c;}return s.scheme==="cenc"||s.scheme==="cens"?dl(o,s,e,r):fl(o,s,e,r)},dl=async(t,e,r,i)=>{let s=new Uint8Array(16);s.set(r.iv,0);let n=await crypto.subtle.importKey("raw",t,{name:"AES-CTR"},!1,["decrypt"]),o=async p=>{let b=await crypto.subtle.decrypt({name:"AES-CTR",counter:s,length:64},n,p);return new Uint8Array(b)};if(!r.subsamples)return o(i);g(e.defaultCryptByteBlock!==null&&e.defaultSkipByteBlock!==null);let a=ga(r.subsamples,e.defaultCryptByteBlock,e.defaultSkipByteBlock),c=0;for(let p of a)for(let b of p.perSubsample)c+=b.length;let l=new Uint8Array(c),u=0;for(let p of a)for(let b of p.perSubsample)l.set(i.subarray(b.offset,b.offset+b.length),u),u+=b.length;let d=await o(l),f=new Uint8Array(i),m=0;for(let p of a)for(let b of p.perSubsample)f.set(d.subarray(m,m+b.length),b.offset),m+=b.length;return f},fl=(t,e,r,i)=>{let s=new dn;s.init({key:t,iv:r.iv});let n=e.defaultCryptByteBlock,o=e.defaultSkipByteBlock;if(g(n!==null&&o!==null),!r.subsamples){let u=new Uint8Array(i),d=Math.floor(i.length/16);for(let f=0;f<d;f++){let m=f*16;s.in.set(i.subarray(m,m+16)),s.decrypt(),u.set(s.out,m);}return u}if(n===0&&o===0)throw new Error("cbcs with subsamples requires pattern encryption.");let a=new Uint8Array(i),c=ga(r.subsamples,n,o),l=new DataView(r.iv.buffer,r.iv.byteOffset,16);for(let u of c){s.iv[0]=l.getUint32(0,!1),s.iv[1]=l.getUint32(4,!1),s.iv[2]=l.getUint32(8,!1),s.iv[3]=l.getUint32(12,!1);for(let d of u.perSubsample){let f=d.length/16;for(let m=0;m<f;m++){let p=d.offset+m*16;s.in.set(i.subarray(p,p+16)),s.decrypt(),a.set(s.out,p);}}}return a},ga=(t,e,r)=>{let i=[],s=e!==0||r!==0,n=0;for(let o of t){n+=o.clearLen;let a=[];if(!s)o.protectedLen>0&&a.push({offset:n,length:o.protectedLen}),n+=o.protectedLen;else {let c=o.protectedLen,l=n;for(;c>0&&!(c<16*e);){let u=16*e;a.push({offset:l,length:u}),l+=u,c-=u;let d=Math.min(16*r,c);l+=d,c-=d;}n+=o.protectedLen;}i.push({perSubsample:a});}return i};var x;(function(t){t[t.EBML=440786851]="EBML",t[t.EBMLVersion=17030]="EBMLVersion",t[t.EBMLReadVersion=17143]="EBMLReadVersion",t[t.EBMLMaxIDLength=17138]="EBMLMaxIDLength",t[t.EBMLMaxSizeLength=17139]="EBMLMaxSizeLength",t[t.DocType=17026]="DocType",t[t.DocTypeVersion=17031]="DocTypeVersion",t[t.DocTypeReadVersion=17029]="DocTypeReadVersion",t[t.Void=236]="Void",t[t.Segment=408125543]="Segment",t[t.SeekHead=290298740]="SeekHead",t[t.Seek=19899]="Seek",t[t.SeekID=21419]="SeekID",t[t.SeekPosition=21420]="SeekPosition",t[t.Duration=17545]="Duration",t[t.Info=357149030]="Info",t[t.TimestampScale=2807729]="TimestampScale",t[t.MuxingApp=19840]="MuxingApp",t[t.WritingApp=22337]="WritingApp",t[t.Tracks=374648427]="Tracks",t[t.TrackEntry=174]="TrackEntry",t[t.TrackNumber=215]="TrackNumber",t[t.TrackUID=29637]="TrackUID",t[t.TrackType=131]="TrackType",t[t.FlagEnabled=185]="FlagEnabled",t[t.FlagDefault=136]="FlagDefault",t[t.FlagForced=21930]="FlagForced",t[t.FlagOriginal=21934]="FlagOriginal",t[t.FlagHearingImpaired=21931]="FlagHearingImpaired",t[t.FlagVisualImpaired=21932]="FlagVisualImpaired",t[t.FlagCommentary=21935]="FlagCommentary",t[t.FlagLacing=156]="FlagLacing",t[t.Name=21358]="Name",t[t.Language=2274716]="Language",t[t.LanguageBCP47=2274717]="LanguageBCP47",t[t.CodecID=134]="CodecID",t[t.CodecPrivate=25506]="CodecPrivate",t[t.CodecDelay=22186]="CodecDelay",t[t.SeekPreRoll=22203]="SeekPreRoll",t[t.DefaultDuration=2352003]="DefaultDuration",t[t.Video=224]="Video",t[t.PixelWidth=176]="PixelWidth",t[t.PixelHeight=186]="PixelHeight",t[t.DisplayWidth=21680]="DisplayWidth",t[t.DisplayHeight=21690]="DisplayHeight",t[t.DisplayUnit=21682]="DisplayUnit",t[t.AlphaMode=21440]="AlphaMode",t[t.Audio=225]="Audio",t[t.SamplingFrequency=181]="SamplingFrequency",t[t.Channels=159]="Channels",t[t.BitDepth=25188]="BitDepth",t[t.SimpleBlock=163]="SimpleBlock",t[t.BlockGroup=160]="BlockGroup",t[t.Block=161]="Block",t[t.BlockAdditions=30113]="BlockAdditions",t[t.BlockMore=166]="BlockMore",t[t.BlockAdditional=165]="BlockAdditional",t[t.BlockAddID=238]="BlockAddID",t[t.BlockDuration=155]="BlockDuration",t[t.ReferenceBlock=251]="ReferenceBlock",t[t.Cluster=524531317]="Cluster",t[t.Timestamp=231]="Timestamp",t[t.Cues=475249515]="Cues",t[t.CuePoint=187]="CuePoint",t[t.CueTime=179]="CueTime",t[t.CueTrackPositions=183]="CueTrackPositions",t[t.CueTrack=247]="CueTrack",t[t.CueClusterPosition=241]="CueClusterPosition",t[t.Colour=21936]="Colour",t[t.MatrixCoefficients=21937]="MatrixCoefficients",t[t.TransferCharacteristics=21946]="TransferCharacteristics",t[t.Primaries=21947]="Primaries",t[t.Range=21945]="Range",t[t.Projection=30320]="Projection",t[t.ProjectionType=30321]="ProjectionType",t[t.ProjectionPoseRoll=30325]="ProjectionPoseRoll",t[t.Attachments=423732329]="Attachments",t[t.AttachedFile=24999]="AttachedFile",t[t.FileDescription=18046]="FileDescription",t[t.FileName=18030]="FileName",t[t.FileMediaType=18016]="FileMediaType",t[t.FileData=18012]="FileData",t[t.FileUID=18094]="FileUID",t[t.Chapters=272869232]="Chapters",t[t.Tags=307544935]="Tags",t[t.Tag=29555]="Tag",t[t.Targets=25536]="Targets",t[t.TargetTypeValue=26826]="TargetTypeValue",t[t.TargetType=25546]="TargetType",t[t.TagTrackUID=25541]="TagTrackUID",t[t.TagEditionUID=25545]="TagEditionUID",t[t.TagChapterUID=25540]="TagChapterUID",t[t.TagAttachmentUID=25542]="TagAttachmentUID",t[t.SimpleTag=26568]="SimpleTag",t[t.TagName=17827]="TagName",t[t.TagLanguage=17530]="TagLanguage",t[t.TagString=17543]="TagString",t[t.TagBinary=17541]="TagBinary",t[t.ContentEncodings=28032]="ContentEncodings",t[t.ContentEncoding=25152]="ContentEncoding",t[t.ContentEncodingOrder=20529]="ContentEncodingOrder",t[t.ContentEncodingScope=20530]="ContentEncodingScope",t[t.ContentCompression=20532]="ContentCompression",t[t.ContentCompAlgo=16980]="ContentCompAlgo",t[t.ContentCompSettings=16981]="ContentCompSettings",t[t.ContentEncryption=20533]="ContentEncryption";})(x||(x={}));var hl=[x.EBML,x.Segment],Rr=[x.SeekHead,x.Info,x.Cluster,x.Tracks,x.Cues,x.Attachments,x.Chapters,x.Tags],li=[...hl,...Rr];var ys=8,Ne=2,et=2*ys,bs=t=>{if(t.remainingLength<1)return null;let e=Q(t);if(t.skip(-1),e===0)return null;let r=1,i=128;for(;(e&i)===0;)r++,i>>=1;return t.remainingLength<r?null:r},Fr=t=>{if(t.remainingLength<1)return null;let e=Q(t);if(e===0)return null;let r=1,i=128;for(;(e&i)===0;)r++,i>>=1;if(t.remainingLength<r-1)return null;let s=e&i-1;for(let n=1;n<r;n++)s*=256,s+=Q(t);return s},J=(t,e)=>{if(e<1||e>8)throw new Error("Bad unsigned int size "+e);let r=0;for(let i=0;i<e;i++)r*=256,r+=Q(t);return r},ya=(t,e)=>{if(e<1)throw new Error("Bad unsigned int size "+e);let r=0n;for(let i=0;i<e;i++)r<<=8n,r+=BigInt(Q(t));return r};var wn=t=>{let e=bs(t);return e===null||t.remainingLength<e?null:J(t,e)},As=t=>{if(t.remainingLength<1)return null;if(Q(t)===255)return;t.skip(-1);let r=Fr(t);if(r===null)return null;if(r!==72057594037927940)return r},tt=t=>{g(t.remainingLength>=Ne);let e=wn(t);if(e===null)return null;let r=As(t);return r===null?null:{id:e,size:r}},Qt=(t,e)=>{let r=te(t,e),i=0;for(;i<e&&r[i]!==0;)i+=1;return String.fromCharCode(...r.subarray(0,i))},Br=(t,e)=>{let r=te(t,e),i=0;for(;i<e&&r[i]!==0;)i+=1;return je.decode(r.subarray(0,i))},yn=(t,e)=>{if(e===0)return 0;if(e!==4&&e!==8)throw new Error("Bad float size "+e);return e===4?ba(t):gn(t)},bn=async(t,e,r,i)=>{let s=new Set(r),n=e;for(;i===null||n<i;){let o=t.requestSliceRange(n,Ne,et);if(U(o)&&(o=await o),!o)break;let a=tt(o);if(!a)break;if(s.has(a.id))return {pos:n,found:!0};Ft(a.size),n=o.filePos+a.size;}return {pos:i!==null&&i>n?i:n,found:!1}},Ts=async(t,e,r,i)=>{let n=new Set(r),o=e;for(;o<i;){let a=t.requestSliceRange(o,0,Math.min(65536,i-o));if(U(a)&&(a=await a),!a||a.length<ys)break;for(let c=0;c<a.length-ys;c++){a.filePos=o;let l=wn(a);if(l!==null&&n.has(l))return o;o++;}}return null},Oe={avc:"V_MPEG4/ISO/AVC",hevc:"V_MPEGH/ISO/HEVC",vp8:"V_VP8",vp9:"V_VP9",av1:"V_AV1",prores:"V_PRORES",aac:"A_AAC",mp3:"A_MPEG/L3",opus:"A_OPUS",vorbis:"A_VORBIS",flac:"A_FLAC",ac3:"A_AC3",eac3:"A_EAC3",dts:"A_DTS","pcm-u8":"A_PCM/INT/LIT","pcm-s16":"A_PCM/INT/LIT","pcm-s16be":"A_PCM/INT/BIG","pcm-s24":"A_PCM/INT/LIT","pcm-s24be":"A_PCM/INT/BIG","pcm-s32":"A_PCM/INT/LIT","pcm-s32be":"A_PCM/INT/BIG","pcm-f32":"A_PCM/FLOAT/IEEE","pcm-f64":"A_PCM/FLOAT/IEEE",webvtt:"S_TEXT/WEBVTT"};function Ft(t){if(t===void 0)throw new Error("Undefined element size is used in a place where it is not supported.")}var Aa=t=>{let r=(t.hasVideo?"video/":t.hasAudio?"audio/":"application/")+(t.isWebM?"webm":"x-matroska");if(t.codecStrings.length>0){let i=[...new Set(t.codecStrings.filter(Boolean))];r+=`; codecs="${i.join(", ")}"`;}return r};var Bt;(function(t){t[t.None=0]="None",t[t.Xiph=1]="Xiph",t[t.FixedSize=2]="FixedSize",t[t.Ebml=3]="Ebml";})(Bt||(Bt={}));var An;(function(t){t[t.Block=1]="Block",t[t.Private=2]="Private",t[t.Next=4]="Next";})(An||(An={}));var ui;(function(t){t[t.Zlib=0]="Zlib",t[t.Bzlib=1]="Bzlib",t[t.lzo1x=2]="lzo1x",t[t.HeaderStripping=3]="HeaderStripping";})(ui||(ui={}));var ks=[{id:x.SeekHead,flag:"seekHeadSeen"},{id:x.Info,flag:"infoSeen"},{id:x.Tracks,flag:"tracksSeen"},{id:x.Cues,flag:"cuesSeen"}],Ta=10*2**20,Tn=class extends Cr{constructor(e){super(e),this.readMetadataPromise=null,this.segments=[],this.currentSegment=null,this.currentTrack=null,this.currentCluster=null,this.currentBlock=null,this.currentBlockAdditional=null,this.currentCueTime=null,this.currentDecodingInstruction=null,this.currentTagTargetIsMovie=!0,this.currentSimpleTagName=null,this.currentAttachedFile=null,this.isWebM=!1,this.reader=e._reader;}async getTrackBackings(){return await this.readMetadata(),this.segments.flatMap(e=>e.tracks.map(r=>r.trackBacking))}async getMimeType(){await this.readMetadata();let e=await this.getTrackBackings(),r=await Promise.all(e.map(i=>i.getDecoderConfig().then(s=>s?.codec??null)));return Aa({isWebM:this.isWebM,hasVideo:this.segments.some(i=>i.tracks.some(s=>s.info?.type==="video")),hasAudio:this.segments.some(i=>i.tracks.some(s=>s.info?.type==="audio")),codecStrings:r.filter(Boolean)})}async getMetadataTags(){await this.readMetadata();for(let r of this.segments)r.metadataTagsCollected||(this.reader.fileSize!==null&&await this.loadSegmentMetadata(r),r.metadataTagsCollected=!0);let e={};for(let r of this.segments)e={...e,...r.metadataTags};return e}readMetadata(){return this.readMetadataPromise??(this.readMetadataPromise=(async()=>{let e=0;for(;;){let r=this.reader.requestSliceRange(e,Ne,et);if(U(r)&&(r=await r),!r)break;let i=tt(r);if(!i)break;let s=i.id,n=i.size,o=r.filePos;if(s===x.EBML){Ft(n);let a=this.reader.requestSlice(o,n);if(U(a)&&(a=await a),!a)break;this.readContiguousElements(a);}else if(s===x.Segment){if(await this.readSegment(o,n),n===void 0||this.reader.fileSize===null)break}else if(s===x.Cluster){if(this.reader.fileSize===null)break;n===void 0&&(n=(await bn(this.reader,o,li,this.reader.fileSize)).pos-o);let a=fe(this.segments);a&&(a.elementEndPos=o+n);}Ft(n),e=o+n;}})())}async readSegment(e,r){this.currentSegment={seekHeadSeen:!1,infoSeen:!1,tracksSeen:!1,cuesSeen:!1,tagsSeen:!1,attachmentsSeen:!1,timestampScale:-1,timestampFactor:-1,duration:-1,seekEntries:[],tracks:[],cuePoints:[],dataStartPos:e,elementEndPos:r===void 0?null:e+r,clusterSeekStartPos:e,lastReadCluster:null,metadataTags:{},metadataTagsCollected:!1},this.segments.push(this.currentSegment);let i=e;for(;this.currentSegment.elementEndPos===null||i<this.currentSegment.elementEndPos;){let a=this.reader.requestSliceRange(i,Ne,et);if(U(a)&&(a=await a),!a)break;let c=i,l=tt(a);if(!l||!Rr.includes(l.id)&&l.id!==x.Void){let p=await Ts(this.reader,c,Rr,Math.min(this.currentSegment.elementEndPos??1/0,c+Ta));if(p){i=p;continue}else break}let{id:u,size:d}=l,f=a.filePos,m=ks.findIndex(p=>p.id===u);if(m!==-1){let p=ks[m].flag;this.currentSegment[p]=!0,Ft(d);let b=this.reader.requestSlice(f,d);U(b)&&(b=await b),b&&this.readContiguousElements(b);}else if(u===x.Tags||u===x.Attachments){u===x.Tags?this.currentSegment.tagsSeen=!0:this.currentSegment.attachmentsSeen=!0,Ft(d);let p=this.reader.requestSlice(f,d);U(p)&&(p=await p),p&&this.readContiguousElements(p);}else if(u===x.Cluster){this.currentSegment.clusterSeekStartPos=c;break}if(d===void 0)break;i=f+d;}if(this.currentSegment.seekEntries.sort((a,c)=>a.segmentPosition-c.segmentPosition),this.reader.fileSize!==null)for(let a of this.currentSegment.seekEntries){let c=ks.find(p=>p.id===a.id);if(!c||this.currentSegment[c.flag])continue;let l=this.reader.requestSliceRange(e+a.segmentPosition,Ne,et);if(U(l)&&(l=await l),!l)continue;let u=tt(l);if(!u)continue;let{id:d,size:f}=u;if(d!==c.id)continue;Ft(f),this.currentSegment[c.flag]=!0;let m=this.reader.requestSlice(l.filePos,f);U(m)&&(m=await m),m&&this.readContiguousElements(m);}this.currentSegment.timestampScale===-1&&(this.currentSegment.timestampScale=1e6,this.currentSegment.timestampFactor=1e9/1e6);for(let a of this.currentSegment.tracks)a.defaultDurationNs!==null&&(a.defaultDuration=this.currentSegment.timestampFactor*a.defaultDurationNs/1e9);let s=new Map(this.currentSegment.tracks.map(a=>[a.id,a]));for(let a of this.currentSegment.cuePoints){let c=s.get(a.trackId);c&&c.cuePoints.push(a);}for(let a of this.currentSegment.tracks){a.cuePoints.sort((c,l)=>c.time-l.time);for(let c=0;c<a.cuePoints.length-1;c++){let l=a.cuePoints[c],u=a.cuePoints[c+1];l.time===u.time&&(a.cuePoints.splice(c+1,1),c--);}}let n=null,o=-1/0;for(let a of this.currentSegment.tracks)a.cuePoints.length>o&&(o=a.cuePoints.length,n=a);for(let a of this.currentSegment.tracks)a.cuePoints.length===0&&(a.cuePoints=n.cuePoints);this.currentSegment=null;}async readCluster(e,r){if(r.lastReadCluster?.elementStartPos===e)return r.lastReadCluster;let i=this.reader.requestSliceRange(e,Ne,et);U(i)&&(i=await i),g(i);let s=e,n=tt(i);g(n);let o=n.id;g(o===x.Cluster);let a=n.size,c=i.filePos;a===void 0&&(a=(await bn(this.reader,c,li,r.elementEndPos)).pos-c);let l=this.reader.requestSlice(c,a);U(l)&&(l=await l);let u={segment:r,elementStartPos:s,elementEndPos:c+a,dataStartPos:c,timestamp:-1,trackData:new Map};if(this.currentCluster=u,l){let d=this.readContiguousElements(l,li);u.elementEndPos=d;}for(let[,d]of u.trackData){let f=d.track;g(d.blocks.length>0);let m=!1;for(let w=0;w<d.blocks.length;w++){let A=d.blocks[w];A.timestamp+=u.timestamp,m||(m=A.lacing!==Bt.None);}d.presentationTimestamps=d.blocks.map((w,A)=>({timestamp:w.timestamp,blockIndex:A})).sort((w,A)=>w.timestamp-A.timestamp);for(let w=0;w<d.presentationTimestamps.length;w++){let A=d.presentationTimestamps[w],T=d.blocks[A.blockIndex];if(d.firstKeyFrameTimestamp===null&&T.isKeyFrame&&(d.firstKeyFrameTimestamp=T.timestamp),w<d.presentationTimestamps.length-1){let I=d.presentationTimestamps[w+1];T.duration=I.timestamp-T.timestamp;}else T.duration===0&&f.defaultDuration!=null&&T.lacing===Bt.None&&(T.duration=f.defaultDuration);}m&&(this.expandLacedBlocks(d.blocks,f),d.presentationTimestamps=d.blocks.map((w,A)=>({timestamp:w.timestamp,blockIndex:A})).sort((w,A)=>w.timestamp-A.timestamp));let p=d.blocks[d.presentationTimestamps[0].blockIndex],b=d.blocks[fe(d.presentationTimestamps).blockIndex];d.startTimestamp=p.timestamp,d.endTimestamp=b.timestamp+b.duration;let y=ce(f.clusterPositionCache,d.startTimestamp,w=>w.startTimestamp);(y===-1||f.clusterPositionCache[y].elementStartPos!==s)&&f.clusterPositionCache.splice(y+1,0,{elementStartPos:u.elementStartPos,startTimestamp:d.startTimestamp});}return r.lastReadCluster=u,u}getTrackDataInCluster(e,r){let i=e.trackData.get(r);if(!i){let s=e.segment.tracks.find(n=>n.id===r);if(!s)return null;i={track:s,startTimestamp:0,endTimestamp:0,firstKeyFrameTimestamp:null,blocks:[],presentationTimestamps:[]},e.trackData.set(r,i);}return i}expandLacedBlocks(e,r){for(let i=0;i<e.length;i++){let s=e[i];if(s.lacing===Bt.None)continue;s.decoded||(s.data=this.decodeBlockData(r,s.data),s.decoded=!0);let n=rt.tempFromBytes(s.data),o=[],a=Q(n)+1;switch(s.lacing){case Bt.Xiph:{let l=0;for(let u=0;u<a-1;u++){let d=0;for(;n.bufferPos<n.length;){let f=Q(n);if(d+=f,f<255){o.push(d),l+=d;break}}}o.push(n.length-(n.bufferPos+l));}break;case Bt.FixedSize:{let l=n.length-1,u=Math.floor(l/a);for(let d=0;d<a;d++)o.push(u);}break;case Bt.Ebml:{let l=Fr(n);g(l!==null);let u=l;o.push(u);let d=u;for(let f=1;f<a-1;f++){let m=n.bufferPos,p=Fr(n);g(p!==null);let b=p,w=(1<<(n.bufferPos-m)*7-1)-1,A=b-w;u+=A,o.push(u),d+=u;}o.push(n.length-(n.bufferPos+d));}break;default:g(!1);}g(o.length===a),e.splice(i,1);let c=s.duration||a*(r.defaultDuration??0);for(let l=0;l<a;l++){let u=o[l],d=te(n,u),f=s.timestamp+c*l/a,m=c/a;e.splice(i+l,0,{timestamp:f,duration:m,isKeyFrame:s.isKeyFrame,data:d,lacing:Bt.None,decoded:!0,postProcessed:!1,mainAdditional:s.mainAdditional});}i+=a,i--;}}async loadSegmentMetadata(e){for(let r of e.seekEntries){if(!(r.id===x.Tags&&!e.tagsSeen)){if(!(r.id===x.Attachments&&!e.attachmentsSeen))continue}let i=this.reader.requestSliceRange(e.dataStartPos+r.segmentPosition,Ne,et);if(U(i)&&(i=await i),!i)continue;let s=tt(i);if(!s||s.id!==r.id)continue;let{size:n}=s;Ft(n),g(!this.currentSegment),this.currentSegment=e;let o=this.reader.requestSlice(i.filePos,n);U(o)&&(o=await o),o&&this.readContiguousElements(o),this.currentSegment=null,r.id===x.Tags?e.tagsSeen=!0:r.id===x.Attachments&&(e.attachmentsSeen=!0);}}readContiguousElements(e,r){for(;e.remainingLength>=Ne;){let i=e.filePos;if(!this.traverseElement(e,r))return i}return e.filePos}traverseElement(e,r){let i=tt(e);if(!i||r&&r.includes(i.id))return !1;let{id:s,size:n}=i,o=e.filePos;switch(Ft(n),s){case x.DocType:this.isWebM=Qt(e,n)==="webm";break;case x.Seek:{if(!this.currentSegment)break;let a={id:-1,segmentPosition:-1};this.currentSegment.seekEntries.push(a),this.readContiguousElements(e.slice(o,n)),(a.id===-1||a.segmentPosition===-1)&&this.currentSegment.seekEntries.pop();}break;case x.SeekID:{let a=this.currentSegment?.seekEntries[this.currentSegment.seekEntries.length-1];if(!a)break;a.id=J(e,n);}break;case x.SeekPosition:{let a=this.currentSegment?.seekEntries[this.currentSegment.seekEntries.length-1];if(!a)break;a.segmentPosition=J(e,n);}break;case x.TimestampScale:{if(!this.currentSegment)break;this.currentSegment.timestampScale=J(e,n),this.currentSegment.timestampFactor=1e9/this.currentSegment.timestampScale;}break;case x.Duration:{if(!this.currentSegment)break;this.currentSegment.duration=yn(e,n);}break;case x.TrackEntry:{if(!this.currentSegment||(this.currentTrack={id:-1,segment:this.currentSegment,demuxer:this,clusterPositionCache:[],cuePoints:[],disposition:{...qi,primary:!1},trackBacking:null,codecId:null,codecPrivate:null,defaultDuration:null,defaultDurationNs:null,name:null,languageCode:"eng",hasLanguageBcp47:!1,decodingInstructions:[],info:null},this.readContiguousElements(e.slice(o,n)),!this.currentTrack))break;if(this.currentTrack.decodingInstructions.some(a=>a.data?.type!=="decompress"||a.scope!==An.Block||a.data.algorithm!==ui.HeaderStripping)&&(K._warn(`Track #${this.currentTrack.id} has an unsupported content encoding; dropping.`),this.currentTrack=null),this.currentTrack&&this.currentTrack.id!==-1&&this.currentTrack.codecId&&this.currentTrack.info){let a=this.currentTrack.codecId.indexOf("/"),c=a===-1?this.currentTrack.codecId:this.currentTrack.codecId.slice(0,a);if(this.currentTrack.info.type==="video"&&this.currentTrack.info.width!==-1&&this.currentTrack.info.height!==-1){if(this.currentTrack.info.squarePixelWidth=this.currentTrack.info.width,this.currentTrack.info.squarePixelHeight=this.currentTrack.info.height,this.currentTrack.info.displayWidth!==null&&this.currentTrack.info.displayHeight!==null){let u=this.currentTrack.info.displayWidth*this.currentTrack.info.height,d=this.currentTrack.info.displayHeight*this.currentTrack.info.width;u>0&&d>0&&(u>d?this.currentTrack.info.squarePixelWidth=Math.round(this.currentTrack.info.width*u/d):this.currentTrack.info.squarePixelHeight=Math.round(this.currentTrack.info.height*d/u));}if(this.currentTrack.codecId===Oe.avc)this.currentTrack.info.codec="avc",this.currentTrack.info.codecDescription=this.currentTrack.codecPrivate;else if(this.currentTrack.codecId===Oe.hevc)this.currentTrack.info.codec="hevc",this.currentTrack.info.codecDescription=this.currentTrack.codecPrivate;else if(c===Oe.vp8)this.currentTrack.info.codec="vp8";else if(c===Oe.vp9)this.currentTrack.info.codec="vp9";else if(c===Oe.av1)this.currentTrack.info.codec="av1";else if(c===Oe.prores){let u=this.currentTrack.codecPrivate?je.decode(this.currentTrack.codecPrivate):"";Ct.includes(u)&&(this.currentTrack.info.codec="prores",this.currentTrack.info.proresFormat=u);}let l=this.currentTrack;this.currentTrack.trackBacking=new Ss(l),this.currentSegment.tracks.push(this.currentTrack);}else if(this.currentTrack.info.type==="audio"){c===Oe.aac?(this.currentTrack.info.codec="aac",this.currentTrack.info.aacCodecInfo={isMpeg2:this.currentTrack.codecId.includes("MPEG2"),objectType:null},this.currentTrack.info.codecDescription=this.currentTrack.codecPrivate):this.currentTrack.codecId===Oe.mp3?this.currentTrack.info.codec="mp3":c===Oe.opus?(this.currentTrack.info.codec="opus",this.currentTrack.info.codecDescription=this.currentTrack.codecPrivate,this.currentTrack.info.sampleRate=sn):c===Oe.vorbis?(this.currentTrack.info.codec="vorbis",this.currentTrack.info.codecDescription=this.currentTrack.codecPrivate):c===Oe.flac?(this.currentTrack.info.codec="flac",this.currentTrack.info.codecDescription=this.currentTrack.codecPrivate):c===Oe.ac3?(this.currentTrack.info.codec="ac3",this.currentTrack.info.codecDescription=this.currentTrack.codecPrivate):c===Oe.eac3?(this.currentTrack.info.codec="eac3",this.currentTrack.info.codecDescription=this.currentTrack.codecPrivate):c===Oe.dts?(this.currentTrack.info.codec="dts",this.currentTrack.codecId==="A_DTS/EXPRESS"?this.currentTrack.info.dtsFormat="dtse":this.currentTrack.codecId==="A_DTS/LOSSLESS"&&(this.currentTrack.info.dtsFormat="dtsl")):this.currentTrack.codecId==="A_PCM/INT/LIT"?this.currentTrack.info.bitDepth===8?this.currentTrack.info.codec="pcm-u8":this.currentTrack.info.bitDepth===16?this.currentTrack.info.codec="pcm-s16":this.currentTrack.info.bitDepth===24?this.currentTrack.info.codec="pcm-s24":this.currentTrack.info.bitDepth===32&&(this.currentTrack.info.codec="pcm-s32"):this.currentTrack.codecId==="A_PCM/INT/BIG"?this.currentTrack.info.bitDepth===8?this.currentTrack.info.codec="pcm-u8":this.currentTrack.info.bitDepth===16?this.currentTrack.info.codec="pcm-s16be":this.currentTrack.info.bitDepth===24?this.currentTrack.info.codec="pcm-s24be":this.currentTrack.info.bitDepth===32&&(this.currentTrack.info.codec="pcm-s32be"):this.currentTrack.codecId==="A_PCM/FLOAT/IEEE"&&(this.currentTrack.info.bitDepth===32?this.currentTrack.info.codec="pcm-f32":this.currentTrack.info.bitDepth===64&&(this.currentTrack.info.codec="pcm-f64"));let l=this.currentTrack;this.currentTrack.trackBacking=new xs(l),this.currentSegment.tracks.push(this.currentTrack);}}this.currentTrack=null;}break;case x.TrackNumber:{if(!this.currentTrack)break;this.currentTrack.id=J(e,n);}break;case x.TrackType:{if(!this.currentTrack)break;let a=J(e,n);a===1?this.currentTrack.info={type:"video",width:-1,height:-1,displayWidth:null,displayHeight:null,displayUnit:null,squarePixelWidth:-1,squarePixelHeight:-1,rotation:0,codec:null,codecDescription:null,colorSpace:{...Bi},alphaMode:!1,proresFormat:null}:a===2&&(this.currentTrack.info={type:"audio",numberOfChannels:1,sampleRate:8e3,bitDepth:-1,codec:null,codecDescription:null,aacCodecInfo:null,dtsFormat:null});}break;case x.FlagEnabled:{if(!this.currentTrack)break;J(e,n)||(this.currentTrack=null);}break;case x.FlagDefault:{if(!this.currentTrack)break;this.currentTrack.disposition.default=!!J(e,n);}break;case x.FlagForced:{if(!this.currentTrack)break;this.currentTrack.disposition.forced=!!J(e,n);}break;case x.FlagOriginal:{if(!this.currentTrack)break;this.currentTrack.disposition.original=!!J(e,n);}break;case x.FlagHearingImpaired:{if(!this.currentTrack)break;this.currentTrack.disposition.hearingImpaired=!!J(e,n);}break;case x.FlagVisualImpaired:{if(!this.currentTrack)break;this.currentTrack.disposition.visuallyImpaired=!!J(e,n);}break;case x.FlagCommentary:{if(!this.currentTrack)break;this.currentTrack.disposition.commentary=!!J(e,n);}break;case x.CodecID:{if(!this.currentTrack)break;this.currentTrack.codecId=Qt(e,n);}break;case x.CodecPrivate:{if(!this.currentTrack)break;this.currentTrack.codecPrivate=te(e,n);}break;case x.DefaultDuration:{if(!this.currentTrack)break;this.currentTrack.defaultDurationNs=J(e,n);}break;case x.Name:{if(!this.currentTrack)break;this.currentTrack.name=Br(e,n);}break;case x.Language:{if(!this.currentTrack||this.currentTrack.hasLanguageBcp47)break;this.currentTrack.languageCode=Qt(e,n),St(this.currentTrack.languageCode)||(this.currentTrack.languageCode=Ut);}break;case x.LanguageBCP47:{if(!this.currentTrack)break;let c=Qt(e,n).split("-")[0];c?this.currentTrack.languageCode=c:this.currentTrack.languageCode=Ut,this.currentTrack.hasLanguageBcp47=!0;}break;case x.Video:{if(this.currentTrack?.info?.type!=="video")break;this.readContiguousElements(e.slice(o,n));}break;case x.PixelWidth:{if(this.currentTrack?.info?.type!=="video")break;this.currentTrack.info.width=J(e,n);}break;case x.PixelHeight:{if(this.currentTrack?.info?.type!=="video")break;this.currentTrack.info.height=J(e,n);}break;case x.DisplayWidth:{if(this.currentTrack?.info?.type!=="video")break;this.currentTrack.info.displayWidth=J(e,n);}break;case x.DisplayHeight:{if(this.currentTrack?.info?.type!=="video")break;this.currentTrack.info.displayHeight=J(e,n);}break;case x.DisplayUnit:{if(this.currentTrack?.info?.type!=="video")break;this.currentTrack.info.displayUnit=J(e,n);}break;case x.AlphaMode:{if(this.currentTrack?.info?.type!=="video")break;this.currentTrack.info.alphaMode=J(e,n)===1;}break;case x.Colour:{if(this.currentTrack?.info?.type!=="video")break;this.readContiguousElements(e.slice(o,n));}break;case x.MatrixCoefficients:{if(this.currentTrack?.info?.type!=="video")break;let a=J(e,n),c=ct[a];this.currentTrack.info.colorSpace.matrix=c;}break;case x.Range:{if(this.currentTrack?.info?.type!=="video")break;let a=J(e,n);this.currentTrack.info.colorSpace.fullRange=a===1||a===2?a===2:void 0;}break;case x.TransferCharacteristics:{if(this.currentTrack?.info?.type!=="video")break;let a=J(e,n),c=at[a];this.currentTrack.info.colorSpace.transfer=c;}break;case x.Primaries:{if(this.currentTrack?.info?.type!=="video")break;let a=J(e,n),c=ot[a];this.currentTrack.info.colorSpace.primaries=c;}break;case x.Projection:{if(this.currentTrack?.info?.type!=="video")break;this.readContiguousElements(e.slice(o,n));}break;case x.ProjectionPoseRoll:{if(this.currentTrack?.info?.type!=="video")break;let c=-yn(e,n);try{this.currentTrack.info.rotation=yt(c);}catch{}}break;case x.Audio:{if(this.currentTrack?.info?.type!=="audio")break;this.readContiguousElements(e.slice(o,n));}break;case x.SamplingFrequency:{if(this.currentTrack?.info?.type!=="audio")break;this.currentTrack.info.sampleRate=yn(e,n);}break;case x.Channels:{if(this.currentTrack?.info?.type!=="audio")break;this.currentTrack.info.numberOfChannels=J(e,n);}break;case x.BitDepth:{if(this.currentTrack?.info?.type!=="audio")break;this.currentTrack.info.bitDepth=J(e,n);}break;case x.CuePoint:{if(!this.currentSegment)break;this.readContiguousElements(e.slice(o,n)),this.currentCueTime=null;}break;case x.CueTime:this.currentCueTime=J(e,n);break;case x.CueTrackPositions:{if(this.currentCueTime===null)break;g(this.currentSegment);let a={time:this.currentCueTime,trackId:-1,clusterPosition:-1};this.currentSegment.cuePoints.push(a),this.readContiguousElements(e.slice(o,n)),(a.trackId===-1||a.clusterPosition===-1)&&this.currentSegment.cuePoints.pop();}break;case x.CueTrack:{let a=this.currentSegment?.cuePoints[this.currentSegment.cuePoints.length-1];if(!a)break;a.trackId=J(e,n);}break;case x.CueClusterPosition:{let a=this.currentSegment?.cuePoints[this.currentSegment.cuePoints.length-1];if(!a)break;g(this.currentSegment),a.clusterPosition=this.currentSegment.dataStartPos+J(e,n);}break;case x.Timestamp:{if(!this.currentCluster)break;this.currentCluster.timestamp=J(e,n);}break;case x.SimpleBlock:{if(!this.currentCluster)break;let a=Fr(e);if(a===null)break;let c=this.getTrackDataInCluster(this.currentCluster,a);if(!c)break;let l=ci(e),u=Q(e),d=u>>1&3,f=!!(u&128);c.track.info?.type==="audio"&&c.track.info.codec&&(f=!0);let m=te(e,n-(e.filePos-o)),p=c.track.decodingInstructions.length>0;c.blocks.push({timestamp:l,duration:0,isKeyFrame:f,data:m,lacing:d,decoded:!p,postProcessed:!1,mainAdditional:null});}break;case x.BlockGroup:{if(!this.currentCluster)break;this.readContiguousElements(e.slice(o,n)),this.currentBlock=null;}break;case x.Block:{if(!this.currentCluster)break;let a=Fr(e);if(a===null)break;let c=this.getTrackDataInCluster(this.currentCluster,a);if(!c)break;let l=ci(e),d=Q(e)>>1&3,f=te(e,n-(e.filePos-o)),m=c.track.decodingInstructions.length>0;this.currentBlock={timestamp:l,duration:0,isKeyFrame:!0,data:f,lacing:d,decoded:!m,postProcessed:!1,mainAdditional:null},c.blocks.push(this.currentBlock);}break;case x.BlockAdditions:this.readContiguousElements(e.slice(o,n));break;case x.BlockMore:{if(!this.currentBlock)break;this.currentBlockAdditional={addId:1,data:null},this.readContiguousElements(e.slice(o,n)),this.currentBlockAdditional.data&&this.currentBlockAdditional.addId===1&&(this.currentBlock.mainAdditional=this.currentBlockAdditional.data),this.currentBlockAdditional=null;}break;case x.BlockAdditional:{if(!this.currentBlockAdditional)break;this.currentBlockAdditional.data=te(e,n);}break;case x.BlockAddID:{if(!this.currentBlockAdditional)break;this.currentBlockAdditional.addId=J(e,n);}break;case x.BlockDuration:{if(!this.currentBlock)break;this.currentBlock.duration=J(e,n);}break;case x.ReferenceBlock:{if(!this.currentBlock)break;this.currentBlock.isKeyFrame=!1;}break;case x.Tag:this.currentTagTargetIsMovie=!0,this.readContiguousElements(e.slice(o,n));break;case x.Targets:this.readContiguousElements(e.slice(o,n));break;case x.TargetTypeValue:J(e,n)!==50&&(this.currentTagTargetIsMovie=!1);break;case x.TagTrackUID:case x.TagEditionUID:case x.TagChapterUID:case x.TagAttachmentUID:this.currentTagTargetIsMovie=!1;break;case x.SimpleTag:{if(!this.currentTagTargetIsMovie)break;this.currentSimpleTagName=null,this.readContiguousElements(e.slice(o,n));}break;case x.TagName:this.currentSimpleTagName=Br(e,n);break;case x.TagString:{if(!this.currentSimpleTagName)break;let a=Br(e,n);this.processTagValue(this.currentSimpleTagName,a);}break;case x.TagBinary:{if(!this.currentSimpleTagName)break;let a=te(e,n);this.processTagValue(this.currentSimpleTagName,a);}break;case x.AttachedFile:{if(!this.currentSegment)break;this.currentAttachedFile={fileUid:null,fileName:null,fileMediaType:null,fileData:null,fileDescription:null},this.readContiguousElements(e.slice(o,n));let a=this.currentSegment.metadataTags;if(this.currentAttachedFile.fileUid&&this.currentAttachedFile.fileData&&(a.raw??(a.raw={}),a.raw[this.currentAttachedFile.fileUid.toString()]=new Yr(this.currentAttachedFile.fileData,this.currentAttachedFile.fileMediaType??void 0,this.currentAttachedFile.fileName??void 0,this.currentAttachedFile.fileDescription??void 0)),this.currentAttachedFile.fileMediaType?.startsWith("image/")&&this.currentAttachedFile.fileData){let c=this.currentAttachedFile.fileName,l="unknown";if(c){let u=c.toLowerCase();u.startsWith("cover.")?l="coverFront":u.startsWith("back.")&&(l="coverBack");}a.images??(a.images=[]),a.images.push({data:this.currentAttachedFile.fileData,mimeType:this.currentAttachedFile.fileMediaType,kind:l,name:this.currentAttachedFile.fileName??void 0,description:this.currentAttachedFile.fileDescription??void 0});}this.currentAttachedFile=null;}break;case x.FileUID:{if(!this.currentAttachedFile)break;this.currentAttachedFile.fileUid=ya(e,n);}break;case x.FileName:{if(!this.currentAttachedFile)break;this.currentAttachedFile.fileName=Br(e,n);}break;case x.FileMediaType:{if(!this.currentAttachedFile)break;this.currentAttachedFile.fileMediaType=Qt(e,n);}break;case x.FileData:{if(!this.currentAttachedFile)break;this.currentAttachedFile.fileData=te(e,n);}break;case x.FileDescription:{if(!this.currentAttachedFile)break;this.currentAttachedFile.fileDescription=Br(e,n);}break;case x.ContentEncodings:{if(!this.currentTrack)break;this.readContiguousElements(e.slice(o,n)),this.currentTrack.decodingInstructions.sort((a,c)=>c.order-a.order);}break;case x.ContentEncoding:this.currentDecodingInstruction={order:0,scope:An.Block,data:null},this.readContiguousElements(e.slice(o,n)),this.currentDecodingInstruction.data&&this.currentTrack.decodingInstructions.push(this.currentDecodingInstruction),this.currentDecodingInstruction=null;break;case x.ContentEncodingOrder:{if(!this.currentDecodingInstruction)break;this.currentDecodingInstruction.order=J(e,n);}break;case x.ContentEncodingScope:{if(!this.currentDecodingInstruction)break;this.currentDecodingInstruction.scope=J(e,n);}break;case x.ContentCompression:{if(!this.currentDecodingInstruction)break;this.currentDecodingInstruction.data={type:"decompress",algorithm:ui.Zlib,settings:null},this.readContiguousElements(e.slice(o,n));}break;case x.ContentCompAlgo:{if(this.currentDecodingInstruction?.data?.type!=="decompress")break;this.currentDecodingInstruction.data.algorithm=J(e,n);}break;case x.ContentCompSettings:{if(this.currentDecodingInstruction?.data?.type!=="decompress")break;this.currentDecodingInstruction.data.settings=te(e,n);}break;case x.ContentEncryption:{if(!this.currentDecodingInstruction)break;this.currentDecodingInstruction.data={type:"decrypt"};}break}return e.filePos=o+n,!0}decodeBlockData(e,r){g(e.decodingInstructions.length>0);let i=r;for(let s of e.decodingInstructions)switch(g(s.data),s.data.type){case "decompress":switch(s.data.algorithm){case ui.HeaderStripping:if(s.data.settings&&s.data.settings.length>0){let n=s.data.settings,o=new Uint8Array(n.length+i.length);o.set(n,0),o.set(i,n.length),i=o;}break;default:}break;default:}return i}processTagValue(e,r){var s;if(!this.currentSegment?.metadataTags)return;let i=this.currentSegment.metadataTags;if(i.raw??(i.raw={}),(s=i.raw)[e]??(s[e]=r),typeof r=="string")switch(e.toLowerCase()){case "title":i.title??(i.title=r);break;case "description":i.description??(i.description=r);break;case "artist":i.artist??(i.artist=r);break;case "album":i.album??(i.album=r);break;case "album_artist":i.albumArtist??(i.albumArtist=r);break;case "genre":i.genre??(i.genre=r);break;case "comment":i.comment??(i.comment=r);break;case "lyrics":i.lyrics??(i.lyrics=r);break;case "date":{let n=new Date(r);Number.isNaN(n.getTime())||(i.date??(i.date=n));}break;case "track_number":case "part_number":{let n=r.split("/"),o=Number.parseInt(n[0],10),a=n[1]&&Number.parseInt(n[1],10);Number.isInteger(o)&&o>0&&(i.trackNumber??(i.trackNumber=o)),a&&Number.isInteger(a)&&a>0&&(i.tracksTotal??(i.tracksTotal=a));}break;case "disc_number":case "disc":{let n=r.split("/"),o=Number.parseInt(n[0],10),a=n[1]&&Number.parseInt(n[1],10);Number.isInteger(o)&&o>0&&(i.discNumber??(i.discNumber=o)),a&&Number.isInteger(a)&&a>0&&(i.discsTotal??(i.discsTotal=a));}break}}},kn=class{constructor(e){this.internalTrack=e,this.packetToClusterLocation=new WeakMap;}getId(){return this.internalTrack.id}getNumber(){let e=this.internalTrack.demuxer,r=this.internalTrack.trackBacking.getType(),i=0;for(let s of e.segments)for(let n of s.tracks)if(n.trackBacking.getType()===r&&i++,n===this.internalTrack)break;return i}getCodec(){throw new Error("Not implemented on base class.")}getInternalCodecId(){return this.internalTrack.codecId}getName(){return this.internalTrack.name}getLanguageCode(){return this.internalTrack.languageCode}getTimeResolution(){return this.internalTrack.segment.timestampFactor}isRelativeToUnixEpoch(){return !1}getUnixTimeForTimestamp(){return null}getDisposition(){return this.internalTrack.disposition}getPairingMask(){return 1n}getBitrate(){return null}getAverageBitrate(){return null}async getDurationFromMetadata(){let e=this.internalTrack.segment;if(e.duration<=0)return null;let r=e.duration/e.timestampFactor,i=await this.getFirstPacket({metadataOnly:!0});return r+=i?.timestamp??0,r}async getLiveRefreshInterval(){return null}async getFirstPacket(e){return this.performClusterLookup(null,r=>r.trackData.get(this.internalTrack.id)?{blockIndex:0,correctBlockFound:!0}:{blockIndex:-1,correctBlockFound:!1},-1/0,1/0,e)}intoTimescale(e){return Di(e*this.internalTrack.segment.timestampFactor)}async getPacket(e,r){let i=this.intoTimescale(e);return this.performClusterLookup(null,s=>{let n=s.trackData.get(this.internalTrack.id);if(!n)return {blockIndex:-1,correctBlockFound:!1};let o=ce(n.presentationTimestamps,i,l=>l.timestamp),a=o!==-1?n.presentationTimestamps[o].blockIndex:-1,c=o!==-1&&i<n.endTimestamp;return {blockIndex:a,correctBlockFound:c}},i,i,r)}async getNextPacket(e,r){let i=this.packetToClusterLocation.get(e);if(i===void 0)throw new Error("Packet was not created from this track.");return this.performClusterLookup(i.cluster,s=>{if(s===i.cluster){let n=s.trackData.get(this.internalTrack.id);if(i.blockIndex+1<n.blocks.length)return {blockIndex:i.blockIndex+1,correctBlockFound:!0}}else if(s.trackData.get(this.internalTrack.id))return {blockIndex:0,correctBlockFound:!0};return {blockIndex:-1,correctBlockFound:!1}},-1/0,1/0,r)}async getKeyPacket(e,r){let i=this.intoTimescale(e);return this.performClusterLookup(null,s=>{let n=s.trackData.get(this.internalTrack.id);if(!n)return {blockIndex:-1,correctBlockFound:!1};let o=Mi(n.presentationTimestamps,l=>n.blocks[l.blockIndex].isKeyFrame&&l.timestamp<=i),a=o!==-1?n.presentationTimestamps[o].blockIndex:-1,c=o!==-1&&i<n.endTimestamp;return {blockIndex:a,correctBlockFound:c}},i,i,r)}async getNextKeyPacket(e,r){let i=this.packetToClusterLocation.get(e);if(i===void 0)throw new Error("Packet was not created from this track.");return this.performClusterLookup(i.cluster,s=>{if(s===i.cluster){let o=s.trackData.get(this.internalTrack.id).blocks.findIndex((a,c)=>a.isKeyFrame&&c>i.blockIndex);if(o!==-1)return {blockIndex:o,correctBlockFound:!0}}else {let n=s.trackData.get(this.internalTrack.id);if(n&&n.firstKeyFrameTimestamp!==null){let o=n.blocks.findIndex(a=>a.isKeyFrame);return g(o!==-1),{blockIndex:o,correctBlockFound:!0}}}return {blockIndex:-1,correctBlockFound:!1}},-1/0,1/0,r)}async fetchPacketInCluster(e,r,i){if(r===-1)return null;let n=e.trackData.get(this.internalTrack.id).blocks[r];if(g(n),n.decoded||(n.data=this.internalTrack.demuxer.decodeBlockData(this.internalTrack,n.data),n.decoded=!0),!n.postProcessed){if(this.internalTrack.info?.codec==="prores"&&!(n.data.length>=8&&n.data[4]===105&&n.data[5]===99&&n.data[6]===112&&n.data[7]===102)){let f=new Uint8Array(n.data.length+8);ie(f).setUint32(0,f.length,!1),f[4]=105,f[5]=99,f[6]=112,f[7]=102,f.set(n.data,8),n.data=f;}n.postProcessed=!0;}let o=i.metadataOnly?Ht:n.data,a=n.timestamp/this.internalTrack.segment.timestampFactor,c=n.duration/this.internalTrack.segment.timestampFactor,l={};n.mainAdditional&&this.internalTrack.info?.type==="video"&&this.internalTrack.info.alphaMode&&(l.alpha=i.metadataOnly?Ht:n.mainAdditional,l.alphaByteLength=n.mainAdditional.byteLength);let u=new de(o,n.isKeyFrame?"key":"delta",a,c,e.dataStartPos+r,n.data.byteLength,l);return this.packetToClusterLocation.set(u,{cluster:e,blockIndex:r}),u}async performClusterLookup(e,r,i,s,n){let{demuxer:o,segment:a}=this.internalTrack,c=null,l=null,u=-1;if(e){let{blockIndex:w,correctBlockFound:A}=r(e);if(A)return this.fetchPacketInCluster(e,w,n);w!==-1&&(l=e,u=w);}let d=ce(this.internalTrack.cuePoints,i,w=>w.time),f=d!==-1?this.internalTrack.cuePoints[d]:null,m=ce(this.internalTrack.clusterPositionCache,i,w=>w.startTimestamp),p=m!==-1?this.internalTrack.clusterPositionCache[m]:null,b=Math.max(f?.clusterPosition??0,p?.elementStartPos??0)||null,y;for(e?b===null||e.elementStartPos>=b?(y=e.elementEndPos,c=e):y=b:y=b??a.clusterSeekStartPos;a.elementEndPos===null||y<=a.elementEndPos-Ne;){if(c){let k=c.trackData.get(this.internalTrack.id);if(k&&k.startTimestamp>s)break}let w=o.reader.requestSliceRange(y,Ne,et);if(U(w)&&(w=await w),!w)break;let A=y,T=tt(w);if(!T||!Rr.includes(T.id)&&T.id!==x.Void){let k=await Ts(o.reader,A,Rr,Math.min(a.elementEndPos??1/0,A+Ta));if(k){y=k;continue}else break}let I=T.id,v=T.size,F=w.filePos;if(I===x.Cluster){c=await o.readCluster(A,a),v=c.elementEndPos-F;let{blockIndex:k,correctBlockFound:_}=r(c);if(_)return this.fetchPacketInCluster(c,k,n);k!==-1&&(l=c,u=k);}v===void 0&&(g(I!==x.Cluster),v=(await bn(o.reader,F,li,a.elementEndPos)).pos-F);let E=F+v;if(a.elementEndPos===null){let k=o.reader.requestSliceRange(E,Ne,et);if(U(k)&&(k=await k),!k)break;if(wn(k)===x.Segment){a.elementEndPos=E;break}}y=E;}if(f&&(!l||l.elementStartPos<f.clusterPosition)){let w=this.internalTrack.cuePoints[d-1];g(!w||w.time<f.time);let A=w?.time??-1/0;return this.performClusterLookup(null,r,A,s,n)}return l?this.fetchPacketInCluster(l,u,n):null}},Ss=class extends kn{constructor(e){super(e),this.decoderConfigPromise=null,this.internalTrack=e;}getType(){return "video"}getCodec(){return this.internalTrack.info.codec}getCodedWidth(){return this.internalTrack.info.width}getCodedHeight(){return this.internalTrack.info.height}getSquarePixelWidth(){return this.internalTrack.info.squarePixelWidth}getSquarePixelHeight(){return this.internalTrack.info.squarePixelHeight}getRotation(){return this.internalTrack.info.rotation}async getColorSpace(){let e=await this.getDecoderConfig();return e?{primaries:e.colorSpace?.primaries,transfer:e.colorSpace?.transfer,matrix:e.colorSpace?.matrix,fullRange:e.colorSpace?.fullRange}:this.internalTrack.info.colorSpace}async canBeTransparent(){return this.internalTrack.info.alphaMode||this.internalTrack.info.codec==="prores"&&(this.internalTrack.info.proresFormat==="ap4h"||this.internalTrack.info.proresFormat==="ap4x")}async getDecoderConfig(){return this.internalTrack.info.codec?this.decoderConfigPromise??(this.decoderConfigPromise=(async()=>{var n,o,a,c;let e=null;(this.internalTrack.info.codec==="vp9"||this.internalTrack.info.codec==="av1"||this.internalTrack.info.codec==="prores"||this.internalTrack.info.codec==="avc"&&!this.internalTrack.info.codecDescription||this.internalTrack.info.codec==="hevc"&&!this.internalTrack.info.codecDescription)&&(e=await this.getFirstPacket({}));let i={width:this.internalTrack.info.width,height:this.internalTrack.info.height,codec:this.internalTrack.info.codec,codecDescription:this.internalTrack.info.codecDescription,colorSpace:this.internalTrack.info.colorSpace,avcType:1,avcCodecInfo:this.internalTrack.info.codec==="avc"&&e?Sr(e.data):null,hevcCodecInfo:this.internalTrack.info.codec==="hevc"&&e?xr(e.data):null,vp9CodecInfo:this.internalTrack.info.codec==="vp9"&&e?Zi(e.data):null,av1CodecInfo:this.internalTrack.info.codec==="av1"&&e?si(e.data):null,proresCodecInfo:this.internalTrack.info.codec==="prores"&&e?Yi(e.data):null,proresFormat:this.internalTrack.info.proresFormat};if(!gr(this.internalTrack.info.colorSpace)){let l=rn(i);(n=this.internalTrack.info.colorSpace).primaries??(n.primaries=l.primaries),(o=this.internalTrack.info.colorSpace).transfer??(o.transfer=l.transfer),(a=this.internalTrack.info.colorSpace).matrix??(a.matrix=l.matrix),(c=this.internalTrack.info.colorSpace).fullRange??(c.fullRange=l.fullRange);}let s={codec:tn(i),codedWidth:this.internalTrack.info.width,codedHeight:this.internalTrack.info.height,description:this.internalTrack.info.codecDescription??void 0,colorSpace:this.internalTrack.info.colorSpace};return (this.internalTrack.info.width!==this.internalTrack.info.squarePixelWidth||this.internalTrack.info.height!==this.internalTrack.info.squarePixelHeight)&&(s.displayAspectWidth=this.internalTrack.info.squarePixelWidth,s.displayAspectHeight=this.internalTrack.info.squarePixelHeight),s})()):null}},xs=class extends kn{constructor(e){super(e),this.decoderConfigPromise=null,this.internalTrack=e;}getType(){return "audio"}getCodec(){return this.internalTrack.info.codec}getNumberOfChannels(){return this.internalTrack.info.numberOfChannels}getSampleRate(){return this.internalTrack.info.sampleRate}async getDecoderConfig(){return this.internalTrack.info.codec?this.decoderConfigPromise??(this.decoderConfigPromise=(async()=>{if(this.internalTrack.info.codec==="dts"&&!this.internalTrack.info.dtsFormat){let e=await this.getFirstPacket({});this.internalTrack.info.dtsFormat=e&&en(e.data);}return {codec:nn({codec:this.internalTrack.info.codec,codecDescription:this.internalTrack.info.codecDescription,aacCodecInfo:this.internalTrack.info.aacCodecInfo,dtsFormat:this.internalTrack.info.dtsFormat}),numberOfChannels:this.internalTrack.info.numberOfChannels,sampleRate:this.internalTrack.info.sampleRate,description:this.internalTrack.info.codecDescription??void 0}})()):null}};var ka=7,Sa=9,_s=t=>{let e=t.filePos,r=te(t,9),i=new ae(r);if(i.readBits(12)!==4095||(i.skipBits(1),i.readBits(2)!==0))return null;let o=i.readBits(1),a=i.readBits(2)+1,c=i.readBits(4);if(c===15)return null;i.skipBits(1);let l=i.readBits(3);if(l===0)throw new Error("ADTS frames with channel configuration 0 are not supported.");i.skipBits(1),i.skipBits(1),i.skipBits(1),i.skipBits(1);let u=i.readBits(13);i.skipBits(11);let d=i.readBits(2)+1;if(d!==1)throw new Error("ADTS frames with more than one AAC frame are not supported.");let f=null;return o===1?t.filePos-=2:f=i.readBits(16),{objectType:a,samplingFrequencyIndex:c,channelConfiguration:l,frameLength:u,numberOfAacFrames:d,crcCheck:f,startPos:e}};br();var Es=0,vs=1/0,ml=null;typeof FinalizationRegistry<"u"&&(ml=new FinalizationRegistry(t=>{t();}));var Qe=class extends He{constructor(){super(),this._disposed=!1,this._refCount=0,this._usedForHls=!1,this._refFinalizationRegistry=null,this._sizePromise=null,this.onread=null,typeof FinalizationRegistry<"u"&&(this._refFinalizationRegistry=new FinalizationRegistry(e=>{e._decrementRefCount();}));}async getSizeOrNull(){if(this._disposed)throw new ke;return this._sizePromise??(this._sizePromise=(async()=>{let e=this._getFileSize();return e!==void 0||(await this._read(0,1,Es,vs),e=this._getFileSize(),g(e!==void 0)),e})())}async getSize(){if(this._disposed)throw new ke;let e=await this.getSizeOrNull();if(e===null)throw new Error("Cannot determine the size of an unsized source.");return e}slice(e,r){if(!Number.isInteger(e)||e<0)throw new TypeError("offset must be a non-negative integer.");if(r!==void 0&&(!Number.isInteger(r)||r<0))throw new TypeError("length, when provided, must be a non-negative integer.");return new Sn(this,e,r)}_dispatchRead(e,r){this.onread?.(e,r),this._emit("read",{start:e,end:r});}ref(){return new er(this)}_incrementRefCount(){this._refCount++;}_decrementRefCount(){this._refCount--,this._refCount===0&&(this._dispose(),this._disposed=!0);}},er=class{constructor(e){if(this._freed=!1,e._disposed)throw new Error("Cannot ref a disposed source.");e._incrementRefCount(),e._refFinalizationRegistry?.register(this,e,this),this._source=e;}get source(){if(!this._source)throw new Error("Can't get source; ref has already been freed.");return this._source}get freed(){return this._freed}free(){if(this._freed)throw new Error("Illegal operation: double free on SourceRef.");let e=this.source;g(e._refCount>0),e._decrementRefCount(),e._refFinalizationRegistry?.unregister(this),this._freed=!0,this._source=null;}[Symbol.dispose](){this.freed||this.free();}},di=class extends Qe{constructor(e,r){if(typeof e!="string")throw new TypeError("rootPath must be a string.");if(typeof r!="function")throw new TypeError("requestHandler must be a function.");super(),this.rootPath=e,this.requestHandler=r;}_resolveRequest(e){let r=this.requestHandler(e),i=s=>{var o;if(!(s instanceof Qe||s instanceof er))throw new TypeError("requestHandler must return or resolve to a Source or SourceRef.");let n=s instanceof Qe?s.ref():s;return (o=n.source)._usedForHls||(o._usedForHls=this._usedForHls),n};return U(r)?r.then(i):i(r)}},Is=(t,e)=>t.path===e.path;var xa=typeof FinalizationRegistry<"u"?new FinalizationRegistry(t=>{t.cancel().catch(()=>{});}):null,fi=class extends Qe{constructor(e,r={}){if(!(e instanceof Blob))throw new TypeError("blob must be a Blob.");if(!r||typeof r!="object")throw new TypeError("options must be an object.");if(r.maxCacheSize!==void 0&&(!Nt(r.maxCacheSize)||r.maxCacheSize<0))throw new TypeError("options.maxCacheSize, when provided, must be a non-negative number.");if(r.useStreamReader!==void 0&&typeof r.useStreamReader!="boolean")throw new TypeError("options.useStreamReader, when provided, must be a boolean.");super(),this._readers=new WeakMap,this._blob=e,this._options=r,this._orchestrator=new Cs({maxCacheSize:r.maxCacheSize??8*2**20,maxWorkerCount:4,runWorker:this._runWorker.bind(this),onIdleWorkerRemoved:i=>{let s=this._readers.get(i);s&&(this._readers.delete(i),xa?.unregister(i),s.cancel().catch(()=>{}));},prefetchProfile:gl.fileSystem}),this._orchestrator.fileSize=e.size;}_getFileSize(){return this._orchestrator.fileSize}_read(e,r,i,s){return this._orchestrator.read(e,r,i,s)}async _runWorker(e){g(e.strictTarget);let r=this._readers.get(e);for(r===void 0&&("stream"in this._blob&&!xt()&&this._options.useStreamReader!==!1?(r=this._blob.slice(e.currentPos).stream().getReader(),xa?.register(e,r,e)):r=null,this._readers.set(e,r));e.currentPos<e.targetPos&&!e.aborted;)if(r){let{done:i,value:s}=await r.read();if(i)throw this._orchestrator.onWorkerFinished(e),new Error("Blob reader stopped unexpectedly before all requested data was read.");if(e.aborted)break;this._dispatchRead(e.currentPos,e.currentPos+s.length),this._orchestrator.supplyWorkerData(e,s);}else {let i=await this._blob.slice(e.currentPos,e.targetPos).arrayBuffer();if(e.aborted)break;this._dispatchRead(e.currentPos,e.currentPos+i.byteLength),this._orchestrator.supplyWorkerData(e,new Uint8Array(i));}this._orchestrator.signalWorkerStoppedRunning(e),e.aborted&&await r?.cancel();}_dispose(){this._orchestrator.dispose();}},pl=.5*2**20;var gl={none:(t,e)=>({start:t,end:e}),fileSystem:(t,e)=>(t=Math.floor((t-65536)/65536)*65536,e=Math.ceil((e+65536)/65536)*65536,{start:t,end:e}),network:(t,e,r)=>{t=Math.max(0,Math.floor((t-65536)/65536)*65536);for(let s of r){let o=Math.max((s.startPos+s.targetPos)/2,s.targetPos-8388608);if(zi(t,e,o,s.targetPos)){let a=s.targetPos-s.startPos,c=Math.ceil((a+1)/8388608)*8388608,l=2**Math.ceil(Math.log2(a+1)),u=Math.min(l,c);e=Math.max(e,s.startPos+u);}}return e=Math.max(e,t+pl),{start:t,end:e}}},Cs=class{constructor(e){this.options=e,this.fileSize=null,this.nextAge=0,this.workers=[],this.cache=[],this.currentCacheSize=0,this.disposed=!1,this.queuedReads=[];}read(e,r,i,s){g(!this.disposed);let n=this.options.prefetchProfile(e,r,this.workers),o=Math.max(n.start,i),a=Math.min(n.end,this.fileSize??1/0,s);g(o<=e&&r<=a);let c=null,l=ce(this.cache,e,v=>v.start),u=l!==-1?this.cache[l]:null;u&&u.start<=e&&r<=u.end&&(u.age=this.nextAge++,c={bytes:u.bytes,view:u.view,offset:u.start});let d=ce(this.cache,o,v=>v.start),f=c?null:new Uint8Array(r-e),m=0,p=o,b=[];if(d!==-1){for(let v=d;v<this.cache.length;v++){let F=this.cache[v];if(F.start>=a)break;if(F.end<=o)continue;let E=Math.max(o,F.start),k=Math.min(a,F.end);if(g(E<=k),p<E&&b.push({start:p,end:E}),p=k,f){let _=Math.max(e,F.start),B=Math.min(r,F.end);if(_<B){let z=_-e;f.set(F.bytes.subarray(_-F.start,B-F.start),z),z===m&&(m=B-e);}}F.age=this.nextAge++;}p<a&&b.push({start:p,end:a});}else b.push({start:o,end:a});if(f&&m>=f.length&&(c={bytes:f,view:ie(f),offset:e}),b.length===0)return g(c),c;let{promise:y,resolve:w,reject:A}=he(),T=[];for(let v of b){let F=Math.max(e,v.start),E=Math.min(r,v.end);F===v.start&&E===v.end?T.push(v):F<E&&T.push({start:F,end:E});}let I=f&&{start:e,bytes:f,holes:T,resolve:w,reject:A};e:for(let v of b){for(let k of this.workers)if(this.checkHoleAgainstWorker(k,v,I?[I]:[])){this.checkQueuedReadsAgainstWorker(k);continue e}let F=v.end<a||this.fileSize!==null,E=this.createWorker(v.start,v.end,F);if(E)I&&(E.pendingSlices=[I]),this.runWorker(E);else {let k=ce(this.queuedReads,v.start,B=>B.hole.start),_=k!==-1?this.queuedReads[k]:null;for(_&&v.start<=_.hole.end?(_.hole.end=Math.max(_.hole.end,v.end),_.strictTarget&&(_.strictTarget=F),I&&_.pendingSlices.push(I)):(k++,_={hole:{start:v.start,end:v.end},strictTarget:F,pendingSlices:I?[I]:[],age:this.nextAge++},this.queuedReads.splice(k,0,_));k+1<this.queuedReads.length;){let B=this.queuedReads[k+1];if(B.hole.start>_.hole.end)break;_.hole.end=Math.max(_.hole.end,B.hole.end),_.pendingSlices.push(...B.pendingSlices),_.strictTarget&&(_.strictTarget=B.strictTarget),_.age=Math.min(_.age,B.age),this.queuedReads.splice(k+1,1);}}}return c?y.catch(v=>{if(!this.disposed)throw v}):(g(f),c=y.then(v=>v&&{bytes:v,view:ie(v),offset:e})),c}checkHoleAgainstWorker(e,r,i){if(zi(r.start-131072,r.start,e.currentPos,e.targetPos)){e.targetPos=Math.max(e.targetPos,r.end);for(let n=0;n<i.length;n++){let o=i[n];e.pendingSlices.includes(o)||e.pendingSlices.push(o);}return e.running||this.runWorker(e),!0}return !1}checkQueuedReadsAgainstWorker(e){let r=!1;for(let i=0;i<this.queuedReads.length;i++){let s=this.queuedReads[i];if(this.checkHoleAgainstWorker(e,s.hole,s.pendingSlices))this.queuedReads.splice(i,1),i--,r=!0;else if(r)break}}createWorker(e,r,i){if(this.workers.length>=this.options.maxWorkerCount){let n=null,o=null;for(let a=0;a<this.workers.length;a++){let c=this.workers[a];!c.running&&c.pendingSlices.length===0&&(!n||c.age<n.age)&&(o=a,n=c);}if(n)g(o!==null),g(n.pendingSlices.length===0),this.workers.splice(o,1),this.options.onIdleWorkerRemoved?.(n);else return null}let s={startPos:e,currentPos:e,targetPos:r,strictTarget:i,running:!1,aborted:this.disposed,pendingSlices:[],age:this.nextAge++};return this.workers.push(s),s}runWorker(e){g(!e.running),g(e.currentPos<e.targetPos),e.running=!0,e.age=this.nextAge++,this.options.runWorker(e).catch(r=>{if(e.running=!1,e.pendingSlices.length>0)e.pendingSlices.forEach(i=>i.reject(r)),e.pendingSlices.length=0;else if(!e.aborted&&!this.disposed)throw r}).finally(()=>{if(!e.running&&this.queuedReads.length>0){let r=0;for(let n=1;n<this.queuedReads.length;n++)this.queuedReads[n].age<this.queuedReads[r].age&&(r=n);let i=this.queuedReads[r],s=this.createWorker(i.hole.start,i.hole.end,i.strictTarget);if(!s)return;this.queuedReads.splice(r,1),s.pendingSlices=i.pendingSlices,this.runWorker(s);}});}supplyWorkerData(e,r){g(!e.aborted);let i=e.currentPos,s=i+r.length;this.insertIntoCache({start:i,end:s,bytes:r,view:ie(r),age:this.nextAge++}),e.currentPos+=r.length,e.currentPos>e.targetPos&&(e.targetPos=e.currentPos,this.checkQueuedReadsAgainstWorker(e));for(let n=0;n<e.pendingSlices.length;n++){let o=e.pendingSlices[n],a=Math.max(i,o.start),c=Math.min(s,o.start+o.bytes.length);a<c&&o.bytes.set(r.subarray(a-i,c-i),a-o.start);for(let l=0;l<o.holes.length;l++){let u=o.holes[l];i<=u.start&&s>u.start&&(u.start=s),u.end<=u.start&&(o.holes.splice(l,1),l--);}o.holes.length===0&&(o.resolve(o.bytes),e.pendingSlices.splice(n,1),n--);}for(let n=0;n<this.workers.length;n++){let o=this.workers[n];e===o||o.running||zi(i,s,o.currentPos,o.targetPos)&&(this.workers.splice(n,1),this.options.onIdleWorkerRemoved?.(o),n--);}}supplyFileSize(e){g(this.fileSize===null),this.fileSize=e;for(let r of this.workers){r.targetPos=Math.min(r.targetPos,e),r.strictTarget=!0;for(let i=0;i<r.pendingSlices.length;i++){let s=r.pendingSlices[i];for(let n of s.holes)if(n.end>e){s.resolve(null),r.pendingSlices.splice(i,1),i--;break}}}for(let r=0;r<this.queuedReads.length;r++){let i=this.queuedReads[r];if(i.hole.start>=e){for(let s of i.pendingSlices)s.resolve(null);this.queuedReads.splice(r,1),r--;}else if(i.hole.end>e){i.hole.end=e,i.strictTarget=!0;for(let s=0;s<i.pendingSlices.length;s++){let n=i.pendingSlices[s];n.start>=e&&(n.resolve(null),i.pendingSlices.splice(s,1),s--);}}}}signalWorkerStoppedRunning(e){e.running=!1,e.aborted||(e.pendingSlices.length=0);}onWorkerFinished(e){let r=this.workers.indexOf(e);g(r!==-1),e.running=!1,this.workers.splice(r,1),this.options.onIdleWorkerRemoved?.(e),this.fileSize===null&&this.supplyFileSize(e.currentPos);for(let i of e.pendingSlices)i.resolve(null);}insertIntoCache(e){if(this.options.maxCacheSize===0)return;let r=ce(this.cache,e.start,i=>i.start)+1;if(r>0){let i=this.cache[r-1];if(i.end>=e.end)return;if(i.end>e.start){let s=new Uint8Array(e.end-i.start);s.set(i.bytes,0),s.set(e.bytes,e.start-i.start),this.currentCacheSize+=e.end-i.end,i.bytes=s,i.view=ie(s),i.end=e.end,r--,e=i;}else this.cache.splice(r,0,e),this.currentCacheSize+=e.bytes.length;}else this.cache.splice(r,0,e),this.currentCacheSize+=e.bytes.length;for(let i=r+1;i<this.cache.length;i++){let s=this.cache[i];if(e.end<=s.start)break;if(e.end>=s.end){this.cache.splice(i,1),this.currentCacheSize-=s.bytes.length,i--;continue}let n=new Uint8Array(s.end-e.start);n.set(e.bytes,0),n.set(s.bytes,s.start-e.start),this.currentCacheSize-=e.end-s.start,e.bytes=n,e.view=ie(n),e.end=s.end,this.cache.splice(i,1);break}for(;this.currentCacheSize>this.options.maxCacheSize;){let i=0,s=this.cache[0];for(let n=1;n<this.cache.length;n++){let o=this.cache[n];o.age<s.age&&(i=n,s=o);}if(this.currentCacheSize-s.bytes.length<=this.options.maxCacheSize)break;this.cache.splice(i,1),this.currentCacheSize-=s.bytes.length;}}dispose(){for(let e of this.workers){for(let r of e.pendingSlices)r.reject(new ke);e.pendingSlices.length=0,e.aborted=!0,e.running||this.options.onIdleWorkerRemoved?.(e);}for(let e of this.queuedReads)for(let r of e.pendingSlices)r.reject(new ke);this.workers.length=0,this.cache.length=0,this.queuedReads.length=0,this.disposed=!0;}};var Sn=class extends Qe{constructor(e,r,i){if(super(),this._ref=null,e._disposed)throw new Error("Cannot create a slice of a disposed source.");this._baseSource=e,this._offset=r,this._length=i??null;}_getFileSize(){let e=this._baseSource._getFileSize();return e===void 0?this._length!==null?this._length:void 0:e===null?this._length!==null?this._length:null:ue(e-this._offset,0,this._length??1/0)}_read(e,r,i,s){if(this._length!==null&&r>this._length)return null;let n=this._baseSource._read(this._offset+e,this._offset+r,this._offset+i,this._offset+s),o=a=>a?(a.offset-=this._offset,a):null;return U(n)?n.then(o):o(n)}_dispose(){this._ref?.free();}ref(){return this._ref??(this._ref=this._baseSource.ref()),super.ref()}};var tr=class{constructor(){this._isIsobmff=!1;}},hi=class extends tr{constructor(){super(...arguments),this._isIsobmff=!0;}async _getMajorBrand(e){let r=e._reader.requestSlice(0,12);if(U(r)&&(r=await r),!r)return null;r.skip(4);let i=Ue(r,4);return i!=="ftyp"&&i!=="styp"?null:Ue(r,4)}_createDemuxer(e){return new fn(e)}},mi=class extends hi{async _canReadInput(e){let r=await this._getMajorBrand(e);if(r!==null)return r!=="qt  ";let i=0;for(let s=0;s<10;s++){let n=e._reader.requestSlice(i,8);if(U(n)&&(n=await n),!n)return !1;let o=O(n),a=8;if(o===1){let l=e._reader.requestSlice(i+8,8);if(U(l)&&(l=await l),!l)return !1;o=Re(l),a=16;}if(o<a)return !1;let c=Ue(n,4);if(c==="moof"||c==="sidx")return !0;if(c==="emsg"||c==="prft"||c==="free")i+=o;else return !1}return !1}get name(){return "MP4"}get mimeType(){return "video/mp4"}},pi=class extends hi{async _canReadInput(e){return await this._getMajorBrand(e)==="qt  "}get name(){return "QuickTime File Format"}get mimeType(){return "video/quicktime"}},Mr=class extends tr{async isSupportedEBMLOfDocType(e,r){let i=e._reader.requestSlice(0,et);if(U(i)&&(i=await i),!i)return !1;let s=bs(i);if(s===null||s<1||s>8||J(i,s)!==x.EBML)return !1;let o=As(i);if(typeof o!="number")return !1;let a=e._reader.requestSlice(i.filePos,o);if(U(a)&&(a=await a),!a)return !1;let c=i.filePos;for(;a.filePos<=c+o-Ne;){let l=tt(a);if(!l)break;let{id:u,size:d}=l,f=a.filePos;if(d===void 0)return !1;switch(u){case x.EBMLVersion:if(J(a,d)!==1)return !1;break;case x.EBMLReadVersion:if(J(a,d)!==1)return !1;break;case x.DocType:if(Qt(a,d)!==r)return !1;break;case x.DocTypeVersion:if(J(a,d)>4)return !1;break}a.filePos=f+d;}return !0}_canReadInput(e){return this.isSupportedEBMLOfDocType(e,"matroska")}_createDemuxer(e){return new Tn(e)}get name(){return "Matroska"}get mimeType(){return "video/x-matroska"}},gi=class extends Mr{_canReadInput(e){return this.isSupportedEBMLOfDocType(e,"webm")}get name(){return "WebM"}get mimeType(){return "video/webm"}};var _a=(t,e)=>{if(!t||typeof t!="object")throw new TypeError(`${e}, when provided, must be an object.`);if(t.isobmff!==void 0){if(!t.isobmff||typeof t.isobmff!="object")throw new TypeError(`${e}.isobmff, when provided, must be an object.`);if(t.isobmff.resolveKeyId!==void 0&&typeof t.isobmff.resolveKeyId!="function")throw new TypeError(`${e}.isobmff.resolveKeyId, when provided, must be a function.`)}if(t.hls!==void 0){if(!t.hls||typeof t.hls!="object")throw new TypeError(`${e}.hls, when provided, must be an object.`);if(t.hls.offsetTimestampsByDateTime!==void 0&&typeof t.hls.offsetTimestampsByDateTime!="boolean")throw new TypeError(`${e}.hls.offsetTimestampsByDateTime, when provided, must be a boolean.`)}};var wl=function(t,e,r){if(e!=null){if(typeof e!="object"&&typeof e!="function")throw new TypeError("Object expected.");var i,s;if(r){if(!Symbol.asyncDispose)throw new TypeError("Symbol.asyncDispose is not defined.");i=e[Symbol.asyncDispose];}if(i===void 0){if(!Symbol.dispose)throw new TypeError("Symbol.dispose is not defined.");i=e[Symbol.dispose],r&&(s=i);}if(typeof i!="function")throw new TypeError("Object not disposable.");s&&(i=function(){try{s.call(this);}catch(n){return Promise.reject(n)}}),t.stack.push({value:e,dispose:i,async:r});}else r&&t.stack.push({async:!0});return e},yl=(function(t){return function(e){function r(o){e.error=e.hasError?new t(o,e.error,"An error was suppressed during disposal."):o,e.hasError=!0;}var i,s=0;function n(){for(;i=e.stack.pop();)try{if(!i.async&&s===1)return s=0,e.stack.push(i),Promise.resolve().then(n);if(i.dispose){var o=i.dispose.call(i.value);if(i.async)return s|=2,Promise.resolve(o).then(n,function(a){return r(a),n()})}else s|=1;}catch(a){r(a);}if(s===1)return e.hasError?Promise.reject(e.error):Promise.resolve();if(e.hasError)throw e.error}return n()}})(typeof SuppressedError=="function"?SuppressedError:function(t,e,r){var i=new Error(r);return i.name="SuppressedError",i.error=t,i.suppressed=e,i});br();var Ca=-1/0,Ea=-1/0,Ti=null;typeof FinalizationRegistry<"u"&&(Ti=new FinalizationRegistry(t=>{let e=performance.now();t.type==="video"?(e-Ca>=1e3&&(K._error("A VideoSample was garbage collected without first being closed. For proper resource management, make sure to call close() on all your VideoSamples as soon as you're done using them."),Ca=e),typeof VideoFrame<"u"&&t.data instanceof VideoFrame&&t.data.close()):(e-Ea>=1e3&&(K._error("An AudioSample was garbage collected without first being closed. For proper resource management, make sure to call close() on all your AudioSamples as soon as you're done using them."),Ea=e),typeof AudioData<"u"&&t.data instanceof AudioData&&t.data.close());}));var Mt=class{constructor(){this._referenceCount=0,this._lastAllocationBuffer=null;}},Ps=["I420","I420P10","I420P12","I420A","I420AP10","I420AP12","I422","I422P10","I422P12","I422A","I422AP10","I422AP12","I444","I444P10","I444P12","I444A","I444AP10","I444AP12","NV12","RGBA","RGBX","BGRA","BGRX"],bl=new Set(Ps),Ke=class t{get codedWidth(){return this.visibleRect.width}get codedHeight(){return this.visibleRect.height}get displayWidth(){return this.rotation%180===0?this.squarePixelWidth:this.squarePixelHeight}get displayHeight(){return this.rotation%180===0?this.squarePixelHeight:this.squarePixelWidth}get microsecondTimestamp(){return Math.trunc(lt*this.timestamp)}get microsecondDuration(){return Math.trunc(lt*this.duration)}get hasAlpha(){return this.format&&this.format.includes("A")}constructor(e,r){if(this._closed=!1,e instanceof ArrayBuffer||typeof SharedArrayBuffer<"u"&&e instanceof SharedArrayBuffer||ArrayBuffer.isView(e)){if(!r||typeof r!="object")throw new TypeError("init must be an object.");if(r.format===void 0||!bl.has(r.format))throw new TypeError("init.format must be one of: "+Ps.join(", "));if(!Number.isInteger(r.codedWidth)||r.codedWidth<=0)throw new TypeError("init.codedWidth must be a positive integer.");if(!Number.isInteger(r.codedHeight)||r.codedHeight<=0)throw new TypeError("init.codedHeight must be a positive integer.");if(r.rotation!==void 0&&![0,90,180,270].includes(r.rotation))throw new TypeError("init.rotation, when provided, must be 0, 90, 180, or 270.");if(!Number.isFinite(r.timestamp))throw new TypeError("init.timestamp must be a number.");if(r.duration!==void 0&&(!Number.isFinite(r.duration)||r.duration<0))throw new TypeError("init.duration, when provided, must be a non-negative number.");if(r.layout!==void 0){if(!Array.isArray(r.layout))throw new TypeError("init.layout, when provided, must be an array.");for(let n of r.layout){if(!n||typeof n!="object"||Array.isArray(n))throw new TypeError("Each entry in init.layout must be an object.");if(!Number.isInteger(n.offset)||n.offset<0)throw new TypeError("plane.offset must be a non-negative integer.");if(!Number.isInteger(n.stride)||n.stride<0)throw new TypeError("plane.stride must be a non-negative integer.")}}if(r.visibleRect!==void 0&&Ni(r.visibleRect,"init.visibleRect"),r.displayWidth!==void 0&&(!Number.isInteger(r.displayWidth)||r.displayWidth<=0))throw new TypeError("init.displayWidth, when provided, must be a positive integer.");if(r.displayHeight!==void 0&&(!Number.isInteger(r.displayHeight)||r.displayHeight<=0))throw new TypeError("init.displayHeight, when provided, must be a positive integer.");if(r.displayWidth!==void 0!=(r.displayHeight!==void 0))throw new TypeError("init.displayWidth and init.displayHeight must be either both provided or both omitted.");this.format=r.format,this.rotation=r.rotation??0,this.timestamp=r.timestamp,this.duration=r.duration??0;let i=r.layout??kl(r.format,r.codedWidth,r.codedHeight),s=r.colorSpace??null;s===null&&(this.format==="RGBA"||this.format==="RGBX"||this.format==="BGRA"||this.format==="BGRX"?s={primaries:"bt709",transfer:"iec61966-2-1",matrix:"rgb",fullRange:!0}:s={primaries:"bt709",transfer:"bt709",matrix:"bt709",fullRange:!1}),this.visibleRect={left:r.visibleRect?.left??0,top:r.visibleRect?.top??0,width:r.visibleRect?.width??r.codedWidth,height:r.visibleRect?.height??r.codedHeight},r.displayWidth!==void 0?(this.squarePixelWidth=this.rotation%180===0?r.displayWidth:r.displayHeight,this.squarePixelHeight=this.rotation%180===0?r.displayHeight:r.displayWidth):(this.squarePixelWidth=this.visibleRect.width,this.squarePixelHeight=this.visibleRect.height),this._data=r._doNotCopy?Te(e):Te(e).slice(),this._layout=i,this.colorSpace=new Ai(s);}else if(typeof VideoFrame<"u"&&e instanceof VideoFrame){if(r?.rotation!==void 0&&![0,90,180,270].includes(r.rotation))throw new TypeError("init.rotation, when provided, must be 0, 90, 180, or 270.");if(r?.timestamp!==void 0&&!Number.isFinite(r?.timestamp))throw new TypeError("init.timestamp, when provided, must be a number.");if(r?.duration!==void 0&&(!Number.isFinite(r.duration)||r.duration<0))throw new TypeError("init.duration, when provided, must be a non-negative number.");r?.visibleRect!==void 0&&Ni(r.visibleRect,"init.visibleRect"),this._data=e,this._layout=null,this.format=e.format,this.visibleRect={left:e.visibleRect?.x??0,top:e.visibleRect?.y??0,width:e.visibleRect?.width??e.codedWidth,height:e.visibleRect?.height??e.codedHeight},this.rotation=r?.rotation??0,this.squarePixelWidth=e.displayWidth,this.squarePixelHeight=e.displayHeight,this.timestamp=r?.timestamp??e.timestamp/1e6,this.duration=r?.duration??(e.duration??0)/1e6,this.colorSpace=new Ai(e.colorSpace);}else if(typeof HTMLImageElement<"u"&&e instanceof HTMLImageElement||typeof SVGImageElement<"u"&&e instanceof SVGImageElement||typeof ImageBitmap<"u"&&e instanceof ImageBitmap||typeof HTMLVideoElement<"u"&&e instanceof HTMLVideoElement||typeof HTMLCanvasElement<"u"&&e instanceof HTMLCanvasElement||typeof OffscreenCanvas<"u"&&e instanceof OffscreenCanvas){if(!r||typeof r!="object")throw new TypeError("init must be an object.");if(r.rotation!==void 0&&![0,90,180,270].includes(r.rotation))throw new TypeError("init.rotation, when provided, must be 0, 90, 180, or 270.");if(!Number.isFinite(r.timestamp))throw new TypeError("init.timestamp must be a number.");if(r.duration!==void 0&&(!Number.isFinite(r.duration)||r.duration<0))throw new TypeError("init.duration, when provided, must be a non-negative number.");if(r.visibleRect!==void 0&&Ni(r.visibleRect,"init.visibleRect"),typeof VideoFrame<"u")return new t(new VideoFrame(e,{timestamp:Math.trunc(r.timestamp*lt),duration:Math.trunc((r.duration??0)*lt)||void 0,visibleRect:r.visibleRect&&{x:r.visibleRect.left,y:r.visibleRect.top,width:r.visibleRect.width,height:r.visibleRect.height}}),r);let i=0,s=0;if("naturalWidth"in e?(i=e.naturalWidth,s=e.naturalHeight):"videoWidth"in e?(i=e.videoWidth,s=e.videoHeight):"width"in e&&(i=Number(e.width),s=Number(e.height)),!i||!s)throw new TypeError("Could not determine dimensions.");let n=r.visibleRect??{left:0,top:0,width:i,height:s},o=new OffscreenCanvas(n.width,n.height),a=o.getContext("2d",{alpha:Xr(),willReadFrequently:!0});if(!a)throw new Error("OffscreenCanvas must have support for the '2d' context in order to create a VideoSample from this data.");a.drawImage(e,-n.left,-n.top),this._data=o,this._layout=null,this.format="RGBX",this.visibleRect={left:0,top:0,width:n.width,height:n.height},this.squarePixelWidth=n.width,this.squarePixelHeight=n.height,this.rotation=r.rotation??0,this.timestamp=r.timestamp,this.duration=r.duration??0,this.colorSpace=new Ai({matrix:"rgb",primaries:"bt709",transfer:"iec61966-2-1",fullRange:!0});}else if(e instanceof Mt){if(!r||typeof r!="object")throw new TypeError("init must be an object.");if(r.rotation!==void 0&&![0,90,180,270].includes(r.rotation))throw new TypeError("init.rotation, when provided, must be 0, 90, 180, or 270.");if(!Number.isFinite(r.timestamp))throw new TypeError("init.timestamp must be a number.");if(r.duration!==void 0&&(!Number.isFinite(r.duration)||r.duration<0))throw new TypeError("init.duration, when provided, must be a non-negative number.");if(this._data=e,e._referenceCount++,this.format=e.getFormat(),this.format!==null&&!Ps.includes(this.format))throw new TypeError("getFormat() must return a VideoSamplePixelFormat or null.");if(this.visibleRect={left:0,top:0,width:e.getCodedWidth(),height:e.getCodedHeight()},!Number.isInteger(this.visibleRect.width)||this.visibleRect.width<=0)throw new TypeError("getCodedWidth() must return a positive integer.");if(!Number.isInteger(this.visibleRect.height)||this.visibleRect.height<=0)throw new TypeError("getCodedHeight() must return a positive integer.");if(this.squarePixelWidth=e.getSquarePixelWidth(),!Number.isInteger(this.squarePixelWidth)||this.squarePixelWidth<=0)throw new TypeError("getSquarePixelWidth() must return a positive integer.");if(this.squarePixelHeight=e.getSquarePixelHeight(),!Number.isInteger(this.squarePixelHeight)||this.squarePixelHeight<=0)throw new TypeError("getSquarePixelHeight() must return a positive integer.");this.rotation=r.rotation??0,this.timestamp=r.timestamp,this.duration=r.duration??0,this.colorSpace=e.getColorSpace();}else throw new TypeError("Invalid data type: Must be a BufferSource, CanvasImageSource, or VideoSampleResource.");this.encodeOptions=r?.encodeOptions??{},this.pixelAspectRatio=Wt({num:this.squarePixelWidth*this.codedHeight,den:this.squarePixelHeight*this.codedWidth}),Ti?.register(this,{type:"video",data:this._data},this);}clone(){if(this._closed)throw new Error("VideoSample is closed.");return g(this._data!==null),this._data instanceof Mt?new t(this._data,{timestamp:this.timestamp,duration:this.duration,rotation:this.rotation,encodeOptions:this.encodeOptions}):yi(this._data)?new t(this._data.clone(),{timestamp:this.timestamp,duration:this.duration,rotation:this.rotation,encodeOptions:this.encodeOptions}):this._data instanceof Uint8Array?(g(this._layout),new t(this._data,{format:this.format,layout:this._layout,codedWidth:this.codedWidth,codedHeight:this.codedHeight,timestamp:this.timestamp,duration:this.duration,colorSpace:this.colorSpace,rotation:this.rotation,visibleRect:this.visibleRect,displayWidth:this.displayWidth,displayHeight:this.displayHeight,encodeOptions:this.encodeOptions,_doNotCopy:!0})):new t(this._data,{format:this.format,codedWidth:this.codedWidth,codedHeight:this.codedHeight,timestamp:this.timestamp,duration:this.duration,colorSpace:this.colorSpace,rotation:this.rotation,visibleRect:this.visibleRect,displayWidth:this.displayWidth,displayHeight:this.displayHeight,encodeOptions:this.encodeOptions})}close(){this._closed||(Ti?.unregister(this),this._data instanceof Mt?(this._data._referenceCount--,this._data._referenceCount===0&&this._data.close()):yi(this._data)?this._data.close():this._data=null,this._closed=!0);}allocationSize(e={}){if(Pa(e),this._closed)throw new Error("VideoSample is closed.");if((e.format??this.format)==null)throw new Error("Cannot get allocation size when format is null.");return yi(this._data)?this._data.allocationSize(e):Ra(this,e).allocationSize}async copyTo(e,r={}){if(!wr(e))throw new TypeError("destination must be an ArrayBuffer or an ArrayBuffer view.");if(Pa(r),this._closed)throw new Error("VideoSample is closed.");if((r.format??this.format)==null)throw new Error("Cannot copy video sample data when format is null.");if(g(this._data!==null),yi(this._data))return this._data.copyTo(e,r);if(r.format&&!["RGBA","RGBX","BGRA","BGRX"].includes(this.format)&&["RGBA","RGBX","BGRA","BGRX"].includes(r.format))if(this._data instanceof Mt){let l={stack:[],error:void 0,hasError:!1};try{let u=wl(l,await this._data.toRgbSample({timestamp:this.timestamp,duration:this.duration,rotation:this.rotation},r.colorSpace??"srgb"),!1);if(!(u instanceof t))throw new TypeError("toRgbSample() must return a VideoSample.");if(!["RGBA","RGBX","BGRA","BGRX"].includes(u.format))throw new Error(`Sample returned by toRgbSample was expected to have an RGB format, got '${u.format}' instead.`);return await u.copyTo(e,r)}catch(u){l.error=u,l.hasError=!0;}finally{yl(l);}}else {if(typeof VideoFrame>"u")throw new Error("For this sample, converting from a non-RGB to an RGB format requires VideoFrame to be defined.");let l=this.toVideoFrame(),u=await l.copyTo(e,r);return l.close(),u}let i=Ra(this,r);g(this.format);let s=Te(e);if(s.byteLength<i.allocationSize)throw new TypeError(`Destination buffer too small. Required: ${i.allocationSize}, Available: ${s.byteLength}`);let n=_n(this.format),o;if(this._data instanceof Mt){let l=this._data.getDataPlanes();if(U(l)&&(l=await l),!Array.isArray(l)||l.some(u=>!(u.data instanceof Uint8Array)||!Number.isInteger(u.stride)||u.stride<0))throw new TypeError('getDataPlanes() must return an array of objects with a Uint8Array "data" property and a non-negative integer "stride" property.');o=l;}else if(this._data instanceof Uint8Array)g(this._layout),g(this._layout.length===n.length),o=this._layout.map((l,u)=>{let d=Math.ceil(this.codedHeight/n[u].heightDivisor);return {data:this._data.subarray(l.offset,l.offset+l.stride*d),stride:l.stride}});else {let u=this._data.getContext("2d");g(u);let d=u.getImageData(0,0,this.codedWidth,this.codedHeight);o=[{data:Te(d.data),stride:4*this.codedWidth}];}let a=[],c=n.length;for(let l=0;l<c;l++){let u=i.computedLayouts[l],d=o[l].stride,f=o[l].data,m=u.sourceTop*d;m+=u.sourceLeftBytes;let p=u.destinationOffset,b=u.sourceWidthBytes,y={offset:p,stride:u.destinationStride};for(let w=0;w<u.sourceHeight;w++){if(m+b>f.byteLength)throw new Error("Source buffer OOB read.");if(p+b>s.byteLength)throw new Error("Destination buffer OOB write.");let A=f.subarray(m,m+b);s.set(A,p),m+=d,p+=u.destinationStride;}a.push(y);}if(r.format!==void 0){let l=this.format.startsWith("RGB")!==r.format.startsWith("RGB"),u=this.format.includes("X")&&r.format.includes("A");if(l||u)for(let d=0;d<i.allocationSize;d+=4){if(l){let f=s[d],m=s[d+2];s[d]=m,s[d+2]=f;}u&&(s[d+3]=255);}}return a}toVideoFrame(){if(this._closed)throw new Error("VideoSample is closed.");if(g(this._data!==null),this._data instanceof Mt){if(this.format===null)throw new Error("Cannot convert a VideoSampleResource-backed VideoSample to VideoFrame if format is null.");let e=this._data.getDataPlanes();if(U(e))throw new Error("Cannot convert a VideoSampleResource-backed VideoSample to VideoFrame if getDataPlanes() returns a promise.");let r=e.reduce((o,a)=>o+a.data.byteLength,0),i=new Uint8Array(r),s=0,n=[];for(let o of e)i.set(o.data,s),n.push(s),s+=o.data.byteLength;return new VideoFrame(i,{format:this.format,layout:e.map((o,a)=>({offset:n[a],stride:o.stride})),codedWidth:this.codedWidth,codedHeight:this.codedHeight,timestamp:this.microsecondTimestamp,duration:this.microsecondDuration,colorSpace:this.colorSpace,visibleRect:this.visibleRect,displayWidth:this.squarePixelWidth,displayHeight:this.squarePixelHeight})}else return yi(this._data)?new VideoFrame(this._data,{timestamp:this.microsecondTimestamp,duration:this.microsecondDuration||void 0}):this._data instanceof Uint8Array?(g(this._layout),new VideoFrame(this._data,{format:this.format,codedWidth:this.codedWidth,codedHeight:this.codedHeight,layout:this._layout,timestamp:this.microsecondTimestamp,duration:this.microsecondDuration||void 0,colorSpace:this.colorSpace,visibleRect:this.visibleRect,displayWidth:this.squarePixelWidth,displayHeight:this.squarePixelHeight})):new VideoFrame(this._data,{timestamp:this.microsecondTimestamp,duration:this.microsecondDuration||void 0})}draw(e,r,i,s,n,o,a,c,l){let u=0,d=0,f=this.displayWidth,m=this.displayHeight,p=0,b=0,y=this.displayWidth,w=this.displayHeight;if(o!==void 0?(u=r,d=i,f=s,m=n,p=o,b=a,c!==void 0?(y=c,w=l):(y=f,w=m)):(p=r,b=i,s!==void 0&&(y=s,w=n)),!(typeof CanvasRenderingContext2D<"u"&&e instanceof CanvasRenderingContext2D||typeof OffscreenCanvasRenderingContext2D<"u"&&e instanceof OffscreenCanvasRenderingContext2D))throw new TypeError("context must be a CanvasRenderingContext2D or OffscreenCanvasRenderingContext2D.");if(!Number.isFinite(u))throw new TypeError("sx must be a number.");if(!Number.isFinite(d))throw new TypeError("sy must be a number.");if(!Number.isFinite(f)||f<0)throw new TypeError("sWidth must be a non-negative number.");if(!Number.isFinite(m)||m<0)throw new TypeError("sHeight must be a non-negative number.");if(!Number.isFinite(p))throw new TypeError("dx must be a number.");if(!Number.isFinite(b))throw new TypeError("dy must be a number.");if(!Number.isFinite(y)||y<0)throw new TypeError("dWidth must be a non-negative number.");if(!Number.isFinite(w)||w<0)throw new TypeError("dHeight must be a non-negative number.");if(this._closed)throw new Error("VideoSample is closed.");({sx:u,sy:d,sWidth:f,sHeight:m}=this._rotateSourceRegion(u,d,f,m,this.rotation));let A=this.toCanvasImageSource();e.save();let T=p+y/2,I=b+w/2;e.translate(T,I),e.rotate(this.rotation*Math.PI/180);let v=this.rotation%180===0?1:y/w;e.scale(1/v,v),e.drawImage(A,u,d,f,m,-y/2,-w/2,y,w),e.restore();}drawWithFit(e,r){if(!(typeof CanvasRenderingContext2D<"u"&&e instanceof CanvasRenderingContext2D||typeof OffscreenCanvasRenderingContext2D<"u"&&e instanceof OffscreenCanvasRenderingContext2D))throw new TypeError("context must be a CanvasRenderingContext2D or OffscreenCanvasRenderingContext2D.");if(!r||typeof r!="object")throw new TypeError("options must be an object.");if(!["fill","contain","cover"].includes(r.fit))throw new TypeError("options.fit must be 'fill', 'contain', or 'cover'.");if(r.rotation!==void 0&&![0,90,180,270].includes(r.rotation))throw new TypeError("options.rotation, when provided, must be 0, 90, 180, or 270.");r.crop!==void 0&&nr(r.crop,"options.");let i=e.canvas.width,s=e.canvas.height,n=r.rotation??this.rotation,[o,a]=n%180===0?[this.squarePixelWidth,this.squarePixelHeight]:[this.squarePixelHeight,this.squarePixelWidth],c=r.crop;c&&(c=ki(c,o,a));let l,u,d,f,{sx:m,sy:p,sWidth:b,sHeight:y}=this._rotateSourceRegion(r.crop?.left??0,r.crop?.top??0,r.crop?.width??o,r.crop?.height??a,n);if(r.fit==="fill")l=0,u=0,d=i,f=s;else {let[A,T]=r.crop?[r.crop.width,r.crop.height]:[o,a],I=r.fit==="contain"?Math.min(i/A,s/T):Math.max(i/A,s/T);d=A*I,f=T*I,l=(i-d)/2,u=(s-f)/2;}e.save();let w=n%180===0?1:d/f;e.translate(i/2,s/2),e.rotate(n*Math.PI/180),e.scale(1/w,w),e.translate(-i/2,-s/2),e.drawImage(this.toCanvasImageSource(),m,p,b,y,l,u,d,f),e.restore();}_rotateSourceRegion(e,r,i,s,n){return n===90?[e,r,i,s]=[r,this.squarePixelHeight-e-i,s,i]:n===180?[e,r]=[this.squarePixelWidth-e-i,this.squarePixelHeight-r-s]:n===270&&([e,r,i,s]=[this.squarePixelWidth-r-s,e,s,i]),{sx:e,sy:r,sWidth:i,sHeight:s}}_drawWithFitAndMipmapping(e,r,i){let s=e.width,n=e.height,[o,a]=i.rotation%180===0?[this.squarePixelWidth,this.squarePixelHeight]:[this.squarePixelHeight,this.squarePixelWidth],c=i.crop?i.crop.width:o,l=i.crop?i.crop.height:a,u=0;2*s<c&&2*n<l&&(u=Math.floor(Math.log2(Math.min(c/s,l/n))));let d=s*2**u,f=n*2**u,{canvas:m,context:p,isNew:b}=u>0?Ia(d,f):{canvas:e,context:r,isNew:i.targetIsFresh};p.imageSmoothingQuality="high",i.fillBlack?(p.fillStyle="black",p.fillRect(0,0,d,f)):b||p.clearRect(0,0,d,f),this.drawWithFit(p,{fit:i.fit,rotation:i.rotation,crop:i.crop}),p.globalCompositeOperation="copy";for(let y=u;y>1;y--){let w=s*2**y,A=n*2**y;p.drawImage(m,0,0,w,A,0,0,w/2,A/2);}p.globalCompositeOperation="source-over",u>0&&(r.imageSmoothingQuality="high",r.globalCompositeOperation="copy",r.drawImage(m,0,0,2*s,2*n,0,0,s,n),r.globalCompositeOperation="source-over");}toCanvasImageSource(){if(this._closed)throw new Error("VideoSample is closed.");if(g(this._data!==null),this._data instanceof Mt||this._data instanceof Uint8Array){let e=this.toVideoFrame();return queueMicrotask(()=>e.close()),e}else return this._data}async transform(e){if(!e||typeof e!="object")throw new TypeError("options must be an object.");if(e.width!==void 0&&(!Number.isInteger(e.width)||e.width<=0))throw new TypeError("options.width, when provided, must be a positive integer.");if(e.height!==void 0&&(!Number.isInteger(e.height)||e.height<=0))throw new TypeError("options.height, when provided, must be a positive integer.");if(e.roundDimensionsTo!==void 0&&(!Number.isInteger(e.roundDimensionsTo)||e.roundDimensionsTo<=0))throw new TypeError("options.roundDimensionsTo, when provided, must be a positive integer.");if(e.fit!==void 0&&!["fill","contain","cover"].includes(e.fit))throw new TypeError('options.fit, when provided, must be one of "fill", "contain", or "cover".');if(e.width!==void 0&&e.height!==void 0&&e.fit===void 0)throw new TypeError("When both options.width and options.height are provided, options.fit must also be provided.");if(e.rotate!==void 0&&![0,90,180,270].includes(e.rotate))throw new TypeError("options.rotate, when provided, must be 0, 90, 180 or 270.");if(e.crop!==void 0&&nr(e.crop,"options."),e.alpha!==void 0&&!["keep","discard"].includes(e.alpha))throw new TypeError("options.alpha, when provided, must be 'keep' or 'discard'.");let r=yt(this.rotation+(e.rotate??0)),[i,s]=r%180===0?[this.squarePixelWidth,this.squarePixelHeight]:[this.squarePixelHeight,this.squarePixelWidth],n=e.crop;n&&(n=ki(n,i,s));let o=n?n.width:i,a=n?n.height:s,c=o/a,l,u;e.width!==void 0&&e.height===void 0?(l=e.width,u=l/c):e.width===void 0&&e.height!==void 0?(u=e.height,l=u*c):e.width!==void 0&&e.height!==void 0?(l=e.width,u=e.height):(l=o,u=a),l=Gr(l,e.roundDimensionsTo??1),u=Gr(u,e.roundDimensionsTo??1);let d={width:l,height:u,fit:e.fit??"fill",rotation:r,crop:n??{left:0,top:0,width:i,height:s},alpha:e.alpha??"keep"};for(let b of Al){let y=b(this,d);if(U(y)&&(y=await y),y!==null)return y}let{canvas:f,context:m,isNew:p}=Ia(d.width,d.height);return this._drawWithFitAndMipmapping(f,m,{fit:d.fit,rotation:d.rotation,crop:d.crop,targetIsFresh:p,fillBlack:d.alpha==="discard"}),new t(f,{timestamp:this.timestamp,duration:this.duration,rotation:0})}setRotation(e){if(![0,90,180,270].includes(e))throw new TypeError("newRotation must be 0, 90, 180, or 270.");this.rotation=e;}setTimestamp(e){if(!Number.isFinite(e))throw new TypeError("newTimestamp must be a number.");this.timestamp=e;}setDuration(e){if(!Number.isFinite(e)||e<0)throw new TypeError("newDuration must be a non-negative number.");this.duration=e;}setEncodeOptions(e){if(!e||typeof e!="object")throw new TypeError("newEncodeOptions must be an object.");this.encodeOptions=e;}[Symbol.dispose](){this.close();}},Al=[];var Tl=3,wi=[],va=0,Ia=(t,e)=>{for(let s of wi)if(s.canvas.width===t&&s.canvas.height===e)return s.age=va++,{canvas:s.canvas,context:s.context,isNew:!1};let r;if(typeof OffscreenCanvas<"u")r=new OffscreenCanvas(t,e);else {if(typeof window>"u"||typeof document>"u")throw new Error("Cannot transform VideoSamples in this environment. Either run in an environment with OffscreenCanvas or HTMLCanvasElement, or supply a custom VideoSample transformer using registerVideoSampleTransformer().");r=document.createElement("canvas"),r.width=t,r.height=e;}let i=r.getContext("2d",{alpha:!0,willReadFrequently:!1});if(!i)throw new Error("The '2d' canvas context is required to transform VideoSamples. Register a custom transformer using registerVideoSampleTransformer to work around this limitation.");return wi.length>=Tl&&wi.splice(Ui(wi,s=>s.age),1),wi.push({canvas:r,context:i,age:va++}),{canvas:r,context:i,isNew:!0}},Ai=class{constructor(e){if(e!==void 0){if(!e||typeof e!="object")throw new TypeError("init.colorSpace, when provided, must be an object.");let r=Object.keys(At);if(e.primaries!=null&&!r.includes(e.primaries))throw new TypeError(`init.colorSpace.primaries, when provided, must be one of ${r.join(", ")}.`);let i=Object.keys(Tt);if(e.transfer!=null&&!i.includes(e.transfer))throw new TypeError(`init.colorSpace.transfer, when provided, must be one of ${i.join(", ")}.`);let s=Object.keys(kt);if(e.matrix!=null&&!s.includes(e.matrix))throw new TypeError(`init.colorSpace.matrix, when provided, must be one of ${s.join(", ")}.`);if(e.fullRange!=null&&typeof e.fullRange!="boolean")throw new TypeError("init.colorSpace.fullRange, when provided, must be a boolean.")}this.primaries=e?.primaries??null,this.transfer=e?.transfer??null,this.matrix=e?.matrix??null,this.fullRange=e?.fullRange??null;}toJSON(){return {primaries:this.primaries,transfer:this.transfer,matrix:this.matrix,fullRange:this.fullRange}}},yi=t=>typeof VideoFrame<"u"&&t instanceof VideoFrame,ki=(t,e,r)=>{let i=Math.min(t.left,e),s=Math.min(t.top,r),n=Math.min(t.width,e-i),o=Math.min(t.height,r-s);return g(n>=0),g(o>=0),{left:i,top:s,width:n,height:o}},nr=(t,e)=>{if(!t||typeof t!="object")throw new TypeError(e+"crop, when provided, must be an object.");if(!Number.isInteger(t.left)||t.left<0)throw new TypeError(e+"crop.left must be a non-negative integer.");if(!Number.isInteger(t.top)||t.top<0)throw new TypeError(e+"crop.top must be a non-negative integer.");if(!Number.isInteger(t.width)||t.width<0)throw new TypeError(e+"crop.width must be a non-negative integer.");if(!Number.isInteger(t.height)||t.height<0)throw new TypeError(e+"crop.height must be a non-negative integer.")},Pa=t=>{if(!t||typeof t!="object")throw new TypeError("options must be an object.");if(t.colorSpace!==void 0&&!["display-p3","srgb"].includes(t.colorSpace))throw new TypeError("options.colorSpace, when provided, must be 'display-p3' or 'srgb'.");if(t.format!==void 0&&typeof t.format!="string")throw new TypeError("options.format, when provided, must be a string.");if(t.layout!==void 0){if(!Array.isArray(t.layout))throw new TypeError("options.layout, when provided, must be an array.");for(let e of t.layout){if(!e||typeof e!="object")throw new TypeError("Each entry in options.layout must be an object.");if(!Number.isInteger(e.offset)||e.offset<0)throw new TypeError("plane.offset must be a non-negative integer.");if(!Number.isInteger(e.stride)||e.stride<0)throw new TypeError("plane.stride must be a non-negative integer.")}}if(t.rect!==void 0){if(!t.rect||typeof t.rect!="object")throw new TypeError("options.rect, when provided, must be an object.");if(t.rect.x!==void 0&&(!Number.isInteger(t.rect.x)||t.rect.x<0))throw new TypeError("options.rect.x, when provided, must be a non-negative integer.");if(t.rect.y!==void 0&&(!Number.isInteger(t.rect.y)||t.rect.y<0))throw new TypeError("options.rect.y, when provided, must be a non-negative integer.");if(t.rect.width!==void 0&&(!Number.isInteger(t.rect.width)||t.rect.width<0))throw new TypeError("options.rect.width, when provided, must be a non-negative integer.");if(t.rect.height!==void 0&&(!Number.isInteger(t.rect.height)||t.rect.height<0))throw new TypeError("options.rect.height, when provided, must be a non-negative integer.")}},kl=(t,e,r)=>{let i=_n(t),s=[],n=0;for(let o of i){let a=Math.ceil(e/o.widthDivisor),c=Math.ceil(r/o.heightDivisor),l=a*o.sampleBytes,u=l*c;s.push({offset:n,stride:l}),n+=u;}return s},_n=t=>{let e=(r,i,s,n,o)=>{let a=[{sampleBytes:r,widthDivisor:1,heightDivisor:1},{sampleBytes:i,widthDivisor:s,heightDivisor:n},{sampleBytes:i,widthDivisor:s,heightDivisor:n}];return o&&a.push({sampleBytes:r,widthDivisor:1,heightDivisor:1}),a};switch(t){case "I420":return e(1,1,2,2,!1);case "I420P10":case "I420P12":return e(2,2,2,2,!1);case "I420A":return e(1,1,2,2,!0);case "I420AP10":case "I420AP12":return e(2,2,2,2,!0);case "I422":return e(1,1,2,1,!1);case "I422P10":case "I422P12":return e(2,2,2,1,!1);case "I422A":return e(1,1,2,1,!0);case "I422AP10":case "I422AP12":return e(2,2,2,1,!0);case "I444":return e(1,1,1,1,!1);case "I444P10":case "I444P12":return e(2,2,1,1,!1);case "I444A":return e(1,1,1,1,!0);case "I444AP10":case "I444AP12":return e(2,2,1,1,!0);case "NV12":return [{sampleBytes:1,widthDivisor:1,heightDivisor:1},{sampleBytes:2,widthDivisor:2,heightDivisor:2}];case "RGBA":case "RGBX":case "BGRA":case "BGRX":return [{sampleBytes:4,widthDivisor:1,heightDivisor:1}];default:xe(t),g(!1);}},Ra=(t,e)=>{let r={left:0,top:0,width:t.codedWidth,height:t.codedHeight},i=e.rect,s=Sl(r,i,t.codedWidth,t.codedHeight,t.format),n=e.layout,o;if(!e.format||e.format===t.format)o=t.format;else if(["RGBA","RGBX","BGRA","BGRX"].includes(e.format))o=e.format;else throw new Error("NotSupportedError: Invalid destination format.");return _l(s,o,n)},Sl=(t,e,r,i,s)=>{let n={...t};if(e!==void 0){if(e.width===0||e.height===0)throw new TypeError("visibleRect dimensions cannot be zero.");if((e.x||0)+(e.width||0)>r)throw new TypeError("visibleRect exceeds codedWidth.");if((e.y||0)+(e.height||0)>i)throw new TypeError("visibleRect exceeds codedHeight.");n.x=e.x||0,n.y=e.y||0,n.width=e.width||0,n.height=e.height||0;}if(!xl(s,n))throw new TypeError("visibleRect alignment is invalid for the format.");return n},xl=(t,e)=>{if(t===null)return !0;let r=_n(t);for(let i=0;i<r.length;i++){let s=r[i],n=s.widthDivisor,o=s.heightDivisor;if((e.x||0)%n!==0||(e.y||0)%o!==0)return !1}return !0},_l=(t,e,r)=>{let i=_n(e),s=i.length;if(r!==void 0&&r.length!==s)throw new TypeError(`Layout must have ${s} planes.`);let n=0,o=[],a=[];for(let c=0;c<s;c++){let l=i[c],u=l.sampleBytes,d=l.widthDivisor,f=l.heightDivisor,m={destinationOffset:0,destinationStride:0,sourceTop:0,sourceHeight:0,sourceLeftBytes:0,sourceWidthBytes:0};if(m.sourceTop=Math.ceil(Math.trunc(t.y||0)/f),m.sourceHeight=Math.ceil(Math.trunc(t.height||0)/f),m.sourceLeftBytes=Math.floor(Math.trunc(t.x||0)/d)*u,m.sourceWidthBytes=Math.floor(Math.trunc(t.width||0)/d)*u,r!==void 0){let y=r[c];if(y.stride<m.sourceWidthBytes)throw new TypeError(`Stride for plane ${c} is too small.`);m.destinationOffset=y.offset,m.destinationStride=y.stride;}else m.destinationOffset=n,m.destinationStride=m.sourceWidthBytes;let b=m.destinationStride*m.sourceHeight+m.destinationOffset;if(b>4294967295)throw new TypeError("Allocation size exceeds limit.");a.push(b),n=Math.max(n,b);for(let y=0;y<c;y++){let w=o[y];if(!(a[c]<=w.destinationOffset||a[y]<=m.destinationOffset))throw new TypeError("Planes overlap.")}o.push(m);}return {allocationSize:n,computedLayouts:o}},xn=new Set(["f32","f32-planar","s16","s16-planar","s32","s32-planar","u8","u8-planar"]),rr=class{constructor(){this._referenceCount=0;}},Fe=class t{get microsecondTimestamp(){return Math.trunc(lt*this.timestamp)}get microsecondDuration(){return Math.trunc(lt*this.duration)}constructor(e){if(this._closed=!1,bi(e)){if(e.format===null)throw new TypeError("AudioData with null format is not supported.");this._data=e,this.format=e.format,this.sampleRate=e.sampleRate,this.numberOfFrames=e.numberOfFrames,this.numberOfChannels=e.numberOfChannels,this.timestamp=e.timestamp/1e6,this.duration=e.numberOfFrames/e.sampleRate;}else if(e instanceof rr){if(this._data=e,e._referenceCount++,this.format=e.getFormat(),!xn.has(this.format))throw new TypeError("getFormat() must return an AudioSampleFormat.");if(this.sampleRate=e.getSampleRate(),!Number.isInteger(this.sampleRate)||this.sampleRate<=0)throw new TypeError("getSampleRate() must return a positive integer.");if(this.numberOfFrames=e.getNumberOfFrames(),!Number.isInteger(this.numberOfFrames)||this.numberOfFrames<0)throw new TypeError("getNumberOfFrames() must return a non-negative integer.");if(this.numberOfChannels=e.getNumberOfChannels(),!Number.isInteger(this.numberOfChannels)||this.numberOfChannels<=0)throw new TypeError("getNumberOfChannels() must return a positive integer.");if(this.timestamp=e.getTimestamp(),!Number.isFinite(this.timestamp))throw new TypeError("getTimestamp() must return a finite number.");this.duration=this.numberOfFrames/this.sampleRate;}else {if(!e||typeof e!="object")throw new TypeError("Invalid AudioDataInit: must be an object.");if(!xn.has(e.format))throw new TypeError("Invalid AudioDataInit: invalid format.");if(!Number.isFinite(e.sampleRate)||e.sampleRate<=0)throw new TypeError("Invalid AudioDataInit: sampleRate must be > 0.");if(!Number.isInteger(e.numberOfChannels)||e.numberOfChannels===0)throw new TypeError("Invalid AudioDataInit: numberOfChannels must be an integer > 0.");if(!Number.isFinite(e?.timestamp))throw new TypeError("init.timestamp must be a number.");let r=e.data.byteLength/(dt(e.format)*e.numberOfChannels);if(!Number.isInteger(r))throw new TypeError("Invalid AudioDataInit: data size is not a multiple of frame size.");this.format=e.format,this.sampleRate=e.sampleRate,this.numberOfFrames=r,this.numberOfChannels=e.numberOfChannels,this.timestamp=e.timestamp,this.duration=r/e.sampleRate;let i;if(e.data instanceof ArrayBuffer)i=new Uint8Array(e.data);else if(ArrayBuffer.isView(e.data))i=new Uint8Array(e.data.buffer,e.data.byteOffset,e.data.byteLength);else throw new TypeError("Invalid AudioDataInit: data is not a BufferSource.");let s=this.numberOfFrames*this.numberOfChannels*dt(this.format);if(i.byteLength<s)throw new TypeError("Invalid AudioDataInit: insufficient data size.");this._data=i;}Ti?.register(this,{type:"audio",data:this._data},this);}allocationSize(e){if(!e||typeof e!="object")throw new TypeError("options must be an object.");if(!Number.isInteger(e.planeIndex)||e.planeIndex<0)throw new TypeError("planeIndex must be a non-negative integer.");if(e.format!==void 0&&!xn.has(e.format))throw new TypeError("Invalid format.");if(e.frameOffset!==void 0&&(!Number.isInteger(e.frameOffset)||e.frameOffset<0))throw new TypeError("frameOffset must be a non-negative integer.");if(e.frameCount!==void 0&&(!Number.isInteger(e.frameCount)||e.frameCount<0))throw new TypeError("frameCount must be a non-negative integer.");if(this._closed)throw new Error("AudioSample is closed.");let r=e.format??this.format,i=e.frameOffset??0;if(i>=this.numberOfFrames)throw new RangeError("frameOffset out of range");let s=e.frameCount!==void 0?e.frameCount:this.numberOfFrames-i;if(s>this.numberOfFrames-i)throw new RangeError("frameCount out of range");let n=dt(r),o=ir(r);if(o&&e.planeIndex>=this.numberOfChannels)throw new RangeError("planeIndex out of range");if(!o&&e.planeIndex!==0)throw new RangeError("planeIndex out of range");return (o?s:s*this.numberOfChannels)*n}copyTo(e,r){if(!wr(e))throw new TypeError("destination must be an ArrayBuffer or an ArrayBuffer view.");if(!r||typeof r!="object")throw new TypeError("options must be an object.");if(!Number.isInteger(r.planeIndex)||r.planeIndex<0)throw new TypeError("planeIndex must be a non-negative integer.");if(r.format!==void 0&&!xn.has(r.format))throw new TypeError("Invalid format.");if(r.frameOffset!==void 0&&(!Number.isInteger(r.frameOffset)||r.frameOffset<0))throw new TypeError("frameOffset must be a non-negative integer.");if(r.frameCount!==void 0&&(!Number.isInteger(r.frameCount)||r.frameCount<0))throw new TypeError("frameCount must be a non-negative integer.");if(this._closed)throw new Error("AudioSample is closed.");let{format:i,frameCount:s,frameOffset:n}=r,{planeIndex:o}=r,a=this.format,c=i??this.format;if(!c)throw new Error("Destination format not determined");let l=this.numberOfFrames,u=this.numberOfChannels,d=n??0;if(d>=l)throw new RangeError("frameOffset out of range");let f=s!==void 0?s:l-d;if(f>l-d)throw new RangeError("frameCount out of range");let m=dt(c),p=ir(c);if(p&&o>=u)throw new RangeError("planeIndex out of range");if(!p&&o!==0)throw new RangeError("planeIndex out of range");let y=(p?f:f*u)*m;if(e.byteLength<y)throw new RangeError("Destination buffer is too small");let w=ie(e),A=Ba(c);if(bi(this._data))if(xt()&&u>2&&c!==a){Cl(this._data,w,a,c,u,o,d,f);return}else try{this._data.copyTo(e,{planeIndex:o,frameOffset:d,frameCount:f,format:c});return}catch(k){if(c==="f32-planar")throw k;a="f32-planar";}let T=Fa(a),I=dt(a),v=ir(a),F;if(this._data instanceof rr){let k=_=>{let B=this._data.getDataPlane(_);if(!(B instanceof Uint8Array))throw new TypeError("getDataPlane() must return a Uint8Array.");let z=l*I*(v?1:u);if(B.byteLength!==z)throw new TypeError(`Data plane ${_} has invalid size. Expected exactly ${z} bytes, got ${B.byteLength} bytes.`);return B};if(v)if(p)F=k(o),o=0;else {F=new Uint8Array(l*I*u);for(let _=0;_<u;_++){let B=k(_);F.set(B,_*l*I);}}else F=k(0);}else if(this._data instanceof Uint8Array)F=this._data;else if(g(a==="f32-planar"),p)F=new Uint8Array(this._data.allocationSize({format:"f32-planar",planeIndex:o})),this._data.copyTo(F,{format:"f32-planar",planeIndex:o}),o=0;else {F=new Uint8Array(this._data.allocationSize({format:"f32-planar",planeIndex:0})*u);for(let k=0;k<u;k++)this._data.copyTo(F.subarray(k*l*I,(k+1)*l*I),{format:"f32-planar",planeIndex:k});}let E=ie(F);for(let k=0;k<f;k++)if(p){let _=k*m,B;v?B=(o*l+(k+d))*I:B=((k+d)*u+o)*I;let z=T(E,B);A(w,_,z);}else for(let _=0;_<u;_++){let z=(k*u+_)*m,N;v?N=(_*l+(k+d))*I:N=((k+d)*u+_)*I;let Z=T(E,N);A(w,z,Z);}}clone(){if(this._closed)throw new Error("AudioSample is closed.");if(this._data instanceof rr){let e=new t(this._data);return e.setTimestamp(this.timestamp),e}else if(bi(this._data)){let e=new t(this._data.clone());return e.setTimestamp(this.timestamp),e}else return new t({format:this.format,sampleRate:this.sampleRate,numberOfFrames:this.numberOfFrames,numberOfChannels:this.numberOfChannels,timestamp:this.timestamp,data:this._data})}trim(e,r=this.numberOfFrames){if(!Number.isInteger(e)||e<0)throw new TypeError("startSample must be a non-negative integer.");if(!Number.isInteger(r)||r<0)throw new TypeError("endSample must be a non-negative integer.");if(e>this.numberOfFrames)throw new RangeError("startSample out of range.");if(r>this.numberOfFrames)throw new RangeError("endSample out of range.");if(r<e)throw new RangeError("endSample must not be less than startSample.");if(this._closed)throw new Error("AudioSample is closed.");let i=r-e,s=dt(this.format),n;if(ir(this.format)){let o=i*s;if(n=new Uint8Array(o*this.numberOfChannels),i>0)for(let a=0;a<this.numberOfChannels;a++)this.copyTo(n.subarray(a*o,(a+1)*o),{planeIndex:a,format:this.format,frameOffset:e,frameCount:i});}else n=new Uint8Array(i*this.numberOfChannels*s),i>0&&this.copyTo(n,{planeIndex:0,format:this.format,frameOffset:e,frameCount:i});return new t({data:n,format:this.format,sampleRate:this.sampleRate,numberOfChannels:this.numberOfChannels,timestamp:this.timestamp+e/this.sampleRate})}close(){this._closed||(Ti?.unregister(this),this._data instanceof rr?(this._data._referenceCount--,this._data._referenceCount===0&&this._data.close()):bi(this._data)?this._data.close():this._data=new Uint8Array(0),this._closed=!0);}toAudioData(){if(this._closed)throw new Error("AudioSample is closed.");return this._data instanceof rr?this._createAudioDataFromData():bi(this._data)?this._data.timestamp===this.microsecondTimestamp?this._data.clone():this._createAudioDataFromData():new AudioData({format:this.format,sampleRate:this.sampleRate,numberOfFrames:this.numberOfFrames,numberOfChannels:this.numberOfChannels,timestamp:this.microsecondTimestamp,data:this._data.buffer instanceof ArrayBuffer?this._data.buffer:this._data.slice()})}_createAudioDataFromData(){if(ir(this.format)){let e=this.allocationSize({planeIndex:0,format:this.format}),r=new ArrayBuffer(e*this.numberOfChannels);for(let i=0;i<this.numberOfChannels;i++)this.copyTo(new Uint8Array(r,i*e,e),{planeIndex:i,format:this.format});return new AudioData({format:this.format,sampleRate:this.sampleRate,numberOfFrames:this.numberOfFrames,numberOfChannels:this.numberOfChannels,timestamp:this.microsecondTimestamp,data:r})}else {let e=new ArrayBuffer(this.allocationSize({planeIndex:0,format:this.format}));return this.copyTo(e,{planeIndex:0,format:this.format}),new AudioData({format:this.format,sampleRate:this.sampleRate,numberOfFrames:this.numberOfFrames,numberOfChannels:this.numberOfChannels,timestamp:this.microsecondTimestamp,data:e})}}toAudioBuffer(){if(this._closed)throw new Error("AudioSample is closed.");let e=new AudioBuffer({numberOfChannels:this.numberOfChannels,length:this.numberOfFrames,sampleRate:this.sampleRate}),r=new Float32Array(this.allocationSize({planeIndex:0,format:"f32-planar"})/4);for(let i=0;i<this.numberOfChannels;i++)this.copyTo(r,{planeIndex:i,format:"f32-planar"}),e.copyToChannel(r,i);return e}setTimestamp(e){if(!Number.isFinite(e))throw new TypeError("newTimestamp must be a number.");this.timestamp=e;}[Symbol.dispose](){this.close();}static*_fromAudioBuffer(e,r){if(!(e instanceof AudioBuffer))throw new TypeError("audioBuffer must be an AudioBuffer.");let i=48e3*5,s=e.numberOfChannels,n=e.sampleRate,o=e.length,a=Math.floor(i/s),c=0,l=o;for(;l>0;){let u=Math.min(a,l),d=new Float32Array(s*u);for(let f=0;f<s;f++)e.copyFromChannel(d.subarray(f*u,(f+1)*u),f,c);yield new t({format:"f32-planar",sampleRate:n,numberOfFrames:u,numberOfChannels:s,timestamp:r+c/n,data:d}),c+=u,l-=u;}}static fromAudioBuffer(e,r){if(!(e instanceof AudioBuffer))throw new TypeError("audioBuffer must be an AudioBuffer.");let i=48e3*5,s=e.numberOfChannels,n=e.sampleRate,o=e.length,a=Math.floor(i/s),c=0,l=o,u=[];for(;l>0;){let d=Math.min(a,l),f=new Float32Array(s*d);for(let p=0;p<s;p++)e.copyFromChannel(f.subarray(p*d,(p+1)*d),p,c);let m=new t({format:"f32-planar",sampleRate:n,numberOfFrames:d,numberOfChannels:s,timestamp:r+c/n,data:f});u.push(m),c+=d,l-=d;}return u}},dt=t=>{switch(t){case "u8":case "u8-planar":return 1;case "s16":case "s16-planar":return 2;case "s32":case "s32-planar":return 4;case "f32":case "f32-planar":return 4;default:throw new Error("Unknown AudioSampleFormat")}},ir=t=>{switch(t){case "u8-planar":case "s16-planar":case "s32-planar":case "f32-planar":return !0;default:return !1}},Fa=t=>{switch(t){case "u8":case "u8-planar":return (e,r)=>(e.getUint8(r)-128)/128;case "s16":case "s16-planar":return (e,r)=>e.getInt16(r,!0)/32768;case "s32":case "s32-planar":return (e,r)=>e.getInt32(r,!0)/2147483648;case "f32":case "f32-planar":return (e,r)=>e.getFloat32(r,!0)}},Ba=t=>{switch(t){case "u8":case "u8-planar":return (e,r,i)=>e.setUint8(r,ue((i+1)*127.5,0,255));case "s16":case "s16-planar":return (e,r,i)=>e.setInt16(r,ue(Math.round(i*32767),-32768,32767),!0);case "s32":case "s32-planar":return (e,r,i)=>e.setInt32(r,ue(Math.round(i*2147483647),-2147483648,2147483647),!0);case "f32":case "f32-planar":return (e,r,i)=>e.setFloat32(r,i,!0)}},bi=t=>typeof AudioData<"u"&&t instanceof AudioData,Ma=t=>{switch(t){case "u8-planar":return "u8";case "s16-planar":return "s16";case "s32-planar":return "s32";case "f32-planar":return "f32";default:return t}},Cl=(t,e,r,i,s,n,o,a)=>{let c=Fa(r),l=Ba(i),u=dt(r),d=dt(i),f=ir(r);if(ir(i))if(f){let p=new ArrayBuffer(a*u),b=ie(p);t.copyTo(p,{planeIndex:n,frameOffset:o,frameCount:a,format:r});for(let y=0;y<a;y++){let w=y*u,A=y*d,T=c(b,w);l(e,A,T);}}else {let p=new ArrayBuffer(a*s*u),b=ie(p);t.copyTo(p,{planeIndex:0,frameOffset:o,frameCount:a,format:r});for(let y=0;y<a;y++){let w=(y*s+n)*u,A=y*d,T=c(b,w);l(e,A,T);}}else if(f){let p=a*u,b=new ArrayBuffer(p),y=ie(b);for(let w=0;w<s;w++){t.copyTo(b,{planeIndex:w,frameOffset:o,frameCount:a,format:r});for(let A=0;A<a;A++){let T=A*u,I=(A*s+w)*d,v=c(y,T);l(e,I,v);}}}else {let p=new ArrayBuffer(a*s*u),b=ie(p);t.copyTo(p,{planeIndex:0,frameOffset:o,frameCount:a,format:r});for(let y=0;y<a;y++)for(let w=0;w<s;w++){let A=y*s+w,T=A*u,I=A*d,v=c(b,T);l(e,I,v);}}},Da=(t,e)=>{let r=t.allocationSize({format:e,planeIndex:0}),i=new ArrayBuffer(r);return t.copyTo(i,{format:e,planeIndex:0}),new Fe({data:i,format:e,numberOfChannels:t.numberOfChannels,sampleRate:t.sampleRate,timestamp:t.timestamp,duration:t.duration})};var Oa=new Map,za=new Map,Na=t=>{if(!t||typeof t!="object")throw new TypeError("Encoding config must be an object.");if(!De.includes(t.codec))throw new TypeError(`Invalid video codec '${t.codec}'. Must be one of: ${De.join(", ")}.`);let e=t.bitrate;if(t.quality===void 0&&e===void 0)throw new TypeError("config.quality must be provided.");if(t.quality!==void 0&&e!==void 0)throw new TypeError("config.quality and config.bitrate cannot both be provided.");if(t.quality!==void 0&&!(t.quality instanceof Se))throw new TypeError("config.quality, when provided, must be a Quality.");if(e!==void 0&&!(e instanceof Se)&&(!Number.isInteger(e)||e<=0))throw new TypeError("config.bitrate, when provided, must be a positive integer or a quality.");if(t.keyFrameInterval!==void 0&&(!Number.isFinite(t.keyFrameInterval)||t.keyFrameInterval<0))throw new TypeError("config.keyFrameInterval, when provided, must be a non-negative number.");if(t.sizeChangeBehavior!==void 0&&!["deny","passThrough","fill","contain","cover"].includes(t.sizeChangeBehavior))throw new TypeError("config.sizeChangeBehavior, when provided, must be 'deny', 'passThrough', 'fill', 'contain' or 'cover'.");if(t.transform!==void 0){if(typeof t.transform!="object"||!t.transform)throw new TypeError("config.transform, when provided, must be an object.");if(t.transform.width!==void 0&&(!Number.isInteger(t.transform.width)||t.transform.width<=0))throw new TypeError("config.transform.width, when provided, must be a positive integer.");if(t.transform.height!==void 0&&(!Number.isInteger(t.transform.height)||t.transform.height<=0))throw new TypeError("config.transform.height, when provided, must be a positive integer.");if(t.transform.fit!==void 0&&!["fill","contain","cover"].includes(t.transform.fit))throw new TypeError('config.transform.fit, when provided, must be one of "fill", "contain", or "cover".');if(t.transform.width!==void 0&&t.transform.height!==void 0&&t.transform.fit===void 0&&!["fill","contain","cover"].includes(t.sizeChangeBehavior))throw new TypeError("When both config.transform.width and config.transform.height are provided, config.transform.fit must also be provided.");if(t.transform.fit!==void 0&&["fill","contain","cover"].includes(t.sizeChangeBehavior)&&t.transform.fit!==t.sizeChangeBehavior)throw new TypeError("config.transform.fit, when provided, cannot differ from config.sizeChangeBehavior when config.sizeChangeBehavior is 'fill', 'contain' or 'cover', as sizeChangeBehavior already determines the fitting algorithm.");if(t.transform.rotate!==void 0&&![0,90,180,270].includes(t.transform.rotate))throw new TypeError("config.transform.rotate, when provided, must be 0, 90, 180 or 270.");if(t.transform.crop!==void 0&&nr(t.transform.crop,"config.transform."),t.transform.process!==void 0&&typeof t.transform.process!="function")throw new TypeError("config.transform.process, when provided, must be a function.");if(t.transform.frameRate!==void 0&&(!Number.isFinite(t.transform.frameRate)||t.transform.frameRate<=0))throw new TypeError("config.transform.frameRate, when provided, must be a finite positive number.");if(t.transform.force!==void 0&&typeof t.transform.force!="boolean")throw new TypeError("config.transform.force, when provided, must be a boolean.")}if(t.onEncodedPacket!==void 0&&typeof t.onEncodedPacket!="function")throw new TypeError("config.onEncodedPacket, when provided, must be a function.");if(t.onEncoderConfig!==void 0&&typeof t.onEncoderConfig!="function")throw new TypeError("config.onEncoderConfig, when provided, must be a function.");if(t.onEncodedSample!==void 0&&typeof t.onEncodedSample!="function")throw new TypeError("config.onEncodedSample, when provided, must be a function.");Wa(t.codec,t);},Wa=(t,e)=>{if(!e||typeof e!="object")throw new TypeError("Encoding options must be an object.");if(e.alpha!==void 0&&!["discard","keep"].includes(e.alpha))throw new TypeError("options.alpha, when provided, must be 'discard' or 'keep'.");let r=e.bitrateMode;if(r!==void 0&&!["constant","variable"].includes(r))throw new TypeError("bitrateMode, when provided, must be 'constant' or 'variable'.");if(e.latencyMode!==void 0&&!["quality","realtime"].includes(e.latencyMode))throw new TypeError("latencyMode, when provided, must be 'quality' or 'realtime'.");if(e.fullCodecString!==void 0&&typeof e.fullCodecString!="string")throw new TypeError("fullCodecString, when provided, must be a string.");if(e.fullCodecString!==void 0&&ai(e.fullCodecString)!==t)throw new TypeError(`fullCodecString, when provided, must be a string that matches the specified codec (${t}).`);if(e.hardwareAcceleration!==void 0&&!["no-preference","prefer-hardware","prefer-software"].includes(e.hardwareAcceleration))throw new TypeError("hardwareAcceleration, when provided, must be 'no-preference', 'prefer-hardware' or 'prefer-software'.");if(e.scalabilityMode!==void 0&&typeof e.scalabilityMode!="string")throw new TypeError("scalabilityMode, when provided, must be a string.");if(e.contentHint!==void 0&&typeof e.contentHint!="string")throw new TypeError("contentHint, when provided, must be a string.")},Fs=t=>{let e=t.bitrateMode,r=t.quality._toVideoRateControl(t.codec,t.width,t.height,e),i=(n,o,a)=>({codec:t.fullCodecString??Jo(t.codec,t.width,t.height,a,t.alpha==="keep"),width:t.width,height:t.height,displayWidth:t.squarePixelWidth,displayHeight:t.squarePixelHeight,bitrate:n,bitrateMode:o,alpha:t.alpha??"discard",framerate:t.framerate,latencyMode:t.latencyMode,hardwareAcceleration:t.hardwareAcceleration,scalabilityMode:t.scalabilityMode,contentHint:t.contentHint,...ia(t.codec)}),s=[];return r.quantizer!==null&&s.push({config:i(void 0,"quantizer",r.bitrate),quantizer:r.quantizer}),r.bitrateMode!=="quantizer"&&s.push({config:i(r.bitrate,r.bitrateMode,r.bitrate),quantizer:null}),g(s.length>0),s},qa=t=>{if(!t||typeof t!="object")throw new TypeError("Encoding config must be an object.");if(!ze.includes(t.codec))throw new TypeError(`Invalid audio codec '${t.codec}'. Must be one of: ${ze.join(", ")}.`);let e=t.bitrate;if(t.quality===void 0&&e===void 0&&!(Ae.includes(t.codec)||t.codec==="flac"))throw new TypeError("config.quality must be provided for compressed audio codecs.");if(t.quality!==void 0&&e!==void 0)throw new TypeError("config.quality and config.bitrate cannot both be provided.");if(t.quality!==void 0&&!(t.quality instanceof Se))throw new TypeError("config.quality, when provided, must be a Quality.");if(e!==void 0&&!(e instanceof Se)&&(!Number.isInteger(e)||e<=0))throw new TypeError("config.bitrate, when provided, must be a positive integer or a quality.");if(t.transform!==void 0){if(typeof t.transform!="object"||!t.transform)throw new TypeError("config.transform, when provided, must be an object.");if(t.transform.numberOfChannels!==void 0&&(!Number.isInteger(t.transform.numberOfChannels)||t.transform.numberOfChannels<=0))throw new TypeError("config.transform.numberOfChannels, when provided, must be a positive integer.");if(t.transform.sampleRate!==void 0&&(!Number.isInteger(t.transform.sampleRate)||t.transform.sampleRate<=0))throw new TypeError("config.transform.sampleRate, when provided, must be a positive integer.");if(t.transform.sampleFormat!==void 0&&!["u8","s16","s32","f32"].includes(t.transform.sampleFormat))throw new TypeError("config.transform.sampleFormat, when provided, must be one of: u8, s16, s32, f32.");if(t.transform.process!==void 0&&typeof t.transform.process!="function")throw new TypeError("config.transform.process, when provided, must be a function.")}if(t.onEncodedPacket!==void 0&&typeof t.onEncodedPacket!="function")throw new TypeError("config.onEncodedPacket, when provided, must be a function.");if(t.onEncoderConfig!==void 0&&typeof t.onEncoderConfig!="function")throw new TypeError("config.onEncoderConfig, when provided, must be a function.");if(t.onEncodedSample!==void 0&&typeof t.onEncodedSample!="function")throw new TypeError("config.onEncodedSample, when provided, must be a function.");La(t.codec,t);},La=(t,e)=>{if(!e||typeof e!="object")throw new TypeError("Encoding options must be an object.");let r=e.bitrateMode;if(r!==void 0&&!["constant","variable"].includes(r))throw new TypeError("bitrateMode, when provided, must be 'constant' or 'variable'.");if(e.fullCodecString!==void 0&&typeof e.fullCodecString!="string")throw new TypeError("fullCodecString, when provided, must be a string.");if(e.fullCodecString!==void 0&&ai(e.fullCodecString)!==t)throw new TypeError(`fullCodecString, when provided, must be a string that matches the specified codec (${t}).`)},Bs=t=>{let e=t.bitrateMode;return {codec:t.fullCodecString??ta(t.codec,t.numberOfChannels,t.sampleRate),numberOfChannels:t.numberOfChannels,sampleRate:t.sampleRate,bitrate:t.quality?._toAudioBitrate(t.codec),bitrateMode:t.quality?._bitrateMode??e,...na(t.codec)}},Se=class{constructor(e){if((typeof e=="number"||typeof e=="string")&&(e={quality:e}),!e||typeof e!="object")throw new TypeError("options must be an object.");if(e.bitrateMode!==void 0&&!["constant","variable"].includes(e.bitrateMode))throw new TypeError("options.bitrateMode, when provided, must be 'constant' or 'variable'.");if("quality"in e){if(typeof e.quality=="string"?!(e.quality in Va):typeof e.quality!="number"||Number.isNaN(e.quality))throw new TypeError("options.quality must be a number, or one of 'very-low', 'low', 'medium', 'high' or 'very-high'.");if(e.preferBitrate!==void 0&&typeof e.preferBitrate!="boolean")throw new TypeError("options.preferBitrate, when provided, must be a boolean.");if("bitrate"in e||"quantizer"in e)throw new TypeError("options.quality cannot be combined with options.bitrate or options.quantizer.");this._quality=typeof e.quality=="string"?Va[e.quality]:e.quality,this._preferBitrate=e.preferBitrate??!1,this._bitrate=void 0,this._quantizer=void 0;}else {if(e.bitrate!==void 0&&(!Number.isInteger(e.bitrate)||e.bitrate<=0))throw new TypeError("options.bitrate, when provided, must be a positive integer.");if(e.quantizer!==void 0&&(!Number.isInteger(e.quantizer)||e.quantizer<0))throw new TypeError("options.quantizer, when provided, must be a non-negative integer.");if(e.bitrate===void 0&&e.quantizer===void 0)throw new TypeError("At least one of options.bitrate or options.quantizer must be set.");if("preferBitrate"in e)throw new TypeError("options.preferBitrate can only be combined with options.quality.");this._quality=void 0,this._preferBitrate=!1,this._bitrate=e.bitrate,this._quantizer=e.quantizer;}this._bitrateMode=e.bitrateMode;}_toVideoRateControl(e,r,i,s){let n=El[e],o=null,a=this._bitrateMode??s??"variable";if(this._quantizer!==void 0){if(n)if(this._quantizer<n.min||this._quantizer>n.max){if(this._bitrate===void 0)throw new Error(`Quantizer ${this._quantizer} is out of range for codec '${e}'; must be between ${n.min} and ${n.max}.`)}else o=this._quantizer,this._bitrate===void 0&&(a="quantizer");else if(this._bitrate===void 0)throw new Error(`Codec '${e}' does not support quantizer-based encoding. Provide a bitrate in the Quality to define a fallback.`)}else this._bitrate===void 0&&n&&!this._preferBitrate&&(g(this._quality!==void 0),o=ue(Math.round(yo(n.worst,n.best,this._quality)),n.min,n.max));let c;if(this._bitrate!==void 0)c=this._bitrate;else {let l=this._quality;l===void 0&&(g(o!==null&&n),l=ue((o-n.worst)/(n.best-n.worst),0,1)),c=Ua(e,r,i,Rs(l));}return {quantizer:o,bitrate:c,bitrateMode:a}}_toVideoBitrate(e,r,i){return this._bitrate!==void 0?this._bitrate:(g(this._quality!==void 0),Ua(e,r,i,Rs(this._quality)))}_toAudioBitrate(e){if(Ae.includes(e)||e==="flac")return;if(this._bitrate!==void 0)return this._bitrate;if(this._quality===void 0)throw new Error("This Quality defines neither a quality level nor a bitrate and therefore cannot be used for audio encoding.");let r=Rs(this._quality),s={aac:128e3,opus:64e3,mp3:16e4,vorbis:64e3,ac3:384e3,eac3:192e3,dts:768e3}[e];if(!s)throw new Error(`Unhandled codec: ${e}`);let n=s*r;return e==="aac"?n=[96e3,128e3,16e4,192e3].reduce((a,c)=>Math.abs(c-n)<Math.abs(a-n)?c:a):e==="opus"||e==="vorbis"?n=Math.max(6e3,n):e==="mp3"&&(n=[8e3,16e3,24e3,32e3,4e4,48e3,64e3,8e4,96e3,112e3,128e3,16e4,192e3,224e3,256e3,32e4].reduce((a,c)=>Math.abs(c-n)<Math.abs(a-n)?c:a)),Math.round(n/1e3)*1e3}},Va={"very-low":0,low:.25,medium:.5,high:.75,"very-high":1},El={avc:{min:0,max:51,worst:41,best:16},hevc:{min:0,max:51,worst:41,best:16},vp9:{min:0,max:63,worst:52,best:20},av1:{min:0,max:255,worst:208,best:80}},Rs=t=>.3*Math.exp(2.5538*t),Ua=(t,e,r,i)=>{let s=e*r,n=1920*1080,o=3e6,a=Math.pow(s/n,.95),c=o*a,l={avc:1,hevc:.6,vp9:.6,av1:.4,vp8:1.2,prores:22e7/o},d=c*l[t]*i;return Math.ceil(d/1e3)*1e3},Ms=(t,e)=>{if(t==="avc")return {avc:{quantizer:e}};if(t==="hevc")return {hevc:{quantizer:e}};if(t==="vp9")return {vp9:{quantizer:e}};if(t==="av1")return {av1:{quantizer:e}};g(!1);};var vl=async(t,e={})=>{let{width:r=1280,height:i=720,quality:s,bitrate:n,...o}=e;if(!De.includes(t))return !1;if(!Number.isInteger(r)||r<=0)throw new TypeError("width must be a positive integer.");if(!Number.isInteger(i)||i<=0)throw new TypeError("height must be a positive integer.");if(s!==void 0&&!(s instanceof Se))throw new TypeError("quality, when provided, must be a Quality.");if(s!==void 0&&n!==void 0)throw new TypeError("quality and bitrate cannot both be provided.");if(n!==void 0&&!(n instanceof Se)&&(!Number.isInteger(n)||n<=0))throw new TypeError("bitrate must be a positive integer or a quality.");Wa(t,o);let a=Kt(s,n)??new Se("medium"),c;try{c=Fs({codec:t,width:r,height:i,quality:a,framerate:void 0,...o,alpha:"discard"});}catch{return !1}let l=JSON.stringify(c),u=Oa.get(l);if(u)return u;let d=(async()=>{for(let{config:m}of c)if(Cn.some(p=>p.supports(t,m)))return !0;if(typeof VideoEncoder>"u"||(r%2===1||i%2===1)&&(t==="avc"||t==="hevc"))return !1;for(let{config:m,quantizer:p}of c){try{if(!(await VideoEncoder.isConfigSupported(m)).supported)continue}catch{continue}if(!Xr()||await new Promise(async y=>{try{let w=new VideoEncoder({output:()=>{},error:()=>y(!1)});w.configure(m);let A=new Uint8Array(r*i*4),T=new VideoFrame(A,{format:"RGBA",codedWidth:r,codedHeight:i,timestamp:0});w.encode(T,p!==null?Ms(t,p):void 0),T.close(),await w.flush(),y(!0);}catch{y(!1);}}))return !0}return !1})();return Oa.set(l,d),d},Il=async(t,e={})=>{let{numberOfChannels:r=2,sampleRate:i=48e3,quality:s,bitrate:n,...o}=e;if(!ze.includes(t))return !1;if(!Number.isInteger(r)||r<=0)throw new TypeError("numberOfChannels must be a positive integer.");if(!Number.isInteger(i)||i<=0)throw new TypeError("sampleRate must be a positive integer.");if(s!==void 0&&!(s instanceof Se))throw new TypeError("quality, when provided, must be a Quality.");if(s!==void 0&&n!==void 0)throw new TypeError("quality and bitrate cannot both be provided.");if(n!==void 0&&!(n instanceof Se)&&(!Number.isInteger(n)||n<=0))throw new TypeError("bitrate must be a positive integer.");La(t,o);let a=Kt(s,n)??new Se("medium"),c=Bs({codec:t,numberOfChannels:r,sampleRate:i,quality:a,...o}),l=JSON.stringify(c),u=za.get(l);if(u)return u;let d=(async()=>{if(En.some(f=>f.supports(t,c))||Ae.includes(t))return !0;if(typeof AudioEncoder>"u")return !1;try{return (await AudioEncoder.isConfigSupported(c)).supported===!0}catch{return !1}})();return za.set(l,d),d},Kt=(t,e)=>{if(t!==void 0)return t;if(e!==void 0)return e instanceof Se?e:new Se({bitrate:e})};var Ds=async(t=ze,e)=>{let r=await Promise.all(t.map(i=>Il(i,e)));return t.filter((i,s)=>r[s])};var Ha=async(t,e)=>{for(let r of t)if(await vl(r,e))return r;return null};var vn=[],In=[],Cn=[],En=[];var ja=t=>{let i=t,s=4096,n=0,o=12,a=0;for(i<0&&(i=-i,n=128),i+=33,i>8191&&(i=8191);(i&s)!==s&&o>=5;)s>>=1,o--;return a=i>>o-4&15,~(n|o-5<<4|a)&255},Qa=t=>{let r=0,i=0,s=~t;s&128&&(s&=-129,r=-1),i=((s&240)>>4)+5;let n=(1<<i|(s&15)<<i-4|1<<i-5)-33;return r===0?n:-n},Ka=t=>{let r=2048,i=0,s=11,n=0,o=t;for(o<0&&(o=-o,i=128),o>4095&&(o=4095);(o&r)!==r&&s>=5;)r>>=1,s--;return n=o>>(s===4?1:s-4)&15,(i|s-4<<4|n)^85},Ga=t=>{let e=0,r=0,i=t^85;i&128&&(i&=-129,e=-1),r=((i&240)>>4)+4;let s=0;return r!==4?s=1<<r|(i&15)<<r-4|1<<r-5:s=i<<1|1,e===0?s:-s};var sr=t=>{if(!t||typeof t!="object")throw new TypeError("options must be an object.");if(t.metadataOnly!==void 0&&typeof t.metadataOnly!="boolean")throw new TypeError("options.metadataOnly, when defined, must be a boolean.");if(t.verifyKeyPackets!==void 0&&typeof t.verifyKeyPackets!="boolean")throw new TypeError("options.verifyKeyPackets, when defined, must be a boolean.");if(t.verifyKeyPackets&&t.metadataOnly)throw new TypeError("options.verifyKeyPackets and options.metadataOnly cannot be enabled together.");if(t.skipLiveWait!==void 0&&typeof t.skipLiveWait!="boolean")throw new TypeError("options.skipLiveWait, when defined, must be a boolean.")},or=t=>{if(!Nt(t))throw new TypeError("timestamp must be a number.")},Os=(t,e,r)=>r.verifyKeyPackets?e.then(async i=>{if(!i||i.type==="delta")return i;let s=await t.determinePacketType(i);return s&&(i.type=s),i}):e,ft=class{constructor(e){if(!(e instanceof Dr))throw new TypeError("track must be an InputTrack.");this._track=e;}async getFirstPacket(e={}){if(sr(e),this._track.input._disposed)throw new ke;return Os(this._track,this._track._backing.getFirstPacket(e),e)}async getFirstKeyPacket(e={}){sr(e);let r=await this.getFirstPacket(e);return r?r.type==="key"?r:this.getNextKeyPacket(r,e):null}async getPacket(e,r={}){if(or(e),sr(r),this._track.input._disposed)throw new ke;return Os(this._track,this._track._backing.getPacket(e,r),r)}async getNextPacket(e,r={}){if(!(e instanceof de))throw new TypeError("packet must be an EncodedPacket.");if(sr(r),this._track.input._disposed)throw new ke;return Os(this._track,this._track._backing.getNextPacket(e,r),r)}async getKeyPacket(e,r={}){if(or(e),sr(r),this._track.input._disposed)throw new ke;if(!r.verifyKeyPackets)return this._track._backing.getKeyPacket(e,r);let i=await this._track._backing.getKeyPacket(e,r);return i&&(g(i.type==="key"),await this._track.determinePacketType(i)==="delta"?this.getKeyPacket(i.timestamp-1/await this._track.getTimeResolution(),r):i)}async getNextKeyPacket(e,r={}){if(!(e instanceof de))throw new TypeError("packet must be an EncodedPacket.");if(sr(r),this._track.input._disposed)throw new ke;if(!r.verifyKeyPackets)return this._track._backing.getNextKeyPacket(e,r);let i=await this._track._backing.getNextKeyPacket(e,r);return i&&(g(i.type==="key"),await this._track.determinePacketType(i)==="delta"?this.getNextKeyPacket(i,r):i)}packets(e,r,i={}){if(e!==void 0&&!(e instanceof de))throw new TypeError("startPacket must be an EncodedPacket.");if(e!==void 0&&e.isMetadataOnly&&!i?.metadataOnly)throw new TypeError("startPacket can only be metadata-only if options.metadataOnly is enabled.");if(r!==void 0&&!(r instanceof de))throw new TypeError("endPacket must be an EncodedPacket.");if(sr(i),this._track.input._disposed)throw new ke;let s=[],{promise:n,resolve:o}=he(),{promise:a,resolve:c}=he(),l=!1,u=!1,d=null,f=!1,m=[],p=()=>Math.max(2,m.length);(async()=>{let y=e??await this.getFirstPacket(i);for(;y&&!u&&!this._track.input._disposed&&!(r&&y.sequenceNumber>=r?.sequenceNumber);){if(s.length>p()){(({promise:a,resolve:c}=he())),await a;continue}s.push(y),o(),{promise:n,resolve:o}=he(),y=await this.getNextPacket(y,i);}l=!0,o();})().catch(y=>{f||(d=y,f=!0,o());});let b=this._track;return {async next(){for(;;){if(b.input._disposed)throw new ke;if(u)return {value:void 0,done:!0};if(f)throw d;if(s.length>0){let y=s.shift(),w=performance.now();for(m.push(w);m.length>0&&w-m[0]>=1e3;)m.shift();return c(),{value:y,done:!1}}else {if(l)return {value:void 0,done:!0};await n;}}},async return(){return u=!0,c(),o(),{value:void 0,done:!0}},async throw(y){throw y},[Symbol.asyncIterator](){return this}}}},Si=class{constructor(e,r){this.onSample=e,this.onError=r;}},Pn=class{mediaSamplesInRange(e=-1/0,r=1/0,i){or(e),or(r);let s=[],n=!1,o=null,{promise:a,resolve:c}=he(),{promise:l,resolve:u}=he(),d=!1,f=!1,m=!1,p=null,b=null,y=!1,w={...i,verifyKeyPackets:!0,metadataOnly:!1};(async()=>{p=await this._createDecoder(_=>{if(u(),_.timestamp>=r&&(f=!0),f){_.close();return}o&&(_.timestamp>e?(s.push(o),n=!0):o.close()),_.timestamp>=e&&(s.push(_),n=!0),o=n?null:_,s.length>0&&(c(),{promise:a,resolve:c}=he());},_=>{y||(b=_,y=!0,c());});let I=this._createPacketSink(),v=await I.getKeyPacket(e,w)??await I.getFirstKeyPacket(w),F=v,k=I.packets(v??void 0,void 0,w);for(await k.next();F&&!f&&!this._track.input._disposed;){let _=$a(s.length);if(s.length+p.getDecodeQueueSize()>_){(({promise:l,resolve:u}=he())),await l;continue}p.decode(F);let B=await k.next();if(B.done)break;F=B.value;}await k.return(),!m&&!this._track.input._disposed&&await p.flush(),!n&&o&&s.push(o),d=!0,c();})().catch(I=>{y||(b=I,y=!0,c());}).finally(()=>{p?.close();});let A=this._track,T=()=>{o?.close();for(let I of s)I.close();};return {async next(){for(;;){if(A.input._disposed)throw T(),new ke;if(m)return {value:void 0,done:!0};if(y)throw T(),b;if(s.length>0){let I=s.shift();return u(),{value:I,done:!1}}else if(!d)await a;else return {value:void 0,done:!0}}},async return(){return m=!0,f=!0,u(),c(),T(),{value:void 0,done:!0}},async throw(I){throw I},[Symbol.asyncIterator](){return this}}}mediaSamplesAtTimestamps(e,r){po(e);let i=mo(e),s=[],n=[],{promise:o,resolve:a}=he(),{promise:c,resolve:l}=he(),u=!1,d=!1,f=null,m=null,p=!1,b=T=>{n.push(T),a(),{promise:o,resolve:a}=he();},y={...r,verifyKeyPackets:!0,metadataOnly:!1};(async()=>{f=await this._createDecoder(_=>{if(l(),d){_.close();return}let B=0;for(;s.length>0&&_.timestamp-s[0]>-1e-10;)B++,s.shift();if(B>0)for(let z=0;z<B;z++)b(z<B-1?_.clone():_);else _.close();},_=>{p||(m=_,p=!0,a());});let T=this._createPacketSink(),I=null,v=null,F=-1,E=async()=>{g(v),g(f);let _=v;for(f.decode(_);_.sequenceNumber<F;){let B=$a(n.length);for(;n.length+f.getDecodeQueueSize()>B&&!d;)(({promise:c,resolve:l}=he())),await c;if(d)break;let z=await T.getNextPacket(_,y);g(z),f.decode(z),_=z;}F=-1;},k=async()=>{g(f),await f.flush();for(let _=0;_<s.length;_++)b(null);s.length=0;};for await(let _ of i){if(or(_),d||this._track.input._disposed)break;let B=await T.getPacket(_,y),z=B&&await T.getKeyPacket(_,y);if(!z){F!==-1&&(await E(),await k()),b(null),I=null;continue}I&&(z.sequenceNumber!==v.sequenceNumber||B.timestamp<I.timestamp)&&(await E(),await k()),s.push(B.timestamp),F=Math.max(B.sequenceNumber,F),I=B,v=z;}!d&&!this._track.input._disposed&&(F!==-1&&await E(),await k()),u=!0,a();})().catch(T=>{p||(m=T,p=!0,a());}).finally(()=>{f?.close();});let w=this._track,A=()=>{for(let T of n)T?.close();};return {async next(){for(;;){if(w.input._disposed)throw A(),new ke;if(d)return {value:void 0,done:!0};if(p)throw A(),m;if(n.length>0){let T=n.shift();return g(T!==void 0),l(),{value:T,done:!1}}else if(!u)await o;else return {value:void 0,done:!0}}},async return(){return d=!0,l(),a(),A(),{value:void 0,done:!0}},async throw(T){throw T},[Symbol.asyncIterator](){return this}}}},$a=t=>t===0?40:8,Vs=class extends Si{constructor(e,r,i,s,n,o){super(e,r),this.codec=i,this.decoderConfig=s,this.rotation=n,this.timeResolution=o,this.decoder=null,this.customDecoder=null,this.customDecoderCallSerializer=new zt,this.customDecoderQueueSize=0,this.inputTimestamps=[],this.sampleQueue=[],this.currentPacketIndex=0,this.raslSkipped=!1,this.alphaDecoder=null,this.alphaHadKeyframe=!1,this.colorQueue=[],this.alphaQueue=[],this.merger=null,this.decodedAlphaChunkCount=0,this.alphaDecoderQueueSize=0,this.nullAlphaFrameQueue=[],this.currentAlphaPacketIndex=0,this.alphaRaslSkipped=!1,this.finalSamples=[],this.mergeAlphaPromises=[];let a=vn.find(c=>c.supports(i,s));if(a)this.customDecoder=new a,this.customDecoder.codec=i,this.customDecoder.config=s,this.customDecoder.onSample=c=>{if(!(c instanceof Ke))throw new TypeError("The argument passed to onSample must be a VideoSample.");this.finalizeAndEmitSample(c);},this.customDecoder.onError=c=>{r(c);},this.customDecoderCallSerializer.call(()=>this.customDecoder.init()).catch(c=>r(c));else {let c=u=>{if(this.alphaQueue.length>0){let d=this.alphaQueue.shift();g(d!==void 0),this.mergeAlpha(u,d);}else this.colorQueue.push(u);};if(Zr()){if(i==="avc"&&this.decoderConfig.description){let u=Xi(Te(this.decoderConfig.description));if(u&&u.sequenceParameterSets.length>0){let d=ni(u.sequenceParameterSets[0]);d&&d.frameMbsOnlyFlag===0&&(this.decoderConfig={...this.decoderConfig,hardwareAcceleration:"prefer-software"});}}gr(this.decoderConfig.colorSpace)||(this.decoderConfig={...this.decoderConfig,colorSpace:{primaries:this.decoderConfig.colorSpace?.primaries??"bt709",matrix:this.decoderConfig.colorSpace?.matrix??"bt709",transfer:this.decoderConfig.colorSpace?.transfer??"bt709",fullRange:this.decoderConfig.colorSpace?.fullRange??!1}});}let l=new Error("Decoding error").stack;this.decoder=new VideoDecoder({output:u=>{try{c(u);}catch(d){this.onError(d);}},error:u=>{u.stack=l,this.onError(u);}}),this.decoder.configure(this.decoderConfig);}}getDecodeQueueSize(){return this.customDecoder?this.customDecoderQueueSize:(g(this.decoder),Math.max(this.decoder.decodeQueueSize,this.alphaDecoder?.decodeQueueSize??0))}decode(e){if(this.codec==="hevc"&&this.currentPacketIndex>0&&!this.raslSkipped){if(this.hasHevcRaslPicture(e.data))return;this.raslSkipped=!0;}if(this.customDecoder)this.customDecoderQueueSize++,this.customDecoderCallSerializer.call(()=>this.customDecoder.decode(e)).catch(r=>this.onError(r)).finally(()=>this.customDecoderQueueSize--);else {if(g(this.decoder),xt()||is(this.inputTimestamps,e.timestamp,r=>r),Zr()&&this.currentPacketIndex===0){if(this.codec==="avc"){let r=[],i=!1;for(let n of ds(e.data,this.decoderConfig)){let o=Ki(e.data[n.offset]);if(i||(i=o>=1&&o<=5),o===Ze.AUD){if(i)break;r.length=0;}o>=20&&o<=31||r.push(e.data.subarray(n.offset,n.offset+n.length));}let s=Ro(r,this.decoderConfig);e=new de(s,e.type,e.timestamp,e.duration);}else if(this.codec==="hevc"){let r=Oo(e.data,this.decoderConfig);r&&(e=new de(r,e.type,e.timestamp,e.duration));}}this.decoder.decode(e.toEncodedVideoChunk()),this.decodeAlphaData(e);}this.currentPacketIndex++;}decodeAlphaData(e){if(!e.sideData.alpha){this.pushNullAlphaFrame();return}if(this.merger||(this.merger=new Us),!this.alphaDecoder){let i=n=>{if(this.colorQueue.length>0){let o=this.colorQueue.shift();g(o!==void 0),this.mergeAlpha(o,n);}else this.alphaQueue.push(n);for(this.decodedAlphaChunkCount++;this.nullAlphaFrameQueue.length>0&&this.nullAlphaFrameQueue[0]===this.decodedAlphaChunkCount;)if(this.nullAlphaFrameQueue.shift(),this.colorQueue.length>0){let o=this.colorQueue.shift();g(o!==void 0),this.mergeAlpha(o,null);}else this.alphaQueue.push(null);this.alphaDecoderQueueSize--;},s=new Error("Decoding error").stack;this.alphaDecoder=new VideoDecoder({output:n=>{try{i(n);}catch(o){this.onError(o);}},error:n=>{n.stack=s,this.onError(n);}}),this.alphaDecoder.configure(this.decoderConfig);}let r=_r(this.codec,this.decoderConfig,e.sideData.alpha);if(this.alphaHadKeyframe||(this.alphaHadKeyframe=r==="key"),this.alphaHadKeyframe){if(this.codec==="hevc"&&this.currentAlphaPacketIndex>0&&!this.alphaRaslSkipped){if(this.hasHevcRaslPicture(e.sideData.alpha)){this.pushNullAlphaFrame();return}this.alphaRaslSkipped=!0;}this.currentAlphaPacketIndex++,this.alphaDecoder.decode(e.alphaToEncodedVideoChunk(r??e.type)),this.alphaDecoderQueueSize++;}else this.pushNullAlphaFrame();}pushNullAlphaFrame(){this.alphaDecoderQueueSize===0?this.alphaQueue.push(null):this.nullAlphaFrameQueue.push(this.decodedAlphaChunkCount+this.alphaDecoderQueueSize);}hasHevcRaslPicture(e){for(let r of ri(e,this.decoderConfig)){let i=Tr(e[r.offset]);if(i===Ce.RASL_N||i===Ce.RASL_R)return !0}return !1}sampleHandler(e){if(xt()){if(this.sampleQueue.length>0&&e.timestamp>=fe(this.sampleQueue).timestamp){for(let r of this.sampleQueue)this.finalizeAndEmitSample(r);this.sampleQueue.length=0;}is(this.sampleQueue,e,r=>r.timestamp);}else {let r=this.inputTimestamps.shift();g(r!==void 0),e.setTimestamp(r),this.finalizeAndEmitSample(e);}}finalizeAndEmitSample(e){e.setTimestamp(Math.round(e.timestamp*this.timeResolution)/this.timeResolution),e.setDuration(Math.round(e.duration*this.timeResolution)/this.timeResolution),e.setRotation(this.rotation),this.onSample(e);}async mergeAlpha(e,r){let i=he();this.mergeAlphaPromises.push(i.promise);let s={sample:null};this.finalSamples.push(s);try{if(!r)s.sample=new Ke(e);else {g(this.merger);let n=await this.merger.merge(e,r);s.sample=new Ke(n);}for(;this.finalSamples.length>0&&this.finalSamples[0].sample!==null;){let n=this.finalSamples.shift();this.sampleHandler(n.sample);}}catch(n){Qr(this.finalSamples,s),this.onError(n);}finally{Qr(this.mergeAlphaPromises,i.promise),i.resolve();}}async flush(){if(this.customDecoder?await this.customDecoderCallSerializer.call(()=>this.customDecoder.flush()):(g(this.decoder),await Promise.all([this.decoder.flush(),this.alphaDecoder?.flush()]),await Promise.all(this.mergeAlphaPromises),this.colorQueue.forEach(e=>e.close()),this.colorQueue.length=0,this.alphaQueue.forEach(e=>e?.close()),this.alphaQueue.length=0,this.alphaHadKeyframe=!1,this.decodedAlphaChunkCount=0,this.alphaDecoderQueueSize=0,this.nullAlphaFrameQueue.length=0,this.currentAlphaPacketIndex=0,this.alphaRaslSkipped=!1),xt()){for(let e of this.sampleQueue)this.finalizeAndEmitSample(e);this.sampleQueue.length=0;}this.currentPacketIndex=0,this.raslSkipped=!1;}close(){this.customDecoder?this.customDecoderCallSerializer.call(()=>this.customDecoder.close()):(g(this.decoder),this.decoder.state!=="closed"&&this.decoder.close(),this.alphaDecoder&&this.alphaDecoder.state!=="closed"&&this.alphaDecoder.close(),this.colorQueue.forEach(e=>e.close()),this.colorQueue.length=0,this.alphaQueue.forEach(e=>e?.close()),this.alphaQueue.length=0,this.merger?.close());for(let e of this.sampleQueue)e.close();this.sampleQueue.length=0;}},zs=null,Us=class{constructor(){this.workers=[],this.nextWorkerIndex=0,this.pendingRequests=new Map,this.nextRequestId=0;}merge(e,r){if(this.workers.length===0){if(!zs){let a=new Blob([`(${Pl.toString()})()`],{type:"application/javascript"});zs=URL.createObjectURL(a);}let o=ue(navigator.hardwareConcurrency,1,4);for(let a=0;a<o;a++){let c=new Worker(zs);c.addEventListener("message",l=>{let u=l.data,d=this.pendingRequests.get(u.id);d&&(this.pendingRequests.delete(u.id),"error"in u?d.reject(new Error(u.error)):d.resolve(u.frame));}),c.addEventListener("error",l=>{let u=new Error(l.message||"Color/alpha merge worker error.");for(let d of this.pendingRequests.values())d.reject(u);this.pendingRequests.clear();}),this.workers.push(c);}}let i=this.nextRequestId++,s=he();this.pendingRequests.set(i,s);let n=this.workers[this.nextWorkerIndex];return this.nextWorkerIndex=(this.nextWorkerIndex+1)%this.workers.length,n.postMessage({id:i,color:e,alpha:r},{transfer:[e,r]}),s.promise}close(){for(let r of this.workers)r.terminate();this.workers.length=0;let e=new Error("Color/alpha merger closed.");for(let r of this.pendingRequests.values())r.reject(e);this.pendingRequests.clear();}},Pl=()=>{let t=null,e=null,r=Promise.resolve();self.addEventListener("message",c=>{let{id:l,color:u,alpha:d}=c.data;r=r.then(async()=>{try{let f=await i(u,d);self.postMessage({id:l,frame:f},{transfer:[f]});}catch(f){self.postMessage({id:l,error:f.message});}finally{u.close(),d.close();}});});let i=async(c,l)=>{let u=c.format,d=l.format;if(!u||!d)throw new Error("CPU color/alpha merging requires a known VideoFrame format.");let f=u.includes("P10"),m=u.includes("P12"),p=d.includes("P10"),b=d.includes("P12");if(p!==f||b!==m)throw new Error(`CPU color/alpha merging requires the alpha frame to have the same bit depth as the color frame (color: '${u}', alpha: '${d}').`);if(u==="RGBX"||u==="RGBA"||u==="BGRX"||u==="BGRA")return await s(c,l,u);if(u==="I420"||u==="I420P10"||u==="I420P12"||u==="I422"||u==="I422P10"||u==="I422P12"||u==="I444"||u==="I444P10"||u==="I444P12")return await n(c,l,u);if(u==="NV12")return await o(c,l);throw new Error(`CPU color/alpha merging does not support format '${u}'.`)},s=async(c,l,u)=>{let d=c.visibleRect?.width??c.codedWidth,f=c.visibleRect?.height??c.codedHeight,m=d*f,p=new Uint8Array(m*4);await c.copyTo(p);let b=await a(l,d,f,1);for(let A=0,T=3;A<m;A++,T+=4)p[T]=b[A];let w={format:u==="RGBX"||u==="RGBA"?"RGBA":"BGRA",codedWidth:d,codedHeight:f,timestamp:c.timestamp,duration:c.duration??void 0,transfer:[p.buffer]};return new VideoFrame(p,w)},n=async(c,l,u)=>{let d=c.visibleRect?.width??c.codedWidth,f=c.visibleRect?.height??c.codedHeight,m=u.includes("P10"),p=u.includes("P12"),b=m||p?2:1,y,w;u.startsWith("I420")?(y=Math.ceil(d/2),w=Math.ceil(f/2)):u.startsWith("I422")?(y=Math.ceil(d/2),w=f):(y=d,w=f);let A=d*f,T=y*w,I=A*b,v=T*b,F=A*b,E=I+2*v+F,k=new Uint8Array(E);await c.copyTo(k);let _=await a(l,d,f,b),B=I+2*v;k.set(_,B);let N={format:u.slice(0,4)+"A"+u.slice(4),codedWidth:d,codedHeight:f,timestamp:c.timestamp,duration:c.duration??void 0,transfer:[k.buffer]};return new VideoFrame(k,N)},o=async(c,l)=>{let u=c.visibleRect?.width??c.codedWidth,d=c.visibleRect?.height??c.codedHeight,f=u*d,m=Math.ceil(u/2),p=Math.ceil(d/2),b=m*p,y=c.allocationSize();(!e||e.byteLength!==y)&&(e=new Uint8Array(y)),await c.copyTo(e);let w=new Uint8Array(f+2*b+f);w.set(e.subarray(0,f),0);let A=f,T=f+b,I=f;for(let E=0;E<b;E++)w[A+E]=e[I+E*2],w[T+E]=e[I+E*2+1];let v=await a(l,u,d,1);w.set(v,f+2*b);let F={format:"I420A",codedWidth:u,codedHeight:d,timestamp:c.timestamp,duration:c.duration??void 0,transfer:[w.buffer]};return new VideoFrame(w,F)},a=async(c,l,u,d)=>{let f=c.allocationSize();(!t||t.byteLength!==f)&&(t=new Uint8Array(f)),await c.copyTo(t);let m=c.format;if(m==="RGBA"||m==="BGRA"||m==="RGBX"||m==="BGRX"){let p=m==="RGBA"||m==="RGBX"?0:2,b=l*u;for(let y=0;y<b;y++)t[y]=t[y*4+p];return t.subarray(0,b)}else return t.subarray(0,l*u*d)};},Rl=t=>{if(!t||typeof t!="object")throw new TypeError("decoderOptions must be an object.");if(t.hardwareAcceleration!==void 0&&!["no-preference","prefer-hardware","prefer-software"].includes(t.hardwareAcceleration))throw new TypeError("decoderOptions.hardwareAcceleration, when provided, must be 'no-preference', 'prefer-hardware' or 'prefer-software'.");if(t.optimizeForLatency!==void 0&&typeof t.optimizeForLatency!="boolean")throw new TypeError("decoderOptions.optimizeForLatency, when provided, must be a boolean.")},xi=class extends Pn{constructor(e,r={}){if(!(e instanceof ar))throw new TypeError("videoTrack must be an InputVideoTrack.");Rl(r),super(),this._track=e,this._decoderOptions=r;}async _createDecoder(e,r){if(!await this._track.canDecode())throw typeof VideoDecoder>"u"?new Error(yr("VideoDecoder")):new Error("This video track cannot be decoded in this environment. Make sure to check decodability before using a track.");let i=await this._track.getCodec(),s=await this._track.getRotation(),n=await this._track.getDecoderConfig(),o=await this._track.getTimeResolution();return g(i&&n),n={...n,hardwareAcceleration:this._decoderOptions.hardwareAcceleration,optimizeForLatency:this._decoderOptions.optimizeForLatency},new Vs(e,r,i,n,s,o)}_createPacketSink(){return new ft(this._track)}async getSample(e,r={}){or(e);for await(let i of this.mediaSamplesAtTimestamps([e],r))return i;throw new Error("Internal error: Iterator returned nothing.")}samples(e,r,i={}){return this.mediaSamplesInRange(e,r,i)}samplesAtTimestamps(e,r={}){return this.mediaSamplesAtTimestamps(e,r)}};var Ns=class extends Si{constructor(e,r,i,s){super(e,r),this.decoder=null,this.customDecoder=null,this.customDecoderCallSerializer=new zt,this.customDecoderQueueSize=0,this.currentTimestamp=null,this.expectedFirstTimestamp=null,this.timestampOffset=0;let n=a=>{let c=a.timestamp;this.expectedFirstTimestamp!==null&&this.currentTimestamp===null&&(this.timestampOffset=this.expectedFirstTimestamp-c),c+=this.timestampOffset,(this.currentTimestamp===null||Math.abs(c-this.currentTimestamp)>=a.duration)&&(this.currentTimestamp=c);let l=this.currentTimestamp;if(this.currentTimestamp+=a.duration,a.numberOfFrames===0){a.close();return}let u=s.sampleRate;a.setTimestamp(Math.round(l*u)/u),e(a);},o=In.find(a=>a.supports(i,s));if(o)this.customDecoder=new o,this.customDecoder.codec=i,this.customDecoder.config=s,this.customDecoder.onSample=a=>{if(!(a instanceof Fe))throw new TypeError("The argument passed to onSample must be an AudioSample.");n(a);},this.customDecoder.onError=a=>{r(a);},this.customDecoderCallSerializer.call(()=>this.customDecoder.init()).catch(a=>r(a));else {let a=new Error("Decoding error").stack;this.decoder=new AudioDecoder({output:c=>{try{n(new Fe(c));}catch(l){this.onError(l);}},error:c=>{c.stack=a,this.onError(c);}}),this.decoder.configure(s);}}getDecodeQueueSize(){return this.customDecoder?this.customDecoderQueueSize:(g(this.decoder),this.decoder.decodeQueueSize)}decode(e){this.customDecoder?(this.customDecoderQueueSize++,this.customDecoderCallSerializer.call(()=>this.customDecoder.decode(e)).catch(r=>this.onError(r)).finally(()=>this.customDecoderQueueSize--)):(g(this.decoder),this.expectedFirstTimestamp??(this.expectedFirstTimestamp=e.timestamp),this.decoder.decode(e.toEncodedAudioChunk()));}async flush(){this.customDecoder?await this.customDecoderCallSerializer.call(()=>this.customDecoder.flush()):(g(this.decoder),await this.decoder.flush()),this.currentTimestamp=null,this.expectedFirstTimestamp=null,this.timestampOffset=0;}close(){this.customDecoder?this.customDecoderCallSerializer.call(()=>this.customDecoder.close()):(g(this.decoder),this.decoder.state!=="closed"&&this.decoder.close());}},Ws=class extends Si{constructor(e,r,i){super(e,r),this.decoderConfig=i,this.currentTimestamp=null,g(Ae.includes(i.codec)),this.codec=i.codec;let{dataType:s,sampleSize:n,littleEndian:o}=Ve(this.codec);switch(this.inputSampleSize=n,n){case 1:s==="unsigned"?this.readInputValue=(a,c)=>a.getUint8(c)-2**7:s==="signed"?this.readInputValue=(a,c)=>a.getInt8(c):s==="ulaw"?this.readInputValue=(a,c)=>Qa(a.getUint8(c)):s==="alaw"?this.readInputValue=(a,c)=>Ga(a.getUint8(c)):g(!1);break;case 2:s==="unsigned"?this.readInputValue=(a,c)=>a.getUint16(c,o)-2**15:s==="signed"?this.readInputValue=(a,c)=>a.getInt16(c,o):g(!1);break;case 3:s==="unsigned"?this.readInputValue=(a,c)=>Yt(a,c,o)-2**23:s==="signed"?this.readInputValue=(a,c)=>go(a,c,o):g(!1);break;case 4:s==="unsigned"?this.readInputValue=(a,c)=>a.getUint32(c,o)-2**31:s==="signed"?this.readInputValue=(a,c)=>a.getInt32(c,o):s==="float"?this.readInputValue=(a,c)=>a.getFloat32(c,o):g(!1);break;case 8:s==="float"?this.readInputValue=(a,c)=>a.getFloat64(c,o):g(!1);break;default:xe(n),g(!1);}switch(n){case 1:s==="ulaw"||s==="alaw"?(this.outputSampleSize=2,this.outputFormat="s16",this.writeOutputValue=(a,c,l)=>a.setInt16(c,l,!0)):(this.outputSampleSize=1,this.outputFormat="u8",this.writeOutputValue=(a,c,l)=>a.setUint8(c,l+2**7));break;case 2:this.outputSampleSize=2,this.outputFormat="s16",this.writeOutputValue=(a,c,l)=>a.setInt16(c,l,!0);break;case 3:this.outputSampleSize=4,this.outputFormat="s32",this.writeOutputValue=(a,c,l)=>a.setInt32(c,l<<8,!0);break;case 4:this.outputSampleSize=4,s==="float"?(this.outputFormat="f32",this.writeOutputValue=(a,c,l)=>a.setFloat32(c,l,!0)):(this.outputFormat="s32",this.writeOutputValue=(a,c,l)=>a.setInt32(c,l,!0));break;case 8:this.outputSampleSize=4,this.outputFormat="f32",this.writeOutputValue=(a,c,l)=>a.setFloat32(c,l,!0);break;default:xe(n),g(!1);}}getDecodeQueueSize(){return 0}decode(e){let r=ie(e.data),i=e.byteLength/this.decoderConfig.numberOfChannels/this.inputSampleSize,s=i*this.decoderConfig.numberOfChannels*this.outputSampleSize,n=new ArrayBuffer(s),o=new DataView(n);for(let u=0;u<i*this.decoderConfig.numberOfChannels;u++){let d=u*this.inputSampleSize,f=u*this.outputSampleSize,m=this.readInputValue(r,d);this.writeOutputValue(o,f,m);}let a=i/this.decoderConfig.sampleRate;(this.currentTimestamp===null||Math.abs(e.timestamp-this.currentTimestamp)>=a)&&(this.currentTimestamp=e.timestamp);let c=this.currentTimestamp;this.currentTimestamp+=a;let l=new Fe({format:this.outputFormat,data:n,numberOfChannels:this.decoderConfig.numberOfChannels,sampleRate:this.decoderConfig.sampleRate,numberOfFrames:i,timestamp:c});this.onSample(l);}async flush(){}close(){}},Rn=class extends Pn{constructor(e){if(!(e instanceof cr))throw new TypeError("audioTrack must be an InputAudioTrack.");super(),this._track=e;}async _createDecoder(e,r){if(!await this._track.canDecode())throw typeof AudioDecoder>"u"?new Error(yr("AudioDecoder")):new Error("This audio track cannot be decoded in this environment. Make sure to check decodability before using a track.");let i=await this._track.getCodec(),s=await this._track.getDecoderConfig();return g(i&&s),Ae.includes(s.codec)?new Ws(e,r,s):new Ns(e,r,i,s)}_createPacketSink(){return new ft(this._track)}async getSample(e,r={}){or(e);for await(let i of this.mediaSamplesAtTimestamps([e],r))return i;throw new Error("Internal error: Iterator returned nothing.")}samples(e,r,i={}){return this.mediaSamplesInRange(e,r,i)}samplesAtTimestamps(e,r={}){return this.mediaSamplesAtTimestamps(e,r)}};var Dr=class t{constructor(e,r){this.input=e,this._backing=r;}isVideoTrack(){return this instanceof ar}isAudioTrack(){return this instanceof cr}get id(){return this._backing.getId()}get number(){return this._backing.getNumber()}async getInternalCodecId(){return this._backing.getInternalCodecId()}get internalCodecId(){return we(this._backing.getInternalCodecId(),"internalCodecId","getInternalCodecId")}async getLanguageCode(){return this._backing.getLanguageCode()}get languageCode(){return we(this._backing.getLanguageCode(),"languageCode","getLanguageCode")}async getName(){return this._backing.getName()}get name(){return we(this._backing.getName(),"name","getName")}async getTimeResolution(){return this._backing.getTimeResolution()}get timeResolution(){return we(this._backing.getTimeResolution(),"timeResolution","getTimeResolution")}async isRelativeToUnixEpoch(){return this._backing.isRelativeToUnixEpoch()}async getUnixTimeForTimestamp(e){return this._backing.getUnixTimeForTimestamp(e)}async hasUnixTimeMapping(){return await this._backing.getUnixTimeForTimestamp(await this.getFirstTimestamp())!==null}async getDisposition(){return this._backing.getDisposition()}get disposition(){return we(this._backing.getDisposition(),"disposition","getDisposition")}async getBitrate(){return this._backing.getBitrate()}async getAverageBitrate(){return this._backing.getAverageBitrate()}async getFirstTimestamp(){return (await this._backing.getFirstPacket({metadataOnly:!0}))?.timestamp??0}async computeDuration(e){let r=await this._backing.getPacket(1/0,{metadataOnly:!0,...e}),i=(r?.timestamp??0)+(r?.duration??0);return $r(i,await this.getTimeResolution())}async getDurationFromMetadata(e={}){return this._backing.getDurationFromMetadata(e)}async computePacketStats(e=1/0,r){let i=new ft(this),s=1/0,n=-1/0,o=0,a=0;for await(let c of i.packets(void 0,void 0,{metadataOnly:!0,...r})){if(o>=e&&c.timestamp>=n)break;s=Math.min(s,c.timestamp),n=Math.max(n,c.timestamp+c.duration),o++,a+=c.byteLength;}return {packetCount:o,averagePacketRate:o?Number((o/(n-s)).toPrecision(16)):0,averageBitrate:o?Number((8*a/(n-s)).toPrecision(16)):0}}async isLive(){return await this._backing.getLiveRefreshInterval()!==null}async getLiveRefreshInterval(){return this._backing.getLiveRefreshInterval()}canBePairedWith(e){if(!(e instanceof t))throw new TypeError("other must be an InputTrack.");return this.input!==e.input||this===e?!1:(this._backing.getPairingMask()&e._backing.getPairingMask())!==0n}async getPairableTracks(e){return this.input.getTracks(Gt({filter:r=>r.canBePairedWith(this)},e))}async getPairableVideoTracks(e){return this.input.getVideoTracks(Gt({filter:r=>r.canBePairedWith(this)},e))}async getPairableAudioTracks(e){return this.input.getAudioTracks(Gt({filter:r=>r.canBePairedWith(this)},e))}async getPrimaryPairableVideoTrack(e){return this.input.getPrimaryVideoTrack(Gt({filter:r=>r.canBePairedWith(this)},e))}async getPrimaryPairableAudioTrack(e){return this.input.getPrimaryAudioTrack(Gt({filter:r=>r.canBePairedWith(this)},e))}async hasPairableTrack(e){e&&(e=qs(e));let r=await this.input.getTracks();for(let i of r)if(this.canBePairedWith(i)&&(!e||await e(i)))return !0;return !1}hasPairableVideoTrack(e){return e&&(e=qs(e)),this.hasPairableTrack(async r=>r.isVideoTrack()&&(!e||await e(r)))}hasPairableAudioTrack(e){return e&&(e=qs(e)),this.hasPairableTrack(async r=>r.isAudioTrack()&&(!e||await e(r)))}},we=(t,e,r)=>{if(U(t))throw new Error(`'${e}' is deprecated and not available synchronously for this track. Use the preferred '${r}()' instead.`);return t},qs=t=>{if(t!==void 0&&typeof t!="function")throw new TypeError("predicate, when provided, must be a function.");return t?e=>{let r=s=>{if(typeof s!="boolean")throw new TypeError("predicate must return or resolve to a boolean value.");return s},i=t(e);return U(i)?i.then(r):r(i)}:void 0},ar=class extends Dr{constructor(e,r){super(e,r),this._pixelAspectRatioCache=null,this._backing=r;}get type(){return "video"}async getCodec(){return this._backing.getCodec()}get codec(){return we(this._backing.getCodec(),"codec","getCodec")}async hasOnlyKeyPackets(){return await this._backing.getHasOnlyKeyPackets?.()??await this._backing.getCodec()==="prores"}async getCodedWidth(){return this._backing.getCodedWidth()}get codedWidth(){return we(this._backing.getCodedWidth(),"codedWidth","getCodedWidth")}async getCodedHeight(){return this._backing.getCodedHeight()}get codedHeight(){return we(this._backing.getCodedHeight(),"codedHeight","getCodedHeight")}async getRotation(){return this._backing.getRotation()}get rotation(){return we(this._backing.getRotation(),"rotation","getRotation")}async getSquarePixelWidth(){return this._backing.getSquarePixelWidth()}get squarePixelWidth(){return we(this._backing.getSquarePixelWidth(),"squarePixelWidth","getSquarePixelWidth")}async getSquarePixelHeight(){return this._backing.getSquarePixelHeight()}get squarePixelHeight(){return we(this._backing.getSquarePixelHeight(),"squarePixelHeight","getSquarePixelHeight")}async getPixelAspectRatio(){return this._pixelAspectRatioCache??(this._pixelAspectRatioCache=Wt({num:await this.getSquarePixelWidth()*await this.getCodedHeight(),den:await this.getSquarePixelHeight()*await this.getCodedWidth()}))}get pixelAspectRatio(){return this._pixelAspectRatioCache??(this._pixelAspectRatioCache=Wt({num:we(this._backing.getSquarePixelWidth(),"pixelAspectRatio","getPixelAspectRatio")*we(this._backing.getCodedHeight(),"pixelAspectRatio","getPixelAspectRatio"),den:we(this._backing.getSquarePixelHeight(),"pixelAspectRatio","getPixelAspectRatio")*we(this._backing.getCodedWidth(),"pixelAspectRatio","getPixelAspectRatio")}))}async getDisplayWidth(){let e=await this._backing.getMetadataDisplayWidth?.();return e??(await this.getRotation()%180===0?this.getSquarePixelWidth():this.getSquarePixelHeight())}get displayWidth(){let e=this._backing.getMetadataDisplayWidth?.();if(e!==void 0){let s=we(e,"displayWidth","getDisplayWidth");if(s!==null)return s}let i=we(this._backing.getRotation(),"displayWidth","getDisplayWidth")%180===0?this._backing.getSquarePixelWidth():this._backing.getSquarePixelHeight();return we(i,"displayWidth","getDisplayWidth")}async getDisplayHeight(){let e=await this._backing.getMetadataDisplayHeight?.();return e??(await this.getRotation()%180===0?this.getSquarePixelHeight():this.getSquarePixelWidth())}get displayHeight(){let e=this._backing.getMetadataDisplayHeight?.();if(e!==void 0){let s=we(e,"displayHeight","getDisplayHeight");if(s!==null)return s}let i=we(this._backing.getRotation(),"displayHeight","getDisplayHeight")%180===0?this._backing.getSquarePixelHeight():this._backing.getSquarePixelWidth();return we(i,"displayHeight","getDisplayHeight")}async getColorSpace(){return this._backing.getColorSpace()}async hasHighDynamicRange(){let e=await this._backing.getColorSpace();return e.primaries==="bt2020"||e.primaries==="smpte432"||e.transfer==="pq"||e.transfer==="hlg"||e.matrix==="bt2020-ncl"}async canBeTransparent(){return this._backing.canBeTransparent()}async getDecoderConfig(){return this._backing.getDecoderConfig()}async getCodecParameterString(){let e=await this._backing.getMetadataCodecParameterString?.();return e??(await this._backing.getDecoderConfig())?.codec??null}async canDecode(){try{let e=await this._backing.getDecoderConfig();if(!e)return !1;let r=await this._backing.getCodec();return g(r!==null),vn.some(s=>s.supports(r,e))?!0:typeof VideoDecoder>"u"?!1:(await VideoDecoder.isConfigSupported(e)).supported===!0}catch(e){return K._error("Error during decodability check:",e),!1}}async determinePacketType(e){if(!(e instanceof de))throw new TypeError("packet must be an EncodedPacket.");if(e.isMetadataOnly)throw new TypeError("packet must not be metadata-only to determine its type.");let r=await this.getCodec();if(r===null)return null;let i=await this.getDecoderConfig();return g(i),_r(r,i,e.data)}async computeFrameRateMetrics(e={}){if(!e||typeof e!="object")throw new TypeError("options must be an object.");if(e.targetPacketCount!==void 0&&(!Nt(e.targetPacketCount)||e.targetPacketCount<0))throw new TypeError("options.targetPacketCount must be a non-negative number.");let r=await this.getTimeResolution(),i=e.targetPacketCount??256,s=new ft(this),n=[],o=-1/0,a=0;for await(let B of s.packets(void 0,void 0,{metadataOnly:!0})){if(n.length>=i&&B.timestamp>=o)break;n.push(B.timestamp),o=Math.max(o,B.timestamp),a++;}let c=new Float64Array(n.length);for(let B=0;B<n.length;B++)c[B]=Math.round(n[B]*r);c.sort();let l=1;for(let B=1;B<c.length;B++)c[B]!==c[l-1]&&(c[l++]=c[B]);if(l<2)return {underlyingFrameRate:null,bestGuessFrameRate:r,minFrameRate:r,maxFrameRate:r,averageFrameRate:r,medianFrameRate:r,frameRateIsConstant:!0,probedPacketCount:a};let u=c.subarray(0,l),d=Fl(u,r),f=d??r,m=d!==null?r/d:null,p=new Map,b=1/0,y=-1/0,w=0;for(let B=1;B<l;B++){let z=u[B]-u[B-1],N=m!==null?Math.max(1,Math.round(z/m)):z;p.set(N,(p.get(N)??0)+1),b=Math.min(b,N),y=Math.max(y,N),w+=N;}let A=l-1,T=[...p.keys()].sort((B,z)=>B-z),I=A-1>>1,v=A>>1,F=0,E=0,k=0;for(let B of T)if(k+=p.get(B),F===0&&k>I&&(F=B),k>v){E=B;break}let _=(f/F+f/E)/2;return {underlyingFrameRate:d,bestGuessFrameRate:d!==null?d:Bl(_),minFrameRate:f/y,maxFrameRate:f/b,averageFrameRate:f*A/w,medianFrameRate:_,frameRateIsConstant:d!==null&&b===1&&y===1,probedPacketCount:a}}},cr=class extends Dr{constructor(e,r){super(e,r),this._backing=r;}get type(){return "audio"}async getCodec(){return this._backing.getCodec()}get codec(){return we(this._backing.getCodec(),"codec","getCodec")}async hasOnlyKeyPackets(){return await this._backing.getHasOnlyKeyPackets?.()??!0}async getNumberOfChannels(){return this._backing.getNumberOfChannels()}get numberOfChannels(){return we(this._backing.getNumberOfChannels(),"numberOfChannels","getNumberOfChannels")}async getSampleRate(){return this._backing.getSampleRate()}get sampleRate(){return we(this._backing.getSampleRate(),"sampleRate","getSampleRate")}async getDecoderConfig(){return this._backing.getDecoderConfig()}async getCodecParameterString(){let e=await this._backing.getMetadataCodecParameterString?.();return e??(await this._backing.getDecoderConfig())?.codec??null}async canDecode(){try{let e=await this._backing.getDecoderConfig();if(!e)return !1;let r=await this._backing.getCodec();return g(r!==null),In.some(i=>i.supports(r,e))||e.codec.startsWith("pcm-")?!0:typeof AudioDecoder>"u"?!1:(await AudioDecoder.isConfigSupported(e)).supported===!0}catch(e){return K._error("Error during decodability check:",e),!1}}async determinePacketType(e){if(!(e instanceof de))throw new TypeError("packet must be an EncodedPacket.");return await this.getCodec()===null?null:"key"}};var Ls=t=>-(t??-1/0),Or=t=>-t,zr=t=>{if(typeof t!="object"||!t)throw new TypeError("query must be an object.");if(t.filter!==void 0&&typeof t.filter!="function")throw new TypeError("query.filter, when provided, must be a function.");if(t.sortBy!==void 0&&typeof t.sortBy!="function")throw new TypeError("query.sortBy, when provided, must be a function.");return {filter:t.filter?e=>{let r=s=>{if(typeof s!="boolean")throw new TypeError("query.filter must return or resolve to a boolean.");return s},i=t.filter(e);return U(i)?i.then(r):r(i)}:void 0,sortBy:t.sortBy?e=>{let r=s=>{if(typeof s!="number"&&(!Array.isArray(s)||!s.every(n=>typeof n=="number")))throw new TypeError("query.sortBy must return or resolve to a number or an array of numbers.");return s},i=t.sortBy(e);return U(i)?i.then(r):r(i)}:void 0}},Gt=(t,e)=>({filter:t?.filter||e?.filter?r=>{let i=t?.filter?.(r)??!0,s=n=>n===!1?!1:e?.filter?.(r)??!0;return U(i)?i.then(s):s(i)}:void 0,sortBy:t?.sortBy||e?.sortBy?r=>{let i=t?.sortBy?.(r)??[],s=e?.sortBy?.(r)??[],n=(o,a)=>[...Array.isArray(o)?o:[o],...Array.isArray(a)?a:[a]];return U(i)||U(s)?Promise.all([i,s]).then(([o,a])=>n(o,a)):n(i,s)}:void 0}),Fn=async(t,e)=>{let r=t;if(e?.filter){let o=t.map(c=>e.filter(c));if(o.some(c=>U(c))){let c=await Promise.all(o);r=t.filter((l,u)=>c[u]);}else r=t.filter((c,l)=>o[l]);}if(!e?.sortBy)return r;let i=r.map(o=>e.sortBy(o)),n=i.some(o=>U(o))?await Promise.all(i):i;return r.map((o,a)=>({track:o,sortValue:n[a]})).sort((o,a)=>{let c=Array.isArray(o.sortValue)?o.sortValue:[o.sortValue],l=Array.isArray(a.sortValue)?a.sortValue:[a.sortValue],u=Math.max(c.length,l.length);for(let d=0;d<u;d++){let f=c[d]??0,m=l[d]??0;if(f!==m)return f-m}return 0}).map(o=>o.track)},Fl=(t,e)=>{let s=1.000000001,n=1e3,o=[12,15,20,24e3/1001,24,25,3e4/1001,30,48,50,6e4/1001,60,100,12e4/1001,120,144,240];if(t.length<2)return null;let a=new Float64Array(t.length-1);for(let E=1;E<t.length;E++){let k=t[E]-t[E-1];if(!(k>0))return null;a[E-1]=k;}let c=a.slice();c.sort();let l=c[Math.floor(c.length*.05)];for(let E=0;E<6;E++){let k=0,_=0;for(let z of a){let N=Math.max(1,Math.round(z/l));Math.abs(z-N*l)>=s||(k+=z,_+=N);}if(_===0)return null;let B=k/_;if(Math.abs(B-l)<=1e-12*Math.max(1,l)){l=B;break}l=B;}let u=0,d=0,f=0;for(let E of a){let k=Math.max(1,Math.round(E/l));Math.abs(E-k*l)>=s||(u++,d+=E,f+=k);}if(u/a.length<.98)return null;l=d/f;let m=1/Math.min(f,n),p=Math.max(Number.EPSILON,l-m),b=l+m,y=e/b,w=e/p,A=e/l,T=null,I=1/0;for(let E of o){if(E<y||E>w)continue;let k=Math.abs(E/A-1);k<I&&(T=E,I=k);}if(T===null){let E=Xa(p,b,1e6),k=Xa(y,w,1e6);if(k&&(!E||k.den<E.den||k.den===E.den&&k.num<=E.num))T=k.num/k.den;else if(E)T=e*E.den/E.num;else return null}let v=e/T,F=0;for(let E of a){let k=Math.max(1,Math.round(E/v));Math.abs(E-k*v)<s&&F++;}return F/a.length<.98?null:T},Xa=(t,e,r)=>{for(let i=1;i<=r;i++){let s=Math.floor(t*i)+1;if(s/i<e)return Wt({num:s,den:i})}return null},Bl=t=>{let e=[23.976023976023978,29.970029970029973,59.940059940059946,119.88011988011989],r=[12,15,20,24,25,30,48,50,60,100,120,144,240],i=5e-4,s=.025;for(let a of e)if(Math.abs(a/t-1)<=i)return a;let n=t,o=1/0;for(let a of r){let c=Math.abs(a/t-1);c<=s&&c<o&&(n=a,o=c);}return n};br();var Ml=1;var lr=class t extends He{get disposed(){return this._disposed}constructor(e){if(super(),this._demuxerPromise=null,this._format=null,this._trackBackingsCache=null,this._backingToTrack=new Map,this._disposed=!1,this._nextSourceCacheAge=0,this._sourceRefs=[],this._sourceCache=[],this._sourceCachePromises=[],this._onFormatDetermined=null,!e||typeof e!="object")throw new TypeError("options must be an object.");if(!Array.isArray(e.formats)||e.formats.some(r=>!(r instanceof tr)))throw new TypeError("options.formats must be an array of InputFormat.");if(!(e.source instanceof Qe||e.source instanceof er))throw new TypeError("options.source must be a Source or SourceRef.");if(e.source instanceof Qe&&e.source._disposed)throw new TypeError("options.source must not be a disposed Source.");if(e.initInput!==void 0&&!(e.initInput instanceof t))throw new TypeError("options.initInput, when provided, must be an Input.");e.formatOptions!==void 0&&_a(e.formatOptions,"formatOptions"),this._formats=e.formats,this._initInput=e.initInput??null,this._formatOptions=e.formatOptions??{},e.source instanceof Qe?this._rootRef=e.source.ref():this._rootRef=e.source,this._sourceRefs.push(this._rootRef);}get _rootSource(){return this._rootRef.source}async _getSourceUncached(e){g(this._rootSource instanceof di);let r=await this._rootSource._resolveRequest(e);return this._emit("source",{source:r.source,request:e,isRoot:e.isRoot}),r}_getSourceCached(e,r=Ml){let i=this._sourceCache.find(o=>o.cacheGroup===r&&Is(o.request,e));if(i)return i.age++,Promise.resolve(i.sourceRef.source.ref());let s=this._sourceCachePromises.find(o=>o.cacheGroup===r&&Is(o.request,e));if(s)return s.promise.then(o=>o.sourceRef.source.ref());let n=(async()=>{let o=await this._getSourceUncached(e);if(To(this._sourceCache,d=>d.cacheGroup===r&&d.sourceRef.source._refCount===1)>=4){let d=Ui(this._sourceCache,m=>m.cacheGroup===r&&m.sourceRef.source._refCount===1?m.age:1/0);g(d!==-1);let f=this._sourceCache[d];this._sourceCache.splice(d,1),f.sourceRef.free(),Qr(this._sourceRefs,f.sourceRef);}this._sourceRefs.push(o);let l=this._sourceCachePromises.findIndex(d=>d.request===e);return g(l!==-1),this._sourceCachePromises.splice(l,1),{request:e,sourceRef:o,age:this._nextSourceCacheAge++,cacheGroup:r}})();return this._sourceCachePromises.push({request:e,cacheGroup:r,promise:n}),n.then(o=>{let a=o.sourceRef.source.ref();return this._sourceCache.push(o),a})}_getDemuxer(){return this._demuxerPromise??(this._demuxerPromise=(async()=>{this._reader=new Bn(this._rootSource),this._emit("source",{source:this._rootSource,request:null,isRoot:!0});for(let e of this._formats)if(await e._canReadInput(this))return this._format=e,this._onFormatDetermined?.(e),e._createDemuxer(this);throw new _i})())}get source(){return this._rootSource}async getFormat(){return await this._getDemuxer(),g(this._format),this._format}async canRead(){try{return await this._getDemuxer(),!0}catch(e){if(e instanceof _i)return !1;throw e}}async getFirstTimestamp(e){e??(e=await this.getTracks());let r=e.filter(n=>n!==null);if(r.length===0)return 0;let i=await Promise.all(r.map(n=>n._backing.getFirstPacket({metadataOnly:!0}))),s=Math.min(...i.map(n=>n?.timestamp??1/0));return s===1/0?0:s}async computeDuration(e,r){e??(e=await this.getTracks());let i=e.filter(n=>n!==null);if(i.length===0)return 0;let s=await Promise.all(i.map(n=>n.computeDuration(r)));return Math.max(...s)}async getDurationFromMetadata(e,r){e??(e=await this.getTracks());let i=e.filter(o=>o!==null),n=(await Promise.all(i.map(o=>o.getDurationFromMetadata(r)))).filter(o=>o!==null);return n.length===0?null:Math.max(...n)}async getTracks(e){e&&(e=zr(e));let i=(await this._getTrackBackings()).map(s=>this._wrapBackingAsTrack(s));return Fn(i,e)}async getVideoTracks(e){e&&(e=zr(e));let i=(await this.getTracks()).filter(s=>s.isVideoTrack());return Fn(i,e)}async getAudioTracks(e){e&&(e=zr(e));let i=(await this.getTracks()).filter(s=>s.isAudioTrack());return Fn(i,e)}async getPrimaryVideoTrack(e){e&&(e=zr(e));let r=Gt(e,{sortBy:async s=>[Or((await s.getDisposition()).default),Or(await s.hasPairableAudioTrack()),Or(!await s.hasOnlyKeyPackets()),Ls(await s.getBitrate())]});return (await this.getVideoTracks(r))[0]??null}async getPrimaryAudioTrack(e){e&&(e=zr(e));let r=await this.getPrimaryVideoTrack(),i=Gt(e,{sortBy:async n=>[Or(!r||n.canBePairedWith(r)),Or((await n.getDisposition()).default),Ls(await n.getBitrate())]});return (await this.getAudioTracks(i))[0]??null}async _getTrackBackings(){let e=await this._getDemuxer();return this._trackBackingsCache??(this._trackBackingsCache=await e.getTrackBackings())}_wrapBackingAsTrack(e){let r=this._backingToTrack.get(e);if(r)return r;let s=e.getType()==="video"?new ar(this,e):new cr(this,e);return this._backingToTrack.set(e,s),s}async getMimeType(){return (await this._getDemuxer()).getMimeType()}async getMetadataTags(){return (await this._getDemuxer()).getMetadataTags()}dispose(){if(!this._disposed){this._disposed=!0;for(let e of this._sourceRefs)e.free();this._sourceRefs.length=0,this._demuxerPromise&&this._demuxerPromise.then(e=>e.dispose()).catch(()=>{});}}[Symbol.dispose](){this.dispose();}},_i=class extends Error{constructor(e="Input has an unsupported or unrecognizable format."){super(e),this.name="UnsupportedInputFormatError";}},ke=class extends Error{constructor(e="Input has been disposed."){super(e),this.name="InputDisposedError";}};var Bn=class{constructor(e){this.source=e;}get fileSize(){let e=this.source._getFileSize();if(e===void 0)throw new Error("Reading file size too early; read required first.");return e}get fileSizeNonStrict(){return this.source._getFileSize()??null}requestSlice(e,r){if(this.source._disposed)throw new ke;if(e<0||this.fileSizeNonStrict!==null&&e+r>this.fileSizeNonStrict)return null;if(r===0){let n=new Uint8Array(0);return new rt(n,ie(n),0,e,e)}let i=e+r,s=this.source._read(e,i,Es,vs);return U(s)?s.then(n=>n?new rt(n.bytes,n.view,n.offset,e,i):null):s?new rt(s.bytes,s.view,s.offset,e,i):null}requestSliceRange(e,r,i){if(this.source._disposed)throw new ke;if(e<0)return null;if(this.fileSizeNonStrict!==null)return this.requestSlice(e,ue(this.fileSizeNonStrict-e,r,i));{let s=this.requestSlice(e,i),n=o=>o||(g(this.fileSizeNonStrict!==null),this.requestSlice(e,ue(this.fileSizeNonStrict-e,r,i)));return U(s)?s.then(n):n(s)}}requestEntireFile(){if(this.fileSizeNonStrict!==null)return this.requestSlice(0,this.fileSizeNonStrict);let e=1024;return (async()=>{let r=[],i=0;for(;;){if(r.length===1&&this.fileSizeNonStrict!==null)return this.requestSlice(0,this.fileSizeNonStrict);let o=this.requestSliceRange(i,0,e);if(U(o)&&(o=await o),!o||o.length===0)break;let a=te(o,o.length);r.push(a),i+=o.length;}let s=new Uint8Array(i),n=0;for(let o of r)s.set(o,n),n+=o.length;return new rt(s,ie(s),0,0,i)})()}},rt=class t{constructor(e,r,i,s,n){this.bytes=e,this.view=r,this.offset=i,this.start=s,this.end=n,this.bufferPos=s-i;}static tempFromBytes(e){return new t(e,ie(e),0,0,e.length)}get length(){return this.end-this.start}get filePos(){return this.offset+this.bufferPos}set filePos(e){this.bufferPos=e-this.offset;}get remainingLength(){return Math.max(this.end-this.filePos,0)}skip(e){this.bufferPos+=e;}slice(e,r=this.end-e){if(e<this.start||e+r>this.end)throw new RangeError("Slicing outside of original slice.");return new t(this.bytes,this.view,this.offset,e,e+r)}},ht=(t,e)=>{if(t.filePos<t.start||t.filePos+e>t.end)throw new RangeError(`Tried reading [${t.filePos}, ${t.filePos+e}), but slice is [${t.start}, ${t.end}). This is likely an internal error, please report it alongside the file that caused it.`)},te=(t,e)=>{ht(t,e);let r=t.bytes.subarray(t.bufferPos,t.bufferPos+e);return t.bufferPos+=e,r},Q=t=>(ht(t,1),t.view.getUint8(t.bufferPos++));var _e=t=>{ht(t,2);let e=t.view.getUint16(t.bufferPos,!1);return t.bufferPos+=2,e},Rt=t=>{ht(t,3);let e=Yt(t.view,t.bufferPos,!1);return t.bufferPos+=3,e},ci=t=>{ht(t,2);let e=t.view.getInt16(t.bufferPos,!1);return t.bufferPos+=2,e};var O=t=>{ht(t,4);let e=t.view.getUint32(t.bufferPos,!1);return t.bufferPos+=4,e};var It=t=>{ht(t,4);let e=t.view.getInt32(t.bufferPos,!1);return t.bufferPos+=4,e};var Re=t=>{let e=O(t),r=O(t);return e*4294967296+r},wa=t=>{let e=It(t),r=O(t);return e*4294967296+r};var ba=t=>{ht(t,4);let e=t.view.getFloat32(t.bufferPos,!1);return t.bufferPos+=4,e},gn=t=>{ht(t,8);let e=t.view.getFloat64(t.bufferPos,!1);return t.bufferPos+=8,e},Ue=(t,e)=>{ht(t,e);let r="";for(let i=0;i<e;i++)r+=String.fromCharCode(t.bytes[t.bufferPos++]);return r};var Mn=class{constructor(e){this.mutex=new pr,this.trackTimestampInfo=new WeakMap,this.output=e;}onTrackClose(e){}validateTimestamp(e,r,i){if(r<0)throw new Error(`Timestamps must be non-negative (got ${r}s).`);let s=this.trackTimestampInfo.get(e);if(s){if(i&&(s.maxTimestampBeforeLastKeyPacket=s.maxTimestamp),s.maxTimestampBeforeLastKeyPacket!==null&&r<s.maxTimestampBeforeLastKeyPacket)throw new Error(`Timestamps cannot be smaller than the largest timestamp of the previous GOP (a GOP begins with a key packet and ends right before the next key packet). Got ${r}s, but largest timestamp is ${s.maxTimestampBeforeLastKeyPacket}s.`);s.maxTimestamp=Math.max(s.maxTimestamp,r);}else {if(!i)throw new Error("First packet must be a key packet.");s={maxTimestamp:r,maxTimestampBeforeLastKeyPacket:null},this.trackTimestampInfo.set(e,s);}}};var Hs=/<(?:(\d{2}):)?(\d{2}):(\d{2}).(\d{3})>/g;var Za=t=>{let e=Math.floor(t/36e5),r=Math.floor(t%(3600*1e3)/(60*1e3)),i=Math.floor(t%(60*1e3)/1e3),s=t%1e3;return e.toString().padStart(2,"0")+":"+r.toString().padStart(2,"0")+":"+i.toString().padStart(2,"0")+"."+s.toString().padStart(3,"0")};var ur=class{constructor(e){this.writer=e,this.helper=new Uint8Array(8),this.helperView=new DataView(this.helper.buffer),this.offsets=new WeakMap;}writeU32(e){this.helperView.setUint32(0,e,!1),this.writer.write(this.helper.subarray(0,4));}writeU64(e){this.helperView.setUint32(0,Math.floor(e/2**32),!1),this.helperView.setUint32(4,e,!1),this.writer.write(this.helper.subarray(0,8));}writeAscii(e){for(let r=0;r<e.length;r++)this.helperView.setUint8(r%8,e.charCodeAt(r)),r%8===7&&this.writer.write(this.helper);e.length%8!==0&&this.writer.write(this.helper.subarray(0,e.length%8));}writeBox(e){if(this.offsets.set(e,this.writer.getPos()),e.contents&&!e.children)this.writeBoxHeader(e,e.size??e.contents.byteLength+8),this.writer.write(e.contents);else {let r=this.writer.getPos();if(this.writeBoxHeader(e,0),e.contents&&this.writer.write(e.contents),e.children)for(let n of e.children)n&&this.writeBox(n);let i=this.writer.getPos(),s=e.size??i-r;this.writer.seek(r),this.writeBoxHeader(e,s),this.writer.seek(i);}}writeBoxHeader(e,r){this.writeU32(e.largeSize?1:r),this.writeAscii(e.type),e.largeSize&&this.writeU64(r);}measureBoxHeader(e){return 8+(e.largeSize?8:0)}patchBox(e){let r=this.offsets.get(e);g(r!==void 0);let i=this.writer.getPos();this.writer.seek(r),this.writeBox(e),this.writer.seek(i);}measureBox(e){if(e.contents&&!e.children)return this.measureBoxHeader(e)+e.contents.byteLength;{let r=this.measureBoxHeader(e);if(e.contents&&(r+=e.contents.byteLength),e.children)for(let i of e.children)i&&(r+=this.measureBox(i));return r}}},ee=new Uint8Array(8),$e=new DataView(ee.buffer),be=t=>[(t%256+256)%256],H=t=>($e.setUint16(0,t,!1),[ee[0],ee[1]]),Gs=t=>($e.setInt16(0,t,!1),[ee[0],ee[1]]),ec=t=>($e.setUint32(0,t,!1),[ee[1],ee[2],ee[3]]),M=t=>($e.setUint32(0,t,!1),[ee[0],ee[1],ee[2],ee[3]]),Dt=t=>($e.setInt32(0,t,!1),[ee[0],ee[1],ee[2],ee[3]]),gt=t=>($e.setUint32(0,Math.floor(t/2**32),!1),$e.setUint32(4,t,!1),[ee[0],ee[1],ee[2],ee[3],ee[4],ee[5],ee[6],ee[7]]),Dl=t=>($e.setInt32(0,Math.floor(t/2**32),!1),$e.setUint32(4,t,!1),[ee[0],ee[1],ee[2],ee[3],ee[4],ee[5],ee[6],ee[7]]),tc=t=>($e.setInt16(0,2**8*t,!1),[ee[0],ee[1]]),nt=t=>($e.setInt32(0,2**16*t,!1),[ee[0],ee[1],ee[2],ee[3]]),js=t=>($e.setInt32(0,2**30*t,!1),[ee[0],ee[1],ee[2],ee[3]]),Qs=(t,e)=>{let r=[],i=t;do{let s=i&127;i>>=7,r.length>0&&(s|=128),r.push(s),e!==void 0&&e--;}while(i>0||e);return r.reverse()},le=(t,e=!1)=>{let r=Array(t.length).fill(null).map((i,s)=>t.charCodeAt(s));return e&&r.push(0),r},rc=t=>{let e=t*(Math.PI/180),r=Math.round(Math.cos(e)),i=Math.round(Math.sin(e));return [r,i,0,-i,r,0,0,0,1]},ic=rc(0),nc=t=>[nt(t[0]),nt(t[1]),js(t[2]),nt(t[3]),nt(t[4]),js(t[5]),nt(t[6]),nt(t[7]),js(t[8])],q=(t,e,r)=>({type:t,contents:e&&new Uint8Array(e.flat(10)),children:r}),se=(t,e,r,i,s)=>q(t,[be(e),ec(r),i??[]],s),sc=t=>t.isQuickTime?q("ftyp",[le("qt  "),M(512),le("qt  ")]):t.fragmented?t.cmaf?q("ftyp",[le("iso5"),M(512),le("iso5"),le("iso6"),le("mp41"),le("cmfc"),le("dash")]):q("ftyp",[le("iso5"),M(512),le("iso5"),le("iso6"),le("mp41")]):q("ftyp",[le("isom"),M(512),le("isom"),t.holdsAvc?le("avc1"):[],le("mp41")]),$s=()=>q("styp",[le("iso5"),M(0),le("iso5"),le("iso6"),le("mp41"),le("cmfc"),le("dash")]),Xs=(t,e)=>{let r=t.maxWrittenEndTimestamp-t.minWrittenTimestamp;return Number.isFinite(r)||(r=0),se("sidx",1,0,[M(1),M(Ge),gt(pe(t.minWrittenTimestamp,Ge)),gt(0),H(0),H(1),M(e&2147483647),M(pe(r,Ge)),M(0)])},Ci=t=>({type:"mdat",largeSize:t}),oc=t=>({type:"free",size:t}),Vr=t=>q("moov",void 0,[Ol(t.creationTime,t.trackDatas),...t.trackDatas.map(e=>zl(e,t.creationTime)),t.isFragmented?Su(t.trackDatas):null,Fu(t)]),Ol=(t,e)=>{let r=Math.max(0,...e.map(o=>pe(Dn(o),Ge)+pe(o.startTimestampOffset??0,Ge))),i=Math.max(0,...e.map(o=>o.track.id))+1,s=!bt(t)||!bt(r),n=s?gt:M;return se("mvhd",+s,0,[n(t),n(t),M(Ge),n(r),nt(1),tc(1),Array(10).fill(0),nc(ic),Array(24).fill(0),M(i)])},Dn=t=>{if(t.samples.length===0)return 0;let e=1/0,r=-1/0;for(let i=0;i<t.samples.length;i++){let s=t.samples[i];s.timestamp<e&&(e=s.timestamp),s.timestamp+s.duration>r&&(r=s.timestamp+s.duration);}return e===1/0?0:r-e},zl=(t,e)=>{let r=pc(t),i=t.startTimestampOffset!==null&&t.startTimestampOffset>0;return q("trak",void 0,[Vl(t,e),i?Ul(t,t.startTimestampOffset):null,Nl(t,e),r.name!==void 0?q("udta",void 0,[q("name",[...qe.encode(r.name)])]):null])},Vl=(t,e)=>{let r=pe(Dn(t),Ge)+pe(t.startTimestampOffset??0,Ge),i=!bt(e)||!bt(r),s=i?gt:M,n;if(t.type==="video"){let c=t.track.metadata.rotation;n=rc(c??0);}else n=ic;let o=2;t.track.metadata.disposition?.default!==!1&&(o|=1);let a=t.type==="video"?0:t.type==="audio"?1:t.type==="subtitle"?2:xe(t);return se("tkhd",+i,o,[s(e),s(e),M(t.track.id),M(0),s(r),Array(8).fill(0),H(0),H(a),tc(t.type==="audio"?1:0),H(0),nc(n),nt(t.type==="video"?t.info.width:0),nt(t.type==="video"?t.info.height:0)])},Ul=(t,e)=>{let r=pe(e,Ge),i=pe(Dn(t),Ge),s=!bt(r)||!bt(i),n=s?gt:M,o=s?Dl:Dt;return q("edts",void 0,[se("elst",s?1:0,0,[M(2),n(r),o(-1),nt(1),n(i),o(0),nt(1)])])},Nl=(t,e)=>q("mdia",void 0,[Wl(t,e),Zs(!0,ql[t.type],Ll[t.type]),Hl(t)]),Wl=(t,e)=>{let r=pe(Dn(t),t.timescale),i=!bt(e)||!bt(r),s=i?gt:M;return se("mdhd",+i,0,[s(e),s(e),M(t.timescale),s(r),H(mc(t.track.metadata.languageCode??Ut)),H(0)])},ql={video:"vide",audio:"soun",subtitle:"text"},Ll={video:"MediabunnyVideoHandler",audio:"MediabunnySoundHandler",subtitle:"MediabunnyTextHandler"},Zs=(t,e,r,i="\0\0\0\0")=>se("hdlr",0,0,[t?le("mhlr"):M(0),le(e),le(i),M(0),M(0),le(r,!0)]),Hl=t=>q("minf",void 0,[Gl[t.type](),$l(),Yl(t)]),jl=()=>se("vmhd",0,1,[H(0),H(0),H(0),H(0)]),Ql=()=>se("smhd",0,0,[H(0),H(0)]),Kl=()=>se("nmhd",0,0),Gl={video:jl,audio:Ql,subtitle:Kl},$l=()=>q("dinf",void 0,[Xl()]),Xl=()=>se("dref",0,0,[M(1)],[Zl()]),Zl=()=>se("url ",0,1),Yl=t=>{let e=t.compositionTimeOffsetTable.length>1||t.compositionTimeOffsetTable.some(r=>r.sampleCompositionTimeOffset!==0);return q("stbl",void 0,[Jl(t),gu(t),e?Tu(t):null,e?ku(t):null,yu(t),bu(t),Au(t),wu(t)])},Jl=t=>{let e;if(t.type==="video")e=eu(Ou(t.track.source._codec,t.info.decoderConfig.codec),t);else if(t.type==="audio"){let r=hc(t.track.source._codec,t.info.decoderConfig.codec,t.muxer.isQuickTime);g(r),e=ou(r,t);}else t.type==="subtitle"&&(e=mu(Uu[t.track.source._codec],t));return g(e),se("stsd",0,0,[M(1)],[e])},eu=(t,e)=>q(t,[Array(6).fill(0),H(1),H(0),H(0),Array(12).fill(0),H(e.info.width),H(e.info.height),M(4718592),M(4718592),M(0),H(1),be(10),le("Mediabunny"),Array(21).fill(0),H(e.info.hasAlphaChannel?32:24),Gs(65535)],[zu[e.track.source._codec]?.(e)??null,tu(e),uo(e.info.decoderConfig.colorSpace)?null:ru(e)]),tu=t=>t.info.pixelAspectRatio.num===t.info.pixelAspectRatio.den?null:q("pasp",[M(t.info.pixelAspectRatio.num),M(t.info.pixelAspectRatio.den)]),ru=t=>{let e=t.info.decoderConfig.colorSpace;return q("colr",[le(t.muxer.isQuickTime?"nclc":"nclx"),H(e?.primaries!=null?At[e.primaries]:2),H(e?.transfer!=null?Tt[e.transfer]:2),H(e?.matrix!=null?kt[e.matrix]:2),t.muxer.isQuickTime?[]:be((e?.fullRange?1:0)<<7)])},iu=t=>t.info.decoderConfig&&q("avcC",[...Te(t.info.decoderConfig.description)]),nu=t=>t.info.decoderConfig&&q("hvcC",[...Te(t.info.decoderConfig.description)]),Ya=t=>{if(!t.info.decoderConfig)return null;let e=t.info.decoderConfig,r=e.codec.split("."),i=Number(r[1]),s=Number(r[2]),n=Number(r[3]),o=r[4]?Number(r[4]):1,a=r[8]?Number(r[8]):Number(e.colorSpace?.fullRange??0),c=(n<<4)+(o<<1)+a,l=r[5]?Number(r[5]):e.colorSpace?.primaries?At[e.colorSpace.primaries]:1,u=r[6]?Number(r[6]):e.colorSpace?.transfer?Tt[e.colorSpace.transfer]:1,d=r[7]?Number(r[7]):e.colorSpace?.matrix?kt[e.colorSpace.matrix]:1;return se("vpcC",1,0,[be(i),be(s),be(c),be(l),be(u),be(d),H(0)])},su=t=>q("av1C",ea(t.info.decoderConfig.codec)),ou=(t,e)=>{let r=0,i,s=16,n=Ae.includes(e.track.source._codec);if(n){let o=e.track.source._codec,{sampleSize:a}=Ve(o);s=8*a,s>16&&(r=1);}if(e.muxer.isQuickTime&&(r=1),r===0)i=[Array(6).fill(0),H(1),H(r),H(0),M(0),H(e.info.numberOfChannels),H(s),H(0),H(0),H(e.info.sampleRate<2**16?e.info.sampleRate:0),H(0)];else {let o=n?0:-2;i=[Array(6).fill(0),H(1),H(r),H(0),M(0),H(e.info.numberOfChannels),H(Math.min(s,16)),Gs(o),H(0),H(e.info.sampleRate<2**16?e.info.sampleRate:0),H(0),n?[M(1),M(s/8),M(e.info.numberOfChannels*s/8)]:[M(0),M(0),M(0)],M(2)];}return q(t,i,[Vu(e.track.source._codec,e.muxer.isQuickTime)?.(e)??null])},Ks=t=>{let e;switch(t.track.source._codec){case "aac":e=64;break;case "mp3":e=107;break;case "vorbis":e=221;break;default:throw new Error(`Unhandled audio codec: ${t.track.source._codec}`)}let r=[...be(e),...be(21),...ec(0),...M(0),...M(0)];if(t.info.decoderConfig.description){let i=Te(t.info.decoderConfig.description);r=[...r,...be(5),...Qs(i.byteLength),...i];}return r=[...H(1),...be(0),...be(4),...Qs(r.length),...r,...be(6),...be(1),...be(2)],r=[...be(3),...Qs(r.length),...r],se("esds",0,0,r)},$t=t=>q("wave",void 0,[au(t),cu(t),q("\0\0\0\0")]),au=t=>q("frma",[le(hc(t.track.source._codec,t.info.decoderConfig.codec,t.muxer.isQuickTime))]),cu=t=>{let{littleEndian:e}=Ve(t.track.source._codec);return q("enda",[H(+e)])},lu=t=>{let e=t.info.numberOfChannels,r=3840,i=t.info.sampleRate,s=0,n=0,o=new Uint8Array(0),a=t.info.decoderConfig?.description;if(a){g(a.byteLength>=18);let c=Te(a),l=No(c);e=l.outputChannelCount,r=l.preSkip,i=l.inputSampleRate,s=l.outputGain,n=l.channelMappingFamily,l.channelMappingTable&&(o=l.channelMappingTable);}return q("dOps",[be(0),be(e),H(r),M(i),Gs(s),be(n),...o])},uu=t=>{let e=t.info.decoderConfig?.description;g(e);let r=Te(e);return se("dfLa",0,0,[...r.subarray(4)])},mt=t=>{let{littleEndian:e,sampleSize:r}=Ve(t.track.source._codec),i=+e;return se("pcmC",0,0,[be(i),be(8*r)])},du=t=>{g(t.info.primingPacket);let e=Wo(t.info.primingPacket.data);if(!e)throw new Error("Couldn't extract AC-3 frame info from the audio packet. Ensure the packets contain valid AC-3 sync frames (as specified in ETSI TS 102 366).");let r=new Uint8Array(3),i=new ae(r);return i.writeBits(2,e.fscod),i.writeBits(5,e.bsid),i.writeBits(3,e.bsmod),i.writeBits(3,e.acmod),i.writeBits(1,e.lfeon),i.writeBits(5,e.bitRateCode),i.writeBits(5,0),q("dac3",[...r])},fu=t=>{g(t.info.primingPacket);let e=qo(t.info.primingPacket.data);if(!e)throw new Error("Couldn't extract E-AC-3 frame info from the audio packet. Ensure the packets contain valid E-AC-3 sync frames (as specified in ETSI TS 102 366).");let r=16;for(let o of e.substreams)r+=23,o.numDepSub>0?r+=9:r+=1;let i=Math.ceil(r/8),s=new Uint8Array(i),n=new ae(s);n.writeBits(13,e.dataRate),n.writeBits(3,e.substreams.length-1);for(let o of e.substreams)n.writeBits(2,o.fscod),n.writeBits(5,o.bsid),n.writeBits(1,0),n.writeBits(1,0),n.writeBits(3,o.bsmod),n.writeBits(3,o.acmod),n.writeBits(1,o.lfeon),n.writeBits(3,0),n.writeBits(4,o.numDepSub),o.numDepSub>0?n.writeBits(9,o.chanLoc):n.writeBits(1,0);return q("dec3",[...s])},hu=t=>{g(t.info.primingPacket);let e=ms(t.info.primingPacket.data);if(!e)throw new Error("Couldn't extract DTS frame info from the audio packet. Ensure the packets contain valid DTS frames as specified in ETSI TS 102 114.");return q("ddts",[...Go(e)])},mu=(t,e)=>q(t,[Array(6).fill(0),H(1)],[Nu[e.track.source._codec](e)]),pu=t=>q("vttC",[...qe.encode(t.info.config.description)]);var gu=t=>se("stts",0,0,[M(t.timeToSampleTable.length),t.timeToSampleTable.map(e=>[M(e.sampleCount),M(e.sampleDelta)])]),wu=t=>{if(t.samples.every(r=>r.type==="key"))return null;let e=[...t.samples.entries()].filter(([,r])=>r.type==="key");return se("stss",0,0,[M(e.length),e.map(([r])=>M(r+1))])},yu=t=>se("stsc",0,0,[M(t.compactlyCodedChunkTable.length),t.compactlyCodedChunkTable.map(e=>[M(e.firstChunk),M(e.samplesPerChunk),M(1)])]),bu=t=>{if(t.type==="audio"&&t.info.requiresPcmTransformation){let{sampleSize:e}=Ve(t.track.source._codec);return se("stsz",0,0,[M(e*t.info.numberOfChannels),M(t.samples.reduce((r,i)=>r+pe(i.duration,t.timescale),0))])}return se("stsz",0,0,[M(0),M(t.samples.length),t.samples.map(e=>M(e.size))])},Au=t=>t.finalizedChunks.length>0&&fe(t.finalizedChunks).offset>=2**32?se("co64",0,0,[M(t.finalizedChunks.length),t.finalizedChunks.map(e=>gt(e.offset))]):se("stco",0,0,[M(t.finalizedChunks.length),t.finalizedChunks.map(e=>M(e.offset))]),Tu=t=>se("ctts",1,0,[M(t.compositionTimeOffsetTable.length),t.compositionTimeOffsetTable.map(e=>[M(e.sampleCount),Dt(e.sampleCompositionTimeOffset)])]),ku=t=>{let e=1/0,r=-1/0,i=1/0,s=-1/0;g(t.compositionTimeOffsetTable.length>0),g(t.samples.length>0);for(let o=0;o<t.compositionTimeOffsetTable.length;o++){let a=t.compositionTimeOffsetTable[o];e=Math.min(e,a.sampleCompositionTimeOffset),r=Math.max(r,a.sampleCompositionTimeOffset);}for(let o=0;o<t.samples.length;o++){let a=t.samples[o];i=Math.min(i,pe(a.timestamp,t.timescale)),s=Math.max(s,pe(a.timestamp+a.duration,t.timescale));}let n=Math.max(-e,0);return s>=2**31?null:se("cslg",0,0,[Dt(n),Dt(e),Dt(r),Dt(i),Dt(s)])},Su=t=>q("mvex",void 0,t.map(xu)),xu=t=>se("trex",0,0,[M(t.track.id),M(1),M(0),M(0),M(0)]),Ys=(t,e)=>q("moof",void 0,[_u(t),...e.map(Cu)]),_u=t=>se("mfhd",0,0,[M(t)]),ac=t=>{let e=0,r=0,i=0,s=0,n=t.type==="delta";return r|=+n,n?e|=1:e|=2,e<<24|r<<16|i<<8|s},Cu=t=>q("traf",void 0,[Eu(t),vu(t),Iu(t)]),Eu=t=>{g(t.currentChunk);let e=0;e|=8,e|=16,e|=32,e|=131072;let r=t.currentChunk.samples[1]??t.currentChunk.samples[0],i={duration:r.timescaleUnitsToNextSample,size:r.size,flags:ac(r)};return se("tfhd",0,e,[M(t.track.id),M(i.duration),M(i.size),M(i.flags)])},vu=t=>(g(t.currentChunk),se("tfdt",1,0,[gt(pe(t.currentChunk.startTimestamp,t.timescale))])),Iu=t=>{g(t.currentChunk);let e=t.currentChunk.samples.map(b=>b.timescaleUnitsToNextSample),r=t.currentChunk.samples.map(b=>b.size),i=t.currentChunk.samples.map(ac),s=t.currentChunk.samples.map(b=>pe(b.timestamp-b.decodeTimestamp,t.timescale)),n=new Set(e),o=new Set(r),a=new Set(i),c=new Set(s),l=a.size===2&&i[0]!==i[1],u=n.size>1,d=o.size>1,f=!l&&a.size>1,m=c.size>1||[...c].some(b=>b!==0),p=0;return p|=1,p|=4*+l,p|=256*+u,p|=512*+d,p|=1024*+f,p|=2048*+m,se("trun",1,p,[M(t.currentChunk.samples.length),M(t.currentChunk.offset-t.currentChunk.moofOffset||0),l?M(i[0]):[],t.currentChunk.samples.map((b,y)=>[u?M(e[y]):[],d?M(r[y]):[],f?M(i[y]):[],m?Dt(s[y]):[]])])},cc=t=>q("mfra",void 0,[...t.map(Pu),Ru()]),Pu=t=>se("tfra",1,0,[M(t.track.id),M(63),M(t.finalizedChunks.length),t.finalizedChunks.map(r=>[gt(pe(r.samples[0].timestamp,t.timescale)),gt(r.moofOffset),M(r.trafIndex+1),M(1),M(1)])]),Ru=()=>se("mfro",0,0,[M(0)]),lc=()=>q("vtte"),uc=(t,e,r,i,s)=>q("vttc",void 0,[s!==null?q("vsid",[Dt(s)]):null,r!==null?q("iden",[...qe.encode(r)]):null,e!==null?q("ctim",[...qe.encode(Za(e))]):null,i!==null?q("sttg",[...qe.encode(i)]):null,q("payl",[...qe.encode(t)])]),dc=t=>q("vtta",[...qe.encode(t)]),Fu=t=>{let e=[],r=t.format._options.metadataFormat??"auto",i=t.output._metadataTags;if(r==="mdir"||r==="auto"&&!t.isQuickTime){let s=Mu(i);s&&e.push(s);}else if(r==="mdta"){let s=Du(i);s&&e.push(s);}else (r==="udta"||r==="auto"&&t.isQuickTime)&&Bu(e,t.output._metadataTags);return e.length===0?null:q("udta",void 0,e)},Bu=(t,e)=>{for(let{key:r,value:i}of Vi(e))switch(r){case "title":t.push(pt("\xA9nam",i));break;case "description":t.push(pt("\xA9des",i));break;case "artist":t.push(pt("\xA9ART",i));break;case "album":t.push(pt("\xA9alb",i));break;case "albumArtist":t.push(pt("albr",i));break;case "genre":t.push(pt("\xA9gen",i));break;case "date":t.push(pt("\xA9day",i.toISOString().slice(0,10)));break;case "comment":t.push(pt("\xA9cmt",i));break;case "lyrics":t.push(pt("\xA9lyr",i));break;case "raw":break;case "discNumber":case "discsTotal":case "trackNumber":case "tracksTotal":case "images":break;default:xe(r);}if(e.raw)for(let r in e.raw){let i=e.raw[r];i==null||r.length!==4||t.some(s=>s.type===r)||(typeof i=="string"?t.push(pt(r,i)):i instanceof Uint8Array&&t.push(q(r,Array.from(i))));}},pt=(t,e)=>{let r=qe.encode(e);return q(t,[H(r.length),H(mc("und")),Array.from(r)])},Ja={"image/jpeg":13,"image/png":14,"image/bmp":27},fc=(t,e)=>{let r=[];for(let{key:i,value:s}of Vi(t))switch(i){case "title":r.push({key:e?"title":"\xA9nam",value:it(s)});break;case "description":r.push({key:e?"description":"\xA9des",value:it(s)});break;case "artist":r.push({key:e?"artist":"\xA9ART",value:it(s)});break;case "album":r.push({key:e?"album":"\xA9alb",value:it(s)});break;case "albumArtist":r.push({key:e?"album_artist":"aART",value:it(s)});break;case "comment":r.push({key:e?"comment":"\xA9cmt",value:it(s)});break;case "genre":r.push({key:e?"genre":"\xA9gen",value:it(s)});break;case "lyrics":r.push({key:e?"lyrics":"\xA9lyr",value:it(s)});break;case "date":r.push({key:e?"date":"\xA9day",value:it(s.toISOString().slice(0,10))});break;case "images":for(let n of s)n.kind==="coverFront"&&r.push({key:"covr",value:q("data",[M(Ja[n.mimeType]??0),M(0),Array.from(n.data)])});break;case "trackNumber":if(e){let n=t.tracksTotal!==void 0?`${s}/${t.tracksTotal}`:s.toString();r.push({key:"track",value:it(n)});}else r.push({key:"trkn",value:q("data",[M(0),M(0),H(0),H(s),H(t.tracksTotal??0),H(0)])});break;case "discNumber":e||r.push({key:"disc",value:q("data",[M(0),M(0),H(0),H(s),H(t.discsTotal??0),H(0)])});break;case "tracksTotal":case "discsTotal":break;case "raw":break;default:xe(i);}if(t.raw)for(let i in t.raw){let s=t.raw[i];s==null||!e&&i.length!==4||r.some(n=>n.key===i)||(typeof s=="string"?r.push({key:i,value:it(s)}):s instanceof Uint8Array?r.push({key:i,value:q("data",[M(0),M(0),Array.from(s)])}):s instanceof Xe&&r.push({key:i,value:q("data",[M(Ja[s.mimeType]??0),M(0),Array.from(s.data)])}));}return r},Mu=t=>{let e=fc(t,!1);return e.length===0?null:se("meta",0,0,void 0,[Zs(!1,"mdir","","appl"),q("ilst",void 0,e.map(r=>q(r.key,void 0,[r.value])))])},Du=t=>{let e=fc(t,!0);return e.length===0?null:q("meta",void 0,[Zs(!1,"mdta",""),se("keys",0,0,[M(e.length)],e.map(r=>q("mdta",[...qe.encode(r.key)]))),q("ilst",void 0,e.map((r,i)=>{let s=String.fromCharCode(...M(i+1));return q(s,void 0,[r.value])}))])},it=t=>q("data",[M(1),M(0),...qe.encode(t)]),Ou=(t,e)=>{switch(t){case "avc":return e.startsWith("avc3")?"avc3":"avc1";case "hevc":return "hvc1";case "vp8":return "vp08";case "vp9":return "vp09";case "av1":return "av01";case "prores":return e}},zu={avc:iu,hevc:nu,vp8:Ya,vp9:Ya,av1:su,prores:null},hc=(t,e,r)=>{switch(t){case "aac":return "mp4a";case "mp3":return "mp4a";case "opus":return "Opus";case "vorbis":return "mp4a";case "flac":return "fLaC";case "ulaw":return "ulaw";case "alaw":return "alaw";case "pcm-u8":return "raw ";case "pcm-s8":return "sowt";case "ac3":return "ac-3";case "eac3":return "ec-3";case "dts":return e}if(r)switch(t){case "pcm-s16":return "sowt";case "pcm-s16be":return "twos";case "pcm-s24":return "in24";case "pcm-s24be":return "in24";case "pcm-s32":return "in32";case "pcm-s32be":return "in32";case "pcm-f32":return "fl32";case "pcm-f32be":return "fl32";case "pcm-f64":return "fl64";case "pcm-f64be":return "fl64"}else switch(t){case "pcm-s16":return "ipcm";case "pcm-s16be":return "ipcm";case "pcm-s24":return "ipcm";case "pcm-s24be":return "ipcm";case "pcm-s32":return "ipcm";case "pcm-s32be":return "ipcm";case "pcm-f32":return "fpcm";case "pcm-f32be":return "fpcm";case "pcm-f64":return "fpcm";case "pcm-f64be":return "fpcm"}},Vu=(t,e)=>{switch(t){case "aac":return Ks;case "mp3":return Ks;case "opus":return lu;case "vorbis":return Ks;case "flac":return uu;case "ac3":return du;case "eac3":return fu;case "dts":return hu}if(e)switch(t){case "pcm-s24":return $t;case "pcm-s24be":return $t;case "pcm-s32":return $t;case "pcm-s32be":return $t;case "pcm-f32":return $t;case "pcm-f32be":return $t;case "pcm-f64":return $t;case "pcm-f64be":return $t}else switch(t){case "pcm-s16":return mt;case "pcm-s16be":return mt;case "pcm-s24":return mt;case "pcm-s24be":return mt;case "pcm-s32":return mt;case "pcm-s32be":return mt;case "pcm-f32":return mt;case "pcm-f32be":return mt;case "pcm-f64":return mt;case "pcm-f64be":return mt}return null},Uu={webvtt:"wvtt"},Nu={webvtt:pu},mc=t=>{g(t.length===3);let e=0;for(let r=0;r<3;r++)e<<=5,e+=t.charCodeAt(r)-96;return e};var dr=class{constructor(e,r){if(this.finalized=!1,this.started=!1,this.pos=0,this.trackedWrites=null,this.trackedStart=-1,this.trackedEnd=-1,e._writerAcquired)throw new Error("Can't have multiple Writers for the same Target.");this.target=e,e._setMonotonicity(r),e._writerAcquired=!0;}start(){g(!this.started),this.target._start(),this.started=!0;}write(e){g(this.started&&!this.finalized),this.maybeTrackWrites(e),this.target._write(e,this.pos),this.pos+=e.byteLength;}seek(e){this.pos=e;}getPos(){return this.pos}async flush(){return g(this.started&&!this.finalized),this.target._flush()}async finalize(){g(this.started&&!this.finalized),await this.target._finalize(),this.finalized=!0;}maybeTrackWrites(e){if(!this.trackedWrites)return;let r=this.getPos();if(r<this.trackedStart){if(r+e.byteLength<=this.trackedStart)return;e=e.subarray(this.trackedStart-r),r=0;}let i=r+e.byteLength-this.trackedStart,s=this.trackedWrites.byteLength;for(;s<i;)s*=2;if(s!==this.trackedWrites.byteLength){let n=new Uint8Array(s);n.set(this.trackedWrites,0),this.trackedWrites=n;}this.trackedWrites.set(e,r-this.trackedStart),this.trackedEnd=Math.max(this.trackedEnd,r+e.byteLength);}startTrackingWrites(){this.trackedWrites=new Uint8Array(2**10),this.trackedStart=this.getPos(),this.trackedEnd=this.trackedStart;}stopTrackingWrites(){if(!this.trackedWrites)throw new Error("Internal error: Can't get tracked writes since nothing was tracked.");let r={data:this.trackedWrites.subarray(0,this.trackedEnd-this.trackedStart),start:this.trackedStart,end:this.trackedEnd};return this.trackedWrites=null,r}};var We=class extends He{constructor(){super(...arguments),this._writerAcquired=!1,this._monotonicity=null,this.onwrite=null;}_setMonotonicity(e){this._monotonicity!==!1&&(this._monotonicity=e);}_dispatchWrite(e,r){this.onwrite?.(e,r),this._emit("write",{start:e,end:r});}slice(e){if(!Number.isInteger(e)||e<0)throw new TypeError("offset must be a non-negative integer.");return new On(this,e)}},Js=2**16,eo=2**32,Ot=class extends We{constructor(e={}){if(super(),this.buffer=null,this._maxPos=0,!e||typeof e!="object")throw new TypeError("BufferTarget options, when provided, must be an object.");if(e.onFinalize!==void 0&&typeof e.onFinalize!="function")throw new TypeError("options.onFinalize, when provided, must be a function.");if(this._options=e,this._supportsResize="resize"in new ArrayBuffer(0),this._supportsResize)try{this._buffer=new ArrayBuffer(Js,{maxByteLength:eo});}catch{this._buffer=new ArrayBuffer(Js),this._supportsResize=!1;}else this._buffer=new ArrayBuffer(Js);this._bytes=new Uint8Array(this._buffer);}_ensureSize(e){let r=this._buffer.byteLength;for(;r<e;)r*=2;if(r!==this._buffer.byteLength){if(r>eo)throw new Error(`ArrayBuffer exceeded maximum size of ${eo} bytes. Please consider using another target.`);if(this._supportsResize)this._buffer.resize(r);else {let i=new ArrayBuffer(r),s=new Uint8Array(i);s.set(this._bytes,0),this._buffer=i,this._bytes=s;}}}_start(){}_write(e,r){this._ensureSize(r+e.byteLength),this._bytes.set(e,r),this._maxPos=Math.max(this._maxPos,r+e.byteLength),this._dispatchWrite(r,r+e.byteLength);}async _flush(){}async _finalize(){this.buffer=this._buffer.slice(0,this._maxPos),this._options.onFinalize&&await this._options.onFinalize(this.buffer),this._emit("finalized");}async _close(){}_getSlice(e,r){return this._bytes.slice(e,r)}},wh=2**24;var Ei=class extends We{_start(){}_write(e,r){this._dispatchWrite(r,r+e.byteLength);}async _flush(){}async _finalize(){this._emit("finalized");}async _close(){}},On=class extends We{constructor(e,r){super(),this._baseTarget=e,this._offset=r;}_start(){}_write(e,r){this._baseTarget._write(e,this._offset+r),this._dispatchWrite(r,r+e.byteLength);}_flush(){return this._baseTarget._flush()}async _finalize(){this._emit("finalized");}async _close(){}_setMonotonicity(e){super._setMonotonicity(e),this._baseTarget._setMonotonicity(e);}},fr=class{constructor(e,r){if(this.rootPath=e,this.getTarget=r,typeof e!="string")throw new TypeError("rootPath must be a string.");if(typeof r!="function")throw new TypeError("getTarget must be a function.")}};var Ge=57600,Wu=2082844800,pc=t=>{let e={},r=t.track;return r.metadata.name!==void 0&&(e.name=r.metadata.name),e},pe=(t,e,r=!0)=>{let i=t*e;return r?Math.round(i):i},zn=class extends Mn{constructor(e,r){super(e),this.writer=null,this.boxWriter=null,this.initWriter=null,this.initBoxWriter=null,this.auxTarget=new Ot,this.auxWriter=new dr(this.auxTarget,!1),this.auxBoxWriter=new ur(this.auxWriter),this.mdat=null,this.ftypSize=null,this.trackDatas=[],this.allTracksKnown=he(),this.creationTime=Math.floor(Date.now()/1e3)+Wu,this.finalizedChunks=[],this.wroteFragmentedHeader=!1,this.nextFragmentNumber=1,this.maxWrittenTimestamp=-1/0,this.minWrittenTimestamp=1/0,this.maxWrittenEndTimestamp=-1/0,this.segmentHeaderSize=null,this.format=r,this.formatOptions={...r._options},this.isQuickTime=r instanceof Nr,this.isCmaf=r instanceof Ur,this.minimumFragmentDuration=this.formatOptions.minimumFragmentDuration??(r instanceof Ur?1/0:1),this.auxWriter.start();}async start(){let e=await this.mutex.acquire();if(this.isCmaf?(this.fastStart="fragmented",this.isFragmented=!0):(this.writer=await this.output._getRootWriter(i=>this.formatOptions.fastStart!==void 0?this.formatOptions.fastStart==="fragmented":i instanceof Ot),this.boxWriter=new ur(this.writer),this.fastStart=this.formatOptions.fastStart??(this.writer.target instanceof Ot?"in-memory":!1),this.isFragmented=this.fastStart==="fragmented"),this.isCmaf){if(!this.output._hasInitTarget())throw new Error("CMAF outputs require the initTarget field in OutputOptions to be set; the init segment will be written to it.");let i=await this.output._getInitTarget(),s=new dr(i,!0);s.start(),this.initWriter=s,this.initBoxWriter=new ur(s);}let r=this.output.tracks.some(i=>i.isVideoTrack()&&i.source._codec==="avc");{let i=this.initBoxWriter??this.boxWriter;if(g(i),this.formatOptions.onFtyp&&i.writer.startTrackingWrites(),i.writeBox(sc({isQuickTime:this.isQuickTime,holdsAvc:r,fragmented:this.isFragmented,cmaf:this.isCmaf})),this.formatOptions.onFtyp){let{data:s,start:n}=i.writer.stopTrackingWrites();this.formatOptions.onFtyp(s,n);}this.ftypSize=i.writer.getPos(),this.isCmaf&&await this.initWriter.flush();}if(this.fastStart!=="in-memory")if(this.fastStart==="reserve"){for(let i of this.output.tracks)if(i.metadata.maximumPacketCount===void 0)throw new Error("All tracks must specify maximumPacketCount in their metadata when using fastStart: 'reserve'.")}else this.isFragmented||(g(this.writer),g(this.boxWriter),this.formatOptions.onMdat&&this.writer.startTrackingWrites(),this.mdat=Ci(!0),this.boxWriter.writeBox(this.mdat));await this.writer?.flush();for(let i of this.output.tracks)i.isVideoTrack()&&i.metadata.decoderConfig?this.getVideoTrackData(i,i.metadata.primingPacket??null,{decoderConfig:i.metadata.decoderConfig}):i.isAudioTrack()&&i.metadata.decoderConfig&&this.getAudioTrackData(i,i.metadata.primingPacket??null,{decoderConfig:i.metadata.decoderConfig});e();}allTracksAreKnown(){for(let e of this.output.tracks)if(!e.source._closed&&!this.trackDatas.some(r=>r.track===e))return !1;return !0}async getMimeType(){await this.allTracksKnown.promise;let e=this.trackDatas.map(r=>r.type==="video"||r.type==="audio"?r.info.decoderConfig.codec:{webvtt:"wvtt"}[r.track.source._codec]);return cn({isQuickTime:this.isQuickTime,hasVideo:this.trackDatas.some(r=>r.type==="video"),hasAudio:this.trackDatas.some(r=>r.type==="audio"),codecStrings:e})}getVideoTrackData(e,r,i){let s=this.trackDatas.find(m=>m.track===e);if(s)return s;on(i,e.source._codec),g(i),g(i.decoderConfig);let n={...i.decoderConfig};g(n.codedWidth!==void 0),g(n.codedHeight!==void 0);let o=!1;if(e.source._codec==="avc"&&!n.description){if(!r)throw new Error("No AVC description provided; you must therefore provide a priming packet.");let m=Sr(r.data);if(!m)throw new Error("Couldn't extract an AVCDecoderConfigurationRecord from the AVC packet. Make sure the packets are in Annex B format (as specified in ITU-T-REC-H.264) when not providing a description, or provide a description (must be an AVCDecoderConfigurationRecord as specified in ISO 14496-15) and ensure the packets are in AVCC format.");n.description=Fo(m),o=!0;}else if(e.source._codec==="hevc"&&!n.description){if(!r)throw new Error("No HEVC description provided; you must therefore provide a priming packet.");let m=xr(r.data);if(!m)throw new Error("Couldn't extract an HEVCDecoderConfigurationRecord from the HEVC packet. Make sure the packets are in Annex B format (as specified in ITU-T-REC-H.265) when not providing a description, or provide a description (must be an HEVCDecoderConfigurationRecord as specified in ISO 14496-15) and ensure the packets are in HEVC format.");n.description=Mo(m),o=!0;}let a=bo(1/(e.metadata.frameRate??Ge),1e6).den,c=n.displayAspectWidth,l=n.displayAspectHeight,u=c===void 0||l===void 0?{num:1,den:1}:Wt({num:c*n.codedHeight,den:l*n.codedWidth}),d=n.codec==="ap4h"||n.codec==="ap4x",f={muxer:this,track:e,type:"video",info:{width:n.codedWidth,height:n.codedHeight,pixelAspectRatio:u,decoderConfig:n,requiresAnnexBTransformation:o,hasAlphaChannel:d},timescale:a,samples:[],sampleQueue:[],timestampProcessingQueue:[],timeToSampleTable:[],compositionTimeOffsetTable:[],lastTimescaleUnits:null,lastSample:null,startTimestampOffset:null,finalizedChunks:[],currentChunk:null,compactlyCodedChunkTable:[],closed:!1};return this.trackDatas.push(f),this.trackDatas.sort((m,p)=>m.track.id-p.track.id),this.allTracksAreKnown()&&this.allTracksKnown.resolve(),f}getAudioTrackData(e,r,i){let s=this.trackDatas.find(c=>c.track===e);if(s)return s;an(i,e.source._codec),g(i),g(i.decoderConfig);let n={...i.decoderConfig},o=!1;if(e.source._codec==="aac"&&!n.description){if(!r)throw new Error("No AAC description provided; you must therefore provide a priming packet.");let c=_s(rt.tempFromBytes(r.data));if(!c)throw new Error("Couldn't parse ADTS header from the AAC packet. Make sure the packets are in ADTS format (as specified in ISO 13818-7) when not providing a description, or provide a description (must be an AudioSpecificConfig as specified in ISO 14496-3) and ensure the packets are raw AAC data.");let l=ei[c.samplingFrequencyIndex],u=Li[c.channelConfiguration];if(l===void 0||u===void 0)throw new Error("Invalid ADTS frame header.");n.description=Hi({objectType:c.objectType,outputSampleRate:l,outputNumberOfChannels:u}),o=!0;}if(!r){if(e.source._codec==="ac3"||e.source._codec==="eac3")throw new Error("AC-3/E-AC-3 require a priming packet.");if(e.source._codec==="dts")throw new Error("DTS requires a priming packet.")}let a={muxer:this,track:e,type:"audio",info:{numberOfChannels:i.decoderConfig.numberOfChannels,sampleRate:i.decoderConfig.sampleRate,decoderConfig:n,requiresPcmTransformation:!this.isFragmented&&Ae.includes(e.source._codec),expectedNextPcmPacketTimestamp:null,requiresAdtsStripping:o,primingPacket:r},timescale:n.sampleRate,samples:[],sampleQueue:[],timestampProcessingQueue:[],timeToSampleTable:[],compositionTimeOffsetTable:[],lastTimescaleUnits:null,lastSample:null,startTimestampOffset:null,finalizedChunks:[],currentChunk:null,compactlyCodedChunkTable:[],closed:!1};return this.trackDatas.push(a),this.trackDatas.sort((c,l)=>c.track.id-l.track.id),this.allTracksAreKnown()&&this.allTracksKnown.resolve(),a}getSubtitleTrackData(e,r){let i=this.trackDatas.find(n=>n.track===e);if(i)return i;sa(r),g(r),g(r.config);let s={muxer:this,track:e,type:"subtitle",info:{config:r.config},timescale:1e3,samples:[],sampleQueue:[],timestampProcessingQueue:[],timeToSampleTable:[],compositionTimeOffsetTable:[],lastTimescaleUnits:null,lastSample:null,startTimestampOffset:null,finalizedChunks:[],currentChunk:null,compactlyCodedChunkTable:[],closed:!1,lastCueEndTimestamp:0,cueQueue:[],nextSourceId:0,cueToSourceId:new WeakMap};return this.trackDatas.push(s),this.trackDatas.sort((n,o)=>n.track.id-o.track.id),this.allTracksAreKnown()&&this.allTracksKnown.resolve(),s}async addEncodedVideoPacket(e,r,i){let s=await this.mutex.acquire();try{let n=this.getVideoTrackData(e,r,i),o=r.data;if(n.info.requiresAnnexBTransformation){let c=[...kr(o)].map(l=>o.subarray(l.offset,l.offset+l.length));if(c.length===0)throw new Error("Failed to transform packet data. Make sure all packets are provided in Annex B format, as specified in ITU-T-REC-H.264 and ITU-T-REC-H.265.");o=$i(c,4);}this.validateTimestamp(n.track,r.timestamp,r.type==="key");let a=this.createSampleForTrack(n,o,r.timestamp,r.duration,r.type);await this.registerSample(n,a);}finally{s();}}async addEncodedAudioPacket(e,r,i){let s=await this.mutex.acquire();try{let n=this.getAudioTrackData(e,r,i),o=r.data;if(n.info.requiresAdtsStripping){let u=_s(rt.tempFromBytes(o));if(!u)throw new Error("Expected ADTS frame, didn't get one.");let d=u.crcCheck===null?ka:Sa;o=o.subarray(d);}this.validateTimestamp(n.track,r.timestamp,r.type==="key");let a=r.timestamp,c=r.duration;if(n.info.requiresPcmTransformation){let d=Ve(n.info.decoderConfig.codec).sampleSize*n.info.numberOfChannels;if(c=o.byteLength/d/n.info.sampleRate,n.info.expectedNextPcmPacketTimestamp!==null){let f=a-n.info.expectedNextPcmPacketTimestamp;if(f<.01)a=n.info.expectedNextPcmPacketTimestamp;else {let m=await this.padWithSilence(n,n.info.expectedNextPcmPacketTimestamp,f);a=n.info.expectedNextPcmPacketTimestamp+m;}}n.info.expectedNextPcmPacketTimestamp=a+c;}let l=this.createSampleForTrack(n,o,a,c,r.type);await this.registerSample(n,l);}finally{s();}}async padWithSilence(e,r,i){let s=pe(i,e.timescale);if(i=s/e.timescale,s>0){let{sampleSize:n,silentValue:o}=Ve(e.info.decoderConfig.codec),a=s*e.info.numberOfChannels,c=new Uint8Array(n*a).fill(o),l=this.createSampleForTrack(e,new Uint8Array(c.buffer),r,i,"key");await this.registerSample(e,l);}return i}async addSubtitleCue(e,r,i){let s=await this.mutex.acquire();try{let n=this.getSubtitleTrackData(e,i);this.validateTimestamp(n.track,r.timestamp,!0),e.source._codec==="webvtt"&&(n.cueQueue.push(r),await this.processWebVTTCues(n,r.timestamp));}finally{s();}}async processWebVTTCues(e,r){for(;e.cueQueue.length>0;){let i=new Set([]);for(let l of e.cueQueue)g(l.timestamp<=r),g(e.lastCueEndTimestamp<=l.timestamp+l.duration),i.add(Math.max(l.timestamp,e.lastCueEndTimestamp)),i.add(l.timestamp+l.duration);let s=[...i].sort((l,u)=>l-u),n=s[0],o=s[1]??n;if(r<o)break;if(e.lastCueEndTimestamp<n){this.auxWriter.seek(0);let l=lc();this.auxBoxWriter.writeBox(l);let u=this.auxTarget._getSlice(0,this.auxWriter.getPos()),d=this.createSampleForTrack(e,u,e.lastCueEndTimestamp,n-e.lastCueEndTimestamp,"key");await this.registerSample(e,d),e.lastCueEndTimestamp=n;}this.auxWriter.seek(0);for(let l=0;l<e.cueQueue.length;l++){let u=e.cueQueue[l];if(u.timestamp>=o)break;Hs.lastIndex=0;let d=Hs.test(u.text),f=u.timestamp+u.duration,m=e.cueToSourceId.get(u);if(m===void 0&&o<f&&(m=e.nextSourceId++,e.cueToSourceId.set(u,m)),u.notes){let b=dc(u.notes);this.auxBoxWriter.writeBox(b);}let p=uc(u.text,d?n:null,u.identifier??null,u.settings??null,m??null);this.auxBoxWriter.writeBox(p),f===o&&e.cueQueue.splice(l--,1);}let a=this.auxTarget._getSlice(0,this.auxWriter.getPos()),c=this.createSampleForTrack(e,a,n,o-n,"key");await this.registerSample(e,c),e.lastCueEndTimestamp=o;}}createSampleForTrack(e,r,i,s,n){return {timestamp:i,decodeTimestamp:i,duration:s,data:r,size:r.byteLength,type:n,timescaleUnitsToNextSample:pe(s,e.timescale)}}processTimestamps(e,r){if(e.timestampProcessingQueue.length===0)return;if(e.type==="audio"&&e.info.requiresPcmTransformation){this.isFragmented||(e.startTimestampOffset??(e.startTimestampOffset=e.timestampProcessingQueue[0].timestamp));let s=0;for(let n=0;n<e.timestampProcessingQueue.length;n++){let o=e.timestampProcessingQueue[n],a=pe(o.duration,e.timescale);s+=a;}if(e.timeToSampleTable.length===0)e.timeToSampleTable.push({sampleCount:s,sampleDelta:1});else {let n=fe(e.timeToSampleTable);n.sampleCount+=s;}e.timestampProcessingQueue.length=0;return}let i=e.timestampProcessingQueue.map(s=>s.timestamp).sort((s,n)=>s-n);this.isFragmented||(e.startTimestampOffset??(e.startTimestampOffset=i[0]));for(let s=0;s<e.timestampProcessingQueue.length;s++){let n=e.timestampProcessingQueue[s];n.decodeTimestamp=i[s];let o=pe(n.timestamp-n.decodeTimestamp,e.timescale),a=pe(n.duration,e.timescale);if(e.lastTimescaleUnits!==null){g(e.lastSample);let c=pe(n.decodeTimestamp,e.timescale,!1),l=Math.round(c-e.lastTimescaleUnits);if(g(l>=0),e.lastTimescaleUnits+=l,e.lastSample.timescaleUnitsToNextSample=l,!this.isFragmented){let u=fe(e.timeToSampleTable);if(g(u),u.sampleCount===1){u.sampleDelta=l;let f=e.timeToSampleTable[e.timeToSampleTable.length-2];f&&f.sampleDelta===l&&(f.sampleCount++,e.timeToSampleTable.pop(),u=f);}else u.sampleDelta!==l&&(u.sampleCount--,e.timeToSampleTable.push(u={sampleCount:1,sampleDelta:l}));u.sampleDelta===a?u.sampleCount++:e.timeToSampleTable.push({sampleCount:1,sampleDelta:a});let d=fe(e.compositionTimeOffsetTable);g(d),d.sampleCompositionTimeOffset===o?d.sampleCount++:e.compositionTimeOffsetTable.push({sampleCount:1,sampleCompositionTimeOffset:o});}}else e.lastTimescaleUnits=pe(n.decodeTimestamp,e.timescale,!1),this.isFragmented||(e.timeToSampleTable.push({sampleCount:1,sampleDelta:a}),e.compositionTimeOffsetTable.push({sampleCount:1,sampleCompositionTimeOffset:o}));e.lastSample=n;}if(e.timestampProcessingQueue.length=0,g(e.lastSample),g(e.lastTimescaleUnits!==null),r!==void 0&&e.lastSample.timescaleUnitsToNextSample===0){g(r.type==="key");let s=pe(r.timestamp,e.timescale,!1),n=Math.round(s-e.lastTimescaleUnits);e.lastSample.timescaleUnitsToNextSample=n;}}async registerSample(e,r){r.type==="key"&&this.processTimestamps(e,r),e.timestampProcessingQueue.push(r),this.isFragmented?(e.sampleQueue.push(r),await this.interleaveSamples()):this.fastStart==="reserve"?await this.registerSampleFastStartReserve(e,r):await this.addSampleToTrack(e,r);}async addSampleToTrack(e,r){if(!this.isFragmented&&(e.samples.push(r),this.fastStart==="reserve")){let s=e.track.metadata.maximumPacketCount;if(g(s!==void 0),e.samples.length>s)throw new Error(`Track #${e.track.id} has already reached the maximum packet count (${s}). Either add less packets or increase the maximum packet count.`)}let i=!1;if(!e.currentChunk)i=!0;else {e.currentChunk.startTimestamp=Math.min(e.currentChunk.startTimestamp,r.timestamp);let s=r.timestamp-e.currentChunk.startTimestamp;if(this.isFragmented){let n=this.trackDatas.every(o=>{if(e===o)return r.type==="key";let a=o.sampleQueue[0];return a?a.type==="key":o.closed});s>=this.minimumFragmentDuration&&n&&r.timestamp>this.maxWrittenTimestamp&&(i=!0,await this.finalizeFragment());}else i=s>=.5;}i&&(e.currentChunk&&await this.finalizeCurrentChunk(e),e.currentChunk={startTimestamp:r.timestamp,samples:[],offset:null,moofOffset:null,trafIndex:null}),g(e.currentChunk),e.currentChunk.samples.push(r),this.isFragmented&&(this.maxWrittenTimestamp=Math.max(this.maxWrittenTimestamp,r.timestamp),this.maxWrittenEndTimestamp=Math.max(this.maxWrittenEndTimestamp,r.timestamp+r.duration),this.minWrittenTimestamp=Math.min(this.minWrittenTimestamp,r.timestamp));}async finalizeCurrentChunk(e){if(g(!this.isFragmented),g(this.writer),!e.currentChunk)return;e.finalizedChunks.push(e.currentChunk),this.finalizedChunks.push(e.currentChunk);let r=e.currentChunk.samples.length;if(e.type==="audio"&&e.info.requiresPcmTransformation&&(r=e.currentChunk.samples.reduce((i,s)=>i+pe(s.duration,e.timescale),0)),(e.compactlyCodedChunkTable.length===0||fe(e.compactlyCodedChunkTable).samplesPerChunk!==r)&&e.compactlyCodedChunkTable.push({firstChunk:e.finalizedChunks.length,samplesPerChunk:r}),this.fastStart==="in-memory"){e.currentChunk.offset=0;return}e.currentChunk.offset=this.writer.getPos();for(let i of e.currentChunk.samples)g(i.data),this.writer.write(i.data),i.data=null;await this.writer.flush();}async interleaveSamples(e=!1){if(g(this.isFragmented),!(!e&&!this.allTracksAreKnown()))e:for(;;){let r=null,i=1/0;for(let n of this.trackDatas){if(!e&&n.sampleQueue.length===0&&!n.closed)break e;n.sampleQueue.length>0&&n.sampleQueue[0].timestamp<i&&(r=n,i=n.sampleQueue[0].timestamp);}if(!r)break;let s=r.sampleQueue.shift();await this.addSampleToTrack(r,s);}}async finalizeFragment(e=!this.isCmaf){if(g(this.isFragmented),!this.wroteFragmentedHeader){this.wroteFragmentedHeader=!0;let m=this.initBoxWriter??this.boxWriter;g(m),this.formatOptions.onMoov&&m.writer.startTrackingWrites(),this.ensureOneEnabledTrack();let p=Vr(this);if(m.writeBox(p),this.formatOptions.onMoov){let{data:b,start:y}=m.writer.stopTrackingWrites();this.formatOptions.onMoov(b,y);}if(this.isCmaf){g(this.initWriter),await this.initWriter.flush(),await this.initWriter.finalize(),this.writer=await this.output._getRootWriter(!0),this.boxWriter=new ur(this.writer);let b=this.boxWriter.measureBox($s()),y=this.boxWriter.measureBox(Xs(this,0));this.segmentHeaderSize=b+y,this.writer.seek(this.segmentHeaderSize);}}g(this.writer),g(this.boxWriter);let r=this.trackDatas.filter(m=>m.currentChunk);if(r.length===0){e&&await this.writer.flush();return}let i=this.nextFragmentNumber++,s=Ys(i,r),n=this.writer.getPos(),o=n+this.boxWriter.measureBox(s),a=o+Ye,c=1/0;for(let m=0;m<r.length;m++){let p=r[m];p.currentChunk.offset=a,p.currentChunk.moofOffset=n,p.currentChunk.trafIndex=m;for(let b of p.currentChunk.samples)a+=b.size;c=Math.min(c,p.currentChunk.startTimestamp);}let l=a-o,u=l>=2**32;if(u)for(let m of r)m.currentChunk.offset+=Et-Ye;this.formatOptions.onMoof&&this.writer.startTrackingWrites();let d=Ys(i,r);if(this.boxWriter.writeBox(d),this.formatOptions.onMoof){let{data:m,start:p}=this.writer.stopTrackingWrites();this.formatOptions.onMoof(m,p,c);}g(this.writer.getPos()===o),this.formatOptions.onMdat&&this.writer.startTrackingWrites();let f=Ci(u);f.size=l,this.boxWriter.writeBox(f),this.writer.seek(o+(u?Et:Ye));for(let m of r)for(let p of m.currentChunk.samples)this.writer.write(p.data),p.data=null;if(this.formatOptions.onMdat){let{data:m,start:p}=this.writer.stopTrackingWrites();this.formatOptions.onMdat(m,p);}for(let m of r)m.finalizedChunks.push(m.currentChunk),this.finalizedChunks.push(m.currentChunk),m.currentChunk=null;e&&await this.writer.flush();}async registerSampleFastStartReserve(e,r){this.allTracksAreKnown()?(this.mdat||await this.createFastStartReserveMdat(),await this.addSampleToTrack(e,r)):e.sampleQueue.push(r);}async createFastStartReserveMdat(){g(this.writer),g(this.boxWriter),this.ensureOneEnabledTrack();let e=Vr(this),i=this.boxWriter.measureBox(e)+this.computeSampleTableSizeUpperBound()+4096;g(this.ftypSize!==null),this.writer.seek(this.ftypSize+i),this.formatOptions.onMdat&&this.writer.startTrackingWrites(),this.mdat=Ci(!0),this.boxWriter.writeBox(this.mdat);for(let s of this.trackDatas){for(let n of s.sampleQueue)await this.addSampleToTrack(s,n);s.sampleQueue.length=0;}}computeSampleTableSizeUpperBound(){g(this.fastStart==="reserve");let e=0;for(let r of this.trackDatas){let i=r.track.metadata.maximumPacketCount;g(i!==void 0),e+=8*Math.ceil(2/3*i),e+=4*i,e+=8*Math.ceil(2/3*i),e+=12*Math.ceil(2/3*i),e+=4*i,e+=8*i;}return e}async onTrackClose(e){let r=await this.mutex.acquire(),i=this.trackDatas.find(s=>s.track===e);i&&(i.closed=!0,i.type==="subtitle"&&e.source._codec==="webvtt"&&await this.processWebVTTCues(i,1/0),this.processTimestamps(i)),this.allTracksAreKnown()&&this.allTracksKnown.resolve(),this.isFragmented&&await this.interleaveSamples(),r();}ensureOneEnabledTrack(){for(let e of ["video","audio","subtitle"]){let r=this.trackDatas.filter(s=>s.type===e);if(r.length===0)continue;if(!r.some(s=>s.track.metadata.disposition?.default!==!1)){let s=r[0];s.track.metadata.disposition={...s.track.metadata.disposition,default:!0};}}}async forceFragmentFinalization(){g(this.isFragmented);let e=await this.mutex.acquire();try{for(let r of this.trackDatas)r.type==="subtitle"&&r.track.source._codec==="webvtt"&&await this.processWebVTTCues(r,1/0),this.processTimestamps(r);await this.interleaveSamples(!0),await this.finalizeFragment();}finally{e();}}async finalize(){let e=await this.mutex.acquire();this.allTracksKnown.resolve(),this.ensureOneEnabledTrack(),!this.mdat&&this.fastStart==="reserve"&&await this.createFastStartReserveMdat();for(let r of this.trackDatas)r.closed=!0,r.type==="subtitle"&&r.track.source._codec==="webvtt"&&await this.processWebVTTCues(r,1/0),this.processTimestamps(r);if(this.isFragmented)await this.interleaveSamples(!0),await this.finalizeFragment(!1);else for(let r of this.trackDatas)if(await this.finalizeCurrentChunk(r),r.startTimestampOffset!==null)for(let i=0;i<r.samples.length;i++){let s=r.samples[i];s.timestamp-=r.startTimestampOffset,s.decodeTimestamp-=r.startTimestampOffset;}if(g(this.writer),g(this.boxWriter),this.fastStart==="in-memory"){this.mdat=Ci(!1);let r;for(let s=0;s<2;s++){let n=Vr(this),o=this.boxWriter.measureBox(n);r=this.boxWriter.measureBox(this.mdat);let a=this.writer.getPos()+o+r;for(let c of this.finalizedChunks){c.offset=a;for(let{data:l}of c.samples)g(l),a+=l.byteLength,r+=l.byteLength;}if(a<2**32)break;r>=2**32&&(this.mdat.largeSize=!0);}this.formatOptions.onMoov&&this.writer.startTrackingWrites();let i=Vr(this);if(this.boxWriter.writeBox(i),this.formatOptions.onMoov){let{data:s,start:n}=this.writer.stopTrackingWrites();this.formatOptions.onMoov(s,n);}this.formatOptions.onMdat&&this.writer.startTrackingWrites(),this.mdat.size=r,this.boxWriter.writeBox(this.mdat);for(let s of this.finalizedChunks)for(let n of s.samples)g(n.data),this.writer.write(n.data),n.data=null;if(this.formatOptions.onMdat){let{data:s,start:n}=this.writer.stopTrackingWrites();this.formatOptions.onMdat(s,n);}}else if(this.isFragmented)if(this.isCmaf){let r=this.segmentHeaderSize!==null?this.writer.getPos()-this.segmentHeaderSize:0;this.writer.seek(0),this.boxWriter.writeBox($s()),this.boxWriter.writeBox(Xs(this,r));}else {let r=this.writer.getPos(),i=cc(this.trackDatas);this.boxWriter.writeBox(i);let s=this.writer.getPos()-r;this.writer.seek(this.writer.getPos()-4),this.boxWriter.writeU32(s);}else {g(this.mdat);let r=this.boxWriter.offsets.get(this.mdat);g(r!==void 0);let i=this.writer.getPos()-r;if(this.mdat.size=i,this.mdat.largeSize=i>=2**32,this.boxWriter.patchBox(this.mdat),this.formatOptions.onMdat){let{data:n,start:o}=this.writer.stopTrackingWrites();this.formatOptions.onMdat(n,o);}let s=Vr(this);if(this.fastStart==="reserve"){g(this.ftypSize!==null),this.writer.seek(this.ftypSize),this.formatOptions.onMoov&&this.writer.startTrackingWrites(),this.boxWriter.writeBox(s);let n=this.boxWriter.offsets.get(this.mdat)-this.writer.getPos();this.boxWriter.writeBox(oc(n));}else this.formatOptions.onMoov&&this.writer.startTrackingWrites(),this.boxWriter.writeBox(s);if(this.formatOptions.onMoov){let{data:n,start:o}=this.writer.stopTrackingWrites();this.formatOptions.onMoov(n,o);}}e();}};var Vn=class{constructor(e){this.sourceSampleRate=null,this.sourceNumberOfChannels=null,this.startTime=null,this.bufferStartFrame=0,this.maxWrittenFrame=null,this.targetSampleRate=e.targetSampleRate,this.targetNumberOfChannels=e.targetNumberOfChannels,this.onSample=e.onSample,this.bufferSizeInFrames=Math.floor(this.targetSampleRate*5),this.bufferSizeInSamples=this.bufferSizeInFrames*this.targetNumberOfChannels,this.outputBuffer=new Float32Array(this.bufferSizeInSamples);}doChannelMixerSetup(){g(this.sourceNumberOfChannels!==null);let e=this.sourceNumberOfChannels,r=this.targetNumberOfChannels;e===1&&r===2?this.channelMixer=(i,s)=>i[s*e]:e===1&&r===4?this.channelMixer=(i,s,n)=>i[s*e]*+(n<2):e===1&&r===6?this.channelMixer=(i,s,n)=>i[s*e]*+(n===2):e===2&&r===1?this.channelMixer=(i,s)=>{let n=s*e;return .5*(i[n]+i[n+1])}:e===2&&r===4?this.channelMixer=(i,s,n)=>i[s*e+n]*+(n<2):e===2&&r===6?this.channelMixer=(i,s,n)=>i[s*e+n]*+(n<2):e===4&&r===1?this.channelMixer=(i,s)=>{let n=s*e;return .25*(i[n]+i[n+1]+i[n+2]+i[n+3])}:e===4&&r===2?this.channelMixer=(i,s,n)=>{let o=s*e;return .5*(i[o+n]+i[o+n+2])}:e===4&&r===6?this.channelMixer=(i,s,n)=>{let o=s*e;return n<2?i[o+n]:n===2||n===3?0:i[o+n-2]}:e===6&&r===1?this.channelMixer=(i,s)=>{let n=s*e;return Math.SQRT1_2*(i[n]+i[n+1])+i[n+2]+.5*(i[n+4]+i[n+5])}:e===6&&r===2?this.channelMixer=(i,s,n)=>{let o=s*e;return i[o+n]+Math.SQRT1_2*(i[o+2]+i[o+n+4])}:e===6&&r===4?this.channelMixer=(i,s,n)=>{let o=s*e;return n<2?i[o+n]+Math.SQRT1_2*i[o+2]:i[o+n+2]}:this.channelMixer=(i,s,n)=>n<e?i[s*e+n]:0;}ensureTempBufferSize(e){let r=this.tempSourceBuffer.length;for(;r<e;)r*=2;if(r!==this.tempSourceBuffer.length){let i=new Float32Array(r);i.set(this.tempSourceBuffer),this.tempSourceBuffer=i;}}async add(e){this.sourceSampleRate===null&&(this.sourceSampleRate=e.sampleRate,this.sourceNumberOfChannels=e.numberOfChannels,this.startTime=e.timestamp,this.tempSourceBuffer=new Float32Array(this.sourceSampleRate*this.sourceNumberOfChannels),this.doChannelMixerSetup()),g(this.startTime!==null);let r=e.numberOfFrames*e.numberOfChannels;this.ensureTempBufferSize(r);let i=e.allocationSize({planeIndex:0,format:"f32"}),s=new Float32Array(this.tempSourceBuffer.buffer,0,i/4);e.copyTo(s,{planeIndex:0,format:"f32"});let n=e.timestamp-this.startTime,o=n+e.duration,a=Math.floor((n-1/this.sourceSampleRate)*this.targetSampleRate)+1,c=Math.ceil(o*this.targetSampleRate);for(let l=a;l<c;l++){if(l<this.bufferStartFrame)continue;for(;l>=this.bufferStartFrame+this.bufferSizeInFrames;)await this.finalizeCurrentBuffer(),this.bufferStartFrame+=this.bufferSizeInFrames;let u=l-this.bufferStartFrame;g(u<this.bufferSizeInFrames);let m=(l/this.targetSampleRate-n)*this.sourceSampleRate,p=Math.floor(m),b=Math.ceil(m),y=m-p;for(let w=0;w<this.targetNumberOfChannels;w++){let A=0,T=0;p>=0&&p<e.numberOfFrames&&(A=this.channelMixer(s,p,w)),b>=0&&b<e.numberOfFrames&&(T=this.channelMixer(s,b,w));let I=A+y*(T-A),v=u*this.targetNumberOfChannels+w;this.outputBuffer[v]+=I;}this.maxWrittenFrame===null?this.maxWrittenFrame=u:this.maxWrittenFrame=Math.max(this.maxWrittenFrame,u);}}async finalizeCurrentBuffer(){if(this.maxWrittenFrame===null)return;g(this.startTime!==null);let e=(this.maxWrittenFrame+1)*this.targetNumberOfChannels,r=new Float32Array(e);r.set(this.outputBuffer.subarray(0,e));let i=new Fe({format:"f32",sampleRate:this.targetSampleRate,numberOfChannels:this.targetNumberOfChannels,timestamp:this.startTime+this.bufferStartFrame/this.targetSampleRate,data:r});await this.onSample(i),this.outputBuffer.fill(0),this.maxWrittenFrame=null;}finalize(){return this.finalizeCurrentBuffer()}};var qu=function(t,e,r){if(e!=null){if(typeof e!="object"&&typeof e!="function")throw new TypeError("Object expected.");var i,s;if(r){if(!Symbol.asyncDispose)throw new TypeError("Symbol.asyncDispose is not defined.");i=e[Symbol.asyncDispose];}if(i===void 0){if(!Symbol.dispose)throw new TypeError("Symbol.dispose is not defined.");i=e[Symbol.dispose],r&&(s=i);}if(typeof i!="function")throw new TypeError("Object not disposable.");s&&(i=function(){try{s.call(this);}catch(n){return Promise.reject(n)}}),t.stack.push({value:e,dispose:i,async:r});}else r&&t.stack.push({async:!0});return e},Lu=(function(t){return function(e){function r(o){e.error=e.hasError?new t(o,e.error,"An error was suppressed during disposal."):o,e.hasError=!0;}var i,s=0;function n(){for(;i=e.stack.pop();)try{if(!i.async&&s===1)return s=0,e.stack.push(i),Promise.resolve().then(n);if(i.dispose){var o=i.dispose.call(i.value);if(i.async)return s|=2,Promise.resolve(o).then(n,function(a){return r(a),n()})}else s|=1;}catch(a){r(a);}if(s===1)return e.hasError?Promise.reject(e.error):Promise.resolve();if(e.hasError)throw e.error}return n()}})(typeof SuppressedError=="function"?SuppressedError:function(t,e,r){var i=new Error(r);return i.name="SuppressedError",i.error=t,i.suppressed=e,i}),vi=class{constructor(){this._connectedTrack=null,this._closingPromise=null,this._closed=!1;}_ensureValidAdd(){if(!this._connectedTrack)throw new Error("Source is not connected to an output track.");if(this._connectedTrack.output.state==="canceled")throw new Error("Output has been canceled.");if(this._connectedTrack.output.state==="finalizing"||this._connectedTrack.output.state==="finalized")throw new Error("Output has been finalized.");if(this._connectedTrack.output.state==="pending")throw new Error("Output has not started.");if(this._closed)throw new Error("Source is closed.")}async _start(){}async _flushAndClose(e){}close(){if(this._closingPromise)return;let e=this._connectedTrack;if(!e)throw new Error("Cannot call close without connecting the source to an output track.");if(e.output.state==="pending")throw new Error("Cannot call close before output has been started.");this._closingPromise=(async()=>{await this._flushAndClose(!1),this._closed=!0,!(e.output.state==="finalizing"||e.output.state==="finalized")&&e.output._muxer.onTrackClose(e);})();}async _flushOrWaitForOngoingClose(e){return this._closingPromise??(this._closingPromise=(async()=>{await this._flushAndClose(e),this._closed=!0;})())}},Wr=class extends vi{constructor(e){if(super(),this._connectedTrack=null,!De.includes(e))throw new TypeError(`Invalid video codec '${e}'. Must be one of: ${De.join(", ")}.`);this._codec=e;}},ro=(t,e)=>{if(t.metadata.hasOnlyKeyPackets&&e.type!=="key")throw new Error("Cannot add non-key packets to a hasOnlyKeyPackets video track.")},Un=class extends Wr{constructor(e){super(e);}add(e,r){if(!(e instanceof de))throw new TypeError("packet must be an EncodedPacket.");if(e.isMetadataOnly)throw new TypeError("Metadata-only packets cannot be added.");if(r!==void 0&&(!r||typeof r!="object"))throw new TypeError("meta, when provided, must be an object.");return this._ensureValidAdd(),ro(this._connectedTrack,e),this._connectedTrack.output._muxer.addEncodedVideoPacket(this._connectedTrack,e,r)}},io=class{setError(e){this.errorSet||(this.error=e,this.errorSet=!0);}constructor(e,r){this.source=e,this.encodingConfig=r,this.ensureEncoderPromise=null,this.encoderInitialized=!1,this.encoder=null,this.muxer=null,this.lastMultipleOfKeyFrameInterval=-1,this.emittedEncoderPackets=0,this.codedWidth=null,this.codedHeight=null,this.outputWidth=null,this.outputHeight=null,this.frameRateLastSample=null,this.frameRateLastTimestamp=null,this.frameRateLastEndTimestamp=null,this.preciseTimings=[],this.customEncoder=null,this.customEncoderCallSerializer=new zt,this.customEncoderQueueSize=0,this.defaultEncodeOptions={},this.alphaEncoder=null,this.splitter=null,this.splitterCreationFailed=!1,this.alphaFrameQueue=[],this.error=null,this.errorSet=!1,this.lastMuxerPromise=Promise.resolve(),this.closed=!1;}async add(e,r,i){let s=e;try{this.checkForEncoderError(),this.source._ensureValidAdd();let n=this.encodingConfig,o=n.sizeChangeBehavior??"deny",a=!1;if(this.codedWidth!==null&&this.codedHeight!==null){if((e.codedWidth!==this.codedWidth||e.codedHeight!==this.codedHeight)&&(a=!0,o==="deny"))throw new Error(`Video sample size must remain constant. Expected ${this.codedWidth}x${this.codedHeight}, got ${e.codedWidth}x${e.codedHeight}. To allow the sample size to change over time, set \`sizeChangeBehavior\` to a value other than 'deny' in the encoding options.`)}else this.codedWidth=e.codedWidth,this.codedHeight=e.codedHeight;if(n.transform?.width!==void 0||n.transform?.height!==void 0||n.transform?.rotate!==void 0||n.transform?.crop!==void 0||n.transform?.force===!0||a&&o!=="passThrough"){let d=n.transform?.width,f=n.transform?.height,m=n.transform?.fit??"fill";a&&o!=="passThrough"&&(g(this.outputWidth),g(this.outputHeight),g(o!=="deny"),d=this.outputWidth,f=this.outputHeight,m=o);let p=await e.transform({width:d,height:f,roundDimensionsTo:2,crop:n.transform?.crop,rotate:n.transform?.rotate,fit:m,alpha:n.alpha});(this.outputWidth===null||this.outputHeight===null)&&(this.outputWidth=p.displayWidth,this.outputHeight=p.displayHeight),r&&e.close(),e=p,r=!0;}else (this.outputWidth===null||this.outputHeight===null)&&(this.outputWidth=e.codedWidth,this.outputHeight=e.codedHeight);let u=n.transform?.frameRate;if(u!==void 0){let d=e.timestamp+e.duration,f=ns(e.timestamp,u);if(this.frameRateLastSample!==null)if(f<=this.frameRateLastTimestamp){this.frameRateLastSample.close(),this.frameRateLastSample=e.clone(),this.frameRateLastEndTimestamp=d;return}else await this.padFrameRate(f,i);e===s&&(e=e.clone(),r=!0),e.setTimestamp(f),e.setDuration(1/u),this.frameRateLastSample?.close(),this.frameRateLastSample=e.clone(),this.frameRateLastTimestamp=f,this.frameRateLastEndTimestamp=d;}await this.processAndEncode(e,i);}finally{r&&e.close();}}async processAndEncode(e,r){let i=this.encodingConfig,s;if(i.transform?.process){let n=i.transform.process(e);if(U(n)&&(n=await n),n===null)return;Array.isArray(n)||(n=[n]);let o=[];try{for(let a of n)a instanceof Ke?o.push(a):typeof VideoFrame<"u"&&a instanceof VideoFrame?o.push(new Ke(a)):o.push(new Ke(a,{timestamp:e.timestamp,duration:e.duration}));}catch(a){for(let c of o)c!==e&&c.close();for(let c of n)(c instanceof Ke&&c!==e||typeof VideoFrame<"u"&&c instanceof VideoFrame)&&c.close();throw a}s=o;}else s=[e];try{for(let n of s){if(this.encoderInitialized||(this.ensureEncoderPromise||this.ensureEncoder(n),this.encoderInitialized||await this.ensureEncoderPromise),g(this.encoderInitialized),this.closed)break;let o=this.encodingConfig.keyFrameInterval??2,a=Math.floor(n.timestamp/o),c={...this.defaultEncodeOptions,...n.encodeOptions,...r},l={...c,keyFrame:c.keyFrame!==void 0?c.keyFrame:o===0||a!==this.lastMultipleOfKeyFrameInterval};if(this.lastMultipleOfKeyFrameInterval=a,this.encodingConfig.onEncodedSample?.(n),this.customEncoder){this.customEncoderQueueSize++;let u=n.clone(),d=this.customEncoderCallSerializer.call(()=>this.customEncoder.encode(u,l)).catch(f=>this.setError(f)).finally(()=>{this.customEncoderQueueSize--,u.close();});this.customEncoderQueueSize>=4&&await d;}else {g(this.encoder);let u=n.toVideoFrame(),d=ce(this.preciseTimings,u.timestamp,m=>m.microsecondTimestamp),f=d!==-1?this.preciseTimings[d]:null;if(f&&f.microsecondTimestamp===u.timestamp?(f.timestamp!==n.timestamp&&(f.timestampIsValid=!1),f.duration!==n.duration&&(f.durationIsValid=!1)):(this.preciseTimings.splice(d+1,0,{microsecondTimestamp:u.timestamp,timestamp:n.timestamp,duration:n.duration,timestampIsValid:!0,durationIsValid:!0}),this.preciseTimings.length>128&&this.preciseTimings.shift()),this.alphaEncoder)if(!!u.format&&!u.format.includes("A")||this.splitterCreationFailed){this.alphaFrameQueue.push(null);try{this.encoder.encode(u,l);}finally{u.close();}}else {this.splitter||(this.splitter=new no);let{colorFrame:p,alphaFrame:b}=await this.splitter.split(u);this.alphaFrameQueue.push(b);try{this.encoder.encode(p,l);}finally{p.close();}}else try{this.encoder.encode(u,l);}finally{u.close();}this.encoder.encodeQueueSize>=4&&await new Promise(m=>this.encoder.addEventListener("dequeue",m,{once:!0}));}await this.lastMuxerPromise;}}finally{for(let n of s)n!==e&&n.close();}}async padFrameRate(e,r){let i=this.encodingConfig.transform.frameRate;g(this.frameRateLastSample);let s=Math.round((e-this.frameRateLastTimestamp)*i);for(let n=1;n<s;n++){let o={stack:[],error:void 0,hasError:!1};try{let a=qu(o,this.frameRateLastSample.clone(),!1);a.setTimestamp(this.frameRateLastTimestamp+n/i),a.setDuration(1/i),await this.processAndEncode(a,r);}catch(a){o.error=a,o.hasError=!0;}finally{Lu(o);}}}ensureEncoder(e){this.ensureEncoderPromise=(async()=>{let r=Kt(this.encodingConfig.quality,this.encodingConfig.bitrate);g(r!==void 0);let i=Fs({...this.encodingConfig,quality:r,width:e.codedWidth,height:e.codedHeight,squarePixelWidth:e.squarePixelWidth,squarePixelHeight:e.squarePixelHeight,framerate:this.source._connectedTrack?.metadata.frameRate}),s=null,n;for(let a of i){let c=a.config;if(this.encodingConfig.onEncoderConfig?.(c),n=Cn.find(u=>u.supports(this.encodingConfig.codec,c)),n){s=a;break}if(typeof VideoEncoder>"u")continue;if(c.alpha="discard",this.encodingConfig.alpha==="keep"&&(c.latencyMode="quality"),(c.width%2===1||c.height%2===1)&&(this.encodingConfig.codec==="avc"||this.encodingConfig.codec==="hevc"))throw new Error(`The dimensions ${c.width}x${c.height} are not supported for codec '${this.encodingConfig.codec}'; both width and height must be even numbers. Make sure to round your dimensions to the nearest even number.`);try{if((await VideoEncoder.isConfigSupported(c)).supported){s=a;break}}catch{}}if(!s){if(typeof VideoEncoder>"u")throw new Error(yr("VideoEncoder"));let a=i[0].config,c=i.map(({config:l,quantizer:u})=>u!==null?`quantizer ${u}`:`${l.bitrate} bps`);throw new Error(`This specific encoder configuration (${a.codec}, ${c.join(" / ")}, ${a.width}x${a.height}, hardware acceleration: ${a.hardwareAcceleration??"no-preference"}) is not supported in this environment. Consider using another codec or changing your video parameters.`)}let o=s.config;if(s.quantizer!==null&&(this.defaultEncodeOptions=Ms(this.encodingConfig.codec,s.quantizer)),n)this.customEncoder=new n,this.customEncoder.codec=this.encodingConfig.codec,this.customEncoder.config=o,this.customEncoder.onPacket=(a,c)=>{if(!(a instanceof de))throw new TypeError("The first argument passed to onPacket must be an EncodedPacket.");if(c!==void 0&&(!c||typeof c!="object"))throw new TypeError("The second argument passed to onPacket must be an object or undefined.");ro(this.source._connectedTrack,a),this.encodingConfig.onEncodedPacket?.(a,c),this.lastMuxerPromise=this.muxer.addEncodedVideoPacket(this.source._connectedTrack,a,c).catch(l=>{this.setError(l);});},this.customEncoder.onError=a=>{this.setError(a);},await this.customEncoder.init();else {let a=[],c=[],l=0,u=0,d=(m,p,b)=>{let y={};if(p){let v=new Uint8Array(p.byteLength);p.copyTo(v),y.alpha=v;}let w=de.fromEncodedChunk(m,y),A=ce(this.preciseTimings,m.timestamp,v=>v.microsecondTimestamp),T=A!==-1?this.preciseTimings[A]:null,I=null;this.emittedEncoderPackets===0&&w.type==="delta"&&b?.decoderConfig&&(I=_r(this.encodingConfig.codec,b.decoderConfig,w.data)),(T&&T.microsecondTimestamp===m.timestamp||I!==null)&&(w=w.clone({timestamp:T?.timestampIsValid?T.timestamp:void 0,duration:T?.durationIsValid?T.duration:void 0,type:I??void 0})),ro(this.source._connectedTrack,w),this.encodingConfig.onEncodedPacket?.(w,b),this.lastMuxerPromise=this.muxer.addEncodedVideoPacket(this.source._connectedTrack,w,b).catch(v=>{this.setError(v);}),this.emittedEncoderPackets++;},f=new Error("Encoding error").stack;if(this.encoder=new VideoEncoder({output:(m,p)=>{if(!this.alphaEncoder){d(m,null,p);return}let b=this.alphaFrameQueue.shift();g(b!==void 0),b?(this.alphaEncoder.encode(b,{...this.defaultEncodeOptions,keyFrame:m.type==="key"}),u++,b.close(),a.push({chunk:m,meta:p})):u===0?d(m,null,p):(c.push(l+u),a.push({chunk:m,meta:p}));},error:m=>{m.stack=f,this.setError(m);}}),this.encoder.configure(o),this.encodingConfig.alpha==="keep"){let m=new Error("Encoding error").stack;this.alphaEncoder=new VideoEncoder({output:(p,b)=>{u--;let y=a.shift();for(g(y!==void 0),d(y.chunk,p,y.meta),l++;c.length>0&&c[0]===l;){c.shift();let w=a.shift();g(w!==void 0),d(w.chunk,null,w.meta);}},error:p=>{p.stack=m,this.setError(p);}}),this.alphaEncoder.configure(o);}}g(this.source._connectedTrack),this.muxer=this.source._connectedTrack.output._muxer,this.encoderInitialized=!0;})();}async flushAndClose(e){try{if(!e&&(this.checkForEncoderError(),this.frameRateLastSample)){let r=this.encodingConfig.transform.frameRate,i=ns(this.frameRateLastEndTimestamp,r);await this.padFrameRate(i);}this.closed=!0,e||(this.customEncoder?this.customEncoderCallSerializer.call(()=>this.customEncoder.flush()):this.encoder&&(await this.encoder.flush(),await this.alphaEncoder?.flush(),await ss(25)));}finally{this.closed=!0,this.frameRateLastSample?.close(),this.frameRateLastSample=null,this.customEncoder?await this.customEncoderCallSerializer.call(()=>this.customEncoder.close()).catch(r=>this.setError(r)):this.encoder&&(this.encoder.state!=="closed"&&this.encoder.close(),this.alphaEncoder&&this.alphaEncoder.state!=="closed"&&this.alphaEncoder.close(),this.alphaFrameQueue.forEach(r=>r?.close()),this.alphaFrameQueue.length=0,this.splitter?.close());}e||this.checkForEncoderError();}getQueueSize(){return this.customEncoder?this.customEncoderQueueSize:this.encoder?.encodeQueueSize??0}checkForEncoderError(){if(this.errorSet)throw this.error}},to=null,no=class{constructor(){this.worker=null,this.pendingRequests=new Map,this.nextRequestId=0;}split(e){if(!this.worker){if(!to){let s=new Blob([`(${Hu.toString()})()`],{type:"application/javascript"});to=URL.createObjectURL(s);}this.worker=new Worker(to),this.worker.addEventListener("message",s=>{let n=s.data,o=this.pendingRequests.get(n.id);o&&(this.pendingRequests.delete(n.id),"error"in n?o.reject(new Error(n.error)):o.resolve({colorFrame:n.colorFrame,alphaFrame:n.alphaFrame}));}),this.worker.addEventListener("error",s=>{let n=new Error(s.message||"Color/alpha splitter worker error.");for(let o of this.pendingRequests.values())o.reject(n);this.pendingRequests.clear();});}let r=this.nextRequestId++,i=he();return this.pendingRequests.set(r,i),this.worker.postMessage({id:r,sourceFrame:e},{transfer:[e]}),i.promise}close(){this.worker?.terminate(),this.worker=null;let e=new Error("Color/alpha splitter closed.");for(let r of this.pendingRequests.values())r.reject(e);this.pendingRequests.clear();}},Hu=()=>{let t=null,e=Promise.resolve();self.addEventListener("message",n=>{let{id:o,sourceFrame:a}=n.data;e=e.then(async()=>{try{let{colorFrame:c,alphaFrame:l}=await r(a);self.postMessage({id:o,colorFrame:c,alphaFrame:l},{transfer:[c,l]});}catch(c){self.postMessage({id:o,error:c.message});}finally{a.close();}});});let r=async n=>{let o=n.format;if(!o)throw new Error("CPU color/alpha splitting requires a known VideoFrame format.");let a=n.allocationSize();if((!t||t.byteLength!==a)&&(t=new Uint8Array(a)),await n.copyTo(t),o==="RGBA"||o==="BGRA")return i(t,o,n);if(o==="I420A"||o==="I420AP10"||o==="I420AP12"||o==="I422A"||o==="I422AP10"||o==="I422AP12"||o==="I444A"||o==="I444AP10"||o==="I444AP12")return s(t,o,n);throw new Error(`CPU color/alpha splitting does not support format '${o}'.`)},i=(n,o,a)=>{let c=a.visibleRect?.width??a.codedWidth,l=a.visibleRect?.height??a.codedHeight,u=c*l,d=Math.ceil(c/2),f=Math.ceil(l/2),m=u+d*f*2,p=new Uint8Array(m);for(let A=0,T=3;A<u;A++,T+=4)p[A]=n[T];p.fill(128,u);let b=new VideoFrame(n,{format:o==="RGBA"?"RGBX":"BGRX",codedWidth:c,codedHeight:l,timestamp:a.timestamp,duration:a.duration??void 0}),y={format:"I420",codedWidth:c,codedHeight:l,timestamp:a.timestamp,duration:a.duration??void 0,transfer:[p.buffer]},w=new VideoFrame(p,y);return {colorFrame:b,alphaFrame:w}},s=(n,o,a)=>{let c=a.visibleRect?.width??a.codedWidth,l=a.visibleRect?.height??a.codedHeight,u=o.includes("P10"),d=o.includes("P12"),f=u||d?2:1,m,p;o.startsWith("I420")?(m=Math.ceil(c/2),p=Math.ceil(l/2)):o.startsWith("I422")?(m=Math.ceil(c/2),p=l):(m=c,p=l);let b=c*l,y=m*p,w=b*f,A=y*f,T=b*f,I=w+A*2,v=o.replace("A",""),F=Math.ceil(c/2),E=Math.ceil(l/2),k=F*E,_=k*f,B=T+2*_,z=new Uint8Array(B),N=I;z.set(n.subarray(N,N+T),0);let Z=T,oe=u?512:d?2048:128;f===1?z.fill(oe,Z):new Uint16Array(z.buffer,Z,2*k).fill(oe);let Y=u?"I420P10":d?"I420P12":"I420",G=new VideoFrame(n.subarray(0,I),{format:v,codedWidth:c,codedHeight:l,timestamp:a.timestamp,duration:a.duration??void 0}),ne={format:Y,codedWidth:c,codedHeight:l,timestamp:a.timestamp,duration:a.duration??void 0,transfer:[z.buffer]},ge=new VideoFrame(z,ne);return {colorFrame:G,alphaFrame:ge}};},Ii=class extends Wr{constructor(e){Na(e),super(e.codec),this._encoder=new io(this,e);}add(e,r){if(!(e instanceof Ke))throw new TypeError("videoSample must be a VideoSample.");return this._encoder.add(e,!1,r)}_flushAndClose(e){return this._encoder.flushAndClose(e)}};var qr=class extends vi{constructor(e){if(super(),this._connectedTrack=null,!ze.includes(e))throw new TypeError(`Invalid audio codec '${e}'. Must be one of: ${ze.join(", ")}.`);this._codec=e;}},Nn=class extends qr{constructor(e){super(e);}add(e,r){if(!(e instanceof de))throw new TypeError("packet must be an EncodedPacket.");if(e.isMetadataOnly)throw new TypeError("Metadata-only packets cannot be added.");if(r!==void 0&&(!r||typeof r!="object"))throw new TypeError("meta, when provided, must be an object.");return this._ensureValidAdd(),this._connectedTrack.output._muxer.addEncodedAudioPacket(this._connectedTrack,e,r)}},so=class{setError(e){this.errorSet||(this.error=e,this.errorSet=!0);}constructor(e,r){this.source=e,this.encodingConfig=r,this.ensureEncoderPromise=null,this.encoderInitialized=!1,this.encoder=null,this.muxer=null,this.lastNumberOfChannels=null,this.lastSampleRate=null,this.isPcmEncoder=!1,this.outputSampleSize=null,this.writeOutputValue=null,this.customEncoder=null,this.customEncoderCallSerializer=new zt,this.customEncoderQueueSize=0,this.lastEndSampleIndex=null,this.resampler=null,this.error=null,this.errorSet=!1,this.lastMuxerPromise=Promise.resolve(),this.closed=!1;}async add(e,r){try{if(this.checkForEncoderError(),this.source._ensureValidAdd(),this.lastNumberOfChannels!==null&&this.lastSampleRate!==null){if(e.numberOfChannels!==this.lastNumberOfChannels||e.sampleRate!==this.lastSampleRate)throw new Error(`Audio parameters must remain constant. Expected ${this.lastNumberOfChannels} channels at ${this.lastSampleRate} Hz, got ${e.numberOfChannels} channels at ${e.sampleRate} Hz.`)}else this.lastNumberOfChannels=e.numberOfChannels,this.lastSampleRate=e.sampleRate;let i=this.encodingConfig;i.transform?.numberOfChannels!==void 0||i.transform?.sampleRate!==void 0?(this.resampler||(this.resampler=new Vn({targetNumberOfChannels:i.transform.numberOfChannels??e.numberOfChannels,targetSampleRate:i.transform.sampleRate??e.sampleRate,onSample:async n=>{await this.processAndEncode(n,!0);}})),await this.resampler.add(e)):await this.processAndEncode(e,r);}finally{r&&e.close();}}async processAndEncode(e,r){let i=this.encodingConfig;if(i.transform?.sampleFormat!==void 0&&Ma(e.format)!==i.transform.sampleFormat){let s=Da(e,i.transform.sampleFormat);r&&e.close(),e=s,r=!0;}if(i.transform?.process)try{let s=i.transform.process(e);if(U(s)&&(s=await s),s===null)return;Array.isArray(s)||(s=[s]);try{for(let n of s)if(!(n instanceof Fe))throw new TypeError("The audio process function must return an AudioSample, null, or an array of AudioSamples.");for(let n of s)await this.encodeSample(n,!0);}finally{for(let n of s)n instanceof Fe&&n.close();}}finally{r&&e.close();}else await this.encodeSample(e,r);}async encodeSample(e,r){try{if(this.encoderInitialized||(this.ensureEncoderPromise||this.ensureEncoder(e),this.encoderInitialized||await this.ensureEncoderPromise),g(this.encoderInitialized),this.closed)return;{let i=Math.round(e.timestamp*e.sampleRate),s=Math.round((e.timestamp+e.duration)*e.sampleRate);if(this.lastEndSampleIndex===null)this.lastEndSampleIndex=s;else {let n=i-this.lastEndSampleIndex;if(n>=64){let o=new Fe({data:new Float32Array(n*e.numberOfChannels),format:"f32-planar",sampleRate:e.sampleRate,numberOfChannels:e.numberOfChannels,numberOfFrames:n,timestamp:this.lastEndSampleIndex/e.sampleRate});await this.encodeSample(o,!0);}this.lastEndSampleIndex+=e.numberOfFrames;}}if(this.encodingConfig.onEncodedSample?.(e),this.customEncoder){this.customEncoderQueueSize++;let i=e.clone(),s=this.customEncoderCallSerializer.call(()=>this.customEncoder.encode(i)).catch(n=>this.setError(n)).finally(()=>{this.customEncoderQueueSize--,i.close();});this.customEncoderQueueSize>=4&&await s,await this.lastMuxerPromise;}else if(this.isPcmEncoder)await this.doPcmEncoding(e,r);else {g(this.encoder);let i=e.toAudioData();this.encoder.encode(i),i.close(),r&&e.close(),this.encoder.encodeQueueSize>=4&&await new Promise(s=>this.encoder.addEventListener("dequeue",s,{once:!0})),await this.lastMuxerPromise;}}finally{r&&e.close();}}async doPcmEncoding(e,r){g(this.outputSampleSize),g(this.writeOutputValue);let{numberOfChannels:i,numberOfFrames:s,sampleRate:n,timestamp:o}=e,a=2048,c=[];for(let f=0;f<s;f+=a){let m=Math.min(a,e.numberOfFrames-f),p=m*i*this.outputSampleSize,b=new ArrayBuffer(p),y=new DataView(b);c.push({frameCount:m,view:y});}let l=e.allocationSize({planeIndex:0,format:"f32-planar"}),u=new Float32Array(l/Float32Array.BYTES_PER_ELEMENT);for(let f=0;f<i;f++){e.copyTo(u,{planeIndex:f,format:"f32-planar"});for(let m=0;m<c.length;m++){let{frameCount:p,view:b}=c[m];for(let y=0;y<p;y++)this.writeOutputValue(b,(y*i+f)*this.outputSampleSize,u[m*a+y]);}}r&&e.close();let d={decoderConfig:{codec:this.encodingConfig.codec,numberOfChannels:i,sampleRate:n}};for(let f=0;f<c.length;f++){let{frameCount:m,view:p}=c[f],b=p.buffer,y=f*a,w=new de(new Uint8Array(b),"key",o+y/n,m/n);this.encodingConfig.onEncodedPacket?.(w,d),await this.muxer.addEncodedAudioPacket(this.source._connectedTrack,w,d);}}ensureEncoder(e){this.ensureEncoderPromise=(async()=>{let{numberOfChannels:r,sampleRate:i}=e,s=Kt(this.encodingConfig.quality,this.encodingConfig.bitrate),n=Bs({numberOfChannels:r,sampleRate:i,...this.encodingConfig,quality:s});this.encodingConfig.onEncoderConfig?.(n);let o=En.find(a=>a.supports(this.encodingConfig.codec,n));if(o)this.customEncoder=new o,this.customEncoder.codec=this.encodingConfig.codec,this.customEncoder.config=n,this.customEncoder.onPacket=(a,c)=>{if(!(a instanceof de))throw new TypeError("The first argument passed to onPacket must be an EncodedPacket.");if(c!==void 0&&(!c||typeof c!="object"))throw new TypeError("The second argument passed to onPacket must be an object or undefined.");this.encodingConfig.onEncodedPacket?.(a,c),this.lastMuxerPromise=this.muxer.addEncodedAudioPacket(this.source._connectedTrack,a,c).catch(l=>{this.setError(l);});},this.customEncoder.onError=a=>{this.setError(a);},await this.customEncoder.init();else if(Ae.includes(this.encodingConfig.codec))this.initPcmEncoder();else {if(typeof AudioEncoder>"u")throw new Error(yr("AudioEncoder"));let a;try{a=(await AudioEncoder.isConfigSupported(n)).supported??!1;}catch{a=!1;}if(!a)throw new Error(`This specific encoder configuration (${n.codec}, ${n.bitrate} bps, ${n.numberOfChannels} channels, ${n.sampleRate} Hz) is not supported in this environment. Consider using another codec or changing your audio parameters.`);let c=new Error("Encoding error").stack;this.encoder=new AudioEncoder({output:(l,u)=>{if(this.encodingConfig.codec==="aac"&&u?.decoderConfig){let f=!1;if(!u.decoderConfig.description||u.decoderConfig.description.byteLength<2?f=!0:f=Ar(Te(u.decoderConfig.description)).objectType===0,f){let m=Number(fe(n.codec.split(".")));u.decoderConfig.description=Hi({objectType:m,outputNumberOfChannels:u.decoderConfig.numberOfChannels,outputSampleRate:u.decoderConfig.sampleRate});}}let d=de.fromEncodedChunk(l);d=d.clone({timestamp:$r(d.timestamp,n.sampleRate),duration:l.duration!=null?$r(d.duration,n.sampleRate):void 0}),this.encodingConfig.onEncodedPacket?.(d,u),this.lastMuxerPromise=this.muxer.addEncodedAudioPacket(this.source._connectedTrack,d,u).catch(f=>{this.setError(f);});},error:l=>{l.stack=c,this.setError(l);}}),this.encoder.configure(n);}g(this.source._connectedTrack),this.muxer=this.source._connectedTrack.output._muxer,this.encoderInitialized=!0;})();}initPcmEncoder(){this.isPcmEncoder=!0;let e=this.encodingConfig.codec,{dataType:r,sampleSize:i,littleEndian:s}=Ve(e);switch(this.outputSampleSize=i,i){case 1:r==="unsigned"?this.writeOutputValue=(n,o,a)=>n.setUint8(o,ue((a+1)*127.5,0,255)):r==="signed"?this.writeOutputValue=(n,o,a)=>{n.setInt8(o,ue(Math.round(a*128),-128,127));}:r==="ulaw"?this.writeOutputValue=(n,o,a)=>{let c=ue(Math.floor(a*32767),-32768,32767);n.setUint8(o,ja(c));}:r==="alaw"?this.writeOutputValue=(n,o,a)=>{let c=ue(Math.floor(a*32767),-32768,32767);n.setUint8(o,Ka(c));}:g(!1);break;case 2:r==="unsigned"?this.writeOutputValue=(n,o,a)=>n.setUint16(o,ue((a+1)*32767.5,0,65535),s):r==="signed"?this.writeOutputValue=(n,o,a)=>n.setInt16(o,ue(Math.round(a*32767),-32768,32767),s):g(!1);break;case 3:r==="unsigned"?this.writeOutputValue=(n,o,a)=>Kr(n,o,ue((a+1)*83886075e-1,0,16777215),s):r==="signed"?this.writeOutputValue=(n,o,a)=>wo(n,o,ue(Math.round(a*8388607),-8388608,8388607),s):g(!1);break;case 4:r==="unsigned"?this.writeOutputValue=(n,o,a)=>n.setUint32(o,ue((a+1)*21474836475e-1,0,4294967295),s):r==="signed"?this.writeOutputValue=(n,o,a)=>n.setInt32(o,ue(Math.round(a*2147483647),-2147483648,2147483647),s):r==="float"?this.writeOutputValue=(n,o,a)=>n.setFloat32(o,a,s):g(!1);break;case 8:r==="float"?this.writeOutputValue=(n,o,a)=>n.setFloat64(o,a,s):g(!1);break;default:xe(i),g(!1);}}async flushAndClose(e){try{e||(this.checkForEncoderError(),this.resampler&&await this.resampler.finalize()),this.closed=!0,e||(this.customEncoder?this.customEncoderCallSerializer.call(()=>this.customEncoder.flush()):this.encoder&&await this.encoder.flush());}finally{this.closed=!0,this.resampler=null,this.customEncoder?await this.customEncoderCallSerializer.call(()=>this.customEncoder.close()).catch(r=>this.setError(r)):this.encoder&&this.encoder.state!=="closed"&&this.encoder.close();}e||this.checkForEncoderError();}getQueueSize(){return this.customEncoder?this.customEncoderQueueSize:this.isPcmEncoder?0:this.encoder?.encodeQueueSize??0}checkForEncoderError(){if(this.errorSet)throw this.error}},Wn=class extends qr{constructor(e){qa(e),super(e.codec),this._encoder=new so(this,e);}add(e){if(!(e instanceof Fe))throw new TypeError("audioSample must be an AudioSample.");return this._encoder.add(e,!1)}_flushAndClose(e){return this._encoder.flushAndClose(e)}};var qn=class extends vi{constructor(e){if(super(),this._connectedTrack=null,!Lt.includes(e))throw new TypeError(`Invalid subtitle codec '${e}'. Must be one of: ${Lt.join(", ")}.`);this._codec=e;}};var Lr=class{getSupportedVideoCodecs(){return this.getSupportedCodecs().filter(e=>De.includes(e))}getSupportedAudioCodecs(){return this.getSupportedCodecs().filter(e=>ze.includes(e))}getSupportedSubtitleCodecs(){return this.getSupportedCodecs().filter(e=>Lt.includes(e))}_codecUnsupportedHint(e){return ""}_isFragmentedIsobmff(){return !1}},Hr=class extends Lr{constructor(e={}){if(!e||typeof e!="object")throw new TypeError("options must be an object.");if(e.fastStart!==void 0&&![!1,"in-memory","reserve","fragmented"].includes(e.fastStart))throw new TypeError("options.fastStart, when provided, must be false, 'in-memory', 'reserve', or 'fragmented'.");if(e.minimumFragmentDuration!==void 0&&(!Nt(e.minimumFragmentDuration)||e.minimumFragmentDuration<0))throw new TypeError("options.minimumFragmentDuration, when provided, must be a non-negative number.");if(e.onFtyp!==void 0&&typeof e.onFtyp!="function")throw new TypeError("options.onFtyp, when provided, must be a function.");if(e.onMoov!==void 0&&typeof e.onMoov!="function")throw new TypeError("options.onMoov, when provided, must be a function.");if(e.onMdat!==void 0&&typeof e.onMdat!="function")throw new TypeError("options.onMdat, when provided, must be a function.");if(e.onMoof!==void 0&&typeof e.onMoof!="function")throw new TypeError("options.onMoof, when provided, must be a function.");if(e.metadataFormat!==void 0&&!["mdir","mdta","udta","auto"].includes(e.metadataFormat))throw new TypeError("options.metadataFormat, when provided, must be either 'auto', 'mdir', 'mdta', or 'udta'.");super(),this._options=e;}getSupportedTrackCounts(){return {video:{min:0,max:4294967295},audio:{min:0,max:4294967295},subtitle:{min:0,max:4294967295},total:{min:0,max:4294967295}}}get supportsVideoRotationMetadata(){return !0}get supportsTimestampedMediaData(){return !0}_createMuxer(e){return new zn(e,this)}_isFragmentedIsobmff(){return this._options.fastStart==="fragmented"}},Xt=class extends Hr{constructor(e){super(e);}get _name(){return "MP4"}get fileExtension(){return ".mp4"}get mimeType(){return "video/mp4"}getSupportedCodecs(){return [...De,...qt,"pcm-s16","pcm-s16be","pcm-s24","pcm-s24be","pcm-s32","pcm-s32be","pcm-f32","pcm-f32be","pcm-f64","pcm-f64be",...Lt]}_codecUnsupportedHint(e){return new Nr().getSupportedCodecs().includes(e)?" Switching to MOV will grant support for this codec.":""}},Ur=class extends Hr{constructor(e){super(e);}get _name(){return "CMAF"}get fileExtension(){return ".m4s"}get mimeType(){return "video/mp4"}getSupportedCodecs(){return [...De,...qt,"pcm-s16","pcm-s16be","pcm-s24","pcm-s24be","pcm-s32","pcm-s32be","pcm-f32","pcm-f32be","pcm-f64","pcm-f64be",...Lt]}},Nr=class extends Hr{constructor(e){super(e);}get _name(){return "MOV"}get fileExtension(){return ".mov"}get mimeType(){return "video/quicktime"}getSupportedCodecs(){return [...De,...ze]}_codecUnsupportedHint(e){return new Xt().getSupportedCodecs().includes(e)?" Switching to MP4 will grant support for this codec.":""}};var gc=["video","audio","subtitle"],jr=class t{constructor(e,r,i,s,n){this.id=e,this.output=r,this.type=i,this.source=s,this.metadata=n;}isVideoTrack(){return this.type==="video"}isAudioTrack(){return this.type==="audio"}isSubtitleTrack(){return this.type==="subtitle"}canBePairedWith(e){if(!(e instanceof t))throw new TypeError("other must be an OutputTrack.");if(this===e)return !1;let r=Wi(this.metadata.group),i=Wi(e.metadata.group);for(let s of r)if(this.type!==e.type&&i.some(a=>s===a)||i.some(a=>s._pairedGroups.has(a)))return !0;return !1}},Ln=class extends jr{constructor(e,r,i,s){super(e,r,"video",i,s);}},Hn=class extends jr{constructor(e,r,i,s){super(e,r,"audio",i,s);}},jn=class extends jr{constructor(e,r,i,s){super(e,r,"subtitle",i,s);}},Le=class t{constructor(){this._pairedGroups=new Set;}pairWith(e){if(!(e instanceof t))throw new TypeError("other must be an OutputTrackGroup.");if(this===e)throw new TypeError("Cannot pair a group with itself.");this._pairedGroups.add(e),e._pairedGroups.add(this);}},oo=t=>{if(!t||typeof t!="object")throw new TypeError("metadata must be an object.");if(t.languageCode!==void 0&&!St(t.languageCode))throw new TypeError("metadata.languageCode, when provided, must be a three-letter, ISO 639-2/T language code.");if(t.name!==void 0&&typeof t.name!="string")throw new TypeError("metadata.name, when provided, must be a string.");if(t.disposition!==void 0&&So(t.disposition),t.maximumPacketCount!==void 0&&(!Number.isInteger(t.maximumPacketCount)||t.maximumPacketCount<0))throw new TypeError("metadata.maximumPacketCount, when provided, must be a non-negative integer.");if(t.group!==void 0&&!(t.group instanceof Le)&&(!Array.isArray(t.group)||t.group.some(e=>!(e instanceof Le))))throw new TypeError("metadata.group, when provided, must be an OutputTrackGroup instance or an array of OutputTrackGroup instances.")},Zt=class extends He{get target(){let e="Output.target cannot be used when using PathedTarget with an async callback. Use the 'target' event instead.";if(this._rootTargetPromise)throw new TypeError(e);let r=this._getRootTarget();if(U(r))throw new TypeError(e);return r}constructor(e){if(super(),this.state="pending",this.defaultTrackGroup=new Le,this.tracks=[],this._onFinalize=null,this._unfinalizedTargets=new Set,this._rootWriterPromise=null,this._startPromise=null,this._cancelPromise=null,this._finalizePromise=null,this._mutex=new pr,this._metadataTags={},this._rootTarget=null,this._rootTargetPromise=null,this._firstMediaStreamTimestamp=null,!e||typeof e!="object")throw new TypeError("options must be an object.");if(!(e.format instanceof Lr))throw new TypeError("options.format must be an OutputFormat.");if(!(e.target instanceof We||e.target instanceof fr))throw new TypeError("options.target must be a Target or a PathedTarget.");if(e.target instanceof We&&this._rememberTarget(e.target),e.initTarget!==void 0&&!(e.initTarget instanceof We)&&typeof e.initTarget!="function")throw new Error("options.initTarget, when provided, must be a Target or a function that returns or resolves to a Target.");if(e.onFinalize!==void 0&&typeof e.onFinalize!="function")throw new TypeError("options.onFinalize, when provided, must be a function.");this.format=e.format,this._target=e.target,this._onFinalize=e.onFinalize??null,this._initTarget=e.initTarget??null,this._initTarget instanceof We&&this._rememberTarget(this._initTarget),this._muxer=e.format._createMuxer(this);}_getTargetValidated(e){g(this._target instanceof fr);let r=this._target.getTarget(e),i=s=>{if(!(s instanceof We))throw new TypeError("getTarget must return a Target.");return s};return U(r)?r.then(i):i(r)}async _getTarget(e){g(this._target instanceof fr);let r=await this._getTargetValidated(e);return this._emit("target",{target:r,request:e,isRoot:e.isRoot}),this.state==="canceled"?await r._close():this._rememberTarget(r),r}_rememberTarget(e){this._unfinalizedTargets.add(e),e.on("finalized",()=>this._unfinalizedTargets.delete(e),{once:!0});}async _getInitTarget(){if(g(this._initTarget!==null),this._initTarget instanceof We)return this._initTarget;let e=await this._initTarget();return this.state==="canceled"?await e._close():this._rememberTarget(e),e}_hasInitTarget(){return this._initTarget!==null}_getRootTarget(){if(this._rootTarget)return this._rootTarget;if(this._rootTargetPromise)return this._rootTargetPromise;if(this._target instanceof We)return this._emit("target",{target:this._target,request:null,isRoot:!0}),this._rootTarget=this._target,this._target;let e={path:this._target.rootPath,isRoot:!0,mimeType:this.format.mimeType},r=this._getTargetValidated(e),i=s=>(this.state==="canceled"?s._close():this._rememberTarget(s),this._emit("target",{target:s,request:e,isRoot:!0}),this._rootTarget=s,s);return U(r)?this._rootTargetPromise=r.then(i):i(r)}_getRootWriter(e){return this._rootWriterPromise??(this._rootWriterPromise=(async()=>{let r=await this._getRootTarget(),i=new dr(r,typeof e=="boolean"?e:e(r));return i.start(),i})())}addVideoTrack(e,r={}){if(!(e instanceof Wr))throw new TypeError("source must be a VideoSource.");if(oo(r),r.rotation!==void 0&&![0,90,180,270].includes(r.rotation))throw new TypeError(`Invalid video rotation: ${r.rotation}. Has to be 0, 90, 180 or 270.`);if(!this.format.supportsVideoRotationMetadata&&r.rotation)throw new Error(`${this.format._name} does not support video rotation metadata.`);if(r.frameRate!==void 0&&(!Number.isFinite(r.frameRate)||r.frameRate<=0))throw new TypeError(`Invalid video frame rate: ${r.frameRate}. Must be a positive number.`);if(r.decoderConfig!==void 0&&on({decoderConfig:r.decoderConfig},e._codec),r.primingPacket!==void 0){if(!(r.primingPacket instanceof de))throw new TypeError("metadata.primingPacket, when provided, must be an EncodedPacket.");if(r.decoderConfig===void 0)throw new TypeError("metadata.primingPacket can only be provided alongside metadata.decoderConfig.")}let i={...r};return i.group??(i.group=this.defaultTrackGroup),this._addTrack(new Ln(this.tracks.length+1,this,e,i))}addAudioTrack(e,r={}){if(!(e instanceof qr))throw new TypeError("source must be an AudioSource.");if(oo(r),r.decoderConfig!==void 0&&an({decoderConfig:r.decoderConfig},e._codec),r.primingPacket!==void 0){if(!(r.primingPacket instanceof de))throw new TypeError("metadata.primingPacket, when provided, must be an EncodedPacket.");if(r.decoderConfig===void 0)throw new TypeError("metadata.primingPacket can only be provided alongside metadata.decoderConfig.")}let i={...r};return i.group??(i.group=this.defaultTrackGroup),this._addTrack(new Hn(this.tracks.length+1,this,e,i))}addSubtitleTrack(e,r={}){if(!(e instanceof qn))throw new TypeError("source must be a SubtitleSource.");oo(r);let i={...r};return i.group??(i.group=this.defaultTrackGroup),this._addTrack(new jn(this.tracks.length+1,this,e,i))}setMetadataTags(e){if(Jr(e),this.state!=="pending")throw new Error("Cannot set metadata tags after output has been started or canceled.");this._metadataTags=e;}_addTrack(e){if(this.state!=="pending")throw new Error("Cannot add track after output has been started or canceled.");if(e.source._connectedTrack)throw new Error("Source is already used for a track.");let r=this.format.getSupportedTrackCounts(),i=this.tracks.reduce((o,a)=>o+(a.type===e.type?1:0),0),s=r[e.type].max;if(i===s)throw new Error(s===0?`${this.format._name} does not support ${e.type} tracks.`:`${this.format._name} does not support more than ${s} ${e.type} track${s===1?"":"s"}.`);let n=r.total.max;if(this.tracks.length===n)throw new Error(`${this.format._name} does not support more than ${n} tracks${n===1?"":"s"} in total.`);if(e.isVideoTrack()){let o=this.format.getSupportedVideoCodecs();if(o.length===0)throw new Error(`${this.format._name} does not support video tracks.`+this.format._codecUnsupportedHint(e.source._codec));if(!o.includes(e.source._codec))throw new Error(`Codec '${e.source._codec}' cannot be contained within ${this.format._name}. Supported video codecs are: ${o.map(a=>`'${a}'`).join(", ")}.`+this.format._codecUnsupportedHint(e.source._codec))}else if(e.isAudioTrack()){let o=this.format.getSupportedAudioCodecs();if(o.length===0)throw new Error(`${this.format._name} does not support audio tracks.`+this.format._codecUnsupportedHint(e.source._codec));if(!o.includes(e.source._codec))throw new Error(`Codec '${e.source._codec}' cannot be contained within ${this.format._name}. Supported audio codecs are: ${o.map(a=>`'${a}'`).join(", ")}.`+this.format._codecUnsupportedHint(e.source._codec))}else if(e.isSubtitleTrack()){let o=this.format.getSupportedSubtitleCodecs();if(o.length===0)throw new Error(`${this.format._name} does not support subtitle tracks.`+this.format._codecUnsupportedHint(e.source._codec));if(!o.includes(e.source._codec))throw new Error(`Codec '${e.source._codec}' cannot be contained within ${this.format._name}. Supported subtitle codecs are: ${o.map(a=>`'${a}'`).join(", ")}.`+this.format._codecUnsupportedHint(e.source._codec))}return this.tracks.push(e),e.source._connectedTrack=e,e}hasEnoughTracks(){let e=this.format.getSupportedTrackCounts();for(let i of gc){let s=this.tracks.reduce((o,a)=>o+(a.type===i?1:0),0),n=e[i].min;if(s<n)return !1}let r=e.total.min;return !(this.tracks.length<r)}async start(){let e=this.format.getSupportedTrackCounts();for(let i of gc){let s=this.tracks.reduce((o,a)=>o+(a.type===i?1:0),0),n=e[i].min;if(s<n)throw new Error(n===e[i].max?`${this.format._name} requires exactly ${n} ${i} track${n===1?"":"s"}.`:`${this.format._name} requires at least ${n} ${i} track${n===1?"":"s"}.`)}let r=e.total.min;if(this.tracks.length<r)throw new Error(r===e.total.max?`${this.format._name} requires exactly ${r} track${r===1?"":"s"}.`:`${this.format._name} requires at least ${r} track${r===1?"":"s"}.`);if(this.state==="canceled")throw new Error("Output has been canceled.");return this._startPromise?(K._warn("Output has already been started."),this._startPromise):this._startPromise=(async()=>{this.state="started";let i=this._mutex.acquire();try{await this._muxer.start();let s=this.tracks.map(n=>n.source._start());await Promise.all(s);}finally{(await i)();}})()}getMimeType(){return this._muxer.getMimeType()}async cancel(){if(this._cancelPromise)return K._warn("Output has already been canceled."),this._cancelPromise;if(this.state==="finalizing"||this.state==="finalized"){this.state==="finalized"&&K._warn("Output has already been finalized.");return}return this._cancelPromise=(async()=>{this.state="canceled";let e=await this._mutex.acquire();try{let r=this.tracks.map(i=>i.source._flushOrWaitForOngoingClose(!0));await Promise.all(r),await Promise.all([...this._unfinalizedTargets].map(i=>i._close())),this._unfinalizedTargets.clear();}finally{e();}})()}async finalize(){if(this.state==="pending")throw new Error("Cannot finalize before starting.");if(this.state==="canceled")throw new Error("Cannot finalize after canceling.");return this._finalizePromise?(K._warn("Output has already been finalized."),this._finalizePromise):this._finalizePromise=(async()=>{this.state="finalizing";let e=await this._mutex.acquire();try{let r=this.tracks.map(i=>i.source._flushOrWaitForOngoingClose(!1));if(await Promise.all(r),await this._muxer.finalize(),this._rootWriterPromise){let i=await this._rootWriterPromise;i.finalized||(await i.flush(),await i.finalize());}this._onFinalize&&await this._onFinalize(),this.state="finalized";}finally{await Promise.all([...this._unfinalizedTargets].map(r=>r._close().catch(()=>{}))),this._unfinalizedTargets.clear(),e();}})()}};var Pi=function(t,e,r){if(e!=null){if(typeof e!="object"&&typeof e!="function")throw new TypeError("Object expected.");var i,s;if(r){if(!Symbol.asyncDispose)throw new TypeError("Symbol.asyncDispose is not defined.");i=e[Symbol.asyncDispose];}if(i===void 0){if(!Symbol.dispose)throw new TypeError("Symbol.dispose is not defined.");i=e[Symbol.dispose],r&&(s=i);}if(typeof i!="function")throw new TypeError("Object not disposable.");s&&(i=function(){try{s.call(this);}catch(n){return Promise.reject(n)}}),t.stack.push({value:e,dispose:i,async:r});}else r&&t.stack.push({async:!0});return e},Qn=(function(t){return function(e){function r(o){e.error=e.hasError?new t(o,e.error,"An error was suppressed during disposal."):o,e.hasError=!0;}var i,s=0;function n(){for(;i=e.stack.pop();)try{if(!i.async&&s===1)return s=0,e.stack.push(i),Promise.resolve().then(n);if(i.dispose){var o=i.dispose.call(i.value);if(i.async)return s|=2,Promise.resolve(o).then(n,function(a){return r(a),n()})}else s|=1;}catch(a){r(a);}if(s===1)return e.hasError?Promise.reject(e.error):Promise.resolve();if(e.hasError)throw e.error}return n()}})(typeof SuppressedError=="function"?SuppressedError:function(t,e,r){var i=new Error(r);return i.name="SuppressedError",i.error=t,i.suppressed=e,i}),Kn=t=>{if(!t||typeof t!="object")throw new TypeError("options.video, when provided, must be an object.");if(t?.discard!==void 0&&typeof t.discard!="boolean")throw new TypeError("options.video.discard, when provided, must be a boolean.");if(t?.forceTranscode!==void 0&&typeof t.forceTranscode!="boolean")throw new TypeError("options.video.forceTranscode, when provided, must be a boolean.");if(t?.codec!==void 0&&!De.includes(t.codec))throw new TypeError(`options.video.codec, when provided, must be one of: ${De.join(", ")}.`);let e=t?.bitrate;if(t?.quality!==void 0&&!(t.quality instanceof Se))throw new TypeError("options.video.quality, when provided, must be a Quality.");if(t?.quality!==void 0&&e!==void 0)throw new TypeError("options.video.quality and options.video.bitrate cannot both be provided.");if(e!==void 0&&!(e instanceof Se)&&(!Number.isInteger(e)||e<=0))throw new TypeError("options.video.bitrate, when provided, must be a positive integer or a quality.");if(t?.width!==void 0&&(!Number.isInteger(t.width)||t.width<=0))throw new TypeError("options.video.width, when provided, must be a positive integer.");if(t?.height!==void 0&&(!Number.isInteger(t.height)||t.height<=0))throw new TypeError("options.video.height, when provided, must be a positive integer.");if(t?.fit!==void 0&&!["fill","contain","cover"].includes(t.fit))throw new TypeError("options.video.fit, when provided, must be one of 'fill', 'contain', or 'cover'.");if(t?.width!==void 0&&t.height!==void 0&&t.fit===void 0)throw new TypeError("When both options.video.width and options.video.height are provided, options.video.fit must also be provided.");if(t?.rotate!==void 0&&![0,90,180,270].includes(t.rotate))throw new TypeError("options.video.rotate, when provided, must be 0, 90, 180 or 270.");if(t?.allowRotationMetadata!==void 0&&typeof t.allowRotationMetadata!="boolean")throw new TypeError("options.video.allowRotationMetadata, when provided, must be a boolean.");if(t?.crop!==void 0&&nr(t.crop,"options.video."),t?.frameRate!==void 0&&(!Number.isFinite(t.frameRate)||t.frameRate<=0))throw new TypeError("options.video.frameRate, when provided, must be a finite positive number.");if(t?.alpha!==void 0&&!["discard","keep"].includes(t.alpha))throw new TypeError("options.video.alpha, when provided, must be either 'discard' or 'keep'.");if(t?.keyFrameInterval!==void 0&&(!Number.isFinite(t.keyFrameInterval)||t.keyFrameInterval<0))throw new TypeError("options.video.keyFrameInterval, when provided, must be a non-negative number.");if(t?.process!==void 0&&typeof t.process!="function")throw new TypeError("options.video.process, when provided, must be a function.");if(t?.processedWidth!==void 0&&(!Number.isInteger(t.processedWidth)||t.processedWidth<=0))throw new TypeError("options.video.processedWidth, when provided, must be a positive integer.");if(t?.processedHeight!==void 0&&(!Number.isInteger(t.processedHeight)||t.processedHeight<=0))throw new TypeError("options.video.processedHeight, when provided, must be a positive integer.");if(t?.hardwareAcceleration!==void 0&&!["no-preference","prefer-hardware","prefer-software"].includes(t.hardwareAcceleration))throw new TypeError("options.video.hardwareAcceleration, when provided, must be 'no-preference', 'prefer-hardware' or 'prefer-software'.");if(t?.group!==void 0&&!(t.group instanceof Le||Array.isArray(t.group)&&t.group.every(r=>r instanceof Le)))throw new TypeError("options.video.group, when provided, must be an OutputTrackGroup or an array of OutputTrackGroups.")},Gn=t=>{if(!t||typeof t!="object")throw new TypeError("options.audio, when provided, must be an object.");if(t?.discard!==void 0&&typeof t.discard!="boolean")throw new TypeError("options.audio.discard, when provided, must be a boolean.");if(t?.forceTranscode!==void 0&&typeof t.forceTranscode!="boolean")throw new TypeError("options.audio.forceTranscode, when provided, must be a boolean.");if(t?.codec!==void 0&&!ze.includes(t.codec))throw new TypeError(`options.audio.codec, when provided, must be one of: ${ze.join(", ")}.`);let e=t?.bitrate;if(t?.quality!==void 0&&!(t.quality instanceof Se))throw new TypeError("options.audio.quality, when provided, must be a Quality.");if(t?.quality!==void 0&&e!==void 0)throw new TypeError("options.audio.quality and options.audio.bitrate cannot both be provided.");if(e!==void 0&&!(e instanceof Se)&&(!Number.isInteger(e)||e<=0))throw new TypeError("options.audio.bitrate, when provided, must be a positive integer or a quality.");if(t?.numberOfChannels!==void 0&&(!Number.isInteger(t.numberOfChannels)||t.numberOfChannels<=0))throw new TypeError("options.audio.numberOfChannels, when provided, must be a positive integer.");if(t?.sampleRate!==void 0&&(!Number.isInteger(t.sampleRate)||t.sampleRate<=0))throw new TypeError("options.audio.sampleRate, when provided, must be a positive integer.");if(t?.sampleFormat!==void 0&&!["u8","s16","s32","f32"].includes(t.sampleFormat))throw new TypeError("options.audio.sampleFormat, when provided, must be one of: u8, s16, s32, f32.");if(t?.process!==void 0&&typeof t.process!="function")throw new TypeError("options.audio.process, when provided, must be a function.");if(t?.processedNumberOfChannels!==void 0&&(!Number.isInteger(t.processedNumberOfChannels)||t.processedNumberOfChannels<=0))throw new TypeError("options.audio.processedNumberOfChannels, when provided, must be a positive integer.");if(t?.processedSampleRate!==void 0&&(!Number.isInteger(t.processedSampleRate)||t.processedSampleRate<=0))throw new TypeError("options.audio.processedSampleRate, when provided, must be a positive integer.");if(t?.group!==void 0&&!(t.group instanceof Le||Array.isArray(t.group)&&t.group.every(r=>r instanceof Le)))throw new TypeError("options.audio.group, when provided, must be an OutputTrackGroup or an array of OutputTrackGroups.")},ao=2,co=48e3,Ri=class t{static async init(e){let r=new t(e);return await r._init(),r}constructor(e){if(this.state="idle",this._nextOutputTrackId=0,this._outputTrackIds=[],this._outputOwnTrackGroups=[],this._trackPumps=[],this._composable=!1,this._executed=!1,this._executionUntil=1/0,this._pauseRequested=!1,this._synchronizer=new lo(this),this._totalDuration=null,this._maxTimestamps=new Map,this.onProgress=void 0,this._computeProgress=!1,this._lastProgress=0,this.isValid=!1,this.utilizedTracks=[],this.discardedTracks=[],!e||typeof e!="object")throw new TypeError("options must be an object.");if(!(e.input instanceof lr))throw new TypeError("options.input must be an Input.");if(!(e.output instanceof Zt))throw new TypeError("options.output must be an Output.");if(e.tracks!==void 0&&e.tracks!=="all"&&e.tracks!=="primary")throw new TypeError("options.tracks, when provided, must be either 'all' or 'primary'.");if(e.composable!==void 0&&typeof e.composable!="boolean")throw new TypeError("options.composable, when provided, must be a boolean.");let r=e.composable??!1;if(r){if(e.tags!==void 0)throw new TypeError("options.tags cannot be set by a composable conversion; set metadata directly on the output instead.");if(e.output.state!=="pending")throw new TypeError("options.output must not have been started yet.")}else if(e.output.tracks.length>0||Object.keys(e.output._metadataTags).length>0||e.output.state!=="pending")throw new TypeError("options.output must be fresh: no tracks or metadata tags added and not started.");if(e.video!==void 0&&typeof e.video!="function")if(Array.isArray(e.video))for(let i of e.video)Kn(i);else Kn(e.video);if(e.audio!==void 0&&typeof e.audio!="function")if(Array.isArray(e.audio))for(let i of e.audio)Gn(i);else Gn(e.audio);if(e.trim!==void 0&&(!e.trim||typeof e.trim!="object"))throw new TypeError("options.trim, when provided, must be an object.");if(e.trim?.start!==void 0&&!Number.isFinite(e.trim.start))throw new TypeError("options.trim.start, when provided, must be a finite number.");if(e.trim?.end!==void 0&&!Number.isFinite(e.trim.end))throw new TypeError("options.trim.end, when provided, must be a finite number.");if(e.trim?.start!==void 0&&e.trim.end!==void 0&&e.trim.start>=e.trim.end)throw new TypeError("options.trim.start must be less than options.trim.end.");if(e.tags!==void 0&&(typeof e.tags!="object"||!e.tags)&&typeof e.tags!="function")throw new TypeError("options.tags, when provided, must be an object or a function.");if(typeof e.tags=="object"&&Jr(e.tags),e.showWarnings!==void 0&&typeof e.showWarnings!="boolean")throw new TypeError("options.showWarnings, when provided, must be a boolean.");this._options=e,this._composable=r,this.input=e.input,this.output=e.output;}async _init(){let e=await this.input.getFormat(),r,i=this._options.tracks;if(i===void 0&&(i=e.name.includes("(HLS)")?"primary":"all"),i==="all")r=await this.input.getTracks();else if(i==="primary"){let l=await this.input.getPrimaryVideoTrack(),u=await this.input.getPrimaryAudioTrack();r=[l,u].filter(d=>d!==null);}else xe(i),g(!1);let s=this.output.format.getSupportedTrackCounts(),n=1,o=1,a=[],c=[];for(let l of r){let u;if(l.isVideoTrack())if(this._options.video)if(typeof this._options.video=="function"){let m=await this._options.video(l,n)??{};if(Array.isArray(m))for(let p of m)Kn(p);else Kn(m);u=Array.isArray(m)?m:[m],n++;}else u=Array.isArray(this._options.video)?this._options.video:[this._options.video];else u=[{}];else if(l.isAudioTrack())if(this._options.audio)if(typeof this._options.audio=="function"){let m=await this._options.audio(l,o)??{};if(Array.isArray(m))for(let p of m)Gn(p);else Gn(m);u=Array.isArray(m)?m:[m],o++;}else u=Array.isArray(this._options.audio)?this._options.audio:[this._options.audio];else u=[{}];else g(!1);let d=u.filter(m=>m.discard);for(let m of d)this.discardedTracks.push({track:l,reason:"discarded_by_user",trackOptions:m});if(u.length===d.length){u.length===0&&this.discardedTracks.push({track:l,reason:"discarded_by_user",trackOptions:{}});continue}let f=u.filter(m=>!m.discard);a.push(l),c.push(f);}this._options.trim?.start!==void 0?this._startTimestamp=this._options.trim.start:this._startTimestamp=Math.max(await this.input.getFirstTimestamp(a),0),this._endTimestamp=Math.max(this._options.trim?.end??1/0,this._startTimestamp);for(let l=0;l<a.length;l++){let u=a[l],d=c[l];for(let f of d){if(this.output.tracks.length===s.total.max){this.discardedTracks.push({track:u,reason:"max_track_count_reached",trackOptions:f});continue}if(this.output.tracks.reduce((b,y)=>b+(y.type===u.type?1:0),0)===s[u.type].max){this.discardedTracks.push({track:u,reason:"max_track_count_of_type_reached",trackOptions:f});continue}let p=this._nextOutputTrackId++;u.isVideoTrack()?await this._processVideoTrack(u,f,p):u.isAudioTrack()?await this._processAudioTrack(u,f,p):g(!1);}}for(let l=0;l<this.utilizedTracks.length-1;l++)for(let u=l+1;u<this.utilizedTracks.length;u++){let d=this.utilizedTracks[l],f=this.utilizedTracks[u],m=this._outputOwnTrackGroups[l],p=this._outputOwnTrackGroups[u];g(m!==void 0),g(p!==void 0),m&&p&&d.canBePairedWith(f)&&m.pairWith(p);}if(!this._composable){let l=await this.input.getMetadataTags(),u;if(this._options.tags){let m=typeof this._options.tags=="function"?await this._options.tags(l):this._options.tags;Jr(m),u=m;}else u=l;let d=e.mimeType===this.output.format.mimeType,f=l.raw===u.raw;l.raw&&f&&!d&&delete u.raw,this.output.setMetadataTags(u);}if(this._composable?this.isValid=!0:this.isValid=this.output.hasEnoughTracks()&&this.output.tracks.length>0,this._options.showWarnings??!0){let l=[],u=this.discardedTracks.filter(d=>d.reason!=="discarded_by_user");u.length>0&&l.push("Some tracks had to be discarded from the conversion:",u),this.isValid||(l.length>0&&l.push(`

`),l.push(this._getInvalidityExplanation().join(""))),l.length>0&&K._warn(...l);}}_getInvalidityExplanation(){let e=[];if(this.discardedTracks.length===0)e.push("Due to missing tracks, this conversion cannot be executed.");else {let r=this.discardedTracks.every(i=>i.reason==="discarded_by_user"||i.reason==="no_encodable_target_codec")&&this.discardedTracks.some(i=>i.reason==="no_encodable_target_codec");if(e.push("Due to discarded tracks, this conversion cannot be executed."),r){let i=this.discardedTracks.flatMap(n=>{if(n.reason==="discarded_by_user")return [];let o;return n.track.type==="video"?o=this.output.format.getSupportedVideoCodecs():n.track.type==="audio"?o=this.output.format.getSupportedAudioCodecs():o=this.output.format.getSupportedSubtitleCodecs(),o.filter(a=>!n.trackOptions.codec||a===n.trackOptions.codec)}),s=[...new Set(i)];s.length===1?e.push(`
Tracks were discarded because your environment is not able to encode '${s[0]}' with the provided parameters.`):e.push(`
Tracks were discarded because your environment is not able to encode any of the codecs ${s.map(n=>`'${n}'`).join(", ")} with the provided parameters.`),s.includes("mp3")&&e.push(`
The @mediabunny/mp3-encoder extension package provides support for encoding MP3.`),s.includes("aac")&&e.push(`
The @mediabunny/aac-encoder extension package provides support for encoding AAC.`),(s.includes("ac3")||s.includes("eac3"))&&e.push(`
The @mediabunny/ac3 extension package provides support for encoding and decoding AC-3/E-AC-3.`),s.includes("flac")&&e.push(`
The @mediabunny/flac-encoder extension package provides support for encoding FLAC.`);}else e.push(`
Check the discardedTracks field for more info.`);}return e}async execute(e={}){if(!e||typeof e!="object")throw new TypeError("options must be an object.");if(e.until!==void 0&&(typeof e.until!="number"||Number.isNaN(e.until)))throw new TypeError("options.until, when provided, must be a number.");if(e.pauseSignal!==void 0&&!(e.pauseSignal instanceof AbortSignal))throw new TypeError("options.pauseSignal, when provided, must be an AbortSignal.");if(!this.isValid)throw new Error(`Cannot execute this conversion because its output configuration is invalid. Make sure to always check the isValid field before executing a conversion.
`+this._getInvalidityExplanation().join(""));if(this.state==="executing")throw new Error("Cannot call execute() while a previous call to execute() is still running.");if(this.state==="canceled")throw new Fi;if(this.state==="done")return;if(this._composable&&this.output.state==="pending")throw new Error("A composable conversion requires the output to be started. Call start() on the output before executing the conversion.");this.state="executing",this._executionUntil=e.until??1/0,this._pauseRequested=e.pauseSignal?.aborted??!1;let r=()=>{this.state==="executing"&&(this._pauseRequested=!0,this._synchronizer.resolveAll());};e.pauseSignal?.addEventListener("abort",r);for(let s of this._trackPumps)s.done||(s.resolvers=he());if(this._executed)for(let s of this._trackPumps)s.wake?.();else {this._executed=!0;for(let s of this._outputTrackIds)this._synchronizer.declareTrack(s);if(this.onProgress){let n=[...new Set(this.utilizedTracks)].map(async a=>await a.isLive()?1/0:await a.getDurationFromMetadata()??await a.computeDuration()),o=Math.max(0,...await Promise.all(n));this._computeProgress=!0,this._totalDuration=Math.min(o-this._startTimestamp,this._endTimestamp-this._startTimestamp);for(let a of this._outputTrackIds)this._maxTimestamps.set(a,0);this.onProgress?.(0,0);}this._composable||await this.output.start();for(let s of this._trackPumps)s.start();}try{await Promise.all(this._trackPumps.map(s=>s.resolvers.promise));}catch(s){throw this.state!=="canceled"&&this.cancel(),s}finally{e.pauseSignal?.removeEventListener("abort",r);}if(this.state==="canceled")throw new Fi;let i=this._trackPumps.every(s=>s.done);if(this.state=i?"done":"idle",i&&(this._composable||await this.output.finalize(),this._computeProgress)){let s=Math.min(...this._maxTimestamps.values());this.onProgress?.(1,s);}}async cancel(){if(this.state!=="done"){if(this.state==="canceled"){K._warn("Conversion already canceled.");return}this.state="canceled";for(let e of this._trackPumps)e.wake?.();this._synchronizer.resolveAll(),this._composable||await this.output.cancel();}}async _processVideoTrack(e,r,i){let s=await e.getCodec();if(!s){this.discardedTracks.push({track:e,reason:"unknown_source_codec",trackOptions:r});return}let n,o=await e.getRotation(),a=yt(o+(r.rotate??0)),c=a,l=this.output.format.supportsVideoRotationMetadata&&(r.allowRotationMetadata??!0),u=await e.getSquarePixelWidth(),d=await e.getSquarePixelHeight(),[f,m]=a%180===0?[u,d]:[d,u],p=r.crop;p&&(p=ki(p,f,m));let[b,y]=p?[p.width,p.height]:[f,m],w=b,A=y,T=w/A;r.width!==void 0&&r.height===void 0?(w=Jt(r.width),A=Jt(Math.round(w/T))):r.width===void 0&&r.height!==void 0?(A=Jt(r.height),w=Jt(Math.round(A*T))):r.width!==void 0&&r.height!==void 0&&(w=Jt(r.width),A=Jt(r.height));let I=await e.getFirstTimestamp(),v=this.output.format.getSupportedVideoCodecs(),F=!!r.forceTranscode||I<this._startTimestamp||!!r.frameRate||r.keyFrameInterval!==void 0||r.process!==void 0||r.quality!==void 0||r.bitrate!==void 0||!v.includes(s)||r.codec&&r.codec!==s||w!==b||A!==y||a!==0&&!l||!!p,E=r.alpha??"discard";if(F){if(!await e.canDecode()){this.discardedTracks.push({track:e,reason:"undecodable_source_codec",trackOptions:r});return}r.codec&&(v=v.filter(ne=>ne===r.codec));let z=Kt(r.quality,r.bitrate)??new Se("high"),N=await Ha(v,{width:r.process&&r.processedWidth?r.processedWidth:w,height:r.process&&r.processedHeight?r.processedHeight:A,quality:z});if(!N){this.discardedTracks.push({track:e,reason:"no_encodable_target_codec",trackOptions:r});return}let Z={codec:N,quality:z,keyFrameInterval:r.keyFrameInterval,sizeChangeBehavior:r.fit??"passThrough",alpha:E,hardwareAcceleration:r.hardwareAcceleration,transform:{}};g(Z.transform);let oe=w!==b||A!==y||a!==0&&(!l||r.process!==void 0)||!!p||u!==await e.getCodedWidth()||d!==await e.getCodedHeight();if(!oe){let ne={stack:[],error:void 0,hasError:!1};try{let ge=new Zt({format:new Xt,target:new Ei}),Ie=new Ii(Z);ge.addVideoTrack(Ie),await ge.start();let Be=new xi(e),Ee=Pi(ne,await Be.getSample(I),!1);if(Ee)try{await Ie.add(Ee),Ee.close(),await ge.finalize();}catch(hr){K._warn("An error occurred when probing encoder support. Falling back to rerender path.",hr),ge.cancel(),oe=!0,Z.transform.force=!0;}else await ge.cancel();}catch(ge){ne.error=ge,ne.hasError=!0;}finally{Qn(ne);}}r.frameRate&&(Z.transform.frameRate=r.frameRate),r.process&&(Z.transform.process=r.process),oe&&(c=0,Z.transform.width=w,Z.transform.height=A,Z.transform.fit=r.fit??"fill",Z.transform.rotate=yt(a-o),Z.transform.crop=p,Z.transform.alpha=E);let Y=null;Z.onEncodedSample=ne=>{Y=ne.timestamp;};let G=new Ii(Z);n=G,this._registerTrackPump(async ne=>{let ge=new xi(e);for await(let Ie of ge.samples(this._startTimestamp,this._endTimestamp)){let Be={stack:[],error:void 0,hasError:!1};try{let Ee=Pi(Be,Ie,!1);if(this.state==="canceled")break;let hr=Math.max(Ee.timestamp-this._startTimestamp,0);Ee.setTimestamp(hr),this._reportProgress(i,Ee.timestamp+Ee.duration),await G.add(Ee),Ee.close(),Y!==null&&(this._synchronizer.shouldWait(i,Y)&&await this._synchronizer.wait(Y),await this._checkpoint(ne,Y));}catch(Ee){Be.error=Ee,Be.hasError=!0;}finally{Qn(Be);}}G.close(),this._synchronizer.closeTrack(i);});}else {let B=new Un(s);n=B,this._registerTrackPump(async z=>{let N=new ft(e),oe={decoderConfig:await e.getDecoderConfig()??void 0};for await(let Y of N.packets(void 0,void 0,{verifyKeyPackets:!0})){if(this.state==="canceled"||Y.timestamp>=this._endTimestamp)break;let G=Y.clone({timestamp:Y.timestamp-this._startTimestamp,sideData:E==="discard"?{}:Y.sideData});g(G.timestamp>=0),this._reportProgress(i,G.timestamp+G.duration),await B.add(G,oe),this._synchronizer.shouldWait(i,G.timestamp)&&await this._synchronizer.wait(G.timestamp),await this._checkpoint(z,G.timestamp);}B.close(),this._synchronizer.closeTrack(i);});}let k=null;!r.group&&!this._composable&&(k=new Le);let _=await e.getLanguageCode();this.output.addVideoTrack(n,{frameRate:r.frameRate,languageCode:St(_)?_:void 0,name:await e.getName()??void 0,disposition:await e.getDisposition(),rotation:c,group:k??r.group}),this.utilizedTracks.push(e),this._outputTrackIds.push(i),this._outputOwnTrackGroups.push(k);}async _processAudioTrack(e,r,i){let s=await e.getCodec();if(!s){this.discardedTracks.push({track:e,reason:"unknown_source_codec",trackOptions:r});return}let n,o=await e.getNumberOfChannels(),a=await e.getSampleRate(),c=await e.getFirstTimestamp(),l=r.numberOfChannels??o,u=r.sampleRate??a,d=c<this._startTimestamp,f=c>this._startTimestamp&&!this.output.format.supportsTimestampedMediaData,m=this.output.format.getSupportedAudioCodecs();if(!r.forceTranscode&&!r.quality&&!r.bitrate&&l===o&&u===a&&!d&&!f&&m.includes(s)&&(!r.codec||r.codec===s)&&!r.process&&r.sampleFormat===void 0){let y=new Nn(s);n=y,this._registerTrackPump(async w=>{let A=new ft(e),I={decoderConfig:await e.getDecoderConfig()??void 0};for await(let v of A.packets()){if(this.state==="canceled"||v.timestamp>=this._endTimestamp)break;let F=v.clone({timestamp:v.timestamp-this._startTimestamp});g(F.timestamp>=0),this._reportProgress(i,F.timestamp+F.duration),await y.add(F,I),this._synchronizer.shouldWait(i,F.timestamp)&&await this._synchronizer.wait(F.timestamp),await this._checkpoint(w,F.timestamp);}y.close(),this._synchronizer.closeTrack(i);});}else {if(!await e.canDecode()){this.discardedTracks.push({track:e,reason:"undecodable_source_codec",trackOptions:r});return}let w=null;r.codec&&(m=m.filter(E=>E===r.codec));let A=Kt(r.quality,r.bitrate)??new Se("high"),T=await Ds(m,{numberOfChannels:r.process&&r.processedNumberOfChannels?r.processedNumberOfChannels:l,sampleRate:r.process&&r.processedSampleRate?r.processedSampleRate:u,quality:A});if(!T.some(E=>qt.includes(E))&&m.some(E=>qt.includes(E))&&(l!==ao||u!==co)){let k=(await Ds(m,{numberOfChannels:ao,sampleRate:co,quality:A})).find(_=>qt.includes(_));k&&(w=k,l=ao,u=co);}else w=T[0]??null;if(w===null){this.discardedTracks.push({track:e,reason:"no_encodable_target_codec",trackOptions:r});return}let I={codec:w,quality:A,transform:{sampleFormat:r.sampleFormat,process:r.process}};g(I.transform),l!==o&&(I.transform.numberOfChannels=l),u!==a&&(I.transform.sampleRate=u);let v=null;I.onEncodedSample=E=>{v=E.timestamp;};let F=new Wn(I);n=F,this._registerTrackPump(async E=>{let k=new Rn(e);for await(let _ of k.samples(this._startTimestamp,this._endTimestamp)){let B={stack:[],error:void 0,hasError:!1};try{let z=Pi(B,_,!1);if(this.state==="canceled")break;if(f){let G={stack:[],error:void 0,hasError:!1};try{let ne=c-this._startTimestamp,ge=Math.round(ne*a),Ie=dt(z.format),Be=new Uint8Array(Ie*ge*o);(z.format==="u8"||z.format==="u8-planar")&&Be.fill(2**7);let Ee=Pi(G,new Fe({data:Be,format:z.format,numberOfChannels:o,sampleRate:a,timestamp:0}),!1);await this._registerAudioSample(E,Ee,F,i,()=>v),f=!1;}catch(ne){G.error=ne,G.hasError=!0;}finally{Qn(G);}}let N=0,Z=z.numberOfFrames;z.timestamp<this._startTimestamp&&(N=Math.round((this._startTimestamp-z.timestamp)*z.sampleRate)),z.timestamp+z.duration>this._endTimestamp&&(Z=Math.round((this._endTimestamp-z.timestamp)*z.sampleRate));let oe;if(N>0||Z<z.numberOfFrames){let G=z.trim(N,Z);if(z.close(),oe=G,G.numberOfFrames===0){G.close();continue}}else oe=z;let Y=Pi(B,oe,!1);Y.setTimestamp(Y.timestamp-this._startTimestamp),await this._registerAudioSample(E,Y,F,i,()=>v);}catch(z){B.error=z,B.hasError=!0;}finally{Qn(B);}}F.close(),this._synchronizer.closeTrack(i);});}let p=null;!r.group&&!this._composable&&(p=new Le);let b=await e.getLanguageCode();this.output.addAudioTrack(n,{languageCode:St(b)?b:void 0,name:await e.getName()??void 0,disposition:await e.getDisposition(),group:p??r.group}),this.utilizedTracks.push(e),this._outputTrackIds.push(i),this._outputOwnTrackGroups.push(p);}async _registerAudioSample(e,r,i,s,n){this._reportProgress(s,r.timestamp+r.duration),await i.add(r),r.close();let o=n();o!==null&&(this._synchronizer.shouldWait(s,o)&&await this._synchronizer.wait(o),await this._checkpoint(e,o));}_registerTrackPump(e){let r={done:!1,resolvers:he(),wake:null,start:()=>{e(r).then(()=>{r.done=!0,r.resolvers.resolve();},i=>{r.resolvers.reject(i);});}};this._trackPumps.push(r);}async _checkpoint(e,r){for(;this.state!=="canceled"&&(r>=this._executionUntil||this._pauseRequested);){e.resolvers.resolve();let{promise:i,resolve:s}=he();e.wake=s,await i;}}_reportProgress(e,r){if(!this._computeProgress)return;g(this._totalDuration!==null),this._maxTimestamps.set(e,Math.max(r,this._maxTimestamps.get(e)));let i=Math.min(...this._maxTimestamps.values()),s=ue(i/this._totalDuration,0,1);s!==this._lastProgress&&(this._lastProgress=s,this.onProgress?.(s,i));}},Fi=class extends Error{constructor(e="Conversion has been canceled."){super(e),this.name="ConversionCanceledError";}},wc=1,lo=class{constructor(e){this.maxTimestamps=new Map,this.resolvers=[],this.conversion=e;}declareTrack(e){this.maxTimestamps.set(e,0);}shouldWait(e,r){let i=this.maxTimestamps.get(e);g(i!==void 0),this.maxTimestamps.set(e,Math.max(r,i));let s=this.computeMinAndMaybeResolve();return this.conversion.state==="canceled"||this.conversion._pauseRequested||r>=this.conversion._executionUntil?!1:r-s>wc}wait(e){let{promise:r,resolve:i}=he();return this.resolvers.push({timestamp:e,resolve:i}),r}closeTrack(e){this.maxTimestamps.delete(e),this.computeMinAndMaybeResolve();}resolveAll(){for(let e of this.resolvers)e.resolve();this.resolvers.length=0;}computeMinAndMaybeResolve(){let e=1/0;for(let[,r]of this.maxTimestamps)e=Math.min(e,r);for(let r=0;r<this.resolvers.length;r++){let i=this.resolvers[r];i.timestamp-e<wc&&(i.resolve(),this.resolvers.splice(r,1),r--);}return e}};var yc=Symbol.for("mediabunny loaded");globalThis[yc]&&K._error(`[WARNING]
Mediabunny was loaded twice. This will likely cause Mediabunny not to work correctly. Check if multiple dependencies are importing different versions of Mediabunny, or if something is being bundled incorrectly.`);globalThis[yc]=!0;return _c(ju);})();
    } catch (e) {
      console.error('YTEE: Mediabunny failed to initialize', e);
      __ytee_mediabunnyFailed = true;
      return null;
    }
    return Mediabunny;
  };
  // ==[/Mediabunny end]==

  if (window.self === window.top) {
    runTopFrameFixes();

  // Chat / hyperchat frames — leave them alone.
  } else if (!isChat()) {
    injectCriticalCSS();
    registerSettingsFlush();

    let currentSettings = loadStoredSettings() || defaultSettings;

    let __ytee_visibleBtnCount = 10;

    const applyUIStates = (settings) => {
      const w = document.documentElement.clientWidth || window.innerWidth || 800;
      const h = document.documentElement.clientHeight || window.innerHeight || 600;
      const isSmall = w < 550 || h < 400;

      let labelsOff = !!settings.compactMode;
      let collapsed = !!settings.isCollapsed;

      document.documentElement.dataset.yteeLabels = labelsOff ? '0' : '1';
      document.documentElement.dataset.yteeHighContrast = settings.highContrastUI ? '1' : '0';
      const group = document.getElementById('custom-btn-group');
      if (group) {
        group.classList.toggle('collapsed', collapsed);

        if (isSmall) {
          const leftReserve = (settings.buttons && settings.buttons.vol) ? 92 : 40;
          const avail = w - leftReserve;
          const SLACK = 24;
          const measured = group.offsetWidth;

          if (measured > 0) {
            if (!labelsOff && measured > avail + SLACK) {
              labelsOff = true;
              document.documentElement.dataset.yteeLabels = '0';
            }
            if (!collapsed && (group.offsetWidth > avail + SLACK || h < 180)) {
              collapsed = true;
              group.classList.toggle('collapsed', true);
            }
          } else {
            const n = __ytee_visibleBtnCount;
            if (!labelsOff && w < n * 60 + 100) { labelsOff = true; document.documentElement.dataset.yteeLabels = '0'; }
            if (!collapsed && (w < n * 24 + 100 || h < 180)) { collapsed = true; group.classList.toggle('collapsed', true); }
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
          if (typeof p.setPlaybackQuality === 'function') p.setPlaybackQuality(pref);
          qualityAppliedFor = vid;
        } catch (e) { yteeWarn('YTEE: applyQuality failed', e); }
      };

      let lastHolodexStatus = 'unknown';

      const hookPlayerEvents = () => {
        const p = getPlayer();
        if (!p || typeof p.addEventListener !== 'function') return;
        p.addEventListener('onStateChange', (state) => {
          if (state === 1) applyQuality();
          if (state === 1) sessionStorage.setItem('ytee-reload-count', '0');
        });
        p.addEventListener('onPlaybackQualityChange', (q) => {
          const level = (q && q.data) || q;
          const pref = currentSettings.preferredQuality;
          if (!pref || pref === 'auto') return;
          const vid = (() => { try { return getVideoId(p); } catch (e) { return null; } })();
          if (vid && qualityAppliedFor === vid && typeof level === 'string' && level !== pref) {
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
        if (annotPanelOpen && annotPanel && annotPanel.contains(e.target)) return;
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
      document.documentElement.addEventListener("wheel", onWheel, { passive: false });

      // Stats
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
        currentSettings.miniStatsPos = { pL, pT };
        saveStoredSettings(currentSettings);
      };
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

      miniStats.addEventListener('dblclick', (e) => {
        e.stopPropagation();
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

      // Speed
      const SPEED_MIN = 0.1, SPEED_MAX = 16, SPEED_STEP = 0.1, SPEED_STEP_FINE = 0.01, SPEED_DEFAULT = 1;
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
      speedBtn.addEventListener("mouseenter", () => { isHoveringSpeedBtn = true; });
      speedBtn.addEventListener("mouseleave", () => { isHoveringSpeedBtn = false; });

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
      const urlBtn = mkBtn('custom-url-btn', 'url', 'URL', 'Copy URL (Ctrl+Click = with timestamp) \u2022 Middle-Click = Open in YouTube');
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

      // Bookmarks (annotations)
      const annotBtn = mkBtn('custom-annot-btn', 'annot', 'Notes', 'Notes for this video • right-click drops one');

      const seekTo = (sec) => {
        const p = getPlayer();
        try {
          if (p && typeof p.seekTo === 'function') { p.seekTo(sec, true); return; }
        } catch (e) { }
        try { video.currentTime = sec; } catch (e) { }
      };

      const annotVid = () => { try { return getVideoId(getPlayer()); } catch (e) { return ''; } };

      const getAnnot = (vid) => currentSettings.annotationsCache[vid] || null;

      const ensureAnnot = (vid) => {
        let a = currentSettings.annotationsCache[vid];
        if (!a) {
          const p = getPlayer();
          a = { marks: [], title: getVideoTitle(p) || '', channel: getVideoAuthor(p) || '', t: Date.now() };
          currentSettings.annotationsCache[vid] = a;
        }
        return a;
      };

      const cleanupAnnot = (vid) => {
        const a = currentSettings.annotationsCache[vid];
        if (a && a.marks.length === 0) delete currentSettings.annotationsCache[vid];
      };

      const persistAnnot = (vid) => {
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
          id: "custom-settings-restore", textContent: "Restore defaults", title: "Resets settings to defaults (keeps caches)"
        });
        const clearCacheBtn = Object.assign(document.createElement("button"), {
          id: "custom-settings-clear-cache", textContent: "Clear cache", title: "Clears volume, video, mini stats, and InnerTube cache"
        });
        const cancelBtn = Object.assign(document.createElement("button"), { id: "custom-settings-cancel", textContent: "Cancel" });
        const saveBtn = Object.assign(document.createElement("button"), { id: "custom-settings-save", textContent: "Save changes" });
        settingsButtons.append(restoreBtn, clearCacheBtn, cancelBtn, saveBtn);

        settingsContent.append(settingsHeader, tabsContainer, infoBox, settingsItems, settingsButtons);
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
          const preserved = { volumeCache: currentSettings.volumeCache, positionCache: currentSettings.positionCache, miniStatsCache: currentSettings.miniStatsCache, miniStatsPos: currentSettings.miniStatsPos, favoritesCache: currentSettings.favoritesCache, annotationsCache: currentSettings.annotationsCache };
          currentSettings = Object.assign(structuredClone(defaultSettings), preserved);
          saveStoredSettings(currentSettings, { immediate: true });
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

        let clearConfirmTimeout = null;
        clearCacheBtn.addEventListener('click', () => {
          if (!clearCacheBtn.classList.contains('confirm')) {
            clearCacheBtn.classList.add('confirm');
            clearCacheBtn.textContent = 'Confirm clear?';
            clearConfirmTimeout = setTimeout(() => { clearCacheBtn.classList.remove('confirm'); clearCacheBtn.textContent = 'Clear cache'; }, 3000);
            return;
          }
          clearTimeout(clearConfirmTimeout);
          clearCacheBtn.classList.remove('confirm');
          currentSettings.volumeCache = {};
          currentSettings.positionCache = {};
          currentSettings.miniStatsCache = {};
          currentSettings.miniStatsPos = null;
          clearInnertubeCache();
          saveStoredSettings(currentSettings, { immediate: true });
          try {
            if (miniStats && miniStats.style) {
              miniStats.style.left = ''; miniStats.style.top = ''; miniStats.style.bottom = '45px';
            }
          } catch (e) { }
          if (isHistoryTabActive()) { renderHistoryTab(); historyTabDirty = false; } else { historyTabDirty = true; }
          clearCacheBtn.classList.add('success');
          clearCacheBtn.textContent = 'Cleared!'; clearCacheBtn.disabled = true;
          setTimeout(() => { clearCacheBtn.classList.remove('success'); clearCacheBtn.textContent = 'Clear cache'; clearCacheBtn.disabled = false; }, 1500);
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

      const mkActionBtn = (variant, label, title, color) => {
        const b = Object.assign(document.createElement('button'), {
          textContent: label, title, className: 'ytee-abtn ytee-abtn-' + variant,
        });
        if (color) b.style.color = color;
        return b;
      };

      let historyRenderTimer = null;
      let historyRenderRaf = 0;
      const scheduleHistoryRender = () => {
        if (!settingsModal || !settingsModal.classList.contains('show') || !isHistoryTabActive()) { historyTabDirty = true; return; }
        clearTimeout(historyRenderTimer);
        historyRenderTimer = setTimeout(() => {
          try { renderHistoryTab(); historyTabDirty = false; } catch (e) { }
        }, 500);
      };

      const syncGist = (onDone) => {
        const token = currentSettings.gistToken;
        const gistId = currentSettings.gistId;
        if (!token || !gistId) { if (onDone) onDone('error'); return; }

        const pushToGist = () => {
          GM_xmlhttpRequest({
            method: 'PATCH',
            url: `https://api.github.com/gists/${gistId}`,
            headers: { 'Authorization': `token ${token}`, 'Content-Type': 'application/json', 'Accept': 'application/vnd.github.v3+json' },
            data: JSON.stringify({
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
            }),
            onload: (pr) => {
              if (pr.status === 200 || pr.status === 201) {
                currentSettings.gistSyncLastTime = Date.now();
                saveStoredSettings(currentSettings, { immediate: true });
                if (onDone) onDone('success');
              } else { if (onDone) onDone('error'); }
            },
            onerror: () => { if (onDone) onDone('error'); }
          });
        };

        GM_xmlhttpRequest({
          method: 'GET',
          url: `https://api.github.com/gists/${gistId}`,
          headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json' },
          onload: (r) => {
            if (r.status === 404) { pushToGist(); return; }
            if (r.status !== 200) { if (onDone) onDone('error'); return; }
            try {
              const gistData = JSON.parse(r.responseText);
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
                    const r = rem[vid], l = loc[vid];
                    if (!l) { loc[vid] = r; continue; }
                    const markMap = new Map();
                    [...l.marks, ...r.marks].forEach(m => {
                      const prev = markMap.get(m.s);
                      if (!prev || (m.label && m.label.length > prev.label.length)) markMap.set(m.s, m);
                    });
                    loc[vid] = {
                      marks: [...markMap.values()].sort((a, b) => a.s - b.s).slice(0, ANNOT_MARKS_MAX),
                      title: l.title || r.title, channel: l.channel || r.channel,
                      t: Math.max(l.t || 0, r.t || 0),
                    };
                  }
                  currentSettings.annotationsCache = parseAnnotationsCache(loc);
                }
              }
            } catch (e) { }
            pushToGist();
          },
          onerror: () => { if (onDone) onDone('error'); }
        });
      };

      const trySyncWithLock = () => {
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
          if (settingsModal && settingsModal.classList.contains('show') && isHistoryTabActive()) { try { renderHistoryTab(); historyTabDirty = false; } catch (e) { } }
          else historyTabDirty = true;
        });
      };

      let historySortDescending = true;
      let historyViewMode = currentSettings.historyViewMode || 'list';
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
            currentSettings.historyViewMode = historyViewMode;
            saveStoredSettings(currentSettings);
            renderHistoryTab();
          });
          controls.append(favFilterBtn, syncBtn, refreshBtn, sortBtn, viewBtnS);
        } else {
          const viewBtnL = mkCtrlBtn(historyViewMode === 'list' ? '\u229E' : '\u2261', historyViewMode === 'list' ? 'Switch to grid view' : 'Switch to list view');
          viewBtnL.addEventListener('click', () => {
            historyViewMode = historyViewMode === 'list' ? 'grid' : 'list';
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
          ...Object.keys(currentSettings.favoritesCache || {}),
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

        const mkHistBtn = (label, title, color) => mkActionBtn('pill', label, title, color);

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

          const dlThumbHistBtn = mkHistBtn('\u2B07 Thumb', 'Download thumbnail (best available quality)');
          dlThumbHistBtn.addEventListener('click', () => {
            const thumbQualities = ['maxresdefault.jpg', 'hqdefault.jpg', 'mqdefault.jpg'];
            const tryThumb = (idx) => {
              if (idx >= thumbQualities.length) { flashBtnState(dlThumbHistBtn, 'error'); return; }
              const url = `https://img.youtube.com/vi/${vid}/${thumbQualities[idx]}`;
              GM_xmlhttpRequest({
                method: 'HEAD', url,
                onload: (r) => {
                  if (r.status === 200) { downloadUrlAsFile(url, `${titleText}_thumbnail`); flashBtnState(dlThumbHistBtn, 'success'); }
                  else { tryThumb(idx + 1); }
                },
                onerror: () => tryThumb(idx + 1)
              });
            };
            tryThumb(0);
          });

          const dlPfpHistBtn = mkHistBtn('\u2B07 PFP', 'Download channel avatar');
          dlPfpHistBtn.addEventListener('click', () => {
            dlPfpHistBtn.textContent = '\u2026';
            const fallbackToYouTube = (vId) => {
              GM_xmlhttpRequest({
                method: 'GET', url: `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${vId}&format=json`,
                onload: (r) => {
                  if (r.status !== 200) { flashBtnState(dlPfpHistBtn, 'error'); dlPfpHistBtn.textContent = '\u2B07 PFP'; return; }
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
                            flashBtnState(dlPfpHistBtn, 'success');
                          } else { throw new Error('No avatar found'); }
                        } catch (e) { flashBtnState(dlPfpHistBtn, 'error'); }
                        dlPfpHistBtn.textContent = '\u2B07 PFP';
                      },
                      onerror: () => { flashBtnState(dlPfpHistBtn, 'error'); dlPfpHistBtn.textContent = '\u2B07 PFP'; }
                    });
                  } catch (e) { flashBtnState(dlPfpHistBtn, 'error'); dlPfpHistBtn.textContent = '\u2B07 PFP'; }
                },
                onerror: () => { flashBtnState(dlPfpHistBtn, 'error'); dlPfpHistBtn.textContent = '\u2B07 PFP'; }
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
                      flashBtnState(dlPfpHistBtn, 'success');
                      dlPfpHistBtn.textContent = '\u2B07 PFP';
                      return;
                    }
                  } catch (e) { }
                }
                fallbackToYouTube(vid);
              },
              onerror: () => fallbackToYouTube(vid)
            });
          });

          const copyLinkBtn = mkHistBtn('\uD83D\uDD17', 'Copy link  \u2022  Ctrl+click to copy with timestamp');
          copyLinkBtn.addEventListener('click', (e) => {
            const baseUrl = `https://youtu.be/${vid}`;
            if (e.ctrlKey) {
              const posVal = posObj && typeof posObj === 'object' ? posObj.v : (posObj || 0);
              if (!posVal || posVal <= 0) {
                const origTitle = copyLinkBtn.title;
                copyLinkBtn.title = '\u26A0 No timestamp saved for this video';
                flashBtnState(copyLinkBtn, 'error');
                setTimeout(() => { copyLinkBtn.title = origTitle; }, 2500);
                return;
              }
              navigator.clipboard.writeText(`${baseUrl}?t=${Math.floor(posVal)}`)
                .then(() => flashBtnState(copyLinkBtn, 'success'))
                .catch(() => flashBtnState(copyLinkBtn, 'error'));
            } else {
              navigator.clipboard.writeText(baseUrl)
                .then(() => flashBtnState(copyLinkBtn, 'success'))
                .catch(() => flashBtnState(copyLinkBtn, 'error'));
            }
          });

          const deleteBtn = mkHistBtn('Delete', 'Delete from history', '#ff5555');
          deleteBtn.style.background = 'rgba(255,0,0,0.2)';
          deleteBtn.style.borderColor = 'rgba(255,0,0,0.4)';
          deleteBtn.addEventListener('click', () => {
            delete currentSettings.volumeCache[vid];
            delete currentSettings.positionCache[vid];
            delete currentSettings.miniStatsCache[vid];
            delete currentSettings.favoritesCache[vid];
            delete currentSettings.annotationsCache[vid];
            saveStoredSettings(currentSettings, { immediate: true });
            if (cardRef.el && cardRef.el.isConnected) cardRef.el.remove();
            else renderHistoryTab();
          });

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
              delete currentSettings.favoritesCache[vid];
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

          const holodexBtn = mkHistBtn('Open Holodex', 'Open in Holodex', '#7ddf7d');
          holodexBtn.addEventListener('click', () => { window.open(`https://holodex.net/multiview/AAYY${vid}`, '_blank'); flashBtnState(holodexBtn, 'success'); });

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
            ovThumb.addEventListener('click', (e) => { e.stopPropagation(); dlThumbHistBtn.click(); });
            const ovPfp = mkOvBtn('\u{1F464}', 'Download PFP');
            ovPfp.addEventListener('click', (e) => { e.stopPropagation(); dlPfpHistBtn.click(); });
            const ovLink = mkOvBtn('\uD83D\uDD17', 'Copy link \u2022 Ctrl+click for timestamp');
            ovLink.addEventListener('click', (e) => { e.stopPropagation(); copyLinkBtn.dispatchEvent(new MouseEvent('click', { ctrlKey: e.ctrlKey, bubbles: true })); });
            const ovHolo = mkOvBtn('Holodex', 'Open in Holodex', '#7ddf7d');
            ovHolo.addEventListener('click', (e) => { e.stopPropagation(); holodexBtn.click(); });
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
            cardDel.addEventListener('click', () => deleteBtn.click());

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
            laThumb.addEventListener('click', () => dlThumbHistBtn.click());
            const laPfp = mkListAction('\u2B07 PFP', 'Download PFP');
            laPfp.addEventListener('click', () => dlPfpHistBtn.click());
            const laLink = mkListAction('\uD83D\uDD17', 'Copy link \u2022 Ctrl+click for timestamp');
            laLink.addEventListener('click', (e) => copyLinkBtn.dispatchEvent(new MouseEvent('click', { ctrlKey: e.ctrlKey, bubbles: true })));
            const laHolo = mkListAction('Holodex', 'Open in Holodex', '#7ddf7d');
            laHolo.addEventListener('click', () => holodexBtn.click());
            const laDel = mkListAction('Delete', 'Delete from history', 'rgba(255,80,80,0.7)');
            laDel.style.borderColor = 'rgba(255,80,80,0.2)';
            laDel.addEventListener('mouseenter', () => { laDel.style.background = 'rgba(255,50,50,0.15)'; laDel.style.color = '#ff5555'; });
            laDel.addEventListener('mouseleave', () => { laDel.style.background = 'rgba(255,255,255,0.07)'; laDel.style.color = 'rgba(255,80,80,0.7)'; });
            laDel.addEventListener('click', () => deleteBtn.click());
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
          ui.append(mkRow('Persistent Mini Stats', 'Show Mini Stats on every video', mkToggle('ytee-always-show-mini-stats', false)));
          ui.append(mkSection('Button Visibility'));
          const grid = Object.assign(document.createElement('div'), { className: 'ytee-grid-2' });
          const buttonNames = { vol: 'Volume slider', wl: 'Watch later', url: 'Copy URL', screenshot: 'Screenshot', clip: 'Clip', replay: 'Replay', pip: 'PiP', speed: 'Speed', stats: 'Stats', sleep: 'Sleep timer', annot: 'Notes' };
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
            toggleFullscreen: ['Toggle Fullscreen', 'Enter/exit fullscreen'],
            cycleSleepTimer: ['Sleep Timer', 'Cycle off / 15m / 30m / 45m / 1h / 1.5h / 2h / 3h / 4h / end'],
            addBookmark: ['Add Note', 'Drop a note at the current time'],
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
        setCb('ytee-compact-mode', currentSettings.compactMode);
        setCb('ytee-high-contrast', currentSettings.highContrastUI);
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
        const isShiftedSym = e.shiftKey && (e.key in SHIFTED_SYMBOL_MAP);
        const combo = [e.altKey ? 'alt+' : '', e.ctrlKey ? 'ctrl+' : '', e.shiftKey && !isShiftedSym ? 'shift+' : '', e.key.toLowerCase()].join('');
        const action = hotkeyMap[combo];
        noteSleepActivity('activity');
        if (annotPanelOpen && annotPanel && annotPanel.contains(e.target)) {
          if (e.key === 'Escape') closeAnnotPanel();
          return;
        }
        if (annotPanelOpen && e.key === 'Escape') { closeAnnotPanel(); e.preventDefault(); return; }
        if (isSettingsOpen) {
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
            case 'increaseSpeed': applySpeed(targetSpeed + SPEED_STEP); break;
            case 'decreaseSpeed': applySpeed(targetSpeed - SPEED_STEP); break;
            case 'increaseSpeedFine': applySpeed(targetSpeed + SPEED_STEP_FINE); break;
            case 'decreaseSpeedFine': applySpeed(targetSpeed - SPEED_STEP_FINE); break;
            case 'volumeUp': applyVolume(targetVolume + (currentSettings.volumeStep / 100)); break;
            case 'volumeDown': applyVolume(targetVolume - (currentSettings.volumeStep / 100)); break;
            case 'toggleSettings': showSettingsModal(); break;
            case 'toggleFullscreen': toggleFullscreen(); break;
            case 'cycleSleepTimer': cycleSleepTimer(); break;
            case 'addBookmark': addBookmarkAtCurrent(true); break;
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

      applySpeed(targetSpeed);
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
        document.documentElement.classList.toggle('ytee-compact', w < 550 || h < 400);
        applyMiniStatsPos();
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
            const uiChanged = ['buttons', 'compactMode', 'highContrastUI', 'isCollapsed'].some(diff);
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
        clearTimeout(volTimeout); clearTimeout(speedTimeout); clearTimeout(controlsTimeout); clearTimeout(miniStatsTimer);
        clearTimeout(historyRenderTimer);
        clearTimeout(gistSyncStartTimer); if (gistSyncIntervalId) clearInterval(gistSyncIntervalId);
        if (clipRafId) cancelAnimationFrame(clipRafId);
        if (historyRenderRaf) { cancelAnimationFrame(historyRenderRaf); historyRenderRaf = 0; }
        document.documentElement.removeEventListener("wheel", onWheel);
        window.removeEventListener("keydown", onKeyDown, true);
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("dblclick", onDblClick);
        document.removeEventListener('fullscreenchange', onFullscreenChange);
        window.removeEventListener('mousemove', onMiniStatsDrag);
        window.removeEventListener('mouseup', onMiniStatsDragEnd);
        document.removeEventListener('visibilitychange', onVisibilityChange);
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
        clearInterval(annotNowTimer);
        document.removeEventListener('mousedown', onAnnotOutside, true);
        [settingsModal, btnGroup, volPct, speedOverlay, clipOverlay, replayOverlay, sleepOverlay, sleepChip, miniStats, vol, muteBtn, annotPanel].forEach(el => {
          if (el && el.parentNode) el.remove();
        });
      };
      window.addEventListener('pagehide', cleanup);

    });
  }

})();
