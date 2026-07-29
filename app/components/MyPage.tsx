"use client";

import { useEffect, useState } from "react";

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
  useEffect(() => {
    const sync = () => setStoredProfileImageUrl(window.localStorage.getItem("shorttoon-profile-image"));
    sync();
    window.addEventListener("shorttoon-profile-image", sync);
    return () => window.removeEventListener("shorttoon-profile-image", sync);
  }, [profileImageUrl]);
  useEffect(() => {
    const sync = () => {
      try { const value = JSON.parse(window.localStorage.getItem("shorttoon-liked-posts") ?? "[]"); setLikedCount(Array.isArray(value) ? value.length : 0); } catch { setLikedCount(0); }
    };
    sync();
    window.addEventListener("shorttoon-liked-posts", sync);
    return () => window.removeEventListener("shorttoon-liked-posts", sync);
  }, []);
  return <section className="my-page" aria-label="MY 페이지">
    <button className="my-profile" type="button" onClick={() => { window.sessionStorage.setItem("shorttoon-open-channel-top", "1"); onOpenChannel(); }} aria-label="내 채널 보기">
      <div className="profile-avatar" aria-label="프로필 이미지" role="img">{storedProfileImageUrl ? <img src={storedProfileImageUrl} alt="프로필" /> : <span />}</div>
      <h1>{channelName}</h1><span className="my-profile-channel-id">@{channelId}</span>
    </button>
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
