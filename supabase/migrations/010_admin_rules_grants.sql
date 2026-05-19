-- Idempotent grants for admin_rules (if 009 was applied before grants were added)
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table public.admin_rules to anon, authenticated;
