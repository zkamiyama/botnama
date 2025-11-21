import { getDb } from "../db.ts";
import { DOCK_EVENT, emitDockEvent } from "../events/dockEventBus.ts";
import { PlaybackLogItem } from "../types.ts";

const generateId = () => {
  try {
    if (typeof crypto?.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch (_err) {
    // ignore
  }
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
};

type PlaybackLogRow = {
  id: string;
  request_id: string | null;
  title: string | null;
  url: string;
  played_at: number;
};

const rowToItem = (row: PlaybackLogRow): PlaybackLogItem => ({
  id: row.id,
  requestId: row.request_id,
  title: row.title,
  url: row.url,
  playedAt: row.played_at,
});

export const insertPlaybackLog = (input: {
  requestId: string | null;
  title: string | null;
  url: string;
  playedAt: number;
}) => {
  const db = getDb();
  const id = generateId();
  db.prepare(
    `INSERT INTO playback_logs (id, request_id, title, url, played_at)
     VALUES (:id, :requestId, :title, :url, :playedAt)`,
  ).run({ id, ...input });
  emitDockEvent(DOCK_EVENT.LOGS);
  return { id, ...input } satisfies PlaybackLogItem;
};

export const listPlaybackLogs = (limit: number): PlaybackLogItem[] => {
  const db = getDb();
  const safeLimit = Math.max(1, Math.min(limit, 1000));
  const rows = db.prepare(
    `SELECT id, request_id, title, url, played_at
     FROM playback_logs
     ORDER BY played_at DESC
     LIMIT :limit`,
  ).all({ limit: safeLimit }) as PlaybackLogRow[];
  return rows.map(rowToItem);
};

export const clearPlaybackLogs = () => {
  const db = getDb();
  db.exec(`DELETE FROM playback_logs`);
  emitDockEvent(DOCK_EVENT.LOGS);
};

export const fetchAllPlaybackLogs = (): PlaybackLogItem[] => {
  const db = getDb();
  const rows = db.prepare(
    `SELECT id, request_id, title, url, played_at
     FROM playback_logs
     ORDER BY played_at DESC`,
  ).all() as PlaybackLogRow[];
  return rows.map(rowToItem);
};
