import {
  applyAiImageRatioToPrompt as applyAiImageRatioToPromptFromTypes,
  formatImageGenerationOptionLabel,
  mergeImageGenerationParams,
  resolveGenerateCountOptions,
  resolveImageGenerateCount,
  sanitizeImageGenerationParams,
  type UpstreamParamProfileField,
} from "@dafthunk/types";

import { useTranslation } from "@/components/locale-provider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { LIST_SCROLL_CLASS } from "@/components/list-scroll";
import { cn } from "@/utils/utils";

import { AI_BOTTOM_CHIP_CLASS } from "./ai-bottom-chip";

export { applyAiImageRatioToPromptFromTypes as applyAiImageRatioToPrompt };
export { mergeImageGenerationParams, resolveImageGenerateCount, sanitizeImageGenerationParams } from "@dafthunk/types";

export interface AiImageParamsPopoverProps {
  readonly fields: readonly UpstreamParamProfileField[];
  readonly values: Readonly<Record<string, unknown>>;
  readonly disabled?: boolean;
  readonly triggerLabel: string;
  readonly title: string;
  readonly onChange: (next: Record<string, unknown>) => void;
}

export const RATIO_FIELD_NAMES = new Set(["ratio", "aspect_ratio"]);
export const RESOLUTION_FIELD_NAMES = new Set(["resolution", "size"]);

const GENERATE_COUNT_FIELD_NAMES = new Set(["generate_count", "batch_count"]);
const WATERMARK_FIELD_NAMES = new Set(["watermark"]);

const TAIL_FIELD_NAMES = new Set([
  "watermark",
  "output_format",
  "web_search",
  "output_compression",
  "moderation",
]);

const TAIL_FIELD_ORDER = [
  "watermark",
  "output_format",
  "web_search",
  "output_compression",
  "moderation",
] as const;

function partitionVisibleFields(
  fields: readonly UpstreamParamProfileField[]
): {
  readonly mainFields: readonly UpstreamParamProfileField[];
  readonly tailFields: readonly UpstreamParamProfileField[];
} {
  const visible = fields.filter((field) => !field.hidden);
  const tailByName = new Map(
    visible
      .filter((field) => TAIL_FIELD_NAMES.has(field.name))
      .map((field) => [field.name, field] as const)
  );
  const tailFields = TAIL_FIELD_ORDER.flatMap((name) => {
    const field = tailByName.get(name);
    return field ? [field] : [];
  });
  const mainFields = visible.filter((field) => !TAIL_FIELD_NAMES.has(field.name));
  return { mainFields, tailFields };
}

function readFieldValue(
  field: UpstreamParamProfileField,
  values: Readonly<Record<string, unknown>>
): unknown {
  const current = values[field.name];
  if (current !== undefined && current !== null && current !== "") {
    return current;
  }
  return field.default;
}

function formatRatioLabel(value: string, smartLabel: string): string {
  return formatImageGenerationOptionLabel("ratio", value, smartLabel);
}

function formatResolutionLabel(
  value: string,
  smartLabel: string,
  sizeLabels: Readonly<Record<string, string>>
): string {
  const smart = formatImageGenerationOptionLabel("size", value, smartLabel);
  if (smart !== value) {
    return smart;
  }
  return sizeLabels[value.toUpperCase()] ?? value.toUpperCase();
}

function ratioFrameClass(value: string): string {
  switch (value) {
    case "21:9":
      return "h-2 w-5";
    case "16:9":
      return "h-2.5 w-4.5";
    case "3:2":
      return "h-2.5 w-4";
    case "4:3":
      return "h-3 w-4";
    case "1:1":
      return "h-3.5 w-3.5";
    case "3:4":
      return "h-4 w-3";
    case "2:3":
      return "h-4 w-2.5";
    case "9:16":
      return "h-4.5 w-2.5";
    default:
      return "h-3.5 w-3.5";
  }
}

interface RatioPreviewIconProps {
  readonly value: string;
}

function RatioPreviewIcon({ value }: RatioPreviewIconProps) {
  if (value === "auto" || value === "adaptive") {
    return (
      <span className="relative h-3.5 w-3.5 text-foreground">
        <span className="absolute inset-0 rounded-[2px] border border-current" />
        <span className="absolute right-0 top-0 h-1.5 w-1.5 rounded-[1px] border border-current bg-popover" />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "rounded-[2px] border border-current text-foreground",
        ratioFrameClass(value)
      )}
    />
  );
}

function formatOptimizePromptLabel(
  option: string,
  smartLabel: string,
  labels: Readonly<{
    readonly standard: string;
    readonly fast: string;
  }>
): string {
  return formatImageGenerationOptionLabel("optimize_prompt_mode", option, smartLabel, {
    optimizePromptStandard: labels.standard,
    optimizePromptFast: labels.fast,
  });
}

function formatParamSummary(
  fields: readonly UpstreamParamProfileField[],
  values: Readonly<Record<string, unknown>>,
  formatCount: (count: number) => string,
  smartLabel: string,
  sizeLabels: Readonly<Record<string, string>>,
  optimizePromptLabels: Readonly<{
    readonly standard: string;
    readonly fast: string;
  }>
): string {
  return fields
    .filter((field) => !field.hidden)
    .map((field) => {
      const raw = readFieldValue(field, values);
      if (raw === undefined || raw === null || raw === "") return null;
      if (typeof raw === "boolean") return raw ? field.name : null;
      if (GENERATE_COUNT_FIELD_NAMES.has(field.name)) {
        const count = typeof raw === "number" ? raw : Number(raw);
        if (!Number.isFinite(count) || count < 1) return null;
        return formatCount(count);
      }
      if (RATIO_FIELD_NAMES.has(field.name)) {
        return formatRatioLabel(String(raw), smartLabel);
      }
      if (RESOLUTION_FIELD_NAMES.has(field.name)) {
        return formatResolutionLabel(String(raw), smartLabel, sizeLabels);
      }
      if (field.name === "optimize_prompt_mode") {
        return formatOptimizePromptLabel(String(raw), smartLabel, optimizePromptLabels);
      }
      return String(raw);
    })
    .filter(Boolean)
    .slice(0, 3)
    .join(" · ");
}

function coerceFieldValue(
  field: UpstreamParamProfileField,
  raw: string | number | boolean
): unknown {
  if (field.type === "number") {
    if (typeof raw === "boolean") return raw ? 1 : 0;
    return raw === "" ? undefined : Number(raw);
  }
  if (field.type === "boolean") {
    return raw;
  }
  return raw;
}

interface SegmentedControlProps {
  readonly options: readonly string[];
  readonly value: string;
  readonly disabled?: boolean;
  readonly compact?: boolean;
  readonly formatOption?: (option: string) => string;
  readonly onSelect: (option: string) => void;
}

function SegmentedControl({
  options,
  value,
  disabled = false,
  compact = false,
  formatOption,
  onSelect,
}: SegmentedControlProps) {
  return (
    <div className="flex rounded-lg border border-border/70 bg-muted/20 p-0.5">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          disabled={disabled}
          className={cn(
            "flex-1 rounded-md transition-colors",
            compact ? "px-1 py-1 text-[10px]" : "px-2 py-1.5 text-xs",
            value === option
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => onSelect(option)}
        >
          {formatOption ? formatOption(option) : option}
        </button>
      ))}
    </div>
  );
}

interface FieldSectionProps {
  readonly field: UpstreamParamProfileField;
  readonly value: unknown;
  readonly disabled?: boolean;
  readonly sizeLabels: Readonly<Record<string, string>>;
  readonly smartLabel: string;
  readonly onChange: (next: unknown) => void;
}

function FieldSection({
  field,
  value,
  disabled = false,
  sizeLabels,
  smartLabel,
  onChange,
}: FieldSectionProps) {
  const { t } = useTranslation();
  const title = field.description || field.name;

  if (RATIO_FIELD_NAMES.has(field.name) && field.enumValues?.length) {
    const rawSelected = String(value ?? field.default ?? "");
    const selected = field.enumValues.includes(rawSelected)
      ? rawSelected
      : String(field.default ?? field.enumValues[0] ?? "auto");
    return (
      <div className="space-y-2">
        <Label className="text-xs font-medium text-foreground">{title}</Label>
        <div className="flex gap-0.5 rounded-lg border border-border/70 bg-muted/20 p-0.5">
          {field.enumValues.map((option) => (
            <button
              key={option}
              type="button"
              disabled={disabled}
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center gap-1 rounded-md px-0.5 py-1.5 transition-colors",
                selected === option
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => onChange(option)}
            >
              <RatioPreviewIcon value={option} />
              <span className="w-full truncate text-center text-[10px] leading-none">
                {formatRatioLabel(option, smartLabel)}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (
    (RESOLUTION_FIELD_NAMES.has(field.name) ||
      GENERATE_COUNT_FIELD_NAMES.has(field.name)) &&
    (field.enumValues?.length || GENERATE_COUNT_FIELD_NAMES.has(field.name))
  ) {
    const options = GENERATE_COUNT_FIELD_NAMES.has(field.name)
      ? resolveGenerateCountOptions(field)
      : (field.enumValues ?? []);
    if (options.length === 0) {
      return null;
    }
    const rawSelected = String(value ?? field.default ?? "");
    const selected = options.includes(rawSelected)
      ? rawSelected
      : String(field.default ?? options[0] ?? "");
    return (
      <div className="space-y-2">
        <Label className="text-xs font-medium text-foreground">{title}</Label>
        <SegmentedControl
          options={options}
          value={selected}
          disabled={disabled}
          formatOption={
            GENERATE_COUNT_FIELD_NAMES.has(field.name)
              ? (option) =>
                  t("workflow.aiVideoPanel.generateCountOption", {
                    count: Number(option),
                  })
              : (option) =>
                  formatResolutionLabel(option, smartLabel, sizeLabels)
          }
          onSelect={(option) =>
            onChange(field.type === "number" ? Number(option) : option)
          }
        />
      </div>
    );
  }

  if (WATERMARK_FIELD_NAMES.has(field.name) || field.type === "boolean") {
    const checked = value === true;
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-3">
          <Label className="text-xs font-medium text-foreground">{title}</Label>
          <Switch
            checked={checked}
            disabled={disabled}
            onCheckedChange={onChange}
          />
        </div>
        {WATERMARK_FIELD_NAMES.has(field.name) ? (
          <p className="text-[11px] leading-4 text-muted-foreground">
            {t("workflow.aiImagePanel.watermarkHint")}
          </p>
        ) : null}
      </div>
    );
  }

  if (field.enumValues?.length) {
    const selected = String(value ?? field.default ?? "");
    const formatOption =
      field.name === "optimize_prompt_mode"
        ? (option: string) =>
            formatOptimizePromptLabel(option, smartLabel, {
              standard: t("workflow.aiImagePanel.optimizePromptStandard"),
              fast: t("workflow.aiImagePanel.optimizePromptFast"),
            })
        : undefined;
    return (
      <div className="space-y-2">
        <Label className="text-xs font-medium text-foreground">{title}</Label>
        <SegmentedControl
          options={field.enumValues}
          value={selected}
          disabled={disabled}
          formatOption={formatOption}
          onSelect={(option) => onChange(option)}
        />
      </div>
    );
  }

  if (field.type === "number") {
    return (
      <div className="space-y-2">
        <Label className="text-xs font-medium text-foreground">{title}</Label>
        <Input
          type="number"
          value={value === undefined || value === null ? "" : String(value)}
          disabled={disabled}
          className="h-8 text-xs"
          onChange={(event) => {
            const next = event.target.value;
            onChange(next === "" ? undefined : Number(next));
          }}
        />
      </div>
    );
  }

  return null;
}

const BOOLEAN_SEGMENT_OPTIONS = ["false", "true"] as const;

const PLAIN_NUMBER_INPUT_CLASS = cn(
  "h-7 text-xs",
  "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
);

function formatTailOptionLabel(
  field: UpstreamParamProfileField,
  option: string,
  smartLabel: string
): string {
  if (option === "auto" || option === "adaptive") {
    return smartLabel;
  }
  if (field.name === "output_format") {
    return option.toUpperCase();
  }
  return option;
}

interface TailFieldSectionProps {
  readonly field: UpstreamParamProfileField;
  readonly value: unknown;
  readonly disabled?: boolean;
  readonly smartLabel: string;
  readonly onChange: (next: unknown) => void;
}

function TailFieldSection({
  field,
  value,
  disabled = false,
  smartLabel,
  onChange,
}: TailFieldSectionProps) {
  const { t } = useTranslation();
  const title = field.description || field.name;

  if (field.type === "boolean") {
    const selected = value === true ? "true" : "false";
    return (
      <div className="space-y-1.5">
        <Label className="text-[11px] font-medium leading-none text-foreground">
          {title}
        </Label>
        <SegmentedControl
          compact
          options={BOOLEAN_SEGMENT_OPTIONS}
          value={selected}
          disabled={disabled}
          formatOption={(option) =>
            option === "true"
              ? t("workflow.aiImagePanel.optionOn")
              : t("workflow.aiImagePanel.optionOff")
          }
          onSelect={(option) => onChange(option === "true")}
        />
      </div>
    );
  }

  if (field.enumValues?.length) {
    const rawSelected = String(value ?? field.default ?? "");
    const selected = field.enumValues.includes(rawSelected)
      ? rawSelected
      : String(field.default ?? field.enumValues[0] ?? "");
    return (
      <div className="space-y-1.5">
        <Label className="text-[11px] font-medium leading-none text-foreground">
          {title}
        </Label>
        <SegmentedControl
          compact
          options={field.enumValues}
          value={selected}
          disabled={disabled}
          formatOption={(option) => formatTailOptionLabel(field, option, smartLabel)}
          onSelect={(option) => onChange(option)}
        />
      </div>
    );
  }

  if (field.type === "number") {
    return (
      <div className="space-y-1.5">
        <Label className="text-[11px] font-medium leading-none text-foreground">
          {title}
        </Label>
        <Input
          type="number"
          min={field.name === "output_compression" ? 0 : undefined}
          max={field.name === "output_compression" ? 100 : undefined}
          value={value === undefined || value === null ? "" : String(value)}
          disabled={disabled}
          className={PLAIN_NUMBER_INPUT_CLASS}
          onChange={(event) => {
            const next = event.target.value;
            onChange(next === "" ? undefined : Number(next));
          }}
        />
      </div>
    );
  }

  return null;
}

export function AiImageParamsPopover({
  fields,
  values,
  disabled = false,
  triggerLabel,
  title: _title,
  onChange,
}: AiImageParamsPopoverProps) {
  const { t } = useTranslation();
  const smartLabel = t("workflow.aiImagePanel.smartOption");
  const sizeLabels = {
    "1K": t("workflow.aiImagePanel.sizeLabel1K"),
    "2K": t("workflow.aiImagePanel.sizeLabel2K"),
    "4K": t("workflow.aiImagePanel.sizeLabel4K"),
  } as const;
  const optimizePromptLabels = {
    standard: t("workflow.aiImagePanel.optimizePromptStandard"),
    fast: t("workflow.aiImagePanel.optimizePromptFast"),
  } as const;
  const formatCount = (count: number) =>
    t("workflow.aiVideoPanel.generateCountOption", { count });
  const summary = formatParamSummary(
    fields,
    values,
    formatCount,
    smartLabel,
    sizeLabels,
    optimizePromptLabels
  );
  const { mainFields, tailFields } = partitionVisibleFields(fields);

  const handleFieldChange = (
    field: UpstreamParamProfileField,
    raw: string | number | boolean
  ) => {
    onChange({
      ...values,
      [field.name]: coerceFieldValue(field, raw),
    });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={AI_BOTTOM_CHIP_CLASS}
        >
          <span className="truncate">{summary || triggerLabel}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        className={cn(
          "w-[22.5rem] space-y-4 p-3 pr-2 dark:border-neutral-700 dark:bg-neutral-800",
          "max-h-[min(70vh,28rem)]",
          LIST_SCROLL_CLASS
        )}
        onClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {mainFields.map((field) => (
          <FieldSection
            key={field.name}
            field={field}
            value={readFieldValue(field, values)}
            disabled={disabled}
            sizeLabels={sizeLabels}
            smartLabel={smartLabel}
            onChange={(next) =>
              handleFieldChange(
                field,
                next as string | number | boolean
              )
            }
          />
        ))}
        {tailFields.length > 0 ? (
          <div className="grid grid-cols-3 gap-2">
            {tailFields.map((field) => (
              <TailFieldSection
                key={field.name}
                field={field}
                value={readFieldValue(field, values)}
                disabled={disabled}
                smartLabel={smartLabel}
                onChange={(next) =>
                  handleFieldChange(
                    field,
                    next as string | number | boolean
                  )
                }
              />
            ))}
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

export function buildDefaultImageGenerationParams(
  fields: readonly UpstreamParamProfileField[]
): Record<string, unknown> {
  return sanitizeImageGenerationParams(fields);
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
