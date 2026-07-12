import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const comics = sqliteTable("comics", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  creator: text("creator").notNull(),
  genre: text("genre").notNull(),
  accent: text("accent").notNull(),
  publisher: text("publisher").notNull().default("NAVER"),
  fullUrl: text("full_url").notNull().default("https://comic.naver.com"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const comments = sqliteTable("comments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  comicId: integer("comic_id").notNull().references(() => comics.id, { onDelete: "cascade" }),
  author: text("author").notNull(),
  body: text("body").notNull(),
  isSpoiler: integer("is_spoiler", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const panels = sqliteTable("panels", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  comicId: integer("comic_id").notNull().references(() => comics.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  eyebrow: text("eyebrow").notNull(),
  line: text("line").notNull(),
  tone: text("tone").notNull(),
});
