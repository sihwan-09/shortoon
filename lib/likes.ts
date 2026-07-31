import { supabase } from "./supabase";

export async function syncPostLike(postId: string, liked: boolean) {
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user) return;
  if (liked) {
    const { error } = await supabase.from("post_likes").upsert({ user_id: user.id, post_id: postId }, { onConflict: "user_id,post_id" });
    if (error) throw error;
  } else {
    const { error } = await supabase.from("post_likes").delete().eq("user_id", user.id).eq("post_id", postId);
    if (error) throw error;
  }
}

export async function loadUserLikedPostIds() {
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user) return [];
  let { data: rows, error } = await supabase.from("post_likes").select("post_id,created_at").eq("user_id", user.id).order("created_at", { ascending: false });
  if (error) ({ data: rows, error } = await supabase.from("post_likes").select("post_id").eq("user_id", user.id));
  if (error) return [];
  return (rows ?? []).map((row) => row.post_id as string);
}
