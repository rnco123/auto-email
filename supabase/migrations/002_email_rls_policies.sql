-- RLS policies for server use with the Supabase publishable key (anon role)

create policy email_threads_all on email_threads
  for all to anon, authenticated
  using (true) with check (true);

create policy email_messages_all on email_messages
  for all to anon, authenticated
  using (true) with check (true);

create policy email_processing_jobs_all on email_processing_jobs
  for all to anon, authenticated
  using (true) with check (true);
