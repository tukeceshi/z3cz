import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { useTranslation } from "@/components/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAppToast } from "@/hooks/use-app-toast";
import {
  updateModelInterfacePriority,
  useModelInterfacePriorities,
  useOrgTextModels,
} from "@/services/platform-ai-model-service";
import { useOrganizationAiInterfaces } from "@/services/organization-ai-interface-service";
import { cn } from "@/utils/utils";

import {
  AggregateChannelBadge,
  ApiChannelBadge,
} from "./interface-card-shell";
import {
  buildDuplicateTextModelEntries,
  sortBrandInterfacesByPriority,
} from "./model-interface-priority-utils";

interface ModelInterfacePriorityDialogProps {
  readonly orgId: string;
}

function ChannelBadge({ channelKind }: { readonly channelKind: "aggregate" | "api" }) {
  return channelKind === "aggregate" ? (
    <AggregateChannelBadge />
  ) : (
    <ApiChannelBadge />
  );
}

export function ModelInterfacePriorityDialog({
  orgId,
}: ModelInterfacePriorityDialogProps) {
  const { t } = useTranslation();
  const appToast = useAppToast();
  const [open, setOpen] = useState(false);
  const [selectedCanonicalId, setSelectedCanonicalId] = useState<string>("");
  const [orderedIds, setOrderedIds] = useState<readonly string[]>([]);
  const [saving, setSaving] = useState(false);

  const { models } = useOrgTextModels(orgId);
  const { interfaces } = useOrganizationAiInterfaces(orgId);
  const { priorities, refreshPriorities } = useModelInterfacePriorities(orgId);

  const duplicateModels = useMemo(
    () =>
      buildDuplicateTextModelEntries({
        models,
        interfaces,
        modalityLabelFor: (modality) =>
          t(`pages.aiInterfaces.volcano.modalityShort.${modality}`),
      }),
    [interfaces, models, t]
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    if (
      selectedCanonicalId &&
      duplicateModels.some((entry) => entry.canonicalId === selectedCanonicalId)
    ) {
      return;
    }
    setSelectedCanonicalId(duplicateModels[0]?.canonicalId ?? "");
  }, [duplicateModels, open, selectedCanonicalId]);

  const selectedEntry = duplicateModels.find(
    (entry) => entry.canonicalId === selectedCanonicalId
  );

  useEffect(() => {
    if (!selectedEntry) {
      setOrderedIds([]);
      return;
    }
    const saved = priorities.find(
      (entry) => entry.canonicalId === selectedEntry.canonicalId
    );
    const sorted = sortBrandInterfacesByPriority(
      selectedEntry.brandInterfaces,
      saved?.interfaceIds ?? []
    );
    setOrderedIds(sorted.map((entry) => entry.interfaceId));
  }, [priorities, selectedEntry]);

  const orderedBrands = useMemo(() => {
    if (!selectedEntry) {
      return [];
    }
    const byId = new Map(
      selectedEntry.brandInterfaces.map((entry) => [entry.interfaceId, entry])
    );
    return orderedIds.flatMap((interfaceId) => {
      const brand = byId.get(interfaceId);
      return brand ? [brand] : [];
    });
  }, [orderedIds, selectedEntry]);

  const move = (index: number, direction: -1 | 1) => {
    const next = [...orderedIds];
    const target = index + direction;
    if (target < 0 || target >= next.length) {
      return;
    }
    const current = next[index]!;
    next[index] = next[target]!;
    next[target] = current;
    setOrderedIds(next);
  };

  const handleSave = async () => {
    if (!selectedCanonicalId || orderedIds.length === 0) {
      return;
    }
    setSaving(true);
    try {
      await updateModelInterfacePriority(orgId, {
        canonicalId: selectedCanonicalId,
        interfaceIds: orderedIds,
      });
      await refreshPriorities();
      toast.success(t("pages.aiInterfaces.prioritySaved"));
    } catch {
      appToast.error("pages.aiInterfaces.prioritySaveFailed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        {t("pages.aiInterfaces.prioritySettings")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("pages.aiInterfaces.priorityDialogTitle")}</DialogTitle>
          </DialogHeader>

          <p className="text-muted-foreground text-sm">
            {t("pages.aiInterfaces.priorityDialogDescription")}
          </p>

          {duplicateModels.length === 0 ? (
            <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
              {t("pages.aiInterfaces.priorityEmpty")}
            </p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {duplicateModels.map((entry) => {
                  const selected = entry.canonicalId === selectedCanonicalId;
                  return (
                    <button
                      key={entry.canonicalId}
                      type="button"
                      onClick={() => setSelectedCanonicalId(entry.canonicalId)}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                        selected
                          ? "border-primary bg-primary/5"
                          : "hover:bg-muted/50"
                      )}
                    >
                      <span className="font-medium">{entry.displayLabel}</span>
                      <span className="text-muted-foreground mt-0.5 block text-xs">
                        {t("pages.aiInterfaces.priorityBrandCount", {
                          count: entry.brandInterfaces.length,
                        })}
                      </span>
                    </button>
                  );
                })}
              </div>

              {selectedEntry ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    {t("pages.aiInterfaces.priorityBrandOrder")}
                  </p>
                  <div className="space-y-2">
                    {orderedBrands.map((brand, index) => (
                      <div
                        key={brand.interfaceId}
                        className="flex items-center justify-between rounded-lg border px-3 py-2"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <Badge
                            variant="outline"
                            className="shrink-0 tabular-nums"
                          >
                            {index + 1}
                          </Badge>
                          <ChannelBadge channelKind={brand.channelKind} />
                          <span className="truncate text-sm font-medium">
                            {brand.interfaceName}
                          </span>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={index === 0}
                            onClick={() => move(index, -1)}
                          >
                            ↑
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={index === orderedBrands.length - 1}
                            onClick={() => move(index, 1)}
                          >
                            ↓
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button
                    className="w-full"
                    disabled={saving || orderedIds.length === 0}
                    onClick={() => void handleSave()}
                  >
                    {t("common.save")}
                  </Button>
                </div>
              ) : null}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
