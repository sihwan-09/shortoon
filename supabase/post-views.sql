create table if not exists public.post_views (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  viewed_at timestamptz not null default now()
);

create index if not exists post_views_post_id_viewed_at_idx
  on public.post_views (post_id, viewed_at desc);
create index if not exists post_views_user_post_viewed_at_idx
  on public.post_views (user_id, post_id, viewed_at desc);

alter table public.post_views enable row level security;

drop policy if exists "post views are readable" on public.post_views;
create policy "post views are readable"
  on public.post_views for select
  to anon, authenticated
  using (true);

drop policy if exists "users can create own post views" on public.post_views;
create policy "users can create own post views"
  on public.post_views for insert
  to authenticated
  with check (user_id = auth.uid());
