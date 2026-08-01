import { supabase } from "./supabase";
import type { PublishedPost } from "./posts";

export type SearchAuthor = { ownerId: string; name: string; channelId: string; profileImageUrl: string | null; followerCount: number; postCount: number };

const escapeSearchKeyword = (value: string) => value.replace(/[\\%_,()]/g, "").trim().slice(0, 80);

export async function searchPublishedPosts(query: string): Promise<PublishedPost[]> {
  const keyword = escapeSearchKeyword(query);
  if (!keyword) return [];
  const { data, error } = await supabase.from("posts")
    .select("id,author_id,title,genre,description,author_name,link_title,link_url,cover_image_url,like_count,comment_count,created_at,published_at")
    .eq("status", "published")
    .or(`title.ilike.%${keyword}%,description.ilike.%${keyword}%`)
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("id", { ascending: false })
    .limit(20);
  if (error) throw error;
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const authorIds = Array.from(new Set(rows.map((row) => typeof row.author_id === "string" ? row.author_id : null).filter((id): id is string => Boolean(id))));
  const { data: profiles } = authorIds.length ? await supabase.from("channel_profiles").select("owner_id,channel_id,profile_image_url").in("owner_id", authorIds) : { data: [] };
  const profileMap = new Map((profiles ?? []).map((row) => [row.owner_id as string, row]));
  const posts = rows.map((row) => {
    const id = String(row.id);
    const authorId = typeof row.author_id === "string" ? row.author_id : null;
    const profile = authorId ? profileMap.get(authorId) : undefined;
    return { id, authorId, authorChannelId: profile?.channel_id ?? null, authorImageUrl: profile?.profile_image_url ?? null, title: String(row.title ?? ""), coverUrl: String(row.cover_image_url ?? ""), imageUrls: [], genre: String(row.genre ?? ""), authorName: String(row.author_name ?? "시화 작가"), description: String(row.description ?? ""), createdAt: String(row.created_at ?? ""), publishedAt: typeof row.published_at === "string" ? row.published_at : undefined, likeCount: Number(row.like_count ?? 0), commentCount: Number(row.comment_count ?? 0), viewCount: 0, link: row.link_title && row.link_url ? { title: String(row.link_title), url: String(row.link_url) } : undefined } satisfies PublishedPost;
  });
  const { data: images } = posts.length ? await supabase.from("post_images").select("post_id,image_url,sort_order").in("post_id", posts.map((post) => post.id)).order("sort_order", { ascending: true }) : { data: [] };
  const imageMap = new Map<string, string[]>();
  for (const image of images ?? []) imageMap.set(image.post_id, [...(imageMap.get(image.post_id) ?? []), image.image_url]);
  return posts.map((post) => ({ ...post, imageUrls: imageMap.get(post.id) ?? [] }));
}

export async function searchAuthors(query: string): Promise<SearchAuthor[]> {
  const keyword = escapeSearchKeyword(query);
  if (!keyword) return [];
  const { data, error } = await supabase.from("channel_profiles").select("owner_id,name,channel_id,profile_image_url").or(`name.ilike.%${keyword}%,channel_id.ilike.%${keyword}%`).limit(20);
  if (error) throw error;
  const rows = (data ?? []) as Array<{ owner_id: string; name: string | null; channel_id: string | null; profile_image_url: string | null }>;
  const ids = rows.map((row) => row.owner_id).filter(Boolean);
  const { data: posts } = ids.length ? await supabase.from("posts").select("author_id").eq("status", "published").in("author_id", ids) : { data: [] };
  const counts = new Map<string, number>();
  for (const row of posts ?? []) counts.set(row.author_id, (counts.get(row.author_id) ?? 0) + 1);
  return rows.map((row) => ({ ownerId: row.owner_id, name: row.name ?? "채널명", channelId: row.channel_id ?? "채널 아이디", profileImageUrl: row.profile_image_url, followerCount: 0, postCount: counts.get(row.owner_id) ?? 0 }));
}
