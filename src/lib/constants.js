/** Diet-Youtube constants — system tab ids and view defaults. */

export const APP_NAME = "Diet-Youtube";
export const APP_ID = "diet-youtube";
export const APP_VERSION = "1.2.0";

export const SYSTEM_TAB = Object.freeze({
  FEED: "feed",
  WATCH_LATER: "watch-later",
  SUBSCRIPTIONS: "subscriptions",
});

export const SYSTEM_TABS = Object.freeze([
  { id: SYSTEM_TAB.FEED, type: "system", label: "Feed" },
  { id: SYSTEM_TAB.WATCH_LATER, type: "system", label: "Watch later" },
  { id: SYSTEM_TAB.SUBSCRIPTIONS, type: "system", label: "Subscriptions" },
]);

export const LAYOUT = Object.freeze({
  LIST: "list",
  ICONS: "icons",
});

export const SORT = Object.freeze({
  NEWEST: "newest",
  OLDEST: "oldest",
  CHANNEL: "channel",
});

export const POSTED_WITHIN = Object.freeze({
  ANY: "any",
  D1: "1d",
  D3: "3d",
  D7: "7d",
  D14: "14d",
  D30: "30d",
});

export const ICONS_DENSITY = Object.freeze({
  COMFORTABLE: "comfortable",
  DEFAULT: "default",
  DENSE: "dense",
});

export const DEFAULT_LAYOUT = LAYOUT.ICONS;
export const DEFAULT_ICONS_DENSITY = ICONS_DENSITY.DEFAULT;

export const DEFAULT_VIEW = Object.freeze({
  layout: DEFAULT_LAYOUT,
  sort: SORT.NEWEST,
  postedWithin: POSTED_WITHIN.ANY,
  density: DEFAULT_ICONS_DENSITY,
});

export const WATCH_LATER_PLAYLIST_ID = "WL";

export const MSG = Object.freeze({
  ISOLATED: "diet-yt-isolated",
  MAIN: "diet-yt-main",
});

export const SYSTEM_TAB_LABELS = Object.freeze({
  [SYSTEM_TAB.FEED]: "Feed",
  [SYSTEM_TAB.WATCH_LATER]: "Watch later",
  [SYSTEM_TAB.SUBSCRIPTIONS]: "Subscriptions",
});
