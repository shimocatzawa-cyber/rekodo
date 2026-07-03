"use client";

import { useTransition } from "react";

const LOCALES: { value: string; label: string }[] = [
  { value: "en", label: "EN" },
  { value: "ja", label: "日本語" },
  { value: "de", label: "DE" },
  { value: "pt", label: "PT" },
];

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
    <select
      value={locale}
      disabled={isPending}
      onChange={e => switchLocale(e.target.value)}
      style={{
        fontFamily: "var(--font-noto-jp), var(--font-dm-mono), sans-serif",
        fontSize: "11px",
        letterSpacing: "0.04em",
        color: isPending ? "#cccccc" : "#888888",
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: "0",
        appearance: "none",
        WebkitAppearance: "none",
        outline: "none",
      }}
    >
      {LOCALES.map(l => (
        <option key={l.value} value={l.value}>{l.label}</option>
      ))}
    </select>
  );
}
