import type {
  ClientMessage,
  WorkflowErrorMessage,
  WorkflowExecuteMessage,
  WorkflowExecution,
  WorkflowExecutionUpdateMessage,
  WorkflowGraphPatchBroadcast,
  WorkflowGraphPatchMessage,
  WorkflowInitMessage,
  WorkflowState,
  WorkflowUpdateMessage,
} from "@dafthunk/types";
import {
  applyWorkflowGraphPatch,
  isEmptyWorkflowGraphPatch,
} from "@dafthunk/types";
import type { WSContext } from "hono/ws";

import type { Bindings } from "../context";
import type { OrgMembershipContext } from "../middleware/org-permissions";
import { ExecutionManager } from "../services/execution-manager";
import {
  canAccessExecutions,
  canEditWorkflows,
} from "../utils/sub-account-permissions";
import type { SaveWorkflowRecord } from "../stores/workflow-store";
import { WorkflowStore } from "../stores/workflow-store";

interface NodeWsClient {
  readonly id: string;
  readonly ws: WSContext;
  readonly membership: OrgMembershipContext;
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
  rev: number;
}

const PERSIST_DEBOUNCE_MS = 500;

class NodeWorkflowSessionHub {
  private readonly sessions = new Map<string, NodeWorkflowSession>();

  private sessionKey(workflowId: string): string {
    return workflowId;
  }

  /** Drop in-memory session so the next connect reloads from persisted storage. */
  invalidateSession(workflowId: string): void {
    const key = this.sessionKey(workflowId);
    const session = this.sessions.get(key);
    if (!session) {
      return;
    }
    if (session.persistTimer) {
      clearTimeout(session.persistTimer);
    }
    this.sessions.delete(key);
  }

  async handleOpen(
    workflowId: string,
    userId: string,
    env: Bindings,
    ws: WSContext,
    membership: OrgMembershipContext
  ): Promise<void> {
    const clientId = crypto.randomUUID();
    const session = await this.loadSession(workflowId, userId, env);
    await this.reloadSessionFromStore(session);

    const client: NodeWsClient = { id: clientId, ws, membership };
    session.clients.set(clientId, client);

    const initMessage: WorkflowInitMessage = {
      type: "init",
      state: { ...session.workflowState, timestamp: session.workflowState.timestamp },
    };
    ws.send(JSON.stringify(initMessage));
  }

  async handleMessage(
    workflowId: string,
    userId: string,
    env: Bindings,
    ws: WSContext,
    rawMessage: string | ArrayBuffer,
    _membership: OrgMembershipContext
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
      case "patch_graph":
        await this.handlePatchGraph(session, client, parsed);
        break;
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
      schemeId: workflow.schemeId,
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
      rev: 0,
      workflowState: {
        id: workflowId,
        name: workflowData.name,
        description: workflowData.description,
        schemeId: workflowData.schemeId,
        trigger: workflowData.trigger as WorkflowState["trigger"],
        runtime: workflowData.runtime,
        nodes: workflowData.nodes,
        edges: workflowData.edges,
        ...(workflowData.editorViewport
          ? { editorViewport: workflowData.editorViewport }
          : {}),
        timestamp: workflow.updatedAt?.getTime() ?? Date.now(),
      },
    };

    this.sessions.set(key, session);
    return session;
  }

  private async reloadSessionFromStore(
    session: NodeWorkflowSession
  ): Promise<void> {
    const workflowStore = new WorkflowStore(session.env);
    const workflowWithData = await workflowStore.getWithData(
      session.workflowState.id,
      session.organizationId
    );
    if (!workflowWithData) {
      return;
    }

    const workflowData = workflowWithData.data;
    session.workflowState = {
      id: session.workflowState.id,
      name: workflowData.name,
      description: workflowData.description,
      schemeId: workflowData.schemeId,
      trigger: workflowData.trigger as WorkflowState["trigger"],
      runtime: workflowData.runtime,
      nodes: workflowData.nodes,
      edges: workflowData.edges,
      ...(workflowData.editorViewport
        ? { editorViewport: workflowData.editorViewport }
        : {}),
      ...(workflowData.generativeDefaults
        ? { generativeDefaults: workflowData.generativeDefaults }
        : {}),
      timestamp: workflowWithData.updatedAt?.getTime() ?? Date.now(),
    };
  }

  private async handlePatchGraph(
    session: NodeWorkflowSession,
    source: NodeWsClient,
    message: WorkflowGraphPatchMessage
  ): Promise<void> {
    if (
      !canEditWorkflows(source.membership.role, source.membership.permissions)
    ) {
      source.ws.close(1008, "Permission denied");
      return;
    }

    if (isEmptyWorkflowGraphPatch(message)) {
      return;
    }

    session.workflowState = {
      ...applyWorkflowGraphPatch(session.workflowState, message),
      timestamp: Date.now(),
    };
    session.rev += 1;

    this.schedulePersist(session);

    const patchMsg: WorkflowGraphPatchBroadcast = {
      type: "patch_graph",
      rev: session.rev,
      nodePatches: message.nodePatches,
      edgePatches: message.edgePatches,
      timestamp: session.workflowState.timestamp,
    };
    const payload = JSON.stringify(patchMsg);
    for (const client of session.clients.values()) {
      if (client.id !== source.id) {
        client.ws.send(payload);
      }
    }
  }

  private async handleUpdate(
    session: NodeWorkflowSession,
    source: NodeWsClient,
    message: WorkflowUpdateMessage
  ): Promise<void> {
    if (
      !canEditWorkflows(source.membership.role, source.membership.permissions)
    ) {
      source.ws.close(1008, "Permission denied");
      return;
    }

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

    session.workflowState = {
      ...message.state,
      edges: filteredEdges,
      editorViewport:
        message.state.editorViewport ?? session.workflowState.editorViewport,
      timestamp: message.state.timestamp ?? Date.now(),
    };

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
    if (
      !canAccessExecutions(client.membership.role, client.membership.permissions)
    ) {
      client.ws.close(1008, "Permission denied");
      return;
    }

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
      session.persistTimer = null;
      void this.writeSessionToStore(session);
    }, PERSIST_DEBOUNCE_MS);
  }

  private async persistNow(session: NodeWorkflowSession): Promise<void> {
    if (session.persistTimer) {
      clearTimeout(session.persistTimer);
      session.persistTimer = null;
    }
    session.pendingPersist = null;
    await this.writeSessionToStore(session);
  }

  private async flushPersist(session: NodeWorkflowSession): Promise<void> {
    if (session.persistTimer) {
      clearTimeout(session.persistTimer);
      session.persistTimer = null;
    }

    session.pendingPersist = null;
    await this.writeSessionToStore(session);
  }

  private async writeSessionToStore(
    session: NodeWorkflowSession
  ): Promise<void> {
    const state = session.workflowState;
    if (!state) {
      return;
    }

    try {
      const workflowStore = new WorkflowStore(session.env);
      const workflowData = {
        id: state.id,
        name: state.name,
        description: state.description,
        schemeId: state.schemeId,
        trigger: state.trigger,
        runtime: state.runtime,
        organizationId: session.organizationId,
        nodes: state.nodes,
        edges: state.edges,
        ...(state.editorViewport
          ? { editorViewport: state.editorViewport }
          : {}),
        ...(state.generativeDefaults
          ? { generativeDefaults: state.generativeDefaults }
          : {}),
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
