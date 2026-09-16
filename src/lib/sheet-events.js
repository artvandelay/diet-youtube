/**
 * Feed-sheet click routing.
 * The backdrop is [data-dismiss-sheet], so closest() from Save/Delete would
 * also match it — action buttons must win, and only the backdrop itself or
 * Cancel dismisses.
 */

export function eventElement(target) {
  if (!target) return null;
  if (typeof target.closest === "function") return target;
  return target.parentElement || null;
}

export function sheetActionFromClick(target) {
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
