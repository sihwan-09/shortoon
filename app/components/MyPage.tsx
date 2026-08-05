"use client";

import { useEffect, useState } from "react";
import { loadUserLikedPostIds } from "../../lib/likes";
import { loadChannelProfilesByOwnerIds, type FollowedChannelProfile } from "../../lib/channel";
import { loadFollowedChannelIds } from "../../lib/follows";

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
        let ids: string[];
        try {
          ids = await loadFollowedChannelIds();
        } catch (error) {
          console.error("팔로우 기록 조회 실패", error);
          const value = JSON.parse(window.localStorage.getItem("shorttoon-followed-channels") ?? "[]");
          ids = Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && !/^T\d+$/.test(item)) : [];
        }
        window.localStorage.setItem("shorttoon-followed-channels", JSON.stringify(ids));
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
    const bugReportButton = document.querySelector<HTMLButtonElement>(".my-links > button:first-child");
    const ideaButton = document.querySelector<HTMLButtonElement>(".my-links > button:nth-child(2)");
    const termsButton = document.querySelector<HTMLButtonElement>(".my-links-section-start");
    const bugReportUrl = "https://docs.google.com/forms/d/e/1FAIpQLSdfbnLEV-MuGF6qEoxbD90kQLmbEhSbfPcKI-3FaZ3mf72wqg/viewform?usp=dialog";
    const ideaUrl = "https://docs.google.com/forms/d/e/1FAIpQLSdUttrfaJqL3ThshpKTl6NU-Iw4hraVvYGeLCJE9mambn-6bw/viewform?usp=publish-editor";
    const openBugReport = () => { window.location.href = bugReportUrl; };
    const openIdeaForm = () => { window.location.href = ideaUrl; };
    const openTerms = () => { window.dispatchEvent(new Event("shorttoon-open-terms")); };
    bugReportButton?.addEventListener("click", openBugReport);
    ideaButton?.addEventListener("click", openIdeaForm);
    termsButton?.addEventListener("click", openTerms);
    return () => {
      cancelled = true;
      window.removeEventListener("shorttoon-liked-posts", sync);
      bugReportButton?.removeEventListener("click", openBugReport);
      ideaButton?.removeEventListener("click", openIdeaForm);
      termsButton?.removeEventListener("click", openTerms);
    };
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
            const avatar = <span className={`post-author-avatar my-following-avatar${author?.profileImageUrl ? "" : " is-empty"}`} aria-label={author?.name ?? author?.channelId ?? "팔로우한 작가"} role="img" style={author?.profileImageUrl ? { backgroundImage: `url("${author.profileImageUrl}")` } : undefined} />;
            return author ? <button className="my-following-avatar-button" type="button" key={author.ownerId} onClick={() => window.dispatchEvent(new CustomEvent("shorttoon-open-channel", { detail: { authorId: author.ownerId } }))} aria-label={`${author.name ?? author.channelId ?? "팔로우한 작가"} 채널 보기`}>{avatar}</button> : <span className="my-following-avatar-placeholder" key={`${followingPage}-${index}`} aria-hidden="true" />;
          })}
        </div>
        <button className="my-following-arrow" type="button" aria-label="다음 팔로우 작가" onClick={() => setFollowingPage((page) => Math.min(page + 1, Math.max(0, Math.ceil(followingAuthors.length / 6) - 1)))} disabled={followingPage >= Math.max(0, Math.ceil(followingAuthors.length / 6) - 1)}>&gt;</button>
      </div>
    </section>
    <div className="my-stats" aria-label="숏툰 활동">
      <button type="button" className="my-stat-row" onClick={() => window.dispatchEvent(new Event("open-liked-posts"))}><span>좋아요 표시한 작품</span></button>
      <button type="button" className="my-stat-row saved-posts-row"><span>저장한 숏툰</span></button>
    </div>
    <div className="my-links"><button type="button">버그 제보</button><button type="button">아이디어 제안</button><button type="button" className="my-links-section-start">이용약관</button><button type="button">개인정보 처리방침</button><button type="button" className="logout-button" onClick={() => setShowLogoutConfirm(true)}>로그아웃</button></div>
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
