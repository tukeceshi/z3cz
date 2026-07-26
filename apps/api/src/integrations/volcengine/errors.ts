export const VOLCANO_ARK_NOT_OPENED_CODE = "volcano_ark_not_opened" as const;
export const AI_INTERFACE_NAME_CONFLICT_CODE =
  "ai_interface_name_conflict" as const;

export function isAiInterfaceNameConflictError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message.toLowerCase();
  return (
    message.includes("organization_ai_interfaces_org_name") ||
    (message.includes("unique") && message.includes("name"))
  );
}

export class VolcanoArkNotOpenedError extends Error {
  readonly code = VOLCANO_ARK_NOT_OPENED_CODE;

  constructor() {
    super("Volcano Ark is not enabled.");
    this.name = "VolcanoArkNotOpenedError";
  }
}

export function isVolcanoArkNotOpenedError(
  error: unknown
): error is VolcanoArkNotOpenedError {
  return error instanceof VolcanoArkNotOpenedError;
}
