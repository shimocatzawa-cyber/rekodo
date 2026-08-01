"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

// Keeps a page's active tab in the URL (?tab=...) so refresh/back/forward and
// shared links land on the same tab instead of resetting to the default.
// Uses window.history.replaceState instead of router.replace so the URL updates
// without triggering a Next.js navigation (which would remount server components
// and reset client state like the selected artist in Deep Dive).
export function useUrlTab<T extends string>(
  paramName: string,
  validKeys: readonly T[],
  defaultKey: T,
): [T, (key: T) => void] {
  const searchParams = useSearchParams();

  const [tab, setTabState] = useState<T>(() => {
    const raw = searchParams.get(paramName);
    return raw && (validKeys as readonly string[]).includes(raw) ? (raw as T) : defaultKey;
  });

  function setTab(key: T) {
    setTabState(key);
    const params = new URLSearchParams(window.location.search);
    if (key === defaultKey) params.delete(paramName);
    else params.set(paramName, key);
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
  }

  return [tab, setTab];
}
