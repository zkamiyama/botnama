import { emitInfoOverlay } from "../events/infoOverlayBus.ts";
import { RequestItem } from "../types.ts";

type Vote = "yes" | "no";

export interface PollRuleConfig {
  enabled: boolean;
  intervalSec: number; // time after play start before asking
  voteWindowSec: number; // how long to collect votes
  stopDelaySec: number; // delay before stopping if rejected
}

interface ActivePollState {
  requestId: string;
  timeoutId: number | null;
  windowTimer: number | null;
  stopTimer: number | null;
  yesVotes: Map<string, Vote>;
  expiresAt: number;
}

let rules: PollRuleConfig = {
  enabled: false,
  intervalSec: 90,
  voteWindowSec: 20,
  stopDelaySec: 10,
};

let state: ActivePollState | null = null;
let onRejectCallback: (() => void) | null = null;

export const configurePollRules = (config: Partial<PollRuleConfig>) => {
  rules = { ...rules, ...config };
};

export const setPollRejectHandler = (handler: () => void) => {
  onRejectCallback = handler;
};

const clearTimers = () => {
  if (state?.timeoutId) clearTimeout(state.timeoutId);
  if (state?.windowTimer) clearTimeout(state.windowTimer);
  if (state?.stopTimer) clearTimeout(state.stopTimer);
};

export const resetPoll = () => {
  clearTimers();
  state = null;
};

export const onPlaybackStarted = (request: RequestItem) => {
  resetPoll();
  if (!rules.enabled) return;
  const timeoutId = setTimeout(() => startPoll(request), rules.intervalSec * 1000) as unknown as number;
  state = {
    requestId: request.id,
    timeoutId,
    windowTimer: null,
    stopTimer: null,
    yesVotes: new Map(),
    expiresAt: Date.now() + rules.intervalSec * 1000,
  };
};

const startPoll = (request: RequestItem) => {
  // announce question
  const questionDurationMs = Math.max(5000, rules.voteWindowSec * 1000);
  emitInfoOverlay({
    level: "info",
    title: "",
    message: "",
    titleKey: "poll_question_title",
    messageKey: "poll_question_body",
    params: { url: request.url },
    scope: "status",
    durationMs: questionDurationMs,
  });
  if (!state) return;
  const windowTimer = setTimeout(() => finishPoll(request), rules.voteWindowSec * 1000) as unknown as number;
  state.windowTimer = windowTimer;
  state.expiresAt = Date.now() + rules.voteWindowSec * 1000;
};

const finishPoll = (request: RequestItem) => {
  if (!state) return;
  const votes = Array.from(state.yesVotes.values());
  const total = votes.length;
  const yesCount = votes.filter((v) => v === "yes").length;
  const yesPct = total === 0 ? 0 : Math.round((yesCount / total) * 100);
  const noPct = total === 0 ? 0 : 100 - yesPct;
  
  let winner: "yes" | "no" | "draw" = "draw";
  if (noPct > yesPct) {
    winner = "no";
  } else {
    // yesPct >= noPct (tie or yes majority) -> continue, so highlight yes
    winner = "yes";
  }

  emitInfoOverlay({
    level: "info",
    titleKey: "poll_result_title",
    messageKey: "poll_result_body",
    params: {
      yes: yesPct,
      no: noPct,
      total,
      winner,
    },
    scope: "status",
  });
  if (noPct > yesPct) {
    const stopTimer = setTimeout(() => {
      if (onRejectCallback) onRejectCallback();
    }, rules.stopDelaySec * 1000) as unknown as number;
    if (state) state.stopTimer = stopTimer;
  } else {
    // schedule next poll
    const timeoutId = setTimeout(() => startPoll(request), rules.intervalSec * 1000) as unknown as number;
    state.timeoutId = timeoutId;
    state.windowTimer = null;
    state.yesVotes.clear();
    state.expiresAt = Date.now() + rules.intervalSec * 1000;
  }
};

export const handleVote = (requestId: string | null, userKey: string, vote: Vote) => {
  if (!state || state.requestId !== requestId) return;
  if (!state.windowTimer) return; // only count during window
  state.yesVotes.set(userKey, vote);
};
