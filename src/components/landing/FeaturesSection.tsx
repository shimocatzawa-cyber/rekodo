const features = [
  {
    label: "Collection",
    title: "Your collection, catalogued.",
    body: "Search and add records via Discogs. Each piece in your collection is documented with cover art, artist, year, label, and estimated market value. Filter by genre. See your collection as it truly is.",
    imagePlaceholder: "collection",
    links: null as null,
  },
  {
    label: "Lists",
    title: "Top 5 lists, shared with the world.",
    body: "Build your definitive Top 5 All Time, Desert Island list, and Gateway Records. Every list lives at a public URL — rekodo.co/@you/listname — and appears on your profile. Taste made visible.",
    imagePlaceholder: "lists",
    links: null as null,
  },
  {
    label: "Dig",
    title: "Recommendations that know your taste.",
    body: "Claude reads your entire collection and surfaces three records you haven't heard yet — with plain English reasoning for each pick.",
    imagePlaceholder: "dig",
    links: [
      { name: "Bandcamp",    href: "https://bandcamp.com" },
      { name: "Apple Music", href: "https://music.apple.com" },
      { name: "Spotify",     href: "https://spotify.com" },
    ] as { name: string; href: string }[],
  },
];

export default function FeaturesSection() {
  return (
    <section className="py-32 px-8 md:px-12 lg:px-16 bg-white">
      {/* Section marker */}
      <div className="flex items-center gap-4 mb-24">
        <span
          className="text-xs tracking-widest uppercase text-[#CC5500]"
          style={{ fontFamily: "var(--font-dm-mono), 'Courier New', monospace" }}
        >
          Features
        </span>
        <div className="flex-1 h-px bg-black/10" />
      </div>

      <div className="space-y-40">
        {features.map((feature, i) => (
          <div
            key={feature.label}
            className={`grid grid-cols-1 lg:grid-cols-2 gap-16 items-center ${
              i % 2 === 1 ? "lg:flex-row-reverse" : ""
            }`}
          >
            {/* Image placeholder — greyscale photography */}
            <div
              className={`relative aspect-[4/5] bg-grey-100 overflow-hidden ${
                i % 2 === 1 ? "lg:order-2" : ""
              }`}
              style={{ backgroundColor: "#f4f4f4" }}
            >
              <div
                className="absolute inset-0 flex items-end p-8"
                style={{ background: "linear-gradient(to top, rgba(0,0,0,0.3) 0%, transparent 60%)" }}
              >
                <span
                  className="text-white/60 text-xs tracking-widest uppercase"
                  style={{ fontFamily: "var(--font-dm-mono), 'Courier New', monospace" }}
                >
                  {feature.imagePlaceholder}
                </span>
              </div>
            </div>

            {/* Text */}
            <div className={`space-y-8 ${i % 2 === 1 ? "lg:order-1" : ""}`}>
              <p
                className="text-xs tracking-widest uppercase text-[#CC5500]"
                style={{ fontFamily: "var(--font-dm-mono), 'Courier New', monospace" }}
              >
                {feature.label}
              </p>
              <h2
                className="text-4xl md:text-5xl leading-tight text-black"
                style={{ fontFamily: "var(--font-shippori), Georgia, serif" }}
              >
                {feature.title}
              </h2>
              <p
                className="text-base leading-relaxed text-black/60 max-w-sm"
                style={{ fontFamily: "var(--font-dm-mono), 'Courier New', monospace" }}
              >
                {feature.body}
              </p>

              {feature.links && (
                <div className="flex items-center gap-6 pt-2">
                  {feature.links.map((link) => (
                    <a
                      key={link.name}
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:opacity-60 transition-opacity"
                      style={{
                        fontFamily: "var(--font-dm-mono), 'Courier New', monospace",
                        fontSize: "11px",
                        color: "#444444",
                        letterSpacing: "0.06em",
                        textDecoration: "none",
                      }}
                    >
                      {link.name} ↗
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
