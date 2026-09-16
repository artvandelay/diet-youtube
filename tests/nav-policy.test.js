import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  NAV_EVENT,
  SYSTEM_TAB,
  classifyNavigation,
  resolveNavigation,
  resolveWatchLaterLanding,
  shouldClearFeedSticky,
  isHomePath,
  isWatchPath,
  isModifiedClick,
} from "../src/lib/nav-policy.js";

describe("nav-policy: path helpers", () => {
  it("treats / and trailing slashes as home", () => {
    assert.equal(isHomePath("/"), true);
    assert.equal(isHomePath(""), true);
    assert.equal(isHomePath("/?bp=1"), true);
    assert.equal(isHomePath("/feed/subscriptions"), false);
    assert.equal(isHomePath("/watch?v=abc"), false);
  });

  it("detects watch paths", () => {
    assert.equal(isWatchPath("/watch?v=abc"), true);
    assert.equal(isWatchPath("/watch"), true);
    assert.equal(isWatchPath("/"), false);
  });
});

describe("nav-policy: classifyNavigation", () => {
  it("maps first load to cold", () => {
    assert.equal(classifyNavigation({ isFirstLoad: true, nextPath: "/" }), NAV_EVENT.COLD);
  });

  it("maps watch → home to watch-to-home", () => {
    assert.equal(
      classifyNavigation({ prevPath: "/watch?v=1", nextPath: "/" }),
      NAV_EVENT.WATCH_TO_HOME
    );
  });

  it("maps logo / sidebar home to yt-home", () => {
    assert.equal(
      classifyNavigation({ source: "yt-home", prevPath: "/", nextPath: "/" }),
      NAV_EVENT.YT_HOME
    );
    assert.equal(
      classifyNavigation({ prevPath: "/feed/library", nextPath: "/" }),
      NAV_EVENT.YT_HOME
    );
  });

  it("does not treat home remounts as a new home intent", () => {
    assert.equal(
      classifyNavigation({ prevPath: "/", nextPath: "/" }),
      NAV_EVENT.OTHER
    );
  });

  it("maps explicit Diet-Youtube tab clicks to chrono-tab", () => {
    assert.equal(
      classifyNavigation({ source: "chrono-tab", isFirstLoad: true, nextPath: "/" }),
      NAV_EVENT.CHRONO_TAB
    );
  });

  it("maps non-home navigations to other", () => {
    assert.equal(
      classifyNavigation({ prevPath: "/", nextPath: "/watch?v=1" }),
      NAV_EVENT.OTHER
    );
  });
});

describe("nav-policy: resolveNavigation", () => {
  const wlPrefs = { defaultHome: SYSTEM_TAB.WATCH_LATER };

  it("cold / yt-home / watch-to-home always land on diet home, not Feed", () => {
    for (const event of [NAV_EVENT.COLD, NAV_EVENT.YT_HOME, NAV_EVENT.WATCH_TO_HOME]) {
      const out = resolveNavigation(event, { prefs: wlPrefs });
      assert.equal(out.tabId, SYSTEM_TAB.WATCH_LATER);
      assert.equal(out.feedSticky, false);
    }
  });

  it("never lands on Feed from YouTube home chrome even if session was on Feed", () => {
    const session = { tabId: SYSTEM_TAB.FEED, feedSticky: true };
    const out = resolveNavigation(NAV_EVENT.YT_HOME, { prefs: wlPrefs, session });
    assert.equal(out.tabId, SYSTEM_TAB.WATCH_LATER);
    assert.equal(out.feedSticky, false);
  });

  it("explicit Feed click sticks until a home event", () => {
    const clicked = resolveNavigation(NAV_EVENT.CHRONO_TAB, {
      prefs: wlPrefs,
      requestedTabId: SYSTEM_TAB.FEED,
    });
    assert.equal(clicked.tabId, SYSTEM_TAB.FEED);
    assert.equal(clicked.feedSticky, true);

    const afterLogo = resolveNavigation(NAV_EVENT.YT_HOME, {
      prefs: wlPrefs,
      session: clicked,
    });
    assert.equal(afterLogo.tabId, SYSTEM_TAB.WATCH_LATER);
    assert.equal(afterLogo.feedSticky, false);
  });

  it("other keeps the current session tab", () => {
    const out = resolveNavigation(NAV_EVENT.OTHER, {
      prefs: wlPrefs,
      session: { tabId: SYSTEM_TAB.SUBSCRIPTIONS, feedSticky: false },
    });
    assert.equal(out.tabId, SYSTEM_TAB.SUBSCRIPTIONS);
  });

  it("honors a saved Subscriptions default home", () => {
    const out = resolveNavigation(NAV_EVENT.COLD, {
      prefs: { defaultHome: SYSTEM_TAB.SUBSCRIPTIONS },
    });
    assert.equal(out.tabId, SYSTEM_TAB.SUBSCRIPTIONS);
  });

  it("refuses Feed as a diet-home default", () => {
    const out = resolveNavigation(NAV_EVENT.COLD, {
      prefs: { defaultHome: SYSTEM_TAB.FEED },
    });
    assert.equal(out.tabId, SYSTEM_TAB.WATCH_LATER);
  });
});

describe("nav-policy: feed sticky + modifiers", () => {
  it("clears sticky on cold / yt-home / watch-to-home only", () => {
    assert.equal(shouldClearFeedSticky(NAV_EVENT.COLD), true);
    assert.equal(shouldClearFeedSticky(NAV_EVENT.YT_HOME), true);
    assert.equal(shouldClearFeedSticky(NAV_EVENT.WATCH_TO_HOME), true);
    assert.equal(shouldClearFeedSticky(NAV_EVENT.CHRONO_TAB), false);
    assert.equal(shouldClearFeedSticky(NAV_EVENT.OTHER), false);
  });

  it("lets modifier / middle-clicks pass through", () => {
    assert.equal(isModifiedClick({ metaKey: true, button: 0 }), true);
    assert.equal(isModifiedClick({ ctrlKey: true, button: 0 }), true);
    assert.equal(isModifiedClick({ button: 1 }), true);
    assert.equal(isModifiedClick({ button: 0 }), false);
  });
});

describe("nav-policy: resolveWatchLaterLanding", () => {
  it("is the same function the resolver uses for diet home", () => {
    assert.equal(resolveWatchLaterLanding({ defaultHome: "watch-later" }), "watch-later");
  });
});
