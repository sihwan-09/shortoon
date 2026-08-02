"use client";

import { useEffect, useRef, useState } from "react";
import { loadChannelProfileByOwnerId } from "../../lib/channel";
import { loadPostsFromSupabase } from "../../lib/posts";
import { loadFollowedChannelIds, loadFollowerCount, setFollowedChannel } from "../../lib/follows";
import { ViewCountBadge } from "./ViewCountBadge";

type ChannelPageProps = { onBack: () => void; onEdit: () => void; isOwner?: boolean; isFollowing?: boolean; onFollow?: () => void; channelOwnerId?: string | null };
type ChannelProfile = { name: string; channelId: string; intro: string; profileImageUrl?: string | null };

type ChannelPost = { id?: string; title: string; coverUrl: string; imageUrls: string[]; genre: string; viewCount?: number; isTest?: boolean };

export function ChannelPage({ onBack, onEdit, onOpenIntro, posts, onOpenPost, profile, isOwner = true, isFollowing = false, onFollow, channelOwnerId }: ChannelPageProps & { posts: ChannelPost[]; onOpenIntro: () => void; onOpenPost: (post: ChannelPost, index: number, scrollTop: number) => void; profile: ChannelProfile }) {
  const [activeAction, setActiveAction] = useState<"analytics" | "edit" | null>(null);
  const [viewProfile, setViewProfile] = useState(profile);
  const [viewPosts, setViewPosts] = useState(posts);
  const [viewIsOwner, setViewIsOwner] = useState(isOwner);
  const [viewFollowing, setViewFollowing] = useState(isFollowing);
  const [storedProfileImageUrl, setStoredProfileImageUrl] = useState(profile.profileImageUrl ?? null);
  const [followerCount, setFollowerCount] = useState(0);
  const [visiblePostCount, setVisiblePostCount] = useState(30);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => setVisiblePostCount(30), [viewPosts]);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) setVisiblePostCount((count) => Math.min(viewPosts.length, count + 30)); }, { rootMargin: "600px" });
    const grid = document.querySelector<HTMLElement>(".channel-page .channel-thumbnail-grid");
    const target = grid?.querySelector<HTMLElement>(`[data-post-index="${Math.max(0, Math.min(viewPosts.length - 1, visiblePostCount - 1))}"]`);
    if (target) observer.observe(target);
    return () => observer.disconnect();
  }, [viewPosts.length, visiblePostCount]);
  useEffect(() => {
    document.querySelectorAll<HTMLElement>(".channel-page .channel-thumbnail-grid .channel-thumbnail-tile").forEach((tile, index) => { tile.style.display = index < visiblePostCount ? "" : "none"; });
  }, [viewPosts, visiblePostCount]);
  useEffect(() => { let cancelled = false; const ownerId = channelOwnerId ?? window.sessionStorage.getItem("shorttoon-viewed-channel-owner"); if (!ownerId || viewIsOwner) { setViewFollowing(false); return; } void loadFollowedChannelIds().then((ids) => { if (!cancelled) setViewFollowing(ids.includes(ownerId)); }).catch((error) => console.error("팔로우 상태 조회 실패", error)); return () => { cancelled = true; }; }, [channelOwnerId, viewIsOwner]);
  useEffect(() => { let cancelled = false; const ownerId = channelOwnerId ?? window.sessionStorage.getItem("shorttoon-viewed-channel-owner"); void loadFollowerCount(ownerId).then((count) => { if (!cancelled) setFollowerCount(count); }).catch((error) => console.error("팔로워 수 조회 실패", error)); return () => { cancelled = true; }; }, [channelOwnerId, isOwner, profile.channelId]);
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

  const requireLogin = (action: () => void) => { void supabase.auth.getSession().then(({ data }) => { if (data.session) action(); else window.dispatchEvent(new Event("shorttoon-login-required")); }).catch(() => window.dispatchEvent(new Event("shorttoon-login-required"))); };
  return (
    <section className="channel-page" aria-label="My channel">
      <button className="channel-back" type="button" onClick={() => window.dispatchEvent(new Event("shorttoon-channel-back"))} aria-label="Back to my page">←</button>
      <div className="channel-profile">
        <div className="profile-avatar" aria-label="Profile image" role="img">{storedProfileImageUrl ? <img src={storedProfileImageUrl} alt="프로필 이미지" /> : <span />}</div>
        <div className="channel-identity">
          <h1>{viewProfile.name}</h1>
          <span className="channel-id">@{viewProfile.channelId}</span>
          <span>팔로워 {followerCount}명</span>
        </div>
      </div>
      <button className="channel-intro" type="button" onClick={onOpenIntro} aria-label="소개 전체 보기">
        <p title={viewProfile.intro}>{displayedIntro}</p>
      </button>
      <div className="channel-actions" onClickCapture={(event) => { if (!viewIsOwner) return; if (document.querySelector(".header-login-floating")) { event.preventDefault(); event.stopPropagation(); window.dispatchEvent(new Event("shorttoon-login-required")); } }}>
        {viewIsOwner ? <><button className={activeAction === "analytics" ? "is-active" : ""} type="button" onClick={() => setActiveAction("analytics")} aria-pressed={activeAction === "analytics"}>분석</button><button className={activeAction === "edit" ? "is-active" : ""} type="button" onClick={() => { setActiveAction("edit"); onEdit(); }} aria-pressed={activeAction === "edit"}>채널 수정</button></> : <button className={`channel-follow-button ${viewFollowing ? "is-following" : ""}`} type="button" onClick={async () => { const ownerId = window.sessionStorage.getItem("shorttoon-viewed-channel-owner"); if (!ownerId) return; const next = !viewFollowing; setViewFollowing(next); try { await setFollowedChannel(ownerId, next); setFollowerCount((count) => Math.max(0, count + (next ? 1 : -1))); window.dispatchEvent(new Event("shorttoon-followed-channels")); } catch (error) { console.error("팔로우 변경 실패", error); setViewFollowing(!next); } }} aria-pressed={viewFollowing}>{viewFollowing ? "팔로잉" : "팔로우"}</button>}
      </div>
      <div className="channel-tabs" role="tablist" aria-label="Channel content">
        <button className="is-active" type="button" role="tab" aria-selected="true">숏툰 <span>{viewPosts.length}</span></button>
        <button type="button" role="tab" aria-selected="false">작품 목록</button>
      </div>
      <div className="channel-thumbnail-grid" aria-label="숏툰 썸네일 목록">
        {viewPosts.map((post, index) => <button className={`channel-thumbnail-tile has-post ${post.isTest ? "is-test" : ""}`} data-post-index={index} key={`${post.title}-${post.coverUrl}-${index}`} type="button" onClick={(event) => { window.localStorage.setItem("shorttoon-post-return", "channel"); onOpenPost(post, index, event.currentTarget.closest<HTMLElement>(".channel-page")?.scrollTop ?? 0); }} aria-label={`${post.title} 게시물 보기`}>{post.isTest ? <strong>TEST</strong> : <img src={post.coverUrl} alt="" />}<ViewCountBadge postId={post.id} fallback={post.viewCount} /><span>{post.title}</span></button>)}
      </div>
    </section>
  );
}
