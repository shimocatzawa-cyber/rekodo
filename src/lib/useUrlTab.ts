"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

// Keeps a page's active tab in the URL (?tab=...) so refresh/back/forward and
// shared links land on the same tab instead of resetting to the default.
export function useUrlTab<T extends string>(
  paramName: string,
  validKeys: readonly T[],
  defaultKey: T,
): [T, (key: T) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [tab, setTabState] = useState<T>(() => {
    const raw = searchParams.get(paramName);
    return raw && (validKeys as readonly string[]).includes(raw) ? (raw as T) : defaultKey;
  });

  function setTab(key: T) {
    setTabState(key);
    const params = new URLSearchParams(searchParams.toString());
    if (key === defaultKey) params.delete(paramName);
    else params.set(paramName, key);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return [tab, setTab];
}
