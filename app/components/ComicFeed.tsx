"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { createPostComment, loadPostComments, toggleCommentLike } from "../../lib/comments";
import { loadUserLikedPostIds, syncPostLike } from "../../lib/likes";
import { deletePostFromSupabase, loadPublishedPostsPage, type PublishedPost } from "../../lib/posts";
import { loadPostReports, reportPost, type PostReport } from "../../lib/reports";

type Panel = { id: number; position: number; eyebrow: string; line: string; tone: string; imageUrl?: string };
type Comic = { id: number; title: string; creator: string; authorId?: string | null; authorChannelId?: string | null; authorImageUrl?: string | null; genre: string; accent: string; publisher: string; fullUrl: string; panels: Panel[]; description?: string; createdAt?: string; likeCount?: number; commentCount?: number; viewCount?: number; link?: { title: string; url: string }; commentPostId?: string };
type SelectedPost = { id?: string; authorId?: string | null; authorChannelId?: string | null; authorImageUrl?: string | null; title: string; coverUrl: string; imageUrls: string[]; genre: string; description?: string; createdAt?: string; likeCount?: number; viewCount?: number; link?: { title: string; url: string }; authorName?: string };
type Comment = { id: number | string; comicId: number | string; author: string; authorId?: string | null; authorChannelId?: string | null; authorImageUrl?: string | null; body: string; isSpoiler: number | boolean; createdAt: number; parentId?: string | null; likeCount: number; likedByMe: boolean; replyCount: number };

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

export function ComicFeed({ selectedPost, selectedPosts, selectedPostIndex = 0, initialHomeIndex = 0, onSelectedPostChange, onExitPost, onOpenChannel, channelName, channelId, profileImageUrl, legacyChannelNames = [] }: { selectedPost?: SelectedPost | null; selectedPosts?: SelectedPost[]; selectedPostIndex?: number; initialHomeIndex?: number; onSelectedPostChange?: (index: number) => void; onExitPost?: () => void; onOpenChannel?: (comic: Comic) => void; channelName?: string; channelId?: string; profileImageUrl?: string | null; legacyChannelNames?: string[] }) {
  const [comics, setComics] = useState<Comic[]>([]);
  const [feedPage, setFeedPage] = useState(0);
  const [feedCurrentIndex, setFeedCurrentIndex] = useState(0);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedLoadingMore, setFeedLoadingMore] = useState(false);
  const [feedHasMore, setFeedHasMore] = useState(true);
  const [feedError, setFeedError] = useState(false);
  const feedRequestRef = useRef(false);
  const [likedComics, setLikedComics] = useState<Record<number, boolean>>({});
  const [likeCountOverrides, setLikeCountOverrides] = useState<Record<number, number>>({});
  const [likedPostIds, setLikedPostIds] = useState<string[]>([]);
  const [savedComics, setSavedComics] = useState<Record<number, boolean>>({});
  const [metaHidden, setMetaHidden] = useState<Record<number, boolean>>({});
  const [commentComic, setCommentComic] = useState<Comic | null>(null);
  const [menuComic, setMenuComic] = useState<Comic | null>(null);
  const [menuIsOwner, setMenuIsOwner] = useState(false);
  const [menuReports, setMenuReports] = useState<PostReport[]>([]);
  const [infoComic, setInfoComic] = useState<Comic | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentCounts, setCommentCounts] = useState<Record<number, number>>({});
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [body, setBody] = useState("");
  const [isSpoiler, setIsSpoiler] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);
  const [storedProfileImageUrl, setStoredProfileImageUrl] = useState(profileImageUrl ?? null);
  const lastScrollTop = useRef<Record<number, number>>({});
  const feedRef = useRef<HTMLDivElement>(null);
  const horizontalGestureStartX = useRef<number | null>(null);
  const horizontalGestureStartY = useRef<number | null>(null);
  const horizontalGestureStartIndex = useRef(0);

  useEffect(() => {
    const sync = () => setStoredProfileImageUrl(window.localStorage.getItem("shorttoon-profile-image"));
    sync();
    window.addEventListener("shorttoon-profile-image", sync);
    return () => window.removeEventListener("shorttoon-profile-image", sync);
  }, [profileImageUrl]);

  useEffect(() => {
    let cancelled = false;
    const syncLikes = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!data.session) { if (!cancelled) setLikedPostIds([]); return; }
        const ids = await loadUserLikedPostIds();
        if (!cancelled) setLikedPostIds(ids);
      } catch (error) {
        console.error("사용자 좋아요 불러오기 실패", error);
        if (!cancelled) setLikedPostIds([]);
      }
    };
    void syncLikes();
    const { data: authListener } = supabase.auth.onAuthStateChange(() => { void syncLikes(); });
    window.addEventListener("shorttoon-liked-posts", syncLikes);
    return () => { cancelled = true; authListener.subscription.unsubscribe(); window.removeEventListener("shorttoon-liked-posts", syncLikes); };
  }, []);

  const isHomeFeed = !selectedPost && !selectedPosts;
  const toComic = (post: PublishedPost, index: number): Comic => ({ id: Number.parseInt(post.id.replace(/-/g, "").slice(0, 8), 16) || index + 1, title: post.title, creator: post.authorName ?? "시화 작가", authorId: post.authorId, authorChannelId: post.authorChannelId, authorImageUrl: post.authorImageUrl, genre: post.genre, description: post.description, createdAt: post.createdAt, likeCount: post.likeCount, commentCount: post.commentCount, viewCount: post.viewCount, accent: "#C7FF3D", publisher: "", fullUrl: "", link: post.link, commentPostId: post.id, panels: (post.imageUrls.length ? post.imageUrls : [post.coverUrl]).map((imageUrl, imageIndex) => ({ id: index * 100 + imageIndex, position: imageIndex + 1, eyebrow: `${imageIndex + 1} / ${post.imageUrls.length || 1}`, line: post.title, tone: "lime", imageUrl })) });
  const loadFeedPage = async (page: number, append: boolean) => {
    if (!isHomeFeed || feedRequestRef.current || (!append && page !== 0)) return;
    feedRequestRef.current = true;
    if (append) setFeedLoadingMore(true); else { setFeedLoading(true); setFeedError(false); }
    try {
      const result = await loadPublishedPostsPage(page, 10);
      setComics((current) => { const merged = append ? [...current, ...result.posts.map(toComic)] : result.posts.map(toComic); return Array.from(new Map(merged.map((comic) => [comic.commentPostId ?? String(comic.id), comic])).values()); });
      setFeedPage(page); setFeedHasMore(result.hasMore);
    } catch (error) { console.error("Supabase 홈 피드 조회 실패", error); if (!append) setFeedError(true); }
    finally { feedRequestRef.current = false; if (append) setFeedLoadingMore(false); else setFeedLoading(false); }
  };
  useEffect(() => { if (isHomeFeed) void loadFeedPage(0, false); }, [isHomeFeed]);

  useEffect(() => {
    if (!isHomeFeed || !feedRef.current || !comics.length) return;
    const storedIndex = Number(window.sessionStorage.getItem("shorttoon-home-target-index"));
    const requestedIndex = Number.isFinite(storedIndex) && storedIndex >= 0 ? storedIndex : initialHomeIndex;
    const index = Math.max(0, Math.min(requestedIndex, comics.length - 1));
    if (Number.isFinite(storedIndex)) window.sessionStorage.removeItem("shorttoon-home-target-index");
    feedRef.current.scrollTo({ left: index * feedRef.current.clientWidth, behavior: "auto" });
  }, [isHomeFeed, comics.length, initialHomeIndex]);

  const openComments = async (comic: Comic) => {
    setCommentComic(comic);
    try {
      if (!comic.commentPostId) throw new Error("댓글을 저장할 게시물 ID가 없습니다.");
      const loadedComments = await loadPostComments(comic.commentPostId);
      setComments(loadedComments);
      setCommentCounts((current) => ({ ...current, [comic.id]: loadedComments.length }));
      setReplyingTo(null);
    } catch (error) {
      console.error("댓글을 불러오지 못했습니다.", error);
      setComments([]);
    }
  };

  const openPostMenu = async (comic: Comic) => {
    const { data } = await supabase.auth.getUser();
    const isOwner = Boolean(data.user?.id && comic.authorId && data.user.id === comic.authorId);
    setMenuIsOwner(isOwner);
    setMenuReports([]);
    setMenuComic(comic);
    if (isOwner && comic.commentPostId) {
      try {
        setMenuReports(await loadPostReports(comic.commentPostId));
      } catch (error) {
        console.error("게시물 신고 내역을 불러오지 못했습니다", error);
      }
    }
  };

  const handlePostMenuAction = async () => {
    if (!menuComic) return;
    if (menuIsOwner && menuComic.commentPostId) {
      try {
        await deletePostFromSupabase(menuComic.commentPostId);
        setComics((current) => current.filter((comic) => comic.commentPostId !== menuComic.commentPostId));
        window.dispatchEvent(new Event("shorttoon-post-deleted"));
      } catch (error) {
        console.error("게시물 삭제에 실패했습니다", error);
        window.alert("게시물을 삭제하지 못했습니다.");
      }
    } else if (menuComic.commentPostId) {
      try {
        await reportPost(menuComic.commentPostId);
        window.alert("게시물 신고가 접수되었습니다.");
      } catch (error) {
        console.error("게시물 신고에 실패했습니다", error);
        window.alert(error instanceof Error ? error.message : "게시물 신고에 실패했습니다.");
      }
    }
    setMenuComic(null);
  };

  const submitComment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!commentComic || !body.trim()) return;
    setSubmitting(true);
    try {
      if (!commentComic.commentPostId) throw new Error("댓글을 저장할 게시물 ID가 없습니다.");
      const comment = await createPostComment(commentComic.commentPostId, channelName ?? commentComic.creator, body.trim(), isSpoiler, replyingTo?.id ? String(replyingTo.id) : null);
      setComments((current) => [{ ...comment, authorChannelId: channelId, authorImageUrl: storedProfileImageUrl }, ...current]);
      if (replyingTo) setComments((current) => current.map((item) => item.id === replyingTo.id ? { ...item, replyCount: item.replyCount + 1 } : item));
      setCommentCounts((current) => ({ ...current, [commentComic.id]: (current[commentComic.id] ?? 0) + 1 }));
      setBody("");
      setIsSpoiler(false);
      setReplyingTo(null);
    } catch (error) {
      console.error("댓글을 등록하지 못했습니다.", error);
    }
    setSubmitting(false);
  };

  const selectedCollection = selectedPosts?.length ? selectedPosts : selectedPost ? [selectedPost] : [];
  const selectedPostSetKey = selectedPosts?.map((post) => post.id ?? post.title).join("|") ?? "";
  const visibleComics = selectedCollection.length ? selectedCollection.map((post, postIndex) => ({ id: -1000 - postIndex, title: post.title, creator: post.authorName ?? "시화 작가", authorId: post.authorId, authorChannelId: post.authorChannelId, authorImageUrl: post.authorImageUrl, genre: post.genre, description: post.description, createdAt: post.createdAt, likeCount: post.likeCount, viewCount: post.viewCount, accent: "#C7FF3D", publisher: "", fullUrl: "", link: post.link, commentPostId: post.id, panels: (post.imageUrls.length ? post.imageUrls : [post.coverUrl]).map((imageUrl, index) => ({ id: -100000 - postIndex * 100 - index, position: index + 1, eyebrow: `${index + 1} / ${post.imageUrls.length || 1}`, line: post.title, tone: "lime", imageUrl })) })) : comics;

  useEffect(() => {
    const handleLikeClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest<HTMLButtonElement>(".like-action");
      if (!button) return;
      const article = button.closest<HTMLElement>(".comic-column");
      const index = article ? Array.from(article.parentElement?.children ?? []).indexOf(article) : -1;
      const comic = visibleComics[index];
      const postId = comic?.commentPostId;
      if (!postId) return;
      const current = likedPostIds;
      const next = current.includes(postId) ? current.filter((id) => id !== postId) : Array.from(new Set([...current, postId]));
      const currentLikeCount = likeCountOverrides[comic.id] ?? comic.likeCount ?? 0;
      setLikeCountOverrides((counts) => ({ ...counts, [comic.id]: Math.max(0, currentLikeCount + (next.includes(postId) ? 1 : -1)) }));
      setLikedPostIds(next);
      void syncPostLike(postId, next.includes(postId)).then(() => window.dispatchEvent(new Event("shorttoon-liked-posts"))).catch((error) => console.error("게시물 좋아요 저장 실패", error));
    };
    document.addEventListener("click", handleLikeClick, true);
    return () => document.removeEventListener("click", handleLikeClick, true);
  }, [visibleComics, likeCountOverrides, likedPostIds]);

  useEffect(() => {
    const handleAuthorClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest(".comic-author")) return;
      const article = target.closest<HTMLElement>(".comic-column");
      const index = article ? Array.from(article.parentElement?.children ?? []).indexOf(article) : -1;
      const comic = visibleComics[index];
      if (comic) {
        if (onOpenChannel) onOpenChannel(comic);
        else window.dispatchEvent(new CustomEvent("shorttoon-open-channel", { detail: { authorId: comic.authorId ?? null, postIndex: index } }));
      }
    };
    document.addEventListener("click", handleAuthorClick);
    return () => document.removeEventListener("click", handleAuthorClick);
  }, [onOpenChannel, visibleComics]);

  useEffect(() => {
    const buttons = document.querySelectorAll<HTMLButtonElement>(".comic-column .like-action");
    buttons.forEach((button, index) => {
      const post = selectedCollection[index];
      const comic = visibleComics[index];
      const liked = comic?.commentPostId ? likedPostIds.includes(comic.commentPostId) : Boolean(comic && likedComics[comic.id]);
      button.classList.toggle("liked", liked);
      button.setAttribute("aria-pressed", String(liked));
    });
  }, [likedPostIds, likedComics, selectedCollection, visibleComics]);

  useEffect(() => {
    if (!selectedPosts?.length || !feedRef.current) return;
    feedRef.current.scrollTo({ left: selectedPostIndex * feedRef.current.clientWidth, behavior: "auto" });
  }, [selectedPostSetKey]);

  useEffect(() => {
    const feed = feedRef.current;
    if (!feed) return;
    const preventNativeHorizontalScroll = (event: TouchEvent) => {
      const startX = horizontalGestureStartX.current;
      const startY = horizontalGestureStartY.current;
      const touch = event.touches[0];
      if (startX === null || startY === null || !touch) return;
      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 4) event.preventDefault();
    };
    feed.addEventListener("touchmove", preventNativeHorizontalScroll, { passive: false });
    return () => feed.removeEventListener("touchmove", preventNativeHorizontalScroll);
  }, []);

  const moveOnePost = (direction: 1 | -1) => {
    const feed = feedRef.current;
    if (!feed || visibleComics.length < 2) return;
    const currentIndex = Math.max(0, Math.min(visibleComics.length - 1, Math.round(feed.scrollLeft / feed.clientWidth)));
    const targetIndex = Math.max(0, Math.min(visibleComics.length - 1, currentIndex + direction));
    feed.scrollTo({ left: targetIndex * feed.clientWidth, behavior: "smooth" });
  };

  const orderedComments = comments.flatMap((comment) => comment.parentId ? [] : [comment, ...comments.filter((reply) => reply.parentId === comment.id)]);

  return (
    <section className="feed-wrap" aria-label="Shorttoon comic feed">
      {isHomeFeed && feedLoading && <div className="feed-state" role="status">숏툰을 불러오는 중...</div>}
      {isHomeFeed && feedError && <div className="feed-state feed-error" role="alert"><p>숏툰을 불러오지 못했습니다.</p><button type="button" onClick={() => void loadFeedPage(0, false)}>다시 시도</button></div>}
      {isHomeFeed && !feedLoading && !feedError && visibleComics.length === 0 && <div className="feed-state" role="status">아직 게시된 숏툰이 없습니다.</div>}
      {selectedPost && onExitPost && <button className="post-view-back" type="button" onClick={() => { onExitPost(); window.dispatchEvent(new Event("shorttoon-post-back")); }} aria-label="이전 페이지로 돌아가기">←</button>}
      <div ref={feedRef} className={`comic-feed ${selectedPosts?.length ? "channel-feed" : ""} ${isHomeFeed && (feedLoading || feedError || visibleComics.length === 0) ? "feed-content-hidden" : ""}`} onWheel={(event) => {
        if (Math.abs(event.deltaX) <= Math.abs(event.deltaY) && !event.shiftKey) return;
        event.preventDefault();
        moveOnePost(event.deltaX >= 0 || event.deltaY >= 0 ? 1 : -1);
      }} onPointerDown={(event) => {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        horizontalGestureStartX.current = event.clientX;
        horizontalGestureStartY.current = event.clientY;
        horizontalGestureStartIndex.current = feedRef.current ? Math.round(feedRef.current.scrollLeft / feedRef.current.clientWidth) : 0;
        event.currentTarget.setPointerCapture?.(event.pointerId);
      }} onPointerUp={(event) => {
        const startX = horizontalGestureStartX.current;
        horizontalGestureStartX.current = null;
        horizontalGestureStartY.current = null;
        if (startX === null) return;
        const endX = event.clientX;
        const delta = endX - startX;
        const feed = feedRef.current;
        if (!feed || Math.abs(delta) < 30) {
          if (feed) feed.scrollTo({ left: horizontalGestureStartIndex.current * feed.clientWidth, behavior: "smooth" });
          return;
        }
        const targetIndex = Math.max(0, Math.min(visibleComics.length - 1, horizontalGestureStartIndex.current + (delta < 0 ? 1 : -1)));
        feed.scrollTo({ left: targetIndex * feed.clientWidth, behavior: "smooth" });
      }} onPointerCancel={() => {
        horizontalGestureStartX.current = null;
        horizontalGestureStartY.current = null;
      }} onScroll={(event) => {
        const width = event.currentTarget.clientWidth;
        if (!width) return;
        const nextIndex = Math.max(0, Math.min(visibleComics.length - 1, Math.round(event.currentTarget.scrollLeft / width)));
        if (isHomeFeed) setFeedCurrentIndex(nextIndex);
        if (selectedPosts?.length && onSelectedPostChange && nextIndex !== selectedPostIndex) onSelectedPostChange(nextIndex);
        if (isHomeFeed && feedHasMore && !feedLoadingMore && nextIndex >= visibleComics.length - 3) void loadFeedPage(feedPage + 1, true);
      }}>
        {visibleComics.map((comic, comicIndex) => (
          <article className={`comic-column ${comic.commentPostId ? "uploaded-comic" : ""} ${isHomeFeed ? "home-comic" : ""}`} key={comic.id} aria-label={comic.title}>
            <button className="more-button post-kebab" type="button" aria-label="게시물 메뉴" onClick={() => void openPostMenu(comic)}>⋮</button>
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
                <section className={`comic-panel tone-${panel.tone} ${comic.commentPostId ? "uploaded-panel" : ""}`} key={panel.id}>
                  <div className="panel-art" aria-hidden="true">{panel.imageUrl ? <img className="panel-art-image" src={panel.imageUrl} alt="" loading={comic.commentPostId ? "eager" : "lazy"} /> : <><i /><b /><em /></>}</div>
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
              <button type="button" className={`like-action ${likedComics[comic.id] ? "liked" : ""}`} onClick={() => setLikedComics((current) => ({ ...current, [comic.id]: !current[comic.id] }))} aria-label={`${likedComics[comic.id] ? "Unlike" : "Like"} ${comic.title}`} aria-pressed={Boolean(likedComics[comic.id])}><span aria-hidden="true">♥</span><small>{likeCountOverrides[comic.id] ?? comic.likeCount ?? 0}</small></button>
              <button type="button" onClick={() => openComments(comic)} aria-label={`${comic.title} 댓글 보기`}><span>•••</span><small>{commentCounts[comic.id] ?? comic.commentCount ?? 0}</small></button>
              <button type="button" className={`save-action ${savedComics[comic.id] ? "saved" : ""}`} onClick={() => setSavedComics((current) => ({ ...current, [comic.id]: !current[comic.id] }))} aria-label={`${savedComics[comic.id] ? "Remove" : "Save"} ${comic.title}`} aria-pressed={Boolean(savedComics[comic.id])}><span className="save-symbol" aria-hidden="true" /><small>저장</small></button>
              <a href={comic.fullUrl} target="_blank" rel="noreferrer" aria-label={`Open full ${comic.title} on ${comic.publisher}`}><span>↗</span><small>공유</small></a>
            </div>
            <footer className={`comic-meta ${metaHidden[comic.id] ? "meta-hidden" : ""}`}>
              <div><div className="comic-author" role="button" tabIndex={0} aria-label={`${comic.creator} 채널 보기`} onClick={() => onOpenChannel ? onOpenChannel(comic) : window.dispatchEvent(new CustomEvent("shorttoon-open-channel", { detail: { authorId: comic.authorId ?? null, postIndex: comicIndex } }))} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpenChannel ? onOpenChannel(comic) : window.dispatchEvent(new CustomEvent("shorttoon-open-channel", { detail: { authorId: comic.authorId ?? null, postIndex: comicIndex } })); } }}><span className="post-author-avatar" aria-hidden="true" style={(comic.authorImageUrl || (!comic.commentPostId && storedProfileImageUrl)) ? { backgroundImage: `url(${comic.authorImageUrl || storedProfileImageUrl})` } : undefined} /><small>{comic.authorChannelId ? `@${comic.authorChannelId}` : comic.creator}</small></div><button className="comic-title-button" type="button" onClick={() => setInfoComic(comic)}>{comic.title}</button><div className="comic-tag-cluster">{comic.link && <a className="comic-tag-pill" href={comic.link.url} target="_blank" rel="noreferrer">{comic.link.title}</a>}{comic.genre.split(" · ").filter(Boolean).map((genre) => <span className="comic-tag-pill" key={genre}>{genre}</span>)}</div></div>
            </footer>
          </article>
        ))}
      </div>
      {isHomeFeed && feedLoadingMore && <div className="feed-loading-more" role="status">숏툰을 더 불러오는 중...</div>}
      {commentComic && <div className="sheet-backdrop" role="presentation" onClick={() => setCommentComic(null)}>
        <aside className="comment-sheet" role="dialog" aria-modal="true" aria-label={`${commentComic.title} 댓글`} onClick={(event) => event.stopPropagation()}>
          <div className="sheet-handle" />
          <header><div aria-hidden="true" /><button type="button" onClick={() => setCommentComic(null)} aria-label="댓글창 닫기">×</button></header>
          <div className="comment-list">
            {comments.length === 0 && <p className="no-comments">첫 댓글을 남겨보세요.</p>}
            {orderedComments.map((comment) => {
              const hidden = Boolean(comment.isSpoiler) && !revealed.has(comment.id);
              const parentComment = comment.parentId ? comments.find((item) => String(item.id) === String(comment.parentId)) : null;
              const parentChannelId = parentComment?.authorChannelId;
              return <article className={`comment-card ${hidden ? "spoiler-hidden" : ""}`} data-reply={comment.parentId ? "true" : undefined} key={comment.id}>
                <div className="comment-author-line"><span className="comment-author-avatar" aria-hidden="true" style={comment.authorImageUrl ? { backgroundImage: `url(${comment.authorImageUrl})` } : undefined} /><div className="comment-author-meta"><strong>{comment.authorChannelId ? `@${comment.authorChannelId}` : comment.author}</strong>{parentChannelId && <button className="comment-reply-target" type="button" onClick={() => { if (parentComment?.authorId) window.dispatchEvent(new CustomEvent("shorttoon-open-channel", { detail: { authorId: parentComment.authorId } })); }}><span className="comment-target-arrow" aria-hidden="true">↳</span><span>@{parentChannelId}</span></button>}</div>{Boolean(comment.isSpoiler) && <span className="comment-spoiler-label">SPOILER</span>}</div>
                <p>{hidden ? "스포일러가 포함된 댓글입니다." : comment.body}</p>
                {hidden && <button type="button" onClick={() => setRevealed((current) => new Set(current).add(comment.id))}>스포일러 보기</button>}
                <div className="comment-actions">
                  <button type="button" className={`comment-like-button ${comment.likedByMe ? "is-liked" : ""}`} aria-pressed={comment.likedByMe} onClick={async () => {
                    const nextLiked = !comment.likedByMe;
                    setComments((current) => current.map((item) => item.id === comment.id ? { ...item, likedByMe: nextLiked, likeCount: Math.max(0, item.likeCount + (nextLiked ? 1 : -1)) } : item));
                    try { await toggleCommentLike(String(comment.id), nextLiked); } catch (error) {
                      console.error("댓글 좋아요 저장 실패", error);
                      setComments((current) => current.map((item) => item.id === comment.id ? { ...item, likedByMe: comment.likedByMe, likeCount: comment.likeCount } : item));
                    }
                  }}><span className="comment-like-symbol" aria-hidden="true">♥</span><small>{comment.likeCount}</small></button>
                  <button type="button" className="comment-reply-button" onClick={() => { setReplyingTo(comment); setBody(""); }}><span className="comment-reply-symbol" aria-hidden="true" /><small>{comment.replyCount}</small></button>
                </div>
              </article>;
            })}
          </div>
          <form className="comment-form" onSubmit={submitComment}>
            {replyingTo && <div className="replying-to">{replyingTo.authorChannelId ? `@${replyingTo.authorChannelId}` : replyingTo.author}에게 답글 <button type="button" onClick={() => setReplyingTo(null)}>취소</button></div>}
            <textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder={replyingTo ? "답글을 입력하세요" : "댓글을 입력하세요"} maxLength={500} aria-label={replyingTo ? "답글" : "댓글"} required />
            <div><label><input type="checkbox" checked={isSpoiler} onChange={(event) => setIsSpoiler(event.target.checked)} /> 스포일러 포함</label><button type="submit" disabled={submitting}>{submitting ? "등록 중..." : "등록"}</button></div>
          </form>
        </aside>
      </div>}
      {menuComic && <div className="sheet-backdrop" role="presentation" onClick={() => setMenuComic(null)}>
        <aside className="comment-sheet post-menu-sheet" role="dialog" aria-modal="true" aria-label="게시물 메뉴" onClick={(event) => event.stopPropagation()}>
          <div className="sheet-handle" />
          <header><strong>{menuIsOwner ? "게시물 관리" : "게시물 신고"}</strong><button type="button" onClick={() => setMenuComic(null)} aria-label="닫기">×</button></header>
          {menuIsOwner && <div className="post-report-summary"><strong>신고 {menuReports.length}건</strong>{menuReports.length > 0 ? <ul>{menuReports.map((report) => <li key={`${report.reporterId}-${report.createdAt}`}><span>@{report.channelId}</span><time dateTime={report.createdAt}>{new Date(report.createdAt).toLocaleString("ko-KR")}</time></li>)}</ul> : <p>접수된 신고가 없습니다.</p>}</div>}
          <button className={`post-menu-action ${menuIsOwner ? "danger" : ""}`} type="button" onClick={() => void handlePostMenuAction()}>{menuIsOwner ? "게시물 삭제" : "게시물 신고"}</button>
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
