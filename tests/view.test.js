import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ICONS_DENSITY, SORT, SYSTEM_TAB } from "../src/lib/constants.js";
import {
  applySessionViewPatch,
  applyView,
  iconsMinmaxPx,
  normalizeIconsDensity,
  resolveSessionView,
  viewsEqual,
} from "../src/lib/view.js";
import { getViewForTab, migratePrefs, setViewForTab } from "../src/lib/prefs.js";

describe("icons density prefs", () => {
  it("maps Comfortable / Default / Dense to minmax widths", () => {
    assert.equal(iconsMinmaxPx(ICONS_DENSITY.COMFORTABLE), 280);
    assert.equal(iconsMinmaxPx(ICONS_DENSITY.DEFAULT), 210);
    assert.equal(iconsMinmaxPx(ICONS_DENSITY.DENSE), 160);
    assert.equal(normalizeIconsDensity("nope"), ICONS_DENSITY.DEFAULT);
  });

  it("migrates old view prefs without density to Default", () => {
    const prefs = migratePrefs({
      viewByTab: {
        [SYSTEM_TAB.WATCH_LATER]: { layout: "icons", sort: "newest", postedWithin: "any" },
      },
    });
    const view = getViewForTab(prefs, SYSTEM_TAB.WATCH_LATER);
    assert.equal(view.density, ICONS_DENSITY.DEFAULT);
  });

  it("saves density per feed with view prefs", () => {
    const prefs = migratePrefs(null);
    const next = setViewForTab(prefs, SYSTEM_TAB.WATCH_LATER, {
      ...getViewForTab(prefs, SYSTEM_TAB.WATCH_LATER),
      density: ICONS_DENSITY.DENSE,
    });
    assert.equal(getViewForTab(next, SYSTEM_TAB.WATCH_LATER).density, ICONS_DENSITY.DENSE);
    assert.equal(getViewForTab(next, SYSTEM_TAB.FEED).density, ICONS_DENSITY.DEFAULT);
    assert.equal(
      viewsEqual(getViewForTab(next, SYSTEM_TAB.WATCH_LATER), getViewForTab(prefs, SYSTEM_TAB.WATCH_LATER)),
      false
    );
  });
});

describe("session view vs Save as default", () => {
  it("applying sort/posted immediately re-filters without writing prefs", () => {
    const prefs = migratePrefs(null);
    const saved = getViewForTab(prefs, SYSTEM_TAB.WATCH_LATER);
    const videos = [
      { videoId: "old", publishedMs: 1, channelTitle: "A" },
      { videoId: "new", publishedMs: 9, channelTitle: "B" },
    ];
    assert.equal(applyView(videos, saved)[0].videoId, "new");

    const session = applySessionViewPatch(saved, { sort: SORT.OLDEST });
    assert.equal(session.sort, SORT.OLDEST);
    assert.equal(applyView(videos, session)[0].videoId, "old");
    assert.equal(getViewForTab(prefs, SYSTEM_TAB.WATCH_LATER).sort, SORT.NEWEST);
    assert.equal(viewsEqual(session, saved), false);
  });

  it("only setViewForTab persists the session overlay", () => {
    const prefs = migratePrefs(null);
    const saved = getViewForTab(prefs, SYSTEM_TAB.WATCH_LATER);
    const session = applySessionViewPatch(saved, { sort: SORT.CHANNEL, postedWithin: "7d" });
    assert.equal(getViewForTab(prefs, SYSTEM_TAB.WATCH_LATER).sort, SORT.NEWEST);

    const persisted = setViewForTab(prefs, SYSTEM_TAB.WATCH_LATER, session);
    assert.equal(getViewForTab(persisted, SYSTEM_TAB.WATCH_LATER).sort, SORT.CHANNEL);
    assert.equal(getViewForTab(persisted, SYSTEM_TAB.WATCH_LATER).postedWithin, "7d");
  });

  it("session overlay survives switching tabs; COLD falls back to saved", () => {
    const map = new Map();
    const savedWL = getViewForTab(migratePrefs(null), SYSTEM_TAB.WATCH_LATER);
    const savedFeed = getViewForTab(migratePrefs(null), SYSTEM_TAB.FEED);
    map.set(SYSTEM_TAB.WATCH_LATER, applySessionViewPatch(savedWL, { sort: SORT.OLDEST }));

    assert.equal(resolveSessionView(savedWL, map.get(SYSTEM_TAB.WATCH_LATER)).sort, SORT.OLDEST);
    assert.equal(resolveSessionView(savedFeed, map.get(SYSTEM_TAB.FEED)).sort, SORT.NEWEST);

    map.clear();
    assert.equal(resolveSessionView(savedWL, map.get(SYSTEM_TAB.WATCH_LATER)).sort, SORT.NEWEST);
  });
});
