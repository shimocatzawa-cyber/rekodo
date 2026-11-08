-- Reset enrichment status to 'pending' for user_records where the linked record
-- has a discogs_id but no cover_url. These were previously marked 'enriched'
-- even when Discogs returned no image, so they never got a second attempt.
-- After this migration runs, the enrich-status polling on the collection page
-- will automatically pick them up and retry the Discogs image fetch.
UPDATE user_records ur
SET    enrichment_status        = 'pending',
       enrichment_attempted_at  = NULL
FROM   records r
WHERE  ur.record_id              = r.id
  AND  r.discogs_id              IS NOT NULL
  AND  (r.cover_url IS NULL OR r.cover_url = '')
  AND  ur.enrichment_status      = 'enriched';
