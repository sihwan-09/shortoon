"use client";

type ChannelLink = { title: string; url: string };
type ChannelIntroPageProps = { intro: string; link: ChannelLink | null; onBack: () => void };

function splitIntoLines(text: string) {
  const lines: string[] = [];
  for (let index = 0; index < text.length; index += 52) lines.push(text.slice(index, index + 52));
  return lines.length ? lines : [""];
}

export function ChannelIntroPage({ intro, link, onBack }: ChannelIntroPageProps) {
  return (
    <section className="channel-intro-page" aria-label="채널 소개">
      <h1>소개</h1>
      <div className="channel-intro-full">{splitIntoLines(intro).map((line, index) => <p key={`${line}-${index}`}>{line}</p>)}</div>
      {link && <a className="channel-intro-link" href={link.url} target="_blank" rel="noreferrer"><strong>{link.title}</strong><span>{link.url}</span></a>}
    </section>
  );
}
