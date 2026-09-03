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
    name === "remotion_get" ||
    name === "remotion_write"
  ) {
    return SIMPLE_ANIMATION_CAPABILITY;
  }
  return null;
}

export function capabilitiesGrantedOnExecute(): readonly string[] {
  return [SIMPLE_ANIMATION_CAPABILITY];
}

export function isPlanConfirmPending(params: {
  readonly sessionMode: AgentSessionMode;
  readonly planPending: boolean;
  readonly streaming: boolean;
}): boolean {
  return (
    params.sessionMode === "plan" &&
    params.planPending &&
    !params.streaming
  );
}
