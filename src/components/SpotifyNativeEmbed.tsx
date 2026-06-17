"use client";

type Props = {
  uri: string | undefined;
  height?: number;
};

function toEmbedSrc(uri: string): string | null {
  const parts = uri.split(":");
  if (parts.length !== 3) return null;
  const [, type, id] = parts;
  if (!type || !id) return null;
  return `https://open.spotify.com/embed/${type}/${id}?utm_source=generator`;
}

export default function SpotifyNativeEmbed({ uri, height = 152 }: Props) {
  if (!uri) return null;
  const src = toEmbedSrc(uri);
  if (!src) return null;
  return (
    <iframe
      src={src}
      width="100%"
      height={height}
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
      loading="lazy"
      style={{ border: "none", display: "block" }}
    />
  );
}
