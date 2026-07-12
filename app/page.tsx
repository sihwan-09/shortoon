export default function Home() {
  return (
    <main className="app-shell">
      <header className="app-header" aria-label="숏툰 상단 헤더">
        <div className="header-spacer" aria-hidden="true" />
        <a className="brand" href="/" aria-label="숏툰 홈">
          <span className="brand-logo" role="img" aria-label="숏툰" />
        </a>
      </header>

      <section className="feed-stage" aria-label="웹툰 피드 준비 영역">
        <div className="empty-state">
          <span className="eyebrow">SHORT WEBTOON</span>
          <h1>짧게 넘기고,<br />깊게 빠져들다.</h1>
          <p>다음 단계에서 웹툰 피드를 채워볼게요.</p>
        </div>
      </section>
    </main>
  );
}
