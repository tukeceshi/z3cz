import type {
  WorkflowBillingMode,
  WorkflowRuntime,
  WorkflowTrigger,
} from "@dafthunk/types";
import { useEffect, useRef, useState } from "react";

import { useTranslation } from "@/components/locale-provider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

const WORKFLOW_TRIGGERS: WorkflowTrigger[] = [
  "manual",
  "scheduled",
  "http_webhook",
  "http_request",
  "email_message",
  "discord_event",
  "telegram_event",
  "whatsapp_event",
  "slack_event",
  "queue_message",
];

export interface WorkflowPropertiesFormProps {
  workflowName?: string;
  workflowDescription?: string;
  workflowTrigger?: WorkflowTrigger;
  workflowRuntime?: WorkflowRuntime;
  workflowBillingMode?: WorkflowBillingMode;
  onWorkflowUpdate?: (
    name: string,
    description?: string,
    trigger?: WorkflowTrigger,
    runtime?: WorkflowRuntime,
    billingMode?: WorkflowBillingMode
  ) => void;
  disabled?: boolean;
  isEnabled?: boolean;
  isTogglingEnabled?: boolean;
  onToggleEnabled?: (checked: boolean) => void;
  onTriggerChange?: (newTrigger: WorkflowTrigger) => void;
}

export function WorkflowPropertiesForm({
  workflowName = "",
  workflowDescription = "",
  workflowTrigger = "manual",
  workflowRuntime = "workflow",
  workflowBillingMode = "platform",
  onWorkflowUpdate,
  disabled = false,
  isEnabled,
  isTogglingEnabled,
  onToggleEnabled,
  onTriggerChange,
}: WorkflowPropertiesFormProps) {
  const { t } = useTranslation();
  const [localName, setLocalName] = useState(workflowName);
  const [localDescription, setLocalDescription] = useState(workflowDescription);
  const [localTrigger, setLocalTrigger] =
    useState<WorkflowTrigger>(workflowTrigger);
  const [localRuntime, setLocalRuntime] =
    useState<WorkflowRuntime>(workflowRuntime);
  const [localBillingMode, setLocalBillingMode] =
    useState<WorkflowBillingMode>(workflowBillingMode);
  const updateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const localStateRef = useRef({
    name: localName,
    description: localDescription,
    trigger: localTrigger,
    runtime: localRuntime,
    billingMode: localBillingMode,
  });
  localStateRef.current = {
    name: localName,
    description: localDescription,
    trigger: localTrigger,
    runtime: localRuntime,
    billingMode: localBillingMode,
  };

  useEffect(() => {
    setLocalName(workflowName);
  }, [workflowName]);

  useEffect(() => {
    setLocalDescription(workflowDescription || "");
  }, [workflowDescription]);

  useEffect(() => {
    setLocalTrigger(workflowTrigger);
  }, [workflowTrigger]);

  useEffect(() => {
    setLocalRuntime(workflowRuntime);
  }, [workflowRuntime]);

  useEffect(() => {
    setLocalBillingMode(workflowBillingMode);
  }, [workflowBillingMode]);

  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
    };
  }, []);

  const scheduleDebouncedUpdate = () => {
    if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
    updateTimeoutRef.current = setTimeout(() => {
      const state = localStateRef.current;
      onWorkflowUpdate?.(
        state.name,
        state.description,
        state.trigger,
        state.runtime,
        state.billingMode
      );
    }, 500);
  };

  const handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setLocalName(event.target.value);
    scheduleDebouncedUpdate();
  };

  const handleDescriptionChange = (
    event: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    setLocalDescription(event.target.value);
    scheduleDebouncedUpdate();
  };

  const handleTriggerChange = (newTrigger: WorkflowTrigger) => {
    setLocalTrigger(newTrigger);
    onTriggerChange?.(newTrigger);
  };

  const handleRuntimeChange = (newRuntime: WorkflowRuntime) => {
    setLocalRuntime(newRuntime);
    const state = localStateRef.current;
    onWorkflowUpdate?.(
      state.name,
      state.description,
      state.trigger,
      newRuntime,
      state.billingMode
    );
  };

  const handleBillingModeChange = (newBillingMode: WorkflowBillingMode) => {
    setLocalBillingMode(newBillingMode);
    const state = localStateRef.current;
    onWorkflowUpdate?.(
      state.name,
      state.description,
      state.trigger,
      state.runtime,
      newBillingMode
    );
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {t("workflow.propertiesForm.description")}
      </p>
      <div>
        <Label htmlFor="workflow-name">
          {t("workflow.propertiesForm.workflowName")}
        </Label>
        <Input
          id="workflow-name"
          value={localName}
          onChange={handleNameChange}
          placeholder={t("workflow.propertiesForm.workflowNamePlaceholder")}
          className="mt-2"
          disabled={disabled}
        />
      </div>
      <div>
        <Label htmlFor="workflow-description">
          {t("workflow.propertiesForm.workflowDescription")}
        </Label>
        <Textarea
          id="workflow-description"
          value={localDescription}
          onChange={handleDescriptionChange}
          placeholder={t("workflow.propertiesForm.workflowDescriptionPlaceholder")}
          className="mt-2"
          maxLength={256}
          rows={3}
          disabled={disabled}
        />
      </div>
      <div>
        <Label htmlFor="workflow-trigger">
          {t("workflow.propertiesForm.triggerType")}
        </Label>
        <Select
          value={localTrigger}
          onValueChange={(value) =>
            handleTriggerChange(value as WorkflowTrigger)
          }
          disabled={disabled}
        >
          <SelectTrigger id="workflow-trigger" className="mt-2">
            <SelectValue
              placeholder={t("workflow.propertiesForm.selectTrigger")}
            />
          </SelectTrigger>
          <SelectContent>
            {WORKFLOW_TRIGGERS.map((trigger) => (
              <SelectItem key={trigger} value={trigger}>
                {t(`pages.workflows.triggers.${trigger}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="workflow-runtime">
          {t("workflow.propertiesForm.executionMode")}
        </Label>
        <Select
          value={localRuntime}
          onValueChange={(value) =>
            handleRuntimeChange(value as WorkflowRuntime)
          }
          disabled={disabled}
        >
          <SelectTrigger id="workflow-runtime" className="mt-2">
            <SelectValue
              placeholder={t("workflow.propertiesForm.selectRuntime")}
            />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="workflow">
              {t("workflowScheme.runtimes.workflow.title")}
            </SelectItem>
            <SelectItem value="worker">
              {t("workflowScheme.runtimes.worker.title")}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="workflow-billing-mode">
          {t("workflow.propertiesForm.billingMode")}
        </Label>
        <Select
          value={localBillingMode}
          onValueChange={(value) =>
            handleBillingModeChange(value as WorkflowBillingMode)
          }
          disabled={disabled}
        >
          <SelectTrigger id="workflow-billing-mode" className="mt-2">
            <SelectValue
              placeholder={t("workflow.propertiesForm.selectBillingMode")}
            />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="platform">
              {t("workflow.propertiesForm.billingPlatform")}
            </SelectItem>
            <SelectItem value="upstream">
              {t("workflow.propertiesForm.billingUpstream")}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      {onToggleEnabled ? (
        <div>
          <Label htmlFor="workflow-enabled">
            {t("workflow.propertiesForm.enabled")}
          </Label>
          <div className="mt-2">
            <Switch
              id="workflow-enabled"
              checked={isEnabled}
              onCheckedChange={onToggleEnabled}
              disabled={isTogglingEnabled || disabled}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
