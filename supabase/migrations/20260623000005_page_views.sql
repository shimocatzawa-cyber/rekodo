-- Per-user feature-usage tracking, to see which app sections (Collection,
-- Dig, Lists, etc.) are actually used and surface that in admin. Logged
-- client-side on route change via /api/track-pageview rather than from
-- middleware, so that Next.js Link prefetches (which middleware sees as
-- real requests) don't get counted as views.
CREATE TABLE IF NOT EXISTS public.page_views (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  section    text NOT NULL,
  path       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS page_views_user_id_idx ON public.page_views (user_id);
CREATE INDEX IF NOT EXISTS page_views_section_created_at_idx ON public.page_views (section, created_at);

ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;

-- Users may only log views as themselves; no SELECT policy for regular users —
-- admin reads aggregate data via the service-role client (default privileges
-- from 20260621000001 already grant service_role full access on new tables).
DROP POLICY IF EXISTS "Users can log their own page views" ON public.page_views;
CREATE POLICY "Users can log their own page views"
  ON public.page_views FOR INSERT
  WITH CHECK (auth.uid() = user_id);
