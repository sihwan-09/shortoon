"use client";

import { useState } from "react";

type ChannelPageProps = { onBack: () => void; onEdit: () => void };

type ChannelPost = { title: string; coverUrl: string };

export function ChannelPage({ onBack, onEdit, posts }: ChannelPageProps & { posts: ChannelPost[] }) {
  const [activeAction, setActiveAction] = useState<"analytics" | "edit" | null>(null);

  return (
    <section className="channel-page" aria-label="My channel">
      <button className="channel-back" type="button" onClick={onBack} aria-label="Back to my page">←</button>
      <div className="channel-profile">
        <div className="profile-avatar" aria-label="Profile image" role="img"><span /></div>
        <div className="channel-identity">
          <h1>시화 작가</h1>
          <span>구독자 0명</span>
        </div>
      </div>
      <div className="channel-intro">
        <p>숏툰으로 전하는 짧고 강한 이야기</p>
      </div>
      <div className="channel-actions">
        <button className={activeAction === "analytics" ? "is-active" : ""} type="button" onClick={() => setActiveAction("analytics")} aria-pressed={activeAction === "analytics"}>분석</button>
        <button className={activeAction === "edit" ? "is-active" : ""} type="button" onClick={() => { setActiveAction("edit"); onEdit(); }} aria-pressed={activeAction === "edit"}>채널 수정</button>
      </div>
      <div className="channel-tabs" role="tablist" aria-label="Channel content">
        <button className="is-active" type="button" role="tab" aria-selected="true">숏툰 <span>0</span></button>
        <button type="button" role="tab" aria-selected="false">작품 목록</button>
      </div>
      <div className="channel-thumbnail-grid" aria-label="숏툰 썸네일 목록">
        {Array.from({ length: 9 }, (_, index) => {
          const post = posts[index];
          return <div className={`channel-thumbnail-tile ${post ? "has-post" : ""}`} key={index}>{post && <><img src={post.coverUrl} alt="" /><span>{post.title}</span></>}</div>;
        })}
      </div>
    </section>
  );
}
