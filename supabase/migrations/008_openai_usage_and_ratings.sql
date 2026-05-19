-- OpenAI usage tracking and optional thread ratings for dashboard metrics

create table if not exists openai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  model text not null,
  operation text not null
    check (operation in ('analyze', 'reply', 'classify', 'other')),
  prompt_tokens int not null default 0,
  completion_tokens int not null default 0,
  total_tokens int not null default 0,
  estimated_cost_usd numeric(12, 6) not null default 0,
  thread_id uuid references email_threads (id) on delete set null
);

create index if not exists idx_openai_usage_created_at on openai_usage_logs (created_at desc);
create index if not exists idx_openai_usage_operation on openai_usage_logs (operation, created_at desc);
create index if not exists idx_openai_usage_thread_id on openai_usage_logs (thread_id);

create table if not exists thread_ratings (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references email_threads (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  unique (thread_id)
);

create index if not exists idx_thread_ratings_thread_id on thread_ratings (thread_id);

alter table openai_usage_logs enable row level security;
alter table thread_ratings enable row level security;

create policy openai_usage_logs_all on openai_usage_logs
  for all to anon, authenticated
  using (true) with check (true);

create policy thread_ratings_all on thread_ratings
  for all to anon, authenticated
  using (true) with check (true);
