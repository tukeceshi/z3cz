import type {
  OrgVideoModelOption,
  OrgVideoModelUnavailableReason,
  VideoModelParameterRules,
} from "@dafthunk/types";

import type { Database } from "../db";
import {
  getVideoParameterRules,
  listPlatformAiModels,
} from "../db/platform-ai-model-queries";
import { listOrganizationAiInterfaces } from "../db/ai-interface-queries";
import { buildOrgModelBindings } from "./build-org-model-bindings";
import {
  collectSingleModelInterfaces,
  collectVolcanoInterfaces,
  resolveOrgModelInterfaceBinding,
  type ResolvedOrgModelInterface,
} from "./resolve-text-model-interface";

export type ResolvedVideoModelInterface = ResolvedOrgModelInterface<
  VideoModelParameterRules
>;

export async function listOrgVideoModelOptions(
  db: Database,
  organizationId: string
): Promise<readonly OrgVideoModelOption[]> {
  const [platformModels, interfaces] = await Promise.all([
    listPlatformAiModels(db, "video"),
    listOrganizationAiInterfaces(db, organizationId),
  ]);

  const volcanoInterfaces = collectVolcanoInterfaces(interfaces);
  const singleModelInterfaces = collectSingleModelInterfaces(interfaces);

  return buildOrgModelBindings({
    platformModels,
    volcanoInterfaces,
    singleModelInterfaces,
  }).map((binding) => ({
    ...binding,
    unavailableReason:
      binding.unavailableReason as OrgVideoModelUnavailableReason | undefined,
    parameterRules: getVideoParameterRules(
      platformModels.find(
        (model) => model.canonicalId === binding.canonicalId
      )!
    ),
  }));
}

export async function resolveVideoModelInterface(
  db: Database,
  organizationId: string,
  canonicalId: string,
  interfaceId: string
): Promise<ResolvedVideoModelInterface | null> {
  return resolveOrgModelInterfaceBinding(
    db,
    organizationId,
    canonicalId,
    interfaceId,
    listOrgVideoModelOptions
  );
}
