import { isIntakePaused, toggleIntake, setIntakePaused } from "./requestGate.ts";
import { emitInfoOverlay } from "../events/infoOverlayBus.ts";

export const getIntakeStatus = () => ({ paused: isIntakePaused() });

export const toggleIntakeStatus = () => {
  const paused = toggleIntake();
  emitInfoOverlay({
    level: "info",
    titleKey: paused ? "request_intake_paused_title" : "request_intake_resumed_title",
    scope: "status",
  });
  return { paused };
};

export const setIntakeStatus = (paused: boolean) => ({ paused: setIntakePaused(paused) });
