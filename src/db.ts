import { ensureDirSync } from "@std/fs/ensure-dir";
import { join } from "@std/path/join";
import { DatabaseSync } from "node:sqlite";

const DB_DIR = "db";
const DB_FILE = "app.sqlite";

let dbInstance: DatabaseSync | null = null;

const createSchema = (db: DatabaseSync) => {
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      platform TEXT NOT NULL,
      room_id TEXT,
      user_id TEXT,
      user_name TEXT,
      message TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      request_id TEXT,
      request_status TEXT,
      request_status_reason TEXT
    );

    CREATE TABLE IF NOT EXISTS requests (
      id TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      comment_id TEXT,
      platform TEXT NOT NULL,
      user_id TEXT,
      user_name TEXT,
      original_message TEXT NOT NULL,
      url TEXT NOT NULL,
      parsed_site TEXT,
      parsed_video_id TEXT,
      parsed_normalized_url TEXT,
      title TEXT,
      duration_sec INTEGER,
      thumbnail_url TEXT,
      uploaded_at INTEGER,
      view_count INTEGER,
      like_count INTEGER,
      dislike_count INTEGER,
      comment_count INTEGER,
      mylist_count INTEGER,
      favorite_count INTEGER,
      danmaku_count INTEGER,
      meta_refreshed_at INTEGER,
      uploader TEXT,
      status TEXT NOT NULL,
      status_reason TEXT,
      queue_position INTEGER,
      play_started_at INTEGER,
      play_ended_at INTEGER,
      file_name TEXT,
      cache_file_path TEXT,
      cache_file_size INTEGER,
      FOREIGN KEY(comment_id) REFERENCES comments(id)
    );

    CREATE TABLE IF NOT EXISTS playback_logs (
      id TEXT PRIMARY KEY,
      request_id TEXT,
      title TEXT,
      url TEXT NOT NULL,
      played_at INTEGER NOT NULL,
      FOREIGN KEY(request_id) REFERENCES requests(id)
    );

    CREATE INDEX IF NOT EXISTS idx_playback_logs_played_at ON playback_logs(played_at DESC);

    CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
    CREATE INDEX IF NOT EXISTS idx_requests_queue ON requests(queue_position);

  `);

  const ensureColumn = (table: string, column: string, definition: string) => {
    const info = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    if (!info.some((row) => row.name === column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  };

  ensureColumn("requests", "uploaded_at", "INTEGER");
  ensureColumn("requests", "view_count", "INTEGER");
  ensureColumn("requests", "like_count", "INTEGER");
  ensureColumn("requests", "dislike_count", "INTEGER");
  ensureColumn("requests", "comment_count", "INTEGER");
  ensureColumn("requests", "mylist_count", "INTEGER");
  ensureColumn("requests", "favorite_count", "INTEGER");
  ensureColumn("requests", "danmaku_count", "INTEGER");
  ensureColumn("requests", "meta_refreshed_at", "INTEGER");
  ensureColumn("requests", "uploader", "TEXT");
  ensureColumn("requests", "user_id", "TEXT");
  ensureColumn("comments", "request_id", "TEXT");
  ensureColumn("comments", "request_status", "TEXT");
  ensureColumn("comments", "request_status_reason", "TEXT");
};

export const getDb = () => {
  if (!dbInstance) {
    ensureDirSync(DB_DIR);
    const dbPath = join(DB_DIR, DB_FILE);
    dbInstance = new DatabaseSync(dbPath, {
      enableForeignKeyConstraints: true,
    });
    createSchema(dbInstance);
  }
  return dbInstance;
};

export const closeDb = () => {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
};
