import { supabase } from "./supabase";

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
