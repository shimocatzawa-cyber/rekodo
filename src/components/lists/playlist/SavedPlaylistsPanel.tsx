"use client";

import type { GeneratedTrack } from "@/components/lists/PlaylistTab";

const SERIF  = "var(--font-editorial)";
const MONO   = "var(--font-mono)";
const ORANGE = "#CC5500";
const INK    = "#0d0d0d";
const MUTED  = "#aaaaaa";
const RULE   = "#e0e0da";

function buildExportText(title: string, tracks: GeneratedTrack[]): string {
  const lines = tracks.map((t, i) => {
    const year = t.year ? ` (${t.year})` : "";
    return `${i + 1}. ${t.artist} — ${t.title} — ${t.album}${year}`;
  });
  return [
    title,
    "",
    ...lines,
    "",
    "Import into Apple Music, Spotify, or any service via Soundiiz (soundiiz.com) or TuneMyMusic (tunemymusic.com) — both free for playlists this size.",
  ].join("\n");
}

function downloadTextFile(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export type SavedPlaylistSummary = { id: string; title: string; createdAt: string; trackCount: number; durationMs: number };

function relativeDate(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return new Date(iso).toLocaleDateString();
}

function fmtTotal(ms: number): string {
  const totalMin = Math.round(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

interface Props {
  titleDraft:    string;
  setTitleDraft: (s: string) => void;
  onRegenerate:  () => void;
  generating:    boolean;
  onSave:        () => void;
  saving:        boolean;
  saveDone:      string | null;
  hasTracks:     boolean;
  tracks:        GeneratedTrack[];
  savedPlaylists: SavedPlaylistSummary[];
  loadingSaved:   boolean;
  activeSavedId:  string | null;
  onLoadSaved:    (id: string) => void;
  onDeleteSaved:  (id: string) => void;
}

export default function SavedPlaylistsPanel({
  titleDraft, setTitleDraft, onRegenerate, generating, onSave, saving, saveDone, hasTracks,
  tracks, savedPlaylists, loadingSaved, activeSavedId, onLoadSaved, onDeleteSaved,
}: Props) {
  function handleExport() {
    const title = titleDraft.trim() || "My Playlist";
    const slug  = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
    downloadTextFile(`rekodo-${slug}.txt`, buildExportText(title, tracks));
  }
  return (
    <div style={{ background: "#ffffff", border: `1px solid ${RULE}`, padding: "28px 28px 24px" }}>
      <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", color: MUTED, marginBottom: "10px" }}>
        Save Current Mix
      </p>

      <input
        value={titleDraft}
        onChange={e => setTitleDraft(e.target.value)}
        placeholder="List title"
        maxLength={80}
        disabled={!hasTracks}
        style={{ fontFamily: SERIF, fontSize: "13px", color: INK, border: `1px solid ${RULE}`, padding: "8px 10px", width: "100%", boxSizing: "border-box", marginBottom: "10px" }}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: saveDone ? "8px" : "20px" }}>
        <button
          onClick={onSave}
          disabled={saving || !hasTracks}
          style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", background: hasTracks ? INK : "#eeeeee", color: hasTracks ? "#ffffff" : "#bbbbbb", border: "none", cursor: saving || !hasTracks ? "default" : "pointer", padding: "9px 14px", width: "100%" }}
        >
          {saving ? "Saving…" : "Save as list"}
        </button>

        <button
          onClick={onRegenerate}
          disabled={generating || !hasTracks}
          style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: hasTracks ? ORANGE : "#cccccc", background: "none", border: `1px solid ${hasTracks ? ORANGE : RULE}`, borderRadius: "3px", cursor: generating || !hasTracks ? "default" : "pointer", padding: "8px 14px", width: "100%" }}
        >
          Regenerate
        </button>

        <button
          onClick={handleExport}
          disabled={!hasTracks}
          title="Downloads a track list you can import into Apple Music or Spotify via Soundiiz or TuneMyMusic (both free)"
          style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: hasTracks ? INK : "#cccccc", background: "none", border: `1px solid ${hasTracks ? "#c0bcb4" : RULE}`, borderRadius: "3px", cursor: !hasTracks ? "default" : "pointer", padding: "8px 0", width: "100%" }}
        >
          Export Playlist
        </button>
      </div>

      {saveDone && (
        <p style={{ fontFamily: MONO, fontSize: "9px", color: MUTED, marginBottom: "20px" }}>
          Saved as “{saveDone}”.
        </p>
      )}

      <div style={{ borderTop: `1px solid ${RULE}`, paddingTop: "16px" }}>
        <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", color: MUTED, marginBottom: "10px" }}>
          My Saved Playlists
        </p>

        {loadingSaved ? (
          <p style={{ fontFamily: MONO, fontSize: "9.5px", color: MUTED }}>Loading…</p>
        ) : savedPlaylists.length === 0 ? (
          <p style={{ fontFamily: MONO, fontSize: "9.5px", color: MUTED }}>
            Nothing saved yet — generate a mix and save it to see it here.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {savedPlaylists.map(p => {
              const active = p.id === activeSavedId;
              return (
                <div
                  key={p.id}
                  style={{
                    display: "flex", alignItems: "center", gap: "4px",
                    background: active ? "#fdf6f0" : "none",
                    borderLeft: `2px solid ${active ? ORANGE : "transparent"}`,
                  }}
                >
                  <button
                    onClick={() => onLoadSaved(p.id)}
                    style={{
                      flex: 1, minWidth: 0, textAlign: "left", background: "none",
                      border: "none", padding: "8px 10px", cursor: "pointer",
                    }}
                  >
                    <p style={{ fontFamily: SERIF, fontSize: "13px", color: INK, margin: "0 0 2px 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.title}
                    </p>
                    <p style={{ fontFamily: MONO, fontSize: "8px", letterSpacing: "0.04em", color: MUTED, margin: 0 }}>
                      {p.trackCount} track{p.trackCount === 1 ? "" : "s"}{p.durationMs > 0 ? ` · ${fmtTotal(p.durationMs)}` : ""} · {relativeDate(p.createdAt)}
                    </p>
                  </button>
                  <button
                    onClick={() => onDeleteSaved(p.id)}
                    aria-label={`Delete ${p.title}`}
                    title="Delete"
                    style={{
                      flexShrink: 0, fontFamily: MONO, fontSize: "11px", color: MUTED,
                      background: "none", border: "none", cursor: "pointer", padding: "8px 10px",
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#cc3300"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = MUTED; }}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
