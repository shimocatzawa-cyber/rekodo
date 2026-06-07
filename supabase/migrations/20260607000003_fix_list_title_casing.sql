-- Fix incorrect casing on "Top 5 All Time" list title
UPDATE lists
SET title = 'Top 5 All Time'
WHERE title ILIKE 'top 5 all time'
  AND title != 'Top 5 All Time';
