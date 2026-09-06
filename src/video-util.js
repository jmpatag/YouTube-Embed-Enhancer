import { yteeWarn } from './debug.js';

export const waitForVideo = (callback) => {
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

export const formatClock = (totalSecs) => {
  totalSecs = Math.max(0, Math.floor(totalSecs || 0));
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  return h > 0
    ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    : `${m}:${s.toString().padStart(2, '0')}`;
};

export const getVideoAuthor = (player) => {
  if (player && typeof player.getVideoData === 'function') {
    const data = player.getVideoData();
    if (data?.author) return data.author.replace(/[<>:"/\\|?*\x00-\x1F]/g, '').trim();
  }
  const authorEl = document.querySelector('.ytp-title-channel-name, .ytp-title-expanded-title .ytp-title-link');
  if (authorEl && authorEl.textContent) return authorEl.textContent.replace(/[<>:"/\\|?*\x00-\x1F]/g, '').trim();
  return '';
};

// For filenames
export const getVideoAuthorForFile = (player) => getVideoAuthor(player) || 'YouTube';

export const getVideoTitle = (player) => {
  if (player && typeof player.getVideoData === 'function') {
    const data = player.getVideoData();
    if (data?.title) return data.title.replace(/[<>:"/\\|?*\x00-\x1F]/g, '').trim();
  }
  return '';
};

export const formatTimestamp = (currentTime) => {
  const timeMs = Math.floor(currentTime * 1000);
  const mins = Math.floor(timeMs / 60000).toString().padStart(2, '0');
  const secs = Math.floor((timeMs % 60000) / 1000).toString().padStart(2, '0');
  const ms = (timeMs % 1000).toString().padStart(3, '0');
  return `${mins}-${secs}-${ms}`;
};

const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
export const getVideoId = (p) => {
  if (p && typeof p.getVideoData === 'function') {
    const id = p.getVideoData()?.video_id;
    if (id && VIDEO_ID_RE.test(id)) return id;
  }
  const fromPath = window.location.pathname.split('/').pop().split('?')[0].split('#')[0];
  if (VIDEO_ID_RE.test(fromPath)) return fromPath;
  const fromQuery = new URLSearchParams(window.location.search).get('v');
  return (fromQuery && VIDEO_ID_RE.test(fromQuery)) ? fromQuery : '';
};

export const downloadUrlAsFile = (url, baseFilename) => {
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
