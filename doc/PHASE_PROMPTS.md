# ShopReel — Phase prompts (zero-cost edition)

Paste these into Copilot Agent mode one at a time, in order. After each phase: run the app, test it yourself, then `git commit`. Start a new chat for each phase so context stays clean.


do git commit yrself i will not do 
Every prompt assumes `docs/SPEC.md` and `.github/copilot-instructions.md` are already in the repo.

## Accounts to create first (all free, no payment needed unless noted)
1. GitHub (repo, Actions)
2. Supabase: new project, region Mumbai (ap-south-1)
3. Cloudflare: Pages, R2 (may ask for a payment method; check at signup)
4. Google Cloud Console: OAuth client for Google login
5. Sentry (free) and a free uptime monitor

---

## Phase 0 — Plan only (no code)
```
Read docs/SPEC.md fully. Do NOT write code yet.
Produce docs/ARCHITECTURE.md with: folder structure, database tables and
RLS policy outline, list of RPC functions with inputs/outputs, the Pages
Functions list, auth flow, upload flow (compress -> presign -> PUT to R2 ->
create_reel), share-link flow, and a list of risks or contradictions you
found in the spec (especially anything that could exceed free-tier limits).
Then list any questions you need answered.
```

## Phase 1 — Scaffold and tooling
```
Implement Phase 1 only. Create the Vite + React + TypeScript (strict)
project with Tailwind, shadcn/ui, react-router, TanStack Query, i18n (en + hi),
ESLint, Prettier, Vitest, Playwright, a Cloudflare Pages Functions folder,
.env.example, and a GitHub Actions workflow running lint, typecheck, test
and build. Add the dark theme tokens and a mobile layout shell with bottom nav
(Feed, Wishlist, Create, Bag, Me). No features yet. Show the commands to run it.
```

## Phase 2 — Database, RLS, RPC
```
Implement Phase 2 only. Write Supabase SQL migrations for every table in
spec section 8 with constraints and indexes, counter triggers, full-text
search vector + pg_trgm, RLS policies on EVERY table, the rate_limits table
and check_rate_limit function, the allowed_store_domains seed, and the RPC
functions: create_reel, add_comment, report_content, log_click_out,
mark_purchased, delete_my_account. Add a seed script (local only) with demo
reels using placeholder media URLs. Write automated RLS tests proving: a user
cannot modify another user's rows, cannot change counters/status/role, and
cannot insert a reel with a non-allowlisted domain.
```

## Phase 3 — Auth and onboarding
```
Implement Phase 3 only. Supabase Auth with Google login, route protection,
and /onboarding (unique handle check, 18+ confirmation, Terms/Privacy consent
saved to consents). Email and phone OTP must exist only as disabled feature
flags. Public routes: /creator/:handle, legal pages, login. Add an e2e test:
sign in (mock) -> onboarding -> feed.
```

## Phase 4 — Storage and upload
```
Implement Phase 4 only. Create StorageProvider and VideoProvider interfaces
with an R2 implementation. Build the Pages Function /api/upload-url (verify the
Supabase JWT, check quota, return a presigned R2 PUT URL with fixed key and max
size). Build /upload: lazy-loaded single-thread ffmpeg.wasm compression to
720x1280 H.264 MP4 with faststart, max 45s, output max 12MB, progress + cancel,
poster frame to WebP <100KB, product image to WebP <200KB, resumable-friendly
error handling, Zod validation, domain allowlist feedback, then create_reel RPC.
Add a cleanup script for orphaned R2 objects. Mock R2 in tests.
```

## Phase 5 — Feed
```
Implement Phase 5 only. The feed from the spec: cursor pagination (10 per
page, prefetch at 3 remaining), scroll-snap, virtualized video (active reel
+ next only), IntersectionObserver autoplay at 60%, pause when tab hidden,
shared persisted mute, saveData/slow-network handling, caption show more/less,
product chip with the affiliate disclosure label, keyboard shortcuts.
Read-only for now. Add a Playwright test that scrolls through 25 reels and
asserts at most 3 video elements exist in the DOM at any time.
```

## Phase 6 — Reel interactions
```
Implement Phase 6 only. Like/unlike (optimistic with rollback), double-tap
heart pop (respect reduced motion), comments sheet with pagination, delete own
comment, report reel/comment, share (native sheet, copy link, WhatsApp), the
/reel/:id page, and the Pages Function /r/:id that returns Open Graph tags then
redirects. Rate limits must be enforced in the DB. Add tests for double-like
prevention and that users cannot delete others' comments.
```

## Phase 7 — Discover and creator pages
```
Implement Phase 7 only. /discover with Postgres full-text + trigram search
via an RPC, tag chips, paginated grid, debounce, empty state. /creator/:handle
with stats and reel grid. Add tests for ranking and a typo query.
```

## Phase 8 — Wishlist, Bag, Purchases
```
Implement Phase 8 only, exactly as spec section 6. Wishlist and Bag (unique
per user+reel, no quantity), "No longer available" rows, Buy buttons as plain
links with rel="sponsored nofollow noopener noreferrer" that also call
log_click_out, the "Did you buy this?" prompt on return, and /purchases with
All/Clicked/Purchased tabs. Do NOT build fake shipped/delivered statuses.
Add an e2e test: save -> add to bag -> buy -> mark purchased.
```

## Phase 9 — Profile, Settings, legal, i18n
```
Implement Phase 9 only. /profile (stats, my reels with edit/delete),
/settings (language en/hi, export my data as JSON, delete account with
30-day soft delete, legal links, grievance page, logout), and legal pages with
placeholder text I will replace after review. Translate every UI string to
Hindi. Gate analytics behind consent.
```

## Phase 10 — Admin moderation
```
Implement Phase 10 only. /admin for role=admin: report queue, pending-review
reels, hide/remove reel or comment, ban user, edit allowed_store_domains, with
every action written to audit_log. All admin actions are RPCs checking
is_admin(). Auto-hide a reel after 5 distinct reports (configurable). Add tests
proving non-admins are rejected.
```

## Phase 11 — Hardening, PWA, performance
```
Implement Phase 11 only. Add security headers in a Cloudflare _headers file
(CSP, HSTS, frame-ancestors none, etc.). Review every RLS policy, RPC and
Function for auth, ownership, validation and rate limiting, and list gaps you
fixed. Add error boundaries and a not-found page. Make it an installable PWA
(manifest, icons, app-shell service worker, offline page). Run Lighthouse
mobile and fix issues to reach 90+ performance and accessibility. Add axe checks.
```

## Phase 12 — Test coverage
```
Implement Phase 12 only. Fill gaps in Vitest and Playwright coverage for all
spec flows. Add a small load test of the feed query and report whether it stays
within free-tier limits. Update CI to run e2e against preview deployments.
```

## Phase 13 — Deploy and keep-alive
```
Implement Phase 13 only. Write docs/DEPLOY.md and config for Cloudflare Pages,
Supabase, R2, and Sentry. Add /api/health and a GitHub Actions cron that pings
it every 3 days to prevent Supabase's inactivity pause. Add the scheduled
cleanup jobs (orphan R2 objects, 30-day account hard deletes). Document env
vars, how to back up the database manually (free plan has no point-in-time
recovery), the custom-domain step for R2 video delivery, and a launch
checklist. Do not put real secrets in any file.
```

---

## Review prompt (use with a DIFFERENT model after each phase)
Switch the model picker to another model and paste:
```
Review the changes from the last commit against docs/SPEC.md and
.github/copilot-instructions.md. Do not edit code. List: (1) spec violations,
(2) security issues (RLS gaps, RPC validation, XSS, exposed secrets),
(3) anything that could exceed free-tier limits or add cost, (4) bugs and race
conditions, (5) accessibility and mobile problems, (6) missing tests.
Rank by severity.
```
Paste the findings back to the building model: "Fix these, high severity first."
