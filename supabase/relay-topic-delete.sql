-- 릴레이툰 작성자만 자신의 주제를 삭제할 수 있도록 설정합니다.
alter table public.relay_topics enable row level security;

drop policy if exists "owners can delete relay topics" on public.relay_topics;
create policy "owners can delete relay topics"
  on public.relay_topics for delete
  using (auth.uid() = owner_id);
