-- Fix for 009 when it failed at "drop index thread_ratings_thread_id_key"
-- Safe to re-run: uses IF EXISTS / IF NOT EXISTS

alter table thread_ratings alter column thread_id drop not null;

alter table thread_ratings
  add column if not exists session_key text,
  add column if not exists resolution_confirmed boolean,
  add column if not exists comment text,
  add column if not exists updated_at timestamptz not null default now();

alter table thread_ratings drop constraint if exists thread_ratings_thread_id_key;
drop index if exists idx_thread_ratings_thread_id;

create unique index if not exists idx_thread_ratings_thread_id
  on thread_ratings (thread_id)
  where thread_id is not null;

create unique index if not exists idx_thread_ratings_session_key
  on thread_ratings (session_key)
  where session_key is not null;
