/**
 * document_start cloak (classic script — not a module).
 * Modules can defer; this file must paint chrome immediately so Home
 * is never a permanent black panel if content.js races or remounts late.
 */
(function () {
  var HOME_INTENT_MS = 5000;
  var homeIntentUntil = 0;
  var pendingNav = null;

  function pathOf(href) {
    try {
      return new URL(href, location.origin).pathname.replace(/\/+$/, "") || "/";
    } catch (_) {
      return "/";
    }
  }

  function searchOf(href) {
    try {
      return new URL(href, location.origin).search || "";
    } catch (_) {
      return "";
    }
  }

  function isHome(pathname) {
    var p = (pathname || "/").replace(/\/+$/, "") || "/";
    return p === "/" || p === "/index.html" || p === "/feed/recommended" || p === "/feed/featured";
  }

  function isWatch(pathname) {
    var p = (pathname || "").replace(/\/+$/, "") || "";
    return p === "/watch" || p.indexOf("/watch/") === 0;
  }

  function isWlPlaylist(pathname, search) {
    var p = (pathname || "").replace(/\/+$/, "") || "";
    if (p !== "/playlist") return false;
    try {
      return new URLSearchParams(String(search || "").replace(/^\?/, "")).get("list") === "WL";
    } catch (_) {
      return /(?:\?|&)list=WL(?:&|$)/.test(String(search || ""));
    }
  }

  function destFromEvent(event) {
    var d = event && event.detail;
    if (!d) return null;
    var browseId = d.endpoint && d.endpoint.browseEndpoint && d.endpoint.browseEndpoint.browseId;
    if (browseId === "FEwhat_to_watch") return { pathname: "/", search: "" };
    if (browseId === "VLWL") return { pathname: "/playlist", search: "?list=WL" };
    var raw =
      d.url ||
      (d.endpoint &&
        d.endpoint.commandMetadata &&
        d.endpoint.commandMetadata.webCommandMetadata &&
        d.endpoint.commandMetadata.webCommandMetadata.url) ||
      (d.endpoint && d.endpoint.urlEndpoint && d.endpoint.urlEndpoint.url) ||
      "";
    if (!raw) return null;
    try {
      var u = new URL(raw, location.origin);
      return { pathname: u.pathname, search: u.search };
    } catch (_) {
      return null;
    }
  }

  function markHomeIntent() {
    homeIntentUntil = Date.now() + HOME_INTENT_MS;
    html.dataset.dietHomeIntent = "1";
  }

  function setPendingNav(event) {
    pendingNav = event || null;
    if (event) html.dataset.dietNavEvent = event;
    else delete html.dataset.dietNavEvent;
  }

  function getPendingNav() {
    return pendingNav || html.dataset.dietNavEvent || null;
  }

  function consumePendingNav() {
    var next = getPendingNav();
    pendingNav = null;
    delete html.dataset.dietNavEvent;
    return next;
  }

  function homeIntentActive() {
    var on = Date.now() < homeIntentUntil;
    if (!on) delete html.dataset.dietHomeIntent;
    return on;
  }

  function hostNode() {
    return document.body || html;
  }

  function paintSkeleton(root) {
    if (!root) return;
    if (root.querySelector(".diet-yt-chrome, .diet-yt-boot-chrome")) return;
    root.innerHTML =
      '<div class="diet-yt-boot-chrome" data-diet-boot-chrome="1">' +
      "<span>Feed</span>" +
      '<span class="is-active">Watch later</span>' +
      "<span>Subscriptions</span>" +
      "</div>" +
      '<div class="diet-yt-boot-body"></div>';
  }

  function ensureSkeleton() {
    var root = document.getElementById("diet-yt-root");
    if (!root) {
      root = document.createElement("div");
      root.id = "diet-yt-root";
      root.setAttribute("data-boot", "1");
      hostNode().appendChild(root);
    } else if (document.body && root.parentElement !== document.body) {
      document.body.appendChild(root);
    }
    paintSkeleton(root);
    return root;
  }

  function forceDietHomeUrl() {
    if (isHome(pathOf(location.href))) return;
    try {
      history.replaceState.call(history, history.state || {}, "", "/");
    } catch (_) {
      try {
        history.pushState({}, "", "/");
      } catch (__) {
        /* ignore */
      }
    }
  }

  function deactivate() {
    dietEnabled = false;
    homeIntentUntil = 0;
    pendingNav = null;
    delete html.dataset.dietHomeIntent;
    delete html.dataset.dietNavEvent;
    delete html.dataset.dietRoute;
    html.classList.remove("diet-yt-active");
    html.dataset.dietEnabled = "0";
    var root = document.getElementById("diet-yt-root");
    if (root) root.remove();
  }

  function activateHome() {
    if (!dietEnabled) return;
    html.classList.add("diet-yt-active");
    html.dataset.dietRoute = "home";
    ensureSkeleton();
  }

  function recoverWlBounce() {
    if (!homeIntentActive()) return false;
    if (!isWlPlaylist(pathOf(location.href), searchOf(location.href))) return false;
    forceDietHomeUrl();
    activateHome();
    return true;
  }

  function isLogo(target) {
    if (!target || !target.closest) return false;
    if (target.id === "logo" || target.id === "logo-icon") return true;
    if (target.closest("#guide-button, #voice-search-button, ytd-searchbox, yt-searchbox, #center, #end")) {
      return false;
    }
    if (target.closest("#logo, ytd-topbar-logo-renderer, yt-icon-button#logo, #logo-icon, yt-masthead-logo, #start")) {
      return true;
    }
    var a = target.closest("a");
    return Boolean(a && a.closest("ytd-topbar-logo-renderer, yt-masthead-logo, #start"));
  }

  function isSidebarHome(target) {
    if (!target || !target.closest) return false;
    var entry = target.closest(
      "ytd-mini-guide-entry-renderer, ytd-guide-entry-renderer, ytm-pivot-bar-item-renderer, a"
    );
    if (!entry) return false;
    if (
      !entry.closest(
        "#guide, ytd-mini-guide-renderer, ytd-guide-renderer, ytd-mini-guide-entry-renderer, ytd-guide-entry-renderer, ytd-guide-section-renderer, ytm-pivot-bar-renderer"
      )
    ) {
      return false;
    }
    var a = entry.tagName === "A" ? entry : entry.querySelector("a#endpoint, a[href], a");
    var href = ((a && a.getAttribute("href")) || entry.getAttribute("href") || "").trim();
    var path = pathOf(href || "/");
    if (href && href.charAt(0) !== "/") path = pathOf(href);
    var title = (
      (a && (a.getAttribute("title") || a.getAttribute("aria-label"))) ||
      entry.getAttribute("title") ||
      entry.getAttribute("aria-label") ||
      ""
    ).toLowerCase();
    if (title === "home" || title.indexOf("home ") === 0) return true;
    if (
      (path === "/" || path === "/feed/recommended" || path === "/feed/featured") &&
      !/short|subscription|library|history|playlist|later|liked/.test(title)
    ) {
      return true;
    }
    var mini = target.closest("ytd-mini-guide-entry-renderer");
    if (mini && mini.parentNode) {
      var siblings = mini.parentNode.querySelectorAll("ytd-mini-guide-entry-renderer");
      if (siblings[0] === mini) return true;
    }
    return false;
  }

  function homeControlFromEvent(event) {
    if (!event) return false;
    var path = typeof event.composedPath === "function" ? event.composedPath() : [event.target];
    for (var i = 0; i < path.length; i++) {
      var node = path[i];
      if (isLogo(node) || isSidebarHome(node)) return true;
    }
    return isLogo(event.target) || isSidebarHome(event.target);
  }

  function peekUnderDiet(event) {
    var root = document.getElementById("diet-yt-root");
    if (!root || !event || event.clientX == null || !document.elementFromPoint) return null;
    var prev = root.style.pointerEvents;
    var el = null;
    root.style.pointerEvents = "none";
    try {
      el = document.elementFromPoint(event.clientX, event.clientY);
    } catch (_) {
      el = null;
    }
    root.style.pointerEvents = prev;
    return el;
  }

  function pathHitsHomeChrome(event) {
    var nodes = [];
    var i;
    var path = typeof event.composedPath === "function" ? event.composedPath() : [event.target];
    for (i = 0; i < path.length; i++) nodes.push(path[i]);
    try {
      var el = peekUnderDiet(event);
      if (!el && event.clientX != null && document.elementFromPoint) {
        el = document.elementFromPoint(event.clientX, event.clientY);
      }
      while (el) {
        nodes.push(el);
        el = el.parentElement || el.parentNode || el.host;
      }
    } catch (_) {
      /* ignore */
    }
    var sawExclude = false;
    var sawMasthead = false;
    var sawGuide = false;
    for (i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (!node || !node.closest) continue;
      if (node.id === "diet-yt-root" || node.closest("#diet-yt-root")) continue;
      if (
        node.closest(
          "#guide-button, #center, #end, #buttons, ytd-searchbox, yt-searchbox, #avatar-btn, #notification-button"
        )
      ) {
        sawExclude = true;
      }
      if (node.closest("#masthead-container, ytd-masthead, #start, #logo, ytd-topbar-logo-renderer")) {
        sawMasthead = true;
      }
      if (isLogo(node) || isSidebarHome(node)) sawGuide = true;
      if (node.closest("ytd-mini-guide-entry-renderer, ytd-guide-entry-renderer")) {
        var mini = node.closest("ytd-mini-guide-entry-renderer");
        if (mini && mini.parentNode && mini.parentNode.querySelectorAll) {
          var sibs = mini.parentNode.querySelectorAll("ytd-mini-guide-entry-renderer");
          if (sibs[0] === mini) sawGuide = true;
        }
        var a = node.closest("a") || (mini && mini.querySelector && mini.querySelector("a"));
        var href = a && a.getAttribute ? a.getAttribute("href") || "" : "";
        if (href === "/" || (href.indexOf("youtube.com/") !== -1 && href.split("?")[0].replace(/\/$/, "") === "")) {
          sawGuide = true;
        }
        if (href === "/" || /youtube\.com\/?$/.test(href.split("?")[0])) sawGuide = true;
      }
    }
    if (sawGuide) return true;
    return sawMasthead && !sawExclude;
  }

  function dietDebug(message, extra) {
    try {
      if (!window.localStorage || window.localStorage.getItem("dietYtDebug") !== "1") return;
      console.info("[diet-yt:boot]", message, extra || "");
    } catch (_) {
      /* ignore */
    }
  }

  function interceptHome(event) {
    if (!dietEnabled) return;
    if (!event) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (event.button === 1 || event.which === 2) return;
    var hits = homeControlFromEvent(event) || pathHitsHomeChrome(event);
    dietDebug("boot intercept", { hits: Boolean(hits), hasOnHome: typeof window.__dietYtOnHome === "function" });
    if (!hits) return;
    setPendingNav("yt-home");
    markHomeIntent();
    forceDietHomeUrl();
    activateHome();
    notifyHome();
    event.preventDefault();
    /* Do not stopImmediatePropagation — the IIFE handler must still run. */
  }

  function notifyHome() {
    if (typeof window.__dietYtOnHome === "function") {
      try {
        window.__dietYtOnHome();
      } catch (_) {
        /* content.js hydrates this */
      }
    } else {
      dietDebug("boot notify skipped: __dietYtOnHome missing");
    }
  }

  function onYtNavigate(event) {
    if (!dietEnabled) return;
    var dest = destFromEvent(event) || { pathname: location.pathname, search: location.search };
    if (homeIntentActive() && isWlPlaylist(pathOf(dest.pathname + dest.search), dest.search)) {
      if (event && event.preventDefault) event.preventDefault();
      if (event && event.stopImmediatePropagation) event.stopImmediatePropagation();
      forceDietHomeUrl();
      activateHome();
      return;
    }
    if (isHome(dest.pathname) || (homeIntentActive() && isWatch(dest.pathname))) {
      activateHome();
    }
  }

  var html = document.documentElement;
  var dietEnabled = true;
  html.dataset.dietYt = "1";

  function startIfHome() {
    if (!dietEnabled) return;
    if (isHome(pathOf(location.href))) {
      setPendingNav("cold");
      markHomeIntent();
      activateHome();
    }
  }

  function applyEnabled(value) {
    dietEnabled = value !== false;
    html.dataset.dietEnabled = dietEnabled ? "1" : "0";
    if (!dietEnabled) deactivate();
    else startIfHome();
  }

  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get("dietYtEnabled", function (got) {
      applyEnabled(got.dietYtEnabled !== false);
    });
    if (chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener(function (changes, area) {
        if (area === "local" && changes.dietYtEnabled) {
          applyEnabled(changes.dietYtEnabled.newValue !== false);
        }
      });
    }
  } else {
    startIfHome();
  }

  window.addEventListener("pointerdown", interceptHome, true);
  window.addEventListener("click", interceptHome, true);
  document.addEventListener("pointerdown", interceptHome, true);
  document.addEventListener("click", interceptHome, true);
  document.addEventListener("yt-navigate", onYtNavigate, true);
  document.addEventListener("yt-navigate-start", onYtNavigate, true);
  document.addEventListener("yt-navigate-finish", function () {
    if (isHome(pathOf(location.href))) activateHome();
    recoverWlBounce();
  }, true);

  var recoverTimer = setInterval(function () {
    if (!dietEnabled) return;
    if (!homeIntentActive()) return;
    recoverWlBounce();
    if (isHome(pathOf(location.href))) {
      var root = document.getElementById("diet-yt-root");
      if (!root || !root.querySelector(".diet-yt-chrome, .diet-yt-boot-chrome")) activateHome();
    }
  }, 250);
  setTimeout(function () {
    clearInterval(recoverTimer);
  }, 15000);

  window.__dietYtBoot = {
    isHome: isHome,
    startedAt: Date.now(),
    markHomeIntent: markHomeIntent,
    homeIntentActive: homeIntentActive,
    forceDietHomeUrl: forceDietHomeUrl,
    activateHome: activateHome,
    deactivate: deactivate,
    ensureSkeleton: ensureSkeleton,
    setPendingNav: setPendingNav,
    getPendingNav: getPendingNav,
    consumePendingNav: consumePendingNav,
  };
})();
