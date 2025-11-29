export type InfoOverlayLevel = "info" | "warn" | "error";

export type InfoOverlayEvent = {
  id: string;
  level: InfoOverlayLevel;
  title?: string;
  message?: string | null;
  titleKey?: string;
  messageKey?: string;
  params?: Record<string, unknown> | null;
  requestId?: string | null;
  userName?: string | null;
  url?: string | null;
  scope?: "info" | "status";
  stats?: Record<string, unknown> | null;
  durationMs?: number | null;
  createdAt: number;
};

type Listener = (event: InfoOverlayEvent) => void;

class InfoOverlayBus {
  #listeners = new Set<Listener>();

  subscribe(listener: Listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  emit(event: InfoOverlayEvent) {
    for (const listener of this.#listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error("[InfoOverlayBus] listener error", err);
      }
    }
  }
}

const bus = new InfoOverlayBus();

export const emitInfoOverlay = (
  input: Omit<InfoOverlayEvent, "id" | "createdAt"> & {
    id?: string;
    createdAt?: number;
  },
) => {
  const event: InfoOverlayEvent = {
    id: input.id ?? crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
    createdAt: input.createdAt ?? Date.now(),
    level: input.level,
    title: input.title,
    message: input.message ?? null,
    titleKey: input.titleKey,
    messageKey: input.messageKey,
    params: input.params ?? null,
    requestId: input.requestId ?? null,
    userName: input.userName ?? null,
    url: input.url ?? null,
    scope: input.scope ?? "info",
    stats: input.stats ?? null,
    durationMs: typeof input.durationMs === "number" ? input.durationMs : null,
  };
  bus.emit(event);
  return event;
};

export const subscribeInfoOverlay = (listener: Listener) => bus.subscribe(listener);
