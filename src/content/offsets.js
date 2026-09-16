/** Measure YouTube masthead + guide so the first Diet-Youtube row is never clipped. */

function parsePx(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

export function readYoutubeOffsets() {
  const css = getComputedStyle(document.documentElement);
  const cssMasthead = parsePx(css.getPropertyValue("--ytd-masthead-height")) || 56;
  const cssMini = parsePx(css.getPropertyValue("--ytd-mini-guide-width")) || 72;

  const masthead = document.querySelector("#masthead-container, ytd-masthead");
  let top = cssMasthead;
  if (masthead) {
    const rect = masthead.getBoundingClientRect();
    if (rect.height > 0) top = Math.round(rect.bottom);
  }
  top = Math.max(top, 56);

  let left = cssMini;
  const narrow = window.innerWidth < 792;
  if (narrow) {
    left = 0;
  } else {
    const app = document.querySelector("ytd-app");
    const guidePersistent = app?.hasAttribute("guide-persistent-and-visible");
    const guide = document.querySelector("#guide");
    if (guidePersistent && guide) {
      const rect = guide.getBoundingClientRect();
      if (rect.width > 40) left = Math.round(rect.right);
    } else {
      const mini = document.querySelector("ytd-mini-guide-renderer");
      if (mini) {
        const rect = mini.getBoundingClientRect();
        if (rect.width > 0) left = Math.round(rect.right);
      }
    }
  }

  return { top, left };
}

export function applyOffsets(root, offsets) {
  if (!root) return;
  const { top, left } = offsets || readYoutubeOffsets();
  root.style.setProperty("--diet-offset-top", `${top}px`);
  root.style.setProperty("--diet-offset-left", `${left}px`);
}

export function watchOffsets(root, onChange) {
  const update = () => {
    const next = readYoutubeOffsets();
    applyOffsets(root, next);
    onChange?.(next);
  };
  update();
  const ro = new ResizeObserver(update);
  const masthead = document.querySelector("#masthead-container, ytd-masthead");
  const guide = document.querySelector("#guide, ytd-mini-guide-renderer");
  if (masthead) ro.observe(masthead);
  if (guide) ro.observe(guide);
  window.addEventListener("resize", update);
  document.addEventListener("yt-guide-toggle", update, true);
  document.addEventListener("yt-navigate-finish", update, true);
  requestAnimationFrame(update);
  setTimeout(update, 0);
  setTimeout(update, 120);
  setTimeout(update, 400);
  return () => {
    ro.disconnect();
    window.removeEventListener("resize", update);
  };
}
