export type DockEvent = "requests" | "comments" | "system";

type Listener = (event: DockEvent) => void;

class DockEventBus {
  #listeners = new Set<Listener>();

  subscribe(listener: Listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  emit(event: DockEvent) {
    for (const listener of this.#listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error("[DockEventBus] listener error", err);
      }
    }
  }
}

export const dockEventBus = new DockEventBus();

export const emitDockEvent = (event: DockEvent) => {
  dockEventBus.emit(event);
};

export const DOCK_EVENT = {
  REQUESTS: "requests",
  COMMENTS: "comments",
  SYSTEM: "system",
} as const satisfies Record<string, DockEvent>;
