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
        Row: { id: string; username: string; display_name: string | null; /** @deprecated use city + country */ location: string | null; bio: string | null; created_at: string; taste_summary: string | null; taste_summary_count: number | null; last_synced_at: string | null; avatar_url: string | null; is_donor: boolean | null; is_public: boolean; city: string | null; country: string | null; country_code: string | null; star_sign: string | null };
        Insert: { id: string; username: string; display_name?: string | null; location?: string | null; bio?: string | null; created_at?: string; taste_summary?: string | null; taste_summary_count?: number | null; last_synced_at?: string | null; avatar_url?: string | null; is_donor?: boolean | null; is_public?: boolean; city?: string | null; country?: string | null; country_code?: string | null; star_sign?: string | null };
        Update: { username?: string; display_name?: string | null; location?: string | null; bio?: string | null; taste_summary?: string | null; taste_summary_count?: number | null; last_synced_at?: string | null; avatar_url?: string | null; is_donor?: boolean | null; is_public?: boolean; city?: string | null; country?: string | null; country_code?: string | null; star_sign?: string | null };
        Relationships: [];
      };
      collection_photos: {
        Row: { id: string; user_id: string; storage_path: string; display_order: number; created_at: string };
        Insert: { id?: string; user_id: string; storage_path: string; display_order: number; created_at?: string };
        Update: { storage_path?: string; display_order?: number };
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
      collection_intelligence: {
        Row: {
          user_id: string;
          top_artists: Json | null;
          top_labels: Json | null;
          top_genres: Json | null;
          top_decades: Json | null;
          top_countries: Json | null;
          taste_summary: string | null;
          last_computed_at: string;
        };
        Insert: {
          user_id: string;
          top_artists?: Json | null;
          top_labels?: Json | null;
          top_genres?: Json | null;
          top_decades?: Json | null;
          top_countries?: Json | null;
          taste_summary?: string | null;
          last_computed_at?: string;
        };
        Update: {
          top_artists?: Json | null;
          top_labels?: Json | null;
          top_genres?: Json | null;
          top_decades?: Json | null;
          top_countries?: Json | null;
          taste_summary?: string | null;
          last_computed_at?: string;
        };
        Relationships: [];
      };
      library_recommendations: {
        Row: {
          id: string;
          user_id: string;
          format: "podcast" | "book" | "audible" | null;
          title: string;
          creator: string | null;
          description: string | null;
          match_reason: string | null;
          match_artists: string[] | null;
          match_labels: string[] | null;
          external_url: string | null;
          affiliate_url: string | null;
          thumbnail_url: string | null;
          source_api: string | null;
          source_id: string | null;
          artist_coverage_depth: "dedicated" | "primary" | "passing" | null;
          relevance_score: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          format?: "podcast" | "book" | "audible" | null;
          title: string;
          creator?: string | null;
          description?: string | null;
          match_reason?: string | null;
          match_artists?: string[] | null;
          match_labels?: string[] | null;
          external_url?: string | null;
          affiliate_url?: string | null;
          thumbnail_url?: string | null;
          source_api?: string | null;
          source_id?: string | null;
          artist_coverage_depth?: "dedicated" | "primary" | "passing" | null;
          relevance_score?: number | null;
          created_at?: string;
        };
        Update: {
          format?: "podcast" | "book" | "audible" | null;
          title?: string;
          creator?: string | null;
          description?: string | null;
          match_reason?: string | null;
          match_artists?: string[] | null;
          match_labels?: string[] | null;
          external_url?: string | null;
          affiliate_url?: string | null;
          thumbnail_url?: string | null;
          source_api?: string | null;
          source_id?: string | null;
          artist_coverage_depth?: "dedicated" | "primary" | "passing" | null;
          relevance_score?: number | null;
        };
        Relationships: [];
      };
      library_wantlist: {
        Row: {
          id: string;
          user_id: string;
          recommendation_id: string | null;
          format: "podcast" | "book" | "audible" | null;
          title: string | null;
          creator: string | null;
          external_url: string | null;
          affiliate_url: string | null;
          thumbnail_url: string | null;
          match_reason: string | null;
          status: "saved" | "in_progress" | "done";
          added_at: string;
          actioned_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          recommendation_id?: string | null;
          format?: "podcast" | "book" | "audible" | null;
          title?: string | null;
          creator?: string | null;
          external_url?: string | null;
          affiliate_url?: string | null;
          thumbnail_url?: string | null;
          match_reason?: string | null;
          status?: "saved" | "in_progress" | "done";
          added_at?: string;
          actioned_at?: string | null;
        };
        Update: {
          format?: "podcast" | "book" | "audible" | null;
          title?: string | null;
          creator?: string | null;
          external_url?: string | null;
          affiliate_url?: string | null;
          thumbnail_url?: string | null;
          match_reason?: string | null;
          status?: "saved" | "in_progress" | "done";
          actioned_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
