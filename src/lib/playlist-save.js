import { SYSTEM_TAB, WATCH_LATER_PLAYLIST_ID } from "./constants.js";

export function normalizePlaylistId(id) {
  const raw = String(id || "").trim();
  if (!raw) return "";
  return raw.startsWith("VL") ? raw.slice(2) : raw;
}

export function playlistDisplayName(id, label) {
  const pid = normalizePlaylistId(id);
  if (pid === WATCH_LATER_PLAYLIST_ID || pid === "WL") return "Watch later";
  if (pid === "LL") return "Liked videos";
  return String(label || "").trim() || "Playlist";
}

/** One-click "Save to Watch later" — not on the Watch later tab itself. */
export function canSaveToWatchLater(tabId) {
  return tabId !== SYSTEM_TAB.WATCH_LATER;
}

/** ⋮ is on every Diet card, including Watch later (save to other playlists). */
export function canOpenMoreMenu() {
  return true;
}

export function moreMenuItems(tabId) {
  const items = [];
  if (canSaveToWatchLater(tabId)) {
    items.push({ id: "save-wl", label: "Save to Watch later" });
  }
  items.push({ id: "save-playlist", label: "Save to playlist…" });
  return items;
}

export function interpretPlaylistAddStatus(json) {
  const status = String(json?.status || json?.actions?.[0]?.status || "");
  const blob = status;
  if (/DUPLICATE|ALREADY_EXISTS|ALREADY_IN|ALREADY_ADDED/i.test(blob)) {
    return { ok: true, alreadyIn: true, status: status || "STATUS_DUPLICATE" };
  }
  if (status && status !== "STATUS_SUCCEEDED" && status !== "STATUS_NOOP") {
    return { ok: false, alreadyIn: false, status };
  }
  return { ok: true, alreadyIn: Boolean(json?.alreadyIn), status: status || "STATUS_SUCCEEDED" };
}

function textOf(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value.simpleText) return value.simpleText;
  if (value.content) return value.content;
  if (Array.isArray(value.runs)) return value.runs.map((r) => r.text || "").join("");
  return "";
}

function walk(node, visit, seen) {
  if (!node || typeof node !== "object") return;
  if (!seen) seen = new Set();
  if (seen.has(node)) return;
  seen.add(node);
  visit(node);
  if (Array.isArray(node)) {
    for (const item of node) walk(item, visit, seen);
    return;
  }
  for (const key of Object.keys(node)) walk(node[key], visit, seen);
}

/** Walk Innertube get_add_to_playlist / library browse payloads. */
export function extractAddToPlaylistOptions(root) {
  const out = [];
  walk(root, (node) => {
    const option = node.playlistAddToOptionRenderer;
    if (option?.playlistId) {
      out.push({
        id: normalizePlaylistId(option.playlistId),
        label: playlistDisplayName(option.playlistId, textOf(option.title)),
        alreadyIn: option.containsSelectedVideos === "ALL",
      });
      return;
    }
    if (node.gridPlaylistRenderer?.playlistId) {
      const r = node.gridPlaylistRenderer;
      out.push({
        id: normalizePlaylistId(r.playlistId),
        label: playlistDisplayName(r.playlistId, textOf(r.title)),
        alreadyIn: false,
      });
      return;
    }
    if (node.playlistRenderer?.playlistId) {
      const r = node.playlistRenderer;
      out.push({
        id: normalizePlaylistId(r.playlistId),
        label: playlistDisplayName(r.playlistId, textOf(r.title)),
        alreadyIn: false,
      });
    }
  });
  return dedupePlaylists(out);
}

export function playlistSourcesFromPrefs(prefs) {
  const out = [];
  for (const feed of prefs?.customFeeds || []) {
    for (const source of feed.sources || []) {
      if (source.type === "playlist" && source.id) {
        out.push({
          id: normalizePlaylistId(source.id),
          label: source.label || feed.name || "Playlist",
          type: "playlist",
        });
      }
    }
  }
  return out;
}

export function mergeSaveTargets({ library = [], feedSources = [] } = {}) {
  const seen = new Set();
  const out = [];
  const push = (item, alreadyIn = false) => {
    const id = normalizePlaylistId(item?.id);
    if (!id || seen.has(id)) return;
    seen.add(id);
    out.push({
      id,
      label: playlistDisplayName(id, item.label),
      alreadyIn: Boolean(item.alreadyIn || alreadyIn),
    });
  };
  push({ id: WATCH_LATER_PLAYLIST_ID, label: "Watch later" });
  for (const source of feedSources) push(source);
  for (const item of library) push(item);
  return out;
}

export function saveToastMessage({ alreadyIn = false, playlistLabel = "playlist", count = 1 } = {}) {
  const name = playlistLabel || "playlist";
  if (alreadyIn) return `Already in ${name}`;
  if (count > 1) return `Saved ${count} to ${name}`;
  return `Saved to ${name}`;
}

function dedupePlaylists(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const id = normalizePlaylistId(item.id);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push({ ...item, id });
  }
  return out;
}
