import type {
  AiModelCatalogEntry,
  AiModelModality,
  OrgTextModelOption,
  OrgTextModelUnavailableReason,
  PlatformAiModel,
  VolcanoInterfaceMetadata,
  VolcanoModelConfig,
} from "@dafthunk/types";
import { isVolcanoAiInterfaceProvider } from "@dafthunk/types";

import type { Database } from "../db";
import {
  getTextParameterRules,
  listModelInterfacePriorities,
  listPlatformAiModelGroups,
  listPlatformAiModels,
} from "../db/platform-ai-model-queries";
import { listOrganizationAiInterfaces } from "../db/ai-interface-queries";
import {
  isVolcanoMetadata,
  parseInterfaceMetadata,
} from "../integrations/volcengine/metadata";

export interface ResolvedTextModelInterface {
  readonly canonicalId: string;
  readonly displayName: string;
  readonly interfaceId: string;
  readonly interfaceName: string;
  readonly providerModelId: string;
  readonly parameterRules: ReturnType<typeof getTextParameterRules>;
}

export interface VolcanoInterfaceCandidate {
  readonly id: string;
  readonly createdAt: Date;
  readonly models: Readonly<Record<string, VolcanoModelConfig>>;
}

export function sortInterfacesByPriority(
  interfaceIds: readonly string[],
  candidates: readonly { id: string; createdAt: Date }[]
): { id: string; createdAt: Date }[] {
  if (interfaceIds.length === 0) {
    return [...candidates].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  const rank = new Map(interfaceIds.map((id, index) => [id, index]));
  return [...candidates].sort((a, b) => {
    const rankA = rank.get(a.id);
    const rankB = rank.get(b.id);
    if (rankA !== undefined && rankB !== undefined) {
      return rankA - rankB;
    }
    if (rankA !== undefined) return -1;
    if (rankB !== undefined) return 1;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}

/**
 * Rule B:
 * - List = Admin platform text models with platformEnabled=true
 * - selectable = at least one enabled org volcano interface has the same canonicalId enabled
 */
export function evaluateOrgTextModelAvailability(
  canonicalId: string,
  volcanoInterfaces: readonly VolcanoInterfaceCandidate[]
): {
  readonly selectable: boolean;
  readonly unavailableReason?: OrgTextModelUnavailableReason;
} {
  if (volcanoInterfaces.length === 0) {
    return { selectable: false, unavailableReason: "no_org_interface" };
  }

  const enabledOnInterface = volcanoInterfaces.some(
    (entry) => entry.models[canonicalId]?.enabled === true
  );
  if (enabledOnInterface) {
    return { selectable: true };
  }

  const keyPresent = volcanoInterfaces.some(
    (entry) => entry.models[canonicalId] !== undefined
  );
  if (!keyPresent) {
    return {
      selectable: false,
      unavailableReason: "model_missing_on_interface",
    };
  }

  return {
    selectable: false,
    unavailableReason: "model_disabled_on_interface",
  };
}

export function toVolcanoCatalogEntriesFromPlatform(
  models: readonly PlatformAiModel[]
): readonly AiModelCatalogEntry[] {
  return models.map((model) => ({
    canonicalId: model.canonicalId,
    alias: model.displayName,
    modality: model.modality,
    providerModelId: model.providerModelId,
  }));
}

function collectVolcanoInterfaces(
  interfaces: Awaited<ReturnType<typeof listOrganizationAiInterfaces>>
): VolcanoInterfaceCandidate[] {
  return interfaces
    .filter(
      (row) => row.enabled && isVolcanoAiInterfaceProvider(row.provider)
    )
    .flatMap((row) => {
      // OrganizationAiInterface.metadata is already parsed by rowToOrgInterface.
      const metadata = parseInterfaceMetadata(row.metadata);
      if (!isVolcanoMetadata(metadata)) return [];
      return [
        {
          id: row.id,
          createdAt: new Date(row.createdAt),
          models: metadata.models,
        },
      ];
    });
}

export async function listOrgTextModelOptions(
  db: Database,
  organizationId: string
): Promise<readonly OrgTextModelOption[]> {
  const [platformModels, groups, interfaces] = await Promise.all([
    listPlatformAiModels(db, "text"),
    listPlatformAiModelGroups(db),
    listOrganizationAiInterfaces(db, organizationId),
  ]);

  const groupById = new Map(groups.map((group) => [group.id, group]));
  const visibleModels = platformModels.filter((model) => model.platformEnabled);
  const volcanoInterfaces = collectVolcanoInterfaces(interfaces);

  return visibleModels.map((model) => {
    const availability = evaluateOrgTextModelAvailability(
      model.canonicalId,
      volcanoInterfaces
    );
    const group = model.groupId ? groupById.get(model.groupId) : undefined;

    return {
      canonicalId: model.canonicalId,
      displayName: model.displayName,
      modality: model.modality as AiModelModality,
      providerModelId: model.providerModelId,
      parameterRules: getTextParameterRules(model),
      selectable: availability.selectable,
      unavailableReason: availability.unavailableReason,
      description: model.description,
      groupId: model.groupId,
      groupName: group?.name ?? null,
      groupDescription: group?.description ?? null,
      groupIcon: group?.icon ?? null,
    };
  });
}

export async function resolveTextModelInterface(
  db: Database,
  organizationId: string,
  canonicalId: string
): Promise<ResolvedTextModelInterface | null> {
  const options = await listOrgTextModelOptions(db, organizationId);
  const option = options.find((entry) => entry.canonicalId === canonicalId);
  if (!option?.selectable) return null;

  const [interfaces, priorities] = await Promise.all([
    listOrganizationAiInterfaces(db, organizationId),
    listModelInterfacePriorities(db, organizationId),
  ]);

  const priorityIds =
    priorities.find((entry) => entry.canonicalId === canonicalId)?.interfaceIds ??
    [];

  const volcanoInterfaces = collectVolcanoInterfaces(interfaces);
  const candidates = volcanoInterfaces.filter(
    (entry) => entry.models[canonicalId]?.enabled === true
  );

  const sorted = sortInterfacesByPriority(
    priorityIds,
    candidates.map((entry) => ({
      id: entry.id,
      createdAt: entry.createdAt,
    }))
  );

  const match = sorted[0];
  if (!match) return null;

  const row = volcanoInterfaces.find((entry) => entry.id === match.id);
  if (!row) return null;

  const providerModelId =
    row.models[canonicalId]?.providerModelId ?? option.providerModelId;

  const ifaceRow = interfaces.find((entry) => entry.id === match.id);
  if (!ifaceRow) return null;

  return {
    canonicalId,
    displayName: option.displayName,
    interfaceId: ifaceRow.id,
    interfaceName: ifaceRow.name,
    providerModelId,
    parameterRules: option.parameterRules,
  };
}

/** Ensure volcano metadata includes all platform catalog keys (enabled defaults to false). */
export function ensureVolcanoModelsIncludePlatformCatalog(
  metadata: VolcanoInterfaceMetadata,
  platformCatalog: readonly AiModelCatalogEntry[]
): VolcanoInterfaceMetadata {
  if (platformCatalog.length === 0) {
    return metadata;
  }

  const models = { ...metadata.models };
  for (const entry of platformCatalog) {
    if (models[entry.canonicalId]) continue;
    models[entry.canonicalId] = {
      enabled: false,
      providerModelId: entry.providerModelId,
      modality: entry.modality,
    };
  }

  return { ...metadata, models };
}
