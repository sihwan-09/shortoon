"use client";

import { useEffect, useRef, useState } from "react";

type Panel = { id: number; position: number; eyebrow: string; line: string; tone: string };
type Comic = { id: number; title: string; creator: string; genre: string; accent: string; publisher: string; fullUrl: string; panels: Panel[] };
type Comment = { id: number; comicId: number; author: string; body: string; isSpoiler: number | boolean; createdAt: number };

const fallbackComics: Comic[] = [
  { id: 1, title: "Midnight Delivery", creator: "Haru", genre: "Mystery", accent: "#C7FF3D", publisher: "NAVER", fullUrl: "https://comic.naver.com", panels: [
    { id: 1, position: 1, eyebrow: "11:58 PM", line: "The order said: deliver before midnight.", tone: "lime" },
    { id: 2, position: 2, eyebrow: "59 SECONDS LEFT", line: "But the address did not exist.", tone: "violet" },
    { id: 3, position: 3, eyebrow: "KNOCK KNOCK", line: "Someone answered from inside the wall.", tone: "red" },
  ]},
  { id: 2, title: "Orbiting You", creator: "Mina", genre: "Romance", accent: "#8B7CFF", publisher: "KAKAO", fullUrl: "https://webtoon.kakao.com", panels: [
    { id: 4, position: 1, eyebrow: "DAY 127", line: "Every night, the same star followed her home.", tone: "blue" },
    { id: 5, position: 2, eyebrow: "SIGNAL FOUND", line: "Tonight, it finally replied.", tone: "violet" },
    { id: 6, position: 3, eyebrow: "ONE MESSAGE", line: "I have been waiting for you too.", tone: "pink" },
  ]},
  { id: 3, title: "Last Train Home", creator: "Doyeon", genre: "Drama", accent: "#FF9F1C", publisher: "NAVER", fullUrl: "https://comic.naver.com", panels: [
    { id: 7, position: 1, eyebrow: "LAST TRAIN", line: "The final carriage was always empty.", tone: "amber" },
    { id: 8, position: 2, eyebrow: "NEXT STOP", line: "Until he saw his younger self.", tone: "blue" },
    { id: 9, position: 3, eyebrow: "DOORS OPEN", line: "You still have time to go back.", tone: "lime" },
  ]},
];

export function ComicFeed() {
  const [comics, setComics] = useState(fallbackComics);
  const [activeComic, setActiveComic] = useState(0);
  const [activePanels, setActivePanels] = useState<Record<number, number>>({});
  const [commentComic, setCommentComic] = useState<Comic | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [author, setAuthor] = useState("");
  const [body, setBody] = useState("");
  const [isSpoiler, setIsSpoiler] = useState(false);
  const [submitting, setSubmitting] = useState(false);
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

  const openComments = async (comic: Comic) => {
    setCommentComic(comic);
    const response = await fetch(`/api/comments?comicId=${comic.id}`);
    if (response.ok) setComments((await response.json()).comments ?? []);
  };

  const submitComment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!commentComic || !author.trim() || !body.trim()) return;
    setSubmitting(true);
    const response = await fetch("/api/comments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ comicId: commentComic.id, author, body, isSpoiler }) });
    if (response.ok) {
      const { comment } = await response.json();
      setComments((current) => [comment, ...current]);
      setBody("");
      setIsSpoiler(false);
    }
    setSubmitting(false);
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
            <div className="action-rail">
              <a href={comic.fullUrl} target="_blank" rel="noreferrer" aria-label={`Open full ${comic.title} on ${comic.publisher}`}><span>↗</span><small>{comic.publisher}</small></a>
              <button type="button" onClick={() => openComments(comic)} aria-label={`Comments for ${comic.title}`}><span>•••</span><small>COMMENT</small></button>
            </div>
            <footer className="comic-meta">
              <div><strong>{comic.title}</strong><span>{comic.creator} · {comic.genre}</span></div>
              <div className="cut-count" style={{ color: comic.accent }}>{(activePanels[comic.id] ?? 0) + 1}/{comic.panels.length}</div>
            </footer>
          </article>
        ))}
      </div>
      {commentComic && <div className="sheet-backdrop" role="presentation" onClick={() => setCommentComic(null)}>
        <aside className="comment-sheet" role="dialog" aria-modal="true" aria-label={`Comments for ${commentComic.title}`} onClick={(event) => event.stopPropagation()}>
          <div className="sheet-handle" />
          <header><div><span>COMMENTS</span><strong>{commentComic.title}</strong></div><button type="button" onClick={() => setCommentComic(null)} aria-label="Close comments">×</button></header>
          <div className="comment-list">
            {comments.length === 0 && <p className="no-comments">Be the first to leave a comment.</p>}
            {comments.map((comment) => {
              const hidden = Boolean(comment.isSpoiler) && !revealed.has(comment.id);
              return <article className={`comment-card ${hidden ? "spoiler-hidden" : ""}`} key={comment.id}>
                <div><strong>{comment.author}</strong>{Boolean(comment.isSpoiler) && <span>SPOILER</span>}</div>
                <p>{hidden ? "This comment contains a spoiler." : comment.body}</p>
                {hidden && <button type="button" onClick={() => setRevealed((current) => new Set(current).add(comment.id))}>Reveal spoiler</button>}
              </article>;
            })}
          </div>
          <form className="comment-form" onSubmit={submitComment}>
            <input value={author} onChange={(event) => setAuthor(event.target.value)} placeholder="Nickname" maxLength={20} aria-label="Nickname" required />
            <textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="Write a comment" maxLength={500} aria-label="Comment" required />
            <div><label><input type="checkbox" checked={isSpoiler} onChange={(event) => setIsSpoiler(event.target.checked)} /> Contains spoiler</label><button type="submit" disabled={submitting}>{submitting ? "Posting..." : "Post"}</button></div>
          </form>
        </aside>
      </div>}
    </section>
  );
}
