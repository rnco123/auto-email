-- Grants for public clinic info (RLS policies in 004 are not enough on some projects)
grant usage on schema public to anon, authenticated;
grant select on table public.locations to anon, authenticated;
grant select on table public.services to anon, authenticated;
