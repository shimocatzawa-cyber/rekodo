-- Clear Chelsea Wolfe's cached Deep Dive sections so they regenerate:
-- rankings: removes hallucinated "Gold (2009)" and will pick up "The Dark" with
--           correct formatVerified + Discogs community ratings
-- about: regenerate with improved bio prompt
DELETE FROM deep_dive_cache WHERE artist = 'Chelsea Wolfe';
