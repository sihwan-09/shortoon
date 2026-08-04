-- 게시물 신고와 같은 구조로 채널 신고를 저장합니다.
create table if not exists public.channel_reports (
  id uuid primary key default gen_random_uuid(),
  channel_id text not null,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  category_sexual boolean not null default false,
  category_violent boolean not null default false,
  category_hate boolean not null default false,
  category_harassment boolean not null default false,
  category_misinformation boolean not null default false,
  category_spam boolean not null default false,
  category_impersonation boolean not null default false,
  category_privacy boolean not null default false,
  total_report_count integer not null default 0,
  sexual_report_count integer not null default 0,
  violent_report_count integer not null default 0,
  hate_report_count integer not null default 0,
  harassment_report_count integer not null default 0,
  misinformation_report_count integer not null default 0,
  spam_report_count integer not null default 0,
  impersonation_report_count integer not null default 0,
  privacy_report_count integer not null default 0,
  created_at timestamptz not null default now(),
  unique (channel_id, reporter_id)
);

create index if not exists channel_reports_channel_id_idx on public.channel_reports (channel_id, created_at desc);
create index if not exists channel_reports_reporter_id_idx on public.channel_reports (reporter_id, created_at desc);
alter table public.channel_reports enable row level security;
drop policy if exists "users can report channels" on public.channel_reports;
create policy "users can report channels" on public.channel_reports for insert with check (reporter_id = auth.uid());
drop policy if exists "users can read their channel reports" on public.channel_reports;
create policy "users can read their channel reports" on public.channel_reports for select using (reporter_id = auth.uid());

create or replace function public.refresh_channel_report_counts(target_channel_id text)
returns void language plpgsql security definer set search_path = public as $$
begin
  with counts as (
    select count(*)::integer total_count,
      count(*) filter (where category_sexual)::integer sexual_count,
      count(*) filter (where category_violent)::integer violent_count,
      count(*) filter (where category_hate)::integer hate_count,
      count(*) filter (where category_harassment)::integer harassment_count,
      count(*) filter (where category_misinformation)::integer misinformation_count,
      count(*) filter (where category_spam)::integer spam_count,
      count(*) filter (where category_impersonation)::integer impersonation_count,
      count(*) filter (where category_privacy)::integer privacy_count
    from public.channel_reports where channel_id = target_channel_id
  )
  update public.channel_reports cr set total_report_count = counts.total_count,
    sexual_report_count = counts.sexual_count, violent_report_count = counts.violent_count,
    hate_report_count = counts.hate_count, harassment_report_count = counts.harassment_count,
    misinformation_report_count = counts.misinformation_count, spam_report_count = counts.spam_count,
    impersonation_report_count = counts.impersonation_count, privacy_report_count = counts.privacy_count
  from counts where cr.channel_id = target_channel_id;
end; $$;

create or replace function public.sync_channel_report_counts()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.refresh_channel_report_counts(coalesce(new.channel_id, old.channel_id));
  return coalesce(new, old);
end; $$;

drop trigger if exists channel_reports_counts_after_change on public.channel_reports;
create trigger channel_reports_counts_after_change after insert or delete on public.channel_reports
for each row execute function public.sync_channel_report_counts();
