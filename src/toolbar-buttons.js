import { mkBtn } from './icons.js';
import { setBtnLabel, flashBtnState, flashBtnResult } from './buttons.js';
import { getVideoId } from './video-util.js';

export const createPipButton = ({ video }) => {
    const pipSupported = document.pictureInPictureEnabled && typeof video.requestPictureInPicture === "function";
    const pipBtn = mkBtn('custom-pip-btn', 'pip', 'PiP', 'Picture-in-Picture');
    if (pipSupported) {
      pipBtn.addEventListener("click", async () => {
        try {
          if (document.pictureInPictureElement) await document.exitPictureInPicture();
          else await video.requestPictureInPicture();
        } catch (err) { console.error("PiP failed:", err); }
      });
    } else {
      pipBtn.style.display = "none";
    }
    return { pipBtn, pipSupported };
};

export const createUrlButton = ({ video, getPlayer }) => {
    const urlBtn = mkBtn('custom-url-btn', 'url', 'URL', 'Copy URL (Ctrl+Click = with timestamp) • Middle-Click = Open in YouTube');
    urlBtn.addEventListener("auxclick", (e) => {
      if (e.button === 1) {
        e.preventDefault();
        const videoId = getVideoId(getPlayer());
        if (videoId) {
          let url = `https://youtu.be/${videoId}`;
          if (e.ctrlKey) url += `?t=${Math.floor(video.currentTime)}`;
          window.open(url, '_blank');
        }
      }
    });
    urlBtn.addEventListener("click", async (e) => {
      try {
        const videoId = getVideoId(getPlayer());
        let url = `https://youtu.be/${videoId}`;
        if (e.ctrlKey) url += `?t=${Math.floor(video.currentTime)}`;
        let copied = false;
        if (navigator.clipboard) {
          try { await navigator.clipboard.writeText(url); copied = true; } catch (clipErr) { }
        }
        if (!copied) {
          const ta = document.createElement('textarea');
          ta.value = url;
          ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0;';
          document.body.appendChild(ta);
          ta.focus(); ta.select();
          copied = document.execCommand('copy');
          document.body.removeChild(ta);
        }
        if (copied) {
          flashBtnResult(urlBtn, '✓ Copied!', 'success');
        } else { throw new Error('All copy methods failed'); }
      } catch (err) {
        console.error("Copy URL failed:", err);
        flashBtnState(urlBtn, 'error');
      }
    });
    return { urlBtn };
};

export const SPEED_STEP = 0.1, SPEED_STEP_FINE = 0.01, SPEED_DEFAULT = 1;

export const createSpeedControl = ({ video, showSpeedOverlay, setHoveringSpeedBtn }) => {
    const SPEED_MIN = 0.1, SPEED_MAX = 16;
    let targetSpeed = Math.round((video.playbackRate || SPEED_DEFAULT) * 100) / 100;
    const speedBtn = mkBtn('custom-speed-btn', 'speed', targetSpeed + 'x', 'Speed', 'Playback Speed');

    const updateSpeedBtnText = (rate) => { setBtnLabel(speedBtn, rate + 'x', `Speed: ${rate}x`); };

    const applySpeed = (rate) => {
      targetSpeed = Math.round(Math.min(SPEED_MAX, Math.max(SPEED_MIN, rate)) * 100) / 100;
      if (video.playbackRate !== targetSpeed) video.playbackRate = targetSpeed;
      updateSpeedBtnText(targetSpeed);
      speedBtn.classList.toggle("modified", targetSpeed !== 1);
      showSpeedOverlay(targetSpeed);
      const speedInput = document.getElementById('ytee-precise-speed');
      if (speedInput && parseFloat(speedInput.value) !== targetSpeed) speedInput.value = targetSpeed;
    };

    speedBtn.addEventListener("click", (e) => {
      const step = e.shiftKey ? SPEED_STEP_FINE : SPEED_STEP;
      const next = targetSpeed + step;
      applySpeed(next > SPEED_MAX ? SPEED_MIN : next);
    });
    speedBtn.addEventListener("contextmenu", (e) => { e.preventDefault(); applySpeed(SPEED_DEFAULT); });
    speedBtn.addEventListener("mouseenter", () => { setHoveringSpeedBtn(true); });
    speedBtn.addEventListener("mouseleave", () => { setHoveringSpeedBtn(false); });

    return { speedBtn, applySpeed, getTargetSpeed: () => targetSpeed };
};
