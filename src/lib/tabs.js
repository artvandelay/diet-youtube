import { SYSTEM_TAB, SYSTEM_TABS, SYSTEM_TAB_LABELS } from "./constants.js";
import { findCustomFeed, isSystemTabId } from "./prefs.js";

export function tabLabel(prefs, tabId) {
  if (SYSTEM_TAB_LABELS[tabId]) return SYSTEM_TAB_LABELS[tabId];
  const feed = findCustomFeed(prefs, tabId);
  return feed?.name || "Feed";
}

export function buildTabStrip(prefs) {
  const custom = (prefs.customTabOrder || [])
    .map((id) => findCustomFeed(prefs, id))
    .filter(Boolean)
    .map((feed) => ({ id: feed.id, type: "custom", label: feed.name }));
  return [...SYSTEM_TABS.map((t) => ({ ...t })), ...custom];
}

export function playlistIdForTab(prefs, tabId) {
  if (tabId === SYSTEM_TAB.WATCH_LATER) return "WL";
  const feed = findCustomFeed(prefs, tabId);
  if (!feed) return null;
  const playlists = (feed.sources || []).filter((s) => s.type === "playlist");
  if (playlists.length === 1 && feed.sources.length === 1) return playlists[0].id;
  return null;
}

export function isQueueTab(prefs, tabId) {
  if (tabId === SYSTEM_TAB.WATCH_LATER) return true;
  return playlistIdForTab(prefs, tabId) != null;
}

export function tabKind(tabId) {
  return isSystemTabId(tabId) ? "system" : "custom";
}

export { SYSTEM_TAB, SYSTEM_TABS };
