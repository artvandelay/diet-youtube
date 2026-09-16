import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CACHE_FRESH_MS,
  createVideoCache,
  inspectCache,
  putCache,
  putCacheEntry,
} from "../src/lib/cache.js";
import { planTabLoad, warmTabIds } from "../src/lib/tab-load.js";
import {
  hydrateCacheFromSnapshot,
  hydrateEntriesFromSnapshot,
  mergeTabSnapshot,
  serializeTabSnapshot,
  shouldPersistTabSnapshot,
} from "../src/lib/snapshot.js";
import { SYSTEM_TAB } from "../src/lib/constants.js";

describe("tab load: cache-first paint", () => {
  it("cache hit paints immediately and skips the blank spinner", () => {
    const plan = planTabLoad({ hit: true, fresh: false, force: false });
    assert.equal(plan.paintCached, true);
    assert.equal(plan.showSpinner, false);
    assert.equal(plan.refresh, true);
  });

  it("fresh cache hit paints and does not refetch", () => {
    const plan = planTabLoad({ hit: true, fresh: true, force: false });
    assert.equal(plan.paintCached, true);
    assert.equal(plan.showSpinner, false);
    assert.equal(plan.refresh, false);
  });

  it("cache miss shows a spinner and refreshes", () => {
    const plan = planTabLoad({ hit: false, fresh: false, force: false });
    assert.equal(plan.paintCached, false);
    assert.equal(plan.showSpinner, true);
    assert.equal(plan.refresh, true);
  });

  it("force refresh still paints cache when present (no blank)", () => {
    const plan = planTabLoad({ hit: true, fresh: false, force: true });
    assert.equal(plan.paintCached, true);
    assert.equal(plan.showSpinner, false);
    assert.equal(plan.refresh, true);
  });

  it("inspectCache reports a hit after putCache", () => {
    const cache = createVideoCache();
    const now = 1_000_000;
    putCache(cache, "tab:watch-later", [{ videoId: "a", playlistId: "WL" }], now);
    const fresh = inspectCache(cache, "tab:watch-later", now + 100);
    assert.equal(fresh.hit, true);
    assert.equal(fresh.fresh, true);
    assert.equal(fresh.videos[0].videoId, "a");

    const stale = inspectCache(cache, "tab:watch-later", now + CACHE_FRESH_MS + 1);
    assert.equal(stale.hit, true);
    assert.equal(stale.fresh, false);
    assert.equal(planTabLoad(stale).showSpinner, false);
    assert.equal(planTabLoad(stale).refresh, true);

    assert.equal(inspectCache(cache, "tab:missing").hit, false);
  });
});

describe("tab load: warm prefetch ids", () => {
  it("warms Watch later, Subscriptions, and custom tabs — never Feed", () => {
    const ids = warmTabIds({
      currentTabId: SYSTEM_TAB.FEED,
      customFeedIds: ["cf_late", "cf_news"],
    });
    assert.deepEqual(ids, [
      SYSTEM_TAB.WATCH_LATER,
      SYSTEM_TAB.SUBSCRIPTIONS,
      "cf_late",
      "cf_news",
    ]);
    assert.ok(!ids.includes(SYSTEM_TAB.FEED));
  });
});

describe("tab snapshot persist", () => {
  it("skips Feed and hydrates last-good WL into the memory cache", () => {
    assert.equal(shouldPersistTabSnapshot(SYSTEM_TAB.FEED), false);
    assert.equal(shouldPersistTabSnapshot(SYSTEM_TAB.WATCH_LATER), true);

    const snap = serializeTabSnapshot(SYSTEM_TAB.WATCH_LATER, [
      { videoId: "v1", title: "One", playlistId: "WL" },
    ], 50);
    const store = mergeTabSnapshot(null, SYSTEM_TAB.WATCH_LATER, snap.videos, 50);
    assert.equal(hydrateEntriesFromSnapshot(store).length, 1);

    const cache = createVideoCache();
    hydrateCacheFromSnapshot(cache, store, 50);
    const info = inspectCache(cache, "tab:watch-later", 50);
    assert.equal(info.hit, true);
    assert.equal(info.videos[0].videoId, "v1");
    putCacheEntry(cache, "tab:watch-later", info.videos, 50, 50);
  });
});
