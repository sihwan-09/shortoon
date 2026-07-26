"use client";

import { useEffect, useState } from "react";

type ChannelPageProps = { onBack: () => void; onEdit: () => void };
type ChannelProfile = { name: string; channelId: string; intro: string; profileImageUrl?: string | null };

type ChannelPost = { title: string; coverUrl: string; imageUrls: string[]; genre: string; isTest?: boolean };

export function ChannelPage({ onBack, onEdit, onOpenIntro, posts, onOpenPost, profile }: ChannelPageProps & { posts: ChannelPost[]; onOpenIntro: () => void; onOpenPost: (post: ChannelPost, index: number, scrollTop: number) => void; profile: ChannelProfile }) {
  const [activeAction, setActiveAction] = useState<"analytics" | "edit" | null>(null);
  const [storedProfileImageUrl, setStoredProfileImageUrl] = useState(profile.profileImageUrl ?? null);
  useEffect(() => {
    const sync = () => setStoredProfileImageUrl(window.localStorage.getItem("shorttoon-profile-image"));
    sync();
    window.addEventListener("shorttoon-profile-image", sync);
    return () => window.removeEventListener("shorttoon-profile-image", sync);
  }, [profile.profileImageUrl]);
  const firstIntroLine = profile.intro.split(/\r?\n/)[0] ?? "";
  const introHasOverflow = profile.intro.length > firstIntroLine.length;
  const displayedIntro = introHasOverflow ? `${firstIntroLine.trimEnd()}…` : firstIntroLine;

  return (
    <section className="channel-page" aria-label="My channel">
      <button className="channel-back" type="button" onClick={onBack} aria-label="Back to my page">←</button>
      <div className="channel-profile">
        <div className="profile-avatar" aria-label="Profile image" role="img">{storedProfileImageUrl ? <img src={storedProfileImageUrl} alt="프로필 이미지" /> : <span />}</div>
        <div className="channel-identity">
          <h1>{profile.name}</h1>
          <span className="channel-id">@{profile.channelId}</span>
          <span>구독자 0명</span>
        </div>
      </div>
      <button className="channel-intro" type="button" onClick={onOpenIntro} aria-label="소개 전체 보기">
        <p title={profile.intro}>{displayedIntro}</p>
      </button>
      <div className="channel-actions">
        <button className={activeAction === "analytics" ? "is-active" : ""} type="button" onClick={() => setActiveAction("analytics")} aria-pressed={activeAction === "analytics"}>분석</button>
        <button className={activeAction === "edit" ? "is-active" : ""} type="button" onClick={() => { setActiveAction("edit"); onEdit(); }} aria-pressed={activeAction === "edit"}>채널 수정</button>
      </div>
      <div className="channel-tabs" role="tablist" aria-label="Channel content">
        <button className="is-active" type="button" role="tab" aria-selected="true">숏툰 <span>{posts.length}</span></button>
        <button type="button" role="tab" aria-selected="false">작품 목록</button>
      </div>
      <div className="channel-thumbnail-grid" aria-label="숏툰 썸네일 목록">
        {posts.map((post, index) => <button className={`channel-thumbnail-tile has-post ${post.isTest ? "is-test" : ""}`} data-post-index={index} key={`${post.title}-${post.coverUrl}-${index}`} type="button" onClick={(event) => onOpenPost(post, index, event.currentTarget.closest<HTMLElement>(".channel-page")?.scrollTop ?? 0)} aria-label={`${post.title} 게시물 보기`}>{post.isTest ? <strong>TEST</strong> : <img src={post.coverUrl} alt="" />}<span>{post.title}</span></button>)}
      </div>
    </section>
  );
}
