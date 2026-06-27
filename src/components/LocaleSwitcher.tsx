"use client";

import { useTransition } from "react";

export default function LocaleSwitcher({ locale }: { locale: string }) {
  const [isPending, startTransition] = useTransition();

  function switchLocale(next: string) {
    startTransition(async () => {
      await fetch("/api/locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: next }),
      });
      window.location.reload();
    });
  }

  return (
    <button
      onClick={() => switchLocale(locale === "en" ? "ja" : "en")}
      disabled={isPending}
      style={{
        fontFamily: "var(--font-dm-mono), monospace",
        fontSize: "11px",
        letterSpacing: "0.08em",
        color: isPending ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.5)",
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: "0",
      }}
    >
      {locale === "en" ? "日本語" : "English"}
    </button>
  );
}
