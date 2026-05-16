-- Read-only access for public clinic info (locations + services)

alter table locations enable row level security;
alter table services enable row level security;

create policy locations_read_public on locations
  for select to anon, authenticated
  using (true);

create policy services_read_public on services
  for select to anon, authenticated
  using (true);
