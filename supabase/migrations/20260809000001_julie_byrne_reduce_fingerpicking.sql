-- Reduce repetitive fingerpicking/fingerstyle references across bio, releases and neighbors.
-- Keeps one clean mention ("intricate picking") in the bio; removes or rephrases the rest.

update public.spotlights
set
  bio = $json$[
    "Julie Byrne grew up in Buffalo listening to her father play guitar and began playing his instrument herself at seventeen. His influence remains central to a style shaped by intricate picking, open tunings and an instinctive use of silence. Across three albums released between 2014 and 2023, Byrne has built a small but remarkably coherent catalogue: intimate without sounding narrowly diaristic, technically assured without calling attention to its difficulty, and patient enough to let a held note or the space around a phrase carry as much weight as the lyric.",
    "Not Even Happiness brought Byrne to a wider audience in 2017. Although voice and guitar remain at its centre, the album is less bare than its reputation suggests, with strings, flute, synthesizer and environmental textures quietly expanding its arrangements. Songs such as \"Follow My Voice\" and \"Natural Blue\" move through gradual changes in atmosphere rather than conventional dramatic peaks, turning landscape, solitude and memory into something almost physical.",
    "Six years later, The Greater Wings widened that musical language with piano, harp, synthesizers and orchestral strings. Recording began with Eric Littmann, Byrne's longtime collaborator and the producer of Not Even Happiness, before his death in 2021; Byrne later completed the record with Alex Somers and returning collaborators including Jake Falby. Grief runs through the album, but Byrne has described it more broadly as a love letter to her chosen family and a commitment to their shared future. It is her most expansive record without being her loudest, showing how restraint can hold devotion, loss, renewal and an enormous amount of life."
  ]$json$::jsonb,

  releases = $json$[
    {
      "year": "2014",
      "title": "Rooms With Walls and Windows",
      "label": "Orindal Records",
      "badge": null,
      "note": "Byrne's debut album collects material from two limited cassette releases recorded in Chicago between 2011 and 2012. The performances were recorded live, with Byrne accompanying herself on acoustic guitar or keyboard. The essential character of her work is already present: close, unhurried songs in which domestic images and private revelations emerge gradually from skeletal arrangements. The album is sometimes described as uniformly scarce, but its pressing history is more complicated. Orindal produced five documented vinyl pressings, including several later black and randomly coloured editions. The early coloured variants are the genuinely difficult copies; later pressings were produced in more substantial numbers."
    },
    {
      "year": "2017",
      "title": "Not Even Happiness",
      "label": "Ba Da Bing! / Basin Rock",
      "badge": "Essential",
      "note": "Byrne's widely recognised breakthrough. The record adds subtle instrumental and electronic detail to the intimacy of her debut, but its real strength lies in how little it forces. Guitar patterns circle rather than resolve, environmental images replace conventional narrative, and Byrne's low, controlled delivery allows the songs to retain their privacy even as the arrangements grow. Not Even Happiness is still the clearest entry point into Byrne's catalogue: concise, immediately distinctive and spacious enough to reveal new details over repeated listens."
    },
    {
      "year": "2023",
      "title": "The Greater Wings",
      "label": "Ghostly International",
      "badge": "Latest",
      "note": "Byrne's third album and her first full-length in more than six years. Recording began with Eric Littmann and was completed with Alex Somers and Jake Falby. Byrne's guitar is joined by piano, harp, strings and synthesizers, creating music that feels larger in scale without losing its sense of proximity. The title track, \"Portrait of a Clear Day\" and \"Death Is the Diamond\" move between remembrance and continuation rather than settling into elegy. It is a record changed by loss but not contained by it—an album about carrying love forward when its original form is no longer possible."
    }
  ]$json$::jsonb,

  neighbors = $json$[
    {
      "tag": "Hushed & Spectral",
      "artist": "Marissa Nadler",
      "album": "Songs III: Bird on the Water",
      "reason": "Nadler's guitar work, hushed delivery and sparse arrangements make Songs III a natural companion to Byrne's work. It is darker and more spectral, drawing on folk and dreamlike atmosphere, but both artists understand how much emotional weight can be carried by a quiet voice, a repeating guitar figure and the space around them."
    },
    {
      "tag": "Private Scale",
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
