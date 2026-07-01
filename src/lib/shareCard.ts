// Canvas share card generator — 1080×1350 (Instagram feed / 4:5 ratio)

export interface ShareCardSlot {
  position: number;
  record: { artist: string; album: string; cover_url?: string | null } | null;
}

export interface ShareCardParams {
  title:    string;
  slots:    ShareCardSlot[];
  username: string;
}

const W      = 1080;
const H      = 1350;
const MARGIN = 32;
const CW     = W - 2 * MARGIN; // 1016

// Palette
const BG        = "#F6F3EB";          // warm ivory
const INK       = "#222222";          // charcoal
const OG_MARK   = "#C96A2B";          // burnt orange — "ō" only
const MUTED     = "#888888";
const PALE      = "#c0bcb4";          // empty-slot accents
const ART_BG    = "#dddad2";          // empty slot fill
const RULE_C    = "rgba(34,34,34,0.10)";

// Layout
const LOGO_Y      = 86;               // wordmark baseline
const LOGO_RULE_Y = LOGO_Y + 20;      // 106
const TITLE_Y     = LOGO_RULE_Y + 42; // 148  — title starts here
const ARTWORK_Y   = 284;              // artwork grid top (room for 2-line titles)

const GAP     = 6;                    // gap between covers

// Row 1: positions 1–3 (3 equal squares)
const R1      = 3;
const R1_SIZE = Math.floor((CW - GAP * (R1 - 1)) / R1); // 334

// Row 2: positions 4–5 (2 wider squares)
const R2      = 2;
const R2_SIZE = Math.floor((CW - GAP * (R2 - 1)) / R2); // 505

const R2_Y = ARTWORK_Y + R1_SIZE + GAP; // 284+334+6 = 624

// Footer
const FOOTER_RULE_Y = 1165;
const FOOTER_U_Y    = 1230; // @username baseline
const FOOTER_D_Y    = 1258; // rekodo.co baseline

// ─── Font helpers ──────────────────────────────────────────────────────────

function serif(size: number, weight = 400): string {
  return `${weight} ${size}px "Shippori Mincho", Georgia, serif`;
}

function mono(size: number, weight = 400): string {
  return `${weight} ${size}px "DM Mono", "Courier New", monospace`;
}

async function loadFonts(): Promise<void> {
  const loads = [
    document.fonts.load(serif(28)),
    document.fonts.load(serif(30)),
    document.fonts.load(serif(36)),
    document.fonts.load(serif(42)),
    document.fonts.load(serif(48)),
    document.fonts.load(mono(13)),
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
    const resp    = await fetch(proxied, { signal: AbortSignal.timeout(8000) });
    if (!resp.ok) return null;
    const blob      = await resp.blob();
    const objectUrl = URL.createObjectURL(blob);
    return new Promise(resolve => {
      const img    = new Image();
      img.onload   = () => { URL.revokeObjectURL(objectUrl); resolve(img); };
      img.onerror  = () => { URL.revokeObjectURL(objectUrl); resolve(null); };
      img.src      = objectUrl;
    });
  } catch {
    return null;
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function titleFontSize(title: string): number {
  const n = title.length;
  if (n <= 12) return 48;
  if (n <= 22) return 42;
  if (n <= 34) return 36;
  return 30;
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      if (lines.length >= maxLines) break;
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  return lines.length > 0 ? lines : [text];
}

function hline(
  ctx: CanvasRenderingContext2D,
  x1: number, x2: number, y: number,
  color = RULE_C, lw = 1,
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth   = lw;
  ctx.beginPath();
  ctx.moveTo(x1, Math.round(y) + 0.5);
  ctx.lineTo(x2, Math.round(y) + 0.5);
  ctx.stroke();
  ctx.restore();
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  x: number, y: number, size: number,
  position: number, hasRecord: boolean,
) {
  // Cover image or ivory placeholder
  if (img) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, size, size);
    ctx.clip();
    ctx.drawImage(img, x, y, size, size);
    ctx.restore();
  } else {
    ctx.fillStyle = ART_BG;
    ctx.fillRect(x, y, size, size);
  }

  // Position number — scales proportionally with cover
  const numSize = Math.max(14, Math.round(size * 0.042));
  ctx.font = mono(numSize);
  if (img) {
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur  = 6;
    ctx.fillStyle   = "rgba(255,255,255,0.82)";
    ctx.fillText(String(position), x + 10, y + numSize + 9);
    ctx.restore();
  } else {
    ctx.fillStyle = hasRecord ? OG_MARK : PALE;
    ctx.fillText(String(position), x + 10, y + numSize + 9);
  }
}

// ─── Main generator ────────────────────────────────────────────────────────

export async function generateShareCard(
  params: ShareCardParams,
): Promise<HTMLCanvasElement> {
  const { title, slots, username } = params;

  await loadFonts();

  const coverImages = await Promise.all(
    [1, 2, 3, 4, 5].map(async pos => {
      const url = slots.find(s => s.position === pos)?.record?.cover_url;
      return url ? loadImage(url) : null;
    }),
  );

  const canvas    = document.createElement("canvas");
  canvas.width    = W;
  canvas.height   = H;
  const ctx       = canvas.getContext("2d")!;

  // Background
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = "alphabetic";

  // ── Bicolor wordmark: rek + ō + do ──────────────────────────────────────
  ctx.font      = serif(28);
  ctx.textAlign = "left";
  const w_rek   = ctx.measureText("rek").width;
  const w_o     = ctx.measureText("ō").width;
  const w_do    = ctx.measureText("do").width;
  const logoX   = (W - w_rek - w_o - w_do) / 2;

  ctx.fillStyle = INK;     ctx.fillText("rek", logoX,           LOGO_Y);
  ctx.fillStyle = OG_MARK; ctx.fillText("ō",   logoX + w_rek,   LOGO_Y);
  ctx.fillStyle = INK;     ctx.fillText("do",  logoX + w_rek + w_o, LOGO_Y);

  hline(ctx, MARGIN, MARGIN + CW, LOGO_RULE_Y);

  // ── List title (centered, max 2 lines) ──────────────────────────────────
  const tSize  = titleFontSize(title);
  ctx.font     = serif(tSize);
  ctx.textAlign = "center";
  ctx.fillStyle = INK;

  const titleLines = wrapText(ctx, title, CW * 0.88, 2);
  const lineH      = tSize * 1.28;
  titleLines.forEach((line, i) => ctx.fillText(line, W / 2, TITLE_Y + i * lineH));

  ctx.textAlign = "left";

  // ── Artwork grid ─────────────────────────────────────────────────────────
  // Row 1: positions 1, 2, 3
  for (let i = 0; i < 3; i++) {
    const pos   = i + 1;
    const slot  = slots.find(s => s.position === pos);
    const x     = MARGIN + i * (R1_SIZE + GAP);
    drawCover(ctx, coverImages[i], x, ARTWORK_Y, R1_SIZE, pos, Boolean(slot?.record));
  }

  // Row 2: positions 4, 5
  for (let i = 0; i < 2; i++) {
    const pos   = i + 4;
    const slot  = slots.find(s => s.position === pos);
    const x     = MARGIN + i * (R2_SIZE + GAP);
    drawCover(ctx, coverImages[i + 3], x, R2_Y, R2_SIZE, pos, Boolean(slot?.record));
  }

  // ── Footer ───────────────────────────────────────────────────────────────
  hline(ctx, MARGIN, MARGIN + CW, FOOTER_RULE_Y);

  ctx.textAlign = "center";

  ctx.font      = mono(16);
  ctx.fillStyle = INK;
  ctx.fillText(`@${username}`, W / 2, FOOTER_U_Y);

  ctx.font      = mono(13);
  ctx.fillStyle = MUTED;
  ctx.fillText("rekodo.co", W / 2, FOOTER_D_Y);

  ctx.textAlign = "left";
  return canvas;
}

// ─── Export utilities ──────────────────────────────────────────────────────

export function downloadCard(canvas: HTMLCanvasElement, listTitle: string) {
  const slug    = listTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  const link    = document.createElement("a");
  link.download = `rekodo-${slug}.png`;
  link.href     = canvas.toDataURL("image/png");
  link.click();
}

export async function copyCardToClipboard(canvas: HTMLCanvasElement): Promise<boolean> {
  try {
    const blob = await getCardBlob(canvas);
    if (!blob) return false;
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    return true;
  } catch {
    return false;
  }
}

export function getCardBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise(resolve => canvas.toBlob(b => resolve(b), "image/png"));
}

export function trackShareCard(cardType: string, action: "download" | "copy"): void {
  fetch("/api/track-share-card", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cardType, action }),
    keepalive: true,
  }).catch(() => {});
}
