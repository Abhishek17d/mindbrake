document.addEventListener("DOMContentLoaded", () => {
  const elSite = document.getElementById("site");
  const elSiteTime = document.getElementById("siteTime");
  const elTotalTime = document.getElementById("totalTime");
  const elPercent = document.getElementById("percent");
  const elBar = document.getElementById("bar");
  const elStatus = document.getElementById("status");
  const btnDash = document.getElementById("openDashboard");
  const btnReset = document.getElementById("resetToday");

  function fmt(ms) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const ss = String(s % 60).padStart(2, "0");
    return `${m}m ${ss}s`;
  }

  function update() {
    chrome.runtime.sendMessage({ type: "GET_TODAY_STATS" }, (resp) => {
      if (chrome.runtime.lastError || !resp) return;
      const { day } = resp;
      const total = day?.totalMs || 0;

      chrome.runtime.sendMessage({ type: "GET_CURRENT" }, (cur) => {
        const domain = cur?.domain || "";
        elSite.textContent = domain || "—";

        const siteMs = (day?.perDomain?.[domain]) || 0;
        elSiteTime.textContent = fmt(siteMs);
        elTotalTime.textContent = fmt(total);

        const pct = total > 0 ? Math.round((siteMs / total) * 100) : 0;
        elPercent.textContent = `${pct}%`;
        elBar.style.width = `${Math.min(pct, 100)}%`;

        elStatus.textContent = "Tracking…";
      });
    });
  }

  // update every second with *true background values*
  setInterval(update, 1000);
  update();

  btnDash.addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
  });

  btnReset.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "RESET_TODAY" }, (resp) => {
      if (resp?.ok) {
        elStatus.textContent = "✅ Today’s stats reset";
        setTimeout(update, 400);
      } else {
        elStatus.textContent = "⚠️ Couldn’t reset.";
      }
    });
  });
});
