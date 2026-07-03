-- batch-scores route uses get_user_collection_data to read other users' artist/genre/year/country.
-- The previous grant was service_role only, so authenticated queries got RLS-blocked user_records
-- and returned empty profiles, causing all collection similarity scores to compute as 0.
-- Records table is already publicly readable; this just lets the definer function be called.
grant execute on function public.get_user_collection_data(uuid[]) to authenticated;
