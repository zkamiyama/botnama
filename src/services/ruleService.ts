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

let state: RuleState = {
  maxDurationMinutes: 10, // default fallback, will be overridden by init
  maxDurationEnabled: true,
  disallowDuplicates: true,
  cooldownMinutes: 60,
  pollEnabled: false,
  pollIntervalSec: 90,
  pollWindowSec: 20,
  pollStopDelaySec: 10,
};

export const initRuleState = (initialMaxDurationSec: number) => {
  state.maxDurationMinutes = Math.max(1, Math.round(initialMaxDurationSec / 60));
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
