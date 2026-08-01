"use client";

import { useEffect, useState } from "react";
import { loadChannelProfileByOwnerId } from "../../lib/channel";
import { loadPostsFromSupabase } from "../../lib/posts";

type ChannelPageProps = { onBack: () => void; onEdit: () => void; isOwner?: boolean; isFollowing?: boolean; onFollow?: () => void };
type ChannelProfile = { name: string; channelId: string; intro: string; profileImageUrl?: string | null };

type ChannelPost = { title: string; coverUrl: string; imageUrls: string[]; genre: string; isTest?: boolean };

export function ChannelPage({ onBack, onEdit, onOpenIntro, posts, onOpenPost, profile, isOwner = true, isFollowing = false, onFollow }: ChannelPageProps & { posts: ChannelPost[]; onOpenIntro: () => void; onOpenPost: (post: ChannelPost, index: number, scrollTop: number) => void; profile: ChannelProfile }) {
  const [activeAction, setActiveAction] = useState<"analytics" | "edit" | null>(null);
  const [viewProfile, setViewProfile] = useState(profile);
  const [viewPosts, setViewPosts] = useState(posts);
  const [viewIsOwner, setViewIsOwner] = useState(isOwner);
  const [viewFollowing, setViewFollowing] = useState(isFollowing);
  const [storedProfileImageUrl, setStoredProfileImageUrl] = useState(profile.profileImageUrl ?? null);
  useEffect(() => {
    const sync = () => setStoredProfileImageUrl(isOwner ? window.localStorage.getItem("shorttoon-profile-image") : (profile.profileImageUrl ?? null));
    sync();
    window.addEventListener("shorttoon-profile-image", sync);
    return () => window.removeEventListener("shorttoon-profile-image", sync);
  }, [isOwner, profile.profileImageUrl]);
  useEffect(() => {
    const ownerId = window.sessionStorage.getItem("shorttoon-viewed-channel-owner");
    if (!ownerId) { setViewProfile(profile); setViewPosts(posts); setViewIsOwner(true); setStoredProfileImageUrl(profile.profileImageUrl ?? null); return; }
    let cancelled = false;
    setViewIsOwner(false);
    try {
      const ids = JSON.parse(window.localStorage.getItem("shorttoon-followed-channels") ?? "[]");
      setViewFollowing(Array.isArray(ids) && ids.includes(ownerId));
    } catch { setViewFollowing(false); }
    if (ownerId === "anonymous-external") { setViewProfile({ name: "채널명", channelId: "채널 아이디", intro: "", links: [], profileImageUrl: null }); setViewPosts([]); setStoredProfileImageUrl(null); return () => { cancelled = true; }; }
    void Promise.all([loadChannelProfileByOwnerId(ownerId), loadPostsFromSupabase(ownerId)]).then(([nextProfile, nextPosts]) => {
      if (cancelled) return;
      if (nextProfile) { setViewProfile(nextProfile); setStoredProfileImageUrl(nextProfile.profileImageUrl ?? null); }
      setViewPosts(nextPosts);
    }).catch((error) => console.error("남의 채널 불러오기 실패", error));
    return () => { cancelled = true; };
  }, [profile, posts, isOwner]);
  const firstIntroLine = viewProfile.intro.split(/\r?\n/)[0] ?? "";
  const introHasOverflow = viewProfile.intro.length > firstIntroLine.length;
  const displayedIntro = introHasOverflow ? `${firstIntroLine.trimEnd()}…` : firstIntroLine;

  return (
    <section className="channel-page" aria-label="My channel">
      <button className="channel-back" type="button" onClick={() => window.dispatchEvent(new Event("shorttoon-channel-back"))} aria-label="Back to my page">←</button>
      <div className="channel-profile">
        <div className="profile-avatar" aria-label="Profile image" role="img">{storedProfileImageUrl ? <img src={storedProfileImageUrl} alt="프로필 이미지" /> : <span />}</div>
        <div className="channel-identity">
          <h1>{viewProfile.name}</h1>
          <span className="channel-id">@{viewProfile.channelId}</span>
          <span>팔로워 0명</span>
        </div>
      </div>
      <button className="channel-intro" type="button" onClick={onOpenIntro} aria-label="소개 전체 보기">
        <p title={viewProfile.intro}>{displayedIntro}</p>
      </button>
      <div className="channel-actions">
        {viewIsOwner ? <><button className={activeAction === "analytics" ? "is-active" : ""} type="button" onClick={() => setActiveAction("analytics")} aria-pressed={activeAction === "analytics"}>분석</button><button className={activeAction === "edit" ? "is-active" : ""} type="button" onClick={() => { setActiveAction("edit"); onEdit(); }} aria-pressed={activeAction === "edit"}>채널 수정</button></> : <button className={`channel-follow-button ${viewFollowing ? "is-following" : ""}`} type="button" onClick={() => { const ownerId = window.sessionStorage.getItem("shorttoon-viewed-channel-owner"); if (!ownerId) return; const next = !viewFollowing; setViewFollowing(next); const ids = (() => { try { const value = JSON.parse(window.localStorage.getItem("shorttoon-followed-channels") ?? "[]"); return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; } catch { return []; } })(); const nextIds = next ? Array.from(new Set([...ids, ownerId])) : ids.filter((id) => id !== ownerId); window.localStorage.setItem("shorttoon-followed-channels", JSON.stringify(nextIds)); }} aria-pressed={viewFollowing}>{viewFollowing ? "팔로잉" : "팔로우"}</button>}
      </div>
      <div className="channel-tabs" role="tablist" aria-label="Channel content">
        <button className="is-active" type="button" role="tab" aria-selected="true">숏툰 <span>{viewPosts.length}</span></button>
        <button type="button" role="tab" aria-selected="false">작품 목록</button>
      </div>
      <div className="channel-thumbnail-grid" aria-label="숏툰 썸네일 목록">
        {viewPosts.map((post, index) => <button className={`channel-thumbnail-tile has-post ${post.isTest ? "is-test" : ""}`} data-post-index={index} key={`${post.title}-${post.coverUrl}-${index}`} type="button" onClick={(event) => { window.localStorage.setItem("shorttoon-post-return", "channel"); onOpenPost(post, index, event.currentTarget.closest<HTMLElement>(".channel-page")?.scrollTop ?? 0); }} aria-label={`${post.title} 게시물 보기`}>{post.isTest ? <strong>TEST</strong> : <img src={post.coverUrl} alt="" />}<span>{post.title}</span></button>)}
      </div>
    </section>
  );
}
