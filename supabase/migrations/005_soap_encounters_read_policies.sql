-- Read access for verified SOAP note delivery (app filters by patient_id)

alter table encounters enable row level security;
alter table ai_soapnotes enable row level security;

create policy encounters_read_automation on encounters
  for select to anon, authenticated
  using (true);

create policy ai_soapnotes_read_automation on ai_soapnotes
  for select to anon, authenticated
  using (true);
