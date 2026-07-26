import type {
  ClientMessage,
  Edge,
  Node,
  ServerMessage,
  WorkflowExecution,
  WorkflowEditorViewport,
  WorkflowRuntime,
  WorkflowState,
  WorkflowTrigger,
} from "@dafthunk/types";

import { buildApiUrl, getApiBaseUrl } from "@/config/api";

// Re-export for convenience
export type { WorkflowState };

function isWsViaProxy(): boolean {
  if (typeof import.meta.env === "undefined") {
    return false;
  }
  const flag = import.meta.env.VITE_WS_VIA_PROXY;
  return flag === "1" || flag === "true";
}

function getWebSocketBaseUrl(): string {
  const viaProxy = isWsViaProxy();

  if (!viaProxy) {
    const wsHost =
      typeof import.meta.env !== "undefined"
        ? import.meta.env.VITE_WS_HOST
        : undefined;
    if (typeof wsHost === "string" && wsHost.length > 0) {
      return wsHost.replace(/\/$/, "");
    }
  }

  const apiBaseUrl = getApiBaseUrl();
  if (apiBaseUrl.startsWith("http://") || apiBaseUrl.startsWith("https://")) {
    return apiBaseUrl.replace(/^http/, "ws");
  }

  // Classic Vite /api proxy cannot complete @hono/node-ws (HTTP 200).
  // Dev gateway / host Caddy (VITE_WS_VIA_PROXY) upgrades WS on the same origin.
  if (
    !viaProxy &&
    apiBaseUrl.startsWith("/") &&
    typeof import.meta.env !== "undefined" &&
    import.meta.env.DEV
  ) {
    return "ws://localhost:3102";
  }

  const origin =
    typeof window !== "undefined"
      ? window.location.origin.replace(/^http/, "ws")
      : "ws://localhost:3101";
  return `${origin}${apiBaseUrl}`;
}

export interface WorkflowWSOptions {
  // Message-level callbacks (happy path only)
  onInit?: (state: WorkflowState) => void;
  onUpdate?: (state: WorkflowState) => void;
  onExecutionUpdate?: (execution: WorkflowExecution) => void;
  onWorkflowError?: (error: { code: string; message: string }) => void;

  // Connection-level callbacks (problems)
  onConnectionOpen?: () => void;
  onConnectionClose?: (
    event: CloseEvent,
    context: { willReconnect: boolean }
  ) => void;
  onConnectionError?: (event: Event) => void;
}

async function fetchWsAccessToken(): Promise<string | undefined> {
  try {
    const response = await fetch(buildApiUrl("/auth/ws-token"), {
      credentials: "include",
    });
    if (!response.ok) {
      return undefined;
    }
    const body = (await response.json()) as { token?: string };
    return body.token;
  } catch (error) {
    console.warn("[WorkflowWS] Failed to fetch ws-token:", error);
    return undefined;
  }
}

export class WorkflowWebSocket {
  // WebSocket close codes
  private static readonly NORMAL_CLOSURE = 1000;
  private static readonly GOING_AWAY = 1001;
  private static readonly MAX_RECONNECT_DELAY = 30000; // 30 seconds

  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second
  private shouldReconnect = true;
  private accessToken: string | undefined;
  private currentState: WorkflowState | null = null;
  private activeExecutionId: string | null = null;

  constructor(
    private orgId: string,
    private workflowId: string,
    private options: WorkflowWSOptions = {}
  ) {}

  connect(accessToken?: string): void {
    if (this.isConnectedOrConnecting()) {
      return;
    }

    if (accessToken) {
      this.accessToken = accessToken;
    }

    const wsBaseUrl = getWebSocketBaseUrl();
    const basePath = `${wsBaseUrl}/${this.orgId}/ws/${this.workflowId}`;
    const url = this.accessToken
      ? `${basePath}?access_token=${encodeURIComponent(this.accessToken)}`
      : basePath;

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
        this.options.onConnectionOpen?.();
      };

      this.ws.onmessage = (event) => this.handleMessage(event);

      this.ws.onerror = (event) => {
        console.error("[WorkflowWS] Connection error:", event);
        this.options.onConnectionError?.(event);
      };

      this.ws.onclose = (event) => {
        const willReconnect = this.shouldAttemptReconnect(event);
        this.options.onConnectionClose?.(event, { willReconnect });

        if (willReconnect) {
          this.reconnectAttempts++;

          setTimeout(() => this.connect(), this.reconnectDelay);

          // Exponential backoff
          this.reconnectDelay = Math.min(
            this.reconnectDelay * 2,
            WorkflowWebSocket.MAX_RECONNECT_DELAY
          );
        }
      };
    } catch (error) {
      console.error("[WorkflowWS] Failed to create WebSocket:", error);
      // Connection creation failure is a connection-level error
      this.options.onConnectionError?.(
        new Event("error", { cancelable: false })
      );
    }
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const message = JSON.parse(event.data) as ServerMessage;

      // Route typed messages (happy path only)
      if (!("type" in message)) {
        // Protocol violation: message must have a type
        console.error("[WorkflowWS] Protocol violation: message missing type");
        this.ws?.close(1002, "Message missing type");
        return;
      }

      switch (message.type) {
        case "init":
          this.currentState = message.state;
          this.options.onInit?.(message.state);
          // Re-subscribe to active execution after reconnection
          if (this.activeExecutionId) {
            this.registerForExecutionUpdates(this.activeExecutionId);
          }
          break;

        case "update":
          this.currentState = message.state;
          this.options.onUpdate?.(message.state);
          break;

        case "execution_update":
          // Track active execution for reconnection re-subscription
          if (message.executionId) {
            this.activeExecutionId = message.executionId;
          }
          // Clear tracking on terminal statuses
          if (
            message.status === "completed" ||
            message.status === "error" ||
            message.status === "exhausted" ||
            message.status === "cancelled"
          ) {
            this.activeExecutionId = null;
          }
          // Execution updates are normal results, not errors
          // Even if execution.error is set, this is just a summary
          this.options.onExecutionUpdate?.({
            id: message.executionId,
            workflowId: this.workflowId,
            status: message.status,
            nodeExecutions: message.nodeExecutions,
            error: message.error,
          });
          break;

        case "error":
          this.options.onWorkflowError?.({
            code: message.code,
            message: message.message,
          });
          break;

        default:
          // Unknown message type - protocol violation
          console.error(
            "[WorkflowWS] Protocol violation: unknown message type"
          );
          this.ws?.close(1002, "Unknown message type");
          break;
      }
    } catch (error) {
      // Parse failure - protocol violation, close connection
      console.error(
        "[WorkflowWS] Protocol violation: failed to parse message:",
        error
      );
      this.ws?.close(1002, "Failed to parse message");
    }
  }

  /**
   * Determine if we should attempt to reconnect after close
   */
  private shouldAttemptReconnect(event: CloseEvent): boolean {
    return (
      this.shouldReconnect &&
      this.reconnectAttempts < this.maxReconnectAttempts &&
      !event.wasClean &&
      event.code !== WorkflowWebSocket.NORMAL_CLOSURE &&
      event.code !== WorkflowWebSocket.GOING_AWAY
    );
  }

  /**
   * Send workflow state update (nodes and edges)
   */
  sendStateUpdate(nodes: Node[], edges: Edge[]): void {
    if (!this.currentState) {
      console.warn(
        "[WorkflowWS] No current state available, cannot send update"
      );
      return;
    }

    const updatedState: WorkflowState = {
      ...this.currentState,
      nodes,
      edges,
      timestamp: Date.now(),
    };

    const success = this.sendMessage(
      { type: "update", state: updatedState },
      "send state update"
    );

    if (success) {
      this.currentState = updatedState;
    }
  }

  /**
   * Persist editor canvas pan/zoom (debounced on the client).
   */
  sendViewportUpdate(viewport: WorkflowEditorViewport): void {
    if (!this.currentState) {
      return;
    }

    const updatedState: WorkflowState = {
      ...this.currentState,
      editorViewport: viewport,
      timestamp: Date.now(),
    };

    const success = this.sendMessage(
      { type: "update", state: updatedState },
      "send viewport update"
    );

    if (success) {
      this.currentState = updatedState;
    }
  }

  /**
   * Update workflow metadata (name, description, trigger, runtime)
   * This updates the local state and sends it to the server
   */
  updateMetadata(metadata: {
    name?: string;
    description?: string;
    trigger?: WorkflowTrigger;
    runtime?: WorkflowRuntime;
  }): void {
    if (!this.currentState) {
      console.warn(
        "[WorkflowWS] No current state available, cannot update metadata"
      );
      return;
    }

    const updatedState: WorkflowState = {
      ...this.currentState,
      ...(metadata.name !== undefined && { name: metadata.name }),
      ...(metadata.description !== undefined && {
        description: metadata.description,
      }),
      ...(metadata.trigger !== undefined && { trigger: metadata.trigger }),
      ...(metadata.runtime !== undefined && { runtime: metadata.runtime }),
      timestamp: Date.now(),
    };

    const success = this.sendMessage(
      { type: "update", state: updatedState },
      "send metadata update"
    );

    if (success) {
      this.currentState = updatedState;
    }
  }

  /**
   * Send a JSON message via WebSocket
   */
  private sendMessage(message: ClientMessage, errorContext: string): boolean {
    if (!this.isConnected()) {
      console.warn("[WorkflowWS] Not connected, cannot send message");
      return false;
    }

    try {
      this.ws?.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error(`[WorkflowWS] Failed to ${errorContext}:`, error);
      return false;
    }
  }

  /**
   * Execute workflow and receive realtime updates via WebSocket
   */
  executeWorkflow(options?: { parameters?: Record<string, unknown> }): void {
    // Clear previous execution tracking — server will assign a new ID
    this.activeExecutionId = null;
    this.sendMessage(
      {
        type: "execute",
        parameters: options?.parameters,
      },
      "execute workflow"
    );
  }

  /**
   * Register to receive updates for an existing execution
   */
  registerForExecutionUpdates(executionId: string): void {
    this.activeExecutionId = executionId;
    this.sendMessage(
      {
        type: "execute",
        executionId,
      },
      "register for execution updates"
    );
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private isConnectedOrConnecting(): boolean {
    return (
      this.ws?.readyState === WebSocket.OPEN ||
      this.ws?.readyState === WebSocket.CONNECTING
    );
  }

  getWorkflowId(): string {
    return this.workflowId;
  }
}

export const connectWorkflowWS = async (
  orgId: string,
  workflowId: string,
  options: WorkflowWSOptions = {}
): Promise<WorkflowWebSocket> => {
  const accessToken = await fetchWsAccessToken();
  const ws = new WorkflowWebSocket(orgId, workflowId, options);
  ws.connect(accessToken);
  return ws;
};
