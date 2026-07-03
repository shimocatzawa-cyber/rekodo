"use client";

import { useRef, useEffect, useState, useCallback } from "react";

// ── Types ──────────────────────────────────────────────────────────────────────

type RelType = "collaboration" | "influence" | "genre" | "sampled" | "production";
type ClusterKey = "jazz" | "funk" | "electronic" | "hiphop" | "triphop";

interface ArtistNode {
  id: string;
  name: string;
  genres: string[];
  styles: string[];
  albums: number;
  cluster: ClusterKey;
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

interface Camera { x: number; y: number; scale: number; }

// ── Design tokens ──────────────────────────────────────────────────────────────

const ORANGE    = "#CC5500";
const INK       = "#1a1a1a";
const CREAM     = "#fafaf8";
const EDITORIAL = '"Shippori Mincho", Georgia, serif';
const MONO      = '"DM Mono", "Courier New", monospace';

const CLUSTER_FILL: Record<ClusterKey, string> = {
  jazz:       "#D8CCAC",
  funk:       "#E8C09A",
  electronic: "#B4D0C4",
  hiphop:     "#C4BAD4",
  triphop:    "#D4BCBC",
};

const CLUSTER_LABEL: Record<ClusterKey, string> = {
  jazz:       "JAZZ",
  funk:       "FUNK · SOUL",
  electronic: "ELECTRONIC",
  hiphop:     "HIP-HOP",
  triphop:    "TRIP-HOP",
};

const CLUSTER_SEED: Record<ClusterKey, [number, number]> = {
  jazz:       [0.22, 0.30],
  funk:       [0.22, 0.68],
  electronic: [0.72, 0.28],
  hiphop:     [0.68, 0.70],
  triphop:    [0.55, 0.75],
};

const REL_VERB: Record<RelType, string> = {
  collaboration: "Collaborated with",
  influence:     "Influenced",
  genre:         "Genre peers with",
  sampled:       "Sampled by",
  production:    "Produced",
};

const BG_MARKS = [
  { text: "INFLUENCE",  xF: 0.42, yF: 0.15, size: 56, rot: -0.06 },
  { text: "SAMPLING",   xF: 0.60, yF: 0.88, size: 48, rot:  0.04 },
  { text: "FREQUENCY",  xF: 0.08, yF: 0.52, size: 40, rot: -0.09 },
  { text: "RHYTHM",     xF: 0.82, yF: 0.55, size: 52, rot:  0.07 },
  { text: "33⅓",       xF: 0.35, yF: 0.78, size: 38, rot: -0.04 },
  { text: "TEMPO",      xF: 0.75, yF: 0.92, size: 36, rot:  0.05 },
  { text: "SIDE A",     xF: 0.05, yF: 0.18, size: 34, rot: -0.07 },
  { text: "VIBE",       xF: 0.88, yF: 0.12, size: 60, rot:  0.03 },
  { text: "GROOVE",     xF: 0.48, yF: 0.42, size: 44, rot: -0.05 },
  { text: "1979",       xF: 0.15, yF: 0.88, size: 42, rot:  0.08 },
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

// ── Static data ────────────────────────────────────────────────────────────────

const ARTISTS_INITIAL: Omit<ArtistNode, "x"|"y"|"vx"|"vy"|"radius">[] = [
  { id: "miles",      name: "Miles Davis",          genres: ["Jazz"],                styles: ["Modal", "Fusion"],       albums: 12, cluster: "jazz" },
  { id: "coltrane",   name: "John Coltrane",        genres: ["Jazz"],                styles: ["Avant-garde", "Modal"],  albums: 8,  cluster: "jazz" },
  { id: "gilscott",   name: "Gil Scott-Heron",      genres: ["Jazz", "Soul"],        styles: ["Spoken Word"],           albums: 5,  cluster: "jazz" },
  { id: "herbie",     name: "Herbie Hancock",       genres: ["Jazz", "Electronic"],  styles: ["Fusion", "Funk"],        albums: 9,  cluster: "jazz" },
  { id: "sunra",      name: "Sun Ra",               genres: ["Jazz"],                styles: ["Avant-garde"],           albums: 6,  cluster: "jazz" },
  { id: "nina",       name: "Nina Simone",          genres: ["Jazz", "Soul"],        styles: ["Blues", "Gospel"],       albums: 8,  cluster: "jazz" },
  { id: "jb",         name: "James Brown",          genres: ["Soul", "Funk"],        styles: ["R&B"],                   albums: 11, cluster: "funk" },
  { id: "sly",        name: "Sly & Family Stone",   genres: ["Soul", "Funk"],        styles: ["Psychedelic"],           albums: 7,  cluster: "funk" },
  { id: "pfunk",      name: "Parliament",           genres: ["Funk"],                styles: ["P-Funk"],                albums: 10, cluster: "funk" },
  { id: "kraftwerk",  name: "Kraftwerk",            genres: ["Electronic"],          styles: ["Synth-pop", "Techno"],   albums: 8,  cluster: "electronic" },
  { id: "aphex",      name: "Aphex Twin",           genres: ["Electronic"],          styles: ["IDM", "Ambient"],        albums: 7,  cluster: "electronic" },
  { id: "eno",        name: "Brian Eno",            genres: ["Electronic", "Ambient"],styles: ["Experimental"],         albums: 9,  cluster: "electronic" },
  { id: "talktalk",   name: "Talk Talk",            genres: ["Art Rock"],            styles: ["Post-rock", "Ambient"],  albums: 5,  cluster: "electronic" },
  { id: "can",        name: "Can",                  genres: ["Krautrock"],           styles: ["Experimental"],          albums: 5,  cluster: "electronic" },
  { id: "neu",        name: "Neu!",                 genres: ["Krautrock"],           styles: ["Motorik"],               albums: 4,  cluster: "electronic" },
  { id: "pe",         name: "Public Enemy",         genres: ["Hip-Hop"],             styles: ["Political rap"],         albums: 6,  cluster: "hiphop" },
  { id: "delasoul",   name: "De La Soul",           genres: ["Hip-Hop"],             styles: ["Afrocentric"],           albums: 5,  cluster: "hiphop" },
  { id: "atcq",       name: "A Tribe Called Quest", genres: ["Hip-Hop"],             styles: ["Jazz rap"],              albums: 7,  cluster: "hiphop" },
  { id: "portishead", name: "Portishead",           genres: ["Trip-Hop"],            styles: ["Cinematic"],             albums: 4,  cluster: "triphop" },
  { id: "massive",    name: "Massive Attack",       genres: ["Trip-Hop"],            styles: ["Dub", "Electronic"],     albums: 6,  cluster: "triphop" },
];

const EDGES_INITIAL: Omit<Edge, "cpDx"|"cpDy">[] = [
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

// Demo pool: artists added one-by-one via the "New Record" button
const NEW_ARRIVALS: (Omit<ArtistNode, "x"|"y"|"vx"|"vy"|"radius"> & {
  newEdges: Omit<Edge, "cpDx"|"cpDy">[];
})[] = [
  {
    id: "kendrick", name: "Kendrick Lamar",
    genres: ["Hip-Hop"], styles: ["Conscious rap", "Jazz rap"],
    albums: 5, cluster: "hiphop",
    newEdges: [
      { source: "kendrick", target: "atcq", type: "influence", weight: 0.70 },
      { source: "kendrick", target: "pe",   type: "influence", weight: 0.75 },
    ],
  },
  {
    id: "flyinglotus", name: "Flying Lotus",
    genres: ["Electronic", "Hip-Hop"], styles: ["Beat music", "IDM"],
    albums: 6, cluster: "electronic",
    newEdges: [
      { source: "flyinglotus", target: "aphex",  type: "influence", weight: 0.65 },
      { source: "flyinglotus", target: "atcq",   type: "genre",     weight: 0.55 },
      { source: "flyinglotus", target: "herbie", type: "sampled",   weight: 0.60 },
    ],
  },
  {
    id: "alice", name: "Alice Coltrane",
    genres: ["Jazz"], styles: ["Spiritual", "Avant-garde"],
    albums: 7, cluster: "jazz",
    newEdges: [
      { source: "alice", target: "coltrane", type: "collaboration", weight: 0.95 },
      { source: "alice", target: "miles",    type: "genre",         weight: 0.70 },
      { source: "alice", target: "sunra",    type: "genre",         weight: 0.65 },
    ],
  },
  {
    id: "burial", name: "Burial",
    genres: ["Electronic"], styles: ["UK Garage", "Ambient"],
    albums: 3, cluster: "triphop",
    newEdges: [
      { source: "burial", target: "massive", type: "influence", weight: 0.70 },
      { source: "burial", target: "aphex",   type: "genre",     weight: 0.60 },
    ],
  },
];

// ── Component ──────────────────────────────────────────────────────────────────

export default function ConstellationPOC() {
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

  const [selectedArtist, setSelectedArtist] = useState<ArtistNode | null>(null);
  const [isReady,        setIsReady]         = useState(false);
  const [arrivalIndex,   setArrivalIndex]    = useState(0);

  // ── Data helpers ─────────────────────────────────────────────────────────────

  function buildEdge(e: Omit<Edge, "cpDx"|"cpDy">): Edge {
    const h   = strHash(e.source + e.target);
    const mag = 18 + seededRng(h) * 28;
    const sgn = seededRng(h + 5) > 0.5 ? 1 : -1;
    return { ...e, cpDx: mag * sgn, cpDy: (seededRng(h + 3) - 0.4) * mag * sgn };
  }

  function buildNode(
    raw: Omit<ArtistNode, "x"|"y"|"vx"|"vy"|"radius">,
    W: number, H: number
  ): ArtistNode {
    const [xF, yF] = CLUSTER_SEED[raw.cluster];
    const h = strHash(raw.id);
    return {
      ...raw,
      x:  xF * W + (seededRng(h)     - 0.5) * 110,
      y:  yF * H + (seededRng(h + 1) - 0.5) * 110,
      vx: 0, vy: 0,
      radius: 7 + Math.sqrt(raw.albums) * 3.2,
    };
  }

  function recomputeDerived(nodes: ArtistNode[], edges: Edge[]) {
    // Influence = normalized weighted degree
    const raw = new Map<string, number>();
    for (const e of edges) {
      raw.set(e.source, (raw.get(e.source) ?? 0) + e.weight);
      raw.set(e.target, (raw.get(e.target) ?? 0) + e.weight);
    }
    const maxInf = Math.max(...raw.values(), 1);
    influenceRef.current = new Map([...raw.entries()].map(([k, v]) => [k, v / maxInf]));

    // Bridge artists: node whose edges touch more than one cluster
    const nodeMap    = new Map(nodes.map(n => [n.id, n]));
    const clusterSet = new Map<string, Set<ClusterKey>>();
    for (const n of nodes) clusterSet.set(n.id, new Set<ClusterKey>([n.cluster]));
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

  // ── Init ──────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = canvas.parentElement!.clientWidth;
    const H = canvas.parentElement!.clientHeight;
    const nodes = ARTISTS_INITIAL.map(a => buildNode(a, W, H));
    const edges = EDGES_INITIAL.map(buildEdge);
    nodesRef.current = nodes;
    edgesRef.current = edges;
    recomputeDerived(nodes, edges);
    setIsReady(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Main animation loop ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!isReady) return;
    const canvas = canvasRef.current!;
    const ctx    = canvas.getContext("2d")!;
    const dpr    = window.devicePixelRatio || 1;
    dprRef.current = dpr;

    function resize() {
      const W = canvas.parentElement!.clientWidth;
      const H = canvas.parentElement!.clientHeight;
      canvas.width        = W * dpr;
      canvas.height       = H * dpr;
      canvas.style.width  = `${W}px`;
      canvas.style.height = `${H}px`;
      ctx.scale(dpr, dpr);
    }
    resize();
    window.addEventListener("resize", resize);

    function cssSize() {
      return { W: canvas.width / dpr, H: canvas.height / dpr };
    }

    // Physics tick
    function tick() {
      const { W, H } = cssSize();
      const nodes = nodesRef.current;
      const edges = edgesRef.current;
      for (const n of nodes) {
        if (draggingNodeRef.current === n.id) continue;
        n.vx += (W * 0.5 - n.x) * 0.0004;
        n.vy += (H * 0.5 - n.y) * 0.0004;
        const [xF, yF] = CLUSTER_SEED[n.cluster];
        n.vx += (xF * W - n.x) * 0.0022;
        n.vy += (yF * H - n.y) * 0.0022;
        for (const o of nodes) {
          if (o.id === n.id) continue;
          const dx = n.x - o.x, dy = n.y - o.y;
          const d2 = dx * dx + dy * dy + 1, d = Math.sqrt(d2);
          const minD = n.radius + o.radius + 24;
          if (d < minD * 3.5) { const f = 1400 / d2; n.vx += (dx/d)*f; n.vy += (dy/d)*f; }
        }
        for (const e of edges) {
          const isS = e.source === n.id, isT = e.target === n.id;
          if (!isS && !isT) continue;
          const o = nodes.find(x => x.id === (isS ? e.target : e.source));
          if (!o) continue;
          const dx = o.x - n.x, dy = o.y - n.y;
          const d  = Math.sqrt(dx*dx + dy*dy) + 0.1;
          const f  = (d - (90 + (1 - e.weight) * 60)) * 0.007 * e.weight;
          n.vx += (dx/d)*f; n.vy += (dy/d)*f;
        }
        n.vx *= 0.87; n.vy *= 0.87;
        n.x  += n.vx;  n.y  += n.vy;
        const pad = n.radius + 50;
        if (n.x < pad)     n.vx += (pad - n.x)     * 0.12;
        if (n.x > W - pad) n.vx += (W - pad - n.x) * 0.12;
        if (n.y < pad)     n.vy += (pad - n.y)     * 0.12;
        if (n.y > H - pad) n.vy += (H - pad - n.y) * 0.12;
      }
    }

    // Smooth camera lerp
    function lerpCamera() {
      if (!autoZoomRef.current) return;
      const c = cameraRef.current, t = targetCamRef.current, k = 0.09;
      c.x     += (t.x - c.x) * k;
      c.y     += (t.y - c.y) * k;
      c.scale += (t.scale - c.scale) * k;
      if (Math.abs(t.x - c.x) < 0.4 && Math.abs(t.y - c.y) < 0.4 && Math.abs(t.scale - c.scale) < 0.003) {
        Object.assign(c, t);
        autoZoomRef.current = false;
      }
    }

    // Render
    function render() {
      const { W, H } = cssSize();
      const nodes     = nodesRef.current;
      const edges     = edgesRef.current;
      const cam       = cameraRef.current;
      const hovered   = hoveredRef.current;
      const selected  = selectedRef.current;
      const activeId  = hovered || selected;
      const now       = Date.now();
      const influence = influenceRef.current;
      const bridgeIds = bridgeIdsRef.current;
      const spawns    = spawnAnimsRef.current;

      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = CREAM;
      ctx.fillRect(0, 0, W, H);

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

      // Camera transform
      ctx.save();
      ctx.translate(cam.x, cam.y);
      ctx.scale(cam.scale, cam.scale);

      // Layer 0 — background marks
      for (const m of BG_MARKS) {
        ctx.save();
        ctx.translate(m.xF * W, m.yF * H);
        ctx.rotate(m.rot);
        ctx.font = `bold ${m.size}px ${EDITORIAL}`;
        ctx.fillStyle = "rgba(180,170,155,0.065)";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(m.text, 0, 0);
        ctx.restore();
      }

      // Layer 1 — cluster halos
      const centroids: Record<string, { x: number; y: number; n: number }> = {};
      for (const node of nodes) {
        if (!centroids[node.cluster]) centroids[node.cluster] = { x: 0, y: 0, n: 0 };
        centroids[node.cluster].x += node.x;
        centroids[node.cluster].y += node.y;
        centroids[node.cluster].n++;
      }
      for (const cluster of Object.keys(centroids) as ClusterKey[]) {
        const c = centroids[cluster];
        const cx = c.x / c.n, cy = c.y / c.n;
        const r  = 90 + c.n * 20;
        const fill = CLUSTER_FILL[cluster];
        const grad = ctx.createRadialGradient(cx, cy, r * 0.05, cx, cy, r);
        grad.addColorStop(0,   fill + "33");
        grad.addColorStop(0.5, fill + "16");
        grad.addColorStop(1,   fill + "00");
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(-0.06);
        ctx.font = `bold 34px ${EDITORIAL}`;
        ctx.fillStyle = fill + "70";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(CLUSTER_LABEL[cluster], 0, 0);
        ctx.restore();
      }

      // Layer 2 — edges
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
          ctx.lineWidth   = 1.2 + e.weight * 1.8;
          ctx.globalAlpha = 0.85;
          if (e.type === "influence")   ctx.setLineDash([7, 4]);
          else if (e.type === "sampled") ctx.setLineDash([3, 3]);
          else if (e.type === "production") ctx.setLineDash([10, 3]);
          else ctx.setLineDash([]);
        } else {
          ctx.strokeStyle = INK;
          ctx.lineWidth   = 0.4 + e.weight * 0.9;
          ctx.globalAlpha = activeId ? 0.04 : 0.14;
          ctx.setLineDash([]);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        if (isActive) {
          const lx = (src.x + tgt.x) / 2 + e.cpDx * 0.4;
          const ly = (src.y + tgt.y) / 2 + e.cpDy * 0.4;
          ctx.globalAlpha = 0.92;
          ctx.font = `500 9px ${MONO}`;
          const label = e.type.toUpperCase();
          const tw = ctx.measureText(label).width;
          ctx.fillStyle = "rgba(250,250,248,0.92)";
          ctx.fillRect(lx - tw/2 - 3, ly - 7, tw + 6, 14);
          ctx.fillStyle = ORANGE;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(label, lx, ly);
        }
        ctx.restore();
      }

      // Layer 3 — node glows (drawn before node circles)
      const sorted = [...nodes].sort((a, b) => b.radius - a.radius);
      for (const node of sorted) {
        const isActive = hovered === node.id || selected === node.id;
        const isDimmed = !!activeId && !isActive && !connectedIds.has(node.id);
        const inf      = influence.get(node.id) ?? 0;
        const glowR    = node.radius * (2.6 + inf * 4);
        const alpha    = isDimmed ? 0.025 : (0.10 + inf * 0.30 + (isActive ? 0.18 : 0));
        const fill     = CLUSTER_FILL[node.cluster];
        const grad     = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, glowR);
        grad.addColorStop(0,    fill + "ee");
        grad.addColorStop(0.35, fill + "66");
        grad.addColorStop(1,    fill + "00");
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(node.x, node.y, glowR, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.restore();
      }

      // Layer 4 — node circles + bridge rings + spawn ripples
      for (const node of sorted) {
        const isHovered  = hovered  === node.id;
        const isSelected = selected === node.id;
        const isActive   = isHovered || isSelected;
        const isDimmed   = !!activeId && !isActive && !connectedIds.has(node.id);
        const isBridge   = bridgeIds.has(node.id);

        const spawn     = spawns.find(s => s.id === node.id);
        const spawnT    = spawn ? (now - spawn.birthMs) / 480 : 1;
        const spawnScale = spawnT < 1 ? easeOutBack(clamp(spawnT, 0, 1)) : 1;

        ctx.save();
        ctx.globalAlpha = isDimmed ? 0.18 : 1;

        const r = (node.radius + (isActive ? 4 : 0)) * spawnScale;

        // Bridge ring
        if (isBridge && !isDimmed) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, r + 9, 0, Math.PI * 2);
          ctx.strokeStyle = INK;
          ctx.lineWidth   = 0.8;
          ctx.globalAlpha = 0.22;
          ctx.setLineDash([3, 4]);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = isDimmed ? 0.18 : 1;
        }

        // Selected glow ring
        if (isSelected) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, r + 8, 0, Math.PI * 2);
          ctx.strokeStyle = ORANGE;
          ctx.lineWidth   = 1;
          ctx.globalAlpha = 0.38;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }

        // Fill
        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
        ctx.fillStyle = isActive ? "#fcfcfa" : CLUSTER_FILL[node.cluster];
        ctx.fill();

        // Border
        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
        ctx.strokeStyle = isActive ? ORANGE : INK;
        ctx.lineWidth   = isActive ? 2.5 : 1.5;
        ctx.stroke();

        // Centre dot
        ctx.beginPath();
        ctx.arc(node.x, node.y, isActive ? 3.5 : 2.5, 0, Math.PI * 2);
        ctx.fillStyle = isActive ? ORANGE : INK;
        ctx.fill();

        // Ripple rings on spawn
        if (spawn && spawnT < 3.5) {
          for (let i = 0; i < 3; i++) {
            const rt = clamp((now - spawn.birthMs - i * 200) / 750, 0, 1);
            if (rt <= 0) continue;
            ctx.beginPath();
            ctx.arc(node.x, node.y, node.radius * (1 + rt * 2.8), 0, Math.PI * 2);
            ctx.strokeStyle = CLUSTER_FILL[node.cluster];
            ctx.lineWidth   = 1.5;
            ctx.globalAlpha = (1 - rt) * 0.55;
            ctx.stroke();
          }
        }

        ctx.restore();
      }

      // Layer 5 — labels
      for (const node of nodes) {
        const isActive = hovered === node.id || selected === node.id;
        const isDimmed = !!activeId && !isActive && !connectedIds.has(node.id);
        const isBridge = bridgeIds.has(node.id);
        const spawn    = spawns.find(s => s.id === node.id);
        const spawnT   = spawn ? (now - spawn.birthMs) / 480 : 1;
        if (spawnT < 0.25) continue;
        const spawnScale = spawnT < 1 ? easeOutBack(clamp(spawnT, 0, 1)) : 1;
        const r = (node.radius + (isActive ? 4 : 0)) * spawnScale;

        const h     = strHash(node.id);
        const tilt  = (seededRng(h + 7) - 0.5) * 0.035;
        const words = node.name.split(" ");
        const mid   = Math.ceil(words.length / 2);
        const line1 = words.length > 2 ? words.slice(0, mid).join(" ") : node.name;
        const line2 = words.length > 2 ? words.slice(mid).join(" ")    : null;
        const fs    = isActive ? 12 + node.radius * 0.22 : 10 + node.radius * 0.16;

        ctx.save();
        ctx.translate(node.x, node.y + r + (isActive ? 18 : 14));
        ctx.rotate(tilt);
        ctx.globalAlpha = isDimmed ? 0.12 : clamp(spawnT, 0, 1);
        ctx.font        = isActive ? `600 ${fs}px ${EDITORIAL}` : `400 ${fs}px ${EDITORIAL}`;
        ctx.fillStyle   = isActive ? ORANGE : isBridge ? "#444" : INK;
        ctx.textAlign   = "center";
        ctx.textBaseline = "top";
        ctx.fillText(line1, 0, 0);
        if (line2) ctx.fillText(line2, 0, fs + 1);
        if (isActive) {
          const lineH = line2 ? (fs + 1) * 2 : fs + 1;
          ctx.font      = `400 9px ${MONO}`;
          ctx.fillStyle = "#999";
          ctx.fillText(
            `${node.albums} albums${isBridge ? " · bridge" : ""}`,
            0, lineH + 3
          );
        }
        ctx.restore();
      }

      ctx.restore(); // end camera transform

      // Clean up finished spawn anims
      spawnAnimsRef.current = spawns.filter(s => now - s.birthMs < 3500);
    }

    function loop() {
      tick();
      lerpCamera();
      render();
      animRef.current = requestAnimationFrame(loop);
    }
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
      const factor   = e.deltaY > 0 ? 0.88 : 1.12;
      const newScale = clamp(c.scale * factor, 0.2, 5);
      const sf       = newScale / c.scale;
      c.x = mx + (c.x - mx) * sf;
      c.y = my + (c.y - my) * sf;
      c.scale = newScale;
      autoZoomRef.current = false;
      Object.assign(targetCamRef.current, c);
    }

    function onMove(e: MouseEvent) {
      const { x: sx, y: sy } = cvPos(e);
      if (draggingNodeRef.current) {
        const { x: wx, y: wy } = screenToWorld(sx, sy);
        const n = nodesRef.current.find(n => n.id === draggingNodeRef.current);
        if (n) { n.x = wx; n.y = wy; n.vx = 0; n.vy = 0; }
        return;
      }
      if (isPanningRef.current) {
        const c = cameraRef.current;
        c.x += sx - panLastRef.current.x;
        c.y += sy - panLastRef.current.y;
        panLastRef.current = { x: sx, y: sy };
        Object.assign(targetCamRef.current, c);
        return;
      }
      const hit = hitTest(sx, sy);
      hoveredRef.current = hit?.id ?? null;
      canvas.style.cursor = hit ? "pointer" : "grab";
    }

    function onDown(e: MouseEvent) {
      const { x: sx, y: sy } = cvPos(e);
      mouseDownPosRef.current = { x: sx, y: sy };
      const hit = hitTest(sx, sy);
      if (hit) {
        draggingNodeRef.current = hit.id;
        canvas.style.cursor = "grabbing";
      } else {
        isPanningRef.current = true;
        panLastRef.current   = { x: sx, y: sy };
        canvas.style.cursor  = "grabbing";
      }
    }

    function onUp(e: MouseEvent) {
      const { x: sx, y: sy } = cvPos(e);
      const { W, H } = cssSize();
      const dx = sx - mouseDownPosRef.current.x;
      const dy = sy - mouseDownPosRef.current.y;
      const moved = Math.sqrt(dx*dx + dy*dy);

      if (draggingNodeRef.current && moved < 6) {
        const hit = nodesRef.current.find(n => n.id === draggingNodeRef.current);
        if (hit) {
          if (selectedRef.current === hit.id) {
            selectedRef.current = null;
            setSelectedArtist(null);
            targetCamRef.current = { x: 0, y: 0, scale: 1 };
            autoZoomRef.current  = true;
          } else {
            selectedRef.current = hit.id;
            setSelectedArtist({ ...hit });
            const ts = clamp(cameraRef.current.scale < 1.5 ? 1.7 : cameraRef.current.scale, 1.2, 2.4);
            targetCamRef.current = { x: W/2 - hit.x * ts, y: H/2 - hit.y * ts, scale: ts };
            autoZoomRef.current  = true;
          }
        }
      }

      draggingNodeRef.current = null;
      isPanningRef.current    = false;
      canvas.style.cursor     = "grab";
      void e;
    }

    function onLeave() {
      hoveredRef.current      = null;
      draggingNodeRef.current = null;
      isPanningRef.current    = false;
    }

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

  // ── Add new arrival ───────────────────────────────────────────────────────────

  function addNewArrival() {
    if (arrivalIndex >= NEW_ARRIVALS.length) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = canvas.parentElement!.clientWidth;
    const H = canvas.parentElement!.clientHeight;
    const arrival = NEW_ARRIVALS[arrivalIndex];
    const node    = buildNode(arrival, W, H);
    const [xF, yF] = CLUSTER_SEED[arrival.cluster];
    node.x = xF * W + (Math.random() - 0.5) * 50;
    node.y = yF * H + (Math.random() - 0.5) * 50;

    nodesRef.current.push(node);
    edgesRef.current.push(...arrival.newEdges.map(buildEdge));
    spawnAnimsRef.current.push({ id: arrival.id, birthMs: Date.now() });
    recomputeDerived(nodesRef.current, edgesRef.current);
    setArrivalIndex(i => i + 1);

    // Auto-select and zoom
    selectedRef.current = node.id;
    setSelectedArtist({ ...node });
    const ts = 1.9;
    targetCamRef.current = { x: W/2 - node.x * ts, y: H/2 - node.y * ts, scale: ts };
    autoZoomRef.current  = true;
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
    selectedRef.current  = null;
    setSelectedArtist(null);
    targetCamRef.current = { x: 0, y: 0, scale: 1 };
    autoZoomRef.current  = true;
  };

  const resetView = () => {
    selectedRef.current  = null;
    setSelectedArtist(null);
    targetCamRef.current = { x: 0, y: 0, scale: 1 };
    autoZoomRef.current  = true;
  };

  const isBridge    = selectedArtist ? bridgeIdsRef.current.has(selectedArtist.id) : false;
  const moreArrivals = arrivalIndex < NEW_ARRIVALS.length;

  return (
    <div className="relative w-full h-screen overflow-hidden select-none" style={{ background: CREAM }}>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ cursor: "grab" }} />

      {/* Header */}
      <div className="absolute top-5 left-6 z-10 pointer-events-none">
        <p style={{ fontFamily: MONO, fontSize: "10px", color: "#aaa", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: "2px" }}>
          Rekōdo
        </p>
        <h1 style={{ fontFamily: EDITORIAL, fontSize: "22px", fontWeight: 700, lineHeight: 1.2, color: "#0a0a0a", margin: 0 }}>
          Collector<br />Constellation
        </h1>
        <p style={{ fontFamily: MONO, fontSize: "9px", color: "#bbb", letterSpacing: "0.18em", textTransform: "uppercase", marginTop: "6px" }}>
          Proof of Concept
        </p>
      </div>

      {/* Right panel: legend + controls */}
      <div className="absolute top-5 right-5 z-10 flex flex-col gap-2" style={{ minWidth: 168 }}>
        <div style={{ background: "rgba(250,250,248,0.97)", border: "1px solid #e0e0da", padding: "16px" }}>
          <p style={{ fontFamily: MONO, fontSize: "9px", color: "#aaa", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "10px" }}>
            Relationship
          </p>
          {(["collaboration", "influence", "sampled", "production", "genre"] as RelType[]).map(t => (
            <div key={t} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
              <svg width="24" height="8" style={{ flexShrink: 0 }}>
                <line x1="0" y1="4" x2="24" y2="4" stroke={INK} strokeWidth="1.5"
                  strokeDasharray={
                    t === "influence"  ? "5,3"
                    : t === "sampled"  ? "2,2"
                    : t === "production" ? "8,2"
                    : undefined
                  }
                />
              </svg>
              <span style={{ fontFamily: MONO, fontSize: "9px", color: "#666", textTransform: "capitalize" }}>{t}</span>
            </div>
          ))}

          <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid #e0e0da" }}>
            <p style={{ fontFamily: MONO, fontSize: "9px", color: "#aaa", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "8px" }}>
              Cluster
            </p>
            {(Object.keys(CLUSTER_LABEL) as ClusterKey[]).map(c => (
              <div key={c} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                <div style={{ width: 12, height: 12, borderRadius: "50%", background: CLUSTER_FILL[c], border: "1px solid rgba(0,0,0,0.5)", flexShrink: 0 }} />
                <span style={{ fontFamily: MONO, fontSize: "9px", color: "#666" }}>{CLUSTER_LABEL[c]}</span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid #e0e0da" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <div style={{ width: 12, height: 12, borderRadius: "50%", border: "1px dashed rgba(0,0,0,0.5)", flexShrink: 0 }} />
              <span style={{ fontFamily: MONO, fontSize: "9px", color: "#666" }}>Bridge artist</span>
            </div>
            <p style={{ fontFamily: MONO, fontSize: "9px", color: "#aaa", lineHeight: 1.5, marginTop: "2px" }}>
              Links multiple<br />genre clusters
            </p>
          </div>

          <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid #e0e0da" }}>
            <p style={{ fontFamily: MONO, fontSize: "9px", color: "#aaa", lineHeight: 1.5 }}>
              Node size = albums owned<br />Glow = influence
            </p>
          </div>
        </div>

        <button
          onClick={resetView}
          style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", color: "#888", background: "rgba(250,250,248,0.97)", border: "1px solid #e0e0da", padding: "8px 12px", cursor: "pointer" }}
        >
          Reset view
        </button>

        {moreArrivals ? (
          <button
            onClick={addNewArrival}
            style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", color: "#fff", background: ORANGE, border: "none", padding: "10px 12px", cursor: "pointer" }}
          >
            + Add record to collection
          </button>
        ) : (
          <p style={{ fontFamily: MONO, fontSize: "9px", color: "#bbb", textAlign: "center", padding: "4px 0" }}>
            All demo records added
          </p>
        )}
      </div>

      {/* Info panel */}
      {selectedArtist && (
        <div className="absolute bottom-5 left-5 z-10" style={{ width: 280, background: "#fff", border: `1px solid ${INK}` }}>
          <div style={{ padding: "20px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "4px" }}>
              <div>
                <p style={{ fontFamily: MONO, fontSize: "9px", color: "#aaa", letterSpacing: "0.18em", textTransform: "uppercase" }}>
                  {CLUSTER_LABEL[selectedArtist.cluster]}
                </p>
                {isBridge && (
                  <p style={{ fontFamily: MONO, fontSize: "8px", color: ORANGE, letterSpacing: "0.14em", textTransform: "uppercase", marginTop: "2px" }}>
                    ◦ Bridge artist
                  </p>
                )}
              </div>
              <button onClick={dismiss} style={{ fontFamily: MONO, fontSize: "10px", color: "#aaa", background: "none", border: "none", cursor: "pointer" }}>✕</button>
            </div>

            <h2 style={{ fontFamily: EDITORIAL, fontSize: "20px", fontWeight: 700, color: "#0a0a0a", lineHeight: 1.2, margin: "8px 0" }}>
              {selectedArtist.name}
            </h2>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "12px" }}>
              {selectedArtist.genres.map(g => (
                <span key={g} style={{ fontFamily: MONO, fontSize: "8px", border: "1px solid #aaa", padding: "2px 6px", color: "#555", letterSpacing: "0.1em", textTransform: "uppercase" }}>{g}</span>
              ))}
              {selectedArtist.styles.map(s => (
                <span key={s} style={{ fontFamily: MONO, fontSize: "8px", border: "1px solid #e0e0da", padding: "2px 6px", color: "#aaa", letterSpacing: "0.1em", textTransform: "uppercase" }}>{s}</span>
              ))}
            </div>

            <p style={{ fontFamily: MONO, fontSize: "10px", color: "#aaa", marginBottom: "16px" }}>
              {selectedArtist.albums} albums in collection
            </p>

            <div style={{ borderTop: "1px solid #e0e0da", paddingTop: "12px" }}>
              <p style={{ fontFamily: MONO, fontSize: "9px", color: "#aaa", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "10px" }}>
                Connections
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {getConnections(selectedArtist.id).slice(0, 5).map(({ artist, type, weight, isSource }) => (
                  <div key={artist.id} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontFamily: EDITORIAL, fontSize: "14px", color: "#0a0a0a", lineHeight: 1.3, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {artist.name}
                      </p>
                      <p style={{ fontFamily: MONO, fontSize: "8px", color: "#aaa", letterSpacing: "0.1em", textTransform: "uppercase", margin: 0 }}>
                        {isSource ? REL_VERB[type]
                          : type === "influence"  ? "Influenced by"
                          : type === "sampled"    ? "Samples from"
                          : type === "production" ? "Produced by"
                          : REL_VERB[type]}
                      </p>
                    </div>
                    <span style={{ fontFamily: MONO, fontSize: "9px", color: "#aaa", flexShrink: 0, marginTop: "2px" }}>
                      {Math.round(weight * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <button style={{ marginTop: "16px", width: "100%", border: `1px solid ${INK}`, padding: "8px", fontFamily: MONO, fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase", background: "none", cursor: "pointer", color: INK }}>
              Discover similar →
            </button>
          </div>
        </div>
      )}

      {/* Bottom hint */}
      {!selectedArtist && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
          <p style={{ fontFamily: MONO, fontSize: "9px", color: "#bbb", letterSpacing: "0.2em", textTransform: "uppercase" }}>
            Scroll to zoom · Drag to pan · Click a star to explore
          </p>
        </div>
      )}
    </div>
  );
}
