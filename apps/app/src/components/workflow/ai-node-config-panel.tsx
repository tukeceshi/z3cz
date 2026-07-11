import {
  AI_IMAGE_NODE_TYPE,
  AI_TEXT_NODE_TYPE,
  AI_VIDEO_NODE_TYPE,
} from "@dafthunk/types";
import AlertCircleIcon from "lucide-react/icons/alert-circle";
import PlayIcon from "lucide-react/icons/play";
import { useState } from "react";
import { Link } from "react-router";

import { useAuth } from "@/components/auth-context";
import { useTranslation } from "@/components/locale-provider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useOrgUrl } from "@/hooks/use-org-url";
import { useOrganizationAiInterfaces } from "@/services/organization-ai-interface-service";
import { cn } from "@/utils/utils";

import { updateNodeInput, useWorkflow } from "./workflow-context";
import type { WorkflowNodeType } from "./workflow-types";

const PANEL_WIDTH = 384;
const PANEL_HEIGHT = 280;
const DEFAULT_AI_INTERFACE = "__default__";

type SupportedAiNodeType =
  | typeof AI_TEXT_NODE_TYPE
  | typeof AI_IMAGE_NODE_TYPE
  | typeof AI_VIDEO_NODE_TYPE;

export interface AiNodeConfigPanelProps {
  nodeId: string;
  data: WorkflowNodeType;
}

export function AiNodeConfigPanel({ nodeId, data }: AiNodeConfigPanelProps) {
  const { updateNodeData, disabled, onRunNode } = useWorkflow();
  const { organization } = useAuth();
  const { t } = useTranslation();
  const orgId = organization?.id;
  const { getOrgUrl } = useOrgUrl();
  const [isRunning, setIsRunning] = useState(false);

  const nodeType = (data.nodeType ?? "") as SupportedAiNodeType;
  const isTextNode = nodeType === AI_TEXT_NODE_TYPE;
  const isImageNode = nodeType === AI_IMAGE_NODE_TYPE;

  const { interfaces, isInterfacesLoading } = useOrganizationAiInterfaces(
    isTextNode ? orgId : undefined
  );

  const getInput = (id: string): string => {
    const input = data.inputs.find((i) => i.id === id);
    return typeof input?.value === "string" ? input.value : "";
  };

  const getNumberInput = (id: string, fallback: number): number => {
    const input = data.inputs.find((i) => i.id === id);
    return typeof input?.value === "number" ? input.value : fallback;
  };

  const setInput = (id: string, value: string | number) => {
    if (disabled || !updateNodeData) return;
    updateNodeInput(nodeId, id, value, data.inputs, updateNodeData);
  };

  const handleRun = async () => {
    if (!onRunNode) return;
    setIsRunning(true);
    try {
      await onRunNode(nodeId);
    } finally {
      setIsRunning(false);
    }
  };

  const showAiInterfaceAlert =
    isTextNode && !isInterfacesLoading && interfaces.length === 0;
  const hasAiInterfaces =
    isTextNode && !isInterfacesLoading && interfaces.length > 0;
  const selectedInterfaceId = getInput("ai_interface_id") || DEFAULT_AI_INTERFACE;

  return (
    <div
      className={cn(
        "nodrag nopan nowheel absolute top-full left-1/2 z-20 mt-2",
        "-translate-x-1/2 overflow-hidden rounded-md border border-border",
        "bg-neutral-50 shadow-md dark:bg-neutral-800"
      )}
      style={{
        width: PANEL_WIDTH,
        height: PANEL_HEIGHT,
      }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="h-full overflow-y-auto p-3 flex flex-col gap-3">
        {showAiInterfaceAlert && (
          <Alert variant="default" className="py-2">
            <AlertCircleIcon className="h-4 w-4" />
            <AlertDescription className="text-xs">
              {t("workflow.aiPanel.noInterfaces")}{" "}
              {orgId && (
                <Link
                  to={getOrgUrl("/ai-interfaces")}
                  className="underline text-blue-500"
                >
                  {t("workflow.aiPanel.setupInterface")}
                </Link>
              )}
            </AlertDescription>
          </Alert>
        )}

        {hasAiInterfaces && (
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">{t("workflow.aiPanel.aiInterface")}</Label>
            <Select
              value={selectedInterfaceId}
              onValueChange={(value) =>
                setInput(
                  "ai_interface_id",
                  value === DEFAULT_AI_INTERFACE ? "" : value
                )
              }
              disabled={disabled}
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue placeholder={t("workflow.aiPanel.orgDefaultPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={DEFAULT_AI_INTERFACE}>
                  {t("workflow.aiPanel.orgDefault")}
                </SelectItem>
                {interfaces.map((iface) => (
                  <SelectItem key={iface.id} value={iface.id}>
                    {iface.name}
                    {iface.isDefault ? t("workflow.aiPanel.defaultSuffix") : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {(hasAiInterfaces || !isTextNode) && (
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">
              {isTextNode ? t("workflow.aiPanel.modelOverride") : t("workflow.aiPanel.model")}
            </Label>
            <Input
              className="h-7 text-xs"
              placeholder={
                isTextNode
                  ? t("workflow.aiPanel.modelPlaceholderText")
                  : isImageNode
                    ? t("workflow.aiPanel.modelPlaceholderImage")
                    : t("workflow.aiPanel.modelPlaceholderVideo")
              }
              value={getInput("model")}
              onChange={(e) => setInput("model", e.target.value)}
              disabled={disabled}
            />
          </div>
        )}

        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">{t("workflow.aiPanel.prompt")}</Label>
          <Textarea
            className="text-xs min-h-[60px] resize-none"
            placeholder={t("workflow.aiPanel.promptPlaceholder")}
            value={getInput("prompt")}
            onChange={(e) => setInput("prompt", e.target.value)}
            disabled={disabled}
          />
        </div>

        {isImageNode && (
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">{t("workflow.aiPanel.count")}</Label>
            <Input
              type="number"
              className="h-7 text-xs w-20"
              min={1}
              max={8}
              value={getNumberInput("count", 1)}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!isNaN(v)) setInput("count", v);
              }}
              disabled={disabled}
            />
          </div>
        )}

        {isTextNode && (
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">
              {t("workflow.aiPanel.manualTextBypass")}
            </Label>
            <Textarea
              className="text-xs min-h-[40px] resize-none"
              placeholder={t("workflow.aiPanel.manualTextPlaceholder")}
              value={getInput("manual_text")}
              onChange={(e) => setInput("manual_text", e.target.value)}
              disabled={disabled}
            />
          </div>
        )}

        {onRunNode && (
          <div className="mt-auto pt-1">
            <Button
              size="sm"
              className="w-full h-7 text-xs gap-1"
              onClick={handleRun}
              disabled={isRunning || disabled}
            >
              <PlayIcon className="h-3 w-3" />
              {isRunning ? t("workflow.aiPanel.running") : t("workflow.aiPanel.run")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
