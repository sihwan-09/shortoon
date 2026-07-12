import { env } from "cloudflare:workers";

async function ensureComments() {
  await env.DB.batch([
    env.DB.prepare("CREATE TABLE IF NOT EXISTS comments (id INTEGER PRIMARY KEY AUTOINCREMENT, comic_id INTEGER NOT NULL REFERENCES comics(id) ON DELETE CASCADE, author TEXT NOT NULL, body TEXT NOT NULL, is_spoiler INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS comments_comic_created_idx ON comments (comic_id, created_at DESC)"),
  ]);
}

export async function GET(request: Request) {
  await ensureComments();
  const comicId = Number(new URL(request.url).searchParams.get("comicId"));
  if (!Number.isInteger(comicId) || comicId < 1) return Response.json({ error: "Invalid comic" }, { status: 400 });
  const result = await env.DB.prepare("SELECT id, comic_id AS comicId, author, body, is_spoiler AS isSpoiler, created_at AS createdAt FROM comments WHERE comic_id = ? ORDER BY created_at DESC LIMIT 100").bind(comicId).all();
  return Response.json({ comments: result.results });
}

export async function POST(request: Request) {
  await ensureComments();
  const input = await request.json() as { comicId?: number; author?: string; body?: string; isSpoiler?: boolean };
  const comicId = Number(input.comicId);
  const author = String(input.author ?? "").trim().slice(0, 20);
  const body = String(input.body ?? "").trim().slice(0, 500);
  if (!Number.isInteger(comicId) || comicId < 1 || !author || !body) return Response.json({ error: "Missing comment fields" }, { status: 400 });
  const result = await env.DB.prepare("INSERT INTO comments (comic_id, author, body, is_spoiler, created_at) VALUES (?, ?, ?, ?, ?) RETURNING id, comic_id AS comicId, author, body, is_spoiler AS isSpoiler, created_at AS createdAt")
    .bind(comicId, author, body, input.isSpoiler ? 1 : 0, Date.now()).first();
  return Response.json({ comment: result }, { status: 201 });
}
