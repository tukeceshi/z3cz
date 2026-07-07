import type {
  ClientMessage,
  WorkflowExecuteMessage,
  WorkflowExecution,
  WorkflowExecutionUpdateMessage,
  WorkflowInitMessage,
  WorkflowState,
  WorkflowUpdateMessage,
} from "@dafthunk/types";
import type { WSContext } from "hono/ws";

import type { Bindings } from "../context";
import { ExecutionManager } from "../services/execution-manager";
import type { SaveWorkflowRecord } from "../stores/workflow-store";
import { WorkflowStore } from "../stores/workflow-store";

const PERSIST_DEBOUNCE_MS = 500;

interface NodeWsClient {
  readonly id: string;
  readonly ws: WSContext;
  executionId?: string;
}

interface NodeWorkflowSession {
  workflowState: WorkflowState;
  organizationId: string;
  userId: string;
  env: Bindings;
  clients: Map<string, NodeWsClient>;
  persistTimer: ReturnType<typeof setTimeout> | null;
  pendingPersist: WorkflowState | null;
}

class NodeWorkflowSessionHub {
  private readonly sessions = new Map<string, NodeWorkflowSession>();

  private sessionKey(workflowId: string): string {
    return workflowId;
  }

  async handleOpen(
    workflowId: string,
    userId: string,
    env: Bindings,
    ws: WSContext
  ): Promise<void> {
    const clientId = crypto.randomUUID();
    const session = await this.loadSession(workflowId, userId, env);

    const client: NodeWsClient = { id: clientId, ws };
    session.clients.set(clientId, client);

    const initMessage: WorkflowInitMessage = {
      type: "init",
      state: session.workflowState,
    };
    ws.send(JSON.stringify(initMessage));
  }

  async handleMessage(
    workflowId: string,
    userId: string,
    env: Bindings,
    ws: WSContext,
    rawMessage: string | ArrayBuffer
  ): Promise<void> {
    if (typeof rawMessage !== "string") {
      ws.close(1003, "Binary messages not supported");
      return;
    }

    const session = await this.loadSession(workflowId, userId, env);
    const client = this.findClient(session, ws);
    if (!client) {
      ws.close(1011, "Client not registered");
      return;
    }

    let parsed: ClientMessage;
    try {
      parsed = JSON.parse(rawMessage) as ClientMessage;
    } catch {
      ws.close(1003, "Invalid message format");
      return;
    }

    if (!parsed || !("type" in parsed)) {
      ws.close(1003, "Invalid message format");
      return;
    }

    switch (parsed.type) {
      case "update":
        await this.handleUpdate(session, client, parsed);
        break;
      case "execute":
        await this.handleExecute(session, client, parsed);
        break;
      default:
        ws.close(1003, "Unknown message type");
    }
  }

  handleClose(workflowId: string, ws: WSContext): void {
    const session = this.sessions.get(this.sessionKey(workflowId));
    if (!session) {
      return;
    }

    for (const [clientId, client] of session.clients) {
      if (client.ws === ws) {
        session.clients.delete(clientId);
        break;
      }
    }

    if (session.clients.size === 0) {
      void this.flushPersist(session);
      this.sessions.delete(this.sessionKey(workflowId));
    }
  }

  /** Push execution progress to all editor clients watching this workflow. */
  broadcastExecution(workflowId: string, execution: WorkflowExecution): void {
    const session = this.sessions.get(this.sessionKey(workflowId));
    if (!session || session.clients.size === 0) {
      return;
    }

    const message: WorkflowExecutionUpdateMessage = {
      type: "execution_update",
      executionId: execution.id,
      status: execution.status,
      nodeExecutions: execution.nodeExecutions,
      error: execution.error,
    };
    const payload = JSON.stringify(message);

    for (const client of session.clients.values()) {
      if (execution.id) {
        client.executionId = execution.id;
      }
      try {
        client.ws.send(payload);
      } catch (error) {
        console.error("[NodeWorkflowSession] broadcast failed:", error);
      }
    }
  }

  private findClient(
    session: NodeWorkflowSession,
    ws: WSContext
  ): NodeWsClient | undefined {
    for (const client of session.clients.values()) {
      if (client.ws === ws) {
        return client;
      }
    }
    return undefined;
  }

  private async loadSession(
    workflowId: string,
    userId: string,
    env: Bindings
  ): Promise<NodeWorkflowSession> {
    const key = this.sessionKey(workflowId);
    const existing = this.sessions.get(key);
    if (existing) {
      return existing;
    }

    const workflowStore = new WorkflowStore(env);
    const access = await workflowStore.getWithUserAccess(workflowId, userId);
    if (!access) {
      throw new Error(
        `User ${userId} does not have access to workflow ${workflowId}`
      );
    }

    const { workflow, organizationId } = access;
    const workflowWithData = await workflowStore.getWithData(
      workflowId,
      organizationId
    );
    const workflowData = workflowWithData?.data ?? {
      id: workflowId,
      name: workflow.name,
      description: workflow.description ?? undefined,
      trigger: workflow.trigger,
      runtime: workflow.runtime,
      nodes: [],
      edges: [],
    };

    const session: NodeWorkflowSession = {
      env,
      userId,
      organizationId,
      clients: new Map(),
      persistTimer: null,
      pendingPersist: null,
      workflowState: {
        id: workflowId,
        name: workflowData.name,
        description: workflowData.description,
        trigger: workflowData.trigger as WorkflowState["trigger"],
        runtime: workflowData.runtime,
        nodes: workflowData.nodes,
        edges: workflowData.edges,
        timestamp: workflow.updatedAt?.getTime() ?? Date.now(),
      },
    };

    this.sessions.set(key, session);
    return session;
  }

  private async handleUpdate(
    session: NodeWorkflowSession,
    source: NodeWsClient,
    message: WorkflowUpdateMessage
  ): Promise<void> {
    if (message.state.id !== session.workflowState.id) {
      return;
    }
    if (!message.state.name || !message.state.trigger) {
      return;
    }
    if (
      !Array.isArray(message.state.nodes) ||
      !Array.isArray(message.state.edges)
    ) {
      return;
    }

    const nodeIds = new Set(message.state.nodes.map((node) => node.id));
    const filteredEdges = message.state.edges.filter(
      (edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target)
    );

    session.workflowState = { ...message.state, edges: filteredEdges };
    this.schedulePersist(session);

    const updateMsg: WorkflowUpdateMessage = {
      type: "update",
      state: session.workflowState,
    };
    const payload = JSON.stringify(updateMsg);
    for (const client of session.clients.values()) {
      if (client.id !== source.id) {
        client.ws.send(payload);
      }
    }
  }

  private async handleExecute(
    session: NodeWorkflowSession,
    client: NodeWsClient,
    message: WorkflowExecuteMessage
  ): Promise<void> {
    if (message.executionId) {
      client.executionId = message.executionId;
      return;
    }

    const executionManager = new ExecutionManager({ env: session.env });
    try {
      const { executionId, execution } = await executionManager.executeWorkflow(
        session.workflowState,
        session.organizationId,
        session.userId,
        message.parameters
      );
      client.executionId = executionId;
      this.sendExecutionUpdate(client, execution);
    } catch (error) {
      this.sendExecutionUpdate(client, {
        id: "",
        workflowId: session.workflowState.id,
        status: "error",
        nodeExecutions: [],
        error:
          error instanceof Error ? error.message : "Failed to execute workflow",
      });
    }
  }

  private sendExecutionUpdate(
    client: NodeWsClient,
    execution: WorkflowExecution
  ): void {
    const message: WorkflowExecutionUpdateMessage = {
      type: "execution_update",
      executionId: execution.id,
      status: execution.status,
      nodeExecutions: execution.nodeExecutions,
      error: execution.error,
    };
    client.ws.send(JSON.stringify(message));
  }

  private schedulePersist(session: NodeWorkflowSession): void {
    session.pendingPersist = session.workflowState;
    if (session.persistTimer) {
      clearTimeout(session.persistTimer);
    }
    session.persistTimer = setTimeout(() => {
      void this.flushPersist(session);
    }, PERSIST_DEBOUNCE_MS);
  }

  private async flushPersist(session: NodeWorkflowSession): Promise<void> {
    if (session.persistTimer) {
      clearTimeout(session.persistTimer);
      session.persistTimer = null;
    }

    const state = session.pendingPersist ?? session.workflowState;
    session.pendingPersist = null;
    if (!state) {
      return;
    }

    try {
      const workflowStore = new WorkflowStore(session.env);
      const workflowData = {
        id: state.id,
        name: state.name,
        description: state.description,
        trigger: state.trigger,
        runtime: state.runtime,
        organizationId: session.organizationId,
        nodes: state.nodes,
        edges: state.edges,
      };

      await Promise.all([
        workflowStore.update(state.id, session.organizationId, {
          name: state.name,
          description: state.description ?? null,
          trigger: state.trigger,
          runtime: state.runtime,
        }),
        workflowStore.save(workflowData as SaveWorkflowRecord),
      ]);
    } catch (error) {
      console.error("[NodeWorkflowSession] persist failed:", error);
    }
  }
}

export const nodeWorkflowSessionHub = new NodeWorkflowSessionHub();
