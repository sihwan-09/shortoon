"use client";

import { useEffect, useState } from "react";
import { loadChannelProfileByOwnerId } from "../../lib/channel";
import { loadFollowerCount } from "../../lib/follows";
import { loadPostViewCounts } from "../../lib/views";
import { loadPostsFromSupabase } from "../../lib/posts";
import { supabase } from "../../lib/supabase";

type ChannelLink = { title: string; url: string };
type ChannelIntroPageProps = {
  intro: string;
  links: ChannelLink[];
  postCount: number;
  onBack: () => void;
  channelOwnerId?: string | null;
  postIds?: string[];
  joinedAt?: string | null;
};

export function ChannelIntroPage({ intro, links, postCount, onBack: _onBack, channelOwnerId, postIds = [], joinedAt }: ChannelIntroPageProps) {
  const [viewIntro, setViewIntro] = useState(intro);
  const [viewLinks, setViewLinks] = useState(links);
  const [followerCount, setFollowerCount] = useState(0);
  const [totalViewCount, setTotalViewCount] = useState(0);
  const [viewJoinedAt, setViewJoinedAt] = useState<string | null>(joinedAt ?? null);
  const joinedDateLabel = (viewJoinedAt ?? joinedAt) ? new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric" }).format(new Date((viewJoinedAt ?? joinedAt) as string)) : "-";

  useEffect(() => {
    let cancelled = false;
    const ownerId = channelOwnerId ?? window.sessionStorage.getItem("shorttoon-viewed-channel-owner");
    void loadFollowerCount(ownerId).then((count) => {
      if (!cancelled) setFollowerCount(count);
    }).catch((error) => console.error("팔로워 수 조회 실패", error));
    return () => { cancelled = true; };
  }, [channelOwnerId, postCount]);

  useEffect(() => {
    let cancelled = false;
    const loadTotal = async () => {
      let ids = postIds.filter(Boolean);
      if (!ids.length) {
        let ownerId = channelOwnerId ?? window.sessionStorage.getItem("shorttoon-viewed-channel-owner");
        if (!ownerId) {
          const { data } = await supabase.auth.getSession();
          ownerId = data.session?.user.id ?? null;
        }
        if (ownerId && ownerId !== "anonymous-external") {
          try { ids = (await loadPostsFromSupabase(ownerId)).map((post) => post.id); } catch (error) { console.error("채널 게시물 조회수 대상 조회 실패", error); }
        }
      }
      const counts = await loadPostViewCounts(ids);
      if (!cancelled) setTotalViewCount(Object.values(counts).reduce((total, count) => total + count, 0));
    };
    void loadTotal();
    return () => { cancelled = true; };
  }, [postIds.join("|"), postCount, channelOwnerId]);

  useEffect(() => {
    const ownerId = window.sessionStorage.getItem("shorttoon-viewed-channel-owner");
    if (!ownerId) {
      setViewIntro(intro); setViewLinks(links); setViewJoinedAt(joinedAt ?? null);
      void supabase.auth.getSession().then(({ data }) => data.session?.user.id ? loadChannelProfileByOwnerId(data.session.user.id) : null).then((profile) => { if (profile) setViewJoinedAt(profile.joinedAt ?? null); }).catch(() => undefined);
      return;
    }
    if (ownerId === "anonymous-external") { setViewIntro(""); setViewLinks([]); return; }
    void loadChannelProfileByOwnerId(ownerId).then((profile) => {
      if (profile) { setViewIntro(profile.intro); setViewLinks(profile.links); setViewJoinedAt(profile.joinedAt ?? null); }
    }).catch((error) => console.error("채널 소개 불러오기 실패", error));
  }, [intro, links]);

  return (
    <section className="channel-intro-page" aria-label="채널 소개">
      <h2 className="channel-intro-subtitle">소개</h2>
      <div className="channel-intro-full"><p>{viewIntro}</p></div>
      <h2 className="channel-intro-subtitle">링크</h2>
      {viewLinks.slice(0, 5).map((link, index) => <a className="channel-intro-link" href={link.url} target="_blank" rel="noreferrer" key={`${link.url}-${index}`}><strong>{link.title}</strong><span>{link.url}</span></a>)}
      <h2 className="channel-intro-subtitle">정보</h2>
      <div className="channel-intro-info" aria-label="채널 정보">
        {viewLinks.slice(0, 5).map((link, index) => <div className="channel-intro-info-row" key={`info-${link.url}-${index}`}><span className="channel-info-icon link-info-icon" aria-hidden="true">⌁</span><span>{link.url}</span></div>)}
        <div className="channel-intro-info-row"><span className="channel-info-icon" aria-hidden="true">ⓘ</span><span>가입일: {joinedDateLabel}</span></div>
        <div className="channel-intro-info-row"><span className="channel-info-icon follower-info-icon" aria-hidden="true"><span className="follower-person" /></span><span>팔로워 {followerCount}명</span></div>
        <div className="channel-intro-info-row"><span className="channel-info-icon" aria-hidden="true">▣</span><span>작품 {postCount}개</span></div>
        <div className="channel-intro-info-row"><span className="channel-info-icon" aria-hidden="true">⌁</span><span>조회수 {totalViewCount}회</span></div>
      </div>
    </section>
  );
}
