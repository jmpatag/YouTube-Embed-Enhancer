import { loadStoredSettings, saveStoredSettings, parseAnnotationsCache, ANNOT_MARKS_MAX } from './settings.js';
import { gmOrFetch } from './net.js';

export const createGistSync = ({ getSettings, onBackgroundSynced }) => {

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
