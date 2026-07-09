// Wikidata enrichment — resolves artist names to QIDs then queries P737 "influenced by"
// QIDs are cached in localStorage for 30 days; SPARQL is one fast batch request per session.

const QID_CACHE_KEY = "rekodo_wd_qid_v1";
const CACHE_TTL     = 30 * 24 * 60 * 60 * 1000;
const WD_API        = "https://www.wikidata.org/w/api.php";
const SPARQL_URL    = "https://query.wikidata.org/sparql";
const UA            = "rekodo/1.0 (shimocatzawa@gmail.com)";

interface QIDEntry { qid: string | null; fetchedAt: number; }
type QIDCache = Record<string, QIDEntry>;

let _cache: QIDCache | null = null;

function loadCache(): QIDCache {
  if (_cache) return _cache;
  try { _cache = JSON.parse(localStorage.getItem(QID_CACHE_KEY) ?? "{}"); }
  catch { _cache = {}; }
  return _cache!;
}

function saveQID(key: string, qid: string | null) {
  const c = loadCache();
  c[key] = { qid, fetchedAt: Date.now() };
  try { localStorage.setItem(QID_CACHE_KEY, JSON.stringify(c)); } catch {}
}

async function resolveQID(name: string): Promise<string | null> {
  const key    = name.toLowerCase();
  const cached = loadCache()[key];
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) return cached.qid;

  try {
    const url = `${WD_API}?action=wbsearchentities&search=${encodeURIComponent(name)}&language=en&type=item&format=json&origin=*&limit=5`;
    const res  = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) { saveQID(key, null); return null; }

    const data    = await res.json() as { search?: { id: string; label: string; description?: string }[] };
    const results = data.search ?? [];
    let qid: string | null = null;

    // Prefer exact-label match with a music-related description
    const MUSIC_TERMS = ["musician","singer","band","rapper","composer","group","guitarist",
                         "drummer","vocalist","folk","jazz","rock","electronic","producer"];
    for (const r of results) {
      const desc  = (r.description ?? "").toLowerCase();
      const label = r.label.toLowerCase();
      if (label === key && MUSIC_TERMS.some(t => desc.includes(t))) { qid = r.id; break; }
    }
    // Fallback: first exact-label match regardless of description
    if (!qid) {
      const exact = results.find(r => r.label.toLowerCase() === key);
      if (exact) qid = exact.id;
    }

    saveQID(key, qid);
    return qid;
  } catch {
    return null;
  }
}

export interface WDInfluenceEdge {
  source: string; // the influencer (may or may not be in collection)
  target: string; // the influenced artist (in collection)
  note:   string;
}

export async function fetchWikidataInfluences(
  artistNames: string[],
  onProgress?: (done: number, total: number) => void,
): Promise<WDInfluenceEdge[]> {

  // ── Step 1: resolve all names → QIDs (parallel batches of 8) ─────────────────
  const qidToName: Record<string, string> = {};
  const BATCH = 8;

  for (let i = 0; i < artistNames.length; i += BATCH) {
    const slice = artistNames.slice(i, i + BATCH);
    const qids  = await Promise.all(slice.map(n => resolveQID(n)));
    slice.forEach((name, j) => {
      if (qids[j]) qidToName[qids[j]!] = name;
    });
    onProgress?.(Math.min(i + BATCH, artistNames.length), artistNames.length);
    if (i + BATCH < artistNames.length) await new Promise(r => setTimeout(r, 300));
  }

  const qids = Object.keys(qidToName);
  if (qids.length === 0) return [];

  // ── Step 2: SPARQL batch — P737 "influenced by" for all resolved QIDs ─────────
  const CHUNK = 60; // Wikidata handles ~60 VALUES entries comfortably
  const edges: WDInfluenceEdge[] = [];

  for (let i = 0; i < qids.length; i += CHUNK) {
    const chunk  = qids.slice(i, i + CHUNK);
    const values = chunk.map(q => `wd:${q}`).join(" ");

    const sparql = `SELECT ?src ?tgt ?srcLabel ?tgtLabel WHERE {
  VALUES ?src { ${values} }
  ?src wdt:P737 ?tgt .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
}`;

    try {
      const url = `${SPARQL_URL}?query=${encodeURIComponent(sparql)}&format=json`;
      const res  = await fetch(url, {
        headers: { "Accept": "application/sparql-results+json", "User-Agent": UA },
      });
      if (!res.ok) continue;

      const data = await res.json() as {
        results: {
          bindings: {
            src:      { value: string };
            tgt:      { value: string };
            srcLabel?: { value: string };
            tgtLabel?: { value: string };
          }[];
        };
      };

      for (const b of data.results.bindings) {
        const srcQid     = b.src.value.split("/").pop()!;
        const targetName = qidToName[srcQid];   // the influenced (our collection artist)
        const sourceName = b.tgtLabel?.value;    // the influencer (anyone Wikidata knows)
        if (!targetName || !sourceName || sourceName === targetName) continue;
        edges.push({
          source: sourceName,
          target: targetName,
          note:   `${sourceName} influenced ${targetName} — Wikidata`,
        });
      }
    } catch { /* network error — skip chunk */ }

    if (i + CHUNK < qids.length) await new Promise(r => setTimeout(r, 600));
  }

  return edges;
}
