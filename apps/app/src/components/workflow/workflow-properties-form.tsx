import { useEffect, useRef, useState } from "react";

import { useTranslation } from "@/components/locale-provider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface WorkflowPropertiesFormProps {
  workflowName?: string;
  workflowDescription?: string;
  onWorkflowUpdate?: (name: string, description?: string) => void;
  disabled?: boolean;
}

export function WorkflowPropertiesForm({
  workflowName = "",
  workflowDescription = "",
  onWorkflowUpdate,
  disabled = false,
}: WorkflowPropertiesFormProps) {
  const { t } = useTranslation();
  const [localName, setLocalName] = useState(workflowName);
  const [localDescription, setLocalDescription] = useState(workflowDescription);
  const updateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const localStateRef = useRef({
    name: localName,
    description: localDescription,
  });
  localStateRef.current = {
    name: localName,
    description: localDescription,
  };

  useEffect(() => {
    setLocalName(workflowName);
  }, [workflowName]);

  useEffect(() => {
    setLocalDescription(workflowDescription || "");
  }, [workflowDescription]);

  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
    };
  }, []);

  const scheduleDebouncedUpdate = () => {
    if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
    updateTimeoutRef.current = setTimeout(() => {
      const state = localStateRef.current;
      onWorkflowUpdate?.(state.name, state.description);
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
    </div>
  );
}
