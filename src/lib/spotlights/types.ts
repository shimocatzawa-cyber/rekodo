export interface SpotlightRelease {
  year: string;
  title: string;
  label?: string;   // artist spotlights
  artist?: string;  // label spotlights
  note: string;
  badge: string | null;
}

export interface SpotlightCell {
  title: string;
  body: string;
}

export interface SpotlightNeighbor {
  tag: string;
  artist: string;
  album: string;
  reason: string;
}

export interface SpotlightMeta {
  // artist
  label_affiliation?: string;
  active_period?: string;
  // label
  founded?: string;
  website?: string;
  // shared
  location?: string;
}

export interface Spotlight {
  id: string;
  type: "artist" | "label";
  month: string;
  status: "draft" | "active" | "archived";
  name: string;
  discogs_id: string;
  subtitle: string;
  meta: SpotlightMeta;
  bio: string[];
  releases: SpotlightRelease[];
  collector_notes: SpotlightCell[];
  neighbors: SpotlightNeighbor[];
  rekoodos_pick: string | null;
}

export interface SpotlightSummary {
  id: string;
  type: "artist" | "label";
  name: string;
  month: string;
}
