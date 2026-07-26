import type {
  AiModelModality,
  AudioModelParameterRules,
  OrgAudioModelOption,
  OrgAudioModelUnavailableReason,
} from "@dafthunk/types";

import type { Database } from "../db";
import {
  getAudioParameterRules,
  listModelInterfacePriorities,
  listPlatformAiModelGroups,
  listPlatformAiModels,
} from "../db/platform-ai-model-queries";
import { listOrganizationAiInterfaces } from "../db/ai-interface-queries";
import {
  collectSingleModelInterfaces,
  evaluateOrgTextModelAvailability,
  sortInterfacesByPriority,
} from "./resolve-text-model-interface";

export interface ResolvedAudioModelInterface {
  readonly canonicalId: string;
  readonly displayName: string;
  readonly interfaceId: string;
  readonly interfaceName: string;
  readonly providerModelId: string;
  readonly parameterRules: AudioModelParameterRules;
}

export async function listOrgAudioModelOptions(
  db: Database,
  organizationId: string
): Promise<readonly OrgAudioModelOption[]> {
  const [platformModels, groups, interfaces] = await Promise.all([
    listPlatformAiModels(db, "audio"),
    listPlatformAiModelGroups(db),
    listOrganizationAiInterfaces(db, organizationId),
  ]);

  const groupById = new Map(groups.map((group) => [group.id, group]));
  const visibleModels = platformModels.filter((model) => model.platformEnabled);
  const singleModelInterfaces = collectSingleModelInterfaces(interfaces);

  return visibleModels.map((model) => {
    const availability = evaluateOrgTextModelAvailability(
      model.canonicalId,
      [],
      singleModelInterfaces
    );
    const group = model.groupId ? groupById.get(model.groupId) : undefined;

    return {
      canonicalId: model.canonicalId,
      displayName: model.displayName,
      modality: model.modality as AiModelModality,
      providerModelId: model.providerModelId,
      parameterRules: getAudioParameterRules(model),
      selectable: availability.selectable,
      unavailableReason:
        availability.unavailableReason as OrgAudioModelUnavailableReason | undefined,
      description: model.description,
      groupId: model.groupId,
      groupName: group?.name ?? null,
      groupDescription: group?.description ?? null,
      groupIcon: group?.icon ?? null,
    };
  });
}

export async function resolveAudioModelInterface(
  db: Database,
  organizationId: string,
  canonicalId: string
): Promise<ResolvedAudioModelInterface | null> {
  const options = await listOrgAudioModelOptions(db, organizationId);
  const option = options.find((entry) => entry.canonicalId === canonicalId);
  if (!option?.selectable) return null;

  const [interfaces, priorities] = await Promise.all([
    listOrganizationAiInterfaces(db, organizationId),
    listModelInterfacePriorities(db, organizationId),
  ]);

  const priorityIds =
    priorities.find((entry) => entry.canonicalId === canonicalId)?.interfaceIds ??
    [];

  const singleModelInterfaces = collectSingleModelInterfaces(interfaces);

  const directCandidates = singleModelInterfaces
    .filter((entry) => entry.models[canonicalId]?.enabled === true)
    .map((entry) => ({
      id: entry.id,
      createdAt: entry.createdAt,
      upstreamModelId: entry.models[canonicalId]!.upstreamModelId,
    }));

  const sorted = sortInterfacesByPriority(priorityIds, directCandidates);
  const match = sorted[0];
  if (!match) return null;

  const directMatch = directCandidates.find((entry) => entry.id === match.id);
  if (!directMatch) return null;

  const ifaceRow = interfaces.find((entry) => entry.id === match.id);
  if (!ifaceRow) return null;

  return {
    canonicalId,
    displayName: option.displayName,
    interfaceId: ifaceRow.id,
    interfaceName: ifaceRow.name,
    providerModelId: directMatch.upstreamModelId,
    parameterRules: option.parameterRules,
  };
}
