const ENABLED_KEY = "dietYtEnabled";
const checkbox = document.getElementById("enabled");
const label = document.getElementById("switch-label");
const versionEl = document.getElementById("version");
const reloadBtn = document.getElementById("reload");

function setLabel(on) {
  label.textContent = on ? "Diet-Youtube: On" : "Diet-Youtube: Off";
  checkbox.checked = on;
}

async function youtubeTabs() {
  return chrome.tabs.query({ url: ["https://www.youtube.com/*", "https://youtube.com/*"] });
}

async function reloadYoutubeTabs() {
  const tabs = await youtubeTabs();
  await Promise.all(
    tabs.map((tab) => (tab.id ? chrome.tabs.reload(tab.id).catch(() => {}) : Promise.resolve()))
  );
  return tabs.length;
}

async function init() {
  try {
    const meta = await chrome.runtime.sendMessage({ type: "diet-yt-meta" });
    if (meta?.version) versionEl.textContent = `v${meta.version}`;
  } catch (_) {
    /* ignore */
  }
  const got = await chrome.storage.local.get(ENABLED_KEY);
  setLabel(got[ENABLED_KEY] !== false);
}

checkbox.addEventListener("change", async () => {
  const on = checkbox.checked;
  setLabel(on);
  await chrome.storage.local.set({ [ENABLED_KEY]: on });
  await reloadYoutubeTabs();
});

reloadBtn.addEventListener("click", async () => {
  const n = await reloadYoutubeTabs();
  reloadBtn.textContent = n ? `Reloaded ${n} tab${n === 1 ? "" : "s"}` : "No YouTube tabs open";
  setTimeout(() => {
    reloadBtn.textContent = "Reload YouTube tabs";
  }, 2000);
});

init();
