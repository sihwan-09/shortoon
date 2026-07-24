import { supabase } from "./supabase";
import type { ChannelLink, ChannelProfile } from "../app/components/ChannelEditPage";

const PROFILE_ID = "default";

export async function loadChannelProfile(): Promise<ChannelProfile | null> {
  const { data, error } = await supabase.from("channel_profiles").select("name,channel_id,intro,link_title,link_url").eq("id", PROFILE_ID).maybeSingle();
  if (error) throw error;
  return data ? { name: data.name, channelId: data.channel_id, intro: data.intro, link: data.link_title && data.link_url ? { title: data.link_title, url: data.link_url } : null } : null;
}

export async function saveChannelProfile(profile: ChannelProfile, link: ChannelLink | null): Promise<ChannelProfile> {
  const { data, error } = await supabase.from("channel_profiles").upsert({ id: PROFILE_ID, name: profile.name, channel_id: profile.channelId, intro: profile.intro, link_title: link?.title ?? null, link_url: link?.url ?? null, updated_at: new Date().toISOString() }).select("name,channel_id,intro,link_title,link_url").single();
  if (error) throw error;
  return { name: data.name, channelId: data.channel_id, intro: data.intro, link: data.link_title && data.link_url ? { title: data.link_title, url: data.link_url } : null };
}
