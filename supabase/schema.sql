-- 숏툰 채널 프로필 저장 구조
create table if not exists public.channel_profiles (
  id text primary key,
  owner_id uuid references auth.users(id) on delete set null,
  name text not null,
  channel_id text not null,
  intro text not null default '',
  profile_image_url text,
  links jsonb not null default '[]'::jsonb,
  link_title text,
  link_url text,
  updated_at timestamptz not null default now()
);

alter table public.channel_profiles add column if not exists link_title text;
alter table public.channel_profiles add column if not exists link_url text;
alter table public.channel_profiles add column if not exists links jsonb not null default '[]'::jsonb;
create unique index if not exists channel_profiles_owner_id_idx on public.channel_profiles(owner_id) where owner_id is not null;

alter table public.channel_profiles enable row level security;
drop policy if exists "channel profiles are readable" on public.channel_profiles;
create policy "channel profiles are readable" on public.channel_profiles for select using (true);
drop policy if exists "channel profiles can be created" on public.channel_profiles;
create policy "channel profiles can be created" on public.channel_profiles for insert with check (owner_id = auth.uid());
drop policy if exists "channel profiles can be updated" on public.channel_profiles;
create policy "channel profiles can be updated" on public.channel_profiles for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- 숏툰 게시물 저장 구조
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references auth.users(id) on delete set null,
  author_name text not null default '시화 작가',
  title text not null,
  genre text not null,
  description text not null default '',
  link_title text,
  link_url text,
  cover_image_url text not null,
  like_count integer not null default 0 check (like_count >= 0),
  comment_count integer not null default 0 check (comment_count >= 0),
  status text not null default 'published' check (status in ('draft', 'published', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.posts add column if not exists link_title text;
alter table public.posts add column if not exists link_url text;

create table if not exists public.post_images (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  image_url text not null,
  sort_order integer not null check (sort_order >= 0),
  width integer,
  height integer,
  created_at timestamptz not null default now(),
  unique (post_id, sort_order)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  parent_id uuid references public.comments(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  author_name text not null,
  body text not null,
  is_spoiler boolean not null default false,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.post_reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, reporter_id)
);

alter table public.comments add column if not exists author_id uuid references auth.users(id) on delete set null;
alter table public.comments add column if not exists parent_id uuid references public.comments(id) on delete cascade;

create index if not exists posts_created_at_idx on public.posts (created_at desc);
create index if not exists post_images_post_id_idx on public.post_images (post_id, sort_order);
create index if not exists comments_post_id_idx on public.comments (post_id, created_at desc);
create index if not exists comments_author_id_idx on public.comments (author_id);
create index if not exists comments_parent_id_idx on public.comments (parent_id, created_at desc);
create index if not exists post_reports_post_id_idx on public.post_reports (post_id, created_at desc);
create index if not exists post_reports_reporter_id_idx on public.post_reports (reporter_id, created_at desc);

drop view if exists public.post_report_summary;

create view public.post_report_summary as
select
  pr.post_id,
  p.title as post_title,
  coalesce(cp.channel_id, '(채널 아이디 없음)') as reported_channel_id,
  count(*)::integer as report_count,
  min(pr.created_at) as first_reported_at,
  max(pr.created_at) as last_reported_at
from public.post_reports pr
join public.posts p on p.id = pr.post_id
left join public.channel_profiles cp on cp.owner_id = p.author_id
group by pr.post_id, p.title, cp.channel_id;

create table if not exists public.comment_likes (
  comment_id uuid not null references public.comments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create index if not exists comment_likes_comment_id_idx on public.comment_likes (comment_id);
alter table public.comment_likes enable row level security;
drop policy if exists "comment likes are readable" on public.comment_likes;
create policy "comment likes are readable" on public.comment_likes for select using (true);
drop policy if exists "users can like comments" on public.comment_likes;
create policy "users can like comments" on public.comment_likes for insert with check (user_id = auth.uid());
drop policy if exists "users can remove comment likes" on public.comment_likes;
create policy "users can remove comment likes" on public.comment_likes for delete using (user_id = auth.uid());

alter table public.posts enable row level security;
alter table public.post_images enable row level security;
alter table public.comments enable row level security;
alter table public.post_reports enable row level security;

drop policy if exists "users can report posts" on public.post_reports;
create policy "users can report posts" on public.post_reports for insert with check (reporter_id = auth.uid());
drop policy if exists "users can read their reports" on public.post_reports;
create policy "users can read their reports" on public.post_reports for select using (reporter_id = auth.uid());
drop policy if exists "post owners can read reports" on public.post_reports;
create policy "post owners can read reports" on public.post_reports for select using (exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid()));

drop policy if exists "published posts are readable" on public.posts;
create policy "published posts are readable" on public.posts for select using (status = 'published' or author_id = auth.uid() or author_id is null);
drop policy if exists "users can create posts" on public.posts;
create policy "users can create posts" on public.posts for insert with check (author_id = auth.uid() or author_id is null);
drop policy if exists "owners can update posts" on public.posts;
create policy "owners can update posts" on public.posts for update using (author_id = auth.uid() or author_id is null) with check (author_id = auth.uid() or author_id is null);
drop policy if exists "owners can delete posts" on public.posts;
create policy "owners can delete posts" on public.posts for delete using (author_id = auth.uid());

drop policy if exists "post images are readable" on public.post_images;
create policy "post images are readable" on public.post_images for select using (exists (select 1 from public.posts p where p.id = post_id and (p.status = 'published' or p.author_id = auth.uid() or p.author_id is null)));
drop policy if exists "post images can be created" on public.post_images;
create policy "post images can be created" on public.post_images for insert with check (exists (select 1 from public.posts p where p.id = post_id and (p.author_id = auth.uid() or p.author_id is null)));
drop policy if exists "owners can delete post images" on public.post_images;
create policy "owners can delete post images" on public.post_images for delete using (exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid()));

drop policy if exists "comments are readable" on public.comments;
create policy "comments are readable" on public.comments for select using (deleted_at is null);
drop policy if exists "comments can be created" on public.comments;
create policy "comments can be created" on public.comments for insert with check (author_id = auth.uid() or author_id is null);

insert into storage.buckets (id, name, public) values ('shorttoon-posts', 'shorttoon-posts', true) on conflict (id) do update set public = true;

drop policy if exists "shorttoon files are public" on storage.objects;
create policy "shorttoon files are public" on storage.objects for select using (bucket_id = 'shorttoon-posts');
drop policy if exists "shorttoon files can be uploaded" on storage.objects;
create policy "shorttoon files can be uploaded" on storage.objects for insert with check (bucket_id = 'shorttoon-posts');
drop policy if exists "owners can delete shorttoon files" on storage.objects;
create policy "owners can delete shorttoon files" on storage.objects for delete using (bucket_id = 'shorttoon-posts' and exists (select 1 from public.posts p where p.id::text = (storage.foldername(name))[1] and p.author_id = auth.uid()));
