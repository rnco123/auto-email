-- Patient read access for email automation (publishable / anon key)
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/kxtbfmlatysaxjzppmti/sql

-- 1) RLS policy (who can read which rows)
alter table public.patients enable row level security;

drop policy if exists patients_read_for_automation on public.patients;

create policy patients_read_for_automation on public.patients
  for select
  to anon, authenticated
  using (true);

-- 2) Table GRANTs (required — policy alone often returns "permission denied")
grant usage on schema public to anon, authenticated;
grant select on table public.patients to anon, authenticated;

-- Optional: verify (should return policy row + grantees)
-- select policyname, roles, cmd from pg_policies where tablename = 'patients';
-- select grantee, privilege_type from information_schema.role_table_grants where table_name = 'patients';
