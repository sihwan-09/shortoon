"use client";

import { useState } from "react";

type ChannelEditPageProps = { onBack: () => void };

export function ChannelEditPage({ onBack }: ChannelEditPageProps) {
  const [channelName, setChannelName] = useState("시화 작가");
  const [intro, setIntro] = useState("숏툰으로 전하는 짧고 강한 이야기");

  return (
    <section className="channel-edit-page" aria-label="Edit channel">
      <div className="edit-section edit-profile-section">
        <h2>프로필 이미지</h2>
        <div className="edit-avatar-wrap"><div className="profile-avatar" aria-label="Profile image" role="img"><span /></div><button type="button">이미지 변경</button></div>
      </div>
      <div className="edit-form">
        <label>채널명<input value={channelName} onChange={(event) => setChannelName(event.target.value)} maxLength={20} /><small>{channelName.length}/20</small></label>
        <label>채널 아이디<div className="channel-id-input"><span>@</span><input defaultValue="shorttoon_creator" maxLength={30} /></div></label>
        <label>소개<textarea value={intro} onChange={(event) => setIntro(event.target.value)} maxLength={150} /><small>{intro.length}/150</small></label>
      </div>
      <div className="edit-links"><button type="button">링크 추가 <span aria-hidden="true">＋</span></button></div>
      <button className="save-channel-button" type="button" onClick={onBack}>변경사항 저장</button>
    </section>
  );
}
