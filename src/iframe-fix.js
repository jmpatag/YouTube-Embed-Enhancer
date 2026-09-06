import { yteeWarn } from './debug.js';

export const runTopFrameFixes = () => {
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
