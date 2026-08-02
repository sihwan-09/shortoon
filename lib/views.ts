import { supabase } from "./supabase";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_WEEKLY_VIEWS = 5;

async function getUserId() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session?.user.id ?? null;
}

export async function loadPostViewCounts(postIds: string[]): Promise<Record<string, number>> {
  const ids = Array.from(new Set(postIds.filter(Boolean)));
  if (!ids.length) return {};
  const { data, error } = await supabase.from("post_views").select("post_id").in("post_id", ids);
  if (error) {
    console.error("게시물 조회수 집계 실패", error);
    return {};
  }
  return (data ?? []).reduce<Record<string, number>>((counts, row) => {
    counts[row.post_id] = (counts[row.post_id] ?? 0) + 1;
    return counts;
  }, {});
}

export async function recordPostView(postId: string): Promise<boolean> {
  const userId = await getUserId();
  if (!userId || !postId) return false;
  const since = new Date(Date.now() - WEEK_MS).toISOString();
  const { count, error: countError } = await supabase.from("post_views").select("id", { count: "exact", head: true }).eq("post_id", postId).eq("user_id", userId).gte("viewed_at", since);
  if (countError) throw countError;
  if ((count ?? 0) >= MAX_WEEKLY_VIEWS) return false;
  const { error } = await supabase.from("post_views").insert({ post_id: postId, user_id: userId });
  if (error) throw error;
  return true;
}
