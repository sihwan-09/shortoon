import { supabase } from "./supabase";

export type PostReport = { reporterId: string; channelId: string; createdAt: string };
export const REPORT_CATEGORIES = [
  { id: "sexual", label: "성적인 콘텐츠" },
  { id: "violent", label: "폭력적 또는 혐오스러운 콘텐츠" },
  { id: "hate", label: "증오 또는 악의적인 콘텐츠" },
  { id: "harassment", label: "괴롭힘 또는 폭력" },
  { id: "misinformation", label: "잘못된 정보" },
  { id: "spam", label: "스팸 또는 혼동을 야기하는 콘텐츠" },
] as const;
export type ReportCategory = (typeof REPORT_CATEGORIES)[number]["id"];
export type ChannelReportCategory = ReportCategory | "impersonation" | "privacy";

export async function reportPost(postId: string, category: ReportCategory) {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) throw new Error("로그인이 필요합니다.");

  const { error } = await supabase.from("post_reports").insert({
    post_id: postId,
    reporter_id: userId,
    category_sexual: category === "sexual",
    category_violent: category === "violent",
    category_hate: category === "hate",
    category_harassment: category === "harassment",
    category_misinformation: category === "misinformation",
    category_spam: category === "spam",
  });
  if (error) {
    if (error.code === "23505") throw new Error("이미 신고한 게시물입니다.");
    throw error;
  }
}

export async function reportChannel(channelId: string, category: ChannelReportCategory) {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) throw new Error("로그인이 필요합니다.");
  const { error } = await supabase.from("channel_reports").insert({
    channel_id: channelId,
    reporter_id: userId,
    category_sexual: category === "sexual",
    category_violent: category === "violent",
    category_hate: category === "hate",
    category_harassment: category === "harassment",
    category_misinformation: category === "misinformation",
    category_spam: category === "spam",
    category_impersonation: category === "impersonation",
    category_privacy: category === "privacy",
  });
  if (error) {
    if (error.code === "23505") throw new Error("이미 신고한 채널입니다.");
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
