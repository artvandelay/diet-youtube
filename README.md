# Diet-Youtube

**A Chrome extension that replaces YouTube’s impulse Home with a queue-first reading surface.**

Watch later is the diet home. The algorithmic Feed stays one extra click away. Subscriptions stay chronological. Click **＋** to make a **new feed** — name it and add channels or playlists (for example a Learning feed from a few channels).

Nothing leaves your browser. Preferences stay in `chrome.storage`. Playlist reads and Watch later edits use YouTube’s own page session (Innertube) — there is no Diet-Youtube backend.

**Author:** [artvandelay](https://github.com/artvandelay) · **Version:** 1.1.0 · **License:** MIT

**Live page:** [artvandelay.github.io/diet-youtube](https://artvandelay.github.io/diet-youtube/)

## Screenshots

Subscriptions as a chronological Icons grid (queue-first chrome above):

![Subscriptions in Icons layout](docs/screenshots/02-subscriptions-icons.jpg)

Make a **new feed**: name it and add channels or playlists (example: Learning Playlist + The Verge):

![New feed sheet with name and sources](docs/screenshots/04-custom-feed.jpg)

View menu: sort, posted-within, Icons density, and Save as default (per feed). Session changes apply immediately; only Save writes prefs:

![View menu with density controls](docs/screenshots/03-view-menu-density.jpg)

## Install (Load unpacked)

1. Clone this repo (or download the ZIP from GitHub → **Code** → **Download ZIP** and unzip).
2. Open Chrome → `chrome://extensions`.
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked**.
5. Select **this repository folder** (the one that contains `manifest.json`).
6. Open [youtube.com](https://www.youtube.com) while signed in.

You should land on **Watch later**, even if that queue is empty. YouTube’s For you grid stays behind the Diet-Youtube chrome.

After updates, click **Reload** on the extension card at `chrome://extensions`.

## What you get

- **One chrome row:** Feed · Watch later · Subscriptions · your custom feeds · ＋ · List/Icons · View
- **New feed (＋):** name a feed and add channels or playlists — e.g. Learning Playlist from a few sources — then edit, rename, delete, or drag-reorder tabs
- **Cold start, logo, sidebar Home, watch→home, hard refresh** always open Watch later (or the default home you saved). An empty queue stays empty — it never auto-bounces to Subscriptions or Feed.
- **Feed** only after an explicit Diet-Youtube tab click. It sticks until reload, logo, or Home.
- **Icons** is the default layout; **List** is one click away.
- **View menu:** Sort (Newest / Oldest / Channel A–Z), Posted within, Icons density (Comfortable / Default / Dense). Changes apply to the current tab immediately. **Save as default** is the only write to prefs, per active tab.
- **Faster tabs:** cache-first paint on switch, background refresh, and idle prefetch for Watch later / Subscriptions / custom feeds.
- **Watch later remove:** hover to remove one, or checkbox / ⌘-click / shift-range + **Remove N**.

## Privacy

Diet-Youtube runs only on YouTube pages in your browser. It does not upload your Watch later or subscriptions list to a Diet-Youtube server. Feeds and view defaults live in `chrome.storage.local`.

## Develop

```bash
npm test          # rebuilds the content IIFE, then runs unit tests
npm run build     # rebuild src/content/content.bundle.js after editing ESM sources
```

Chrome Load unpacked injects `content_scripts` as classic scripts, so the isolated world ships as `src/content/content.bundle.js` (IIFE). Edit `src/content/content.js` and its imports, then `npm run build`.

## Out of scope (for now)

Group-by-channel, Dock-style neighbor magnification, and hover-peek.

## Changelog (short)

- **1.1.0** — Cache-first tabs + prefetch; Icons density; session sort/posted/density vs Save as default.
- **1.0.x** — Greenfield MV3: queue-first home, Feed sticky policy, List/Icons, custom feeds, Watch later remove.
