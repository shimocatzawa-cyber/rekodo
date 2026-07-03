export function isAppleMusicUrl(url: string): boolean {
  return url.includes("music.apple.com");
}

// Returns the app-scheme URL for a streaming service, or null if no scheme is known.
// Apple Music: https://music.apple.com/... → music://music.apple.com/...
// Spotify:     https://open.spotify.com/search/QUERY → spotify:search:QUERY
// Tidal has no reliable cross-platform app scheme, so falls through to browser.
export function getStreamAppUrl(url: string): string | null {
  if (url.includes("music.apple.com")) return url.replace(/^https?:\/\//, "music://");
  if (url.includes("open.spotify.com/search/")) {
    const encoded = url.split("/search/")[1] ?? "";
    return `spotify:search:${encoded}`;
  }
  return null;
}

function tryOpenWithAppFallback(appUrl: string, webUrl: string): void {
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  if (!isMobile) {
    // Desktop: open a blank fallback tab so the main tab can try the app scheme
    // without losing the page. blur fires if the app (or new tab) gets focus.
    const fallbackTab = window.open("", "_blank", "noopener,noreferrer");
    let appOpened = false;
    const onBlur = () => { appOpened = true; };
    window.addEventListener("blur", onBlur);
    window.location.href = appUrl;
    setTimeout(() => {
      window.removeEventListener("blur", onBlur);
      if (!fallbackTab) { window.open(webUrl, "_blank", "noopener,noreferrer"); return; }
      if (appOpened) fallbackTab.close();
      else fallbackTab.location.href = webUrl;
    }, 1000);
    return;
  }

  // Mobile: opening an empty popup first steals focus from the current tab, which
  // means the app-scheme navigation happens on a background tab and iOS never triggers
  // the app. Instead, navigate the current (foreground) tab directly and use
  // visibilitychange to detect whether the app actually opened.
  let appOpened = false;
  const onVisChange = () => { if (document.hidden) appOpened = true; };
  document.addEventListener("visibilitychange", onVisChange);

  window.location.href = appUrl;

  setTimeout(() => {
    document.removeEventListener("visibilitychange", onVisChange);
    if (!appOpened) {
      // App didn't open — fall back to the web URL on the current tab
      window.location.href = webUrl;
    }
  }, 1500);
}

// Opens a streaming URL in the native app if a scheme is available, browser otherwise.
export function openStreamLink(url: string): void {
  const appUrl = getStreamAppUrl(url);
  if (!appUrl) { window.open(url, "_blank", "noopener,noreferrer"); return; }
  tryOpenWithAppFallback(appUrl, url);
}

// Kept for backward compatibility — existing callers pass Apple Music URLs directly.
export function openAppleMusicLink(url: string): void {
  tryOpenWithAppFallback(url.replace(/^https?:\/\//, "music://"), url);
}
