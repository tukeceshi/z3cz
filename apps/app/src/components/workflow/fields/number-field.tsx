import { useEffect, useState } from "react";

import { useTranslation } from "@/components/locale-provider";
import { Input } from "@/components/ui/input";
import { cn } from "@/utils/utils";

import { ClearButton } from "./clear-button";
import { FieldPlaceholder } from "./field-placeholder";
import type { FieldProps } from "./types";

/**
 * Check whether a string is an intermediate numeric input that the user
 * is still actively typing (e.g. "-", "3.", "3.0").
 */
function isIncompleteNumber(s: string): boolean {
  return s === "-" || s === "." || s === "-." || s.endsWith(".");
}

export function NumberField({
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

  const hasValue = value !== undefined && value !== "";

  // Local string state so intermediate values like "3." aren't destroyed
  const [localValue, setLocalValue] = useState(String(value ?? ""));

  // Sync from parent when the external value changes (e.g. undo, clear)
  // Only update if the external value actually differs from what localValue represents
  useEffect(() => {
    const parsedLocal = parseFloat(localValue);
    if (value !== parsedLocal && !(value === undefined && localValue === "")) {
      setLocalValue(String(value ?? ""));
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;

    // Allow clearing the field
    if (raw === "") {
      setLocalValue("");
      onChange("");
      return;
    }

    // Only accept characters that can form a valid number
    if (!/^-?\d*\.?\d*$/.test(raw)) return;

    setLocalValue(raw);

    // Only propagate when the string is a complete, parseable number
    if (!isIncompleteNumber(raw)) {
      const num = parseFloat(raw);
      if (!isNaN(num)) {
        onChange(num);
      }
    }
  };

  // Commit on blur — normalize trailing dots, etc.
  const handleBlur = () => {
    if (localValue === "" || localValue === "-" || localValue === ".") return;
    const num = parseFloat(localValue);
    if (!isNaN(num)) {
      setLocalValue(String(num));
      onChange(num);
    }
  };

  // Disabled state without value - show placeholder message
  if (disabled && !hasValue) {
    return (
      <FieldPlaceholder
        className={className}
        connected={connected}
        label={t("workflow.fields.noNumber")}
      />
    );
  }

  // Has value or enabled - render input
  return (
    <div className={cn("relative", className)}>
      <Input
        type="text"
        inputMode="decimal"
        value={localValue}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={connected ? t("workflow.fields.connected") : t("workflow.fields.enterNumber")}
        disabled={disabled}
        className="rounded-md border border-neutral-300 dark:border-neutral-700"
        autoFocus={autoFocus}
      />
      {clearable && hasValue && (
        <ClearButton
          onClick={onClear}
          label={t("workflow.fields.clearNumber")}
          className="absolute top-2 right-1"
          disabled={disabled}
        />
      )}
    </div>
  );
}
