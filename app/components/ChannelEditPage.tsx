"use client";

import { useEffect, useState } from "react";
import { uploadChannelProfileImage } from "../../lib/channel";

export type ChannelLink = { title: string; url: string };
export type ChannelProfile = { name: string; channelId: string; intro: string; links: ChannelLink[]; profileImageUrl?: string | null };
type ChannelEditPageProps = { onBack: () => void; onAddLink: () => void; onEditLink: (index: number) => void; links: ChannelLink[]; profile: ChannelProfile; onSave: (profile: ChannelProfile) => void | Promise<void>; onDraftChange?: (profile: ChannelProfile) => void; onProfileImageChange?: (file: File) => void | Promise<void> };

const limitIntroLines = (value: string) => value.split("\n").flatMap((line) => line.match(/.{1,52}/gu) ?? [""]).join("\n").slice(0, 150);

export function ChannelEditPage({ onBack, onAddLink, onEditLink, links, profile, onSave, onDraftChange, onProfileImageChange }: ChannelEditPageProps) {
  const [channelName, setChannelName] = useState(profile.name);
  const [channelId, setChannelId] = useState(profile.channelId);
  const [intro, setIntro] = useState(profile.intro);
  const [saving, setSaving] = useState(false);
  const [profileImagePreview, setProfileImagePreview] = useState(profile.profileImageUrl ?? null);
  useEffect(() => {
    setProfileImagePreview(profile.profileImageUrl ?? window.localStorage.getItem("shorttoon-profile-image"));
  }, [profile.profileImageUrl]);
  const handleProfileImageChange = async (file: File) => {
    const localUrl = URL.createObjectURL(file);
    setProfileImagePreview(localUrl);
    window.localStorage.setItem("shorttoon-profile-image", localUrl);
    window.dispatchEvent(new Event("shorttoon-profile-image"));
    try {
      const uploadedUrl = await uploadChannelProfileImage(file);
      setProfileImagePreview(uploadedUrl);
      window.localStorage.setItem("shorttoon-profile-image", uploadedUrl);
      window.dispatchEvent(new Event("shorttoon-profile-image"));
    } catch (error) {
      console.error("프로필 이미지 업로드 실패", error);
    }
  };
  const introCharacterCount = intro.replace(/\r?\n/g, "").length;
  const updateDraft = (next: Partial<ChannelProfile>) => {
    const draft = { name: next.name ?? channelName, channelId: next.channelId ?? channelId, intro: next.intro ?? intro, links: profile.links, profileImageUrl: profile.profileImageUrl };
    onDraftChange?.(draft);
  };

  return (
    <section className="channel-edit-page" aria-label="Edit channel">
      <div className="edit-section edit-profile-section">
        <h2>프로필 이미지</h2>
        <div className="edit-avatar-wrap"><div className="profile-avatar" aria-label="Profile image" role="img">{profileImagePreview ? <img src={profileImagePreview} alt="프로필 이미지" /> : <span />}</div><label className="profile-image-change-button">이미지 변경<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0]; event.currentTarget.value = ""; if (file) void handleProfileImageChange(file); }} /></label></div>
      </div>
      <div className="edit-form">
        <label>채널명<input value={channelName} onChange={(event) => { const value = event.target.value; setChannelName(value); updateDraft({ name: value }); }} maxLength={20} /><small>{channelName.length}/20</small></label>
        <label>채널 아이디<div className="channel-id-input"><span>@</span><input value={channelId} onChange={(event) => { const value = event.target.value.replace(/\s/g, ""); setChannelId(value); updateDraft({ channelId: value }); }} maxLength={30} /></div></label>
        <label>소개<textarea value={intro} onChange={(event) => { const value = limitIntroLines(event.target.value); setIntro(value); updateDraft({ intro: value }); }} maxLength={150} /><small>{introCharacterCount}/150</small></label>
      </div>
      <div className="edit-links"><button type="button" onClick={onAddLink} disabled={links.length >= 5}>링크 추가 <span aria-hidden="true">＋</span></button>{links.map((link, index) => <button className="existing-link" type="button" key={`${link.url}-${index}`} onClick={() => onEditLink(index)}><strong>{link.title}</strong><span>{link.url}</span></button>)}</div>
      <button className="save-channel-button" type="button" disabled={saving} onClick={async () => { setSaving(true); try { await onSave({ name: channelName.trim() || profile.name, channelId: channelId.trim() || profile.channelId, intro: intro.trim(), links, profileImageUrl: profile.profileImageUrl }); onBack(); } catch { window.alert("채널 정보 저장에 실패했습니다. Supabase의 channel_profiles 테이블과 정책을 확인해주세요."); } finally { setSaving(false); } }}>{saving ? "저장 중..." : "변경사항 저장"}</button>
    </section>
  );
}
