-- 기존 channel_profiles에 가입 시각을 저장합니다.
alter table public.channel_profiles
  add column if not exists joined_at timestamptz;

-- 기존 계정은 Supabase Auth 가입 시각으로 한 번만 채웁니다.
update public.channel_profiles cp
set joined_at = u.created_at
from auth.users u
where cp.owner_id = u.id
  and cp.joined_at is null;

-- 이후 새 프로필이 저장될 때 값이 비어 있으면 현재 시각을 사용합니다.
alter table public.channel_profiles
  alter column joined_at set default now();
