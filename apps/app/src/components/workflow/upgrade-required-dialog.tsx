import type { NodeType } from "@dafthunk/types";
// @ts-ignore - https://github.com/lucide-icons/lucide/issues/2867#issuecomment-2847105863
import { DynamicIcon } from "lucide-react/dynamic.mjs";
import Sparkles from "lucide-react/icons/sparkles";
import { useNavigate } from "react-router";

import { useTranslation } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useOrgUrl } from "@/hooks/use-org-url";

export interface UpgradeRequiredDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gatedNodeTypes: NodeType[];
  variant?: "preflight" | "post-failure";
}

export function UpgradeRequiredDialog({
  open,
  onOpenChange,
  gatedNodeTypes,
  variant = "preflight",
}: UpgradeRequiredDialogProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { getOrgUrl } = useOrgUrl();

  const handleUpgrade = () => {
    onOpenChange(false);
    navigate(getOrgUrl("billing"));
  };

  const title =
    variant === "post-failure"
      ? t("workflow.upgradeRequired.titlePostFailure")
      : t("workflow.upgradeRequired.titlePreflight");

  const description =
    variant === "post-failure"
      ? t("workflow.upgradeRequired.descriptionPostFailure")
      : gatedNodeTypes.length === 1
        ? t("workflow.upgradeRequired.descriptionPreflightOne")
        : t("workflow.upgradeRequired.descriptionPreflightMany");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            <DialogTitle>{title}</DialogTitle>
          </div>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {gatedNodeTypes.length > 0 && (
          <ul className="rounded-md border border-border divide-y divide-border max-h-64 overflow-y-auto">
            {gatedNodeTypes.map((nodeType) => (
              <li
                key={nodeType.type}
                className="flex items-center gap-3 px-3 py-2"
              >
                {nodeType.icon ? (
                  <DynamicIcon
                    name={nodeType.icon as any}
                    className="h-4 w-4 text-muted-foreground shrink-0"
                  />
                ) : (
                  <Sparkles className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {nodeType.name}
                  </p>
                  {nodeType.description && (
                    <p className="text-xs text-muted-foreground truncate">
                      {nodeType.description}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("workflow.upgradeRequired.notNow")}
          </Button>
          <Button onClick={handleUpgrade}>
            {t("workflow.upgradeRequired.upgrade")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
