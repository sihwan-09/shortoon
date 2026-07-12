import { env } from "cloudflare:workers";

const seedComics = [
  { id: 1, title: "Midnight Delivery", creator: "Haru", genre: "Mystery", accent: "#C7FF3D", publisher: "NAVER", fullUrl: "https://comic.naver.com" },
  { id: 2, title: "Orbiting You", creator: "Mina", genre: "Romance", accent: "#8B7CFF", publisher: "KAKAO", fullUrl: "https://webtoon.kakao.com" },
  { id: 3, title: "Last Train Home", creator: "Doyeon", genre: "Drama", accent: "#FF9F1C", publisher: "NAVER", fullUrl: "https://comic.naver.com" },
];

const seedPanels = [
  [1, 1, "11:58 PM", "The order said: deliver before midnight.", "lime"],
  [1, 2, "59 SECONDS LEFT", "But the address did not exist.", "violet"],
  [1, 3, "KNOCK KNOCK", "Someone answered from inside the wall.", "red"],
  [2, 1, "DAY 127", "Every night, the same star followed her home.", "blue"],
  [2, 2, "SIGNAL FOUND", "Tonight, it finally replied.", "violet"],
  [2, 3, "ONE MESSAGE", "I have been waiting for you too.", "pink"],
  [3, 1, "LAST TRAIN", "The final carriage was always empty.", "amber"],
  [3, 2, "NEXT STOP", "Until he saw his younger self.", "blue"],
  [3, 3, "DOORS OPEN", "You still have time to go back.", "lime"],
];

async function ensureSeeded() {
  const db = env.DB;
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS comics (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, creator TEXT NOT NULL, genre TEXT NOT NULL, accent TEXT NOT NULL, publisher TEXT NOT NULL DEFAULT 'NAVER', full_url TEXT NOT NULL DEFAULT 'https://comic.naver.com', created_at INTEGER NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS panels (id INTEGER PRIMARY KEY AUTOINCREMENT, comic_id INTEGER NOT NULL REFERENCES comics(id) ON DELETE CASCADE, position INTEGER NOT NULL, eyebrow TEXT NOT NULL, line TEXT NOT NULL, tone TEXT NOT NULL)"),
    db.prepare("CREATE INDEX IF NOT EXISTS panels_comic_position_idx ON panels (comic_id, position)"),
  ]);

  const count = await db.prepare("SELECT COUNT(*) AS count FROM comics").first<{ count: number }>();
  if ((count?.count ?? 0) > 0) return;

  const comicStatements = seedComics.map((comic) =>
    db.prepare("INSERT INTO comics (id, title, creator, genre, accent, publisher, full_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(comic.id, comic.title, comic.creator, comic.genre, comic.accent, comic.publisher, comic.fullUrl, Date.now())
  );
  const panelStatements = seedPanels.map((panel) =>
    db.prepare("INSERT INTO panels (comic_id, position, eyebrow, line, tone) VALUES (?, ?, ?, ?, ?)")
      .bind(...panel)
  );
  await db.batch([...comicStatements, ...panelStatements]);
}

export async function GET() {
  await ensureSeeded();
  const [comicResult, panelResult] = await Promise.all([
    env.DB.prepare("SELECT id, title, creator, genre, accent, publisher, full_url AS fullUrl FROM comics ORDER BY id").all(),
    env.DB.prepare("SELECT id, comic_id AS comicId, position, eyebrow, line, tone FROM panels ORDER BY comic_id, position").all(),
  ]);
  const comics = comicResult.results.map((comic) => ({
    ...comic,
    panels: panelResult.results.filter((panel) => panel.comicId === comic.id),
  }));
  return Response.json({ comics });
}
