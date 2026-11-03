# ShopReel Specification Amendments

This is the canonical repository specification. It incorporates the base
requirements from `doc/SPEC.md` and adds binding amendments. Until the two
files are physically consolidated, implementation work must read both files
and apply this file where they conflict.

Endpoints and RPCs

- RPCs to add: `complete_onboarding`, `toggle_like`, `update_reel`, `delete_reel`, `log_share`, `export_my_data`, `search_reels`, `get_feed` (keyset pagination; returns viewer flags liked/saved/bagged in same call).
- RPCs: `add_comment`, `log_click_out`. `toggle_like(reel_id)` is rate-limited.
- `/api/upload-url`: signed URL must include exact `Content-Length` and `Content-Type`. Server must enforce quota checks via SQL function (3 uploads/day for accounts <7 days; 10/day otherwise). First 3 reels per creator go to `pending_review`.
- `/api/finalize-reel`: verifies JWT, issues HEAD to R2 object(s) to confirm size/type, builds server-side URLs from keys, calls `create_reel` with service key and verified user id. Client never submits URLs.
- `/r/:id`: return 200 HTML with Open Graph meta (og:image = poster) and a JS redirect to `/reel/:id`. Escape all user text. Add automated test verifying OG and redirect.
- `/api/health`: used by uptime monitor.

Storage and deletion

- Add `reports` table for user reports with `reporter_id`, `target_type`
  (`reel|comment|user`), `target_id`, `reason`
  (`spam|scam|harassment|sexual|violence|copyright|other`), `status`
  (`open|reviewing|resolved|dismissed`), `admin_id`, `resolution_note`, and
  `resolved_at`. One reporter may have only one open report for a target.
- Hard delete policy: 30 days after account deletion remove reels, comments, likes, wishlist, bag, click_outs and R2 media. Retain minimal consents and admin audit entries.
- purge_orphan_r2: service-key script to remove orphaned R2 objects; must delete R2 objects before DB rows.

Security and DB

- No client-side role changes. The separate `admins` table is the sole source
  of admin authority; `profiles.role` must not contain an `admin` value. Only
  admin RPCs and `/admin` may change `allowed_store_domains`, and every such
  action must produce an `audit_log` entry.
- All SECURITY DEFINER functions must set `search_path`, REVOKE public rights where needed, and call `auth.uid()` to get caller. `check_rate_limit` must be atomic.
- State-changing RPCs return stable error categories for unauthenticated,
  forbidden, not found, invalid input, rate limited, and conflict outcomes.

Tests and deploy

- Add tests for domain validation (evilamazon.in and https://amazon.in@evil.com) and `/r/:id` HTML/OG escaping.
- R2 CORS configuration and CSP must be documented in deploy notes. Note ffmpeg core .wasm hosting plan.
- Add GitHub Action for weekly `pg_dump` to private R2.

Misc

- `log_share` is authenticated, rate-limited, and idempotent for the same
  user/reel/source within the configured window. Anonymous native-share events
  are not persisted.
- `log_click_out` is idempotent for the same user/reel/source within the
  configured click window. `mark_purchased` may only update that user's own
  click-out row and is safe to retry.
- GitHub Actions is authoritative for keep-alive, weekly backup, orphan
  cleanup, and account hard-delete jobs. Jobs use durable per-object or
  per-account idempotency keys.
- Weekly backups retain four snapshots. Account deletion marks matching backup
  records for removal, and backup rotation removes those records from private
  R2 where technically possible.
- Rejected, hidden, deleted, and pending reels count toward the creator's
  first-three threshold, which is per authenticated account.
- Reels retain stable R2 object keys as canonical identifiers and store
  delivery URLs only as replaceable derived values.
- The 12 MB media limit is a launch guardrail, not a promise of 1,000 reels.
  The upload kill switch must activate before aggregate R2 usage reaches the
  configured safety threshold.
- Quotas, Sentry, region, and retention policies as in ARCHITECTURE notes.
- List of DB migrations and RPCs to be implemented will follow after doc approval.
