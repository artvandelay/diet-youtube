import { ICONS_DENSITY, POSTED_WITHIN, SORT } from "./constants.js";

export const ICONS_DENSITY_MINMAX_PX = Object.freeze({
  [ICONS_DENSITY.COMFORTABLE]: 280,
  [ICONS_DENSITY.DEFAULT]: 210,
  [ICONS_DENSITY.DENSE]: 160,
});

export function normalizeIconsDensity(density) {
  if (density === ICONS_DENSITY.COMFORTABLE || density === ICONS_DENSITY.DENSE) return density;
  return ICONS_DENSITY.DEFAULT;
}

export function iconsMinmaxPx(density) {
  return ICONS_DENSITY_MINMAX_PX[normalizeIconsDensity(density)];
}

const UNIT_MS = {
  second: 1_000,
  seconds: 1_000,
  minute: 60_000,
  minutes: 60_000,
  hour: 3_600_000,
  hours: 3_600_000,
  day: 86_400_000,
  days: 86_400_000,
  week: 604_800_000,
  weeks: 604_800_000,
  month: 2_592_000_000,
  months: 2_592_000_000,
  year: 31_536_000_000,
  years: 31_536_000_000,
};

const POSTED_MS = {
  [POSTED_WITHIN.ANY]: 0,
  [POSTED_WITHIN.D1]: 1 * 86_400_000,
  [POSTED_WITHIN.D3]: 3 * 86_400_000,
  [POSTED_WITHIN.D7]: 7 * 86_400_000,
  [POSTED_WITHIN.D14]: 14 * 86_400_000,
  [POSTED_WITHIN.D30]: 30 * 86_400_000,
};

export function parseRelativeTime(text, now = Date.now()) {
  if (!text) return null;
  const m = String(text).match(/(\d+)\s+(second|minute|hour|day|week|month|year)s?/i);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  const ms = UNIT_MS[unit] || UNIT_MS[`${unit}s`];
  if (!ms) return null;
  return now - n * ms;
}

export function postedWithinMs(postedWithin) {
  return POSTED_MS[postedWithin] || 0;
}

export function applyView(videos, { sort = SORT.NEWEST, postedWithin = POSTED_WITHIN.ANY } = {}, now = Date.now()) {
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
    out.sort((a, b) =>
      String(a.channelTitle || "").localeCompare(String(b.channelTitle || ""), undefined, {
        sensitivity: "base",
      })
    );
  } else {
    out.sort((a, b) => (b.publishedMs || 0) - (a.publishedMs || 0));
  }
  return out;
}

export function viewsEqual(a, b) {
  return (
    a?.layout === b?.layout &&
    a?.sort === b?.sort &&
    a?.postedWithin === b?.postedWithin &&
    normalizeIconsDensity(a?.density) === normalizeIconsDensity(b?.density)
  );
}

/** Session overlay on top of the saved default. Missing session → saved. */
export function resolveSessionView(saved, sessionView) {
  if (!sessionView) return { ...saved };
  return { ...saved, ...sessionView };
}

/** Sort / posted / density / layout apply in-memory only until Save as default. */
export function applySessionViewPatch(current, patch) {
  return { ...current, ...patch };
}
