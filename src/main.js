import { yteeWarn, yteeLog } from './debug.js';
import { runTopFrameFixes } from './iframe-fix.js';
import { isChat } from './page.js';
import { injectCriticalCSS, ensureSettingsCSS } from './styles.js';
import { ICON_DEFS, mkBtn } from './icons.js';
import { setBtnLabel, flashBtnState, flashBtnResult } from './buttons.js';
import {
  waitForVideo, formatClock, formatTimestamp, getVideoId,
  getVideoAuthor, getVideoAuthorForFile, getVideoTitle, downloadUrlAsFile,
} from './video-util.js';
import {
  defaultSettings, loadStoredSettings, saveStoredSettings, registerSettingsFlush,
  parseCache, parseAnnotationsCache, ANNOT_LABEL_MAX, ANNOT_MARKS_MAX, normalizeSettings,
} from './settings.js';
import { __ytee_loadMediabunny } from './mediabunny.js';
import { createGistSync } from './gist-sync.js';
import { createHistoryTab } from './history-tab.js';
import { createBookmarks } from './bookmarks.js';
import { createWatchLater } from './watch-later.js';
import { createPipButton, createUrlButton, createSpeedControl, SPEED_STEP, SPEED_STEP_FINE, SPEED_DEFAULT } from './toolbar-buttons.js';
import { createStats } from './stats.js';

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
