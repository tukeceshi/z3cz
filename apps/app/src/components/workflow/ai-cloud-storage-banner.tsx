import { Link } from "react-router";
import X from "lucide-react/icons/x";

import { useTranslation } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { useOrgUrl } from "@/hooks/use-org-url";
import { cn } from "@/utils/utils";

interface AiCloudStorageBannerProps {
  readonly visible: boolean;
  readonly onDismiss?: () => void;
}

export function AiCloudStorageBanner({
  visible,
  onDismiss,
}: AiCloudStorageBannerProps) {
  const { t } = useTranslation();
  const { getOrgUrl } = useOrgUrl();

  if (!visible) return null;

  return (
    <div className="absolute top-0 left-0 right-0 z-50 border-b border-red-300 bg-red-50 px-4 py-2 dark:border-red-900 dark:bg-red-950/40">
      <div className="mx-auto flex max-w-5xl items-start justify-between gap-3">
        <div className="space-y-1 text-sm text-red-900 dark:text-red-100">
          <p className="font-medium">
            {t("workflow.aiCloudStorageBanner.title")}
          </p>
          <p className="text-red-800/90 dark:text-red-200/90">
            {t("workflow.aiCloudStorageBanner.description")}
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button asChild size="sm" variant="outline" className="h-7">
              <Link to={getOrgUrl("/ai-interfaces")}>
                {t("workflow.aiCloudStorageBanner.configure")}
              </Link>
            </Button>
          </div>
        </div>
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className={cn(
              "rounded p-1 text-red-700 hover:bg-red-100 dark:text-red-200 dark:hover:bg-red-900/50"
            )}
            aria-label={t("workflow.execution.close")}
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
