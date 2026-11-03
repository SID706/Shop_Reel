# Copilot instructions for ShopReel

Save this file as `.github/copilot-instructions.md`. Copilot reads it automatically in every chat.

## Source of truth
- Read `docs/SPEC.md` before any task. Do not contradict it.
- If the spec is unclear or a task would change it, ask first. Do not guess.
- Do only the task requested. No extra features, no unrelated refactors.

## Hard constraint: zero running cost
- Use only the services in the spec's stack table. Do not add paid services, paid APIs or new major dependencies without asking.
- Never store media in the database. Store only URLs. Media goes to R2 through the `StorageProvider` interface.
- Never load unbounded lists. Paginate everything.
- All storage and video access goes through `StorageProvider` / `VideoProvider` interfaces so we can swap providers later.

## Stack
Vite + React + TypeScript (strict), react-router, TanStack Query, Tailwind, shadcn/ui, Supabase (Postgres + Auth + RLS), Cloudflare Pages + Pages Functions, Cloudflare R2, Zod, i18n (en, hi), Vitest, Playwright.

## Code rules
- TypeScript strict. No `any`, no `@ts-ignore`.
- The browser talks to Supabase directly, so **Row Level Security is the security layer**. Every new table gets RLS policies in the same migration. Never disable RLS.
- Anything needing validation, rate limiting or cross-user effects is a Postgres function called via RPC. Do not let the client write counters, status, roles or other users' rows.
- Database changes only through Supabase SQL migrations committed to git.
- Validate every input with Zod on the client and in Functions, plus SQL constraints in the DB.
- Never expose the Supabase service key or R2 keys to the browser. They live only in Pages Functions environment variables. Update `.env.example` for new variables.
- Never use `dangerouslySetInnerHTML` with user content.
- Handle errors: try/catch in user actions, toast with retry, error boundary per route. Never swallow errors silently.
- All user-facing strings in i18n files (en and hi). Prices use `Intl.NumberFormat('en-IN')` in ₹. Money stored as integer paise.

## UI rules
- Mobile-first, test at 360px width. Dark theme as defined in the spec.
- Every icon-only button has an `aria-label`. Tap targets at least 44px. Respect `prefers-reduced-motion`.
- Every screen has loading, empty and error states.
- Only the active reel and its next neighbour mount a `<video>`. Others show the poster.
- Lazy-load heavy code (`ffmpeg.wasm`, comments sheet, admin, upload).

## Workflow
1. For any non-trivial task, first reply with a short plan and the files you will touch. Wait for approval.
2. Implement in small steps. After each step run lint, typecheck and tests, and fix failures.
3. Add or update tests (happy path and one failure path). For database work, add RLS tests proving one user cannot read or change another user's data.
4. Finish with a short summary: what changed, what to test manually, open questions.
5. Do not mark work done if checks fail.
