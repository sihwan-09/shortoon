"use client";

import { useEffect, useRef, useState } from "react";
import { supabase, supabaseConfigured } from "../lib/supabase";
import { ComicFeed } from "./components/ComicFeed";
import { ChannelPage } from "./components/ChannelPage";
import { ChannelIntroPage } from "./components/ChannelIntroPage";
import { ChannelEditPage, ChannelProfile } from "./components/ChannelEditPage";
import { LinkEditPage } from "./components/LinkEditPage";
import { MyPage } from "./components/MyPage";
import { LikedPostsPage } from "./components/LikedPostsPage";
import { PublishedShorttoon, UploadPage } from "./components/UploadPage";
import { loadPostsByIds, loadPostsFromSupabase, savePostToSupabase } from "../lib/posts";
import { loadUserLikedPostIds } from "../lib/likes";
import { loadChannelProfile, loadChannelProfileByOwnerId, saveChannelProfile, uploadChannelProfileImage } from "../lib/channel";
import { AuthPage } from "./components/AuthPage";
import { SearchPage } from "./components/SearchPage";
import { LoginPromptModal } from "./components/LoginPromptModal";

const DEFAULT_CHANNEL_PROFILE: ChannelProfile = { name: "채널명", channelId: "채널 아이디", intro: "숏툰으로 전하는 짧고 강한 이야기", links: [], profileImageUrl: null };

export default function Home() {
  const [activeTab, setActiveTab] = useState<"home" | "my" | "channel" | "liked" | "channel-intro" | "edit" | "link-edit" | "upload" | "upload-link" | "post" | "login" | "signup" | "search">("home");
  const [authReturnTab, setAuthReturnTab] = useState<"home" | "my" | "channel">("home");
  const [searchReturnTab, setSearchReturnTab] = useState<"home" | "my" | "channel" | "post" | "liked">("home");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginPromptOpen, setLoginPromptOpen] = useState(false);
  const [uploadStep, setUploadStep] = useState<1 | 2 | 3>(1);
  const [uploadOrigin, setUploadOrigin] = useState<"home" | "channel">("home");
  const [channelLinks, setChannelLinks] = useState<{ title: string; url: string }[]>([]);
  const [channelProfile, setChannelProfile] = useState<ChannelProfile>(DEFAULT_CHANNEL_PROFILE);
  const [channelEditDraft, setChannelEditDraft] = useState<ChannelProfile>(channelProfile);
  const [legacyChannelNames, setLegacyChannelNames] = useState<string[]>([channelProfile.name]);
  const [channelProfileLoaded, setChannelProfileLoaded] = useState(false);
  const [channelProfileDirty, setChannelProfileDirty] = useState(false);
  const [uploadLink, setUploadLink] = useState<{ title: string; url: string } | null>(null);
  const [editingLinkIndex, setEditingLinkIndex] = useState<number | null>(null);
  const editingLink = editingLinkIndex !== null;
  const [ownChannelPosts, setOwnChannelPosts] = useState<PublishedShorttoon[]>([]);
  const [selectedPost, setSelectedPost] = useState<PublishedShorttoon | null>(null);
  const [postOrigin, setPostOrigin] = useState<"channel" | "liked" | "search">("channel");
  const [searchPosts, setSearchPosts] = useState<PublishedShorttoon[]>([]);
  const [channelScrollTop, setChannelScrollTop] = useState(0);
  const [channelTargetIndex, setChannelTargetIndex] = useState<number | null>(null);
  const [homeTargetIndex, setHomeTargetIndex] = useState(0);
  const [likedPostIds, setLikedPostIds] = useState<string[]>([]);
  const [likedPosts, setLikedPosts] = useState<PublishedShorttoon[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [viewedChannelOwnerId, setViewedChannelOwnerId] = useState<string | null>(null);
  const [viewedChannelProfile, setViewedChannelProfile] = useState<ChannelProfile | null>(null);
  const [viewedChannelPosts, setViewedChannelPosts] = useState<PublishedShorttoon[]>([]);
  const [channelReturnTab, setChannelReturnTab] = useState<"home" | "my" | "post" | "search">("my");
  const [commentReturn, setCommentReturn] = useState<{ tab: "home" | "post"; postId: string; postIndex: number; commentId?: string; scrollTop?: number } | null>(null);
  const [followedChannelIds, setFollowedChannelIds] = useState<string[]>([]);
  const profileSyncRequestRef = useRef(0);
  const currentUserIdRef = useRef<string | null>(null);
  const channelPosts = viewedChannelOwnerId ? viewedChannelPosts : ownChannelPosts;
  const displayedChannelProfile = viewedChannelProfile ?? channelProfile;
  const displayedChannelPosts = channelPosts;
  const isViewingOwnChannel = !viewedChannelOwnerId || viewedChannelOwnerId === currentUserId;

  const openChannelForComic = async (comic: { authorId?: string | null; postIndex?: number }, fromMy = false) => {
    const ownerId = comic.authorId ?? null;
    if (typeof comic.postIndex === "number") { setHomeTargetIndex(comic.postIndex); window.sessionStorage.setItem("shorttoon-home-target-index", String(comic.postIndex)); }
    setChannelReturnTab(activeTab === "post" ? "post" : activeTab === "home" ? "home" : activeTab === "search" ? "search" : "my");
    const { data: sessionData } = await supabase.auth.getSession();
    const sessionUserId = sessionData.session?.user.id ?? currentUserIdRef.current;
    if (fromMy || ownerId === sessionUserId) {
      window.sessionStorage.removeItem("shorttoon-viewed-channel-owner");
      setViewedChannelOwnerId(null); setViewedChannelProfile(null); setActiveTab("channel"); return;
    }
    const viewedOwnerKey = ownerId ?? "anonymous-external";
    window.sessionStorage.setItem("shorttoon-viewed-channel-owner", viewedOwnerKey);
    if (!ownerId) {
      setViewedChannelOwnerId(viewedOwnerKey);
      setViewedChannelProfile(DEFAULT_CHANNEL_PROFILE);
      setViewedChannelPosts([]);
      setActiveTab("channel");
      return;
    }
    try {
      const [profile, posts] = await Promise.all([loadChannelProfileByOwnerId(ownerId), loadPostsFromSupabase(ownerId)]);
      setViewedChannelOwnerId(ownerId);
      setViewedChannelProfile(profile ?? DEFAULT_CHANNEL_PROFILE);
      setViewedChannelPosts(posts);
      setActiveTab("channel");
    } catch (error) {
      console.error("채널 조회 실패", error);
      setViewedChannelOwnerId(ownerId); setViewedChannelProfile(DEFAULT_CHANNEL_PROFILE); setViewedChannelPosts([]); setActiveTab("channel");
    }
  };

  useEffect(() => {
    const showLoginPrompt = () => { if (!isAuthenticated) setLoginPromptOpen(true); };
    window.addEventListener("shorttoon-login-required", showLoginPrompt);
    return () => window.removeEventListener("shorttoon-login-required", showLoginPrompt);
  }, [isAuthenticated]);

  useEffect(() => {
    try {
      const value = JSON.parse(window.localStorage.getItem("shorttoon-followed-channels") ?? "[]");
      setFollowedChannelIds(Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);
    } catch { setFollowedChannelIds([]); }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const syncLikes = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!data.session) { if (!cancelled) { setLikedPostIds([]); setLikedPosts([]); } return; }
        const ids = await loadUserLikedPostIds();
        const posts = await loadPostsByIds(ids);
        if (!cancelled) { setLikedPostIds(ids); setLikedPosts(posts); }
      } catch (error) {
        console.error("사용자 좋아요 불러오기 실패", error);
        if (!cancelled) { setLikedPostIds([]); setLikedPosts([]); }
      }
    };
    void syncLikes();
    const openLiked = () => { void syncLikes(); setActiveTab("liked"); };
    const returnFromPost = () => {
      if (window.localStorage.getItem("shorttoon-post-return") === "liked") setActiveTab("liked");
    };
    const { data: authListener } = supabase.auth.onAuthStateChange(() => { void syncLikes(); });
    window.addEventListener("shorttoon-liked-posts", syncLikes);
    window.addEventListener("open-liked-posts", openLiked);
    window.addEventListener("shorttoon-post-back", returnFromPost);
    return () => { cancelled = true; authListener.subscription.unsubscribe(); window.removeEventListener("shorttoon-liked-posts", syncLikes); window.removeEventListener("open-liked-posts", openLiked); window.removeEventListener("shorttoon-post-back", returnFromPost); };
  }, []);

  const afterChannelRender = (action: () => void) => window.requestAnimationFrame(() => window.requestAnimationFrame(action));
  const restoreChannelScroll = () => afterChannelRender(() => {
    const page = document.querySelector<HTMLElement>(".channel-page");
    if (!page) return;
    if (window.sessionStorage.getItem("shorttoon-open-channel-top") === "1") { window.sessionStorage.removeItem("shorttoon-open-channel-top"); page.scrollTo({ top: 0, behavior: "auto" }); return; }
    page.scrollTo({ top: channelScrollTop, behavior: "auto" });
  });
  const scrollToChannelIndex = (index: number) => afterChannelRender(() => {
    const page = document.querySelector<HTMLElement>(".channel-page");
    if (window.sessionStorage.getItem("shorttoon-open-channel-top") === "1") { window.sessionStorage.removeItem("shorttoon-open-channel-top"); page?.scrollTo({ top: 0, behavior: "auto" }); return; }
    document.querySelector<HTMLElement>(`.channel-thumbnail-tile[data-post-index="${index}"]`)?.scrollIntoView({ block: "center", behavior: "auto" });
  });
  const leaveUpload = () => { setUploadLink(null); setActiveTab(uploadOrigin); if (uploadOrigin === "channel") restoreChannelScroll(); };
  const exitUploadTo = (destination: "home" | "my") => { setUploadLink(null); setActiveTab(destination); };
  const openLogin = () => { setAuthReturnTab(activeTab === "my" || activeTab === "channel" || activeTab === "post" ? (activeTab === "post" ? "channel" : activeTab) : "home"); setActiveTab("login"); };
  const completeAuth = () => { setIsAuthenticated(true); setActiveTab(authReturnTab); };
  const signOut = async () => {
    if (supabaseConfigured) {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("Supabase 로그아웃 실패", error);
        window.alert("로그아웃에 실패했습니다. 잠시 후 다시 시도해 주세요.");
        return;
      }
    }
    profileSyncRequestRef.current += 1;
    window.localStorage.removeItem("shorttoon-profile-image");
    window.dispatchEvent(new Event("shorttoon-profile-image"));
    setChannelProfile(DEFAULT_CHANNEL_PROFILE);
    setChannelEditDraft(DEFAULT_CHANNEL_PROFILE);
    setChannelLinks([]);
    setOwnChannelPosts([]);
    setLikedPostIds([]);
    setLikedPosts([]);
    setViewedChannelOwnerId(null);
    setViewedChannelProfile(null);
    setViewedChannelPosts([]);
    window.sessionStorage.removeItem("shorttoon-viewed-channel-owner");
    setChannelProfileLoaded(true);
    setIsAuthenticated(false);
    setActiveTab("home");
  };
  const signInWithEmail = async (email: string, password: string): Promise<string | null> => {
    if (!supabaseConfigured) return "Supabase 인증 환경변수가 설정되지 않았습니다.";
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      console.error("이메일 로그인 실패", error);
      return "이메일 또는 비밀번호를 확인해 주세요.";
    }
    completeAuth();
    return null;
  };
  const signUpWithEmail = async (email: string, password: string): Promise<{ message: string | null; success: boolean }> => {
    if (!supabaseConfigured) return { message: "Supabase 인증 환경변수가 설정되지 않았습니다.", success: false };
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      console.error("이메일 회원가입 실패", error);
      return { message: "회원가입에 실패했습니다. 입력한 이메일을 확인해 주세요.", success: false };
    }
    if (data.session) {
      completeAuth();
      return { message: null, success: true };
    }
    return { message: "가입이 완료되었습니다. 이메일 인증 후 로그인해 주세요.", success: true };
  };
  const signInWithProvider = async (provider: "google" | "kakao"): Promise<string | null> => {
    if (!supabaseConfigured) return "Supabase 인증 환경변수가 설정되지 않았습니다.";
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
    if (error) {
      console.error(`${provider} OAuth 로그인 실패`, error);
      return `${provider === "google" ? "Google" : "카카오"} 로그인 설정을 확인해 주세요.`;
    }
    return null;
  };
  const handleProfileImageChange = async (file: File) => {
    const localPreviewUrl = URL.createObjectURL(file);
    window.localStorage.setItem("shorttoon-profile-image", localPreviewUrl);
    window.dispatchEvent(new Event("shorttoon-profile-image"));
    setChannelProfile((current) => ({ ...current, profileImageUrl: localPreviewUrl }));
    setChannelEditDraft((current) => ({ ...current, profileImageUrl: localPreviewUrl }));
    try {
      const profileImageUrl = await uploadChannelProfileImage(file);
      window.localStorage.setItem("shorttoon-profile-image", profileImageUrl);
      window.dispatchEvent(new Event("shorttoon-profile-image"));
      setChannelProfile((current) => ({ ...current, profileImageUrl }));
      setChannelEditDraft((current) => ({ ...current, profileImageUrl }));
    } catch (error) {
      console.error("프로필 이미지 저장 실패", error);
      window.alert("이미지는 적용했지만 서버 저장에 실패했습니다. Supabase Storage 정책을 확인해주세요.");
    }
  };

  useEffect(() => {
    const syncChannelProfile = async (ownerId: string | null) => {
      const requestId = ++profileSyncRequestRef.current;
      if (!ownerId) {
        window.localStorage.removeItem("shorttoon-profile-image");
        window.dispatchEvent(new Event("shorttoon-profile-image"));
        setChannelProfile(DEFAULT_CHANNEL_PROFILE);
        setChannelEditDraft(DEFAULT_CHANNEL_PROFILE);
        setChannelLinks([]);
        setChannelProfileDirty(false);
        setChannelProfileLoaded(true);
        return;
      }
      try {
        const profile = await loadChannelProfile();
        if (requestId !== profileSyncRequestRef.current) return;
        const nextProfile = profile ?? DEFAULT_CHANNEL_PROFILE;
        if (nextProfile.profileImageUrl) window.localStorage.setItem("shorttoon-profile-image", nextProfile.profileImageUrl);
        else window.localStorage.removeItem("shorttoon-profile-image");
        window.dispatchEvent(new Event("shorttoon-profile-image"));
        setChannelProfile(nextProfile);
        setChannelEditDraft(nextProfile);
        setChannelLinks(nextProfile.links);
        setChannelProfileDirty(false);
        setLegacyChannelNames((names) => names.includes(nextProfile.name) ? names : [...names, nextProfile.name]);
      } catch (error) {
        console.error("채널 프로필 불러오기 실패", error);
      } finally {
        setChannelProfileLoaded(true);
      }
    };
    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) console.error("Supabase 연결 확인 실패", error);
      currentUserIdRef.current = data.session?.user.id ?? null;
      setCurrentUserId(data.session?.user.id ?? null);
      setIsAuthenticated(Boolean(data.session));
      void syncChannelProfile(data.session?.user.id ?? null);
    });
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      currentUserIdRef.current = session?.user.id ?? null;
      setCurrentUserId(session?.user.id ?? null);
      setIsAuthenticated(Boolean(session));
      void syncChannelProfile(session?.user.id ?? null);
    });
    return () => authListener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (channelProfileLoaded && channelProfileDirty && currentUserIdRef.current) void saveChannelProfile(channelProfile, channelLinks).then(() => setChannelProfileDirty(false)).catch((error) => console.error("채널 프로필 저장 실패", error));
  }, [channelProfile, channelLinks, channelProfileLoaded, channelProfileDirty]);

  useEffect(() => {
    if (!channelProfileLoaded) return;
    if (JSON.stringify(channelEditDraft) !== JSON.stringify(channelProfile)) setChannelProfileDirty(true);
  }, [channelEditDraft, channelProfile, channelProfileLoaded]);

  useEffect(() => {
    if (activeTab !== "channel" && activeTab !== "liked") return;
    if (activeTab === "channel" && viewedChannelOwnerId) return;
    if (!currentUserIdRef.current) { setOwnChannelPosts([]); return; }
    void loadPostsFromSupabase(currentUserIdRef.current).then((posts) => setOwnChannelPosts(posts)).catch((error) => console.error("채널 게시물 조회 실패", error));
  }, [activeTab, viewedChannelOwnerId, isAuthenticated]);

  const publishPost = async (post: PublishedShorttoon) => {
    if (!currentUserIdRef.current) {
      window.alert("게시하려면 먼저 로그인해 주세요.");
      setActiveTab("login");
      return;
    }
    try {
      const saved = await savePostToSupabase({ ...post, authorName: channelProfile.name });
      setUploadLink(null);
      const newIndex = ownChannelPosts.length;
      setOwnChannelPosts((current) => [...current, saved]);
      setChannelTargetIndex(newIndex);
      setUploadStep(1);
      setActiveTab("channel");
      scrollToChannelIndex(newIndex);
    } catch (error) {
      console.error("게시물 저장 실패", error);
      window.alert("게시물 저장에 실패했습니다. Supabase 테이블과 Storage 버킷 설정을 확인해주세요.");
    }
  };

  useEffect(() => {
    const openChannel = (event: Event) => {
      const detail = (event as CustomEvent<{ authorId?: string | null; postIndex?: number; commentPostId?: string; commentId?: string; commentScrollTop?: number }>).detail;
      const ownerId = detail?.authorId ?? null;
      if (detail?.commentPostId) {
        setCommentReturn({ tab: activeTab === "post" ? "post" : "home", postId: detail.commentPostId, postIndex: typeof detail.postIndex === "number" && detail.postIndex >= 0 ? detail.postIndex : 0, commentId: detail.commentId, scrollTop: detail.commentScrollTop });
      }
      if (ownerId) {
        void openChannelForComic({ authorId: ownerId, postIndex: detail?.postIndex });
      } else {
        if (typeof detail?.postIndex === "number") { setHomeTargetIndex(detail.postIndex); window.sessionStorage.setItem("shorttoon-home-target-index", String(detail.postIndex)); }
        setChannelReturnTab(activeTab === "post" ? "post" : activeTab === "home" ? "home" : "my");
        setViewedChannelOwnerId(null); setViewedChannelProfile(null); setViewedChannelPosts([]); setActiveTab("channel"); if (activeTab !== "post") setChannelTargetIndex(null);
      }
    };
    window.addEventListener("shorttoon-open-channel", openChannel);
    return () => window.removeEventListener("shorttoon-open-channel", openChannel);
  }, [activeTab]);

  const handleChannelBack = () => {
    if (commentReturn) {
      const restore = commentReturn;
      setCommentReturn(null);
      window.sessionStorage.setItem("shorttoon-comment-restore", JSON.stringify({ postId: restore.postId, commentId: restore.commentId, scrollTop: restore.scrollTop }));
      if (restore.tab === "home") {
        setHomeTargetIndex(restore.postIndex);
        window.sessionStorage.setItem("shorttoon-home-target-index", String(restore.postIndex));
        setActiveTab("home");
      } else {
        setChannelTargetIndex(restore.postIndex);
        setActiveTab("post");
      }
      return;
    }
    setActiveTab(channelReturnTab);
  };

  useEffect(() => {
    window.addEventListener("shorttoon-channel-back", handleChannelBack);
    return () => window.removeEventListener("shorttoon-channel-back", handleChannelBack);
  }, [commentReturn, channelReturnTab]);

  useEffect(() => {
    const openSearch = (event: MouseEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest(".search-button")) return;
      if (!isAuthenticated) { setLoginPromptOpen(true); return; }
      window.sessionStorage.removeItem("shorttoon-search-query");
      window.sessionStorage.removeItem("shorttoon-search-category");
      const returnTab = activeTab === "my" || activeTab === "channel" || activeTab === "post" || activeTab === "liked" ? activeTab : "home";
      setSearchReturnTab(returnTab);
      setActiveTab("search");
    };
    const openGenreSearch = (event: Event) => {
      const genre = (event as CustomEvent<{ genre?: string }>).detail?.genre?.trim();
      if (!genre) return;
      window.sessionStorage.setItem("shorttoon-search-query", genre);
      window.sessionStorage.setItem("shorttoon-search-category", "works");
      const returnTab = activeTab === "my" || activeTab === "channel" || activeTab === "post" || activeTab === "liked" ? activeTab : "home";
      setSearchReturnTab(returnTab);
      setActiveTab("search");
    };
    document.addEventListener("click", openSearch);
    window.addEventListener("shorttoon-search-genre", openGenreSearch);
    return () => { document.removeEventListener("click", openSearch); window.removeEventListener("shorttoon-search-genre", openGenreSearch); };
  }, [activeTab, isAuthenticated]);

  return (
    <main className={`app-shell ${activeTab === "login" || activeTab === "signup" ? "auth-mode" : ""} ${activeTab === "search" ? "search-mode" : ""}`}>
      {!isAuthenticated && (activeTab === "home" || activeTab === "my" || activeTab === "channel" || activeTab === "post") && <button type="button" className={`header-login-floating ${activeTab === "channel" ? "header-login-channel" : ""}`} onClick={openLogin}>로그인</button>}
      <header className="app-header" aria-label="Shorttoon header">
        {activeTab === "upload" ? <><button className="edit-header-back upload-close" type="button" onClick={() => uploadStep > 1 ? setUploadStep((uploadStep - 1) as 1 | 2 | 3) : leaveUpload()} aria-label={uploadStep > 1 ? "이전 단계" : "업로드 닫기"}>{uploadStep > 1 ? "←" : "×"}</button><strong className="edit-header-title">숏툰 업로드</strong><span /></> : activeTab === "upload-link" ? <><button className="edit-header-back" type="button" onClick={() => setActiveTab("upload")} aria-label="Back">←</button><strong className="edit-header-title">{uploadLink ? "링크 수정" : "링크 추가"}</strong><span /></> : activeTab === "channel-intro" ? <><button className="edit-header-back" type="button" onClick={() => setActiveTab("channel")} aria-label="채널로 돌아가기">←</button><strong className="edit-header-title">{channelProfile.name}</strong><span /></> : activeTab === "edit" || activeTab === "link-edit" ? <><button className="edit-header-back" type="button" onClick={() => setActiveTab(activeTab === "link-edit" ? "edit" : "channel")} aria-label="Back">←</button><strong className="edit-header-title">{activeTab === "link-edit" ? (editingLink ? "링크 수정" : "링크 추가") : "채널 수정"}</strong><span /></> : <><a className="brand" href="/" aria-label="Shorttoon home"><span className="brand-logo" role="img" aria-label="Shorttoon" /></a><div className="header-tools"><button className="search-button" type="button" aria-label="Search shorttoons"><span aria-hidden="true" /></button>{activeTab === "channel" && <button className="more-button" type="button" aria-label="More channel options" onClick={() => { if (!isAuthenticated) setLoginPromptOpen(true); }}>⋮</button>}</div></>}
      </header>
      {activeTab === "search" && <SearchPage onBack={() => setActiveTab(searchReturnTab)} onOpenPost={(post, posts, index) => { setSearchPosts(posts); setPostOrigin("search"); setChannelTargetIndex(index); setSelectedPost(post); setActiveTab("post"); }} onOpenAuthor={(authorId) => { void openChannelForComic({ authorId }); }} />}
      {activeTab !== "search" && <>
      {activeTab === "home" || activeTab === "post" ? <ComicFeed channelName={channelProfile.name} channelId={channelProfile.channelId} legacyChannelNames={legacyChannelNames} selectedPost={activeTab === "post" ? selectedPost : null} selectedPosts={activeTab === "post" ? (postOrigin === "liked" ? likedPosts : postOrigin === "search" ? searchPosts : channelPosts).map((post) => post) : undefined} selectedPostIndex={channelTargetIndex ?? 0} onSelectedPostChange={activeTab === "post" ? (index) => { const sourcePosts = postOrigin === "liked" ? likedPosts : postOrigin === "search" ? searchPosts : channelPosts; setChannelTargetIndex(index); setSelectedPost(sourcePosts[index] ?? null); } : undefined} onExitPost={activeTab === "post" ? () => { setActiveTab(postOrigin === "search" ? "search" : postOrigin); if (postOrigin === "channel") { if (channelTargetIndex !== null) scrollToChannelIndex(channelTargetIndex); else restoreChannelScroll(); } } : undefined} /> : activeTab === "my" ? <MyPage channelName={channelProfile.name} channelId={channelProfile.channelId} onOpenChannel={() => { setViewedChannelOwnerId(null); setViewedChannelProfile(null); setViewedChannelPosts([]); setChannelReturnTab("my"); setActiveTab("channel"); if (channelTargetIndex !== null) scrollToChannelIndex(channelTargetIndex); else restoreChannelScroll(); }} onLogout={signOut} /> : activeTab === "channel" ? <ChannelPage posts={displayedChannelPosts} profile={displayedChannelProfile} isOwner={isViewingOwnChannel} onBack={() => setActiveTab(channelReturnTab)} onOpenIntro={() => setActiveTab("channel-intro")} onEdit={() => { setChannelEditDraft(channelProfile); setActiveTab("edit"); }} onOpenPost={(post, index, scrollTop) => { setPostOrigin("channel"); setChannelTargetIndex(index); setChannelScrollTop(scrollTop); setSelectedPost(post); setActiveTab("post"); }} /> : activeTab === "channel-intro" ? <ChannelIntroPage intro={channelProfile.intro} links={channelLinks} postCount={channelPosts.length} onBack={() => setActiveTab("channel")} /> : activeTab === "edit" ? <ChannelEditPage profile={channelEditDraft} onDraftChange={setChannelEditDraft} onSave={async (profile) => { const savedProfile = await saveChannelProfile(profile, profile.links); setLegacyChannelNames((names) => names.includes(profile.name) ? names : [...names, profile.name]); setChannelProfile(savedProfile); setChannelEditDraft(savedProfile); setChannelLinks(savedProfile.links); setChannelProfileDirty(false); }} onBack={() => setActiveTab("channel")} onAddLink={() => { setEditingLinkIndex(null); setActiveTab("link-edit"); }} onEditLink={(index) => { setEditingLinkIndex(index); setActiveTab("link-edit"); }} links={channelLinks} /> : activeTab === "link-edit" ? <LinkEditPage onBack={() => setActiveTab("edit")} initialLink={editingLinkIndex === null ? null : channelLinks[editingLinkIndex] ?? null} onSave={(link) => { setChannelLinks((current) => editingLinkIndex === null ? [...current, link].slice(0, 5) : current.map((item, index) => index === editingLinkIndex ? link : item)); setActiveTab("edit"); }} onDelete={() => { if (editingLinkIndex !== null) setChannelLinks((current) => current.filter((_, index) => index !== editingLinkIndex)); setActiveTab("edit"); }} links={channelLinks} /> : activeTab === "upload-link" ? <div className="upload-screen-shell"><UploadPage onClose={leaveUpload} step={uploadStep} onStepChange={setUploadStep} onAddLink={() => setActiveTab("upload-link")} onEditLink={() => setActiveTab("upload-link")} link={uploadLink} onPublish={publishPost} visible={false} /><LinkEditPage onBack={() => setActiveTab("upload")} initialLink={uploadLink} titleLabel="제목" titlePlaceholder="예: 풀버전 보기" onSave={(link) => { setUploadLink(link); setActiveTab("upload"); }} onDelete={() => { setUploadLink(null); setActiveTab("upload"); }} /></div> : <div className="upload-screen-shell"><UploadPage onClose={leaveUpload} step={uploadStep} onStepChange={setUploadStep} onAddLink={() => setActiveTab("upload-link")} onEditLink={() => setActiveTab("upload-link")} link={uploadLink} onPublish={publishPost} /></div>}
      {activeTab === "liked" && <LikedPostsPage posts={likedPosts} onBack={() => setActiveTab("my")} onOpenPost={(post, index) => { window.localStorage.setItem("shorttoon-post-return", "liked"); setPostOrigin("liked"); setChannelTargetIndex(index); setSelectedPost(post); setActiveTab("post"); }} />}
      </>}
      <nav className="bottom-nav" aria-label="Main navigation">
        <button className={`bottom-nav-item ${activeTab === "home" || (activeTab === "channel" && Boolean(viewedChannelOwnerId)) ? "is-active" : ""}`} type="button" onClick={() => (activeTab === "upload" || activeTab === "upload-link") ? exitUploadTo("home") : setActiveTab("home")} aria-current={activeTab === "home" || (activeTab === "channel" && Boolean(viewedChannelOwnerId)) ? "page" : undefined} aria-label="Home"><span className="home-icon" aria-hidden="true" /></button>
        <button className={`bottom-nav-item upload-nav-item ${activeTab === "upload" ? "is-active" : ""}`} type="button" onClick={() => { if (!isAuthenticated) { setLoginPromptOpen(true); return; } if (activeTab === "channel") setChannelScrollTop(document.querySelector<HTMLElement>(".channel-page")?.scrollTop ?? 0); setUploadOrigin(activeTab === "channel" ? "channel" : "home"); setUploadStep(1); setActiveTab("upload"); }} aria-label="Upload shorttoon"><span className="plus-icon" aria-hidden="true">+</span></button>
        <button className={`bottom-nav-item ${activeTab === "my" || (activeTab === "channel" && !viewedChannelOwnerId) || activeTab === "channel-intro" || activeTab === "edit" || activeTab === "link-edit" || (activeTab === "post" && postOrigin === "channel" && !viewedChannelOwnerId) ? "is-active" : ""}`} type="button" onClick={() => (activeTab === "upload" || activeTab === "upload-link") ? exitUploadTo("my") : setActiveTab("my")} aria-current={activeTab === "my" || (activeTab === "channel" && !viewedChannelOwnerId) || activeTab === "channel-intro" || activeTab === "edit" || activeTab === "link-edit" || (activeTab === "post" && postOrigin === "channel" && !viewedChannelOwnerId) ? "page" : undefined} aria-label="My page"><span className="my-icon" aria-hidden="true">MY</span></button>
      </nav>
      {(activeTab === "login" || activeTab === "signup") && <AuthPage mode={activeTab} onBack={() => setActiveTab(activeTab === "signup" ? "login" : authReturnTab)} onChangeMode={(mode) => setActiveTab(mode)} onEmailLogin={signInWithEmail} onEmailSignup={signUpWithEmail} onOAuth={signInWithProvider} />}
      {loginPromptOpen && <LoginPromptModal onClose={() => setLoginPromptOpen(false)} onLogin={() => { setLoginPromptOpen(false); openLogin(); }} />}
    </main>
  );
}
