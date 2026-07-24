import { supabase } from "./supabase";
import type { ChannelProfile } from "../app/components/ChannelEditPage";

const PROFILE_ID = "default";

export async function loadChannelProfile(): Promise<ChannelProfile | null> {
  const { data, error } = await supabase.from("channel_profiles").select("name,channel_id,intro").eq("id", PROFILE_ID).maybeSingle();
  if (error) throw error;
  return data ? { name: data.name, channelId: data.channel_id, intro: data.intro } : null;
}

export async function saveChannelProfile(profile: ChannelProfile): Promise<ChannelProfile> {
  const { data, error } = await supabase.from("channel_profiles").upsert({ id: PROFILE_ID, name: profile.name, channel_id: profile.channelId, intro: profile.intro, updated_at: new Date().toISOString() }).select("name,channel_id,intro").single();
  if (error) throw error;
  return { name: data.name, channelId: data.channel_id, intro: data.intro };
}
