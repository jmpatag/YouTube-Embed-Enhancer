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
