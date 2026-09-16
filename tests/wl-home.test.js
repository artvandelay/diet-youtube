import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  NAV_EVENT,
  SYSTEM_TAB,
  resolveNavigation,
  resolveWatchLaterLanding,
  getDietHomeTabId,
} from "../src/lib/nav-policy.js";

describe("WL diet home always queue", () => {
  const events = [NAV_EVENT.COLD, NAV_EVENT.YT_HOME, NAV_EVENT.WATCH_TO_HOME];

  it("empty queue still opens Watch later — never Subscriptions", () => {
    const landing = resolveWatchLaterLanding({
      defaultHome: SYSTEM_TAB.WATCH_LATER,
      queueCount: 0,
    });
    assert.equal(landing, SYSTEM_TAB.WATCH_LATER);

    for (const event of events) {
      const out = resolveNavigation(event, {
        prefs: { defaultHome: SYSTEM_TAB.WATCH_LATER, queueCount: 0 },
      });
      assert.equal(out.tabId, SYSTEM_TAB.WATCH_LATER);
      assert.notEqual(out.tabId, SYSTEM_TAB.SUBSCRIPTIONS);
      assert.notEqual(out.tabId, SYSTEM_TAB.FEED);
    }
  });

  it("unknown queue count still opens Watch later — never Subscriptions", () => {
    for (const queueCount of [undefined, null, NaN]) {
      const landing = resolveWatchLaterLanding({
        defaultHome: SYSTEM_TAB.WATCH_LATER,
        queueCount,
      });
      assert.equal(landing, SYSTEM_TAB.WATCH_LATER);
    }
  });

  it("hard refresh / new tab (cold) with empty prefs is Watch later", () => {
    const out = resolveNavigation(NAV_EVENT.COLD, { prefs: {} });
    assert.equal(out.tabId, SYSTEM_TAB.WATCH_LATER);
    assert.equal(getDietHomeTabId({}), SYSTEM_TAB.WATCH_LATER);
  });

  it("logo after an empty-queue session does not bounce to Subs", () => {
    const session = { tabId: SYSTEM_TAB.WATCH_LATER, feedSticky: false };
    const out = resolveNavigation(NAV_EVENT.YT_HOME, {
      prefs: { defaultHome: SYSTEM_TAB.WATCH_LATER, queueCount: 0 },
      session,
    });
    assert.equal(out.tabId, SYSTEM_TAB.WATCH_LATER);
  });

  it("watch→home after watching a video returns to the queue, not Feed", () => {
    const out = resolveNavigation(NAV_EVENT.WATCH_TO_HOME, {
      prefs: { defaultHome: SYSTEM_TAB.WATCH_LATER },
      session: { tabId: SYSTEM_TAB.FEED, feedSticky: true },
    });
    assert.equal(out.tabId, SYSTEM_TAB.WATCH_LATER);
    assert.equal(out.feedSticky, false);
  });
});
