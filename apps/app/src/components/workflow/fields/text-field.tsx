import { useTranslation } from "@/components/locale-provider";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/utils/utils";

import { ClearButton } from "./clear-button";
import { FieldPlaceholder } from "./field-placeholder";
import type { FieldProps } from "./types";

export function TextField({
  className,
  clearable,
  connected,
  disabled,
  onChange,
  onClear,
  value,
  autoFocus,
}: FieldProps) {
  const { t } = useTranslation();

  // Convert to string and check for meaningful value (empty strings are considered "no value")
  const stringValue = String(value ?? "");
  const hasValue = value !== undefined && value !== "";

  // Disabled state without value - show placeholder message
  if (disabled && !hasValue) {
    return (
      <FieldPlaceholder
        className={className}
        connected={connected}
        label={t("workflow.fields.noText")}
      />
    );
  }

  // Has value or enabled - render textarea
  return (
    <div className={cn("relative", className)}>
      <Textarea
        value={stringValue}
        onChange={(e) => onChange(e.target.value || undefined)}
        placeholder={connected ? t("workflow.fields.connected") : t("workflow.fields.enterText")}
        className="resize-y rounded-md border border-neutral-300 dark:border-neutral-700"
        disabled={disabled}
        readOnly={disabled}
        autoFocus={autoFocus}
      />
      {clearable && hasValue && (
        <ClearButton
          onClick={onClear}
          label={t("workflow.fields.clearText")}
          className="absolute top-2 right-1"
          disabled={disabled}
        />
      )}
    </div>
  );
}
