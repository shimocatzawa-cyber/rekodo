export type SymbolDef = { key: string; insert: string; filled: boolean; d: string };

export const SYMBOLS: SymbolDef[] = [
  {
    key: "heart", insert: "♥", filled: true,
    d: "M12 20C12 20 3 14.5 3 8.5C3 5.5 5.5 3 8.5 3C10.2 3 11.8 4 12 5.5C12.2 4 13.8 3 15.5 3C18.5 3 21 5.5 21 8.5C21 14.5 12 20 12 20Z",
  },
  {
    key: "star", insert: "★", filled: true,
    d: "M12 2L14.5 9.2L22 9.2L16.3 13.7L18.3 21L12 17L5.7 21L7.7 13.7L2 9.2L9.5 9.2Z",
  },
  {
    key: "note", insert: "♪", filled: true,
    d: "M16 3.5L16 15C16 17.2 14.2 18.5 12 18.5C9.8 18.5 8 17.2 8 15C8 12.8 9.8 11.5 12 11.5C13.2 11.5 14.2 12 15 12.8L15 6.5Z",
  },
  {
    key: "moon", insert: "☾", filled: true,
    d: "M17.5 12C17.5 16.1 14.1 19.5 10 19.5C9.5 19.5 9 19.4 8.5 19.3C11 18.5 12.5 15.4 12.5 12C12.5 8.6 11 5.5 8.5 4.7C9 4.6 9.5 4.5 10 4.5C14.1 4.5 17.5 7.9 17.5 12Z",
  },
  {
    key: "sparkle", insert: "✦", filled: true,
    d: "M12 2L13.3 10.7L22 12L13.3 13.3L12 22L10.7 13.3L2 12L10.7 10.7Z",
  },
  {
    key: "wave", insert: "〜", filled: false,
    d: "M2 13C5 9 7 9 10 13C13 17 15 17 18 13C19.5 11 21 11 22 13",
  },
  {
    key: "arrow", insert: "→", filled: false,
    d: "M3 12H20M14 7L20 12L14 17",
  },
  {
    key: "sun", insert: "☀", filled: false,
    d: "M12 4V2M12 22V20M4 12H2M22 12H20M6.34 6.34L4.93 4.93M19.07 19.07L17.66 17.66M17.66 6.34L19.07 4.93M4.93 19.07L6.34 17.66M16 12A4 4 0 1 1 8 12A4 4 0 0 1 16 12Z",
  },
  {
    key: "flame", insert: "♨", filled: true,
    d: "M12 2C9.5 7 7 11 7 14.5C7 17.5 9.2 20 12 20C14.8 20 17 17.5 17 14.5C17 11 14.5 7 12 2Z",
  },
  {
    key: "diamond", insert: "◆", filled: true,
    d: "M12 2L22 12L12 22L2 12Z",
  },
  {
    key: "lightning", insert: "⚡", filled: true,
    d: "M13 2L3 14H11L11 22L21 10H13Z",
  },
  {
    key: "infinity", insert: "∞", filled: false,
    d: "M5 12C5 9.8 6.8 8 9 8C11.2 8 12 10 13 12C14 14 14.8 16 17 16C19.2 16 21 14.2 21 12C21 9.8 19.2 8 17 8C14.8 8 14 10 13 12C12 14 11.2 16 9 16C6.8 16 5 14.2 5 12Z",
  },
  {
    key: "crown", insert: "♛", filled: true,
    d: "M3 18L6 8L10.5 13.5L12 6L13.5 13.5L18 8L21 18H3Z",
  },
  {
    key: "snowflake", insert: "❄", filled: false,
    d: "M12 2V22M2 12H22M5.6 5.6L18.4 18.4M18.4 5.6L5.6 18.4M12 6L9 9M12 6L15 9M12 18L9 15M12 18L15 15M6 12L9 9M6 12L9 15M18 12L15 9M18 12L15 15",
  },
];

export const SYMBOL_MAP: Record<string, SymbolDef> = Object.fromEntries(
  SYMBOLS.map(s => [s.key, s])
);

export type Stamp = { id: string; key: string; x: number; y: number };
