"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { createPostComment, loadPostComments, toggleCommentLike } from "../../lib/comments";
import { loadUserLikedPostIds, syncPostLike } from "../../lib/likes";
import { deletePostFromSupabase, loadPublishedPostsPage, type PublishedPost } from "../../lib/posts";
import { REPORT_CATEGORIES, reportPost, type ReportCategory } from "../../lib/reports";
import { reportRelayTopic, loadRelayTopicComments, loadRelayTopicCommentCount, createRelayTopicComment, toggleRelayTopicCommentLike, type RelayParticipant } from "../../lib/relay";
import { loadPostViewCounts, recordPostView } from "../../lib/views";

type Panel = { id: number; position: number; eyebrow: string; line: string; tone: string; imageUrl?: string; relayParticipant?: RelayParticipant | null };
type Comic = { id: number; title: string; creator: string; authorId?: string | null; authorChannelId?: string | null; participantCount?: number; participants?: RelayParticipant[]; pageParticipants?: Array<RelayParticipant | null>; authorImageUrl?: string | null; genre: string; accent: string; publisher: string; fullUrl: string; panels: Panel[]; description?: string; allowComments?: boolean; createdAt?: string; likeCount?: number; commentCount?: number; viewCount?: number; link?: { title: string; url: string }; commentPostId?: string; isRelay?: boolean; relayId?: string };
type SelectedPost = { id?: string; authorId?: string | null; authorChannelId?: string | null; participantCount?: number; participants?: RelayParticipant[]; pageParticipants?: Array<RelayParticipant | null>; authorImageUrl?: string | null; title: string; coverUrl: string; imageUrls: string[]; genre: string; description?: string; allowComments?: boolean; createdAt?: string; likeCount?: number; commentCount?: number; viewCount?: number; link?: { title: string; url: string }; authorName?: string; isRelay?: boolean; relayId?: string };
type Comment = { id: number | string; comicId: number | string; author: string; authorId?: string | null; authorChannelId?: string | null; authorImageUrl?: string | null; replyToOwnerId?: string; replyToChannelId?: string; body: string; isSpoiler: number | boolean; createdAt: number; parentId?: string | null; likeCount: number; likedByMe: boolean; replyCount: number };
type CommentMentionTarget = { ownerId: string; channelId: string };
type CommentRestore = { postId?: string; relayId?: string; commentId?: string; scrollTop?: number; body?: string; mentionTarget?: CommentMentionTarget | null };

function CommentEditor({ initialValue, resetKey, placeholder, disabled, onValueChange }: { initialValue: string; resetKey: number; placeholder: string; disabled: boolean; onValueChange: (value: string) => void }) {
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const resizeEditor = (editor: HTMLTextAreaElement) => {
    editor.style.height = "auto";
    editor.style.height = `${Math.min(editor.scrollHeight + 2, 180)}px`;
  };

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.value = initialValue;
    resizeEditor(editor);
  }, [resetKey]);

  // Let the browser retain its IME composition and selection while typing.
  return <textarea ref={editorRef} className="comment-editor" rows={1} maxLength={500} defaultValue={initialValue} placeholder={placeholder} disabled={disabled} aria-label="댓글 입력" onChange={(event) => { onValueChange(event.currentTarget.value); resizeEditor(event.currentTarget); }} />;
}
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

export function ComicFeed({ selectedPost, selectedPosts, selectedPostIndex = 0, initialHomeIndex = 0, onSelectedPostChange, onExitPost, onOpenChannel, onOpenRelayParticipants, onSearchGenre, onRelayLike, onRelayView, onRelayDelete, onRelayJoin, channelName, channelId, profileImageUrl, legacyChannelNames = [], restoreComment, onCommentRestored, isAuthenticated = false }: { selectedPost?: SelectedPost | null; selectedPosts?: SelectedPost[]; selectedPostIndex?: number; initialHomeIndex?: number; onSelectedPostChange?: (index: number) => void; onExitPost?: () => void; onOpenChannel?: (comic: Comic) => void; onOpenRelayParticipants?: (participants: RelayParticipant[], relayId: string) => void; onRelayLike?: (relayId: string, liked: boolean) => Promise<number | null>; onRelayView?: (relayId: string) => Promise<{ counted: boolean; count: number } | null>; onRelayDelete?: (relayId: string) => Promise<void>; onRelayJoin?: (relayId: string) => void; channelName?: string; channelId?: string; profileImageUrl?: string | null; legacyChannelNames?: string[]; restoreComment?: CommentRestore | null; onCommentRestored?: () => void; isAuthenticated?: boolean }) {
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
  const [viewCountOverrides, setViewCountOverrides] = useState<Record<number, number>>({});
  const [participantCountOverrides, setParticipantCountOverrides] = useState<Record<number, number>>({});
  const [likedPostIds, setLikedPostIds] = useState<string[]>([]);
  const [savedComics, setSavedComics] = useState<Record<number, boolean>>({});
  const [metaHidden, setMetaHidden] = useState<Record<number, boolean>>({});
  const [commentComic, setCommentComic] = useState<Comic | null>(null);
  const [menuComic, setMenuComic] = useState<Comic | null>(null);
  const [menuIsOwner, setMenuIsOwner] = useState(false);
  const [infoComic, setInfoComic] = useState<Comic | null>(null);
  const [reportComic, setReportComic] = useState<Comic | null>(null);
  const [reportCategory, setReportCategory] = useState<ReportCategory | null>(null);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentCounts, setCommentCounts] = useState<Record<number, number>>({});
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [body, setBody] = useState("");
  const [mentionTarget, setMentionTarget] = useState<CommentMentionTarget | null>(null);
  const [commentEditorResetKey, setCommentEditorResetKey] = useState(0);
  const [isSpoiler, setIsSpoiler] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);
  const [expandedCommentIds, setExpandedCommentIds] = useState<Set<string>>(new Set());
  const [storedProfileImageUrl, setStoredProfileImageUrl] = useState(profileImageUrl ?? null);
  const lastScrollTop = useRef<Record<number, number>>({});
  const feedRef = useRef<HTMLDivElement>(null);
  const horizontalGestureStartX = useRef<number | null>(null);
  const horizontalGestureStartY = useRef<number | null>(null);
  const horizontalGestureStartIndex = useRef(0);
  const homePositionedRef = useRef(false);
  const restoredCommentKey = useRef<string | null>(null);
  const viewTimers = useRef<Map<string, number>>(new Map());

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
  const toComic = (post: PublishedPost, index: number): Comic => ({ id: Number.parseInt(post.id.replace(/-/g, "").slice(0, 8), 16) || index + 1, title: post.title, creator: post.authorName ?? "시화 작가", authorId: post.authorId, authorChannelId: post.authorChannelId, participantCount: post.participantCount, authorImageUrl: post.authorImageUrl, genre: post.genre, description: post.description, allowComments: post.allowComments, createdAt: post.createdAt, likeCount: post.likeCount, commentCount: post.commentCount, viewCount: post.viewCount, accent: "#C7FF3D", publisher: "", fullUrl: "", link: post.link, commentPostId: post.id, panels: (post.imageUrls.length ? post.imageUrls : [post.coverUrl]).map((imageUrl, imageIndex) => ({ id: index * 100 + imageIndex, position: imageIndex + 1, eyebrow: `${imageIndex + 1} / ${post.imageUrls.length || 1}`, line: post.title, tone: "lime", imageUrl })) });
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
    if (!isHomeFeed) homePositionedRef.current = false;
  }, [isHomeFeed]);

  useEffect(() => {
    if (!isHomeFeed || homePositionedRef.current || !feedRef.current || !comics.length) return;
    const storedIndex = Number(window.sessionStorage.getItem("shorttoon-home-target-index"));
    const requestedIndex = Number.isFinite(storedIndex) && storedIndex >= 0 ? storedIndex : initialHomeIndex;
    const index = Math.max(0, Math.min(requestedIndex, comics.length - 1));
    if (Number.isFinite(storedIndex)) window.sessionStorage.removeItem("shorttoon-home-target-index");
    feedRef.current.scrollTo({ left: index * feedRef.current.clientWidth, behavior: "auto" });
    homePositionedRef.current = true;
  }, [isHomeFeed, comics.length, initialHomeIndex]);

  const openComments = async (comic: Comic, restore?: CommentRestore, prefilledMention?: CommentMentionTarget) => {
    setCommentComic(comic);
    const nextMentionTarget = restore?.mentionTarget ?? prefilledMention ?? null;
    setMentionTarget(nextMentionTarget);
    setBody(restore?.body ?? "");
    setCommentEditorResetKey((key) => key + 1);
    try {
      if (!comic.commentPostId && !comic.relayId) throw new Error("댓글을 저장할 게시물 ID가 없습니다.");
      const [loadedComments, totalCount] = comic.relayId
        ? await Promise.all([loadRelayTopicComments(comic.relayId), loadRelayTopicCommentCount(comic.relayId)])
        : [await loadPostComments(comic.commentPostId!), null];
      setComments(loadedComments);
      const commentCount = totalCount ?? loadedComments.length;
      setCommentCounts((current) => ({ ...current, [comic.id]: commentCount }));
      if (comic.relayId) window.dispatchEvent(new CustomEvent("shorttoon-relay-comment-count", { detail: { topicId: comic.relayId, commentCount } }));
      setReplyingTo(null);
      if (restore) {
        window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
          const list = document.querySelector<HTMLElement>(".comment-list");
          if (!list) return;
          if (typeof restore.scrollTop === "number") list.scrollTop = restore.scrollTop;
          if (restore.commentId) list.querySelector<HTMLElement>(`[data-comment-id="${CSS.escape(restore.commentId)}"]`)?.scrollIntoView({ block: "center", behavior: "auto" });
        }));
      }
    } catch (error) {
      console.error("댓글을 불러오지 못했습니다.", error);
      setComments([]);
    }
  };

  const openPostMenu = async (comic: Comic) => {
    const { data } = await supabase.auth.getUser();
    const isOwner = Boolean(data.user?.id && comic.authorId && data.user.id === comic.authorId);
    setMenuIsOwner(isOwner);
    setMenuComic(comic);
  };

  const handlePostMenuAction = async () => {
    if (!menuComic) return;
    if (!menuIsOwner && (menuComic.commentPostId || menuComic.relayId)) {
      setReportComic(menuComic);
      setReportCategory(null);
      setMenuComic(null);
      return;
    }
    if (menuIsOwner && menuComic.isRelay && menuComic.relayId) {
      try {
        await onRelayDelete?.(menuComic.relayId);
        setComics((current) => current.filter((comic) => comic.relayId !== menuComic.relayId));
        window.dispatchEvent(new Event("shorttoon-post-deleted"));
      } catch (error) {
        console.error("릴레이툰 삭제에 실패했습니다", error);
        window.alert("릴레이툰을 삭제하지 못했습니다.");
      }
    } else if (menuIsOwner && menuComic.commentPostId) {
      try {
        await deletePostFromSupabase(menuComic.commentPostId);
        setComics((current) => current.filter((comic) => comic.commentPostId !== menuComic.commentPostId));
        window.dispatchEvent(new Event("shorttoon-post-deleted"));
      } catch (error) {
        console.error("게시물 삭제에 실패했습니다", error);
        window.alert("게시물을 삭제하지 못했습니다.");
      }
    }
    setMenuComic(null);
  };

  const submitReport = async () => {
    if ((!reportComic?.commentPostId && !reportComic?.relayId) || !reportCategory) return;
    setReportSubmitting(true);
    try {
      if (reportComic.relayId) await reportRelayTopic(reportComic.relayId, reportCategory);
      else await reportPost(reportComic.commentPostId!, reportCategory);
      setReportComic(null);
      setReportCategory(null);
      window.alert("\uAC8C\uC2DC\uBB3C \uC2E0\uACE0\uAC00 \uC811\uC218\uB418\uC5C8\uC2B5\uB2C8\uB2E4.");
    } catch (error) {
      console.error("\uAC8C\uC2DC\uBB3C \uC2E0\uACE0 \uC2E4\uD328", error);
      window.alert(error instanceof Error ? error.message : "\uAC8C\uC2DC\uBB3C \uC2E0\uACE0\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.");
    } finally {
      setReportSubmitting(false);
    }
  };

  const submitComment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!commentComic || !body.trim()) return;
    setSubmitting(true);
    try {
      if (!commentComic.commentPostId && !commentComic.relayId) throw new Error("댓글을 저장할 게시물 ID가 없습니다.");
      const comment = commentComic.relayId
        ? await createRelayTopicComment(commentComic.relayId, body.trim(), isSpoiler, replyingTo?.id ? String(replyingTo.id) : null, replyingTo ? null : mentionTarget)
        : await createPostComment(commentComic.commentPostId!, channelName ?? commentComic.creator, body.trim(), isSpoiler, replyingTo?.id ? String(replyingTo.id) : null);
      setComments((current) => [{ ...comment, authorChannelId: channelId, authorImageUrl: storedProfileImageUrl }, ...current]);
      if (replyingTo) setComments((current) => current.map((item) => item.id === replyingTo.id ? { ...item, replyCount: item.replyCount + 1 } : item));
      const nextCommentCount = (commentCounts[commentComic.id] ?? commentComic.commentCount ?? 0) + 1;
      setCommentCounts((current) => ({ ...current, [commentComic.id]: nextCommentCount }));
      if (commentComic.relayId) window.dispatchEvent(new CustomEvent("shorttoon-relay-comment-count", { detail: { topicId: commentComic.relayId, commentCount: nextCommentCount } }));
      setBody("");
      setMentionTarget(null);
      setCommentEditorResetKey((key) => key + 1);
      setIsSpoiler(false);
      setReplyingTo(null);
    } catch (error) {
      console.error("댓글을 등록하지 못했습니다.", error);
    }
    setSubmitting(false);
  };

  const selectedCollection = selectedPosts?.length ? selectedPosts : selectedPost ? [selectedPost] : [];
  const selectedPostSetKey = selectedPosts?.map((post) => post.id ?? post.title).join("|") ?? "";
  const visibleComics = selectedCollection.length ? selectedCollection.map((post, postIndex) => ({ id: -1000 - postIndex, title: post.title, creator: post.authorName ?? "시화 작가", authorId: post.authorId, authorChannelId: post.authorChannelId, participantCount: post.participantCount, participants: post.participants, pageParticipants: post.pageParticipants, authorImageUrl: post.authorImageUrl, genre: post.genre, description: post.description, allowComments: post.allowComments, createdAt: post.createdAt, likeCount: post.likeCount, commentCount: post.commentCount, viewCount: post.viewCount, accent: "#C7FF3D", publisher: "", fullUrl: "", link: post.link, commentPostId: post.isRelay ? undefined : post.id, isRelay: post.isRelay, relayId: post.relayId, panels: (post.imageUrls.length ? post.imageUrls : [post.coverUrl]).map((imageUrl, index) => ({ id: -100000 - postIndex * 100 - index, position: index + 1, eyebrow: post.isRelay ? "" : `${index + 1} / ${post.imageUrls.length || 1}`, line: post.isRelay ? "" : post.title, tone: "lime", imageUrl, relayParticipant: post.pageParticipants?.[index] ?? null })) })) : comics;

  useEffect(() => {
    const openRelayComment = (event: Event) => {
      const detail = (event as CustomEvent<{ relayId?: string; participant?: CommentMentionTarget }>).detail;
      if (!detail?.relayId || !detail.participant) return;
      if (!isAuthenticated) { window.dispatchEvent(new Event("shorttoon-login-required")); return; }
      const comic = visibleComics.find((item) => item.relayId === detail.relayId);
      if (comic) void openComments(comic, undefined, detail.participant);
    };
    window.addEventListener("shorttoon-open-relay-comment", openRelayComment);
    return () => window.removeEventListener("shorttoon-open-relay-comment", openRelayComment);
  }, [visibleComics, isAuthenticated]);

  useEffect(() => {
    const updateRelayParticipantCount = (event: Event) => {
      const detail = (event as CustomEvent<{ topicId?: string; participantCount?: number }>).detail;
      const comic = visibleComics.find((item) => item.relayId === detail?.topicId);
      if (comic && typeof detail?.participantCount === "number") setParticipantCountOverrides((current) => ({ ...current, [comic.id]: detail.participantCount! }));
    };
    window.addEventListener("shorttoon-relay-participant-count", updateRelayParticipantCount);
    return () => window.removeEventListener("shorttoon-relay-participant-count", updateRelayParticipantCount);
  }, [visibleComics]);

  useEffect(() => {
    document.querySelectorAll<HTMLElement>(".comic-author.has-relay-avatar").forEach((author) => {
      author.classList.remove("has-relay-avatar");
      author.style.removeProperty("--relay-avatar-image");
    });
  }, [selectedPostSetKey]);

  useEffect(() => {
    const relayLiked = Object.fromEntries(visibleComics.filter((comic) => comic.isRelay).map((comic) => [comic.id, Boolean(selectedCollection.find((post) => post.relayId === comic.relayId)?.likedByMe)]));
    if (Object.keys(relayLiked).length) setLikedComics((current) => ({ ...current, ...relayLiked }));
  }, [selectedPostSetKey]);

  useEffect(() => {
    const postIds = visibleComics.map((comic) => comic.commentPostId).filter((id): id is string => Boolean(id));
    if (!postIds.length) return;
    loadPostViewCounts(postIds).then((counts) => {
      setViewCountOverrides((current) => ({ ...current, ...Object.fromEntries(visibleComics.map((comic) => [comic.id, counts[comic.commentPostId ?? ""] ?? comic.viewCount ?? 0])) }));
    }).catch((error) => console.error("게시물 조회수 불러오기 실패", error));
  }, [selectedPostSetKey, comics.length]);

  useEffect(() => {
    viewTimers.current.forEach((timer) => window.clearTimeout(timer));
    viewTimers.current.clear();
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const element = entry.target as HTMLElement;
        const postId = element.dataset.postId;
        const relayId = element.dataset.relayId;
        const metricId = postId ?? relayId;
        if (!metricId) return;
        const existing = viewTimers.current.get(metricId);
        if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
          if (existing) return;
          const timer = window.setTimeout(() => {
            void Promise.resolve(relayId ? onRelayView?.(relayId) : recordPostView(postId!)).then((counted) => {
              if (counted) {
                const comic = visibleComics.find((item) => item.commentPostId === postId || item.relayId === relayId);
                if (comic) setViewCountOverrides((current) => ({ ...current, [comic.id]: relayId && typeof counted === "object" ? counted.count : (current[comic.id] ?? comic.viewCount ?? 0) + 1 }));
              }
            }).catch((error) => console.error("게시물 조회수 기록 실패", error)).finally(() => viewTimers.current.delete(metricId));
          }, 3000);
          viewTimers.current.set(metricId, timer);
        } else if (existing) {
          window.clearTimeout(existing);
          viewTimers.current.delete(metricId);
        }
      });
    }, { threshold: [0.6] });
    feedRef.current?.querySelectorAll<HTMLElement>(".comic-column[data-post-id], .comic-column[data-relay-id]").forEach((element) => observer.observe(element));
    return () => { observer.disconnect(); viewTimers.current.forEach((timer) => window.clearTimeout(timer)); viewTimers.current.clear(); };
  }, [selectedPostSetKey, comics.length]);

  useEffect(() => {
    const pendingRestore = restoreComment ?? (() => {
      try { return JSON.parse(window.sessionStorage.getItem("shorttoon-comment-restore") ?? "null") as CommentRestore | null; } catch { return null; }
    })();
    if (!pendingRestore || !visibleComics.length) return;
    const key = `${pendingRestore.postId}:${pendingRestore.commentId ?? ""}`;
    if (restoredCommentKey.current === key) return;
    const comic = visibleComics.find((item) => (pendingRestore.relayId && item.relayId === pendingRestore.relayId) || (pendingRestore.postId && item.commentPostId === pendingRestore.postId));
    if (!comic) return;
    restoredCommentKey.current = key;
    void openComments(comic, pendingRestore, pendingRestore.mentionTarget ?? undefined).finally(() => {
      window.sessionStorage.removeItem("shorttoon-comment-restore");
      onCommentRestored?.();
    });
  }, [restoreComment, visibleComics]);

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
        if (comic.isRelay && comic.participants && comic.participants.length > 1 && comic.relayId) {
          if (onOpenRelayParticipants) onOpenRelayParticipants(comic.participants, comic.relayId);
          else window.dispatchEvent(new CustomEvent("shorttoon-open-relay-participants", { detail: { participants: comic.participants, relayId: comic.relayId } }));
          return;
        }
        if (onOpenChannel) onOpenChannel(comic);
        else window.dispatchEvent(new CustomEvent("shorttoon-open-channel", { detail: { authorId: comic.authorId ?? null, postIndex: index } }));
      }
    };
    document.addEventListener("click", handleAuthorClick);
    return () => document.removeEventListener("click", handleAuthorClick);
  }, [onOpenChannel, onOpenRelayParticipants, visibleComics]);

  // 릴레이툰 참여자 버튼은 인라인 채널 이동 핸들러보다 먼저 가로채어
  // 참여자 목록을 열고, 기존 채널 이동을 실행하지 않는다.
  useEffect(() => {
    const interceptRelayAuthorClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest(".comic-author")) return;
      const article = target.closest<HTMLElement>(".comic-column");
      const index = article ? Array.from(article.parentElement?.children ?? []).indexOf(article) : -1;
      const comic = visibleComics[index];
      if (!comic?.isRelay || !comic.participants || comic.participants.length <= 1 || !comic.relayId) return;
      event.preventDefault();
      event.stopPropagation();
      if (onOpenRelayParticipants) onOpenRelayParticipants(comic.participants, comic.relayId);
      else window.dispatchEvent(new CustomEvent("shorttoon-open-relay-participants", { detail: { participants: comic.participants, relayId: comic.relayId } }));
    };
    document.addEventListener("click", interceptRelayAuthorClick, true);
    return () => document.removeEventListener("click", interceptRelayAuthorClick, true);
  }, [onOpenRelayParticipants, visibleComics]);

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

  const orderedComments = (() => {
    const result: Comment[] = [];
    const appendReplies = (parentId: number | string) => {
      comments.filter((reply) => String(reply.parentId) === String(parentId)).forEach((reply) => {
        result.push(reply);
        appendReplies(reply.id);
      });
    };
    comments.filter((comment) => !comment.parentId).forEach((comment) => {
      result.push(comment);
      appendReplies(comment.id);
    });
    return result;
  })();
  const collectDescendantIds = (parentId: string): string[] => comments.filter((comment) => String(comment.parentId) === parentId).flatMap((comment) => [String(comment.id), ...collectDescendantIds(String(comment.id))]);
  const countDescendants = (parentId: string): number => comments.filter((comment) => String(comment.parentId) === parentId).reduce((total, comment) => total + 1 + countDescendants(String(comment.id)), 0);
  const visibleComments = orderedComments.filter((comment) => !comment.parentId || expandedCommentIds.has(String(comment.parentId)));
  const toggleCommentReplies = (comment: Comment) => {
    const id = String(comment.id);
    const descendantIds = collectDescendantIds(id);
    setExpandedCommentIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
        descendantIds.forEach((descendantId) => next.delete(descendantId));
        setReplyingTo((replying) => replying?.id === comment.id ? null : replying);
      } else {
        next.add(id);
        descendantIds.forEach((descendantId) => next.add(descendantId));
      }
      return next;
    });
  };

  return (
    <section className="feed-wrap" aria-label="Shorttoon comic feed">
      {isHomeFeed && feedLoading && <div className="feed-state" role="status">숏툰을 불러오는 중...</div>}
      {isHomeFeed && feedError && <div className="feed-state feed-error" role="alert"><p>숏툰을 불러오지 못했습니다.</p><button type="button" onClick={() => void loadFeedPage(0, false)}>다시 시도</button></div>}
      {isHomeFeed && !feedLoading && !feedError && visibleComics.length === 0 && <div className="feed-state" role="status">아직 게시된 숏툰이 없습니다.</div>}
      {selectedPost && onExitPost && <button className="post-view-back" type="button" onClick={() => { onExitPost(); window.dispatchEvent(new Event("shorttoon-post-back")); }} aria-label="이전 페이지로 돌아가기">←</button>}
      <div ref={feedRef} onClickCapture={(event) => { const target = event.target as HTMLElement; if (isAuthenticated || !target.closest(".action-rail button, .action-rail a, .post-kebab, .comic-author, .comic-title-button, .comic-tag-pill")) return; event.preventDefault(); event.stopPropagation(); window.dispatchEvent(new Event("shorttoon-login-required")); }} className={`comic-feed ${selectedPosts?.length ? "channel-feed" : ""} ${isHomeFeed && (feedLoading || feedError || visibleComics.length === 0) ? "feed-content-hidden" : ""}`} onWheel={(event) => {
        if (Math.abs(event.deltaX) <= Math.abs(event.deltaY) && !event.shiftKey) return;
        event.preventDefault();
        moveOnePost(event.deltaX >= 0 || event.deltaY >= 0 ? 1 : -1);
      }} onPointerDown={(event) => {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        horizontalGestureStartX.current = event.clientX;
        horizontalGestureStartY.current = event.clientY;
        horizontalGestureStartIndex.current = feedRef.current ? Math.round(feedRef.current.scrollLeft / feedRef.current.clientWidth) : 0;
        // 마우스는 포인터 캡처를 하지 않아 버튼의 일반 click 이벤트가 유지되게 한다.
        // 터치·펜은 기존처럼 캡처해 한 게시물 단위 스와이프를 안정적으로 처리한다.
        if (event.pointerType !== "mouse") event.currentTarget.setPointerCapture?.(event.pointerId);
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
          <article className={`comic-column ${comic.commentPostId || comic.isRelay ? "uploaded-comic" : ""} ${isHomeFeed ? "home-comic" : ""}`} data-post-id={comic.commentPostId} data-relay-id={comic.relayId} key={comic.id} aria-label={comic.title}>
            <button className="more-button post-kebab" type="button" aria-label="게시물 메뉴" onClick={() => void openPostMenu(comic)}>⋮</button>
            <div className="panel-stack" onScroll={(event) => {
              const element = event.currentTarget;
              if (comic.isRelay) {
                const stackRect = element.getBoundingClientRect();
                const screenTop = Math.max(0, stackRect.top);
                const screenBottom = Math.min(window.innerHeight, stackRect.bottom);
                const screenHeight = Math.max(1, screenBottom - screenTop);
                let dominantPanel: HTMLElement | null = null;
                let dominantScreenShare = 0;
                element.querySelectorAll<HTMLElement>(".comic-panel").forEach((panel) => {
                  const rect = panel.getBoundingClientRect();
                  const visibleHeight = Math.max(0, Math.min(screenBottom, rect.bottom) - Math.max(screenTop, rect.top));
                  const screenShare = visibleHeight / screenHeight;
                  if (screenShare > dominantScreenShare) { dominantScreenShare = screenShare; dominantPanel = panel; }
                });
                const panelIndex = dominantPanel ? Array.from(element.querySelectorAll(".comic-panel")).indexOf(dominantPanel) : -1;
                const pageAuthor = comic.panels[panelIndex]?.relayParticipant;
                const authorElement = element.closest(".comic-column")?.querySelector<HTMLElement>(".comic-author");
                if (authorElement && pageAuthor && pageAuthor.ownerId !== comic.authorId && pageAuthor.profileImageUrl) {
                  authorElement.classList.add("has-relay-avatar");
                  authorElement.style.setProperty("--relay-avatar-image", `url("${pageAuthor.profileImageUrl.replaceAll('"', '\\"')}")`);
                } else if (authorElement) {
                  authorElement.classList.remove("has-relay-avatar");
                  authorElement.style.removeProperty("--relay-avatar-image");
                }
              }
              const previousTop = lastScrollTop.current[comic.id] ?? 0;
              const delta = element.scrollTop - previousTop;
              if (Math.abs(delta) > 2) {
                setMetaHidden((current) => ({ ...current, [comic.id]: delta > 0 }));
                lastScrollTop.current[comic.id] = element.scrollTop;
              }
            }}>
              {comic.panels.map((panel, panelIndex) => (
                <section className={`comic-panel tone-${panel.tone} ${comic.commentPostId || comic.isRelay ? "uploaded-panel" : ""}`} key={panel.id}>
                  <div className="panel-art" aria-hidden="true">{panel.imageUrl ? <img className="panel-art-image" src={panel.imageUrl} alt="" loading={comic.commentPostId ? "eager" : "lazy"} /> : <><i /><b /><em /></>}</div>
                  {!comic.isRelay && <div className="panel-copy">
                    <span>{panel.eyebrow}</span>
                    <h2>{panel.line}</h2>
                    <em className="post-genre">{comic.genre}</em>
                  </div>}
                  {panelIndex === 0 && <div className="swipe-tip">Swipe up for next cut</div>}
                </section>
              ))}
            </div>
            <div className="action-rail">
              <button type="button" className={`like-action ${likedComics[comic.id] ? "liked" : ""}`} onClick={() => { const nextLiked = !likedComics[comic.id]; setLikedComics((current) => ({ ...current, [comic.id]: nextLiked })); if (comic.isRelay && comic.relayId) void Promise.resolve(onRelayLike?.(comic.relayId, nextLiked)).then((count) => { if (count !== null && count !== undefined) setLikeCountOverrides((current) => ({ ...current, [comic.id]: count })); }).catch((error) => { console.error("릴레이툰 좋아요 저장 실패", error); setLikedComics((current) => ({ ...current, [comic.id]: !nextLiked })); }); }} aria-label={`${likedComics[comic.id] ? "Unlike" : "Like"} ${comic.title}`} aria-pressed={Boolean(likedComics[comic.id])}><span aria-hidden="true">♥</span><small>{likeCountOverrides[comic.id] ?? comic.likeCount ?? 0}</small></button>
              <button type="button" onClick={() => openComments(comic)} aria-label={`${comic.title} 댓글 보기`}><span>•••</span><small>{commentCounts[comic.id] ?? comic.commentCount ?? 0}</small></button>{comic.isRelay && <button type="button" className="relay-add-action" onClick={() => comic.relayId && onRelayJoin?.(comic.relayId)} aria-label={`${comic.title} 릴레이 참여`}><span aria-hidden="true">+</span></button>}
              <button type="button" className={`save-action ${savedComics[comic.id] ? "saved" : ""}`} onClick={() => setSavedComics((current) => ({ ...current, [comic.id]: !current[comic.id] }))} aria-label={`${savedComics[comic.id] ? "Remove" : "Save"} ${comic.title}`} aria-pressed={Boolean(savedComics[comic.id])}><span className="save-symbol" aria-hidden="true" /><small>저장</small></button>
              <a className="share-action" href={comic.fullUrl} target="_blank" rel="noreferrer" aria-label={`Open full ${comic.title} on ${comic.publisher}`}><span>↗</span><small>공유</small></a>
            </div>
            <footer className={`comic-meta ${metaHidden[comic.id] ? "meta-hidden" : ""}`}>
              <div><div className="comic-author" role="button" tabIndex={0} aria-label={`${comic.creator} 채널 보기`} onClick={() => onOpenChannel ? onOpenChannel(comic) : window.dispatchEvent(new CustomEvent("shorttoon-open-channel", { detail: { authorId: comic.authorId ?? null, postIndex: comicIndex } }))} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpenChannel ? onOpenChannel(comic) : window.dispatchEvent(new CustomEvent("shorttoon-open-channel", { detail: { authorId: comic.authorId ?? null, postIndex: comicIndex } })); } }}><span className="post-author-avatar" aria-hidden="true" style={(comic.authorImageUrl || (!comic.commentPostId && storedProfileImageUrl)) ? { backgroundImage: `url(${comic.authorImageUrl || storedProfileImageUrl})` } : undefined} /><small>{comic.authorChannelId ? `@${comic.authorChannelId}${comic.isRelay && (participantCountOverrides[comic.id] ?? comic.participantCount ?? 0) > 0 ? ` 외 ${participantCountOverrides[comic.id] ?? comic.participantCount}명` : ""}` : comic.creator}</small></div><button className="comic-title-button" type="button" onClick={() => setInfoComic(comic.isRelay ? { ...comic, description: `좋아요 ${likeCountOverrides[comic.id] ?? comic.likeCount ?? 0}개 · 조회수 ${viewCountOverrides[comic.id] ?? comic.viewCount ?? 0}회` } : comic)}>{comic.title}</button><div className="comic-tag-cluster">{comic.link && <a className="comic-tag-pill" href={comic.link.url} target="_blank" rel="noreferrer">{comic.link.title}</a>}{comic.genre.split(" · ").filter(Boolean).map((genre) => <button className="comic-tag-pill" type="button" key={genre} onClick={(event) => { event.stopPropagation(); window.dispatchEvent(new CustomEvent("shorttoon-search-genre", { detail: { genre } })); }}>{genre}</button>)}</div></div>
            </footer>
          </article>
        ))}
      </div>
      {isHomeFeed && feedLoadingMore && <div className="feed-loading-more" role="status">숏툰을 더 불러오는 중...</div>}
      {commentComic && <div className="sheet-backdrop" role="presentation" onClick={() => setCommentComic(null)}>
        <aside className="comment-sheet" role="dialog" aria-modal="true" aria-label={`${commentComic.title} 댓글`} onClick={(event) => event.stopPropagation()}>
          <div className="sheet-handle" />
          <header><div aria-hidden="true" /><button type="button" onClick={() => setCommentComic(null)} aria-label="댓글창 닫기">×</button></header>
          {commentComic.allowComments === false ? <div className="comments-disabled-message">해당 게시물은 댓글이 허용되지 않은 게시물입니다.</div> : <><div className="comment-list">
            {comments.length === 0 && <p className="no-comments">첫 댓글을 남겨보세요.</p>}
            {visibleComments.map((comment) => {
              const hidden = Boolean(comment.isSpoiler) && !revealed.has(comment.id);
              const parentComment = comment.parentId ? comments.find((item) => String(item.id) === String(comment.parentId)) : null;
              const parentChannelId = parentComment?.authorChannelId;
              return <article className={`comment-card ${hidden ? "spoiler-hidden" : ""}`} data-comment-id={String(comment.id)} data-reply={comment.parentId ? "true" : undefined} key={comment.id} onClick={(event) => { if ((event.target as HTMLElement).closest("button,a,input,textarea")) return; toggleCommentReplies(comment); }}>
                <div className="comment-author-line"><button className="comment-author-avatar" type="button" aria-label={`${comment.authorChannelId ? `@${comment.authorChannelId}` : comment.author} 채널 보기`} onClick={() => { if (comment.authorId) window.dispatchEvent(new CustomEvent("shorttoon-open-channel", { detail: { authorId: comment.authorId, commentRelayId: commentComic?.relayId, commentPostId: commentComic?.commentPostId, commentId: String(comment.id), commentScrollTop: document.querySelector<HTMLElement>(".comment-list")?.scrollTop, postIndex: visibleComics.findIndex((item) => commentComic?.relayId ? item.relayId === commentComic.relayId : item.commentPostId === commentComic?.commentPostId) } })); }} style={comment.authorImageUrl ? { backgroundImage: `url(${comment.authorImageUrl})` } : undefined} /><div className="comment-author-meta"><strong>{comment.authorChannelId ? `@${comment.authorChannelId}` : comment.author}</strong>{(comment.replyToChannelId || parentChannelId) && <button className="comment-reply-target" type="button" onClick={() => { const targetId = comment.replyToOwnerId ?? parentComment?.authorId; if (targetId) window.dispatchEvent(new CustomEvent("shorttoon-open-channel", { detail: { authorId: targetId, commentRelayId: commentComic?.relayId, commentPostId: commentComic?.commentPostId, commentId: String(comment.id), commentScrollTop: document.querySelector<HTMLElement>(".comment-list")?.scrollTop, postIndex: visibleComics.findIndex((item) => commentComic?.relayId ? item.relayId === commentComic.relayId : item.commentPostId === commentComic?.commentPostId) } })); }}><span className="comment-target-arrow" aria-hidden="true">↳</span><span>@{comment.replyToChannelId ?? parentChannelId}</span></button>}</div></div>
                <p>{hidden ? "스포일러가 포함된 댓글입니다." : comment.body}</p>
                {hidden && <button type="button" onClick={() => setRevealed((current) => new Set(current).add(comment.id))}>스포일러 보기</button>}
                <div className="comment-actions">
                  <button type="button" className={`comment-like-button ${comment.likedByMe ? "is-liked" : ""}`} aria-pressed={comment.likedByMe} onClick={async () => {
                    const nextLiked = !comment.likedByMe;
                    setComments((current) => current.map((item) => item.id === comment.id ? { ...item, likedByMe: nextLiked, likeCount: Math.max(0, item.likeCount + (nextLiked ? 1 : -1)) } : item));
                    try { if (commentComic?.relayId) await toggleRelayTopicCommentLike(String(comment.id), nextLiked); else await toggleCommentLike(String(comment.id), nextLiked); } catch (error) {
                      console.error("댓글 좋아요 저장 실패", error);
                      setComments((current) => current.map((item) => item.id === comment.id ? { ...item, likedByMe: comment.likedByMe, likeCount: comment.likeCount } : item));
                    }
                  }}><span className="comment-like-symbol" aria-hidden="true">♥</span><small>{comment.likeCount}</small></button>
                  <button type="button" className="comment-reply-button" onClick={() => { setExpandedCommentIds((current) => new Set([...current, String(comment.id), ...collectDescendantIds(String(comment.id))])); setReplyingTo(comment); setMentionTarget(null); setBody(""); }}><span className="comment-reply-symbol" aria-hidden="true" /><small>{countDescendants(String(comment.id))}</small></button>
                </div>
              </article>;
            })}
          </div>
          <form className="comment-form" onSubmit={submitComment}>
            {replyingTo && <div className="replying-to">{replyingTo.authorChannelId ? `@${replyingTo.authorChannelId}` : replyingTo.author}에게 답글 <button type="button" onClick={() => setReplyingTo(null)}>취소</button></div>}
            {!replyingTo && mentionTarget && <div className="replying-to relay-comment-target-label"><span><button type="button" onClick={() => { window.dispatchEvent(new CustomEvent("shorttoon-open-channel", { detail: { authorId: mentionTarget.ownerId, commentRelayId: commentComic.relayId, commentBody: body, relayMentionTarget: mentionTarget, commentScrollTop: document.querySelector<HTMLElement>(".comment-list")?.scrollTop ?? 0, postIndex: visibleComics.findIndex((item) => item.relayId === commentComic.relayId) } })); }}>@{mentionTarget.channelId}</button>에게 댓글</span><button type="button" aria-label="댓글 대상 지우기" onClick={() => setMentionTarget(null)}>취소</button></div>}
            <CommentEditor key={commentComic.relayId ?? commentComic.id} initialValue={body} resetKey={commentEditorResetKey} placeholder={replyingTo ? "답글을 입력하세요" : "댓글을 입력하세요"} disabled={submitting} onValueChange={(value) => setBody(value.slice(0, 500))} />
            <div><label><input type="checkbox" checked={isSpoiler} onChange={(event) => setIsSpoiler(event.target.checked)} /> 스포일러 포함</label><button type="submit" disabled={submitting}>{submitting ? "등록 중..." : "등록"}</button></div>
          </form></>}
        </aside>
      </div>}
      {menuComic && <div className="sheet-backdrop" role="presentation" onClick={() => setMenuComic(null)}>
        <aside className="comment-sheet post-menu-sheet" role="dialog" aria-modal="true" aria-label="게시물 메뉴" onClick={(event) => event.stopPropagation()}>
          <div className="sheet-handle" />
          <header><strong>{menuIsOwner ? "게시물 관리" : "게시물 신고"}</strong><button type="button" onClick={() => setMenuComic(null)} aria-label="닫기">×</button></header>
          <button className={`post-menu-action ${menuIsOwner ? "danger" : ""}`} type="button" onClick={() => void handlePostMenuAction()}>{menuIsOwner ? "게시물 삭제" : "게시물 신고"}</button>
        </aside>
      </div>}
      {reportComic && <div className="report-page" role="dialog" aria-modal="true" aria-labelledby="report-page-title">
        <header className="report-page-header"><strong id="report-page-title">{"\uC2E0\uACE0"}</strong><button type="button" onClick={() => { setReportComic(null); setReportCategory(null); }} aria-label={"\uB2EB\uAE30"}>×</button></header>
        <div className="report-page-body">
          <h2>{"\uC5B4\uB5A4 \uBB38\uC81C\uC778\uAC00\uC694?"}</h2>
          <div className="report-category-list">
            {REPORT_CATEGORIES.map((category) => <button type="button" key={category.id} className={reportCategory === category.id ? "selected" : ""} onClick={() => setReportCategory(category.id)}><span className="report-radio" aria-hidden="true" />{category.label}</button>)}
          </div>
          <button type="button" className="report-submit" disabled={!reportCategory || reportSubmitting} onClick={() => void submitReport()}>{reportSubmitting ? "\uC811\uC218 \uC911..." : "\uC2E0\uACE0\uD558\uAE30"}</button>
        </div>
      </div>}
      {infoComic && <div className="sheet-backdrop" role="presentation" onClick={() => setInfoComic(null)}>
        <aside className="comment-sheet info-sheet" role="dialog" aria-modal="true" aria-label={`${infoComic.title} 설명`} onClick={(event) => event.stopPropagation()}>
          <div className="sheet-handle" />
          <header><strong>설명</strong><button type="button" onClick={() => setInfoComic(null)} aria-label="설명 닫기">×</button></header>
          <div className="info-sheet-body">
            <h2>{infoComic.title}</h2>
            <div className="info-stats">
              <div><strong>{infoComic.likeCount ?? 0}</strong><span>좋아요</span></div>
              <div><strong>{viewCountOverrides[infoComic.id] ?? infoComic.viewCount ?? 0}</strong><span>조회수</span></div>
              <div><strong>{infoComic.createdAt ? new Date(infoComic.createdAt).toLocaleDateString("ko-KR", { month: "long", day: "numeric" }) : "-"}</strong><span>{infoComic.createdAt ? new Date(infoComic.createdAt).getFullYear() + "년" : "게시일"}</span></div>
            </div>
            <div className="info-description"><p>{infoComic.description?.trim() || "설명이 없습니다."}</p><div className="info-meta-tags">{(infoComic.link ? [infoComic.link] : []).map((link) => <a key={`${link.title}-${link.url}`} href={link.url} target="_blank" rel="noreferrer" onClick={(event) => { if (!isAuthenticated) { event.preventDefault(); window.dispatchEvent(new Event("shorttoon-login-required")); } }}>#{link.title}</a>)}{infoComic.genre.split(" · ").filter(Boolean).map((genre) => <button type="button" key={genre} onClick={() => { if (!isAuthenticated) { window.dispatchEvent(new Event("shorttoon-login-required")); return; } setInfoComic(null); onSearchGenre?.(genre); window.dispatchEvent(new CustomEvent("shorttoon-search-genre", { detail: { genre } })); }}>#{genre}</button>)}</div></div>
          </div>
        </aside>
      </div>}
    </section>
  );
}
