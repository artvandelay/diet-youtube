import { SYSTEM_TAB } from "./constants.js";

/**
 * Cache-first tab load. A hit paints immediately and never blanks the surface.
 * Fresh hits skip Innertube. Soft-stale and misses refresh in the background.
 */
export function planTabLoad({ hit = false, fresh = false, force = false } = {}) {
  if (force) {
    return { paintCached: Boolean(hit), showSpinner: !hit, refresh: true };
  }
  if (hit) {
    return { paintCached: true, showSpinner: false, refresh: !fresh };
  }
  return { paintCached: false, showSpinner: true, refresh: true };
}

/** Watch later, Subscriptions, current custom tab, then other custom feeds. Never Feed. */
export function warmTabIds({ currentTabId, customFeedIds } = {}) {
  const ids = [];
  const add = (id) => {
    if (!id || id === SYSTEM_TAB.FEED || ids.includes(id)) return;
    ids.push(id);
  };
  add(SYSTEM_TAB.WATCH_LATER);
  add(SYSTEM_TAB.SUBSCRIPTIONS);
  add(currentTabId);
  for (const id of customFeedIds || []) add(id);
  return ids;
}

export const PREFETCH_GAP_MS = 450;
