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
      timestamp INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS requests (
      id TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      comment_id TEXT,
      platform TEXT NOT NULL,
      user_name TEXT,
      original_message TEXT NOT NULL,
      url TEXT NOT NULL,
      parsed_site TEXT,
      parsed_video_id TEXT,
      parsed_normalized_url TEXT,
      title TEXT,
      duration_sec INTEGER,
      thumbnail_url TEXT,
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

    CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
    CREATE INDEX IF NOT EXISTS idx_requests_queue ON requests(queue_position);

  `);
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
