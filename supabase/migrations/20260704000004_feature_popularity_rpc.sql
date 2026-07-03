create or replace function public.feature_popularity()
returns table (section text, unique_users bigint)
language sql
security definer
set search_path = public
as $$
  select pv.section, count(distinct pv.user_id) as unique_users
  from page_views pv
  join profiles p on p.id = pv.user_id
  where pv.section != 'Share Card'
    and (p.role is null or p.role != 'admin')
  group by pv.section
  order by unique_users desc;
$$;

grant execute on function public.feature_popularity() to service_role;
