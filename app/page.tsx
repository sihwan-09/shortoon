"use client";

import { useState } from "react";
import { ComicFeed } from "./components/ComicFeed";
import { ChannelPage } from "./components/ChannelPage";
import { ChannelEditPage } from "./components/ChannelEditPage";
import { LinkEditPage } from "./components/LinkEditPage";
import { MyPage } from "./components/MyPage";

export default function Home() {
  const [activeTab, setActiveTab] = useState<"home" | "my" | "channel" | "edit" | "link-edit">("home");
  const [channelLink, setChannelLink] = useState<{ title: string; url: string } | null>(null);

  return (
    <main className="app-shell">
      <header className="app-header" aria-label="Shorttoon header">
        {activeTab === "edit" || activeTab === "link-edit" ? <><button className="edit-header-back" type="button" onClick={() => setActiveTab(activeTab === "link-edit" ? "edit" : "channel")} aria-label="Back">←</button><strong className="edit-header-title">{activeTab === "link-edit" ? "링크 추가" : "채널 수정"}</strong><span /></> : <><a className="brand" href="/" aria-label="Shorttoon home"><span className="brand-logo" role="img" aria-label="Shorttoon" /></a><div className="header-tools"><button className="search-button" type="button" aria-label="Search shorttoons"><span aria-hidden="true" /></button>{activeTab === "channel" && <button className="more-button" type="button" aria-label="More channel options">⋮</button>}</div></>}
      </header>
      {activeTab === "home" ? <ComicFeed /> : activeTab === "my" ? <MyPage onOpenChannel={() => setActiveTab("channel")} /> : activeTab === "channel" ? <ChannelPage onBack={() => setActiveTab("my")} onEdit={() => setActiveTab("edit")} /> : activeTab === "edit" ? <ChannelEditPage onBack={() => setActiveTab("channel")} onAddLink={() => setActiveTab("link-edit")} link={channelLink} /> : <LinkEditPage onBack={() => setActiveTab("edit")} onSave={(link) => { setChannelLink(link); setActiveTab("edit"); }} />}
      {activeTab !== "edit" && activeTab !== "link-edit" && <nav className="bottom-nav" aria-label="Main navigation">
        <button className={`bottom-nav-item ${activeTab === "home" ? "is-active" : ""}`} type="button" onClick={() => setActiveTab("home")} aria-current={activeTab === "home" ? "page" : undefined} aria-label="Home">
          <span className="home-icon" aria-hidden="true" />
        </button>
        <button className="bottom-nav-item upload-nav-item" type="button" aria-label="Upload shorttoon">
          <span className="plus-icon" aria-hidden="true">+</span>
        </button>
        <button className={`bottom-nav-item ${activeTab === "my" || activeTab === "channel" ? "is-active" : ""}`} type="button" onClick={() => setActiveTab("my")} aria-current={activeTab === "my" || activeTab === "channel" ? "page" : undefined} aria-label="My page">
          <span className="my-icon" aria-hidden="true">MY</span>
        </button>
      </nav>}
    </main>
  );
}
