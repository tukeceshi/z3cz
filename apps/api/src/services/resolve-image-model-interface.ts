import type {
  AiModelModality,
  ImageModelParameterRules,
  OrgImageModelOption,
  OrgTextModelUnavailableReason,
  PlatformAiModel,
} from "@dafthunk/types";
import { isVolcanoAiInterfaceProvider } from "@dafthunk/types";

import type { Database } from "../db";
import {
  getImageParameterRules,
  listModelInterfacePriorities,
  listPlatformAiModelGroups,
  listPlatformAiModels,
} from "../db/platform-ai-model-queries";
import { listOrganizationAiInterfaces } from "../db/ai-interface-queries";
import {
  isVolcanoMetadata,
  parseInterfaceMetadata,
} from "../integrations/volcengine/metadata";
import {
  sortInterfacesByPriority,
  type VolcanoInterfaceCandidate,
} from "./resolve-text-model-interface";

export interface ResolvedImageModelInterface {
  readonly canonicalId: string;
  readonly displayName: string;
  readonly interfaceId: string;
  readonly interfaceName: string;
  readonly providerModelId: string;
  readonly parameterRules: ImageModelParameterRules;
}

function collectVolcanoInterfaces(
  interfaces: Awaited<ReturnType<typeof listOrganizationAiInterfaces>>
): VolcanoInterfaceCandidate[] {
  return interfaces
    .filter(
      (row) => row.enabled && isVolcanoAiInterfaceProvider(row.provider)
    )
    .flatMap((row) => {
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

export function evaluateOrgImageModelAvailability(
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

  const existsOnInterface = volcanoInterfaces.some(
    (entry) => canonicalId in entry.models
  );
  if (!existsOnInterface) {
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

export async function listOrgImageModelOptions(
  db: Database,
  organizationId: string
): Promise<readonly OrgImageModelOption[]> {
  const [platformModels, groups, interfaces] = await Promise.all([
    listPlatformAiModels(db, "image"),
    listPlatformAiModelGroups(db),
    listOrganizationAiInterfaces(db, organizationId),
  ]);

  const groupById = new Map(groups.map((group) => [group.id, group]));
  const visibleModels = platformModels.filter((model) => model.platformEnabled);
  const volcanoInterfaces = collectVolcanoInterfaces(interfaces);

  return visibleModels.map((model) => {
    const availability = evaluateOrgImageModelAvailability(
      model.canonicalId,
      volcanoInterfaces
    );
    const group = model.groupId ? groupById.get(model.groupId) : undefined;

    return {
      canonicalId: model.canonicalId,
      displayName: model.displayName,
      modality: model.modality as AiModelModality,
      providerModelId: model.providerModelId,
      parameterRules: getImageParameterRules(model),
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

export async function resolveImageModelInterface(
  db: Database,
  organizationId: string,
  canonicalId: string
): Promise<ResolvedImageModelInterface | null> {
  const options = await listOrgImageModelOptions(db, organizationId);
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
