-- 기존 post_reports를 신고 카테고리/집계 컬럼 구조로 변경합니다.
-- 새 테이블은 만들지 않습니다. Supabase SQL Editor에서 한 번 실행하세요.

-- category를 참조하는 기존 뷰를 먼저 제거해야 컬럼 삭제가 가능합니다.
drop view if exists public.post_report_summary;

alter table public.post_reports add column if not exists category_sexual boolean not null default false;
alter table public.post_reports add column if not exists category_violent boolean not null default false;
alter table public.post_reports add column if not exists category_hate boolean not null default false;
alter table public.post_reports add column if not exists category_harassment boolean not null default false;
alter table public.post_reports add column if not exists category_misinformation boolean not null default false;
alter table public.post_reports add column if not exists category_spam boolean not null default false;

-- 기존 텍스트 카테고리가 있다면 6개 선택 여부로 먼저 옮깁니다.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'post_reports' and column_name = 'category'
  ) then
    update public.post_reports
    set category_sexual = (category = 'sexual'), category_violent = (category = 'violent'),
      category_hate = (category = 'hate'), category_harassment = (category = 'harassment'),
      category_misinformation = (category = 'misinformation'), category_spam = (category = 'spam')
    where category is not null;
  end if;
end;
$$;

alter table public.post_reports drop column if exists category;

alter table public.post_reports add column if not exists total_report_count integer not null default 0;
alter table public.post_reports add column if not exists sexual_report_count integer not null default 0;
alter table public.post_reports add column if not exists violent_report_count integer not null default 0;
alter table public.post_reports add column if not exists hate_report_count integer not null default 0;
alter table public.post_reports add column if not exists harassment_report_count integer not null default 0;
alter table public.post_reports add column if not exists misinformation_report_count integer not null default 0;
alter table public.post_reports add column if not exists spam_report_count integer not null default 0;

create or replace function public.refresh_post_report_counts(target_post_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  with counts as (
    select
      count(*)::integer as total_count,
      count(*) filter (where category_sexual)::integer as sexual_count,
      count(*) filter (where category_violent)::integer as violent_count,
      count(*) filter (where category_hate)::integer as hate_count,
      count(*) filter (where category_harassment)::integer as harassment_count,
      count(*) filter (where category_misinformation)::integer as misinformation_count,
      count(*) filter (where category_spam)::integer as spam_count
    from public.post_reports
    where post_id = target_post_id
  )
  update public.post_reports pr
  set
    total_report_count = counts.total_count,
    sexual_report_count = counts.sexual_count,
    violent_report_count = counts.violent_count,
    hate_report_count = counts.hate_count,
    harassment_report_count = counts.harassment_count,
    misinformation_report_count = counts.misinformation_count,
    spam_report_count = counts.spam_count
  from counts
  where pr.post_id = target_post_id;
end;
$$;

create or replace function public.sync_post_report_counts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_post_report_counts(coalesce(new.post_id, old.post_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists post_reports_counts_after_change on public.post_reports;
create trigger post_reports_counts_after_change
after insert or delete on public.post_reports
for each row execute function public.sync_post_report_counts();

-- 기존 행의 집계값을 채웁니다.
do $$
declare target_post_id uuid;
begin
  for target_post_id in select distinct post_id from public.post_reports loop
    perform public.refresh_post_report_counts(target_post_id);
  end loop;
end;
$$;
