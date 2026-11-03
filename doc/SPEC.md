# ShopReel — Production Spec (v2, zero-cost launch, built to scale)

This file is the base product specification. The canonical repository
specification is `docs/SPEC.md`, which must be read together with this file
until the amendments are consolidated. The amendments take precedence where
they conflict with this base document. Never build anything that contradicts
the canonical specification. If something is unclear, ask before coding.

**Rule of this version:** every service must have a free tier that allows commercial use, and every paid upgrade later must be a configuration swap, not a rewrite.

## 1. Product
ShopReel is a mobile-first short-video shopping app. Creators upload vertical product reels with an affiliate link. Viewers watch a feed, like, comment, share, save products, and click out to buy on the store's own site.

**Important truth:** purchases happen on external stores (Amazon, Flipkart, etc.). ShopReel does NOT process payments or know shipping status. Do not fake order statuses (see section 6).

Target: users across India on mid-range Android phones with patchy 3G/4G. Languages: English and Hindi.

## 2. Out of scope for v1
In-app payments, creator payouts, DMs, follows, push notifications, live streams, native apps, phone/SMS OTP (costs money), server-side video transcoding (costs money).

## 3. Tech stack (fixed, all free tiers)
| Layer | Choice | Why |
|---|---|---|
| Frontend | Vite + React + TypeScript (strict), react-router, TanStack Query | Static build, hostable for free |
| UI | Tailwind CSS, shadcn/ui, Framer Motion, Sonner, lucide-react | |
| Hosting + API | Cloudflare Pages with Pages Functions | Free tier allows commercial use. (Vercel's free plan forbids commercial use, so do NOT use it.) |
| Database + Auth | Supabase (Postgres, Mumbai region ap-south-1) | Free plan: 500 MB DB, 50k MAU |
| Video + image storage | Cloudflare R2 behind a `StorageProvider` interface | 10 GB free, zero egress fees |
| Auth methods | Google login only at launch | Free. Email/phone OTP added later |
| Search | Postgres full-text + `pg_trgm` | Free, inside the DB |
| Rate limiting | Postgres table + SQL function | Free. Swappable for Redis later |
| Validation | Zod (client and Functions); SQL constraints in DB | |
| i18n | i18next or react-intl (en, hi) | |
| Video compression | `ffmpeg.wasm` in the creator's browser, lazy-loaded on `/upload` only | Replaces paid server transcoding |
| Monitoring | Sentry free tier, Cloudflare Web Analytics, free uptime monitor | |
| Tests | Vitest, Playwright, axe | |
| CI/CD | GitHub Actions | |
| Migrations | Supabase CLI SQL migrations, committed to git | |

Do not add other major libraries or paid services without asking.

## 4. Free-tier budget (design to stay inside these)
- DB 500 MB: store only text and URLs. Never store media in the DB.
- R2 10 GB: treat storage as a hard launch guardrail. Enforce the 12 MB
  per-video limit, measure aggregate media and backup usage, and pause uploads
  before the bucket approaches capacity.
- Supabase egress and Functions request limits: keep API payloads small, paginate everything, cache what you can.
- Supabase free projects pause after 7 days with no activity. A scheduled GitHub Action pings `/api/health` (which runs a tiny DB query) every 3 days.
- Verify all free-tier numbers on each provider's pricing page before launch, because they change.

## 5. Scale path (swap, don't rewrite)
| When you outgrow | Free now | Upgrade |
|---|---|---|
| Video storage over 10 GB | R2 free | R2 pay-as-you-go (storage is cheap, egress still free) |
| Slow networks / need adaptive streaming | Compressed MP4 | Implement a `VideoProvider` for Cloudflare Stream or Mux |
| DB over 500 MB or pause risk | Supabase Free | Supabase Pro |
| API request limits | Pages Functions free | Workers Paid plan |
| More login options | Google only | Email OTP via an SMTP provider, then phone OTP via MSG91 after DLT registration |
| Rate limiting / caching | Postgres | Redis (Upstash) |
| Search quality | Postgres FTS | Typesense/Meilisearch/Algolia |
| SEO / SSR | SPA + share pages via Functions | Migrate to Next.js, reusing shared logic |

To make this possible: all storage and video access goes through `StorageProvider` and `VideoProvider` interfaces, and business rules live in SQL functions and shared TypeScript modules, not scattered in components.

## 6. Affiliate and "orders" (honest design)
1. **Bag** = "to buy" list. Each row has **Buy on {store}**. No bulk checkout (browsers block multiple popups).
2. Buy buttons are normal links: `<a href=affiliate_url target="_blank" rel="sponsored nofollow noopener noreferrer">`. On click, also fire a logging call (`log_click_out` RPC) that records a `click_outs` row and increments `click_count`.
3. When the user returns to the app (visibility change), show "Did you buy {product}?" Yes sets `purchased_marked_at`.
4. **Purchases page** (replaces Order History): tabs All, Clicked, Purchased. Only statuses we truly know.
5. Every reel with an affiliate link shows: **"Affiliate link — creator may earn a commission."**
6. The affiliate URL domain is validated against `allowed_store_domains` when a reel is created (enforced in the DB, not just the UI).
7. Future: conversion postbacks from an affiliate network can add a "Confirmed" status.

## 7. Pages and routes
| Route | Purpose |
|---|---|
| `/` | Feed |
| `/discover` | Search and tag filters |
| `/upload` | Creator upload |
| `/bag` | To-buy list |
| `/wishlist` | Saved products |
| `/purchases` | Click-out and purchase history |
| `/profile` | Own profile, stats, own reels (edit/delete) |
| `/settings` | Language, export data, delete account, legal links, log out |
| `/creator/:handle` | Public creator page |
| `/reel/:id` | In-app reel page |
| `/r/:id` | Share link, served by a Pages Function that returns Open Graph tags (for WhatsApp previews) then redirects to `/reel/:id` |
| `/login`, `/onboarding` | Auth and first-run setup |
| `/legal/terms`, `/legal/privacy`, `/legal/affiliate-disclosure`, `/legal/grievance` | Legal |
| `/admin` | Moderation (admin only) |

Removed from the original: swipe-between-tabs navigation, fake settings toggles, dead links.

### Feed
- Cursor-paginated: 10 reels per page, prefetch next page when 3 remain. Never load all reels.
- Scroll-snap, each reel `h-[100dvh]`.
- **Virtualized video:** only the active reel and its next neighbour mount a `<video>`; all others show the poster image only.
- Plain MP4 with `preload="metadata"`, `playsInline`, poster shown instantly. Autoplay muted at ≥60% visible; pause when off-screen or tab hidden.
- If `navigator.connection.saveData` is on or the connection is slow: do not preload the next reel.
- Mute state shared and persisted. Overlay, product chip, disclosure label, action rail, double-tap-to-like with heart pop (respect reduced motion), comments sheet, report buttons, share (native sheet, copy link, WhatsApp). Keyboard shortcuts on desktop.

### Upload
- Requires login, completed onboarding, 18+ confirmed.
- **Limits that protect the free tier:** max 45 seconds, output max 12 MB, max 720p (720x1280), H.264 MP4 with `faststart`. Input file up to 150 MB accepted, then compressed in the browser with `ffmpeg.wasm` (single-thread build, lazy-loaded, with a progress bar and cancel). If compression fails, show a clear message with tips (lower the phone's recording resolution).
- Poster image generated in the browser from a video frame, compressed to WebP under 100 KB.
- Product image compressed in the browser to WebP under 200 KB.
- Upload goes directly to R2 using a short-lived presigned PUT URL issued by a Pages Function (`/api/upload-url`) that checks login, daily quota (3 uploads per day for accounts under 7 days old, 10 otherwise), and fixes the object key and max size.
- `create_reel` RPC validates the URL domain, tag count, text lengths, and that the objects exist and are within size limits. A scheduled job deletes orphaned R2 objects older than 24 hours.
- Status: new creators' first 3 reels go to `pending_review` (configurable); others publish immediately.
- Handle comes from the logged-in profile, never typed in the form.

### Other pages
Discover (server-side search, tag chips, paginated grid), creator page, wishlist, bag, purchases, profile (stats, my reels with edit/delete), settings (language en/hi, export my data as JSON, delete account with 30-day soft delete then hard delete via scheduled job, legal links, grievance contact, log out), admin (report queue, pending-review reels, hide/remove reel or comment, ban user, edit allowed domains; all actions logged).

## 8. Data model (Postgres)
All tables: `id` (uuid), `created_at`, `updated_at`. User content uses soft delete (`deleted_at`).

- **profiles** — `id` (= auth user id), `handle` (unique, `[a-z0-9_]{3,20}`), `display_name`, `avatar_url`, `bio`, `role` (`user|creator`), `locale`, `age_confirmed_at`, `banned_at`.
- **admins** — `user_id` (= auth user id), `created_at`, `created_by`, and
  `revoked_at`. This table is the sole source of admin authority. It is
  service-controlled and has no client insert/update/delete policy.
- **consents** — `user_id`, `type` (`terms|privacy|analytics`), `version`, `accepted_at`.
- **reels** — `creator_id`, `video_url`, `poster_url`, `duration_s`, `size_bytes`, `caption` (≤300), `product_name` (≤120), `price_paise` (int, nullable), `product_image_url`, `affiliate_url`, `store_domain`, `tags` (text[], max 5), `like_count`, `comment_count`, `share_count`, `click_count`, `status` (`published|pending_review|hidden|removed`), `search_vector`.
- **likes** — PK (`user_id`, `reel_id`).
- **comments** — `reel_id`, `user_id`, `text` (≤500), `status` (`visible|hidden`).
- **wishlist_items**, **bag_items** — unique (`user_id`, `reel_id`). No quantity.
- **click_outs** — `user_id`, `reel_id`, `source`, `purchased_marked_at`.
- **reports** — `reporter_id`, `target_type` (`reel|comment|user`),
  `target_id`, `reason` (`spam|scam|harassment|sexual|violence|copyright|other`),
  `status` (`open|reviewing|resolved|dismissed`), `admin_id`, `resolution_note`,
  `resolved_at`. A reporter may have only one open report for the same target.
- **allowed_store_domains** — `domain`, `active`. Seed: amazon.in, amzn.to, flipkart.com, fkrt.it, myntra.com, ajio.com, nykaa.com, meesho.com.
- **rate_limits** — `user_id`, `action`, `window_start`, `count`.
- **audit_log** — admin actions.

Rules:
- **Row Level Security is ON for every table and is the main security layer**, because the browser talks to Supabase directly. Public can read published reels and visible comments. Users can read/write only their own likes, wishlist, bag, click_outs, consents. Clients cannot update counters, status, role, or other users' rows.
- Counters are maintained by DB triggers, never sent by the client.
- Anything needing validation or rate limiting is a Postgres function called via RPC: `create_reel`, `add_comment`, `report_content`, `log_click_out`, `mark_purchased`, `delete_my_account`, and admin functions (which check `is_admin()`). State-changing RPCs must be atomic and return stable error codes for `unauthenticated`, `forbidden`, `not_found`, `invalid_input`, `rate_limited`, and `conflict`.
- Indexes: `reels(status, created_at desc)`, `reels(creator_id)`, GIN on `search_vector` and `tags`, `comments(reel_id, created_at)`.
- Product details live on the reel. If a reel is removed, bag/wishlist rows show "No longer available".
- Generate TypeScript types from the DB schema.

## 9. Pages Functions (the only server code)
- `/api/upload-url` — auth check, quota check, returns presigned R2 PUT URL.
- `/r/:id` — returns HTML with Open Graph tags, then redirects to `/reel/:id`.
- `/api/health` — runs a tiny DB query, returns 200.
- Scheduled cleanup via GitHub Actions: orphan R2 objects, 30-day account
  hard deletes, and weekly backups. Jobs use a durable job lock/idempotency
  key so retries cannot process the same account or object twice.

Secrets (R2 keys, Supabase service key) exist only in Pages Functions environment variables. The browser only gets the Supabase anon key, which is safe because RLS is on.

## 10. Auth and onboarding
- Google login at launch. Email OTP and phone OTP are behind feature flags, off.
- `/onboarding`: unique handle, "I am 18 or older", accept Terms and Privacy (versioned in `consents`), optional analytics consent.
- Protected routes redirect to `/login`. Public: `/r/:id`, `/creator/:handle`, legal pages.

## 11. Security
- Every write is either an RLS-guarded own-row write or an RPC with validation, ownership check and rate limit.
- Never trust client-sent counts, user ids, or prices.
- No `dangerouslySetInnerHTML` with user content.
- Security headers via Cloudflare `_headers` file: CSP, HSTS, X-Content-Type-Options, Referrer-Policy, frame-ancestors none.
- Secrets only in environment variables. `.env.example` committed, `.env` ignored.
- Server-side limits on upload size and type.
- Error boundaries on every route; user actions catch errors and show a toast with retry; details go to Sentry.
- Dependabot and `npm audit` in CI.
- **Test RLS explicitly:** write tests that prove user A cannot read or change user B's data.

## 12. Compliance (India) — have a lawyer review before real launch
DPDP Act 2023 (privacy notice, versioned consent, export and deletion, 18+ only), IT Rules 2021 intermediary duties (Terms, named Grievance Officer, report/takedown flow), affiliate disclosure label, analytics only after consent, prohibited content policy.

## 13. Performance and PWA
Targets on throttled "Slow 4G" mid-range Android: first poster under 2.5 s, video starts under 3 s, initial JS under 200 KB gzipped on the feed route. Lazy-load `ffmpeg.wasm`, comments sheet, admin and upload routes. Installable PWA (manifest, icons, app-shell service worker, offline page). Responsive WebP images with explicit dimensions.

## 14. Domain note
The app can run on a free `*.pages.dev` address. R2's free `r2.dev` URLs are rate-limited and not meant for production, so before real launch attach a custom domain to the R2 bucket for video delivery. A domain (about ₹100–800 per year) is the one thing worth paying for. Cloudflare may also ask for a payment method to enable R2 even if you stay inside the free allowance; check at signup.

## 15. Environments
local, preview (per PR), production. Migrations via Supabase CLI in CI. Seed script for local only. Feature flags in env vars.

## 16. Definition of done (per feature)
1. Matches this spec. 2. Strict TypeScript, linted. 3. Validated input, RLS/ownership verified. 4. Loading, empty and error states. 5. Works at 360px width. 6. Accessible (labels, focus, contrast, tap targets 44px). 7. Strings in i18n files (en + hi). 8. Tests for happy path and one failure path. 9. No console errors. 10. Stays inside the free-tier budget in section 4.
