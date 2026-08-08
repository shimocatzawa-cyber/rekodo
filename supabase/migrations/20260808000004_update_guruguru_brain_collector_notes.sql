update public.spotlights
set collector_notes = $json$[
  {
    "title": "Pressing Quality",
    "body": "Guruguru Brain usually offers its LPs in standard black vinyl alongside limited coloured editions. The label is fairly clear about the difference between records made for listening and variants made partly as collectibles. For Kumoyo Island, for example, it recommends the black pressing over the picture disc if sound quality is the priority. Collector feedback on the label's vinyl is generally positive, but individual pressings are still worth checking before buying."
  },
  {
    "title": "Formats and Variants",
    "body": "Limited coloured vinyl is where much of the collecting interest sits. Masana Temples has appeared in several variants, including a flower-petal transparent edition limited to 2,000 copies, while Kumoyo Island received a 2,000-copy gatefold picture disc sold through Guruguru Brain and Bandcamp. Smaller runs appear elsewhere in the catalogue. The clear pressing of maya ongaku's Approach to Anima, for example, is limited to 300 copies. The clouds & waves releases are also worth noting — Guruguru Brain's first 7-inch series consists of four records built around spring, summer, autumn and winter, each by a different artist. The two Guruguru Brain Wash compilations are different propositions: the original 2014 compilation was digital-only, while Guruguru Brain Wash 2 received a physical release including a coloured pressing limited to 500 copies."
  },
  {
    "title": "What to Prioritise",
    "body": "Kikagaku Moyo remains the obvious place to start for collectors. Their Guruguru Brain catalogue has been repressed several times, so it is worth checking the exact edition rather than assuming an expensive copy is the only option. Limited coloured editions and the Kumoyo Island picture disc are more collectible, while the standard black versions make more sense if the record itself is the priority. Beyond Kikagaku Moyo, the smaller coloured runs are often more interesting from a collecting point of view. Approach to Anima, Mong Tong's Mystery and releases from newer artists have appeared in editions of only a few hundred copies. The clouds & waves singles are another good place to look if you want something specific to the label rather than simply its best-known albums."
  },
  {
    "title": "Where to Buy",
    "body": "Start with Guruguru Brain's own store or Bandcamp. US orders are fulfilled from its US warehouse, while orders elsewhere ship from the Netherlands. The label still carries a surprising amount of older material alongside current releases and represses. Norman Records and Boomkat are also reliable places to check for current titles. For editions that have sold out at the label, Discogs is the obvious next stop. Pay attention to catalogue numbers, vinyl colour and pressing year, particularly with Kikagaku Moyo releases, where several versions of the same album exist."
  }
]$json$::jsonb
where name = 'Guruguru Brain';
