import { SYSTEM_TAB } from "./constants.js";
import { cacheKey, putCacheEntry } from "./cache.js";

export const TAB_SNAPSHOT_STORAGE_KEY = "dietYtTabSnap";
export const SNAPSHOT_MAX_VIDEOS = 80;

export function shouldPersistTabSnapshot(tabId) {
  return Boolean(tabId) && tabId !== SYSTEM_TAB.FEED;
}

function trimVideo(video) {
  if (!video || !video.videoId) return null;
  return {
    videoId: video.videoId,
    setVideoId: video.setVideoId,
    playlistId: video.playlistId,
    title: video.title,
    channelTitle: video.channelTitle,
    thumbUrl: video.thumbUrl,
    lengthText: video.lengthText,
    viewCountText: video.viewCountText,
    publishedText: video.publishedText,
    publishedMs: video.publishedMs,
  };
}

export function serializeTabSnapshot(tabId, videos, now = Date.now()) {
  const trimmed = (videos || []).map(trimVideo).filter(Boolean).slice(0, SNAPSHOT_MAX_VIDEOS);
  return { tabId, videos: trimmed, fetchedAt: now };
}

export function mergeTabSnapshot(store, tabId, videos, now = Date.now()) {
  const next = {
    version: 1,
    tabs: { ...(store?.tabs && typeof store.tabs === "object" ? store.tabs : {}) },
  };
  if (!shouldPersistTabSnapshot(tabId)) return next;
  next.tabs[tabId] = serializeTabSnapshot(tabId, videos, now);
  return next;
}

export function hydrateEntriesFromSnapshot(store) {
  if (!store?.tabs || typeof store.tabs !== "object") return [];
  const out = [];
  for (const [tabId, entry] of Object.entries(store.tabs)) {
    if (!shouldPersistTabSnapshot(tabId) || !entry) continue;
    out.push({
      key: cacheKey("tab", tabId),
      videos: Array.isArray(entry.videos) ? entry.videos : [],
      fetchedAt: Number(entry.fetchedAt) || 0,
    });
  }
  return out;
}

export function hydrateCacheFromSnapshot(cache, store, now = Date.now()) {
  let n = 0;
  for (const entry of hydrateEntriesFromSnapshot(store)) {
    putCacheEntry(cache, entry.key, entry.videos, entry.fetchedAt, now);
    n += 1;
  }
  return n;
}
