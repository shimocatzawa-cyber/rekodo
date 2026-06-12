-- ─── Follows relationship ──────────────────────────────────────────────────────

create table if not exists public.follows (
  id           uuid primary key default gen_random_uuid(),
  follower_id  uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at   timestamptz default now(),
  unique(follower_id, following_id)
);

create index if not exists follows_follower_idx  on public.follows(follower_id);
create index if not exists follows_following_idx on public.follows(following_id);

alter table public.follows enable row level security;

create policy "Public follows are viewable by everyone"
  on public.follows for select using (true);

create policy "Users can follow others"
  on public.follows for insert
  with check (auth.uid() = follower_id);

create policy "Users can unfollow"
  on public.follows for delete
  using (auth.uid() = follower_id);

-- ─── Follower affinity RPC ────────────────────────────────────────────────────
-- Uses user_records (join table) + records (has artist/label) for affinity scoring.
-- security definer bypasses RLS on user_records so followers' collections are readable.

create or replace function public.get_follower_affinity(
  profile_owner_id uuid
)
returns table (
  follower_id      uuid,
  username         text,
  display_name     text,
  avatar_url       text,
  collection_count int,
  affinity_score   int,
  affinity_category text
)
language plpgsql
security definer
as $$
begin
  return query
  with owner_artists as (
    select distinct r.artist
    from user_records ur
    join records r on r.id = ur.record_id
    where ur.user_id = profile_owner_id
      and r.artist is not null
  ),
  owner_labels as (
    select distinct r.label
    from user_records ur
    join records r on r.id = ur.record_id
    where ur.user_id = profile_owner_id
      and r.label is not null
  ),
  follower_list as (
    select f.follower_id
    from follows f
    where f.following_id = profile_owner_id
  ),
  scored as (
    select
      fl.follower_id,
      p.username,
      p.display_name,
      p.avatar_url,
      (select count(*) from user_records where user_id = fl.follower_id)::int as collection_count,
      (
        select count(*)
        from user_records ur2
        join records r2 on r2.id = ur2.record_id
        where ur2.user_id = fl.follower_id
          and r2.artist in (select artist from owner_artists)
      )::int as shared_artists,
      (
        select count(*)
        from user_records ur2
        join records r2 on r2.id = ur2.record_id
        where ur2.user_id = fl.follower_id
          and r2.label in (select label from owner_labels)
      )::int as shared_labels,
      (select count(*) from user_records where user_id = profile_owner_id)::int as owner_total,
      (select count(*) from user_records where user_id = fl.follower_id)::int    as follower_total
    from follower_list fl
    join profiles p on p.id = fl.follower_id
  )
  select
    s.follower_id,
    s.username,
    s.display_name,
    s.avatar_url,
    s.collection_count,
    least(
      100,
      case
        when least(s.owner_total, s.follower_total) = 0 then 0
        else round(
          greatest(s.shared_artists, s.shared_labels)::numeric
          / least(s.owner_total, s.follower_total)::numeric * 100
        )::int
      end
    ) as affinity_score,
    case
      when s.shared_artists >= 5 then 'Bandmates'
      when s.shared_labels  >= 3 then 'Label Mate'
      else 'A Side to my B'
    end as affinity_category
  from scored s
  order by greatest(s.shared_artists, s.shared_labels) desc;
end;
$$;

-- ─── Suggested collectors RPC ─────────────────────────────────────────────────

create or replace function public.get_suggested_collectors(
  profile_owner_id uuid,
  limit_count      int default 4
)
returns table (
  user_id          uuid,
  username         text,
  display_name     text,
  avatar_url       text,
  collection_count int,
  affinity_score   int,
  affinity_category text,
  top_labels       text[]
)
language plpgsql
security definer
as $$
begin
  return query
  with owner_artists as (
    select distinct r.artist
    from user_records ur
    join records r on r.id = ur.record_id
    where ur.user_id = profile_owner_id
      and r.artist is not null
  ),
  owner_labels as (
    select distinct r.label
    from user_records ur
    join records r on r.id = ur.record_id
    where ur.user_id = profile_owner_id
      and r.label is not null
  ),
  all_others as (
    select p.id, p.username, p.display_name, p.avatar_url
    from profiles p
    where p.id != profile_owner_id
      and p.id not in (select follower_id  from follows where following_id = profile_owner_id)
      and p.id not in (select following_id from follows where follower_id  = profile_owner_id)
  ),
  scored as (
    select
      ao.id,
      ao.username,
      ao.display_name,
      ao.avatar_url,
      (select count(*) from user_records where user_id = ao.id)::int as collection_count,
      (
        select count(*)
        from user_records ur2
        join records r2 on r2.id = ur2.record_id
        where ur2.user_id = ao.id
          and r2.artist in (select artist from owner_artists)
      )::int as shared_artists,
      (
        select count(*)
        from user_records ur2
        join records r2 on r2.id = ur2.record_id
        where ur2.user_id = ao.id
          and r2.label in (select label from owner_labels)
      )::int as shared_labels,
      (select count(*) from user_records where user_id = profile_owner_id)::int as owner_total,
      (select count(*) from user_records where user_id = ao.id)::int            as other_total,
      array(
        select r2.label
        from user_records ur2
        join records r2 on r2.id = ur2.record_id
        where ur2.user_id = ao.id
          and r2.label in (select label from owner_labels)
          and r2.label is not null
        group by r2.label
        order by count(*) desc
        limit 2
      ) as top_labels
    from all_others ao
  )
  select
    s.id,
    s.username,
    s.display_name,
    s.avatar_url,
    s.collection_count,
    least(100, case
      when least(s.owner_total, s.other_total) = 0 then 0
      else round(
        greatest(s.shared_artists, s.shared_labels)::numeric
        / least(s.owner_total, s.other_total)::numeric * 100
      )::int
    end) as affinity_score,
    case
      when s.shared_artists >= 5 then 'Bandmates'
      when s.shared_labels  >= 3 then 'Label Mate'
      else 'A Side to my B'
    end as affinity_category,
    s.top_labels
  from scored s
  where greatest(s.shared_artists, s.shared_labels) > 0
  order by greatest(s.shared_artists, s.shared_labels) desc
  limit limit_count;
end;
$$;
