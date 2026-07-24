"use client";

type ChannelLink = { title: string; url: string };
type ChannelIntroPageProps = { intro: string; link: ChannelLink | null; onBack: () => void };

export function ChannelIntroPage({ intro, link, onBack }: ChannelIntroPageProps) {
  return (
    <section className="channel-intro-page" aria-label="채널 소개">
      <h1>소개</h1>
      <div className="channel-intro-full"><p>{intro}</p></div>
      <small className="channel-intro-count">{intro.length}/150</small>
      {link && <a className="channel-intro-link" href={link.url} target="_blank" rel="noreferrer"><strong>{link.title}</strong><span>{link.url}</span></a>}
    </section>
  );
}
