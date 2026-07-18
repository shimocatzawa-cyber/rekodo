update public.spotlights
set meta = meta || '{"bandcamp_url": "https://mariabc.bandcamp.com"}'::jsonb
where type = 'artist'
  and name = 'Maria BC';
