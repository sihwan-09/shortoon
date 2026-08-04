-- 신고 카테고리 저장 및 게시물별 신고 집계
-- Supabase SQL Editor에서 한 번 실행하세요.

alter table public.post_reports add column if not exists category text;

do $$
begin
  alter table public.post_reports
    add constraint post_reports_category_check
    check (category is null or category in ('sexual', 'violent', 'hate', 'harassment', 'misinformation', 'spam'));
exception when duplicate_object then null;
end $$;

create index if not exists post_reports_category_idx
  on public.post_reports (post_id, category);

drop view if exists public.post_report_summary;

create view public.post_report_summary as
select
  pr.post_id,
  p.title as post_title,
  coalesce(cp.channel_id, '(채널 아이디 없음)') as reported_channel_id,
  count(*)::integer as report_count,
  count(*) filter (where pr.category = 'sexual')::integer as sexual_count,
  count(*) filter (where pr.category = 'violent')::integer as violent_count,
  count(*) filter (where pr.category = 'hate')::integer as hate_count,
  count(*) filter (where pr.category = 'harassment')::integer as harassment_count,
  count(*) filter (where pr.category = 'misinformation')::integer as misinformation_count,
  count(*) filter (where pr.category = 'spam')::integer as spam_count,
  min(pr.created_at) as first_reported_at,
  max(pr.created_at) as last_reported_at
from public.post_reports pr
join public.posts p on p.id = pr.post_id
left join public.channel_profiles cp on cp.owner_id = p.author_id
group by pr.post_id, p.title, cp.channel_id;
