export function focusElement(target, {
  revealMobilePanel = false,
  scroll = false,
} = {}) {
  if (!target) return false;

  if (revealMobilePanel) {
    const panel = target.closest("details.learner-mobile-panel");
    if (panel) panel.open = true;
  }
  if (scroll) {
    target.scrollIntoView({
      behavior: "auto",
      block: "center",
      inline: "nearest",
    });
  }
  target.focus({ preventScroll: true });
  return true;
}

export function scheduleFocus(selector, options = {}, {
  query = (value) => document.querySelector(value),
  schedule = (callback) => requestAnimationFrame(callback),
} = {}) {
  schedule(() => {
    focusElement(query(selector), options);
  });
}
