"use strict";

/**
 * MindBrake — Debug Timer
 * - Tracks per-domain time every second.
 * - Logs each increment to console for testing accuracy.
 * - Uses statsByDay[YYYY-MM-DD] format.
 */

let currentDomain = null;
let lastUpdate = Date.now();
let windowFocused = true;

// ---- Helpers ----
function todayKey() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function hostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

async function getActiveHttpTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url) return null;
  if (!/^https?:/i.test(tab.url)) return null;
  return tab;
}

async function loadTodayStats() {
  const key = todayKey();
  const { statsByDay = {} } = await chrome.storage.local.get("statsByDay");
  if (!statsByDay[key]) statsByDay[key] = { totalMs: 0, perDomain: {} };
  return { key, statsByDay };
}

async function saveTodayStats(statsByDay) {
  await chrome.storage.local.set({ statsByDay });
}

// ---- Tick every second ----
async function tick() {
  const now = Date.now();
  let delta = now - lastUpdate;
  if (delta < 0) delta = 0;
  if (delta > 5000) delta = 1000; // clamp weird gaps to ~1s
  lastUpdate = now;

  if (!windowFocused) return;

  const tab = await getActiveHttpTab();
  if (!tab) return;

  const dom = hostname(tab.url);
  if (!dom) return;

  const { key, statsByDay } = await loadTodayStats();
  const dayStats = statsByDay[key];

  dayStats.totalMs += delta;
  dayStats.perDomain[dom] = (dayStats.perDomain[dom] || 0) + delta;

  await saveTodayStats(statsByDay);

  // 🔍 Debug log
  console.log(
    `[MindBrake] ${dom} +${Math.round(delta / 1000)}s (total: ${Math.round(
      dayStats.perDomain[dom] / 1000
    )}s)`
  );
}

// Run loop every 1 second
setInterval(() => {
  tick().catch((err) => console.error("Tick error", err));
}, 1000);

// ---- Lifecycle events ----
chrome.runtime.onStartup.addListener(() => {
  lastUpdate = Date.now();
});
chrome.runtime.onInstalled.addListener(() => {
  lastUpdate = Date.now();
});

// ---- Window focus ----
chrome.windows.onFocusChanged.addListener((winId) => {
  windowFocused = (winId !== chrome.windows.WINDOW_ID_NONE && winId !== -1);
  lastUpdate = Date.now();
});

// ---- Reset at midnight ----
function scheduleMidnightReset() {
  const now = new Date();
  const msUntilMidnight =
    new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0) -
    now;

  setTimeout(() => {
    chrome.storage.local.set({ statsByDay: {} }, () => {
      console.log("⏳ MindBrake: Stats reset for new day");
    });
    scheduleMidnightReset();
  }, msUntilMidnight);
}
scheduleMidnightReset();

// ---- Messaging API ----
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    if (msg?.type === "GET_CURRENT") {
      const tab = await getActiveHttpTab();
      const url = tab?.url || "";
      const domain = url ? hostname(url) : "";
      sendResponse({ url, domain });
    }

    if (msg?.type === "GET_TODAY_STATS") {
      const { key, statsByDay } = await loadTodayStats();
      sendResponse({ key, day: statsByDay[key] });
    }

    if (msg?.type === "RESET_TODAY") {
      const { key, statsByDay } = await loadTodayStats();
      statsByDay[key] = { totalMs: 0, perDomain: {} };
      await saveTodayStats(statsByDay);
      sendResponse({ ok: true });
    }
  })();
  return true; // keep channel alive for async sendResponse
});
