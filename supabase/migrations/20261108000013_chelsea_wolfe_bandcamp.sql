UPDATE spotlights
SET meta = meta || '{"bandcamp_url": "https://chelseawolfe.bandcamp.com"}'::jsonb
WHERE name = 'Chelsea Wolfe' AND month = '2026-11';
