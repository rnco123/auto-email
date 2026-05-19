-- Resolution/rating feedback on threads + admin-configurable rules

alter table email_threads
  add column if not exists feedback_stage text not null default 'none'
    check (feedback_stage in ('none', 'awaiting_resolution', 'awaiting_rating', 'complete'));

alter table email_threads
  add column if not exists resolved_at timestamptz,
  add column if not exists resolution_confirmed boolean;

alter table thread_ratings
  add column if not exists session_key text,
  add column if not exists resolution_confirmed boolean,
  add column if not exists comment text,
  add column if not exists updated_at timestamptz not null default now();

alter table thread_ratings alter column thread_id drop not null;

-- 008 created unique(thread_id) as a constraint, not a standalone index
alter table thread_ratings drop constraint if exists thread_ratings_thread_id_key;
drop index if exists idx_thread_ratings_thread_id;

create unique index if not exists idx_thread_ratings_thread_id
  on thread_ratings (thread_id)
  where thread_id is not null;

create unique index if not exists idx_thread_ratings_session_key
  on thread_ratings (session_key)
  where session_key is not null;

create table if not exists admin_rules (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  category text,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_admin_rules_active_sort
  on admin_rules (active, sort_order, created_at);

alter table admin_rules enable row level security;

create policy admin_rules_all on admin_rules
  for all to anon, authenticated
  using (true) with check (true);

-- Table GRANTs (RLS policy alone often returns permission denied with anon key)
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table public.admin_rules to anon, authenticated;

-- Default rules summarizing built-in behavior (admins can edit or add more)
insert into admin_rules (title, body, category, active, sort_order)
select v.title, v.body, v.category, true, v.sort_order
from (
  values
    (
      10,
      'Patient verification (production)',
      'When DISABLE_PATIENT_VERIFICATION=false, appointment and SOAP requests require verified identity (name + DOB matching chart). Alternate email flows may apply.',
      'verification'
    ),
    (
      20,
      'Open-access / demo mode',
      'When DISABLE_PATIENT_VERIFICATION is not false, patients may receive SOAP PDFs after providing name and DOB without full verification envelope.',
      'verification'
    ),
    (
      30,
      'SOAP note access',
      'SOAP PDFs are sent only for the patient''s own chart after lookup. Never attach SOAP for policy/privacy questions about another person''s records.',
      'clinical'
    ),
    (
      40,
      'Public clinic information',
      'Locations and services may be listed without patient verification. Use database facts only; do not invent addresses or offerings.',
      'public'
    ),
    (
      50,
      'Bilingual replies',
      'Detect patient language (en/es) and reply entirely in that language. End English with "Thank you," and Spanish with "Gracias,".',
      'i18n'
    ),
    (
      60,
      'Policy and privacy questions',
      'If the patient asks about accessing someone else''s records, explain records are released only to the verified patient (name + DOB). Do not send clinical PDFs.',
      'policy'
    ),
    (
      70,
      'AI orchestration',
      'Each turn: analyze intent and system actions first, fetch facts, then compose a conversational reply following replyStrategy. Do not repeat prior answers unnecessarily.',
      'orchestration'
    )
) as v(sort_order, title, body, category)
where not exists (select 1 from admin_rules limit 1);
