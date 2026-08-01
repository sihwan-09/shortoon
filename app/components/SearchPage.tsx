"use client";

import { useEffect, useRef, useState } from "react";

type SearchPageProps = { onBack: () => void };

export function SearchPage({ onBack }: SearchPageProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const persistRecentSearches = (next: string[]) => {
    setRecentSearches(next);
    window.localStorage.setItem("shorttoon-recent-searches", JSON.stringify(next));
  };

  const submitSearch = () => {
    const value = query.trim();
    if (!value) return;
    persistRecentSearches([value, ...recentSearches.filter((item) => item !== value)].slice(0, 30));
  };

  useEffect(() => {
    inputRef.current?.focus();
    try {
      const saved = JSON.parse(window.localStorage.getItem("shorttoon-recent-searches") ?? "[]");
      if (Array.isArray(saved)) setRecentSearches(saved.filter((item): item is string => typeof item === "string").slice(0, 30));
    } catch {
      // Ignore malformed device-local search history.
    }
  }, []);

  return (
    <section className="search-page" aria-label="검색">
      <div className="search-page-header">
        <button type="button" className="search-page-back" onClick={onBack} aria-label="이전 페이지로 돌아가기">←</button>
        <div className="search-page-input-wrap">
          <input ref={inputRef} type="search" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") submitSearch(); }} placeholder="작품 또는 작가 검색" aria-label="검색어 입력" />
          {query && <button type="button" className="search-page-clear" onClick={() => setQuery("")} aria-label="검색어 지우기" />}
        </div>
      </div>
      <section className="recent-searches" aria-label="최근 검색어">
        <div className="recent-searches-heading">
          <strong>최근 검색어</strong>
          {recentSearches.length > 0 && <button type="button" onClick={() => persistRecentSearches([])}>전체삭제</button>}
        </div>
        {recentSearches.length > 0 && <ul>
          {recentSearches.map((term) => <li key={term}>
            <button type="button" className="recent-search-term" onClick={() => { setQuery(term); inputRef.current?.focus(); }}>{term}</button>
            <button type="button" className="recent-search-remove" onClick={() => persistRecentSearches(recentSearches.filter((item) => item !== term))} aria-label={`${term} 삭제`}>×</button>
          </li>)}
        </ul>}
      </section>
    </section>
  );
}
