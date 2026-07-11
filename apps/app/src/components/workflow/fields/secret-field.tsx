import { useTranslation } from "@/components/locale-provider";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSecrets } from "@/services/secrets-service";
import { cn } from "@/utils/utils";

import { ClearButton } from "./clear-button";
import type { FieldProps } from "./types";

export function SecretField({
  className,
  clearable,
  connected,
  disabled,
  onChange,
  onClear,
  value,
}: FieldProps) {
  const { t } = useTranslation();
  const { secrets, isSecretsLoading } = useSecrets();

  // Convert to string and check for meaningful value (empty strings are considered "no value")
  const stringValue = String(value ?? "");
  const hasValue = value !== undefined && value !== "";

  // Disabled state - show masked secret value
  if (disabled) {
    const maskedValue = hasValue ? "••••••••" : "";
    return (
      <div className={cn("relative", className)}>
        <Input
          type="text"
          value={maskedValue}
          readOnly
          disabled
          placeholder={connected ? t("workflow.fields.connected") : t("workflow.fields.noSecret")}
          className="rounded-md border border-neutral-300 dark:border-neutral-700"
        />
      </div>
    );
  }

  // Render select dropdown with secrets
  return (
    <div className={cn("relative", className)}>
      <Select
        value={stringValue}
        onValueChange={(val) => onChange(val || undefined)}
        disabled={isSecretsLoading}
      >
        <SelectTrigger className="rounded-md border border-neutral-300 dark:border-neutral-700">
          <SelectValue
            placeholder={
              connected
                ? t("workflow.fields.connected")
                : isSecretsLoading
                  ? t("common.loading")
                  : secrets.length === 0
                    ? t("workflow.fields.secret.empty")
                    : t("workflow.fields.secret.select")
            }
          />
        </SelectTrigger>
        <SelectContent>
          {secrets.map((secret) => (
            <SelectItem key={secret.id} value={secret.name}>
              {secret.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {/* Clear button positioned to avoid overlapping with dropdown arrow */}
      {clearable && hasValue && (
        <ClearButton
          onClick={onClear}
          label={t("workflow.fields.clearSecret")}
          className="absolute top-2 right-8"
        />
      )}
    </div>
  );
}
