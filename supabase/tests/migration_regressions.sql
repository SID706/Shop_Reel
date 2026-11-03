begin;

create extension if not exists pgtap;
select plan(11);

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'create_reel'
      and p.proargtypes::oid[] = array[
        'text'::regtype, 'text'::regtype, 'text'::regtype,
        'text'::regtype, 'text'::regtype, 'numeric'::regtype,
        'bigint'::regtype, 'text'::regtype, 'text'::regtype,
        'bigint'::regtype, 'text'::regtype, 'text'::regtype,
        'text[]'::regtype
      ]::oid[]
  ),
  'create_reel has the stable expected signature'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.create_reel(text, text, text, text, text, numeric, bigint, text, text, bigint, text, text, text[])',
    'execute'
  ),
  'anonymous users cannot execute create_reel'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.create_reel(text, text, text, text, text, numeric, bigint, text, text, bigint, text, text, text[])',
    'execute'
  ),
  'authenticated users cannot execute create_reel directly'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.create_reel(text, text, text, text, text, numeric, bigint, text, text, bigint, text, text, text[])',
    'execute'
  ),
  'service_role can execute create_reel through finalize'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.reels'::regclass),
  'reels has row-level security enabled'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  'profiles has row-level security enabled'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'reels'
      and policyname = 'reels_read_published'
  ),
  'reels has a published-only read policy'
);

select ok(
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.reels'::regclass
      and tgname = 'reels_store_domain'
  ),
  'reels validates affiliate domains through a trigger'
);

select ok(
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.reels'::regclass
      and tgname = 'reels_protected'
  ),
  'reels protects status and counters through a trigger'
);

select ok(
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.profiles'::regclass
      and tgname = 'profiles_protected'
  ),
  'profiles protects role and moderation fields through a trigger'
);

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'check_rate_limit_for_user'
      and p.proargtypes::oid[] = array[
        'uuid'::regtype, 'text'::regtype, 'integer'::regtype, 'interval'::regtype
      ]::oid[]
  ),
  'upload quota uses a user-scoped atomic rate-limit helper'
);

select * from finish();
rollback;
