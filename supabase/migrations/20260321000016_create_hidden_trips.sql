create table if not exists public.hidden_trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete cascade,
  created_at timestamp with time zone not null default now(),
  unique(user_id, trip_id)
);

alter table public.hidden_trips enable row level security;

create policy "Users can view own hidden trips"
  on public.hidden_trips
  for select
  using (auth.uid() = user_id);

create policy "Users can hide own trips"
  on public.hidden_trips
  for insert
  with check (auth.uid() = user_id);

create policy "Users can unhide own trips"
  on public.hidden_trips
  for delete
  using (auth.uid() = user_id);

create index if not exists idx_hidden_trips_user_id on public.hidden_trips(user_id);
create index if not exists idx_hidden_trips_trip_id on public.hidden_trips(trip_id);
