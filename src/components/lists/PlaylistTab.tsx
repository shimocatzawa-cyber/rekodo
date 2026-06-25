"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createList, appendSongToList } from "@/app/lists/actions";
import PlaylistPromptPanel, { type Mood, type MatchStatus } from "@/components/lists/playlist/PlaylistPromptPanel";
import PlaylistPlayer from "@/components/lists/playlist/PlaylistPlayer";
import PlaylistTrackList from "@/components/lists/playlist/PlaylistTrackList";
import SavedPlaylistsPanel, { type SavedPlaylistSummary } from "@/components/lists/playlist/SavedPlaylistsPanel";
import PlaylistShareModal from "@/components/lists/playlist/PlaylistShareModal";
import RecordSpinner from "@/components/RecordSpinner";

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
  source:      "collection" | "wantlist" | "discover";
};

const MATCH_POLL_MS = 5000;
const RESEQUENCE_DEBOUNCE_MS = 400;

// Kill switch — paused while we rework this to stop hammering Spotify's
// entire backlog in the background (see the on-demand matcher added to
// /api/playlist/generate instead). Flip back to true to restore the old
// eager-background-sync behavior.
const BACKGROUND_MATCH_ENABLED = false;

export default function PlaylistTab({ username }: { username: string }) {
  const router = useRouter();

  const [mood,                    setMood]                    = useState<Mood | null>(null);
  const [refinement,              setRefinement]              = useState("");
  const [includeOutsideCollection, setIncludeOutsideCollection] = useState(false);
  const [trackCount,              setTrackCount]              = useState(10);

  const [tracks,     setTracks]     = useState<GeneratedTrack[]>([]);
  const [generating,  setGenerating] = useState(false);
  const [error,       setError]      = useState<string | null>(null);
  const [dailyLimitReached, setDailyLimitReached] = useState(false);
  const [resequencing, setResequencing] = useState(false);

  const [matchStatus, setMatchStatus] = useState<MatchStatus | null>(null);
  const [spotifyConnected, setSpotifyConnected] = useState<boolean | null>(null);

  const [titleDraft, setTitleDraft] = useState("");
  const [saving,     setSaving]     = useState(false);
  const [saveDone,   setSaveDone]   = useState<string | null>(null);

  const [savedPlaylists, setSavedPlaylists] = useState<SavedPlaylistSummary[]>([]);
  const [loadingSaved,   setLoadingSaved]   = useState(true);
  const [activeSavedId,  setActiveSavedId]  = useState<string | null>(null);

  const [showShare, setShowShare] = useState(false);

  const matchPollRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const resequenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastMatchTriggerRef = useRef(0);

  // Accumulates what's already been served so repeated Generate clicks for the
  // same mood reach further into the collection instead of converging on the
  // same safe picks every time. Reset whenever the mood or collection scope
  // changes, since those meaningfully change what "already seen" should mean.
  const excludedUrisRef    = useRef<Set<string>>(new Set());
  const excludedArtistsRef = useRef<Set<string>>(new Set());

  // Mood/scope change — start the "already seen" tracking fresh.
  useEffect(() => {
    excludedUrisRef.current = new Set();
    excludedArtistsRef.current = new Set();
  }, [mood, includeOutsideCollection]);

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
      setTitleDraft(data.title ?? "");
      setActiveSavedId(id);
      // An empty result means none of the saved items carry Spotify match data —
      // a legacy list saved before tracks were matched. There's nothing to play;
      // say so instead of silently showing the "pick a mood" empty state.
      if (data.tracks.length === 0) {
        setTracks([]);
        setError("This saved playlist has no Spotify-matched tracks (likely saved before matching was added) — delete it from My Saved Playlists.");
        return;
      }
      setTracks(data.tracks);
    } catch {
      setError("Failed to load saved playlist.");
    }
  }

  async function handleDeleteSaved(id: string) {
    if (!window.confirm("Delete this saved playlist? This can't be undone.")) return;
    try {
      const res = await fetch(`/api/playlist/saved/${id}`, { method: "DELETE" });
      if (!res.ok) {
        setError("Failed to delete saved playlist.");
        return;
      }
      setSavedPlaylists(prev => prev.filter(p => p.id !== id));
      if (activeSavedId === id) {
        setActiveSavedId(null);
        setTracks([]);
        setTitleDraft("");
        setError(null);
      }
    } catch {
      setError("Failed to delete saved playlist.");
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
    setDailyLimitReached(false);
    setSaveDone(null);
    setActiveSavedId(null);
    try {
      const res = await fetch("/api/playlist/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mood, includeOutsideCollection, trackCount, refinement,
          excludeUris: [...excludedUrisRef.current],
          excludeArtists: [...excludedArtistsRef.current],
        }),
      });
      const data = await res.json() as { tracks?: GeneratedTrack[]; error?: string };
      if (res.status === 429 && data.error === "daily_limit_reached") {
        setDailyLimitReached(true);
        setTracks([]);
      } else if (!res.ok || !data.tracks) {
        setError(data.error ?? "Failed to generate playlist.");
        setTracks([]);
      } else {
        for (const t of data.tracks) {
          excludedUrisRef.current.add(t.spotify_uri);
          excludedArtistsRef.current.add(t.artist.toLowerCase().trim());
        }
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
    <div className="rk-playlist-outer" style={{ padding: "3rem 3.5rem", maxWidth: 1400, margin: "0 auto" }}>
      <div className="rk-playlist-grid" style={{ display: "grid", gridTemplateColumns: "320px 1fr 300px", gap: "32px", alignItems: "flex-start" }}>
        <PlaylistPromptPanel
          mood={mood} setMood={setMood}
          refinement={refinement} setRefinement={setRefinement}
          includeOutsideCollection={includeOutsideCollection} setIncludeOutsideCollection={setIncludeOutsideCollection}
          trackCount={trackCount} setTrackCount={setTrackCount}
          onGenerate={handleGenerate} generating={generating}
          matchStatus={matchStatus} spotifyConnected={spotifyConnected}
        />

        <div style={{ minWidth: 0 }}>
          {dailyLimitReached && !generating && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", padding: "2rem", textAlign: "center" }}>
              <p style={{ fontFamily: MONO, fontSize: "0.55rem", letterSpacing: "0.16em", textTransform: "uppercase", color: "#CC5500", margin: 0 }}>
                Daily limit reached
              </p>
              <p style={{ fontFamily: SERIF, fontSize: "1.6rem", fontWeight: 400, color: "#0a0a0a", margin: 0, lineHeight: 1.1 }}>
                2 playlists per day
              </p>
              <p style={{ fontFamily: MONO, fontSize: "0.6rem", color: "#666", margin: "4px 0 16px", lineHeight: 1.7 }}>
                Free accounts get 2 playlist generations per day.<br />
                Support rek<span style={{ color: "#CC5500" }}>ō</span>do for unlimited access.
              </p>
              <Link
                href="/about#support"
                style={{ fontFamily: MONO, fontSize: "0.6rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "#FDF6F0", background: "#0a0a0a", padding: "12px 24px", textDecoration: "none", display: "inline-block" }}
              >
                Support rek<span style={{ color: "#CC5500" }}>ō</span>do →
              </Link>
            </div>
          )}

          {error && !generating && (
            <p style={{ fontFamily: MONO, fontSize: "10px", color: "#cc3300", marginBottom: "16px" }}>{error}</p>
          )}

          {generating ? (
            <div style={{ display: "flex", flexDirection: "column", minHeight: "420px" }}>
              <RecordSpinner />
            </div>
          ) : tracks.length > 0 ? (
            <>
              <div className="rk-playlist-header" style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
                <h2 style={{ fontFamily: SERIF, fontSize: "18px", fontWeight: 400, color: "#0d0d0d", margin: 0, lineHeight: 1.2, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {titleDraft || (mood ? `${mood[0].toUpperCase()}${mood.slice(1)} Mix` : "Playlist")}
                </h2>
                <button
                  onClick={() => setShowShare(true)}
                  style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#CC5500", background: "none", border: "none", cursor: "pointer", padding: 0, flexShrink: 0 }}
                >
                  Share ↗
                </button>
              </div>

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
          onDeleteSaved={handleDeleteSaved}
        />
      </div>

      {showShare && (
        <PlaylistShareModal
          onClose={() => setShowShare(false)}
          title={titleDraft || (mood ? `${mood[0].toUpperCase()}${mood.slice(1)} Mix` : "Playlist")}
          tracks={tracks}
          username={username}
        />
      )}
    </div>
  );
}
