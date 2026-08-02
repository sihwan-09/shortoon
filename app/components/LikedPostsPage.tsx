"use client";

import { useEffect, useRef, useState } from "react";
import type { PublishedShorttoon } from "./UploadPage";
import { ViewCountBadge } from "./ViewCountBadge";

type Props = { posts: PublishedShorttoon[]; onBack: () => void; onOpenPost: (post: PublishedShorttoon, index: number) => void };

export function LikedPostsPage({ posts, onBack, onOpenPost }: Props) {
  const [visiblePostCount, setVisiblePostCount] = useState(30);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => setVisiblePostCount(30), [posts]);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) setVisiblePostCount((count) => Math.min(posts.length, count + 30)); }, { rootMargin: "600px" });
    if (endRef.current) observer.observe(endRef.current);
    return () => observer.disconnect();
  }, [posts.length]);
  return <section className="channel-page liked-posts-page" aria-label="좋아요 표시한 작품">
    <header className="liked-posts-header">
      <button className="channel-back" type="button" onClick={onBack} aria-label="MY로 돌아가기">←</button>
      <h1 className="liked-posts-heading">좋아요 표시한 작품</h1>
    </header>
    <div className="channel-thumbnail-grid" aria-label="좋아요 표시한 작품 목록">
      {posts.slice(0, visiblePostCount).map((post, index) => <button className="channel-thumbnail-tile has-post" data-post-index={index} key={`${post.id ?? post.title}-${index}`} type="button" onClick={() => onOpenPost(post, index)} aria-label={`${post.title} 게시물 보기`}><img src={post.coverUrl} alt="" /><ViewCountBadge postId={post.id} fallback={post.viewCount} /><span>{post.title}</span></button>)}
    </div>
    <div ref={endRef} className="search-results-end" aria-hidden="true" />
    {posts.length === 0 && <p className="liked-posts-empty">좋아요 표시한 작품이 없습니다.</p>}
  </section>;
}
