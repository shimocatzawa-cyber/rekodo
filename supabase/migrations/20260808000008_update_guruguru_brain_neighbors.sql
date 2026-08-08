update public.spotlights
set neighbors = $json$[
  {
    "tag": "Kindred Label",
    "artist": "Cardinal Fuzz",
    "album": "Selected Releases",
    "reason": "UK label Cardinal Fuzz shares Guruguru Brain's interest in psychedelic music built around repetition, improvisation and long-form exploration. The connection is more than aesthetic: Cardinal Fuzz released Minami Deutsch's debut on vinyl in the UK and Europe while Guruguru Brain handled the Japanese release. For collectors drawn to the heavier and more hypnotic side of the catalogue, it is a natural next label to explore."
  },
  {
    "tag": "Essential Companion",
    "artist": "Kikagaku Moyo",
    "album": "Forest of Lost Children (2014)",
    "reason": "Released through Brooklyn label Beyond Beyond is Beyond, Forest of Lost Children captures Kikagaku Moyo just as their audience was beginning to spread outside Japan. The label later worked with TENGGER as well, creating a small but genuine bridge between the American psychedelic underground and the artists around Guruguru Brain."
  },
  {
    "tag": "Rabbit Hole",
    "artist": "Visible Cloaks",
    "album": "Reassemblage (2017)",
    "reason": "Released by RVNG Intl., Reassemblage approaches similar territory from the ambient and electronic side. Visible Cloaks drew heavily on Japanese electronic music and the understated textures of 1980s ambient, creating something spacious, synthetic and quietly strange. For listeners who come to Guruguru Brain through maya ongaku or TENGGER, it opens up a much deeper path into Japanese ambient and experimental electronic music."
  }
]$json$::jsonb
where name = 'Guruguru Brain';
