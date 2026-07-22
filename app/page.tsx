"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { ComicFeed } from "./components/ComicFeed";
import { ChannelPage } from "./components/ChannelPage";
import { ChannelEditPage } from "./components/ChannelEditPage";
import { LinkEditPage } from "./components/LinkEditPage";
import { MyPage } from "./components/MyPage";
import { UploadPage } from "./components/UploadPage";

export default function Home() {
  const [activeTab, setActiveTab] = useState<"home" | "my" | "channel" | "edit" | "link-edit" | "upload">("home");
  const [uploadStep, setUploadStep] = useState<1 | 2 | 3>(1);
  const [channelLink, setChannelLink] = useState<{ title: string; url: string } | null>(null);
  const [editingLink, setEditingLink] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ error }) => {
      if (error) console.error("Supabase 연결 확인 실패", error);
    });
  }, []);

  return (
    <main className="app-shell">
      <header className="app-header" aria-label="Shorttoon header">
        {activeTab === "upload" ? <><button className="edit-header-back upload-close" type="button" onClick={() => uploadStep > 1 ? setUploadStep((uploadStep - 1) as 1 | 2 | 3) : setActiveTab("home")} aria-label={uploadStep > 1 ? "이전 단계" : "업로드 닫기"}>{uploadStep > 1 ? "←" : "×"}</button><strong className="edit-header-title">숏툰 업로드</strong><span /></> : activeTab === "edit" || activeTab === "link-edit" ? <><button className="edit-header-back" type="button" onClick={() => setActiveTab(activeTab === "link-edit" ? "edit" : "channel")} aria-label="Back">←</button><strong className="edit-header-title">{activeTab === "link-edit" ? (editingLink ? "링크 수정" : "링크 추가") : "채널 수정"}</strong><span /></> : <><a className="brand" href="/" aria-label="Shorttoon home"><span className="brand-logo" role="img" aria-label="Shorttoon" /></a><div className="header-tools"><button className="search-button" type="button" aria-label="Search shorttoons"><span aria-hidden="true" /></button>{activeTab === "channel" && <button className="more-button" type="button" aria-label="More channel options">⋮</button>}</div></>}
      </header>
      {activeTab === "home" ? <ComicFeed /> : activeTab === "my" ? <MyPage onOpenChannel={() => setActiveTab("channel")} /> : activeTab === "channel" ? <ChannelPage onBack={() => setActiveTab("my")} onEdit={() => setActiveTab("edit")} /> : activeTab === "edit" ? <ChannelEditPage onBack={() => setActiveTab("channel")} onAddLink={() => { setEditingLink(false); setActiveTab("link-edit"); }} onEditLink={() => { setEditingLink(true); setActiveTab("link-edit"); }} link={channelLink} /> : activeTab === "link-edit" ? <LinkEditPage onBack={() => setActiveTab("edit")} initialLink={editingLink ? channelLink : null} onSave={(link) => { setChannelLink(link); setActiveTab("edit"); }} onDelete={() => { setChannelLink(null); setActiveTab("edit"); }} /> : <UploadPage onClose={() => setActiveTab("home")} step={uploadStep} onStepChange={setUploadStep} />}
      <nav className="bottom-nav" aria-label="Main navigation">
        <button className={`bottom-nav-item ${activeTab === "home" ? "is-active" : ""}`} type="button" onClick={() => setActiveTab("home")} aria-current={activeTab === "home" ? "page" : undefined} aria-label="Home"><span className="home-icon" aria-hidden="true" /></button>
        <button className={`bottom-nav-item upload-nav-item ${activeTab === "upload" ? "is-active" : ""}`} type="button" onClick={() => { setUploadStep(1); setActiveTab("upload"); }} aria-label="Upload shorttoon"><span className="plus-icon" aria-hidden="true">+</span></button>
        <button className={`bottom-nav-item ${activeTab === "my" || activeTab === "channel" || activeTab === "edit" || activeTab === "link-edit" ? "is-active" : ""}`} type="button" onClick={() => setActiveTab("my")} aria-current={activeTab === "my" || activeTab === "channel" || activeTab === "edit" || activeTab === "link-edit" ? "page" : undefined} aria-label="My page"><span className="my-icon" aria-hidden="true">MY</span></button>
      </nav>
    </main>
  );
}
