"use client";

import { useState, useEffect } from "react";

const SERIF  = "var(--font-editorial)";
const MONO   = "var(--font-mono)";
const ORANGE = "#CC5500";
const INK    = "#0a0a0a";
const RULE   = "#e0e0da";

const DISCOGS_ARTIST_ID = "8722522";

const BIO =
  "Maria BC grew up singing mezzo-soprano in an Ohio church — a classical training that still shapes every record, present not as technique but as a discipline of space and restraint. Early recordings were built carefully, around roommates, in apartments. The debut EP Devil's Rain (2021) was recorded so as not to disturb the neighbours. That constraint became aesthetic. By Hyaline (2022, Father/Daughter Records), limitation had become language — phone recordings woven into folk arrangements, Pitchfork's album of the week. Sacred Bones signed them for Spike Field (2023): an out-of-tune baby Steinway, choral arrangements with childhood friends, nuclear-waste conceptualism beneath some of the most tender music of the year. Marathon (2026) strips production back further — foley recordings of nature and creaking West Coast homes — and finds the same sense of urgency under a deliberately quieter surface.";

type DiscRow = {
  year: string;
  title: string;
  label: string;
  note: string;
  badge: string | null;
};

const DISCOGRAPHY: DiscRow[] = [
  {
    year: "2026", title: "Marathon", label: "Sacred Bones Records",
    note: "The most immediate record yet — West Coast foley, creaking domestic spaces, thirteen tracks in 37 minutes. Endurance as form.",
    badge: "Pitchfork 7.4 · MC 78",
  },
  {
    year: "2023", title: "Spike Field", label: "Sacred Bones Records",
    note: "Named after granite thorns built around nuclear waste sites to warn future civilisations. Recorded on an out-of-tune baby Steinway. Paste gave it 9.1.",
    badge: "Pitchfork 7.8 · MC 79",
  },
  {
    year: "2022", title: "Hyaline", label: "Father/Daughter Records",
    note: "The debut. Phone recordings, sonic collage, grief through character-led accounts. Pitchfork album of the week. Stereogum agreed.",
    badge: "Pitchfork pick",
  },
  {
    year: "2021", title: "Devil's Rain EP", label: "Self-released",
    note: "The quiet beginning — recorded so as not to wake the neighbours. Title track praised by Pitchfork. Everything started here.",
    badge: null,
  },
];

type PressCell = { title: string; body: string };

const PRESSING: PressCell[] = [
  {
    title: "Spike Field — Sacred Bones, 2023",
    body: "Available on red vinyl (Sacred Bones exclusive) and standard black. The red pressing is the collector's edition — limited run. Both pressings cut from the same master.",
  },
  {
    title: "Hyaline — Father/Daughter, 2022",
    body: "The debut-label edition. Maria BC moved to Sacred Bones after this, making the F/D Hyaline the original-label pressing. Worth holding.",
  },
  {
    title: "Marathon — Sacred Bones, 2026",
    body: "First pressing still in print. Sacred Bones typically offers colour variants via their direct store. Standard black widely available. Buy direct for variant options.",
  },
  {
    title: "Devil's Rain EP — 2021",
    body: "Self-released, digital-first. Physical copies in very small quantities. The rarest item in the catalogue. If you find one on Discogs, it's the earliest document of the project.",
  },
];

type Neighbor = { tag: string; artist: string; album: string; reason: string };

const NEIGHBORS: Neighbor[] = [
  {
    tag: "Sonic neighbour", artist: "Grouper", album: "Dragging a Dead Deer Up a Hill (2008)",
    reason: "The spiritual precedent. Lo-fi home recording, voice submerged in reverb, grief worn lightly. Where Maria BC's classicism comes from, even if Grouper never trained.",
  },
  {
    tag: "Label context", artist: "Xiu Xiu", album: "Girl with Basket of Fruit (2019)",
    reason: "The Sacred Bones roster is deliberately strange. Xiu Xiu on the same label grounds the aesthetic — experimental, unflinching, made outside the mainstream.",
  },
  {
    tag: "Rabbit hole", artist: "Rachika Nayar", album: "Heaven Come Crashing (2022)",
    reason: "Maria BC appeared on this record. Nayar's ambient guitar explorations and Maria BC's vocals exist in the same emotional register. Pull this thread.",
  },
];

function SectionEyebrow({ children }: { children: string }) {
  return (
    <p style={{
      fontFamily: MONO, fontSize: "10px", letterSpacing: "0.14em",
      textTransform: "uppercase", color: ORANGE, margin: "0 0 16px", fontWeight: 400,
    }}>
      {children}
    </p>
  );
}

function ArtistPhotoPanel() {
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`https://api.discogs.com/artists/${DISCOGS_ARTIST_ID}`, {
      headers: { "User-Agent": "rekodo/1.0 +https://rekodo.co" },
    })
      .then(res => {
        if (!res.ok) throw new Error("discogs fetch failed");
        return res.json();
      })
      .then((data: { images?: { uri?: string }[] }) => {
        if (cancelled) return;
        const uri = data.images?.[0]?.uri ?? null;
        if (uri) setImgUrl(uri);
        else setFailed(true);
      })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div style={{ width: 260, flexShrink: 0, position: "sticky", top: 24, alignSelf: "flex-start" }}>
      <div style={{ width: "100%", aspectRatio: "1 / 1", background: "#f7f7f5", overflow: "hidden" }}>
        {imgUrl && !failed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imgUrl}
            alt="Maria BC"
            onError={() => setFailed(true)}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontFamily: MONO, fontSize: "12px", color: "#aaaaaa" }}>Maria BC</span>
          </div>
        )}
      </div>

      <div style={{ borderTop: `1px solid ${RULE}`, marginTop: 16, paddingTop: 12 }}>
        <p style={{ fontFamily: SERIF, fontSize: "14px", fontWeight: 600, color: INK, margin: "0 0 6px" }}>
          Maria BC
        </p>
        <p style={{ fontFamily: MONO, fontSize: "11px", color: INK, margin: "0 0 4px", fontWeight: 400 }}>
          Sacred Bones Records
        </p>
        <p style={{ fontFamily: MONO, fontSize: "11px", color: INK, margin: 0, fontWeight: 400 }}>
          Oakland, CA · Active 2020–present
        </p>
      </div>
    </div>
  );
}

export default function MariaBCSpotlight() {
  return (
    <div style={{ display: "flex", gap: 40, alignItems: "flex-start" }}>
      <ArtistPhotoPanel />

      <div style={{ flex: 1, minWidth: 0 }}>

        {/* 1. Header */}
        <div style={{ borderBottom: `1px solid ${RULE}`, paddingBottom: 32, marginBottom: 32 }}>
          <SectionEyebrow>Artist Spotlight - June 2026</SectionEyebrow>
          <h1 style={{
            fontFamily: SERIF, fontSize: "48px", fontWeight: 600,
            letterSpacing: "-0.03em", color: INK, margin: "0 0 16px", lineHeight: 1.05,
          }}>
            Maria BC
          </h1>
          <p style={{ fontFamily: MONO, fontSize: "12px", color: INK, lineHeight: 1.7, maxWidth: 560, margin: 0, fontWeight: 400 }}>
            Ohio-born, Oakland-based. Classically trained mezzo-soprano. Three albums in four years — one of the most quietly arresting voices in American ambient folk.
          </p>
        </div>

        {/* 2. Bio */}
        <div style={{ borderBottom: `1px solid ${RULE}`, paddingBottom: 32, marginBottom: 32 }}>
          <SectionEyebrow>About</SectionEyebrow>
          <p style={{ fontFamily: MONO, fontSize: "12px", lineHeight: 1.75, color: INK, margin: 0, fontWeight: 400 }}>
            {BIO}
          </p>
        </div>

        {/* 3. Discography */}
        <div style={{ borderBottom: `1px solid ${RULE}`, paddingBottom: 32, marginBottom: 32 }}>
          <SectionEyebrow>Discography</SectionEyebrow>
          <div>
            {DISCOGRAPHY.map((row, i) => (
              <div
                key={row.title}
                style={{
                  display: "flex", gap: 16, padding: "16px 0",
                  borderBottom: i < DISCOGRAPHY.length - 1 ? `1px solid ${RULE}` : "none",
                }}
              >
                <div style={{ width: 48, flexShrink: 0, fontFamily: MONO, fontSize: "12px", color: ORANGE, fontWeight: 400 }}>
                  {row.year}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: SERIF, fontSize: "15px", fontWeight: 600, color: INK, margin: "0 0 3px", display: "flex", alignItems: "center", gap: 8 }}>
                    {row.title}
                    {row.title === "Marathon" && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <span style={{ fontFamily: SERIF, fontSize: "16px", color: "#B8860B", lineHeight: 1 }}>ō</span>
                        <span style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.06em", textTransform: "uppercase", color: "#B8860B", fontWeight: 400 }}>
                          Rekōdo&rsquo;s Pick
                        </span>
                      </span>
                    )}
                  </p>
                  <p style={{ fontFamily: MONO, fontSize: "11px", color: "#888888", margin: "0 0 6px", fontWeight: 400 }}>
                    {row.label}
                  </p>
                  <p style={{ fontFamily: MONO, fontSize: "11px", color: INK, lineHeight: 1.6, margin: 0, fontWeight: 400 }}>
                    {row.note}
                  </p>
                </div>
                {row.badge && (
                  <div style={{ flexShrink: 0 }}>
                    <span style={{
                      fontFamily: MONO, fontSize: "10px", color: INK,
                      border: `1px solid ${RULE}`, padding: "2px 8px",
                      whiteSpace: "nowrap", fontWeight: 400,
                    }}>
                      {row.badge}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 4. Pressing Intelligence */}
        <div style={{ borderBottom: `1px solid ${RULE}`, paddingBottom: 32, marginBottom: 32 }}>
          <SectionEyebrow>Pressing Intelligence</SectionEyebrow>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", border: `1px solid ${RULE}` }}>
            {PRESSING.map((cell, i) => (
              <div
                key={cell.title}
                style={{
                  padding: 16,
                  borderRight: i % 2 === 0 ? `1px solid ${RULE}` : "none",
                  borderBottom: i < 2 ? `1px solid ${RULE}` : "none",
                }}
              >
                <p style={{ fontFamily: MONO, fontSize: "11px", fontWeight: 500, color: INK, margin: "0 0 8px" }}>
                  {cell.title}
                </p>
                <p style={{ fontFamily: MONO, fontSize: "11px", fontWeight: 400, color: INK, lineHeight: 1.6, margin: 0 }}>
                  {cell.body}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* 5. Dig / If you own this */}
        <div>
          <SectionEyebrow>If you own Maria BC</SectionEyebrow>
          <p style={{ fontFamily: MONO, fontSize: "11px", color: "#888888", margin: "0 0 16px", fontWeight: 400 }}>
            You might also reach for
          </p>
          <div style={{ display: "flex", border: `1px solid ${RULE}` }}>
            {NEIGHBORS.map((n, i) => (
              <div
                key={n.artist}
                style={{
                  flex: 1, padding: 16,
                  borderLeft: i > 0 ? `1px solid ${RULE}` : "none",
                }}
              >
                <p style={{ fontFamily: MONO, fontSize: "10px", textTransform: "uppercase", color: ORANGE, margin: "0 0 8px", fontWeight: 400 }}>
                  {n.tag}
                </p>
                <p style={{ fontFamily: SERIF, fontSize: "14px", fontWeight: 600, color: INK, margin: "0 0 3px" }}>
                  {n.artist}
                </p>
                <p style={{ fontFamily: MONO, fontSize: "11px", color: "#888888", margin: "0 0 8px", fontWeight: 400 }}>
                  {n.album}
                </p>
                <p style={{ fontFamily: MONO, fontSize: "11px", color: INK, lineHeight: 1.6, margin: 0, fontWeight: 400 }}>
                  {n.reason}
                </p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
