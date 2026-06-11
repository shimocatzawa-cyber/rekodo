"use client";

import { useRef, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import WantlistCoverImage from "./WantlistCoverImage";
import type { WantlistItem } from "@/app/[username]/wantlist/page";

const MONO   = "var(--font-mono)";
const SERIF  = "var(--font-editorial)";
const ORANGE = "#CC5500";
const INK    = "#0a0a0a";
const RULE   = "#e0e0da";
const BG     = "#FDF6F0";

interface Props {
  profileUsername: string;
  isOwner: boolean;
  userId: string | null;
  initialItems: WantlistItem[];
}

type ParsedRow = {
  catalog: string | null;
  artist: string;
  title: string;
  label: string | null;
  format: string | null;
  released: number | null;
  discogs_release_id: number;
  date_added: string | null;
};

// RFC-4180-compatible CSV row parser (handles quoted commas + escaped quotes)
function parseCsvRow(line: string): string[] {
  const cols: string[] = [];
  let i = 0;
  while (i <= line.length) {
    if (line[i] === '"') {
      let val = "";
      i++;
      while (i < line.length) {
        if (line[i] === '"') {
          if (line[i + 1] === '"') { val += '"'; i += 2; }
          else { i++; break; }
        } else {
          val += line[i++];
        }
      }
      cols.push(val);
      if (line[i] === ",") i++;
    } else {
      const end = line.indexOf(",", i);
      if (end === -1) { cols.push(line.slice(i)); break; }
      cols.push(line.slice(i, end));
      i = end + 1;
    }
  }
  return cols;
}

function parseWantlistCsv(text: string): { rows: ParsedRow[]; errors: string[] } {
  const lines  = text.split(/\r?\n/).filter(Boolean);
  const errors: string[] = [];
  const rows: ParsedRow[] = [];

  for (let li = 1; li < lines.length; li++) {
    const cols = parseCsvRow(lines[li]);
    const releaseId = parseInt(cols[7] ?? "", 10);
    if (isNaN(releaseId)) {
      errors.push(`Row ${li + 1}: invalid release_id "${cols[7] ?? ""}"`);
      continue;
    }
    const artist = (cols[1] ?? "").trim();
    const title  = (cols[2] ?? "").trim();
    if (!artist || !title) {
      errors.push(`Row ${li + 1}: missing artist or title`);
      continue;
    }
    rows.push({
      catalog:           (cols[0] ?? "").trim() || null,
      artist,
      title,
      label:             (cols[3] ?? "").trim() || null,
      format:            (cols[4] ?? "").trim() || null,
      released:          parseInt(cols[6] ?? "", 10) || null,
      discogs_release_id: releaseId,
      date_added:        (cols[9] ?? "").trim() || null,
    });
  }

  return { rows, errors };
}

type UploadState =
  | { phase: "idle" }
  | { phase: "parsed"; count: number }
  | { phase: "importing"; done: number; total: number }
  | { phase: "done"; count: number; timestamp: string }
  | { phase: "error"; message: string };

export default function WantlistClient({ profileUsername, isOwner, userId, initialItems }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<WantlistItem[]>(initialItems);
  const [upload, setUpload] = useState<UploadState>({ phase: "idle" });
  const [dragOver, setDragOver] = useState(false);

  const lastImportKey = userId ? `wantlist_last_import_${userId}` : null;
  const lastImport    = lastImportKey ? (typeof window !== "undefined" ? localStorage.getItem(lastImportKey) : null) : null;

  const processFile = useCallback(async (file: File) => {
    if (!userId) return;
    const text = await file.text();
    const { rows, errors } = parseWantlistCsv(text);

    if (errors.length > 0 && rows.length === 0) {
      setUpload({ phase: "error", message: errors[0] });
      return;
    }

    setUpload({ phase: "importing", done: 0, total: rows.length });

    const supabase = createClient();
    const BATCH    = 100;
    let imported   = 0;

    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH).map((r) => ({ ...r, user_id: userId }));
      const { error } = await supabase
        .from("wantlist")
        .upsert(batch, { onConflict: "user_id,discogs_release_id" });

      if (error) {
        setUpload({ phase: "error", message: `Batch starting at row ${i + 1}: ${error.message}` });
        return;
      }
      imported += batch.length;
      setUpload({ phase: "importing", done: imported, total: rows.length });
    }

    // Refetch to get DB-assigned IDs + any previously cached cover URLs
    const { data: fresh } = await supabase
      .from("wantlist")
      .select("id, discogs_release_id, catalog, artist, title, label, format, released, date_added, cover_image_url")
      .eq("user_id", userId)
      .order("date_added", { ascending: false });

    const timestamp = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    if (lastImportKey) localStorage.setItem(lastImportKey, timestamp);

    setItems((fresh ?? []) as WantlistItem[]);
    setUpload({ phase: "done", count: imported, timestamp });
  }, [userId, lastImportKey]);

  function handleFile(file: File) {
    if (!file.name.endsWith(".csv")) {
      setUpload({ phase: "error", message: "Please upload a .csv file exported from Discogs." });
      return;
    }
    setUpload({ phase: "parsed", count: 0 });
    processFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  const hasItems = items.length > 0;

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "2.5rem 1.5rem 4rem" }}>

      {/* Page header */}
      <div style={{ marginBottom: "2rem", borderBottom: `1px solid ${RULE}`, paddingBottom: "1.5rem" }}>
        <p style={{ fontFamily: MONO, fontSize: "0.55rem", letterSpacing: "0.16em", textTransform: "uppercase", color: ORANGE, margin: "0 0 8px" }}>
          @{profileUsername}
        </p>
        <h1 style={{ fontFamily: SERIF, fontSize: "clamp(1.8rem, 3vw, 2.6rem)", color: INK, margin: 0, lineHeight: 1 }}>
          Wantlist
        </h1>
      </div>

      {/* Owner: upload controls */}
      {isOwner && (
        <div style={{ marginBottom: "2rem" }}>
          {!hasItems ? (
            // Full upload zone when empty
            <div>
              <p style={{ fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase", color: INK, margin: "0 0 6px" }}>
                IMPORT YOUR DISCOGS WANTLIST
              </p>
              <p style={{ fontFamily: MONO, fontSize: "0.7rem", color: "#888", margin: "0 0 16px" }}>
                Export your wantlist from Discogs: Account → Export → Wantlist CSV
              </p>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                style={{
                  border: `1px dashed ${dragOver ? ORANGE : RULE}`,
                  background: BG,
                  padding: "2.5rem",
                  textAlign: "center",
                  cursor: "pointer",
                  transition: "border-color 0.15s",
                }}
              >
                <p style={{ fontFamily: MONO, fontSize: "0.75rem", letterSpacing: "0.06em", color: "#999", margin: 0 }}>
                  Drop CSV file here, or click to browse
                </p>
              </div>
            </div>
          ) : (
            // Compact re-import button when items exist
            <button
              onClick={() => fileRef.current?.click()}
              style={{
                fontFamily: MONO,
                fontSize: "0.65rem",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: INK,
                background: "none",
                border: `1px solid ${RULE}`,
                padding: "8px 16px",
                cursor: "pointer",
              }}
            >
              Re-import / update wantlist
            </button>
          )}

          {/* Mobile: plain button even when empty (hidden on desktop via display logic) */}
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
          />

          {/* Upload status */}
          {upload.phase === "parsed" && (
            <p style={{ fontFamily: MONO, fontSize: "0.75rem", color: INK, margin: "12px 0 0" }}>
              Parsing…
            </p>
          )}
          {upload.phase === "importing" && (
            <p style={{ fontFamily: MONO, fontSize: "0.75rem", color: INK, margin: "12px 0 0" }}>
              Importing {upload.done.toLocaleString()} / {upload.total.toLocaleString()} items…
            </p>
          )}
          {upload.phase === "done" && (
            <p style={{ fontFamily: MONO, fontSize: "0.75rem", color: INK, margin: "12px 0 0" }}>
              {upload.count.toLocaleString()} items imported. Last updated: {upload.timestamp}.
            </p>
          )}
          {upload.phase === "error" && (
            <p style={{ fontFamily: MONO, fontSize: "0.75rem", color: "#c0392b", margin: "12px 0 0" }}>
              {upload.message}
            </p>
          )}
          {lastImport && upload.phase === "idle" && hasItems && (
            <p style={{ fontFamily: MONO, fontSize: "0.65rem", color: "#aaa", margin: "8px 0 0" }}>
              Last updated: {lastImport}
            </p>
          )}
        </div>
      )}

      {/* Item count eyebrow */}
      {hasItems && (
        <p style={{ fontFamily: MONO, fontSize: "0.6rem", letterSpacing: "0.14em", textTransform: "uppercase", color: ORANGE, margin: "0 0 1.25rem" }}>
          {items.length.toLocaleString()} {items.length === 1 ? "RECORD" : "RECORDS"}
        </p>
      )}

      {/* Grid */}
      {hasItems ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
            gap: "1.25rem",
          }}
        >
          {items.map((item) => (
            <div key={item.id}>
              <WantlistCoverImage
                releaseId={item.discogs_release_id}
                initialUrl={item.cover_image_url}
                alt={`${item.artist} – ${item.title}`}
                catalog={item.catalog}
              />
              <div style={{ marginTop: "8px" }}>
                <p
                  className="truncate"
                  style={{ fontFamily: SERIF, fontSize: "0.78rem", color: INK, margin: "0 0 3px", lineHeight: 1.3 }}
                >
                  {item.artist}
                </p>
                <p
                  className="truncate"
                  style={{ fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "0.03em", color: INK, margin: "0 0 3px" }}
                >
                  {item.title}
                </p>
                {item.released && (
                  <p style={{ fontFamily: MONO, fontSize: "0.6rem", letterSpacing: "0.06em", color: ORANGE, margin: 0 }}>
                    {item.released}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : !isOwner ? (
        <p style={{ fontFamily: MONO, fontSize: "0.75rem", color: "#aaa", marginTop: "3rem" }}>
          No wantlist items yet.
        </p>
      ) : null}
    </div>
  );
}
