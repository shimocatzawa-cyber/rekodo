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
}

interface EchoesData {
  missingMiddle: {
    clusterA: string;
    clusterB: string;
    bridge: string;
    albums: EchoAlbum[];
  };
  unboughtClassic: {
    scene: string;
    intro: string;
    albums: EchoAlbum[];
  };
  scenePortals: Array<{
    scene: string;
    adjacentTo: string;
    why: string;
    gatewayAlbum: EchoAlbum;
  }>;
  tasteForks: {
    archetypePattern: string;
    yourDivergence: string;
    albums: EchoAlbum[];
  };
  nextObsession: {
    prediction: string;
    reasoning: string;
    entryPoint: EchoAlbum;
  };
  cached?: boolean;
}

// ── Shared components ─────────────────────────────────────────────────────────

function ModuleHeader({ number, title }: { number: string; title: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
      <span style={{ fontFamily: MONO, fontSize: 8, letterSpacing: "0.22em", color: "rgba(10,10,10,0.28)", flexShrink: 0 }}>
        {number}
      </span>
      <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: INK, flexShrink: 0 }}>
        {title}
      </span>
      <div style={{ flex: 1, height: "1px", background: RULE }} />
    </div>
  );
}

function AlbumLine({ album, variant = "default" }: { album: EchoAlbum; variant?: "default" | "checklist" | "fork" }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        {variant === "checklist" && (
          <span style={{ fontFamily: MONO, fontSize: 11, color: "rgba(10,10,10,0.25)", flexShrink: 0, marginTop: 1 }}>□</span>
        )}
        {variant === "fork" && (
          <span style={{ fontFamily: MONO, fontSize: 11, color: ORANGE, flexShrink: 0 }}>↳</span>
        )}
        <span style={{ fontFamily: SERIF, fontSize: "1rem", fontWeight: 400, color: INK, letterSpacing: "-0.01em" }}>
          {album.title}
        </span>
        <span style={{ fontFamily: MONO, fontSize: "0.65rem", color: MUTED, letterSpacing: "0.04em", flexShrink: 0 }}>
          {album.artist} · {album.year}
        </span>
      </div>
      <p style={{ fontFamily: MONO, fontSize: "0.68rem", color: MUTED, letterSpacing: "0.04em", lineHeight: 1.7, margin: "4px 0 0", paddingLeft: variant !== "default" ? 20 : 0 }}>
        {album.why}
      </p>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonPulse({ height, width = "100%", style }: { height: number; width?: string | number; style?: React.CSSProperties }) {
  return (
    <div style={{
      height,
      width,
      background: "#ede9e4",
      animation: "pulse 1.5s ease-in-out infinite",
      ...style,
    }} />
  );
}

function EchoesSkeleton() {
  return (
    <div>
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} style={{ marginBottom: 52 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <SkeletonPulse height={8} width={20} />
            <SkeletonPulse height={8} width={120} />
            <div style={{ flex: 1, height: 1, background: RULE }} />
          </div>
          <SkeletonPulse height={22} width="60%" style={{ marginBottom: 10 }} />
          <SkeletonPulse height={14} style={{ marginBottom: 6 }} />
          <SkeletonPulse height={14} width="85%" style={{ marginBottom: 16 }} />
          <SkeletonPulse height={18} width="50%" style={{ marginBottom: 6 }} />
          <SkeletonPulse height={14} width="80%" style={{ marginBottom: 6 }} />
          <SkeletonPulse height={18} width="55%" style={{ marginBottom: 6 }} />
          <SkeletonPulse height={14} width="75%" />
        </div>
      ))}
    </div>
  );
}

// ── Module 1: Missing Middle ──────────────────────────────────────────────────

function MissingMiddle({ data }: { data: EchoesData["missingMiddle"] }) {
  return (
    <div style={{ marginBottom: 52 }}>
      <ModuleHeader number="01" title="Missing Middle" />

      {/* Cluster connector */}
      <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 18 }}>
        <div style={{
          fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase",
          background: INK, color: "#fff", padding: "4px 10px",
        }}>
          {data.clusterA}
        </div>
        <div style={{ flex: 1, position: "relative", height: 1, background: RULE, margin: "0 -1px" }}>
          <div style={{
            position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
            background: "#fff", padding: "0 8px",
            fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: "0.1em",
          }}>
            ·····
          </div>
        </div>
        <div style={{
          fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase",
          background: INK, color: "#fff", padding: "4px 10px",
        }}>
          {data.clusterB}
        </div>
      </div>

      <p style={{ fontFamily: MONO, fontSize: "0.72rem", color: MUTED, letterSpacing: "0.04em", lineHeight: 1.75, margin: "0 0 20px" }}>
        {data.bridge}
      </p>

      <div>
        {data.albums?.map((album, i) => (
          <AlbumLine key={i} album={album} />
        ))}
      </div>
    </div>
  );
}

// ── Module 2: Unbought Classic ────────────────────────────────────────────────

function UnboughtClassic({ data }: { data: EchoesData["unboughtClassic"] }) {
  return (
    <div style={{ marginBottom: 52 }}>
      <ModuleHeader number="02" title="Unbought Classic" />

      <div style={{
        background: WARM, borderLeft: `2px solid ${INK}`,
        padding: "14px 20px", marginBottom: 20,
      }}>
        <div style={{ fontFamily: SERIF, fontSize: "1.1rem", fontWeight: 400, color: INK, marginBottom: 6, letterSpacing: "-0.01em" }}>
          {data.scene}
        </div>
        <p style={{ fontFamily: MONO, fontSize: "0.68rem", color: MUTED, letterSpacing: "0.04em", lineHeight: 1.7, margin: 0 }}>
          {data.intro}
        </p>
      </div>

      <div>
        {data.albums?.map((album, i) => (
          <AlbumLine key={i} album={album} variant="checklist" />
        ))}
      </div>
    </div>
  );
}

// ── Module 3: Scene Portals ───────────────────────────────────────────────────

function ScenePortals({ data }: { data: EchoesData["scenePortals"] }) {
  return (
    <div style={{ marginBottom: 52 }}>
      <ModuleHeader number="03" title="Scene Portals" />

      <div className="echoes-portals" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: RULE }}>
        {data?.map((portal, i) => (
          <div key={i} style={{ background: "#fff", padding: "20px 22px" }}>
            <div style={{ fontFamily: MONO, fontSize: 8, letterSpacing: "0.18em", textTransform: "uppercase", color: ORANGE, marginBottom: 10 }}>
              {i === 0 ? "Next door" : "Left turn"}
            </div>
            <div style={{ fontFamily: SERIF, fontSize: "1.05rem", fontWeight: 400, color: INK, marginBottom: 4, letterSpacing: "-0.01em", lineHeight: 1.2 }}>
              {portal.scene}
            </div>
            <div style={{ fontFamily: MONO, fontSize: "0.62rem", color: MUTED, letterSpacing: "0.06em", marginBottom: 12 }}>
              Adjacent to: {portal.adjacentTo}
            </div>
            <p style={{ fontFamily: MONO, fontSize: "0.68rem", color: MUTED, letterSpacing: "0.04em", lineHeight: 1.7, margin: "0 0 16px" }}>
              {portal.why}
            </p>
            <div style={{ borderTop: `1px solid ${RULE}`, paddingTop: 12 }}>
              <div style={{ fontFamily: MONO, fontSize: 8, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(10,10,10,0.3)", marginBottom: 6 }}>
                Gateway
              </div>
              <div style={{ fontFamily: SERIF, fontSize: "0.9rem", color: INK, letterSpacing: "-0.01em", marginBottom: 2 }}>
                {portal.gatewayAlbum.title}
              </div>
              <div style={{ fontFamily: MONO, fontSize: "0.62rem", color: MUTED, letterSpacing: "0.04em", marginBottom: 6 }}>
                {portal.gatewayAlbum.artist} · {portal.gatewayAlbum.year}
              </div>
              <p style={{ fontFamily: MONO, fontSize: "0.65rem", color: MUTED, letterSpacing: "0.04em", lineHeight: 1.65, margin: 0 }}>
                {portal.gatewayAlbum.why}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Module 4: Taste Forks ─────────────────────────────────────────────────────

function TasteForks({ data }: { data: EchoesData["tasteForks"] }) {
  return (
    <div style={{ marginBottom: 52 }}>
      <ModuleHeader number="04" title="Taste Forks" />

      <div className="echoes-fork" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: RULE, marginBottom: 24 }}>
        <div style={{ background: "#fff", padding: "16px 20px" }}>
          <div style={{ fontFamily: MONO, fontSize: 8, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(10,10,10,0.3)", marginBottom: 8 }}>
            The pattern
          </div>
          <p style={{ fontFamily: MONO, fontSize: "0.7rem", color: MUTED, letterSpacing: "0.04em", lineHeight: 1.75, margin: 0 }}>
            {data.archetypePattern}
          </p>
        </div>
        <div style={{ background: WARM, padding: "16px 20px" }}>
          <div style={{ fontFamily: MONO, fontSize: 8, letterSpacing: "0.18em", textTransform: "uppercase", color: ORANGE, marginBottom: 8 }}>
            Your path
          </div>
          <p style={{ fontFamily: MONO, fontSize: "0.7rem", color: INK, letterSpacing: "0.04em", lineHeight: 1.75, margin: 0 }}>
            {data.yourDivergence}
          </p>
        </div>
      </div>

      <div style={{ fontFamily: MONO, fontSize: 8, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(10,10,10,0.3)", marginBottom: 12 }}>
        Roads not taken
      </div>
      <div>
        {data.albums?.map((album, i) => (
          <AlbumLine key={i} album={album} variant="fork" />
        ))}
      </div>
    </div>
  );
}

// ── Module 5: Next Obsession ──────────────────────────────────────────────────

function NextObsession({ data }: { data: EchoesData["nextObsession"] }) {
  return (
    <div style={{ marginBottom: 52 }}>
      <ModuleHeader number="05" title="Next Obsession" />

      <div style={{ background: INK, padding: "28px 28px 24px" }}>
        <div style={{ fontFamily: MONO, fontSize: 8, letterSpacing: "0.22em", textTransform: "uppercase", color: ORANGE, marginBottom: 14 }}>
          Incoming
        </div>
        <h2 style={{ fontFamily: SERIF, fontSize: "1.7rem", fontWeight: 400, color: "#fff", margin: "0 0 16px", letterSpacing: "-0.02em", lineHeight: 1.15 }}>
          {data.prediction}
        </h2>
        <p style={{ fontFamily: MONO, fontSize: "0.7rem", color: "rgba(255,255,255,0.6)", letterSpacing: "0.04em", lineHeight: 1.8, margin: "0 0 22px" }}>
          {data.reasoning}
        </p>
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.12)", paddingTop: 18 }}>
          <div style={{ fontFamily: MONO, fontSize: 8, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>
            Entry point
          </div>
          <div style={{ fontFamily: SERIF, fontSize: "1rem", color: "#fff", letterSpacing: "-0.01em", marginBottom: 3 }}>
            {data.entryPoint.title}
          </div>
          <div style={{ fontFamily: MONO, fontSize: "0.65rem", color: "rgba(255,255,255,0.45)", letterSpacing: "0.06em", marginBottom: 8 }}>
            {data.entryPoint.artist} · {data.entryPoint.year}
          </div>
          <p style={{ fontFamily: MONO, fontSize: "0.68rem", color: "rgba(255,255,255,0.5)", letterSpacing: "0.04em", lineHeight: 1.7, margin: 0 }}>
            {data.entryPoint.why}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function EchoesClient({ userId: _userId }: { userId: string }) {
  const [data, setData] = useState<EchoesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    fetch("/api/echoes")
      .then(async r => {
        if (r.status === 412) throw new Error("archetypes_required");
        if (!r.ok) throw new Error("failed");
        return r.json() as Promise<EchoesData>;
      })
      .then(d => setData(d))
      .catch(e => setError(e instanceof Error ? e.message : "failed"))
      .finally(() => setLoading(false));
  }, []);

  async function handleRegenerate() {
    setRegenerating(true);
    try {
      const r = await fetch("/api/echoes", { method: "POST" });
      if (r.ok) setData(await r.json() as EchoesData);
    } catch {}
    setRegenerating(false);
  }

  return (
    <div style={{ padding: "32px 0 80px" }}>
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @media (max-width: 600px) {
          .echoes-portals { grid-template-columns: 1fr !important; }
          .echoes-fork    { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 40 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ flex: 1, height: 1, background: RULE, width: 40 }} />
          <span style={{ fontFamily: SERIF, fontSize: "1.5rem", fontWeight: 400, color: INK, letterSpacing: "-0.02em" }}>
            Echoes
          </span>
          {data?.cached && (
            <span style={{ fontFamily: MONO, fontSize: 8, letterSpacing: "0.14em", color: "rgba(10,10,10,0.3)" }}>
              CACHED
            </span>
          )}
        </div>
        {!loading && data && (
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            style={{
              fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase",
              color: regenerating ? MUTED : ORANGE, background: "none", border: "none",
              cursor: regenerating ? "default" : "pointer", padding: 0,
            }}
          >
            {regenerating ? "Regenerating…" : "Regenerate"}
          </button>
        )}
      </div>

      {/* States */}
      {loading && <EchoesSkeleton />}

      {!loading && error === "archetypes_required" && (
        <div style={{ padding: "60px 0", textAlign: "center" }}>
          <p style={{ fontFamily: MONO, fontSize: "0.72rem", color: MUTED, letterSpacing: "0.04em", lineHeight: 1.75 }}>
            Generate your Archetype profile first — Echoes builds on top of it.
          </p>
        </div>
      )}

      {!loading && error && error !== "archetypes_required" && (
        <div style={{ padding: "60px 0", textAlign: "center" }}>
          <p style={{ fontFamily: MONO, fontSize: "0.72rem", color: MUTED, letterSpacing: "0.04em" }}>
            Failed to generate Echoes.{" "}
            <button
              onClick={() => { setError(null); setLoading(true); fetch("/api/echoes").then(r => r.json()).then(setData).catch(() => setError("failed")).finally(() => setLoading(false)); }}
              style={{ fontFamily: MONO, fontSize: "0.72rem", color: ORANGE, background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "underline" }}
            >
              Try again
            </button>
          </p>
        </div>
      )}

      {!loading && data && (
        <>
          {data.missingMiddle && <MissingMiddle data={data.missingMiddle} />}
          {data.unboughtClassic && <UnboughtClassic data={data.unboughtClassic} />}
          {data.scenePortals && <ScenePortals data={data.scenePortals} />}
          {data.tasteForks && <TasteForks data={data.tasteForks} />}
          {data.nextObsession && <NextObsession data={data.nextObsession} />}
        </>
      )}
    </div>
  );
}
