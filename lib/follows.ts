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
