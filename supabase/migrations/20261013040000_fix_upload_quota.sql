begin;

create or replace function public.check_rate_limit_for_user(
  p_user_id uuid,
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
  next_count integer;
begin
  if p_user_id is null then
    raise exception using message = 'unauthenticated: user is required';
  end if;
  if p_limit <= 0 or p_window <= interval '0' or p_action is null then
    raise exception using message = 'invalid_input: invalid rate limit';
  end if;
  insert into public.rate_limits(user_id, action, window_start, count)
  values (p_user_id, p_action, now(), 1)
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

create or replace function public.check_upload_quota(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  account_created timestamptz;
  upload_limit integer;
  allowed boolean;
begin
  if p_user_id is null then
    return false;
  end if;
  select created_at into account_created from auth.users where id = p_user_id;
  if account_created is null then
    return false;
  end if;
  upload_limit := case when account_created > now() - interval '7 days' then 3 else 10 end;
  select result.allowed into allowed
  from public.check_rate_limit_for_user(p_user_id, 'upload', upload_limit, interval '1 day') result;
  return coalesce(allowed, false);
end;
$$;

revoke all on function public.check_rate_limit_for_user(uuid, text, integer, interval) from public, anon, authenticated;
revoke all on function public.check_upload_quota(uuid) from public, anon, authenticated;
grant execute on function public.check_upload_quota(uuid) to service_role;

commit;
