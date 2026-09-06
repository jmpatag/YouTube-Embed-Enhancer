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
export const ensureSettingsCSS = () => {
  if (yteeSettingsCSSInjected) return;
  yteeSettingsCSSInjected = true;
  document.head.appendChild(Object.assign(document.createElement('style'), { textContent: YTEE_SETTINGS_CSS }));
};

export const injectCriticalCSS = () => {
  document.head.appendChild(Object.assign(document.createElement('style'), { textContent: YTEE_CRITICAL_CSS }));
};
