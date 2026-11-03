begin;

create extension if not exists pgtap;
select plan(20);

select has_table('public', 'profiles');
select has_table('public', 'reels');
select has_table('public', 'rate_limits');
select ok((select count(*) = 1 from pg_policies where schemaname = 'public' and tablename = 'profiles'), 'profiles has its complete policy set');
select ok((select count(*) = 1 from pg_policies where schemaname = 'public' and tablename = 'reels'), 'reels has its complete policy set');
select ok((select count(*) = 3 from pg_policies where schemaname = 'public' and tablename = 'likes'), 'likes has its complete policy set');
select ok((select count(*) = 2 from pg_policies where schemaname = 'public' and tablename = 'comments'), 'comments has its complete policy set');
select ok((select count(*) = 3 from pg_policies where schemaname = 'public' and tablename = 'wishlist_items'), 'wishlist has its complete policy set');
select ok((select count(*) = 3 from pg_policies where schemaname = 'public' and tablename = 'bag_items'), 'bag has its complete policy set');
select ok((select count(*) = 1 from pg_policies where schemaname = 'public' and tablename = 'click_outs'), 'click-outs have their complete policy set');
select ok((select count(*) = 1 from pg_policies where schemaname = 'public' and tablename = 'reports'), 'reports have their complete policy set');
select ok((select count(*) = 1 from pg_policies where schemaname = 'public' and tablename = 'rate_limits'), 'rate limits have a deny-by-default policy');

-- These behavioral checks use the two auth users created by `supabase start`.
-- The test harness supplies TEST_USER_A, TEST_USER_B and TEST_REEL_ID as psql
-- variables, so the same assertions can run against every local database.
\set user_a `echo "$TEST_USER_A"`
\set user_b `echo "$TEST_USER_B"`
\set reel_id `echo "$TEST_REEL_ID"`

set local role authenticated;
select set_config('request.jwt.claim.sub', :'user_a', true);
select is(
  (select count(*) from public.reels where creator_id = :'user_b'::uuid),
  0::bigint,
  'a user cannot read another creator''s unpublished reel'
);

select throws_ok(
  $$insert into public.reels (
    creator_id, video_url, poster_url, duration_s, size_bytes, product_name,
    affiliate_url, store_domain
  ) values (
    :'user_a'::uuid, 'https://placehold.co/video.mp4', 'https://placehold.co/poster.webp',
    5, 1000, 'Direct insert', 'https://amazon.in/item', 'amazon.in'
  )$$,
  '.*row-level security.*',
  'a user cannot insert a reel directly'
);
select throws_ok(
  $$update public.reels set like_count = 99 where id = :'reel_id'::uuid$$,
  '.*forbidden.*',
  'a user cannot change reel counters'
);
select throws_ok(
  $$update public.reels set status = 'removed' where id = :'reel_id'::uuid$$,
  '.*forbidden.*',
  'a user cannot change reel status'
);
select throws_ok(
  $$update public.profiles set role = 'creator' where id = :'user_a'::uuid$$,
  '.*forbidden.*',
  'a user cannot change their role'
);
select throws_ok(
  $$insert into public.wishlist_items(user_id, reel_id) values (:'user_b'::uuid, :'reel_id'::uuid)$$,
  '.*row-level security.*',
  'a user cannot modify another user''s wishlist'
);
select throws_ok(
  $$insert into public.reels (
    creator_id, video_url, poster_url, duration_s, size_bytes, product_name,
    affiliate_url, store_domain
  ) values (
    :'user_a'::uuid, 'https://placehold.co/video.mp4', 'https://placehold.co/poster.webp',
    5, 1000, 'Invalid store', 'https://amazon.in@evil.com/item', 'evilamazon.in'
  )$$,
  '.*allowlisted.*',
  'a user cannot insert a reel with a non-allowlisted domain'
);

select throws_ok(
  $$insert into public.reels (
    creator_id, video_url, poster_url, duration_s, size_bytes, product_name,
    affiliate_url, store_domain
  ) values (
    :'user_a'::uuid, 'https://placehold.co/video.mp4', 'https://placehold.co/poster.webp',
    5, 1000, 'Invalid host', 'https://evilamazon.in/item', 'evilamazon.in'
  )$$,
  '.*allowlisted.*',
  'a user cannot use a lookalike affiliate host'
);

select * from finish();
rollback;
