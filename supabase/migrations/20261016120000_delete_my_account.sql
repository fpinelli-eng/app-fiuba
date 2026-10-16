-- "Borrar mi cuenta" (perfil). Deletes the caller's auth user: the profile and every row
-- that hangs from it go with it (on delete cascade), including review_authors, so the
-- student's reviews stay published without an author.

create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke execute on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;
