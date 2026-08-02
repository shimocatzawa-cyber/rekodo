update public.spotlights
set bio = (bio -> 'paragraphs')
where name = 'Julie Byrne'
  and jsonb_typeof(bio) = 'object'
  and bio ? 'paragraphs';
