// Canvas-based Instagram Story card generator for rekōdo lists.
// Confirmed font family names from next/font compiled output:
//   Shippori Mincho → "Shippori Mincho"
//   DM Mono        → "DM Mono"

export interface ShareCardSlot {
  position: number;
  record: { artist: string; album: string; cover_url?: string | null } | null;
}

export interface ShareCardParams {
  title: string;
  slots: ShareCardSlot[];
  username: string;
}

const W = 1080;
const H = 1920;
const M = 150; // safe zone — all content stays M px from every edge
const CW = W - 2 * M; // 780 content width

const ORANGE = "#CC5500";
const INK = "#0d0d0d";
const GREY = "#888888";
const RULE_C = "rgba(0,0,0,0.08)";
const PALE_C = "#d4d4d4";
const SEP_C = "rgba(0,0,0,0.05)";
const ART_BG = "#eeeeee";

// ─── Album art layout ──────────────────────────────────────────────────────

const IMG_S   = 120;  // square album cover size
const NUM_W   = 30;   // column width for position number
const NUM_GAP = 14;   // gap: number → art
const ART_GAP = 18;   // gap: art → text
const IMG_X   = M + NUM_W + NUM_GAP;          // left edge of album art
const TXT_X   = IMG_X + IMG_S + ART_GAP;      // left edge of text
const TXT_MAX = M + CW - TXT_X;               // max text width
const ROW_H   = 148;                           // height per record row
const ROW_PAD = (ROW_H - IMG_S) / 2;          // vertical padding around art (14)

// ─── Font helpers ──────────────────────────────────────────────────────────

function serif(size: number, weight = 400): string {
  return `${weight} ${size}px "Shippori Mincho", Georgia, serif`;
}

function mono(size: number, weight = 400): string {
  return `${weight} ${size}px "DM Mono", "Courier New", monospace`;
}

async function loadFonts(): Promise<void> {
  const loads = [
    document.fonts.load(serif(30, 600)),
    document.fonts.load(serif(34, 600)),
    document.fonts.load(serif(40, 600)),
    document.fonts.load(serif(60, 700)),
    document.fonts.load(serif(76, 700)),
    document.fonts.load(serif(96, 700)),
    document.fonts.load(serif(120, 700)),
    document.fonts.load(mono(12)),
    document.fonts.load(mono(14)),
    document.fonts.load(mono(16)),
  ];
  await Promise.allSettled(loads);
  await document.fonts.ready;
}

// ─── Image loader ──────────────────────────────────────────────────────────

async function loadImage(url: string): Promise<HTMLImageElement | null> {
  try {
    const proxied = `/api/image-proxy?url=${encodeURIComponent(url)}`;
    const resp = await fetch(proxied, { signal: AbortSignal.timeout(8000) });
    if (!resp.ok) return null;
    const blob = await resp.blob();
    const objectUrl = URL.createObjectURL(blob);
    return new Promise((resolve) => {
      const img = new Image();
      img.onload  = () => { URL.revokeObjectURL(objectUrl); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(null); };
      img.src = objectUrl;
    });
  } catch {
    return null;
  }
}

// ─── Layout helpers ────────────────────────────────────────────────────────

function titleFontSize(title: string): number {
  const len = title.length;
  if (len <= 10) return 120;
  if (len <= 18) return 96;
  if (len <= 28) return 76;
  return 60;
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      if (lines.length >= maxLines) { line = ""; break; }
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines.length > 0 ? lines : [text];
}

function truncate(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth)
    t = t.slice(0, -1);
  return `${t}…`;
}

function hline(
  ctx: CanvasRenderingContext2D,
  x1: number, x2: number, y: number,
  color = RULE_C, width = 1
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, Math.round(y) + 0.5);
  ctx.lineTo(x2, Math.round(y) + 0.5);
  ctx.stroke();
  ctx.restore();
}

// ─── Main generator ────────────────────────────────────────────────────────

export async function generateShareCard(
  params: ShareCardParams
): Promise<HTMLCanvasElement> {
  const { title, slots, username } = params;

  await loadFonts();

  // Load all cover images in parallel (fall back to null on error/CORS)
  const coverImages = await Promise.all(
    [1, 2, 3, 4, 5].map(async (pos) => {
      const slot = slots.find(s => s.position === pos);
      const url  = slot?.record?.cover_url;
      if (!url) return null;
      return loadImage(url);
    })
  );

  const canvas = document.createElement("canvas");
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // ── Background ──────────────────────────────────────────────────────
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  ctx.textBaseline = "alphabetic";
  ctx.textAlign    = "left";

  // ── rekōdo wordmark ─────────────────────────────────────────────────
  const WORDMARK_Y = M + 56;
  ctx.font      = serif(30, 600);
  ctx.fillStyle = ORANGE;
  ctx.fillText("rekōdo", M, WORDMARK_Y);
  hline(ctx, M, M + CW, WORDMARK_Y + 26);

  // ── List title ──────────────────────────────────────────────────────
  const tSize      = titleFontSize(title);
  ctx.font         = serif(tSize, 700);
  ctx.fillStyle    = INK;
  const TITLE_Y    = WORDMARK_Y + 26 + 80;
  const titleLineH = tSize * 1.18;
  const titleLines = wrapText(ctx, title, CW, 2);

  titleLines.forEach((line, i) => {
    ctx.fillText(line, M, TITLE_Y + i * titleLineH);
  });

  const titleEndY = TITLE_Y + titleLines.length * titleLineH;

  // ── Rule before records ─────────────────────────────────────────────
  const PRE_REC_RULE_Y = Math.max(titleEndY + 72, M + 440);
  hline(ctx, M, M + CW, PRE_REC_RULE_Y);

  // ── Records ─────────────────────────────────────────────────────────
  const REC_START_Y = PRE_REC_RULE_Y + 56;

  for (let i = 0; i < 5; i++) {
    const slot      = slots.find(s => s.position === i + 1);
    const coverImg  = coverImages[i];
    const ry        = REC_START_Y + i * ROW_H;
    const imgTop    = ry + ROW_PAD;
    const num       = String(i + 1).padStart(2, "0");
    const hasRecord = Boolean(slot?.record);

    // ── Position number (vertically centered with art) ────────────────
    ctx.font      = mono(14);
    ctx.fillStyle = hasRecord ? ORANGE : PALE_C;
    ctx.fillText(num, M, imgTop + IMG_S / 2 + 6);

    // ── Album art or grey placeholder ─────────────────────────────────
    if (coverImg) {
      // Clip to a square to handle non-square source images cleanly
      ctx.save();
      ctx.beginPath();
      ctx.rect(IMG_X, imgTop, IMG_S, IMG_S);
      ctx.clip();
      ctx.drawImage(coverImg, IMG_X, imgTop, IMG_S, IMG_S);
      ctx.restore();
    } else {
      ctx.fillStyle = ART_BG;
      ctx.fillRect(IMG_X, imgTop, IMG_S, IMG_S);
      if (!hasRecord) {
        // Empty slot marker inside placeholder
        ctx.font      = mono(14);
        ctx.fillStyle = PALE_C;
        ctx.textAlign = "center";
        ctx.fillText("—", IMG_X + IMG_S / 2, imgTop + IMG_S / 2 + 6);
        ctx.textAlign = "left";
      }
    }

    // ── Text ──────────────────────────────────────────────────────────
    if (hasRecord && slot!.record) {
      const albumText  = truncate(ctx, slot!.record.album, TXT_MAX);
      const artistText = truncate(ctx, slot!.record.artist.toUpperCase(), TXT_MAX);

      ctx.font      = serif(34, 600);
      ctx.fillStyle = INK;
      ctx.fillText(albumText, TXT_X, imgTop + 40);

      ctx.font      = mono(12);
      ctx.fillStyle = GREY;
      ctx.fillText(artistText, TXT_X, imgTop + 66);
    }

    // ── Row separator (skip after last row) ───────────────────────────
    if (i < 4) {
      hline(ctx, IMG_X, M + CW, ry + ROW_H - 10, SEP_C);
    }
  }

  // ── Bottom attribution ──────────────────────────────────────────────
  const BOTTOM_RULE_Y = H - M - 82;
  hline(ctx, M, M + CW, BOTTOM_RULE_Y);

  const ATTR_Y = BOTTOM_RULE_Y + 48;

  ctx.font      = mono(16);
  ctx.fillStyle = INK;
  ctx.textAlign = "left";
  ctx.fillText(`@${username}`, M, ATTR_Y);

  ctx.font      = mono(13);
  ctx.fillStyle = GREY;
  ctx.textAlign = "right";
  ctx.fillText("rekodo.co", M + CW, ATTR_Y);

  ctx.textAlign = "left";
  return canvas;
}

// ─── Export utilities ─────────────────────────────────────────────────────

export function downloadCard(canvas: HTMLCanvasElement, listTitle: string) {
  const slug = listTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const link      = document.createElement("a");
  link.download   = `rekodo-${slug}.png`;
  link.href       = canvas.toDataURL("image/png");
  link.click();
}

export async function copyCardToClipboard(
  canvas: HTMLCanvasElement
): Promise<boolean> {
  try {
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
        "image/png"
      );
    });
    await navigator.clipboard.write([
      new ClipboardItem({ "image/png": blob }),
    ]);
    return true;
  } catch {
    return false;
  }
}
