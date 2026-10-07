import { saveStoredSettings, ANNOT_LABEL_MAX, ANNOT_MARKS_MAX } from './settings.js';
import { formatClock, getVideoId, getVideoTitle, getVideoAuthor } from './video-util.js';
import { flashBtnState } from './buttons.js';
import { mkBtn } from './icons.js';

export const createBookmarks = ({ video, getPlayer, getSettings, scheduleHistoryRender, showControls }) => {
    const annotBtn = mkBtn('custom-annot-btn', 'annot', 'Notes', 'Notes for this video • right-click drops one');

    const seekTo = (sec) => {
      const p = getPlayer();
      try {
        if (p && typeof p.seekTo === 'function') { p.seekTo(sec, true); return; }
      } catch (e) { }
      try { video.currentTime = sec; } catch (e) { }
    };

    const annotVid = () => { try { return getVideoId(getPlayer()); } catch (e) { return ''; } };

    const getAnnot = (vid) => getSettings().annotationsCache[vid] || null;

    const ensureAnnot = (vid) => {
      const currentSettings = getSettings();
      let a = currentSettings.annotationsCache[vid];
      if (!a) {
        const p = getPlayer();
        a = { marks: [], title: getVideoTitle(p) || '', channel: getVideoAuthor(p) || '', t: Date.now() };
        currentSettings.annotationsCache[vid] = a;
      }
      return a;
    };

    const cleanupAnnot = (vid) => {
      const currentSettings = getSettings();
      const a = currentSettings.annotationsCache[vid];
      if (a && a.marks.length === 0) delete currentSettings.annotationsCache[vid];
    };

    const persistAnnot = (vid) => {
      const currentSettings = getSettings();
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

    return {
      annotBtn, ensureAnnot, persistAnnot, addBookmarkAtCurrent, closeAnnotPanel,
      isAnnotPanelOpen: () => annotPanelOpen,
      getAnnotPanel: () => annotPanel,
    };
};

