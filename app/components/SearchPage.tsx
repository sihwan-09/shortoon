"use client";

import { useEffect, useRef, useState } from "react";
import { searchAuthors, searchPublishedPosts, type SearchAuthor } from "../../lib/search";
import type { PublishedPost } from "../../lib/posts";
import { loadFollowedChannelIds, setFollowedChannel } from "../../lib/follows";
import { supabase } from "../../lib/supabase";

type SearchPageProps = { onBack: () => void; onOpenPost?: (post: PublishedPost, posts: PublishedPost[], index: number) => void; onOpenAuthor?: (authorId: string) => void };

export function SearchPage({ onBack, onOpenPost, onOpenAuthor }: SearchPageProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [category, setCategory] = useState<"works" | "authors">("works");
  const [workResults, setWorkResults] = useState<PublishedPost[]>([]);
  const [authorResults, setAuthorResults] = useState<SearchAuthor[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [following, setFollowing] = useState<Record<string, boolean>>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [resultPage, setResultPage] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const resultEndRef = useRef<HTMLDivElement>(null);

  const switchCategory = (next: "works" | "authors") => {
    setCategory(next);
    window.sessionStorage.setItem("shorttoon-search-category", next);
  };

  const persistRecentSearches = (next: string[]) => {
    setRecentSearches(next);
    window.localStorage.setItem("shorttoon-recent-searches", JSON.stringify(next));
  };

  const submitSearch = () => {
    const value = query.trim();
    if (!value) return;
    setSubmittedQuery(value);
    window.sessionStorage.setItem("shorttoon-search-query", value);
    persistRecentSearches([value, ...recentSearches.filter((item) => item !== value)].slice(0, 30));
    setLoadingResults(true);
    setResultPage(0); setHasMore(true);
    void Promise.all([searchPublishedPosts(value, 0, 30), searchAuthors(value, 0, 30)]).then(([posts, authors]) => { setWorkResults(posts); setAuthorResults(authors); setHasMore(posts.length === 30 || authors.length === 30); }).catch((error) => console.error("검색 결과 조회 실패", error)).finally(() => setLoadingResults(false));
  };

  const openRecentSearch = (term: string) => {
    setQuery(term);
    setSubmittedQuery(term);
    window.sessionStorage.setItem("shorttoon-search-query", term);
    setLoadingResults(true);
    setResultPage(0); setHasMore(true);
    void Promise.all([searchPublishedPosts(term, 0, 30), searchAuthors(term, 0, 30)]).then(([posts, authors]) => { setWorkResults(posts); setAuthorResults(authors); setHasMore(posts.length === 30 || authors.length === 30); }).catch((error) => console.error("검색 결과 조회 실패", error)).finally(() => setLoadingResults(false));
    inputRef.current?.focus();
  };

  useEffect(() => {
    inputRef.current?.focus();
    void supabase.auth.getUser().then(({ data }) => { setCurrentUserId(data.user?.id ?? null); return loadFollowedChannelIds(); }).then((ids) => setFollowing(Object.fromEntries(ids.map((id) => [id, true])))).catch((error) => console.error("팔로우 상태 조회 실패", error));
    const restoredQuery = window.sessionStorage.getItem("shorttoon-search-query") ?? "";
    const restoredCategory = window.sessionStorage.getItem("shorttoon-search-category");
    if (restoredQuery) {
      setQuery(restoredQuery);
      setSubmittedQuery(restoredQuery);
      setLoadingResults(true);
      setResultPage(0); setHasMore(true); void Promise.all([searchPublishedPosts(restoredQuery, 0, 30), searchAuthors(restoredQuery, 0, 30)]).then(([posts, authors]) => { setWorkResults(posts); setAuthorResults(authors); setHasMore(posts.length === 30 || authors.length === 30); }).catch((error) => console.error("검색 결과 복원 실패", error)).finally(() => setLoadingResults(false));
    }
    if (restoredCategory === "authors" || restoredCategory === "works") setCategory(restoredCategory);
    try {
      const saved = JSON.parse(window.localStorage.getItem("shorttoon-recent-searches") ?? "[]");
      if (Array.isArray(saved)) setRecentSearches(saved.filter((item): item is string => typeof item === "string").slice(0, 30));
    } catch {
      // Ignore malformed device-local search history.
    }
  }, []);

  useEffect(() => {
    if (!submittedQuery || loadingResults || loadingMore || !hasMore) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      const nextPage = resultPage + 1;
      setLoadingMore(true);
      void Promise.all([searchPublishedPosts(submittedQuery, nextPage * 30, 30), searchAuthors(submittedQuery, nextPage * 30, 30)])
        .then(([posts, authors]) => { setWorkResults((current) => [...current, ...posts.filter((post) => !current.some((item) => item.id === post.id))]); setAuthorResults((current) => [...current, ...authors.filter((author) => !current.some((item) => item.ownerId === author.ownerId))]); setHasMore(posts.length === 30 || authors.length === 30); setResultPage(nextPage); })
        .catch((error) => console.error("검색 결과 추가 조회 실패", error))
        .finally(() => setLoadingMore(false));
    }, { rootMargin: "600px" });
    if (resultEndRef.current) observer.observe(resultEndRef.current);
    return () => observer.disconnect();
  }, [submittedQuery, resultPage, loadingResults, loadingMore, hasMore]);

  return (
    <section className="search-page" aria-label="검색">
      <div className="search-page-header">
        <button type="button" className="search-page-back" onClick={onBack} aria-label="이전 페이지로 돌아가기">←</button>
        <div className="search-page-input-wrap">
          <input ref={inputRef} type="search" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") submitSearch(); }} placeholder="작품 또는 작가 검색" aria-label="검색어 입력" />
          {query && <button type="button" className="search-page-clear" onClick={() => setQuery("")} aria-label="검색어 지우기" />}
        </div>
      </div>
      {submittedQuery ? <section className="search-results" aria-label="검색 결과">
        <div className="search-category-tabs" role="tablist" aria-label="검색 결과 종류">
          <button type="button" role="tab" aria-selected={category === "works"} className={category === "works" ? "is-active" : ""} onClick={() => switchCategory("works")}>작품</button>
          <button type="button" role="tab" aria-selected={category === "authors"} className={category === "authors" ? "is-active" : ""} onClick={() => switchCategory("authors")}>작가</button>
        </div>
        <div className="search-results-title">‘{submittedQuery}’ 검색 결과</div>
        {loadingResults ? <div className="search-results-empty"><span>검색 중입니다.</span></div> : (
          <div key={category} className={category === "works" ? "search-result-panel search-result-panel-works" : "search-result-panel search-result-panel-authors"}>
            {category === "works" ? <div className="search-result-grid">
              {workResults.map((post, index) => <button type="button" className="search-result-tile" key={post.id} onClick={() => onOpenPost?.(post, workResults, index)}><img src={post.coverUrl} alt="" /><span>{post.title}</span></button>)}
              {!workResults.length && <div className="search-results-empty"><span>검색된 작품이 없습니다.</span></div>}
            </div> : <div className="search-author-results">
              {authorResults.map((author) => <article className="search-author-card" key={author.ownerId} onClick={() => onOpenAuthor?.(author.ownerId)}>
                <button type="button" className="search-author-profile-button" onClick={() => onOpenAuthor?.(author.ownerId)} aria-label={`${author.name} 채널 보기`}><span className="search-author-avatar" role="img" aria-label="프로필 이미지" style={author.profileImageUrl ? { backgroundImage: `url("${author.profileImageUrl}")` } : undefined} /></button>
                <div className="search-author-info"><strong>{author.name}</strong><span>@{author.channelId}</span><small>팔로워 {author.followerCount}명 · 작품 {author.postCount}개</small></div>
                {author.ownerId !== currentUserId && <button type="button" className={`search-follow-button${following[author.ownerId] ? " is-following" : ""}`} onClick={async (event) => { event.stopPropagation(); const next = !following[author.ownerId]; setFollowing((current) => ({ ...current, [author.ownerId]: next })); try { await setFollowedChannel(author.ownerId, next); window.dispatchEvent(new Event("shorttoon-followed-channels")); } catch (error) { console.error("팔로우 처리 실패", error); setFollowing((current) => ({ ...current, [author.ownerId]: !next })); } }}>{following[author.ownerId] ? "팔로잉" : "팔로우"}</button>}
              </article>)}
              {!authorResults.length && <div className="search-results-empty"><span>검색된 작가가 없습니다.</span></div>}
            </div>}
          </div>
        )}
        <div ref={resultEndRef} className="search-results-end" aria-hidden="true" />
        {loadingMore && <div className="search-results-loading-more">더 불러오는 중...</div>}
      </section> : <section className="recent-searches" aria-label="최근 검색어">
        <div className="recent-searches-heading">
          <strong>최근 검색어</strong>
          {recentSearches.length > 0 && <button type="button" onClick={() => persistRecentSearches([])}>전체삭제</button>}
        </div>
        {recentSearches.length > 0 && <ul>
          {recentSearches.map((term) => <li key={term} onClick={() => openRecentSearch(term)}>
            <button type="button" className="recent-search-term" onClick={(event) => { event.stopPropagation(); openRecentSearch(term); }}>{term}</button>
            <button type="button" className="recent-search-remove" onClick={(event) => { event.stopPropagation(); persistRecentSearches(recentSearches.filter((item) => item !== term)); }} aria-label={`${term} 삭제`}>×</button>
          </li>)}
        </ul>}
      </section>}
    </section>
  );
}
