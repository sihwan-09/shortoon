import { supabase } from "./supabase";

export type PostDraft = {
  title: string;
  genre: string;
  description?: string;
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
  const { error: postError } = await supabase.from("posts").insert({ id: postId, author_id: userId, author_name: "시화 작가", title: draft.title, genre: draft.genre, description: draft.description ?? "", cover_image_url: coverUrl, like_count: 0, comment_count: 0, status: "published" });
  if (postError) throw postError;
  if (imageUrls.length) {
    const { error: imageError } = await supabase.from("post_images").insert(imageUrls.map((imageUrl, sortOrder) => ({ post_id: postId, image_url: imageUrl, sort_order: sortOrder })));
    if (imageError) throw imageError;
  }
  return { id: postId, title: draft.title, coverUrl, imageUrls, genre: draft.genre };
}

export async function loadPostsFromSupabase() {
  const { data, error } = await supabase.from("posts").select("id,title,genre,cover_image_url,post_images(image_url,sort_order)").eq("status", "published").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((post) => ({ id: post.id, title: post.title, coverUrl: post.cover_image_url, imageUrls: (post.post_images ?? []).sort((a, b) => a.sort_order - b.sort_order).map((image) => image.image_url), genre: post.genre }));
}
