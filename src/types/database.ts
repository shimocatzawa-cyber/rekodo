export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; username: string; display_name: string | null; location: string | null; bio: string | null; created_at: string; taste_summary: string | null; taste_summary_count: number | null; last_synced_at: string | null; avatar_url: string | null; is_donor: boolean | null };
        Insert: { id: string; username: string; display_name?: string | null; location?: string | null; bio?: string | null; created_at?: string; taste_summary?: string | null; taste_summary_count?: number | null; last_synced_at?: string | null; avatar_url?: string | null; is_donor?: boolean | null };
        Update: { username?: string; display_name?: string | null; location?: string | null; bio?: string | null; taste_summary?: string | null; taste_summary_count?: number | null; last_synced_at?: string | null; avatar_url?: string | null; is_donor?: boolean | null };
        Relationships: [];
      };
      records: {
        Row: {
          id: string;
          discogs_id: string | null;
          artist: string;
          album: string;
          year: number | null;
          genre: string | null;
          cover_url: string | null;
          label: string | null;
          format: string | null;
          country: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          discogs_id?: string | null;
          artist: string;
          album: string;
          year?: number | null;
          genre?: string | null;
          cover_url?: string | null;
          label?: string | null;
          format?: string | null;
          country?: string | null;
          created_at?: string;
        };
        Update: {
          discogs_id?: string | null;
          artist?: string;
          album?: string;
          year?: number | null;
          genre?: string | null;
          cover_url?: string | null;
          label?: string | null;
          format?: string | null;
          country?: string | null;
        };
        Relationships: [];
      };
      user_records: {
        Row: {
          id: string;
          user_id: string;
          record_id: string;
          value: number | null;
          plays: number;
          created_at: string;
          price_last_sold:  number | null;
          price_low:        number | null;
          price_median:     number | null;
          price_high:       number | null;
          price_currency:   string | null;
          price_fetched_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          record_id: string;
          value?: number | null;
          plays?: number;
          created_at?: string;
          price_last_sold?:  number | null;
          price_low?:        number | null;
          price_median?:     number | null;
          price_high?:       number | null;
          price_currency?:   string | null;
          price_fetched_at?: string | null;
        };
        Update: {
          value?: number | null;
          plays?: number;
          price_last_sold?:  number | null;
          price_low?:        number | null;
          price_median?:     number | null;
          price_high?:       number | null;
          price_currency?:   string | null;
          price_fetched_at?: string | null;
        };
        Relationships: [];
      };
      lists: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          slug: string;
          is_public: boolean;
          list_type: "top5" | "personal";
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          slug: string;
          is_public?: boolean;
          list_type?: "top5" | "personal";
          created_at?: string;
        };
        Update: {
          title?: string;
          slug?: string;
          is_public?: boolean;
          list_type?: "top5" | "personal";
        };
        Relationships: [];
      };
      list_items: {
        Row: {
          id: string;
          list_id: string;
          record_id: string | null;
          position: number;
          item_type: "record" | "song";
          song_title: string | null;
          song_artist: string | null;
          song_album: string | null;
          song_cover_url: string | null;
          song_year: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          list_id: string;
          record_id?: string | null;
          position: number;
          item_type?: "record" | "song";
          song_title?: string | null;
          song_artist?: string | null;
          song_album?: string | null;
          song_cover_url?: string | null;
          song_year?: number | null;
          created_at?: string;
        };
        Update: {
          record_id?: string | null;
          position?: number;
          item_type?: "record" | "song";
          song_title?: string | null;
          song_artist?: string | null;
          song_album?: string | null;
          song_cover_url?: string | null;
          song_year?: number | null;
        };
        Relationships: [];
      };
      waitlist_emails: {
        Row: { id: string; email: string; name: string | null; created_at: string };
        Insert: { id?: string; email: string; name?: string | null; created_at?: string };
        Update: { email?: string; name?: string | null };
        Relationships: [];
      };
      compatibility_scores: {
        Row: { id: string; user_id_a: string; user_id_b: string; score: number; shared_tags: string[]; calculated_at: string };
        Insert: { id?: string; user_id_a: string; user_id_b: string; score: number; shared_tags?: string[]; calculated_at?: string };
        Update: { score?: number; shared_tags?: string[]; calculated_at?: string };
        Relationships: [];
      };
      follows: {
        Row: { id: string; follower_id: string; following_id: string; created_at: string };
        Insert: { id?: string; follower_id: string; following_id: string; created_at?: string };
        Update: never;
        Relationships: [];
      };
      gig_cache: {
        Row: { id: string; cache_key: string; results: Json; cached_at: string };
        Insert: { id?: string; cache_key: string; results?: Json; cached_at?: string };
        Update: { results?: Json; cached_at?: string };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
