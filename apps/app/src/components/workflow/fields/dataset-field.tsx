import { useTranslation } from "@/components/locale-provider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/utils/utils";

import type { FieldProps } from "./types";

/** Dataset storage was removed; field renders read-only placeholder. */
export function DatasetField({
  className,
  connected,
  disabled,
  onChange,
  value,
}: FieldProps) {
  const { t } = useTranslation();
  const stringValue = String(value ?? "");

  return (
    <div className={cn("relative", className)}>
      <Select
        value={stringValue || undefined}
        onValueChange={(val) => onChange(val || undefined)}
        disabled={disabled || true}
      >
        <SelectTrigger>
          <SelectValue
            placeholder={
              connected
                ? t("workflow.fields.connected")
                : stringValue || t("workflow.fields.dataset.none")
            }
          />
        </SelectTrigger>
        <SelectContent />
      </Select>
    </div>
  );
}
