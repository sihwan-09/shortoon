"use client";

import { useEffect, useRef, useState } from "react";

type Panel = { id: number; position: number; eyebrow: string; line: string; tone: string };
type Comic = { id: number; title: string; creator: string; genre: string; accent: string; panels: Panel[] };

const fallbackComics: Comic[] = [
  { id: 1, title: "Midnight Delivery", creator: "Haru", genre: "Mystery", accent: "#C7FF3D", panels: [
    { id: 1, position: 1, eyebrow: "11:58 PM", line: "The order said: deliver before midnight.", tone: "lime" },
    { id: 2, position: 2, eyebrow: "59 SECONDS LEFT", line: "But the address did not exist.", tone: "violet" },
    { id: 3, position: 3, eyebrow: "KNOCK KNOCK", line: "Someone answered from inside the wall.", tone: "red" },
  ]},
  { id: 2, title: "Orbiting You", creator: "Mina", genre: "Romance", accent: "#8B7CFF", panels: [
    { id: 4, position: 1, eyebrow: "DAY 127", line: "Every night, the same star followed her home.", tone: "blue" },
    { id: 5, position: 2, eyebrow: "SIGNAL FOUND", line: "Tonight, it finally replied.", tone: "violet" },
    { id: 6, position: 3, eyebrow: "ONE MESSAGE", line: "I have been waiting for you too.", tone: "pink" },
  ]},
  { id: 3, title: "Last Train Home", creator: "Doyeon", genre: "Drama", accent: "#FF9F1C", panels: [
    { id: 7, position: 1, eyebrow: "LAST TRAIN", line: "The final carriage was always empty.", tone: "amber" },
    { id: 8, position: 2, eyebrow: "NEXT STOP", line: "Until he saw his younger self.", tone: "blue" },
    { id: 9, position: 3, eyebrow: "DOORS OPEN", line: "You still have time to go back.", tone: "lime" },
  ]},
];

export function ComicFeed() {
  const [comics, setComics] = useState(fallbackComics);
  const [activeComic, setActiveComic] = useState(0);
  const [activePanels, setActivePanels] = useState<Record<number, number>>({});
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/comics").then((response) => response.ok ? response.json() : Promise.reject())
      .then((data) => data.comics?.length && setComics(data.comics)).catch(() => undefined);
  }, []);

  const onHorizontalScroll = () => {
    const feed = feedRef.current;
    if (!feed) return;
    setActiveComic(Math.round(feed.scrollLeft / feed.clientWidth));
  };

  return (
    <section className="feed-wrap" aria-label="Shorttoon comic feed">
      <div className="feed-progress" aria-label={`Comic ${activeComic + 1} of ${comics.length}`}>
        {comics.map((comic, index) => <span key={comic.id} className={index === activeComic ? "active" : ""} />)}
      </div>
      <div className="comic-feed" ref={feedRef} onScroll={onHorizontalScroll}>
        {comics.map((comic, comicIndex) => (
          <article className="comic-column" key={comic.id} aria-label={comic.title}>
            <div className="panel-stack" onScroll={(event) => {
              const element = event.currentTarget;
              setActivePanels((current) => ({ ...current, [comic.id]: Math.round(element.scrollTop / element.clientHeight) }));
            }}>
              {comic.panels.map((panel, panelIndex) => (
                <section className={`comic-panel tone-${panel.tone}`} key={panel.id}>
                  <div className="panel-art" aria-hidden="true"><i /><b /><em /></div>
                  <div className="panel-copy">
                    <span>{panel.eyebrow}</span>
                    <h2>{panel.line}</h2>
                  </div>
                  {panelIndex === 0 && <div className="swipe-tip">Swipe up for next cut</div>}
                </section>
              ))}
            </div>
            <footer className="comic-meta">
              <div><strong>{comic.title}</strong><span>{comic.creator} · {comic.genre}</span></div>
              <div className="cut-count" style={{ color: comic.accent }}>{(activePanels[comic.id] ?? 0) + 1}/{comic.panels.length}</div>
            </footer>
          </article>
        ))}
      </div>
    </section>
  );
}
