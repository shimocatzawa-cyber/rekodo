-- Users can save Top 5 lists they discover in the community feed.

CREATE TABLE public.saved_lists (
  id       uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id  uuid NOT NULL REFERENCES public.profiles(id)  ON DELETE CASCADE,
  list_id  uuid NOT NULL REFERENCES public.lists(id)     ON DELETE CASCADE,
  saved_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, list_id)
);

CREATE INDEX saved_lists_user_idx ON public.saved_lists(user_id);
CREATE INDEX saved_lists_list_idx ON public.saved_lists(list_id);

ALTER TABLE public.saved_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own saved lists"
  ON public.saved_lists FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can save lists"
  ON public.saved_lists FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unsave lists"
  ON public.saved_lists FOR DELETE USING (auth.uid() = user_id);
