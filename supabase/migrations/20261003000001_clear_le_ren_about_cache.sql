-- Clear Le Ren's about cache so the improved bio generation prompt is used on next load.
DELETE FROM deep_dive_cache WHERE artist = 'Le Ren' AND section = 'about';
