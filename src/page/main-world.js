/**
 * Diet-Youtube MAIN-world adapter.
 * Reads ytcfg / ytInitialData, walks lockupViewModel + classic renderers,
 * fetches playlists via same-origin Innertube, edits Watch Later.
 *
 * Isolated world talks to this file only through window.postMessage.
 */
(function () {
  const SOURCE = "diet-yt-main";
  const LISTEN = "diet-yt-isolated";

  function walk(node, visit, seen) {
    if (!node || typeof node !== "object") return;
    if (!seen) seen = new Set();
    if (seen.has(node)) return;
    seen.add(node);
    visit(node);
    if (Array.isArray(node)) {
      for (const item of node) walk(item, visit, seen);
      return;
    }
    for (const key of Object.keys(node)) walk(node[key], visit, seen);
  }

  function textOf(value) {
    if (!value) return "";
    if (typeof value === "string") return value;
    if (value.simpleText) return value.simpleText;
    if (value.content) return value.content;
    if (Array.isArray(value.runs)) return value.runs.map((r) => r.text || "").join("");
    if (value.accessibility?.accessibilityData?.label) return value.accessibility.accessibilityData.label;
    return "";
  }

  function bestThumb(thumbs) {
    if (!Array.isArray(thumbs) || !thumbs.length) return "";
    const sorted = thumbs.slice().sort((a, b) => (b.width || 0) - (a.width || 0));
    const mid = sorted.find((t) => (t.width || 0) >= 320) || sorted[0];
    return mid.url || "";
  }

  function parseRelativeMs(text) {
    if (!text) return null;
    const m = String(text).match(/(\d+)\s+(second|minute|hour|day|week|month|year)s?/i);
    if (!m) return null;
    const n = Number(m[1]);
    const unit = m[2].toLowerCase();
    const table = {
      second: 1e3,
      minute: 6e4,
      hour: 36e5,
      day: 864e5,
      week: 6048e5,
      month: 2592e6,
      year: 31536e6,
    };
    return Date.now() - n * (table[unit] || 0);
  }

  function fromLockup(lockup, extras) {
    const watch =
      lockup.rendererContext?.commandContext?.onTap?.innertubeCommand?.watchEndpoint ||
      lockup.rendererContext?.commandContext?.onTap?.innertubeCommand?.reelWatchEndpoint ||
      {};
    const videoId = lockup.contentId || watch.videoId || null;
    if (!videoId) return null;
    if (lockup.contentType && String(lockup.contentType).toLowerCase().includes("short")) return null;

    const meta = lockup.metadata?.lockupMetadataViewModel || {};
    const title = textOf(meta.title);
    const rows = meta.metadata?.contentMetadataViewModel?.metadataRows || [];
    const parts = [];
    for (const row of rows) {
      for (const part of row.metadataParts || []) {
        const t = textOf(part.text);
        if (t) parts.push(t);
      }
    }
    const channelTitle = parts[0] || "";
    const viewCountText = parts.find((p) => /view|watching/i.test(p)) || "";
    const publishedText = parts.find((p) => /ago|streamed|premiered|scheduled/i.test(p)) || parts[parts.length - 1] || "";

    const image =
      lockup.contentImage?.thumbnailViewModel?.image?.sources ||
      lockup.contentImage?.thumbnailViewModel?.thumbnail?.sources ||
      [];

    const channelNav =
      meta.image?.decoratedAvatarViewModel?.rendererContext?.commandContext?.onTap?.innertubeCommand
        ?.browseEndpoint ||
      meta.image?.avatarViewModel?.rendererContext?.commandContext?.onTap?.innertubeCommand?.browseEndpoint ||
      {};

    const badges = lockup.contentImage?.thumbnailViewModel?.overlays || [];
    let lengthText = "";
    walk(badges, (n) => {
      if (!lengthText && n?.thumbnailOverlayTimeStatusViewModel?.text) {
        lengthText = textOf(n.thumbnailOverlayTimeStatusViewModel.text);
      }
      if (!lengthText && n?.text?.content && /^\d+:\d+/.test(n.text.content)) lengthText = n.text.content;
    });

    return normalize({
      videoId,
      setVideoId: extras?.setVideoId || watch.playlistSetVideoId || null,
      title,
      channelTitle,
      channelId: channelNav.browseId || "",
      thumbUrl: bestThumb(image),
      publishedText,
      publishedMs: parseRelativeMs(publishedText),
      viewCountText,
      lengthText,
      playlistId: extras?.playlistId || watch.playlistId || null,
    });
  }

  function fromVideoRenderer(node, extras) {
    const videoId = node.videoId;
    if (!videoId) return null;
    const title = textOf(node.title);
    const channelTitle = textOf(node.shortBylineText || node.ownerText || node.longBylineText);
    const channelRun = (node.shortBylineText?.runs || node.ownerText?.runs || [])[0];
    const channelId = channelRun?.navigationEndpoint?.browseEndpoint?.browseId || "";
    const publishedText = textOf(node.publishedTimeText);
    return normalize({
      videoId,
      setVideoId: node.setVideoId || extras?.setVideoId || null,
      title,
      channelTitle,
      channelId,
      thumbUrl: bestThumb(node.thumbnail?.thumbnails),
      publishedText,
      publishedMs: parseRelativeMs(publishedText),
      viewCountText: textOf(node.shortViewCountText || node.viewCountText),
      lengthText: textOf(node.lengthText),
      playlistId: extras?.playlistId || node.navigationEndpoint?.watchEndpoint?.playlistId || null,
    });
  }

  function normalize(partial) {
    if (!partial?.videoId || !partial.title) return null;
    return {
      videoId: partial.videoId,
      setVideoId: partial.setVideoId || null,
      title: partial.title,
      channelTitle: partial.channelTitle || "",
      channelId: partial.channelId || "",
      thumbUrl: partial.thumbUrl || `https://i.ytimg.com/vi/${partial.videoId}/hqdefault.jpg`,
      publishedText: partial.publishedText || "",
      publishedMs: partial.publishedMs || parseRelativeMs(partial.publishedText),
      viewCountText: partial.viewCountText || "",
      lengthText: partial.lengthText || "",
      playlistId: partial.playlistId || null,
    };
  }

  function extractVideos(root, extras) {
    const out = [];
    const seen = new Set();
    walk(root, (node) => {
      let video = null;
      if (node.lockupViewModel) video = fromLockup(node.lockupViewModel, extras);
      else if (node.playlistVideoRenderer) video = fromVideoRenderer(node.playlistVideoRenderer, extras);
      else if (node.videoRenderer) video = fromVideoRenderer(node.videoRenderer, extras);
      else if (node.compactVideoRenderer) video = fromVideoRenderer(node.compactVideoRenderer, extras);
      else if (node.gridVideoRenderer) video = fromVideoRenderer(node.gridVideoRenderer, extras);
      else if (node.richItemRenderer?.content?.videoRenderer) {
        video = fromVideoRenderer(node.richItemRenderer.content.videoRenderer, extras);
      }
      if (!video) return;
      const key = `${video.videoId}:${video.setVideoId || ""}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push(video);
    });
    return out;
  }

  function extractContinuations(root) {
    const tokens = [];
    walk(root, (node) => {
      if (node.continuationCommand?.token) tokens.push(node.continuationCommand.token);
      if (node.nextContinuationData?.continuation) tokens.push(node.nextContinuationData.continuation);
      if (node.continuationEndpoint?.continuationCommand?.token) {
        tokens.push(node.continuationEndpoint.continuationCommand.token);
      }
    });
    return [...new Set(tokens)];
  }

  function readYtcfg() {
    const ytcfg = window.ytcfg;
    const get = (key) => {
      try {
        if (ytcfg && typeof ytcfg.get === "function") return ytcfg.get(key);
      } catch (_) {
        /* ignore */
      }
      return ytcfg?.data_?.[key];
    };
    return {
      INNERTUBE_API_KEY: get("INNERTUBE_API_KEY") || "",
      INNERTUBE_CONTEXT: get("INNERTUBE_CONTEXT") || null,
      VISITOR_DATA: get("VISITOR_DATA") || get("INNERTUBE_CONTEXT")?.client?.visitorData || "",
      LOGGED_IN: Boolean(get("LOGGED_IN")),
      DELEGATED_SESSION_ID: get("DELEGATED_SESSION_ID") || "",
    };
  }

  function cookie(name) {
    const m = document.cookie.match(new RegExp("(?:^|; )" + name.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&") + "=([^;]*)"));
    return m ? decodeURIComponent(m[1]) : "";
  }

  async function sha1hex(s) {
    const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(s));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  async function authorizationHeader() {
    const sapisid = cookie("SAPISID") || cookie("__Secure-1PAPISID") || cookie("__Secure-3PAPISID");
    if (!sapisid) return "";
    const ts = Math.floor(Date.now() / 1000);
    const origin = location.origin;
    const hash = await sha1hex(`${ts} ${sapisid} ${origin}`);
    return `SAPISIDHASH ${ts}_${hash}`;
  }

  async function innertubeHeaders() {
    const cfg = readYtcfg();
    const headers = {
      "Content-Type": "application/json",
      "X-YouTube-Client-Name": "1",
      "X-YouTube-Client-Version": cfg.INNERTUBE_CONTEXT?.client?.clientVersion || "",
    };
    if (cfg.VISITOR_DATA) headers["X-Goog-Visitor-Id"] = cfg.VISITOR_DATA;
    if (cfg.DELEGATED_SESSION_ID) headers["X-Goog-PageId"] = cfg.DELEGATED_SESSION_ID;
    const auth = await authorizationHeader();
    if (auth) headers.Authorization = auth;
    return headers;
  }

  async function innertube(path, body) {
    const cfg = readYtcfg();
    if (!cfg.INNERTUBE_API_KEY || !cfg.INNERTUBE_CONTEXT) {
      throw new Error("YouTube client is not ready yet");
    }
    const url = `/youtubei/v1/${path}?key=${encodeURIComponent(cfg.INNERTUBE_API_KEY)}&prettyPrint=false`;
    const res = await fetch(url, {
      method: "POST",
      credentials: "same-origin",
      headers: await innertubeHeaders(),
      body: JSON.stringify({ context: cfg.INNERTUBE_CONTEXT, ...body }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = json?.error?.message || `Innertube ${path} failed (${res.status})`;
      throw new Error(msg);
    }
    return json;
  }

  function waitForCfg(timeoutMs = 12000) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const tick = () => {
        const cfg = readYtcfg();
        if (cfg.INNERTUBE_API_KEY && cfg.INNERTUBE_CONTEXT) {
          resolve(cfg);
          return;
        }
        if (Date.now() - start > timeoutMs) {
          reject(new Error("Timed out waiting for YouTube client"));
          return;
        }
        setTimeout(tick, 50);
      };
      tick();
    });
  }

  function initialData() {
    return window.ytInitialData || window.ytInitialPlayerResponse || null;
  }

  async function browseAll(body, extras, maxPages = 6) {
    await waitForCfg();
    let data = await innertube("browse", body);
    const videos = extractVideos(data, extras);
    let pages = 1;
    let tokens = extractContinuations(data);
    const used = new Set();
    while (tokens.length && pages < maxPages) {
      const token = tokens.shift();
      if (!token || used.has(token)) continue;
      used.add(token);
      data = await innertube("browse", { continuation: token });
      videos.push(...extractVideos(data, extras));
      tokens = tokens.concat(extractContinuations(data).filter((t) => !used.has(t)));
      pages += 1;
    }
    return uniqueVideos(videos);
  }

  function uniqueVideos(videos) {
    const seen = new Set();
    const out = [];
    for (const v of videos) {
      const key = `${v.videoId}:${v.setVideoId || ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(v);
    }
    return out;
  }

  function browseIdForPlaylist(playlistId) {
    const id = playlistId || "WL";
    return id.startsWith("VL") ? id : `VL${id}`;
  }

  async function fetchPlaylist(playlistId) {
    const id = playlistId || "WL";
    return browseAll({ browseId: browseIdForPlaylist(id) }, { playlistId: id }, 8);
  }

  async function fetchHome() {
    const local = extractVideos(initialData(), {});
    try {
      const remote = await browseAll({ browseId: "FEwhat_to_watch" }, {}, 3);
      return uniqueVideos(remote.length ? remote : local);
    } catch (err) {
      if (local.length) return local;
      throw err;
    }
  }

  async function fetchSubscriptions() {
    return browseAll({ browseId: "FEsubscriptions" }, {}, 5);
  }

  async function fetchChannelVideos(channelId) {
    return browseAll({ browseId: channelId, params: "EgZ2aWRlb3PyBgQKAjoA" }, {}, 3);
  }

  async function fetchCustom(sources) {
    const lists = await Promise.all(
      (sources || []).map(async (source) => {
        try {
          if (source.type === "playlist") return await fetchPlaylist(source.id);
          if (source.type === "channel") return await fetchChannelVideos(source.id);
        } catch (_) {
          return [];
        }
        return [];
      })
    );
    return uniqueVideos(lists.flat());
  }

  async function removeFromPlaylist(playlistId, items) {
    await waitForCfg();
    const id = playlistId || "WL";
    const actions = (items || []).map((item) => {
      if (item.setVideoId) {
        return { action: "ACTION_REMOVE_VIDEO", setVideoId: item.setVideoId };
      }
      return { action: "ACTION_REMOVE_VIDEO_BY_VIDEO_ID", removedVideoId: item.videoId };
    });
    if (!actions.length) return { ok: true, status: "STATUS_NOOP" };

    const json = await innertube("browse/edit_playlist", {
      playlistId: id,
      actions,
    });
    const status = json.status || json.actions?.[0]?.status || "";
    const ok = !status || status === "STATUS_SUCCEEDED" || status === "STATUS_NOOP";
    if (!ok) throw new Error(status || "Playlist edit failed");
    return { ok: true, status: status || "STATUS_SUCCEEDED" };
  }

  function parseSourceQuery(query) {
    const raw = String(query || "").trim();
    if (!raw) return null;
    try {
      const url = new URL(raw, "https://www.youtube.com");
      if (/youtube\.com|youtu\.be/.test(url.hostname)) {
        const list = url.searchParams.get("list");
        const channelMatch = url.pathname.match(/\/channel\/(UC[\w-]+)/);
        const handleMatch = url.pathname.match(/\/@([\w.-]+)/);
        if (list && list !== "WL" && list !== "LL") {
          return { kind: "playlist", id: list, label: raw };
        }
        if (channelMatch) return { kind: "channel", id: channelMatch[1], label: raw };
        if (handleMatch) return { kind: "search", query: `@${handleMatch[1]}` };
      }
    } catch (_) {
      /* not a url */
    }
    if (/^UC[\w-]{20,}$/.test(raw)) return { kind: "channel", id: raw, label: raw };
    if (/^(PL|UU|FL|OL)[\w-]+$/.test(raw)) return { kind: "playlist", id: raw, label: raw };
    if (raw === "WL" || raw === "LL") return { kind: "playlist", id: raw, label: raw === "WL" ? "Watch later" : "Liked videos" };
    return { kind: "search", query: raw };
  }

  async function resolveSource(query) {
    const parsed = parseSourceQuery(query);
    if (!parsed) return [];
    if (parsed.kind === "channel") {
      return [{ type: "channel", id: parsed.id, label: parsed.label || parsed.id }];
    }
    if (parsed.kind === "playlist") {
      const label = parsed.id === "WL" ? "Watch later" : parsed.label || "Playlist";
      return [{ type: "playlist", id: parsed.id, label }];
    }
    await waitForCfg();
    const data = await innertube("search", { query: parsed.query });
    const results = [];
    walk(data, (node) => {
      if (node.channelRenderer) {
        const ch = node.channelRenderer;
        results.push({
          type: "channel",
          id: ch.channelId,
          label: textOf(ch.title),
        });
      }
      if (node.playlistRenderer) {
        const pl = node.playlistRenderer;
        results.push({
          type: "playlist",
          id: pl.playlistId,
          label: textOf(pl.title),
        });
      }
    });
    const seen = new Set();
    return results.filter((r) => {
      const key = `${r.type}:${r.id}`;
      if (!r.id || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function getStatus() {
    const cfg = readYtcfg();
    return {
      loggedIn: cfg.LOGGED_IN || Boolean(cookie("SAPISID") || cookie("__Secure-1PAPISID")),
      path: location.pathname,
      ready: Boolean(cfg.INNERTUBE_API_KEY && cfg.INNERTUBE_CONTEXT),
    };
  }

  async function handle(type, payload) {
    switch (type) {
      case "ping":
        return { ok: true, status: getStatus() };
      case "status":
        return getStatus();
      case "extractInitial":
        return extractVideos(initialData(), {});
      case "fetchHome":
        return fetchHome();
      case "fetchWatchLater":
        return fetchPlaylist("WL");
      case "fetchPlaylist":
        return fetchPlaylist(payload?.playlistId || "WL");
      case "fetchSubscriptions":
        return fetchSubscriptions();
      case "fetchCustom":
        return fetchCustom(payload?.sources || []);
      case "removeFromPlaylist":
        return removeFromPlaylist(payload?.playlistId || "WL", payload?.items || []);
      case "resolveSource":
        return resolveSource(payload?.query || "");
      default:
        throw new Error(`Unknown MAIN rpc: ${type}`);
    }
  }

  window.addEventListener("message", async (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.source !== LISTEN) return;
    try {
      const result = await handle(data.type, data.payload);
      window.postMessage({ source: SOURCE, id: data.id, payload: result }, "*");
    } catch (err) {
      window.postMessage(
        { source: SOURCE, id: data.id, error: String(err && err.message ? err.message : err) },
        "*"
      );
    }
  });

  function emit(type, payload) {
    window.postMessage({ source: SOURCE, type, payload }, "*");
  }

  function destFromNavEvent(event) {
    const d = event && event.detail;
    if (!d) return null;
    const browseId = d.endpoint?.browseEndpoint?.browseId;
    if (browseId === "FEwhat_to_watch") return { pathname: "/", search: "" };
    if (browseId === "VLWL") return { pathname: "/playlist", search: "?list=WL" };
    const raw =
      d.url ||
      d.endpoint?.commandMetadata?.webCommandMetadata?.url ||
      d.endpoint?.urlEndpoint?.url ||
      "";
    if (!raw) return null;
    try {
      const url = new URL(raw, location.origin);
      return { pathname: url.pathname, search: url.search };
    } catch (_) {
      return null;
    }
  }

  function hookInitial() {
    try {
      let current = window.ytInitialData;
      Object.defineProperty(window, "ytInitialData", {
        configurable: true,
        enumerable: true,
        get() {
          return current;
        },
        set(value) {
          current = value;
          emit("ytInitialData", { path: location.pathname });
        },
      });
    } catch (_) {
      /* already defined */
    }
  }

  function onNavigated(phase, event) {
    const dest = destFromNavEvent(event);
    emit("navigated", {
      phase,
      pathname: dest?.pathname || location.pathname,
      search: dest?.search || location.search,
      href: dest ? `${dest.pathname}${dest.search}` : location.href,
      livePathname: location.pathname,
      liveSearch: location.search,
    });
  }

  hookInitial();
  document.addEventListener("yt-navigate-start", (e) => onNavigated("start", e), true);
  document.addEventListener("yt-navigate-finish", (e) => onNavigated("finish", e), true);
  document.addEventListener("yt-page-data-updated", (e) => onNavigated("data", e), true);
  window.addEventListener("popstate", () => onNavigated("popstate"), true);

  emit("ready", { pathname: location.pathname, status: getStatus() });
})();
