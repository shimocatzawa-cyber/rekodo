UPDATE spotlights
SET
  rekoodos_pick = 'Birth of Violence',
  releases = '[
    {"year": "2010", "title": "The Grime and the Glow", "label": "Pendu Sound Recordings", "note": "Wolfe''s debut album, released on the New York independent label Pendu Sound Recordings. Its raw, lo-fi sound introduced the blend of folk, gothic rock, and experimental textures that she would continue to develop.", "badge": null},
    {"year": "2011", "title": "Apokalypsis", "label": "Pendu Sound Recordings", "note": "Wolfe''s second studio album, co-produced with Ben Chisholm. It developed the gothic folk and rock palette of her debut. Sargent House later reissued the album.", "badge": null},
    {"year": "2013", "title": "Pain Is Beauty", "label": "Sargent House", "note": "A shift toward synthesizers and sequenced beats alongside guitar and voice. \"Feral Love\" and \"House of Metal\" are among its best-known tracks. Pitchfork scored it 8.0; Metacritic lists an 82/100 based on seventeen reviews.", "badge": null},
    {"year": "2015", "title": "Abyss", "label": "Sargent House", "note": "A darker, heavier record that brought electronic and industrial elements further into Wolfe''s sound. Its lyrics draw on her experiences with sleep paralysis.", "badge": null},
    {"year": "2017", "title": "Hiss Spun", "label": "Sargent House", "note": "Recorded at God City Studio with Kurt Ballou. Troy Van Leeuwen contributes guitar, while Aaron Turner provides guest vocals. The double LP includes an etched D-side.", "badge": "Double LP"},
    {"year": "2019", "title": "Birth of Violence", "label": "Sargent House", "note": "A largely acoustic record recorded at Wolfe''s home in Northern California, following the heavier sound of *Hiss Spun*.", "badge": null},
    {"year": "2024", "title": "She Reaches Out to She Reaches Out to She", "label": "Loma Vista Recordings", "note": "Wolfe''s first album for Loma Vista. Produced with Dave Sitek, it draws on electronic and trip-hop influences.", "badge": null},
    {"year": "2026", "title": "The Dark", "label": "Loma Vista Recordings", "note": "Wolfe''s ninth studio album, made with Ben Chisholm and Jennifer Decilveo. It shifts from the largely electronic sound of the 2024 album toward dark folk and slow-burning rock.", "badge": null}
  ]'::jsonb
WHERE name = 'Chelsea Wolfe' AND month = '2026-11';
