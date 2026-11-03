# ShopReel Architecture
 `git commit`after every new phase yrse;f


do git commit yrself i will not do 
https://github.com/aman71711/ShopReel.git
repo do here all thing
## Status and source precedence

This document is the implementation architecture for the Phase 0 plan. It is
based on the canonical repository specification in `docs/SPEC.md` plus the
base requirements in `doc/SPEC.md`.

Where the two documents conflict, the binding amendment in `docs/SPEC.md`
wins. `docs/SPEC.md` must be consolidated with the base specification before
the first production release.

The remaining questions below are implementation details, not permission to
weaken the security, retention, quota, or idempotency rules already fixed by
the specifications.

## 1. Proposed repository structure

The Vite application remains at the repository root. This keeps the static
frontend, Cloudflare Pages Functions, and deployment configuration in one
Pages project.

```text
/
├── src/
│   ├── app/                 # Router, providers, route-level error boundary
│   ├── components/          # Shared UI and accessible primitives
│   ├── features/
│   │   ├── auth/            # Login, session, onboarding
│   │   ├── feed/            # Feed query, cursor pagination, video virtualization
│   │   ├── discover/        # Search and tag filters
│   │   ├── upload/          # Compression, validation, upload orchestration
│   │   ├── reels/           # Reel detail, likes, comments, reports, sharing
│   │   ├── creator/         # Public creator page
│   │   ├── commerce/        # Wishlist, bag, click-outs, purchases
│   │   ├── profile/         # Own profile and reel management
│   │   ├── settings/        # Locale, export, deletion, legal links
│   │   └── admin/           # Moderation and admin-only operations
│   ├── lib/
│   │   ├── supabase/        # Browser client and generated database types
│   │   ├── storage/         # StorageProvider and R2-facing abstractions
│   │   ├── video/           # VideoProvider and compression abstractions
│   │   ├── validation/      # Shared Zod schemas
│   │   ├── i18n/            # English and Hindi resources
│   │   └── telemetry/       # Consent-gated Sentry/analytics adapters
│   ├── routes/              # Route components and lazy-loaded route boundaries
│   └── styles/
├── functions/
│   ├── api/
│   │   ├── upload-url.ts
│   │   ├── finalize-reel.ts
│   │   └── health.ts
│   └── r/
│       └── [id].ts
├── public/
│   ├── ffmpeg/              # Only if the wasm hosting decision permits this
│   └── icons/
├── supabase/
│   ├── migrations/
│   ├── seed.sql             # Local-only demo data
│   └── tests/               # RLS and RPC integration tests
├── scripts/
│   ├── purge-orphan-r2.*
│   └── hard-delete-accounts.*
├── .github/
│   └── workflows/
│       ├── ci.yml
│       ├── keep-alive.yml
│       └── backup-pg.yml
├── docs/
│   ├── SPEC.md
│   ├── ARCHITECTURE.md
│   └── DEPLOY.md
├── _headers
├── .env.example
├── package.json
└── vite.config.ts
```

`StorageProvider` is the only application boundary for media storage and
`VideoProvider` is the only boundary for video delivery/transcoding strategy.
The initial implementations are R2 and browser-side `ffmpeg.wasm`; neither
boundary should expose provider credentials to the browser.

## 2. Runtime components and trust boundaries

```text
Browser
  ├── Supabase anon client ──> Supabase Auth/Postgres (RLS enforced)
  ├── authenticated Function calls ──> Cloudflare Pages Functions
  └── signed PUT ──> Cloudflare R2

Pages Functions
  ├── verify Supabase JWT
  ├── use Supabase service key only server-side
  ├── issue/verify R2 signed operations
  └── return share HTML and health status

Scheduled GitHub Actions / cleanup worker
  ├── ping health endpoint
  ├── purge orphan R2 objects
  ├── hard-delete expired accounts
  └── write encrypted/private pg_dump to R2
```

The browser may use the Supabase anon key, but never receives the Supabase
service key, R2 access keys, or unrestricted object URLs. Client writes are
limited to RLS-safe own-row operations. Validation, rate limiting, counters,
cross-user effects, and administrative changes use RPCs.

## 3. Database tables and RLS outline

All tables have `id uuid`, `created_at`, `updated_at` unless a composite key is
more appropriate. User content has `deleted_at` where applicable. RLS is
enabled on every table; no table relies on obscurity or UI checks.

| Table | Main data | Client read policy | Client write policy |
|---|---|---|---|
| `profiles` | Auth-linked profile, handle, locale, moderation fields | No direct public select; expose only safe fields through `public_profiles` | No direct client update; onboarding/profile RPCs only |
| `consents` | Versioned terms, privacy, analytics consent | Own rows | Own consent through onboarding/settings RPCs |
| `reels` | Metadata, media keys/URLs, product details, status, counters | Published reels; creator sees own rows as appropriate | Create/finalize, update, delete RPCs; no client counter/status writes |
| `likes` | `(user_id, reel_id)` relationship | Own rows; aggregate state comes from feed/detail query | `toggle_like` RPC only |
| `comments` | Reel comments and moderation status | Visible comments; author/admin access to own/moderated rows | `add_comment` and delete-own-comment RPCs |
| `wishlist_items` | `(user_id, reel_id)` | Own rows | Own rows only, with ownership and uniqueness constraints |
| `bag_items` | `(user_id, reel_id)` | Own rows | Own rows only, with ownership and uniqueness constraints |
| `click_outs` | External click and optional purchase mark | Own rows | `log_click_out` and `mark_purchased` RPCs |
| `reports` | User reports of reels/comments/users | Reporter sees own reports; admins see queue | `report_content` RPC; admin moderation RPCs update status |
| `allowed_store_domains` | Active exact domains and subdomain policy | No public management; validation may use restricted function | Admin RPC only; audit each change |
| `rate_limits` | Per-user action windows and counts | No client access | Atomic `check_rate_limit` function only |
| `audit_log` | Admin actions and security events | Admin-only, preferably service/admin RPC access | Server/admin RPC only |
| `admins` | Separate admin membership/authorization | No client access | Out-of-band/service controlled; never client writable |
| `app_settings` | Kill switches such as `uploads_enabled` | Public-safe settings only if needed | Admin RPC only; audit changes |

Additional database objects:

- `public_profiles` view exposes only handle, display name, avatar URL, and bio.
- `search_vector` is maintained for reels; add GIN indexes for full-text and
  tags, plus `pg_trgm` support for typo-tolerant discovery.
- Feed and creator indexes include status, creation time, creator, and the
  pagination/search columns.
- Counter triggers update likes, comments, shares, and click-outs. No client
  can set or increment counters.
- Foreign keys and soft-delete filters prevent dangling user-facing rows.
- Hard deletion retains only the minimum consents and admin audit entries
  required by the retention policy.

RLS helper rules:

1. Every `SECURITY DEFINER` function sets a fixed `search_path`, derives the
   caller from `auth.uid()`, and revokes public execute rights where needed.
2. Ownership checks use the authenticated caller, not a caller-supplied
   `user_id`.
3. Admin checks use the separate `admins` table and `is_admin()`.
4. Anonymous reads are limited to published reels, visible comments, public
   creator profiles, legal content, and share-page metadata.
5. Direct updates cannot change role, moderation status, counters, creator,
   ownership, or timestamps.

## 4. RPC catalogue

The signatures below are the proposed stable application contracts. Exact
Postgres types and error codes belong in the migration design.

| RPC | Inputs | Output | Authorization and behavior |
|---|---|---|---|
| `complete_onboarding` | `handle`, `age_confirmed`, consent versions | Updated profile plus consent result | Authenticated caller; validates handle, age, and required consents |
| `update_profile` | Display name, avatar URL, bio, locale | Updated safe profile | Own profile only; never role/ban/age fields |
| `create_reel` | Verified user ID, object keys/metadata, caption, product details, affiliate URL, tags | New reel ID/status | Service-key/finalize path only; validates objects, domain, limits, first-three review rule |
| `update_reel` | Reel ID and editable metadata | Updated reel | Creator ownership; preserves immutable counters/status rules |
| `delete_reel` | Reel ID | Success/result | Creator ownership; soft-deletes metadata and schedules media cleanup |
| `get_feed` | Cursor, page size | Reels plus `liked`, `saved`, `bagged` viewer flags and next cursor | Public published feed; bounded keyset pagination |
| `search_reels` | Query, tags, cursor, page size | Ranked reel rows plus next cursor | Public published search; bounded FTS/trigram query |
| `toggle_like` | `reel_id` | `{ liked, like_count }` | Authenticated; atomic, rate-limited, ownership-safe |
| `add_comment` | `reel_id`, text | New comment | Authenticated; validates length, status, and rate limit |
| `delete_comment` | `comment_id` | Success/result | Comment author or admin only |
| `report_content` | Target type/ID, reason | Report ID/status | Authenticated; rate-limited and deduplicated as designed |
| `log_share` | `reel_id`, source | Share result/count | Authenticated or explicitly anonymous policy; rate-limited |
| `log_click_out` | `reel_id`, source | Click-out ID/result | Authenticated; records own click and increments counter atomically |
| `mark_purchased` | Click-out ID or reel ID | Updated click-out | Authenticated; only caller's click-out can be marked |
| `export_my_data` | None or export format | JSON-safe user data or export job/result | Authenticated; excludes secrets and other users' data |
| `delete_my_account` | Confirmation token/phrase | Soft-delete timestamp | Authenticated; starts 30-day deletion window |
| `check_rate_limit` | Action, limit/window | Allowed plus current count | Atomic upsert; callable only through trusted functions/RPCs |
| `admin_moderate_report` | Report ID, decision, note | Updated moderation result | Admin only; writes audit log |
| `admin_moderate_reel` | Reel ID, status, note | Updated reel status | Admin only; writes audit log |
| `admin_moderate_comment` | Comment ID, status, note | Updated comment status | Admin only; writes audit log |
| `admin_ban_user` | User ID, reason | Updated moderation result | Admin only; writes audit log |
| `admin_update_store_domain` | Domain, active flag | Updated domain | Admin only; validates domain and writes audit log |

`create_reel` must not be executable by anonymous or ordinary authenticated
clients if the finalize Function is the only supported creation path. The
finalize Function supplies the verified user and server-built media URLs/keys.

## 5. Pages Functions and scheduled operations

### `POST /api/upload-url`

- Verify the Supabase JWT and onboarding/age requirements.
- Check `uploads_enabled`.
- Call the SQL quota/rate-limit function.
- Validate requested media metadata.
- Generate a short-lived R2 PUT signature with a fixed object key.
- Bind the exact `Content-Length`, `Content-Type`, and maximum permitted size
  to the signature.
- Return only the upload URL, key, expiry, and required headers.

### `POST /api/finalize-reel`

- Verify the Supabase JWT.
- Accept object keys and reel metadata, never client-generated media URLs.
- HEAD each R2 object and verify size and content type against limits.
- Build server-side URLs from validated keys.
- Call `create_reel` using the service key and verified user ID.
- Return the created reel/status, or an explicit validation error.

### `GET /r/:id`

- Look up only a published/shareable reel and its poster.
- HTML-escape every user-controlled value in title, description, and URLs.
- Return `200 text/html` containing Open Graph metadata, especially
  `og:image`, plus a JavaScript redirect to `/reel/:id`.
- Do not use a bare HTTP redirect because crawlers need the metadata.

### `GET /api/health`

- Execute a tiny bounded database query.
- Return a non-sensitive `200` response when dependencies are healthy.
- Return an explicit failure status without leaking credentials or internals.

### Scheduled jobs

- Keep-alive request every three days.
- Weekly `pg_dump` to a private R2 backup location.
- Orphan cleanup removes R2 objects older than 24 hours that have no matching
  database row.
- Account hard-delete job processes accounts whose 30-day soft-delete window
  expired, removes R2 media first, then database rows, and retains minimal
  consents/audit entries.

## 6. Authentication and onboarding flow

1. The browser starts a Supabase Auth Google OAuth flow.
2. Auth callback establishes the session; protected routes require a valid
   session and redirect unauthenticated users to `/login`.
3. The app loads the profile using the authenticated user ID.
4. A missing/incomplete profile redirects to `/onboarding`.
5. Onboarding validates the unique handle, confirms age 18+, and records
   versioned Terms and Privacy consent. Analytics consent is optional.
6. `complete_onboarding` performs the authoritative transaction.
7. The client refreshes the session/profile and enters the feed.
8. Email and phone OTP remain disabled feature flags at launch.

## 7. Upload flow

1. An authenticated, onboarded creator selects an input video and product
   image.
2. The browser validates input and lazily loads single-thread
   `ffmpeg.wasm`.
3. Video is compressed to 720x1280 H.264 MP4 with faststart, at most 45
   seconds and at most 12 MB. Poster and product image are compressed to WebP
   under 100 KB and 200 KB respectively.
4. The client requests `/api/upload-url` for each object. The Function checks
   JWT, kill switch, account age/quota, content type, and size, then returns
   short-lived signed PUT URLs with exact length/type constraints.
5. The browser PUTs directly to R2. It reports progress and supports cancel
   and retry without exposing R2 credentials.
6. The client calls `/api/finalize-reel` with object keys and reel metadata.
7. The Function HEADs all objects, verifies their actual size/type, constructs
   server-side URLs, and calls `create_reel`.
8. `create_reel` validates the affiliate URL's HTTPS host against the
   allowlist, text/tag limits, object existence metadata, and creator
   ownership. The creator's first three reels receive `pending_review`; later
   reels publish according to the configured moderation policy.
9. Failed or abandoned uploads remain eligible for orphan cleanup after 24
   hours. R2 objects are deleted before corresponding database rows during
   cleanup/deletion.

## 8. Share-link flow

1. A viewer selects share and the client logs the share through `log_share`
   according to the final anonymous/authenticated policy.
2. The generated public URL is `/r/:id`.
3. A crawler or browser requests the Pages Function.
4. The Function fetches safe published reel metadata, escapes all user text,
   and returns `200` HTML with `og:title`, `og:description`, `og:image`, and a
   canonical target.
5. The page's JavaScript redirects browsers to `/reel/:id`; crawlers can retain
   the OG metadata.
6. Automated tests must cover OG fields, redirect target, unpublished IDs,
   malicious text, and HTML escaping.

## 9. Risks and contradictions

1. **Canonical-document drift:** the base and amendments remain in two files
   until they are consolidated. Tooling and implementation must read both in
   the meantime; no third copy should be introduced.
2. **Free R2 capacity is finite:** a 12 MB output cap is only a per-object
   limit. At 1,000 reels, video alone can approach 12 GB before posters,
   product images, abandoned objects, backups, and replacements. The base
   estimate of “1,000+ reels at ~8 MB” does not hold at the 12 MB maximum.
3. **R2 backups consume the same budget unless separated:** weekly database
   dumps to private R2 add storage and may reduce the media headroom. Retention,
   compression, and backup deletion rules are unspecified.
4. **`ffmpeg.wasm` delivery may exceed Pages limits:** the wasm/core payload
   can exceed the per-file Pages limit and may be expensive for mobile users.
   Hosting it in R2 or a pinned CDN requires a final CSP, CORS, cache, and
   integrity plan.
5. **Cloudflare R2 production delivery needs a custom domain:** `r2.dev` is
   rate-limited/not intended for production; a paid domain is outside the
   otherwise zero-cost launch assumption.
6. **Free-tier limits can change:** Supabase database size, MAU, egress,
   Functions limits, Cloudflare quotas, GitHub Actions minutes, and Sentry
   limits must be rechecked at launch.
7. **Deletion and backups conflict:** a user hard delete may remove primary
    data while historical `pg_dump` files still retain personal data. Backup
    retention and deletion semantics need a privacy decision.
8. **Server-side URLs versus object keys:** the update says `create_reel`
    receives server-built URLs, while the storage abstraction and cleanup
    require stable keys. The schema should retain canonical object keys (or
    define a deterministic key derivation) rather than rely only on URLs.
9. **SEO redirect behavior is crawler-sensitive:** JavaScript redirect after a
    `200` response is required, but some clients do not execute JavaScript.
    Canonical metadata and a no-script fallback need an agreed UX.

## 10. Questions requiring answers before Phase 1/2

1. Where should `ffmpeg.wasm` and its core assets be hosted, and what exact
    CSP/CORS policy should permit them?
2. What are the exact response/error conventions for RPCs and Pages
    Functions so clients can distinguish validation, authentication, rate
    limit, and transient storage failures?
3. Is a paid custom domain acceptable for production R2 delivery despite the
    zero-cost launch goal?
