# rekōdo — Claude Code instructions

## Privacy & security checklist

Run this checklist mentally before committing any change. Flag anything that doesn't pass.

### New page or route (`src/app/**/page.tsx`)
- [ ] Fetches the session early (`getUserWithTimeout`) and calls `redirect("/login")` if `!viewer`
- [ ] `generateMetadata` returns `robots: { index: false, follow: false }` (all pages are members-only)
- [ ] No user data rendered before the auth check

### New API route (`src/app/api/**/route.ts`)
- [ ] Calls `supabase.auth.getUser()` and returns `401` if no user — before any data fetch
- [ ] If it uses the service role client, verify the caller's session first (service role bypasses RLS)
- [ ] Does not return data belonging to a different user than the caller

### New Supabase table (migration)
- [ ] `ALTER TABLE … ENABLE ROW LEVEL SECURITY`
- [ ] No `GRANT SELECT … TO anon` — all tables are members-only
- [ ] SELECT policy uses `TO authenticated` not just `USING (true)` (bare `USING (true)` allows anon)
- [ ] Sensitive write policies (INSERT/UPDATE) scoped to owner (`auth.uid() = user_id`) or `service_role`

### New RPC / function (migration)
- [ ] If `SECURITY DEFINER`: does the function verify `auth.uid()` matches the target user, or is it restricted to `service_role` callers only?
- [ ] `GRANT EXECUTE` explicitly names the role — never granted to `public` or `anon`

### Sitemap / robots
- [ ] `src/app/sitemap.ts` — no dynamic user URLs (profiles, lists, collections)
- [ ] `src/app/robots.ts` — any new user-facing path prefix is in the `disallow` list

### Environment variables
- [ ] Secrets never use the `NEXT_PUBLIC_` prefix (those are bundled into client JS)
- [ ] Service role key (`SUPABASE_SERVICE_ROLE_KEY`) only appears in server-side files

---

## Architecture notes

- `src/proxy.ts` is the actual Next.js middleware. It rewrites `/@username → /p/username` before calling `updateSession`.
- Middleware `protectedRoutes`: `/collection`, `/lists`, `/dig`, `/onboarding`, `/settings`, `/admin`, `/library` — other routes gate themselves in the page component.
- All `/@username` and `/p/` paths are disallowed in robots.txt and carry `noindex` metadata.
- `service_role` client bypasses RLS — always verify the caller's session in the route before using it.
- New `*_likes` tables need RLS + policies + explicit `GRANT` or authenticated inserts silently fail (PostgREST permission denied before RLS runs).
