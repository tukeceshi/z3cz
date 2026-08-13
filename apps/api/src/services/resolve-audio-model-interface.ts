import type {
  OrgAudioModelOption,
  OrgAudioModelUnavailableReason,
  AudioModelParameterRules,
} from "@dafthunk/types";

import type { Database } from "../db";
import {
  getAudioParameterRules,
  listPlatformAiModels,
} from "../db/platform-ai-model-queries";
import { listOrganizationAiInterfaces } from "../db/ai-interface-queries";
import { buildOrgModelBindings } from "./build-org-model-bindings";
import {
  collectOrgBindingInterfaces,
  resolveOrgModelInterfaceBinding,
  type ResolvedOrgModelInterface,
} from "./resolve-text-model-interface";

export type ResolvedAudioModelInterface = ResolvedOrgModelInterface<
  AudioModelParameterRules
>;

export async function listOrgAudioModelOptions(
  db: Database,
  organizationId: string
): Promise<readonly OrgAudioModelOption[]> {
  const [platformModels, interfaces] = await Promise.all([
    listPlatformAiModels(db, "audio"),
    listOrganizationAiInterfaces(db, organizationId),
  ]);

  return buildOrgModelBindings({
    platformModels,
    interfaces: collectOrgBindingInterfaces(interfaces),
  }).map((binding) => ({
    ...binding,
    unavailableReason:
      binding.unavailableReason as OrgAudioModelUnavailableReason | undefined,
    parameterRules: getAudioParameterRules(
      platformModels.find(
        (model) => model.canonicalId === binding.canonicalId
      )!
    ),
  }));
}

export async function resolveAudioModelInterface(
  db: Database,
  organizationId: string,
  canonicalId: string,
  interfaceId: string,
  instanceId?: string
): Promise<ResolvedAudioModelInterface | null> {
  return resolveOrgModelInterfaceBinding(
    db,
    organizationId,
    canonicalId,
    interfaceId,
    listOrgAudioModelOptions,
    instanceId
  );
}
