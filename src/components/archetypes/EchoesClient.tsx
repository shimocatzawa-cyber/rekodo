"use client";

import { useState, useEffect } from "react";

const SERIF  = "var(--font-editorial)";
const MONO   = "var(--font-mono)";
const INK    = "#0a0a0a";
const ORANGE = "#CC5500";
const RULE   = "#e0e0da";
const MUTED  = "#8a7e76";
const WARM   = "#FDF6F0";

// ── Types ─────────────────────────────────────────────────────────────────────

interface EchoAlbum {
  title: string;
  artist: string;
  year?: number | null;
  why: string;
  imageUrl?: string;
}

interface SignalCtx { score?: number; label?: string; rhythmType?: string; digitalOnlyArtists?: string[] }

interface EchoesData {
  missingMiddle: { clusterA: string; clusterB: string; bridge: string; albums: EchoAlbum[] };
  unboughtClassic: { scene: string; intro: string; albums: EchoAlbum[] };
  scenePortals: Array<{ scene: string; adjacentTo: string; why: string; gatewayAlbum: EchoAlbum }>;
  tasteForks: { archetypePattern: string; yourDivergence: string; albums: EchoAlbum[] };
  nextObsession: { prediction: string; reasoning: string; entryPoint: EchoAlbum | null };
  _context?: {
    sonicCoherence?:      SignalCtx | null;
    canonObscurity?:      SignalCtx | null;
    labelLoyalty?:        SignalCtx | null;
    artistConcentration?: SignalCtx | null;
    transgressiveIndex?:  SignalCtx | null;
    acquisitionRhythm?:   SignalCtx | null;
    digitalDivergence?:   SignalCtx | null;
    shadow?:              string | null;
    namedPairing?:        string | null;
  };
  cached?: boolean;
}

// ── Shared pieces ─────────────────────────────────────────────────────────────

function ModuleHeader({ number, title }: { number: string; title: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
      <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.18em", color: "rgba(10,10,10,0.28)" }}>{number}</span>
      <span style={{ fontFamily: MONO, fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: INK, fontWeight: 500 }}>{title}</span>
      <div style={{ flex: 1, height: 1, background: RULE }} />
    </div>
  );
}

function ArtSquare({ album, size = 88 }: { album: EchoAlbum; size?: number }) {
  return album.imageUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={album.imageUrl}
      alt={album.title}
      style={{ width: size, height: size, objectFit: "cover", display: "block", flexShrink: 0 }}
    />
  ) : (
    <div style={{
      width: size, height: size, flexShrink: 0,
      background: WARM, border: `1px solid ${RULE}`,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <span style={{ fontFamily: SERIF, fontSize: size * 0.28, color: ORANGE }}>ō</span>
    </div>
  );
}

function AlbumMeta({ album, muted = false }: { album: EchoAlbum; muted?: boolean }) {
  return (
    <div>
      <div style={{ fontFamily: SERIF, fontSize: "0.95rem", color: muted ? MUTED : INK, letterSpacing: "-0.01em", lineHeight: 1.2, marginBottom: 3 }}>
        {album.title}
      </div>
      <div style={{ fontFamily: MONO, fontSize: "0.68rem", color: MUTED, letterSpacing: "0.04em", marginBottom: album.why ? 5 : 0 }}>
        {album.artist}{album.year ? ` · ${album.year}` : ""}
      </div>
      {album.why && (
        <div style={{ fontFamily: MONO, fontSize: "0.7rem", color: MUTED, letterSpacing: "0.02em", lineHeight: 1.55 }}>
          {album.why}
        </div>
      )}
    </div>
  );
}

// Small archetype signal tag shown under each module header
function SignalTag({ label }: { label: string }) {
  return (
    <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: ORANGE, marginBottom: 14, marginTop: -8 }}>
      {label}
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Pulse({ w = "100%", h }: { w?: string | number; h: number }) {
  return <div style={{ width: w, height: h, background: "#ede9e4", animation: "echoes-pulse 1.5s ease-in-out infinite", marginBottom: 8 }} />;
}

function EchoesSkeleton() {
  return (
    <div>
      <style>{`@keyframes echoes-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} style={{ marginBottom: 48 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <Pulse w={20} h={8} />
            <Pulse w={100} h={8} />
            <div style={{ flex: 1, height: 1, background: RULE }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            {[1, 2, 3, 4].map(j => (
              <div key={j}>
                <Pulse h={88} />
                <Pulse w="70%" h={11} />
                <Pulse w="55%" h={9} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── 01 Missing Middle ─────────────────────────────────────────────────────────

function MissingMiddle({ data, ctx }: { data: EchoesData["missingMiddle"]; ctx?: EchoesData["_context"] }) {
  const sc = ctx?.sonicCoherence;
  const ac = ctx?.artistConcentration;
  const tag = sc?.label ? `Sonic Coherence: ${sc.label}${ac?.label ? ` · Artist Concentration: ${ac.label}` : ""}` : undefined;
  return (
    <div style={{ marginBottom: 48 }}>
      <ModuleHeader number="01" title="Missing Middle" />
      {tag && <SignalTag label={tag} />}

      {/* Cluster connector — stacked so long labels never overflow */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 0 }}>
          <div style={{ fontFamily: MONO, fontSize: "0.6rem", letterSpacing: "0.1em", textTransform: "uppercase", background: INK, color: "#fff", padding: "3px 8px" }}>
            {data.clusterA}
          </div>
          <div style={{ flex: 1, height: 1, background: RULE }} />
          <div style={{ fontFamily: MONO, fontSize: "0.6rem", letterSpacing: "0.1em", textTransform: "uppercase", background: INK, color: "#fff", padding: "3px 8px" }}>
            {data.clusterB}
          </div>
        </div>
        <div style={{ fontFamily: MONO, fontSize: "0.62rem", color: MUTED, letterSpacing: "0.03em", lineHeight: 1.6, padding: "8px 0 0" }}>
          {data.bridge}
        </div>
      </div>

      <div className="echoes-grid-4" style={{ display: "grid", gap: 16 }}>
        {data.albums?.map((album, i) => (
          <div key={i}>
            <ArtSquare album={album} />
            <div style={{ marginTop: 8 }}>
              <AlbumMeta album={album} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 02 Unbought Classic ───────────────────────────────────────────────────────

function UnboughtClassic({ data, ctx }: { data: EchoesData["unboughtClassic"]; ctx?: EchoesData["_context"] }) {
  const co = ctx?.canonObscurity;
  const tag = co?.label ? `Canon Obscurity: ${co.label}` : undefined;
  return (
    <div style={{ marginBottom: 48 }}>
      <ModuleHeader number="02" title="Unbought Classic" />
      {tag && <SignalTag label={tag} />}

      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 16 }}>
        <span style={{ fontFamily: SERIF, fontSize: "1rem", color: INK, letterSpacing: "-0.01em" }}>
          {data.scene}
        </span>
        <span style={{ fontFamily: MONO, fontSize: "0.7rem", color: MUTED, letterSpacing: "0.02em" }}>
          {data.intro}
        </span>
      </div>

      <div className="echoes-grid-4" style={{ display: "grid", gap: 16 }}>
        {data.albums?.map((album, i) => (
          <div key={i}>
            <ArtSquare album={album} />
            <div style={{ marginTop: 8 }}>
              <AlbumMeta album={album} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 03 Scene Portals ──────────────────────────────────────────────────────────

function ScenePortals({ data, ctx }: { data: EchoesData["scenePortals"]; ctx?: EchoesData["_context"] }) {
  const ll = ctx?.labelLoyalty;
  const dd = ctx?.digitalDivergence;
  const parts = [ll?.label && `Label Loyalty: ${ll.label}`, dd?.label && `Digital Divergence: ${dd.label}`].filter(Boolean);
  const tag = parts.length ? parts.join(" · ") : undefined;
  const portal = data?.[0];
  if (!portal) return null;
  return (
    <div style={{ marginBottom: 48 }}>
      <ModuleHeader number="03" title="Scene Portals" />
      {tag && <SignalTag label={tag} />}

      <div style={{ background: "#fff", border: `1px solid ${RULE}`, padding: "18px 18px 20px" }}>
        <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: ORANGE, marginBottom: 10 }}>
          Next door
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 12 }}>
          <ArtSquare album={portal.gatewayAlbum} size={72} />
          <div>
            <div style={{ fontFamily: SERIF, fontSize: "0.95rem", color: INK, letterSpacing: "-0.01em", lineHeight: 1.2, marginBottom: 4 }}>
              {portal.scene}
            </div>
            <div style={{ fontFamily: MONO, fontSize: "0.66rem", color: MUTED, letterSpacing: "0.04em", marginBottom: 8 }}>
              Adjacent to: {portal.adjacentTo}
            </div>
            <div style={{ fontFamily: MONO, fontSize: "0.7rem", color: MUTED, letterSpacing: "0.02em", lineHeight: 1.6 }}>
              {portal.why}
            </div>
          </div>
        </div>
        <div style={{ borderTop: `1px solid ${RULE}`, paddingTop: 10 }}>
          <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(10,10,10,0.28)", marginBottom: 4 }}>
            Gateway
          </div>
          <AlbumMeta album={portal.gatewayAlbum} />
        </div>
      </div>
    </div>
  );
}

// ── 04 Taste Forks ───────────────────────────────────────────────────────────

function TasteForks({ data, ctx }: { data: EchoesData["tasteForks"]; ctx?: EchoesData["_context"] }) {
  const shadow = ctx?.shadow;
  const tag = shadow ? `Shadow: ${shadow.charAt(0).toUpperCase() + shadow.slice(1)}` : undefined;
  return (
    <div style={{ marginBottom: 48 }}>
      <ModuleHeader number="04" title="Taste Forks" />
      {tag && <SignalTag label={tag} />}

      {/* Pattern vs. divergence */}
      <div className="echoes-fork-header" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: RULE, marginBottom: 20 }}>
        <div style={{ background: "#fff", padding: "16px 18px 18px" }}>
          <div style={{ fontFamily: MONO, fontSize: 8, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(10,10,10,0.3)", marginBottom: 10 }}>The pattern</div>
          <div style={{ fontFamily: SERIF, fontSize: "0.95rem", color: MUTED, letterSpacing: "-0.01em", lineHeight: 1.45 }}>{data.archetypePattern}</div>
        </div>
        <div style={{ background: WARM, padding: "16px 18px 18px" }}>
          <div style={{ fontFamily: MONO, fontSize: 8, letterSpacing: "0.18em", textTransform: "uppercase", color: ORANGE, marginBottom: 10 }}>Your path</div>
          <div style={{ fontFamily: SERIF, fontSize: "0.95rem", color: INK, letterSpacing: "-0.01em", lineHeight: 1.45 }}>{data.yourDivergence}</div>
        </div>
      </div>

      {/* Road not taken albums */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {data.albums?.map((album, i) => (
          <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <ArtSquare album={album} size={72} />
            <div style={{ paddingTop: 2 }}>
              <div style={{ fontFamily: MONO, fontSize: 9, color: ORANGE, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 5 }}>
                Road not taken
              </div>
              <AlbumMeta album={album} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 05 Next Obsession ─────────────────────────────────────────────────────────

function NextObsession({ data, ctx }: { data: EchoesData["nextObsession"]; ctx?: EchoesData["_context"] }) {
  const ar = ctx?.acquisitionRhythm;
  const shadow = ctx?.shadow;
  const parts = [ar?.rhythmType && `Rhythm: ${ar.rhythmType}`, shadow && `Shadow: ${shadow.charAt(0).toUpperCase() + shadow.slice(1)}`].filter(Boolean);
  const tag = parts.length ? parts.join(" · ") : undefined;
  return (
    <div style={{ marginBottom: 48 }}>
      <ModuleHeader number="05" title="Next Obsession" />
      {tag && <SignalTag label={tag} />}

      <div style={{ background: INK, padding: "24px 24px 22px" }}>
        <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
          {/* Album art */}
          {data.entryPoint && (
            <div style={{ flexShrink: 0 }}>
              {data.entryPoint.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={data.entryPoint.imageUrl}
                  alt={data.entryPoint.title}
                  style={{ width: 110, height: 110, objectFit: "cover", display: "block" }}
                />
              ) : (
                <div style={{ width: 110, height: 110, background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontFamily: SERIF, fontSize: 36, color: ORANGE }}>ō</span>
                </div>
              )}
            </div>
          )}

          {/* Text */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: ORANGE, marginBottom: 10 }}>
              Incoming
            </div>
            <h2 style={{ fontFamily: SERIF, fontSize: "1.5rem", fontWeight: 400, color: "#fff", margin: "0 0 12px", letterSpacing: "-0.02em", lineHeight: 1.15 }}>
              {data.prediction}
            </h2>
            <p style={{ fontFamily: MONO, fontSize: "0.72rem", color: "rgba(255,255,255,0.55)", letterSpacing: "0.02em", lineHeight: 1.75, margin: "0 0 16px" }}>
              {data.reasoning}
            </p>
            {data.entryPoint && (
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 12 }}>
                <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.28)", marginBottom: 5 }}>
                  Entry point
                </div>
                <div style={{ fontFamily: SERIF, fontSize: "0.95rem", color: "#fff", letterSpacing: "-0.01em", marginBottom: 2 }}>
                  {data.entryPoint.title}
                </div>
                <div style={{ fontFamily: MONO, fontSize: "0.68rem", color: "rgba(255,255,255,0.4)", letterSpacing: "0.04em" }}>
                  {data.entryPoint.artist}{data.entryPoint.year ? ` · ${data.entryPoint.year}` : ""}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

function extractAlbums(d: EchoesData): { artist: string; title: string }[] {
  return [
    ...(d.missingMiddle?.albums     ?? []),
    ...(d.unboughtClassic?.albums   ?? []),
    ...((d.scenePortals ?? []).map(p => p.gatewayAlbum).filter(Boolean)),
    ...(d.tasteForks?.albums        ?? []),
    ...(d.nextObsession?.entryPoint ? [d.nextObsession.entryPoint] : []),
  ].map(a => ({ artist: a.artist, title: a.title }));
}

function applyArtworkAndValidation(
  d: EchoesData,
  images: Record<string, string>,
  notFound: string[]
): EchoesData {
  const badKeys = new Set(notFound);
  const albumKey = (a: EchoAlbum) => `${a.artist}|${a.title}`;

  const fill = (a: EchoAlbum | null | undefined): EchoAlbum | null | undefined => {
    if (!a) return a;
    return { ...a, imageUrl: images[albumKey(a)] ?? a.imageUrl };
  };
  const keep = (a: EchoAlbum) => !badKeys.has(albumKey(a));
  const keepPortal = (p: EchoesData["scenePortals"][number]) =>
    !p.gatewayAlbum || !badKeys.has(albumKey(p.gatewayAlbum));

  return {
    ...d,
    missingMiddle:   d.missingMiddle   ? { ...d.missingMiddle,   albums: d.missingMiddle.albums.filter(keep).map(a => fill(a)!)   } : d.missingMiddle,
    unboughtClassic: d.unboughtClassic ? { ...d.unboughtClassic, albums: d.unboughtClassic.albums.filter(keep).map(a => fill(a)!) } : d.unboughtClassic,
    tasteForks:      d.tasteForks      ? { ...d.tasteForks,      albums: d.tasteForks.albums.filter(keep).map(a => fill(a)!)      } : d.tasteForks,
    scenePortals:    (d.scenePortals   ?? []).filter(keepPortal).map(p => ({ ...p, gatewayAlbum: fill(p.gatewayAlbum)! })),
    nextObsession:   d.nextObsession
      ? {
          ...d.nextObsession,
          entryPoint: d.nextObsession.entryPoint && !badKeys.has(albumKey(d.nextObsession.entryPoint))
            ? fill(d.nextObsession.entryPoint) as EchoAlbum
            : null,
        }
      : d.nextObsession,
  };
}

export default function EchoesClient({ userId: _userId }: { userId: string }) {
  const [data, setData]           = useState<EchoesData | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [regenerating, setRegen]  = useState(false);

  async function fetchArtwork(d: EchoesData) {
    const albums = extractAlbums(d);
    if (albums.length === 0) return;
    try {
      const res = await fetch("/api/echoes/artwork", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ albums }),
      });
      if (!res.ok) {
        console.error("[Echoes] artwork route failed:", res.status);
        return;
      }
      const { images, notFound } = await res.json() as { images: Record<string, string>; notFound: string[] };
      if (notFound.length > 0) console.log("[Echoes] not found on Discogs:", notFound);
      setData(prev => prev ? applyArtworkAndValidation(prev, images, notFound) : prev);
    } catch (e) {
      console.error("[Echoes] artwork error:", e);
    }
  }

  function load() {
    setLoading(true);
    setError(null);
    fetch("/api/echoes")
      .then(async r => {
        if (r.status === 412) throw new Error("archetypes_required");
        if (!r.ok) throw new Error("failed");
        return r.json() as Promise<EchoesData>;
      })
      .then(d => { setData(d); fetchArtwork(d); })
      .catch(e => setError(e instanceof Error ? e.message : "failed"))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleRegenerate() {
    setRegen(true);
    try {
      const r = await fetch("/api/echoes", { method: "POST" });
      if (r.ok) {
        const d = await r.json() as EchoesData;
        setData(d);
        fetchArtwork(d);
      }
    } catch {}
    setRegen(false);
  }

  return (
    <div style={{ padding: "28px 0 80px" }}>
      <style>{`
        @keyframes echoes-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .echoes-grid-4 { grid-template-columns: repeat(4, 1fr); }
        @media (max-width: 600px) {
          .echoes-grid-4      { grid-template-columns: repeat(2, 1fr) !important; }
          .echoes-fork-header { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 36 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontFamily: SERIF, fontSize: "1.8rem", fontWeight: 400, color: INK, letterSpacing: "-0.02em" }}>
            Echoes
          </span>
          {data?.cached && (
            <span style={{ fontFamily: MONO, fontSize: 7, letterSpacing: "0.14em", color: "rgba(10,10,10,0.28)" }}>CACHED</span>
          )}
        </div>
        {!loading && data && (
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            style={{ fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase", color: regenerating ? MUTED : ORANGE, background: "none", border: "none", cursor: regenerating ? "default" : "pointer", padding: 0 }}
          >
            {regenerating ? "Regenerating…" : "Regenerate"}
          </button>
        )}
      </div>

      {/* States */}
      {loading && <EchoesSkeleton />}

      {!loading && error === "archetypes_required" && (
        <div style={{ padding: "60px 0", textAlign: "center" }}>
          <p style={{ fontFamily: MONO, fontSize: "0.72rem", color: MUTED, letterSpacing: "0.04em" }}>
            Generate your Archetype profile first — Echoes builds on top of it.
          </p>
        </div>
      )}

      {!loading && error && error !== "archetypes_required" && (
        <div style={{ padding: "60px 0", textAlign: "center" }}>
          <p style={{ fontFamily: MONO, fontSize: "0.72rem", color: MUTED, letterSpacing: "0.04em" }}>
            Failed to generate.{" "}
            <button onClick={load} style={{ fontFamily: MONO, fontSize: "0.72rem", color: ORANGE, background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "underline" }}>
              Try again
            </button>
          </p>
        </div>
      )}

      {!loading && data && (
        <>
          {data.missingMiddle   && <MissingMiddle   data={data.missingMiddle}   ctx={data._context} />}
          {data.unboughtClassic && <UnboughtClassic data={data.unboughtClassic} ctx={data._context} />}
          {data.scenePortals    && <ScenePortals    data={data.scenePortals}    ctx={data._context} />}
          {data.tasteForks      && <TasteForks      data={data.tasteForks}      ctx={data._context} />}
          {data.nextObsession   && <NextObsession   data={data.nextObsession}   ctx={data._context} />}
        </>
      )}
    </div>
  );
}
