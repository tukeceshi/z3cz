import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { useTranslation } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  updateModelInterfacePriority,
  useModelInterfacePriorities,
  useOrgTextModels,
} from "@/services/platform-ai-model-service";
import {
  useOrganizationAiInterfaces,
} from "@/services/organization-ai-interface-service";

interface ModelInterfacePriorityDialogProps {
  readonly orgId: string;
}

export function ModelInterfacePriorityDialog({
  orgId,
}: ModelInterfacePriorityDialogProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [canonicalId, setCanonicalId] = useState<string>("");
  const [orderedIds, setOrderedIds] = useState<readonly string[]>([]);
  const [saving, setSaving] = useState(false);

  const { models } = useOrgTextModels(orgId);
  const { interfaces } = useOrganizationAiInterfaces(orgId);
  const { priorities, refreshPriorities } = useModelInterfacePriorities(orgId);

  const textModels = models.filter((entry) => entry.modality === "text");

  const interfaceOptions = useMemo(
    () => interfaces.filter((entry) => entry.enabled),
    [interfaces]
  );

  useEffect(() => {
    if (!canonicalId && textModels.length > 0) {
      setCanonicalId(textModels[0]!.canonicalId);
    }
  }, [canonicalId, textModels]);

  useEffect(() => {
    if (!canonicalId) return;
    const saved = priorities.find((entry) => entry.canonicalId === canonicalId);
    if (saved && saved.interfaceIds.length > 0) {
      setOrderedIds(saved.interfaceIds);
      return;
    }
    setOrderedIds(
      [...interfaceOptions]
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        .map((entry) => entry.id)
    );
  }, [canonicalId, interfaceOptions, priorities]);

  const move = (index: number, direction: -1 | 1) => {
    const next = [...orderedIds];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    const current = next[index]!;
    next[index] = next[target]!;
    next[target] = current;
    setOrderedIds(next);
  };

  const handleSave = async () => {
    if (!canonicalId) return;
    setSaving(true);
    try {
      await updateModelInterfacePriority(orgId, {
        canonicalId,
        interfaceIds: orderedIds,
      });
      await refreshPriorities();
      toast.success(t("pages.aiInterfaces.prioritySaved"));
      setOpen(false);
    } catch {
      toast.error(t("pages.aiInterfaces.prioritySaveFailed"));
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("pages.aiInterfaces.priorityDialogTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={canonicalId} onValueChange={setCanonicalId}>
              <SelectTrigger>
                <SelectValue placeholder={t("pages.aiInterfaces.selectModel")} />
              </SelectTrigger>
              <SelectContent>
                {textModels.map((model) => (
                  <SelectItem key={model.canonicalId} value={model.canonicalId}>
                    {model.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="space-y-2">
              {orderedIds.map((interfaceId, index) => {
                const iface = interfaceOptions.find(
                  (entry) => entry.id === interfaceId
                );
                if (!iface) return null;
                return (
                  <div
                    key={interfaceId}
                    className="flex items-center justify-between rounded border px-2 py-1 text-sm"
                  >
                    <span>{iface.name}</span>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => move(index, -1)}
                      >
                        ↑
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => move(index, 1)}
                      >
                        ↓
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
            <Button className="w-full" disabled={saving} onClick={handleSave}>
              {t("common.save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
