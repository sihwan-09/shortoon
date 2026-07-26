"use client";

import { useEffect, useRef, useState } from "react";
import { createPostComment, loadPostComments } from "../../lib/comments";
import { loadUserLikedPostIds, syncPostLike } from "../../lib/likes";

type Panel = { id: number; position: number; eyebrow: string; line: string; tone: string; imageUrl?: string };
type Comic = { id: number; title: string; creator: string; genre: string; accent: string; publisher: string; fullUrl: string; panels: Panel[]; description?: string; createdAt?: string; likeCount?: number; viewCount?: number; link?: { title: string; url: string }; commentPostId?: string };
type SelectedPost = { id?: string; title: string; coverUrl: string; imageUrls: string[]; genre: string; description?: string; createdAt?: string; likeCount?: number; viewCount?: number; link?: { title: string; url: string }; authorName?: string };
type Comment = { id: number | string; comicId: number | string; author: string; body: string; isSpoiler: number | boolean; createdAt: number };

const fallbackComics: Comic[] = [
  { id: 1, title: "Midnight Delivery", creator: "Haru", genre: "Mystery", accent: "#C7FF3D", publisher: "NAVER", fullUrl: "https://comic.naver.com", panels: [
    { id: 1, position: 1, eyebrow: "11:58 PM", line: "The order said: deliver before midnight.", tone: "lime" },
    { id: 2, position: 2, eyebrow: "59 SECONDS LEFT", line: "But the address did not exist.", tone: "violet" },
    { id: 3, position: 3, eyebrow: "KNOCK KNOCK", line: "Someone answered from inside the wall.", tone: "red" },
  ]},
  { id: 2, title: "Orbiting You", creator: "Mina", genre: "Romance", accent: "#8B7CFF", publisher: "KAKAO", fullUrl: "https://webtoon.kakao.com", panels: [
    { id: 4, position: 1, eyebrow: "DAY 127", line: "Every night, the same star followed her home.", tone: "blue" },
    { id: 5, position: 2, eyebrow: "SIGNAL FOUND", line: "Tonight, it finally replied.", tone: "violet" },
    { id: 6, position: 3, eyebrow: "ONE MESSAGE", line: "I have been waiting for you too.", tone: "pink" },
  ]},
  { id: 3, title: "Last Train Home", creator: "Doyeon", genre: "Drama", accent: "#FF9F1C", publisher: "NAVER", fullUrl: "https://comic.naver.com", panels: [
    { id: 7, position: 1, eyebrow: "LAST TRAIN", line: "The final carriage was always empty.", tone: "amber" },
    { id: 8, position: 2, eyebrow: "NEXT STOP", line: "Until he saw his younger self.", tone: "blue" },
    { id: 9, position: 3, eyebrow: "DOORS OPEN", line: "You still have time to go back.", tone: "lime" },
  ]},
];

export function ComicFeed({ selectedPost, selectedPosts, selectedPostIndex = 0, onSelectedPostChange, onExitPost, channelName, profileImageUrl, legacyChannelNames = [] }: { selectedPost?: SelectedPost | null; selectedPosts?: SelectedPost[]; selectedPostIndex?: number; onSelectedPostChange?: (index: number) => void; onExitPost?: () => void; channelName?: string; profileImageUrl?: string | null; legacyChannelNames?: string[] }) {
  const [comics, setComics] = useState(fallbackComics);
  const [likedComics, setLikedComics] = useState<Record<number, boolean>>({});
  const [likedPostIds, setLikedPostIds] = useState<string[]>([]);
  const [savedComics, setSavedComics] = useState<Record<number, boolean>>({});
  const [metaHidden, setMetaHidden] = useState<Record<number, boolean>>({});
  const [commentComic, setCommentComic] = useState<Comic | null>(null);
  const [infoComic, setInfoComic] = useState<Comic | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentCounts, setCommentCounts] = useState<Record<number, number>>({});
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [author] = useState("익명");
  const [body, setBody] = useState("");
  const [isSpoiler, setIsSpoiler] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [storedProfileImageUrl, setStoredProfileImageUrl] = useState(profileImageUrl ?? null);
  const lastScrollTop = useRef<Record<number, number>>({});
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sync = () => setStoredProfileImageUrl(window.localStorage.getItem("shorttoon-profile-image"));
    sync();
    window.addEventListener("shorttoon-profile-image", sync);
    return () => window.removeEventListener("shorttoon-profile-image", sync);
  }, [profileImageUrl]);

  useEffect(() => {
    const syncLikes = () => {
      try { const value = JSON.parse(window.localStorage.getItem("shorttoon-liked-posts") ?? "[]"); setLikedPostIds(Array.isArray(value) ? value : []); } catch { setLikedPostIds([]); }
    };
    syncLikes();
    void loadUserLikedPostIds().then((ids) => {
      if (!ids.length) return;
      setLikedPostIds((current) => Array.from(new Set([...current, ...ids])));
      window.localStorage.setItem("shorttoon-liked-posts", JSON.stringify(Array.from(new Set([...likedPostIds, ...ids]))));
      window.dispatchEvent(new Event("shorttoon-liked-posts"));
    }).catch(() => undefined);
    window.addEventListener("shorttoon-liked-posts", syncLikes);
    return () => window.removeEventListener("shorttoon-liked-posts", syncLikes);
  }, []);

  useEffect(() => {
    fetch("/api/comics").then((response) => response.ok ? response.json() : Promise.reject())
      .then((data) => data.comics?.length && setComics(data.comics)).catch(() => undefined);
  }, []);

  const openComments = async (comic: Comic) => {
    setCommentComic(comic);
    try {
      if (comic.commentPostId) {
        const loadedComments = await loadPostComments(comic.commentPostId);
        // Channel-post comments are authored through the channel identity. Keep
        // historical comments tied to that identity when the channel name changes.
        setComments(channelName ? loadedComments.map((comment) => ({ ...comment, author: channelName })) : loadedComments);
        setCommentCounts((current) => ({ ...current, [comic.id]: loadedComments.length }));
      } else {
        const response = await fetch(`/api/comments?comicId=${comic.id}`);
        if (response.ok) {
          const loadedComments = (await response.json()).comments ?? [];
          setComments(loadedComments);
          setCommentCounts((current) => ({ ...current, [comic.id]: loadedComments.length }));
        }
      }
    } catch (error) {
      console.error("댓글을 불러오지 못했습니다.", error);
      setComments([]);
    }
  };

  const submitComment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!commentComic || !body.trim()) return;
    setSubmitting(true);
    try {
      const comment = commentComic.commentPostId
        ? await createPostComment(commentComic.commentPostId, commentComic.creator, body.trim(), isSpoiler)
        : await fetch("/api/comments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ comicId: commentComic.id, author, body, isSpoiler }) }).then(async (response) => response.ok ? (await response.json()).comment : null);
      if (comment) {
      setComments((current) => [comment, ...current]);
      setCommentCounts((current) => ({ ...current, [commentComic.id]: (current[commentComic.id] ?? 0) + 1 }));
      setBody("");
      setIsSpoiler(false);
      }
    } catch (error) {
      console.error("댓글을 등록하지 못했습니다.", error);
    }
    setSubmitting(false);
  };

  const selectedCollection = selectedPosts?.length ? selectedPosts : selectedPost ? [selectedPost] : [];
  const visibleComics = selectedCollection.length ? selectedCollection.map((post, postIndex) => ({ id: -1000 - postIndex, title: post.title, creator: post.authorName ?? "시화 작가", genre: post.genre, description: post.description, createdAt: post.createdAt, likeCount: post.likeCount, viewCount: post.viewCount, accent: "#C7FF3D", publisher: "", fullUrl: "", link: post.link, commentPostId: post.id, panels: (post.imageUrls.length ? post.imageUrls : [post.coverUrl]).map((imageUrl, index) => ({ id: -100000 - postIndex * 100 - index, position: index + 1, eyebrow: `${index + 1} / ${post.imageUrls.length || 1}`, line: post.title, tone: "lime", imageUrl })) })) : comics;

  useEffect(() => {
    const handleLikeClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest<HTMLButtonElement>(".like-action");
      if (!button) return;
      const article = button.closest<HTMLElement>(".comic-column");
      const index = article ? Array.from(article.parentElement?.children ?? []).indexOf(article) : -1;
      const post = selectedCollection[index];
      if (!post?.id) return;
      const current = (() => { try { const value = JSON.parse(window.localStorage.getItem("shorttoon-liked-posts") ?? "[]"); return Array.isArray(value) ? value as string[] : []; } catch { return []; } })();
      const next = current.includes(post.id) ? current.filter((id) => id !== post.id) : Array.from(new Set([...current, post.id]));
      window.localStorage.setItem("shorttoon-liked-posts", JSON.stringify(next));
      window.dispatchEvent(new Event("shorttoon-liked-posts"));
      void syncPostLike(identity, next.includes(identity)).catch(() => undefined);
    };
    document.addEventListener("click", handleLikeClick, true);
    return () => document.removeEventListener("click", handleLikeClick, true);
  }, [selectedCollection]);

  useEffect(() => {
    if (!selectedPosts?.length || !feedRef.current) return;
    feedRef.current.scrollTo({ left: selectedPostIndex * feedRef.current.clientWidth, behavior: "auto" });
  }, [selectedPosts, selectedPostIndex]);

  return (
    <section className="feed-wrap" aria-label="Shorttoon comic feed">
      {selectedPost && onExitPost && <button className="post-view-back" type="button" onClick={onExitPost} aria-label="내 채널로 돌아가기">←</button>}
      <div ref={feedRef} className="comic-feed" onScroll={(event) => {
        if (!selectedPosts?.length || !onSelectedPostChange) return;
        const width = event.currentTarget.clientWidth;
        if (!width) return;
        const nextIndex = Math.max(0, Math.min(selectedPosts.length - 1, Math.round(event.currentTarget.scrollLeft / width)));
        if (nextIndex !== selectedPostIndex) onSelectedPostChange(nextIndex);
      }}>
        {visibleComics.map((comic, comicIndex) => (
          <article className={`comic-column ${selectedPost ? "uploaded-comic" : ""}`} key={comic.id} aria-label={comic.title}>
            <div className="panel-stack" onScroll={(event) => {
              const element = event.currentTarget;
              const previousTop = lastScrollTop.current[comic.id] ?? 0;
              const delta = element.scrollTop - previousTop;
              if (Math.abs(delta) > 2) {
                setMetaHidden((current) => ({ ...current, [comic.id]: delta > 0 }));
                lastScrollTop.current[comic.id] = element.scrollTop;
              }
            }}>
              {comic.panels.map((panel, panelIndex) => (
                <section className={`comic-panel tone-${panel.tone} ${selectedPost ? "uploaded-panel" : ""}`} key={panel.id}>
                  <div className="panel-art" aria-hidden="true">{panel.imageUrl ? <img className="panel-art-image" src={panel.imageUrl} alt="" /> : <><i /><b /><em /></>}</div>
                  <div className="panel-copy">
                    <span>{panel.eyebrow}</span>
                    <h2>{panel.line}</h2>
                    <em className="post-genre">{comic.genre}</em>
                  </div>
                  {panelIndex === 0 && <div className="swipe-tip">Swipe up for next cut</div>}
                </section>
              ))}
            </div>
            <div className="action-rail">
              <button type="button" className={`like-action ${likedComics[comic.id] ? "liked" : ""}`} onClick={() => setLikedComics((current) => ({ ...current, [comic.id]: !current[comic.id] }))} aria-label={`${likedComics[comic.id] ? "Unlike" : "Like"} ${comic.title}`} aria-pressed={Boolean(likedComics[comic.id])}><span aria-hidden="true">♥</span><small>{likedComics[comic.id] ? 1 : 0}</small></button>
              <button type="button" onClick={() => openComments(comic)} aria-label={`${comic.title} 댓글 보기`}><span>•••</span><small>{commentCounts[comic.id] ?? 0}</small></button>
              <button type="button" className={`save-action ${savedComics[comic.id] ? "saved" : ""}`} onClick={() => setSavedComics((current) => ({ ...current, [comic.id]: !current[comic.id] }))} aria-label={`${savedComics[comic.id] ? "Remove" : "Save"} ${comic.title}`} aria-pressed={Boolean(savedComics[comic.id])}><span className="save-symbol" aria-hidden="true" /><small>저장</small></button>
              <a href={comic.fullUrl} target="_blank" rel="noreferrer" aria-label={`Open full ${comic.title} on ${comic.publisher}`}><span>↗</span><small>공유</small></a>
            </div>
            <footer className={`comic-meta ${metaHidden[comic.id] ? "meta-hidden" : ""}`}>
              <div><div className="comic-author"><span className="post-author-avatar" aria-hidden="true" style={storedProfileImageUrl ? { backgroundImage: `url(${storedProfileImageUrl})` } : undefined} /><small>@{comic.creator.toLowerCase().replace(/\s+/g, "")}</small></div><button className="comic-title-button" type="button" onClick={() => setInfoComic(comic)}>{comic.title}</button><div className="comic-tag-cluster">{comic.link && <a className="comic-tag-pill" href={comic.link.url} target="_blank" rel="noreferrer">{comic.link.title}</a>}{comic.genre.split(" · ").filter(Boolean).map((genre) => <span className="comic-tag-pill" key={genre}>{genre}</span>)}</div></div>
            </footer>
          </article>
        ))}
      </div>
      {commentComic && <div className="sheet-backdrop" role="presentation" onClick={() => setCommentComic(null)}>
        <aside className="comment-sheet" role="dialog" aria-modal="true" aria-label={`${commentComic.title} 댓글`} onClick={(event) => event.stopPropagation()}>
          <div className="sheet-handle" />
          <header><div aria-hidden="true" /><button type="button" onClick={() => setCommentComic(null)} aria-label="댓글창 닫기">×</button></header>
          <div className="comment-list">
            {comments.length === 0 && <p className="no-comments">첫 댓글을 남겨보세요.</p>}
            {comments.map((comment) => {
              const hidden = Boolean(comment.isSpoiler) && !revealed.has(comment.id);
              return <article className={`comment-card ${hidden ? "spoiler-hidden" : ""}`} key={comment.id}>
                <div><strong>{comment.author}</strong>{Boolean(comment.isSpoiler) && <span>SPOILER</span>}</div>
                <p>{hidden ? "스포일러가 포함된 댓글입니다." : comment.body}</p>
                {hidden && <button type="button" onClick={() => setRevealed((current) => new Set(current).add(comment.id))}>스포일러 보기</button>}
              </article>;
            })}
          </div>
          <form className="comment-form" onSubmit={submitComment}>
            <textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="댓글을 입력하세요" maxLength={500} aria-label="댓글" required />
            <div><label><input type="checkbox" checked={isSpoiler} onChange={(event) => setIsSpoiler(event.target.checked)} /> 스포일러 포함</label><button type="submit" disabled={submitting}>{submitting ? "등록 중..." : "등록"}</button></div>
          </form>
        </aside>
      </div>}
      {infoComic && <div className="sheet-backdrop" role="presentation" onClick={() => setInfoComic(null)}>
        <aside className="comment-sheet info-sheet" role="dialog" aria-modal="true" aria-label={`${infoComic.title} 설명`} onClick={(event) => event.stopPropagation()}>
          <div className="sheet-handle" />
          <header><strong>설명</strong><button type="button" onClick={() => setInfoComic(null)} aria-label="설명 닫기">×</button></header>
          <div className="info-sheet-body">
            <h2>{infoComic.title}</h2>
            <div className="info-stats">
              <div><strong>{infoComic.likeCount ?? 0}</strong><span>좋아요</span></div>
              <div><strong>{infoComic.viewCount ?? 0}</strong><span>조회수</span></div>
              <div><strong>{infoComic.createdAt ? new Date(infoComic.createdAt).toLocaleDateString("ko-KR", { month: "long", day: "numeric" }) : "-"}</strong><span>{infoComic.createdAt ? new Date(infoComic.createdAt).getFullYear() + "년" : "게시일"}</span></div>
            </div>
            <p className="info-description">{infoComic.description?.trim() || "설명이 없습니다."}</p>
          </div>
        </aside>
      </div>}
    </section>
  );
}
