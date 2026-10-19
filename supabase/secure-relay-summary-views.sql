-- 집계 뷰가 뷰 소유자 권한(Security Definer)으로 우회하지 않고
-- 호출자 권한과 원본 테이블 RLS를 따르도록 설정합니다.
alter view if exists public.relay_topic_comment_summary
  set (security_invoker = true);

alter view if exists public.relay_topic_report_summary
  set (security_invoker = true);

-- 신고 집계는 로그인 사용자만 조회하도록 제한합니다.
revoke all on table public.relay_topic_report_summary from anon;
grant select on table public.relay_topic_report_summary to authenticated;

-- 댓글 수 집계는 서비스 화면에서 사용할 수 있도록 로그인 사용자에게만 공개합니다.
revoke all on table public.relay_topic_comment_summary from anon;
grant select on table public.relay_topic_comment_summary to authenticated;
