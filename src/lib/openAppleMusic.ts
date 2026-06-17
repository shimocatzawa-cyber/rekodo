// Apple's Universal Links handoff (https://music.apple.com/... opening the
// native app instead of the web player) is a Safari/WebKit-only behaviour —
// Chrome and other browsers never get it, regardless of the URL used. This
// mimics it by attempting the `music://` scheme that Apple Music.app
// registers on Mac/iOS, falling back to the normal web link if nothing
// intercepts it within the timeout.

export function isAppleMusicUrl(url: string): boolean {
  return url.includes("music.apple.com");
}

export function openAppleMusicLink(url: string): void {
  const appUrl = url.replace(/^https?:\/\//, "music://");
  const fallbackTab = window.open("", "_blank", "noopener,noreferrer");

  let appOpened = false;
  const onBlur = () => { appOpened = true; };
  window.addEventListener("blur", onBlur);

  window.location.href = appUrl;

  setTimeout(() => {
    window.removeEventListener("blur", onBlur);
    if (!fallbackTab) return;
    if (appOpened) fallbackTab.close();
    else fallbackTab.location.href = url;
  }, 1000);
}
