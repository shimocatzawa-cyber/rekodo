update public.spotlights
set meta = meta || '{"image_url": "/guruguru-brain-logo.jpg"}'::jsonb
where name = 'Guruguru Brain';
