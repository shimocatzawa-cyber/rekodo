"use client";

import { useState, useRef, useEffect } from "react";
import { generateShareCard, downloadCard, copyCardToClipboard, getCardBlob } from "@/lib/shareCard";
import type { ListSlot } from "@/app/lists/types";

const MONO = "var(--font-mono)";
const INK  = "#0d0d0d";
const MUTED = "#aaaaaa";

interface Props {
  onClose:  () => void;
  title:    string;
  slots:    ListSlot[];
  username: string;
  listUrl:  string;
}

export default function ShareModal({ onClose, title, slots, username, listUrl }: Props) {
  const [canvas,       setCanvas]       = useState<HTMLCanvasElement | null>(null);
  const [generating,   setGenerating]   = useState(true);
  const [copyImgState, setCopyImgState] = useState<"idle" | "copied" | "failed">("idle");
  const [copyLinkState, setCopyLinkState] = useState<"idle" | "copied">("idle");
  const [canWebShare,  setCanWebShare]  = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCanWebShare(typeof navigator !== "undefined" && !!navigator.share);

    generateShareCard({
      title,
      slots: slots.map(s => ({
        position: s.position,
        record: s.item
          ? { artist: s.item.artist, album: s.item.song_title ?? s.item.album, cover_url: s.item.cover_url }
          : null,
      })),
      username,
    })
      .then(c => { setCanvas(c); setGenerating(false); })
      .catch(() => setGenerating(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!canvas || !previewRef.current) return;
    previewRef.current.innerHTML = "";
    canvas.style.cssText = "width:100%;height:auto;display:block;";
    previewRef.current.appendChild(canvas);
  }, [canvas]);

  async function handleWebShare() {
    if (!canvas) return;
    const blob = await getCardBlob(canvas);
    if (!blob) return;
    const file = new File([blob], "rekodo-list.png", { type: "image/png" });
    try {
      await navigator.share({ files: [file], title: `${title} — rekōdo`, url: listUrl });
    } catch {
      // user dismissed
    }
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(listUrl);
      setCopyLinkState("copied");
      setTimeout(() => setCopyLinkState("idle"), 2500);
    } catch { /* ignore */ }
  }

  const enc  = encodeURIComponent;
  const text = enc(`"${title}" — rekōdo`);
  const url  = enc(listUrl);

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}
    >
      <div style={{ background: "#fff", maxWidth: 460, width: "100%", maxHeight: "92vh", display: "flex", flexDirection: "column" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
          <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", margin: 0 }}>Share Card</p>
          <button onClick={onClose} style={{ fontFamily: MONO, fontSize: "18px", color: "#aaa", background: "none", border: "none", cursor: "pointer", lineHeight: 1, padding: 0 }}>×</button>
        </div>

        {/* Preview */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
          {generating ? (
            <p style={{ fontFamily: MONO, fontSize: "10px", color: "#aaa", letterSpacing: "0.06em", textAlign: "center", padding: "40px 0" }}>Generating…</p>
          ) : canvas ? (
            <div ref={previewRef} style={{ border: "1px solid rgba(0,0,0,0.08)" }} />
          ) : (
            <p style={{ fontFamily: MONO, fontSize: "10px", color: "#aaa", letterSpacing: "0.06em", textAlign: "center", padding: "40px 0" }}>Could not generate card.</p>
          )}
        </div>

        {/* Actions */}
        {canvas && (
          <div style={{ padding: "12px 16px 16px", borderTop: "1px solid rgba(0,0,0,0.08)" }}>

            {/* Export */}
            <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
              <button
                onClick={() => downloadCard(canvas, title)}
                style={{ flex: 1, fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", background: INK, color: "#fff", border: "none", cursor: "pointer", padding: "10px 0" }}
              >
                Download PNG
              </button>
              <button
                onClick={async () => {
                  const ok = await copyCardToClipboard(canvas);
                  setCopyImgState(ok ? "copied" : "failed");
                  setTimeout(() => setCopyImgState("idle"), 2500);
                }}
                style={{ flex: 1, fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", background: "none", border: "1px solid rgba(0,0,0,0.18)", cursor: "pointer", padding: "10px 0", color: copyImgState === "copied" ? "#22c55e" : copyImgState === "failed" ? "#ef4444" : INK }}
              >
                {copyImgState === "copied" ? "Copied ✓" : copyImgState === "failed" ? "Failed" : "Copy Image"}
              </button>
            </div>

            {/* Social links */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 18px", alignItems: "center" }}>
              {canWebShare && (
                <button
                  onClick={handleWebShare}
                  style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: INK, background: "none", border: "none", cursor: "pointer", padding: 0 }}
                >
                  Share to apps ↗
                </button>
              )}
              <a
                href={`https://x.com/intent/tweet?text=${text}&url=${url}`}
                target="_blank" rel="noopener noreferrer"
                style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: MUTED, textDecoration: "none" }}
              >
                X ↗
              </a>
              <a
                href={`https://bsky.app/intent/compose?text=${enc(`"${title}" — rekōdo\n${listUrl}`)}`}
                target="_blank" rel="noopener noreferrer"
                style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: MUTED, textDecoration: "none" }}
              >
                Bluesky ↗
              </a>
              <a
                href={`https://www.reddit.com/submit?url=${url}&title=${text}`}
                target="_blank" rel="noopener noreferrer"
                style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: MUTED, textDecoration: "none" }}
              >
                Reddit ↗
              </a>
              <button
                onClick={handleCopyLink}
                style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: copyLinkState === "copied" ? "#22c55e" : MUTED, background: "none", border: "none", cursor: "pointer", padding: 0 }}
              >
                {copyLinkState === "copied" ? "Link Copied ✓" : "Copy Link"}
              </button>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
