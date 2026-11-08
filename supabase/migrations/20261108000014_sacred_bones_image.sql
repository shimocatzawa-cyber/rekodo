UPDATE spotlights
SET meta = meta || '{"image_url": "https://opcatpkzwtftfktwidrb.supabase.co/storage/v1/object/public/turntable-photos/spotlight/sacred_bones_spotlight.jpg"}'::jsonb
WHERE name = 'Sacred Bones Records' AND month = '2026-11';
