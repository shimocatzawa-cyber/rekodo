"use client";

import { useState, useEffect } from "react";

const SERIF  = "var(--font-editorial)";
const MONO   = "var(--font-mono)";
const ORANGE = "#CC5500";
const INK    = "#0a0a0a";
const RULE   = "#e0e0da";

const DISCOGS_LABEL_ID = "24105";

const ABOUT_BODY =
  "Light in the Attic was founded in 2001 by high school friends Matt Sullivan and Josh Wright in Seattle, Washington. Their mission was simple and remains unchanged: find great music, wherever it is, however it sounds, and put it out properly. What began with a handful of cult reissues became one of the most respected independent labels in the world — 200+ titles across soul, funk, folk, Japanese ambient, psychedelic rock, country, and beyond. Their early work with Sixto Rodriguez, the Detroit singer-songwriter whose music had become legendary in South Africa without his knowledge, culminated in the 2012 Academy Award-winning documentary Searching for Sugar Man, which brought the label and the artist global attention. But Rodriguez was one thread in a much larger tapestry. Karen Dalton's In My Own Time, Betty Davis's complete discography, Lee Hazlewood's LHI archives, Hiroshi Yoshimura's environmental music series, the Native North America compilation — each one a recovery operation. In 2024, Discogs named Light in the Attic Indie Label of the Year. They have also won A2IM's Label of the Year (Medium) twice: 2021 and 2024.";

type LandmarkRow = {
  year: string;
  title: string;
  artist: string;
  note: string;
  badge: string | null;
};

const LANDMARK_RELEASES: LandmarkRow[] = [
  {
    year: "2008", title: "Cold Fact", artist: "Sixto Rodriguez",
    note: "The reissue that launched everything. Rodriguez's 1970 debut had been a cult phenomenon in South Africa for decades while he worked construction in Detroit. This pressing introduced him to the world — and five years later the documentary finished the job.",
    badge: "Grammy region · Oscar doc",
  },
  {
    year: "2006", title: "In My Own Time", artist: "Karen Dalton",
    note: "The Greenwich Village folk singer with a voice between Billie Holiday and Tim Buckley. This reissue pulled her from near-complete obscurity. Covered later by Angel Olsen and Mark Lanegan on the LITA cover series.",
    badge: "Foundational reissue",
  },
  {
    year: "2009", title: "Dreamin' Wild", artist: "Donnie & Joe Emerson",
    note: "Two brothers from rural Washington recorded a private-press album in their barn in 1979. Nobody heard it for thirty years. LITA found it, reissued it, and it became a cult sensation — eventually a 2022 film starring Casey Affleck.",
    badge: "Private press recovery",
  },
  {
    year: "2019", title: "Pacific Breeze", artist: "Various Artists",
    note: "Japanese city pop, AOR and boogie 1976–1986. The compilation that crystallised a global city pop revival and opened the door to LITA's deep Japan Archival Series.",
    badge: "Japan Archival Series",
  },
  {
    year: "2023", title: "Music and Nature", artist: "Hiroshi Yoshimura",
    note: "The Japanese environmental music pioneer whose 1982 debut Music for Nine Post Cards had been nearly impossible to find. LITA's Yoshimura series brought his entire catalogue back into print — among their most important archival projects.",
    badge: "Environmental music",
  },
];

type CollectorCell = { title: string; body: string };

const COLLECTOR_NOTES: CollectorCell[] = [
  {
    title: "Packaging as object",
    body: "LITA pressings are designed as archival objects — tip-on jackets, restored original artwork, gatefold construction, extensive liner notes. The physical edition is almost always more complete than any streaming experience. The Rodriguez Cold Fact reissue includes original liner notes and photos unavailable elsewhere.",
  },
  {
    title: "First LITA pressings vs. subsequent editions",
    body: "For key titles, the first LITA pressing is the one to own. Subsequent repress editions sometimes simplify the packaging. Rodriguez's Cold Fact first LITA press (2008), Karen Dalton's In My Own Time first LITA press (2006), and the original Dreamin' Wild reissue (2009) all command premiums on Discogs relative to later editions.",
  },
  {
    title: "Japan Archival Series",
    body: "The Pacific Breeze series and its companions (Even a Tree Can Shed Tears, Kankyo Ongaku) are among the most collectable LITA releases. The city pop revival drove Pacific Breeze Vol. 1 to significant secondary market premiums. Vol. 2 and Vol. 3 followed — the full series is the collector's target.",
  },
  {
    title: "Cover Songs 7\" series",
    body: "LITA's ongoing series of 7\" singles pairs contemporary artists with LITA catalogue names — Mac DeMarco covering Haruomi Hosono, Angel Olsen covering Karen Dalton, Iggy Pop covering Betty Davis. These pressed in small quantities and disappear fast. The full set was collected on the Light in the Attic & Friends compilation (2023).",
  },
];

type Neighbor = { tag: string; artist: string; album: string; reason: string };

const NEIGHBORS: Neighbor[] = [
  {
    tag: "Kindred label", artist: "Numero Group", album: "Various — ongoing since 2003",
    reason: "Chicago's answer to LITA. Deep archival work on soul, funk, and outsider music — mostly regional American sounds that fell through the cracks. If you trust LITA's curatorial instincts, Numero is the natural next step.",
  },
  {
    tag: "Essential companion", artist: "Various Artists", album: "Kankyo Ongaku: Japanese Ambient, Environmental & New Age Music 1980–1990 (2019)",
    reason: "The Grammy-nominated LITA compilation that sits alongside Pacific Breeze as their most complete statement on Japanese music. If you own Pacific Breeze and not this, that's the gap to close first.",
  },
  {
    tag: "Rabbit hole", artist: "Betty Davis", album: "They Say I'm Different (1974)",
    reason: "LITA's reissue of Davis's second album is the one that converts new listeners. Funk so raw it makes Parliament sound polished. The cover art alone. If Rodriguez was your entry point into LITA, Davis is where it gets interesting.",
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

function LabelLogoPanel() {
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`https://api.discogs.com/labels/${DISCOGS_LABEL_ID}`, {
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
    <div className="rk-spotlight-panel" style={{ width: 260, flexShrink: 0, position: "sticky", top: 24, alignSelf: "flex-start" }}>
      <div className="rk-spotlight-img" style={{ width: "100%", aspectRatio: "1 / 1", background: "#f7f7f5", overflow: "hidden" }}>
        {imgUrl && !failed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imgUrl}
            alt="Light in the Attic"
            onError={() => setFailed(true)}
            style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
          />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontFamily: MONO, fontSize: "12px", color: "#aaaaaa" }}>LITA</span>
          </div>
        )}
      </div>

      <div style={{ borderTop: `1px solid ${RULE}`, marginTop: 16, paddingTop: 12 }}>
        <p style={{ fontFamily: SERIF, fontSize: "14px", fontWeight: 600, color: INK, margin: "0 0 6px" }}>
          Light in the Attic
        </p>
        <p style={{ fontFamily: MONO, fontSize: "11px", color: INK, margin: "0 0 4px", fontWeight: 400 }}>
          Founded 2001 · Seattle, WA
        </p>
        <a
          href="https://lightintheattic.net"
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontFamily: MONO, fontSize: "11px", color: ORANGE, fontWeight: 400, textDecoration: "none" }}
        >
          lightintheattic.net
        </a>
      </div>
    </div>
  );
}

export default function LightInTheAtticSpotlight() {
  return (
    <div className="rk-spotlight-outer" style={{ display: "flex", gap: 40, alignItems: "flex-start" }}>
      <LabelLogoPanel />

      <div style={{ flex: 1, minWidth: 0 }}>

        {/* 1. Header */}
        <div style={{ borderBottom: `1px solid ${RULE}`, paddingBottom: 32, marginBottom: 32 }}>
          <SectionEyebrow>Label Spotlight · June 2026</SectionEyebrow>
          <h1 style={{
            fontFamily: SERIF, fontSize: "48px", fontWeight: 600,
            letterSpacing: "-0.03em", color: INK, margin: "0 0 16px", lineHeight: 1.05,
          }}>
            Light in the Attic
          </h1>
          <p style={{ fontFamily: MONO, fontSize: "12px", color: INK, lineHeight: 1.7, maxWidth: 560, margin: 0, fontWeight: 400 }}>
            Seattle&apos;s finest archivists. Two decades of recovering music the world nearly lost — from Detroit folk-soul to Japanese environmental music to lost country funk. The reissue label that gives overlooked records the lives they deserved.
          </p>
        </div>

        {/* 2. About */}
        <div style={{ borderBottom: `1px solid ${RULE}`, paddingBottom: 32, marginBottom: 32 }}>
          <SectionEyebrow>About</SectionEyebrow>
          <p style={{ fontFamily: MONO, fontSize: "12px", lineHeight: 1.75, color: INK, margin: 0, fontWeight: 400 }}>
            {ABOUT_BODY}
          </p>
        </div>

        {/* 3. Landmark Releases */}
        <div style={{ borderBottom: `1px solid ${RULE}`, paddingBottom: 32, marginBottom: 32 }}>
          <SectionEyebrow>Landmark Releases</SectionEyebrow>
          <div>
            {LANDMARK_RELEASES.map((row, i) => (
              <div
                key={row.title}
                style={{
                  display: "flex", gap: 16, padding: "16px 0",
                  borderBottom: i < LANDMARK_RELEASES.length - 1 ? `1px solid ${RULE}` : "none",
                }}
              >
                <div style={{ width: 48, flexShrink: 0, fontFamily: MONO, fontSize: "12px", color: ORANGE, fontWeight: 400 }}>
                  {row.year}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: SERIF, fontSize: "15px", fontWeight: 600, color: INK, margin: "0 0 3px", display: "flex", alignItems: "center", gap: 8 }}>
                    {row.title}
                    {row.title === "In My Own Time" && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <span style={{ fontFamily: SERIF, fontSize: "16px", color: "#B8860B", lineHeight: 1 }}>ō</span>
                        <span style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.06em", textTransform: "uppercase", color: "#B8860B", fontWeight: 400 }}>
                          Rekōdo&rsquo;s Pick
                        </span>
                      </span>
                    )}
                  </p>
                  <p style={{ fontFamily: MONO, fontSize: "11px", color: "#888888", margin: "0 0 6px", fontWeight: 400 }}>
                    {row.artist}
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

        {/* 4. Collector's Notes */}
        <div style={{ borderBottom: `1px solid ${RULE}`, paddingBottom: 32, marginBottom: 32 }}>
          <SectionEyebrow>Collector&apos;s Notes</SectionEyebrow>
          <p style={{ fontFamily: MONO, fontSize: "11px", color: "#888888", margin: "0 0 16px", fontWeight: 400 }}>
            What makes a LITA pressing worth owning
          </p>
          <div className="rk-pressing-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", border: `1px solid ${RULE}` }}>
            {COLLECTOR_NOTES.map((cell, i) => (
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

        {/* 5. If LITA is in your collection */}
        <div>
          <SectionEyebrow>If LITA is in your collection</SectionEyebrow>
          <p style={{ fontFamily: MONO, fontSize: "11px", color: "#888888", margin: "0 0 16px", fontWeight: 400 }}>
            You might also explore
          </p>
          <div className="rk-neighbors-flex" style={{ display: "flex", border: `1px solid ${RULE}` }}>
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
