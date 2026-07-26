"use client";

type MyPageProps = { onOpenChannel: () => void; channelName: string; channelId: string };

export function MyPage({ onOpenChannel, channelName, channelId }: MyPageProps) {
  return (
    <section className="my-page" aria-label="My page">
      <button className="my-profile" type="button" onClick={onOpenChannel} aria-label="View my channel">
        <div className="profile-avatar" aria-label="Profile image" role="img"><span /></div>
        <h1>{channelName}</h1>
        <span className="my-profile-channel-id">@{channelId}</span>
      </button>

      <div className="my-stats" aria-label="Shorttoon activity">
        <button type="button" className="my-stat-row">
          <span>좋아요한 숏툰</span><strong>128<span>/1000</span></strong>
        </button>
        <button type="button" className="my-stat-row">
          <span>저장한 숏툰</span><strong>36<span>/1000</span></strong>
        </button>
      </div>

      <div className="my-links">
        <button type="button">이용약관<span aria-hidden="true">›</span></button>
        <button type="button">개인정보 처리방침<span aria-hidden="true">›</span></button>
        <button type="button" className="logout-button">로그아웃</button>
      </div>
    </section>
  );
}
