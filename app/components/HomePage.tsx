"use client";

import { useEffect, useState } from "react";
import { loadPublishedPostsPage, type PublishedPost } from "../../lib/posts";
import { loadDailyHighlight, type DailyHighlight } from "../../lib/highlights";
import { getHighlightDayWindow } from "../../lib/highlight-time";
import type { RelayTopic } from "../../lib/relay";
import styles from "./HomePage.module.css";

type Props = { relayTopics: RelayTopic[]; onOpenFeed: (index?: number) => void; onOpenPost: (post: PublishedPost) => void; onOpenRelay: () => void };

function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={diagonal ? "M6 18 18 6M6 6h12v12" : "M4 12h15m-6-6 6 6-6 6"} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function HomePage({ relayTopics, onOpenFeed, onOpenPost, onOpenRelay }: Props) {
  const [posts, setPosts] = useState<PublishedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [genre, setGenre] = useState("전체");
  const [highlight, setHighlight] = useState<DailyHighlight | null>(null);
  const [highlightLoading, setHighlightLoading] = useState(true);
  const [highlightFailed, setHighlightFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    void loadPublishedPostsPage(0, 6).then(({ posts: next }) => {
      if (!cancelled) setPosts(next);
    }).catch((error) => {
      console.error("홈 최신 작품 조회 실패", error);
      if (!cancelled) setFailed(true);
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [attempt]);

  useEffect(() => {
    let cancelled = false;
    let requestId = 0;
    let midnightTimer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      const request = ++requestId;
      setHighlightLoading(true);
      setHighlightFailed(false);
      try {
        const next = await loadDailyHighlight();
        if (!cancelled && request === requestId) setHighlight(next);
      } catch (error) {
        console.error("오늘의 하이라이트 조회 실패", error);
        if (!cancelled && request === requestId) { setHighlight(null); setHighlightFailed(true); }
      } finally {
        if (!cancelled && request === requestId) setHighlightLoading(false);
      }
    };
    const scheduleMidnight = () => {
      midnightTimer = setTimeout(() => {
        void refresh();
        scheduleMidnight();
      }, getHighlightDayWindow().end.getTime() - Date.now() + 50);
    };
    const resume = () => { if (document.visibilityState === "visible") void refresh(); };
    void refresh();
    scheduleMidnight();
    const interval = setInterval(resume, 60_000);
    document.addEventListener("visibilitychange", resume);
    return () => { cancelled = true; clearTimeout(midnightTimer); clearInterval(interval); document.removeEventListener("visibilitychange", resume); };
  }, [attempt]);

  const genres = Array.from(new Set(posts.flatMap((post) => post.genre.split(" · ").filter(Boolean))));
  const visiblePosts = posts.filter((post) => genre === "전체" || post.genre.split(" · ").includes(genre));

  return <div className={styles.home}>
    <div className={styles.edition}><span>HILIGHTOON</span></div>

    <section className={styles.hero} aria-labelledby="home-title">
      <div className={styles.heroCopy}>
        <span className={styles.eyebrow}>YOUR DAILY HIGHLIGHT</span>
        <h1 id="home-title">오늘의<br /><span>하이라이트.</span></h1>
        <p>잠깐의 틈, 새로운 이야기.<br />마음에 남을 한 컷을 만나보세요.</p>
        {highlightFailed && <button className={styles.highlightRetry} type="button" onClick={() => setAttempt((value) => value + 1)}>다시 불러오기</button>}
        <button className={styles.heroButton} type="button" disabled={!highlight || highlightLoading} onClick={() => { if (highlight) onOpenPost(highlight.post); }}>작품 보러 가기 <Arrow /></button>
      </div>
      <div className={styles.art} aria-hidden="true">
        <div className={styles.backPage}><span>한 컷,<br />또 한 컷.</span><i /></div>
        <div className={styles.frontPage}>{highlight && !highlightLoading ? <img src={highlight.post.coverUrl || highlight.post.imageUrls[0]} alt="" /> : <><span className={styles.artStar}>✳</span><span className={styles.artType}>TO BE<br />CONTINUED<span>…</span></span><span className={styles.artBubble}>이야기는<br />계속된다!</span></>}</div>
        <span className={styles.artStamp}>한 번 더<br /><b>SWIPE →</b></span>
      </div>
      <div className={styles.heroFoot}><span>짧게 읽고, 오래 남는 이야기</span><span>SCROLL TO DISCOVER ↓</span></div>
    </section>

    <section className={styles.latest} aria-labelledby="home-latest-title">
      <header className={styles.sectionHead}><div><span className={styles.eyebrow}>FRESH OFF THE PAGE</span><h2 id="home-latest-title">새로 도착한 이야기<span>.</span></h2></div><button type="button" onClick={() => onOpenFeed()}>더 보기 <Arrow /></button></header>
      {genres.length > 0 && <div className={styles.filters} role="group" aria-label="최신 작품 장르"><button type="button" aria-pressed={genre === "전체"} onClick={() => setGenre("전체")}>전체</button>{genres.map((item) => <button type="button" key={item} aria-pressed={genre === item} onClick={() => setGenre(item)}>{item}</button>)}</div>}
      {loading ? <div className={styles.grid} role="status" aria-label="최신 작품 불러오는 중">{[0, 1, 2, 3].map((id) => <div key={id} className={styles.skeleton} />)}</div>
        : failed ? <div className={styles.empty} role="status"><span>이야기를 잠시 불러오지 못했어요.</span><button type="button" onClick={() => setAttempt((value) => value + 1)}>다시 불러오기 <Arrow /></button></div>
        : visiblePosts.length ? <div className={styles.grid}>{visiblePosts.map((post) => <button className={styles.work} type="button" key={post.id} onClick={() => onOpenFeed(posts.findIndex((item) => item.id === post.id))} aria-label={`${post.title} 읽기`}>
          <div className={styles.cover}>{post.coverUrl ? <img src={post.coverUrl} alt="" loading="lazy" /> : <span className={styles.noCover}>HILIGHT<br />OON.</span>}<span className={styles.readMark}><Arrow diagonal /></span>{post.genre && <span className={styles.genre}>{post.genre.split(" · ")[0]}</span>}</div>
          <strong>{post.title}</strong><span className={styles.author}>{post.authorChannelId ? `@${post.authorChannelId}` : post.authorName ?? "작가"}</span>
        </button>)}</div>
        : <div className={styles.empty}><span className={styles.emptySymbol}>＋</span><strong>첫 이야기를 기다리고 있어요.</strong><p>작가들의 새로운 작품이 이곳에 모입니다.</p><button type="button" onClick={() => onOpenFeed()}>작품 탐색하기 <Arrow /></button></div>}
    </section>

    <section className={styles.relay} aria-labelledby="home-relay-title">
      <div className={styles.relayLabel}><span>RELAY TOON</span><span className={styles.relayDots}>● ● ●</span></div>
      <h2 id="home-relay-title">다음 장면은,<br /><span>당신의 차례.</span></h2>
      <p>한 사람이 시작한 이야기,<br />여럿의 상상으로 이어지는 세계.</p>
      <div className={styles.relayBottom}><span>{relayTopics.length > 0 ? `${relayTopics.length}개의 이야기가 펼쳐지는 중` : "함께 만들어 가는 세계관"}</span><button type="button" onClick={onOpenRelay} aria-label="릴레이툰 둘러보기"><Arrow diagonal /></button></div>
      <div className={styles.relayIllustration} aria-hidden="true"><span>01</span><span>02</span><span>?</span></div>
    </section>

    <footer className={styles.footer}><span>한 컷의 발견, 하이라이툰.</span><span>KEEP YOUR HIGHLIGHTS.</span></footer>
  </div>;
}
