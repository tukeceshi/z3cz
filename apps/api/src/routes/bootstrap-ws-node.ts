import type { createNodeWebSocket } from "@hono/node-ws";
import type { WSContext } from "hono/ws";

import {
  isBootstrapAssetPath,
  readBootstrapAsset,
} from "../services/bootstrap-asset-store";

type UpgradeWebSocket = ReturnType<
  typeof createNodeWebSocket
>["upgradeWebSocket"];

interface FetchRequest {
  readonly op: "fetch";
  readonly id: number;
  readonly path: string;
}

interface ClientMessage {
  readonly op: string;
  readonly id?: number;
  readonly path?: string;
}

const CHUNK_SIZE = 64 * 1024;

function parseClientMessage(raw: string | ArrayBuffer): ClientMessage | null {
  if (typeof raw !== "string") {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    return parsed as ClientMessage;
  } catch {
    return null;
  }
}

function isFetchRequest(message: ClientMessage): message is FetchRequest {
  return (
    message.op === "fetch" &&
    typeof message.id === "number" &&
    Number.isFinite(message.id) &&
    typeof message.path === "string"
  );
}

function sendJson(ws: WSContext, payload: Record<string, unknown>): void {
  ws.send(JSON.stringify(payload));
}

async function streamAsset(
  ws: WSContext,
  id: number,
  assetPath: string
): Promise<void> {
  if (!isBootstrapAssetPath(assetPath)) {
    sendJson(ws, { op: "error", id, message: "Asset not allowed" });
    return;
  }

  const buffer = readBootstrapAsset(assetPath);
  if (!buffer) {
    sendJson(ws, { op: "error", id, message: "Asset not found" });
    return;
  }

  sendJson(ws, { op: "begin", id, size: buffer.byteLength, gzip: false });

  for (let offset = 0; offset < buffer.byteLength; offset += CHUNK_SIZE) {
    const slice = buffer.subarray(offset, offset + CHUNK_SIZE);
    const frame = Buffer.alloc(4 + slice.byteLength);
    frame.writeUInt32BE(id >>> 0, 0);
    slice.copy(frame, 4);
    ws.send(frame);
  }

  sendJson(ws, { op: "done", id });
}

export function registerNodeBootstrapWsRoutes(
  app: {
    get: (
      path: string,
      ...handlers: unknown[]
    ) => unknown;
  },
  upgradeWebSocket: UpgradeWebSocket
): void {
  app.get(
    "/bootstrap/ws",
    upgradeWebSocket(() => ({
      onMessage(event, ws) {
        const message = parseClientMessage(event.data);
        if (!message) {
          sendJson(ws, { op: "error", message: "Invalid message" });
          return;
        }

        if (!isFetchRequest(message)) {
          sendJson(ws, { op: "error", message: "Unsupported operation" });
          return;
        }

        void streamAsset(ws, message.id, message.path).catch((error) => {
          console.error("[BootstrapWS] stream failed:", error);
          sendJson(ws, {
            op: "error",
            id: message.id,
            message: "Stream failed",
          });
        });
      },
    }))
  );
}
