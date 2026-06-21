"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createList, appendSongToList } from "@/app/lists/actions";
import PlaylistPromptPanel, { type Mood, type MatchStatus } from "@/components/lists/playlist/PlaylistPromptPanel";
import PlaylistPlayer from "@/components/lists/playlist/PlaylistPlayer";
import PlaylistTrackList from "@/components/lists/playlist/PlaylistTrackList";
import SavedPlaylistsPanel, { type SavedPlaylistSummary } from "@/components/lists/playlist/SavedPlaylistsPanel";

const SERIF  = "var(--font-editorial)";
const MONO   = "var(--font-mono)";
const MUTED  = "#aaaaaa";
const RULE   = "#e0e0da";

export type GeneratedTrack = {
  spotify_uri: string;
  artist:      string;
  title:       string;
  album:       string;
  year:        number | null;
  cover_url:   string | null;
  duration_ms: number;
  preview_url: string | null;
  rationale:   string;
  source:      "collection" | "wantlist";
};

const MATCH_POLL_MS = 5000;
const RESEQUENCE_DEBOUNCE_MS = 400;

// Kill switch — paused while we rework this to stop hammering Spotify's
// entire backlog in the background (see the on-demand matcher added to
// /api/playlist/generate instead). Flip back to true to restore the old
// eager-background-sync behavior.
const BACKGROUND_MATCH_ENABLED = false;

export default function PlaylistTab() {
  const router = useRouter();

  const [mood,            setMood]            = useState<Mood | null>(null);
  const [refinement,      setRefinement]      = useState("");
  const [includeWantlist, setIncludeWantlist] = useState(false);
  const [trackCount,      setTrackCount]      = useState(10);

  const [tracks,     setTracks]     = useState<GeneratedTrack[]>([]);
  const [generating,  setGenerating] = useState(false);
  const [error,       setError]      = useState<string | null>(null);
  const [resequencing, setResequencing] = useState(false);

  const [matchStatus, setMatchStatus] = useState<MatchStatus | null>(null);
  const [spotifyConnected, setSpotifyConnected] = useState<boolean | null>(null);

  const [titleDraft, setTitleDraft] = useState("");
  const [saving,     setSaving]     = useState(false);
  const [saveDone,   setSaveDone]   = useState<string | null>(null);

  const [savedPlaylists, setSavedPlaylists] = useState<SavedPlaylistSummary[]>([]);
  const [loadingSaved,   setLoadingSaved]   = useState(true);
  const [activeSavedId,  setActiveSavedId]  = useState<string | null>(null);

  const matchPollRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const resequenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastMatchTriggerRef = useRef(0);

  // ── Spotify connection check ──────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/spotify/token")
      .then(r => r.json() as Promise<{ connected: boolean }>)
      .then(data => setSpotifyConnected(data.connected))
      .catch(() => setSpotifyConnected(false));
  }, []);

  // ── Saved playlists (right column) ────────────────────────────────────────
  // loadingSaved starts true (initial mount); don't setState synchronously
  // within the mount effect below — only clear it once the fetch settles.
  async function loadSavedPlaylists() {
    try {
      const res = await fetch("/api/playlist/saved");
      const data = await res.json() as { playlists?: SavedPlaylistSummary[] };
      setSavedPlaylists(data.playlists ?? []);
    } catch {
      // best-effort — leave whatever was already loaded
    } finally {
      setLoadingSaved(false);
    }
  }

  useEffect(() => {
    fetch("/api/playlist/saved")
      .then(r => r.json() as Promise<{ playlists?: SavedPlaylistSummary[] }>)
      .then(data => setSavedPlaylists(data.playlists ?? []))
      .catch(() => {})
      .finally(() => setLoadingSaved(false));
  }, []);

  async function handleLoadSaved(id: string) {
    setError(null);
    setSaveDone(null);
    try {
      const res = await fetch(`/api/playlist/saved/${id}`);
      const data = await res.json() as { title?: string; tracks?: GeneratedTrack[]; error?: string };
      if (!res.ok || !data.tracks) {
        setError(data.error ?? "Failed to load saved playlist.");
        return;
      }
      setTracks(data.tracks);
      setTitleDraft(data.title ?? "");
      setActiveSavedId(id);
    } catch {
      setError("Failed to load saved playlist.");
    }
  }

  // ── Trigger + poll lazy Spotify matching ──────────────────────────────────
  // Each worker invocation only processes a short, time-boxed chunk (server
  // self-triggering chains aren't reliable on Vercel) — so as long as work
  // remains, the client re-fires the trigger periodically itself. The browser
  // doesn't have the "frozen after response" failure mode serverless
  // functions do, so it's the dependable way to keep progress moving.
  // 30s rather than tighter — this is a background backfill, not anything
  // the user is waiting on, and each retrigger costs a real (Vercel-billed)
  // worker invocation kept alive for its full run via after().
  const MATCH_RETRIGGER_MS = 30_000;

  useEffect(() => {
    if (!BACKGROUND_MATCH_ENABLED) return;
    if (spotifyConnected !== true) return;

    function poll() {
      // Don't keep billing worker invocations for a tab nobody's looking at.
      if (document.hidden) return;
      fetch("/api/playlist/match-status")
        .then(r => r.json() as Promise<MatchStatus>)
        .then(data => {
          setMatchStatus(data);
          if (data.pending === 0) {
            if (matchPollRef.current) { clearInterval(matchPollRef.current); matchPollRef.current = null; }
            return;
          }
          if (Date.now() - lastMatchTriggerRef.current > MATCH_RETRIGGER_MS) {
            lastMatchTriggerRef.current = Date.now();
            fetch("/api/playlist/match-spotify", { method: "POST" }).catch(() => {});
          }
        })
        .catch(() => {});
    }

    lastMatchTriggerRef.current = Date.now();
    fetch("/api/playlist/match-spotify", { method: "POST" }).catch(() => {});
    poll();
    matchPollRef.current = setInterval(poll, MATCH_POLL_MS);

    return () => {
      if (matchPollRef.current) { clearInterval(matchPollRef.current); matchPollRef.current = null; }
    };
  }, [spotifyConnected]);

  // ── Generate ───────────────────────────────────────────────────────────────
  async function handleGenerate() {
    if (!mood) return;
    setGenerating(true);
    setError(null);
    setSaveDone(null);
    setActiveSavedId(null);
    try {
      const res = await fetch("/api/playlist/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mood, includeWantlist, trackCount, refinement }),
      });
      const data = await res.json() as { tracks?: GeneratedTrack[]; error?: string };
      if (!res.ok || !data.tracks) {
        setError(data.error ?? "Failed to generate playlist.");
        setTracks([]);
      } else {
        setTracks(data.tracks);
        setTitleDraft(`${mood[0].toUpperCase()}${mood.slice(1)} Mix`);
      }
    } catch {
      setError("Failed to generate playlist.");
    } finally {
      setGenerating(false);
    }
  }

  // ── Reorder (optimistic, debounced rationale refresh) ────────────────────
  function handleReorder(newTracks: GeneratedTrack[]) {
    setTracks(newTracks);
    if (resequenceTimerRef.current) clearTimeout(resequenceTimerRef.current);
    resequenceTimerRef.current = setTimeout(() => {
      void resequenceNotes(newTracks);
    }, RESEQUENCE_DEBOUNCE_MS);
  }

  async function resequenceNotes(snapshot: GeneratedTrack[]) {
    setResequencing(true);
    try {
      const res = await fetch("/api/playlist/resequence-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mood,
          tracks: snapshot.map(t => ({ spotify_uri: t.spotify_uri, artist: t.artist, title: t.title, album: t.album })),
        }),
      });
      const data = await res.json() as { rationales?: string[] };
      if (res.ok && data.rationales) {
        setTracks(current => {
          // Only apply if the current order's URIs still match the snapshot we requested for —
          // avoids overwriting a newer reorder that happened while this request was in flight.
          const sameOrder = current.length === snapshot.length && current.every((t, i) => t.spotify_uri === snapshot[i].spotify_uri);
          if (!sameOrder) return current;
          return current.map((t, i) => ({ ...t, rationale: data.rationales![i] ?? t.rationale }));
        });
      }
    } catch {
      // best-effort — leave existing rationales in place on failure
    } finally {
      setResequencing(false);
    }
  }

  // ── Save as list ───────────────────────────────────────────────────────────
  async function handleSave() {
    if (!tracks.length) return;
    setSaving(true);
    setSaveDone(null);
    const title = titleDraft.trim() || "My Playlist";
    const res = await createList(title, "personal");
    if (!res.success || !res.list) {
      setError("error" in res && res.error ? res.error : "Failed to create list.");
      setSaving(false);
      return;
    }
    const listId = res.list.id;
    for (const t of tracks) {
      await appendSongToList(listId, {
        song_title: t.title, song_artist: t.artist, song_album: t.album,
        song_cover_url: t.cover_url, song_year: t.year,
        spotify_uri: t.spotify_uri, duration_ms: t.duration_ms, preview_url: t.preview_url,
      });
    }
    await loadSavedPlaylists();
    setSaving(false);
    setSaveDone(title);
    setActiveSavedId(listId);
    router.refresh();
  }

  return (
    <div style={{ padding: "3rem 3.5rem", maxWidth: 1400, margin: "0 auto" }}>
      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr 300px", gap: "32px", alignItems: "flex-start" }}>
        <PlaylistPromptPanel
          mood={mood} setMood={setMood}
          refinement={refinement} setRefinement={setRefinement}
          includeWantlist={includeWantlist} setIncludeWantlist={setIncludeWantlist}
          trackCount={trackCount} setTrackCount={setTrackCount}
          onGenerate={handleGenerate} generating={generating}
          matchStatus={matchStatus} spotifyConnected={spotifyConnected}
        />

        <div style={{ minWidth: 0 }}>
          {error && (
            <p style={{ fontFamily: MONO, fontSize: "10px", color: "#cc3300", marginBottom: "16px" }}>{error}</p>
          )}

          {tracks.length > 0 ? (
            <>
              <div style={{ marginBottom: "16px" }}>
                <PlaylistPlayer tracks={tracks} moodLabel={mood ?? titleDraft} />
              </div>

              <PlaylistTrackList tracks={tracks} onReorder={handleReorder} resequencing={resequencing} />
            </>
          ) : (
            <div style={{ border: `1px dashed ${RULE}`, padding: "48px 24px", textAlign: "center" }}>
              <p style={{ fontFamily: SERIF, fontSize: "16px", color: MUTED, margin: 0 }}>
                Pick a mood and generate a playlist from your collection.
              </p>
            </div>
          )}
        </div>

        <SavedPlaylistsPanel
          titleDraft={titleDraft} setTitleDraft={setTitleDraft}
          onRegenerate={handleGenerate} generating={generating}
          onSave={handleSave} saving={saving} saveDone={saveDone}
          hasTracks={tracks.length > 0}
          savedPlaylists={savedPlaylists} loadingSaved={loadingSaved}
          activeSavedId={activeSavedId} onLoadSaved={handleLoadSaved}
        />
      </div>
    </div>
  );
}
