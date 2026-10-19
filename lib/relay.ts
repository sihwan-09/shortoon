import { supabase } from "./supabase";
import type { PostComment } from "./comments";
import { loadFollowerCount } from "./follows";

export type RelayParticipant = { ownerId: string; name: string; channelId: string; profileImageUrl: string | null; followerCount: number };
export type RelayTopic = { id: string; ownerId?: string; ownerName?: string; ownerChannelId?: string; ownerImageUrl?: string | null; participants?: RelayParticipant[]; pageParticipants?: Array<RelayParticipant | null>; title: string; imageUrl: string; imageUrls?: string[]; participantCount?: number; relayDays: number; participantHours: number; commentsEnabled?: boolean; createdAt?: string; likeCount?: number; commentCount?: number; viewCount?: number; likedByMe?: boolean };

export async function saveRelayTopic(input: { title: string; imageFile?: File; imageUrl: string; relayDays: number; participantHours: number; allowComments: boolean }) {
  const { data: sessionData } = await supabase.auth.getSession();
  const ownerId = sessionData.session?.user.id;
  if (!ownerId) throw new Error("로그인이 필요합니다.");
  const id = crypto.randomUUID();
  let thumbnailUrl = input.imageUrl;
  if (input.imageFile) {
    const path = `relay-topics/${ownerId}/${id}`;
    const { error: uploadError } = await supabase.storage.from("shorttoon-posts").upload(path, input.imageFile, { contentType: input.imageFile.type, upsert: false });
    if (uploadError) throw uploadError;
    thumbnailUrl = supabase.storage.from("shorttoon-posts").getPublicUrl(path).data.publicUrl;
  }
  const { data, error } = await supabase.from("relay_topics").insert({ id, owner_id: ownerId, title: input.title, thumbnail_url: thumbnailUrl, activity_days: input.relayDays, participant_limit_hours: input.participantHours, comments_enabled: input.allowComments }).select("id,title,thumbnail_url,activity_days,participant_limit_hours,comments_enabled,created_at").single();
  if (error) throw error;
  return { id: data.id, ownerId, title: data.title, imageUrl: data.thumbnail_url, relayDays: data.activity_days, participantHours: data.participant_limit_hours, commentsEnabled: data.comments_enabled !== false, createdAt: data.created_at } as RelayTopic;
}

export async function loadRelayTopicCommentCount(topicId: string): Promise<number> {
  const { count, error } = await supabase.from("relay_topic_comments").select("id", { count: "exact", head: true }).eq("relay_topic_id", topicId);
  if (error) throw error;
  return count ?? 0;
}

async function loadRelayTopicCommentCounts(topicIds: string[]) {
  const { data, error } = await supabase.from("relay_topic_comment_summary").select("relay_topic_id,comment_count").in("relay_topic_id", topicIds);
  if (!error) return new Map<string, number>((data ?? []).map((row) => [row.relay_topic_id, Number(row.comment_count)]));
  // The summary view can be unavailable to guests; count readable comments directly.
  return new Map(await Promise.all(topicIds.map(async (id) => [id, await loadRelayTopicCommentCount(id)] as const)));
}

export async function loadRelayTopics() {
  const { data, error } = await supabase.from("relay_topics").select("id,owner_id,title,thumbnail_url,activity_days,participant_limit_hours,comments_enabled,created_at").order("created_at", { ascending: false });
  if (error) throw error;
  const ownerIds = Array.from(new Set((data ?? []).map((row) => row.owner_id).filter(Boolean)));
  const { data: profiles, error: profileError } = ownerIds.length
    ? await supabase.from("channel_profiles").select("owner_id,name,channel_id,profile_image_url").in("owner_id", ownerIds)
    : { data: [], error: null };
  if (profileError) throw profileError;
  const profileByOwner = new Map((profiles ?? []).map((profile) => [profile.owner_id, profile]));
  const topics = (data ?? []).map((row) => {
    const profile = profileByOwner.get(row.owner_id);
    return { id: row.id, ownerId: row.owner_id, ownerName: profile?.name ?? "채널명", ownerChannelId: profile?.channel_id ?? "", ownerImageUrl: profile?.profile_image_url ?? null, title: row.title, imageUrl: row.thumbnail_url, imageUrls: [row.thumbnail_url], relayDays: row.activity_days, participantHours: row.participant_limit_hours, commentsEnabled: row.comments_enabled !== false, createdAt: row.created_at };
  }) as RelayTopic[];
  if (!topics.length) return topics;
  const { data: entryRows, error: entryError } = await supabase.from("relay_topic_entries").select("relay_topic_id,participant_id,image_url,position,created_at").in("relay_topic_id", topics.map((topic) => topic.id)).order("created_at", { ascending: true }).order("position", { ascending: true });
  if (entryError && entryError.code !== "42P01") throw entryError;
  const entriesByTopic = new Map<string, string[]>();
  const pageParticipantIdsByTopic = new Map<string, string[]>();
  const participantsByTopic = new Map<string, Set<string>>();
  const orderedParticipantsByTopic = new Map<string, string[]>();
  for (const row of entryRows ?? []) {
    entriesByTopic.set(row.relay_topic_id, [...(entriesByTopic.get(row.relay_topic_id) ?? []), row.image_url]);
    pageParticipantIdsByTopic.set(row.relay_topic_id, [...(pageParticipantIdsByTopic.get(row.relay_topic_id) ?? []), row.participant_id]);
    const topic = topics.find((item) => item.id === row.relay_topic_id);
    if (topic && row.participant_id !== topic.ownerId) {
      const participantSet = participantsByTopic.get(row.relay_topic_id) ?? new Set<string>();
      if (!participantSet.has(row.participant_id)) orderedParticipantsByTopic.set(row.relay_topic_id, [...(orderedParticipantsByTopic.get(row.relay_topic_id) ?? []), row.participant_id]);
      participantSet.add(row.participant_id);
      participantsByTopic.set(row.relay_topic_id, participantSet);
    }
  }
  const allParticipantIds = Array.from(new Set(topics.flatMap((topic) => [topic.ownerId, ...(orderedParticipantsByTopic.get(topic.id) ?? [])]).filter((id): id is string => Boolean(id))));
  const participantProfilesResult = allParticipantIds.length
    ? await supabase.from("channel_profiles").select("owner_id,name,channel_id,profile_image_url").in("owner_id", allParticipantIds)
    : { data: [], error: null };
  if (participantProfilesResult.error) throw participantProfilesResult.error;
  const participantProfiles = new Map((participantProfilesResult.data ?? []).map((profile) => [profile.owner_id, profile]));
  const followerCounts = new Map<string, number>();
  await Promise.all(allParticipantIds.map(async (id) => {
    try { followerCounts.set(id, await loadFollowerCount(id)); }
    catch (error) { console.error("릴레이툰 참여자 팔로워 수 조회 실패", error); followerCounts.set(id, 0); }
  }));
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id ?? null;
  const [likes, views, mine, commentCounts] = await Promise.all([
    supabase.from("relay_topic_likes").select("relay_topic_id").in("relay_topic_id", topics.map((topic) => topic.id)),
    supabase.from("relay_topic_views").select("relay_topic_id").in("relay_topic_id", topics.map((topic) => topic.id)),
    userId ? supabase.from("relay_topic_likes").select("relay_topic_id").eq("user_id", userId).in("relay_topic_id", topics.map((topic) => topic.id)) : Promise.resolve({ data: [] as { relay_topic_id: string }[] }),
    loadRelayTopicCommentCounts(topics.map((topic) => topic.id))
  ]);
  const likeCounts = new Map<string, number>();
  const viewCounts = new Map<string, number>();
  for (const row of likes.data ?? []) likeCounts.set(row.relay_topic_id, (likeCounts.get(row.relay_topic_id) ?? 0) + 1);
  for (const row of views.data ?? []) viewCounts.set(row.relay_topic_id, (viewCounts.get(row.relay_topic_id) ?? 0) + 1);
  const liked = new Set((mine.data ?? []).map((row) => row.relay_topic_id));
  return topics.map((topic) => {
    const participantIds = [topic.ownerId, ...(orderedParticipantsByTopic.get(topic.id) ?? [])].filter((id): id is string => Boolean(id));
    const participants = participantIds.map((ownerId) => {
      const profile = participantProfiles.get(ownerId);
      return { ownerId, name: profile?.name ?? "채널명", channelId: profile?.channel_id ?? "채널 아이디", profileImageUrl: profile?.profile_image_url ?? null, followerCount: followerCounts.get(ownerId) ?? 0 };
    });
    const participantById = new Map(participants.map((participant) => [participant.ownerId, participant]));
    const pageParticipants = [participantById.get(topic.ownerId ?? "") ?? null, ...(pageParticipantIdsByTopic.get(topic.id) ?? []).map((id) => participantById.get(id) ?? null)];
    return { ...topic, participants, pageParticipants, imageUrls: [topic.imageUrl, ...(entriesByTopic.get(topic.id) ?? [])], participantCount: participants.length ? participants.length - 1 : 0, likeCount: likeCounts.get(topic.id) ?? 0, commentCount: commentCounts.get(topic.id) ?? 0, viewCount: viewCounts.get(topic.id) ?? 0, likedByMe: liked.has(topic.id) };
  });
}

export async function appendRelayTopicImage(topicId: string, imageFile: File) {
  const { data: sessionData } = await supabase.auth.getSession();
  const participantId = sessionData.session?.user.id;
  if (!participantId) throw new Error("로그인이 필요합니다.");
  const entryId = crypto.randomUUID();
  const path = `relay-topics/${topicId}/entries/${entryId}`;
  const { error: uploadError } = await supabase.storage.from("shorttoon-posts").upload(path, imageFile, { contentType: imageFile.type, upsert: false });
  if (uploadError) throw uploadError;
  const imageUrl = supabase.storage.from("shorttoon-posts").getPublicUrl(path).data.publicUrl;
  const { data: lastEntry, error: lastError } = await supabase.from("relay_topic_entries").select("position").eq("relay_topic_id", topicId).order("position", { ascending: false }).limit(1).maybeSingle();
  if (lastError) throw lastError;
  const position = (lastEntry?.position ?? 0) + 1;
  const { error } = await supabase.from("relay_topic_entries").insert({ id: entryId, relay_topic_id: topicId, participant_id: participantId, image_url: imageUrl, position });
  if (error) throw error;
  const [{ data: topic }, { data: participants }] = await Promise.all([
    supabase.from("relay_topics").select("owner_id").eq("id", topicId).maybeSingle(),
    supabase.from("relay_topic_entries").select("participant_id").eq("relay_topic_id", topicId),
  ]);
  const participantCount = new Set((participants ?? []).map((row) => row.participant_id).filter((id) => id && id !== topic?.owner_id)).size;
  window.dispatchEvent(new CustomEvent("shorttoon-relay-participant-count", { detail: { topicId, participantCount } }));
  return imageUrl;
}

export async function getRelayTopicParticipationLock(topicId: string, participantHours: number) {
  const { data: sessionData } = await supabase.auth.getSession();
  const participantId = sessionData.session?.user.id;
  if (!participantId) throw new Error("로그인이 필요합니다.");
  const { data, error } = await supabase
    .from("relay_topic_entries")
    .select("created_at")
    .eq("relay_topic_id", topicId)
    .eq("participant_id", participantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    if (error.code === "42P01") return null;
    throw error;
  }
  if (!data?.created_at) return null;
  const availableAt = new Date(new Date(data.created_at).getTime() + participantHours * 60 * 60 * 1000);
  const remainingMs = availableAt.getTime() - Date.now();
  return remainingMs > 0 ? { availableAt, remainingMs } : null;
}

export async function toggleRelayTopicLike(topicId: string, shouldLike: boolean) {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) return null;
  if (shouldLike) {
    const { error } = await supabase.from("relay_topic_likes").upsert({ relay_topic_id: topicId, user_id: userId }, { onConflict: "relay_topic_id,user_id" });
    if (error) throw error;
  } else {
    const { error } = await supabase.from("relay_topic_likes").delete().eq("relay_topic_id", topicId).eq("user_id", userId);
    if (error) throw error;
  }
  const { count, error } = await supabase.from("relay_topic_likes").select("id", { count: "exact", head: true }).eq("relay_topic_id", topicId);
  if (error) throw error;
  return count ?? 0;
}

export async function recordRelayTopicView(topicId: string): Promise<{ counted: boolean; count: number } | null> {
  const { data, error } = await supabase.rpc("record_relay_topic_view", { p_relay_topic_id: topicId });
  if (error) throw error;
  if (!data) return null;
  return { counted: Boolean(data.counted), count: Number(data.count ?? 0) };
}

export async function reportRelayTopic(topicId: string, category: string) {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) throw new Error("로그인이 필요합니다.");
  const { error } = await supabase.from("relay_topic_reports").insert({ relay_topic_id: topicId, reporter_id: userId, category });
  if (error?.code === "23505") throw new Error("이미 신고한 게시물입니다.");
  if (error) throw error;
}

export async function deleteRelayTopic(topicId: string) {
  const { data, error } = await supabase.from("relay_topics").delete().eq("id", topicId).select("id").maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("릴레이툰을 삭제할 권한이 없거나 게시물이 이미 삭제되었습니다.");
}

export async function loadRelayTopicComments(topicId: string): Promise<PostComment[]> {
  const { data, error } = await supabase.from("relay_topic_comments").select("id,relay_topic_id,parent_id,author_id,reply_to_owner_id,body,is_spoiler,created_at").eq("relay_topic_id", topicId).order("created_at", { ascending: false }).limit(100);
  if (error) throw error;
  const authorIds = Array.from(new Set((data ?? []).flatMap((row) => [row.author_id, row.reply_to_owner_id]).filter(Boolean)));
  const profiles = authorIds.length ? (await supabase.from("channel_profiles").select("owner_id,name,channel_id,profile_image_url").in("owner_id", authorIds)).data ?? [] : [];
  const profileMap = new Map(profiles.map((profile) => [profile.owner_id, profile]));
  const { data: likeRows } = await supabase.from("relay_topic_comment_likes").select("comment_id,user_id").in("comment_id", (data ?? []).map((row) => row.id));
  const { data: session } = await supabase.auth.getSession();
  const likeCounts = new Map<string, number>();
  const likedIds = new Set<string>();
  for (const like of likeRows ?? []) { likeCounts.set(like.comment_id, (likeCounts.get(like.comment_id) ?? 0) + 1); if (like.user_id === session.session?.user.id) likedIds.add(like.comment_id); }
  const replyCounts = new Map<string, number>();
  for (const row of data ?? []) if (row.parent_id) replyCounts.set(row.parent_id, (replyCounts.get(row.parent_id) ?? 0) + 1);
  return (data ?? []).map((row) => ({ id: row.id, comicId: row.relay_topic_id, authorId: row.author_id, author: profileMap.get(row.author_id)?.name ?? "채널명", authorChannelId: profileMap.get(row.author_id)?.channel_id ?? null, authorImageUrl: profileMap.get(row.author_id)?.profile_image_url ?? null, replyToOwnerId: row.reply_to_owner_id ?? undefined, replyToChannelId: profileMap.get(row.reply_to_owner_id)?.channel_id ?? undefined, body: row.body, isSpoiler: Boolean(row.is_spoiler), createdAt: new Date(row.created_at).getTime(), parentId: row.parent_id, likeCount: likeCounts.get(row.id) ?? 0, likedByMe: likedIds.has(row.id), replyCount: replyCounts.get(row.id) ?? 0 }));
}

export async function createRelayTopicComment(topicId: string, body: string, isSpoiler: boolean, parentId?: string | null, target?: { ownerId: string; channelId: string } | null): Promise<PostComment> {
  const { data: sessionData } = await supabase.auth.getSession();
  const authorId = sessionData.session?.user.id;
  if (!authorId) throw new Error("로그인이 필요합니다.");
  const { data, error } = await supabase.from("relay_topic_comments").insert({ relay_topic_id: topicId, author_id: authorId, parent_id: parentId ?? null, reply_to_owner_id: parentId ? null : target?.ownerId ?? null, body, is_spoiler: isSpoiler }).select("id,relay_topic_id,parent_id,author_id,reply_to_owner_id,body,is_spoiler,created_at").single();
  if (error) throw error;
  const { data: profile } = await supabase.from("channel_profiles").select("name,channel_id,profile_image_url").eq("owner_id", authorId).maybeSingle();
  return { id: data.id, comicId: data.relay_topic_id, authorId: data.author_id, author: profile?.name ?? "채널명", authorChannelId: profile?.channel_id ?? null, authorImageUrl: profile?.profile_image_url ?? null, replyToOwnerId: data.reply_to_owner_id ?? undefined, replyToChannelId: data.reply_to_owner_id ? target?.channelId : undefined, body: data.body, isSpoiler: Boolean(data.is_spoiler), createdAt: new Date(data.created_at).getTime(), parentId: data.parent_id, likeCount: 0, likedByMe: false, replyCount: 0 };
}

export async function toggleRelayTopicCommentLike(commentId: string, liked: boolean) {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) throw new Error("댓글 좋아요는 로그인 후 사용할 수 있습니다.");
  const query = liked
    ? supabase.from("relay_topic_comment_likes").upsert({ comment_id: commentId, user_id: userId }, { onConflict: "comment_id,user_id" })
    : supabase.from("relay_topic_comment_likes").delete().eq("comment_id", commentId).eq("user_id", userId);
  const { error } = await query;
  if (error) throw error;
}
