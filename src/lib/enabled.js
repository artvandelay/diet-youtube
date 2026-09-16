/** Diet-Youtube on/off — toolbar popup persists this; default is On. */

export const ENABLED_STORAGE_KEY = "dietYtEnabled";

/** Missing / undefined / null means On. Only an explicit `false` disables. */
export function isDietEnabled(value) {
  return value !== false;
}

/**
 * document_start cloak + Home intercept.
 * When Off, native YouTube Home/Feed must paint — never cloak.
 */
export function shouldCloakHome({ enabled, isHome = false } = {}) {
  return isDietEnabled(enabled) && Boolean(isHome);
}

/**
 * Isolated Diet surface, logo/Home intercept, and skeleton remount.
 * When Off, skip all of it so vanilla YouTube wins.
 */
export function shouldInjectSurface({ enabled } = {}) {
  return isDietEnabled(enabled);
}

export function shouldRunDietChrome({ enabled, pathIsDietHome = false, homeIntent = false } = {}) {
  if (!isDietEnabled(enabled)) return false;
  return Boolean(pathIsDietHome || homeIntent);
}
