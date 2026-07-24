-- 숏툰 채널 프로필 저장 구조
create table if not exists public.channel_profiles (
  id text primary key,
  owner_id uuid references auth.users(id) on delete set null,
  name text not null,
  channel_id text not null,
  intro text not null default '',
  profile_image_url text,
  link_title text,
  link_url text,
  updated_at timestamptz not null default now()
);

alter table public.channel_profiles add column if not exists link_title text;
alter table public.channel_profiles add column if not exists link_url text;

alter table public.channel_profiles enable row level security;
drop policy if exists "channel profiles are readable" on public.channel_profiles;
create policy "channel profiles are readable" on public.channel_profiles for select using (true);
drop policy if exists "channel profiles can be created" on public.channel_profiles;
create policy "channel profiles can be created" on public.channel_profiles for insert with check (owner_id = auth.uid() or owner_id is null);
drop policy if exists "channel profiles can be updated" on public.channel_profiles;
create policy "channel profiles can be updated" on public.channel_profiles for update using (owner_id = auth.uid() or owner_id is null) with check (owner_id = auth.uid() or owner_id is null);

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
  author_id uuid references auth.users(id) on delete set null,
  author_name text not null,
  body text not null,
  is_spoiler boolean not null default false,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists posts_created_at_idx on public.posts (created_at desc);
create index if not exists post_images_post_id_idx on public.post_images (post_id, sort_order);
create index if not exists comments_post_id_idx on public.comments (post_id, created_at desc);

alter table public.posts enable row level security;
alter table public.post_images enable row level security;
alter table public.comments enable row level security;

drop policy if exists "published posts are readable" on public.posts;
create policy "published posts are readable" on public.posts for select using (status = 'published' or author_id = auth.uid() or author_id is null);
drop policy if exists "users can create posts" on public.posts;
create policy "users can create posts" on public.posts for insert with check (author_id = auth.uid() or author_id is null);
drop policy if exists "owners can update posts" on public.posts;
create policy "owners can update posts" on public.posts for update using (author_id = auth.uid() or author_id is null) with check (author_id = auth.uid() or author_id is null);

drop policy if exists "post images are readable" on public.post_images;
create policy "post images are readable" on public.post_images for select using (exists (select 1 from public.posts p where p.id = post_id and (p.status = 'published' or p.author_id = auth.uid() or p.author_id is null)));
drop policy if exists "post images can be created" on public.post_images;
create policy "post images can be created" on public.post_images for insert with check (exists (select 1 from public.posts p where p.id = post_id and (p.author_id = auth.uid() or p.author_id is null)));

drop policy if exists "comments are readable" on public.comments;
create policy "comments are readable" on public.comments for select using (deleted_at is null);
drop policy if exists "comments can be created" on public.comments;
create policy "comments can be created" on public.comments for insert with check (author_id = auth.uid() or author_id is null);

insert into storage.buckets (id, name, public) values ('shorttoon-posts', 'shorttoon-posts', true) on conflict (id) do update set public = true;

drop policy if exists "shorttoon files are public" on storage.objects;
create policy "shorttoon files are public" on storage.objects for select using (bucket_id = 'shorttoon-posts');
drop policy if exists "shorttoon files can be uploaded" on storage.objects;
create policy "shorttoon files can be uploaded" on storage.objects for insert with check (bucket_id = 'shorttoon-posts');
