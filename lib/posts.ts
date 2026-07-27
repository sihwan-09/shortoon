import { supabase } from "./supabase";

const CHANNEL_NAME = "시화 작가";
export type PostDraft = { title: string; genre: string; description?: string; link?: { title: string; url: string }; coverFile?: File | null; imageFiles?: File[]; coverUrl: string; imageUrls: string[]; authorName?: string };
export type PublishedPost = { id: string; title: string; coverUrl: string; imageUrls: string[]; genre: string; description?: string; createdAt?: string; publishedAt?: string; likeCount?: number; viewCount?: number; link?: { title: string; url: string }; authorName?: string };

const isPublishedAtMissing = (error: { code?: string; message?: string } | null) => Boolean(error && (error.code === "PGRST204" || error.message?.toLowerCase().includes("published_at")));

async function uploadPostFiles(draft: PostDraft, postId: string) {
  const uploadFile = async (file: File, name: string) => {
    const path = `${postId}/${name}`;
    const { error } = await supabase.storage.from("shorttoon-posts").upload(path, file, { upsert: true, contentType: file.type });
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

type PostRow = { id: string; title: string; genre: string; description: string | null; author_name: string | null; link_title: string | null; link_url: string | null; cover_image_url: string; like_count: number | null; created_at: string; published_at?: string | null };
type ImageRow = { post_id: string; image_url: string; sort_order: number };

async function queryPosts(page: number, pageSize: number, withPublishedAt: boolean) {
  const from = page * pageSize;
  const to = from + pageSize - 1;
  const select = withPublishedAt ? "id,title,genre,description,author_name,link_title,link_url,cover_image_url,like_count,created_at,published_at" : "id,title,genre,description,author_name,link_title,link_url,cover_image_url,like_count,created_at";
  let query = supabase.from("posts").select(select).eq("status", "published");
  query = withPublishedAt ? query.order("published_at", { ascending: false, nullsFirst: false }).order("id", { ascending: false }) : query.order("created_at", { ascending: false }).order("id", { ascending: false });
  return query.range(from, to);
}

export async function loadPublishedPostsPage(page: number, pageSize = 10): Promise<{ posts: PublishedPost[]; hasMore: boolean }> {
  let result = await queryPosts(page, pageSize, true);
  if (result.error && isPublishedAtMissing(result.error)) result = await queryPosts(page, pageSize, false);
  if (result.error) throw result.error;
  const rows = (result.data ?? []) as PostRow[];
  const ids = rows.map((post) => post.id);
  const { data: images, error: imagesError } = ids.length ? await supabase.from("post_images").select("post_id,image_url,sort_order").in("post_id", ids).order("sort_order", { ascending: true }) : { data: [], error: null };
  if (imagesError) throw imagesError;
  const imagesByPost = new Map<string, ImageRow[]>();
  for (const image of (images ?? []) as ImageRow[]) imagesByPost.set(image.post_id, [...(imagesByPost.get(image.post_id) ?? []), image]);
  const posts = rows.map((post) => ({ id: post.id, title: post.title, coverUrl: post.cover_image_url, imageUrls: (imagesByPost.get(post.id) ?? []).map((image) => image.image_url), genre: post.genre, authorName: post.author_name ?? CHANNEL_NAME, description: post.description ?? "", createdAt: post.created_at, publishedAt: post.published_at ?? undefined, likeCount: post.like_count ?? 0, viewCount: 0, link: post.link_title && post.link_url ? { title: post.link_title, url: post.link_url } : undefined }));
  return { posts, hasMore: posts.length === pageSize };
}

export async function loadPostsFromSupabase() {
  const pages = await loadPublishedPostsPage(0, 1000);
  return pages.posts;
}
