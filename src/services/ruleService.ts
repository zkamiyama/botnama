import { ensureDirSync } from "@std/fs/ensure-dir";
import { join } from "@std/path/join";
import { fromFileUrl } from "@std/path/from-file-url";

type RuleState = {
  maxDurationMinutes: number;
  maxDurationEnabled: boolean;
  disallowDuplicates: boolean;
  cooldownMinutes: number;
  pollEnabled: boolean;
  pollIntervalSec: number;
  pollWindowSec: number;
  pollStopDelaySec: number;
};

const PROJECT_ROOT = fromFileUrl(new URL("../..", import.meta.url));
const CONFIG_DIR = join(PROJECT_ROOT, "config");
const RULES_PATH = join(CONFIG_DIR, "rules.json");

const DEFAULT_STATE: RuleState = {
  maxDurationMinutes: 10, // default fallback, will be overridden by init
  maxDurationEnabled: true,
  disallowDuplicates: true,
  cooldownMinutes: 60,
  pollEnabled: false,
  pollIntervalSec: 90,
  pollWindowSec: 20,
  pollStopDelaySec: 10,
};

let state: RuleState = { ...DEFAULT_STATE };

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
};

export const initRuleState = (initialMaxDurationSec: number) => {
  state = { ...DEFAULT_STATE };
  state.maxDurationMinutes = Math.max(1, Math.round(initialMaxDurationSec / 60));
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
