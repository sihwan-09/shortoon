"use client";

import { useState } from "react";
import { ComicFeed } from "./components/ComicFeed";
import { MyPage } from "./components/MyPage";

export default function Home() {
  const [activeTab, setActiveTab] = useState<"home" | "my">("home");

  return (
    <main className="app-shell">
      <header className="app-header" aria-label="Shorttoon header">
        <a className="brand" href="/" aria-label="Shorttoon home"><span className="brand-logo" role="img" aria-label="Shorttoon" /></a>
        <button className="search-button" type="button" aria-label="Search shorttoons"><span aria-hidden="true" /></button>
      </header>
      {activeTab === "home" ? <ComicFeed /> : <MyPage />}
      <nav className="bottom-nav" aria-label="Main navigation">
        <button className={`bottom-nav-item ${activeTab === "home" ? "is-active" : ""}`} type="button" onClick={() => setActiveTab("home")} aria-current={activeTab === "home" ? "page" : undefined} aria-label="Home">
          <span className="home-icon" aria-hidden="true" />
        </button>
        <button className="bottom-nav-item upload-nav-item" type="button" aria-label="Upload shorttoon">
          <span className="plus-icon" aria-hidden="true">+</span>
        </button>
        <button className={`bottom-nav-item ${activeTab === "my" ? "is-active" : ""}`} type="button" onClick={() => setActiveTab("my")} aria-current={activeTab === "my" ? "page" : undefined} aria-label="My page">
          <span className="my-icon" aria-hidden="true">MY</span>
        </button>
      </nav>
    </main>
  );
}
