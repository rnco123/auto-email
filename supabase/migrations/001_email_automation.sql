-- Email automation tables (operational only; does not modify clinical tables)

create extension if not exists "pgcrypto";

create table if not exists email_threads (
  id uuid primary key default gen_random_uuid(),
  patient_email text not null,
  subject text,
  status text not null default 'active'
    check (status in ('active', 'needs_dob', 'verified', 'failed', 'unknown_sender')),
  last_intent text,
  verified_patient_id uuid,
  message_id_root text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_email_threads_patient_email on email_threads (patient_email);
create index if not exists idx_email_threads_updated_at on email_threads (updated_at desc);
create index if not exists idx_email_threads_message_id_root on email_threads (message_id_root);

create table if not exists email_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references email_threads (id) on delete cascade,
  direction text not null check (direction in ('inbound', 'outbound')),
  resend_email_id text unique,
  body_text text,
  raw_metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_email_messages_thread_id on email_messages (thread_id, created_at);

create table if not exists email_processing_jobs (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references email_threads (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed')),
  attempts int not null default 0,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_email_jobs_status on email_processing_jobs (status, created_at);

alter table email_threads enable row level security;
alter table email_messages enable row level security;
alter table email_processing_jobs enable row level security;

-- RLS policies for publishable key: run 002_email_rls_policies.sql
