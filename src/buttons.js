export const setBtnLabel = (btn, text, tipText) => {
  const label = btn.querySelector('.ytee-label');
  if (label) label.textContent = (text !== undefined && text !== null) ? text : btn.dataset.defaultLabel;
  btn.dataset.tip = (tipText !== undefined && tipText !== null) ? tipText : btn.dataset.defaultTip;
};

export const flashBtnState = (btn, state, duration = 1500) => {
  btn.classList.add(state);
  setTimeout(() => btn.classList.remove(state), duration);
};

export const flashBtnResult = (btn, label, state, holdMs = 1500) => {
  setBtnLabel(btn, label);
  if (state) flashBtnState(btn, state, holdMs);
  setTimeout(() => setBtnLabel(btn), holdMs);
};
