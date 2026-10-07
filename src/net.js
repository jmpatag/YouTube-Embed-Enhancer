import { yteeWarn } from './debug.js';

export const gmOrFetch = ({ method, url, headers = {}, data, credentials = 'same-origin' }) => {
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
