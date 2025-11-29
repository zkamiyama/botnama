import { OverlayInboundMessage, OverlayOutboundMessage, RequestItem } from "../types.ts";
import { DOCK_EVENT, emitDockEvent } from "../events/dockEventBus.ts";

interface OverlayHubHandlers {
  onEnded?: (message: OverlayOutboundMessage) => void;
  onError?: (message: OverlayOutboundMessage) => void;
}

const serialize = (message: OverlayInboundMessage) => JSON.stringify(message);

export class OverlayHub {
  #clients = new Set<WebSocket>();
  #handlers: OverlayHubHandlers;

  constructor(handlers: OverlayHubHandlers = {}) {
    this.#handlers = handlers;
  }

  setHandlers(handlers: OverlayHubHandlers) {
    this.#handlers = handlers;
  }

  register(socket: WebSocket) {
    this.#clients.add(socket);
    console.log(`[OverlayHub] client connected (total=${this.#clients.size})`);
    emitDockEvent(DOCK_EVENT.REQUESTS);
    socket.addEventListener("close", () => {
      this.#clients.delete(socket);
      console.log(`[OverlayHub] client disconnected (total=${this.#clients.size})`);
      emitDockEvent(DOCK_EVENT.REQUESTS);
    });
    socket.addEventListener("message", (event) => {
      try {
        const raw = this.#convertMessageData(event.data);
        if (!raw) return;
        const data = JSON.parse(raw) as OverlayOutboundMessage;
        if (data.type === "ended") {
          this.#handlers.onEnded?.(data);
        } else if (data.type === "error") {
          this.#handlers.onError?.(data);
        }
      } catch (err) {
        console.error("failed to parse overlay message", err);
      }
    });
  }

  #convertMessageData(data: MessageEvent["data"]) {
    if (typeof data === "string") return data;
    if (data instanceof ArrayBuffer) {
      return new TextDecoder().decode(data);
    }
    if (data instanceof Uint8Array) {
      return new TextDecoder().decode(data);
    }
    return null;
  }

  get overlayConnected() {
    for (const client of this.#clients) {
      if (client.readyState === WebSocket.OPEN) {
        return true;
      }
    }
    return false;
  }

  #broadcast(message: OverlayInboundMessage) {
    const encoded = serialize(message);
    for (const client of this.#clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(encoded);
      }
    }
  }

  play(request: RequestItem) {
    if (!request.fileName) {
      throw new Error("request has no downloadable file");
    }
    console.log(`[OverlayHub] sending play -> ${request.id} (${request.fileName})`);
    this.#broadcast({
      type: "play",
      requestId: request.id,
      url: `/media/${request.fileName}`,
      title: request.title,
      requester: request.userName,
      volume: 1,
      loop: false,
    });
  }

  stop(fadeMs = 400) {
    console.log(`[OverlayHub] sending stop (fade=${fadeMs}ms)`);
    this.#broadcast({ type: "stop", fadeMs });
  }

  pause() {
    console.log("[OverlayHub] sending pause");
    this.#broadcast({ type: "pause" });
  }

  resume() {
    console.log("[OverlayHub] sending resume");
    this.#broadcast({ type: "resume" });
  }

  seek(positionSec: number) {
    console.log(`[OverlayHub] sending seek -> ${positionSec.toFixed(2)}s`);
    this.#broadcast({ type: "seek", positionSec });
  }

  getStatus() {
    return {
      overlayConnected: this.overlayConnected,
      connections: this.#clients.size,
    };
  }
}
