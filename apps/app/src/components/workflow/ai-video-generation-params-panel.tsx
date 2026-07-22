import type { UpstreamParamProfileField } from "@dafthunk/types";
import Volume2Icon from "lucide-react/icons/volume-2";

import { useTranslation } from "@/components/locale-provider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/utils/utils";

export interface AiVideoGenerationParamsPanelProps {
  readonly fields: readonly UpstreamParamProfileField[];
  readonly values: Readonly<Record<string, unknown>>;
  readonly disabled?: boolean;
  readonly triggerLabel: string;
  readonly onChange: (next: Record<string, unknown>) => void;
}

const RATIO_FIELD_NAMES = new Set(["ratio", "aspect_ratio"]);
const RESOLUTION_FIELD_NAMES = new Set(["resolution"]);
const DURATION_FIELD_NAMES = new Set(["duration"]);
const GENERATE_COUNT_FIELD_NAMES = new Set(["generate_count", "batch_count"]);

const DURATION_MIN = 4;
const DURATION_MAX = 15;

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

function formatRatioLabel(value: string): string {
  if (value === "adaptive") return "Auto";
  return value;
}

function ratioPreviewClass(value: string): string {
  switch (value) {
    case "16:9":
      return "h-3 w-5";
    case "9:16":
      return "h-5 w-3";
    case "4:3":
      return "h-3.5 w-4.5";
    case "3:4":
      return "h-4.5 w-3.5";
    case "1:1":
      return "h-4 w-4";
    case "21:9":
      return "h-2.5 w-6";
    default:
      return "h-3.5 w-4.5";
  }
}

interface SegmentedControlProps {
  readonly options: readonly string[];
  readonly value: string;
  readonly disabled?: boolean;
  readonly formatOption?: (option: string) => string;
  readonly onSelect: (option: string) => void;
}

function SegmentedControl({
  options,
  value,
  disabled = false,
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
            "flex-1 rounded-md px-2 py-1.5 text-xs transition-colors",
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

interface BooleanToggleProps {
  readonly value: boolean;
  readonly disabled?: boolean;
  readonly onChange: (next: boolean) => void;
  readonly onLabel: string;
  readonly offLabel: string;
}

function BooleanToggle({
  value,
  disabled = false,
  onChange,
  onLabel,
  offLabel,
}: BooleanToggleProps) {
  return (
    <SegmentedControl
      options={["true", "false"]}
      value={value ? "true" : "false"}
      disabled={disabled}
      formatOption={(option) => (option === "true" ? onLabel : offLabel)}
      onSelect={(option) => onChange(option === "true")}
    />
  );
}

function formatSummaryPart(
  field: UpstreamParamProfileField,
  raw: unknown,
  formatCount: (count: number) => string
): string | null {
  if (raw === undefined || raw === null || raw === "") return null;

  if (field.type === "boolean") {
    if (field.name === "generate_audio" && raw === true) {
      return "audio";
    }
    return raw === true ? field.name : null;
  }

  if (GENERATE_COUNT_FIELD_NAMES.has(field.name)) {
    const count = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(count) || count < 1) return null;
    return formatCount(count);
  }

  if (DURATION_FIELD_NAMES.has(field.name)) {
    return `${raw}s`;
  }

  if (RESOLUTION_FIELD_NAMES.has(field.name)) {
    return String(raw).toUpperCase();
  }

  return String(raw);
}

export function formatVideoGenerationParamSummary(
  fields: readonly UpstreamParamProfileField[],
  values: Readonly<Record<string, unknown>>,
  formatCount: (count: number) => string
): string {
  return fields
    .filter((field) => !field.hidden)
    .map((field) => formatSummaryPart(field, readFieldValue(field, values), formatCount))
    .filter((part): part is string => part !== null && part !== "audio")
    .join(" · ");
}

export function formatVideoGenerationParamSummaryWithAudio(
  fields: readonly UpstreamParamProfileField[],
  values: Readonly<Record<string, unknown>>,
  formatCount: (count: number) => string
): { readonly text: string; readonly showAudio: boolean } {
  const visible = fields.filter((field) => !field.hidden);
  const parts: string[] = [];
  let showAudio = false;

  for (const field of visible) {
    const raw = readFieldValue(field, values);
    if (field.type === "boolean" && field.name === "generate_audio") {
      showAudio = raw === true;
      continue;
    }
    const part = formatSummaryPart(field, raw, formatCount);
    if (part && part !== "audio") {
      parts.push(part);
    }
  }

  return { text: parts.join(" · "), showAudio };
}

export function parseVideoGenerateCount(
  params: Readonly<Record<string, unknown>>
): number {
  const raw = params.generate_count ?? params.batch_count ?? 1;
  const count = typeof raw === "number" ? raw : Number(raw);
  if (count === 2 || count === 4) return count;
  return 1;
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

interface FieldSectionProps {
  readonly field: UpstreamParamProfileField;
  readonly value: unknown;
  readonly disabled?: boolean;
  readonly onChange: (next: unknown) => void;
}

function FieldSection({ field, value, disabled = false, onChange }: FieldSectionProps) {
  const { t } = useTranslation();
  const title = field.description || field.name;

  if (RATIO_FIELD_NAMES.has(field.name) && field.enumValues?.length) {
    const selected = String(value ?? field.default ?? "");
    return (
      <div className="space-y-2">
        <Label className="text-xs font-medium text-foreground">{title}</Label>
        <div className="grid grid-cols-4 gap-1.5">
          {field.enumValues.map((option) => (
            <button
              key={option}
              type="button"
              disabled={disabled}
              className={cn(
                "flex flex-col items-center gap-1 rounded-lg border border-transparent px-1 py-2 transition-colors",
                selected === option
                  ? "border-primary/40 bg-primary/10"
                  : "hover:bg-muted/50"
              )}
              onClick={() => onChange(option)}
            >
              <div
                className={cn(
                  "rounded-sm border border-muted-foreground/40 bg-muted/40",
                  ratioPreviewClass(option)
                )}
              />
              <span className="text-[10px] text-muted-foreground">
                {formatRatioLabel(option)}
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
    field.enumValues?.length
  ) {
    const selected = String(value ?? field.default ?? "");
    return (
      <div className="space-y-2">
        <Label className="text-xs font-medium text-foreground">{title}</Label>
        <SegmentedControl
          options={field.enumValues}
          value={selected}
          disabled={disabled}
          formatOption={
            GENERATE_COUNT_FIELD_NAMES.has(field.name)
              ? (option) =>
                  t("workflow.aiVideoPanel.generateCountOption", {
                    count: Number(option),
                  })
              : (option) => option.toUpperCase()
          }
          onSelect={(option) =>
            onChange(
              field.type === "number" ? Number(option) : option
            )
          }
        />
      </div>
    );
  }

  if (DURATION_FIELD_NAMES.has(field.name)) {
    const numeric =
      typeof value === "number"
        ? value
        : Number(value ?? field.default ?? DURATION_MIN);
    const clamped = Math.min(
      DURATION_MAX,
      Math.max(DURATION_MIN, Number.isFinite(numeric) ? numeric : DURATION_MIN)
    );
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-xs font-medium text-foreground">{title}</Label>
          <span className="text-xs tabular-nums text-muted-foreground">
            {clamped}s
          </span>
        </div>
        <Slider
          min={DURATION_MIN}
          max={DURATION_MAX}
          step={1}
          value={[clamped]}
          disabled={disabled}
          onValueChange={(next) => onChange(next[0] ?? clamped)}
        />
        <Input
          type="number"
          min={DURATION_MIN}
          max={DURATION_MAX}
          step={1}
          value={clamped}
          disabled={disabled}
          className="h-8 text-xs"
          onChange={(event) => {
            const next = Number(event.target.value);
            if (!Number.isFinite(next)) return;
            onChange(Math.min(DURATION_MAX, Math.max(DURATION_MIN, next)));
          }}
        />
      </div>
    );
  }

  if (field.type === "boolean") {
    return (
      <div className="space-y-2">
        <Label className="text-xs font-medium text-foreground">{title}</Label>
        <BooleanToggle
          value={value === true}
          disabled={disabled}
          onLabel={t("workflow.aiVideoPanel.paramToggleOn")}
          offLabel={t("workflow.aiVideoPanel.paramToggleOff")}
          onChange={onChange}
        />
      </div>
    );
  }

  if (field.enumValues?.length) {
    const selected = String(value ?? field.default ?? "");
    return (
      <div className="space-y-2">
        <Label className="text-xs font-medium text-foreground">{title}</Label>
        <SegmentedControl
          options={field.enumValues}
          value={selected}
          disabled={disabled}
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

export function AiVideoGenerationParamsPanel({
  fields,
  values,
  disabled = false,
  triggerLabel,
  onChange,
}: AiVideoGenerationParamsPanelProps) {
  const { t } = useTranslation();
  const formatCount = (count: number) =>
    t("workflow.aiVideoPanel.generateCountOption", { count });
  const summary = formatVideoGenerationParamSummaryWithAudio(
    fields,
    values,
    formatCount
  );

  const handleFieldChange = (
    field: UpstreamParamProfileField,
    raw: string | number | boolean
  ) => {
    onChange({
      ...values,
      [field.name]: coerceFieldValue(field, raw),
    });
  };

  const visibleFields = fields.filter((field) => !field.hidden);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "inline-flex h-9 max-w-[220px] items-center gap-1 rounded-lg border border-border/70",
            "bg-background px-2.5 text-xs text-foreground hover:bg-muted/40",
            "disabled:pointer-events-none disabled:opacity-50"
          )}
        >
          <span className="truncate">
            {summary.text || triggerLabel}
          </span>
          {summary.showAudio ? (
            <Volume2Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        className="w-80 space-y-4 p-3"
        onClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {visibleFields.map((field) => (
          <FieldSection
            key={field.name}
            field={field}
            value={readFieldValue(field, values)}
            disabled={disabled}
            onChange={(next) => handleFieldChange(field, next as string | number | boolean)}
          />
        ))}
      </PopoverContent>
    </Popover>
  );
}
