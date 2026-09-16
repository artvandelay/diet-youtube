/**
 * Isolated-world source. Chrome Load unpacked runs content_scripts as classic
 * JS even if the manifest sets "type": "module". Ship the esbuild IIFE
 * (`npm run build` → src/content/content.bundle.js) in the manifest.
 */
import { SYSTEM_TAB, WATCH_LATER_PLAYLIST_ID } from "../lib/constants.js";
import { ENABLED_STORAGE_KEY, isDietEnabled, shouldInjectSurface } from "../lib/enabled.js";
import {
  mergeSaveTargets,
  playlistDisplayName,
  playlistSourcesFromPrefs,
  saveToastMessage,
} from "../lib/playlist-save.js";
import {
  HOME_LOCK_MS,
  NAV_EVENT,
  classifyNavigation,
  isDietSurfacePath,
  isModifiedClick,
  gestureHitsHomeChrome,
  isOutsideDietHomeChromeGesture,
  isYouTubeHomeDestination,
  isWatchPath,
  pathContainsDietRoot,
  resolveNavigation,
  shouldBlockOtherDuringHomeLock,
  shouldForceDietHomeOnStickyFeed,
  upgradeNavigationEvent,
  nodeIsExcludedMastheadControl,
  nodeIsMastheadHomeChrome,
  nodeIsGuideHomeChrome,
} from "../lib/nav-policy.js";
import {
  rootHasDietChrome,
  rootNeedsRemount,
  shouldHideSurface,
  shouldPaintShell,
  shouldRecoverWatchLaterBounce,
} from "../lib/surface.js";
import {
  cacheKey,
  createVideoCache,
  getCache,
  inspectCache,
  putCache,
  tombstoneRemovedMany,
  clearTombstonesFor,
} from "../lib/cache.js";
import { planTabLoad, PREFETCH_GAP_MS, warmTabIds } from "../lib/tab-load.js";
import {
  TAB_SNAPSHOT_STORAGE_KEY,
  hydrateCacheFromSnapshot,
  mergeTabSnapshot,
  shouldPersistTabSnapshot,
} from "../lib/snapshot.js";
import {
  findCustomFeed,
  getViewForTab,
  loadPrefs,
  migratePrefs,
  newFeedId,
  removeCustomFeed,
  reorderCustomTabs,
  savePrefs,
  setViewForTab,
  upsertCustomFeed,
} from "../lib/prefs.js";
import { applyView, resolveSessionView, viewsEqual } from "../lib/view.js";
import { isQueueTab, playlistIdForTab, tabLabel } from "../lib/tabs.js";
import { createShell, watchUrl } from "../ui/shell.js";
import { applyOffsets, watchOffsets } from "./offsets.js";
import { listenMain, mainRpc } from "./rpc.js";

const cache = createVideoCache();

const state = {
  prefs: null,
  session: { tabId: SYSTEM_TAB.WATCH_LATER, feedSticky: false },
  view: { layout: "icons", sort: "newest", postedWithin: "any" },
  savedView: { layout: "icons", sort: "newest", postedWithin: "any" },
  viewDirty: false,
  videos: [],
  rawVideos: [],
  loading: true,
  error: null,
  selected: new Set(),
  lastSelectedIndex: -1,
  canRemove: true,
  viewMenuOpen: false,
  sheet: null,
  toast: null,
  cardMenu: null,
  playlistPicker: null,
  emptyTitle: "Watch later is empty",
  emptyBody: "Save videos for later. This queue is your diet home — the algorithm stays one click away.",
};

let shell = null;
let root = null;
let lastPath = location.pathname + location.search;
let firstLoad = true;
let toastTimer = 0;
let undoFeed = null;
let stopOffsets = null;
let remounting = false;
let lastExternalGestureAt = 0;
let homeLockUntil = 0;
let hooksInstalled = false;
const sessionViews = new Map();
let snapsReady = Promise.resolve();
const persistTimers = new Map();
let prefetchScheduled = false;
let extensionEnabled = true;

async function readEnabled() {
  if (typeof chrome === "undefined" || !chrome.storage?.local) return true;
  const got = await chrome.storage.local.get(ENABLED_STORAGE_KEY);
  return isDietEnabled(got[ENABLED_STORAGE_KEY]);
}

const enabledReady = readEnabled().then((on) => {
  extensionEnabled = on;
  return on;
});

const handlers = {
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
    state.selected = new Set();
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
  },
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
    /* ignore */
  }
  try {
    if (performance.navigation && performance.navigation.type === 1) return true;
  } catch (_) {
    /* ignore */
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
      /* ignore */
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
    liveIdMismatch: Boolean(live && root && live !== root),
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

  // Re-attach an intact detached shell before creating a new one.
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
  if (
    !shouldPaintShell({ path, search, homeIntent: homeIntentActive() }) &&
    !isDietSurfacePath(path)
  ) {
    return;
  }
  remounting = true;
  try {
    if (shouldRecoverWatchLaterBounce({
      path,
      search,
      homeIntent: homeIntentActive(),
      prevWatch: isWatchPath(lastPath),
    })) {
      forceDietHomeUrl();
    }
    const pending = peekPendingNav();
    if (pending === "yt-home" || Date.now() < homeLockUntil) {
      forceDietHome(NAV_EVENT.YT_HOME);
      return;
    }
    if (pending === "cold") {
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
      emptyBody: "Save videos for later. This queue is your diet home — the algorithm stays one click away.",
    };
  }
  if (tabId === SYSTEM_TAB.FEED) {
    return {
      emptyTitle: "Nothing in Feed",
      emptyBody: "YouTube didn’t return For you videos. Try again, or go back to Watch later.",
    };
  }
  if (tabId === SYSTEM_TAB.SUBSCRIPTIONS) {
    return {
      emptyTitle: "No subscription videos",
      emptyBody: "When channels you follow post, they’ll show up here in chronological order.",
    };
  }
  return {
    emptyTitle: "This feed is empty",
    emptyBody: "Add channels or playlists in Edit, or pick another tab.",
  };
}

function applyEvent(event, extra = {}) {
  if (!shouldInjectSurface({ enabled: extensionEnabled })) return;
  if (event === NAV_EVENT.CHRONO_TAB) {
    homeLockUntil = 0;
  } else if (
    shouldBlockOtherDuringHomeLock({
      event,
      lockUntil: homeLockUntil,
      now: Date.now(),
    })
  ) {
    event = NAV_EVENT.YT_HOME;
  }
  const pendingBefore = peekPendingNav();
  if (event !== NAV_EVENT.CHRONO_TAB) {
    event = upgradeNavigationEvent(event, {
      pendingNav: pendingBefore,
      isReload: extra.isReload,
    });
  }
  const decision = resolveNavigation(event, {
    prefs: state.prefs,
    session: state.session,
    requestedTabId: extra.requestedTabId,
  });
  const sameTab = decision.tabId === state.session.tabId;
  const stickyCleared = Boolean(state.session.feedSticky) && !decision.feedSticky;
  state.session = decision;

  if (event === NAV_EVENT.OTHER && sameTab && !stickyCleared && !pendingBefore) {
    showSurface();
    if (root) applyOffsets(root);
    return;
  }

  state.selected = new Set();
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
      void chrome.storage.local
        .get(TAB_SNAPSHOT_STORAGE_KEY)
        .then((got) => {
          const next = mergeTabSnapshot(got[TAB_SNAPSHOT_STORAGE_KEY], tabId, videos);
          return chrome.storage.local.set({ [TAB_SNAPSHOT_STORAGE_KEY]: next });
        })
        .catch(() => {});
    }, 300)
  );
}

function hydrateSnapshots() {
  if (typeof chrome === "undefined" || !chrome.storage?.local) return Promise.resolve();
  return chrome.storage.local
    .get(TAB_SNAPSHOT_STORAGE_KEY)
    .then((got) => {
      hydrateCacheFromSnapshot(cache, got[TAB_SNAPSHOT_STORAGE_KEY]);
    })
    .catch(() => {});
}

function scheduleWarmPrefetch() {
  if (prefetchScheduled) return;
  prefetchScheduled = true;
  const run = () => {
    const ids = warmTabIds({
      currentTabId: state.session.tabId,
      customFeedIds: (state.prefs?.customFeeds || []).map((f) => f.id),
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
      /* keep going */
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
  state.selected = new Set();
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
      videoIds: items.map((v) => v.videoId),
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
  const next = [...items.filter((v) => !have.has(v.videoId)).map((v) => ({ ...v, playlistId: WATCH_LATER_PLAYLIST_ID })), ...(current.videos || [])];
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
      feedSources: playlistSourcesFromPrefs(state.prefs),
    });
    if (state.playlistPicker?.videoId !== videoId) return;
    state.playlistPicker = { videoId, items, loading: false, error: null };
  } catch (err) {
    if (state.playlistPicker?.videoId !== videoId) return;
    state.playlistPicker = {
      videoId,
      items: mergeSaveTargets({ feedSources: playlistSourcesFromPrefs(state.prefs) }),
      loading: false,
      error: friendlyError(err),
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
    advanced: false,
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
  const pending = (sourceInput?.value || state.sheet.query || "").trim();
  if (pending) {
    try {
      const results = await mainRpc("resolveSource", { query: pending });
      const first = results[0];
      if (first && !state.sheet.sources.some((s) => s.id === first.id)) {
        state.sheet.sources.push(first);
      }
    } catch (_) {
      /* name-only save is still valid */
    }
  }
  const feed = { id: state.sheet.id, name, sources: state.sheet.sources.slice() };
  state.prefs = await savePrefs(upsertCustomFeed(state.prefs, feed));
  state.sheet = null;
  showToast(`Saved “${name}”`);
  applyEvent(NAV_EVENT.CHRONO_TAB, { requestedTabId: feed.id });
}

async function confirmDeleteFeed() {
  if (!state.sheet) return;
  const feed = findCustomFeed(state.prefs, state.sheet.id);
  undoFeed = feed ? { ...feed, sources: feed.sources.map((s) => ({ ...s })) } : null;
  state.prefs = await savePrefs(removeCustomFeed(state.prefs, state.sheet.id));
  state.sheet = null;
  showToast(`Deleted “${feed?.name || "feed"}”`, { undo: true });
  applyEvent(NAV_EVENT.COLD);
}

async function undoLast() {
  if (!undoFeed) return;
  state.prefs = await savePrefs(upsertCustomFeed(state.prefs, undoFeed));
  const restored = undoFeed;
  undoFeed = null;
  showToast(`Restored “${restored.name}”`);
  applyEvent(NAV_EVENT.CHRONO_TAB, { requestedTabId: restored.id });
}

function showToast(message, { undo = false, ms = 6000 } = {}) {
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
    /* ignore */
  }
}

function peekNodesUnderDietRoot(event) {
  const nodes = [];
  if (event?.clientX == null || typeof document === "undefined") return nodes;
  const overlay = document.getElementById("diet-yt-root");
  const prev = overlay?.style?.pointerEvents;
  try {
    if (overlay) overlay.style.pointerEvents = "none";
    const stack =
      (typeof document.elementsFromPoint === "function"
        ? document.elementsFromPoint(event.clientX, event.clientY)
        : null) || [];
    if (!stack.length && typeof document.elementFromPoint === "function") {
      const one = document.elementFromPoint(event.clientX, event.clientY);
      if (one) stack.push(one);
    }
    for (const el of stack) {
      let node = el;
      while (node) {
        if (!nodes.includes(node)) nodes.push(node);
        node = node.parentElement || node.parentNode || node.host;
      }
    }
  } catch (_) {
    /* ignore */
  } finally {
    if (overlay) overlay.style.pointerEvents = prev || "";
  }
  return nodes;
}

function coordsHitHomeChrome(event) {
  if (event?.clientX == null || typeof document === "undefined") return false;
  const x = event.clientX;
  const y = event.clientY;
  const inRect = (el) => {
    if (!el || typeof el.getBoundingClientRect !== "function") return false;
    const r = el.getBoundingClientRect();
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
    "#create-icon",
  ];
  for (const sel of excludeSels) {
    if (inRect(document.querySelector(sel))) return false;
  }
  if (
    inRect(document.querySelector("#start")) ||
    inRect(document.querySelector("#logo")) ||
    inRect(document.querySelector("ytd-topbar-logo-renderer"))
  ) {
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
  const pathHits =
    gestureHitsHomeChrome(event, { pointNode, extraNodes }) ||
    isOutsideDietHomeChromeGesture(event);
  const coordHits = !pathHits && coordsHitHomeChrome(event);
  const underHits = extraNodes.some(
    (node) =>
      !nodeIsExcludedMastheadControl(node) &&
      (nodeIsMastheadHomeChrome(node) || nodeIsGuideHomeChrome(node))
  );
  const hits = pathHits || coordHits || underHits;
  dietDebug("intercept", {
    fired: hits,
    why: hits
      ? pathHits
        ? "path-home-chrome"
        : coordHits
          ? "coords-home-chrome"
          : "under-overlay-home-chrome"
      : insideDiet
        ? "inside-diet-root"
        : "no-home-chrome",
    feedSticky: state.session.feedSticky,
    tabId: state.session.tabId,
    target: event.target?.tagName,
    targetId: event.target?.id,
  });
  if (insideDiet && !hits) {
    return;
  }
  if (
    !shouldForceDietHomeOnStickyFeed({
      feedSticky: state.session.feedSticky,
      hitsHomeChrome: hits,
      insideDietRoot: insideDiet,
    })
  ) {
    return;
  }
  lastExternalGestureAt = Date.now();
  forceDietHomeUrl();
  forceDietHome(NAV_EVENT.YT_HOME);
  event.preventDefault();
  event.stopPropagation();
}

function recoverNativeWatchLater(pathname, search, event) {
  if (
    !shouldRecoverWatchLaterBounce({
      path: pathname,
      search,
      homeIntent: homeIntentActive(),
      event,
      prevWatch: isWatchPath(lastPath),
    })
  ) {
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

  if (
    shouldHideSurface({
      phase,
      destPath: next,
      destSearch: nextSearch,
      homeIntent,
    })
  ) {
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
    homeChrome: peekPendingNav() === "yt-home",
  });
  const event = upgradeNavigationEvent(classified, {
    pendingNav: peekPendingNav(),
    isReload: isReloadNavigation() && firstLoad,
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
    if (!painted || (root && !root.isConnected) || (live && root && live !== root)) {
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
    if (
      isDietSurfacePath(location.pathname) ||
      homeIntentActive() ||
      peekPendingNav() === "cold" ||
      isReloadNavigation()
    ) {
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
      homeIntent: homeIntentActive(),
    })) {
      // Do not re-COLD if the user already picked a Diet tab during prefs load.
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
        search: payload?.search,
      });
      if (
        isYouTubeHomeDestination(null, payload?.pathname || location.pathname) &&
        Date.now() - lastExternalGestureAt < 1000
      ) {
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
  if (
    peekPendingNav() === "yt-home" ||
    Date.now() < homeLockUntil ||
    Date.now() - lastExternalGestureAt < 1000
  ) {
    forceDietHome(NAV_EVENT.YT_HOME);
  }
}

function onReloadKey(event) {
  if (!shouldInjectSurface({ enabled: extensionEnabled })) return;
  const reloadKey =
    event.key === "F5" || ((event.key === "r" || event.key === "R") && (event.metaKey || event.ctrlKey));
  if (!reloadKey) return;
  setPendingNav("cold");
}

function onPageShow(event) {
  if (event.persisted || isReloadNavigation()) {
    if (isDietSurfacePath(location.pathname)) forceDietHome(NAV_EVENT.COLD);
  }
}

function bindLiveHomeChrome() {
  const attach = (el) => {
    if (!el || el.dataset?.dietHomeBound) return;
    if (el.dataset) el.dataset.dietHomeBound = "1";
    el.addEventListener("pointerdown", interceptYouTubeHome, true);
    el.addEventListener("click", interceptYouTubeHome, true);
  };
  const scan = () => {
    [
      "#masthead-container",
      "ytd-masthead",
      "#start",
      "#logo",
      "#guide",
      "ytd-mini-guide-renderer",
      "ytd-guide-renderer",
    ].forEach((sel) => {
      document.querySelectorAll(sel).forEach(attach);
    });
    document
      .querySelectorAll(
        "ytd-mini-guide-entry-renderer a[href='/'], ytd-guide-entry-renderer a[href='/'], ytd-mini-guide-renderer ytd-mini-guide-entry-renderer"
      )
      .forEach(attach);
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
    const pending = peekPendingNav();
    if (pending === "yt-home") forceDietHome(NAV_EVENT.YT_HOME);
    else if (pending === "cold") forceDietHome(NAV_EVENT.COLD);
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
      /* last resort: cloak.css + boot skeleton */
    }
  }
});
