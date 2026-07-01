export function isAppleMusicUrl(url: string): boolean {
  return url.includes("music.apple.com");
}

export function openAppleMusicLink(url: string): void {
  const appUrl = url.replace(/^https?:\/\//, "music://");
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
      if (!fallbackTab) { window.open(url, "_blank", "noopener,noreferrer"); return; }
      if (appOpened) fallbackTab.close();
      else fallbackTab.location.href = url;
    }, 1000);
    return;
  }

  // Mobile: opening an empty popup first steals focus from the current tab, which
  // means the music:// navigation happens on a background tab and iOS never triggers
  // the app. Instead, navigate the current (foreground) tab directly and use
  // visibilitychange to detect whether the Apple Music app actually opened.
  let appOpened = false;
  const onVisChange = () => { if (document.hidden) appOpened = true; };
  document.addEventListener("visibilitychange", onVisChange);

  window.location.href = appUrl;

  setTimeout(() => {
    document.removeEventListener("visibilitychange", onVisChange);
    if (!appOpened) {
      // App didn't open — fall back to the web URL on the current tab
      window.location.href = url;
    }
  }, 1500);
}
