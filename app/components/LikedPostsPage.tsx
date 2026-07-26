"use client";

import type { PublishedShorttoon } from "./UploadPage";

type Props = { posts: PublishedShorttoon[]; onBack: () => void; onOpenPost: (post: PublishedShorttoon, index: number) => void };

export function LikedPostsPage({ posts, onBack, onOpenPost }: Props) {
  return <section className="channel-page liked-posts-page" aria-label="좋아요 표시한 작품">
    <header className="liked-posts-header">
      <button className="channel-back" type="button" onClick={onBack} aria-label="MY로 돌아가기">←</button>
      <h1 className="liked-posts-heading">좋아요 표시한 작품</h1>
    </header>
    <div className="channel-thumbnail-grid" aria-label="좋아요 표시한 작품 목록">
      {posts.map((post, index) => <button className="channel-thumbnail-tile has-post" data-post-index={index} key={`${post.id ?? post.title}-${index}`} type="button" onClick={() => onOpenPost(post, index)} aria-label={`${post.title} 게시물 보기`}><img src={post.coverUrl} alt="" /><span>{post.title}</span></button>)}
    </div>
    {posts.length === 0 && <p className="liked-posts-empty">좋아요 표시한 작품이 없습니다.</p>}
  </section>;
}
