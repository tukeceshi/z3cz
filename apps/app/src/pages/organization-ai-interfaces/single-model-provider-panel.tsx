import {
  buildSingleModelSnapshotFromInterface,
  getSingleModelPresetById,
  isSingleModelAiInterface,
  isSingleModelProviderMetadata,
  listEnabledSingleModelSnapshotRows,
  type OrganizationAiInterface,
} from "@dafthunk/types";
import { useMemo, useState } from "react";

import { useTranslation } from "@/components/locale-provider";
import { useAppToast } from "@/hooks/use-app-toast";
import { updateSingleModelModelEnabled } from "@/services/organization-ai-interface-service";

import {
  ApiChannelBadge,
  InterfaceCardShell,
} from "./interface-card-shell";
import {
  SingleModelConfigDialog,
  SingleModelConnectionSummary,
} from "./single-model-config-dialog";
import { resolveSingleModelPresetCardName } from "./single-model-display-name";
import { SingleModelModelRow } from "./single-model-model-row";

interface SingleModelProviderPanelProps {
  readonly organizationId: string;
  readonly iface: OrganizationAiInterface;
  readonly onUpdated: () => Promise<void>;
  readonly onDelete: () => void;
}

export function SingleModelProviderPanel({
  organizationId,
  iface,
  onUpdated,
  onDelete,
}: SingleModelProviderPanelProps) {
  const { t } = useTranslation();
  const appToast = useAppToast();
  const [expanded, setExpanded] = useState(false);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const snapshot = useMemo(
    () => buildSingleModelSnapshotFromInterface(iface),
    [iface]
  );

  if (!isSingleModelAiInterface(iface) || !snapshot) {
    return null;
  }

  const enabledChips = listEnabledSingleModelSnapshotRows(snapshot).map(
    (row) => ({
      canonicalId: row.canonicalId,
      alias: row.alias,
      modality: row.modality,
    })
  );

  const presetId = isSingleModelProviderMetadata(iface.metadata)
    ? iface.metadata.singleModelPresetId
    : undefined;
  const preset = presetId ? getSingleModelPresetById(presetId) : undefined;
  const displayName =
    iface.name.trim() ||
    (preset ? resolveSingleModelPresetCardName(preset, t) : iface.name);

  const handleToggle = async (canonicalId: string, enabled: boolean) => {
    setTogglingId(canonicalId);
    try {
      await updateSingleModelModelEnabled(organizationId, iface.id, {
        [canonicalId]: enabled,
      });
      await onUpdated();
    } catch {
      appToast.error("pages.aiInterfaces.singleModel.toggleFailed");
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <>
      <InterfaceCardShell
        title={displayName}
        titleBadge={<ApiChannelBadge />}
        enabledModelChips={enabledChips}
        expanded={expanded}
        onExpandToggle={() => setExpanded((current) => !current)}
        onDelete={onDelete}
      >
        <div className="space-y-3">
          <SingleModelConnectionSummary
            iface={iface}
            onEdit={() => setConfigDialogOpen(true)}
          />
          <div className="columns-1 gap-3 md:columns-2">
          {snapshot.models.map((row) => (
            <div key={row.canonicalId} className="mb-3 break-inside-avoid">
              <SingleModelModelRow
                row={row}
                disabled={togglingId === row.canonicalId}
                onEnabledChange={(enabled) =>
                  void handleToggle(row.canonicalId, enabled)
                }
              />
            </div>
          ))}
          </div>
        </div>
      </InterfaceCardShell>

      <SingleModelConfigDialog
        organizationId={organizationId}
        iface={iface}
        open={configDialogOpen}
        onOpenChange={setConfigDialogOpen}
        onSaved={onUpdated}
      />
    </>
  );
}
