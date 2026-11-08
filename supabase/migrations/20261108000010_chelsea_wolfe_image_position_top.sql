UPDATE spotlights
SET meta = meta || '{"image_position": "top"}'::jsonb
WHERE name = 'Chelsea Wolfe' AND month = '2026-11';
