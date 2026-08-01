"use client";

import { useEffect, useRef } from "react";

type SearchPageProps = { onBack: () => void };

export function SearchPage({ onBack }: SearchPageProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  return (
    <section className="search-page" aria-label="검색">
      <div className="search-page-header">
        <button type="button" className="search-page-back" onClick={onBack} aria-label="이전 페이지로 돌아가기">←</button>
        <input ref={inputRef} type="search" placeholder="작품 또는 작가 검색" aria-label="검색어 입력" />
      </div>
    </section>
  );
}
