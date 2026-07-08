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
  year: number;
  why: string;
  imageUrl?: string;
}

interface EchoesData {
  missingMiddle: { clusterA: string; clusterB: string; bridge: string; albums: EchoAlbum[] };
  unboughtClassic: { scene: string; intro: string; albums: EchoAlbum[] };
  scenePortals: Array<{ scene: string; adjacentTo: string; why: string; gatewayAlbum: EchoAlbum }>;
  tasteForks: { archetypePattern: string; yourDivergence: string; albums: EchoAlbum[] };
  nextObsession: { prediction: string; reasoning: string; entryPoint: EchoAlbum };
  cached?: boolean;
}

// ── Shared pieces ─────────────────────────────────────────────────────────────

function ModuleHeader({ number, title }: { number: string; title: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
      <span style={{ fontFamily: MONO, fontSize: 8, letterSpacing: "0.22em", color: "rgba(10,10,10,0.28)" }}>{number}</span>
      <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: INK }}>{title}</span>
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
      <div style={{ fontFamily: SERIF, fontSize: "0.88rem", color: muted ? MUTED : INK, letterSpacing: "-0.01em", lineHeight: 1.2, marginBottom: 3 }}>
        {album.title}
      </div>
      <div style={{ fontFamily: MONO, fontSize: "0.6rem", color: MUTED, letterSpacing: "0.06em", marginBottom: album.why ? 5 : 0 }}>
        {album.artist} · {album.year}
      </div>
      {album.why && (
        <div style={{ fontFamily: MONO, fontSize: "0.62rem", color: MUTED, letterSpacing: "0.03em", lineHeight: 1.55 }}>
          {album.why}
        </div>
      )}
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

function MissingMiddle({ data }: { data: EchoesData["missingMiddle"] }) {
  return (
    <div style={{ marginBottom: 48 }}>
      <ModuleHeader number="01" title="Missing Middle" />

      {/* Cluster connector */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: 16, gap: 0 }}>
        <div style={{ fontFamily: MONO, fontSize: "0.6rem", letterSpacing: "0.1em", textTransform: "uppercase", background: INK, color: "#fff", padding: "3px 8px", flexShrink: 0 }}>
          {data.clusterA}
        </div>
        <div style={{ flex: 1, height: 1, background: RULE }} />
        <div style={{ fontFamily: MONO, fontSize: "0.58rem", color: MUTED, padding: "0 10px", flexShrink: 0 }}>
          {data.bridge}
        </div>
        <div style={{ flex: 1, height: 1, background: RULE }} />
        <div style={{ fontFamily: MONO, fontSize: "0.6rem", letterSpacing: "0.1em", textTransform: "uppercase", background: INK, color: "#fff", padding: "3px 8px", flexShrink: 0 }}>
          {data.clusterB}
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

function UnboughtClassic({ data }: { data: EchoesData["unboughtClassic"] }) {
  return (
    <div style={{ marginBottom: 48 }}>
      <ModuleHeader number="02" title="Unbought Classic" />

      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 16 }}>
        <span style={{ fontFamily: SERIF, fontSize: "1rem", color: INK, letterSpacing: "-0.01em" }}>
          {data.scene}
        </span>
        <span style={{ fontFamily: MONO, fontSize: "0.63rem", color: MUTED, letterSpacing: "0.03em" }}>
          — {data.intro}
        </span>
      </div>

      <div className="echoes-grid-4" style={{ display: "grid", gap: 16 }}>
        {data.albums?.map((album, i) => (
          <div key={i}>
            <div style={{ position: "relative" }}>
              <ArtSquare album={album} />
              {/* Checkbox overlay */}
              <div style={{
                position: "absolute", top: 6, right: 6,
                width: 16, height: 16,
                background: "rgba(255,255,255,0.88)",
                border: `1.5px solid ${INK}`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <span style={{ fontFamily: MONO, fontSize: 9, color: "rgba(10,10,10,0.18)" }}>□</span>
              </div>
            </div>
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

function ScenePortals({ data }: { data: EchoesData["scenePortals"] }) {
  return (
    <div style={{ marginBottom: 48 }}>
      <ModuleHeader number="03" title="Scene Portals" />

      <div className="echoes-portals" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: RULE }}>
        {data?.map((portal, i) => (
          <div key={i} style={{ background: "#fff", padding: "18px 18px 20px" }}>
            <div style={{ fontFamily: MONO, fontSize: 7, letterSpacing: "0.2em", textTransform: "uppercase", color: ORANGE, marginBottom: 10 }}>
              {i === 0 ? "Next door" : "Left turn"}
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 12 }}>
              <ArtSquare album={portal.gatewayAlbum} size={72} />
              <div>
                <div style={{ fontFamily: SERIF, fontSize: "0.95rem", color: INK, letterSpacing: "-0.01em", lineHeight: 1.2, marginBottom: 4 }}>
                  {portal.scene}
                </div>
                <div style={{ fontFamily: MONO, fontSize: "0.58rem", color: MUTED, letterSpacing: "0.06em", marginBottom: 8 }}>
                  Adjacent to: {portal.adjacentTo}
                </div>
                <div style={{ fontFamily: MONO, fontSize: "0.63rem", color: MUTED, letterSpacing: "0.03em", lineHeight: 1.6 }}>
                  {portal.why}
                </div>
              </div>
            </div>
            <div style={{ borderTop: `1px solid ${RULE}`, paddingTop: 10 }}>
              <div style={{ fontFamily: MONO, fontSize: 7, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(10,10,10,0.28)", marginBottom: 4 }}>
                Gateway
              </div>
              <AlbumMeta album={portal.gatewayAlbum} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 04 Taste Forks ───────────────────────────────────────────────────────────

function TasteForks({ data }: { data: EchoesData["tasteForks"] }) {
  return (
    <div style={{ marginBottom: 48 }}>
      <ModuleHeader number="04" title="Taste Forks" />

      {/* Pattern vs. divergence — one line each */}
      <div className="echoes-fork-header" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: RULE, marginBottom: 20 }}>
        <div style={{ background: "#fff", padding: "10px 14px" }}>
          <div style={{ fontFamily: MONO, fontSize: 7, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(10,10,10,0.3)", marginBottom: 5 }}>The pattern</div>
          <div style={{ fontFamily: MONO, fontSize: "0.65rem", color: MUTED, letterSpacing: "0.03em", lineHeight: 1.6 }}>{data.archetypePattern}</div>
        </div>
        <div style={{ background: WARM, padding: "10px 14px" }}>
          <div style={{ fontFamily: MONO, fontSize: 7, letterSpacing: "0.18em", textTransform: "uppercase", color: ORANGE, marginBottom: 5 }}>Your path</div>
          <div style={{ fontFamily: MONO, fontSize: "0.65rem", color: INK, letterSpacing: "0.03em", lineHeight: 1.6 }}>{data.yourDivergence}</div>
        </div>
      </div>

      {/* Road not taken albums */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {data.albums?.map((album, i) => (
          <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <ArtSquare album={album} size={72} />
            <div style={{ paddingTop: 2 }}>
              <div style={{ fontFamily: MONO, fontSize: 7, color: ORANGE, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 5 }}>
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

function NextObsession({ data }: { data: EchoesData["nextObsession"] }) {
  return (
    <div style={{ marginBottom: 48 }}>
      <ModuleHeader number="05" title="Next Obsession" />

      <div style={{ background: INK, padding: "24px 24px 22px" }}>
        <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
          {/* Album art */}
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

          {/* Text */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: MONO, fontSize: 7, letterSpacing: "0.22em", textTransform: "uppercase", color: ORANGE, marginBottom: 10 }}>
              Incoming
            </div>
            <h2 style={{ fontFamily: SERIF, fontSize: "1.5rem", fontWeight: 400, color: "#fff", margin: "0 0 12px", letterSpacing: "-0.02em", lineHeight: 1.15 }}>
              {data.prediction}
            </h2>
            <p style={{ fontFamily: MONO, fontSize: "0.65rem", color: "rgba(255,255,255,0.55)", letterSpacing: "0.03em", lineHeight: 1.75, margin: "0 0 16px" }}>
              {data.reasoning}
            </p>
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 12 }}>
              <div style={{ fontFamily: MONO, fontSize: 7, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.28)", marginBottom: 5 }}>
                Entry point
              </div>
              <div style={{ fontFamily: SERIF, fontSize: "0.88rem", color: "#fff", letterSpacing: "-0.01em", marginBottom: 2 }}>
                {data.entryPoint.title}
              </div>
              <div style={{ fontFamily: MONO, fontSize: "0.6rem", color: "rgba(255,255,255,0.4)", letterSpacing: "0.06em" }}>
                {data.entryPoint.artist} · {data.entryPoint.year}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function EchoesClient({ userId: _userId }: { userId: string }) {
  const [data, setData]           = useState<EchoesData | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [regenerating, setRegen]  = useState(false);

  function load() {
    setLoading(true);
    setError(null);
    fetch("/api/echoes")
      .then(async r => {
        if (r.status === 412) throw new Error("archetypes_required");
        if (!r.ok) throw new Error("failed");
        return r.json() as Promise<EchoesData>;
      })
      .then(d => setData(d))
      .catch(e => setError(e instanceof Error ? e.message : "failed"))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleRegenerate() {
    setRegen(true);
    try {
      const r = await fetch("/api/echoes", { method: "POST" });
      if (r.ok) setData(await r.json() as EchoesData);
    } catch {}
    setRegen(false);
  }

  return (
    <div style={{ padding: "28px 0 80px" }}>
      <style>{`
        @keyframes echoes-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .echoes-grid-4 { grid-template-columns: repeat(4, 1fr); }
        @media (max-width: 600px) {
          .echoes-grid-4    { grid-template-columns: repeat(2, 1fr) !important; }
          .echoes-portals   { grid-template-columns: 1fr !important; }
          .echoes-fork-header { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 36 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontFamily: SERIF, fontSize: "1.4rem", fontWeight: 400, color: INK, letterSpacing: "-0.02em" }}>
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
          {data.missingMiddle   && <MissingMiddle   data={data.missingMiddle} />}
          {data.unboughtClassic && <UnboughtClassic data={data.unboughtClassic} />}
          {data.scenePortals    && <ScenePortals    data={data.scenePortals} />}
          {data.tasteForks      && <TasteForks      data={data.tasteForks} />}
          {data.nextObsession   && <NextObsession   data={data.nextObsession} />}
        </>
      )}
    </div>
  );
}
