import { ensureDirSync } from "@std/fs/ensure-dir";
import { existsSync } from "@std/fs/exists";
import { join } from "@std/path/join";
import { parseRequestUrl } from "./urlParser.ts";
import {
  CreateRequestInput,
  ParsedUrl,
  RequestItem,
  RequestStatus,
} from "../types.ts";
import {
  deleteRequest,
  getById,
  insertRequest,
  listRequests,
  updateRequestFields,
} from "../repositories/requestsRepository.ts";
import { createRequestId, nowMs } from "../utils/ids.ts";

const STOCK_DIR = "config/stocks";
const DEFAULT_STOCK_NAME = "default";
const NEW_STOCK_TEMPLATE: StockFile = { name: DEFAULT_STOCK_NAME, items: [], savedAt: Date.now() };

const writeEmptyStockFile = (name: string) => {
  const filePath = stockFilePath(name);
  if (!existsSync(filePath)) {
    const payload: StockFile = { ...NEW_STOCK_TEMPLATE, name, savedAt: Date.now() };
    Deno.writeTextFileSync(filePath, JSON.stringify(payload, null, 2));
  }
};

export const ensureDefaultStockFile = () => {
  ensureStockDir();
  let hasJson = false;
  try {
    for (const entry of Deno.readDirSync(STOCK_DIR)) {
      if (entry.isFile && entry.name.toLowerCase().endsWith(".json")) {
        hasJson = true;
        break;
      }
    }
  } catch (_err) {
    // ignore
  }
  if (!hasJson) {
    writeEmptyStockFile(DEFAULT_STOCK_NAME);
  }
};

export const ensureStockDir = () => {
  ensureDirSync(STOCK_DIR);
};

const sanitizeStockName = (name: string) => {
  const trimmed = name.trim();
  if (!trimmed) return "default";
  return trimmed.replace(/\.json$/i, "");
};

const stockFilePath = (name: string) => join(STOCK_DIR, `${sanitizeStockName(name)}.json`);

const readStockFile = (name: string): StockFile | null => {
  const filePath = stockFilePath(name);
  if (!existsSync(filePath)) return null;
  try {
    const parsed = JSON.parse(Deno.readTextFileSync(filePath)) as Partial<StockFile>;
    const items = Array.isArray(parsed.items) ? parsed.items.filter((item) => item && typeof item.url === "string") : [];
    return {
      name: sanitizeStockName(parsed.name ?? name),
      savedAt: typeof parsed.savedAt === "number" ? parsed.savedAt : Date.now(),
      items,
    };
  } catch (_err) {
    return null;
  }
};

export const listStockNames = (): string[] => {
  ensureStockDir();
  ensureDefaultStockFile();
  const entries: string[] = [];
  try {
    for (const entry of Deno.readDirSync(STOCK_DIR)) {
      if (entry.isFile && entry.name.toLowerCase().endsWith(".json")) {
        entries.push(entry.name.replace(/\.json$/i, ""));
      }
    }
  } catch (_err) {
    // ignore
  }
  if (entries.length === 0) {
    writeEmptyStockFile(DEFAULT_STOCK_NAME);
    entries.push(DEFAULT_STOCK_NAME);
  }
  if (!entries.includes(DEFAULT_STOCK_NAME)) entries.unshift(DEFAULT_STOCK_NAME);
  return Array.from(new Set(entries));
};

const uniqueStockName = (base: string): string => {
  const names = listStockNames();
  if (!names.includes(base)) return base;
  let i = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const candidate = `${base}-${i}`;
    if (!names.includes(candidate)) return candidate;
    i += 1;
  }
};

type StockFileItem = {
  id: string;
  url: string;
  title?: string | null;
  priority?: number | null;
  status?: RequestStatus;
  parsed?: ParsedUrl | null;
  cacheFilePath?: string | null;
  fileName?: string | null;
  durationSec?: number | null;
};

type StockFile = {
  name: string;
  items: StockFileItem[];
  savedAt: number;
};

const exportBucket = (bucket: string): StockFile => {
  const rows = listRequests({ bucket, limit: 1000 }).items;
  return {
    name: bucket,
    savedAt: Date.now(),
    items: rows.map((r) => ({
      id: r.id,
      url: r.url,
      title: r.title,
      priority: r.queuePosition ?? null,
      status: r.status,
      parsed: r.parsed,
      cacheFilePath: r.cacheFilePath ?? null,
      fileName: r.fileName ?? null,
      durationSec: r.durationSec ?? null,
    })),
  };
};

const importBucket = (bucket: string, file: StockFile) => {
  // remove existing rows in bucket to avoid duplicates
  const existing = listRequests({ bucket, limit: 1000 }).items;
  existing.forEach((item) => deleteRequest(item.id));
  for (const item of file.items) {
    const input: CreateRequestInput = {
      id: item.id || createRequestId(),
      createdAt: nowMs(),
      commentId: null,
      platform: "debug",
      userId: null,
      userName: null,
      originalMessage: item.url,
      url: item.url,
      parsed: item.parsed ?? null,
      status: item.status ?? "QUEUED",
      queuePosition: Number.isFinite(item.priority ?? null) ? item.priority ?? null : null,
      bucket,
    };
    const inserted = insertRequest(input);
    if (item.title || item.durationSec || item.cacheFilePath || item.fileName) {
      updateRequestFields(inserted.id, {
        title: item.title ?? null,
        duration_sec: item.durationSec ?? null,
        cache_file_path: item.cacheFilePath ?? null,
        file_name: item.fileName ?? null,
      });
    }
  }
};

export const loadStock = (name: string): RequestItem[] => {
  ensureStockDir();
  ensureDefaultStockFile();
  const bucket = sanitizeStockName(name);
  const rows = listRequests({ bucket, limit: 1000 }).items;
  if (rows.length > 0) return rows;

  const stockFile = readStockFile(bucket);
  if (stockFile && stockFile.items.length > 0) {
    importBucket(bucket, stockFile);
    return listRequests({ bucket, limit: 1000 }).items;
  }

  // Ensure an empty file exists for newly referenced buckets
  writeEmptyStockFile(bucket);
  return [];
};

export const saveStock = (name: string) => {
  ensureStockDir();
  const bucket = sanitizeStockName(name);
  const filePath = stockFilePath(bucket);
  const payload = exportBucket(bucket);
  Deno.writeTextFileSync(filePath, JSON.stringify(payload, null, 2));
  return filePath;
};

export const createStock = (name: string) => {
  ensureStockDir();
  const bucket = uniqueStockName(sanitizeStockName(name));
  const filePath = stockFilePath(bucket);
  if (!existsSync(filePath)) {
    Deno.writeTextFileSync(filePath, JSON.stringify({ name: bucket, items: [], savedAt: Date.now() }, null, 2));
  }
  return bucket;
};

export const addStockItem = (params: { bucket: string; message: string; priority?: number | null }) => {
  const bucket = sanitizeStockName(params.bucket);
  const parsedUrl = parseRequestUrl(params.message);
  if (!parsedUrl) {
    throw new Error("url-not-found");
  }
  const createdAt = nowMs();
  const queuePosition = Number.isFinite(params.priority ?? null)
    ? Number(params.priority)
    : null;
  const request = insertRequest({
    id: createRequestId(),
    createdAt,
    commentId: null,
    platform: "debug",
    userId: null,
    userName: null,
    originalMessage: params.message,
    url: parsedUrl.rawUrl,
    parsed: parsedUrl,
    status: "QUEUED",
    queuePosition,
    bucket,
    notifyComment: false,
    notifyTelop: false,
  });
  return request;
};

export const submitStockItems = (
  params: { bucket: string; ids: string[]; asSuspend?: boolean },
): RequestItem[] => {
  const bucket = sanitizeStockName(params.bucket);
  const items: RequestItem[] = [];
  for (const id of params.ids) {
    const src = getById(id);
    if (!src || src.bucket !== bucket) continue;
    const status: RequestStatus = params.asSuspend ? "SUSPEND" : src.status === "READY" ? "READY" : "QUEUED";
    const queuePosition = src.queuePosition ?? null;
    const copy = insertRequest({
      id: createRequestId(),
      createdAt: nowMs(),
      commentId: null,
      platform: src.platform,
      userId: src.userId,
      userName: src.userName,
      originalMessage: src.originalMessage,
      url: src.url,
      parsed: src.parsed,
      status,
      queuePosition,
      bucket: "queue",
      notifyComment: false,
      notifyTelop: false,
    });
    if (src.fileName || src.cacheFilePath || src.durationSec || src.title) {
      updateRequestFields(copy.id, {
        title: src.title ?? null,
        duration_sec: src.durationSec ?? null,
        file_name: src.fileName ?? null,
        cache_file_path: src.cacheFilePath ?? null,
        cache_file_size: src.cacheFileSize ?? null,
        status: status,
      });
    }
    items.push(copy);
  }
  return items;
};
