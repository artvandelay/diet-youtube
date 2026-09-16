import { DEFAULT_VIEW, SYSTEM_TAB } from "./constants.js";
import { normalizeIconsDensity } from "./view.js";

export const DEFAULT_PREFS = Object.freeze({
  version: 1,
  defaultHome: SYSTEM_TAB.WATCH_LATER,
  customFeeds: [],
  customTabOrder: [],
  viewByTab: Object.freeze({
    [SYSTEM_TAB.FEED]: { ...DEFAULT_VIEW },
    [SYSTEM_TAB.WATCH_LATER]: { ...DEFAULT_VIEW },
    [SYSTEM_TAB.SUBSCRIPTIONS]: { ...DEFAULT_VIEW },
  }),
});

function cloneView(view) {
  return {
    layout: view?.layout || DEFAULT_VIEW.layout,
    sort: view?.sort || DEFAULT_VIEW.sort,
    postedWithin: view?.postedWithin || DEFAULT_VIEW.postedWithin,
    density: normalizeIconsDensity(view?.density || DEFAULT_VIEW.density),
  };
}

export function migratePrefs(raw) {
  const base = {
    version: 1,
    defaultHome: SYSTEM_TAB.WATCH_LATER,
    customFeeds: [],
    customTabOrder: [],
    viewByTab: {},
  };
  if (!raw || typeof raw !== "object") {
    return {
      ...base,
      viewByTab: {
        [SYSTEM_TAB.FEED]: cloneView(DEFAULT_VIEW),
        [SYSTEM_TAB.WATCH_LATER]: cloneView(DEFAULT_VIEW),
        [SYSTEM_TAB.SUBSCRIPTIONS]: cloneView(DEFAULT_VIEW),
      },
    };
  }

  const customFeeds = Array.isArray(raw.customFeeds)
    ? raw.customFeeds
        .filter((f) => f && f.id && f.name)
        .map((f) => ({
          id: String(f.id),
          name: String(f.name),
          sources: Array.isArray(f.sources)
            ? f.sources
                .filter((s) => s && s.id && (s.type === "channel" || s.type === "playlist"))
                .map((s) => ({
                  type: s.type,
                  id: String(s.id),
                  label: String(s.label || s.id),
                }))
            : [],
        }))
    : [];

  const knownIds = new Set([
    SYSTEM_TAB.FEED,
    SYSTEM_TAB.WATCH_LATER,
    SYSTEM_TAB.SUBSCRIPTIONS,
    ...customFeeds.map((f) => f.id),
  ]);

  const customTabOrder = (Array.isArray(raw.customTabOrder) ? raw.customTabOrder : customFeeds.map((f) => f.id))
    .map(String)
    .filter((id) => knownIds.has(id) && !isSystemTabId(id));

  for (const feed of customFeeds) {
    if (!customTabOrder.includes(feed.id)) customTabOrder.push(feed.id);
  }

  const viewByTab = {};
  const incoming = raw.viewByTab && typeof raw.viewByTab === "object" ? raw.viewByTab : {};
  for (const id of knownIds) {
    viewByTab[id] = cloneView(incoming[id] || DEFAULT_VIEW);
  }

  let defaultHome = raw.defaultHome || SYSTEM_TAB.WATCH_LATER;
  if (defaultHome === SYSTEM_TAB.FEED || !knownIds.has(defaultHome)) {
    defaultHome = SYSTEM_TAB.WATCH_LATER;
  }

  return {
    version: 1,
    defaultHome,
    customFeeds,
    customTabOrder,
    viewByTab,
  };
}

export function isSystemTabId(id) {
  return id === SYSTEM_TAB.FEED || id === SYSTEM_TAB.WATCH_LATER || id === SYSTEM_TAB.SUBSCRIPTIONS;
}

export function getViewForTab(prefs, tabId) {
  return cloneView(prefs?.viewByTab?.[tabId] || DEFAULT_VIEW);
}

export function setViewForTab(prefs, tabId, view) {
  return {
    ...prefs,
    viewByTab: {
      ...prefs.viewByTab,
      [tabId]: cloneView(view),
    },
  };
}

export function findCustomFeed(prefs, feedId) {
  return (prefs.customFeeds || []).find((f) => f.id === feedId) || null;
}

export function upsertCustomFeed(prefs, feed) {
  const customFeeds = (prefs.customFeeds || []).slice();
  const idx = customFeeds.findIndex((f) => f.id === feed.id);
  if (idx >= 0) customFeeds[idx] = feed;
  else customFeeds.push(feed);
  const customTabOrder = (prefs.customTabOrder || []).slice();
  if (!customTabOrder.includes(feed.id)) customTabOrder.push(feed.id);
  const viewByTab = { ...prefs.viewByTab };
  if (!viewByTab[feed.id]) viewByTab[feed.id] = cloneView(DEFAULT_VIEW);
  return { ...prefs, customFeeds, customTabOrder, viewByTab };
}

export function removeCustomFeed(prefs, feedId) {
  const customFeeds = (prefs.customFeeds || []).filter((f) => f.id === feedId ? false : true);
  const customTabOrder = (prefs.customTabOrder || []).filter((id) => id !== feedId);
  const viewByTab = { ...prefs.viewByTab };
  delete viewByTab[feedId];
  let defaultHome = prefs.defaultHome;
  if (defaultHome === feedId) defaultHome = SYSTEM_TAB.WATCH_LATER;
  return { ...prefs, customFeeds, customTabOrder, viewByTab, defaultHome };
}

export function reorderCustomTabs(prefs, orderedIds) {
  const allowed = new Set((prefs.customFeeds || []).map((f) => f.id));
  const customTabOrder = orderedIds.filter((id) => allowed.has(id));
  for (const id of allowed) {
    if (!customTabOrder.includes(id)) customTabOrder.push(id);
  }
  return { ...prefs, customTabOrder };
}

export function newFeedId() {
  return `cf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function loadPrefs() {
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    const got = await chrome.storage.local.get("prefs");
    return migratePrefs(got.prefs);
  }
  return migratePrefs(null);
}

export async function savePrefs(prefs) {
  const next = migratePrefs(prefs);
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    await chrome.storage.local.set({ prefs: next });
  }
  return next;
}
