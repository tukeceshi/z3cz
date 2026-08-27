import type {
  OrgVideoModelOption,
  OrgVideoModelUnavailableReason,
  VideoModelParameterRules,
} from "@dafthunk/types";
import {
  applyVideoCapabilityLimits,
  buildVideoEnhanceOrgModelOption,
  isVideoEnhanceModelCanonicalId,
  isVolcanoAiInterfaceProvider,
  isVolcanoMediaKitActive,
  listEnabledVolcanoMediaKitVideoEnhanceModes,
  resolveVideoTaskCancelSupport,
  resolveVolcanoMediaKitFromMetadata,
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
import {
  isVolcanoMetadata,
  parseInterfaceMetadata,
} from "../integrations/volcengine/metadata";

export type ResolvedVideoModelInterface = ResolvedOrgModelInterface<
  VideoModelParameterRules
>;

function listInjectedVideoEnhanceModelOptions(
  interfaces: Awaited<ReturnType<typeof listOrganizationAiInterfaces>>
): readonly OrgVideoModelOption[] {
  const options: OrgVideoModelOption[] = [];

  for (const row of interfaces) {
    if (!row.enabled || !isVolcanoAiInterfaceProvider(row.provider)) {
      continue;
    }

    const metadata = parseInterfaceMetadata(row.metadata);
    if (!isVolcanoMetadata(metadata) || !metadata.mediaKitApiKeyEncrypted?.trim()) {
      continue;
    }

    const mediaKit = resolveVolcanoMediaKitFromMetadata(metadata);
    if (!isVolcanoMediaKitActive(mediaKit)) {
      continue;
    }

    const option = buildVideoEnhanceOrgModelOption({
      interfaceId: row.id,
      enabledModes: listEnabledVolcanoMediaKitVideoEnhanceModes(mediaKit),
    });
    if (option) {
      options.push(option);
    }
  }

  return options;
}

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

  const platformModelsList = buildOrgModelBindings({
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

  return [...platformModelsList, ...listInjectedVideoEnhanceModelOptions(interfaces)];
}

export async function resolveVideoModelInterface(
  db: Database,
  organizationId: string,
  canonicalId: string,
  interfaceId: string,
  instanceId?: string
): Promise<ResolvedVideoModelInterface | null> {
  if (isVideoEnhanceModelCanonicalId(canonicalId)) {
    const options = await listOrgVideoModelOptions(db, organizationId);
    const trimmedInstanceId = instanceId?.trim();
    const option = trimmedInstanceId
      ? options.find(
          (entry) =>
            entry.instanceId === trimmedInstanceId &&
            entry.interfaceId === interfaceId &&
            isVideoEnhanceModelCanonicalId(entry.canonicalId)
        )
      : options.find(
          (entry) =>
            entry.canonicalId === canonicalId &&
            entry.interfaceId === interfaceId
        );
    if (!option?.selectable) {
      return null;
    }

    const ifaceRow = (await listOrganizationAiInterfaces(db, organizationId)).find(
      (row) => row.id === interfaceId
    );
    if (!ifaceRow?.enabled) {
      return null;
    }

    return {
      instanceId: option.instanceId,
      canonicalId: option.canonicalId,
      displayName: option.displayName,
      interfaceId: option.interfaceId,
      interfaceName: ifaceRow.name,
      channelKind: "aggregate",
      providerModelId: option.providerModelId,
      parameterRules: option.parameterRules,
    };
  }

  return resolveOrgModelInterfaceBinding(
    db,
    organizationId,
    canonicalId,
    interfaceId,
    listOrgVideoModelOptions,
    instanceId
  );
}
