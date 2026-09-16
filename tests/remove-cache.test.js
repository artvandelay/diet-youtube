import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyTombstones,
  createVideoCache,
  filterCachedVideos,
  getCache,
  putCache,
  tombstoneRemoved,
  tombstoneRemovedMany,
} from "../src/lib/cache.js";

function vid(id, setVideoId) {
  return {
    videoId: id,
    setVideoId: setVideoId || `set-${id}`,
    playlistId: "WL",
    title: id,
    channelTitle: "Ch",
  };
}

describe("remove cache filter", () => {
  it("drops removed videoIds and setVideoIds", () => {
    const videos = [vid("a"), vid("b"), vid("c")];
    const next = filterCachedVideos(videos, {
      videoIds: ["b"],
      setVideoIds: ["set-c"],
    });
    assert.deepEqual(
      next.map((v) => v.videoId),
      ["a"]
    );
  });

  it("tombstone empty cache returns [] — never stale leftovers", () => {
    const videos = [vid("only")];
    const next = filterCachedVideos(videos, { videoIds: ["only"] });
    assert.deepEqual(next, []);
    assert.equal(filterCachedVideos([], { videoIds: ["only"] }).length, 0);
    assert.equal(filterCachedVideos(null, { videoIds: ["only"] }).length, 0);
  });

  it("putCache / getCache apply tombstones so ghosts cannot reappear", () => {
    const cache = createVideoCache();
    putCache(cache, "playlist:WL", [vid("keep"), vid("gone")]);
    tombstoneRemoved(cache, { playlistId: "WL", videoId: "gone", setVideoId: "set-gone" });

    const fromCache = getCache(cache, "playlist:WL");
    assert.deepEqual(
      fromCache.map((v) => v.videoId),
      ["keep"]
    );

    const racyRefetch = putCache(cache, "playlist:WL", [vid("keep"), vid("gone"), vid("also-gone", "set-also")]);
    tombstoneRemoved(cache, { playlistId: "WL", videoId: "also-gone", setVideoId: "set-also" });
    const afterRace = getCache(cache, "playlist:WL");
    assert.ok(!racyRefetch.some((v) => v.videoId === "gone"));
    assert.deepEqual(
      afterRace.map((v) => v.videoId),
      ["keep"]
    );
  });

  it("bulk tombestones empty the queue without leaving a ghost card", () => {
    const cache = createVideoCache();
    const items = [vid("1"), vid("2"), vid("3")];
    putCache(cache, "playlist:WL", items);
    tombstoneRemovedMany(cache, items, "WL");
    assert.deepEqual(getCache(cache, "playlist:WL"), []);
    assert.equal(applyTombstones(items, cache.tombstones).length, 0);
  });

  it("filters by setVideoId even when videoId would collide", () => {
    const videos = [
      { videoId: "same", setVideoId: "s1", playlistId: "WL" },
      { videoId: "same", setVideoId: "s2", playlistId: "WL" },
    ];
    const next = filterCachedVideos(videos, { setVideoIds: ["s1"] });
    assert.equal(next.length, 1);
    assert.equal(next[0].setVideoId, "s2");
  });
});
