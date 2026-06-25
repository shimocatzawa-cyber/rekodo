"use client";

import { useRef, useState, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const MONO   = "var(--font-mono)";
const INK    = "#0a0a0a";
const RULE   = "#e0e0da";
const BG     = "#FDF6F0";
const ORANGE = "#CC5500";

interface Props {
  isOwner:      boolean;
  isSupporter:  boolean;
  userId:       string | null;
  embedded?:    boolean;
}

type ParsedRow = {
  artist: string;
  title: string;
  released: number | null;
  discogs_release_id: number;
};

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
      artist,
      title,
      released: parseInt(cols[6] ?? "", 10) || null,
      discogs_release_id: releaseId,
    });
  }

  return { rows, errors };
}

type UploadState =
  | { phase: "idle" }
  | { phase: "importing"; done: number; total: number }
  | { phase: "done"; count: number; timestamp: string; skipped: number }
  | { phase: "error"; message: string };

export default function WantlistClient({ isOwner, isSupporter, userId, embedded = false }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [upload, setUpload] = useState<UploadState>({ phase: "idle" });
  const [dragOver, setDragOver] = useState(false);

  const processFile = useCallback(async (file: File) => {
    if (!userId) return;
    const text = await file.text();
    const { rows, errors } = parseWantlistCsv(text);

    if (rows.length === 0) {
      setUpload({ phase: "error", message: errors.length > 0 ? errors[0] : "No valid rows found in CSV." });
      return;
    }

    setUpload({ phase: "importing", done: 0, total: rows.length });

    const supabase = createClient();

    // Find or create the wantlist list
    let listId: string;
    {
      const { data: existing, error: findErr } = await supabase
        .from("lists")
        .select("id")
        .eq("user_id", userId)
        .eq("slug", "wantlist")
        .single();

      if (findErr && findErr.code !== "PGRST116") {
        setUpload({ phase: "error", message: `Could not look up wantlist: ${findErr.message}` });
        return;
      }

      if (existing) {
        listId = existing.id;
      } else {
        const { data: created, error: createErr } = await supabase
          .from("lists")
          .insert({ user_id: userId, title: "Wantlist", slug: "wantlist", is_public: true, list_type: "personal" })
          .select("id")
          .single();
        if (createErr || !created) {
          setUpload({ phase: "error", message: `Could not create wantlist: ${createErr?.message ?? "unknown"}` });
          return;
        }
        listId = created.id;
      }
    }

    // Fetch existing items to determine positions
    const { data: existingItems } = await supabase
      .from("list_items")
      .select("position, discogs_release_id")
      .eq("list_id", listId)
      .not("discogs_release_id", "is", null);

    const existingMap = new Map<number, number>(
      (existingItems ?? []).map(e => [e.discogs_release_id as number, e.position])
    );
    const maxPos = existingItems && existingItems.length > 0
      ? existingItems.reduce((m, e) => Math.max(m, e.position), 0)
      : 0;

    let nextPos = maxPos + 1;
    const upsertRows = rows.map(r => {
      const existingPos = existingMap.get(r.discogs_release_id);
      const position = existingPos ?? nextPos++;
      return {
        list_id: listId,
        position,
        item_type: "song" as const,
        song_title: r.title,
        song_artist: r.artist,
        song_album: r.title,
        song_year: r.released,
        source: "discogs",
        discogs_release_id: r.discogs_release_id,
      };
    });

    const BATCH = 100;
    let imported = 0;

    for (let i = 0; i < upsertRows.length; i += BATCH) {
      const batch = upsertRows.slice(i, i + BATCH);
      const { error } = await supabase
        .from("list_items")
        .upsert(batch, { onConflict: "list_id,discogs_release_id" });

      if (error) {
        setUpload({ phase: "error", message: `Batch at row ${i + 1}: ${error.message}` });
        return;
      }
      imported += batch.length;
      setUpload({ phase: "importing", done: imported, total: rows.length });
    }

    const timestamp = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    setUpload({ phase: "done", count: imported, timestamp, skipped: errors.length });

    window.location.reload();
  }, [userId]);

  function handleFile(file: File) {
    if (!file.name.endsWith(".csv")) {
      setUpload({ phase: "error", message: "Please upload a .csv file exported from Discogs." });
      return;
    }
    processFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  if (!isOwner) return null;

  if (!isSupporter) {
    return (
      <div style={{ marginBottom: embedded ? "2rem" : "3rem", padding: "1.5rem", border: "1px solid #e0e0da", background: "#FDFCF8" }}>
        <p style={{ fontFamily: MONO, fontSize: "0.55rem", letterSpacing: "0.14em", textTransform: "uppercase", color: ORANGE, margin: "0 0 8px" }}>
          Supporter Feature
        </p>
        <p style={{ fontFamily: MONO, fontSize: "0.65rem", color: "#555", margin: "0 0 14px", lineHeight: 1.7 }}>
          Wantlist upload is available to rek<span style={{ color: ORANGE }}>ō</span>do supporters.
        </p>
        <Link
          href="/about#support"
          style={{ fontFamily: MONO, fontSize: "0.6rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "#FDF6F0", background: "#0a0a0a", padding: "10px 20px", textDecoration: "none", display: "inline-block" }}
        >
          Support rek<span style={{ color: ORANGE }}>ō</span>do →
        </Link>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: embedded ? "2rem" : "3rem" }}>
      <p style={{ fontFamily: MONO, fontSize: "0.55rem", letterSpacing: "0.14em", textTransform: "uppercase", color: ORANGE, margin: "0 0 6px" }}>
        DISCOGS WANTLIST IMPORT
      </p>
      <p style={{ fontFamily: MONO, fontSize: "0.65rem", color: "#888", margin: "0 0 12px" }}>
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
          padding: "1.25rem 2rem",
          textAlign: "center",
          cursor: "pointer",
          transition: "border-color 0.15s",
          display: "inline-block",
        }}
      >
        <p style={{ fontFamily: MONO, fontSize: "0.7rem", letterSpacing: "0.04em", color: "#999", margin: 0 }}>
          Drop CSV here, or click to browse
        </p>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".csv"
        style={{ display: "none" }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
      />

      {upload.phase === "importing" && (
        <p style={{ fontFamily: MONO, fontSize: "0.7rem", color: INK, margin: "10px 0 0" }}>
          Importing {upload.done.toLocaleString()} / {upload.total.toLocaleString()}…
        </p>
      )}
      {upload.phase === "done" && (
        <p style={{ fontFamily: MONO, fontSize: "0.7rem", color: INK, margin: "10px 0 0" }}>
          {upload.count.toLocaleString()} items imported on {upload.timestamp}.
          {upload.skipped > 0 && ` ${upload.skipped} row${upload.skipped > 1 ? "s" : ""} skipped (missing data).`}
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
