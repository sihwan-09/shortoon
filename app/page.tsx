"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { ComicFeed } from "./components/ComicFeed";
import { ChannelPage } from "./components/ChannelPage";
import { ChannelIntroPage } from "./components/ChannelIntroPage";
import { ChannelEditPage, ChannelProfile } from "./components/ChannelEditPage";
import { LinkEditPage } from "./components/LinkEditPage";
import { MyPage } from "./components/MyPage";
import { LikedPostsPage } from "./components/LikedPostsPage";
import { PublishedShorttoon, UploadPage } from "./components/UploadPage";
import { loadPostsFromSupabase, savePostToSupabase } from "../lib/posts";
import { loadChannelProfile, saveChannelProfile, uploadChannelProfileImage } from "../lib/channel";

export default function Home() {
  const [activeTab, setActiveTab] = useState<"home" | "my" | "channel" | "liked" | "channel-intro" | "edit" | "link-edit" | "upload" | "upload-link" | "post">("home");
  const [uploadStep, setUploadStep] = useState<1 | 2 | 3>(1);
  const [uploadOrigin, setUploadOrigin] = useState<"home" | "channel">("home");
  const [channelLinks, setChannelLinks] = useState<{ title: string; url: string }[]>([]);
  const [channelProfile, setChannelProfile] = useState<ChannelProfile>({ name: "시화 작가", channelId: "shorttoon_creator", intro: "숏툰으로 전하는 짧고 강한 이야기", links: [], profileImageUrl: null });
  const [channelEditDraft, setChannelEditDraft] = useState<ChannelProfile>(channelProfile);
  const [legacyChannelNames, setLegacyChannelNames] = useState<string[]>([channelProfile.name]);
  const [channelProfileLoaded, setChannelProfileLoaded] = useState(false);
  const [uploadLink, setUploadLink] = useState<{ title: string; url: string } | null>(null);
  const [editingLinkIndex, setEditingLinkIndex] = useState<number | null>(null);
  const editingLink = editingLinkIndex !== null;
  const [channelPosts, setChannelPosts] = useState<PublishedShorttoon[]>([]);
  const [selectedPost, setSelectedPost] = useState<PublishedShorttoon | null>(null);
  const [channelScrollTop, setChannelScrollTop] = useState(0);
  const [channelTargetIndex, setChannelTargetIndex] = useState<number | null>(null);
  const [likedPostIds, setLikedPostIds] = useState<string[]>([]);

  useEffect(() => {
    const syncLikes = () => {
      try { const value = JSON.parse(window.localStorage.getItem("shorttoon-liked-posts") ?? "[]"); setLikedPostIds(Array.isArray(value) ? value : []); } catch { setLikedPostIds([]); }
    };
    syncLikes();
    const openLiked = () => setActiveTab("liked");
    const returnFromPost = () => {
      if (window.localStorage.getItem("shorttoon-post-return") === "liked") setActiveTab("liked");
    };
    window.addEventListener("shorttoon-liked-posts", syncLikes);
    window.addEventListener("open-liked-posts", openLiked);
    window.addEventListener("shorttoon-post-back", returnFromPost);
    return () => { window.removeEventListener("shorttoon-liked-posts", syncLikes); window.removeEventListener("open-liked-posts", openLiked); window.removeEventListener("shorttoon-post-back", returnFromPost); };
  }, []);

  const afterChannelRender = (action: () => void) => window.requestAnimationFrame(() => window.requestAnimationFrame(action));
  const restoreChannelScroll = () => afterChannelRender(() => document.querySelector<HTMLElement>(".channel-page")?.scrollTo({ top: channelScrollTop, behavior: "auto" }));
  const scrollToChannelIndex = (index: number) => afterChannelRender(() => document.querySelector<HTMLElement>(`.channel-thumbnail-tile[data-post-index="${index}"]`)?.scrollIntoView({ block: "center", behavior: "auto" }));
  const leaveUpload = () => { setUploadLink(null); setActiveTab(uploadOrigin); if (uploadOrigin === "channel") restoreChannelScroll(); };
  const exitUploadTo = (destination: "home" | "my") => { setUploadLink(null); setActiveTab(destination); };
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
    void supabase.auth.getSession().then(({ error }) => {
      if (error) console.error("Supabase 연결 확인 실패", error);
    });
    void loadPostsFromSupabase().then((posts) => setChannelPosts(posts)).catch(() => undefined);
    void loadChannelProfile().then((profile) => { if (profile) { if (profile.profileImageUrl) window.localStorage.setItem("shorttoon-profile-image", profile.profileImageUrl); setChannelProfile(profile); setChannelEditDraft(profile); setChannelLinks(profile.links); setLegacyChannelNames((names) => names.includes(profile.name) ? names : [...names, profile.name]); } setChannelProfileLoaded(true); }).catch((error) => { console.error("채널 프로필 불러오기 실패", error); setChannelProfileLoaded(true); });
  }, []);

  useEffect(() => {
    if (channelProfileLoaded) void saveChannelProfile(channelProfile, channelLinks).catch((error) => console.error("채널 프로필 저장 실패", error));
  }, [channelProfile, channelLinks, channelProfileLoaded]);

  const publishPost = async (post: PublishedShorttoon) => {
    try {
      const saved = await savePostToSupabase({ ...post, authorName: channelProfile.name });
      setUploadLink(null);
      const newIndex = channelPosts.length;
      setChannelPosts((current) => [...current, saved]);
      setChannelTargetIndex(newIndex);
      setUploadStep(1);
      setActiveTab("channel");
      scrollToChannelIndex(newIndex);
    } catch (error) {
      console.error("게시물 저장 실패", error);
      window.alert("게시물 저장에 실패했습니다. Supabase 테이블과 Storage 버킷 설정을 확인해주세요.");
    }
  };

  return (
    <main className="app-shell">
      <header className="app-header" aria-label="Shorttoon header">
        {activeTab === "upload" ? <><button className="edit-header-back upload-close" type="button" onClick={() => uploadStep > 1 ? setUploadStep((uploadStep - 1) as 1 | 2 | 3) : leaveUpload()} aria-label={uploadStep > 1 ? "이전 단계" : "업로드 닫기"}>{uploadStep > 1 ? "←" : "×"}</button><strong className="edit-header-title">숏툰 업로드</strong><span /></> : activeTab === "upload-link" ? <><button className="edit-header-back" type="button" onClick={() => setActiveTab("upload")} aria-label="Back">←</button><strong className="edit-header-title">{uploadLink ? "링크 수정" : "링크 추가"}</strong><span /></> : activeTab === "channel-intro" ? <><button className="edit-header-back" type="button" onClick={() => setActiveTab("channel")} aria-label="채널로 돌아가기">←</button><strong className="edit-header-title">{channelProfile.name}</strong><span /></> : activeTab === "edit" || activeTab === "link-edit" ? <><button className="edit-header-back" type="button" onClick={() => setActiveTab(activeTab === "link-edit" ? "edit" : "channel")} aria-label="Back">←</button><strong className="edit-header-title">{activeTab === "link-edit" ? (editingLink ? "링크 수정" : "링크 추가") : "채널 수정"}</strong><span /></> : <><a className="brand" href="/" aria-label="Shorttoon home"><span className="brand-logo" role="img" aria-label="Shorttoon" /></a><div className="header-tools"><button className="search-button" type="button" aria-label="Search shorttoons"><span aria-hidden="true" /></button>{activeTab === "channel" && <button className="more-button" type="button" aria-label="More channel options">⋮</button>}</div></>}
      </header>
      {activeTab === "home" || activeTab === "post" ? <ComicFeed channelName={channelProfile.name} legacyChannelNames={legacyChannelNames} selectedPost={activeTab === "post" ? selectedPost : null} selectedPosts={activeTab === "post" ? channelPosts.map((post) => ({ ...post, authorName: channelProfile.name })) : undefined} selectedPostIndex={channelTargetIndex ?? 0} onSelectedPostChange={activeTab === "post" ? (index) => { setChannelTargetIndex(index); setSelectedPost(channelPosts[index] ? { ...channelPosts[index], authorName: channelProfile.name } : null); } : undefined} onExitPost={activeTab === "post" ? () => { setActiveTab("channel"); if (channelTargetIndex !== null) scrollToChannelIndex(channelTargetIndex); else restoreChannelScroll(); } : undefined} /> : activeTab === "my" ? <MyPage channelName={channelProfile.name} channelId={channelProfile.channelId} onOpenChannel={() => { setActiveTab("channel"); if (channelTargetIndex !== null) scrollToChannelIndex(channelTargetIndex); else restoreChannelScroll(); }} /> : activeTab === "channel" ? <ChannelPage posts={channelPosts} profile={channelProfile} onBack={() => setActiveTab("my")} onOpenIntro={() => setActiveTab("channel-intro")} onEdit={() => { setChannelEditDraft(channelProfile); setActiveTab("edit"); }} onOpenPost={(post, index, scrollTop) => { setChannelTargetIndex(index); setChannelScrollTop(scrollTop); setSelectedPost({ ...post, authorName: channelProfile.name }); setActiveTab("post"); }} /> : activeTab === "channel-intro" ? <ChannelIntroPage intro={channelProfile.intro} links={channelLinks} postCount={channelPosts.length} onBack={() => setActiveTab("channel")} /> : activeTab === "edit" ? <ChannelEditPage profile={channelEditDraft} onDraftChange={setChannelEditDraft} onSave={(profile) => { setLegacyChannelNames((names) => names.includes(channelProfile.name) ? names : [...names, channelProfile.name]); setChannelProfile(profile); setChannelEditDraft(profile); setChannelLinks(profile.links); }} onBack={() => setActiveTab("channel")} onAddLink={() => { setEditingLinkIndex(null); setActiveTab("link-edit"); }} onEditLink={(index) => { setEditingLinkIndex(index); setActiveTab("link-edit"); }} links={channelLinks} /> : activeTab === "link-edit" ? <LinkEditPage onBack={() => setActiveTab("edit")} initialLink={editingLinkIndex === null ? null : channelLinks[editingLinkIndex] ?? null} onSave={(link) => { setChannelLinks((current) => editingLinkIndex === null ? [...current, link].slice(0, 5) : current.map((item, index) => index === editingLinkIndex ? link : item)); setActiveTab("edit"); }} onDelete={() => { if (editingLinkIndex !== null) setChannelLinks((current) => current.filter((_, index) => index !== editingLinkIndex)); setActiveTab("edit"); }} /> : activeTab === "upload-link" ? <div className="upload-screen-shell"><UploadPage onClose={leaveUpload} step={uploadStep} onStepChange={setUploadStep} onAddLink={() => setActiveTab("upload-link")} onEditLink={() => setActiveTab("upload-link")} link={uploadLink} onPublish={publishPost} visible={false} /><LinkEditPage onBack={() => setActiveTab("upload")} initialLink={uploadLink} titleLabel="제목" titlePlaceholder="예: 풀버전 보기" onSave={(link) => { setUploadLink(link); setActiveTab("upload"); }} onDelete={() => { setUploadLink(null); setActiveTab("upload"); }} /></div> : <div className="upload-screen-shell"><UploadPage onClose={leaveUpload} step={uploadStep} onStepChange={setUploadStep} onAddLink={() => setActiveTab("upload-link")} onEditLink={() => setActiveTab("upload-link")} link={uploadLink} onPublish={publishPost} /></div>}
      {activeTab === "liked" && <LikedPostsPage posts={channelPosts.filter((post) => post.id && likedPostIds.includes(post.id))} onBack={() => setActiveTab("my")} onOpenPost={(post, index) => { window.localStorage.setItem("shorttoon-post-return", "liked"); setChannelTargetIndex(index); setSelectedPost({ ...post, authorName: channelProfile.name }); setActiveTab("post"); }} />}
      <nav className="bottom-nav" aria-label="Main navigation">
        <button className={`bottom-nav-item ${activeTab === "home" ? "is-active" : ""}`} type="button" onClick={() => (activeTab === "upload" || activeTab === "upload-link") ? exitUploadTo("home") : setActiveTab("home")} aria-current={activeTab === "home" ? "page" : undefined} aria-label="Home"><span className="home-icon" aria-hidden="true" /></button>
        <button className={`bottom-nav-item upload-nav-item ${activeTab === "upload" ? "is-active" : ""}`} type="button" onClick={() => { if (activeTab === "channel") setChannelScrollTop(document.querySelector<HTMLElement>(".channel-page")?.scrollTop ?? 0); setUploadOrigin(activeTab === "channel" ? "channel" : "home"); setUploadStep(1); setActiveTab("upload"); }} aria-label="Upload shorttoon"><span className="plus-icon" aria-hidden="true">+</span></button>
        <button className={`bottom-nav-item ${activeTab === "my" || activeTab === "channel" || activeTab === "channel-intro" || activeTab === "edit" || activeTab === "link-edit" || activeTab === "post" ? "is-active" : ""}`} type="button" onClick={() => (activeTab === "upload" || activeTab === "upload-link") ? exitUploadTo("my") : setActiveTab("my")} aria-current={activeTab === "my" || activeTab === "channel" || activeTab === "channel-intro" || activeTab === "edit" || activeTab === "link-edit" || activeTab === "post" ? "page" : undefined} aria-label="My page"><span className="my-icon" aria-hidden="true">MY</span></button>
      </nav>
    </main>
  );
}
