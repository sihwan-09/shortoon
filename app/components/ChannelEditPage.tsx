"use client";

import { useState } from "react";

export type ChannelLink = { title: string; url: string };
export type ChannelProfile = { name: string; channelId: string; intro: string; link?: ChannelLink | null };
type ChannelEditPageProps = { onBack: () => void; onAddLink: () => void; onEditLink: () => void; link: ChannelLink | null; profile: ChannelProfile; onSave: (profile: ChannelProfile) => void | Promise<void>; onDraftChange?: (profile: ChannelProfile) => void };

const limitIntroLines = (value: string) => value.split("\n").flatMap((line) => line.match(/.{1,52}/gu) ?? [""]).join("\n").slice(0, 150);

export function ChannelEditPage({ onBack, onAddLink, onEditLink, link, profile, onSave, onDraftChange }: ChannelEditPageProps) {
  const [channelName, setChannelName] = useState(profile.name);
  const [channelId, setChannelId] = useState(profile.channelId);
  const [intro, setIntro] = useState(profile.intro);
  const [saving, setSaving] = useState(false);
  const introCharacterCount = intro.replace(/\r?\n/g, "").length;
  const updateDraft = (next: Partial<ChannelProfile>) => {
    const draft = { name: next.name ?? channelName, channelId: next.channelId ?? channelId, intro: next.intro ?? intro };
    onDraftChange?.(draft);
  };

  return (
    <section className="channel-edit-page" aria-label="Edit channel">
      <div className="edit-section edit-profile-section">
        <h2>프로필 이미지</h2>
        <div className="edit-avatar-wrap"><div className="profile-avatar" aria-label="Profile image" role="img"><span /></div><button type="button">이미지 변경</button></div>
      </div>
      <div className="edit-form">
        <label>채널명<input value={channelName} onChange={(event) => { const value = event.target.value; setChannelName(value); updateDraft({ name: value }); }} maxLength={20} /><small>{channelName.length}/20</small></label>
        <label>채널 아이디<div className="channel-id-input"><span>@</span><input value={channelId} onChange={(event) => { const value = event.target.value.replace(/\s/g, ""); setChannelId(value); updateDraft({ channelId: value }); }} maxLength={30} /></div></label>
        <label>소개<textarea value={intro} onChange={(event) => { const value = limitIntroLines(event.target.value); setIntro(value); updateDraft({ intro: value }); }} maxLength={150} /><small>{introCharacterCount}/150</small></label>
      </div>
      <div className="edit-links"><button type="button" onClick={onAddLink}>링크 추가 <span aria-hidden="true">＋</span></button>{link && <button className="existing-link" type="button" onClick={onEditLink}><strong>{link.title}</strong><span>{link.url}</span></button>}</div>
      <button className="save-channel-button" type="button" disabled={saving} onClick={async () => { setSaving(true); try { await onSave({ name: channelName.trim() || profile.name, channelId: channelId.trim() || profile.channelId, intro: intro.trim() }); onBack(); } catch { window.alert("채널 정보 저장에 실패했습니다. Supabase의 channel_profiles 테이블과 정책을 확인해주세요."); } finally { setSaving(false); } }}>{saving ? "저장 중..." : "변경사항 저장"}</button>
    </section>
  );
}
