"use client";

export function MyPage() {
  return (
    <section className="my-page" aria-label="My page">
      <div className="my-profile">
        <div className="profile-avatar" aria-label="Profile image" role="img"><span /></div>
        <h1>시화님</h1>
      </div>

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
