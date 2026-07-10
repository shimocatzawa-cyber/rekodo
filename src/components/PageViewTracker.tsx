"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

declare function gtag(...args: unknown[]): void;

// Fires only on an actual route commit (not on Link prefetch), so the
// resulting page_views rows reflect real navigation, not hover-prefetching.
export default function PageViewTracker() {
  const pathname = usePathname();
  const lastTracked = useRef<string | null>(null);

  // Set GA user_id once on mount so sessions are stitched across devices.
  // Uses the Supabase UUID — opaque, non-PII, safe to send to GA.
  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      if (!data.user) return;
      try { gtag("config", "G-SNTXSZRKR1", { user_id: data.user.id }); } catch { /* gtag not ready */ }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!pathname || pathname === lastTracked.current) return;

    const isFirstLoad = lastTracked.current === null;
    lastTracked.current = pathname;

    // Skip initial load — the gtag config in layout.tsx already fires page_view.
    // Fire for every client-side navigation after that.
    if (!isFirstLoad) {
      try { gtag("event", "page_view", { page_path: pathname }); } catch { /* gtag not ready */ }
    }

    fetch("/api/track-pageview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: pathname }),
      keepalive: true,
    }).catch(() => {});
  }, [pathname]);

  return null;
}
