import { supabase } from "./supabase";

export type PostComment = { id: string; comicId: string; author: string; authorId?: string | null; body: string; isSpoiler: boolean; createdAt: number };

export async function loadPostComments(postId: string): Promise<PostComment[]> {
  const { data, error } = await supabase.from("comments").select("id,post_id,author_id,author_name,body,is_spoiler,created_at").eq("post_id", postId).is("deleted_at", null).order("created_at", { ascending: false }).limit(100);
  if (error) throw error;
  const authorIds = Array.from(new Set((data ?? []).map((comment) => comment.author_id).filter((id): id is string => Boolean(id))));
  const authorNames = new Map<string, string>();
  if (authorIds.length) {
    const { data: profiles, error: profileError } = await supabase.from("channel_profiles").select("owner_id,name").in("owner_id", authorIds);
    if (profileError) console.error("댓글 작성자 프로필 조회 실패", profileError);
    for (const profile of profiles ?? []) if (profile.owner_id && profile.name) authorNames.set(profile.owner_id, profile.name);
  }
  return (data ?? []).map((comment) => ({ id: comment.id, comicId: comment.post_id, authorId: comment.author_id, author: (comment.author_id && authorNames.get(comment.author_id)) || comment.author_name, body: comment.body, isSpoiler: Boolean(comment.is_spoiler), createdAt: new Date(comment.created_at).getTime() }));
}

export async function createPostComment(postId: string, authorName: string, body: string, isSpoiler: boolean): Promise<PostComment> {
  const { data: sessionData } = await supabase.auth.getSession();
  const authorId = sessionData.session?.user.id ?? null;
  const { data, error } = await supabase.from("comments").insert({ post_id: postId, author_id: authorId, author_name: authorName, body, is_spoiler: isSpoiler }).select("id,post_id,author_id,author_name,body,is_spoiler,created_at").single();
  if (error) throw error;
  return { id: data.id, comicId: data.post_id, authorId: data.author_id, author: data.author_name, body: data.body, isSpoiler: Boolean(data.is_spoiler), createdAt: new Date(data.created_at).getTime() };
}
