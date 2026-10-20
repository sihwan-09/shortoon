import { supabase } from "./supabase";
import { loadPostsByIds, type PublishedPost } from "./posts";
import { getHighlightDayWindow } from "./highlight-time";

export type DailyHighlight = { post: PublishedPost; todayLikes: number };

export async function loadDailyHighlight(now = new Date()): Promise<DailyHighlight | null> {
  const { start, end } = getHighlightDayWindow(now);
  const counts = new Map<string, number>();
  const pageSize = 500;
  // Read every page so the API's row limit cannot change the winning work.
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase.from("post_likes")
      .select("post_id,posts!inner(status)")
      .eq("posts.status", "published")
      .gte("created_at", start.toISOString())
      .lt("created_at", end.toISOString())
      .lte("created_at", now.toISOString())
      .order("post_id", { ascending: true }).order("user_id", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    for (const row of data ?? []) counts.set(row.post_id, (counts.get(row.post_id) ?? 0) + 1);
    if (!data || data.length < pageSize) break;
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  // Resolve ties by publication date, and skip any work removed while loading.
  for (let offset = 0; offset < ranked.length; ) {
    const score = ranked[offset][1];
    const candidates: string[] = [];
    while (offset < ranked.length && ranked[offset][1] === score) candidates.push(ranked[offset++][0]);
    let winner: PublishedPost | null = null;
    for (let index = 0; index < candidates.length; index += 100) {
      for (const post of await loadPostsByIds(candidates.slice(index, index + 100))) {
        const publishedAt = Date.parse(post.publishedAt ?? post.createdAt ?? "") || 0;
        const winnerDate = winner ? Date.parse(winner.publishedAt ?? winner.createdAt ?? "") || 0 : 0;
        if (!winner || publishedAt > winnerDate || (publishedAt === winnerDate && post.id > winner.id)) winner = post;
      }
    }
    if (winner) return { post: winner, todayLikes: score };
  }
  return null;
}
