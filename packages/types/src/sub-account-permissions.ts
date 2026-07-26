export type WorkflowPermission = "view" | "edit";

export interface SubAccountPermissions {
  readonly aiInterfaces: boolean;
  readonly subAccountsView: boolean;
  readonly subAccountsDelete: boolean;
  readonly workflows: WorkflowPermission;
  readonly executions: boolean;
  readonly modelCalls: boolean;
  readonly apiKeys: boolean;
}

export const DEFAULT_SUB_ACCOUNT_PERMISSIONS: SubAccountPermissions = {
  aiInterfaces: false,
  subAccountsView: false,
  subAccountsDelete: false,
  workflows: "view",
  executions: true,
  modelCalls: true,
  apiKeys: false,
};

export type UpdateSubAccountPermissionsRequest = Partial<SubAccountPermissions>;
