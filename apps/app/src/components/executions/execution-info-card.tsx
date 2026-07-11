import { WorkflowExecutionStatus } from "@dafthunk/types";
import AlertCircle from "lucide-react/icons/alert-circle";
import Clock from "lucide-react/icons/clock";
import IdCard from "lucide-react/icons/id-card";
import Workflow from "lucide-react/icons/workflow";
import { Link } from "react-router";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useTranslation } from "@/components/locale-provider";
import { useOrgUrl } from "@/hooks/use-org-url";
import { formatDate } from "@/utils/date";

import { ExecutionStatusBadge } from "./execution-status-badge";

interface ExecutionInfoCardProps {
  id: string;
  status: WorkflowExecutionStatus;
  startedAt?: Date;
  endedAt?: Date;
  workflowId: string;
  workflowName?: string;
  error?: string;
  title?: string;
  description?: string;
}

export function ExecutionInfoCard({
  id,
  status,
  startedAt,
  endedAt,
  workflowId,
  workflowName,
  error,
  title,
  description,
}: ExecutionInfoCardProps) {
  const { t } = useTranslation();
  const { getOrgUrl } = useOrgUrl();
  const cardTitle = title ?? t("pages.executionDetail.infoCard.title");
  const cardDescription =
    description ?? t("pages.executionDetail.infoCard.description");

  const formatDateOrNA = (dateString?: string | Date) => {
    if (!dateString) return t("pages.executionDetail.infoCard.notAvailable");
    return formatDate(dateString);
  };

  const calculateDuration = (
    started?: string | Date,
    ended?: string | Date
  ) => {
    if (!started || !ended) {
      return t("pages.executionDetail.infoCard.notAvailable");
    }
    const start = new Date(started);
    const end = ended ? new Date(ended) : new Date();
    const durationMs = end.getTime() - start.getTime();
    const seconds = Math.floor(durationMs / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl">{cardTitle}</CardTitle>
            <CardDescription>{cardDescription}</CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <ExecutionStatusBadge status={status as any} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground flex items-center">
                <Workflow className="mr-1 h-4 w-4" />{" "}
                {t("pages.executionDetail.infoCard.workflowName")}
              </p>
              <p className="mt-1">
                {workflowName ? (
                  <Link
                    to={getOrgUrl(`workflows/${workflowId}`)}
                    className="hover:underline text-primary"
                  >
                    {workflowName}
                  </Link>
                ) : (
                  <span className="font-mono text-xs">{workflowId}</span>
                )}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground flex items-center">
                <IdCard className="mr-1 h-4 w-4" />{" "}
                {t("pages.executionDetail.infoCard.workflowUuid")}
              </p>
              <p className="mt-1">
                <Link
                  to={getOrgUrl(`workflows/${workflowId}`)}
                  className="hover:underline font-mono text-xs"
                >
                  {workflowId}
                </Link>
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground flex items-center">
                <IdCard className="mr-1 h-4 w-4" />{" "}
                {t("pages.executionDetail.infoCard.executionUuid")}
              </p>
              <p className="mt-1">
                <Link
                  to={getOrgUrl(`executions/${id}`)}
                  className="hover:underline font-mono text-xs"
                >
                  {id}
                </Link>
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground flex items-center">
                <Clock className="mr-1 h-4 w-4" />{" "}
                {t("pages.executionDetail.infoCard.startedAt")}
              </p>
              <p className="mt-1">{formatDateOrNA(startedAt)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground flex items-center">
                <Clock className="mr-1 h-4 w-4" />{" "}
                {t("pages.executionDetail.infoCard.completedAt")}
              </p>
              <p className="mt-1">{formatDateOrNA(endedAt)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground flex items-center">
                <Clock className="mr-1 h-4 w-4" />{" "}
                {t("pages.executionDetail.infoCard.duration")}
              </p>
              <p className="mt-1">{calculateDuration(startedAt, endedAt)}</p>
            </div>
          </div>
        </div>
        {error && (
          <div className="mt-4 p-4 border border-destructive/20 bg-destructive/10 rounded-md">
            <div className="flex items-start">
              <AlertCircle className="h-5 w-5 text-destructive mr-2 mt-0.5" />
              <div>
                <p className="font-semibold text-destructive">
                  {t("pages.executionDetail.infoCard.error")}
                </p>
                <p className="text-sm font-mono whitespace-pre-wrap">{error}</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
