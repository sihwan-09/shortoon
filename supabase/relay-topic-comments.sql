-- 릴레이툰 댓글·답글 저장소
create table if not exists public.relay_topic_comments (
  id uuid primary key default gen_random_uuid(),
  relay_topic_id uuid not null references public.relay_topics(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid null references public.relay_topic_comments(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  is_spoiler boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists relay_topic_comments_topic_created_idx
  on public.relay_topic_comments(relay_topic_id, created_at asc);
create index if not exists relay_topic_comments_parent_idx
  on public.relay_topic_comments(parent_id, created_at asc);
create index if not exists relay_topic_comments_author_idx
  on public.relay_topic_comments(author_id);

alter table public.relay_topic_comments enable row level security;

drop policy if exists "relay topic comments are readable" on public.relay_topic_comments;
create policy "relay topic comments are readable"
  on public.relay_topic_comments for select
  using (true);

drop policy if exists "users create own relay topic comments" on public.relay_topic_comments;
create policy "users create own relay topic comments"
  on public.relay_topic_comments for insert
  with check (auth.uid() = author_id);

drop policy if exists "users update own relay topic comments" on public.relay_topic_comments;
create policy "users update own relay topic comments"
  on public.relay_topic_comments for update
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

drop policy if exists "users delete own relay topic comments" on public.relay_topic_comments;
create policy "users delete own relay topic comments"
  on public.relay_topic_comments for delete
  using (auth.uid() = author_id);

-- updated_at 자동 갱신
create or replace function public.set_relay_topic_comment_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists relay_topic_comments_set_updated_at on public.relay_topic_comments;
create trigger relay_topic_comments_set_updated_at
before update on public.relay_topic_comments
for each row execute function public.set_relay_topic_comment_updated_at();

-- 댓글 수를 릴레이툰별로 집계할 때 사용하는 뷰
create or replace view public.relay_topic_comment_summary as
select relay_topic_id,
       count(*)::integer as comment_count,
       count(*) filter (where parent_id is null)::integer as root_comment_count,
       count(*) filter (where parent_id is not null)::integer as reply_count
from public.relay_topic_comments
group by relay_topic_id;

create table if not exists public.relay_topic_comment_likes (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.relay_topic_comments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (comment_id, user_id)
);

create index if not exists relay_topic_comment_likes_comment_idx on public.relay_topic_comment_likes(comment_id);
alter table public.relay_topic_comment_likes enable row level security;
drop policy if exists "relay topic comment likes are readable" on public.relay_topic_comment_likes;
create policy "relay topic comment likes are readable" on public.relay_topic_comment_likes for select using (true);
drop policy if exists "users manage own relay topic comment likes" on public.relay_topic_comment_likes;
create policy "users manage own relay topic comment likes" on public.relay_topic_comment_likes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
