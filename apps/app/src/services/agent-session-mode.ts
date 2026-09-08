import {
  CANVAS_MAKE_CAPABILITY,
  capabilityForTool as capabilityForToolFromCatalog,
  isMakeTool as isMakeToolFromCatalog,
  SIMPLE_ANIMATION_CAPABILITY as CATALOG_SIMPLE_ANIMATION,
} from "@/services/agent-capabilities";

export type AgentSessionMode = "ask" | "draft" | "real";

export const SESSION_PHASE_LABEL: Record<AgentSessionMode, string> = {
  ask: "问答",
  draft: "草案",
  real: "执行",
};

export const SIMPLE_ANIMATION_CAPABILITY = CATALOG_SIMPLE_ANIMATION;

export function isMakeTool(name: string): boolean {
  return isMakeToolFromCatalog(name);
}

export function capabilityForTool(name: string): string | null {
  return capabilityForToolFromCatalog(name);
}

export function hasCapability(
  consented: readonly string[] | undefined,
  capabilityId: string
): boolean {
  return Boolean(consented?.includes(capabilityId));
}

export function withoutWriteConsent(
  consented: readonly string[] | undefined
): readonly string[] {
  return (consented ?? []).filter(
    (id) => id !== CATALOG_SIMPLE_ANIMATION && id !== CANVAS_MAKE_CAPABILITY
  );
}

export function isDraftPhase(mode: AgentSessionMode): boolean {
  return mode === "draft";
}

export function isPlanRestriction(mode: AgentSessionMode): boolean {
  return isDraftPhase(mode);
}

export function isPlanConfirmPending(params: {
  readonly sessionMode: AgentSessionMode;
  readonly planPending: boolean;
  readonly streaming: boolean;
}): boolean {
  return (
    params.sessionMode === "draft" && params.planPending && !params.streaming
  );
}

export function isSessionMode(value: string): value is AgentSessionMode {
  return value === "ask" || value === "draft" || value === "real";
}

export function modeOnOpenConversation(params: {
  readonly sessionMode?: string;
  readonly activeInvocationId?: string;
}): AgentSessionMode {
  if (params.sessionMode === "view") {
    return "ask";
  }
  if (params.sessionMode && isSessionMode(params.sessionMode)) {
    return params.sessionMode;
  }
  return "ask";
}

export interface AgentRunSessionState {
  readonly sessionMode: AgentSessionMode;
  readonly planPending: boolean;
  readonly planDocument: string | undefined;
}

export function clearedPlanFields(
  sessionMode: AgentSessionMode = "ask"
): AgentRunSessionState {
  return {
    sessionMode,
    planPending: false,
    planDocument: undefined,
  };
}

export function stateAfterRun(params: {
  readonly runMode: AgentSessionMode;
  readonly talk: string;
  readonly preservePlan?: boolean;
  readonly previousPlanDocument?: string;
}): AgentRunSessionState {
  if (params.runMode === "real") {
    if (params.preservePlan) {
      const planDocument = params.previousPlanDocument?.trim();
      return {
        sessionMode: "draft",
        planPending: Boolean(planDocument),
        planDocument: planDocument || undefined,
      };
    }
    return {
      sessionMode: "real",
      planPending: false,
      planDocument: undefined,
    };
  }
  if (params.runMode === "ask") {
    return {
      sessionMode: "ask",
      planPending: false,
      planDocument: params.previousPlanDocument,
    };
  }
  const talk = params.talk.trim();
  return {
    sessionMode: "draft",
    planPending: Boolean(talk),
    planDocument: talk || params.previousPlanDocument,
  };
}
