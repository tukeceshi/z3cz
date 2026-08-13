import type {
  OrgImageModelOption,
  OrgImageModelUnavailableReason,
  ImageModelParameterRules,
} from "@dafthunk/types";

import type { Database } from "../db";
import {
  getImageParameterRules,
  listPlatformAiModels,
} from "../db/platform-ai-model-queries";
import { listOrganizationAiInterfaces } from "../db/ai-interface-queries";
import { buildOrgModelBindings } from "./build-org-model-bindings";
import {
  collectOrgBindingInterfaces,
  resolveOrgModelInterfaceBinding,
  type ResolvedOrgModelInterface,
} from "./resolve-text-model-interface";

export type ResolvedImageModelInterface = ResolvedOrgModelInterface<
  ImageModelParameterRules
>;

export async function listOrgImageModelOptions(
  db: Database,
  organizationId: string
): Promise<readonly OrgImageModelOption[]> {
  const [platformModels, interfaces] = await Promise.all([
    listPlatformAiModels(db, "image"),
    listOrganizationAiInterfaces(db, organizationId),
  ]);

  return buildOrgModelBindings({
    platformModels,
    interfaces: collectOrgBindingInterfaces(interfaces),
  }).map((binding) => ({
    ...binding,
    unavailableReason:
      binding.unavailableReason as OrgImageModelUnavailableReason | undefined,
    parameterRules: getImageParameterRules(
      platformModels.find(
        (model) => model.canonicalId === binding.canonicalId
      )!
    ),
  }));
}

export async function resolveImageModelInterface(
  db: Database,
  organizationId: string,
  canonicalId: string,
  interfaceId: string,
  instanceId?: string
): Promise<ResolvedImageModelInterface | null> {
  return resolveOrgModelInterfaceBinding(
    db,
    organizationId,
    canonicalId,
    interfaceId,
    listOrgImageModelOptions,
    instanceId
  );
}
