import AlertCircle from "lucide-react/icons/alert-circle";

import { useTranslation } from "@/components/locale-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export interface WorkflowErrorProps {
  message: string;
  details?: string;
  onRetry?: () => void;
}

export function WorkflowError({ message, onRetry }: WorkflowErrorProps) {
  const { t } = useTranslation();

  return (
    <div className="w-full h-full flex items-center justify-center p-6">
      <Alert variant="destructive" className="max-w-md">
        <AlertCircle className="size-4 inline-block mr-2 mb-1" />
        <AlertTitle className="inline-block mb-0">
          {t("workflow.error.title")}
        </AlertTitle>
        <AlertDescription className="mt-2">
          {message || t("workflow.error.fallback")}
        </AlertDescription>
        <div className="mt-4 flex justify-end">
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry}>
              {t("workflow.error.retry")}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="ml-2"
            onClick={() => (window.location.href = "/")}
          >
            {t("workflow.error.goHome")}
          </Button>
        </div>
      </Alert>
    </div>
  );
}
