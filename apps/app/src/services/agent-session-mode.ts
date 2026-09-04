import {
  capabilityForTool as capabilityForToolFromCatalog,
  isMakeTool as isMakeToolFromCatalog,
  SIMPLE_ANIMATION_CAPABILITY as CATALOG_SIMPLE_ANIMATION,
} from "@/services/agent-capabilities";

export type AgentSessionMode = "ask" | "plan" | "agent";

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

export function isPlanRestriction(mode: AgentSessionMode): boolean {
  return mode === "plan";
}

export function isPlanConfirmPending(params: {
  readonly sessionMode: AgentSessionMode;
  readonly planPending: boolean;
  readonly streaming: boolean;
}): boolean {
  return (
    params.sessionMode === "plan" && params.planPending && !params.streaming
  );
}

export function isExecuteConfirmPending(params: {
  readonly sessionMode: AgentSessionMode;
  readonly executePending: boolean;
  readonly streaming: boolean;
}): boolean {
  return (
    params.sessionMode === "agent" &&
    params.executePending &&
    !params.streaming
  );
}

export function modeOnOpenConversation(params: {
  readonly sessionMode?: AgentSessionMode;
  readonly activeInvocationId?: string;
}): AgentSessionMode {
  if (params.sessionMode === "agent" && params.activeInvocationId) {
    return "agent";
  }
  if (
    params.sessionMode === "ask" ||
    params.sessionMode === "plan" ||
    params.sessionMode === "agent"
  ) {
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
  if (params.runMode === "agent") {
    if (params.preservePlan) {
      const planDocument = params.previousPlanDocument?.trim();
      return {
        sessionMode: "plan",
        planPending: Boolean(planDocument),
        planDocument: planDocument || undefined,
      };
    }
    return {
      sessionMode: "agent",
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
    sessionMode: "plan",
    planPending: Boolean(talk),
    planDocument: talk || params.previousPlanDocument,
  };
}

export interface AgentModeSwitch {
  readonly from: AgentSessionMode;
  readonly to: AgentSessionMode;
}

const ALLOWED_MODE_SWITCHES: ReadonlySet<string> = new Set([
  "ask:agent",
  "ask:plan",
  "agent:plan",
  "agent:ask",
  "plan:agent",
]);

export function isAllowedModeSwitch(
  from: AgentSessionMode,
  to: AgentSessionMode
): boolean {
  return ALLOWED_MODE_SWITCHES.has(`${from}:${to}`);
}

export function formatSwitchModeArgs(params: {
  readonly from: AgentSessionMode;
  readonly to: AgentSessionMode;
}): string {
  return `from: ${params.from}\nto: ${params.to}`;
}

function asSessionMode(value: string): AgentSessionMode | undefined {
  if (value === "ask" || value === "plan" || value === "agent") {
    return value;
  }
  return undefined;
}

export function parseSwitchModeTarget(
  raw: string
): AgentModeSwitch | undefined {
  let from: AgentSessionMode | undefined;
  let to: AgentSessionMode | undefined;
  for (const line of raw.trim().split(/\r?\n/)) {
    const match = /^(from|to)\s*:\s*(\S+)/i.exec(line.trim());
    if (!match) {
      continue;
    }
    const value = asSessionMode(match[2]?.toLowerCase() ?? "");
    if (!value) {
      return undefined;
    }
    if (match[1]?.toLowerCase() === "from") {
      from = value;
    } else {
      to = value;
    }
  }
  if (!from || !to) {
    return undefined;
  }
  return { from, to };
}
