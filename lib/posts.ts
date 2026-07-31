import { supabase } from "./supabase";

const CHANNEL_NAME = "시화 작가";
export type PostDraft = { title: string; genre: string; description?: string; link?: { title: string; url: string }; coverFile?: File | null; imageFiles?: File[]; coverUrl: string; imageUrls: string[]; authorName?: string };
export type PublishedPost = { id: string; authorId?: string | null; authorChannelId?: string | null; authorImageUrl?: string | null; title: string; coverUrl: string; imageUrls: string[]; genre: string; description?: string; createdAt?: string; publishedAt?: string; likeCount?: number; commentCount?: number; viewCount?: number; link?: { title: string; url: string }; authorName?: string };

const isPublishedAtMissing = (error: { code?: string; message?: string } | null) => Boolean(error && (error.code === "PGRST204" || error.message?.toLowerCase().includes("published_at")));

async function uploadPostFiles(draft: PostDraft, postId: string) {
  const uploadFile = async (file: File, name: string) => {
    const path = `${postId}/${name}`;
    const { error } = await supabase.storage.from("shorttoon-posts").upload(path, file, { contentType: file.type });
    if (error) throw error;
    return supabase.storage.from("shorttoon-posts").getPublicUrl(path).data.publicUrl;
  };
  const coverUrl = draft.coverFile ? await uploadFile(draft.coverFile, "cover") : draft.coverUrl;
  const imageUrls = draft.imageFiles?.length ? await Promise.all(draft.imageFiles.map((file, index) => uploadFile(file, `${String(index).padStart(2, "0")}`))) : draft.imageUrls;
  return { coverUrl, imageUrls };
}

export async function savePostToSupabase(draft: PostDraft) {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id ?? null;
  const postId = crypto.randomUUID();
  const { coverUrl, imageUrls } = await uploadPostFiles(draft, postId);
  const publishedAt = new Date().toISOString();
  const baseRow = { id: postId, author_id: userId, author_name: draft.authorName ?? CHANNEL_NAME, title: draft.title, genre: draft.genre, description: draft.description ?? "", link_title: draft.link?.title ?? null, link_url: draft.link?.url ?? null, cover_image_url: coverUrl, like_count: 0, comment_count: 0, status: "published" as const };
  let { error: postError } = await supabase.from("posts").insert({ ...baseRow, published_at: publishedAt });
  if (postError && isPublishedAtMissing(postError)) ({ error: postError } = await supabase.from("posts").insert(baseRow));
  if (postError) throw postError;
  if (imageUrls.length) {
    const { error: imageError } = await supabase.from("post_images").insert(imageUrls.map((imageUrl, sortOrder) => ({ post_id: postId, image_url: imageUrl, sort_order: sortOrder })));
    if (imageError) throw imageError;
  }
  return { id: postId, title: draft.title, coverUrl, imageUrls, genre: draft.genre, description: draft.description, createdAt: publishedAt, publishedAt, likeCount: 0, viewCount: 0, link: draft.link, authorName: draft.authorName ?? CHANNEL_NAME };
}

export async function deletePostFromSupabase(postId: string) {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) throw new Error("로그인이 필요합니다.");

  const { data: files, error: listError } = await supabase.storage.from("shorttoon-posts").list(postId);
  if (listError) console.warn("게시물 이미지 목록을 정리하지 못했습니다", listError);

  if (files?.length) {
    const { error: storageError } = await supabase.storage.from("shorttoon-posts").remove(files.map((file) => `${postId}/${file.name}`));
    if (storageError) console.warn("게시물 이미지 파일을 정리하지 못했습니다", storageError);
  }

  const { error } = await supabase.from("posts").delete().eq("id", postId).eq("author_id", userId);
  if (error) throw error;
}

type PostRow = { id: string; author_id: string | null; title: string; genre: string; description: string | null; author_name: string | null; link_title: string | null; link_url: string | null; cover_image_url: string; like_count: number | null; comment_count: number | null; created_at: string; published_at?: string | null };
type ImageRow = { post_id: string; image_url: string; sort_order: number };
type ChannelProfileRow = { owner_id: string; channel_id: string | null; profile_image_url: string | null };

async function queryPosts(page: number, pageSize: number, withPublishedAt: boolean, postIds?: string[]) {
  const from = page * pageSize;
  const to = from + pageSize - 1;
  const select = withPublishedAt ? "id,author_id,title,genre,description,author_name,link_title,link_url,cover_image_url,like_count,comment_count,created_at,published_at" : "id,author_id,title,genre,description,author_name,link_title,link_url,cover_image_url,like_count,comment_count,created_at";
  let query = supabase.from("posts").select(select).eq("status", "published");
  if (postIds?.length) query = query.in("id", postIds);
  query = withPublishedAt ? query.order("published_at", { ascending: false, nullsFirst: false }).order("id", { ascending: false }) : query.order("created_at", { ascending: false }).order("id", { ascending: false });
  return query.range(from, to);
}

export async function loadPublishedPostsPage(page: number, pageSize = 10, authorId?: string | null, postIds?: string[]): Promise<{ posts: PublishedPost[]; hasMore: boolean }> {
  let result = await queryPosts(page, pageSize, true, postIds);
  if (authorId) result = { ...result, data: result.data?.filter((row) => row.author_id === authorId) ?? null };
  if (result.error && isPublishedAtMissing(result.error)) result = await queryPosts(page, pageSize, false, postIds);
  if (result.error) throw result.error;
  const rows = (result.data ?? []) as PostRow[];
  const ids = rows.map((post) => post.id);
  const authorIds = Array.from(new Set(rows.map((post) => post.author_id).filter((id): id is string => Boolean(id))));
  const { data: authorProfiles, error: authorProfilesError } = authorIds.length ? await supabase.from("channel_profiles").select("owner_id,channel_id,profile_image_url").in("owner_id", authorIds) : { data: [], error: null };
  if (authorProfilesError) console.error("게시물 작성자 프로필 조회 실패", authorProfilesError);
  const authorProfileMap = new Map<string, ChannelProfileRow>();
  for (const profile of (authorProfiles ?? []) as ChannelProfileRow[]) authorProfileMap.set(profile.owner_id, profile);
  const { data: images, error: imagesError } = ids.length ? await supabase.from("post_images").select("post_id,image_url,sort_order").in("post_id", ids).order("sort_order", { ascending: true }) : { data: [], error: null };
  if (imagesError) throw imagesError;
  const imagesByPost = new Map<string, ImageRow[]>();
  for (const image of (images ?? []) as ImageRow[]) imagesByPost.set(image.post_id, [...(imagesByPost.get(image.post_id) ?? []), image]);
  const [{ data: likeRows, error: likesError }, { data: commentRows, error: commentsError }] = ids.length ? await Promise.all([
    supabase.from("post_likes").select("post_id").in("post_id", ids),
    supabase.from("comments").select("post_id").in("post_id", ids).is("deleted_at", null),
  ]) : [{ data: [], error: null }, { data: [], error: null }];
  if (likesError) console.error("게시물 좋아요 수 집계 실패", likesError);
  if (commentsError) console.error("게시물 댓글 수 집계 실패", commentsError);
  const likeCounts = new Map<string, number>();
  for (const row of likeRows ?? []) likeCounts.set(row.post_id, (likeCounts.get(row.post_id) ?? 0) + 1);
  const commentCounts = new Map<string, number>();
  for (const row of commentRows ?? []) commentCounts.set(row.post_id, (commentCounts.get(row.post_id) ?? 0) + 1);
  const posts = rows.map((post) => { const authorProfile = post.author_id ? authorProfileMap.get(post.author_id) : undefined; return { id: post.id, authorId: post.author_id, authorChannelId: authorProfile?.channel_id ?? null, authorImageUrl: authorProfile?.profile_image_url ?? null, title: post.title, coverUrl: post.cover_image_url, imageUrls: (imagesByPost.get(post.id) ?? []).map((image) => image.image_url), genre: post.genre, authorName: post.author_name ?? CHANNEL_NAME, description: post.description ?? "", createdAt: post.created_at, publishedAt: post.published_at ?? undefined, likeCount: likesError ? post.like_count ?? 0 : likeCounts.get(post.id) ?? 0, commentCount: commentsError ? post.comment_count ?? 0 : commentCounts.get(post.id) ?? 0, viewCount: 0, link: post.link_title && post.link_url ? { title: post.link_title, url: post.link_url } : undefined }; });
  return { posts, hasMore: posts.length === pageSize };
}

export async function loadPostsFromSupabase(authorId?: string | null) {
  const pages = await loadPublishedPostsPage(0, 1000, authorId);
  return pages.posts;
}

export async function loadPostsByIds(postIds: string[]) {
  const uniqueIds = Array.from(new Set(postIds.filter(Boolean)));
  if (!uniqueIds.length) return [];
  const result = await loadPublishedPostsPage(0, uniqueIds.length, undefined, uniqueIds);
  const postsById = new Map(result.posts.map((post) => [post.id, post]));
  return uniqueIds.map((id) => postsById.get(id)).filter((post): post is PublishedPost => Boolean(post));
}
