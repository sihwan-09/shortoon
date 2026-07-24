import { supabase } from "./supabase";

const CHANNEL_NAME = "시화 작가";

export type PostDraft = {
  title: string;
  genre: string;
  description?: string;
  link?: { title: string; url: string };
  coverFile?: File | null;
  imageFiles?: File[];
  coverUrl: string;
  imageUrls: string[];
};

export async function savePostToSupabase(draft: PostDraft) {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id ?? null;
  const postId = crypto.randomUUID();
  const uploadFile = async (file: File, name: string) => {
    const path = `${postId}/${name}`;
    const { error } = await supabase.storage.from("shorttoon-posts").upload(path, file, { upsert: true, contentType: file.type });
    if (error) throw error;
    return supabase.storage.from("shorttoon-posts").getPublicUrl(path).data.publicUrl;
  };

  const coverUrl = draft.coverFile ? await uploadFile(draft.coverFile, "cover") : draft.coverUrl;
  const imageUrls = draft.imageFiles?.length ? await Promise.all(draft.imageFiles.map((file, index) => uploadFile(file, `${String(index).padStart(2, "0")}`))) : draft.imageUrls;
  const { error: postError } = await supabase.from("posts").insert({ id: postId, author_id: userId, author_name: "시화 작가", title: draft.title, genre: draft.genre, description: draft.description ?? "", link_title: draft.link?.title ?? null, link_url: draft.link?.url ?? null, cover_image_url: coverUrl, like_count: 0, comment_count: 0, status: "published" });
  if (postError) throw postError;
  if (imageUrls.length) {
    const { error: imageError } = await supabase.from("post_images").insert(imageUrls.map((imageUrl, sortOrder) => ({ post_id: postId, image_url: imageUrl, sort_order: sortOrder })));
    if (imageError) throw imageError;
  }
  return { id: postId, title: draft.title, coverUrl, imageUrls, genre: draft.genre, description: draft.description, link: draft.link, authorName: draft.authorName ?? CHANNEL_NAME };
}

export async function loadPostsFromSupabase() {
  const { data: posts, error: postsError } = await supabase.from("posts").select("id,title,genre,description,author_name,link_title,link_url,cover_image_url").eq("status", "published").order("created_at", { ascending: false });
  if (postsError) throw postsError;
  const postIds = (posts ?? []).map((post) => post.id);
  const { data: images, error: imagesError } = postIds.length
    ? await supabase.from("post_images").select("post_id,image_url,sort_order").in("post_id", postIds).order("sort_order", { ascending: true })
    : { data: [], error: null };
  if (imagesError) throw imagesError;
  const imagesByPost = new Map<string, { image_url: string; sort_order: number }[]>();
  for (const image of images ?? []) {
    const current = imagesByPost.get(image.post_id) ?? [];
    current.push(image);
    imagesByPost.set(image.post_id, current);
  }
  return (posts ?? []).map((post) => ({
    id: post.id,
    title: post.title,
    coverUrl: post.cover_image_url,
    imageUrls: (imagesByPost.get(post.id) ?? []).sort((a, b) => a.sort_order - b.sort_order).map((image) => image.image_url),
    genre: post.genre,
    authorName: post.author_name ?? CHANNEL_NAME,
    description: post.description,
    link: post.link_title && post.link_url ? { title: post.link_title, url: post.link_url } : undefined,
  }));
}
