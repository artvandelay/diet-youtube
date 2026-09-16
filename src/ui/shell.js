import { ICONS_DENSITY, LAYOUT, POSTED_WITHIN, SORT } from "../lib/constants.js";
import { moreMenuItems } from "../lib/playlist-save.js";
import { iconsMinmaxPx, normalizeIconsDensity } from "../lib/view.js";
import { buildTabStrip, tabLabel } from "../lib/tabs.js";
import { sheetActionFromClick } from "../lib/sheet-events.js";
import { ICONS, svg } from "./icons.js";

const POSTED_LABELS = {
  [POSTED_WITHIN.ANY]: "Any time",
  [POSTED_WITHIN.D1]: "Last 24 hours",
  [POSTED_WITHIN.D3]: "Last 3 days",
  [POSTED_WITHIN.D7]: "Last 7 days",
  [POSTED_WITHIN.D14]: "Last 14 days",
  [POSTED_WITHIN.D30]: "Last 30 days",
};

const SORT_LABELS = {
  [SORT.NEWEST]: "Newest",
  [SORT.OLDEST]: "Oldest",
  [SORT.CHANNEL]: "Channel A–Z",
};

const DENSITY_LABELS = {
  [ICONS_DENSITY.COMFORTABLE]: "Comfortable",
  [ICONS_DENSITY.DEFAULT]: "Default",
  [ICONS_DENSITY.DENSE]: "Dense",
};

function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function createShell(root, handlers) {
  root.id = "diet-yt-root";
  root.innerHTML = `
    <div class="diet-yt-chrome">
      <div class="diet-yt-tabs" role="tablist" aria-label="Diet-Youtube feeds"></div>
      <button type="button" class="diet-yt-plus" title="New feed" aria-label="Create custom feed">＋</button>
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

  const tabsEl = root.querySelector(".diet-yt-tabs");
  const plusBtn = root.querySelector(".diet-yt-plus");
  const viewBtn = root.querySelector(".diet-yt-view-btn");
  const menuEl = root.querySelector(".diet-yt-menu");
  const bodyEl = root.querySelector(".diet-yt-body");
  const surfaceEl = root.querySelector(".diet-yt-surface");
  const bulkEl = root.querySelector(".diet-yt-bulk");
  const seg = root.querySelector(".diet-yt-seg");

  plusBtn.addEventListener("click", () => handlers.onCreateFeed());
  viewBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    handlers.onToggleViewMenu();
  });
  seg.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-layout]");
    if (!btn) return;
    handlers.onLayoutChange(btn.dataset.layout);
  });

  tabsEl.addEventListener("click", (e) => {
    const edit = e.target.closest("[data-edit-feed]");
    if (edit) {
      e.preventDefault();
      e.stopPropagation();
      handlers.onEditFeed(edit.dataset.editFeed);
      return;
    }
    const tab = e.target.closest("[data-tab]");
    if (!tab) return;
    handlers.onTabClick(tab.dataset.tab);
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
      handlers.onReorderCustom(filtered);
    }
    try {
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    } catch (_) {
      /* ignore */
    }
  });

  surfaceEl.addEventListener("click", (e) => {
    const more = e.target.closest("[data-more]");
    if (more) {
      e.preventDefault();
      e.stopPropagation();
      handlers.onOpenMore(more.dataset.more);
      return;
    }
    const remove = e.target.closest("[data-remove]");
    if (remove) {
      e.preventDefault();
      e.stopPropagation();
      handlers.onRemoveOne(remove.dataset.remove);
      return;
    }
    const check = e.target.closest("[data-toggle]");
    if (check) {
      e.preventDefault();
      e.stopPropagation();
      handlers.onToggleSelect(check.dataset.toggle, e.shiftKey);
      return;
    }
    const card = e.target.closest("[data-video]");
    if (!card) return;
    if (e.metaKey || e.ctrlKey) {
      handlers.onToggleSelect(card.dataset.video, e.shiftKey);
      return;
    }
    if (e.shiftKey) {
      handlers.onToggleSelect(card.dataset.video, true);
      return;
    }
    handlers.onOpenVideo(card.dataset.video);
  });

  bulkEl.addEventListener("click", (e) => {
    if (e.target.closest("[data-bulk-remove]")) handlers.onRemoveSelected();
    if (e.target.closest("[data-bulk-clear]")) handlers.onClearSelection();
  });

  bodyEl.addEventListener("click", (e) => {
    const action = sheetActionFromClick(e.target);
    if (action === "retry") handlers.onRetry();
    if (action === "save") handlers.onSaveSheet();
    if (action === "delete") handlers.onDeleteSheet();
    if (action === "confirm-delete") handlers.onConfirmDelete();
    if (action === "add-source") {
      const btn = e.target.closest("[data-add-source]");
      handlers.onAddSource(btn.dataset.addSource, btn.dataset.sourceType, btn.dataset.sourceLabel);
    }
    if (action === "remove-source") {
      handlers.onRemoveSource(e.target.closest("[data-remove-source]").dataset.removeSource);
    }
    if (action === "resolve") handlers.onResolveSource();
    if (action === "undo") handlers.onUndo();
    if (action === "dismiss") handlers.onCloseSheet();
    if (e.target.closest("[data-save-wl]")) {
      e.preventDefault();
      e.stopPropagation();
      handlers.onSaveToWatchLater(e.target.closest("[data-save-wl]").dataset.saveWl);
      return;
    }
    if (e.target.closest("[data-save-playlist]")) {
      e.preventDefault();
      e.stopPropagation();
      handlers.onOpenPlaylistPicker(e.target.closest("[data-save-playlist]").dataset.savePlaylist);
      return;
    }
    if (e.target.closest("[data-pick-playlist]")) {
      e.preventDefault();
      e.stopPropagation();
      const btn = e.target.closest("[data-pick-playlist]");
      handlers.onPickPlaylist(btn.dataset.pickPlaylist, btn.dataset.playlistLabel);
      return;
    }
    if (e.target.closest("[data-dismiss-picker]")) {
      e.preventDefault();
      handlers.onClosePlaylistPicker();
    }
  });

  menuEl.addEventListener("click", (e) => {
    const item = e.target.closest("[data-sort],[data-posted],[data-home],[data-density]");
    if (item?.dataset.sort) handlers.onSortChange(item.dataset.sort);
    if (item?.dataset.posted) handlers.onPostedChange(item.dataset.posted);
    if (item?.dataset.home) handlers.onDefaultHomeChange(item.dataset.home);
    if (item?.dataset.density) handlers.onDensityChange(item.dataset.density);
    if (e.target.closest("[data-save-view]")) handlers.onSaveView();
  });

  const onDocClick = (e) => {
    if (!root.contains(e.target)) return;
    if (e.target.closest?.(".diet-yt-sheet, .diet-yt-sheet-backdrop, .diet-yt-toast, .diet-yt-picker")) return;
    if (!e.target.closest(".diet-yt-view-wrap")) handlers.onCloseViewMenu();
    if (!e.target.closest("[data-more], .diet-yt-more-menu")) handlers.onCloseMore?.();
  };
  document.addEventListener("click", onDocClick);

  function render(state) {
    renderTabs(tabsEl, state);
    renderSeg(seg, state);
    renderViewMenu(menuEl, viewBtn, state);
    renderBulk(bulkEl, state);
    renderSurface(surfaceEl, state);
    renderSheet(bodyEl, state, handlers);
    renderMoreMenu(root, bodyEl, state);
    renderPlaylistPicker(bodyEl, state, handlers);
    renderToast(bodyEl, state);
  }

  function destroy() {
    document.removeEventListener("click", onDocClick);
  }

  return { render, root, bodyEl, destroy };
}

function renderTabs(tabsEl, state) {
  const tabs = buildTabStrip(state.prefs);
  tabsEl.innerHTML = tabs
    .map((tab) => {
      const selected = tab.id === state.session.tabId;
      const edit =
        tab.type === "custom" && selected
          ? `<button type="button" class="diet-yt-tab-edit" data-edit-feed="${escapeHtml(tab.id)}" title="Edit feed" aria-label="Edit ${escapeHtml(tab.label)}">${svg(ICONS.pencil, 14)}</button>`
          : "";
      return `<button type="button" class="diet-yt-tab" role="tab" data-tab="${escapeHtml(tab.id)}" data-kind="${tab.type}" aria-selected="${selected}">
        <span>${escapeHtml(tab.label)}</span>${edit}
      </button>`;
    })
    .join("");
}

function renderSeg(seg, state) {
  for (const btn of seg.querySelectorAll("[data-layout]")) {
    btn.setAttribute("aria-pressed", String(btn.dataset.layout === state.view.layout));
  }
}

function renderViewMenu(menuEl, viewBtn, state) {
  const open = Boolean(state.viewMenuOpen);
  viewBtn.setAttribute("aria-expanded", String(open));
  menuEl.hidden = !open;
  if (!open) return;
  const label = tabLabel(state.prefs, state.session.tabId);
  const dirty = state.viewDirty;
  const density = normalizeIconsDensity(state.view.density);
  menuEl.innerHTML = `
    <div class="diet-yt-menu-label">Sort</div>
    ${Object.entries(SORT_LABELS)
      .map(
        ([id, text]) =>
          `<button type="button" class="diet-yt-item" data-sort="${id}" role="menuitemradio" aria-checked="${state.view.sort === id}">${escapeHtml(text)}</button>`
      )
      .join("")}
    <div class="diet-yt-menu-sep"></div>
    <div class="diet-yt-menu-label">Posted within</div>
    ${Object.entries(POSTED_LABELS)
      .map(
        ([id, text]) =>
          `<button type="button" class="diet-yt-item" data-posted="${id}" role="menuitemradio" aria-checked="${state.view.postedWithin === id}">${escapeHtml(text)}</button>`
      )
      .join("")}
    <div class="diet-yt-menu-sep"></div>
    <div class="diet-yt-menu-label">Icons density</div>
    ${Object.entries(DENSITY_LABELS)
      .map(
        ([id, text]) =>
          `<button type="button" class="diet-yt-item" data-density="${id}" role="menuitemradio" aria-checked="${density === id}">${escapeHtml(text)}</button>`
      )
      .join("")}
    <div class="diet-yt-menu-sep"></div>
    <div class="diet-yt-menu-label">Default home</div>
    <button type="button" class="diet-yt-item" data-home="watch-later" aria-checked="${state.prefs.defaultHome === "watch-later"}">Watch later</button>
    <button type="button" class="diet-yt-item" data-home="subscriptions" aria-checked="${state.prefs.defaultHome === "subscriptions"}">Subscriptions</button>
    <div class="diet-yt-menu-sep"></div>
    <p class="diet-yt-menu-hint">Applies to this tab now. Save as default to keep it next visit.</p>
    <button type="button" class="diet-yt-menu-save" data-save-view ${dirty ? "" : "disabled"}>Save as default for ${escapeHtml(label)}</button>
  `;
}

function renderBulk(bulkEl, state) {
  const n = state.selected?.size || 0;
  if (!n || !state.canRemove) {
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
  return [video.channelTitle, video.viewCountText, video.publishedText].filter(Boolean).join(" · ");
}

function moreButton(video, state) {
  const open = state.cardMenu?.videoId === video.videoId;
  return `<button type="button" class="diet-yt-more" data-more="${escapeHtml(video.videoId)}" title="More actions" aria-label="More actions for ${escapeHtml(video.title)}" aria-haspopup="menu" aria-expanded="${open}">${svg(ICONS.more, 20)}</button>`;
}

function cardActions(video, state) {
  const selected = state.selected?.has(video.videoId);
  const remove = state.canRemove
    ? `<button type="button" class="diet-yt-card-x" data-remove="${escapeHtml(video.videoId)}" title="Remove" aria-label="Remove ${escapeHtml(video.title)}">${svg(ICONS.close, 16)}</button>`
    : "";
  const check = state.canRemove
    ? `<button type="button" class="diet-yt-check" data-toggle="${escapeHtml(video.videoId)}" aria-pressed="${selected}" aria-label="Select">${selected ? svg(ICONS.check, 16) : ""}</button>`
    : "";
  return check + remove + moreButton(video, state);
}

function renderSurface(surfaceEl, state) {
  const density = normalizeIconsDensity(state.view.density);
  const iconMin = iconsMinmaxPx(density);
  const iconsAttr = `class="diet-yt-icons" data-density="${density}" style="--diet-icon-min:${iconMin}px"`;
  if (state.loading && !state.videos.length) {
    const skel =
      state.view.layout === LAYOUT.LIST
        ? `<div class="diet-yt-list">${Array.from({ length: 8 }, () => `<div class="diet-yt-row"><div></div><div class="diet-yt-skel" style="height:90px"></div><div><div class="diet-yt-skel" style="height:14px;width:70%;margin-bottom:8px"></div><div class="diet-yt-skel" style="height:12px;width:40%"></div></div></div>`).join("")}</div>`
        : `<div ${iconsAttr}>${Array.from({ length: 8 }, () => `<div class="diet-yt-skel-card"><div class="diet-yt-skel diet-yt-skel-thumb"></div><div class="diet-yt-skel diet-yt-skel-line"></div><div class="diet-yt-skel diet-yt-skel-line short"></div></div>`).join("")}</div>`;
    surfaceEl.innerHTML = skel;
    return;
  }

  if (state.error) {
    surfaceEl.innerHTML = `<div class="diet-yt-error"><h2>Couldn’t load this feed</h2><p>${escapeHtml(state.error)}</p><button type="button" class="diet-yt-retry" data-retry>Try again</button></div>`;
    return;
  }

  if (!state.videos.length) {
    surfaceEl.innerHTML = `<div class="diet-yt-empty"><h2>${escapeHtml(state.emptyTitle)}</h2><p>${escapeHtml(state.emptyBody)}</p></div>`;
    return;
  }

  if (state.view.layout === LAYOUT.LIST) {
    surfaceEl.innerHTML = `<div class="diet-yt-list">${state.videos
      .map((video) => {
        const selected = state.selected?.has(video.videoId);
        return `<div class="diet-yt-row${selected ? " is-selected" : ""}" data-video="${escapeHtml(video.videoId)}" role="link" tabindex="0">
          <div>${state.canRemove ? `<button type="button" class="diet-yt-check" data-toggle="${escapeHtml(video.videoId)}" aria-pressed="${selected}">${selected ? "✓" : ""}</button>` : ""}</div>
          <div class="diet-yt-thumb"><img alt="" src="${escapeHtml(video.thumbUrl)}">${video.lengthText ? `<span class="diet-yt-dur">${escapeHtml(video.lengthText)}</span>` : ""}</div>
          <div><div class="diet-yt-row-title">${escapeHtml(video.title)}</div><div class="diet-yt-row-sub">${escapeHtml(metaLine(video))}</div></div>
          <div class="diet-yt-row-actions">${state.canRemove ? `<button type="button" class="diet-yt-card-x" data-remove="${escapeHtml(video.videoId)}" aria-label="Remove">✕</button>` : ""}${moreButton(video, state)}</div>
        </div>`;
      })
      .join("")}</div>`;
    return;
  }

  surfaceEl.innerHTML = `<div ${iconsAttr}>${state.videos
    .map((video) => {
      const selected = state.selected?.has(video.videoId);
      return `<article class="diet-yt-card${selected ? " is-selected" : ""}" data-video="${escapeHtml(video.videoId)}" tabindex="0">
        <div class="diet-yt-thumb">
          <img alt="" src="${escapeHtml(video.thumbUrl)}">
          ${video.lengthText ? `<span class="diet-yt-dur">${escapeHtml(video.lengthText)}</span>` : ""}
          ${cardActions(video, state)}
        </div>
        <div class="diet-yt-card-meta">
          <div class="diet-yt-card-title">${escapeHtml(video.title)}</div>
          <div class="diet-yt-card-sub">${escapeHtml(metaLine(video))}</div>
        </div>
      </article>`;
    })
    .join("")}</div>`;
}

function renderSheet(bodyEl, state, handlers) {
  bodyEl.querySelector(".diet-yt-sheet-backdrop")?.remove();
  const sheet = state.sheet;
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
        ${
          suggestions.length
            ? `<div class="diet-yt-suggest">${suggestions
                .map(
                  (s) =>
                    `<button type="button" data-add-source="${escapeHtml(s.id)}" data-source-type="${escapeHtml(s.type)}" data-source-label="${escapeHtml(s.label)}">${escapeHtml(s.label)} <span style="color:#aaa">· ${s.type}</span></button>`
                )
                .join("")}</div>`
            : ""
        }
      </div>
      <div>${(sheet.sources || [])
        .map(
          (s) => `<div class="diet-yt-source-row">
            <div><strong>${escapeHtml(s.label)}</strong>${advanced ? `<span class="diet-yt-source-id">${escapeHtml(s.id)}</span>` : ""}</div>
            <button type="button" class="diet-yt-ghost" data-remove-source="${escapeHtml(s.id)}">Remove</button>
          </div>`
        )
        .join("")}</div>
      <details class="diet-yt-advanced" ${advanced ? "open" : ""}>
        <summary>Advanced (IDs)</summary>
        <p class="diet-yt-card-sub">Channel and playlist IDs stay here — never on the reading surface.</p>
      </details>
      ${
        confirm
          ? `<p>Delete “${escapeHtml(sheet.name || "this feed")}”? This only removes the Diet-Youtube tab.</p>`
          : ""
      }
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
    state.sheet.name = nameInput.value;
  });
  sourceInput.addEventListener("input", () => {
    state.sheet.query = sourceInput.value;
  });
  sourceInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      document.querySelector("#diet-yt-root")?.dispatchEvent(new CustomEvent("diet-yt-resolve"));
    }
  });
  node.querySelector(".diet-yt-advanced")?.addEventListener("toggle", (e) => {
    state.sheet.advanced = e.target.open;
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
  bind("[data-save-feed]", () => handlers.onSaveSheet());
  bind("button[data-dismiss-sheet]", () => handlers.onCloseSheet());
  bind("[data-delete-feed]", () => handlers.onDeleteSheet());
  bind("[data-confirm-delete]", () => handlers.onConfirmDelete());
  bind("[data-resolve]", () => handlers.onResolveSource());
  node.querySelectorAll("[data-add-source]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      handlers.onAddSource(btn.dataset.addSource, btn.dataset.sourceType, btn.dataset.sourceLabel);
    });
  });
  node.querySelectorAll("[data-remove-source]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      handlers.onRemoveSource(btn.dataset.removeSource);
    });
  });
  node.addEventListener("click", (e) => {
    if (e.target === node) handlers.onCloseSheet();
  });
  bodyEl.appendChild(node);
  queueMicrotask(() => nameInput.focus());
}

function renderMoreMenu(root, bodyEl, state) {
  bodyEl.querySelector(".diet-yt-more-menu")?.remove();
  const videoId = state.cardMenu?.videoId;
  if (!videoId) return;
  const items = moreMenuItems(state.session.tabId);
  const menu = el(`<div class="diet-yt-more-menu" role="menu">
    ${items
      .map((item) => {
        const attr = item.id === "save-wl" ? "data-save-wl" : "data-save-playlist";
        return `<button type="button" class="diet-yt-item" role="menuitem" ${attr}="${escapeHtml(videoId)}">${escapeHtml(item.label)}</button>`;
      })
      .join("")}
  </div>`);
  bodyEl.appendChild(menu);
  const btn = root.querySelector(`[data-more="${CSS.escape(videoId)}"]`);
  if (!btn) return;
  const rootRect = root.getBoundingClientRect();
  const btnRect = btn.getBoundingClientRect();
  const top = btnRect.bottom - rootRect.top + 4;
  let left = btnRect.right - rootRect.left - 240;
  left = Math.max(8, Math.min(left, rootRect.width - 248));
  menu.style.top = `${top}px`;
  menu.style.left = `${left}px`;
}

function renderPlaylistPicker(bodyEl, state, handlers) {
  bodyEl.querySelector(".diet-yt-picker")?.remove();
  const picker = state.playlistPicker;
  if (!picker) return;
  const items = picker.items || [];
  const node = el(`<div class="diet-yt-sheet-backdrop diet-yt-picker" data-dismiss-picker>
    <div class="diet-yt-sheet" role="dialog" aria-labelledby="diet-yt-picker-title">
      <h2 id="diet-yt-picker-title">Save to playlist</h2>
      ${
        picker.loading
          ? `<p class="diet-yt-card-sub">Loading your playlists…</p>`
          : picker.error
            ? `<p class="diet-yt-card-sub">${escapeHtml(picker.error)}</p>`
            : !items.length
              ? `<p class="diet-yt-card-sub">No playlists found. Watch later is still available from the ⋮ menu.</p>`
              : `<div class="diet-yt-picker-list">${items
                  .map(
                    (p) =>
                      `<button type="button" class="diet-yt-item" data-pick-playlist="${escapeHtml(p.id)}" data-playlist-label="${escapeHtml(p.label)}">${escapeHtml(p.label)}${p.alreadyIn ? `<span class="diet-yt-picker-flag">Saved</span>` : ""}</button>`
                  )
                  .join("")}</div>`
      }
      <div class="diet-yt-sheet-actions">
        <button type="button" class="diet-yt-btn-secondary" data-dismiss-picker>Cancel</button>
      </div>
    </div>
  </div>`);
  node.addEventListener("click", (e) => {
    if (e.target === node) handlers.onClosePlaylistPicker();
  });
  node.querySelector("[data-dismiss-picker].diet-yt-btn-secondary")?.addEventListener("click", (e) => {
    e.preventDefault();
    handlers.onClosePlaylistPicker();
  });
  node.querySelectorAll("[data-pick-playlist]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      handlers.onPickPlaylist(btn.dataset.pickPlaylist, btn.dataset.playlistLabel);
    });
  });
  bodyEl.appendChild(node);
}

function renderToast(bodyEl, state) {
  bodyEl.querySelector(".diet-yt-toast")?.remove();
  if (!state.toast) return;
  const toast = el(`<div class="diet-yt-toast" role="status">${escapeHtml(state.toast.message)}${state.toast.undo ? `<button type="button" data-undo>Undo</button>` : ""}</div>`);
  bodyEl.appendChild(toast);
}

export function watchUrl(video) {
  const params = new URLSearchParams({ v: video.videoId });
  // Never attach list=WL — YouTube then treats Home/back as /playlist?list=WL.
  if (video.playlistId && video.playlistId !== "WL") params.set("list", video.playlistId);
  return `/watch?${params.toString()}`;
}
