/**
 * Diet surface mount + cloak policy.
 * Keep this free of DOM writes so unit tests can pin remount / hide / recover.
 */

import {
  NAV_EVENT,
  isHomePath,
  isWatchLaterPlaylistPath,
  isWatchPath,
} from "./nav-policy.js";

/**
 * Empty `#diet-yt-root` under `html.diet-yt-active` is a black page.
 * Remount whenever the live node lost chrome or our shell is bound to a detached root.
 */
export function rootNeedsRemount({
  connected,
  hasChrome,
  shellBoundToRoot,
  liveIdMismatch,
} = {}) {
  if (liveIdMismatch) return true;
  if (!hasChrome) return true;
  if (!shellBoundToRoot) return true;
  if (connected === false && !hasChrome) return true;
  return false;
}

/**
 * Never hide the Diet panel on a home destination.
 * `yt-navigate-start` may still report /watch — with a home intent, stay painted.
 */
export function shouldHideSurface({ phase, destPath, destSearch, homeIntent } = {}) {
  const dest = destPath || "";
  if (isHomePath(dest)) return false;
  if (homeIntent && isWatchLaterPlaylistPath(dest, destSearch)) return false;
  if (phase === "start" && homeIntent) return false;
  if (isWatchPath(dest)) return true;
  if (isWatchLaterPlaylistPath(dest, destSearch)) return true;
  return !isHomePath(dest);
}

export function shouldRecoverWatchLaterBounce({
  path,
  search,
  homeIntent,
  event,
  prevWatch,
} = {}) {
  if (!isWatchLaterPlaylistPath(path, search)) return false;
  if (homeIntent) return true;
  if (prevWatch) return true;
  return event === NAV_EVENT.YT_HOME || event === NAV_EVENT.WATCH_TO_HOME;
}

export function shouldPaintShell({ path, search, homeIntent } = {}) {
  if (isHomePath(path)) return true;
  return shouldRecoverWatchLaterBounce({ path, search, homeIntent });
}

export function rootHasDietChrome(root) {
  if (!root || typeof root.querySelector !== "function") return false;
  return Boolean(root.querySelector(".diet-yt-chrome, .diet-yt-boot-chrome"));
}

export const HOME_INTENT_MS = 5000;
