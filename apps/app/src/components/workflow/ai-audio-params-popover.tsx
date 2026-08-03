import type { UpstreamParamProfileField } from "@dafthunk/types";

import { useTranslation } from "@/components/locale-provider";
import { Input } from "@/components/ui/input";
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
import { Slider } from "@/components/ui/slider";

import { AI_BOTTOM_CHIP_CLASS } from "./ai-bottom-chip";

export interface AiAudioParamsPopoverProps {
  readonly fields: readonly UpstreamParamProfileField[];
  readonly values: Readonly<Record<string, unknown>>;
  readonly disabled?: boolean;
  readonly triggerLabel: string;
  readonly title: string;
  readonly onChange: (next: Record<string, unknown>) => void;
}

const SPEED_FIELD_NAMES = new Set(["speed"]);
const VOL_FIELD_NAMES = new Set(["vol"]);
const PITCH_FIELD_NAMES = new Set(["pitch"]);
const EMOTION_FIELD_NAMES = new Set(["emotion"]);

const SPEED_MIN = 0.5;
const SPEED_MAX = 2;
const VOL_MIN = 0;
const VOL_MAX = 10;
const PITCH_MIN = -12;
const PITCH_MAX = 12;

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

function formatSummaryPart(
  field: UpstreamParamProfileField,
  raw: unknown
): string | null {
  if (raw === undefined || raw === null || raw === "") return null;
  if (SPEED_FIELD_NAMES.has(field.name)) return `${raw}x`;
  if (VOL_FIELD_NAMES.has(field.name)) return `vol ${raw}`;
  if (PITCH_FIELD_NAMES.has(field.name)) return `pitch ${raw}`;
  return String(raw);
}

function formatParamSummary(
  fields: readonly UpstreamParamProfileField[],
  values: Readonly<Record<string, unknown>>
): string {
  return fields
    .filter((field) => !field.hidden)
    .map((field) => formatSummaryPart(field, readFieldValue(field, values)))
    .filter((part): part is string => part !== null)
    .slice(0, 3)
    .join(" · ");
}

function coerceFieldValue(
  field: UpstreamParamProfileField,
  raw: string | number
): unknown {
  if (field.type === "number") {
    return raw === "" ? undefined : Number(raw);
  }
  return raw;
}

interface SliderFieldProps {
  readonly field: UpstreamParamProfileField;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly disabled?: boolean;
  readonly formatValue: (value: number) => string;
  readonly onChange: (next: number) => void;
}

function SliderFieldSection({
  field,
  value,
  min,
  max,
  step,
  disabled = false,
  formatValue,
  onChange,
}: SliderFieldProps) {
  const title = field.description || field.name;
  const clamped = Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs font-medium text-foreground">{title}</Label>
        <span className="text-xs tabular-nums text-muted-foreground">
          {formatValue(clamped)}
        </span>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[clamped]}
        disabled={disabled}
        onValueChange={(next) => onChange(next[0] ?? clamped)}
      />
      <Input
        type="number"
        min={min}
        max={max}
        step={step}
        value={clamped}
        disabled={disabled}
        className="h-8 text-xs"
        onChange={(event) => {
          const next = Number(event.target.value);
          if (!Number.isFinite(next)) return;
          onChange(Math.min(max, Math.max(min, next)));
        }}
      />
    </div>
  );
}

export function buildDefaultAudioGenerationParams(
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

export function readAiAudioGenerationParams(
  inputs: readonly { readonly id: string; readonly value?: unknown }[]
): Record<string, unknown> {
  const raw = inputs.find((input) => input.id === "params")?.value;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  return { ...(raw as Record<string, unknown>) };
}

export function AiAudioParamsPopover({
  fields,
  values,
  disabled = false,
  triggerLabel,
  title,
  onChange,
}: AiAudioParamsPopoverProps) {
  const { t } = useTranslation();
  const summary = formatParamSummary(fields, values);
  const visibleFields = fields.filter((field) => !field.hidden);

  const handleFieldChange = (
    field: UpstreamParamProfileField,
    raw: string | number
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
        className="w-72 space-y-4 p-3"
        onClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <p className="text-xs font-medium text-foreground">{title}</p>
        {visibleFields.map((field) => {
          const current = readFieldValue(field, values);

          if (SPEED_FIELD_NAMES.has(field.name)) {
            const numeric =
              typeof current === "number"
                ? current
                : Number(current ?? field.default ?? 1);
            return (
              <SliderFieldSection
                key={field.name}
                field={field}
                value={numeric}
                min={SPEED_MIN}
                max={SPEED_MAX}
                step={0.1}
                disabled={disabled}
                formatValue={(value) => `${value}x`}
                onChange={(next) => handleFieldChange(field, next)}
              />
            );
          }

          if (VOL_FIELD_NAMES.has(field.name)) {
            const numeric =
              typeof current === "number"
                ? current
                : Number(current ?? field.default ?? 1);
            return (
              <SliderFieldSection
                key={field.name}
                field={field}
                value={numeric}
                min={VOL_MIN}
                max={VOL_MAX}
                step={0.1}
                disabled={disabled}
                formatValue={(value) => String(value)}
                onChange={(next) => handleFieldChange(field, next)}
              />
            );
          }

          if (PITCH_FIELD_NAMES.has(field.name)) {
            const numeric =
              typeof current === "number"
                ? current
                : Number(current ?? field.default ?? 0);
            return (
              <SliderFieldSection
                key={field.name}
                field={field}
                value={numeric}
                min={PITCH_MIN}
                max={PITCH_MAX}
                step={1}
                disabled={disabled}
                formatValue={(value) => String(value)}
                onChange={(next) => handleFieldChange(field, next)}
              />
            );
          }

          if (
            EMOTION_FIELD_NAMES.has(field.name) &&
            field.enumValues &&
            field.enumValues.length > 0
          ) {
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
                    <SelectValue
                      placeholder={t("workflow.aiAudioPanel.selectEmotion")}
                    />
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
