-- Store the AI-generated reason text alongside each dig pick so the history
-- tab can display it when loading from the database instead of localStorage.
alter table public.dig_history
  add column if not exists reason text;
