import { supabase } from "./supabase";

export type PostComment = { id: string; comicId: string; author: string; body: string; isSpoiler: boolean; createdAt: number };

export async function loadPostComments(postId: string): Promise<PostComment[]> {
  const { data, error } = await supabase.from("comments").select("id,post_id,author_name,body,is_spoiler,created_at").eq("post_id", postId).is("deleted_at", null).order("created_at", { ascending: false }).limit(100);
  if (error) throw error;
  return (data ?? []).map((comment) => ({ id: comment.id, comicId: comment.post_id, author: comment.author_name, body: comment.body, isSpoiler: Boolean(comment.is_spoiler), createdAt: new Date(comment.created_at).getTime() }));
}

export async function createPostComment(postId: string, body: string, isSpoiler: boolean): Promise<PostComment> {
  const { data, error } = await supabase.from("comments").insert({ post_id: postId, author_name: "익명", body, is_spoiler: isSpoiler }).select("id,post_id,author_name,body,is_spoiler,created_at").single();
  if (error) throw error;
  return { id: data.id, comicId: data.post_id, author: data.author_name, body: data.body, isSpoiler: Boolean(data.is_spoiler), createdAt: new Date(data.created_at).getTime() };
}
