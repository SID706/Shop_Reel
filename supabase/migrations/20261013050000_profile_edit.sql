begin;

create or replace function public.update_profile(
  requested_display_name text,
  requested_avatar_url text,
  requested_bio text
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
  if requested_display_name is null
     or char_length(btrim(requested_display_name)) < 1
     or char_length(requested_display_name) > 80 then
    raise exception using message = 'invalid_input: display name must be 1-80 characters';
  end if;
  if requested_avatar_url is not null and requested_avatar_url !~ '^https://' then
    raise exception using message = 'invalid_input: avatar URL must use https';
  end if;
  if requested_bio is null or char_length(requested_bio) > 500 then
    raise exception using message = 'invalid_input: bio must be 0-500 characters';
  end if;

  update public.profiles
  set display_name = btrim(requested_display_name),
      avatar_url = requested_avatar_url,
      bio = requested_bio
  where id = caller and deleted_at is null and banned_at is null
  returning * into result_profile;

  if result_profile.id is null then
    raise exception using message = 'not_found: profile not found';
  end if;
  return result_profile;
end;
$$;

revoke all on function public.update_profile(text, text, text) from public;
grant execute on function public.update_profile(text, text, text) to authenticated;

commit;
