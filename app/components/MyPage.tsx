"use client";

import { useEffect, useState } from "react";
import { loadUserLikedPostIds } from "../../lib/likes";
import { loadChannelProfilesByOwnerIds, type FollowedChannelProfile } from "../../lib/channel";

type MyPageProps = {
  onOpenChannel: () => void;
  channelName: string;
  channelId: string;
  profileImageUrl?: string | null;
  onLogout: () => Promise<void>;
};

export function MyPage({ onOpenChannel, channelName, channelId, profileImageUrl, onLogout }: MyPageProps) {
  const [storedProfileImageUrl, setStoredProfileImageUrl] = useState(profileImageUrl ?? null);
  const [likedCount, setLikedCount] = useState(0);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [followingPage, setFollowingPage] = useState(0);
  const [followingAuthors, setFollowingAuthors] = useState<FollowedChannelProfile[]>([]);
  useEffect(() => {
    let cancelled = false;
    const sync = async () => {
      try {
        const value = JSON.parse(window.localStorage.getItem("shorttoon-followed-channels") ?? "[]");
        const ids = Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
        const profiles = await loadChannelProfilesByOwnerIds(ids);
        if (!cancelled) setFollowingAuthors(profiles);
      } catch (error) {
        console.error("팔로우한 작가 프로필 조회 실패", error);
        if (!cancelled) setFollowingAuthors([]);
      }
    };
    void sync();
    window.addEventListener("shorttoon-followed-channels", sync);
    return () => { cancelled = true; window.removeEventListener("shorttoon-followed-channels", sync); };
  }, []);
  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(followingAuthors.length / 6) - 1);
    setFollowingPage((page) => Math.min(page, maxPage));
  }, [followingAuthors.length]);
  useEffect(() => {
    const sync = () => setStoredProfileImageUrl(window.localStorage.getItem("shorttoon-profile-image"));
    sync();
    window.addEventListener("shorttoon-profile-image", sync);
    return () => window.removeEventListener("shorttoon-profile-image", sync);
  }, [profileImageUrl]);
  useEffect(() => {
    let cancelled = false;
    const sync = async () => {
      const ids = await loadUserLikedPostIds();
      if (!cancelled) setLikedCount(ids.length);
    };
    void sync();
    window.addEventListener("shorttoon-liked-posts", sync);
    return () => { cancelled = true; window.removeEventListener("shorttoon-liked-posts", sync); };
  }, []);
  return <section className="my-page" aria-label="MY 페이지">
    <button className="my-profile" type="button" onClick={() => { window.sessionStorage.removeItem("shorttoon-viewed-channel-owner"); window.sessionStorage.setItem("shorttoon-open-channel-top", "1"); onOpenChannel(); }} aria-label="내 채널 보기">
      <div className="profile-avatar" aria-label="프로필 이미지" role="img">{storedProfileImageUrl ? <img src={storedProfileImageUrl} alt="프로필" /> : <span />}</div>
      <h1>{channelName}</h1><span className="my-profile-channel-id">@{channelId}</span>
    </button>
    <section className="my-following" aria-label="팔로우한 작가">
      <h2>팔로우한 작가</h2>
      <div className="my-following-list">
        <button className="my-following-arrow" type="button" aria-label="이전 팔로우 작가" onClick={() => setFollowingPage((page) => Math.max(0, page - 1))} disabled={followingPage === 0}>&lt;</button>
        <div className="my-following-avatars">
          {Array.from({ length: 6 }, (_, index) => {
            const author = followingAuthors[followingPage * 6 + index];
            return <span className="post-author-avatar my-following-avatar" key={author?.ownerId ?? `${followingPage}-${index}`} aria-label={author?.name ?? author?.channelId ?? "팔로우한 작가"} role="img" style={author?.profileImageUrl ? { backgroundImage: `url("${author.profileImageUrl}")` } : undefined} />;
          })}
        </div>
        <button className="my-following-arrow" type="button" aria-label="다음 팔로우 작가" onClick={() => setFollowingPage((page) => page + 1)}>&gt;</button>
      </div>
    </section>
    <div className="my-stats" aria-label="숏툰 활동">
      <button type="button" className="my-stat-row" onClick={() => window.dispatchEvent(new Event("open-liked-posts"))}><span>좋아요 표시한 작품</span><strong>{likedCount}<span>/1000</span></strong></button>
      <button type="button" className="my-stat-row"><span>저장한 숏툰</span><strong>36<span>/1000</span></strong></button>
    </div>
    <div className="my-links"><button type="button">이용약관</button><button type="button">개인정보 처리방침</button><button type="button" className="logout-button" onClick={() => setShowLogoutConfirm(true)}>로그아웃</button></div>
    {showLogoutConfirm && <div className="logout-modal-backdrop" role="presentation" onClick={() => !isLoggingOut && setShowLogoutConfirm(false)}>
      <section className="logout-modal" role="dialog" aria-modal="true" aria-labelledby="logout-modal-title" onClick={(event) => event.stopPropagation()}>
        <h2 id="logout-modal-title">로그아웃하시겠습니까?</h2>
        <div className="logout-modal-actions">
          <button type="button" className="logout-cancel" disabled={isLoggingOut} onClick={() => setShowLogoutConfirm(false)}>취소</button>
          <button type="button" className="logout-confirm" disabled={isLoggingOut} onClick={async () => { setIsLoggingOut(true); try { await onLogout(); } finally { setIsLoggingOut(false); setShowLogoutConfirm(false); } }}>로그아웃</button>
        </div>
      </section>
    </div>}
  </section>;
}
