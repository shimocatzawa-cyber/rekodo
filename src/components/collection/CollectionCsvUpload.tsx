"use client";

import { useRef, useState } from "react";

const MONO   = "var(--font-mono)";
const INK    = "#0a0a0a";
const RULE   = "#e0e0da";
const BG     = "#FDF6F0";
const ORANGE = "#CC5500";

interface Props {
  isOwner: boolean;
}

type UploadState =
  | { phase: "idle" }
  | { phase: "uploading" }
  | { phase: "done"; imported: number; conditionsBackfilled: number; skipped: number; failed: number }
  | { phase: "error"; message: string };

// Existing collectors have no entry point to CSV upload at all — that UI
// only exists in the empty-state (0-record) onboarding flow. This reuses
// the same /api/collection/csv-import endpoint, which now does two things:
// adds any records in the CSV missing from the collection (a bulk-import
// fallback for when Discogs sync or the API itself is down), and fills in
// media/sleeve condition only where currently blank on records already
// owned — e.g. recovering from a bad sync that nulled it out. It never
// overwrites a condition value that's already there.
export default function CollectionCsvUpload({ isOwner }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [upload, setUpload] = useState<UploadState>({ phase: "idle" });
  const [dragOver, setDragOver] = useState(false);

  async function handleFile(file: File) {
    if (!file.name.endsWith(".csv")) {
      setUpload({ phase: "error", message: "Please upload a .csv file exported from Discogs." });
      return;
    }
    setUpload({ phase: "uploading" });
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/collection/csv-import", { method: "POST", body: formData });
      const data = await res.json() as {
        success?: boolean; error?: string;
        imported?: number; conditionsBackfilled?: number; skipped?: number; failed?: number;
      };
      if (!res.ok || !data.success) {
        setUpload({ phase: "error", message: data.error ?? "Upload failed." });
        return;
      }
      const imported = data.imported ?? 0;
      setUpload({
        phase: "done",
        imported,
        conditionsBackfilled: data.conditionsBackfilled ?? 0,
        skipped: data.skipped ?? 0,
        failed: data.failed ?? 0,
      });
      // New records were added — reload so the collection/Insights reflect them.
      if (imported > 0) window.location.reload();
    } catch {
      setUpload({ phase: "error", message: "Upload failed — please try again." });
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  if (!isOwner) return null;

  const busy = upload.phase === "uploading";

  return (
    <div style={{ marginTop: "20px", paddingTop: "16px", borderTop: `1px solid ${RULE}` }}>
      <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: ORANGE, margin: "0 0 10px 0" }}>
        Backup / Bulk Import
      </p>
      <p style={{ fontFamily: MONO, fontSize: "0.65rem", color: "#888", margin: "0 0 12px", lineHeight: 1.6, maxWidth: "560px" }}>
        Upload a Discogs collection CSV (Account → Export → Collection CSV) to add any records missing from your collection and fill in blank condition grades — never overwrites data you already have. Useful as a fallback if sync or the Discogs API is unavailable.
      </p>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => { if (!busy) fileRef.current?.click(); }}
        style={{
          border: `1px dashed ${dragOver ? ORANGE : RULE}`,
          background: BG,
          padding: "1.25rem 2rem",
          textAlign: "center",
          cursor: busy ? "default" : "pointer",
          opacity: busy ? 0.6 : 1,
          transition: "border-color 0.15s",
          display: "inline-block",
        }}
      >
        <p style={{ fontFamily: MONO, fontSize: "0.7rem", letterSpacing: "0.04em", color: "#999", margin: 0 }}>
          {busy ? "Uploading…" : "Drop CSV here, or click to browse"}
        </p>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".csv"
        style={{ display: "none" }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
      />

      {upload.phase === "done" && (
        <p style={{ fontFamily: MONO, fontSize: "0.7rem", color: INK, margin: "10px 0 0", lineHeight: 1.6 }}>
          {upload.imported > 0 && `${upload.imported.toLocaleString()} record${upload.imported === 1 ? "" : "s"} added. `}
          {upload.conditionsBackfilled > 0 && `${upload.conditionsBackfilled.toLocaleString()} condition grade${upload.conditionsBackfilled === 1 ? "" : "s"} filled in. `}
          {upload.imported === 0 && upload.conditionsBackfilled === 0 && "Nothing new to add — your collection already matches this file."}
          {upload.failed > 0 && `${upload.failed} row${upload.failed === 1 ? "" : "s"} couldn't be read.`}
        </p>
      )}
      {upload.phase === "error" && (
        <p style={{ fontFamily: MONO, fontSize: "0.7rem", color: "#c0392b", margin: "10px 0 0" }}>
          {upload.message}
        </p>
      )}
    </div>
  );
}
