-- Allow publishable key to read patients for email verification (adjust table name if needed)

alter table patients enable row level security;

create policy patients_read_for_automation on patients
  for select to anon, authenticated
  using (true);
