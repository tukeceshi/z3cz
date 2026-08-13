import type { FormatTransformTemplate } from "@dafthunk/types";
import { useEffect, useMemo, useState } from "react";

import { useTranslation } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppToast } from "@/hooks/use-app-toast";

interface FormatTemplateApplyBarProps {
  readonly templates: readonly FormatTransformTemplate[];
  readonly excludeId?: string;
  readonly isLoading?: boolean;
  readonly resetKey?: string | boolean;
  readonly onApply: (template: FormatTransformTemplate) => void;
}

export function FormatTemplateApplyBar(props: FormatTemplateApplyBarProps) {
  const { t } = useTranslation();
  const appToast = useAppToast();
  const [sourceTemplateId, setSourceTemplateId] = useState("");

  useEffect(() => {
    setSourceTemplateId("");
  }, [props.resetKey]);

  const options = useMemo(
    () =>
      props.excludeId
        ? props.templates.filter((template) => template.id !== props.excludeId)
        : props.templates,
    [props.excludeId, props.templates]
  );

  const handleApply = () => {
    if (!sourceTemplateId.trim()) {
      appToast.error("adminApiForwarding.formatTemplateRequired");
      return;
    }

    const template = options.find((entry) => entry.id === sourceTemplateId);
    if (!template) {
      return;
    }

    props.onApply(template);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={sourceTemplateId || undefined}
        onValueChange={setSourceTemplateId}
        disabled={props.isLoading}
      >
        <SelectTrigger
          id="admin-format-template-source"
          className="h-9 w-[11rem] max-w-full sm:w-52"
        >
          <SelectValue
            placeholder={t("adminApiForwarding.formatTemplatePlaceholder")}
          />
        </SelectTrigger>
        <SelectContent>
          {options.map((template) => (
            <SelectItem key={template.id} value={template.id}>
              {template.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button type="button" variant="outline" size="sm" onClick={handleApply}>
        {t("adminApiForwarding.applyFormatTemplate")}
      </Button>
    </div>
  );
}
