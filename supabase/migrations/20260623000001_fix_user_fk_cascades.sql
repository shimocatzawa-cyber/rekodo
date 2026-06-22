-- Account deletion (auth.admin.deleteUser) relies on every user-owned table
-- cascading from auth.users so a single call cleans up everything. These
-- five FKs were ON DELETE NO ACTION (created outside any tracked migration,
-- same pattern as other gaps this audit found) — left as-is, deleting a
-- user who had ever used Insights, Library, or the taste quiz would fail
-- outright with a foreign key violation instead of cascading.

alter table public.collection_intelligence
  drop constraint collection_intelligence_user_id_fkey,
  add constraint collection_intelligence_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.library_recommendations
  drop constraint library_recommendations_user_id_fkey,
  add constraint library_recommendations_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.library_wantlist
  drop constraint library_wantlist_user_id_fkey,
  add constraint library_wantlist_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.library_wantlist
  drop constraint library_wantlist_recommendation_id_fkey,
  add constraint library_wantlist_recommendation_id_fkey
    foreign key (recommendation_id) references library_recommendations(id) on delete cascade;

alter table public.user_quiz_profile
  drop constraint user_quiz_profile_user_id_fkey,
  add constraint user_quiz_profile_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade;
