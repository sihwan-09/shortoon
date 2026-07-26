import { supabase } from "./supabase";
import type { ChannelLink, ChannelProfile } from "../app/components/ChannelEditPage";

const PROFILE_ID = "default";

export async function loadChannelProfile(): Promise<ChannelProfile | null> {
  let { data, error } = await supabase.from("channel_profiles").select("name,channel_id,intro,link_title,link_url,links").eq("id", PROFILE_ID).maybeSingle();
  if (error) {
    const fallback = await supabase.from("channel_profiles").select("name,channel_id,intro,link_title,link_url").eq("id", PROFILE_ID).maybeSingle();
    data = fallback.data;
    error = fallback.error;
  }
  if (error) throw error;
  const links = Array.isArray(data?.links) ? data.links.filter((link: unknown): link is ChannelLink => Boolean(link && typeof link === "object" && "title" in link && "url" in link)).slice(0, 5) : data?.link_title && data?.link_url ? [{ title: data.link_title, url: data.link_url }] : [];
  return data ? { name: data.name, channelId: data.channel_id, intro: data.intro, links } : null;
}

export async function saveChannelProfile(profile: ChannelProfile, links: ChannelLink[]): Promise<ChannelProfile> {
  const nextLinks = links.slice(0, 5);
  let { data, error } = await supabase.from("channel_profiles").upsert({ id: PROFILE_ID, name: profile.name, channel_id: profile.channelId, intro: profile.intro, links: nextLinks, link_title: nextLinks[0]?.title ?? null, link_url: nextLinks[0]?.url ?? null, updated_at: new Date().toISOString() }).select("name,channel_id,intro,link_title,link_url,links").single();
  if (error) {
    const fallback = await supabase.from("channel_profiles").upsert({ id: PROFILE_ID, name: profile.name, channel_id: profile.channelId, intro: profile.intro, link_title: nextLinks[0]?.title ?? null, link_url: nextLinks[0]?.url ?? null, updated_at: new Date().toISOString() }).select("name,channel_id,intro,link_title,link_url").single();
    data = fallback.data;
    error = fallback.error;
  }
  if (error) throw error;
  return { name: data.name, channelId: data.channel_id, intro: data.intro, links: nextLinks };
}
