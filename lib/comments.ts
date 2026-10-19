import { supabase } from "./supabase";

export type PostComment = { id: string; comicId: string; author: string; authorId?: string | null; authorChannelId?: string | null; authorImageUrl?: string | null; replyToOwnerId?: string; replyToChannelId?: string; body: string; isSpoiler: boolean; createdAt: number; parentId?: string | null; likeCount: number; likedByMe: boolean; replyCount: number };

export async function loadPostComments(postId: string): Promise<PostComment[]> {
  const { data, error } = await supabase.from("comments").select("id,post_id,parent_id,author_id,author_name,body,is_spoiler,created_at").eq("post_id", postId).is("deleted_at", null).order("created_at", { ascending: false }).limit(100);
  if (error) throw error;
  const authorIds = Array.from(new Set((data ?? []).map((comment) => comment.author_id).filter((id): id is string => Boolean(id))));
  const authorNames = new Map<string, string>();
  const authorChannelIds = new Map<string, string>();
  const authorImages = new Map<string, string>();
  if (authorIds.length) {
    const { data: profiles, error: profileError } = await supabase.from("channel_profiles").select("owner_id,name,channel_id,profile_image_url").in("owner_id", authorIds);
    if (profileError) console.error("댓글 작성자 프로필 조회 실패", profileError);
    for (const profile of profiles ?? []) {
      if (profile.owner_id && profile.name) authorNames.set(profile.owner_id, profile.name);
      if (profile.owner_id && profile.channel_id) authorChannelIds.set(profile.owner_id, profile.channel_id);
      if (profile.owner_id && profile.profile_image_url) authorImages.set(profile.owner_id, profile.profile_image_url);
    }
  }
  const commentIds = (data ?? []).map((comment) => comment.id);
  const likeCounts = new Map<string, number>();
  const likedIds = new Set<string>();
  if (commentIds.length) {
    const [{ data: likes, error: likesError }, { data: sessionData }] = await Promise.all([
      supabase.from("comment_likes").select("comment_id,user_id").in("comment_id", commentIds),
      supabase.auth.getSession(),
    ]);
    if (likesError) console.error("댓글 좋아요 조회 실패", likesError);
    for (const like of likes ?? []) {
      likeCounts.set(like.comment_id, (likeCounts.get(like.comment_id) ?? 0) + 1);
      if (sessionData.session?.user.id === like.user_id) likedIds.add(like.comment_id);
    }
  }
  const replyCounts = new Map<string, number>();
  for (const comment of data ?? []) if (comment.parent_id) replyCounts.set(comment.parent_id, (replyCounts.get(comment.parent_id) ?? 0) + 1);
  return (data ?? []).map((comment) => ({ id: comment.id, comicId: comment.post_id, authorId: comment.author_id, authorChannelId: comment.author_id ? authorChannelIds.get(comment.author_id) ?? null : null, authorImageUrl: comment.author_id ? authorImages.get(comment.author_id) ?? null : null, author: (comment.author_id && authorNames.get(comment.author_id)) || comment.author_name, body: comment.body, isSpoiler: Boolean(comment.is_spoiler), createdAt: new Date(comment.created_at).getTime(), parentId: comment.parent_id, likeCount: likeCounts.get(comment.id) ?? 0, likedByMe: likedIds.has(comment.id), replyCount: replyCounts.get(comment.id) ?? 0 }));
}

export async function createPostComment(postId: string, authorName: string, body: string, isSpoiler: boolean, parentId?: string | null): Promise<PostComment> {
  const { data: sessionData } = await supabase.auth.getSession();
  const authorId = sessionData.session?.user.id ?? null;
  const { data, error } = await supabase.from("comments").insert({ post_id: postId, parent_id: parentId ?? null, author_id: authorId, author_name: authorName, body, is_spoiler: isSpoiler }).select("id,post_id,parent_id,author_id,author_name,body,is_spoiler,created_at").single();
  if (error) throw error;
  return { id: data.id, comicId: data.post_id, authorId: data.author_id, authorChannelId: null, authorImageUrl: null, author: data.author_name, body: data.body, isSpoiler: Boolean(data.is_spoiler), createdAt: new Date(data.created_at).getTime(), parentId: data.parent_id, likeCount: 0, likedByMe: false, replyCount: 0 };
}

export async function toggleCommentLike(commentId: string, liked: boolean) {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) throw new Error("댓글 좋아요는 로그인 후 사용할 수 있습니다.");
  if (liked) {
    const { error } = await supabase.from("comment_likes").upsert({ comment_id: commentId, user_id: userId }, { onConflict: "comment_id,user_id" });
    if (error) throw error;
  } else {
    const { error } = await supabase.from("comment_likes").delete().eq("comment_id", commentId).eq("user_id", userId);
    if (error) throw error;
  }
}
