const SVG_NS = 'http://www.w3.org/2000/svg';
const mkSvgEl = (...pathDefs) => {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'currentColor');
  svg.style.cssText = 'width:var(--ytee-icon-size,13px);height:var(--ytee-icon-size,13px);flex-shrink:0;';
  pathDefs.forEach(def => {
    const el = document.createElementNS(SVG_NS, def.tag || 'path');
    Object.entries(def.attrs).forEach(([k, v]) => el.setAttribute(k, v));
    svg.appendChild(el);
  });
  return svg;
};

export const ICON_DEFS = {
  wl: () => mkSvgEl({ tag: 'path', attrs: { d: 'M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z' } }),
  url: () => mkSvgEl({ tag: 'path', attrs: { d: 'M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z' } }),
  screenshot: () => mkSvgEl({ tag: 'path', attrs: { d: 'M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z' } }),
  clip: () => mkSvgEl({ tag: 'circle', attrs: { cx: '12', cy: '12', r: '7' } }),
  rewind: () => mkSvgEl({ tag: 'path', attrs: { d: 'M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z' } }),
  pip: () => mkSvgEl(
    { tag: 'path', attrs: { d: 'M19 7H5c-1.1 0-2 .9-2 2v6c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zm-9 5v-1.5l4 2-4 2V12z' } },
    { tag: 'path', attrs: { d: 'M23 5h-2v14h2V5zM1 5v14h2V5H1z' } }
  ),
  stats: () => mkSvgEl({ tag: 'path', attrs: { d: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm7 13H5v-.23c0-.62.28-1.2.76-1.58C7.47 15.82 9.64 15 12 15s4.53.82 6.24 2.19c.48.38.76.97.76 1.58V19z' } }),
  settings: () => mkSvgEl({ tag: 'path', attrs: { d: 'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z' } }),
  speed: () => mkSvgEl({ tag: 'path', attrs: { d: 'M10 8v8l6-4-6-4zm6.5-4.5l-1.5 1.5C16.78 6.76 18 9.24 18 12s-1.22 5.24-3 6.99l1.5 1.5C18.77 18.12 20 15.2 20 12s-1.23-6.12-3.5-8.5zM7.5 5.5L6 4C3.23 6.38 2 9.3 2 12s1.23 5.62 4 8l1.5-1.5C5.22 16.76 4 14.29 4 12s1.22-5.24 3.5-6.5z' } }),
  hide: () => mkSvgEl({ tag: 'path', attrs: { d: 'M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z' } }),
  expand: () => mkSvgEl({ tag: 'path', attrs: { d: 'M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z' } }),
  info: () => mkSvgEl({ tag: 'path', attrs: { d: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z' } }),
  general: () => mkSvgEl({ tag: 'path', attrs: { d: 'M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z' } }),
  tools: () => mkSvgEl({ tag: 'path', attrs: { d: 'M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.5 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z' } }),
  interface: () => mkSvgEl({ tag: 'path', attrs: { d: 'M4 11h5V5H4v6zm0 7h5v-6H4v6zm6 0h5v-6h-5v6zm6 0h5v-6h-5v6zm-6-7h5V5h-5v6zm6-6v6h5V5h-5z' } }),
  hotkeys: () => mkSvgEl({ tag: 'path', attrs: { d: 'M20 5H4c-1.1 0-1.99.9-1.99 2L2 17c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-9 3h2v2h-2V8zm0 3h2v2h-2v-2zM8 8h2v2H8V8zm0 3h2v2H8v-2zm-1 2H5v-2h2v2zm0-3H5V8h2v2zm9 7H8v-2h8v2zm0-4h-2v-2h2v2zm0-3h-2V8h2v2zm3 3h-2v-2h2v2zm0-3h-2V8h2v2z' } }),
  download: () => mkSvgEl({ tag: 'path', attrs: { d: 'M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z' } }),
  fullscreen: () => mkSvgEl({ tag: 'path', attrs: { d: 'M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z' } }),
  history: () => mkSvgEl({ tag: 'path', attrs: { d: 'M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z' } }),
  sleep: () => mkSvgEl({ tag: 'path', attrs: { d: 'M9.27 4.49C6.24 5.66 4 8.57 4 12c0 4.42 3.58 8 8 8 3.43 0 6.34-2.24 7.51-5.27-.86.32-1.8.49-2.77.49-4.42 0-8-3.58-8-8 0-.97.18-1.91.53-2.74z' } }),
  annot: () => mkSvgEl({ tag: 'path', attrs: { d: 'M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z' } }),
};

export const mkBtn = (id, iconKey, labelText, tipText, titleText, isCollapsible = true) => {
  const btn = document.createElement('button');
  btn.id = id;
  btn.className = 'ytee-btn' + (isCollapsible ? ' ytee-collapsible' : '');
  const accessibleName = labelText || tipText || titleText || id;
  btn.title = titleText || tipText || labelText;
  btn.dataset.tip = tipText || labelText;
  btn.dataset.defaultLabel = labelText;
  btn.dataset.defaultTip = tipText || labelText;
  btn.setAttribute('aria-label', accessibleName);
  btn.type = 'button';
  const iconSpan = document.createElement('span');
  iconSpan.className = 'ytee-icon';
  iconSpan.appendChild(ICON_DEFS[iconKey]());
  const labelSpan = document.createElement('span');
  labelSpan.className = 'ytee-label';
  labelSpan.textContent = labelText;
  btn.appendChild(iconSpan);
  btn.appendChild(labelSpan);
  return btn;
};
