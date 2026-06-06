import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { SlotItem, ListSlot } from "@/app/lists/page";

const SERIF = "var(--font-editorial)";
const MONO  = "var(--font-mono)";

type Params = Promise<{ username: string; slug: string }>;

export default async function PublicListPage({ params }: { params: Params }) {
  const { username: rawUsername, slug } = await params;
  const username = rawUsername.startsWith("@") ? rawUsername.slice(1) : rawUsername;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles").select("id, username").eq("username", username).maybeSingle();
  if (!profile) notFound();

  const { data: list } = await supabase
    .from("lists").select("id, title, slug, is_public, list_type").eq("user_id", profile.id).eq("slug", slug).maybeSingle();
  if (!list || !list.is_public) notFound();

  const { data: itemsData } = await supabase
    .from("list_items")
    .select("id, position, item_type, record_id, song_title, song_artist, song_album, song_cover_url, song_year")
    .eq("list_id", list.id)
    .order("position");

  const recordIds = (itemsData ?? []).filter(i => i.item_type !== "song" && i.record_id).map(i => i.record_id as string);

  const { data: recordsData } = recordIds.length
    ? await supabase.from("records").select("id, artist, album, year, genre, cover_url").in("id", recordIds)
    : { data: [] };

  const recordById = new Map((recordsData ?? []).map(r => [r.id, r]));

  const maxSlots = (list.list_type ?? "top5") === "top5" ? 5 : (itemsData?.length ?? 0);

  const slots: ListSlot[] = Array.from({ length: maxSlots }, (_, idx) => {
    const pos = idx + 1;
    const itemRow = (itemsData ?? []).find(i => i.position === pos);
    if (!itemRow) return { position: pos, item: null };

    if (itemRow.item_type === "song") {
      return {
        position: pos,
        item: {
          id: itemRow.id, item_type: "song",
          artist: itemRow.song_artist ?? "", album: itemRow.song_album ?? "",
          year: itemRow.song_year ?? null, genre: null,
          cover_url: itemRow.song_cover_url ?? null, song_title: itemRow.song_title,
        } satisfies SlotItem,
      };
    }

    const r = itemRow.record_id ? recordById.get(itemRow.record_id) : undefined;
    if (!r) return { position: pos, item: null };
    return {
      position: pos,
      item: {
        id: r.id, item_type: "record",
        artist: r.artist, album: r.album,
        year: r.year ?? null, genre: r.genre ?? null,
        cover_url: r.cover_url ?? null, song_title: null,
      } satisfies SlotItem,
    };
  });

  return (
    <div className="min-h-screen bg-white">
      <nav
        className="flex items-center justify-between px-8 md:px-12 py-6"
        style={{ borderBottom: "1px solid rgba(0,0,0,0.08)" }}
      >
        <a href="/" aria-label="rekōdo home" style={{ fontFamily: SERIF, fontWeight: 700, fontSize: "24px", color: "#CC5500", textDecoration: "none" }}>
          ō
        </a>
      </nav>

      <main className="px-8 md:px-12 py-12 w-full max-w-6xl mx-auto">
        <p style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#aaaaaa", marginBottom: "12px" }}>
          @{profile.username}
        </p>
        <h1 className="mb-12" style={{ fontFamily: SERIF, fontSize: "clamp(28px, 4vw, 48px)", color: "#0d0d0d", lineHeight: 1 }}>
          {list.title}
        </h1>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "16px" }}>
          {slots.map(({ position, item }) => (
            <div key={position}>
              <div style={{ aspectRatio: "1 / 1", position: "relative", overflow: "hidden", background: item ? "transparent" : "#f4f4f4", border: item ? "none" : "1px dashed rgba(0,0,0,0.12)" }}>
                {item?.cover_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.cover_url} alt={item.song_title ?? item.album} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                ) : (
                  <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontFamily: SERIF, fontSize: "22px", color: "#d0d0d0" }}>—</span>
                  </div>
                )}
                <span style={{ position: "absolute", top: "8px", left: "8px", fontFamily: MONO, fontSize: "9px", letterSpacing: "0.08em", color: item ? "rgba(255,255,255,0.8)" : "#c0c0c0", lineHeight: 1, textShadow: item ? "0 1px 2px rgba(0,0,0,0.5)" : "none" }}>
                  {position}
                </span>
              </div>

              <div style={{ marginTop: "10px" }}>
                {item ? (
                  <>
                    <p className="truncate" style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.08em", textTransform: "uppercase", color: "#aaaaaa", marginBottom: "3px" }}>
                      {item.artist}{item.year ? ` · ${item.year}` : ""}
                    </p>
                    <p style={{ fontFamily: SERIF, fontSize: "13px", color: "#0d0d0d", lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {item.song_title ?? item.album}
                    </p>
                    <div style={{ marginTop: "8px", display: "flex", flexWrap: "wrap", gap: "8px" }}>
                      {[
                        { label: "Discogs",     href: `https://www.discogs.com/search/?q=${encodeURIComponent(`${item.artist} ${item.song_title ?? item.album}`)}&type=release` },
                        { label: "Apple Music", href: `https://music.apple.com/search?term=${encodeURIComponent(`${item.artist} ${item.song_title ?? item.album}`)}` },
                        { label: "Tidal",       href: `https://tidal.com/search?q=${encodeURIComponent(`${item.artist} ${item.song_title ?? item.album}`)}` },
                        { label: "Spotify",     href: `https://open.spotify.com/search/${encodeURIComponent(`${item.artist} ${item.song_title ?? item.album}`)}` },
                      ].map(({ label, href }) => (
                        <a key={label} href={href} target="_blank" rel="noopener noreferrer" style={{ fontFamily: MONO, fontSize: "8px", letterSpacing: "0.05em", color: "#bbbbbb", textDecoration: "none", whiteSpace: "nowrap" }}>
                          {label} ↗
                        </a>
                      ))}
                    </div>
                  </>
                ) : (
                  <p style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.08em", textTransform: "uppercase", color: "#d0d0d0" }}>Empty</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
