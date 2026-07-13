#!/usr/bin/env bash
# Quick security/privacy sanity check for rekōdo.
# Run before pushing: bash scripts/security-check.sh
# Exit code 0 = pass, 1 = issues found.

set -euo pipefail

PASS=true
RED='\033[0;31m'
YEL='\033[0;33m'
GRN='\033[0;32m'
NC='\033[0m'

fail() { echo -e "${RED}FAIL${NC}  $1"; PASS=false; }
warn() { echo -e "${YEL}WARN${NC}  $1"; }
ok()   { echo -e "${GRN}OK${NC}    $1"; }

echo ""
echo "rekōdo security check"
echo "─────────────────────"

# ── 1. API routes missing auth check ─────────────────────────────────────────
echo ""
echo "1. API routes without auth check"
ROUTES=$(find src/app/api -name "route.ts" 2>/dev/null)
UNAUTHED=()
for f in $ROUTES; do
  # Skip routes that are intentionally internal-only (checked by INTERNAL_API_SECRET)
  if grep -q "INTERNAL_API_SECRET" "$f" 2>/dev/null; then continue; fi
  # Skip pure proxy/webhook routes that verify by other means
  if grep -qE "stripe\.webhooks\.constructEvent|x-internal-secret" "$f" 2>/dev/null; then continue; fi
  # Check for any auth pattern
  if ! grep -qE "getUser|auth\.uid|getUserWithTimeout|status.*401" "$f" 2>/dev/null; then
    UNAUTHED+=("$f")
  fi
done
if [ ${#UNAUTHED[@]} -eq 0 ]; then
  ok "All API routes appear to check auth"
else
  for f in "${UNAUTHED[@]}"; do
    warn "No auth check found: $f"
  done
fi

# ── 2. Page routes missing auth redirect ─────────────────────────────────────
echo ""
echo "2. Page routes without auth redirect"
PAGES=$(find src/app -name "page.tsx" -not -path "*/\(auth\)/*" 2>/dev/null)
UNAUTHED_PAGES=()
SKIP_PAGES=("src/app/page.tsx" "src/app/login" "src/app/signup" "src/app/about" \
            "src/app/privacy" "src/app/terms" "src/app/down" "src/app/waitlist" \
            "src/app/forgot-password" "src/app/auth")
for f in $PAGES; do
  skip=false
  for s in "${SKIP_PAGES[@]}"; do
    if [[ "$f" == *"$s"* ]]; then skip=true; break; fi
  done
  $skip && continue
  if ! grep -qE "redirect.*login|getUserWithTimeout|getUser" "$f" 2>/dev/null; then
    UNAUTHED_PAGES+=("$f")
  fi
done
if [ ${#UNAUTHED_PAGES[@]} -eq 0 ]; then
  ok "All non-public page routes appear to check auth"
else
  for f in "${UNAUTHED_PAGES[@]}"; do
    warn "No auth check found: $f"
  done
fi

# ── 3. Migrations: anon grants ────────────────────────────────────────────────
echo ""
echo "3. New migrations granting anon access"
NEW_MIGRATIONS=$(git diff --name-only HEAD~1 HEAD 2>/dev/null | grep "supabase/migrations" || true)
if [ -z "$NEW_MIGRATIONS" ]; then
  NEW_MIGRATIONS=$(git diff --name-only --cached 2>/dev/null | grep "supabase/migrations" || true)
fi
if [ -z "$NEW_MIGRATIONS" ]; then
  ok "No new migrations to check"
else
  for f in $NEW_MIGRATIONS; do
    if grep -iE "grant.*(select|insert|update|delete).*to anon|to anon.*(select|insert|update|delete)" "$f" 2>/dev/null; then
      fail "anon grant found in migration: $f"
    fi
    if grep -iE "using \(true\)" "$f" 2>/dev/null | grep -iv "to authenticated\|to service_role" > /dev/null 2>&1; then
      warn "Bare USING (true) policy (may allow anon) — review: $f"
    fi
    if ! grep -qi "enable row level security\|enable.*rls" "$f" 2>/dev/null; then
      if grep -qi "create table" "$f" 2>/dev/null; then
        fail "New table without RLS in: $f"
      fi
    fi
  done
  ok "Migration check complete"
fi

# ── 4. NEXT_PUBLIC_ secrets ───────────────────────────────────────────────────
echo ""
echo "4. NEXT_PUBLIC_ secret exposure"
if grep -rE "NEXT_PUBLIC_(SUPABASE_SERVICE_ROLE|ANTHROPIC|LASTFM|DISCOGS_SECRET|TAVILY|RESEND|STRIPE_SECRET)" \
   src/ --include="*.ts" --include="*.tsx" 2>/dev/null; then
  fail "Secret exposed as NEXT_PUBLIC_ variable"
else
  ok "No secrets in NEXT_PUBLIC_ vars"
fi

# ── 5. Service role key in client components ──────────────────────────────────
echo ""
echo "5. Service role key in client components"
CLIENT_FILES=$(grep -rl '"use client"' src/ --include="*.tsx" --include="*.ts" 2>/dev/null || true)
if [ -n "$CLIENT_FILES" ]; then
  if echo "$CLIENT_FILES" | xargs grep -l "SERVICE_ROLE_KEY" 2>/dev/null; then
    fail "SUPABASE_SERVICE_ROLE_KEY used in a client component"
  else
    ok "Service role key not found in client components"
  fi
fi

# ── 6. Sitemap doesn't include user URLs ─────────────────────────────────────
echo ""
echo "6. Sitemap user URL check"
if grep -E "/@|/p/|username|profile" src/app/sitemap.ts 2>/dev/null | grep -v "//"; then
  fail "sitemap.ts may be including user URLs"
else
  ok "sitemap.ts looks clean"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "─────────────────────"
if $PASS; then
  echo -e "${GRN}All checks passed${NC}"
  exit 0
else
  echo -e "${RED}Issues found — review before pushing${NC}"
  exit 1
fi
