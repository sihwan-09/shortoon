-- 릴레이툰 참여자가 올린 이미지를 원본 주제에 순서대로 연결합니다.
create table if not exists public.relay_topic_entries (
  id uuid primary key default gen_random_uuid(),
  relay_topic_id uuid not null references public.relay_topics(id) on delete cascade,
  participant_id uuid not null references auth.users(id) on delete cascade,
  image_url text not null,
  position integer not null check (position > 0),
  created_at timestamptz not null default now()
);

create index if not exists relay_topic_entries_topic_position_idx
  on public.relay_topic_entries (relay_topic_id, position, created_at);

alter table public.relay_topic_entries enable row level security;

drop policy if exists "relay topic entries are publicly readable" on public.relay_topic_entries;
create policy "relay topic entries are publicly readable"
  on public.relay_topic_entries for select
  using (true);

drop policy if exists "authenticated users can add relay topic entries" on public.relay_topic_entries;
create policy "authenticated users can add relay topic entries"
  on public.relay_topic_entries for insert
  to authenticated
  with check (auth.uid() = participant_id);
