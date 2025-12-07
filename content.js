let scrollCounter = 0;
let scrollTimeout;

// Config (tweak these numbers)
const scrollThreshold = 30;     // Must scroll 30 times
const resetDelay = 20000;       // 10s pause resets counter

console.log("🧘 MindBrake content.js loaded on", window.location.hostname);

function isFeedSite() {
  const feeds = ["youtube.com", "twitter.com", "x.com", "reddit.com", "instagram.com"];
  return feeds.some(feed => window.location.hostname.includes(feed));
}

if (isFeedSite()) {
  window.addEventListener("scroll", () => {
    try {
      scrollCounter++;
      console.log("Scroll event:", scrollCounter);

      clearTimeout(scrollTimeout);

      scrollTimeout = setTimeout(() => {
        try {
          if (!chrome.runtime || !chrome.runtime.id) return;
          console.log("Scroll reset after pause (idle too long)");
          scrollCounter = 0;
        } catch (e) {
          console.warn("Timeout skipped: extension context gone.");
        }
      }, resetDelay);

      if (scrollCounter >= scrollThreshold) {
        console.log("⚠️ Doomscrolling detected after", scrollCounter, "scrolls!");
        if (chrome.runtime && chrome.runtime.id) {
          chrome.runtime.sendMessage({ type: "DOOMSCROLL_ALERT" });
        }
        scrollCounter = 0; // reset after trigger
      }
    } catch (err) {
      console.warn("MindBrake scroll handler error:", err);
    }
  });
}
