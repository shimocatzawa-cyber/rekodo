import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { SlotItem, ListSlot } from "@/app/lists/types";
import PublicListClient, { type PublicComment } from "@/components/lists/PublicListClient";

export const dynamic = "force-dynamic";

const SERIF = "var(--font-editorial)";
const MONO  = "var(--font-mono)";

type Params = Promise<{ username: string; slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { username, slug } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles").select("id, display_name").eq("username", username).maybeSingle();
  if (!profile) return { title: "List not found" };

  const { data: list } = await supabase
    .from("lists").select("title, is_public").eq("user_id", profile.id).eq("slug", slug).maybeSingle();
  if (!list || !list.is_public) return { robots: { index: false } };

  const name = profile.display_name?.trim() || username;
  const description = `A curated list by ${name} on rekōdo.`;

  return {
    title: list.title,
    description,
    alternates: { canonical: `https://rekodo.co/@${username}/${slug}` },
    openGraph: {
      title: `${list.title} — ${name} on rekōdo`,
      description,
      url: `https://rekodo.co/@${username}/${slug}`,
      type: "article",
    },
    twitter: { card: "summary", title: `${list.title} — ${name} on rekōdo`, description },
  };
}

export default async function PublicListPage({ params }: { params: Params }) {
  const { username, slug } = await params;
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
  const maxSlots   = (list.list_type ?? "top5") === "top5" ? 5 : (itemsData?.length ?? 0);

  const slots: ListSlot[] = Array.from({ length: maxSlots }, (_, idx) => {
    const pos     = idx + 1;
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

  const { data: { user: viewer } } = await supabase.auth.getUser();
  const viewerUserId = viewer?.id ?? null;
  const isOwner      = viewerUserId === profile.id;

  // Likes & Comments — graceful fallback if tables not yet migrated
  let likeCount            = 0;
  let initialLiked         = false;
  let initialComments: PublicComment[] = [];
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count } = await (supabase as any)
      .from("list_likes").select("*", { count: "exact", head: true }).eq("list_id", list.id);
    likeCount = count ?? 0;

    if (viewerUserId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: likeRow } = await (supabase as any)
        .from("list_likes").select("id").eq("list_id", list.id).eq("user_id", viewerUserId).maybeSingle();
      initialLiked = Boolean(likeRow);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: commentsRaw } = await (supabase as any)
      .from("list_comments")
      .select("id, user_id, body, created_at, profiles(username, avatar_url)")
      .eq("list_id", list.id)
      .order("created_at", { ascending: false });
    initialComments = (commentsRaw ?? []) as PublicComment[];
  } catch {
    // tables not yet created — page renders with empty social state
  }

  return (
    <div className="min-h-screen bg-white">
      <nav
        className="flex items-center justify-between px-8 md:px-12 py-6"
        style={{ borderBottom: "1px solid rgba(0,0,0,0.08)" }}
      >
        <a href="/" aria-label="rekōdo home" style={{ fontFamily: SERIF, fontWeight: 700, fontSize: "24px", color: "#CC5500", textDecoration: "none" }}>
          ō
        </a>
        <a href={`/@${profile.username}`} style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.08em", color: "#aaa", textDecoration: "none" }}>
          @{profile.username}
        </a>
      </nav>

      <main className="px-8 md:px-12 py-12 w-full max-w-6xl mx-auto">
        <p style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#aaaaaa", marginBottom: "12px" }}>
          @{profile.username}
        </p>
        <PublicListClient
          listId={list.id}
          ownerId={profile.id}
          listTitle={list.title}
          username={profile.username}
          slots={slots}
          initialLikeCount={likeCount}
          initialLiked={initialLiked}
          initialComments={initialComments}
          viewerUserId={viewerUserId}
          isOwner={isOwner}
        />
      </main>
    </div>
  );
}
