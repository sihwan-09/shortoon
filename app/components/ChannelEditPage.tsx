"use client";

import { useState } from "react";

type ChannelLink = { title: string; url: string };
export type ChannelProfile = { name: string; channelId: string; intro: string };
type ChannelEditPageProps = { onBack: () => void; onAddLink: () => void; onEditLink: () => void; link: ChannelLink | null; profile: ChannelProfile; onSave: (profile: ChannelProfile) => void };

export function ChannelEditPage({ onBack, onAddLink, onEditLink, link, profile, onSave }: ChannelEditPageProps) {
  const [channelName, setChannelName] = useState(profile.name);
  const [channelId, setChannelId] = useState(profile.channelId);
  const [intro, setIntro] = useState(profile.intro);

  return (
    <section className="channel-edit-page" aria-label="Edit channel">
      <div className="edit-section edit-profile-section">
        <h2>프로필 이미지</h2>
        <div className="edit-avatar-wrap"><div className="profile-avatar" aria-label="Profile image" role="img"><span /></div><button type="button">이미지 변경</button></div>
      </div>
      <div className="edit-form">
        <label>채널명<input value={channelName} onChange={(event) => setChannelName(event.target.value)} maxLength={20} /><small>{channelName.length}/20</small></label>
        <label>채널 아이디<div className="channel-id-input"><span>@</span><input value={channelId} onChange={(event) => setChannelId(event.target.value.replace(/\s/g, ""))} maxLength={30} /></div></label>
        <label>소개<textarea value={intro} onChange={(event) => setIntro(event.target.value)} maxLength={150} /><small>{intro.length}/150</small></label>
      </div>
      <div className="edit-links"><button type="button" onClick={onAddLink}>링크 추가 <span aria-hidden="true">＋</span></button>{link && <button className="existing-link" type="button" onClick={onEditLink}><strong>{link.title}</strong><span>{link.url}</span></button>}</div>
      <button className="save-channel-button" type="button" onClick={() => { onSave({ name: channelName.trim() || profile.name, channelId: channelId.trim() || profile.channelId, intro: intro.trim() }); onBack(); }}>변경사항 저장</button>
    </section>
  );
}
