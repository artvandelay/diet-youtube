/**
 * Playlist / feed cache with tombstones.
 *
 * After Watch Later (or any playlist) remove, cards must not ghost back in from a
 * stale cache or a racy re-fetch. Tombstones filter videoId + setVideoId.
 * An all-tombstoned cache is a valid empty list — never return the pre-remove array.
 */

export function createVideoCache() {
  return {
    byKey: new Map(),
    tombstones: new Map(),
  };
}

export function cacheKey(kind, id) {
  return `${kind}:${id || ""}`;
}

export function tombstoneKeyForVideo(playlistId, videoId) {
  return `vid:${playlistId || "WL"}:${videoId}`;
}

export function tombstoneKeyForSet(setVideoId) {
  return `set:${setVideoId}`;
}

const DEFAULT_TOMBSTONE_TTL_MS = 10 * 60 * 1000;

export function pruneTombstones(tombstones, now = Date.now()) {
  for (const [key, expires] of tombstones) {
    if (expires <= now) tombstones.delete(key);
  }
}

export function isTombstoned(video, tombstones, now = Date.now()) {
  if (!video) return true;
  const vidKey = tombstoneKeyForVideo(video.playlistId || "WL", video.videoId);
  const vidExp = tombstones.get(vidKey);
  if (vidExp && vidExp > now) return true;
  if (video.setVideoId) {
    const setExp = tombstones.get(tombstoneKeyForSet(video.setVideoId));
    if (setExp && setExp > now) return true;
  }
  return false;
}

/**
 * Filter a cached (or freshly fetched) list through active tombstones.
 * Empty input or fully-removed input → [] (never stale leftovers).
 */
export function applyTombstones(videos, tombstones, now = Date.now()) {
  if (!Array.isArray(videos) || videos.length === 0) return [];
  return videos.filter((video) => !isTombstoned(video, tombstones, now));
}

/**
 * Pure helper for tests / callers that pass removed id sets instead of a cache.
 */
export function filterCachedVideos(videos, removed = {}) {
  if (!Array.isArray(videos) || videos.length === 0) return [];
  const videoIds = new Set(removed.videoIds || removed.removedIds || []);
  const setVideoIds = new Set(removed.setVideoIds || removed.removedSetVideoIds || []);
  return videos.filter((video) => {
    if (!video || !video.videoId) return false;
    if (videoIds.has(video.videoId)) return false;
    if (video.setVideoId && setVideoIds.has(video.setVideoId)) return false;
    return true;
  });
}

export function tombstoneRemoved(
  cache,
  { playlistId = "WL", videoId, setVideoId, ttlMs = DEFAULT_TOMBSTONE_TTL_MS } = {},
  now = Date.now()
) {
  const expires = now + ttlMs;
  if (videoId) cache.tombstones.set(tombstoneKeyForVideo(playlistId, videoId), expires);
  if (setVideoId) cache.tombstones.set(tombstoneKeyForSet(setVideoId), expires);
  for (const entry of cache.byKey.values()) {
    entry.videos = applyTombstones(entry.videos, cache.tombstones, now);
  }
}

export function tombstoneRemovedMany(cache, items, playlistId = "WL", now = Date.now()) {
  for (const item of items || []) {
    tombstoneRemoved(
      cache,
      {
        playlistId: item.playlistId || playlistId,
        videoId: item.videoId,
        setVideoId: item.setVideoId,
      },
      now
    );
  }
}

export function clearTombstonesFor(cache, { playlistId = "WL", videoId, setVideoId } = {}) {
  if (videoId) cache.tombstones.delete(tombstoneKeyForVideo(playlistId, videoId));
  if (setVideoId) cache.tombstones.delete(tombstoneKeyForSet(setVideoId));
}

/** Skip a background refetch if the in-memory entry is this fresh. */
export const CACHE_FRESH_MS = 8_000;
/** Still paint cached rows; refresh in the background. */
export const CACHE_SOFT_STALE_MS = 5 * 60 * 1000;

export function putCache(cache, key, videos, now = Date.now()) {
  return putCacheEntry(cache, key, videos, now, now);
}

export function putCacheEntry(cache, key, videos, fetchedAt, now = Date.now()) {
  pruneTombstones(cache.tombstones, now);
  const filtered = applyTombstones(videos, cache.tombstones, now);
  cache.byKey.set(key, { videos: filtered, fetchedAt: fetchedAt || now });
  return filtered;
}

export function getCache(cache, key, now = Date.now()) {
  const entry = cache.byKey.get(key);
  if (!entry) return null;
  pruneTombstones(cache.tombstones, now);
  const filtered = applyTombstones(entry.videos, cache.tombstones, now);
  entry.videos = filtered;
  return filtered;
}

export function inspectCache(cache, key, now = Date.now()) {
  const entry = cache.byKey.get(key);
  if (!entry) return { hit: false, videos: null, age: Infinity, fresh: false, stale: true };
  const videos = getCache(cache, key, now);
  const age = now - (entry.fetchedAt || 0);
  return {
    hit: true,
    videos,
    age,
    fresh: age >= 0 && age < CACHE_FRESH_MS,
    stale: age >= CACHE_SOFT_STALE_MS,
  };
}

export function emptyAfterTombstones(videos, tombstones, now = Date.now()) {
  return applyTombstones(videos, tombstones, now).length === 0;
}
