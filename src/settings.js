import { yteeWarn, yteeLog } from './debug.js';

// Settings
export const defaultSettings = {
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
export const isGmStorageBroken = () => __ytee_gmStorageBroken;

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

export const loadStoredSettings = () => {
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

export const saveStoredSettings = (s, opts = {}) => {
  __ytee_pending_settings = s;
  __ytee_last_settings = s;
  if (opts.immediate) { __ytee_flushStoredSettings(true); return; }
  if (__ytee_save_timer) clearTimeout(__ytee_save_timer);
  __ytee_save_timer = setTimeout(__ytee_flushStoredSettings, SAVE_DEBOUNCE);
};

export const registerSettingsFlush = () => {
try {
  const __ytee_finalizeSave = () => __ytee_flushStoredSettings(true);
  window.addEventListener('beforeunload', __ytee_finalizeSave, { passive: true });
  window.addEventListener('pagehide', __ytee_finalizeSave, { passive: true });
} catch (e) { }
};

export const parseCache = (rawCache, enabled = true) => {
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

export const ANNOT_LABEL_MAX = 200, ANNOT_MARKS_MAX = 500;

export const parseAnnotationsCache = (raw) => {
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

export const normalizeSettings = (s) => {
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
