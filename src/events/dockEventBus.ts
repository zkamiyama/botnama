export type DockEvent = "requests" | "comments" | "system" | "logs" | "rules";

type Listener = (event: DockEvent, data?: unknown) => void;

class DockEventBus {
  #listeners = new Set<Listener>();

  subscribe(listener: Listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  emit(event: DockEvent, data?: unknown) {
    for (const listener of this.#listeners) {
      try {
        listener(event, data);
      } catch (err) {
        console.error("[DockEventBus] listener error", err);
      }
    }
  }
}

export const dockEventBus = new DockEventBus();

export const emitDockEvent = (event: DockEvent, data?: unknown) => {
  dockEventBus.emit(event, data);
};

export const DOCK_EVENT = {
  REQUESTS: "requests",
  COMMENTS: "comments",
  SYSTEM: "system",
  LOGS: "logs",
  RULES: "rules",
} as const satisfies Record<string, DockEvent>;
