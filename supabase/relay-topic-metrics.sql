create table if not exists public.relay_topic_likes (
  id uuid primary key default gen_random_uuid(),
  relay_topic_id uuid not null references public.relay_topics(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (relay_topic_id, user_id)
);

create table if not exists public.relay_topic_views (
  id uuid primary key default gen_random_uuid(),
  relay_topic_id uuid not null references public.relay_topics(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  viewed_at timestamptz not null default now()
);

create index if not exists relay_topic_likes_topic_idx on public.relay_topic_likes(relay_topic_id);
create index if not exists relay_topic_views_topic_time_idx on public.relay_topic_views(relay_topic_id, viewed_at desc);
create index if not exists relay_topic_views_user_topic_time_idx on public.relay_topic_views(user_id, relay_topic_id, viewed_at desc);

alter table public.relay_topic_likes enable row level security;
alter table public.relay_topic_views enable row level security;

drop policy if exists "relay topic likes are readable" on public.relay_topic_likes;
create policy "relay topic likes are readable" on public.relay_topic_likes for select using (true);
drop policy if exists "users manage own relay topic likes" on public.relay_topic_likes;
create policy "users manage own relay topic likes" on public.relay_topic_likes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "relay topic views are readable" on public.relay_topic_views;
create policy "relay topic views are readable" on public.relay_topic_views for select using (true);
drop policy if exists "users create own relay topic views" on public.relay_topic_views;

create or replace function public.record_relay_topic_view(p_relay_topic_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_recent_count integer;
  v_total_count integer;
  v_counted boolean := false;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  -- Serialize simultaneous tabs/requests for this user and topic before checking the weekly limit.
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text || ':' || p_relay_topic_id::text, 0));

  select count(*) into v_recent_count
  from public.relay_topic_views
  where user_id = v_user_id
    and relay_topic_id = p_relay_topic_id
    and viewed_at >= now() - interval '7 days';

  if v_recent_count < 5 then
    insert into public.relay_topic_views (relay_topic_id, user_id)
    values (p_relay_topic_id, v_user_id);
    v_counted := true;
  end if;

  select count(*) into v_total_count
  from public.relay_topic_views
  where relay_topic_id = p_relay_topic_id;

  return jsonb_build_object('counted', v_counted, 'count', v_total_count);
end;
$$;

revoke all on function public.record_relay_topic_view(uuid) from public;
grant execute on function public.record_relay_topic_view(uuid) to authenticated;
