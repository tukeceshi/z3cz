export type AgentSessionMode = "plan" | "agent";

export const SIMPLE_ANIMATION_CAPABILITY = "simple-animation" as const;

const MAKE_TOOLS = new Set<string>([
  "remotion_write",
  "canvas_write_text",
  "canvas_run_node",
  "canvas_stage_media",
]);

export function isMakeTool(name: string): boolean {
  return MAKE_TOOLS.has(name);
}

export function capabilityForTool(name: string): string | null {
  if (
    name === "remotion_open" ||
    name === "remotion_close" ||
    name === "remotion_get" ||
    name === "remotion_write"
  ) {
    return SIMPLE_ANIMATION_CAPABILITY;
  }
  return null;
}

export function hasCapability(
  consented: readonly string[] | undefined,
  capabilityId: string
): boolean {
  return Boolean(consented?.includes(capabilityId));
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

export function modeOnOpenConversation(params: {
  readonly sessionMode?: AgentSessionMode;
  readonly activeInvocationId?: string;
}): AgentSessionMode {
  if (params.sessionMode === "agent" && params.activeInvocationId) {
    return "agent";
  }
  return "plan";
}

export interface AgentRunSessionState {
  readonly sessionMode: AgentSessionMode;
  readonly planPending: boolean;
  readonly planDocument: string | undefined;
}

export function stateAfterRun(params: {
  readonly runMode: AgentSessionMode;
  readonly talk: string;
}): AgentRunSessionState {
  if (params.runMode === "agent") {
    return {
      sessionMode: "plan",
      planPending: false,
      planDocument: undefined,
    };
  }
  const talk = params.talk.trim();
  return {
    sessionMode: "plan",
    planPending: Boolean(talk),
    planDocument: talk || undefined,
  };
}
