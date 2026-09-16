/* Diet-Youtube isolated content — generated classic IIFE. Source: src/content/content.js */
(() => {
  // src/lib/constants.js
  var SYSTEM_TAB = Object.freeze({
    FEED: "feed",
    WATCH_LATER: "watch-later",
    SUBSCRIPTIONS: "subscriptions"
  });
  var SYSTEM_TABS = Object.freeze([
    { id: SYSTEM_TAB.FEED, type: "system", label: "Feed" },
    { id: SYSTEM_TAB.WATCH_LATER, type: "system", label: "Watch later" },
    { id: SYSTEM_TAB.SUBSCRIPTIONS, type: "system", label: "Subscriptions" }
  ]);
  var LAYOUT = Object.freeze({
    LIST: "list",
    ICONS: "icons"
  });
  var SORT = Object.freeze({
    NEWEST: "newest",
    OLDEST: "oldest",
    CHANNEL: "channel"
  });
  var POSTED_WITHIN = Object.freeze({
    ANY: "any",
    D1: "1d",
    D3: "3d",
    D7: "7d",
    D14: "14d",
    D30: "30d"
  });
  var ICONS_DENSITY = Object.freeze({
    COMFORTABLE: "comfortable",
    DEFAULT: "default",
    DENSE: "dense"
  });
  var DEFAULT_LAYOUT = LAYOUT.ICONS;
  var DEFAULT_ICONS_DENSITY = ICONS_DENSITY.DEFAULT;
  var DEFAULT_VIEW = Object.freeze({
    layout: DEFAULT_LAYOUT,
    sort: SORT.NEWEST,
    postedWithin: POSTED_WITHIN.ANY,
    density: DEFAULT_ICONS_DENSITY
  });
  var WATCH_LATER_PLAYLIST_ID = "WL";
  var MSG = Object.freeze({
    ISOLATED: "diet-yt-isolated",
    MAIN: "diet-yt-main"
  });
  var SYSTEM_TAB_LABELS = Object.freeze({
    [SYSTEM_TAB.FEED]: "Feed",
    [SYSTEM_TAB.WATCH_LATER]: "Watch later",
    [SYSTEM_TAB.SUBSCRIPTIONS]: "Subscriptions"
  });

  // src/lib/enabled.js
  var ENABLED_STORAGE_KEY = "dietYtEnabled";
  function isDietEnabled(value) {
    return value !== false;
  }
  function shouldInjectSurface({ enabled } = {}) {
    return isDietEnabled(enabled);
  }

  // src/lib/playlist-save.js
  function normalizePlaylistId(id) {
    const raw = String(id || "").trim();
    if (!raw) return "";
    return raw.startsWith("VL") ? raw.slice(2) : raw;
  }
  function playlistDisplayName(id, label) {
    const pid = normalizePlaylistId(id);
    if (pid === WATCH_LATER_PLAYLIST_ID || pid === "WL") return "Watch later";
    if (pid === "LL") return "Liked videos";
    return String(label || "").trim() || "Playlist";
  }
  function canSaveToWatchLater(tabId) {
    return tabId !== SYSTEM_TAB.WATCH_LATER;
  }
  function moreMenuItems(tabId) {
    const items = [];
    if (canSaveToWatchLater(tabId)) {
      items.push({ id: "save-wl", label: "Save to Watch later" });
    }
    items.push({ id: "save-playlist", label: "Save to playlist\u2026" });
    return items;
  }
  function playlistSourcesFromPrefs(prefs) {
    const out = [];
    for (const feed of prefs?.customFeeds || []) {
      for (const source of feed.sources || []) {
        if (source.type === "playlist" && source.id) {
          out.push({
            id: normalizePlaylistId(source.id),
            label: source.label || feed.name || "Playlist",
            type: "playlist"
          });
        }
      }
    }
    return out;
  }
  function mergeSaveTargets({ library = [], feedSources = [] } = {}) {
    const seen = /* @__PURE__ */ new Set();
    const out = [];
    const push = (item, alreadyIn = false) => {
      const id = normalizePlaylistId(item?.id);
      if (!id || seen.has(id)) return;
      seen.add(id);
      out.push({
        id,
        label: playlistDisplayName(id, item.label),
        alreadyIn: Boolean(item.alreadyIn || alreadyIn)
      });
    };
    push({ id: WATCH_LATER_PLAYLIST_ID, label: "Watch later" });
    for (const source of feedSources) push(source);
    for (const item of library) push(item);
    return out;
  }
  function saveToastMessage({ alreadyIn = false, playlistLabel = "playlist", count = 1 } = {}) {
    const name = playlistLabel || "playlist";
    if (alreadyIn) return `Already in ${name}`;
    if (count > 1) return `Saved ${count} to ${name}`;
    return `Saved to ${name}`;
  }

  // src/lib/nav-policy.js
  var NAV_EVENT = Object.freeze({
    COLD: "cold",
    YT_HOME: "yt-home",
    WATCH_TO_HOME: "watch-to-home",
    CHRONO_TAB: "chrono-tab",
    OTHER: "other"
  });
  var SYSTEM_TAB2 = Object.freeze({
    FEED: "feed",
    WATCH_LATER: "watch-later",
    SUBSCRIPTIONS: "subscriptions"
  });
  var DEFAULT_HOME_TAB = SYSTEM_TAB2.WATCH_LATER;
  var HOME_PATHS = /* @__PURE__ */ new Set(["/", "/index.html", "/feed/recommended", "/feed/featured"]);
  function normalizePath(path) {
    if (!path) return "/";
    const noHash = String(path).split("#")[0];
    const pathname = noHash.split("?")[0];
    const trimmed = pathname.replace(/\/+$/, "");
    return trimmed || "/";
  }
  function isHomePath(path) {
    return HOME_PATHS.has(normalizePath(path));
  }
  function isWatchPath(path) {
    const p = normalizePath(path);
    return p === "/watch" || p.startsWith("/watch/");
  }
  function isDietSurfacePath(path) {
    return isHomePath(path);
  }
  function getDietHomeTabId(prefs) {
    const raw = prefs?.defaultHome;
    if (raw === SYSTEM_TAB2.SUBSCRIPTIONS) return SYSTEM_TAB2.SUBSCRIPTIONS;
    if (typeof raw === "string" && raw && raw !== SYSTEM_TAB2.FEED && raw !== SYSTEM_TAB2.WATCH_LATER) {
      return raw;
    }
    return SYSTEM_TAB2.WATCH_LATER;
  }
  function resolveWatchLaterLanding({ defaultHome, queueCount } = {}) {
    void queueCount;
    const home = getDietHomeTabId({ defaultHome });
    if (home === SYSTEM_TAB2.FEED) return SYSTEM_TAB2.WATCH_LATER;
    return home;
  }
  function upgradeNavigationEvent(classified, { pendingNav, isReload } = {}) {
    if (classified === NAV_EVENT.CHRONO_TAB) return NAV_EVENT.CHRONO_TAB;
    if (isReload || pendingNav === NAV_EVENT.COLD || pendingNav === "cold") {
      return NAV_EVENT.COLD;
    }
    if (pendingNav === NAV_EVENT.YT_HOME || pendingNav === "yt-home") {
      return NAV_EVENT.YT_HOME;
    }
    return classified || NAV_EVENT.OTHER;
  }
  function classifyNavigation({ isFirstLoad, source, prevPath, nextPath, isReload, homeChrome } = {}) {
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
    if (source === NAV_EVENT.WATCH_TO_HOME || prevWatch && nextHome || prevWatch && isWatchLaterPlaylistPath(nextPath)) {
      return NAV_EVENT.WATCH_TO_HOME;
    }
    if (nextHome && prevHome) return NAV_EVENT.OTHER;
    if (nextHome) return NAV_EVENT.YT_HOME;
    return NAV_EVENT.OTHER;
  }
  function resolveNavigation(event, { prefs, session, requestedTabId } = {}) {
    const dietHome = resolveWatchLaterLanding({
      defaultHome: prefs?.defaultHome,
      queueCount: prefs?.queueCount
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
          feedSticky: tabId === SYSTEM_TAB2.FEED
        };
      }
      case NAV_EVENT.OTHER:
      default: {
        const tabId = session?.tabId || dietHome;
        const feedSticky = Boolean(session?.feedSticky) && tabId === SYSTEM_TAB2.FEED;
        return { tabId, feedSticky };
      }
    }
  }
  function isModifiedClick(event) {
    if (!event) return false;
    return Boolean(
      event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button === 1 || event.which === 2
    );
  }
  function closestOf(node, selector) {
    if (!node) return null;
    if (typeof node.closest === "function") return node.closest(selector);
    return null;
  }
  function isWatchLaterPlaylistPath(path, search) {
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
  function navigateDestFromDetail(detail) {
    if (!detail || typeof detail !== "object") return null;
    const browseId = detail.endpoint?.browseEndpoint?.browseId;
    if (browseId === "FEwhat_to_watch") return { pathname: "/", search: "" };
    if (browseId === "VLWL") return { pathname: "/playlist", search: "?list=WL" };
    const raw = detail.url || detail.endpoint?.commandMetadata?.webCommandMetadata?.url || detail.endpoint?.urlEndpoint?.url || "";
    if (!raw) return null;
    try {
      const url = new URL(raw, "https://www.youtube.com");
      return { pathname: url.pathname, search: url.search };
    } catch (_) {
      return null;
    }
  }
  function isYouTubeLogoAnchor(node) {
    if (!node) return false;
    if (isMastheadLogoCluster(node)) return true;
    if (node.id === "logo" || node.id === "logo-icon") return true;
    if (closestOf(
      node,
      "#logo, ytd-topbar-logo-renderer, yt-icon-button#logo, #logo-icon, yt-masthead-logo, #start #logo"
    )) {
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
  function isMastheadLogoCluster(node) {
    if (!node) return false;
    if (closestOf(
      node,
      "#guide-button, #voice-search-button, ytd-searchbox, yt-searchbox, #center, #end, #buttons, #search-input"
    )) {
      return false;
    }
    if (node.id === "logo" || node.id === "logo-icon") return true;
    if (closestOf(node, "#logo, ytd-topbar-logo-renderer, yt-masthead-logo, #logo-icon")) return true;
    if (closestOf(node, "#start, ytd-masthead #start, #masthead-container #start")) return true;
    return false;
  }
  var GUIDE_HOME_HREFS = /* @__PURE__ */ new Set(["/", "/index.html", "/feed/recommended", "/feed/featured"]);
  var GUIDE_NOT_HOME = /short|subscription|you$|library|history|playlist|later|liked|download|movie|gaming|music|studio|setting|help|trending|shop|sports|news|podcast|course|live|premium/i;
  function isYouTubeSidebarHomeAnchor(node) {
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
    const title = (anchor?.getAttribute?.("title") || anchor?.getAttribute?.("aria-label") || entry.getAttribute?.("title") || entry.getAttribute?.("aria-label") || "").toLowerCase();
    if (title === "home" || title.startsWith("home ")) return true;
    if (GUIDE_HOME_HREFS.has(path) && !GUIDE_NOT_HOME.test(title)) return true;
    if (isFirstMiniGuideEntry(node)) return true;
    return false;
  }
  function isFirstMiniGuideEntry(node) {
    const mini = closestOf(node, "ytd-mini-guide-entry-renderer");
    if (!mini) return false;
    const parent = mini.parentNode || mini.parentElement;
    if (!parent?.children) return false;
    const siblings = [...parent.children].filter(
      (el2) => String(el2.tagName || "").toUpperCase() === "YTD-MINI-GUIDE-ENTRY-RENDERER"
    );
    return siblings[0] === mini;
  }
  function homeControlFromEventTarget(target) {
    if (isMastheadLogoCluster(target) || isYouTubeLogoAnchor(target)) return "logo";
    if (isYouTubeSidebarHomeAnchor(target) || isFirstMiniGuideEntry(target)) return "home";
    return null;
  }
  function eventPathNodes(event) {
    const out = [];
    const seen = /* @__PURE__ */ new Set();
    const add = (node2) => {
      if (!node2 || seen.has(node2)) return;
      seen.add(node2);
      out.push(node2);
    };
    if (typeof event?.composedPath === "function") {
      for (const node2 of event.composedPath()) add(node2);
    }
    let node = event?.target;
    while (node) {
      add(node);
      node = node.parentNode || node.parentElement || node.host;
    }
    if (event?.currentTarget) add(event.currentTarget);
    return out;
  }
  function homeControlFromEvent(event) {
    if (!event) return null;
    for (const node of eventPathNodes(event)) {
      if (node.nodeType === 3) continue;
      const kind = homeControlFromEventTarget(node);
      if (kind) return kind;
    }
    return homeControlFromEventTarget(event.target);
  }
  function isYouTubeHomeDestination(detail, pathname) {
    const dest = navigateDestFromDetail(detail);
    if (dest && isHomePath(dest.pathname)) return true;
    if (detail?.endpoint?.browseEndpoint?.browseId === "FEwhat_to_watch") return true;
    return isHomePath(pathname);
  }
  var HOME_LOCK_MS = 500;
  function shouldBlockOtherDuringHomeLock({ event, lockUntil, now } = {}) {
    if (event === NAV_EVENT.CHRONO_TAB) return false;
    if (event !== NAV_EVENT.OTHER && event) return false;
    if (!lockUntil) return false;
    return (now || 0) < lockUntil;
  }
  function pathContainsDietRoot(event) {
    for (const node of eventPathNodes(event)) {
      if (node.id === "diet-yt-root") return true;
      if (closestOf(node, "#diet-yt-root")) return true;
    }
    return false;
  }
  var MASTHEAD_EXCLUDE = "#guide-button, #voice-search-button, ytd-searchbox, yt-searchbox, #center, #end, #buttons, #search-input, #avatar-btn, #notification-button, ytd-notification-topbar-button-renderer, #create-icon";
  function nodeIsExcludedMastheadControl(node) {
    if (!node) return false;
    const id = node.id || "";
    if (id === "guide-button" || id === "center" || id === "end" || id === "buttons" || id === "voice-search-button" || id === "avatar-btn") {
      return true;
    }
    const tag = String(node.tagName || "").toUpperCase();
    if (tag === "YTD-SEARCHBOX" || tag === "YT-SEARCHBOX") return true;
    return Boolean(closestOf(node, MASTHEAD_EXCLUDE));
  }
  function nodeIsMastheadHomeChrome(node) {
    if (!node || nodeIsExcludedMastheadControl(node)) return false;
    const id = node.id || "";
    if (id === "masthead-container" || id === "start" || id === "logo" || id === "logo-icon") return true;
    const tag = String(node.tagName || "").toUpperCase();
    if (tag === "YTD-MASTHEAD" || tag === "YTD-TOPBAR-LOGO-RENDERER") return true;
    return Boolean(closestOf(node, "#masthead-container, ytd-masthead, #start"));
  }
  function nodeIsGuideHomeChrome(node) {
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
  function collectGestureNodes(event, pointNode, extraNodes) {
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
  function gestureHitsHomeChrome(event, { pointNode, extraNodes } = {}) {
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
  function shouldForceDietHomeOnStickyFeed({ feedSticky, hitsHomeChrome, insideDietRoot } = {}) {
    if (insideDietRoot && !hitsHomeChrome) return false;
    if (!hitsHomeChrome) return false;
    void feedSticky;
    return true;
  }
  function isOutsideDietHomeChromeGesture(event) {
    if (!event) return false;
    const hits = gestureHitsHomeChrome(event);
    if (hits) return true;
    if (pathContainsDietRoot(event)) return false;
    return Boolean(homeControlFromEvent(event));
  }

  // src/lib/surface.js
  function rootNeedsRemount({
    connected,
    hasChrome,
    shellBoundToRoot,
    liveIdMismatch
  } = {}) {
    if (liveIdMismatch) return true;
    if (!hasChrome) return true;
    if (!shellBoundToRoot) return true;
    if (connected === false && !hasChrome) return true;
    return false;
  }
  function shouldHideSurface({ phase, destPath, destSearch, homeIntent } = {}) {
    const dest = destPath || "";
    if (isHomePath(dest)) return false;
    if (homeIntent && isWatchLaterPlaylistPath(dest, destSearch)) return false;
    if (phase === "start" && homeIntent) return false;
    if (isWatchPath(dest)) return true;
    if (isWatchLaterPlaylistPath(dest, destSearch)) return true;
    return !isHomePath(dest);
  }
  function shouldRecoverWatchLaterBounce({
    path,
    search,
    homeIntent,
    event,
    prevWatch
  } = {}) {
    if (!isWatchLaterPlaylistPath(path, search)) return false;
    if (homeIntent) return true;
    if (prevWatch) return true;
    return event === NAV_EVENT.YT_HOME || event === NAV_EVENT.WATCH_TO_HOME;
  }
  function shouldPaintShell({ path, search, homeIntent } = {}) {
    if (isHomePath(path)) return true;
    return shouldRecoverWatchLaterBounce({ path, search, homeIntent });
  }
  function rootHasDietChrome(root2) {
    if (!root2 || typeof root2.querySelector !== "function") return false;
    return Boolean(root2.querySelector(".diet-yt-chrome, .diet-yt-boot-chrome"));
  }

  // src/lib/cache.js
  function createVideoCache() {
    return {
      byKey: /* @__PURE__ */ new Map(),
      tombstones: /* @__PURE__ */ new Map()
    };
  }
  function cacheKey(kind, id) {
    return `${kind}:${id || ""}`;
  }
  function tombstoneKeyForVideo(playlistId, videoId) {
    return `vid:${playlistId || "WL"}:${videoId}`;
  }
  function tombstoneKeyForSet(setVideoId) {
    return `set:${setVideoId}`;
  }
  var DEFAULT_TOMBSTONE_TTL_MS = 10 * 60 * 1e3;
  function pruneTombstones(tombstones, now = Date.now()) {
    for (const [key, expires] of tombstones) {
      if (expires <= now) tombstones.delete(key);
    }
  }
  function isTombstoned(video, tombstones, now = Date.now()) {
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
  function applyTombstones(videos, tombstones, now = Date.now()) {
    if (!Array.isArray(videos) || videos.length === 0) return [];
    return videos.filter((video) => !isTombstoned(video, tombstones, now));
  }
  function tombstoneRemoved(cache2, { playlistId = "WL", videoId, setVideoId, ttlMs = DEFAULT_TOMBSTONE_TTL_MS } = {}, now = Date.now()) {
    const expires = now + ttlMs;
    if (videoId) cache2.tombstones.set(tombstoneKeyForVideo(playlistId, videoId), expires);
    if (setVideoId) cache2.tombstones.set(tombstoneKeyForSet(setVideoId), expires);
    for (const entry of cache2.byKey.values()) {
      entry.videos = applyTombstones(entry.videos, cache2.tombstones, now);
    }
  }
  function tombstoneRemovedMany(cache2, items, playlistId = "WL", now = Date.now()) {
    for (const item of items || []) {
      tombstoneRemoved(
        cache2,
        {
          playlistId: item.playlistId || playlistId,
          videoId: item.videoId,
          setVideoId: item.setVideoId
        },
        now
      );
    }
  }
  function clearTombstonesFor(cache2, { playlistId = "WL", videoId, setVideoId } = {}) {
    if (videoId) cache2.tombstones.delete(tombstoneKeyForVideo(playlistId, videoId));
    if (setVideoId) cache2.tombstones.delete(tombstoneKeyForSet(setVideoId));
  }
  var CACHE_FRESH_MS = 8e3;
  var CACHE_SOFT_STALE_MS = 5 * 60 * 1e3;
  function putCache(cache2, key, videos, now = Date.now()) {
    return putCacheEntry(cache2, key, videos, now, now);
  }
  function putCacheEntry(cache2, key, videos, fetchedAt, now = Date.now()) {
    pruneTombstones(cache2.tombstones, now);
    const filtered = applyTombstones(videos, cache2.tombstones, now);
    cache2.byKey.set(key, { videos: filtered, fetchedAt: fetchedAt || now });
    return filtered;
  }
  function getCache(cache2, key, now = Date.now()) {
    const entry = cache2.byKey.get(key);
    if (!entry) return null;
    pruneTombstones(cache2.tombstones, now);
    const filtered = applyTombstones(entry.videos, cache2.tombstones, now);
    entry.videos = filtered;
    return filtered;
  }
  function inspectCache(cache2, key, now = Date.now()) {
    const entry = cache2.byKey.get(key);
    if (!entry) return { hit: false, videos: null, age: Infinity, fresh: false, stale: true };
    const videos = getCache(cache2, key, now);
    const age = now - (entry.fetchedAt || 0);
    return {
      hit: true,
      videos,
      age,
      fresh: age >= 0 && age < CACHE_FRESH_MS,
      stale: age >= CACHE_SOFT_STALE_MS
    };
  }

  // src/lib/tab-load.js
  function planTabLoad({ hit = false, fresh = false, force = false } = {}) {
    if (force) {
      return { paintCached: Boolean(hit), showSpinner: !hit, refresh: true };
    }
    if (hit) {
      return { paintCached: true, showSpinner: false, refresh: !fresh };
    }
    return { paintCached: false, showSpinner: true, refresh: true };
  }
  function warmTabIds({ currentTabId, customFeedIds } = {}) {
    const ids = [];
    const add = (id) => {
      if (!id || id === SYSTEM_TAB.FEED || ids.includes(id)) return;
      ids.push(id);
    };
    add(SYSTEM_TAB.WATCH_LATER);
    add(SYSTEM_TAB.SUBSCRIPTIONS);
    add(currentTabId);
    for (const id of customFeedIds || []) add(id);
    return ids;
  }
  var PREFETCH_GAP_MS = 450;

  // src/lib/snapshot.js
  var TAB_SNAPSHOT_STORAGE_KEY = "dietYtTabSnap";
  var SNAPSHOT_MAX_VIDEOS = 80;
  function shouldPersistTabSnapshot(tabId) {
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
      publishedMs: video.publishedMs
    };
  }
  function serializeTabSnapshot(tabId, videos, now = Date.now()) {
    const trimmed = (videos || []).map(trimVideo).filter(Boolean).slice(0, SNAPSHOT_MAX_VIDEOS);
    return { tabId, videos: trimmed, fetchedAt: now };
  }
  function mergeTabSnapshot(store, tabId, videos, now = Date.now()) {
    const next = {
      version: 1,
      tabs: { ...store?.tabs && typeof store.tabs === "object" ? store.tabs : {} }
    };
    if (!shouldPersistTabSnapshot(tabId)) return next;
    next.tabs[tabId] = serializeTabSnapshot(tabId, videos, now);
    return next;
  }
  function hydrateEntriesFromSnapshot(store) {
    if (!store?.tabs || typeof store.tabs !== "object") return [];
    const out = [];
    for (const [tabId, entry] of Object.entries(store.tabs)) {
      if (!shouldPersistTabSnapshot(tabId) || !entry) continue;
      out.push({
        key: cacheKey("tab", tabId),
        videos: Array.isArray(entry.videos) ? entry.videos : [],
        fetchedAt: Number(entry.fetchedAt) || 0
      });
    }
    return out;
  }
  function hydrateCacheFromSnapshot(cache2, store, now = Date.now()) {
    let n = 0;
    for (const entry of hydrateEntriesFromSnapshot(store)) {
      putCacheEntry(cache2, entry.key, entry.videos, entry.fetchedAt, now);
      n += 1;
    }
    return n;
  }

  // src/lib/view.js
  var ICONS_DENSITY_MINMAX_PX = Object.freeze({
    [ICONS_DENSITY.COMFORTABLE]: 280,
    [ICONS_DENSITY.DEFAULT]: 210,
    [ICONS_DENSITY.DENSE]: 160
  });
  function normalizeIconsDensity(density) {
    if (density === ICONS_DENSITY.COMFORTABLE || density === ICONS_DENSITY.DENSE) return density;
    return ICONS_DENSITY.DEFAULT;
  }
  function iconsMinmaxPx(density) {
    return ICONS_DENSITY_MINMAX_PX[normalizeIconsDensity(density)];
  }
  var POSTED_MS = {
    [POSTED_WITHIN.ANY]: 0,
    [POSTED_WITHIN.D1]: 1 * 864e5,
    [POSTED_WITHIN.D3]: 3 * 864e5,
    [POSTED_WITHIN.D7]: 7 * 864e5,
    [POSTED_WITHIN.D14]: 14 * 864e5,
    [POSTED_WITHIN.D30]: 30 * 864e5
  };
  function postedWithinMs(postedWithin) {
    return POSTED_MS[postedWithin] || 0;
  }
  function applyView(videos, { sort = SORT.NEWEST, postedWithin = POSTED_WITHIN.ANY } = {}, now = Date.now()) {
    if (!Array.isArray(videos)) return [];
    let out = videos.slice();
    const windowMs = postedWithinMs(postedWithin);
    if (windowMs > 0) {
      const cutoff = now - windowMs;
      out = out.filter((v) => v.publishedMs == null || v.publishedMs >= cutoff);
    }
    if (sort === SORT.OLDEST) {
      out.sort((a, b) => (a.publishedMs || 0) - (b.publishedMs || 0));
    } else if (sort === SORT.CHANNEL) {
      out.sort(
        (a, b) => String(a.channelTitle || "").localeCompare(String(b.channelTitle || ""), void 0, {
          sensitivity: "base"
        })
      );
    } else {
      out.sort((a, b) => (b.publishedMs || 0) - (a.publishedMs || 0));
    }
    return out;
  }
  function viewsEqual(a, b) {
    return a?.layout === b?.layout && a?.sort === b?.sort && a?.postedWithin === b?.postedWithin && normalizeIconsDensity(a?.density) === normalizeIconsDensity(b?.density);
  }
  function resolveSessionView(saved, sessionView) {
    if (!sessionView) return { ...saved };
    return { ...saved, ...sessionView };
  }

  // src/lib/prefs.js
  var DEFAULT_PREFS = Object.freeze({
    version: 1,
    defaultHome: SYSTEM_TAB.WATCH_LATER,
    customFeeds: [],
    customTabOrder: [],
    viewByTab: Object.freeze({
      [SYSTEM_TAB.FEED]: { ...DEFAULT_VIEW },
      [SYSTEM_TAB.WATCH_LATER]: { ...DEFAULT_VIEW },
      [SYSTEM_TAB.SUBSCRIPTIONS]: { ...DEFAULT_VIEW }
    })
  });
  function cloneView(view) {
    return {
      layout: view?.layout || DEFAULT_VIEW.layout,
      sort: view?.sort || DEFAULT_VIEW.sort,
      postedWithin: view?.postedWithin || DEFAULT_VIEW.postedWithin,
      density: normalizeIconsDensity(view?.density || DEFAULT_VIEW.density)
    };
  }
  function migratePrefs(raw) {
    const base = {
      version: 1,
      defaultHome: SYSTEM_TAB.WATCH_LATER,
      customFeeds: [],
      customTabOrder: [],
      viewByTab: {}
    };
    if (!raw || typeof raw !== "object") {
      return {
        ...base,
        viewByTab: {
          [SYSTEM_TAB.FEED]: cloneView(DEFAULT_VIEW),
          [SYSTEM_TAB.WATCH_LATER]: cloneView(DEFAULT_VIEW),
          [SYSTEM_TAB.SUBSCRIPTIONS]: cloneView(DEFAULT_VIEW)
        }
      };
    }
    const customFeeds = Array.isArray(raw.customFeeds) ? raw.customFeeds.filter((f) => f && f.id && f.name).map((f) => ({
      id: String(f.id),
      name: String(f.name),
      sources: Array.isArray(f.sources) ? f.sources.filter((s) => s && s.id && (s.type === "channel" || s.type === "playlist")).map((s) => ({
        type: s.type,
        id: String(s.id),
        label: String(s.label || s.id)
      })) : []
    })) : [];
    const knownIds = /* @__PURE__ */ new Set([
      SYSTEM_TAB.FEED,
      SYSTEM_TAB.WATCH_LATER,
      SYSTEM_TAB.SUBSCRIPTIONS,
      ...customFeeds.map((f) => f.id)
    ]);
    const customTabOrder = (Array.isArray(raw.customTabOrder) ? raw.customTabOrder : customFeeds.map((f) => f.id)).map(String).filter((id) => knownIds.has(id) && !isSystemTabId(id));
    for (const feed of customFeeds) {
      if (!customTabOrder.includes(feed.id)) customTabOrder.push(feed.id);
    }
    const viewByTab = {};
    const incoming = raw.viewByTab && typeof raw.viewByTab === "object" ? raw.viewByTab : {};
    for (const id of knownIds) {
      viewByTab[id] = cloneView(incoming[id] || DEFAULT_VIEW);
    }
    let defaultHome = raw.defaultHome || SYSTEM_TAB.WATCH_LATER;
    if (defaultHome === SYSTEM_TAB.FEED || !knownIds.has(defaultHome)) {
      defaultHome = SYSTEM_TAB.WATCH_LATER;
    }
    return {
      version: 1,
      defaultHome,
      customFeeds,
      customTabOrder,
      viewByTab
    };
  }
  function isSystemTabId(id) {
    return id === SYSTEM_TAB.FEED || id === SYSTEM_TAB.WATCH_LATER || id === SYSTEM_TAB.SUBSCRIPTIONS;
  }
  function getViewForTab(prefs, tabId) {
    return cloneView(prefs?.viewByTab?.[tabId] || DEFAULT_VIEW);
  }
  function setViewForTab(prefs, tabId, view) {
    return {
      ...prefs,
      viewByTab: {
        ...prefs.viewByTab,
        [tabId]: cloneView(view)
      }
    };
  }
  function findCustomFeed(prefs, feedId) {
    return (prefs.customFeeds || []).find((f) => f.id === feedId) || null;
  }
  function upsertCustomFeed(prefs, feed) {
    const customFeeds = (prefs.customFeeds || []).slice();
    const idx = customFeeds.findIndex((f) => f.id === feed.id);
    if (idx >= 0) customFeeds[idx] = feed;
    else customFeeds.push(feed);
    const customTabOrder = (prefs.customTabOrder || []).slice();
    if (!customTabOrder.includes(feed.id)) customTabOrder.push(feed.id);
    const viewByTab = { ...prefs.viewByTab };
    if (!viewByTab[feed.id]) viewByTab[feed.id] = cloneView(DEFAULT_VIEW);
    return { ...prefs, customFeeds, customTabOrder, viewByTab };
  }
  function removeCustomFeed(prefs, feedId) {
    const customFeeds = (prefs.customFeeds || []).filter((f) => f.id === feedId ? false : true);
    const customTabOrder = (prefs.customTabOrder || []).filter((id) => id !== feedId);
    const viewByTab = { ...prefs.viewByTab };
    delete viewByTab[feedId];
    let defaultHome = prefs.defaultHome;
    if (defaultHome === feedId) defaultHome = SYSTEM_TAB.WATCH_LATER;
    return { ...prefs, customFeeds, customTabOrder, viewByTab, defaultHome };
  }
  function reorderCustomTabs(prefs, orderedIds) {
    const allowed = new Set((prefs.customFeeds || []).map((f) => f.id));
    const customTabOrder = orderedIds.filter((id) => allowed.has(id));
    for (const id of allowed) {
      if (!customTabOrder.includes(id)) customTabOrder.push(id);
    }
    return { ...prefs, customTabOrder };
  }
  function newFeedId() {
    return `cf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }
  async function loadPrefs() {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      const got = await chrome.storage.local.get("prefs");
      return migratePrefs(got.prefs);
    }
    return migratePrefs(null);
  }
  async function savePrefs(prefs) {
    const next = migratePrefs(prefs);
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      await chrome.storage.local.set({ prefs: next });
    }
    return next;
  }

  // src/lib/tabs.js
  function tabLabel(prefs, tabId) {
    if (SYSTEM_TAB_LABELS[tabId]) return SYSTEM_TAB_LABELS[tabId];
    const feed = findCustomFeed(prefs, tabId);
    return feed?.name || "Feed";
  }
  function buildTabStrip(prefs) {
    const custom = (prefs.customTabOrder || []).map((id) => findCustomFeed(prefs, id)).filter(Boolean).map((feed) => ({ id: feed.id, type: "custom", label: feed.name }));
    return [...SYSTEM_TABS.map((t) => ({ ...t })), ...custom];
  }
  function playlistIdForTab(prefs, tabId) {
    if (tabId === SYSTEM_TAB.WATCH_LATER) return "WL";
    const feed = findCustomFeed(prefs, tabId);
    if (!feed) return null;
    const playlists = (feed.sources || []).filter((s) => s.type === "playlist");
    if (playlists.length === 1 && feed.sources.length === 1) return playlists[0].id;
    return null;
  }
  function isQueueTab(prefs, tabId) {
    if (tabId === SYSTEM_TAB.WATCH_LATER) return true;
    return playlistIdForTab(prefs, tabId) != null;
  }

  // src/lib/sheet-events.js
  function eventElement(target) {
    if (!target) return null;
    if (typeof target.closest === "function") return target;
    return target.parentElement || null;
  }
  function sheetActionFromClick(target) {
    target = eventElement(target);
    if (!target) return null;
    if (target.closest("[data-save-feed]")) return "save";
    if (target.closest("[data-delete-feed]")) return "delete";
    if (target.closest("[data-confirm-delete]")) return "confirm-delete";
    if (target.closest("[data-add-source]")) return "add-source";
    if (target.closest("[data-remove-source]")) return "remove-source";
    if (target.closest("[data-resolve]")) return "resolve";
    if (target.closest("[data-retry]")) return "retry";
    if (target.closest("[data-undo]")) return "undo";
    if (target.closest("button[data-dismiss-sheet]")) return "dismiss";
    if (target.classList?.contains("diet-yt-sheet-backdrop")) return "dismiss";
    return null;
  }

  // src/ui/icons.js
  function svg(path, size = 20) {
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" fill="currentColor">${path}</svg>`;
  }
  var ICONS = {
    sliders: `<path d="M3 6h10v2H3V6zm0 10h6v2H3v-2zm8 2v-2h10v2H11zM21 8h-6V6h6v2zM9 11H3v2h6v2l3-3-3-3v2zm12 0h-8v2h8v-2z"/>`,
    close: `<path d="M18.3 5.71 12 12.01l-6.3-6.3-1.4 1.41 6.29 6.29-6.3 6.3 1.42 1.4 6.29-6.29 6.3 6.3 1.4-1.42-6.29-6.29 6.3-6.3z"/>`,
    pencil: `<path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>`,
    check: `<path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>`,
    more: `<path d="M12 16.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5-1.5-.67-1.5-1.5.67-1.5 1.5-1.5zM10.5 12c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5-.67-1.5-1.5-1.5-1.5.67-1.5 1.5zm0-6c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5S13.33 4.5 12 4.5 10.5 5.17 10.5 6z"/>`
  };

  // src/ui/shell.js
  var POSTED_LABELS = {
    [POSTED_WITHIN.ANY]: "Any time",
    [POSTED_WITHIN.D1]: "Last 24 hours",
    [POSTED_WITHIN.D3]: "Last 3 days",
    [POSTED_WITHIN.D7]: "Last 7 days",
    [POSTED_WITHIN.D14]: "Last 14 days",
    [POSTED_WITHIN.D30]: "Last 30 days"
  };
  var SORT_LABELS = {
    [SORT.NEWEST]: "Newest",
    [SORT.OLDEST]: "Oldest",
    [SORT.CHANNEL]: "Channel A\u2013Z"
  };
  var DENSITY_LABELS = {
    [ICONS_DENSITY.COMFORTABLE]: "Comfortable",
    [ICONS_DENSITY.DEFAULT]: "Default",
    [ICONS_DENSITY.DENSE]: "Dense"
  };
  function el(html) {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }
  function escapeHtml(s) {
    return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function createShell(root2, handlers2) {
    root2.id = "diet-yt-root";
    root2.innerHTML = `
    <div class="diet-yt-chrome">
      <div class="diet-yt-tabs" role="tablist" aria-label="Diet-Youtube feeds"></div>
      <button type="button" class="diet-yt-plus" title="New feed" aria-label="Create custom feed">\uFF0B</button>
      <div class="diet-yt-chrome-tools">
        <div class="diet-yt-seg" role="group" aria-label="Layout">
          <button type="button" data-layout="list">List</button>
          <button type="button" data-layout="icons">Icons</button>
        </div>
        <div class="diet-yt-view-wrap">
          <button type="button" class="diet-yt-icon-btn diet-yt-view-btn" aria-haspopup="true" aria-expanded="false" title="View options" aria-label="View options">
            ${svg(ICONS.sliders)}
          </button>
          <div class="diet-yt-menu" hidden></div>
        </div>
      </div>
    </div>
    <div class="diet-yt-body">
      <div class="diet-yt-bulk" hidden></div>
      <div class="diet-yt-surface"></div>
    </div>
  `;
    const tabsEl = root2.querySelector(".diet-yt-tabs");
    const plusBtn = root2.querySelector(".diet-yt-plus");
    const viewBtn = root2.querySelector(".diet-yt-view-btn");
    const menuEl = root2.querySelector(".diet-yt-menu");
    const bodyEl = root2.querySelector(".diet-yt-body");
    const surfaceEl = root2.querySelector(".diet-yt-surface");
    const bulkEl = root2.querySelector(".diet-yt-bulk");
    const seg = root2.querySelector(".diet-yt-seg");
    plusBtn.addEventListener("click", () => handlers2.onCreateFeed());
    viewBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      handlers2.onToggleViewMenu();
    });
    seg.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-layout]");
      if (!btn) return;
      handlers2.onLayoutChange(btn.dataset.layout);
    });
    tabsEl.addEventListener("click", (e) => {
      const edit = e.target.closest("[data-edit-feed]");
      if (edit) {
        e.preventDefault();
        e.stopPropagation();
        handlers2.onEditFeed(edit.dataset.editFeed);
        return;
      }
      const tab = e.target.closest("[data-tab]");
      if (!tab) return;
      handlers2.onTabClick(tab.dataset.tab);
    });
    let dragId = null;
    tabsEl.addEventListener("pointerdown", (e) => {
      const tab = e.target.closest("[data-tab]");
      if (!tab || tab.dataset.kind !== "custom") return;
      if (e.target.closest("[data-edit-feed]")) return;
      dragId = tab.dataset.tab;
      tab.classList.add("is-dragging");
      tab.setPointerCapture(e.pointerId);
    });
    tabsEl.addEventListener("pointermove", (e) => {
      if (!dragId) return;
      const over = document.elementFromPoint(e.clientX, e.clientY)?.closest?.("[data-tab]");
      tabsEl.querySelectorAll(".diet-yt-drop").forEach((n) => n.remove());
      if (!over || over.dataset.kind !== "custom" || over.dataset.tab === dragId) return;
      const rect = over.getBoundingClientRect();
      const before = e.clientX < rect.left + rect.width / 2;
      const marker = document.createElement("div");
      marker.className = "diet-yt-drop";
      if (before) over.before(marker);
      else over.after(marker);
    });
    tabsEl.addEventListener("pointerup", (e) => {
      if (!dragId) return;
      const id = dragId;
      dragId = null;
      tabsEl.querySelectorAll(".is-dragging").forEach((n) => n.classList.remove("is-dragging"));
      const marker = tabsEl.querySelector(".diet-yt-drop");
      const ids = [...tabsEl.querySelectorAll("[data-tab][data-kind='custom']")].map((n) => n.dataset.tab);
      if (marker) {
        const next = marker.nextElementSibling?.dataset?.tab;
        const filtered = ids.filter((x) => x !== id);
        const at = next ? filtered.indexOf(next) : filtered.length;
        filtered.splice(Math.max(at, 0), 0, id);
        marker.remove();
        handlers2.onReorderCustom(filtered);
      }
      try {
        e.currentTarget.releasePointerCapture?.(e.pointerId);
      } catch (_) {
      }
    });
    surfaceEl.addEventListener("click", (e) => {
      const more = e.target.closest("[data-more]");
      if (more) {
        e.preventDefault();
        e.stopPropagation();
        handlers2.onOpenMore(more.dataset.more);
        return;
      }
      const remove = e.target.closest("[data-remove]");
      if (remove) {
        e.preventDefault();
        e.stopPropagation();
        handlers2.onRemoveOne(remove.dataset.remove);
        return;
      }
      const check = e.target.closest("[data-toggle]");
      if (check) {
        e.preventDefault();
        e.stopPropagation();
        handlers2.onToggleSelect(check.dataset.toggle, e.shiftKey);
        return;
      }
      const card = e.target.closest("[data-video]");
      if (!card) return;
      if (e.metaKey || e.ctrlKey) {
        handlers2.onToggleSelect(card.dataset.video, e.shiftKey);
        return;
      }
      if (e.shiftKey) {
        handlers2.onToggleSelect(card.dataset.video, true);
        return;
      }
      handlers2.onOpenVideo(card.dataset.video);
    });
    bulkEl.addEventListener("click", (e) => {
      if (e.target.closest("[data-bulk-remove]")) handlers2.onRemoveSelected();
      if (e.target.closest("[data-bulk-clear]")) handlers2.onClearSelection();
    });
    bodyEl.addEventListener("click", (e) => {
      const action = sheetActionFromClick(e.target);
      if (action === "retry") handlers2.onRetry();
      if (action === "save") handlers2.onSaveSheet();
      if (action === "delete") handlers2.onDeleteSheet();
      if (action === "confirm-delete") handlers2.onConfirmDelete();
      if (action === "add-source") {
        const btn = e.target.closest("[data-add-source]");
        handlers2.onAddSource(btn.dataset.addSource, btn.dataset.sourceType, btn.dataset.sourceLabel);
      }
      if (action === "remove-source") {
        handlers2.onRemoveSource(e.target.closest("[data-remove-source]").dataset.removeSource);
      }
      if (action === "resolve") handlers2.onResolveSource();
      if (action === "undo") handlers2.onUndo();
      if (action === "dismiss") handlers2.onCloseSheet();
      if (e.target.closest("[data-save-wl]")) {
        e.preventDefault();
        e.stopPropagation();
        handlers2.onSaveToWatchLater(e.target.closest("[data-save-wl]").dataset.saveWl);
        return;
      }
      if (e.target.closest("[data-save-playlist]")) {
        e.preventDefault();
        e.stopPropagation();
        handlers2.onOpenPlaylistPicker(e.target.closest("[data-save-playlist]").dataset.savePlaylist);
        return;
      }
      if (e.target.closest("[data-pick-playlist]")) {
        e.preventDefault();
        e.stopPropagation();
        const btn = e.target.closest("[data-pick-playlist]");
        handlers2.onPickPlaylist(btn.dataset.pickPlaylist, btn.dataset.playlistLabel);
        return;
      }
      if (e.target.closest("[data-dismiss-picker]")) {
        e.preventDefault();
        handlers2.onClosePlaylistPicker();
      }
    });
    menuEl.addEventListener("click", (e) => {
      const item = e.target.closest("[data-sort],[data-posted],[data-home],[data-density]");
      if (item?.dataset.sort) handlers2.onSortChange(item.dataset.sort);
      if (item?.dataset.posted) handlers2.onPostedChange(item.dataset.posted);
      if (item?.dataset.home) handlers2.onDefaultHomeChange(item.dataset.home);
      if (item?.dataset.density) handlers2.onDensityChange(item.dataset.density);
      if (e.target.closest("[data-save-view]")) handlers2.onSaveView();
    });
    const onDocClick = (e) => {
      if (!root2.contains(e.target)) return;
      if (e.target.closest?.(".diet-yt-sheet, .diet-yt-sheet-backdrop, .diet-yt-toast, .diet-yt-picker")) return;
      if (!e.target.closest(".diet-yt-view-wrap")) handlers2.onCloseViewMenu();
      if (!e.target.closest("[data-more], .diet-yt-more-menu")) handlers2.onCloseMore?.();
    };
    document.addEventListener("click", onDocClick);
    function render(state2) {
      renderTabs(tabsEl, state2);
      renderSeg(seg, state2);
      renderViewMenu(menuEl, viewBtn, state2);
      renderBulk(bulkEl, state2);
      renderSurface(surfaceEl, state2);
      renderSheet(bodyEl, state2, handlers2);
      renderMoreMenu(root2, bodyEl, state2);
      renderPlaylistPicker(bodyEl, state2, handlers2);
      renderToast(bodyEl, state2);
    }
    function destroy() {
      document.removeEventListener("click", onDocClick);
    }
    return { render, root: root2, bodyEl, destroy };
  }
  function renderTabs(tabsEl, state2) {
    const tabs = buildTabStrip(state2.prefs);
    tabsEl.innerHTML = tabs.map((tab) => {
      const selected = tab.id === state2.session.tabId;
      const edit = tab.type === "custom" && selected ? `<button type="button" class="diet-yt-tab-edit" data-edit-feed="${escapeHtml(tab.id)}" title="Edit feed" aria-label="Edit ${escapeHtml(tab.label)}">${svg(ICONS.pencil, 14)}</button>` : "";
      return `<button type="button" class="diet-yt-tab" role="tab" data-tab="${escapeHtml(tab.id)}" data-kind="${tab.type}" aria-selected="${selected}">
        <span>${escapeHtml(tab.label)}</span>${edit}
      </button>`;
    }).join("");
  }
  function renderSeg(seg, state2) {
    for (const btn of seg.querySelectorAll("[data-layout]")) {
      btn.setAttribute("aria-pressed", String(btn.dataset.layout === state2.view.layout));
    }
  }
  function renderViewMenu(menuEl, viewBtn, state2) {
    const open = Boolean(state2.viewMenuOpen);
    viewBtn.setAttribute("aria-expanded", String(open));
    menuEl.hidden = !open;
    if (!open) return;
    const label = tabLabel(state2.prefs, state2.session.tabId);
    const dirty = state2.viewDirty;
    const density = normalizeIconsDensity(state2.view.density);
    menuEl.innerHTML = `
    <div class="diet-yt-menu-label">Sort</div>
    ${Object.entries(SORT_LABELS).map(
      ([id, text]) => `<button type="button" class="diet-yt-item" data-sort="${id}" role="menuitemradio" aria-checked="${state2.view.sort === id}">${escapeHtml(text)}</button>`
    ).join("")}
    <div class="diet-yt-menu-sep"></div>
    <div class="diet-yt-menu-label">Posted within</div>
    ${Object.entries(POSTED_LABELS).map(
      ([id, text]) => `<button type="button" class="diet-yt-item" data-posted="${id}" role="menuitemradio" aria-checked="${state2.view.postedWithin === id}">${escapeHtml(text)}</button>`
    ).join("")}
    <div class="diet-yt-menu-sep"></div>
    <div class="diet-yt-menu-label">Icons density</div>
    ${Object.entries(DENSITY_LABELS).map(
      ([id, text]) => `<button type="button" class="diet-yt-item" data-density="${id}" role="menuitemradio" aria-checked="${density === id}">${escapeHtml(text)}</button>`
    ).join("")}
    <div class="diet-yt-menu-sep"></div>
    <div class="diet-yt-menu-label">Default home</div>
    <button type="button" class="diet-yt-item" data-home="watch-later" aria-checked="${state2.prefs.defaultHome === "watch-later"}">Watch later</button>
    <button type="button" class="diet-yt-item" data-home="subscriptions" aria-checked="${state2.prefs.defaultHome === "subscriptions"}">Subscriptions</button>
    <div class="diet-yt-menu-sep"></div>
    <p class="diet-yt-menu-hint">Applies to this tab now. Save as default to keep it next visit.</p>
    <button type="button" class="diet-yt-menu-save" data-save-view ${dirty ? "" : "disabled"}>Save as default for ${escapeHtml(label)}</button>
  `;
  }
  function renderBulk(bulkEl, state2) {
    const n = state2.selected?.size || 0;
    if (!n || !state2.canRemove) {
      bulkEl.hidden = true;
      bulkEl.innerHTML = "";
      return;
    }
    bulkEl.hidden = false;
    bulkEl.innerHTML = `
    <span>${n} selected</span>
    <button type="button" class="diet-yt-danger" data-bulk-remove>Remove ${n}</button>
    <button type="button" class="diet-yt-ghost" data-bulk-clear>Clear</button>
  `;
  }
  function metaLine(video) {
    return [video.channelTitle, video.viewCountText, video.publishedText].filter(Boolean).join(" \xB7 ");
  }
  function moreButton(video, state2) {
    const open = state2.cardMenu?.videoId === video.videoId;
    return `<button type="button" class="diet-yt-more" data-more="${escapeHtml(video.videoId)}" title="More actions" aria-label="More actions for ${escapeHtml(video.title)}" aria-haspopup="menu" aria-expanded="${open}">${svg(ICONS.more, 20)}</button>`;
  }
  function cardActions(video, state2) {
    const selected = state2.selected?.has(video.videoId);
    const remove = state2.canRemove ? `<button type="button" class="diet-yt-card-x" data-remove="${escapeHtml(video.videoId)}" title="Remove" aria-label="Remove ${escapeHtml(video.title)}">${svg(ICONS.close, 16)}</button>` : "";
    const check = state2.canRemove ? `<button type="button" class="diet-yt-check" data-toggle="${escapeHtml(video.videoId)}" aria-pressed="${selected}" aria-label="Select">${selected ? svg(ICONS.check, 16) : ""}</button>` : "";
    return check + remove + moreButton(video, state2);
  }
  function renderSurface(surfaceEl, state2) {
    const density = normalizeIconsDensity(state2.view.density);
    const iconMin = iconsMinmaxPx(density);
    const iconsAttr = `class="diet-yt-icons" data-density="${density}" style="--diet-icon-min:${iconMin}px"`;
    if (state2.loading && !state2.videos.length) {
      const skel = state2.view.layout === LAYOUT.LIST ? `<div class="diet-yt-list">${Array.from({ length: 8 }, () => `<div class="diet-yt-row"><div></div><div class="diet-yt-skel" style="height:90px"></div><div><div class="diet-yt-skel" style="height:14px;width:70%;margin-bottom:8px"></div><div class="diet-yt-skel" style="height:12px;width:40%"></div></div></div>`).join("")}</div>` : `<div ${iconsAttr}>${Array.from({ length: 8 }, () => `<div class="diet-yt-skel-card"><div class="diet-yt-skel diet-yt-skel-thumb"></div><div class="diet-yt-skel diet-yt-skel-line"></div><div class="diet-yt-skel diet-yt-skel-line short"></div></div>`).join("")}</div>`;
      surfaceEl.innerHTML = skel;
      return;
    }
    if (state2.error) {
      surfaceEl.innerHTML = `<div class="diet-yt-error"><h2>Couldn\u2019t load this feed</h2><p>${escapeHtml(state2.error)}</p><button type="button" class="diet-yt-retry" data-retry>Try again</button></div>`;
      return;
    }
    if (!state2.videos.length) {
      surfaceEl.innerHTML = `<div class="diet-yt-empty"><h2>${escapeHtml(state2.emptyTitle)}</h2><p>${escapeHtml(state2.emptyBody)}</p></div>`;
      return;
    }
    if (state2.view.layout === LAYOUT.LIST) {
      surfaceEl.innerHTML = `<div class="diet-yt-list">${state2.videos.map((video) => {
        const selected = state2.selected?.has(video.videoId);
        return `<div class="diet-yt-row${selected ? " is-selected" : ""}" data-video="${escapeHtml(video.videoId)}" role="link" tabindex="0">
          <div>${state2.canRemove ? `<button type="button" class="diet-yt-check" data-toggle="${escapeHtml(video.videoId)}" aria-pressed="${selected}">${selected ? "\u2713" : ""}</button>` : ""}</div>
          <div class="diet-yt-thumb"><img alt="" src="${escapeHtml(video.thumbUrl)}">${video.lengthText ? `<span class="diet-yt-dur">${escapeHtml(video.lengthText)}</span>` : ""}</div>
          <div><div class="diet-yt-row-title">${escapeHtml(video.title)}</div><div class="diet-yt-row-sub">${escapeHtml(metaLine(video))}</div></div>
          <div class="diet-yt-row-actions">${state2.canRemove ? `<button type="button" class="diet-yt-card-x" data-remove="${escapeHtml(video.videoId)}" aria-label="Remove">\u2715</button>` : ""}${moreButton(video, state2)}</div>
        </div>`;
      }).join("")}</div>`;
      return;
    }
    surfaceEl.innerHTML = `<div ${iconsAttr}>${state2.videos.map((video) => {
      const selected = state2.selected?.has(video.videoId);
      return `<article class="diet-yt-card${selected ? " is-selected" : ""}" data-video="${escapeHtml(video.videoId)}" tabindex="0">
        <div class="diet-yt-thumb">
          <img alt="" src="${escapeHtml(video.thumbUrl)}">
          ${video.lengthText ? `<span class="diet-yt-dur">${escapeHtml(video.lengthText)}</span>` : ""}
          ${cardActions(video, state2)}
        </div>
        <div class="diet-yt-card-meta">
          <div class="diet-yt-card-title">${escapeHtml(video.title)}</div>
          <div class="diet-yt-card-sub">${escapeHtml(metaLine(video))}</div>
        </div>
      </article>`;
    }).join("")}</div>`;
  }
  function renderSheet(bodyEl, state2, handlers2) {
    bodyEl.querySelector(".diet-yt-sheet-backdrop")?.remove();
    const sheet = state2.sheet;
    if (!sheet) return;
    const creating = sheet.mode === "create";
    const confirm = sheet.confirmDelete;
    const advanced = sheet.advanced;
    const suggestions = sheet.suggestions || [];
    const node = el(`<div class="diet-yt-sheet-backdrop" data-dismiss-sheet>
    <div class="diet-yt-sheet" role="dialog" aria-labelledby="diet-yt-sheet-title">
      <h2 id="diet-yt-sheet-title">${creating ? "New feed" : "Edit feed"}</h2>
      <div class="diet-yt-field">
        <label for="diet-yt-feed-name">Name</label>
        <input id="diet-yt-feed-name" value="${escapeHtml(sheet.name)}" placeholder="e.g. Late night" />
      </div>
      <div class="diet-yt-field">
        <label for="diet-yt-feed-source">Sources</label>
        <input id="diet-yt-feed-source" value="${escapeHtml(sheet.query || "")}" placeholder="Search channels or paste a URL" />
        <div>
          <button type="button" class="diet-yt-ghost" data-resolve>Add</button>
        </div>
        ${suggestions.length ? `<div class="diet-yt-suggest">${suggestions.map(
      (s) => `<button type="button" data-add-source="${escapeHtml(s.id)}" data-source-type="${escapeHtml(s.type)}" data-source-label="${escapeHtml(s.label)}">${escapeHtml(s.label)} <span style="color:#aaa">\xB7 ${s.type}</span></button>`
    ).join("")}</div>` : ""}
      </div>
      <div>${(sheet.sources || []).map(
      (s) => `<div class="diet-yt-source-row">
            <div><strong>${escapeHtml(s.label)}</strong>${advanced ? `<span class="diet-yt-source-id">${escapeHtml(s.id)}</span>` : ""}</div>
            <button type="button" class="diet-yt-ghost" data-remove-source="${escapeHtml(s.id)}">Remove</button>
          </div>`
    ).join("")}</div>
      <details class="diet-yt-advanced" ${advanced ? "open" : ""}>
        <summary>Advanced (IDs)</summary>
        <p class="diet-yt-card-sub">Channel and playlist IDs stay here \u2014 never on the reading surface.</p>
      </details>
      ${confirm ? `<p>Delete \u201C${escapeHtml(sheet.name || "this feed")}\u201D? This only removes the Diet-Youtube tab.</p>` : ""}
      <div class="diet-yt-sheet-actions">
        ${!creating ? `<button type="button" class="diet-yt-btn-delete" data-${confirm ? "confirm-delete" : "delete-feed"}>${confirm ? "Delete feed" : "Delete"}</button>` : ""}
        <button type="button" class="diet-yt-btn-secondary" data-dismiss-sheet>Cancel</button>
        <button type="button" class="diet-yt-btn-primary" data-save-feed>Save feed</button>
      </div>
    </div>
  </div>`);
    const nameInput = node.querySelector("#diet-yt-feed-name");
    const sourceInput = node.querySelector("#diet-yt-feed-source");
    nameInput.addEventListener("input", () => {
      state2.sheet.name = nameInput.value;
    });
    sourceInput.addEventListener("input", () => {
      state2.sheet.query = sourceInput.value;
    });
    sourceInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        document.querySelector("#diet-yt-root")?.dispatchEvent(new CustomEvent("diet-yt-resolve"));
      }
    });
    node.querySelector(".diet-yt-advanced")?.addEventListener("toggle", (e) => {
      state2.sheet.advanced = e.target.open;
      const rows = node.querySelectorAll(".diet-yt-source-id");
      rows.forEach((row) => {
        row.hidden = !e.target.open;
      });
    });
    const bind = (selector, fn) => {
      node.querySelector(selector)?.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        fn(e);
      });
    };
    bind("[data-save-feed]", () => handlers2.onSaveSheet());
    bind("button[data-dismiss-sheet]", () => handlers2.onCloseSheet());
    bind("[data-delete-feed]", () => handlers2.onDeleteSheet());
    bind("[data-confirm-delete]", () => handlers2.onConfirmDelete());
    bind("[data-resolve]", () => handlers2.onResolveSource());
    node.querySelectorAll("[data-add-source]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        handlers2.onAddSource(btn.dataset.addSource, btn.dataset.sourceType, btn.dataset.sourceLabel);
      });
    });
    node.querySelectorAll("[data-remove-source]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        handlers2.onRemoveSource(btn.dataset.removeSource);
      });
    });
    node.addEventListener("click", (e) => {
      if (e.target === node) handlers2.onCloseSheet();
    });
    bodyEl.appendChild(node);
    queueMicrotask(() => nameInput.focus());
  }
  function renderMoreMenu(root2, bodyEl, state2) {
    bodyEl.querySelector(".diet-yt-more-menu")?.remove();
    const videoId = state2.cardMenu?.videoId;
    if (!videoId) return;
    const items = moreMenuItems(state2.session.tabId);
    const menu = el(`<div class="diet-yt-more-menu" role="menu">
    ${items.map((item) => {
      const attr = item.id === "save-wl" ? "data-save-wl" : "data-save-playlist";
      return `<button type="button" class="diet-yt-item" role="menuitem" ${attr}="${escapeHtml(videoId)}">${escapeHtml(item.label)}</button>`;
    }).join("")}
  </div>`);
    bodyEl.appendChild(menu);
    const btn = root2.querySelector(`[data-more="${CSS.escape(videoId)}"]`);
    if (!btn) return;
    const rootRect = root2.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    const top = btnRect.bottom - rootRect.top + 4;
    let left = btnRect.right - rootRect.left - 240;
    left = Math.max(8, Math.min(left, rootRect.width - 248));
    menu.style.top = `${top}px`;
    menu.style.left = `${left}px`;
  }
  function renderPlaylistPicker(bodyEl, state2, handlers2) {
    bodyEl.querySelector(".diet-yt-picker")?.remove();
    const picker = state2.playlistPicker;
    if (!picker) return;
    const items = picker.items || [];
    const node = el(`<div class="diet-yt-sheet-backdrop diet-yt-picker" data-dismiss-picker>
    <div class="diet-yt-sheet" role="dialog" aria-labelledby="diet-yt-picker-title">
      <h2 id="diet-yt-picker-title">Save to playlist</h2>
      ${picker.loading ? `<p class="diet-yt-card-sub">Loading your playlists\u2026</p>` : picker.error ? `<p class="diet-yt-card-sub">${escapeHtml(picker.error)}</p>` : !items.length ? `<p class="diet-yt-card-sub">No playlists found. Watch later is still available from the \u22EE menu.</p>` : `<div class="diet-yt-picker-list">${items.map(
      (p) => `<button type="button" class="diet-yt-item" data-pick-playlist="${escapeHtml(p.id)}" data-playlist-label="${escapeHtml(p.label)}">${escapeHtml(p.label)}${p.alreadyIn ? `<span class="diet-yt-picker-flag">Saved</span>` : ""}</button>`
    ).join("")}</div>`}
      <div class="diet-yt-sheet-actions">
        <button type="button" class="diet-yt-btn-secondary" data-dismiss-picker>Cancel</button>
      </div>
    </div>
  </div>`);
    node.addEventListener("click", (e) => {
      if (e.target === node) handlers2.onClosePlaylistPicker();
    });
    node.querySelector("[data-dismiss-picker].diet-yt-btn-secondary")?.addEventListener("click", (e) => {
      e.preventDefault();
      handlers2.onClosePlaylistPicker();
    });
    node.querySelectorAll("[data-pick-playlist]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        handlers2.onPickPlaylist(btn.dataset.pickPlaylist, btn.dataset.playlistLabel);
      });
    });
    bodyEl.appendChild(node);
  }
  function renderToast(bodyEl, state2) {
    bodyEl.querySelector(".diet-yt-toast")?.remove();
    if (!state2.toast) return;
    const toast = el(`<div class="diet-yt-toast" role="status">${escapeHtml(state2.toast.message)}${state2.toast.undo ? `<button type="button" data-undo>Undo</button>` : ""}</div>`);
    bodyEl.appendChild(toast);
  }
  function watchUrl(video) {
    const params = new URLSearchParams({ v: video.videoId });
    if (video.playlistId && video.playlistId !== "WL") params.set("list", video.playlistId);
    return `/watch?${params.toString()}`;
  }

  // src/content/offsets.js
  function parsePx(value) {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : 0;
  }
  function readYoutubeOffsets() {
    const css = getComputedStyle(document.documentElement);
    const cssMasthead = parsePx(css.getPropertyValue("--ytd-masthead-height")) || 56;
    const cssMini = parsePx(css.getPropertyValue("--ytd-mini-guide-width")) || 72;
    const masthead = document.querySelector("#masthead-container, ytd-masthead");
    let top = cssMasthead;
    if (masthead) {
      const rect = masthead.getBoundingClientRect();
      if (rect.height > 0) top = Math.round(rect.bottom);
    }
    top = Math.max(top, 56);
    let left = cssMini;
    const narrow = window.innerWidth < 792;
    if (narrow) {
      left = 0;
    } else {
      const app = document.querySelector("ytd-app");
      const guidePersistent = app?.hasAttribute("guide-persistent-and-visible");
      const guide = document.querySelector("#guide");
      if (guidePersistent && guide) {
        const rect = guide.getBoundingClientRect();
        if (rect.width > 40) left = Math.round(rect.right);
      } else {
        const mini = document.querySelector("ytd-mini-guide-renderer");
        if (mini) {
          const rect = mini.getBoundingClientRect();
          if (rect.width > 0) left = Math.round(rect.right);
        }
      }
    }
    return { top, left };
  }
  function applyOffsets(root2, offsets) {
    if (!root2) return;
    const { top, left } = offsets || readYoutubeOffsets();
    root2.style.setProperty("--diet-offset-top", `${top}px`);
    root2.style.setProperty("--diet-offset-left", `${left}px`);
  }
  function watchOffsets(root2, onChange) {
    const update = () => {
      const next = readYoutubeOffsets();
      applyOffsets(root2, next);
      onChange?.(next);
    };
    update();
    const ro = new ResizeObserver(update);
    const masthead = document.querySelector("#masthead-container, ytd-masthead");
    const guide = document.querySelector("#guide, ytd-mini-guide-renderer");
    if (masthead) ro.observe(masthead);
    if (guide) ro.observe(guide);
    window.addEventListener("resize", update);
    document.addEventListener("yt-guide-toggle", update, true);
    document.addEventListener("yt-navigate-finish", update, true);
    requestAnimationFrame(update);
    setTimeout(update, 0);
    setTimeout(update, 120);
    setTimeout(update, 400);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }

  // src/content/rpc.js
  var nextId = 1;
  var pending = /* @__PURE__ */ new Map();
  function listenMain(onEvent) {
    window.addEventListener("message", (event) => {
      if (event.source !== window) return;
      const data = event.data;
      if (!data || data.source !== MSG.MAIN) return;
      if (data.id && pending.has(data.id)) {
        const { resolve, reject, timer } = pending.get(data.id);
        clearTimeout(timer);
        pending.delete(data.id);
        if (data.error) reject(new Error(data.error));
        else resolve(data.payload);
        return;
      }
      if (data.type) onEvent?.(data.type, data.payload);
    });
  }
  function mainRpc(type, payload, timeoutMs = 25e3) {
    return new Promise((resolve, reject) => {
      const id = nextId++;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`Diet-Youtube timed out on ${type}`));
      }, timeoutMs);
      pending.set(id, { resolve, reject, timer });
      window.postMessage({ source: MSG.ISOLATED, id, type, payload }, "*");
    });
  }

  // src/content/content.js
  var cache = createVideoCache();
  var state = {
    prefs: null,
    session: { tabId: SYSTEM_TAB.WATCH_LATER, feedSticky: false },
    view: { layout: "icons", sort: "newest", postedWithin: "any" },
    savedView: { layout: "icons", sort: "newest", postedWithin: "any" },
    viewDirty: false,
    videos: [],
    rawVideos: [],
    loading: true,
    error: null,
    selected: /* @__PURE__ */ new Set(),
    lastSelectedIndex: -1,
    canRemove: true,
    viewMenuOpen: false,
    sheet: null,
    toast: null,
    cardMenu: null,
    playlistPicker: null,
    emptyTitle: "Watch later is empty",
    emptyBody: "Save videos for later. This queue is your diet home \u2014 the algorithm stays one click away."
  };
  var shell = null;
  var root = null;
  var lastPath = location.pathname + location.search;
  var firstLoad = true;
  var toastTimer = 0;
  var undoFeed = null;
  var stopOffsets = null;
  var remounting = false;
  var lastExternalGestureAt = 0;
  var homeLockUntil = 0;
  var hooksInstalled = false;
  var sessionViews = /* @__PURE__ */ new Map();
  var snapsReady = Promise.resolve();
  var persistTimers = /* @__PURE__ */ new Map();
  var prefetchScheduled = false;
  var extensionEnabled = true;
  async function readEnabled() {
    if (typeof chrome === "undefined" || !chrome.storage?.local) return true;
    const got = await chrome.storage.local.get(ENABLED_STORAGE_KEY);
    return isDietEnabled(got[ENABLED_STORAGE_KEY]);
  }
  var enabledReady = readEnabled().then((on) => {
    extensionEnabled = on;
    return on;
  });
  var handlers = {
    onTabClick: (tabId) => applyEvent(NAV_EVENT.CHRONO_TAB, { requestedTabId: tabId }),
    onCreateFeed: () => openSheet("create"),
    onEditFeed: (id) => openSheet("edit", id),
    onReorderCustom: async (ids) => {
      state.prefs = await savePrefs(reorderCustomTabs(state.prefs, ids));
      paint();
    },
    onLayoutChange: (layout) => updateView({ layout }),
    onToggleViewMenu: () => {
      state.viewMenuOpen = !state.viewMenuOpen;
      paint();
    },
    onCloseViewMenu: () => {
      if (!state.viewMenuOpen) return;
      state.viewMenuOpen = false;
      paint();
    },
    onSortChange: (sort) => updateView({ sort }),
    onPostedChange: (postedWithin) => updateView({ postedWithin }),
    onDensityChange: (density) => updateView({ density }),
    onDefaultHomeChange: async (defaultHome) => {
      state.prefs = await savePrefs({ ...state.prefs, defaultHome });
      paint();
    },
    onSaveView: async () => {
      state.prefs = await savePrefs(setViewForTab(state.prefs, state.session.tabId, state.view));
      state.savedView = { ...state.view };
      sessionViews.set(state.session.tabId, { ...state.view });
      state.viewDirty = false;
      showToast(`Saved as default for ${tabLabel(state.prefs, state.session.tabId)}`);
      paint();
    },
    onOpenVideo: (videoId) => {
      const video = state.rawVideos.find((v) => v.videoId === videoId);
      if (!video) return;
      hideSurface();
      location.href = watchUrl(video);
    },
    onToggleSelect: (videoId, shift) => toggleSelect(videoId, shift),
    onRemoveOne: (videoId) => removeVideos([videoId]),
    onRemoveSelected: () => removeVideos([...state.selected]),
    onClearSelection: () => {
      state.selected = /* @__PURE__ */ new Set();
      paint();
    },
    onRetry: () => loadTab(state.session.tabId, { force: true }),
    onCloseSheet: () => {
      state.sheet = null;
      paint();
    },
    onSaveSheet: saveSheet,
    onDeleteSheet: () => {
      if (!state.sheet) return;
      state.sheet.confirmDelete = true;
      paint();
    },
    onConfirmDelete: confirmDeleteFeed,
    onResolveSource: resolveSheetSource,
    onAddSource: (id, type, label) => {
      if (!state.sheet) return;
      if (!state.sheet.sources.some((s) => s.id === id)) {
        state.sheet.sources.push({ id, type, label });
      }
      state.sheet.suggestions = [];
      state.sheet.query = "";
      paint();
    },
    onRemoveSource: (id) => {
      if (!state.sheet) return;
      state.sheet.sources = state.sheet.sources.filter((s) => s.id !== id);
      paint();
    },
    onUndo: undoLast,
    onOpenMore: (videoId) => {
      state.cardMenu = state.cardMenu?.videoId === videoId ? null : { videoId };
      state.viewMenuOpen = false;
      paint();
    },
    onCloseMore: () => {
      if (!state.cardMenu) return;
      state.cardMenu = null;
      paint();
    },
    onSaveToWatchLater: (videoId) => {
      void saveVideosToPlaylist([videoId], WATCH_LATER_PLAYLIST_ID, "Watch later");
    },
    onOpenPlaylistPicker: (videoId) => {
      void openPlaylistPicker(videoId);
    },
    onPickPlaylist: (playlistId, label) => {
      const videoId = state.playlistPicker?.videoId;
      if (!videoId) return;
      void saveVideosToPlaylist([videoId], playlistId, label);
    },
    onClosePlaylistPicker: () => {
      if (!state.playlistPicker) return;
      state.playlistPicker = null;
      paint();
    }
  };
  function bootApi() {
    return window.__dietYtBoot || {};
  }
  function markHomeIntent() {
    bootApi().markHomeIntent?.();
  }
  function setPendingNav(event) {
    bootApi().setPendingNav?.(event);
    if (event) document.documentElement.dataset.dietNavEvent = event;
    else delete document.documentElement.dataset.dietNavEvent;
  }
  function peekPendingNav() {
    return bootApi().getPendingNav?.() || document.documentElement.dataset.dietNavEvent || null;
  }
  function consumePendingNav() {
    const fromBoot = bootApi().consumePendingNav?.();
    const fromHtml = document.documentElement.dataset.dietNavEvent || null;
    delete document.documentElement.dataset.dietNavEvent;
    return fromBoot || fromHtml || null;
  }
  function isReloadNavigation() {
    try {
      const nav = performance.getEntriesByType?.("navigation")?.[0];
      if (nav?.type === "reload") return true;
    } catch (_) {
    }
    try {
      if (performance.navigation && performance.navigation.type === 1) return true;
    } catch (_) {
    }
    return false;
  }
  function homeIntentActive() {
    return Boolean(bootApi().homeIntentActive?.());
  }
  function forceDietHomeUrl() {
    bootApi().forceDietHomeUrl?.();
    if (!isDietSurfacePath(location.pathname)) {
      try {
        history.replaceState(history.state || {}, "", "/");
      } catch (_) {
      }
    }
  }
  function hostNode() {
    return document.body || document.documentElement;
  }
  function attachOffsets() {
    stopOffsets?.();
    stopOffsets = watchOffsets(root);
  }
  function bindShell(node) {
    if (shell?.destroy) shell.destroy();
    shell = createShell(node, handlers);
    node.addEventListener("diet-yt-resolve", resolveSheetSource);
    attachOffsets();
  }
  function ensureRoot() {
    const live = document.getElementById("diet-yt-root");
    const connected = Boolean(root && root.isConnected);
    const hasChrome = rootHasDietChrome(root) && Boolean(root?.querySelector?.(".diet-yt-chrome"));
    const needs = rootNeedsRemount({
      connected,
      hasChrome,
      shellBoundToRoot: Boolean(shell && shell.root === root),
      liveIdMismatch: Boolean(live && root && live !== root)
    });
    if (!needs && root) {
      if (document.body && root.parentElement !== document.body) {
        document.body.appendChild(root);
      }
      return root;
    }
    if (root && root.isConnected && hasChrome && shell?.root === root && !live) {
      return root;
    }
    if (root && rootHasDietChrome(root) && shell?.root === root && !root.isConnected) {
      hostNode().appendChild(root);
      attachOffsets();
      return root;
    }
    let node = live;
    if (!node) {
      node = document.createElement("div");
      node.id = "diet-yt-root";
      hostNode().appendChild(node);
    } else if (document.body && node.parentElement !== document.body) {
      document.body.appendChild(node);
    }
    root = node;
    if (!root.querySelector(".diet-yt-chrome") || !shell || shell.root !== root) {
      bindShell(root);
    }
    applyOffsets(root);
    return root;
  }
  function paint() {
    ensureRoot();
    if (!shell) return;
    if (!state.prefs) state.prefs = migratePrefs(null);
    state.viewDirty = !viewsEqual(state.view, state.savedView);
    state.canRemove = isQueueTab(state.prefs, state.session.tabId);
    shell.render(state);
    document.documentElement.dataset.dietHydrated = "1";
  }
  function setActive(on) {
    if (!extensionEnabled) on = false;
    const html = document.documentElement;
    html.classList.toggle("diet-yt-active", on);
    html.dataset.dietRoute = on ? "home" : "other";
    if (root) root.hidden = !on;
  }
  function deactivateExtension() {
    extensionEnabled = false;
    hideSurface();
    bootApi().deactivate?.();
    document.documentElement.classList.remove("diet-yt-active");
    delete document.documentElement.dataset.dietRoute;
    const live = document.getElementById("diet-yt-root");
    if (live) live.remove();
    root = null;
    if (shell?.destroy) shell.destroy();
    shell = null;
  }
  function showSurface() {
    ensureRoot();
    setActive(true);
    if (root) root.hidden = false;
    requestAnimationFrame(() => applyOffsets(root));
  }
  function hideSurface() {
    setActive(false);
  }
  function remountIfHome() {
    if (!shouldInjectSurface({ enabled: extensionEnabled })) return;
    if (remounting) return;
    const path = location.pathname;
    const search = location.search;
    if (!shouldPaintShell({ path, search, homeIntent: homeIntentActive() }) && !isDietSurfacePath(path)) {
      return;
    }
    remounting = true;
    try {
      if (shouldRecoverWatchLaterBounce({
        path,
        search,
        homeIntent: homeIntentActive(),
        prevWatch: isWatchPath(lastPath)
      })) {
        forceDietHomeUrl();
      }
      const pending2 = peekPendingNav();
      if (pending2 === "yt-home" || Date.now() < homeLockUntil) {
        forceDietHome(NAV_EVENT.YT_HOME);
        return;
      }
      if (pending2 === "cold") {
        forceDietHome(NAV_EVENT.COLD);
        return;
      }
      showSurface();
      paint();
    } finally {
      remounting = false;
    }
  }
  function emptyCopy(tabId) {
    if (tabId === SYSTEM_TAB.WATCH_LATER) {
      return {
        emptyTitle: "Watch later is empty",
        emptyBody: "Save videos for later. This queue is your diet home \u2014 the algorithm stays one click away."
      };
    }
    if (tabId === SYSTEM_TAB.FEED) {
      return {
        emptyTitle: "Nothing in Feed",
        emptyBody: "YouTube didn\u2019t return For you videos. Try again, or go back to Watch later."
      };
    }
    if (tabId === SYSTEM_TAB.SUBSCRIPTIONS) {
      return {
        emptyTitle: "No subscription videos",
        emptyBody: "When channels you follow post, they\u2019ll show up here in chronological order."
      };
    }
    return {
      emptyTitle: "This feed is empty",
      emptyBody: "Add channels or playlists in Edit, or pick another tab."
    };
  }
  function applyEvent(event, extra = {}) {
    if (!shouldInjectSurface({ enabled: extensionEnabled })) return;
    if (event === NAV_EVENT.CHRONO_TAB) {
      homeLockUntil = 0;
    } else if (shouldBlockOtherDuringHomeLock({
      event,
      lockUntil: homeLockUntil,
      now: Date.now()
    })) {
      event = NAV_EVENT.YT_HOME;
    }
    const pendingBefore = peekPendingNav();
    if (event !== NAV_EVENT.CHRONO_TAB) {
      event = upgradeNavigationEvent(event, {
        pendingNav: pendingBefore,
        isReload: extra.isReload
      });
    }
    const decision = resolveNavigation(event, {
      prefs: state.prefs,
      session: state.session,
      requestedTabId: extra.requestedTabId
    });
    const sameTab = decision.tabId === state.session.tabId;
    const stickyCleared = Boolean(state.session.feedSticky) && !decision.feedSticky;
    state.session = decision;
    if (event === NAV_EVENT.OTHER && sameTab && !stickyCleared && !pendingBefore) {
      showSurface();
      if (root) applyOffsets(root);
      return;
    }
    state.selected = /* @__PURE__ */ new Set();
    state.viewMenuOpen = false;
    state.cardMenu = null;
    state.playlistPicker = null;
    if (event === NAV_EVENT.COLD) sessionViews.clear();
    const saved = getViewForTab(state.prefs, decision.tabId);
    state.savedView = { ...saved };
    state.view = resolveSessionView(saved, sessionViews.get(decision.tabId));
    Object.assign(state, emptyCopy(decision.tabId));
    adoptCachedTab(decision.tabId);
    showSurface();
    paint();
    consumePendingNav();
    loadTab(decision.tabId);
  }
  function forceDietHome(event) {
    if (!shouldInjectSurface({ enabled: extensionEnabled })) return;
    const next = event === NAV_EVENT.COLD ? NAV_EVENT.COLD : NAV_EVENT.YT_HOME;
    setPendingNav(next === NAV_EVENT.COLD ? "cold" : "yt-home");
    markHomeIntent();
    homeLockUntil = Date.now() + HOME_LOCK_MS;
    applyEvent(next, { isReload: next === NAV_EVENT.COLD });
  }
  function adoptCachedTab(tabId, { force = false } = {}) {
    const key = cacheKey("tab", tabId);
    const info = inspectCache(cache, key);
    const plan = planTabLoad({ hit: info.hit, fresh: info.fresh, force });
    if (plan.paintCached) {
      setVideos(info.videos);
      state.loading = false;
      state.error = null;
    } else {
      state.rawVideos = [];
      state.videos = [];
      state.loading = true;
      state.error = null;
    }
    return { key, info, plan };
  }
  async function loadTab(tabId, { force = false, background = false } = {}) {
    await snapsReady;
    const key = cacheKey("tab", tabId);
    const info = inspectCache(cache, key);
    const plan = planTabLoad({ hit: info.hit, fresh: info.fresh, force });
    if (!background) {
      if (plan.paintCached) {
        setVideos(info.videos);
        state.loading = false;
        state.error = null;
      } else {
        state.rawVideos = [];
        state.videos = [];
        state.loading = true;
        state.error = null;
      }
      paint();
    }
    if (!plan.refresh) return;
    try {
      const videos = await fetchTab(tabId);
      const stored = putCache(cache, key, videos);
      queueTabSnapshot(tabId, stored);
      if (tabId !== state.session.tabId) return;
      setVideos(stored);
      state.loading = false;
      state.error = null;
    } catch (err) {
      if (tabId !== state.session.tabId) return;
      if (!state.rawVideos.length) {
        state.error = friendlyError(err);
      }
      state.loading = false;
    }
    if (tabId === state.session.tabId) paint();
  }
  function friendlyError(err) {
    const msg = String(err?.message || err);
    if (/not ready|timed out/i.test(msg)) return "YouTube is still loading. Try again in a moment.";
    if (/sign in|login|logged/i.test(msg)) return "Sign in to YouTube to load this queue.";
    return msg;
  }
  async function fetchTab(tabId) {
    if (tabId === SYSTEM_TAB.FEED) return mainRpc("fetchHome");
    if (tabId === SYSTEM_TAB.WATCH_LATER) return mainRpc("fetchWatchLater");
    if (tabId === SYSTEM_TAB.SUBSCRIPTIONS) return mainRpc("fetchSubscriptions");
    const feed = findCustomFeed(state.prefs, tabId);
    if (!feed) return [];
    return mainRpc("fetchCustom", { sources: feed.sources });
  }
  function setVideos(videos) {
    state.rawVideos = videos || [];
    state.videos = applyView(state.rawVideos, state.view);
    const ids = new Set(state.videos.map((v) => v.videoId));
    state.selected = new Set([...state.selected].filter((id) => ids.has(id)));
  }
  function updateView(partial) {
    state.view = { ...state.view, ...partial };
    sessionViews.set(state.session.tabId, { ...state.view });
    setVideos(state.rawVideos);
    paint();
  }
  function queueTabSnapshot(tabId, videos) {
    if (!shouldPersistTabSnapshot(tabId)) return;
    if (typeof chrome === "undefined" || !chrome.storage?.local) return;
    const prev = persistTimers.get(tabId);
    if (prev) clearTimeout(prev);
    persistTimers.set(
      tabId,
      setTimeout(() => {
        persistTimers.delete(tabId);
        void chrome.storage.local.get(TAB_SNAPSHOT_STORAGE_KEY).then((got) => {
          const next = mergeTabSnapshot(got[TAB_SNAPSHOT_STORAGE_KEY], tabId, videos);
          return chrome.storage.local.set({ [TAB_SNAPSHOT_STORAGE_KEY]: next });
        }).catch(() => {
        });
      }, 300)
    );
  }
  function hydrateSnapshots() {
    if (typeof chrome === "undefined" || !chrome.storage?.local) return Promise.resolve();
    return chrome.storage.local.get(TAB_SNAPSHOT_STORAGE_KEY).then((got) => {
      hydrateCacheFromSnapshot(cache, got[TAB_SNAPSHOT_STORAGE_KEY]);
    }).catch(() => {
    });
  }
  function scheduleWarmPrefetch() {
    if (prefetchScheduled) return;
    prefetchScheduled = true;
    const run = () => {
      const ids = warmTabIds({
        currentTabId: state.session.tabId,
        customFeedIds: (state.prefs?.customFeeds || []).map((f) => f.id)
      }).filter((id) => id !== state.session.tabId);
      void prefetchSequential(ids);
    };
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(run, { timeout: 2500 });
    } else {
      setTimeout(run, 800);
    }
  }
  async function prefetchSequential(ids) {
    for (const id of ids) {
      try {
        await loadTab(id, { background: true });
      } catch (_) {
      }
      await new Promise((resolve) => setTimeout(resolve, PREFETCH_GAP_MS));
    }
  }
  function toggleSelect(videoId, shift) {
    const ids = state.videos.map((v) => v.videoId);
    const idx = ids.indexOf(videoId);
    if (shift && state.lastSelectedIndex >= 0 && idx >= 0) {
      const [a, b] = [state.lastSelectedIndex, idx].sort((x, y) => x - y);
      for (let i = a; i <= b; i++) state.selected.add(ids[i]);
    } else if (state.selected.has(videoId)) {
      state.selected.delete(videoId);
    } else {
      state.selected.add(videoId);
    }
    state.lastSelectedIndex = idx;
    paint();
  }
  async function removeVideos(videoIds) {
    const items = state.rawVideos.filter((v) => videoIds.includes(v.videoId));
    if (!items.length) return;
    const playlistId = playlistIdForTab(state.prefs, state.session.tabId) || "WL";
    const key = cacheKey("tab", state.session.tabId);
    tombstoneRemovedMany(cache, items, playlistId);
    setVideos(getCache(cache, key) || filterLocal(state.rawVideos, items));
    state.selected = /* @__PURE__ */ new Set();
    paint();
    try {
      await mainRpc("removeFromPlaylist", { playlistId, items });
      showToast(items.length === 1 ? "Removed" : `Removed ${items.length} videos`);
      const fresh = await fetchTab(state.session.tabId);
      setVideos(putCache(cache, key, fresh));
      paint();
    } catch (err) {
      for (const item of items) {
        clearTombstonesFor(cache, { playlistId, videoId: item.videoId, setVideoId: item.setVideoId });
      }
      showToast(friendlyError(err));
      loadTab(state.session.tabId, { force: true });
    }
  }
  async function saveVideosToPlaylist(videoIds, playlistId, playlistLabel) {
    const items = state.rawVideos.filter((v) => videoIds.includes(v.videoId));
    if (!items.length) return;
    state.cardMenu = null;
    state.playlistPicker = null;
    paint();
    try {
      const result = await mainRpc("addToPlaylist", {
        playlistId: playlistId || WATCH_LATER_PLAYLIST_ID,
        videoIds: items.map((v) => v.videoId)
      });
      const label = playlistDisplayName(playlistId, playlistLabel);
      showToast(saveToastMessage({ alreadyIn: Boolean(result?.alreadyIn), playlistLabel: label, count: items.length }));
      if ((playlistId || WATCH_LATER_PLAYLIST_ID) === WATCH_LATER_PLAYLIST_ID) {
        rememberSavedToWatchLater(items);
      }
    } catch (err) {
      showToast(friendlyError(err));
    }
  }
  function rememberSavedToWatchLater(items) {
    const key = cacheKey("tab", SYSTEM_TAB.WATCH_LATER);
    const current = inspectCache(cache, key);
    if (!current.hit) return;
    const have = new Set((current.videos || []).map((v) => v.videoId));
    const next = [...items.filter((v) => !have.has(v.videoId)).map((v) => ({ ...v, playlistId: WATCH_LATER_PLAYLIST_ID })), ...current.videos || []];
    const stored = putCache(cache, key, next);
    queueTabSnapshot(SYSTEM_TAB.WATCH_LATER, stored);
  }
  async function openPlaylistPicker(videoId) {
    state.cardMenu = null;
    state.playlistPicker = { videoId, items: [], loading: true, error: null };
    paint();
    try {
      const library = await mainRpc("listPlaylists", { videoIds: [videoId] });
      const items = mergeSaveTargets({
        library: library || [],
        feedSources: playlistSourcesFromPrefs(state.prefs)
      });
      if (state.playlistPicker?.videoId !== videoId) return;
      state.playlistPicker = { videoId, items, loading: false, error: null };
    } catch (err) {
      if (state.playlistPicker?.videoId !== videoId) return;
      state.playlistPicker = {
        videoId,
        items: mergeSaveTargets({ feedSources: playlistSourcesFromPrefs(state.prefs) }),
        loading: false,
        error: friendlyError(err)
      };
    }
    paint();
  }
  function filterLocal(videos, removed) {
    const ids = new Set(removed.map((r) => r.videoId));
    const sets = new Set(removed.map((r) => r.setVideoId).filter(Boolean));
    return videos.filter((v) => !ids.has(v.videoId) && !(v.setVideoId && sets.has(v.setVideoId)));
  }
  function openSheet(mode, feedId) {
    const feed = feedId ? findCustomFeed(state.prefs, feedId) : null;
    state.sheet = {
      mode,
      id: feed?.id || newFeedId(),
      name: feed?.name || "",
      sources: feed?.sources ? feed.sources.map((s) => ({ ...s })) : [],
      query: "",
      suggestions: [],
      confirmDelete: false,
      advanced: false
    };
    state.viewMenuOpen = false;
    paint();
  }
  async function resolveSheetSource() {
    if (!state.sheet) return;
    const input = root?.querySelector("#diet-yt-feed-source");
    const query = (input?.value || state.sheet.query || "").trim();
    if (!query) return;
    state.sheet.query = query;
    try {
      const results = await mainRpc("resolveSource", { query });
      if (results.length === 1) {
        const s = results[0];
        if (!state.sheet.sources.some((x) => x.id === s.id)) state.sheet.sources.push(s);
        state.sheet.query = "";
        state.sheet.suggestions = [];
      } else {
        state.sheet.suggestions = results.slice(0, 8);
      }
    } catch (err) {
      showToast(friendlyError(err));
    }
    paint();
  }
  async function saveSheet() {
    if (!state.sheet) return;
    const nameInput = root?.querySelector("#diet-yt-feed-name");
    const sourceInput = root?.querySelector("#diet-yt-feed-source");
    const name = (nameInput?.value || state.sheet.name || "").trim();
    if (!name) {
      showToast("Give this feed a name");
      return;
    }
    const pending2 = (sourceInput?.value || state.sheet.query || "").trim();
    if (pending2) {
      try {
        const results = await mainRpc("resolveSource", { query: pending2 });
        const first = results[0];
        if (first && !state.sheet.sources.some((s) => s.id === first.id)) {
          state.sheet.sources.push(first);
        }
      } catch (_) {
      }
    }
    const feed = { id: state.sheet.id, name, sources: state.sheet.sources.slice() };
    state.prefs = await savePrefs(upsertCustomFeed(state.prefs, feed));
    state.sheet = null;
    showToast(`Saved \u201C${name}\u201D`);
    applyEvent(NAV_EVENT.CHRONO_TAB, { requestedTabId: feed.id });
  }
  async function confirmDeleteFeed() {
    if (!state.sheet) return;
    const feed = findCustomFeed(state.prefs, state.sheet.id);
    undoFeed = feed ? { ...feed, sources: feed.sources.map((s) => ({ ...s })) } : null;
    state.prefs = await savePrefs(removeCustomFeed(state.prefs, state.sheet.id));
    state.sheet = null;
    showToast(`Deleted \u201C${feed?.name || "feed"}\u201D`, { undo: true });
    applyEvent(NAV_EVENT.COLD);
  }
  async function undoLast() {
    if (!undoFeed) return;
    state.prefs = await savePrefs(upsertCustomFeed(state.prefs, undoFeed));
    const restored = undoFeed;
    undoFeed = null;
    showToast(`Restored \u201C${restored.name}\u201D`);
    applyEvent(NAV_EVENT.CHRONO_TAB, { requestedTabId: restored.id });
  }
  function showToast(message, { undo = false, ms = 6e3 } = {}) {
    state.toast = { message, undo };
    paint();
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      state.toast = null;
      paint();
    }, ms);
  }
  function dietDebug(message, extra) {
    try {
      if (globalThis.localStorage?.getItem("dietYtDebug") !== "1") return;
      console.info("[diet-yt]", message, extra || "");
    } catch (_) {
    }
  }
  function peekNodesUnderDietRoot(event) {
    const nodes = [];
    if (event?.clientX == null || typeof document === "undefined") return nodes;
    const overlay = document.getElementById("diet-yt-root");
    const prev = overlay?.style?.pointerEvents;
    try {
      if (overlay) overlay.style.pointerEvents = "none";
      const stack = (typeof document.elementsFromPoint === "function" ? document.elementsFromPoint(event.clientX, event.clientY) : null) || [];
      if (!stack.length && typeof document.elementFromPoint === "function") {
        const one = document.elementFromPoint(event.clientX, event.clientY);
        if (one) stack.push(one);
      }
      for (const el2 of stack) {
        let node = el2;
        while (node) {
          if (!nodes.includes(node)) nodes.push(node);
          node = node.parentElement || node.parentNode || node.host;
        }
      }
    } catch (_) {
    } finally {
      if (overlay) overlay.style.pointerEvents = prev || "";
    }
    return nodes;
  }
  function coordsHitHomeChrome(event) {
    if (event?.clientX == null || typeof document === "undefined") return false;
    const x = event.clientX;
    const y = event.clientY;
    const inRect = (el2) => {
      if (!el2 || typeof el2.getBoundingClientRect !== "function") return false;
      const r = el2.getBoundingClientRect();
      return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom && r.width > 0 && r.height > 0;
    };
    const excludeSels = [
      "#guide-button",
      "#voice-search-button",
      "ytd-searchbox",
      "yt-searchbox",
      "#center",
      "#end",
      "#buttons",
      "#avatar-btn",
      "#notification-button",
      "#create-icon"
    ];
    for (const sel of excludeSels) {
      if (inRect(document.querySelector(sel))) return false;
    }
    if (inRect(document.querySelector("#start")) || inRect(document.querySelector("#logo")) || inRect(document.querySelector("ytd-topbar-logo-renderer"))) {
      return true;
    }
    const mast = document.querySelector("#masthead-container, ytd-masthead");
    if (mast && inRect(mast)) {
      const r = mast.getBoundingClientRect();
      if (x < r.left + 240) return true;
    }
    const firstMini = document.querySelector("ytd-mini-guide-renderer ytd-mini-guide-entry-renderer");
    if (inRect(firstMini)) return true;
    const homes = document.querySelectorAll(
      "ytd-mini-guide-entry-renderer a[href='/'], ytd-guide-entry-renderer a[href='/'], #guide a[href='/']"
    );
    for (const a of homes) {
      if (inRect(a)) return true;
      const entry = a.closest?.("ytd-mini-guide-entry-renderer, ytd-guide-entry-renderer");
      if (inRect(entry)) return true;
    }
    return false;
  }
  function interceptYouTubeHome(event) {
    if (!shouldInjectSurface({ enabled: extensionEnabled })) return;
    if (isModifiedClick(event)) return;
    const insideDiet = pathContainsDietRoot(event);
    const extraNodes = peekNodesUnderDietRoot(event);
    const pointNode = extraNodes[0] || null;
    const pathHits = gestureHitsHomeChrome(event, { pointNode, extraNodes }) || isOutsideDietHomeChromeGesture(event);
    const coordHits = !pathHits && coordsHitHomeChrome(event);
    const underHits = extraNodes.some(
      (node) => !nodeIsExcludedMastheadControl(node) && (nodeIsMastheadHomeChrome(node) || nodeIsGuideHomeChrome(node))
    );
    const hits = pathHits || coordHits || underHits;
    dietDebug("intercept", {
      fired: hits,
      why: hits ? pathHits ? "path-home-chrome" : coordHits ? "coords-home-chrome" : "under-overlay-home-chrome" : insideDiet ? "inside-diet-root" : "no-home-chrome",
      feedSticky: state.session.feedSticky,
      tabId: state.session.tabId,
      target: event.target?.tagName,
      targetId: event.target?.id
    });
    if (insideDiet && !hits) {
      return;
    }
    if (!shouldForceDietHomeOnStickyFeed({
      feedSticky: state.session.feedSticky,
      hitsHomeChrome: hits,
      insideDietRoot: insideDiet
    })) {
      return;
    }
    lastExternalGestureAt = Date.now();
    forceDietHomeUrl();
    forceDietHome(NAV_EVENT.YT_HOME);
    event.preventDefault();
    event.stopPropagation();
  }
  function recoverNativeWatchLater(pathname, search, event) {
    if (!shouldRecoverWatchLaterBounce({
      path: pathname,
      search,
      homeIntent: homeIntentActive(),
      event,
      prevWatch: isWatchPath(lastPath)
    })) {
      return false;
    }
    markHomeIntent();
    forceDietHomeUrl();
    applyEvent(event === NAV_EVENT.WATCH_TO_HOME ? NAV_EVENT.WATCH_TO_HOME : NAV_EVENT.YT_HOME);
    return true;
  }
  function onLocation(pathname, { source, phase, search } = {}) {
    if (!shouldInjectSurface({ enabled: extensionEnabled })) {
      hideSurface();
      return;
    }
    const next = pathname || location.pathname;
    const nextSearch = search ?? location.search;
    const homeIntent = homeIntentActive();
    if (shouldHideSurface({
      phase,
      destPath: next,
      destSearch: nextSearch,
      homeIntent
    })) {
      firstLoad = false;
      lastPath = next + (nextSearch || "");
      hideSurface();
      return;
    }
    if (phase === "start") {
      if (isDietSurfacePath(next) || homeIntent) {
        showSurface();
        if (!rootHasDietChrome(root) || !root?.querySelector?.(".diet-yt-chrome")) {
          paint();
        }
      }
      return;
    }
    const classified = classifyNavigation({
      isFirstLoad: firstLoad,
      source,
      prevPath: lastPath,
      nextPath: next + (nextSearch || ""),
      isReload: isReloadNavigation() && firstLoad,
      homeChrome: peekPendingNav() === "yt-home"
    });
    const event = upgradeNavigationEvent(classified, {
      pendingNav: peekPendingNav(),
      isReload: isReloadNavigation() && firstLoad
    });
    firstLoad = false;
    lastPath = next + (nextSearch || "");
    if (recoverNativeWatchLater(next, nextSearch, event)) return;
    if (isDietSurfacePath(next) || shouldPaintShell({ path: next, search: nextSearch, homeIntent })) {
      applyEvent(event);
      return;
    }
    hideSurface();
  }
  function watchDomRemounts() {
    const check = () => {
      if (!shouldInjectSurface({ enabled: extensionEnabled })) return;
      if (!isDietSurfacePath(location.pathname) && !homeIntentActive()) return;
      const live = document.getElementById("diet-yt-root");
      const painted = live?.querySelector(".diet-yt-chrome");
      if (!painted || root && !root.isConnected || live && root && live !== root) {
        remountIfHome();
      }
    };
    const obs = new MutationObserver(check);
    const start = () => obs.observe(document.body || document.documentElement, { childList: true });
    start();
    if (!document.body) {
      document.addEventListener("DOMContentLoaded", start, { once: true });
    }
    document.addEventListener("yt-navigate-finish", () => {
      if (isDietSurfacePath(location.pathname) || homeIntentActive()) remountIfHome();
    }, true);
  }
  snapsReady = hydrateSnapshots();
  function watchEnabled() {
    if (typeof chrome === "undefined" || !chrome.storage?.onChanged) return;
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local" || !changes[ENABLED_STORAGE_KEY]) return;
      const on = isDietEnabled(changes[ENABLED_STORAGE_KEY].newValue);
      extensionEnabled = on;
      if (!on) deactivateExtension();
      else location.reload();
    });
  }
  async function boot() {
    try {
      await enabledReady;
      if (!shouldInjectSurface({ enabled: extensionEnabled })) {
        deactivateExtension();
        return;
      }
      await snapsReady;
      ensureRoot();
      if (isDietSurfacePath(location.pathname) || homeIntentActive() || peekPendingNav() === "cold" || isReloadNavigation()) {
        showSurface();
        applyEvent(NAV_EVENT.COLD, { isReload: isReloadNavigation() });
        firstLoad = false;
        lastPath = location.pathname + location.search;
      }
      state.prefs = await loadPrefs();
      if (recoverNativeWatchLater(location.pathname, location.search, NAV_EVENT.COLD)) {
        firstLoad = false;
      } else if (isDietSurfacePath(location.pathname) || shouldPaintShell({
        path: location.pathname,
        search: location.search,
        homeIntent: homeIntentActive()
      })) {
        if (state.session.feedSticky) {
          paint();
          loadTab(state.session.tabId);
        } else {
          applyEvent(NAV_EVENT.COLD);
        }
        firstLoad = false;
        lastPath = location.pathname + location.search;
      } else {
        firstLoad = false;
        hideSurface();
      }
    } catch (err) {
      console.warn("[diet-yt] boot failed; painting shell anyway", err);
      state.prefs = state.prefs || migratePrefs(null);
      if (isDietSurfacePath(location.pathname) || homeIntentActive()) {
        showSurface();
        applyEvent(NAV_EVENT.COLD);
      }
      firstLoad = false;
    }
    scheduleWarmPrefetch();
    listenMain((type, payload) => {
      if (type === "navigated") {
        onLocation(payload?.pathname || location.pathname, {
          phase: payload?.phase,
          search: payload?.search
        });
        if (isYouTubeHomeDestination(null, payload?.pathname || location.pathname) && Date.now() - lastExternalGestureAt < 1e3) {
          forceDietHome(NAV_EVENT.YT_HOME);
        }
      }
      if (type === "ytInitialData") {
        onLocation(payload?.path || payload?.pathname || location.pathname, { phase: "data" });
      }
      if (type === "ready" && isDietSurfacePath(location.pathname) && state.loading) {
        loadTab(state.session.tabId);
      }
    });
    watchDomRemounts();
  }
  function onExternalPointerDown(event) {
    if (pathContainsDietRoot(event)) return;
    lastExternalGestureAt = Date.now();
    interceptYouTubeHome(event);
  }
  function onYtHomeNavigate(event) {
    if (!shouldInjectSurface({ enabled: extensionEnabled })) return;
    if (!isYouTubeHomeDestination(event?.detail, location.pathname)) return;
    if (peekPendingNav() === "yt-home" || Date.now() < homeLockUntil || Date.now() - lastExternalGestureAt < 1e3) {
      forceDietHome(NAV_EVENT.YT_HOME);
    }
  }
  function onReloadKey(event) {
    if (!shouldInjectSurface({ enabled: extensionEnabled })) return;
    const reloadKey = event.key === "F5" || (event.key === "r" || event.key === "R") && (event.metaKey || event.ctrlKey);
    if (!reloadKey) return;
    setPendingNav("cold");
  }
  function onPageShow(event) {
    if (event.persisted || isReloadNavigation()) {
      if (isDietSurfacePath(location.pathname)) forceDietHome(NAV_EVENT.COLD);
    }
  }
  function bindLiveHomeChrome() {
    const attach = (el2) => {
      if (!el2 || el2.dataset?.dietHomeBound) return;
      if (el2.dataset) el2.dataset.dietHomeBound = "1";
      el2.addEventListener("pointerdown", interceptYouTubeHome, true);
      el2.addEventListener("click", interceptYouTubeHome, true);
    };
    const scan = () => {
      [
        "#masthead-container",
        "ytd-masthead",
        "#start",
        "#logo",
        "#guide",
        "ytd-mini-guide-renderer",
        "ytd-guide-renderer"
      ].forEach((sel) => {
        document.querySelectorAll(sel).forEach(attach);
      });
      document.querySelectorAll(
        "ytd-mini-guide-entry-renderer a[href='/'], ytd-guide-entry-renderer a[href='/'], ytd-mini-guide-renderer ytd-mini-guide-entry-renderer"
      ).forEach(attach);
    };
    scan();
    let scanTimer = 0;
    const obs = new MutationObserver(() => {
      if (scanTimer) return;
      scanTimer = setTimeout(() => {
        scanTimer = 0;
        scan();
      }, 200);
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
  }
  function installChromeHooks() {
    if (hooksInstalled) return;
    hooksInstalled = true;
    window.__dietYtOnHome = () => forceDietHome(NAV_EVENT.YT_HOME);
    window.addEventListener("pointerdown", onExternalPointerDown, true);
    window.addEventListener("mousedown", onExternalPointerDown, true);
    window.addEventListener("click", interceptYouTubeHome, true);
    document.addEventListener("pointerdown", onExternalPointerDown, true);
    document.addEventListener("mousedown", onExternalPointerDown, true);
    document.addEventListener("click", interceptYouTubeHome, true);
    bindLiveHomeChrome();
    document.addEventListener("yt-navigate", onYtHomeNavigate, true);
    document.addEventListener("yt-navigate-start", onYtHomeNavigate, true);
    document.addEventListener("yt-navigate-finish", () => {
      onLocation(location.pathname, { phase: "finish", search: location.search });
      const pending2 = peekPendingNav();
      if (pending2 === "yt-home") forceDietHome(NAV_EVENT.YT_HOME);
      else if (pending2 === "cold") forceDietHome(NAV_EVENT.COLD);
    }, true);
    window.addEventListener("popstate", () => {
      onLocation(location.pathname, { phase: "popstate", search: location.search });
    }, true);
    window.addEventListener("pageshow", onPageShow, true);
    window.addEventListener("keydown", onReloadKey, true);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        state.viewMenuOpen = false;
        state.sheet = null;
        state.cardMenu = null;
        state.playlistPicker = null;
        paint();
      }
    });
  }
  watchEnabled();
  installChromeHooks();
  enabledReady.then((on) => {
    if (!on) {
      deactivateExtension();
      return;
    }
    if (isDietSurfacePath(location.pathname) || isReloadNavigation()) {
      forceDietHome(NAV_EVENT.COLD);
    }
    try {
      if (document.documentElement) boot();
      else document.addEventListener("DOMContentLoaded", boot, { once: true });
    } catch (err) {
      console.warn("[diet-yt] init failed", err);
      try {
        document.documentElement.classList.add("diet-yt-active");
        bootApi().activateHome?.();
      } catch (_) {
      }
    }
  });
})();
