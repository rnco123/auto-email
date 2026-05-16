-- Required for patient lookup by email / name + DOB (run if 003 was skipped or failed)

alter table patients enable row level security;

drop policy if exists patients_read_for_automation on patients;

create policy patients_read_for_automation on patients
  for select to anon, authenticated
  using (true);
