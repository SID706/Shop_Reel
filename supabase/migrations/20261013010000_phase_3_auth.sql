begin;

create or replace function public.is_handle_available(requested_handle text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then
    raise exception using message = 'unauthenticated: login required';
  end if;
  if requested_handle !~ '^[a-z0-9_]{3,20}$' then
    return false;
  end if;
  return not exists (
    select 1 from public.profiles
    where handle = lower(requested_handle) and deleted_at is null
  );
end;
$$;

revoke all on function public.is_handle_available(text) from public;
grant execute on function public.is_handle_available(text) to authenticated;

create or replace function public.complete_onboarding(
  requested_handle text,
  confirm_age boolean,
  terms_version text,
  privacy_version text
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  result_profile public.profiles;
begin
  if caller is null then
    raise exception using message = 'unauthenticated: login required';
  end if;
  if not confirm_age then
    raise exception using message = 'invalid_input: age confirmation is required';
  end if;
  if requested_handle !~ '^[a-z0-9_]{3,20}$' then
    raise exception using message = 'invalid_input: handle must be 3-20 lowercase characters';
  end if;
  if terms_version is null or privacy_version is null
     or terms_version !~ '^[A-Za-z0-9._-]{1,40}$'
     or privacy_version !~ '^[A-Za-z0-9._-]{1,40}$' then
    raise exception using message = 'invalid_input: legal consent is required';
  end if;
  if exists (select 1 from public.profiles where id = caller) then
    raise exception using message = 'conflict: onboarding is already complete';
  end if;
  if not public.is_handle_available(requested_handle) then
    raise exception using message = 'conflict: handle is already taken';
  end if;

  insert into public.profiles (id, handle, display_name, age_confirmed_at)
  values (
    caller,
    lower(requested_handle),
    coalesce((select raw_user_meta_data->>'full_name' from auth.users where id = caller), ''),
    now()
  )
  returning * into result_profile;

  insert into public.consents (user_id, type, version)
  values (caller, 'terms', terms_version), (caller, 'privacy', privacy_version);
  return result_profile;
exception
  when unique_violation then
    raise exception using message = 'conflict: handle is already taken';
end;
$$;

revoke all on function public.complete_onboarding(text, boolean, text, text) from public;
grant execute on function public.complete_onboarding(text, boolean, text, text) to authenticated;

commit;
