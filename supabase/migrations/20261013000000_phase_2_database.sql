begin;

create extension if not exists pg_trgm;
create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  handle text not null unique check (handle ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null default '' check (char_length(display_name) <= 80),
  avatar_url text check (avatar_url is null or avatar_url ~ '^https://'),
  bio text not null default '' check (char_length(bio) <= 500),
  role text not null default 'user' check (role in ('user', 'creator')),
  locale text not null default 'en' check (locale in ('en', 'hi')),
  age_confirmed_at timestamptz,
  banned_at timestamptz,
  deleted_at timestamptz
);

create table public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  revoked_at timestamptz
);

create table public.consents (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('terms', 'privacy', 'analytics')),
  version text not null check (char_length(version) between 1 and 40),
  accepted_at timestamptz not null default now(),
  unique (user_id, type, version)
);

create table public.reels (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  creator_id uuid not null references auth.users(id) on delete cascade,
  video_key text not null check (video_key ~ '^[A-Za-z0-9][A-Za-z0-9/_-]{0,500}$'),
  poster_key text not null check (poster_key ~ '^[A-Za-z0-9][A-Za-z0-9/_-]{0,500}$'),
  product_image_key text check (product_image_key is null or product_image_key ~ '^[A-Za-z0-9][A-Za-z0-9/_-]{0,500}$'),
  video_url text not null check (video_url ~ '^https://'),
  poster_url text not null check (poster_url ~ '^https://'),
  duration_s numeric(6,2) not null check (duration_s > 0 and duration_s <= 45),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 12582912),
  caption text not null default '' check (char_length(caption) <= 300),
  product_name text not null check (char_length(product_name) between 1 and 120),
  price_paise bigint check (price_paise is null or price_paise >= 0),
  product_image_url text check (product_image_url is null or product_image_url ~ '^https://'),
  affiliate_url text not null check (affiliate_url ~ '^https://'),
  store_domain text not null check (store_domain = lower(store_domain)),
  tags text[] not null default '{}' check (cardinality(tags) <= 5),
  like_count integer not null default 0 check (like_count >= 0),
  comment_count integer not null default 0 check (comment_count >= 0),
  share_count integer not null default 0 check (share_count >= 0),
  click_count integer not null default 0 check (click_count >= 0),
  status text not null default 'published'
    check (status in ('published', 'pending_review', 'hidden', 'removed')),
  search_vector tsvector
);

create table public.likes (
  user_id uuid not null references auth.users(id) on delete cascade,
  reel_id uuid not null references public.reels(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, reel_id)
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  reel_id uuid not null references public.reels(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null check (char_length(btrim(text)) between 1 and 500),
  status text not null default 'visible' check (status in ('visible', 'hidden'))
);

create table public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reel_id uuid not null references public.reels(id) on delete cascade,
  unique (user_id, reel_id)
);

create table public.bag_items (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reel_id uuid not null references public.reels(id) on delete cascade,
  unique (user_id, reel_id)
);

create table public.click_outs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reel_id uuid not null references public.reels(id) on delete cascade,
  source text not null check (source in ('feed', 'reel', 'bag', 'wishlist', 'creator')),
  purchased_marked_at timestamptz,
  unique (user_id, reel_id, source)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('reel', 'comment', 'user')),
  target_id uuid not null,
  reason text not null check (reason in ('spam', 'scam', 'harassment', 'sexual', 'violence', 'copyright', 'other')),
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  admin_id uuid references auth.users(id),
  resolution_note text check (resolution_note is null or char_length(resolution_note) <= 1000),
  resolved_at timestamptz
);

create table public.allowed_store_domains (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  domain text not null unique check (domain = lower(domain) and domain ~ '^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$'),
  active boolean not null default true
);

create table public.rate_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (action ~ '^[a-z0-9_:-]{1,80}$'),
  window_start timestamptz not null,
  count integer not null default 0 check (count >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, action)
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  admin_id uuid not null references auth.users(id),
  action text not null check (char_length(action) between 1 and 100),
  target_type text,
  target_id uuid,
  details jsonb not null default '{}'::jsonb
);

create table public.app_settings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  key text not null unique check (key ~ '^[a-z0-9_:-]{1,80}$'),
  value jsonb not null default '{}'::jsonb
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins
    where user_id = auth.uid() and revoked_at is null
  );
$$;

create or replace function public.system_write_enabled()
returns boolean
language sql
stable
as $$
  select current_setting('shopreel.system_write', true) = 'on';
$$;

create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
as $$
begin
  if not public.system_write_enabled() and current_user not in ('postgres', 'supabase_admin')
     and (new.role is distinct from old.role
       or new.banned_at is distinct from old.banned_at
       or new.age_confirmed_at is distinct from old.age_confirmed_at
       or new.deleted_at is distinct from old.deleted_at
       or new.id is distinct from old.id
       or new.created_at is distinct from old.created_at) then
    raise exception using message = 'forbidden: protected profile field';
  end if;
  return new;
end;
$$;

create or replace function public.protect_reel_fields()
returns trigger
language plpgsql
as $$
begin
  if not public.system_write_enabled() and current_user not in ('postgres', 'supabase_admin')
     and (new.creator_id is distinct from old.creator_id
       or new.status is distinct from old.status
       or new.like_count is distinct from old.like_count
       or new.comment_count is distinct from old.comment_count
       or new.share_count is distinct from old.share_count
       or new.click_count is distinct from old.click_count
       or new.created_at is distinct from old.created_at
       or new.search_vector is distinct from old.search_vector) then
    raise exception using message = 'forbidden: protected reel field';
  end if;
  return new;
end;
$$;

create or replace function public.protect_reel_insert_fields()
returns trigger
language plpgsql
as $$
begin
  if not public.system_write_enabled() and current_user not in ('postgres', 'supabase_admin')
     and (new.like_count <> 0
       or new.comment_count <> 0
       or new.share_count <> 0
       or new.click_count <> 0
       or new.status <> 'pending_review') then
    raise exception using message = 'forbidden: protected reel field';
  end if;
  return new;
end;
$$;

create or replace function public.validate_store_domain()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  host text;
begin
  if new.affiliate_url !~ '^https://' then
    raise exception using message = 'invalid_input: affiliate URL must use HTTPS';
  end if;
  host := lower((regexp_match(new.affiliate_url, '^https://([^/?#]+)'))[1]);
  if host is null or position('@' in host) > 0 or not exists (
    select 1 from public.allowed_store_domains d
    where d.active and (host = d.domain or host like '%.' || d.domain)
  ) then
    raise exception using message = 'invalid_input: store domain is not allowlisted';
  end if;
  if new.store_domain <> host then
    raise exception using message = 'invalid_input: store domain does not match URL';
  end if;
  return new;
end;
$$;

create or replace function public.refresh_reel_search_vector()
returns trigger
language plpgsql
as $$
begin
  new.search_vector := to_tsvector(
    'simple',
    concat_ws(' ', new.product_name, new.caption, array_to_string(new.tags, ' '))
  );
  return new;
end;
$$;

create or replace function public.reel_counter_delta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  delta integer := case when tg_op = 'INSERT' then 1 else -1 end;
  column_name text := tg_argv[0];
begin
  execute format(
    'update public.reels set %I = greatest(0, %I + $1), updated_at = now() where id = $2',
    column_name, column_name
  ) using delta, case when tg_op = 'DELETE' then old.reel_id else new.reel_id end;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger profiles_protected before update on public.profiles
for each row execute function public.protect_profile_fields();
create trigger consents_updated_at before update on public.consents
for each row execute function public.set_updated_at();
create trigger reels_updated_at before update on public.reels
for each row execute function public.set_updated_at();
create trigger reels_protected before update on public.reels
for each row execute function public.protect_reel_fields();
create trigger reels_insert_protected before insert on public.reels
for each row execute function public.protect_reel_insert_fields();
create trigger reels_search_vector before insert or update of product_name, caption, tags on public.reels
for each row execute function public.refresh_reel_search_vector();
create trigger reels_store_domain before insert or update of affiliate_url, store_domain on public.reels
for each row execute function public.validate_store_domain();
create trigger comments_updated_at before update on public.comments
for each row execute function public.set_updated_at();
create trigger wishlist_updated_at before update on public.wishlist_items
for each row execute function public.set_updated_at();
create trigger click_outs_updated_at before update on public.click_outs
for each row execute function public.set_updated_at();
create trigger reports_updated_at before update on public.reports
for each row execute function public.set_updated_at();
create trigger domains_updated_at before update on public.allowed_store_domains
for each row execute function public.set_updated_at();
create trigger settings_updated_at before update on public.app_settings
for each row execute function public.set_updated_at();

create trigger likes_counter after insert or delete on public.likes
for each row execute function public.reel_counter_delta('like_count');
create trigger comments_counter after insert or delete on public.comments
for each row execute function public.reel_counter_delta('comment_count');
create trigger clicks_counter after insert or delete on public.click_outs
for each row execute function public.reel_counter_delta('click_count');

create index reels_status_created_idx on public.reels (status, created_at desc);
create index reels_creator_idx on public.reels (creator_id, created_at desc);
create index reels_search_vector_idx on public.reels using gin (search_vector);
create index reels_tags_idx on public.reels using gin (tags);
create index reels_caption_trgm_idx on public.reels using gin (caption gin_trgm_ops);
create index reels_product_name_trgm_idx on public.reels using gin (product_name gin_trgm_ops);
create index comments_reel_created_idx on public.comments (reel_id, created_at desc);
create index reports_target_idx on public.reports (target_type, target_id);
create unique index reports_open_target_idx on public.reports (reporter_id, target_type, target_id)
where status = 'open';

create view public.public_profiles as
select id, handle, display_name, avatar_url, bio
from public.profiles
where deleted_at is null and banned_at is null;

revoke all on public.public_profiles from public;
grant select on public.public_profiles to anon, authenticated;

alter table public.profiles enable row level security;
alter table public.admins enable row level security;
alter table public.consents enable row level security;
alter table public.reels enable row level security;
alter table public.likes enable row level security;
alter table public.comments enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.bag_items enable row level security;
alter table public.click_outs enable row level security;
alter table public.reports enable row level security;
alter table public.allowed_store_domains enable row level security;
alter table public.rate_limits enable row level security;
alter table public.audit_log enable row level security;
alter table public.app_settings enable row level security;

create policy profiles_select_own on public.profiles for select to authenticated using (id = auth.uid());
create policy reels_read_published on public.reels for select using (
  (status = 'published' and deleted_at is null) or creator_id = auth.uid()
);
create policy likes_select_own on public.likes for select to authenticated using (user_id = auth.uid());
create policy likes_insert_own on public.likes for insert to authenticated with check (user_id = auth.uid());
create policy likes_delete_own on public.likes for delete to authenticated using (user_id = auth.uid());
create policy comments_read_visible on public.comments for select using (
  (status = 'visible' and deleted_at is null)
  or user_id = auth.uid()
);
create policy wishlist_select_own on public.wishlist_items for select to authenticated using (user_id = auth.uid());
create policy wishlist_insert_own on public.wishlist_items for insert to authenticated with check (user_id = auth.uid());
create policy wishlist_delete_own on public.wishlist_items for delete to authenticated using (user_id = auth.uid());
create policy bag_select_own on public.bag_items for select to authenticated using (user_id = auth.uid());
create policy bag_insert_own on public.bag_items for insert to authenticated with check (user_id = auth.uid());
create policy bag_delete_own on public.bag_items for delete to authenticated using (user_id = auth.uid());
create policy click_outs_select_own on public.click_outs for select to authenticated using (user_id = auth.uid());
create policy reports_select_own on public.reports for select to authenticated using (reporter_id = auth.uid() or public.is_admin());
create policy admin_read_domains on public.allowed_store_domains for select to authenticated using (public.is_admin());
create policy admin_read_audit on public.audit_log for select to authenticated using (public.is_admin());
create policy admin_read_admins on public.admins for select to authenticated using (public.is_admin());
create policy consents_select_own on public.consents for select to authenticated using (user_id = auth.uid());
create policy consents_insert_own on public.consents for insert to authenticated with check (user_id = auth.uid());
create policy rate_limits_no_client_access on public.rate_limits for all to authenticated
using (false) with check (false);
create policy app_settings_public_read on public.app_settings for select using (key in ('uploads_enabled'));

create or replace function public.check_rate_limit(
  p_action text,
  p_limit integer,
  p_window interval
)
returns table (allowed boolean, current_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  next_count integer;
begin
  if caller is null then
    raise exception using message = 'unauthenticated: login required';
  end if;
  if p_limit <= 0 or p_window <= interval '0' or p_action is null then
    raise exception using message = 'invalid_input: invalid rate limit';
  end if;
  insert into public.rate_limits(user_id, action, window_start, count)
  values (caller, p_action, now(), 1)
  on conflict (user_id, action) do update
    set window_start = case when public.rate_limits.window_start + p_window <= now()
                            then now() else public.rate_limits.window_start end,
        count = case when public.rate_limits.window_start + p_window <= now()
                     then 1 else public.rate_limits.count + 1 end,
        updated_at = now()
  returning rate_limits.count into next_count;
  return query select next_count <= p_limit, next_count;
end;
$$;

create or replace function public.create_reel(
  p_video_key text,
  p_poster_key text,
  p_product_image_key text,
  p_video_url text,
  p_poster_url text,
  p_duration_s numeric,
  p_size_bytes bigint,
  p_caption text,
  p_product_name text,
  p_price_paise bigint,
  p_product_image_url text,
  p_affiliate_url text,
  p_tags text[] default '{}'
)
returns public.reels
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  host text;
  result public.reels;
  prior_count integer;
begin
  if caller is null then raise exception using message = 'unauthenticated: login required'; end if;
  if current_setting('request.jwt.claim.role', true) <> 'service_role' then
    raise exception using message = 'forbidden: reel creation requires trusted finalize path';
  end if;
  if p_affiliate_url !~ '^https://' then raise exception using message = 'invalid_input: affiliate URL must use HTTPS'; end if;
  host := lower((regexp_match(p_affiliate_url, '^https://([^/?#]+)'))[1]);
  if host is null or position('@' in host) > 0 or not exists (
    select 1 from public.allowed_store_domains d
    where d.active and (host = d.domain or host like '%.' || d.domain)
  ) then
    raise exception using message = 'invalid_input: store domain is not allowlisted';
  end if;
  if array_length(p_tags, 1) > 5 then raise exception using message = 'invalid_input: too many tags'; end if;
  perform 1 from public.profiles where id = caller and deleted_at is null and banned_at is null for update;
  if not found then raise exception using message = 'forbidden: profile is unavailable'; end if;
  select count(*) into prior_count from public.reels where creator_id = caller;
  perform set_config('shopreel.system_write', 'on', true);
  insert into public.reels (
    creator_id, video_key, poster_key, product_image_key, video_url, poster_url, duration_s, size_bytes, caption,
    product_name, price_paise, product_image_url, affiliate_url, store_domain,
    tags, status
  )
  values (
    caller, p_video_key, p_poster_key, p_product_image_key, p_video_url, p_poster_url,
    p_duration_s, p_size_bytes, coalesce(p_caption, ''),
    p_product_name, p_price_paise, p_product_image_url, p_affiliate_url, host,
    coalesce(p_tags, '{}'), case when prior_count < 3 then 'pending_review' else 'published' end
  )
  returning * into result;
  return result;
end;
$$;

create or replace function public.add_comment(p_reel_id uuid, p_text text)
returns public.comments
language plpgsql security definer set search_path = public
as $$
declare result public.comments;
begin
  if auth.uid() is null then raise exception using message = 'unauthenticated: login required'; end if;
  if not exists (select 1 from public.reels where id = p_reel_id and status = 'published' and deleted_at is null)
    then raise exception using message = 'not_found: reel not found'; end if;
  if not (select allowed from public.check_rate_limit('comment', 20, interval '1 hour')) then
    raise exception using message = 'rate_limited: too many comments'; end if;
  insert into public.comments(reel_id, user_id, text) values (p_reel_id, auth.uid(), btrim(p_text))
  returning * into result;
  return result;
end;
$$;

create or replace function public.report_content(p_target_type text, p_target_id uuid, p_reason text)
returns public.reports
language plpgsql security definer set search_path = public
as $$
declare result public.reports;
begin
  if auth.uid() is null then raise exception using message = 'unauthenticated: login required'; end if;
  if not (select allowed from public.check_rate_limit('report', 10, interval '1 hour')) then
    raise exception using message = 'rate_limited: too many reports'; end if;
  insert into public.reports(reporter_id, target_type, target_id, reason)
  values (auth.uid(), p_target_type, p_target_id, p_reason)
  returning * into result;
  return result;
exception when unique_violation then
  raise exception using message = 'conflict: report already open';
end;
$$;

create or replace function public.log_click_out(p_reel_id uuid, p_source text)
returns public.click_outs
language plpgsql security definer set search_path = public
as $$
declare result public.click_outs;
begin
  if auth.uid() is null then raise exception using message = 'unauthenticated: login required'; end if;
  if not exists (select 1 from public.reels where id = p_reel_id and status = 'published' and deleted_at is null)
    then raise exception using message = 'not_found: reel not found'; end if;
  if p_source is null or p_source not in ('feed', 'reel', 'bag', 'wishlist', 'creator') then
    raise exception using message = 'invalid_input: invalid click source'; end if;
  insert into public.click_outs(user_id, reel_id, source)
  values (auth.uid(), p_reel_id, p_source)
  on conflict (user_id, reel_id, source) do update set updated_at = now()
  returning * into result;
  return result;
end;
$$;

create or replace function public.mark_purchased(p_click_out_id uuid)
returns public.click_outs
language plpgsql security definer set search_path = public
as $$
declare result public.click_outs;
begin
  if auth.uid() is null then raise exception using message = 'unauthenticated: login required'; end if;
  update public.click_outs
  set purchased_marked_at = coalesce(purchased_marked_at, now()), updated_at = now()
  where id = p_click_out_id and user_id = auth.uid()
  returning * into result;
  if not found then raise exception using message = 'forbidden: click-out not owned by caller'; end if;
  return result;
end;
$$;

create or replace function public.delete_my_account()
returns timestamptz
language plpgsql security definer set search_path = public
as $$
declare deleted_at_value timestamptz := now();
begin
  if auth.uid() is null then raise exception using message = 'unauthenticated: login required'; end if;
  update public.profiles set deleted_at = coalesce(deleted_at, deleted_at_value)
  where id = auth.uid();
  if not found then raise exception using message = 'not_found: profile not found'; end if;
  return deleted_at_value;
end;
$$;

revoke all on function public.check_rate_limit(text, integer, interval) from public, anon, authenticated;
revoke all on function public.is_admin() from public, anon, authenticated;
revoke all on function public.create_reel(text, text, text, text, text, numeric, bigint, text, text, bigint, text, text, text[]) from public, anon, authenticated;
revoke all on function public.add_comment(uuid, text) from public, anon;
revoke all on function public.report_content(text, uuid, text) from public, anon;
revoke all on function public.log_click_out(uuid, text) from public, anon;
revoke all on function public.mark_purchased(uuid) from public, anon;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.create_reel(text, text, text, text, text, numeric, bigint, text, text, bigint, text, text, text[]) to service_role;
grant execute on function public.add_comment(uuid, text) to authenticated;
grant execute on function public.report_content(text, uuid, text) to authenticated;
grant execute on function public.log_click_out(uuid, text) to authenticated;
grant execute on function public.mark_purchased(uuid) to authenticated;
grant execute on function public.delete_my_account() to authenticated;

insert into public.allowed_store_domains (domain) values
  ('amazon.in'), ('amzn.to'), ('flipkart.com'), ('fkrt.it'),
  ('myntra.com'), ('ajio.com'), ('nykaa.com'), ('meesho.com')
on conflict (domain) do update set active = true;

commit;
