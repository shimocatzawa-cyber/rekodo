// ─── Shared list types ─────────────────────────────────────────────────────────

export type DiscoverList = {
  id: string;
  title: string;
  slug: string;
  username: string;
  displayName: string | null;
  covers: (string | null)[];
  itemCount: number;
  saveCount: number;
};

export type SlotItem = {
  id: string;
  item_type: "record" | "song";
  artist: string;
  album: string;
  year: number | null;
  genre: string | null;
  cover_url: string | null;
  song_title: string | null;
};

export type ListSlot = {
  position: number;
  item: SlotItem | null;
  note?: string | null;
  priority?: "must_have" | "would_love" | "someday" | null;
  price_cap?: number | null;
  pressing_tip?: string | null;
  found?: boolean | null;
  created_at?: string | null;
  source?: string | null;
  discogs_release_id?: number | null;
};

export type UserList = {
  id: string;
  title: string;
  slug: string;
  is_public: boolean;
  list_type: "top5" | "personal";
  slots: ListSlot[];
};
