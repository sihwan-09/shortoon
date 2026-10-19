create table if not exists public.relay_topic_reports (
  id uuid primary key default gen_random_uuid(),
  relay_topic_id uuid not null references public.relay_topics(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('sexual','violent','hate','harassment','misinformation','spam')),
  created_at timestamptz not null default now(),
  unique (relay_topic_id, reporter_id)
);

create index if not exists relay_topic_reports_topic_idx on public.relay_topic_reports(relay_topic_id, created_at desc);
alter table public.relay_topic_reports enable row level security;
drop policy if exists "users create own relay topic reports" on public.relay_topic_reports;
create policy "users create own relay topic reports" on public.relay_topic_reports for insert with check (auth.uid() = reporter_id);
drop policy if exists "relay topic reports are readable" on public.relay_topic_reports;
create policy "relay topic reports are readable" on public.relay_topic_reports for select using (true);

create or replace view public.relay_topic_report_summary as
select relay_topic_id,
       count(*)::integer as report_count,
       count(*) filter (where category = 'sexual')::integer as sexual_count,
       count(*) filter (where category = 'violent')::integer as violent_count,
       count(*) filter (where category = 'hate')::integer as hate_count,
       count(*) filter (where category = 'harassment')::integer as harassment_count,
       count(*) filter (where category = 'misinformation')::integer as misinformation_count,
       count(*) filter (where category = 'spam')::integer as spam_count,
       min(created_at) as first_reported_at,
       max(created_at) as last_reported_at
from public.relay_topic_reports
group by relay_topic_id;
