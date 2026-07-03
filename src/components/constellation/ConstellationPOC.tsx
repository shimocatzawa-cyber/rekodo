"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

// ── Types ──────────────────────────────────────────────────────────────────────

type RelType = "collaboration" | "influence" | "genre" | "sampled" | "production";

interface ArtistNode {
  id: string;
  name: string;
  genres: string[];
  styles: string[];
  albums: number;
  cluster: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

interface Edge {
  source: string;
  target: string;
  type: RelType;
  weight: number;
  cpDx: number;
  cpDy: number;
}

interface ClusterConfig {
  label: string;
  fill: string;
  seed: [number, number];
}

interface Camera { x: number; y: number; scale: number; }

// ── Design tokens ──────────────────────────────────────────────────────────────

const ORANGE    = "#CC5500";
const INK       = "#0d0d0d";
const CANVAS_BG = "#f4f1eb"; // unprimed canvas warmth
const EDITORIAL = '"Shippori Mincho", Georgia, serif';
const MONO      = '"DM Mono", "Courier New", monospace';

// Cluster configs for REAL data (shimocatzawa's collection)
const REAL_CLUSTERS: Record<string, ClusterConfig> = {
  rock:         { label: "ROCK",              fill: "#A85C2A", seed: [0.35, 0.38] },
  electronic:   { label: "ELECTRONIC",        fill: "#2D6E5E", seed: [0.70, 0.28] },
  folk:         { label: "FOLK · AMERICANA",  fill: "#7A6030", seed: [0.18, 0.65] },
  jazz:         { label: "JAZZ · BLUES",      fill: "#3A5A82", seed: [0.65, 0.72] },
  other:        { label: "EXPERIMENTAL",      fill: "#6B3F6B", seed: [0.55, 0.18] },
};

// Cluster configs for DEMO data
const DEMO_CLUSTERS: Record<string, ClusterConfig> = {
  jazz:       { label: "JAZZ",          fill: "#C9A030", seed: [0.22, 0.30] },
  funk:       { label: "FUNK · SOUL",   fill: "#C04218", seed: [0.22, 0.68] },
  electronic: { label: "ELECTRONIC",    fill: "#2E7A6A", seed: [0.72, 0.28] },
  hiphop:     { label: "HIP-HOP",       fill: "#5A3D8A", seed: [0.68, 0.70] },
  triphop:    { label: "TRIP-HOP",      fill: "#8C2E2E", seed: [0.55, 0.75] },
};

// Genre string from Discogs → cluster key for real collection
const GENRE_TO_CLUSTER: Record<string, string> = {
  "Rock":                   "rock",
  "Pop":                    "rock",
  "Blues":                  "jazz",
  "Jazz":                   "jazz",
  "Classical":              "jazz",
  "Electronic":             "electronic",
  "Ambient":                "electronic",
  "IDM":                    "electronic",
  "Techno":                 "electronic",
  "House":                  "electronic",
  "Synth-pop":              "electronic",
  "Drum n Bass":            "electronic",
  "Folk, World, & Country": "folk",
  "Folk":                   "folk",
  "Country":                "folk",
  "Reggae":                 "folk",
  "Hip Hop":                "other",
  "Funk / Soul":            "other",
  "Experimental":           "other",
  "Krautrock":              "other",
  "Noise":                  "other",
  "Industrial":             "other",
  "Latin":                  "other",
};

// ── Background marks (English + Japanese) ─────────────────────────────────────

const BG_MARKS_EN = [
  { text: "INFLUENCE",  xF: 0.42, yF: 0.12, size: 68, rot: -0.06, crossed: false },
  { text: "SAMPLING",   xF: 0.60, yF: 0.88, size: 58, rot:  0.04, crossed: true  },
  { text: "FREQUENCY",  xF: 0.06, yF: 0.50, size: 46, rot: -0.09, crossed: false },
  { text: "RHYTHM",     xF: 0.82, yF: 0.55, size: 62, rot:  0.07, crossed: false },
  { text: "33⅓",       xF: 0.35, yF: 0.80, size: 44, rot: -0.04, crossed: false },
  { text: "TEMPO",      xF: 0.74, yF: 0.93, size: 40, rot:  0.05, crossed: true  },
  { text: "SIDE A",     xF: 0.04, yF: 0.16, size: 36, rot: -0.07, crossed: false },
  { text: "VIBE",       xF: 0.88, yF: 0.10, size: 72, rot:  0.03, crossed: false },
  { text: "GROOVE",     xF: 0.50, yF: 0.44, size: 52, rot: -0.05, crossed: false },
  { text: "1979",       xF: 0.14, yF: 0.88, size: 48, rot:  0.08, crossed: false },
  { text: "ANATOMY",    xF: 0.90, yF: 0.34, size: 36, rot: -0.03, crossed: true  },
  { text: "BREAK",      xF: 0.68, yF: 0.48, size: 46, rot:  0.02, crossed: false },
  { text: "440Hz",      xF: 0.18, yF: 0.32, size: 30, rot:  0.06, crossed: false },
  { text: "DUB",        xF: 0.92, yF: 0.78, size: 52, rot:  0.04, crossed: false },
  { text: "LOOP",       xF: 0.78, yF: 0.70, size: 38, rot:  0.09, crossed: true  },
  { text: "AMEN",       xF: 0.30, yF: 0.94, size: 34, rot: -0.06, crossed: true  },
  { text: "CROWN™",     xF: 0.52, yF: 0.28, size: 26, rot: -0.11, crossed: false },
  { text: "SAMPLED",    xF: 0.26, yF: 0.55, size: 28, rot:  0.10, crossed: false },
];

// Japanese marks — rendered in editorial Shippori Mincho at low opacity
const BG_MARKS_JP = [
  { text: "音楽", xF: 0.45, yF: 0.58, size: 88, rot:  0.02 }, // ongaku — music
  { text: "影",   xF: 0.12, yF: 0.40, size: 96, rot: -0.03 }, // kage — shadow/influence
  { text: "録",   xF: 0.78, yF: 0.62, size: 78, rot:  0.05 }, // roku — record
  { text: "声",   xF: 0.60, yF: 0.84, size: 64, rot: -0.04 }, // koe — voice
  { text: "時",   xF: 0.88, yF: 0.42, size: 56, rot:  0.03 }, // toki — time
];

const REL_VERB: Record<RelType, string> = {
  collaboration: "Collaborated with",
  influence:     "Influenced",
  genre:         "Genre peers with",
  sampled:       "Sampled by",
  production:    "Produced",
};

// ── Static demo data ───────────────────────────────────────────────────────────

const DEMO_ARTISTS: Omit<ArtistNode, "x"|"y"|"vx"|"vy"|"radius">[] = [
  { id: "miles",      name: "Miles Davis",          genres: ["Jazz"],             styles: ["Modal", "Fusion"],      albums: 12, cluster: "jazz"       },
  { id: "coltrane",   name: "John Coltrane",        genres: ["Jazz"],             styles: ["Avant-garde"],          albums: 8,  cluster: "jazz"       },
  { id: "gilscott",   name: "Gil Scott-Heron",      genres: ["Jazz", "Soul"],     styles: ["Spoken Word"],          albums: 5,  cluster: "jazz"       },
  { id: "herbie",     name: "Herbie Hancock",       genres: ["Jazz", "Electronic"],styles: ["Fusion", "Funk"],      albums: 9,  cluster: "jazz"       },
  { id: "sunra",      name: "Sun Ra",               genres: ["Jazz"],             styles: ["Avant-garde"],          albums: 6,  cluster: "jazz"       },
  { id: "nina",       name: "Nina Simone",          genres: ["Jazz", "Soul"],     styles: ["Blues"],                albums: 8,  cluster: "jazz"       },
  { id: "jb",         name: "James Brown",          genres: ["Funk"],             styles: ["R&B"],                  albums: 11, cluster: "funk"       },
  { id: "sly",        name: "Sly & Family Stone",   genres: ["Funk"],             styles: ["Psychedelic"],          albums: 7,  cluster: "funk"       },
  { id: "pfunk",      name: "Parliament",           genres: ["Funk"],             styles: ["P-Funk"],               albums: 10, cluster: "funk"       },
  { id: "kraftwerk",  name: "Kraftwerk",            genres: ["Electronic"],       styles: ["Synth-pop"],            albums: 8,  cluster: "electronic" },
  { id: "aphex",      name: "Aphex Twin",           genres: ["Electronic"],       styles: ["IDM", "Ambient"],       albums: 7,  cluster: "electronic" },
  { id: "eno",        name: "Brian Eno",            genres: ["Ambient"],          styles: ["Experimental"],         albums: 9,  cluster: "electronic" },
  { id: "talktalk",   name: "Talk Talk",            genres: ["Art Rock"],         styles: ["Post-rock"],            albums: 5,  cluster: "electronic" },
  { id: "can",        name: "Can",                  genres: ["Krautrock"],        styles: ["Experimental"],         albums: 5,  cluster: "electronic" },
  { id: "neu",        name: "Neu!",                 genres: ["Krautrock"],        styles: ["Motorik"],              albums: 4,  cluster: "electronic" },
  { id: "pe",         name: "Public Enemy",         genres: ["Hip-Hop"],          styles: ["Political rap"],        albums: 6,  cluster: "hiphop"     },
  { id: "delasoul",   name: "De La Soul",           genres: ["Hip-Hop"],          styles: ["Afrocentric"],          albums: 5,  cluster: "hiphop"     },
  { id: "atcq",       name: "A Tribe Called Quest", genres: ["Hip-Hop"],          styles: ["Jazz rap"],             albums: 7,  cluster: "hiphop"     },
  { id: "portishead", name: "Portishead",           genres: ["Trip-Hop"],         styles: ["Cinematic"],            albums: 4,  cluster: "triphop"    },
  { id: "massive",    name: "Massive Attack",       genres: ["Trip-Hop"],         styles: ["Dub"],                  albums: 6,  cluster: "triphop"    },
];

const DEMO_EDGES: Omit<Edge, "cpDx"|"cpDy">[] = [
  { source: "miles",     target: "coltrane",   type: "collaboration", weight: 0.95 },
  { source: "miles",     target: "herbie",     type: "collaboration", weight: 0.90 },
  { source: "miles",     target: "gilscott",   type: "influence",     weight: 0.60 },
  { source: "coltrane",  target: "sunra",      type: "genre",         weight: 0.70 },
  { source: "coltrane",  target: "nina",       type: "genre",         weight: 0.65 },
  { source: "nina",      target: "gilscott",   type: "influence",     weight: 0.70 },
  { source: "gilscott",  target: "pe",         type: "influence",     weight: 0.75 },
  { source: "atcq",      target: "miles",      type: "sampled",       weight: 0.50 },
  { source: "atcq",      target: "herbie",     type: "sampled",       weight: 0.60 },
  { source: "jb",        target: "sly",        type: "influence",     weight: 0.80 },
  { source: "jb",        target: "pfunk",      type: "influence",     weight: 0.85 },
  { source: "sly",       target: "pfunk",      type: "genre",         weight: 0.75 },
  { source: "pfunk",     target: "delasoul",   type: "sampled",       weight: 0.80 },
  { source: "pfunk",     target: "pe",         type: "sampled",       weight: 0.70 },
  { source: "jb",        target: "pe",         type: "sampled",       weight: 0.85 },
  { source: "kraftwerk", target: "aphex",      type: "influence",     weight: 0.80 },
  { source: "kraftwerk", target: "eno",        type: "genre",         weight: 0.70 },
  { source: "kraftwerk", target: "can",        type: "genre",         weight: 0.75 },
  { source: "can",       target: "neu",        type: "collaboration", weight: 0.90 },
  { source: "eno",       target: "talktalk",   type: "production",    weight: 0.80 },
  { source: "eno",       target: "massive",    type: "production",    weight: 0.75 },
  { source: "herbie",    target: "kraftwerk",  type: "influence",     weight: 0.50 },
  { source: "massive",   target: "portishead", type: "genre",         weight: 0.85 },
  { source: "aphex",     target: "portishead", type: "genre",         weight: 0.60 },
  { source: "aphex",     target: "massive",    type: "genre",         weight: 0.65 },
  { source: "pe",        target: "delasoul",   type: "genre",         weight: 0.70 },
  { source: "delasoul",  target: "atcq",       type: "collaboration", weight: 0.90 },
];

const DEMO_NEW_ARRIVALS: (Omit<ArtistNode, "x"|"y"|"vx"|"vy"|"radius"> & {
  newEdges: Omit<Edge, "cpDx"|"cpDy">[]
})[] = [
  {
    id: "kendrick", name: "Kendrick Lamar",
    genres: ["Hip-Hop"], styles: ["Conscious rap"], albums: 5, cluster: "hiphop",
    newEdges: [
      { source: "kendrick", target: "atcq", type: "influence", weight: 0.70 },
      { source: "kendrick", target: "pe",   type: "influence", weight: 0.75 },
    ],
  },
  {
    id: "alice", name: "Alice Coltrane",
    genres: ["Jazz"], styles: ["Spiritual", "Avant-garde"], albums: 7, cluster: "jazz",
    newEdges: [
      { source: "alice", target: "coltrane", type: "collaboration", weight: 0.95 },
      { source: "alice", target: "miles",    type: "genre",         weight: 0.70 },
    ],
  },
  {
    id: "burial", name: "Burial",
    genres: ["Electronic"], styles: ["UK Garage", "Ambient"], albums: 3, cluster: "triphop",
    newEdges: [
      { source: "burial", target: "massive", type: "influence", weight: 0.70 },
      { source: "burial", target: "aphex",   type: "genre",     weight: 0.60 },
    ],
  },
];

// ── Utilities ──────────────────────────────────────────────────────────────────

function seededRng(seed: number) {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

function strHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function easeOutBack(t: number): number {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 40);
}

// ── Drawing primitives ─────────────────────────────────────────────────────────

// Hand-drawn circle: stable seeded jitter so it doesn't flicker each frame
function wobblyCircle(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number, seed: number
) {
  const pts = 14;
  ctx.beginPath();
  for (let i = 0; i <= pts; i++) {
    const t = (i / pts) * Math.PI * 2;
    // jitter 0-14% of radius, more for small nodes
    const jAmt = Math.min(0.14, 5 / r);
    const jitter = 1 + (seededRng(seed + i * 3.71) - 0.5) * jAmt * 2;
    const px = cx + Math.cos(t) * r * jitter;
    const py = cy + Math.sin(t) * r * jitter;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

// Basquiat's 3-pointed crown — open at the bottom, slightly wobbly
function drawCrown(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  size: number, color: string, seed: number
) {
  const s = size;
  const j = (i: number) => (seededRng(seed + i * 4.3) - 0.5) * s * 0.1;
  ctx.beginPath();
  ctx.moveTo(cx - s      + j(0),  cy          + j(1));  // BL
  ctx.lineTo(cx - s*0.55 + j(2),  cy - s*0.9  + j(3));  // left spike
  ctx.lineTo(cx - s*0.2  + j(4),  cy - s*0.28 + j(5));  // left inner
  ctx.lineTo(cx          + j(6),  cy - s*1.35 + j(7));  // centre spike
  ctx.lineTo(cx + s*0.2  + j(8),  cy - s*0.28 + j(9));  // right inner
  ctx.lineTo(cx + s*0.55 + j(10), cy - s*0.9  + j(11)); // right spike
  ctx.lineTo(cx + s      + j(12), cy          + j(13)); // BR
  ctx.strokeStyle = color;
  ctx.lineWidth   = 2.2;
  ctx.lineJoin    = "round";
  ctx.lineCap     = "round";
  ctx.stroke();
}

// Rough rectangle (slightly wobbly corners for Basquiat feel)
function roughRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, seed: number
) {
  const j = (i: number) => (seededRng(seed + i * 5.1) - 0.5) * 3;
  ctx.beginPath();
  ctx.moveTo(x     + j(0), y     + j(1));
  ctx.lineTo(x + w + j(2), y     + j(3));
  ctx.lineTo(x + w + j(4), y + h + j(5));
  ctx.lineTo(x     + j(6), y + h + j(7));
  ctx.closePath();
}

// ── Component ──────────────────────────────────────────────────────────────────

interface Props { username?: string; }

export default function ConstellationPOC({ username }: Props) {
  const canvasRef       = useRef<HTMLCanvasElement>(null);
  const nodesRef        = useRef<ArtistNode[]>([]);
  const edgesRef        = useRef<Edge[]>([]);
  const animRef         = useRef<number>(0);
  const hoveredRef      = useRef<string | null>(null);
  const selectedRef     = useRef<string | null>(null);
  const draggingNodeRef = useRef<string | null>(null);
  const isPanningRef    = useRef(false);
  const mouseDownPosRef = useRef({ x: 0, y: 0 });
  const panLastRef      = useRef({ x: 0, y: 0 });
  const cameraRef       = useRef<Camera>({ x: 0, y: 0, scale: 1 });
  const targetCamRef    = useRef<Camera>({ x: 0, y: 0, scale: 1 });
  const autoZoomRef     = useRef(false);
  const dprRef          = useRef(1);
  const bridgeIdsRef    = useRef<Set<string>>(new Set());
  const influenceRef    = useRef<Map<string, number>>(new Map());
  const spawnAnimsRef   = useRef<{ id: string; birthMs: number }[]>([]);
  const grainRef        = useRef<HTMLCanvasElement | null>(null);
  const clusterCfgRef   = useRef<Record<string, ClusterConfig>>(DEMO_CLUSTERS);

  const [selectedArtist, setSelectedArtist] = useState<ArtistNode | null>(null);
  const [isReady,        setIsReady]         = useState(false);
  const [arrivalIndex,   setArrivalIndex]    = useState(0);
  const [loadingMsg,     setLoadingMsg]      = useState<string | null>(null);
  const [recordCount,    setRecordCount]     = useState(0);

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function buildEdge(e: Omit<Edge, "cpDx"|"cpDy">): Edge {
    const h = strHash(e.source + e.target);
    const mag = 18 + seededRng(h) * 32;
    const sgn = seededRng(h + 5) > 0.5 ? 1 : -1;
    return { ...e, cpDx: mag * sgn, cpDy: (seededRng(h + 3) - 0.4) * mag * sgn };
  }

  function buildNode(
    raw: Omit<ArtistNode, "x"|"y"|"vx"|"vy"|"radius">,
    W: number, H: number,
    clusters: Record<string, ClusterConfig>
  ): ArtistNode {
    const cfg = clusters[raw.cluster] ?? clusters[Object.keys(clusters)[0]];
    const [xF, yF] = cfg.seed;
    const h = strHash(raw.id);
    return {
      ...raw,
      x:  xF * W + (seededRng(h)     - 0.5) * 120,
      y:  yF * H + (seededRng(h + 1) - 0.5) * 120,
      vx: 0, vy: 0,
      radius: 7 + Math.sqrt(raw.albums) * 3.0,
    };
  }

  function recomputeDerived(nodes: ArtistNode[], edges: Edge[]) {
    const raw = new Map<string, number>();
    for (const e of edges) {
      raw.set(e.source, (raw.get(e.source) ?? 0) + e.weight);
      raw.set(e.target, (raw.get(e.target) ?? 0) + e.weight);
    }
    const maxInf = Math.max(...[...raw.values()], 1);
    influenceRef.current = new Map([...raw.entries()].map(([k, v]) => [k, v / maxInf]));

    const nodeMap    = new Map(nodes.map(n => [n.id, n]));
    const clusterSet = new Map<string, Set<string>>();
    for (const n of nodes) clusterSet.set(n.id, new Set<string>([n.cluster]));
    for (const e of edges) {
      const src = nodeMap.get(e.source), tgt = nodeMap.get(e.target);
      if (src && tgt) {
        clusterSet.get(src.id)?.add(tgt.cluster);
        clusterSet.get(tgt.id)?.add(src.cluster);
      }
    }
    bridgeIdsRef.current = new Set(
      nodes.filter(n => (clusterSet.get(n.id)?.size ?? 1) > 1).map(n => n.id)
    );
  }

  // Generate grain texture once
  function makeGrain(): HTMLCanvasElement {
    const g = document.createElement("canvas");
    g.width = g.height = 256;
    const gx = g.getContext("2d")!;
    const id = gx.createImageData(256, 256);
    for (let i = 0; i < id.data.length; i += 4) {
      const v = Math.floor(Math.random() * 50);
      id.data[i] = id.data[i+1] = id.data[i+2] = v;
      id.data[i+3] = Math.floor(Math.random() * 22);
    }
    gx.putImageData(id, 0, 0);
    return g;
  }

  // ── Data loading ─────────────────────────────────────────────────────────────

  useEffect(() => {
    grainRef.current = makeGrain();

    async function load() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const W = canvas.parentElement!.clientWidth;
      const H = canvas.parentElement!.clientHeight;

      if (username) {
        // ── Real collection path ──────────────────────────────────────────────
        clusterCfgRef.current = REAL_CLUSTERS;
        const supabase = createClient();

        setLoadingMsg("Looking up collection…");
        const { data: profile } = await supabase
          .from("profiles").select("id").eq("username", username).maybeSingle();
        if (!profile) { setLoadingMsg("User not found"); return; }

        setLoadingMsg("Fetching records…");
        const PAGE = 1000;
        const recordIds: string[] = [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (let from = 0; ; from += PAGE) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data } = await (supabase as any)
            .from("public_collection_summary")
            .select("record_id")
            .eq("user_id", profile.id)
            .range(from, from + PAGE - 1);
          if (!data || data.length === 0) break;
          recordIds.push(...data.map((r: { record_id: string }) => r.record_id));
          if (data.length < PAGE) break;
        }
        setRecordCount(recordIds.length);

        setLoadingMsg("Building artist graph…");
        const BATCH = 400;
        const artistMap = new Map<string, { count: number; genres: Record<string, number> }>();
        for (let i = 0; i < recordIds.length; i += BATCH) {
          const { data } = await supabase
            .from("records").select("artist, genre")
            .in("id", recordIds.slice(i, i + BATCH));
          for (const r of data ?? []) {
            if (!r.artist) continue;
            const a = artistMap.get(r.artist) ?? { count: 0, genres: {} };
            a.count++;
            if (r.genre) a.genres[r.genre] = (a.genres[r.genre] ?? 0) + 1;
            artistMap.set(r.artist, a);
          }
        }

        // Top 55 artists by record count (skip "Various")
        const top = [...artistMap.entries()]
          .filter(([name]) => name !== "Various")
          .sort((a, b) => b[1].count - a[1].count)
          .slice(0, 55);

        const nodes: ArtistNode[] = top.map(([name, d]) => {
          const topGenre = Object.entries(d.genres).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
          const cluster  = topGenre ? (GENRE_TO_CLUSTER[topGenre] ?? "other") : "other";
          return buildNode({
            id:      slugify(name),
            name,
            genres:  Object.entries(d.genres).sort((a,b) => b[1]-a[1]).slice(0,2).map(([g]) => g),
            styles:  [],
            albums:  d.count,
            cluster,
          }, W, H, REAL_CLUSTERS);
        });

        // Edges: each node connects to its 3 closest album-count peers in the same cluster
        const edges: Edge[] = [];
        const edgeSet = new Set<string>();
        for (const node of nodes) {
          const peers = nodes
            .filter(n => n.id !== node.id && n.cluster === node.cluster)
            .map(other => ({
              other,
              sim: Math.min(node.albums, other.albums) / Math.max(node.albums, other.albums),
            }))
            .sort((a, b) => b.sim - a.sim)
            .slice(0, 3);

          for (const { other, sim } of peers) {
            if (sim < 0.2) continue;
            const key = [node.id, other.id].sort().join("|");
            if (!edgeSet.has(key)) {
              edgeSet.add(key);
              edges.push(buildEdge({ source: node.id, target: other.id, type: "genre", weight: sim }));
            }
          }
        }

        nodesRef.current = nodes;
        edgesRef.current = edges;
        recomputeDerived(nodes, edges);
        setLoadingMsg(null);
      } else {
        // ── Demo data path ────────────────────────────────────────────────────
        clusterCfgRef.current = DEMO_CLUSTERS;
        const nodes = DEMO_ARTISTS.map(a => buildNode(a, W, H, DEMO_CLUSTERS));
        const edges = DEMO_EDGES.map(buildEdge);
        nodesRef.current = nodes;
        edgesRef.current = edges;
        recomputeDerived(nodes, edges);
      }
      setIsReady(true);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  // ── Animation loop ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isReady) return;
    const canvas = canvasRef.current!;
    const ctx    = canvas.getContext("2d")!;
    const dpr    = window.devicePixelRatio || 1;
    dprRef.current = dpr;

    function resize() {
      const W = canvas.parentElement!.clientWidth;
      const H = canvas.parentElement!.clientHeight;
      canvas.width  = W * dpr; canvas.height = H * dpr;
      canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
      ctx.scale(dpr, dpr);
    }
    resize();
    window.addEventListener("resize", resize);

    function cssSize() { return { W: canvas.width / dpr, H: canvas.height / dpr }; }

    // Physics
    function tick() {
      const { W, H } = cssSize();
      const nodes = nodesRef.current;
      const edges = edgesRef.current;
      const clusters = clusterCfgRef.current;
      for (const n of nodes) {
        if (draggingNodeRef.current === n.id) continue;
        n.vx += (W * 0.5 - n.x) * 0.0003;
        n.vy += (H * 0.5 - n.y) * 0.0003;
        const [xF, yF] = (clusters[n.cluster] ?? clusters[Object.keys(clusters)[0]]).seed;
        n.vx += (xF * W - n.x) * 0.0020;
        n.vy += (yF * H - n.y) * 0.0020;
        for (const o of nodes) {
          if (o.id === n.id) continue;
          const dx = n.x - o.x, dy = n.y - o.y;
          const d2 = dx*dx + dy*dy + 1, d = Math.sqrt(d2);
          const minD = n.radius + o.radius + 22;
          if (d < minD * 3.2) { const f = 1200 / d2; n.vx += (dx/d)*f; n.vy += (dy/d)*f; }
        }
        for (const e of edges) {
          const isS = e.source === n.id, isT = e.target === n.id;
          if (!isS && !isT) continue;
          const o = nodes.find(x => x.id === (isS ? e.target : e.source));
          if (!o) continue;
          const dx = o.x - n.x, dy = o.y - n.y;
          const d  = Math.sqrt(dx*dx + dy*dy) + 0.1;
          const f  = (d - (85 + (1 - e.weight) * 55)) * 0.006 * e.weight;
          n.vx += (dx/d)*f; n.vy += (dy/d)*f;
        }
        n.vx *= 0.86; n.vy *= 0.86;
        n.x  += n.vx; n.y  += n.vy;
        const pad = n.radius + 50;
        if (n.x < pad)     n.vx += (pad - n.x)     * 0.12;
        if (n.x > W - pad) n.vx += (W - pad - n.x) * 0.12;
        if (n.y < pad)     n.vy += (pad - n.y)     * 0.12;
        if (n.y > H - pad) n.vy += (H - pad - n.y) * 0.12;
      }
    }

    // Camera lerp
    function lerpCamera() {
      if (!autoZoomRef.current) return;
      const c = cameraRef.current, t = targetCamRef.current, k = 0.09;
      c.x += (t.x - c.x) * k; c.y += (t.y - c.y) * k; c.scale += (t.scale - c.scale) * k;
      if (Math.abs(t.x-c.x) < 0.4 && Math.abs(t.y-c.y) < 0.4 && Math.abs(t.scale-c.scale) < 0.003) {
        Object.assign(c, t); autoZoomRef.current = false;
      }
    }

    // ── Render ────────────────────────────────────────────────────────────────
    function render() {
      const { W, H } = cssSize();
      const nodes    = nodesRef.current;
      const edges    = edgesRef.current;
      const clusters = clusterCfgRef.current;
      const cam      = cameraRef.current;
      const hovered  = hoveredRef.current;
      const selected = selectedRef.current;
      const activeId = hovered || selected;
      const now      = Date.now();
      const influence = influenceRef.current;
      const bridgeIds = bridgeIdsRef.current;
      const spawns    = spawnAnimsRef.current;

      // ── Background ─────────────────────────────────────────────────────────
      ctx.fillStyle = CANVAS_BG;
      ctx.fillRect(0, 0, W, H);

      // Grain overlay (screen-space, before camera transform)
      const grain = grainRef.current;
      if (grain) {
        const pat = ctx.createPattern(grain, "repeat");
        if (pat) { ctx.save(); ctx.globalAlpha = 0.07; ctx.fillStyle = pat; ctx.fillRect(0, 0, W, H); ctx.restore(); }
      }

      const activeEdgeKeys = new Set<string>();
      const connectedIds   = new Set<string>();
      if (activeId) {
        for (const e of edges) {
          if (e.source === activeId || e.target === activeId) {
            activeEdgeKeys.add(`${e.source}:${e.target}`);
            connectedIds.add(e.source === activeId ? e.target : e.source);
          }
        }
      }

      ctx.save();
      ctx.translate(cam.x, cam.y);
      ctx.scale(cam.scale, cam.scale);

      // ── Layer 0: Japanese marks ────────────────────────────────────────────
      for (const m of BG_MARKS_JP) {
        ctx.save();
        ctx.translate(m.xF * W, m.yF * H);
        ctx.rotate(m.rot);
        ctx.font = `${m.size}px ${EDITORIAL}`;
        ctx.fillStyle = `rgba(13,13,13,0.04)`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(m.text, 0, 0);
        ctx.restore();
      }

      // ── Layer 1: English background marks ─────────────────────────────────
      for (const m of BG_MARKS_EN) {
        ctx.save();
        ctx.translate(m.xF * W, m.yF * H);
        ctx.rotate(m.rot);
        ctx.font = `bold ${m.size}px ${EDITORIAL}`;
        ctx.fillStyle = m.crossed ? "rgba(13,13,13,0.11)" : "rgba(13,13,13,0.08)";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(m.text, 0, 0);
        if (m.crossed) {
          const tw = ctx.measureText(m.text).width;
          ctx.beginPath();
          ctx.moveTo(-tw * 0.55, 0); ctx.lineTo(tw * 0.55, 0);
          ctx.strokeStyle = "rgba(13,13,13,0.18)";
          ctx.lineWidth = m.size * 0.06;
          ctx.lineCap = "round"; ctx.stroke();
        }
        ctx.restore();
      }

      // ── Layer 2: Cluster halos ─────────────────────────────────────────────
      const centroids: Record<string, { x: number; y: number; n: number }> = {};
      for (const node of nodes) {
        if (!centroids[node.cluster]) centroids[node.cluster] = { x: 0, y: 0, n: 0 };
        centroids[node.cluster].x += node.x;
        centroids[node.cluster].y += node.y;
        centroids[node.cluster].n++;
      }
      for (const cluster of Object.keys(centroids)) {
        const c  = centroids[cluster];
        const cx = c.x / c.n, cy = c.y / c.n;
        const r  = 95 + c.n * 19;
        const fill = (clusters[cluster] ?? Object.values(clusters)[0]).fill;
        const grad = ctx.createRadialGradient(cx, cy, r * 0.05, cx, cy, r);
        grad.addColorStop(0,   fill + "28");
        grad.addColorStop(0.5, fill + "14");
        grad.addColorStop(1,   fill + "00");
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = grad; ctx.fill();

        // Large cluster label — bold, slightly tilted, faded
        ctx.save();
        ctx.translate(cx, cy); ctx.rotate(-0.055);
        ctx.font = `bold 40px ${EDITORIAL}`;
        ctx.fillStyle = fill + "60";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText((clusters[cluster] ?? Object.values(clusters)[0]).label, 0, 0);
        ctx.restore();
      }

      // ── Layer 3: Edges ────────────────────────────────────────────────────
      for (const e of edges) {
        const src = nodes.find(n => n.id === e.source);
        const tgt = nodes.find(n => n.id === e.target);
        if (!src || !tgt) continue;
        const key      = `${e.source}:${e.target}`;
        const isActive = activeEdgeKeys.has(key);
        const mx = (src.x + tgt.x) / 2 + e.cpDx;
        const my = (src.y + tgt.y) / 2 + e.cpDy;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(src.x, src.y);
        ctx.quadraticCurveTo(mx, my, tgt.x, tgt.y);

        if (isActive) {
          ctx.strokeStyle = ORANGE;
          ctx.lineWidth   = 1.5 + e.weight * 2.0;
          ctx.globalAlpha = 0.88;
          if (e.type === "influence")     ctx.setLineDash([8, 4]);
          else if (e.type === "sampled")  ctx.setLineDash([3, 3]);
          else if (e.type === "production") ctx.setLineDash([12, 3]);
          else ctx.setLineDash([]);
        } else {
          ctx.strokeStyle = INK;
          ctx.lineWidth   = 0.5 + e.weight * 1.1;
          ctx.globalAlpha = activeId ? 0.04 : 0.13;
          ctx.setLineDash([]);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // Edge type label on active
        if (isActive) {
          const lx = (src.x + tgt.x) / 2 + e.cpDx * 0.5;
          const ly = (src.y + tgt.y) / 2 + e.cpDy * 0.5;
          ctx.globalAlpha = 0.92;
          ctx.font = `600 8px ${MONO}`;
          const label = e.type.toUpperCase();
          const tw = ctx.measureText(label).width;
          // Rough box around label
          roughRect(ctx, lx - tw/2 - 4, ly - 8, tw + 8, 15, strHash(e.source + e.target + "l"));
          ctx.fillStyle = "rgba(244,241,235,0.94)"; ctx.fill();
          ctx.strokeStyle = ORANGE; ctx.lineWidth = 0.8; ctx.stroke();
          ctx.fillStyle = ORANGE;
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText(label, lx, ly);
        }
        ctx.restore();
      }

      // ── Layer 4: Node glows ────────────────────────────────────────────────
      const sorted = [...nodes].sort((a, b) => b.radius - a.radius);
      for (const node of sorted) {
        const isActive = hovered === node.id || selected === node.id;
        const isDimmed = !!activeId && !isActive && !connectedIds.has(node.id);
        const inf    = influence.get(node.id) ?? 0;
        const fill   = (clusters[node.cluster] ?? Object.values(clusters)[0]).fill;
        const glowR  = node.radius * (2.8 + inf * 4.5);
        const alpha  = isDimmed ? 0.02 : (0.11 + inf * 0.32 + (isActive ? 0.16 : 0));
        const grad   = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, glowR);
        grad.addColorStop(0,    fill + "ff");
        grad.addColorStop(0.3,  fill + "99");
        grad.addColorStop(1,    fill + "00");
        ctx.save(); ctx.globalAlpha = alpha;
        ctx.beginPath(); ctx.arc(node.x, node.y, glowR, 0, Math.PI * 2);
        ctx.fillStyle = grad; ctx.fill(); ctx.restore();
      }

      // ── Layer 5: Node circles (wobbly) ────────────────────────────────────
      for (const node of sorted) {
        const isHovered  = hovered  === node.id;
        const isSelected = selected === node.id;
        const isActive   = isHovered || isSelected;
        const isDimmed   = !!activeId && !isActive && !connectedIds.has(node.id);
        const isBridge   = bridgeIds.has(node.id);
        const spawn      = spawns.find(s => s.id === node.id);
        const spawnT     = spawn ? (now - spawn.birthMs) / 480 : 1;
        const spawnScale = spawnT < 1 ? easeOutBack(clamp(spawnT, 0, 1)) : 1;
        const r  = (node.radius + (isActive ? 3 : 0)) * spawnScale;
        const h  = strHash(node.id);
        const fill = (clusters[node.cluster] ?? Object.values(clusters)[0]).fill;

        ctx.save();
        ctx.globalAlpha = isDimmed ? 0.18 : 1;

        // Bridge dashed ring
        if (isBridge && !isDimmed) {
          wobblyCircle(ctx, node.x, node.y, r + 10, h + 99);
          ctx.strokeStyle = INK;
          ctx.lineWidth   = 0.8;
          ctx.globalAlpha = 0.20;
          ctx.setLineDash([3, 5]);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = isDimmed ? 0.18 : 1;
        }

        // Selected glow ring
        if (isSelected) {
          wobblyCircle(ctx, node.x, node.y, r + 9, h + 77);
          ctx.strokeStyle = ORANGE; ctx.lineWidth = 1.2;
          ctx.globalAlpha = 0.42; ctx.stroke(); ctx.globalAlpha = 1;
        }

        // Fill — use cluster color when inactive, off-white when active
        wobblyCircle(ctx, node.x, node.y, r, h);
        ctx.fillStyle = isActive ? "#f9f7f2" : fill + "55";
        ctx.fill();

        // Thick ink border
        wobblyCircle(ctx, node.x, node.y, r, h);
        ctx.strokeStyle = isActive ? ORANGE : INK;
        ctx.lineWidth   = isActive ? 3.0 : 2.2;
        ctx.stroke();

        // Centre dot
        ctx.beginPath(); ctx.arc(node.x, node.y, isActive ? 3.5 : 2.5, 0, Math.PI * 2);
        ctx.fillStyle = isActive ? ORANGE : INK; ctx.fill();

        // Spawn ripple rings
        if (spawn && spawnT < 3.5) {
          for (let i = 0; i < 3; i++) {
            const rt = clamp((now - spawn.birthMs - i * 200) / 750, 0, 1);
            if (rt <= 0) continue;
            wobblyCircle(ctx, node.x, node.y, node.radius * (1 + rt * 2.5), h + i * 13);
            ctx.strokeStyle = fill; ctx.lineWidth = 1.8;
            ctx.globalAlpha = (1 - rt) * 0.6; ctx.stroke();
          }
        }

        ctx.restore();
      }

      // ── Layer 6: Crowns (high-influence artists) ──────────────────────────
      for (const node of nodes) {
        const inf    = influence.get(node.id) ?? 0;
        const isDimmed = !!activeId && selectedRef.current !== node.id && !connectedIds.has(node.id);
        if (inf < 0.65 || isDimmed) continue;

        const spawn      = spawns.find(s => s.id === node.id);
        const spawnT     = spawn ? (now - spawn.birthMs) / 480 : 1;
        const spawnScale = spawnT < 1 ? easeOutBack(clamp(spawnT, 0, 1)) : 1;
        const r = (node.radius + (selectedRef.current === node.id ? 3 : 0)) * spawnScale;

        const isActive = hovered === node.id || selected === node.id;
        const h    = strHash(node.id);
        const fill = (clusters[node.cluster] ?? Object.values(clusters)[0]).fill;
        const size = 7 + (inf - 0.65) * 14; // larger crown = more influence
        const color = isActive ? ORANGE : fill;
        const alpha = isDimmed ? 0.15 : (0.6 + inf * 0.4);

        ctx.save();
        ctx.globalAlpha = alpha;
        drawCrown(ctx, node.x, node.y - r - 5, size, color, h + 200);
        ctx.restore();
      }

      // ── Layer 7: Labels ────────────────────────────────────────────────────
      for (const node of nodes) {
        const isActive = hovered === node.id || selected === node.id;
        const isDimmed = !!activeId && !isActive && !connectedIds.has(node.id);
        const isBridge = bridgeIds.has(node.id);
        const inf      = influence.get(node.id) ?? 0;
        const spawn    = spawns.find(s => s.id === node.id);
        const spawnT   = spawn ? (now - spawn.birthMs) / 480 : 1;
        if (spawnT < 0.22) continue;
        const spawnScale = spawnT < 1 ? easeOutBack(clamp(spawnT, 0, 1)) : 1;
        const r   = (node.radius + (isActive ? 3 : 0)) * spawnScale;
        const h   = strHash(node.id);
        const fill = (clusters[node.cluster] ?? Object.values(clusters)[0]).fill;
        const tilt = (seededRng(h + 7) - 0.5) * 0.04;

        const words = node.name.split(" ");
        const mid   = Math.ceil(words.length / 2);
        const line1 = words.length > 2 ? words.slice(0, mid).join(" ") : node.name;
        const line2 = words.length > 2 ? words.slice(mid).join(" ")    : null;
        const fs    = isActive ? 12 + node.radius * 0.24 : 10 + node.radius * 0.17;

        // For high-influence artists draw a rough box behind the name
        const isBoxed = inf > 0.75 && !isActive;

        ctx.save();
        ctx.globalAlpha = isDimmed ? 0.12 : clamp(spawnT, 0, 1);
        ctx.translate(node.x, node.y + r + (isActive ? 16 : 13));
        ctx.rotate(tilt);

        if (isBoxed) {
          ctx.font = `600 ${fs}px ${EDITORIAL}`;
          const tw = Math.max(
            ctx.measureText(line1).width,
            line2 ? ctx.measureText(line2).width : 0
          );
          const linesH = line2 ? (fs + 2) * 2 : fs + 2;
          const padX = 5, padY = 4;
          roughRect(ctx, -tw/2 - padX, -padY, tw + padX*2, linesH + padY*2, h + 300);
          ctx.fillStyle = "rgba(244,241,235,0.80)"; ctx.fill();
          ctx.strokeStyle = fill; ctx.lineWidth = 1.2; ctx.stroke();
        }

        ctx.font        = isActive ? `700 ${fs}px ${EDITORIAL}` : `${inf > 0.6 ? "600" : "400"} ${fs}px ${EDITORIAL}`;
        ctx.fillStyle   = isActive ? ORANGE : isBridge ? "#333" : INK;
        ctx.textAlign   = "center"; ctx.textBaseline = "top";
        ctx.fillText(line1, 0, 0);
        if (line2) ctx.fillText(line2, 0, fs + 1);

        // Annotations
        const lineH = line2 ? (fs + 1) * 2 : fs + 1;
        if (isActive) {
          ctx.font = `400 9px ${MONO}`;
          ctx.fillStyle = "#888";
          const note = `${node.albums} records${isBridge ? " · bridge" : ""}`;
          ctx.fillText(note, 0, lineH + 3);
        } else if (inf > 0.78) {
          // Album count annotation for very influential nodes
          ctx.font = `400 8px ${MONO}`;
          ctx.fillStyle = fill + "aa";
          ctx.fillText(`×${node.albums}`, 0, lineH + 1);
        }

        ctx.restore();
      }

      ctx.restore(); // end camera transform

      // Clean old spawn anims
      spawnAnimsRef.current = spawns.filter(s => now - s.birthMs < 3500);
    }

    function loop() { tick(); lerpCamera(); render(); animRef.current = requestAnimationFrame(loop); }
    animRef.current = requestAnimationFrame(loop);

    // ── Interactions ──────────────────────────────────────────────────────────

    function screenToWorld(sx: number, sy: number) {
      const c = cameraRef.current;
      return { x: (sx - c.x) / c.scale, y: (sy - c.y) / c.scale };
    }
    function cvPos(e: MouseEvent) {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }
    function hitTest(sx: number, sy: number): ArtistNode | null {
      const { x: wx, y: wy } = screenToWorld(sx, sy);
      const scale = cameraRef.current.scale;
      for (const n of [...nodesRef.current].reverse()) {
        const dx = wx - n.x, dy = wy - n.y;
        if (Math.sqrt(dx*dx + dy*dy) <= n.radius + 8 / scale) return n;
      }
      return null;
    }

    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const r  = canvas.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      const c  = cameraRef.current;
      const factor   = e.deltaY > 0 ? 0.88 : 1.13;
      const newScale = clamp(c.scale * factor, 0.18, 6);
      const sf = newScale / c.scale;
      c.x = mx + (c.x - mx) * sf; c.y = my + (c.y - my) * sf; c.scale = newScale;
      autoZoomRef.current = false; Object.assign(targetCamRef.current, c);
    }
    function onMove(e: MouseEvent) {
      const { x: sx, y: sy } = cvPos(e);
      if (draggingNodeRef.current) {
        const { x: wx, y: wy } = screenToWorld(sx, sy);
        const n = nodesRef.current.find(n => n.id === draggingNodeRef.current);
        if (n) { n.x = wx; n.y = wy; n.vx = 0; n.vy = 0; } return;
      }
      if (isPanningRef.current) {
        const c = cameraRef.current;
        c.x += sx - panLastRef.current.x; c.y += sy - panLastRef.current.y;
        panLastRef.current = { x: sx, y: sy };
        Object.assign(targetCamRef.current, c); return;
      }
      const hit = hitTest(sx, sy);
      hoveredRef.current = hit?.id ?? null;
      canvas.style.cursor = hit ? "pointer" : "grab";
    }
    function onDown(e: MouseEvent) {
      const { x: sx, y: sy } = cvPos(e);
      mouseDownPosRef.current = { x: sx, y: sy };
      const hit = hitTest(sx, sy);
      if (hit) { draggingNodeRef.current = hit.id; canvas.style.cursor = "grabbing"; }
      else { isPanningRef.current = true; panLastRef.current = { x: sx, y: sy }; canvas.style.cursor = "grabbing"; }
    }
    function onUp(e: MouseEvent) {
      const { x: sx, y: sy } = cvPos(e);
      const { W, H } = cssSize();
      const dx = sx - mouseDownPosRef.current.x, dy = sy - mouseDownPosRef.current.y;
      const moved = Math.sqrt(dx*dx + dy*dy);
      void e;
      if (draggingNodeRef.current && moved < 6) {
        const hit = nodesRef.current.find(n => n.id === draggingNodeRef.current);
        if (hit) {
          if (selectedRef.current === hit.id) {
            selectedRef.current = null; setSelectedArtist(null);
            targetCamRef.current = { x: 0, y: 0, scale: 1 }; autoZoomRef.current = true;
          } else {
            selectedRef.current = hit.id; setSelectedArtist({ ...hit });
            const ts = clamp(cameraRef.current.scale < 1.5 ? 1.7 : cameraRef.current.scale, 1.2, 2.5);
            targetCamRef.current = { x: W/2 - hit.x * ts, y: H/2 - hit.y * ts, scale: ts };
            autoZoomRef.current = true;
          }
        }
      }
      draggingNodeRef.current = null; isPanningRef.current = false; canvas.style.cursor = "grab";
    }
    function onLeave() { hoveredRef.current = null; draggingNodeRef.current = null; isPanningRef.current = false; }

    canvas.addEventListener("wheel",      onWheel,  { passive: false });
    canvas.addEventListener("mousemove",  onMove);
    canvas.addEventListener("mousedown",  onDown);
    canvas.addEventListener("mouseup",    onUp);
    canvas.addEventListener("mouseleave", onLeave);
    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("wheel",      onWheel);
      canvas.removeEventListener("mousemove",  onMove);
      canvas.removeEventListener("mousedown",  onDown);
      canvas.removeEventListener("mouseup",    onUp);
      canvas.removeEventListener("mouseleave", onLeave);
    };
  }, [isReady]);

  // ── Demo: add new arrival ──────────────────────────────────────────────────

  function addNewArrival() {
    if (username || arrivalIndex >= DEMO_NEW_ARRIVALS.length) return;
    const canvas = canvasRef.current; if (!canvas) return;
    const W = canvas.parentElement!.clientWidth;
    const H = canvas.parentElement!.clientHeight;
    const arrival = DEMO_NEW_ARRIVALS[arrivalIndex];
    const node    = buildNode(arrival, W, H, DEMO_CLUSTERS);
    const cfg = DEMO_CLUSTERS[arrival.cluster];
    node.x = cfg.seed[0] * W + (Math.random() - 0.5) * 50;
    node.y = cfg.seed[1] * H + (Math.random() - 0.5) * 50;
    nodesRef.current.push(node);
    edgesRef.current.push(...arrival.newEdges.map(buildEdge));
    spawnAnimsRef.current.push({ id: arrival.id, birthMs: Date.now() });
    recomputeDerived(nodesRef.current, edgesRef.current);
    setArrivalIndex(i => i + 1);
    selectedRef.current = node.id; setSelectedArtist({ ...node });
    const ts = 1.9;
    targetCamRef.current = { x: W/2 - node.x * ts, y: H/2 - node.y * ts, scale: ts };
    autoZoomRef.current = true;
  }

  const getConnections = useCallback((artistId: string) => {
    return edgesRef.current
      .filter(e => e.source === artistId || e.target === artistId)
      .map(e => {
        const otherId  = e.source === artistId ? e.target : e.source;
        const other    = nodesRef.current.find(n => n.id === otherId);
        const isSource = e.source === artistId;
        return { artist: other!, type: e.type, weight: e.weight, isSource };
      })
      .filter(c => c.artist)
      .sort((a, b) => b.weight - a.weight);
  }, []);

  const dismiss = () => {
    selectedRef.current = null; setSelectedArtist(null);
    targetCamRef.current = { x: 0, y: 0, scale: 1 }; autoZoomRef.current = true;
  };
  const resetView = () => {
    selectedRef.current = null; setSelectedArtist(null);
    targetCamRef.current = { x: 0, y: 0, scale: 1 }; autoZoomRef.current = true;
  };

  const isBridge    = selectedArtist ? bridgeIdsRef.current.has(selectedArtist.id) : false;
  const isInfluential = selectedArtist ? (influenceRef.current.get(selectedArtist.id) ?? 0) >= 0.65 : false;
  const cfg = selectedArtist ? (clusterCfgRef.current[selectedArtist.cluster] ?? Object.values(clusterCfgRef.current)[0]) : null;

  // ── JSX ───────────────────────────────────────────────────────────────────

  return (
    <div className="relative w-full h-screen overflow-hidden select-none" style={{ background: CANVAS_BG }}>

      {/* Loading state */}
      {loadingMsg && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center" style={{ background: CANVAS_BG }}>
          <p style={{ fontFamily: EDITORIAL, fontSize: "24px", color: INK, marginBottom: "12px" }}>
            Collector Constellation
          </p>
          <p style={{ fontFamily: MONO, fontSize: "10px", color: "#aaa", letterSpacing: "0.2em", textTransform: "uppercase" }}>
            {loadingMsg}
          </p>
        </div>
      )}

      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ cursor: "grab", opacity: isReady ? 1 : 0 }} />

      {/* Header */}
      {isReady && (
        <div className="absolute top-5 left-6 z-10 pointer-events-none">
          <p style={{ fontFamily: MONO, fontSize: "9px", color: "#999", letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: "2px" }}>
            Rekōdo {username ? `· @${username}` : ""}
          </p>
          <h1 style={{ fontFamily: EDITORIAL, fontSize: "20px", fontWeight: 700, lineHeight: 1.2, color: INK, margin: 0 }}>
            Collector<br />Constellation
          </h1>
          {username && recordCount > 0 && (
            <p style={{ fontFamily: MONO, fontSize: "9px", color: "#bbb", letterSpacing: "0.1em", marginTop: "6px" }}>
              {recordCount} records · {nodesRef.current.length} artists
            </p>
          )}
          {!username && (
            <p style={{ fontFamily: MONO, fontSize: "9px", color: "#bbb", letterSpacing: "0.16em", textTransform: "uppercase", marginTop: "6px" }}>
              Demo
            </p>
          )}
        </div>
      )}

      {/* Legend */}
      {isReady && (
        <div className="absolute top-5 right-5 z-10 flex flex-col gap-2" style={{ minWidth: 160 }}>
          <div style={{ background: "rgba(244,241,235,0.96)", border: `1px solid ${INK}`, padding: "14px" }}>
            <p style={{ fontFamily: MONO, fontSize: "8px", color: "#999", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "10px" }}>
              Clusters
            </p>
            {Object.entries(clusterCfgRef.current).map(([key, c]) => (
              <div key={key} style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "5px" }}>
                <div style={{ width: 10, height: 10, background: c.fill + "55", border: `1.5px solid ${c.fill}`, flexShrink: 0 }} />
                <span style={{ fontFamily: MONO, fontSize: "8px", color: "#555" }}>{c.label}</span>
              </div>
            ))}

            <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: `1px solid rgba(0,0,0,0.1)` }}>
              <div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "4px" }}>
                <div style={{ width: 10, height: 10, border: "1px dashed rgba(0,0,0,0.4)", flexShrink: 0 }} />
                <span style={{ fontFamily: MONO, fontSize: "8px", color: "#555" }}>Bridge artist</span>
              </div>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "7px", marginTop: "6px" }}>
                <span style={{ fontFamily: EDITORIAL, fontSize: "11px", color: "#555", lineHeight: 1 }}>♛</span>
                <span style={{ fontFamily: MONO, fontSize: "8px", color: "#555", lineHeight: 1.4 }}>High influence<br />(crown)</span>
              </div>
              <p style={{ fontFamily: MONO, fontSize: "8px", color: "#aaa", marginTop: "8px", lineHeight: 1.5 }}>
                Node size = records owned<br />Glow = connections
              </p>
            </div>
          </div>

          <div style={{ display: "flex", gap: "6px" }}>
            <button
              onClick={resetView}
              style={{ flex: 1, fontFamily: MONO, fontSize: "8px", letterSpacing: "0.12em", textTransform: "uppercase", color: "#777", background: "rgba(244,241,235,0.96)", border: `1px solid ${INK}`, padding: "7px 10px", cursor: "pointer" }}
            >
              Reset
            </button>
          </div>

          {!username && arrivalIndex < DEMO_NEW_ARRIVALS.length && (
            <button
              onClick={addNewArrival}
              style={{ fontFamily: MONO, fontSize: "8px", letterSpacing: "0.12em", textTransform: "uppercase", color: "#fff", background: ORANGE, border: "none", padding: "9px 12px", cursor: "pointer" }}
            >
              + Add record
            </button>
          )}
        </div>
      )}

      {/* Info panel */}
      {selectedArtist && (
        <div className="absolute bottom-5 left-5 z-10" style={{ width: 272, background: "rgba(244,241,235,0.98)", border: `1.5px solid ${INK}` }}>
          <div style={{ padding: "18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "4px" }}>
              <div>
                <p style={{ fontFamily: MONO, fontSize: "8px", color: "#aaa", letterSpacing: "0.18em", textTransform: "uppercase" }}>
                  {cfg?.label}
                </p>
                <div style={{ display: "flex", gap: "8px", marginTop: "2px" }}>
                  {isBridge && (
                    <p style={{ fontFamily: MONO, fontSize: "8px", color: cfg?.fill, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                      ◦ Bridge
                    </p>
                  )}
                  {isInfluential && (
                    <p style={{ fontFamily: MONO, fontSize: "8px", color: ORANGE, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                      ♛ Crown
                    </p>
                  )}
                </div>
              </div>
              <button onClick={dismiss} style={{ fontFamily: MONO, fontSize: "10px", color: "#aaa", background: "none", border: "none", cursor: "pointer", marginTop: "1px" }}>✕</button>
            </div>

            <h2 style={{ fontFamily: EDITORIAL, fontSize: "19px", fontWeight: 700, color: INK, lineHeight: 1.2, margin: "8px 0 6px" }}>
              {selectedArtist.name}
            </h2>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "3px", marginBottom: "10px" }}>
              {selectedArtist.genres.map(g => (
                <span key={g} style={{ fontFamily: MONO, fontSize: "7px", border: `1px solid ${cfg?.fill ?? "#aaa"}`, padding: "2px 5px", color: cfg?.fill ?? "#555", letterSpacing: "0.1em", textTransform: "uppercase" }}>{g}</span>
              ))}
              {selectedArtist.styles.map(s => (
                <span key={s} style={{ fontFamily: MONO, fontSize: "7px", border: "1px solid rgba(0,0,0,0.15)", padding: "2px 5px", color: "#aaa", letterSpacing: "0.1em", textTransform: "uppercase" }}>{s}</span>
              ))}
            </div>

            <p style={{ fontFamily: MONO, fontSize: "9px", color: "#aaa", marginBottom: "14px" }}>
              {selectedArtist.albums} records in collection
            </p>

            {getConnections(selectedArtist.id).length > 0 && (
              <div style={{ borderTop: "1px solid rgba(0,0,0,0.1)", paddingTop: "12px" }}>
                <p style={{ fontFamily: MONO, fontSize: "8px", color: "#aaa", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: "8px" }}>
                  Connections
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {getConnections(selectedArtist.id).slice(0, 5).map(({ artist, type, weight, isSource }) => (
                    <div key={artist.id} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }}>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontFamily: EDITORIAL, fontSize: "13px", color: INK, lineHeight: 1.3, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {artist.name}
                        </p>
                        <p style={{ fontFamily: MONO, fontSize: "7px", color: "#aaa", letterSpacing: "0.1em", textTransform: "uppercase", margin: 0 }}>
                          {isSource ? REL_VERB[type]
                            : type === "influence"   ? "Influenced by"
                            : type === "sampled"     ? "Samples from"
                            : type === "production"  ? "Produced by"
                            : REL_VERB[type]}
                        </p>
                      </div>
                      <span style={{ fontFamily: MONO, fontSize: "8px", color: "#aaa", flexShrink: 0, marginTop: "2px" }}>
                        {Math.round(weight * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom hint */}
      {isReady && !selectedArtist && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
          <p style={{ fontFamily: MONO, fontSize: "8px", color: "#bbb", letterSpacing: "0.22em", textTransform: "uppercase" }}>
            Scroll to zoom · Drag to pan · Click a star to explore
          </p>
        </div>
      )}
    </div>
  );
}
