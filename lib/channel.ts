import { supabase } from "./supabase";
import type { ChannelLink, ChannelProfile } from "../app/components/ChannelEditPage";

async function getCurrentUserId() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session?.user.id ?? null;
}

export async function isChannelIdTaken(channelId: string): Promise<boolean> {
  const value = channelId.trim();
  if (!value) return false;
  const ownerId = await getCurrentUserId();
  let query = supabase.from("channel_profiles").select("owner_id").eq("channel_id", value).limit(1);
  if (ownerId) query = query.neq("owner_id", ownerId);
  const { data, error } = await query;
  if (error) throw error;
  return Boolean(data?.length);
}

export async function loadChannelProfileByOwnerId(ownerId: string | null): Promise<ChannelProfile | null> {
  if (!ownerId) return null;
  let { data, error } = await supabase.from("channel_profiles").select("name,channel_id,intro,link_title,link_url,links,profile_image_url").eq("owner_id", ownerId).maybeSingle();
  if (error) {
    const fallback = await supabase.from("channel_profiles").select("name,channel_id,intro,link_title,link_url").eq("owner_id", ownerId).maybeSingle();
    data = fallback.data;
    error = fallback.error;
  }
  if (error) throw error;
  const links = Array.isArray(data?.links) ? data.links.filter((link: unknown): link is ChannelLink => Boolean(link && typeof link === "object" && "title" in link && "url" in link)).slice(0, 5) : data?.link_title && data?.link_url ? [{ title: data.link_title, url: data.link_url }] : [];
  return data ? { name: data.name, channelId: data.channel_id, intro: data.intro, links, profileImageUrl: data.profile_image_url ?? null } : null;
}

export type FollowedChannelProfile = {
  ownerId: string;
  profileImageUrl: string | null;
  name: string | null;
  channelId: string | null;
};

export async function loadChannelProfilesByOwnerIds(ownerIds: string[]): Promise<FollowedChannelProfile[]> {
  const ids = Array.from(new Set(ownerIds.filter(Boolean)));
  if (!ids.length) return [];
  const { data, error } = await supabase.from("channel_profiles").select("owner_id,name,channel_id,profile_image_url").in("owner_id", ids);
  if (error) throw error;
  const byOwner = new Map((data ?? []).map((row) => [row.owner_id as string, row]));
  return ids.map((ownerId) => {
    const row = byOwner.get(ownerId);
    return { ownerId, profileImageUrl: row?.profile_image_url ?? null, name: row?.name ?? null, channelId: row?.channel_id ?? null };
  });
}

export async function loadChannelProfile(): Promise<ChannelProfile | null> {
  return loadChannelProfileByOwnerId(await getCurrentUserId());
}

export async function saveChannelProfile(profile: ChannelProfile, links: ChannelLink[]): Promise<ChannelProfile> {
  const ownerId = await getCurrentUserId();
  if (!ownerId) return profile;
  const nextLinks = links.slice(0, 5);
  let { data, error } = await supabase.from("channel_profiles").upsert({ id: ownerId, owner_id: ownerId, name: profile.name, channel_id: profile.channelId, intro: profile.intro, links: nextLinks, profile_image_url: profile.profileImageUrl ?? null, link_title: nextLinks[0]?.title ?? null, link_url: nextLinks[0]?.url ?? null, updated_at: new Date().toISOString() }).select("name,channel_id,intro,link_title,link_url,links,profile_image_url").single();
  if (error) {
    const fallback = await supabase.from("channel_profiles").upsert({ id: ownerId, owner_id: ownerId, name: profile.name, channel_id: profile.channelId, intro: profile.intro, link_title: nextLinks[0]?.title ?? null, link_url: nextLinks[0]?.url ?? null, updated_at: new Date().toISOString() }).select("name,channel_id,intro,link_title,link_url").single();
    data = fallback.data;
    error = fallback.error;
  }
  if (error) throw error;
  return { name: data.name, channelId: data.channel_id, intro: data.intro, links: nextLinks, profileImageUrl: data.profile_image_url ?? profile.profileImageUrl ?? null };
}

export async function uploadChannelProfileImage(file: File): Promise<string> {
  const ownerId = await getCurrentUserId();
  if (!ownerId) throw new Error("로그인이 필요합니다.");
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `profiles/${ownerId}/avatar-${Date.now()}.${extension}`;
  const { error } = await supabase.storage.from("shorttoon-posts").upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  const publicUrl = supabase.storage.from("shorttoon-posts").getPublicUrl(path).data.publicUrl;
  const { error: profileError } = await supabase.from("channel_profiles").update({ profile_image_url: publicUrl, updated_at: new Date().toISOString() }).eq("owner_id", ownerId);
  if (profileError) throw profileError;
  return publicUrl;
}
