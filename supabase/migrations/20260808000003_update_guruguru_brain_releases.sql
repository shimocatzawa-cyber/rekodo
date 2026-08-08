update public.spotlights
set
  rekoodos_pick = 'Masana Temples',
  releases = $json$[
  {
    "year": "2016",
    "title": "House in the Tall Grass",
    "artist": "Kikagaku Moyo",
    "note": "Kikagaku Moyo's third album and an important step in the band's development. Sitar, electric guitar and patient rhythms remain central, but the songwriting is more settled than on the earlier records. Tracks like \"Green Sugar\" and \"Silver Owl\" show the balance between folk, psychedelia and longer instrumental passages that became central to the band's sound.",
    "badge": "Early Catalog"
  },
  {
    "year": "2018",
    "title": "Masana Temples",
    "artist": "Kikagaku Moyo",
    "note": "Recorded in Lisbon with Portuguese musician and producer Bruno Pernadas, Masana Temples arrived as Kikagaku Moyo's international profile was growing quickly. The songs are tighter and more clearly defined than much of their earlier work, while still leaving room for the long instrumental sections the band did so well. One of the defining releases in the Guruguru Brain catalogue.",
    "badge": "Essential"
  },
  {
    "year": "2022",
    "title": "Kumoyo Island",
    "artist": "Kikagaku Moyo",
    "note": "Kikagaku Moyo's fifth and final studio album, released during the band's last year of touring before an indefinite hiatus. Recorded at Tsubame Studios in Tokyo, where some of their earliest material was made, it feels fittingly full circle. The record moves between Japanese folk influence, funk, psychedelia and the loose improvisation that had always been part of the band.",
    "badge": "Final Album"
  },
  {
    "year": "2015",
    "title": "Minami Deutsch",
    "artist": "Minami Deutsch",
    "note": "The Tokyo group's debut full-length and an early example of Guruguru Brain looking beyond the sound of Kikagaku Moyo. Repetition and motorik rhythm dominate, with the influence of early 1970s German bands sitting openly on the surface. A particularly good entry point for listeners coming to the label through krautrock.",
    "badge": "Entry Point"
  },
  {
    "year": "2020",
    "title": "Mystery 秘神",
    "artist": "Mong Tong",
    "note": "The Taipei group's Guruguru Brain debut, recorded at their home studio and built around Taiwanese folklore, supernatural imagery and an obsession with older Asian popular culture. Samples, synthesizers, heavy psych and traces of vintage Chinese electronic music run through the record. It introduced one of the label's most distinctive acts outside Taiwan.",
    "badge": null
  },
  {
    "year": "2017",
    "title": "Segye",
    "artist": "TENGGER",
    "note": "TENGGER's Guruguru Brain release pairs itta's voice and Indian harmonium with Marqido's analogue synthesizers. Recorded in Seoul, it moves slowly through drones, repetition and long electronic passages without settling comfortably into either ambient music or psychedelic rock. It also helped widen the label's reach beyond Japan during its early years.",
    "badge": null
  },
  {
    "year": "2023",
    "title": "Approach to Anima",
    "artist": "maya ongaku",
    "note": "The debut album from the Enoshima trio brought maya ongaku to an audience well beyond Japan. Quiet and loosely psychedelic, it moves through acoustic folk, jazz, improvisation and long stretches of open space. The album received international attention on release and quickly became one of the more recognisable records from Guruguru Brain's newer generation of artists.",
    "badge": null
  }
]$json$::jsonb
where name = 'Guruguru Brain';
