import { saveStoredSettings, parseCache, parseAnnotationsCache, ANNOT_LABEL_MAX } from './settings.js';
import { formatClock, downloadUrlAsFile } from './video-util.js';
import { flashBtnState } from './buttons.js';

export const createHistoryTab = ({
  getSettings, getSettingsModal, isHistoryTabActive, tabContents,
  ensureAnnot, persistAnnot, mkSection, mkNote, mkActionBtn, syncGist,
  setHistoryTabDirty, getHistoryViewMode, setHistoryViewMode,
}) => {
    let historyRenderTimer = null;
    let historyRenderRaf = 0;
    const scheduleHistoryRender = () => {
      if (!getSettingsModal() || !getSettingsModal().classList.contains('show') || !isHistoryTabActive()) { setHistoryTabDirty(true); return; }
      clearTimeout(historyRenderTimer);
      historyRenderTimer = setTimeout(() => {
        try { renderHistoryTab(); setHistoryTabDirty(false); } catch (e) { }
      }, 500);
    };

    let historySortDescending = true;
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
      const currentSettings = getSettings();
      let historyViewMode = getHistoryViewMode();
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
          setHistoryViewMode(historyViewMode);
          currentSettings.historyViewMode = historyViewMode;
          saveStoredSettings(currentSettings);
          renderHistoryTab();
        });
        controls.append(favFilterBtn, syncBtn, refreshBtn, sortBtn, viewBtnS);
      } else {
        const viewBtnL = mkCtrlBtn(historyViewMode === 'list' ? '\u229E' : '\u2261', historyViewMode === 'list' ? 'Switch to grid view' : 'Switch to list view');
        viewBtnL.addEventListener('click', () => {
          historyViewMode = historyViewMode === 'list' ? 'grid' : 'list';
          setHistoryViewMode(historyViewMode);
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
        ...Object.keys(currentSettings.favoritesCache || {}).filter(vid => currentSettings.favoritesCache[vid]?.v),
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

        const downloadThumb = (btn) => {
          const thumbQualities = ['maxresdefault.jpg', 'hqdefault.jpg', 'mqdefault.jpg'];
          const tryThumb = (idx) => {
            if (idx >= thumbQualities.length) { flashBtnState(btn, 'error'); return; }
            const url = `https://img.youtube.com/vi/${vid}/${thumbQualities[idx]}`;
            GM_xmlhttpRequest({
              method: 'HEAD', url,
              onload: (r) => {
                if (r.status === 200) { downloadUrlAsFile(url, `${titleText}_thumbnail`); flashBtnState(btn, 'success'); }
                else { tryThumb(idx + 1); }
              },
              onerror: () => tryThumb(idx + 1)
            });
          };
          tryThumb(0);
        };

        const downloadPfp = (btn) => {
          const orig = btn.textContent;
          btn.textContent = '\u2026';
          const done = (ok) => { flashBtnState(btn, ok ? 'success' : 'error'); btn.textContent = orig; };
          const fallbackToYouTube = (vId) => {
            GM_xmlhttpRequest({
              method: 'GET', url: `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${vId}&format=json`,
              onload: (r) => {
                if (r.status !== 200) { done(false); return; }
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
                          done(true);
                        } else { done(false); }
                      } catch (e) { done(false); }
                    },
                    onerror: () => done(false)
                  });
                } catch (e) { done(false); }
              },
              onerror: () => done(false)
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
                    done(true);
                    return;
                  }
                } catch (e) { }
              }
              fallbackToYouTube(vid);
            },
            onerror: () => fallbackToYouTube(vid)
          });
        };

        const copyLink = (btn, withTimestamp) => {
          const baseUrl = `https://youtu.be/${vid}`;
          if (withTimestamp) {
            const posVal = posObj && typeof posObj === 'object' ? posObj.v : (posObj || 0);
            if (!posVal || posVal <= 0) {
              const origTitle = btn.title;
              btn.title = '\u26A0 No timestamp saved for this video';
              flashBtnState(btn, 'error');
              setTimeout(() => { btn.title = origTitle; }, 2500);
              return;
            }
            navigator.clipboard.writeText(`${baseUrl}?t=${Math.floor(posVal)}`)
              .then(() => flashBtnState(btn, 'success'))
              .catch(() => flashBtnState(btn, 'error'));
          } else {
            navigator.clipboard.writeText(baseUrl)
              .then(() => flashBtnState(btn, 'success'))
              .catch(() => flashBtnState(btn, 'error'));
          }
        };

        const deleteFromHistory = () => {
          delete currentSettings.volumeCache[vid];
          delete currentSettings.positionCache[vid];
          delete currentSettings.miniStatsCache[vid];
          if (currentSettings.favoritesCache[vid]?.v) {
            currentSettings.favoritesCache[vid] = {
              v: false, title: titleText, channel: channelText, t: Date.now()
            };
          }
          delete currentSettings.annotationsCache[vid];
          saveStoredSettings(currentSettings, { immediate: true });
          if (cardRef.el && cardRef.el.isConnected) cardRef.el.remove();
          else renderHistoryTab();
        };

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
            currentSettings.favoritesCache[vid] = {
              v: false, title: titleText, channel: channelText, t: Date.now()
            };
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

        const openHolodex = (btn) => { window.open(`https://holodex.net/multiview/AAYY${vid}`, '_blank'); flashBtnState(btn, 'success'); };

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
          ovThumb.addEventListener('click', (e) => { e.stopPropagation(); downloadThumb(ovThumb); });
          const ovPfp = mkOvBtn('\u{1F464}', 'Download PFP');
          ovPfp.addEventListener('click', (e) => { e.stopPropagation(); downloadPfp(ovPfp); });
          const ovLink = mkOvBtn('\uD83D\uDD17', 'Copy link \u2022 Ctrl+click for timestamp');
          ovLink.addEventListener('click', (e) => { e.stopPropagation(); copyLink(ovLink, e.ctrlKey); });
          const ovHolo = mkOvBtn('Holodex', 'Open in Holodex', '#7ddf7d');
          ovHolo.addEventListener('click', (e) => { e.stopPropagation(); openHolodex(ovHolo); });
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
          cardDel.addEventListener('click', deleteFromHistory);

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
          laThumb.addEventListener('click', () => downloadThumb(laThumb));
          const laPfp = mkListAction('\u2B07 PFP', 'Download PFP');
          laPfp.addEventListener('click', () => downloadPfp(laPfp));
          const laLink = mkListAction('\uD83D\uDD17', 'Copy link \u2022 Ctrl+click for timestamp');
          laLink.addEventListener('click', (e) => copyLink(laLink, e.ctrlKey));
          const laHolo = mkListAction('Holodex', 'Open in Holodex', '#7ddf7d');
          laHolo.addEventListener('click', () => openHolodex(laHolo));
          const laDel = mkListAction('Delete', 'Delete from history', 'rgba(255,80,80,0.7)');
          laDel.style.borderColor = 'rgba(255,80,80,0.2)';
          laDel.addEventListener('mouseenter', () => { laDel.style.background = 'rgba(255,50,50,0.15)'; laDel.style.color = '#ff5555'; });
          laDel.addEventListener('mouseleave', () => { laDel.style.background = 'rgba(255,255,255,0.07)'; laDel.style.color = 'rgba(255,80,80,0.7)'; });
          laDel.addEventListener('click', deleteFromHistory);
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

    const disposeHistoryTab = () => {
      clearTimeout(historyRenderTimer);
      if (historyRenderRaf) { cancelAnimationFrame(historyRenderRaf); historyRenderRaf = 0; }
    };

    return { renderHistoryTab, scheduleHistoryRender, disposeHistoryTab };
};
