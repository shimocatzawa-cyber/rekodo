"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

// ── Types ──────────────────────────────────────────────────────────────────────

type RelType = "splinter" | "collaboration" | "influence" | "scene" | "label" | "production";

interface ArtistNode {
  id: string;
  name: string;
  albums: number;
  owned: boolean;
  x: number; y: number; vx: number; vy: number;
  radius: number;
}

interface Edge {
  source: string; target: string;
  type: RelType; weight: number;
  note: string;
  via?: string;
  cpDx: number; cpDy: number;
}

interface Camera { x: number; y: number; scale: number; }

// ── Design tokens ──────────────────────────────────────────────────────────────

const BG      = "#06091a";   // star-field canvas/loading background
const SURFACE = "#0c1128";   // panel background
const INK     = "#ddd8cc";   // warm star-white — labels, text, UI
const ORANGE  = "#CC5500";   // rekōdo brand — selection / active
const WHITE   = "#ffffff";   // pure white — star cores
const EDGE_C  = "rgba(140,170,240,1)"; // pale blue-white constellation lines
const MONO    = '"DM Mono", "Courier New", monospace';
const SERIF   = '"Shippori Mincho", Georgia, serif';

// ── Curated relationship graph ─────────────────────────────────────────────────

const CURATED_EDGES: Omit<Edge, "cpDx" | "cpDy">[] = [
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
  { source: "the_birthday_party", target: "nick_cave",            type: "splinter",   weight: 1.00, note: "The Birthday Party dissolved; Cave formed NCATBS with members" },
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

  // Electronic / ambient thread
  { source: "bjork",              target: "grouper",              type: "influence",  weight: 0.70, note: "Liz Harris (Grouper) echoes Björk's textural intimacy" },
  { source: "grouper",            target: "kali_malone",          type: "scene",      weight: 0.80, note: "Both work with drone, silence, and minimal organ composition" },
  { source: "mazzy_star",         target: "grouper",              type: "influence",  weight: 0.70, note: "Mazzy Star's gauze-wrapped sound prefigures Grouper's fog" },
  { source: "mazzy_star",         target: "htrk",                 type: "scene",      weight: 0.65, note: "Shared aesthetic: texture and mood over rhythm" },

  // Jazz thread
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
  { source: "nick_cave",          target: "einsturzende_neubauten", type: "collaboration", weight: 0.90, note: "Cave and Bargeld collaborated extensively; Neubauten members appeared on Bad Seeds records" },
  { source: "the_birthday_party", target: "current_93",           type: "scene",      weight: 0.78, note: "Both part of the post-punk dark wave; David Tibet was a close associate of the Birthday Party circle" },
  { source: "current_93",         target: "bonnie_prince_billy",  type: "scene",      weight: 0.68, note: "Will Oldham and David Tibet share a folk-noir sensibility; mutual admirers" },
  { source: "current_93",         target: "songs_ohia",           type: "scene",      weight: 0.65, note: "Both dwell in folk noir — death, faith, Americana as elegy" },

  // Post-rock / experimental
  { source: "can",                target: "godspeed_you",         type: "influence",  weight: 0.88, note: "GY!BE's motorik intensity and drone-building owes Can directly" },
  { source: "pink_floyd",         target: "godspeed_you",         type: "influence",  weight: 0.82, note: "The instrumental epic lineage — Echoes to East Hastings" },
  { source: "radiohead",          target: "godspeed_you",         type: "scene",      weight: 0.75, note: "Same post-rock era; GY!BE sampled Blair's words Radiohead soundtracked" },
  { source: "godspeed_you",       target: "low",                  type: "scene",      weight: 0.80, note: "Slowcore and post-rock orbit the same quiet intensity; scene peers" },
  { source: "low",                target: "grouper",              type: "scene",      weight: 0.78, note: "Both on Kranky Records; shared devotion to silence and restraint" },
  { source: "dirty_three",        target: "nick_cave",            type: "collaboration", weight: 0.92, note: "Warren Ellis joined Nick Cave's Bad Seeds; Dirty Three and Cave circle deeply entwined" },
  { source: "dirty_three",        target: "godspeed_you",         type: "scene",      weight: 0.72, note: "Instrumental post-rock peers on the same circuit through the late 1990s" },
  { source: "galaxie_500",        target: "mazzy_star",           type: "scene",      weight: 0.75, note: "Overlapping dream-pop and shoegaze — both defined the gauze-wrapped sound" },
  { source: "galaxie_500",        target: "grouper",              type: "influence",  weight: 0.72, note: "Galaxie 500's fragility and reverb-drenched delicacy prefigures Grouper's fog" },

  // Electronic / ambient expanded
  { source: "can",                target: "aphex_twin",           type: "influence",  weight: 0.82, note: "Aphex has cited Can's motorik texture as foundational to his approach" },
  { source: "bjork",              target: "aphex_twin",           type: "scene",      weight: 0.88, note: "Both on Warp's orbit; mutual influence, shared producers and aesthetics" },
  { source: "aphex_twin",         target: "boards_of_canada",     type: "scene",      weight: 0.90, note: "Both on Warp Records; BoC grew up on Aphex's early releases" },
  { source: "aphex_twin",         target: "burial",               type: "influence",  weight: 0.82, note: "Burial has cited Aphex's Selected Ambient Works as formative" },
  { source: "boards_of_canada",   target: "burial",               type: "scene",      weight: 0.78, note: "Overlapping melancholy electronics — memory, decay, nostalgia as aesthetic" },
  { source: "bjork",              target: "burial",               type: "scene",      weight: 0.72, note: "Both work with loss and texture as primary materials; mutual scene" },
  { source: "grouper",            target: "burial",               type: "scene",      weight: 0.75, note: "Both work with isolation, texture, and the space between notes" },
  { source: "burial",             target: "htrk",                 type: "scene",      weight: 0.72, note: "UK post-club isolation — similar aesthetic of grief and negative space" },
  { source: "grouper",            target: "stars_of_the_lid",     type: "scene",      weight: 0.85, note: "Both on Kranky Records; both define drone-ambient's emotional register" },
  { source: "grouper",            target: "tim_hecker",           type: "scene",      weight: 0.82, note: "Both make music from decay, drone, and texture over melody" },
  { source: "low",                target: "stars_of_the_lid",     type: "scene",      weight: 0.80, note: "Kranky labelmates; both explore slowness and space as compositional tools" },
  { source: "stars_of_the_lid",   target: "tim_hecker",           type: "scene",      weight: 0.85, note: "Both in the Montreal ambient school; overlapping aesthetic DNA" },
  { source: "kali_malone",        target: "tim_hecker",           type: "scene",      weight: 0.80, note: "Both work with organ drone and sacred-space sound design" },
  { source: "kali_malone",        target: "stars_of_the_lid",     type: "scene",      weight: 0.75, note: "Minimalist composition and long-form drone — natural peers" },

  // Jazz expanded
  { source: "miles_davis",        target: "john_coltrane",        type: "scene",      weight: 0.95, note: "Coltrane played in Miles's band 1955–60; two of jazz's supreme voices in direct collaboration" },
  { source: "john_coltrane",      target: "can",                  type: "influence",  weight: 0.82, note: "Holger Czukay cited Coltrane's free improvisation as the model for Can's collective playing" },
  { source: "nina_simone",        target: "john_coltrane",        type: "scene",      weight: 0.78, note: "Contemporaries at the height of American jazz's civil rights era" },

  // Krautrock expanded
  { source: "can",                target: "neu",                  type: "scene",      weight: 0.90, note: "Both Düsseldorf/Cologne Kosmische scene; NEU! members came from early Kraftwerk" },

  // Label connections
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
  { source: "nirvana",            target: "low",                  type: "production", weight: 0.78, note: "Both on Steve Albini's recording table in the early 1990s — same confrontational approach", via: "Steve Albini" },

  // ── Root ancestors ─────────────────────────────────────────────────────────────
  { source: "woody_guthrie",      target: "bob_dylan",            type: "influence",  weight: 0.98, note: "The most documented lineage in American music — Dylan absorbed Guthrie's language, politics, and persona completely" },
  { source: "woody_guthrie",      target: "lead_belly",           type: "scene",      weight: 0.90, note: "Peers in the American folk revival; both in the Almanac Singers orbit" },
  { source: "woody_guthrie",      target: "hank_williams",        type: "scene",      weight: 0.80, note: "Contemporaries defining American roots music from opposite ends of the country" },
  { source: "woody_guthrie",      target: "the_band",             type: "influence",  weight: 0.85, note: "The Band's Americana DNA owes Guthrie's working-class storytelling" },
  { source: "lead_belly",         target: "john_fahey",           type: "influence",  weight: 0.88, note: "Fahey cited Lead Belly's 12-string mastery as a primary source for his American Primitive approach" },
  { source: "lead_belly",         target: "bob_dylan",            type: "influence",  weight: 0.85, note: "Dylan learned directly from Lead Belly's folk and blues forms" },
  { source: "hank_williams",      target: "townes_van_zandt",     type: "influence",  weight: 0.95, note: "Townes said his one goal was to write a song as good as Hank's" },
  { source: "hank_williams",      target: "bob_dylan",            type: "influence",  weight: 0.80, note: "Dylan has called Hank Williams the first genuine American musical genius" },
  { source: "hank_williams",      target: "gram_parsons",         type: "influence",  weight: 0.92, note: "Parsons was a devoted Hank Williams disciple — the Through the Glass darkly to country rock" },
  { source: "hank_williams",      target: "smog",                 type: "influence",  weight: 0.72, note: "Callahan's plainspoken country lyricism traces a line back to Hank" },
  { source: "gram_parsons",       target: "townes_van_zandt",     type: "scene",      weight: 0.82, note: "Contemporaries in the outlaw country orbit — both redefining what country could be" },
  { source: "gram_parsons",       target: "ryan_adams",           type: "influence",  weight: 0.88, note: "Adams's country-rock synthesis owes Parsons the Flying Burrito Brothers blueprint" },
  { source: "gram_parsons",       target: "wilco",                type: "influence",  weight: 0.80, note: "Tweedy's alt-country roots trace directly to Parsons's cosmic American music" },
  { source: "gram_parsons",       target: "bonnie_prince_billy",  type: "influence",  weight: 0.70, note: "Parsons's lonesome Americana feeds into Oldham's gothic folk sensibility" },
  { source: "the_band",           target: "bob_dylan",            type: "collaboration", weight: 0.95, note: "Backed Dylan on the legendary Basement Tapes and Live 1966 tour — inseparable for a decade" },
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

// ── Hand-placed positions ──────────────────────────────────────────────────────
// Americana left → dark gothic bottom → rock/psych center-right → electronic far right

const POSITIONS: Record<string, [number, number]> = {
  // Twin suns — top center
  bob_dylan:          [0.42, 0.24],
  neil_young:         [0.55, 0.22],
  // Folk/Americana — left
  the_beatles:        [0.28, 0.18],
  joni_mitchell:      [0.36, 0.20],
  sufjan_stevens:     [0.40, 0.30],
  townes_van_zandt:   [0.20, 0.38],
  john_fahey:         [0.13, 0.48],
  joanna_newsom:      [0.07, 0.36],
  m_ward:             [0.20, 0.30],
  devendra_banhart:   [0.26, 0.42],
  nick_drake:         [0.22, 0.48],
  iron_and_wine:      [0.30, 0.46],
  bonnie_prince_billy:[0.14, 0.60],
  smog:               [0.18, 0.68],
  songs_ohia:         [0.14, 0.76],
  leonard_cohen:      [0.22, 0.82],
  ryan_adams:         [0.30, 0.52],
  richmond_fontaine:  [0.22, 0.56],
  wilco:              [0.52, 0.34],
  big_thief:          [0.45, 0.42],
  lee_hazlewood:      [0.30, 0.72],
  // Dark/Gothic — bottom center
  the_birthday_party: [0.38, 0.84],
  current_93:         [0.32, 0.88],
  nick_cave:          [0.48, 0.76],
  scott_walker:       [0.32, 0.76],
  einsturzende_neubauten: [0.46, 0.92],
  tom_waits:          [0.38, 0.66],
  pj_harvey:          [0.58, 0.80],
  nina_simone:        [0.62, 0.68],
  emma_ruth_rundle:   [0.60, 0.88],
  // Rock/Post-rock — center/right
  pink_floyd:         [0.68, 0.24],
  the_doors:          [0.62, 0.30],
  galaxie_500:        [0.58, 0.30],
  dead_meadow:        [0.72, 0.36],
  dirty_three:        [0.60, 0.42],
  r_e_m:              [0.65, 0.50],
  nirvana:            [0.72, 0.56],
  low:                [0.70, 0.66],
  thurston_moore:     [0.78, 0.48],
  the_dandy_warhols:  [0.68, 0.40],
  can:                [0.80, 0.28],
  neu:                [0.86, 0.22],
  radiohead:          [0.75, 0.38],
  godspeed_you:       [0.82, 0.48],
  mazzy_star:         [0.82, 0.62],
  // Electronic / Ambient — right
  bjork:              [0.86, 0.36],
  aphex_twin:         [0.96, 0.32],
  boards_of_canada:   [0.90, 0.40],
  htrk:               [0.88, 0.54],
  burial:             [0.86, 0.60],
  grouper:            [0.88, 0.70],
  stars_of_the_lid:   [0.94, 0.74],
  tim_hecker:         [0.84, 0.66],
  kali_malone:        [0.90, 0.80],
  skee_mask:          [0.92, 0.28],
  acronym:            [0.94, 0.44],
  anthony_naples:     [0.92, 0.90],
  dj_python:          [0.88, 0.88],
  beck:               [0.76, 0.64],
  gi_gi:              [0.94, 0.62],
  // Jazz
  miles_davis:        [0.56, 0.58],
  john_coltrane:      [0.52, 0.64],
  beastie_boys:       [0.70, 0.70],
  // Blues roots — centre-bottom
  robert_johnson:     [0.52, 0.82],
  muddy_waters:       [0.54, 0.72],
  // Folk / Country roots — far left
  woody_guthrie:      [0.10, 0.22],
  lead_belly:         [0.08, 0.52],
  hank_williams:      [0.10, 0.82],
  gram_parsons:       [0.32, 0.62],
  the_band:           [0.36, 0.50],
  // Singer-songwriter
  elliott_smith:      [0.48, 0.38],
  // Rock / Psych additions
  black_sabbath:          [0.72, 0.30],
  the_velvet_underground: [0.66, 0.46],
  // Others
  neil_young_crazy_horse: [0.60, 0.18],
  ryan_adams_cardinals:   [0.36, 0.60],
};

function toId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

// ── Collection insights ────────────────────────────────────────────────────────

const INSIGHTS = [
  { heading: "Two separate universes", body: "Folk, rock, Americana on one side. Minimal techno and drone on the other. Almost no overlap. A collection with two souls." },
  { heading: "The twin suns", body: "Bob Dylan and Neil Young — 96 records each. Every Americana artist in the collection orbits one or both of them." },
  { heading: "Nick Cave's complete arc", body: "The Birthday Party dissolved and became Nick Cave & The Bad Seeds. Most people own one. You own both chapters." },
  { heading: "John Fahey, hidden keystone", body: "42 records — and he's the direct root feeding M. Ward, Devendra Banhart, and Bonnie 'Prince' Billy. Pull him out and a whole branch loses its foundation." },
  { heading: "Can bridges your worlds", body: "One of the only nodes connecting the folk/rock cluster to the electronic cluster. Miles Davis → Can → Radiohead → the rest." },
];

// ── Genre watermarks — placed to match cluster regions ────────────────────────
// xF/yF are fractions of the canvas; match the POSITIONS of nearby artists.

const GENRE_MARKS = [
  { text: "FOLK",              xF: 0.08, yF: 0.46, size: 62, rot: -0.06 }, // john_fahey region
  { text: "AMERICANA",         xF: 0.18, yF: 0.80, size: 44, rot:  0.04 }, // smog/songs_ohia region
  { text: "SINGER-SONGWRITER", xF: 0.36, yF: 0.16, size: 28, rot: -0.03 }, // bob_dylan/neil_young area
  { text: "ALT-COUNTRY",       xF: 0.50, yF: 0.40, size: 32, rot:  0.02 }, // wilco area (not psychedelic!)
  { text: "COUNTRY",           xF: 0.20, yF: 0.88, size: 38, rot:  0.05 }, // townes/lee_hazlewood area
  { text: "GOTHIC",            xF: 0.46, yF: 0.82, size: 44, rot:  0.06 }, // nick_cave/birthday_party area
  { text: "BLUES",             xF: 0.64, yF: 0.74, size: 40, rot: -0.04 }, // nina_simone area
  { text: "PSYCHEDELIC",       xF: 0.70, yF: 0.28, size: 52, rot:  0.03 }, // pink_floyd/doors area
  { text: "KRAUTROCK",         xF: 0.82, yF: 0.20, size: 44, rot: -0.07 }, // can area
  { text: "NOISE ROCK",        xF: 0.76, yF: 0.52, size: 36, rot:  0.05 }, // nirvana/thurston area
  { text: "AVANT-GARDE",       xF: 0.38, yF: 0.54, size: 32, rot: -0.05 }, // general experimental
  { text: "DRONE",             xF: 0.88, yF: 0.76, size: 54, rot: -0.04 }, // grouper/kali_malone area
  { text: "AMBIENT",           xF: 0.90, yF: 0.88, size: 38, rot:  0.06 }, // far right bottom
  { text: "ELECTRONIC",        xF: 0.92, yF: 0.28, size: 48, rot: -0.03 }, // skee_mask/bjork area
  { text: "JAZZ",              xF: 0.58, yF: 0.56, size: 60, rot: -0.02 }, // miles_davis area
];

// ── Utilities ──────────────────────────────────────────────────────────────────

function seededRng(seed: number) {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}
function strHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function easeOutBack(t: number) {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

const REL_LABEL: Record<RelType, string> = {
  splinter:      "Band lineage",
  collaboration: "Collaborated",
  influence:     "Influenced",
  scene:         "Scene peers",
  label:         "Same label",
  production:    "Same producer",
};

const REL_VERB: Record<RelType, string> = {
  splinter:      "→ became",
  collaboration: "↔ collaborated with",
  influence:     "→ influenced",
  scene:         "↔ scene peers with",
  label:         "↔ labelmates",
  production:    "↔ produced by",
};

// ── Component ──────────────────────────────────────────────────────────────────

interface Props { username?: string; }

export default function ConstellationPOC({ username }: Props) {
  const canvasRef          = useRef<HTMLCanvasElement>(null);
  const nodesRef           = useRef<ArtistNode[]>([]);
  const edgesRef           = useRef<Edge[]>([]);
  const animRef            = useRef<number>(0);
  const hoveredRef         = useRef<string | null>(null);
  const selectedRef        = useRef<string | null>(null);
  const selectedEdgeKeyRef = useRef<string | null>(null);
  const draggingNodeRef    = useRef<string | null>(null);
  const isPanningRef       = useRef(false);
  const mouseDownPosRef    = useRef({ x: 0, y: 0 });
  const panLastRef         = useRef({ x: 0, y: 0 });
  const cameraRef          = useRef<Camera>({ x: 0, y: 0, scale: 1 });
  const targetCamRef       = useRef<Camera>({ x: 0, y: 0, scale: 1 });
  const autoZoomRef        = useRef(false);
  const dprRef             = useRef(1);
  const influenceRef       = useRef<Map<string, number>>(new Map());
  const spawnAnimsRef      = useRef<{ id: string; birthMs: number }[]>([]);
  const nodePosRef         = useRef<Map<string, [number, number]>>(new Map());

  const [selectedArtist, setSelectedArtist] = useState<ArtistNode | null>(null);
  const [selectedEdge,   setSelectedEdge]   = useState<Edge | null>(null);
  const [isReady,        setIsReady]        = useState(false);
  const [loadingMsg,     setLoadingMsg]     = useState<string | null>(username ? "Loading collection…" : null);
  const [totalRecords,   setTotalRecords]   = useState(0);
  const [insightIdx,     setInsightIdx]     = useState(0);

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function buildEdge(e: Omit<Edge, "cpDx" | "cpDy">): Edge {
    const h = strHash(e.source + e.target);
    const mag = 20 + seededRng(h) * 30;
    const sgn = seededRng(h + 5) > 0.5 ? 1 : -1;
    return { ...e, cpDx: mag * sgn, cpDy: (seededRng(h + 3) - 0.4) * mag * sgn };
  }

  function recomputeInfluence(nodes: ArtistNode[], edges: Edge[]) {
    const raw = new Map<string, number>();
    for (const e of edges) {
      raw.set(e.source, (raw.get(e.source) ?? 0) + e.weight);
      raw.set(e.target, (raw.get(e.target) ?? 0) + e.weight);
    }
    const max = Math.max(...[...raw.values()], 1);
    influenceRef.current = new Map([...raw.entries()].map(([k, v]) => [k, v / max]));
  }

  // ── Init / data loading ───────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const W = canvas.parentElement!.clientWidth;
      const H = canvas.parentElement!.clientHeight;

      let albumCounts = new Map<string, number>();

      if (username) {
        const supabase = createClient();
        const { data: profile } = await supabase
          .from("profiles").select("id").eq("username", username).maybeSingle();
        if (!profile) { setLoadingMsg("User not found"); return; }

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
        setTotalRecords(recordIds.length);

        setLoadingMsg("Building graph…");
        const BATCH = 400;
        for (let i = 0; i < recordIds.length; i += BATCH) {
          const { data } = await supabase
            .from("records").select("artist")
            .in("id", recordIds.slice(i, i + BATCH));
          for (const r of data ?? []) {
            if (r.artist && r.artist !== "Various") {
              albumCounts.set(r.artist, (albumCounts.get(r.artist) ?? 0) + 1);
            }
          }
        }
      }

      // Build curated nodes (from POSITIONS), tracking which albumCounts entries are consumed
      const posMap = new Map<string, [number, number]>();
      const consumed = new Set<string>(); // lowercase keys from albumCounts that matched a curated node

      const curatedNodes: ArtistNode[] = Object.entries(POSITIONS).map(([id, [xF, yF]]) => {
        posMap.set(id, [xF, yF]);
        const displayName = findDisplayName(id) ?? id.replace(/_/g, " ");
        let count = 0;
        if (username) {
          // Exact then case-insensitive match
          const lower = displayName.toLowerCase();
          const matchKey = albumCounts.get(displayName) !== undefined
            ? displayName
            : [...albumCounts.keys()].find(k => k.toLowerCase() === lower);
          if (matchKey) { count = albumCounts.get(matchKey)!; consumed.add(matchKey.toLowerCase()); }
        } else {
          count = Math.floor(seededRng(strHash(id)) * 10 + 3);
        }
        const owned = !username || count > 0;
        const h = strHash(id);
        return {
          id, name: displayName, albums: count, owned,
          x: xF * W + (seededRng(h)     - 0.5) * 40,
          y: yF * H + (seededRng(h + 1) - 0.5) * 40,
          vx: 0, vy: 0,
          radius: owned ? 6 + Math.sqrt(count) * 2.4 : 7,
        };
      });

      // Add remaining collection artists not matched to a curated node
      const extraNodes: ArtistNode[] = [];
      if (username) {
        for (const [artistName, count] of albumCounts) {
          if (count === 0) continue;
          if (consumed.has(artistName.toLowerCase())) continue;
          const id = toId(artistName);
          if (posMap.has(id)) continue; // already added under a different display name
          const h = strHash(id);
          // Place in an outer ring using seeded angle + radius
          const angle = seededRng(h)         * Math.PI * 2;
          const dist  = 0.34 + seededRng(h + 7) * 0.12;
          const xF = clamp(0.5 + Math.cos(angle) * dist,        0.03, 0.97);
          const yF = clamp(0.5 + Math.sin(angle) * dist * 0.78, 0.03, 0.97);
          posMap.set(id, [xF, yF]);
          extraNodes.push({
            id, name: artistName, albums: count, owned: true,
            x: xF * W + (seededRng(h + 2) - 0.5) * 70,
            y: yF * H + (seededRng(h + 3) - 0.5) * 70,
            vx: 0, vy: 0,
            radius: 5 + Math.sqrt(count) * 1.8,
          });
        }
      }

      nodePosRef.current = posMap;
      const nodes = [...curatedNodes, ...extraNodes];

      const nodeIds = new Set(nodes.map(n => n.id));
      const edges = CURATED_EDGES
        .filter(e => nodeIds.has(e.source) && nodeIds.has(e.target))
        .map(buildEdge);

      nodesRef.current = nodes;
      edgesRef.current = edges;
      recomputeInfluence(nodes, edges);
      setLoadingMsg(null);
      setIsReady(true);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  // Rotate insight every 8 seconds
  useEffect(() => {
    if (!isReady) return;
    const t = setInterval(() => setInsightIdx(i => (i + 1) % INSIGHTS.length), 8000);
    return () => clearInterval(t);
  }, [isReady]);

  // ── Animation loop ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isReady) return;
    const canvas = canvasRef.current!;
    const ctx    = canvas.getContext("2d")!;
    const dpr    = window.devicePixelRatio || 1;
    dprRef.current = dpr;

    function resize() {
      const W = canvas.parentElement!.clientWidth;
      const H = canvas.parentElement!.clientHeight;
      canvas.width  = W * dpr; canvas.height = H * dpr;
      canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
      ctx.scale(dpr, dpr);
    }
    resize();
    window.addEventListener("resize", resize);

    function cssSize() { return { W: canvas.width / dpr, H: canvas.height / dpr }; }

    // Physics
    function tick() {
      const { W, H } = cssSize();
      const nodes = nodesRef.current, edges = edgesRef.current;
      for (const n of nodes) {
        if (draggingNodeRef.current === n.id) continue;
        n.vx += (W * 0.5 - n.x) * 0.0002;
        n.vy += (H * 0.5 - n.y) * 0.0002;
        const homePos = nodePosRef.current.get(n.id);
        if (homePos) {
          n.vx += (homePos[0] * W - n.x) * 0.006;
          n.vy += (homePos[1] * H - n.y) * 0.006;
        }
        for (const o of nodes) {
          if (o.id === n.id) continue;
          const dx = n.x - o.x, dy = n.y - o.y;
          const d2 = dx*dx + dy*dy + 1, d = Math.sqrt(d2);
          const minD = n.radius + o.radius + 18;
          if (d < minD * 2.5) { const f = 800 / d2; n.vx += (dx/d)*f; n.vy += (dy/d)*f; }
        }
        for (const e of edges) {
          const isS = e.source === n.id, isT = e.target === n.id;
          if (!isS && !isT) continue;
          const o = nodes.find(x => x.id === (isS ? e.target : e.source));
          if (!o) continue;
          const dx = o.x - n.x, dy = o.y - n.y;
          const d  = Math.sqrt(dx*dx + dy*dy) + 0.1;
          const f  = (d - (80 + (1 - e.weight) * 40)) * 0.003 * e.weight;
          n.vx += (dx/d)*f; n.vy += (dy/d)*f;
        }
        n.vx *= 0.82; n.vy *= 0.82;
        n.x  += n.vx; n.y  += n.vy;
        const pad = n.radius + 30;
        if (n.x < pad)     n.vx += (pad - n.x)     * 0.15;
        if (n.x > W - pad) n.vx += (W - pad - n.x) * 0.15;
        if (n.y < pad)     n.vy += (pad - n.y)     * 0.15;
        if (n.y > H - pad) n.vy += (H - pad - n.y) * 0.15;
      }
    }

    function lerpCamera() {
      if (!autoZoomRef.current) return;
      const c = cameraRef.current, t = targetCamRef.current, k = 0.09;
      c.x += (t.x - c.x) * k; c.y += (t.y - c.y) * k; c.scale += (t.scale - c.scale) * k;
      if (Math.abs(t.x-c.x) < 0.3 && Math.abs(t.y-c.y) < 0.3 && Math.abs(t.scale-c.scale) < 0.002) {
        Object.assign(c, t); autoZoomRef.current = false;
      }
    }

    // ── Render ────────────────────────────────────────────────────────────────
    function render() {
      const { W, H } = cssSize();
      const nodes    = nodesRef.current, edges = edgesRef.current;
      const cam      = cameraRef.current;
      const hovered  = hoveredRef.current, selected = selectedRef.current;
      const activeId = hovered || selected;
      const now      = Date.now();
      const influence = influenceRef.current;
      const spawns    = spawnAnimsRef.current;

      ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);

      const selEdgeKey     = selectedEdgeKeyRef.current;
      const activeEdgeKeys = new Set<string>();
      const connectedIds   = new Set<string>();
      if (activeId) {
        for (const e of edges) {
          if (e.source === activeId || e.target === activeId) {
            activeEdgeKeys.add(`${e.source}:${e.target}`);
            connectedIds.add(e.source === activeId ? e.target : e.source);
          }
        }
        connectedIds.add(activeId);
      } else if (selEdgeKey) {
        activeEdgeKeys.add(selEdgeKey);
        const [srcId, tgtId] = selEdgeKey.split(":");
        connectedIds.add(srcId);
        connectedIds.add(tgtId);
      }
      const hasSelection = !!activeId || !!selEdgeKey;

      ctx.save();
      ctx.translate(cam.x, cam.y);
      ctx.scale(cam.scale, cam.scale);

      // ── Layer 0: Genre watermarks ──────────────────────────────────────────
      for (const m of GENRE_MARKS) {
        ctx.save();
        ctx.translate(m.xF * W, m.yF * H);
        ctx.rotate(m.rot);
        ctx.font = `700 ${m.size}px ${MONO}`;
        ctx.fillStyle = "rgba(255,255,255,0.032)";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(m.text, 0, 0);
        ctx.restore();
      }

      // ── Layer 1: Edges ─────────────────────────────────────────────────────
      for (const e of edges) {
        const src = nodes.find(n => n.id === e.source);
        const tgt = nodes.find(n => n.id === e.target);
        if (!src || !tgt) continue;
        const key      = `${e.source}:${e.target}`;
        const isActive = activeEdgeKeys.has(key);
        const mx = (src.x + tgt.x) / 2 + e.cpDx;
        const my = (src.y + tgt.y) / 2 + e.cpDy;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(src.x, src.y);
        ctx.quadraticCurveTo(mx, my, tgt.x, tgt.y);

        if (isActive) {
          ctx.globalAlpha = 0.90;
          ctx.strokeStyle = ORANGE;
          ctx.lineWidth   = e.type === "splinter"     ? 3.0
                          : e.type === "collaboration" ? 2.0
                          : e.type === "production"    ? 1.8
                          : e.type === "influence"     ? 1.5
                          : e.type === "label"         ? 1.4
                          :                             1.0; // scene
          ctx.setLineDash(e.type === "influence"  ? [7, 5]
                        : e.type === "scene"      ? [2, 4]
                        : e.type === "label"      ? [8, 4]
                        : e.type === "production" ? [3, 2, 8, 2]
                        : []);
        } else {
          const baseAlpha = e.type === "splinter"     ? 0.55
                          : e.type === "collaboration" ? 0.35
                          : e.type === "production"    ? 0.30
                          : e.type === "influence"     ? 0.22
                          : e.type === "label"         ? 0.20
                          :                             0.14; // scene
          ctx.globalAlpha = hasSelection ? baseAlpha * 0.25 : baseAlpha;
          ctx.strokeStyle = EDGE_C;
          ctx.lineWidth   = e.type === "splinter"     ? 2.5
                          : e.type === "collaboration" ? 1.5
                          : e.type === "production"    ? 1.4
                          : e.type === "influence"     ? 1.0
                          : e.type === "label"         ? 1.0
                          :                             0.6; // scene
          ctx.setLineDash(e.type === "influence"  ? [6, 4]
                        : e.type === "scene"      ? [2, 4]
                        : e.type === "label"      ? [8, 4]
                        : e.type === "production" ? [3, 2, 8, 2]
                        : []);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // Arrow for directional edges
        if ((e.type === "influence" || e.type === "splinter") && (isActive || !hasSelection)) {
          const t2 = 0.65;
          const ax = (1-t2)*(1-t2)*src.x + 2*(1-t2)*t2*mx + t2*t2*tgt.x;
          const ay = (1-t2)*(1-t2)*src.y + 2*(1-t2)*t2*my + t2*t2*tgt.y;
          const tx2 = 2*(1-t2)*(mx - src.x) + 2*t2*(tgt.x - mx);
          const ty2 = 2*(1-t2)*(my - src.y) + 2*t2*(tgt.y - my);
          const ang = Math.atan2(ty2, tx2);
          const as = isActive ? 7 : 5;
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(ax + Math.cos(ang + Math.PI*0.78)*as, ay + Math.sin(ang + Math.PI*0.78)*as);
          ctx.moveTo(ax, ay);
          ctx.lineTo(ax + Math.cos(ang - Math.PI*0.78)*as, ay + Math.sin(ang - Math.PI*0.78)*as);
          ctx.lineWidth = isActive ? 1.5 : 0.8;
          ctx.stroke();
        }

        // Label chip on active edge
        if (isActive) {
          const lx = (src.x + tgt.x) / 2 + e.cpDx * 0.5;
          const ly = (src.y + tgt.y) / 2 + e.cpDy * 0.5;
          ctx.globalAlpha = 0.88;
          ctx.font = `400 8px ${MONO}`;
          const label = e.type === "splinter" ? "BECAME"
                      : e.type === "production" ? "ALBINI"
                      : e.type === "label" ? e.via?.toUpperCase() ?? "LABEL"
                      : e.type.toUpperCase();
          const tw = ctx.measureText(label).width;
          ctx.fillStyle = BG;
          ctx.fillRect(lx - tw/2 - 5, ly - 7, tw + 10, 14);
          ctx.fillStyle = ORANGE;
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText(label, lx, ly);
        }
        ctx.restore();
      }

      // ── Layer 2: Nodes ─────────────────────────────────────────────────────
      const sorted = [...nodes].sort((a, b) => b.radius - a.radius);
      for (const node of sorted) {
        const isHov  = hovered  === node.id;
        const isSel  = selected === node.id;
        const isAct  = isHov || isSel;
        const isDim  = hasSelection && !isAct && !connectedIds.has(node.id);
        const inf    = influence.get(node.id) ?? 0;
        const spawn  = spawns.find(s => s.id === node.id);
        const spawnT = spawn ? (now - spawn.birthMs) / 480 : 1;
        const spawnSc = spawnT < 1 ? easeOutBack(clamp(spawnT, 0, 1)) : 1;
        const r = node.radius * spawnSc;

        ctx.save();

        if (!node.owned) {
          // Discovery node — faint dashed ring in constellation blue
          const ghostAlpha = isDim ? 0.06 : isAct ? 0.90 : 0.35;
          ctx.globalAlpha = ghostAlpha;
          ctx.beginPath(); ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
          ctx.strokeStyle = isAct ? ORANGE : "rgba(140,170,240,0.8)";
          ctx.lineWidth = isAct ? 1.8 : 1;
          ctx.setLineDash([3, 4]);
          ctx.stroke();
          ctx.setLineDash([]);
          if (isSel) {
            ctx.globalAlpha = 0.30;
            ctx.beginPath(); ctx.arc(node.x, node.y, r + 9, 0, Math.PI * 2);
            ctx.strokeStyle = ORANGE; ctx.lineWidth = 1;
            ctx.stroke();
          }
          ctx.restore();
          continue;
        }

        ctx.globalAlpha = isDim ? 0.10 : 1;

        // Orange selection ring
        if (isSel) {
          ctx.beginPath(); ctx.arc(node.x, node.y, r + 10, 0, Math.PI * 2);
          ctx.strokeStyle = ORANGE; ctx.lineWidth = 1.5;
          ctx.globalAlpha = 0.45; ctx.stroke(); ctx.globalAlpha = 1;
        }

        // Star glow — radial gradient (warm white → transparent)
        const blotR = r * (1.0 + inf * 0.5);
        const grad  = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, blotR);
        grad.addColorStop(0,    isAct ? ORANGE              : "rgba(232,225,205,1)");
        grad.addColorStop(0.50, isAct ? ORANGE              : "rgba(220,212,190,0.65)");
        grad.addColorStop(0.78, isAct ? "rgba(204,85,0,0.4)": "rgba(205,198,175,0.18)");
        grad.addColorStop(1.0,  "rgba(200,190,165,0.0)");
        ctx.beginPath(); ctx.arc(node.x, node.y, blotR, 0, Math.PI * 2);
        ctx.fillStyle = grad; ctx.fill();

        // Bright star core
        ctx.beginPath(); ctx.arc(node.x, node.y, r * 0.22, 0, Math.PI * 2);
        ctx.fillStyle = WHITE; ctx.fill();

        // Crown for high-influence artists
        if (inf >= 0.68 && !isDim) {
          const cs  = 6 + (inf - 0.68) * 16;
          const cy  = node.y - blotR - 4;
          const col = isAct ? ORANGE : INK;
          const h2  = strHash(node.id + "c");
          const j   = (i: number) => (seededRng(h2 + i * 4.1) - 0.5) * cs * 0.08;
          ctx.globalAlpha = 0.75 + inf * 0.25;
          ctx.beginPath();
          ctx.moveTo(node.x - cs      + j(0),  cy            + j(1));
          ctx.lineTo(node.x - cs*0.5  + j(2),  cy - cs*0.9   + j(3));
          ctx.lineTo(node.x - cs*0.18 + j(4),  cy - cs*0.25  + j(5));
          ctx.lineTo(node.x           + j(6),  cy - cs*1.3   + j(7));
          ctx.lineTo(node.x + cs*0.18 + j(8),  cy - cs*0.25  + j(9));
          ctx.lineTo(node.x + cs*0.5  + j(10), cy - cs*0.9   + j(11));
          ctx.lineTo(node.x + cs      + j(12), cy            + j(13));
          ctx.strokeStyle = col; ctx.lineWidth = 1.8;
          ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.stroke();
          ctx.globalAlpha = isDim ? 0.10 : 1;
        }

        // Spawn ripples
        if (spawn && spawnT < 3) {
          for (let i = 0; i < 2; i++) {
            const rt = clamp((now - spawn.birthMs - i * 250) / 700, 0, 1);
            if (rt <= 0) continue;
            ctx.beginPath(); ctx.arc(node.x, node.y, blotR * (1 + rt * 2), 0, Math.PI * 2);
            ctx.strokeStyle = INK; ctx.lineWidth = 0.8;
            ctx.globalAlpha = (1 - rt) * 0.3; ctx.stroke();
          }
        }
        ctx.restore();
      }

      // ── Layer 3: Labels ────────────────────────────────────────────────────
      for (const node of nodes) {
        const isAct = hovered === node.id || selected === node.id;
        const isDim = hasSelection && !isAct && !connectedIds.has(node.id);
        const inf   = influence.get(node.id) ?? 0;
        const spawn = spawns.find(s => s.id === node.id);
        const spawnT = spawn ? (now - spawn.birthMs) / 480 : 1;
        if (spawnT < 0.3) continue;
        // Suppress labels for uncatalogued (non-curated) artists unless zoomed in or active
        if (!POSITIONS[node.id] && !isAct && cam.scale < 1.8) continue;
        const blotR = node.radius * (node.owned ? (1.0 + inf * 0.5) : 1) * (spawnT < 1 ? easeOutBack(clamp(spawnT, 0, 1)) : 1);

        const h = strHash(node.id);
        const tilt = (seededRng(h + 7) - 0.5) * 0.025;
        const words = node.name.split(" ");
        const mid   = Math.ceil(words.length / 2);
        const line1 = words.length > 2 ? words.slice(0, mid).join(" ") : node.name;
        const line2 = words.length > 2 ? words.slice(mid).join(" ") : null;
        const fs    = isAct ? 11 + node.radius * 0.20 : 9 + node.radius * 0.14;

        ctx.save();
        ctx.globalAlpha = isDim ? 0.08 : clamp(spawnT, 0, 1);
        ctx.translate(node.x, node.y + blotR + (isAct ? 14 : 11));
        ctx.rotate(tilt);
        ctx.font      = isAct ? `600 ${fs}px ${SERIF}`
                      : node.owned ? `400 ${fs}px ${SERIF}`
                      : `300 italic ${fs * 0.88}px ${SERIF}`;
        ctx.fillStyle = isAct ? ORANGE
                      : node.owned ? INK
                      : "rgba(140,170,240,0.55)";
        ctx.textAlign = "center"; ctx.textBaseline = "top";
        ctx.fillText(line1, 0, 0);
        if (line2) ctx.fillText(line2, 0, fs + 1);
        if (isAct) {
          const lineH = line2 ? (fs + 1) * 2 : fs + 1;
          ctx.font = `400 8px ${MONO}`;
          ctx.fillStyle = "rgba(220,213,195,0.6)";
          ctx.fillText(node.owned ? `${node.albums} records` : "not in collection", 0, lineH + 4);
        }
        ctx.restore();
      }

      ctx.restore(); // end camera transform
      spawnAnimsRef.current = spawns.filter(s => now - s.birthMs < 3000);
    }

    function loop() { tick(); lerpCamera(); render(); animRef.current = requestAnimationFrame(loop); }
    animRef.current = requestAnimationFrame(loop);

    // ── Interactions ──────────────────────────────────────────────────────────

    function s2w(sx: number, sy: number) {
      const c = cameraRef.current;
      return { x: (sx - c.x) / c.scale, y: (sy - c.y) / c.scale };
    }
    function cvPos(e: MouseEvent) {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }
    function hitNode(sx: number, sy: number): ArtistNode | null {
      const { x: wx, y: wy } = s2w(sx, sy);
      const sc = cameraRef.current.scale;
      for (const n of [...nodesRef.current].reverse()) {
        const inf = influenceRef.current.get(n.id) ?? 0;
        const blotR = n.owned ? n.radius * (1.0 + inf * 0.5) : n.radius;
        const dx = wx - n.x, dy = wy - n.y;
        if (Math.sqrt(dx*dx + dy*dy) <= blotR + 8 / sc) return n;
      }
      return null;
    }
    function hitEdge(sx: number, sy: number): Edge | null {
      const { x: wx, y: wy } = s2w(sx, sy);
      const sc = cameraRef.current.scale;
      const threshold = 10 / sc;
      for (const e of edgesRef.current) {
        const src = nodesRef.current.find(n => n.id === e.source);
        const tgt = nodesRef.current.find(n => n.id === e.target);
        if (!src || !tgt) continue;
        const mx = (src.x + tgt.x) / 2 + e.cpDx;
        const my = (src.y + tgt.y) / 2 + e.cpDy;
        for (let i = 0; i <= 24; i++) {
          const t = i / 24;
          const bx = (1-t)*(1-t)*src.x + 2*(1-t)*t*mx + t*t*tgt.x;
          const by = (1-t)*(1-t)*src.y + 2*(1-t)*t*my + t*t*tgt.y;
          if (Math.hypot(wx - bx, wy - by) < threshold) return e;
        }
      }
      return null;
    }
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const r  = canvas.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      const c  = cameraRef.current;
      const ns = clamp(c.scale * (e.deltaY > 0 ? 0.88 : 1.13), 0.15, 6);
      const sf = ns / c.scale;
      c.x = mx + (c.x - mx) * sf; c.y = my + (c.y - my) * sf; c.scale = ns;
      autoZoomRef.current = false; Object.assign(targetCamRef.current, c);
    }
    function onMove(e: MouseEvent) {
      const { x: sx, y: sy } = cvPos(e);
      if (draggingNodeRef.current) {
        const { x: wx, y: wy } = s2w(sx, sy);
        const n = nodesRef.current.find(n => n.id === draggingNodeRef.current);
        if (n) { n.x = wx; n.y = wy; n.vx = 0; n.vy = 0; } return;
      }
      if (isPanningRef.current) {
        const c = cameraRef.current;
        c.x += sx - panLastRef.current.x; c.y += sy - panLastRef.current.y;
        panLastRef.current = { x: sx, y: sy }; Object.assign(targetCamRef.current, c); return;
      }
      const hit = hitNode(sx, sy);
      hoveredRef.current = hit?.id ?? null;
      canvas.style.cursor = hit ? "pointer" : "grab";
    }
    function onDown(e: MouseEvent) {
      const { x: sx, y: sy } = cvPos(e);
      mouseDownPosRef.current = { x: sx, y: sy };
      const hit = hitNode(sx, sy);
      if (hit) { draggingNodeRef.current = hit.id; canvas.style.cursor = "grabbing"; }
      else { isPanningRef.current = true; panLastRef.current = { x: sx, y: sy }; canvas.style.cursor = "grabbing"; }
    }
    function onUp(e: MouseEvent) {
      const { x: sx, y: sy } = cvPos(e);
      const { W, H } = cssSize();
      const dx = sx - mouseDownPosRef.current.x, dy = sy - mouseDownPosRef.current.y;
      const isClick = Math.sqrt(dx*dx + dy*dy) < 6;
      if (isClick) {
        if (draggingNodeRef.current) {
          const hit = nodesRef.current.find(n => n.id === draggingNodeRef.current);
          if (hit) {
            if (selectedRef.current === hit.id) {
              selectedRef.current = null; setSelectedArtist(null);
              selectedEdgeKeyRef.current = null; setSelectedEdge(null);
              targetCamRef.current = { x: 0, y: 0, scale: 1 }; autoZoomRef.current = true;
            } else {
              selectedRef.current = hit.id; setSelectedArtist({ ...hit });
              selectedEdgeKeyRef.current = null; setSelectedEdge(null);
              const ts = clamp(cameraRef.current.scale < 1.6 ? 1.8 : cameraRef.current.scale, 1.2, 2.6);
              targetCamRef.current = { x: W/2 - hit.x * ts, y: H/2 - hit.y * ts, scale: ts };
              autoZoomRef.current = true;
            }
          }
        } else {
          const edgeHit = hitEdge(sx, sy);
          if (edgeHit) {
            selectedRef.current = null; setSelectedArtist(null);
            const key = `${edgeHit.source}:${edgeHit.target}`;
            selectedEdgeKeyRef.current = key; setSelectedEdge({ ...edgeHit });
            const src = nodesRef.current.find(n => n.id === edgeHit.source);
            const tgt = nodesRef.current.find(n => n.id === edgeHit.target);
            if (src && tgt) {
              const midX = (src.x + tgt.x) / 2;
              const midY = (src.y + tgt.y) / 2;
              const ts = clamp(cameraRef.current.scale < 1.6 ? 1.8 : cameraRef.current.scale, 1.2, 2.4);
              targetCamRef.current = { x: W/2 - midX * ts, y: H/2 - midY * ts, scale: ts };
              autoZoomRef.current = true;
            }
          } else {
            selectedRef.current = null; setSelectedArtist(null);
            selectedEdgeKeyRef.current = null; setSelectedEdge(null);
            targetCamRef.current = { x: 0, y: 0, scale: 1 }; autoZoomRef.current = true;
          }
        }
      }
      draggingNodeRef.current = null; isPanningRef.current = false; canvas.style.cursor = "grab";
    }
    function onLeave() { hoveredRef.current = null; draggingNodeRef.current = null; isPanningRef.current = false; }

    canvas.addEventListener("wheel",      onWheel,  { passive: false });
    canvas.addEventListener("mousemove",  onMove);
    canvas.addEventListener("mousedown",  onDown);
    canvas.addEventListener("mouseup",    onUp);
    canvas.addEventListener("mouseleave", onLeave);
    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("wheel",      onWheel);
      canvas.removeEventListener("mousemove",  onMove);
      canvas.removeEventListener("mousedown",  onDown);
      canvas.removeEventListener("mouseup",    onUp);
      canvas.removeEventListener("mouseleave", onLeave);
    };
  }, [isReady]);

  const getConnections = useCallback((nodeId: string) => {
    return edgesRef.current
      .filter(e => e.source === nodeId || e.target === nodeId)
      .map(e => {
        const otherId  = e.source === nodeId ? e.target : e.source;
        const other    = nodesRef.current.find(n => n.id === otherId);
        const isSource = e.source === nodeId;
        return { node: other!, type: e.type, weight: e.weight, note: e.note, via: e.via, isSource };
      })
      .filter(c => c.node)
      .sort((a, b) => b.weight - a.weight);
  }, []);

  const dismiss = () => {
    selectedRef.current = null; setSelectedArtist(null);
    selectedEdgeKeyRef.current = null; setSelectedEdge(null);
    targetCamRef.current = { x: 0, y: 0, scale: 1 }; autoZoomRef.current = true;
  };

  const inf     = selectedArtist ? (influenceRef.current.get(selectedArtist.id) ?? 0) : 0;
  const edgeSrc = selectedEdge ? (nodesRef.current.find(n => n.id === selectedEdge.source) ?? null) : null;
  const edgeTgt = selectedEdge ? (nodesRef.current.find(n => n.id === selectedEdge.target) ?? null) : null;

  const DIM2 = "rgba(220,213,195,0.45)"; // secondary text on dark bg
  const DIM3 = "rgba(220,213,195,0.28)"; // tertiary text on dark bg
  const BORD = "rgba(220,213,195,0.10)"; // panel borders

  return (
    <div className="relative w-full h-screen overflow-hidden select-none" style={{ background: BG }}>

      {/* Loading */}
      {loadingMsg && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center" style={{ background: BG }}>
          <p style={{ fontFamily: SERIF, fontSize: "22px", color: INK, marginBottom: "10px" }}>Collector Constellation</p>
          <p style={{ fontFamily: MONO, fontSize: "9px", color: DIM3, letterSpacing: "0.22em", textTransform: "uppercase" }}>{loadingMsg}</p>
        </div>
      )}

      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full"
        style={{ cursor: "grab", opacity: isReady ? 1 : 0, transition: "opacity 0.8s" }} />

      {/* Header */}
      {isReady && (
        <div className="absolute top-6 left-7 z-10 pointer-events-none">
          <p style={{ fontFamily: MONO, fontSize: "8px", color: DIM3, letterSpacing: "0.25em", textTransform: "uppercase", marginBottom: "3px" }}>
            Rekōdo {username ? `· @${username}` : ""}
          </p>
          <h1 style={{ fontFamily: SERIF, fontSize: "19px", fontWeight: 700, lineHeight: 1.25, color: INK, margin: 0 }}>
            Collector<br />Constellation
          </h1>
          {totalRecords > 0 && (
            <p style={{ fontFamily: MONO, fontSize: "8px", color: DIM3, marginTop: "6px", letterSpacing: "0.08em" }}>
              {totalRecords.toLocaleString()} records · {nodesRef.current.filter(n => n.owned).length} artists
            </p>
          )}
        </div>
      )}

      {/* Legend */}
      {isReady && (
        <div className="absolute top-6 right-6 z-10" style={{ minWidth: 156 }}>
          <div style={{ background: SURFACE, border: `1px solid ${BORD}`, padding: "14px 16px" }}>
            <p style={{ fontFamily: MONO, fontSize: "7px", color: DIM3, letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: "10px" }}>
              Connection type
            </p>
            {(["splinter", "collaboration", "influence", "scene", "label", "production"] as RelType[]).map(t => (
              <div key={t} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                <svg width="22" height="8" style={{ flexShrink: 0 }}>
                  <line x1="0" y1="4" x2="22" y2="4" stroke={INK}
                    strokeWidth={t === "splinter" ? 2.2 : t === "collaboration" || t === "production" ? 1.4 : t === "influence" || t === "label" ? 1 : 0.6}
                    strokeDasharray={t === "influence" ? "5,3" : t === "scene" ? "2,3" : t === "label" ? "8,4" : t === "production" ? "3,2,8,2" : undefined}
                    strokeOpacity={t === "scene" ? 0.35 : 0.75}
                  />
                  {(t === "influence" || t === "splinter") && (
                    <polygon points="17,1 22,4 17,7" fill={INK} fillOpacity={0.65} />
                  )}
                </svg>
                <span style={{ fontFamily: MONO, fontSize: "8px", color: DIM2 }}>{REL_LABEL[t]}</span>
              </div>
            ))}
            <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: `1px solid ${BORD}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "5px" }}>
                <svg width="22" height="8" style={{ flexShrink: 0 }}>
                  <circle cx="11" cy="4" r="3.5" fill="none" stroke="rgba(140,170,240,0.7)" strokeWidth="1" strokeDasharray="3,3" />
                </svg>
                <span style={{ fontFamily: MONO, fontSize: "8px", color: DIM2 }}>Not in collection</span>
              </div>
              <p style={{ fontFamily: MONO, fontSize: "7px", color: DIM3, lineHeight: 1.6, marginTop: "6px" }}>
                ♛ Crown = high influence<br />
                Star size = records owned<br />
                Glow depth = connections
              </p>
            </div>
          </div>
          <button
            onClick={() => { selectedRef.current = null; setSelectedArtist(null); selectedEdgeKeyRef.current = null; setSelectedEdge(null); targetCamRef.current = { x: 0, y: 0, scale: 1 }; autoZoomRef.current = true; }}
            style={{ marginTop: "6px", width: "100%", fontFamily: MONO, fontSize: "7px", letterSpacing: "0.14em", textTransform: "uppercase", color: DIM3, background: SURFACE, border: `1px solid ${BORD}`, padding: "7px", cursor: "pointer" }}
          >
            Reset view
          </button>
        </div>
      )}

      {/* Insight panel */}
      {isReady && !selectedArtist && !selectedEdge && (
        <div className="absolute bottom-6 left-7 z-10" style={{ maxWidth: 260 }}>
          <div style={{ borderLeft: `2px solid rgba(220,213,195,0.25)`, paddingLeft: "14px" }}>
            <p style={{ fontFamily: MONO, fontSize: "7px", color: DIM3, letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: "6px" }}>
              Observation {insightIdx + 1} / {INSIGHTS.length}
            </p>
            <p style={{ fontFamily: SERIF, fontSize: "14px", fontWeight: 600, color: INK, lineHeight: 1.3, marginBottom: "6px" }}>
              {INSIGHTS[insightIdx].heading}
            </p>
            <p style={{ fontFamily: MONO, fontSize: "9px", color: DIM2, lineHeight: 1.65 }}>
              {INSIGHTS[insightIdx].body}
            </p>
          </div>
          <div style={{ display: "flex", gap: "5px", marginTop: "8px" }}>
            {INSIGHTS.map((_, i) => (
              <button key={i} onClick={() => setInsightIdx(i)}
                style={{ width: 18, height: 2, background: i === insightIdx ? INK : "rgba(220,213,195,0.2)", border: "none", cursor: "pointer", padding: 0 }} />
            ))}
          </div>
        </div>
      )}

      {/* Edge panel */}
      {isReady && selectedEdge && !selectedArtist && edgeSrc && edgeTgt && (
        <div className="absolute bottom-6 left-7 z-10" style={{ width: 265, background: SURFACE, border: `1px solid ${BORD}` }}>
          <div style={{ padding: "18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <div>
                <p style={{ fontFamily: MONO, fontSize: "7px", color: DIM3, letterSpacing: "0.22em", textTransform: "uppercase" }}>
                  {REL_LABEL[selectedEdge.type]}
                </p>
                {selectedEdge.via && (
                  <p style={{ fontFamily: MONO, fontSize: "7px", color: ORANGE, letterSpacing: "0.12em", marginTop: "2px" }}>
                    via {selectedEdge.via}
                  </p>
                )}
              </div>
              <button onClick={() => { selectedEdgeKeyRef.current = null; setSelectedEdge(null); }} style={{ fontFamily: MONO, fontSize: "10px", color: DIM3, background: "none", border: "none", cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ marginBottom: "14px" }}>
              <p style={{ fontFamily: SERIF, fontSize: "15px", fontWeight: 700, color: INK, margin: 0 }}>{edgeSrc.name}</p>
              <p style={{ fontFamily: MONO, fontSize: "8px", color: ORANGE, margin: "5px 0" }}>{REL_VERB[selectedEdge.type]}</p>
              <p style={{ fontFamily: SERIF, fontSize: "15px", fontWeight: 700, color: INK, margin: 0 }}>{edgeTgt.name}</p>
            </div>
            <p style={{ fontFamily: MONO, fontSize: "9px", color: DIM2, lineHeight: 1.65, margin: 0 }}>
              {selectedEdge.note}
            </p>
          </div>
        </div>
      )}

      {/* Artist panel */}
      {selectedArtist && (
        <div className="absolute bottom-6 left-7 z-10" style={{ width: 265, background: SURFACE, border: `1px solid ${BORD}` }}>
          <div style={{ padding: "18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                {inf >= 0.68 && (
                  <p style={{ fontFamily: MONO, fontSize: "7px", color: ORANGE, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: "3px" }}>
                    ♛ Influential
                  </p>
                )}
                {!selectedArtist.owned && (
                  <p style={{ fontFamily: MONO, fontSize: "7px", color: "rgba(140,170,240,0.7)", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "3px" }}>
                    ◌ Discovery
                  </p>
                )}
              </div>
              <button onClick={dismiss} style={{ fontFamily: MONO, fontSize: "10px", color: DIM3, background: "none", border: "none", cursor: "pointer" }}>✕</button>
            </div>
            <h2 style={{ fontFamily: SERIF, fontSize: "18px", fontWeight: 700, color: INK, lineHeight: 1.2, margin: "4px 0 10px" }}>
              {selectedArtist.name}
            </h2>
            <p style={{ fontFamily: MONO, fontSize: "8px", color: DIM3, marginBottom: "14px" }}>
              {selectedArtist.owned ? `${selectedArtist.albums} records in collection` : "Not in your collection"}
            </p>

            {getConnections(selectedArtist.id).length > 0 && (
              <div style={{ borderTop: `1px solid ${BORD}`, paddingTop: "12px" }}>
                <p style={{ fontFamily: MONO, fontSize: "7px", color: DIM3, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: "10px" }}>
                  Connections
                </p>
                {getConnections(selectedArtist.id).slice(0, 6).map(({ node, type, note, via, isSource }) => (
                  <div key={node.id} style={{ marginBottom: "12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <p style={{ fontFamily: SERIF, fontSize: "13px", fontWeight: 600, color: INK, margin: 0 }}>{node.name}</p>
                      <span style={{ fontFamily: MONO, fontSize: "7px", color: DIM3, flexShrink: 0, marginLeft: "8px" }}>
                        {isSource ? "→" : "←"} {REL_LABEL[type].toLowerCase()}
                      </span>
                    </div>
                    {via && (
                      <p style={{ fontFamily: MONO, fontSize: "7px", color: ORANGE, margin: "2px 0 0" }}>via {via}</p>
                    )}
                    <p style={{ fontFamily: MONO, fontSize: "8px", color: DIM2, lineHeight: 1.5, margin: "3px 0 0" }}>{note}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom hint */}
      {isReady && !selectedArtist && !selectedEdge && (
        <div className="absolute bottom-6 right-6 z-10 pointer-events-none">
          <p style={{ fontFamily: MONO, fontSize: "7px", color: DIM3, letterSpacing: "0.2em", textTransform: "uppercase" }}>
            Scroll · Drag · Click
          </p>
        </div>
      )}
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function findDisplayName(id: string): string | null {
  const known: Record<string, string> = {
    bob_dylan:              "Bob Dylan",
    neil_young:             "Neil Young",
    wilco:                  "Wilco",
    nick_cave:              "Nick Cave & The Bad Seeds",
    dead_meadow:            "Dead Meadow",
    radiohead:              "Radiohead",
    skee_mask:              "Skee Mask",
    townes_van_zandt:       "Townes Van Zandt",
    tom_waits:              "Tom Waits",
    nina_simone:            "Nina Simone",
    r_e_m:                  "R.E.M.",
    ryan_adams:             "Ryan Adams",
    m_ward:                 "M. Ward",
    bjork:                  "Björk",
    john_fahey:             "John Fahey",
    nirvana:                "Nirvana",
    pink_floyd:             "Pink Floyd",
    smog:                   "Smog",
    devendra_banhart:       "Devendra Banhart",
    htrk:                   "HTRK",
    the_birthday_party:     "The Birthday Party",
    songs_ohia:             "Songs: Ohia",
    acronym:                "Acronym",
    beck:                   "Beck",
    anthony_naples:         "Anthony Naples",
    kali_malone:            "Kali Malone",
    richmond_fontaine:      "Richmond Fontaine",
    big_thief:              "Big Thief",
    pj_harvey:              "PJ Harvey",
    bonnie_prince_billy:    'Bonnie "Prince" Billy',
    the_dandy_warhols:      "The Dandy Warhols",
    dj_python:              "DJ Python",
    can:                    "Can",
    miles_davis:            "Miles Davis",
    beastie_boys:           "Beastie Boys",
    thurston_moore:         "Thurston Moore",
    mazzy_star:             "Mazzy Star",
    grouper:                "Grouper",
    the_beatles:            "The Beatles",
    the_doors:              "The Doors",
    gi_gi:                  "Gi Gi",
    lee_hazlewood:          "Lee Hazlewood",
    neil_young_crazy_horse:   "Neil Young, Crazy Horse",
    ryan_adams_cardinals:     "Ryan Adams & The Cardinals",
    emma_ruth_rundle:         "Emma Ruth Rundle",
    joanna_newsom:            "Joanna Newsom",
    nick_drake:               "Nick Drake",
    iron_and_wine:            "Iron & Wine",
    joni_mitchell:            "Joni Mitchell",
    leonard_cohen:            "Leonard Cohen",
    sufjan_stevens:           "Sufjan Stevens",
    scott_walker:             "Scott Walker",
    low:                      "Low",
    godspeed_you:             "Godspeed You! Black Emperor",
    aphex_twin:               "Aphex Twin",
    boards_of_canada:         "Boards of Canada",
    burial:                   "Burial",
    john_coltrane:            "John Coltrane",
    dirty_three:              "Dirty Three",
    galaxie_500:              "Galaxie 500",
    neu:                      "Neu!",
    stars_of_the_lid:         "Stars of the Lid",
    tim_hecker:               "Tim Hecker",
    einsturzende_neubauten:   "Einstürzende Neubauten",
    current_93:               "Current 93",
    woody_guthrie:            "Woody Guthrie",
    lead_belly:               "Lead Belly",
    hank_williams:            "Hank Williams",
    gram_parsons:             "Gram Parsons",
    the_band:                 "The Band",
    robert_johnson:           "Robert Johnson",
    muddy_waters:             "Muddy Waters",
    black_sabbath:            "Black Sabbath",
    the_velvet_underground:   "The Velvet Underground",
    elliott_smith:            "Elliott Smith",
  };
  return known[id] ?? null;
}

function fuzzyCount(name: string, counts: Map<string, number>): number | null {
  const lower = name.toLowerCase();
  for (const [k, v] of counts) {
    if (k.toLowerCase() === lower) return v;
  }
  return null;
}
