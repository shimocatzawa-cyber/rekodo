-- Nadler: keep "Hushed & Spectral" tag but restore original reason text.
-- Lenker: restore original "Intimate Fingerpicking" tag and reason.

update public.spotlights
set neighbors = $json$[
  {
    "tag": "Hushed & Spectral",
    "artist": "Marissa Nadler",
    "album": "Songs III: Bird on the Water",
    "reason": "Nadler's fingerpicked guitar, hushed delivery and sparse arrangements make Songs III a natural companion to Byrne's work. It is darker and more spectral, drawing on folk and dreamlike atmosphere, but both artists understand how much emotional weight can be carried by a quiet voice, a repeating guitar figure and the space around them."
  },
  {
    "tag": "Intimate Fingerpicking",
    "artist": "Adrianne Lenker",
    "album": "abysskiss",
    "reason": "Lenker's solo work shares Byrne's preference for low-volume performances, open guitar tunings and songs that end before their emotional meaning has been fully explained. abysskiss is looser and more fragmentary than Not Even Happiness, but the two records occupy a similar private scale."
  },
  {
    "tag": "Open-Space Guitar Music",
    "artist": "William Tyler",
    "album": "Goes West",
    "reason": "Tyler is an instrumental guitarist rather than a singer-songwriter, but he shares Byrne's patience and feeling for negative space. Goes West allows melodies to unfold gradually, using acoustic guitar to suggest landscape, travel and memory without crowding the listener."
  }
]$json$::jsonb
where name = 'Julie Byrne';
