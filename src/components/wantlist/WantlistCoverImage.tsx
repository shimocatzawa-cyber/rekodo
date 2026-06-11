"use client";

import { useRef, useState, useEffect } from "react";

interface Props {
  releaseId: number;
  initialUrl: string | null;
  alt: string;
  catalog: string | null;
}

export default function WantlistCoverImage({ releaseId, initialUrl, alt, catalog }: Props) {
  const ref        = useRef<HTMLDivElement>(null);
  const [url, setUrl] = useState<string | null>(initialUrl);
  const [loaded, setLoaded] = useState(false);
  const fetched = useRef(false);

  useEffect(() => {
    if (url || fetched.current) return;

    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        observer.disconnect();
        if (fetched.current) return;
        fetched.current = true;

        fetch(`/api/wantlist/cover?release_id=${releaseId}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((data: { url?: string } | null) => {
            if (data?.url) setUrl(data.url);
          })
          .catch(() => {});
      },
      { rootMargin: "200px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [releaseId, url]);

  return (
    <div
      ref={ref}
      style={{
        aspectRatio: "1 / 1",
        background: "#f7f7f5",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={alt}
          onLoad={() => setLoaded(true)}
          onError={() => setUrl(null)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
            opacity: loaded ? 1 : 0,
            transition: "opacity 0.3s ease",
          }}
        />
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "8px",
          }}
        >
          {catalog && (
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "0.6rem",
                letterSpacing: "0.06em",
                color: "#bbbbbb",
                textAlign: "center",
                wordBreak: "break-all",
                lineHeight: 1.3,
              }}
            >
              {catalog}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
