-- Public profile support.
-- 1. bio column on profiles (used by profile page + settings)
-- 2. Public read policy on user_records so profile stats are visible without login

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bio text;

-- Collectors share their collections publicly — allow anyone to read aggregate stats.
-- The existing owner-only policy stays; this second permissive policy ORs with it.
CREATE POLICY "User records are publicly readable"
  ON public.user_records FOR SELECT USING (true);
