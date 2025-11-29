import { ensureDirSync } from "@std/fs/ensure-dir";
import { join } from "@std/path/join";
import { PROJECT_ROOT } from "../settings.ts";
import { DOCK_EVENT, emitDockEvent } from "../events/dockEventBus.ts";

export type CustomSiteRule = {
  id: string;
  pattern: string;
  alias?: string; // optional short alias like "sc" -> soundcloud
};

type RuleState = {
  maxDurationMinutes: number;
  maxDurationEnabled: boolean;
  disallowDuplicates: boolean;
  cooldownMinutes: number;
  pollEnabled: boolean;
  pollIntervalSec: number;
  pollWindowSec: number;
  pollStopDelaySec: number;
  allowYoutube: boolean;
  allowNicovideo: boolean;
  allowBilibili: boolean;
  customSites: CustomSiteRule[];
  concurrentLimitEnabled: boolean;
  concurrentLimitCount: number;
  ngUserBlockingEnabled: boolean;
  ngUserIds: string[];
  // Notification (telop) settings
  notifyTelopEnabled: boolean;
  notifyTelopNiconico: boolean;
  notifyTelopYoutube: boolean;
  notifyTelopDelayMs: number;
};

const CONFIG_DIR = join(PROJECT_ROOT, "config");
const RULES_PATH = join(CONFIG_DIR, "rules.json");

const DEFAULT_STATE: RuleState = {
  maxDurationMinutes: 10, // default fallback, will be overridden by init
  // Default to OFF in shipped builds - users can enable this in config/rules.json
  maxDurationEnabled: false,
  disallowDuplicates: true,
  cooldownMinutes: 60,
  pollEnabled: false,
  pollIntervalSec: 90,
  pollWindowSec: 20,
  pollStopDelaySec: 10,
  allowYoutube: true,
  allowNicovideo: true,
  allowBilibili: true,
  customSites: [],
  concurrentLimitEnabled: false,
  concurrentLimitCount: 5,
  ngUserBlockingEnabled: false,
  ngUserIds: [],
  notifyTelopEnabled: false,
  notifyTelopNiconico: true,
  notifyTelopYoutube: true,
  notifyTelopDelayMs: 5000,
};

let state: RuleState = { ...DEFAULT_STATE };

const uuid = () => {
  try {
    if (typeof crypto?.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch (_err) {
    // ignore
  }
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
};

const buildRegex = (source: string) => {
  const trimmed = source.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("/") && trimmed.lastIndexOf("/") > 0) {
    const lastSlash = trimmed.lastIndexOf("/");
    const body = trimmed.slice(1, lastSlash);
    const flags = trimmed.slice(lastSlash + 1);
    if (!body) return null;
    try {
      return new RegExp(body, flags || undefined);
    } catch (_err) {
      return null;
    }
  }
  try {
    return new RegExp(trimmed, "i");
  } catch (_err) {
    return null;
  }
};

const normalizeCustomSites = (value: unknown): CustomSiteRule[] => {
  if (!Array.isArray(value)) return state.customSites;
  const result: CustomSiteRule[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const rawPattern = (item as { pattern?: unknown }).pattern;
    const pattern = typeof rawPattern === "string" ? rawPattern.trim() : "";
    if (!pattern) continue;
    const regex = buildRegex(pattern);
    if (!regex) continue;
    const rawID = (item as { id?: unknown }).id;
    const idValue = typeof rawID === "string" ? rawID.trim() : "";
    const rawAlias = (item as { alias?: unknown }).alias;
    const aliasValue = typeof rawAlias === "string" ? rawAlias.trim().toLowerCase() : "";
    const alias = aliasValue && /^[a-z0-9_-]{1,8}$/.test(aliasValue) ? aliasValue : undefined;
    result.push({
      id: idValue || uuid(),
      pattern,
      alias,
    });
  }
  return result;
};

const normalizeNgUserIds = (value: unknown): string[] => {
  if (!Array.isArray(value)) return state.ngUserIds;
  const unique = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const trimmed = entry.trim();
    if (!trimmed) continue;
    unique.add(trimmed);
  }
  return Array.from(unique.values());
};

const applyRuleUpdates = (input: Partial<RuleState>) => {
  if (typeof input.maxDurationMinutes === "number" && Number.isFinite(input.maxDurationMinutes)) {
    state.maxDurationMinutes = Math.max(1, Math.round(input.maxDurationMinutes));
  }
  if (typeof input.maxDurationEnabled === "boolean") {
    state.maxDurationEnabled = input.maxDurationEnabled;
  }
  if (typeof input.disallowDuplicates === "boolean") {
    state.disallowDuplicates = input.disallowDuplicates;
  }
  if (typeof input.cooldownMinutes === "number" && Number.isFinite(input.cooldownMinutes)) {
    state.cooldownMinutes = Math.max(0, Math.round(input.cooldownMinutes));
  }
  if (typeof input.pollEnabled === "boolean") state.pollEnabled = input.pollEnabled;
  if (typeof input.pollIntervalSec === "number" && Number.isFinite(input.pollIntervalSec)) {
    state.pollIntervalSec = Math.max(10, Math.round(input.pollIntervalSec));
  }
  if (typeof input.pollWindowSec === "number" && Number.isFinite(input.pollWindowSec)) {
    state.pollWindowSec = Math.max(5, Math.round(input.pollWindowSec));
  }
  if (typeof input.pollStopDelaySec === "number" && Number.isFinite(input.pollStopDelaySec)) {
    state.pollStopDelaySec = Math.max(1, Math.round(input.pollStopDelaySec));
  }
  if (typeof input.allowYoutube === "boolean") state.allowYoutube = input.allowYoutube;
  if (typeof input.allowNicovideo === "boolean") state.allowNicovideo = input.allowNicovideo;
  if (typeof input.allowBilibili === "boolean") state.allowBilibili = input.allowBilibili;
  if (Array.isArray(input.customSites)) {
    state.customSites = normalizeCustomSites(input.customSites);
  }
  if (typeof input.concurrentLimitEnabled === "boolean") {
    state.concurrentLimitEnabled = input.concurrentLimitEnabled;
  }
  if (
    typeof input.concurrentLimitCount === "number" && Number.isFinite(input.concurrentLimitCount)
  ) {
    state.concurrentLimitCount = Math.max(1, Math.round(input.concurrentLimitCount));
  }
  if (typeof input.ngUserBlockingEnabled === "boolean") {
    state.ngUserBlockingEnabled = input.ngUserBlockingEnabled;
  }
  if (Array.isArray(input.ngUserIds)) {
    state.ngUserIds = normalizeNgUserIds(input.ngUserIds);
  }
  if (typeof input.notifyTelopEnabled === "boolean") {
    state.notifyTelopEnabled = input.notifyTelopEnabled;
  }
  if (typeof input.notifyTelopNiconico === "boolean") {
    state.notifyTelopNiconico = input.notifyTelopNiconico;
  }
  if (typeof input.notifyTelopYoutube === "boolean") {
    state.notifyTelopYoutube = input.notifyTelopYoutube;
  }
  if (typeof input.notifyTelopDelayMs === "number" && Number.isFinite(input.notifyTelopDelayMs)) {
    state.notifyTelopDelayMs = Math.max(0, Math.round(input.notifyTelopDelayMs));
  }
};

const hydrateFromDisk = () => {
  try {
    const text = Deno.readTextFileSync(RULES_PATH);
    const parsed = JSON.parse(text) as Partial<RuleState> | null;
    if (parsed && typeof parsed === "object") {
      applyRuleUpdates(parsed);
    }
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) {
      // ファイルが無い場合は初期状態を書き出しておく
      persistToDisk();
      return;
    }
    console.error("[RuleService] failed to load rules.json", err);
  }
};

const persistToDisk = () => {
  try {
    ensureDirSync(CONFIG_DIR);
    const serialized = JSON.stringify(state, null, 2);
    Deno.writeTextFileSync(RULES_PATH, serialized);
  } catch (err) {
    console.error("[RuleService] failed to persist rules", err);
  }
  emitDockEvent(DOCK_EVENT.RULES);
};

export const initRuleState = () => {
  state = { ...DEFAULT_STATE };
  hydrateFromDisk();
};

export const getRules = () => ({
  maxDurationMinutes: state.maxDurationMinutes,
  maxDurationEnabled: state.maxDurationEnabled,
  disallowDuplicates: state.disallowDuplicates,
  cooldownMinutes: state.cooldownMinutes,
  pollEnabled: state.pollEnabled,
  pollIntervalSec: state.pollIntervalSec,
  pollWindowSec: state.pollWindowSec,
  pollStopDelaySec: state.pollStopDelaySec,
  allowYoutube: state.allowYoutube,
  allowNicovideo: state.allowNicovideo,
  allowBilibili: state.allowBilibili,
  customSites: state.customSites,
  concurrentLimitEnabled: state.concurrentLimitEnabled,
  concurrentLimitCount: state.concurrentLimitCount,
  ngUserBlockingEnabled: state.ngUserBlockingEnabled,
  ngUserIds: state.ngUserIds,
  notifyTelopEnabled: state.notifyTelopEnabled,
  notifyTelopNiconico: state.notifyTelopNiconico,
  notifyTelopYoutube: state.notifyTelopYoutube,
  notifyTelopDelayMs: state.notifyTelopDelayMs,
});

export const updateRules = (input: Partial<RuleState>) => {
  applyRuleUpdates(input);
  persistToDisk();
  return getRules();
};

export const getEffectiveMaxDurationSec = () => {
  if (!state.maxDurationEnabled) return Number.POSITIVE_INFINITY;
  return state.maxDurationMinutes * 60;
};

export const getDuplicateRule = () => ({
  disallowDuplicates: state.disallowDuplicates,
  cooldownMinutes: state.cooldownMinutes,
});

export const getPollRule = () => ({
  enabled: state.pollEnabled,
  intervalSec: state.pollIntervalSec,
  windowSec: state.pollWindowSec,
  stopDelaySec: state.pollStopDelaySec,
});

export const getSiteAllowances = () => ({
  youtube: state.allowYoutube,
  nicovideo: state.allowNicovideo,
  bilibili: state.allowBilibili,
});

export const getCustomSiteRules = () => state.customSites.slice();

export const compileCustomSiteRegex = (pattern: string) => buildRegex(pattern);

export const getConcurrentLimitRule = () => ({
  enabled: state.concurrentLimitEnabled,
  maxConcurrent: state.concurrentLimitCount,
});

export const getNgUserRule = () => ({
  enabled: state.ngUserBlockingEnabled,
  userIds: state.ngUserIds.slice(),
});

const setNgUserIds = (ids: string[]) => {
  state.ngUserIds = ids;
  persistToDisk();
};

export const addNgUserId = (userId: string) => {
  const trimmed = userId.trim();
  if (!trimmed) return getNgUserRule();
  if (!state.ngUserIds.includes(trimmed)) {
    state.ngUserIds = [...state.ngUserIds, trimmed];
    persistToDisk();
  }
  return getNgUserRule();
};

export const removeNgUserId = (userId: string) => {
  const trimmed = userId.trim();
  if (!trimmed) return getNgUserRule();
  const next = state.ngUserIds.filter((id) => id !== trimmed);
  if (next.length !== state.ngUserIds.length) {
    setNgUserIds(next);
  }
  return getNgUserRule();
};

export const clearNgUserIds = () => {
  if (state.ngUserIds.length === 0) return getNgUserRule();
  setNgUserIds([]);
  return getNgUserRule();
};
