import type { UpstreamParamProfileField } from "@dafthunk/types";

import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/utils/utils";

export interface AiImageParamsPopoverProps {
  readonly fields: readonly UpstreamParamProfileField[];
  readonly values: Readonly<Record<string, unknown>>;
  readonly disabled?: boolean;
  readonly triggerLabel: string;
  readonly title: string;
  readonly onChange: (next: Record<string, unknown>) => void;
}

function formatParamSummary(
  fields: readonly UpstreamParamProfileField[],
  values: Readonly<Record<string, unknown>>
): string {
  const visible = fields.filter((field) => !field.hidden).slice(0, 2);
  if (visible.length === 0) return "";
  return visible
    .map((field) => {
      const raw = values[field.name] ?? field.default;
      if (raw === undefined || raw === null || raw === "") return null;
      if (typeof raw === "boolean") return raw ? field.name : null;
      return String(raw);
    })
    .filter(Boolean)
    .join(" · ");
}

export function AiImageParamsPopover({
  fields,
  values,
  disabled = false,
  triggerLabel,
  title,
  onChange,
}: AiImageParamsPopoverProps) {
  const summary = formatParamSummary(fields, values);

  const handleFieldChange = (
    field: UpstreamParamProfileField,
    raw: string | boolean
  ) => {
    let nextValue: unknown = raw;
    if (field.type === "number") {
      nextValue = raw === "" ? undefined : Number(raw);
    } else if (field.type === "boolean") {
      nextValue = raw;
    }
    onChange({
      ...values,
      [field.name]: nextValue,
    });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "inline-flex h-9 max-w-[160px] items-center gap-1 rounded-lg border border-border/70",
            "bg-background px-2.5 text-xs text-foreground hover:bg-muted/40",
            "disabled:pointer-events-none disabled:opacity-50"
          )}
        >
          <span className="truncate">{summary || triggerLabel}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-72 space-y-3 p-3"
        onClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <p className="text-xs font-medium text-foreground">{title}</p>
        {fields
          .filter((field) => !field.hidden)
          .map((field) => {
            const current = values[field.name] ?? field.default;

            if (field.type === "boolean") {
              return (
                <div
                  key={field.name}
                  className="flex items-center justify-between gap-3"
                >
                  <Label className="text-xs text-muted-foreground">
                    {field.description || field.name}
                  </Label>
                  <Switch
                    checked={current === true}
                    onCheckedChange={(checked) =>
                      handleFieldChange(field, checked)
                    }
                    disabled={disabled}
                  />
                </div>
              );
            }

            if (field.enumValues && field.enumValues.length > 0) {
              return (
                <div key={field.name} className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    {field.description || field.name}
                  </Label>
                  <Select
                    value={
                      current === undefined || current === null
                        ? ""
                        : String(current)
                    }
                    onValueChange={(value) => handleFieldChange(field, value)}
                    disabled={disabled}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {field.enumValues.map((option) => (
                        <SelectItem key={option} value={option} className="text-xs">
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            }

            return null;
          })}
      </PopoverContent>
    </Popover>
  );
}

export function buildDefaultImageGenerationParams(
  fields: readonly UpstreamParamProfileField[]
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of fields) {
    if (field.default !== undefined) {
      out[field.name] = field.default;
    }
  }
  return out;
}

export function readAiImageGenerationParams(
  inputs: readonly { readonly id: string; readonly value?: unknown }[]
): Record<string, unknown> {
  const raw = inputs.find((input) => input.id === "params")?.value;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  return { ...(raw as Record<string, unknown>) };
}
