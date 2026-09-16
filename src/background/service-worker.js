import { APP_NAME, APP_VERSION } from "../lib/constants.js";
import { ENABLED_STORAGE_KEY, isDietEnabled } from "../lib/enabled.js";
import { DEFAULT_PREFS, migratePrefs } from "../lib/prefs.js";

chrome.runtime.onInstalled.addListener(async () => {
  const got = await chrome.storage.local.get(["prefs", ENABLED_STORAGE_KEY]);
  if (!got.prefs) {
    await chrome.storage.local.set({ prefs: { ...DEFAULT_PREFS, viewByTab: { ...DEFAULT_PREFS.viewByTab } } });
  } else {
    await chrome.storage.local.set({ prefs: migratePrefs(got.prefs) });
  }
  if (got[ENABLED_STORAGE_KEY] === undefined) {
    await chrome.storage.local.set({ [ENABLED_STORAGE_KEY]: true });
  }
});

async function reloadYoutubeTabs() {
  const tabs = await chrome.tabs.query({ url: ["https://www.youtube.com/*", "https://youtube.com/*"] });
  await Promise.all(tabs.map((tab) => (tab.id ? chrome.tabs.reload(tab.id).catch(() => {}) : Promise.resolve())));
  return tabs.length;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "diet-yt-meta") {
    sendResponse({ name: APP_NAME, version: APP_VERSION });
    return true;
  }
  if (message?.type === "diet-yt-get-enabled") {
    chrome.storage.local.get(ENABLED_STORAGE_KEY).then((got) => {
      sendResponse({ enabled: isDietEnabled(got[ENABLED_STORAGE_KEY]) });
    });
    return true;
  }
  if (message?.type === "diet-yt-reload-youtube") {
    reloadYoutubeTabs().then((reloaded) => sendResponse({ ok: true, reloaded }));
    return true;
  }
  return false;
});
