update public.spotlights
set meta = meta || '{"bandcamp_url": "https://coryhanson.bandcamp.com"}'::jsonb
where type = 'artist'
  and name = 'Cory Hanson';
