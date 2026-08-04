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
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.channel_profiles add column if not exists link_title text;
alter table public.channel_profiles add column if not exists link_url text;
alter table public.channel_profiles add column if not exists links jsonb not null default '[]'::jsonb;
alter table public.channel_profiles add column if not exists joined_at timestamptz;
create unique index if not exists channel_profiles_owner_id_idx on public.channel_profiles(owner_id) where owner_id is not null;

create table if not exists public.channel_follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);
create index if not exists channel_follows_following_id_idx on public.channel_follows(following_id, created_at desc);
alter table public.channel_follows enable row level security;
drop policy if exists "users can read their follows" on public.channel_follows;
create policy "users can read their follows" on public.channel_follows for select using (follower_id = auth.uid());
drop policy if exists "users can create follows" on public.channel_follows;
create policy "users can create follows" on public.channel_follows for insert with check (follower_id = auth.uid());
drop policy if exists "users can remove follows" on public.channel_follows;
create policy "users can remove follows" on public.channel_follows for delete using (follower_id = auth.uid());

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

drop view if exists public.post_report_summary;

create table if not exists public.post_reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  category_sexual boolean not null default false,
  category_violent boolean not null default false,
  category_hate boolean not null default false,
  category_harassment boolean not null default false,
  category_misinformation boolean not null default false,
  category_spam boolean not null default false,
  total_report_count integer not null default 0,
  sexual_report_count integer not null default 0,
  violent_report_count integer not null default 0,
  hate_report_count integer not null default 0,
  harassment_report_count integer not null default 0,
  misinformation_report_count integer not null default 0,
  spam_report_count integer not null default 0,
  created_at timestamptz not null default now(),
  unique (post_id, reporter_id)
);

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

alter table public.post_reports add column if not exists category_sexual boolean not null default false;
alter table public.post_reports add column if not exists category_violent boolean not null default false;
alter table public.post_reports add column if not exists category_hate boolean not null default false;
alter table public.post_reports add column if not exists category_harassment boolean not null default false;
alter table public.post_reports add column if not exists category_misinformation boolean not null default false;
alter table public.post_reports add column if not exists category_spam boolean not null default false;
alter table public.post_reports add column if not exists total_report_count integer not null default 0;
alter table public.post_reports add column if not exists sexual_report_count integer not null default 0;
alter table public.post_reports add column if not exists violent_report_count integer not null default 0;
alter table public.post_reports add column if not exists hate_report_count integer not null default 0;
alter table public.post_reports add column if not exists harassment_report_count integer not null default 0;
alter table public.post_reports add column if not exists misinformation_report_count integer not null default 0;
alter table public.post_reports add column if not exists spam_report_count integer not null default 0;
alter table public.post_reports drop column if exists category;

alter table public.comments add column if not exists author_id uuid references auth.users(id) on delete set null;
alter table public.comments add column if not exists parent_id uuid references public.comments(id) on delete cascade;

create index if not exists posts_created_at_idx on public.posts (created_at desc);
create index if not exists post_images_post_id_idx on public.post_images (post_id, sort_order);
create index if not exists comments_post_id_idx on public.comments (post_id, created_at desc);
create index if not exists comments_author_id_idx on public.comments (author_id);
create index if not exists comments_parent_id_idx on public.comments (parent_id, created_at desc);
create index if not exists post_reports_post_id_idx on public.post_reports (post_id, created_at desc);
create index if not exists post_reports_reporter_id_idx on public.post_reports (reporter_id, created_at desc);
create or replace function public.refresh_post_report_counts(target_post_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  with counts as (
    select count(*)::integer as total_count,
      count(*) filter (where category_sexual)::integer as sexual_count,
      count(*) filter (where category_violent)::integer as violent_count,
      count(*) filter (where category_hate)::integer as hate_count,
      count(*) filter (where category_harassment)::integer as harassment_count,
      count(*) filter (where category_misinformation)::integer as misinformation_count,
      count(*) filter (where category_spam)::integer as spam_count
    from public.post_reports where post_id = target_post_id
  )
  update public.post_reports pr set total_report_count = counts.total_count,
    sexual_report_count = counts.sexual_count, violent_report_count = counts.violent_count,
    hate_report_count = counts.hate_count, harassment_report_count = counts.harassment_count,
    misinformation_report_count = counts.misinformation_count, spam_report_count = counts.spam_count
  from counts where pr.post_id = target_post_id;
end; $$;

create or replace function public.sync_post_report_counts()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.refresh_post_report_counts(coalesce(new.post_id, old.post_id));
  return coalesce(new, old);
end; $$;

drop trigger if exists post_reports_counts_after_change on public.post_reports;
create trigger post_reports_counts_after_change after insert or delete on public.post_reports
for each row execute function public.sync_post_report_counts();

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
