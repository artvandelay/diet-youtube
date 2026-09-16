/**
 * Diet-Youtube navigation policy.
 *
 * One resolver. Events are exactly: cold | yt-home | watch-to-home | chrono-tab | other.
 * No stacked home-intent flags — callers pass a single event plus the current prefs/session.
 *
 * Product rule (PRD 1.7.9 / §4):
 *   cold, logo, sidebar Home, watch→home, hard refresh → diet home (Watch later by default).
 *   Never auto-bounce to Subscriptions when the queue is empty or unknown.
 *   Never land on algorithmic Feed from YouTube Home chrome / cold / reload / watch→home.
 *   Feed sticks only after an explicit Diet-Youtube tab click, same session, no reload.
 */

export const NAV_EVENT = Object.freeze({
  COLD: "cold",
  YT_HOME: "yt-home",
  WATCH_TO_HOME: "watch-to-home",
  CHRONO_TAB: "chrono-tab",
  OTHER: "other",
});

export const SYSTEM_TAB = Object.freeze({
  FEED: "feed",
  WATCH_LATER: "watch-later",
  SUBSCRIPTIONS: "subscriptions",
});

export const DEFAULT_HOME_TAB = SYSTEM_TAB.WATCH_LATER;

const HOME_PATHS = new Set(["/", "/index.html", "/feed/recommended", "/feed/featured"]);

export function normalizePath(path) {
  if (!path) return "/";
  const noHash = String(path).split("#")[0];
  const pathname = noHash.split("?")[0];
  const trimmed = pathname.replace(/\/+$/, "");
  return trimmed || "/";
}

export function isHomePath(path) {
  return HOME_PATHS.has(normalizePath(path));
}

export function isWatchPath(path) {
  const p = normalizePath(path);
  return p === "/watch" || p.startsWith("/watch/");
}

export function isSubscriptionsPath(path) {
  return normalizePath(path) === "/feed/subscriptions";
}

export function isDietSurfacePath(path) {
  return isHomePath(path);
}

/**
 * Diet home tab. Feed is never a legal diet-home landing.
 * Custom feed ids / playlists are allowed when the user saved that default.
 */
export function getDietHomeTabId(prefs) {
  const raw = prefs?.defaultHome;
  if (raw === SYSTEM_TAB.SUBSCRIPTIONS) return SYSTEM_TAB.SUBSCRIPTIONS;
  if (typeof raw === "string" && raw && raw !== SYSTEM_TAB.FEED && raw !== SYSTEM_TAB.WATCH_LATER) {
    return raw;
  }
  return SYSTEM_TAB.WATCH_LATER;
}

/**
 * Watch-later diet home always lands on the queue tab.
 * `queueCount` may be 0, null, or undefined — still Watch later. Never bounce to Subs.
 */
export function resolveWatchLaterLanding({ defaultHome, queueCount } = {}) {
  void queueCount;
  const home = getDietHomeTabId({ defaultHome });
  if (home === SYSTEM_TAB.FEED) return SYSTEM_TAB.WATCH_LATER;
  return home;
}

/**
 * Logo / sidebar Home / hard reload must not keep a Feed-sticky OTHER.
 * `pendingNav` is set by the classic intercept (yt-home) or document_start (cold).
 * Explicit Diet tab clicks are never upgraded.
 */
export function upgradeNavigationEvent(classified, { pendingNav, isReload } = {}) {
  if (classified === NAV_EVENT.CHRONO_TAB) return NAV_EVENT.CHRONO_TAB;
  if (isReload || pendingNav === NAV_EVENT.COLD || pendingNav === "cold") {
    return NAV_EVENT.COLD;
  }
  if (pendingNav === NAV_EVENT.YT_HOME || pendingNav === "yt-home") {
    return NAV_EVENT.YT_HOME;
  }
  return classified || NAV_EVENT.OTHER;
}

export function classifyNavigation({ isFirstLoad, source, prevPath, nextPath, isReload, homeChrome } = {}) {
  if (source === NAV_EVENT.CHRONO_TAB || source === "chrono-tab") {
    return NAV_EVENT.CHRONO_TAB;
  }
  if (isReload) return NAV_EVENT.COLD;
  if (isFirstLoad) return NAV_EVENT.COLD;
  if (homeChrome || source === NAV_EVENT.YT_HOME || source === "yt-home") {
    return NAV_EVENT.YT_HOME;
  }

  const nextHome = isHomePath(nextPath);
  const prevWatch = isWatchPath(prevPath);
  const prevHome = isHomePath(prevPath);

  if (
    source === NAV_EVENT.WATCH_TO_HOME ||
    (prevWatch && nextHome) ||
    (prevWatch && isWatchLaterPlaylistPath(nextPath))
  ) {
    return NAV_EVENT.WATCH_TO_HOME;
  }
  // Home remounts / SPA churn must not reset Feed sticky or bounce the tab.
  if (nextHome && prevHome) return NAV_EVENT.OTHER;
  if (nextHome) return NAV_EVENT.YT_HOME;
  return NAV_EVENT.OTHER;
}

/**
 * @param {string} event
 * @param {{ prefs?: object, session?: { tabId?: string, feedSticky?: boolean }, requestedTabId?: string }} ctx
 * @returns {{ tabId: string, feedSticky: boolean }}
 */
export function resolveNavigation(event, { prefs, session, requestedTabId } = {}) {
  const dietHome = resolveWatchLaterLanding({
    defaultHome: prefs?.defaultHome,
    queueCount: prefs?.queueCount,
  });

  switch (event) {
    case NAV_EVENT.COLD:
    case NAV_EVENT.YT_HOME:
    case NAV_EVENT.WATCH_TO_HOME:
      return { tabId: dietHome, feedSticky: false };

    case NAV_EVENT.CHRONO_TAB: {
      const tabId = requestedTabId || dietHome;
      return {
        tabId,
        feedSticky: tabId === SYSTEM_TAB.FEED,
      };
    }

    case NAV_EVENT.OTHER:
    default: {
      const tabId = session?.tabId || dietHome;
      const feedSticky = Boolean(session?.feedSticky) && tabId === SYSTEM_TAB.FEED;
      return { tabId, feedSticky };
    }
  }
}

export function shouldClearFeedSticky(event) {
  return (
    event === NAV_EVENT.COLD ||
    event === NAV_EVENT.YT_HOME ||
    event === NAV_EVENT.WATCH_TO_HOME
  );
}

export function shouldShowDietSurface(pathname, session) {
  if (isHomePath(pathname)) return true;
  if (session?.feedSticky && isHomePath(pathname)) return true;
  return false;
}

export function isModifiedClick(event) {
  if (!event) return false;
  return Boolean(
    event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      event.button === 1 ||
      event.which === 2
  );
}

function closestOf(node, selector) {
  if (!node) return null;
  if (typeof node.closest === "function") return node.closest(selector);
  return null;
}

export function isWatchLaterPlaylistPath(path, search) {
  const raw = String(path || "");
  const pathname = normalizePath(raw);
  if (pathname !== "/playlist") return false;
  let qs = search;
  if (qs == null) {
    const qIdx = raw.indexOf("?");
    qs = qIdx >= 0 ? raw.slice(qIdx) : "";
  }
  const params = new URLSearchParams(String(qs).replace(/^\?/, ""));
  return params.get("list") === "WL";
}

/**
 * Destination YouTube is navigating to. `yt-navigate-start` often still
 * has the old `location.pathname` (e.g. /watch); read the event detail.
 */
export function navigateDestFromDetail(detail) {
  if (!detail || typeof detail !== "object") return null;
  const browseId = detail.endpoint?.browseEndpoint?.browseId;
  if (browseId === "FEwhat_to_watch") return { pathname: "/", search: "" };
  if (browseId === "VLWL") return { pathname: "/playlist", search: "?list=WL" };

  const raw =
    detail.url ||
    detail.endpoint?.commandMetadata?.webCommandMetadata?.url ||
    detail.endpoint?.urlEndpoint?.url ||
    "";
  if (!raw) return null;
  try {
    const url = new URL(raw, "https://www.youtube.com");
    return { pathname: url.pathname, search: url.search };
  } catch (_) {
    return null;
  }
}

export function isYouTubeLogoAnchor(node) {
  if (!node) return false;
  if (isMastheadLogoCluster(node)) return true;
  if (node.id === "logo" || node.id === "logo-icon") return true;
  if (
    closestOf(
      node,
      "#logo, ytd-topbar-logo-renderer, yt-icon-button#logo, #logo-icon, yt-masthead-logo, #start #logo"
    )
  ) {
    return true;
  }
  const anchor = node.tagName === "A" ? node : closestOf(node, "a");
  if (!anchor) return false;
  if (closestOf(anchor, "ytd-topbar-logo-renderer, yt-masthead-logo, #start")) {
    const href = (anchor.getAttribute?.("href") || "").trim();
    const path = normalizePath(href);
    if (!href || path === "/" || path === "/index.html") return true;
  }
  return false;
}

/**
 * Premium wordmark / play-button live under #start, often without id=logo
 * on the clicked yt-icon. Hamburger (#guide-button) is not Home.
 */
export function isMastheadLogoCluster(node) {
  if (!node) return false;
  if (
    closestOf(
      node,
      "#guide-button, #voice-search-button, ytd-searchbox, yt-searchbox, #center, #end, #buttons, #search-input"
    )
  ) {
    return false;
  }
  if (node.id === "logo" || node.id === "logo-icon") return true;
  if (closestOf(node, "#logo, ytd-topbar-logo-renderer, yt-masthead-logo, #logo-icon")) return true;
  if (closestOf(node, "#start, ytd-masthead #start, #masthead-container #start")) return true;
  return false;
}

const GUIDE_HOME_HREFS = new Set(["/", "/index.html", "/feed/recommended", "/feed/featured"]);
const GUIDE_NOT_HOME = /short|subscription|you$|library|history|playlist|later|liked|download|movie|gaming|music|studio|setting|help|trending|shop|sports|news|podcast|course|live|premium/i;

export function isYouTubeSidebarHomeAnchor(node) {
  if (!node) return false;
  const entry = closestOf(
    node,
    "ytd-mini-guide-entry-renderer, ytd-guide-entry-renderer, ytm-pivot-bar-item-renderer, a"
  );
  if (!entry) return false;
  const inGuide = closestOf(
    entry,
    "#guide, ytd-mini-guide-renderer, ytd-guide-renderer, ytd-mini-guide-entry-renderer, ytd-guide-entry-renderer, ytd-guide-section-renderer, ytm-pivot-bar-renderer"
  );
  if (!inGuide) return false;

  const anchor = entry.tagName === "A" ? entry : entry.querySelector?.("a#endpoint, a[href], a");
  const href = (anchor?.getAttribute?.("href") || entry.getAttribute?.("href") || "").trim();
  const path = normalizePath(href);
  const title = (
    anchor?.getAttribute?.("title") ||
    anchor?.getAttribute?.("aria-label") ||
    entry.getAttribute?.("title") ||
    entry.getAttribute?.("aria-label") ||
    ""
  ).toLowerCase();

  if (title === "home" || title.startsWith("home ")) return true;
  if (GUIDE_HOME_HREFS.has(path) && !GUIDE_NOT_HOME.test(title)) return true;
  if (isFirstMiniGuideEntry(node)) return true;
  return false;
}

/** The first mini-guide row is always YouTube Home, even with a localized title. */
export function isFirstMiniGuideEntry(node) {
  const mini = closestOf(node, "ytd-mini-guide-entry-renderer");
  if (!mini) return false;
  const parent = mini.parentNode || mini.parentElement;
  if (!parent?.children) return false;
  const siblings = [...parent.children].filter(
    (el) => String(el.tagName || "").toUpperCase() === "YTD-MINI-GUIDE-ENTRY-RENDERER"
  );
  return siblings[0] === mini;
}

export function homeControlFromEventTarget(target) {
  if (isMastheadLogoCluster(target) || isYouTubeLogoAnchor(target)) return "logo";
  if (isYouTubeSidebarHomeAnchor(target) || isFirstMiniGuideEntry(target)) return "home";
  return null;
}

/** composedPath plus parentNode/host so closed shadow roots still see the guide/logo. */
export function eventPathNodes(event) {
  const out = [];
  const seen = new Set();
  const add = (node) => {
    if (!node || seen.has(node)) return;
    seen.add(node);
    out.push(node);
  };
  if (typeof event?.composedPath === "function") {
    for (const node of event.composedPath()) add(node);
  }
  let node = event?.target;
  while (node) {
    add(node);
    node = node.parentNode || node.parentElement || node.host;
  }
  if (event?.currentTarget) add(event.currentTarget);
  return out;
}

/** Pierces closed shadow trees via composedPath (mini-guide icon clicks). */
export function homeControlFromEvent(event) {
  if (!event) return null;
  for (const node of eventPathNodes(event)) {
    if (node.nodeType === 3) continue;
    const kind = homeControlFromEventTarget(node);
    if (kind) return kind;
  }
  return homeControlFromEventTarget(event.target);
}

export function isYouTubeHomeDestination(detail, pathname) {
  const dest = navigateDestFromDetail(detail);
  if (dest && isHomePath(dest.pathname)) return true;
  if (detail?.endpoint?.browseEndpoint?.browseId === "FEwhat_to_watch") return true;
  return isHomePath(pathname);
}

/**
 * Live chrome: Feed+sticky + logo/Home/reload must land Watch later.
 * Used by unit tests that mirror the v1.0.3 stress failures.
 */
export const HOME_LOCK_MS = 500;

/** After logo/Home, ignore OTHER remounts until the lock expires (unless Feed tab). */
export function shouldBlockOtherDuringHomeLock({ event, lockUntil, now } = {}) {
  if (event === NAV_EVENT.CHRONO_TAB) return false;
  if (event !== NAV_EVENT.OTHER && event) return false;
  if (!lockUntil) return false;
  return (now || 0) < lockUntil;
}

export function pathContainsDietRoot(event) {
  for (const node of eventPathNodes(event)) {
    if (node.id === "diet-yt-root") return true;
    if (closestOf(node, "#diet-yt-root")) return true;
  }
  return false;
}

const MASTHEAD_EXCLUDE =
  "#guide-button, #voice-search-button, ytd-searchbox, yt-searchbox, #center, #end, #buttons, #search-input, #avatar-btn, #notification-button, ytd-notification-topbar-button-renderer, #create-icon";

export function nodeIsExcludedMastheadControl(node) {
  if (!node) return false;
  const id = node.id || "";
  if (
    id === "guide-button" ||
    id === "center" ||
    id === "end" ||
    id === "buttons" ||
    id === "voice-search-button" ||
    id === "avatar-btn"
  ) {
    return true;
  }
  const tag = String(node.tagName || "").toUpperCase();
  if (tag === "YTD-SEARCHBOX" || tag === "YT-SEARCHBOX") return true;
  return Boolean(closestOf(node, MASTHEAD_EXCLUDE));
}

export function nodeIsMastheadHomeChrome(node) {
  if (!node || nodeIsExcludedMastheadControl(node)) return false;
  const id = node.id || "";
  if (id === "masthead-container" || id === "start" || id === "logo" || id === "logo-icon") return true;
  const tag = String(node.tagName || "").toUpperCase();
  if (tag === "YTD-MASTHEAD" || tag === "YTD-TOPBAR-LOGO-RENDERER") return true;
  return Boolean(closestOf(node, "#masthead-container, ytd-masthead, #start"));
}

export function nodeIsGuideHomeChrome(node) {
  if (!node) return false;
  if (isFirstMiniGuideEntry(node) || isYouTubeSidebarHomeAnchor(node)) return true;
  const rawHref = node.getAttribute?.("href");
  if (rawHref == null || rawHref === "") return false;
  const path = normalizePath(rawHref.trim());
  const inGuide = closestOf(
    node,
    "#guide, ytd-mini-guide-renderer, ytd-guide-renderer, ytd-mini-guide-entry-renderer, ytd-guide-entry-renderer"
  );
  if (inGuide && GUIDE_HOME_HREFS.has(path)) return true;
  return false;
}

function walkIntoNodes(nodes, start) {
  let node = start || null;
  while (node) {
    if (!nodes.includes(node)) nodes.push(node);
    node = node.parentElement || node.parentNode || node.host;
  }
  return nodes;
}

/** composedPath + parent walk + optional elementFromPoint node (retargeted Premium clicks). */
export function collectGestureNodes(event, pointNode, extraNodes) {
  const nodes = eventPathNodes(event);
  walkIntoNodes(nodes, pointNode);
  if (extraNodes) {
    for (const extra of extraNodes) walkIntoNodes(nodes, extra);
  }
  return nodes;
}

function nodeIsDietRoot(node) {
  if (!node) return false;
  if (node.id === "diet-yt-root") return true;
  return Boolean(closestOf(node, "#diet-yt-root"));
}

/**
 * Broad home-chrome hit: masthead/#start (not search/create/avatar/menu)
 * or mini-guide/guide Home (first row or href=/).
 * Diet overlay nodes are skipped, not treated as a veto — an overlapping
 * #diet-yt-root must not hide #start / mini-guide Home in the same path.
 */
export function gestureHitsHomeChrome(event, { pointNode, extraNodes } = {}) {
  if (!event) return false;
  const nodes = collectGestureNodes(event, pointNode, extraNodes);
  let sawExclude = false;
  let sawMasthead = false;
  let sawGuideHome = false;
  for (const node of nodes) {
    if (!node || node.nodeType === 3) continue;
    if (nodeIsDietRoot(node)) continue;
    if (nodeIsExcludedMastheadControl(node)) sawExclude = true;
    if (nodeIsMastheadHomeChrome(node)) sawMasthead = true;
    if (nodeIsGuideHomeChrome(node)) sawGuideHome = true;
  }
  if (sawGuideHome) return true;
  return sawMasthead && !sawExclude;
}

export function shouldForceDietHomeOnStickyFeed({ feedSticky, hitsHomeChrome, insideDietRoot } = {}) {
  if (insideDietRoot && !hitsHomeChrome) return false;
  if (!hitsHomeChrome) return false;
  void feedSticky;
  return true;
}

/**
 * Intercept decision used by the content script and unit tests.
 * Diet Feed tab clicks (inside #diet-yt-root, no home chrome) keep sticky.
 * feedSticky + path containing #start / masthead / guide Home → YT_HOME.
 */
export function resolveStickyFeedHomeChromeClick(session, prefs, event, extras = {}) {
  const inside = pathContainsDietRoot(event);
  const hits =
    gestureHitsHomeChrome(event, extras) ||
    Boolean(!inside && homeControlFromEvent(event));
  if (
    !shouldForceDietHomeOnStickyFeed({
      feedSticky: session?.feedSticky,
      hitsHomeChrome: hits,
      insideDietRoot: inside,
    })
  ) {
    return resolveNavigation(NAV_EVENT.OTHER, { prefs, session });
  }
  return resolveNavigation(NAV_EVENT.YT_HOME, { prefs, session });
}

/** Masthead logo cluster or mini-guide Home. Diet-only clicks do not match. */
export function isOutsideDietHomeChromeGesture(event) {
  if (!event) return false;
  const hits = gestureHitsHomeChrome(event);
  if (hits) return true;
  if (pathContainsDietRoot(event)) return false;
  return Boolean(homeControlFromEvent(event));
}

export function resolveFeedStickyHomeChrome(session, prefs, { homeChrome, isReload } = {}) {
  const classified = classifyNavigation({
    prevPath: "/",
    nextPath: "/",
    homeChrome,
    isReload,
  });
  const event = upgradeNavigationEvent(classified, {
    pendingNav: homeChrome ? "yt-home" : isReload ? "cold" : null,
    isReload,
  });
  return resolveNavigation(event, { prefs, session });
}
