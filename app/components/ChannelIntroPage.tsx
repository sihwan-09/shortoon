"use client";

import { useEffect, useState } from "react";
import { loadChannelProfileByOwnerId } from "../../lib/channel";
import { loadFollowerCount } from "../../lib/follows";

type ChannelLink = { title: string; url: string };
type ChannelIntroPageProps = { intro: string; links: ChannelLink[]; postCount: number; onBack: () => void; channelOwnerId?: string | null };

export function ChannelIntroPage({ intro, links, postCount, onBack, channelOwnerId }: ChannelIntroPageProps) {
  const [viewIntro, setViewIntro] = useState(intro);
  const [viewLinks, setViewLinks] = useState(links);
  const [followerCount, setFollowerCount] = useState(0);
  useEffect(() => { let cancelled = false; const ownerId = channelOwnerId ?? window.sessionStorage.getItem("shorttoon-viewed-channel-owner"); void loadFollowerCount(ownerId).then((count) => { if (!cancelled) setFollowerCount(count); }).catch((error) => console.error("팔로워 수 조회 실패", error)); return () => { cancelled = true; }; }, [channelOwnerId, postCount]);
  useEffect(() => {
    const ownerId = window.sessionStorage.getItem("shorttoon-viewed-channel-owner");
    if (!ownerId) { setViewIntro(intro); setViewLinks(links); return; }
    if (ownerId === "anonymous-external") { setViewIntro(""); setViewLinks([]); return; }
    void loadChannelProfileByOwnerId(ownerId).then((profile) => { if (profile) { setViewIntro(profile.intro); setViewLinks(profile.links); } }).catch((error) => console.error("채널 소개 불러오기 실패", error));
  }, [intro, links]);
  return (
    <section className="channel-intro-page" aria-label="채널 소개">
      <h2 className="channel-intro-subtitle">소개</h2>
      <div className="channel-intro-full"><p>{viewIntro}</p></div>
      <h2 className="channel-intro-subtitle">링크</h2>
      {viewLinks.slice(0, 5).map((link, index) => <a className="channel-intro-link" href={link.url} target="_blank" rel="noreferrer" key={`${link.url}-${index}`}><strong>{link.title}</strong><span>{link.url}</span></a>)}
      <h2 className="channel-intro-subtitle">정보</h2>
      <div className="channel-intro-info" aria-label="채널 정보">
        {links.slice(0, 5).map((link, index) => <div className="channel-intro-info-row" key={`info-${link.url}-${index}`}><span className="channel-info-icon link-info-icon" aria-hidden="true">🔗</span><span>{link.url}</span></div>)}
        <div className="channel-intro-info-row"><span className="channel-info-icon" aria-hidden="true">ⓘ</span><span>가입일: -</span></div>
        <div className="channel-intro-info-row"><span className="channel-info-icon follower-info-icon" aria-hidden="true"><span className="follower-person" /></span><span>팔로워 {followerCount}명</span></div>
        <div className="channel-intro-info-row"><span className="channel-info-icon" aria-hidden="true">▣</span><span>작품 {postCount}개</span></div>
        <div className="channel-intro-info-row"><span className="channel-info-icon" aria-hidden="true">⌁</span><span>조회수 0회</span></div>
      </div>
    </section>
  );
}
