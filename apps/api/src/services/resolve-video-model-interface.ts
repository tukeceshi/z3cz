import type {
  OrgVideoModelOption,
  OrgVideoModelUnavailableReason,
  VideoModelParameterRules,
} from "@dafthunk/types";
import {
  applyVideoCapabilityLimits,
  resolveVideoTaskCancelSupport,
} from "@dafthunk/types";

import type { Database } from "../db";
import { listOrganizationAiInterfaces } from "../db/ai-interface-queries";
import {
  getVideoParameterRules,
  listPlatformAiModels,
} from "../db/platform-ai-model-queries";
import { buildOrgModelBindings } from "./build-org-model-bindings";
import {
  collectOrgBindingInterfaces,
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

  const platformModelById = new Map(
    platformModels.map((model) => [model.canonicalId, model])
  );

  const bindingInterfaces = collectOrgBindingInterfaces(interfaces);
  const entriesByInterfaceId = new Map(
    bindingInterfaces.map((iface) => [iface.id, iface.entries])
  );

  return buildOrgModelBindings({
    platformModels,
    interfaces: bindingInterfaces,
  }).map((binding) => {
    const platformModel = platformModelById.get(binding.canonicalId)!;
    const platformRules = getVideoParameterRules(platformModel);
    const instanceEntry =
      binding.channelKind === "api"
        ? entriesByInterfaceId
            .get(binding.interfaceId)
            ?.find((entry) => entry.instanceId === binding.instanceId)
        : undefined;
    const capabilityLimits =
      binding.channelKind === "api"
        ? (instanceEntry?.config.capabilityLimits ?? null)
        : null;

    return {
      ...binding,
      unavailableReason:
        binding.unavailableReason as OrgVideoModelUnavailableReason | undefined,
      parameterRules: applyVideoCapabilityLimits(
        platformRules,
        capabilityLimits
      ),
      supportsTaskCancel: resolveVideoTaskCancelSupport({
        canonicalId: binding.canonicalId,
        channelKind: binding.channelKind,
        platformRules,
        capabilityLimits,
      }),
    };
  });
}

export async function resolveVideoModelInterface(
  db: Database,
  organizationId: string,
  canonicalId: string,
  interfaceId: string,
  instanceId?: string
): Promise<ResolvedVideoModelInterface | null> {
  return resolveOrgModelInterfaceBinding(
    db,
    organizationId,
    canonicalId,
    interfaceId,
    listOrgVideoModelOptions,
    instanceId
  );
}
