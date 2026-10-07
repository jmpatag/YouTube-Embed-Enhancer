import { yteeWarn } from './debug.js';
import { mkBtn } from './icons.js';
import { setBtnLabel, flashBtnState } from './buttons.js';
import { getVideoId } from './video-util.js';
import { gmOrFetch } from './net.js';

export const createWatchLater = ({ uw, getPlayer }) => {
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
