-- Supabase SQL Editor에서 실행하세요. 기존 댓글과 답글은 유지됩니다.
-- 대상 계정은 parent_id와 별도로 저장하므로 일반 댓글로 등록됩니다.
begin;

alter table public.relay_topic_comments
  add column if not exists reply_to_owner_id uuid
  references auth.users(id) on delete set null;

create index if not exists relay_topic_comments_reply_to_owner_idx
  on public.relay_topic_comments(reply_to_owner_id)
  where reply_to_owner_id is not null;

comment on column public.relay_topic_comments.reply_to_owner_id is
  '참여자 목록에서 댓글 달기를 선택한 대상 계정. 답글 관계(parent_id)와 독립적이며 채널 아이디는 channel_profiles에서 조회한다.';

notify pgrst, 'reload schema';
commit;
