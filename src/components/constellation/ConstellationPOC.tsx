"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchMBArtist, mbRelToConstellation } from "@/lib/musicbrainz";
import { fetchDiscogsArtist } from "@/lib/discogs-artist";

// ── Types ──────────────────────────────────────────────────────────────────────

type RelType = "splinter" | "collaboration" | "influence" | "scene" | "label" | "production";

interface CuratedEdge {
  source: string; target: string;
  type: RelType; weight: number;
  note: string;
  via?: string;
}

interface LabelGroup  { label: string; artists: string[]; }
interface StyleGroup  { style: string; artists: string[]; }
interface LineageEdge { source: string; target: string; note: string; via: "mb" | "discogs"; }
interface InflEdge    { source: string; target: string; type: RelType; note: string; via?: string; }

// ── Design tokens ──────────────────────────────────────────────────────────────

const BG     = "#06091a";
const INK    = "#ddd8cc";
const DIM2   = "rgba(221,216,204,0.60)";
const DIM3   = "rgba(221,216,204,0.32)";
const ORANGE = "#CC5500";
const BORD   = "rgba(221,216,204,0.10)";
const MONO   = '"DM Mono", "Courier New", monospace';
const SERIF  = '"Shippori Mincho", Georgia, serif';

// ── Curated influence graph ────────────────────────────────────────────────────
// Used only to surface influence/scene/collaboration connections between owned artists.
// Accuracy requirement: both source and target must be in the user's collection.

const CURATED_EDGES: CuratedEdge[] = [
  // Folk / Americana lineage
  { source: "bob_dylan",          target: "neil_young",           type: "influence",  weight: 0.90, note: "Dylan's electric turn gave Young permission to go there" },
  { source: "bob_dylan",          target: "townes_van_zandt",     type: "influence",  weight: 0.95, note: "Van Zandt carried Dylan's weight into darker country" },
  { source: "bob_dylan",          target: "ryan_adams",           type: "influence",  weight: 0.80, note: "Adams called Dylan his north star, repeatedly" },
  { source: "bob_dylan",          target: "smog",                 type: "influence",  weight: 0.65, note: "Callahan's language and cadence owes Dylan" },
  { source: "townes_van_zandt",   target: "ryan_adams",           type: "influence",  weight: 0.85, note: "Adams covered Townes; cites him as formative" },
  { source: "townes_van_zandt",   target: "bonnie_prince_billy",  type: "influence",  weight: 0.75, note: "Will Oldham counts Van Zandt among his few heroes" },
  { source: "townes_van_zandt",   target: "songs_ohia",           type: "influence",  weight: 0.80, note: "Jason Molina's entire outlook is a Townes descendant" },
  { source: "neil_young",         target: "wilco",                type: "influence",  weight: 0.75, note: "Tweedy draws from Young's distorted rawness" },
  { source: "neil_young",         target: "big_thief",            type: "influence",  weight: 0.70, note: "Adrianne Lenker has named Young's vulnerability" },
  { source: "neil_young",         target: "devendra_banhart",     type: "influence",  weight: 0.60, note: "The acoustic pastoral thread runs through Banhart" },
  { source: "john_fahey",         target: "m_ward",               type: "influence",  weight: 0.90, note: "Fahey's American Primitive is the foundation under Ward" },
  { source: "john_fahey",         target: "devendra_banhart",     type: "influence",  weight: 0.75, note: "Banhart names Fahey as a central influence" },
  { source: "john_fahey",         target: "bonnie_prince_billy",  type: "influence",  weight: 0.70, note: "Will Oldham's fingerpicking owes Fahey directly" },
  { source: "smog",               target: "songs_ohia",           type: "scene",      weight: 0.90, note: "Callahan and Molina — Drag City, same era, mutual admirers" },
  { source: "bonnie_prince_billy",target: "songs_ohia",           type: "scene",      weight: 0.80, note: "Will Oldham and Jason Molina ran almost identical lives" },
  { source: "bonnie_prince_billy",target: "devendra_banhart",     type: "scene",      weight: 0.65, note: "Both part of the freak folk / American Primitive revival" },
  { source: "devendra_banhart",   target: "big_thief",            type: "scene",      weight: 0.65, note: "Banhart championed early Big Thief, scene peers" },
  { source: "m_ward",             target: "devendra_banhart",     type: "scene",      weight: 0.60, note: "Shared the same late-2000s folk revival orbit" },

  // Dark / Gothic arc
  { source: "the_birthday_party", target: "nick_cave",            type: "splinter",   weight: 1.00, note: "The Birthday Party dissolved; Cave formed The Bad Seeds with members" },
  { source: "tom_waits",          target: "nick_cave",            type: "influence",  weight: 0.85, note: "Cave has named Waits a formative voice" },
  { source: "lee_hazlewood",      target: "tom_waits",            type: "influence",  weight: 0.70, note: "Hazlewood's dark baritone Americana prefigures Waits" },
  { source: "nick_cave",          target: "pj_harvey",            type: "collaboration", weight: 0.95, note: "Recorded 'Henry Lee' together on Murder Ballads (1996)" },
  { source: "nina_simone",        target: "pj_harvey",            type: "influence",  weight: 0.75, note: "Harvey has cited Simone's directness as essential" },
  { source: "nina_simone",        target: "mazzy_star",           type: "influence",  weight: 0.65, note: "Hope Sandoval's tone carries Simone's twilight weight" },
  { source: "tom_waits",          target: "ryan_adams",           type: "influence",  weight: 0.65, note: "Waits's broken-down Americana echoes in Adams" },
  { source: "emma_ruth_rundle",   target: "pj_harvey",            type: "influence",  weight: 0.60, note: "Rundle's post-folk darkness traces Harvey's line" },

  // Psychedelic rock chain
  { source: "the_beatles",        target: "the_doors",            type: "influence",  weight: 0.75, note: "The British Invasion gave Morrison permission to be strange" },
  { source: "the_beatles",        target: "neil_young",           type: "influence",  weight: 0.65, note: "Young absorbed Beatle melodicism early on" },
  { source: "the_doors",          target: "dead_meadow",          type: "influence",  weight: 0.90, note: "Dead Meadow are The Doors at lower BPM — same hypnosis" },
  { source: "pink_floyd",         target: "dead_meadow",          type: "influence",  weight: 0.85, note: "The lysergic heavy-psych lineage is unbroken" },
  { source: "pink_floyd",         target: "radiohead",            type: "influence",  weight: 0.80, note: "Yorke has cited Wish You Were Here specifically" },
  { source: "can",                target: "radiohead",            type: "influence",  weight: 0.90, note: "Can is Yorke's most-cited influence for Kid A onward" },
  { source: "can",                target: "pink_floyd",           type: "scene",      weight: 0.70, note: "Kosmische and Pink Floyd shared studio experiments" },
  { source: "radiohead",          target: "bjork",                type: "scene",      weight: 0.80, note: "Mutual admiration; shared producers (Godrich, Hooper)" },
  { source: "the_dandy_warhols",  target: "dead_meadow",          type: "scene",      weight: 0.65, note: "Both part of the early 2000s psychedelic rock revival" },
  { source: "r_e_m",              target: "wilco",                type: "scene",      weight: 0.65, note: "REM's American alt-rock paved the ground Wilco walks" },

  // Noise / avant-garde
  { source: "thurston_moore",     target: "nirvana",              type: "influence",  weight: 0.90, note: "Moore championed Cobain; Sonic Youth directly enabled Nirvana" },
  { source: "thurston_moore",     target: "devendra_banhart",     type: "influence",  weight: 0.55, note: "Moore's anti-folk blessing opened doors for Banhart" },
  { source: "nirvana",            target: "big_thief",            type: "influence",  weight: 0.65, note: "Adrianne Lenker has cited Cobain's unguarded rawness" },

  // Electronic / ambient
  { source: "bjork",              target: "grouper",              type: "influence",  weight: 0.70, note: "Liz Harris (Grouper) echoes Björk's textural intimacy" },
  { source: "grouper",            target: "kali_malone",          type: "scene",      weight: 0.80, note: "Both work with drone, silence, and minimal organ composition" },
  { source: "mazzy_star",         target: "grouper",              type: "influence",  weight: 0.70, note: "Mazzy Star's gauze-wrapped sound prefigures Grouper's fog" },
  { source: "mazzy_star",         target: "htrk",                 type: "scene",      weight: 0.65, note: "Shared aesthetic: texture and mood over rhythm" },

  // Jazz
  { source: "miles_davis",        target: "nina_simone",          type: "scene",      weight: 0.80, note: "Peers at the height of American jazz's golden era" },
  { source: "miles_davis",        target: "can",                  type: "influence",  weight: 0.70, note: "Miles's Bitches Brew is a direct ancestor of Kosmische" },

  // Folk/Americana expanded
  { source: "bob_dylan",          target: "joni_mitchell",        type: "scene",      weight: 0.85, note: "Contemporaries at the summit of American songwriting; mutual influence runs both ways" },
  { source: "bob_dylan",          target: "leonard_cohen",        type: "scene",      weight: 0.80, note: "Both defined the poet-as-folk-singer; Cohen called Dylan's Nobel 'like pinning a medal on Everest'" },
  { source: "bob_dylan",          target: "nick_drake",           type: "influence",  weight: 0.75, note: "Drake absorbed Dylan's literary folk and turned it inward" },
  { source: "neil_young",         target: "sufjan_stevens",       type: "influence",  weight: 0.70, note: "Stevens's orchestral rawness and vulnerability owes Young" },
  { source: "neil_young",         target: "galaxie_500",          type: "influence",  weight: 0.72, note: "Young's quiet/loud dynamic is the blueprint for Galaxie 500's delicacy" },
  { source: "john_fahey",         target: "joanna_newsom",        type: "influence",  weight: 0.85, note: "Newsom's harp technique and American Primitive sensibility owes Fahey directly" },
  { source: "john_fahey",         target: "nick_drake",           type: "influence",  weight: 0.80, note: "Drake's fingerpicked acoustic language is inseparable from Fahey's American Primitive" },
  { source: "john_fahey",         target: "iron_and_wine",        type: "influence",  weight: 0.78, note: "Sam Beam's American Primitive roots run straight back through Fahey" },
  { source: "townes_van_zandt",   target: "leonard_cohen",        type: "scene",      weight: 0.75, note: "Contemporaries — both dark-folk poets who made despair beautiful" },
  { source: "devendra_banhart",   target: "iron_and_wine",        type: "scene",      weight: 0.68, note: "Both at the centre of the late-2000s new-folk revival" },
  { source: "nick_drake",         target: "iron_and_wine",        type: "influence",  weight: 0.85, note: "Sam Beam has explicitly cited Drake's quietness and intimacy" },
  { source: "nick_drake",         target: "songs_ohia",           type: "influence",  weight: 0.78, note: "Molina's interior desolation carries Drake's emotional logic" },
  { source: "joni_mitchell",      target: "big_thief",            type: "influence",  weight: 0.82, note: "Adrianne Lenker cites Mitchell's emotional precision and open tunings as formative" },
  { source: "leonard_cohen",      target: "nick_cave",            type: "influence",  weight: 0.88, note: "Cave has spoken of Cohen's mortality-as-subject as his single greatest influence" },
  { source: "sufjan_stevens",     target: "big_thief",            type: "scene",      weight: 0.62, note: "Both indie-folk artists working with orchestral intimacy and personal confession" },

  // Dark / Gothic expanded
  { source: "scott_walker",       target: "nick_cave",            type: "influence",  weight: 0.90, note: "Cave has called Walker's Scott 4 one of his desert-island records" },
  { source: "scott_walker",       target: "tom_waits",            type: "influence",  weight: 0.78, note: "Walker's orchestral darkness and baritone theatrics prefigure Waits" },
  { source: "scott_walker",       target: "current_93",           type: "influence",  weight: 0.72, note: "David Tibet has cited Walker's late orchestral period as crucial" },
  { source: "lee_hazlewood",      target: "scott_walker",         type: "influence",  weight: 0.72, note: "Hazlewood's dramatic baritone Americana is an early template for Walker" },
  { source: "the_birthday_party", target: "einsturzende_neubauten", type: "scene",    weight: 0.88, note: "Both in Berlin at the same time; Cave and Bargeld became close collaborators" },
  { source: "nick_cave",          target: "einsturzende_neubauten", type: "collaboration", weight: 0.90, note: "Cave and Bargeld collaborated extensively; Neubauten members appeared on Bad Seeds records", via: "Mute Records" },
  { source: "the_birthday_party", target: "current_93",           type: "scene",      weight: 0.78, note: "Both part of the post-punk dark wave; David Tibet was a close associate of the Birthday Party circle" },
  { source: "current_93",         target: "bonnie_prince_billy",  type: "scene",      weight: 0.68, note: "Will Oldham and David Tibet share a folk-noir sensibility; mutual admirers" },
  { source: "current_93",         target: "songs_ohia",           type: "scene",      weight: 0.65, note: "Both dwell in folk noir — death, faith, Americana as elegy" },

  // Post-rock / experimental
  { source: "can",                target: "godspeed_you",         type: "influence",  weight: 0.88, note: "GY!BE's motorik intensity and drone-building owes Can directly" },
  { source: "pink_floyd",         target: "godspeed_you",         type: "influence",  weight: 0.82, note: "The instrumental epic lineage — Echoes to East Hastings" },
  { source: "radiohead",          target: "godspeed_you",         type: "scene",      weight: 0.75, note: "Same post-rock era; GY!BE sampled Blair's words Radiohead soundtracked" },
  { source: "godspeed_you",       target: "low",                  type: "scene",      weight: 0.80, note: "Slowcore and post-rock orbit the same quiet intensity; scene peers" },
  { source: "low",                target: "grouper",              type: "scene",      weight: 0.78, note: "Both on Kranky Records; shared devotion to silence and restraint", via: "Kranky" },
  { source: "dirty_three",        target: "nick_cave",            type: "collaboration", weight: 0.92, note: "Warren Ellis joined Nick Cave's Bad Seeds; Dirty Three and Cave circle deeply entwined" },
  { source: "dirty_three",        target: "godspeed_you",         type: "scene",      weight: 0.72, note: "Instrumental post-rock peers on the same circuit through the late 1990s" },
  { source: "galaxie_500",        target: "mazzy_star",           type: "scene",      weight: 0.75, note: "Overlapping dream-pop and shoegaze — both defined the gauze-wrapped sound" },
  { source: "galaxie_500",        target: "grouper",              type: "influence",  weight: 0.72, note: "Galaxie 500's fragility and reverb-drenched delicacy prefigures Grouper's fog" },

  // Electronic / ambient expanded
  { source: "can",                target: "aphex_twin",           type: "influence",  weight: 0.82, note: "Aphex has cited Can's motorik texture as foundational to his approach" },
  { source: "bjork",              target: "aphex_twin",           type: "scene",      weight: 0.88, note: "Both on Warp's orbit; mutual influence, shared producers and aesthetics" },
  { source: "aphex_twin",         target: "boards_of_canada",     type: "scene",      weight: 0.90, note: "Both on Warp Records; BoC grew up on Aphex's early releases", via: "Warp Records" },
  { source: "aphex_twin",         target: "burial",               type: "influence",  weight: 0.82, note: "Burial has cited Aphex's Selected Ambient Works as formative" },
  { source: "boards_of_canada",   target: "burial",               type: "scene",      weight: 0.78, note: "Overlapping melancholy electronics — memory, decay, nostalgia as aesthetic" },
  { source: "bjork",              target: "burial",               type: "scene",      weight: 0.72, note: "Both work with loss and texture as primary materials; mutual scene" },
  { source: "grouper",            target: "burial",               type: "scene",      weight: 0.75, note: "Both work with isolation, texture, and the space between notes" },
  { source: "burial",             target: "htrk",                 type: "scene",      weight: 0.72, note: "UK post-club isolation — similar aesthetic of grief and negative space" },
  { source: "grouper",            target: "stars_of_the_lid",     type: "scene",      weight: 0.85, note: "Both on Kranky Records; both define drone-ambient's emotional register", via: "Kranky" },
  { source: "grouper",            target: "tim_hecker",           type: "scene",      weight: 0.82, note: "Both make music from decay, drone, and texture over melody" },
  { source: "low",                target: "stars_of_the_lid",     type: "scene",      weight: 0.80, note: "Kranky labelmates; both explore slowness and space as compositional tools", via: "Kranky" },
  { source: "stars_of_the_lid",   target: "tim_hecker",           type: "scene",      weight: 0.85, note: "Both in the Montreal ambient school; overlapping aesthetic DNA" },
  { source: "kali_malone",        target: "tim_hecker",           type: "scene",      weight: 0.80, note: "Both work with organ drone and sacred-space sound design" },
  { source: "kali_malone",        target: "stars_of_the_lid",     type: "scene",      weight: 0.75, note: "Minimalist composition and long-form drone — natural peers" },

  // Jazz expanded
  { source: "miles_davis",        target: "john_coltrane",        type: "scene",      weight: 0.95, note: "Coltrane played in Miles's band 1955–60; two of jazz's supreme voices in direct collaboration" },
  { source: "john_coltrane",      target: "can",                  type: "influence",  weight: 0.82, note: "Holger Czukay cited Coltrane's free improvisation as the model for Can's collective playing" },
  { source: "nina_simone",        target: "john_coltrane",        type: "scene",      weight: 0.78, note: "Contemporaries at the height of American jazz's civil rights era" },

  // Krautrock
  { source: "can",                target: "neu",                  type: "scene",      weight: 0.90, note: "Both Düsseldorf/Cologne Kosmische scene; NEU! members came from early Kraftwerk" },

  // Label connections (curated)
  { source: "smog",               target: "bonnie_prince_billy",  type: "label",      weight: 0.80, note: "Long-term Drag City labelmates — same roster, same audience", via: "Drag City" },
  { source: "joanna_newsom",      target: "smog",                 type: "label",      weight: 0.78, note: "Drag City labelmates; Newsom joined a roster already anchored by Callahan", via: "Drag City" },
  { source: "joanna_newsom",      target: "bonnie_prince_billy",  type: "label",      weight: 0.78, note: "Drag City stablemates throughout the 2000s", via: "Drag City" },
  { source: "joanna_newsom",      target: "songs_ohia",           type: "label",      weight: 0.75, note: "Drag City labelmates during Molina's most productive years", via: "Drag City" },
  { source: "grouper",            target: "low",                  type: "label",      weight: 0.82, note: "Both on Kranky Records — the label that defined American drone-folk", via: "Kranky" },
  { source: "grouper",            target: "stars_of_the_lid",     type: "label",      weight: 0.80, note: "Kranky Records labelmates; both core to the label's ambient identity", via: "Kranky" },
  { source: "grouper",            target: "tim_hecker",           type: "label",      weight: 0.78, note: "Both on Kranky Records in the 2000s–2010s drone-ambient wave", via: "Kranky" },
  { source: "low",                target: "stars_of_the_lid",     type: "label",      weight: 0.80, note: "Kranky labelmates across multiple decades", via: "Kranky" },
  { source: "nick_cave",          target: "einsturzende_neubauten", type: "label",    weight: 0.85, note: "Both on Mute Records; Mute was the natural home for both artists", via: "Mute Records" },
  { source: "aphex_twin",         target: "boards_of_canada",     type: "label",      weight: 0.88, note: "Both on Warp Records; the two defining artists of the label's electronic canon", via: "Warp Records" },

  // Producer connections
  { source: "pj_harvey",          target: "nirvana",              type: "production", weight: 0.85, note: "Both recorded defining albums with Steve Albini — Rid of Me (1993) and In Utero (1993)", via: "Steve Albini" },
  { source: "pj_harvey",          target: "low",                  type: "production", weight: 0.78, note: "Albini recorded Rid of Me (1993) and Low's I Could Live in Hope (1994) in the same period", via: "Steve Albini" },
  { source: "nirvana",            target: "low",                  type: "production", weight: 0.78, note: "Both on Steve Albini's recording table in the early 1990s", via: "Steve Albini" },

  // Root ancestors
  { source: "woody_guthrie",      target: "bob_dylan",            type: "influence",  weight: 0.98, note: "The most documented lineage in American music — Dylan absorbed Guthrie's language, politics, and persona completely" },
  { source: "woody_guthrie",      target: "lead_belly",           type: "scene",      weight: 0.90, note: "Peers in the American folk revival; both in the Almanac Singers orbit" },
  { source: "woody_guthrie",      target: "hank_williams",        type: "scene",      weight: 0.80, note: "Contemporaries defining American roots music from opposite ends of the country" },
  { source: "woody_guthrie",      target: "the_band",             type: "influence",  weight: 0.85, note: "The Band's Americana DNA owes Guthrie's working-class storytelling" },
  { source: "lead_belly",         target: "john_fahey",           type: "influence",  weight: 0.88, note: "Fahey cited Lead Belly's 12-string mastery as a primary source for his American Primitive approach" },
  { source: "lead_belly",         target: "bob_dylan",            type: "influence",  weight: 0.85, note: "Dylan learned directly from Lead Belly's folk and blues forms" },
  { source: "hank_williams",      target: "townes_van_zandt",     type: "influence",  weight: 0.95, note: "Townes said his one goal was to write a song as good as Hank's" },
  { source: "hank_williams",      target: "bob_dylan",            type: "influence",  weight: 0.80, note: "Dylan has called Hank Williams the first genuine American musical genius" },
  { source: "hank_williams",      target: "gram_parsons",         type: "influence",  weight: 0.92, note: "Parsons was a devoted Hank Williams disciple" },
  { source: "hank_williams",      target: "smog",                 type: "influence",  weight: 0.72, note: "Callahan's plainspoken country lyricism traces a line back to Hank" },
  { source: "gram_parsons",       target: "townes_van_zandt",     type: "scene",      weight: 0.82, note: "Contemporaries in the outlaw country orbit — both redefining what country could be" },
  { source: "gram_parsons",       target: "ryan_adams",           type: "influence",  weight: 0.88, note: "Adams's country-rock synthesis owes Parsons the Flying Burrito Brothers blueprint" },
  { source: "gram_parsons",       target: "wilco",                type: "influence",  weight: 0.80, note: "Tweedy's alt-country roots trace directly to Parsons's cosmic American music" },
  { source: "gram_parsons",       target: "bonnie_prince_billy",  type: "influence",  weight: 0.70, note: "Parsons's lonesome Americana feeds into Oldham's gothic folk sensibility" },
  { source: "the_band",           target: "bob_dylan",            type: "collaboration", weight: 0.95, note: "Backed Dylan on the Basement Tapes and Live 1966 tour — inseparable for a decade" },
  { source: "the_band",           target: "neil_young",           type: "scene",      weight: 0.88, note: "Both central to the early-70s Americana revival; played together at The Last Waltz" },
  { source: "the_band",           target: "gram_parsons",         type: "scene",      weight: 0.78, note: "Both pioneering country-rock at the same moment, same scene" },
  { source: "the_band",           target: "wilco",                type: "influence",  weight: 0.82, note: "Wilco's Americana rock lineage runs directly through The Band's ensemble approach" },

  // Blues lineage
  { source: "robert_johnson",     target: "muddy_waters",         type: "influence",  weight: 0.95, note: "Muddy Waters brought Johnson's Delta blues from Mississippi to Chicago — the defining chain in American music" },
  { source: "robert_johnson",     target: "lead_belly",           type: "scene",      weight: 0.80, note: "Both foundational pre-war American blues — the bedrock under everything" },
  { source: "robert_johnson",     target: "nina_simone",          type: "influence",  weight: 0.72, note: "The blues lineage — Johnson's Delta language feeds into Simone's jazz/blues fire" },
  { source: "muddy_waters",       target: "nina_simone",          type: "scene",      weight: 0.78, note: "Contemporaries at the height of 20th century Black American music" },
  { source: "muddy_waters",       target: "the_velvet_underground", type: "influence", weight: 0.80, note: "VU's distortion and hypnotic repetition owes a debt to Chicago electric blues" },
  { source: "muddy_waters",       target: "john_coltrane",        type: "scene",      weight: 0.70, note: "Both pillars of mid-20th century Black American music in separate traditions" },

  // Velvet Underground lineage
  { source: "the_velvet_underground", target: "the_birthday_party", type: "influence", weight: 0.88, note: "The VU's nihilism and noise is the direct ancestor of the Birthday Party's confrontational power" },
  { source: "the_velvet_underground", target: "nick_cave",         type: "influence",  weight: 0.85, note: "Cave's vocal persona and lyrical darkness owes the VU — Lou Reed is an explicit touchstone" },
  { source: "the_velvet_underground", target: "the_dandy_warhols", type: "influence",  weight: 0.90, note: "Named after Warhol's Factory scene — the Dandys are direct VU descendants" },
  { source: "the_velvet_underground", target: "r_e_m",             type: "influence",  weight: 0.78, note: "R.E.M.'s art-rock instincts trace through the VU" },
  { source: "the_velvet_underground", target: "radiohead",         type: "influence",  weight: 0.72, note: "Radiohead's texture and oblique approach owes the VU's experimental precedent" },
  { source: "the_velvet_underground", target: "thurston_moore",    type: "influence",  weight: 0.85, note: "The VU is the foundation of American noise and art-rock — Sonic Youth is a direct descendant" },
  { source: "the_velvet_underground", target: "can",               type: "scene",      weight: 0.78, note: "Both late-60s avant-rock groups pushing repetition, noise, and texture simultaneously" },
  { source: "the_velvet_underground", target: "mazzy_star",        type: "influence",  weight: 0.75, note: "Mazzy Star's hypnotic slow-burn owes the VU's drone and narcotic atmosphere" },

  // Black Sabbath
  { source: "black_sabbath",      target: "dead_meadow",          type: "influence",  weight: 0.88, note: "Dead Meadow's riff-based psychedelic doom is built squarely on Sabbath's blueprint" },
  { source: "black_sabbath",      target: "pink_floyd",           type: "scene",      weight: 0.72, note: "Both psychedelic British rock bands of the same era — different poles of the heavy/cosmic spectrum" },
  { source: "black_sabbath",      target: "the_doors",            type: "scene",      weight: 0.68, note: "Both dwelled in dark, heavy psychedelia — Sabbath took it further into doom" },

  // Elliott Smith
  { source: "elliott_smith",      target: "nick_drake",           type: "influence",  weight: 0.88, note: "Smith's fingerpicking precision and interior devastation owes Drake directly" },
  { source: "elliott_smith",      target: "big_thief",            type: "influence",  weight: 0.82, note: "Adrianne Lenker's introspective quietness is deeply indebted to Smith" },
  { source: "elliott_smith",      target: "sufjan_stevens",       type: "scene",      weight: 0.72, note: "Contemporaries in confessional indie — both made vulnerability their instrument" },
  { source: "elliott_smith",      target: "wilco",                type: "scene",      weight: 0.68, note: "Both in the late-90s indie/alternative orbit reshaping American songwriting" },
];

// ── ID → display name map ──────────────────────────────────────────────────────

const ID_TO_NAME: Record<string, string> = {
  bob_dylan:              "Bob Dylan",
  neil_young:             "Neil Young",
  neil_young_crazy_horse: "Neil Young, Crazy Horse",
  joni_mitchell:          "Joni Mitchell",
  leonard_cohen:          "Leonard Cohen",
  nick_drake:             "Nick Drake",
  elliott_smith:          "Elliott Smith",
  sufjan_stevens:         "Sufjan Stevens",
  the_band:               "The Band",
  wilco:                  "Wilco",
  big_thief:              "Big Thief",
  gram_parsons:           "Gram Parsons",
  ryan_adams:             "Ryan Adams",
  ryan_adams_cardinals:   "Ryan Adams & The Cardinals",
  devendra_banhart:       "Devendra Banhart",
  m_ward:                 "M. Ward",
  iron_and_wine:          "Iron & Wine",
  joanna_newsom:          "Joanna Newsom",
  beck:                   "Beck",
  beastie_boys:           "Beastie Boys",
  the_beatles:            "The Beatles",
  pink_floyd:             "Pink Floyd",
  the_doors:              "The Doors",
  black_sabbath:          "Black Sabbath",
  dead_meadow:            "Dead Meadow",
  the_velvet_underground: "The Velvet Underground",
  nirvana:                "Nirvana",
  thurston_moore:         "Thurston Moore",
  the_dandy_warhols:      "The Dandy Warhols",
  r_e_m:                  "R.E.M.",
  radiohead:              "Radiohead",
  galaxie_500:            "Galaxie 500",
  mazzy_star:             "Mazzy Star",
  low:                    "Low",
  dirty_three:            "Dirty Three",
  godspeed_you:           "Godspeed You! Black Emperor",
  john_fahey:             "John Fahey",
  townes_van_zandt:       "Townes Van Zandt",
  bonnie_prince_billy:    'Bonnie "Prince" Billy',
  smog:                   "Smog",
  songs_ohia:             "Songs: Ohia",
  richmond_fontaine:      "Richmond Fontaine",
  lead_belly:             "Lead Belly",
  woody_guthrie:          "Woody Guthrie",
  hank_williams:          "Hank Williams",
  lee_hazlewood:          "Lee Hazlewood",
  tom_waits:              "Tom Waits",
  scott_walker:           "Scott Walker",
  the_birthday_party:     "The Birthday Party",
  current_93:             "Current 93",
  nick_cave:              "Nick Cave & The Bad Seeds",
  einsturzende_neubauten: "Einstürzende Neubauten",
  emma_ruth_rundle:       "Emma Ruth Rundle",
  pj_harvey:              "PJ Harvey",
  nina_simone:            "Nina Simone",
  muddy_waters:           "Muddy Waters",
  robert_johnson:         "Robert Johnson",
  miles_davis:            "Miles Davis",
  john_coltrane:          "John Coltrane",
  can:                    "Can",
  neu:                    "Neu!",
  bjork:                  "Björk",
  aphex_twin:             "Aphex Twin",
  boards_of_canada:       "Boards of Canada",
  skee_mask:              "Skee Mask",
  acronym:                "Acronym",
  burial:                 "Burial",
  htrk:                   "HTRK",
  grouper:                "Grouper",
  tim_hecker:             "Tim Hecker",
  stars_of_the_lid:       "Stars of the Lid",
  kali_malone:            "Kali Malone",
  gi_gi:                  "Gi Gi",
  anthony_naples:         "Anthony Naples",
  dj_python:              "DJ Python",
};

// ── Skip major / generic labels ────────────────────────────────────────────────

const SKIP_LABELS = new Set([
  "not on label", "promo", "white label", "self-released", "unknown",
  "capitol records", "columbia", "atlantic", "warner bros.", "warner brothers",
  "mercury", "epic records", "mca records", "emi", "polydor", "island records",
  "rca", "geffen records", "interscope", "universal", "sony music", "virgin",
  "elektra", "reprise records", "chrysalis", "sire records", "london records",
]);

// ── Relation labels ────────────────────────────────────────────────────────────

const REL_LABEL: Record<RelType, string> = {
  splinter:      "Band lineage",
  collaboration: "Collaboration",
  influence:     "Influence",
  scene:         "Scene peers",
  label:         "Same label",
  production:    "Same producer",
};

const REL_ARROW: Record<RelType, string> = {
  splinter:      "→",
  collaboration: "↔",
  influence:     "→",
  scene:         "↔",
  label:         "↔",
  production:    "↔",
};

// ── Section component ──────────────────────────────────────────────────────────

function Section({
  title, count, open, onToggle, children,
}: {
  title: string; count: number; open: boolean; onToggle: () => void; children: ReactNode;
}) {
  return (
    <div style={{ borderTop: `1px solid ${BORD}`, marginBottom: 2 }}>
      <button
        onClick={onToggle}
        style={{
          width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "22px 0", background: "none", border: "none", cursor: "pointer",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
          <span style={{ fontFamily: SERIF, fontSize: "1.4rem", color: INK, fontWeight: 400 }}>
            {title}
          </span>
          <span style={{ fontFamily: MONO, fontSize: 11, color: DIM3, letterSpacing: "0.04em" }}>
            {count}
          </span>
        </div>
        <span style={{ fontFamily: MONO, fontSize: 15, color: DIM3, lineHeight: 1, flexShrink: 0 }}>
          {open ? "−" : "+"}
        </span>
      </button>
      {open && <div style={{ paddingBottom: 32 }}>{children}</div>}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface Props { username?: string; }

export default function ConstellationPOC({ username }: Props) {
  const [loadingMsg,     setLoadingMsg]     = useState<string | null>(username ? "Loading collection…" : null);
  const [totalRecords,   setTotalRecords]   = useState(0);
  const [ownedArtists,   setOwnedArtists]   = useState<Array<{ name: string; count: number }>>([]);
  const [labelGroups,    setLabelGroups]    = useState<LabelGroup[]>([]);
  const [styleGroups,    setStyleGroups]    = useState<StyleGroup[]>([]);
  const [mbLineage,      setMbLineage]      = useState<LineageEdge[]>([]);
  const [discogsLineage, setDiscogsLineage] = useState<LineageEdge[]>([]);
  const [discogsIdMap,   setDiscogsIdMap]   = useState<Map<string, number>>(new Map());
  const [minRecords,     setMinRecords]     = useState(1);
  const [openSections,   setOpenSections]   = useState<Set<string>>(
    new Set(["labels", "sonic", "lineage", "influence"])
  );

  // ── Artist / label filter ─────────────────────────────────────────────────────
  const [artistQuery,       setArtistQuery]       = useState("");
  const [artistFilter,      setArtistFilter]      = useState<string | null>(null);
  const [showArtistDrop,    setShowArtistDrop]    = useState(false);
  const [labelQuery,        setLabelQuery]        = useState("");
  const [labelFilter,       setLabelFilter]       = useState<string | null>(null);
  const [showLabelDrop,     setShowLabelDrop]     = useState(false);
  const artistInputRef = useRef<HTMLInputElement>(null);
  const labelInputRef  = useRef<HTMLInputElement>(null);

  // ── Collection loading ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!username) { setLoadingMsg(null); return; }
    let cancelled = false;
    const uname = username;

    async function load() {
      const supabase = createClient();
      const { data: profile } = await supabase
        .from("profiles").select("id").eq("username", uname).maybeSingle();
      if (!profile || cancelled) { setLoadingMsg("User not found"); return; }

      setLoadingMsg("Fetching records…");
      const PAGE = 1000;
      const recordIds: string[] = [];
      for (let from = 0; ; from += PAGE) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (supabase as any)
          .from("public_collection_summary")
          .select("record_id")
          .eq("user_id", profile.id)
          .range(from, from + PAGE - 1);
        if (!data || data.length === 0) break;
        recordIds.push(...data.map((r: { record_id: string }) => r.record_id));
        if (data.length < PAGE) break;
      }
      if (cancelled) return;
      setTotalRecords(recordIds.length);

      setLoadingMsg("Building connections…");
      const artistCounts = new Map<string, number>();
      const labelMap     = new Map<string, Set<string>>();
      const styleMap     = new Map<string, Set<string>>();
      const discogsIds   = new Map<string, number>();

      const BATCH = 400;
      for (let i = 0; i < recordIds.length; i += BATCH) {
        if (cancelled) return;
        const { data } = await supabase
          .from("records")
          .select("artist, styles, label, discogs_artist_id")
          .in("id", recordIds.slice(i, i + BATCH));

        for (const r of data ?? []) {
          if (!r.artist || r.artist === "Various") continue;

          artistCounts.set(r.artist, (artistCounts.get(r.artist) ?? 0) + 1);

          if (r.label) {
            const lc = r.label.toLowerCase().trim();
            if (lc && !SKIP_LABELS.has(lc)) {
              const s = labelMap.get(r.label) ?? new Set<string>();
              s.add(r.artist);
              labelMap.set(r.label, s);
            }
          }

          if (r.styles?.length) {
            for (const style of r.styles as string[]) {
              const st = style.trim();
              if (!st) continue;
              const s = styleMap.get(st) ?? new Set<string>();
              s.add(r.artist);
              styleMap.set(st, s);
            }
          }

          if (r.discogs_artist_id && !discogsIds.has(r.artist)) {
            discogsIds.set(r.artist, r.discogs_artist_id);
          }
        }
      }
      if (cancelled) return;

      setOwnedArtists(
        [...artistCounts.entries()]
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
      );

      setLabelGroups(
        [...labelMap.entries()]
          .filter(([, s]) => s.size >= 2 && s.size <= 30)
          .map(([label, s]) => ({ label, artists: [...s] }))
          .sort((a, b) => b.artists.length - a.artists.length)
      );

      setStyleGroups(
        [...styleMap.entries()]
          .filter(([, s]) => s.size >= 2)
          .map(([style, s]) => ({ style, artists: [...s] }))
          .sort((a, b) => b.artists.length - a.artists.length)
      );

      setDiscogsIdMap(discogsIds);
      setLoadingMsg(null);
    }

    load();
    return () => { cancelled = true; };
  }, [username]);

  // ── MusicBrainz lineage enrichment ────────────────────────────────────────────

  useEffect(() => {
    if (!username || ownedArtists.length === 0) return;
    let cancelled = false;
    const ownedLower = new Set(ownedArtists.map(a => a.name.toLowerCase()));
    const discovered: LineageEdge[] = [];
    const seenKeys   = new Set<string>();

    const run = async () => {
      for (const { name } of ownedArtists.slice(0, 200)) {
        if (cancelled) return;
        const data = await fetchMBArtist(name);
        if (!data || cancelled) continue;

        for (const rel of data.relations) {
          const mapped = mbRelToConstellation(rel, name);
          if (!mapped || mapped.type !== "splinter") continue;

          const srcL = mapped.source.toLowerCase();
          const tgtL = mapped.target.toLowerCase();
          if (!ownedLower.has(srcL) || !ownedLower.has(tgtL) || srcL === tgtL) continue;

          const key = [srcL, tgtL].sort().join("|");
          if (seenKeys.has(key)) continue;
          seenKeys.add(key);

          discovered.push({
            source: mapped.source, target: mapped.target,
            note: `${rel.type} (MusicBrainz)`, via: "mb",
          });
          if (!cancelled) setMbLineage([...discovered]);
        }
      }
    };

    run();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, ownedArtists.length]);

  // ── Discogs lineage enrichment ────────────────────────────────────────────────

  useEffect(() => {
    if (!username || discogsIdMap.size === 0) return;
    let cancelled = false;
    const ownedLower = new Set(ownedArtists.map(a => a.name.toLowerCase()));
    const discovered: LineageEdge[] = [];
    const seenKeys   = new Set<string>();

    const run = async () => {
      for (const [artistName, discogsId] of discogsIdMap) {
        if (cancelled) return;
        const data = await fetchDiscogsArtist(discogsId);
        if (!data || cancelled) continue;

        for (const member of data.members) {
          const mL = member.name.toLowerCase();
          if (!ownedLower.has(mL)) continue;
          const key = [mL, artistName.toLowerCase()].sort().join("|");
          if (seenKeys.has(key)) continue;
          seenKeys.add(key);
          discovered.push({
            source: member.name, target: artistName,
            note: `${member.name} is a member of ${data.name}`, via: "discogs",
          });
          if (!cancelled) setDiscogsLineage([...discovered]);
        }

        for (const group of data.groups) {
          const gL = group.name.toLowerCase();
          if (!ownedLower.has(gL)) continue;
          const key = [artistName.toLowerCase(), gL].sort().join("|");
          if (seenKeys.has(key)) continue;
          seenKeys.add(key);
          discovered.push({
            source: artistName, target: group.name,
            note: `${artistName} is a member of ${group.name}`, via: "discogs",
          });
          if (!cancelled) setDiscogsLineage([...discovered]);
        }
      }
    };

    run();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, discogsIdMap]);

  // Auto-open all sections when a filter is applied
  useEffect(() => {
    if (artistFilter || labelFilter) {
      setOpenSections(new Set(["labels", "sonic", "lineage", "influence"]));
    }
  }, [artistFilter, labelFilter]);

  // ── Derived / filtered data ───────────────────────────────────────────────────

  const visibleNames = new Set(
    ownedArtists.filter(a => a.count >= minRecords).map(a => a.name)
  );

  // Label scope: when a label is selected, narrow the visible artist set to that label's artists
  const labelScopeSet: Set<string> | null = labelFilter
    ? new Set(
        (labelGroups.find(g => g.label === labelFilter)?.artists ?? [])
          .filter(a => visibleNames.has(a))
      )
    : null;

  const scopedNames = labelScopeSet
    ? new Set([...visibleNames].filter(n => labelScopeSet.has(n)))
    : visibleNames;

  // Dropdown suggestions
  const artistSuggestions = showArtistDrop && artistQuery.length >= 1
    ? ownedArtists
        .filter(a => scopedNames.has(a.name) && a.name.toLowerCase().includes(artistQuery.toLowerCase()))
        .slice(0, 10)
    : [];

  const labelSuggestions = showLabelDrop && labelQuery.length >= 1
    ? labelGroups
        .map(g => ({ ...g, artists: g.artists.filter(a => visibleNames.has(a)) }))
        .filter(g => g.artists.length >= 2 && g.label.toLowerCase().includes(labelQuery.toLowerCase()))
        .slice(0, 10)
    : [];

  // Artist filter normalised for comparison
  const afLower = artistFilter ? artistFilter.toLowerCase() : null;

  const filteredLabels = labelGroups
    .map(g => ({ ...g, artists: g.artists.filter(a => scopedNames.has(a)) }))
    .filter(g => {
      if (g.artists.length < 2) return false;
      if (labelFilter && g.label !== labelFilter) return false;
      if (afLower && !g.artists.some(a => a.toLowerCase() === afLower)) return false;
      return true;
    })
    .sort((a, b) => b.artists.length - a.artists.length);

  const filteredStyles = styleGroups
    .map(g => ({ ...g, artists: g.artists.filter(a => scopedNames.has(a)) }))
    .filter(g => {
      if (g.artists.length < 2) return false;
      if (afLower && !g.artists.some(a => a.toLowerCase() === afLower)) return false;
      return true;
    })
    .sort((a, b) => b.artists.length - a.artists.length);

  // Deduplicated band lineage
  const seenLineage = new Set<string>();
  const filteredLineage = [...mbLineage, ...discogsLineage]
    .filter(e => {
      if (!scopedNames.has(e.source) || !scopedNames.has(e.target)) return false;
      if (afLower && e.source.toLowerCase() !== afLower && e.target.toLowerCase() !== afLower) return false;
      return true;
    })
    .filter(e => {
      const key = [e.source.toLowerCase(), e.target.toLowerCase()].sort().join("|");
      if (seenLineage.has(key)) return false;
      seenLineage.add(key);
      return true;
    });

  // Influence connections (curated, scoped + artist filter)
  const filteredInfluence: InflEdge[] = CURATED_EDGES.flatMap(e => {
    const src = ID_TO_NAME[e.source];
    const tgt = ID_TO_NAME[e.target];
    if (!src || !tgt || !scopedNames.has(src) || !scopedNames.has(tgt)) return [];
    if (afLower && src.toLowerCase() !== afLower && tgt.toLowerCase() !== afLower) return [];
    return [{ source: src, target: tgt, type: e.type, note: e.note, via: e.via }];
  });

  // ── Section toggle ────────────────────────────────────────────────────────────

  function toggleSection(id: string) {
    setOpenSections(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // ── Loading screen ────────────────────────────────────────────────────────────

  if (loadingMsg) {
    return (
      <div style={{
        minHeight: "100vh", background: BG,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <p style={{ fontFamily: MONO, fontSize: 11, color: DIM3, letterSpacing: "0.22em", textTransform: "uppercase" }}>
          {loadingMsg}
        </p>
      </div>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100vh", background: BG }}>
      <div style={{ maxWidth: 920, margin: "0 auto", padding: "56px 40px 100px" }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: 48 }}>
          <p style={{
            fontFamily: MONO, fontSize: 10, color: DIM3,
            letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: 8,
          }}>
            Rekōdo{username ? ` · @${username}` : ""} · Collection Constellation
          </p>
          <h1 style={{ fontFamily: SERIF, fontSize: "2rem", fontWeight: 400, color: INK, margin: "0 0 10px" }}>
            Your Artist Network
          </h1>
          {totalRecords > 0 && (
            <p style={{ fontFamily: MONO, fontSize: 12, color: DIM3, margin: 0 }}>
              {totalRecords.toLocaleString()} records · {ownedArtists.length} artists · {visibleNames.size} shown
            </p>
          )}
        </div>

        {/* ── Filter bar ── */}
        <div style={{ marginBottom: 40, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>

          {/* Artist search */}
          <div style={{ position: "relative", flex: "1 1 220px", minWidth: 180 }}>
            <p style={{ fontFamily: MONO, fontSize: 9, color: DIM3, letterSpacing: "0.14em", textTransform: "uppercase", margin: "0 0 6px" }}>
              Artist
            </p>
            {artistFilter ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", border: `1px solid ${ORANGE}`, background: "rgba(204,85,0,0.08)" }}>
                <span style={{ fontFamily: SERIF, fontSize: "0.95rem", color: ORANGE, flex: 1 }}>{artistFilter}</span>
                <button
                  onClick={() => { setArtistFilter(null); setArtistQuery(""); }}
                  style={{ fontFamily: MONO, fontSize: 14, color: ORANGE, background: "none", border: "none", cursor: "pointer", padding: 0, lineHeight: 1, flexShrink: 0 }}
                  aria-label="Clear artist filter"
                >×</button>
              </div>
            ) : (
              <>
                <input
                  ref={artistInputRef}
                  value={artistQuery}
                  onChange={e => setArtistQuery(e.target.value)}
                  onFocus={() => setShowArtistDrop(true)}
                  onBlur={() => setTimeout(() => setShowArtistDrop(false), 160)}
                  placeholder="Search artist…"
                  style={{
                    width: "100%", fontFamily: SERIF, fontSize: "0.95rem", color: INK,
                    background: "rgba(221,216,204,0.04)", border: `1px solid ${BORD}`,
                    padding: "7px 10px", outline: "none", boxSizing: "border-box",
                  }}
                />
                {artistSuggestions.length > 0 && (
                  <div style={{
                    position: "absolute", top: "100%", left: 0, right: 0, zIndex: 20,
                    background: "#0d1229", border: `1px solid rgba(221,216,204,0.18)`,
                    borderTop: "none", maxHeight: 260, overflowY: "auto",
                  }}>
                    {artistSuggestions.map(a => (
                      <button
                        key={a.name}
                        onMouseDown={() => { setArtistFilter(a.name); setArtistQuery(""); setShowArtistDrop(false); }}
                        style={{
                          display: "flex", justifyContent: "space-between", alignItems: "baseline",
                          width: "100%", padding: "9px 12px", background: "none", border: "none",
                          cursor: "pointer", textAlign: "left", borderBottom: `1px solid ${BORD}`,
                        }}
                      >
                        <span style={{ fontFamily: SERIF, fontSize: "0.9rem", color: INK }}>{a.name}</span>
                        <span style={{ fontFamily: MONO, fontSize: 9, color: DIM3, flexShrink: 0, marginLeft: 10 }}>{a.count}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Label search */}
          <div style={{ position: "relative", flex: "1 1 220px", minWidth: 180 }}>
            <p style={{ fontFamily: MONO, fontSize: 9, color: DIM3, letterSpacing: "0.14em", textTransform: "uppercase", margin: "0 0 6px" }}>
              Label
            </p>
            {labelFilter ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", border: `1px solid ${ORANGE}`, background: "rgba(204,85,0,0.08)" }}>
                <span style={{ fontFamily: MONO, fontSize: 10, color: ORANGE, letterSpacing: "0.08em", flex: 1 }}>{labelFilter}</span>
                <button
                  onClick={() => { setLabelFilter(null); setLabelQuery(""); }}
                  style={{ fontFamily: MONO, fontSize: 14, color: ORANGE, background: "none", border: "none", cursor: "pointer", padding: 0, lineHeight: 1, flexShrink: 0 }}
                  aria-label="Clear label filter"
                >×</button>
              </div>
            ) : (
              <>
                <input
                  ref={labelInputRef}
                  value={labelQuery}
                  onChange={e => setLabelQuery(e.target.value)}
                  onFocus={() => setShowLabelDrop(true)}
                  onBlur={() => setTimeout(() => setShowLabelDrop(false), 160)}
                  placeholder="Search label…"
                  style={{
                    width: "100%", fontFamily: MONO, fontSize: "0.85rem", color: INK,
                    background: "rgba(221,216,204,0.04)", border: `1px solid ${BORD}`,
                    padding: "7px 10px", outline: "none", boxSizing: "border-box",
                  }}
                />
                {labelSuggestions.length > 0 && (
                  <div style={{
                    position: "absolute", top: "100%", left: 0, right: 0, zIndex: 20,
                    background: "#0d1229", border: `1px solid rgba(221,216,204,0.18)`,
                    borderTop: "none", maxHeight: 260, overflowY: "auto",
                  }}>
                    {labelSuggestions.map(g => (
                      <button
                        key={g.label}
                        onMouseDown={() => { setLabelFilter(g.label); setLabelQuery(""); setShowLabelDrop(false); }}
                        style={{
                          display: "flex", justifyContent: "space-between", alignItems: "baseline",
                          width: "100%", padding: "9px 12px", background: "none", border: "none",
                          cursor: "pointer", textAlign: "left", borderBottom: `1px solid ${BORD}`,
                        }}
                      >
                        <span style={{ fontFamily: MONO, fontSize: "0.82rem", color: INK, letterSpacing: "0.06em" }}>{g.label}</span>
                        <span style={{ fontFamily: MONO, fontSize: 9, color: DIM3, flexShrink: 0, marginLeft: 10 }}>{g.artists.length}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Min records */}
          <div style={{ flexShrink: 0 }}>
            <p style={{ fontFamily: MONO, fontSize: 9, color: DIM3, letterSpacing: "0.14em", textTransform: "uppercase", margin: "0 0 6px" }}>
              Min. records
            </p>
            <div style={{ display: "flex", gap: 6 }}>
              {[1, 2, 5, 10].map(n => (
                <button
                  key={n}
                  onClick={() => setMinRecords(n)}
                  style={{
                    fontFamily: MONO, fontSize: 10, padding: "6px 14px", cursor: "pointer",
                    border: `1px solid ${minRecords === n ? "rgba(221,216,204,0.55)" : BORD}`,
                    background: minRecords === n ? "rgba(221,216,204,0.06)" : "transparent",
                    color: minRecords === n ? INK : DIM3,
                    letterSpacing: "0.06em",
                  }}
                >
                  {n}+
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Active filter summary ── */}
        {(artistFilter || labelFilter) && (
          <div style={{ marginBottom: 32, padding: "12px 16px", border: `1px solid ${BORD}`, background: "rgba(221,216,204,0.03)" }}>
            <p style={{ fontFamily: MONO, fontSize: 10, color: DIM3, margin: "0 0 4px", letterSpacing: "0.08em" }}>
              Filtered view
            </p>
            <p style={{ fontFamily: SERIF, fontSize: "1rem", color: INK, margin: 0, lineHeight: 1.55 }}>
              {artistFilter && <><span style={{ color: ORANGE }}>{artistFilter}</span>{labelFilter ? " on " : ""}</>}
              {labelFilter && <span style={{ color: ORANGE }}>{labelFilter}</span>}
              {" — "}
              {[
                filteredLabels.length > 0 && `${filteredLabels.length} label${filteredLabels.length === 1 ? "" : "s"}`,
                filteredStyles.length > 0 && `${filteredStyles.length} style${filteredStyles.length === 1 ? "" : "s"}`,
                filteredLineage.length > 0 && `${filteredLineage.length} lineage`,
                filteredInfluence.length > 0 && `${filteredInfluence.length} influence`,
              ].filter(Boolean).join(" · ") || "no connections"}
            </p>
          </div>
        )}

        {/* ── SHARED LABELS ── */}
        <Section
          title="Shared Labels"
          count={filteredLabels.length}
          open={openSections.has("labels")}
          onToggle={() => toggleSection("labels")}
        >
          {filteredLabels.length === 0 ? (
            <p style={{ fontFamily: MONO, fontSize: 12, color: DIM3 }}>
              No label connections for the current filter.
            </p>
          ) : (
            filteredLabels.map(g => (
              <div
                key={g.label}
                style={{ marginBottom: 24, paddingBottom: 24, borderBottom: `1px solid ${BORD}` }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                  <span style={{ fontFamily: MONO, fontSize: 11, color: ORANGE, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                    {g.label}
                  </span>
                  <span style={{ fontFamily: MONO, fontSize: 10, color: DIM3, flexShrink: 0, marginLeft: 16 }}>
                    {g.artists.length} artists
                  </span>
                </div>
                <p style={{ fontFamily: SERIF, fontSize: "1.05rem", lineHeight: 1.7, margin: 0 }}>
                  {g.artists.map((name, i) => (
                    <span key={name}>
                      {i > 0 && <span style={{ color: DIM3 }}> · </span>}
                      <span style={{ color: afLower && name.toLowerCase() === afLower ? ORANGE : DIM2 }}>
                        {name}
                      </span>
                    </span>
                  ))}
                </p>
              </div>
            ))
          )}
        </Section>

        {/* ── SONIC NEIGHBOURS ── */}
        <Section
          title="Sonic Neighbours"
          count={filteredStyles.length}
          open={openSections.has("sonic")}
          onToggle={() => toggleSection("sonic")}
        >
          {filteredStyles.length === 0 ? (
            <p style={{ fontFamily: MONO, fontSize: 12, color: DIM3 }}>
              No style clusters for the current filter.
            </p>
          ) : (
            filteredStyles.map(g => (
              <div
                key={g.style}
                style={{ marginBottom: 24, paddingBottom: 24, borderBottom: `1px solid ${BORD}` }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                  <span style={{ fontFamily: MONO, fontSize: 11, color: ORANGE, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                    {g.style}
                  </span>
                  <span style={{ fontFamily: MONO, fontSize: 10, color: DIM3, flexShrink: 0, marginLeft: 16 }}>
                    {g.artists.length} artists
                  </span>
                </div>
                <p style={{ fontFamily: SERIF, fontSize: "1.05rem", lineHeight: 1.7, margin: 0 }}>
                  {g.artists.map((name, i) => (
                    <span key={name}>
                      {i > 0 && <span style={{ color: DIM3 }}> · </span>}
                      <span style={{ color: afLower && name.toLowerCase() === afLower ? ORANGE : DIM2 }}>
                        {name}
                      </span>
                    </span>
                  ))}
                </p>
              </div>
            ))
          )}
        </Section>

        {/* ── BAND LINEAGE ── */}
        <Section
          title="Band Lineage"
          count={filteredLineage.length}
          open={openSections.has("lineage")}
          onToggle={() => toggleSection("lineage")}
        >
          {filteredLineage.length === 0 ? (
            <p style={{ fontFamily: MONO, fontSize: 12, color: DIM3 }}>
              {mbLineage.length + discogsLineage.length === 0
                ? "Lineage data loading in background…"
                : "No band lineage connections for the current filter."}
            </p>
          ) : (
            filteredLineage.map((e, i) => (
              <div
                key={i}
                style={{ marginBottom: 20, paddingBottom: 20, borderBottom: `1px solid ${BORD}` }}
              >
                <p style={{ fontFamily: SERIF, fontSize: "1.1rem", margin: "0 0 7px", lineHeight: 1.4 }}>
                  <span style={{ color: afLower && e.source.toLowerCase() === afLower ? ORANGE : INK }}>{e.source}</span>
                  <span style={{ fontFamily: MONO, fontSize: 11, color: DIM3, margin: "0 10px" }}>→</span>
                  <span style={{ color: afLower && e.target.toLowerCase() === afLower ? ORANGE : INK }}>{e.target}</span>
                </p>
                <p style={{ fontFamily: MONO, fontSize: 11, color: DIM2, margin: 0, lineHeight: 1.65 }}>
                  {e.note}
                  <span style={{ color: DIM3 }}>
                    {" · "}{e.via === "mb" ? "MusicBrainz" : "Discogs"}
                  </span>
                </p>
              </div>
            ))
          )}
        </Section>

        {/* ── INFLUENCE CONNECTIONS ── */}
        <Section
          title="Influence Connections"
          count={filteredInfluence.length}
          open={openSections.has("influence")}
          onToggle={() => toggleSection("influence")}
        >
          {filteredInfluence.length === 0 ? (
            <p style={{ fontFamily: MONO, fontSize: 12, color: DIM3 }}>
              No influence connections for the current filter.
            </p>
          ) : (
            filteredInfluence.map((e, i) => (
              <div
                key={i}
                style={{ marginBottom: 20, paddingBottom: 20, borderBottom: `1px solid ${BORD}` }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 7, flexWrap: "wrap" }}>
                  <span style={{
                    fontFamily: MONO, fontSize: 9, color: ORANGE,
                    letterSpacing: "0.14em", textTransform: "uppercase", flexShrink: 0,
                  }}>
                    {REL_LABEL[e.type]}
                  </span>
                  <span style={{ fontFamily: SERIF, fontSize: "1.1rem", color: afLower && e.source.toLowerCase() === afLower ? ORANGE : INK }}>{e.source}</span>
                  <span style={{ fontFamily: MONO, fontSize: 11, color: DIM3, flexShrink: 0 }}>
                    {REL_ARROW[e.type]}
                  </span>
                  <span style={{ fontFamily: SERIF, fontSize: "1.1rem", color: afLower && e.target.toLowerCase() === afLower ? ORANGE : INK }}>{e.target}</span>
                  {e.via && (
                    <span style={{ fontFamily: MONO, fontSize: 9, color: DIM3 }}>via {e.via}</span>
                  )}
                </div>
                <p style={{ fontFamily: MONO, fontSize: 11, color: DIM2, margin: 0, lineHeight: 1.65 }}>
                  {e.note}
                </p>
              </div>
            ))
          )}
        </Section>

        {/* Bottom border cap */}
        <div style={{ borderTop: `1px solid ${BORD}`, marginTop: 2 }} />

      </div>
    </div>
  );
}
