"use client";

type ChannelLink = { title: string; url: string };
type ChannelIntroPageProps = { intro: string; links: ChannelLink[]; postCount: number; onBack: () => void };

export function ChannelIntroPage({ intro, links, postCount, onBack }: ChannelIntroPageProps) {
  return (
    <section className="channel-intro-page" aria-label="채널 소개">
      <h2 className="channel-intro-subtitle">소개</h2>
      <div className="channel-intro-full"><p>{intro}</p></div>
      <h2 className="channel-intro-subtitle">링크</h2>
      {links.slice(0, 5).map((link, index) => <a className="channel-intro-link" href={link.url} target="_blank" rel="noreferrer" key={`${link.url}-${index}`}><strong>{link.title}</strong><span>{link.url}</span></a>)}
      <h2 className="channel-intro-subtitle">정보</h2>
      <div className="channel-intro-info" aria-label="채널 정보">
        {links.slice(0, 5).map((link, index) => <div className="channel-intro-info-row" key={`info-${link.url}-${index}`}><span className="channel-info-icon link-info-icon" aria-hidden="true">🔗</span><span>{link.url}</span></div>)}
        <div className="channel-intro-info-row"><span className="channel-info-icon" aria-hidden="true">ⓘ</span><span>가입일: -</span></div>
        <div className="channel-intro-info-row"><span className="channel-info-icon follower-info-icon" aria-hidden="true"><span className="follower-person" /></span><span>팔로워 0명</span></div>
        <div className="channel-intro-info-row"><span className="channel-info-icon" aria-hidden="true">▣</span><span>작품 {postCount}개</span></div>
        <div className="channel-intro-info-row"><span className="channel-info-icon" aria-hidden="true">⌁</span><span>조회수 0회</span></div>
      </div>
    </section>
  );
}
