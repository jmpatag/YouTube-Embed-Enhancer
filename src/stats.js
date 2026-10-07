import { mkBtn } from './icons.js';
import { saveStoredSettings } from './settings.js';
import { getVideoId, getVideoTitle, getVideoAuthor } from './video-util.js';

export const createStats = ({ video, getPlayer, getSettings, isCurrentlyLive, scheduleHistoryRender }) => {
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
