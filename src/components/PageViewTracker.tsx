"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

// Fires only on an actual route commit (not on Link prefetch), so the
// resulting page_views rows reflect real navigation, not hover-prefetching.
export default function PageViewTracker() {
  const pathname = usePathname();
  const lastTracked = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || pathname === lastTracked.current) return;
    lastTracked.current = pathname;
    fetch("/api/track-pageview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: pathname }),
      keepalive: true,
    }).catch(() => {});
  }, [pathname]);

  return null;
}
