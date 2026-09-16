import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  NAV_EVENT,
  SYSTEM_TAB,
  classifyNavigation,
  HOME_LOCK_MS,
  homeControlFromEvent,
  homeControlFromEventTarget,
  isFirstMiniGuideEntry,
  isMastheadLogoCluster,
  isOutsideDietHomeChromeGesture,
  isWatchLaterPlaylistPath,
  isYouTubeLogoAnchor,
  isYouTubeSidebarHomeAnchor,
  navigateDestFromDetail,
  resolveFeedStickyHomeChrome,
  resolveNavigation,
  resolveStickyFeedHomeChromeClick,
  shouldBlockOtherDuringHomeLock,
  shouldForceDietHomeOnStickyFeed,
  gestureHitsHomeChrome,
  upgradeNavigationEvent,
} from "../src/lib/nav-policy.js";
import {
  rootHasDietChrome,
  rootNeedsRemount,
  shouldHideSurface,
  shouldPaintShell,
  shouldRecoverWatchLaterBounce,
} from "../src/lib/surface.js";
import { watchUrl } from "../src/ui/shell.js";

function fakeEl(tag, attrs = {}, parent = null) {
  const node = {
    tagName: String(tag).toUpperCase(),
    id: attrs.id || "",
    parent,
    get parentNode() {
      return this.parent;
    },
    get parentElement() {
      return this.parent;
    },
    attrs,
    children: [],
    getAttribute(name) {
      return this.attrs[name] ?? null;
    },
    querySelector() {
      return this.children[0] || null;
    },
    querySelectorAll(sel) {
      const tag = String(sel || "").toUpperCase();
      return this.children.filter((c) => c.tagName === tag);
    },
    closest(selector) {
      const parts = selector.split(",").map((s) => s.trim());
      let cur = this;
      while (cur) {
        for (const part of parts) {
          if (part.startsWith("#") && cur.id === part.slice(1)) return cur;
          if (part.toLowerCase() === cur.tagName.toLowerCase()) return cur;
          if (part.includes("#")) {
            const [t, id] = part.split("#");
            if ((!t || t.toLowerCase() === cur.tagName.toLowerCase()) && cur.id === id) return cur;
          }
        }
        cur = cur.parent;
      }
      return null;
    },
  };
  if (parent) parent.children.push(node);
  return node;
}

describe("surface remount", () => {
  it("cold empty root (cloak on, no chrome) must remount", () => {
    assert.equal(
      rootNeedsRemount({
        connected: true,
        hasChrome: false,
        shellBoundToRoot: false,
        liveIdMismatch: false,
      }),
      true
    );
  });

  it("SPA remount that replaces #diet-yt-root must remount", () => {
    assert.equal(
      rootNeedsRemount({
        connected: false,
        hasChrome: false,
        shellBoundToRoot: true,
        liveIdMismatch: true,
      }),
      true
    );
  });

  it("live painted shell stays put", () => {
    assert.equal(
      rootNeedsRemount({
        connected: true,
        hasChrome: true,
        shellBoundToRoot: true,
        liveIdMismatch: false,
      }),
      false
    );
  });

  it("boot chrome counts as painted until hydrate", () => {
    const root = {
      querySelector(sel) {
        return sel.includes("boot-chrome") ? {} : null;
      },
    };
    assert.equal(rootHasDietChrome(root), true);
    assert.equal(rootHasDietChrome({ querySelector: () => null }), false);
  });
});

describe("surface hide + recover", () => {
  it("does not hide on yt-navigate-start while a home intent is in flight", () => {
    assert.equal(
      shouldHideSurface({ phase: "start", destPath: "/watch", destSearch: "?v=1", homeIntent: true }),
      false
    );
    assert.equal(
      shouldHideSurface({ phase: "start", destPath: "/", homeIntent: false }),
      false
    );
  });

  it("hides on a finished watch navigation without home intent", () => {
    assert.equal(
      shouldHideSurface({ phase: "finish", destPath: "/watch", destSearch: "?v=1", homeIntent: false }),
      true
    );
  });

  it("never hides a home destination", () => {
    assert.equal(shouldHideSurface({ phase: "finish", destPath: "/", homeIntent: false }), false);
    assert.equal(shouldPaintShell({ path: "/", search: "" }), true);
  });

  it("recovers /playlist?list=WL after logo / watch→home, not as a cold bookmark", () => {
    assert.equal(isWatchLaterPlaylistPath("/playlist?list=WL"), true);
    assert.equal(isWatchLaterPlaylistPath("/playlist", "?list=WL"), true);
    assert.equal(isWatchLaterPlaylistPath("/playlist", "?list=LL"), false);

    assert.equal(
      shouldRecoverWatchLaterBounce({
        path: "/playlist",
        search: "?list=WL",
        homeIntent: true,
      }),
      true
    );
    assert.equal(
      shouldRecoverWatchLaterBounce({
        path: "/playlist",
        search: "?list=WL",
        prevWatch: true,
      }),
      true
    );
    assert.equal(
      shouldRecoverWatchLaterBounce({
        path: "/playlist",
        search: "?list=WL",
        event: NAV_EVENT.COLD,
      }),
      false
    );
  });
});

describe("logo + sidebar Home intercept", () => {
  it("matches Premium play-button / wordmark under #start (not the hamburger)", () => {
    const start = fakeEl("div", { id: "start" });
    const guideBtn = fakeEl("yt-icon-button", { id: "guide-button" }, start);
    const icon = fakeEl("yt-icon", {}, start);
    assert.equal(isMastheadLogoCluster(icon), true);
    assert.equal(homeControlFromEventTarget(icon), "logo");
    assert.equal(isMastheadLogoCluster(guideBtn), false);
    const ghost = { id: "", tagName: "SVG", closest: () => null };
    assert.equal(
      isOutsideDietHomeChromeGesture({
        target: ghost,
        composedPath: () => [ghost, icon, start],
      }),
      true
    );
  });

  it("feedSticky + click path containing #start → YT_HOME", () => {
    const start = fakeEl("div", { id: "start" });
    const play = fakeEl("yt-icon", {}, start);
    const event = {
      target: play,
      composedPath: () => [play, start],
    };
    assert.equal(gestureHitsHomeChrome(event), true);
    assert.equal(
      shouldForceDietHomeOnStickyFeed({
        feedSticky: true,
        hitsHomeChrome: true,
        insideDietRoot: false,
      }),
      true
    );
    const session = { tabId: SYSTEM_TAB.FEED, feedSticky: true };
    const out = resolveStickyFeedHomeChromeClick(session, { defaultHome: SYSTEM_TAB.WATCH_LATER }, event);
    assert.equal(out.tabId, SYSTEM_TAB.WATCH_LATER);
    assert.equal(out.feedSticky, false);
  });

  it("feedSticky + #masthead-container path (no #logo) → Watch later", () => {
    const mast = fakeEl("div", { id: "masthead-container" });
    const head = fakeEl("ytd-masthead", {}, mast);
    const ghost = { id: "", tagName: "SVG", closest: () => null };
    const session = { tabId: SYSTEM_TAB.FEED, feedSticky: true };
    const out = resolveStickyFeedHomeChromeClick(
      session,
      { defaultHome: SYSTEM_TAB.WATCH_LATER },
      { target: ghost, composedPath: () => [ghost, head, mast] }
    );
    assert.equal(out.tabId, SYSTEM_TAB.WATCH_LATER);
    assert.equal(out.feedSticky, false);
  });

  it("explicit Diet Feed tab click inside #diet-yt-root keeps sticky", () => {
    const root = fakeEl("div", { id: "diet-yt-root" });
    const tab = fakeEl("button", { id: "diet-feed-tab" }, root);
    const session = { tabId: SYSTEM_TAB.FEED, feedSticky: true };
    const out = resolveStickyFeedHomeChromeClick(
      session,
      { defaultHome: SYSTEM_TAB.WATCH_LATER },
      { target: tab, composedPath: () => [tab, root] }
    );
    assert.equal(out.tabId, SYSTEM_TAB.FEED);
    assert.equal(out.feedSticky, true);
    assert.equal(
      shouldForceDietHomeOnStickyFeed({
        feedSticky: true,
        hitsHomeChrome: false,
        insideDietRoot: true,
      }),
      false
    );
  });

  it("does not treat search / hamburger as home chrome", () => {
    const start = fakeEl("div", { id: "start" });
    const guideBtn = fakeEl("yt-icon-button", { id: "guide-button" }, start);
    const center = fakeEl("div", { id: "center" });
    const box = fakeEl("ytd-searchbox", {}, center);
    assert.equal(
      gestureHitsHomeChrome({
        target: guideBtn,
        composedPath: () => [guideBtn, start],
      }),
      false
    );
    assert.equal(
      gestureHitsHomeChrome({
        target: box,
        composedPath: () => [box, center],
      }),
      false
    );
  });

  it("blocks OTHER remounts during the home lockout, but not a Feed tab click", () => {
    const now = 1_000;
    const lockUntil = now + HOME_LOCK_MS;
    assert.equal(
      shouldBlockOtherDuringHomeLock({ event: NAV_EVENT.OTHER, lockUntil, now }),
      true
    );
    assert.equal(
      shouldBlockOtherDuringHomeLock({ event: NAV_EVENT.CHRONO_TAB, lockUntil, now }),
      false
    );
    assert.equal(
      shouldBlockOtherDuringHomeLock({ event: NAV_EVENT.OTHER, lockUntil, now: lockUntil + 1 }),
      false
    );
  });

  it("matches logo descendants, not only the <a>", () => {
    const renderer = fakeEl("ytd-topbar-logo-renderer", { id: "" });
    const anchor = fakeEl("a", { id: "logo", href: "/" }, renderer);
    const icon = fakeEl("yt-icon", { id: "logo-icon" }, anchor);
    assert.equal(isYouTubeLogoAnchor(anchor), true);
    assert.equal(isYouTubeLogoAnchor(icon), true);
    assert.equal(homeControlFromEventTarget(icon), "logo");
  });

  it("matches mini-guide Home by title even when the click is on the icon", () => {
    const guide = fakeEl("ytd-mini-guide-renderer");
    const entry = fakeEl("ytd-mini-guide-entry-renderer", { title: "Home" }, guide);
    const anchor = fakeEl("a", { href: "/", title: "Home" }, entry);
    const icon = fakeEl("yt-icon", {}, anchor);
    assert.equal(isYouTubeSidebarHomeAnchor(anchor), true);
    assert.equal(isYouTubeSidebarHomeAnchor(icon), true);
    assert.equal(homeControlFromEventTarget(icon), "home");
  });

  it("treats the first mini-guide entry as Home", () => {
    const list = fakeEl("div");
    const home = fakeEl("ytd-mini-guide-entry-renderer", { title: "Hjem" }, list);
    const shorts = fakeEl("ytd-mini-guide-entry-renderer", { title: "Shorts" }, list);
    assert.equal(isFirstMiniGuideEntry(home), true);
    assert.equal(isFirstMiniGuideEntry(shorts), false);
    assert.equal(isYouTubeSidebarHomeAnchor(home), true);
  });

  it("treats guide href=/ as Home even with a localized title", () => {
    const guide = fakeEl("ytd-mini-guide-renderer");
    const entry = fakeEl("ytd-mini-guide-entry-renderer", { title: "Hjem" }, guide);
    const anchor = fakeEl("a", { href: "/", title: "Hjem" }, entry);
    assert.equal(isYouTubeSidebarHomeAnchor(anchor), true);
  });

  it("reads Home from composedPath when the target is a shadow child", () => {
    const guide = fakeEl("ytd-mini-guide-renderer");
    const entry = fakeEl("ytd-mini-guide-entry-renderer", { title: "Home" }, guide);
    const anchor = fakeEl("a", { href: "/", title: "Home" }, entry);
    const ghost = { id: "", tagName: "SVG", closest: () => null };
    const kind = homeControlFromEvent({
      target: ghost,
      composedPath: () => [ghost, anchor, entry, guide],
    });
    assert.equal(kind, "home");
  });
});

describe("cold / logo / watch→home / Feed sticky after remount", () => {
  const prefs = { defaultHome: SYSTEM_TAB.WATCH_LATER };

  it("cold, logo, and watch→home all land Watch later and clear Feed sticky", () => {
    const session = { tabId: SYSTEM_TAB.FEED, feedSticky: true };
    for (const event of [NAV_EVENT.COLD, NAV_EVENT.YT_HOME, NAV_EVENT.WATCH_TO_HOME]) {
      const out = resolveNavigation(event, { prefs, session });
      assert.equal(out.tabId, SYSTEM_TAB.WATCH_LATER);
      assert.equal(out.feedSticky, false);
    }
  });

  it("watch → /playlist?list=WL is watch-to-home (native WL bounce)", () => {
    assert.equal(
      classifyNavigation({ prevPath: "/watch?v=abc", nextPath: "/playlist?list=WL" }),
      NAV_EVENT.WATCH_TO_HOME
    );
    const out = resolveNavigation(NAV_EVENT.WATCH_TO_HOME, {
      prefs,
      session: { tabId: SYSTEM_TAB.FEED, feedSticky: true },
    });
    assert.equal(out.tabId, SYSTEM_TAB.WATCH_LATER);
  });

  it("session Feed+sticky → logo homeChrome → Watch later (v1.0.3 live fail)", () => {
    const session = { tabId: SYSTEM_TAB.FEED, feedSticky: true };
    const out = resolveFeedStickyHomeChrome(session, prefs, { homeChrome: true });
    assert.equal(out.tabId, SYSTEM_TAB.WATCH_LATER);
    assert.equal(out.feedSticky, false);
  });

  it("session Feed+sticky → reload COLD → Watch later (v1.0.3 live fail)", () => {
    const session = { tabId: SYSTEM_TAB.FEED, feedSticky: true };
    const out = resolveFeedStickyHomeChrome(session, prefs, { isReload: true });
    assert.equal(out.tabId, SYSTEM_TAB.WATCH_LATER);
    assert.equal(out.feedSticky, false);
  });

  it("Feed sticky then logo → Watch later", () => {
    const session = { tabId: SYSTEM_TAB.FEED, feedSticky: true };
    const classified = classifyNavigation({ prevPath: "/", nextPath: "/" });
    assert.equal(classified, NAV_EVENT.OTHER);
    const event = upgradeNavigationEvent(classified, { pendingNav: "yt-home" });
    assert.equal(event, NAV_EVENT.YT_HOME);
    const out = resolveNavigation(event, { prefs, session });
    assert.equal(out.tabId, SYSTEM_TAB.WATCH_LATER);
    assert.equal(out.feedSticky, false);
  });

  it("Feed sticky then sidebar Home → Watch later", () => {
    const session = { tabId: SYSTEM_TAB.FEED, feedSticky: true };
    const event = classifyNavigation({
      prevPath: "/",
      nextPath: "/",
      homeChrome: true,
    });
    assert.equal(event, NAV_EVENT.YT_HOME);
    const out = resolveNavigation(event, { prefs, session });
    assert.equal(out.tabId, SYSTEM_TAB.WATCH_LATER);
    assert.equal(out.feedSticky, false);
  });

  it("Feed sticky then reload/cold → Watch later", () => {
    const session = { tabId: SYSTEM_TAB.FEED, feedSticky: true };
    assert.equal(
      classifyNavigation({ prevPath: "/", nextPath: "/", isReload: true }),
      NAV_EVENT.COLD
    );
    const upgraded = upgradeNavigationEvent(NAV_EVENT.OTHER, { pendingNav: "cold" });
    assert.equal(upgraded, NAV_EVENT.COLD);
    for (const event of [NAV_EVENT.COLD, upgraded]) {
      const out = resolveNavigation(event, { prefs, session });
      assert.equal(out.tabId, SYSTEM_TAB.WATCH_LATER);
      assert.equal(out.feedSticky, false);
    }
  });

  it("does not upgrade an explicit Feed tab click", () => {
    assert.equal(
      upgradeNavigationEvent(NAV_EVENT.CHRONO_TAB, { pendingNav: "cold" }),
      NAV_EVENT.CHRONO_TAB
    );
  });

  it("Feed sticks across a home remount (OTHER) and clears on reload/logo", () => {
    const clicked = resolveNavigation(NAV_EVENT.CHRONO_TAB, {
      prefs,
      requestedTabId: SYSTEM_TAB.FEED,
    });
    assert.equal(clicked.feedSticky, true);

    const remount = resolveNavigation(NAV_EVENT.OTHER, { prefs, session: clicked });
    assert.equal(remount.tabId, SYSTEM_TAB.FEED);
    assert.equal(remount.feedSticky, true);

    const reload = resolveNavigation(NAV_EVENT.COLD, { prefs, session: remount });
    assert.equal(reload.tabId, SYSTEM_TAB.WATCH_LATER);
    assert.equal(reload.feedSticky, false);

    const logo = resolveNavigation(NAV_EVENT.YT_HOME, { prefs, session: clicked });
    assert.equal(logo.tabId, SYSTEM_TAB.WATCH_LATER);
    assert.equal(logo.feedSticky, false);
  });

  it("reads home dest from yt-navigate-start detail instead of stale /watch", () => {
    const dest = navigateDestFromDetail({
      endpoint: { browseEndpoint: { browseId: "FEwhat_to_watch" } },
    });
    assert.equal(dest.pathname, "/");
    assert.equal(
      shouldHideSurface({ phase: "start", destPath: dest.pathname, homeIntent: false }),
      false
    );
  });
});

describe("watch URLs", () => {
  it("does not attach list=WL so logo/back cannot bounce to native playlist", () => {
    assert.equal(watchUrl({ videoId: "abc", playlistId: "WL" }), "/watch?v=abc");
    assert.equal(watchUrl({ videoId: "abc", playlistId: "PLother" }), "/watch?v=abc&list=PLother");
  });
});
