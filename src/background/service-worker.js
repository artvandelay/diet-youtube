import { APP_NAME, APP_VERSION } from "../lib/constants.js";
import { DEFAULT_PREFS, migratePrefs } from "../lib/prefs.js";

chrome.runtime.onInstalled.addListener(async () => {
  const { prefs } = await chrome.storage.local.get("prefs");
  if (!prefs) {
    await chrome.storage.local.set({ prefs: { ...DEFAULT_PREFS, viewByTab: { ...DEFAULT_PREFS.viewByTab } } });
  } else {
    await chrome.storage.local.set({ prefs: migratePrefs(prefs) });
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "diet-yt-meta") {
    sendResponse({ name: APP_NAME, version: APP_VERSION });
    return true;
  }
  return false;
});
