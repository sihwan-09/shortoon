import { supabase } from "./supabase";

async function getCurrentUserId() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session?.user.id ?? null;
}

export async function loadFollowedChannelIds(): Promise<string[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];
  const { data, error } = await supabase.from("channel_follows").select("following_id,created_at").eq("follower_id", userId).order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => row.following_id as string).filter(Boolean);
}

export async function setFollowedChannel(ownerId: string, following: boolean): Promise<void> {
  const userId = await getCurrentUserId();
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!userId || !ownerId || userId === ownerId || !uuidPattern.test(ownerId)) return;
  if (following) {
    const { error } = await supabase.from("channel_follows").upsert({ follower_id: userId, following_id: ownerId }, { onConflict: "follower_id,following_id", ignoreDuplicates: true });
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from("channel_follows").delete().eq("follower_id", userId).eq("following_id", ownerId);
  if (error) throw error;
}

export async function loadFollowerCount(ownerId: string | null): Promise<number> {
  const resolvedOwnerId = ownerId ?? await getCurrentUserId();
  if (!resolvedOwnerId) return 0;
  const { data, error } = await supabase.rpc("get_channel_follower_count", { target_owner_id: resolvedOwnerId });
  if (!error) return Number(data ?? 0);

  console.warn("팔로워 수 집계 함수 호출 실패, 기존 조회 방식으로 재시도합니다.", error);
  const { count, error: countError } = await supabase.from("channel_follows").select("follower_id", { count: "exact", head: true }).eq("following_id", resolvedOwnerId);
  if (countError) throw countError;
  return count ?? 0;
}
