alter table public.relay_topics
  add column if not exists comments_enabled boolean not null default true;
