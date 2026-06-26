"use client";
import { useEffect } from "react";

// Writes the browser's IANA timezone to a cookie so server-rendered components
// (e.g. Daily Pick) can compute "9AM local" boundaries instead of midnight UTC.
export default function TimezoneSetter() {
  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) {
        document.cookie = `tz=${encodeURIComponent(tz)}; path=/; max-age=31536000; SameSite=Lax`;
      }
    } catch { /* ignore — Intl unavailable */ }
  }, []);
  return null;
}
