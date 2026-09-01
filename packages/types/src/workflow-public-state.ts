import type { PublicSiteSettings } from "./site-settings";

/** Site-wide public layer merged with per-workflow WS state on the canvas. */
export interface WorkflowPublicState {
  readonly maintenanceEnabled: boolean;
  readonly maintenanceMessage: string | null;
}

export interface WorkflowPublicMessage {
  readonly type: "public";
  readonly public: WorkflowPublicState;
}

export function workflowPublicStateFromSiteSettings(
  settings: Pick<
    PublicSiteSettings,
    "maintenanceEnabled" | "maintenanceMessage"
  >
): WorkflowPublicState {
  return {
    maintenanceEnabled: settings.maintenanceEnabled,
    maintenanceMessage: settings.maintenanceMessage,
  };
}
