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
        Row: { id: string; username: string; display_name: string | null; /** @deprecated use city + country */ location: string | null; bio: string | null; created_at: string; taste_summary: string | null; taste_summary_count: number | null; taste_summary_history: Json; last_synced_at: string | null; last_active_at: string | null; avatar_url: string | null; is_donor: boolean | null; is_public: boolean; is_test: boolean; city: string | null; country: string | null; country_code: string | null; star_sign: string | null; bandcamp_username: string | null; subscription_tier: string | null; role: string | null; referral_source: string | null };
        Insert: { id: string; username: string; display_name?: string | null; location?: string | null; bio?: string | null; created_at?: string; taste_summary?: string | null; taste_summary_count?: number | null; taste_summary_history?: Json; last_synced_at?: string | null; last_active_at?: string | null; avatar_url?: string | null; is_donor?: boolean | null; is_public?: boolean; is_test?: boolean; city?: string | null; country?: string | null; country_code?: string | null; star_sign?: string | null; bandcamp_username?: string | null; subscription_tier?: string | null; role?: string | null; referral_source?: string | null };
        Update: { username?: string; display_name?: string | null; location?: string | null; bio?: string | null; taste_summary?: string | null; taste_summary_count?: number | null; taste_summary_history?: Json; last_synced_at?: string | null; last_active_at?: string | null; avatar_url?: string | null; is_donor?: boolean | null; is_public?: boolean; is_test?: boolean; city?: string | null; country?: string | null; country_code?: string | null; star_sign?: string | null; bandcamp_username?: string | null; subscription_tier?: string | null; role?: string | null; referral_source?: string | null };
        Relationships: [];
      };
      page_views: {
        Row: { id: number; user_id: string; section: string; path: string; created_at: string };
        Insert: { id?: number; user_id: string; section: string; path: string; created_at?: string };
        Update: { section?: string; path?: string };
        Relationships: [];
      };
      digital_imports: {
        Row: { id: string; user_id: string; source: string; artist: string; album: string; is_duplicate: boolean; matched_record_id: string | null; imported_at: string };
        Insert: { id?: string; user_id: string; source?: string; artist: string; album: string; is_duplicate?: boolean; matched_record_id?: string | null; imported_at?: string };
        Update: { source?: string; artist?: string; album?: string; is_duplicate?: boolean; matched_record_id?: string | null; imported_at?: string };
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
          vinyl_colour: string | null;
          created_at: string;
          styles:                 string[] | null;
          community_have:         number | null;
          community_want:         number | null;
          community_num_for_sale: number | null;
          community_fetched_at:   string | null;
          discogs_artist_id:      number | null;
          producers:              string[] | null;
          barcode:                string | null;
          matrix:                 string[] | null;
          edition_size:           number | null;
        };
        Insert: {
          id?: string;
          discogs_id?: string | null;
          artist: string;
          album: string;
          year?: number | null;
          genre?: string | null;
          styles?: string[] | null;
          cover_url?: string | null;
          label?: string | null;
          format?: string | null;
          country?: string | null;
          vinyl_colour?: string | null;
          created_at?: string;
          community_have?:         number | null;
          community_want?:         number | null;
          community_num_for_sale?: number | null;
          community_fetched_at?:   string | null;
          discogs_artist_id?:      number | null;
          producers?:              string[] | null;
          barcode?:                string | null;
          matrix?:                 string[] | null;
          edition_size?:           number | null;
        };
        Update: {
          discogs_id?: string | null;
          artist?: string;
          album?: string;
          year?: number | null;
          genre?: string | null;
          styles?: string[] | null;
          cover_url?: string | null;
          label?: string | null;
          format?: string | null;
          country?: string | null;
          vinyl_colour?: string | null;
          community_have?:         number | null;
          community_want?:         number | null;
          community_num_for_sale?: number | null;
          community_fetched_at?:   string | null;
          discogs_artist_id?:      number | null;
          producers?:              string[] | null;
          barcode?:                string | null;
          matrix?:                 string[] | null;
          edition_size?:           number | null;
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
          media_condition:  string | null;
          sleeve_condition: string | null;
          open_to_offers:    boolean;
          open_to_offers_at: string | null;
          date_added:        string | null;
          is_essential:      boolean;
          feeling:           string | null;
          feeling_tagged_at: string | null;
          memory_text:       string | null;
          memory_shared:     boolean;
          copies:            number;
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
          media_condition?:  string | null;
          sleeve_condition?: string | null;
          open_to_offers?:    boolean;
          open_to_offers_at?: string | null;
          date_added?:        string | null;
          is_essential?:      boolean;
          feeling?:           string | null;
          feeling_tagged_at?: string | null;
          memory_text?:       string | null;
          memory_shared?:     boolean;
          copies?:            number;
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
          media_condition?:  string | null;
          sleeve_condition?: string | null;
          open_to_offers?:    boolean;
          open_to_offers_at?: string | null;
          date_added?:        string | null;
          is_essential?:      boolean;
          feeling?:           string | null;
          feeling_tagged_at?: string | null;
          memory_text?:       string | null;
          memory_shared?:     boolean;
          copies?:            number;
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
          source: string | null;
          discogs_release_id: number | null;
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
          source?: string | null;
          discogs_release_id?: number | null;
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
          source?: string | null;
          discogs_release_id?: number | null;
        };
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
      activity_events: {
        Row: { id: string; user_id: string; event_type: "play" | "wantlist_add" | "collection_add"; record_id: string; created_at: string };
        Insert: { id?: string; user_id: string; event_type: "play" | "wantlist_add" | "collection_add"; record_id: string; created_at?: string };
        Update: never;
        Relationships: [];
      };
      saved_lists: {
        Row: { id: string; user_id: string; list_id: string; saved_at: string };
        Insert: { id?: string; user_id: string; list_id: string; saved_at?: string };
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
      discogs_tokens: {
        Row: {
          user_id:          string;
          access_token:     string;
          token_secret:     string;
          discogs_username: string;
          created_at:       string;
          updated_at:       string;
        };
        Insert: {
          user_id:          string;
          access_token:     string;
          token_secret:     string;
          discogs_username: string;
          created_at?:      string;
          updated_at?:      string;
        };
        Update: {
          access_token?:     string;
          token_secret?:     string;
          discogs_username?: string;
          updated_at?:       string;
        };
        Relationships: [];
      };
      sync_queue: {
        Row: {
          id:              string;
          user_id:         string;
          status:          "pending" | "processing" | "completed" | "failed";
          phase:           string | null;
          total_records:   number;
          current_page:    number;
          total_pages:     number;
          progress_done:   number;
          new_added:       number;
          records_updated: number;
          error_message:   string | null;
          created_at:      string;
          updated_at:      string;
          started_at:      string | null;
          completed_at:    string | null;
        };
        Insert: {
          id?:              string;
          user_id:          string;
          status?:          "pending" | "processing" | "completed" | "failed";
          phase?:           string | null;
          total_records?:   number;
          current_page?:    number;
          total_pages?:     number;
          progress_done?:   number;
          new_added?:       number;
          records_updated?: number;
          error_message?:   string | null;
          created_at?:      string;
          updated_at?:      string;
          started_at?:      string | null;
          completed_at?:    string | null;
        };
        Update: {
          status?:          "pending" | "processing" | "completed" | "failed";
          phase?:           string | null;
          total_records?:   number;
          current_page?:    number;
          total_pages?:     number;
          progress_done?:   number;
          new_added?:       number;
          records_updated?: number;
          error_message?:   string | null;
          updated_at?:      string;
          started_at?:      string | null;
          completed_at?:    string | null;
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
      wantlist: {
        Row: {
          id:                 string;
          user_id:            string;
          discogs_release_id: number;
          catalog:            string | null;
          artist:             string;
          title:              string;
          label:              string | null;
          format:             string | null;
          released:           number | null;
          date_added:         string | null;
          cover_image_url:    string | null;
          created_at:         string;
        };
        Insert: {
          id?:                string;
          user_id:            string;
          discogs_release_id: number;
          catalog?:           string | null;
          artist:             string;
          title:              string;
          label?:             string | null;
          format?:            string | null;
          released?:          number | null;
          date_added?:        string | null;
          cover_image_url?:   string | null;
          created_at?:        string;
        };
        Update: {
          catalog?:           string | null;
          artist?:            string;
          title?:             string;
          label?:             string | null;
          format?:            string | null;
          released?:          number | null;
          date_added?:        string | null;
          cover_image_url?:   string | null;
        };
        Relationships: [];
      };
      collection_value_snapshots: {
        Row: {
          id:          string;
          user_id:     string;
          snapshot_at: string;
          value_low:   number | null;
          value_med:   number | null;
          value_high:  number | null;
          currency:    string | null;
          record_count: number | null;
        };
        Insert: {
          id?:          string;
          user_id:      string;
          snapshot_at?: string;
          value_low?:   number | null;
          value_med?:   number | null;
          value_high?:  number | null;
          currency?:    string | null;
          record_count?: number | null;
        };
        Update: {
          value_low?:   number | null;
          value_med?:   number | null;
          value_high?:  number | null;
          currency?:    string | null;
          record_count?: number | null;
        };
        Relationships: [];
      };
      label_feed: {
        Row: {
          id:               string;
          gmail_message_id: string | null;
          sender:           string | null;
          subject:          string | null;
          received_at:      string | null;
          artist:           string | null;
          album:            string | null;
          release_type:     "new_release" | "repress" | "preorder" | "announcement" | "unknown" | null;
          format:           string | null;
          label:            string | null;
          description:      string | null;
          tags:             string[] | null;
          created_at:       string | null;
        };
        Insert: {
          id?:               string;
          gmail_message_id?: string | null;
          sender?:           string | null;
          subject?:          string | null;
          received_at?:      string | null;
          artist?:           string | null;
          album?:            string | null;
          release_type?:     "new_release" | "repress" | "preorder" | "announcement" | "unknown" | null;
          format?:           string | null;
          label?:            string | null;
          description?:      string | null;
          tags?:             string[] | null;
          created_at?:       string | null;
        };
        Update: {
          gmail_message_id?: string | null;
          sender?:           string | null;
          subject?:          string | null;
          received_at?:      string | null;
          artist?:           string | null;
          album?:            string | null;
          release_type?:     "new_release" | "repress" | "preorder" | "announcement" | "unknown" | null;
          format?:           string | null;
          label?:            string | null;
          description?:      string | null;
          tags?:             string[] | null;
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
