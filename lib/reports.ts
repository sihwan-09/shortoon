import { supabase } from "./supabase";

export type PostReport = { reporterId: string; channelId: string; createdAt: string };

export async function reportPost(postId: string) {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) throw new Error("로그인이 필요합니다.");

  const { error } = await supabase.from("post_reports").insert({
    post_id: postId,
    reporter_id: userId,
  });
  if (error) {
    if (error.code === "23505") throw new Error("이미 신고한 게시물입니다.");
    throw error;
  }
}

export async function loadPostReports(postId: string): Promise<PostReport[]> {
  const { data, error } = await supabase.from("post_reports").select("reporter_id,created_at").eq("post_id", postId).order("created_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as Array<{ reporter_id: string; created_at: string }>;
  const reporterIds = Array.from(new Set(rows.map((row) => row.reporter_id)));
  const { data: profiles, error: profileError } = reporterIds.length
    ? await supabase.from("channel_profiles").select("owner_id,channel_id").in("owner_id", reporterIds)
    : { data: [], error: null };
  if (profileError) throw profileError;
  const channelIds = new Map<string, string>();
  for (const profile of (profiles ?? []) as Array<{ owner_id: string; channel_id: string | null }>) channelIds.set(profile.owner_id, profile.channel_id ?? "채널 아이디");
  return rows.map((row) => ({ reporterId: row.reporter_id, channelId: channelIds.get(row.reporter_id) ?? "채널 아이디", createdAt: row.created_at }));
}
