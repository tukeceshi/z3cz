import { useEffect, useMemo, useState } from "react";

import { useTranslation } from "@/components/locale-provider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/utils/utils";

import type { BaseWidgetProps } from "../widget";
import { createWidget, getInputValue, useDebouncedChange } from "../widget";

interface CronExpressionWidgetProps extends BaseWidgetProps {
  value: string;
}

const PRESET_VALUES = [
  "* * * * *",
  "*/5 * * * *",
  "*/15 * * * *",
  "*/30 * * * *",
  "0 * * * *",
  "0 0 * * *",
  "0 9 * * *",
  "0 9 * * 1",
  "0 0 1 * *",
  "custom",
] as const;

function parseCronExpression(expr: string): {
  minute: string;
  hour: string;
  dayOfMonth: string;
  month: string;
  dayOfWeek: string;
} {
  const parts = expr.split(" ");
  if (parts.length !== 5) {
    return {
      minute: "*",
      hour: "*",
      dayOfMonth: "*",
      month: "*",
      dayOfWeek: "*",
    };
  }

  return {
    minute: parts[0],
    hour: parts[1],
    dayOfMonth: parts[2],
    month: parts[3],
    dayOfWeek: parts[4],
  };
}

function buildCronExpression(parts: {
  minute: string;
  hour: string;
  dayOfMonth: string;
  month: string;
  dayOfWeek: string;
}): string {
  return `${parts.minute} ${parts.hour} ${parts.dayOfMonth} ${parts.month} ${parts.dayOfWeek}`;
}

function validateCronPart(value: string): boolean {
  if (!value) return false;
  // Allow *, numbers, ranges (1-5), steps (*/5 or 0/5), and lists (1,2,3)
  return /^(\*\/[0-9]+|\*|[0-9]+(-[0-9]+)?(\/[0-9]+)?(,[0-9]+(-[0-9]+)?(\/[0-9]+)?)*)$/.test(
    value
  );
}

function CronExpressionWidget({
  value,
  onChange,
  className,
  disabled = false,
}: CronExpressionWidgetProps) {
  const { t } = useTranslation();
  const presets = useMemo(
    () => [
      { label: t("workflow.widgets.cron.everyMinute"), value: PRESET_VALUES[0] },
      { label: t("workflow.widgets.cron.every5Minutes"), value: PRESET_VALUES[1] },
      {
        label: t("workflow.widgets.cron.every15Minutes"),
        value: PRESET_VALUES[2],
      },
      {
        label: t("workflow.widgets.cron.every30Minutes"),
        value: PRESET_VALUES[3],
      },
      { label: t("workflow.widgets.cron.everyHour"), value: PRESET_VALUES[4] },
      {
        label: t("workflow.widgets.cron.everyDayMidnight"),
        value: PRESET_VALUES[5],
      },
      { label: t("workflow.widgets.cron.everyDay9am"), value: PRESET_VALUES[6] },
      {
        label: t("workflow.widgets.cron.everyMonday9am"),
        value: PRESET_VALUES[7],
      },
      {
        label: t("workflow.widgets.cron.everyFirstOfMonth"),
        value: PRESET_VALUES[8],
      },
      { label: t("workflow.widgets.cron.custom"), value: PRESET_VALUES[9] },
    ],
    [t]
  );
  const [cronParts, setCronParts] = useState(() => parseCronExpression(value));
  const [selectedPreset, setSelectedPreset] = useState<string>("");

  const { debouncedOnChange } = useDebouncedChange(onChange, 300);

  // Check if current value matches a preset
  useEffect(() => {
    const preset = presets.find((p) => p.value === value);
    if (preset && preset.value !== "custom") {
      setSelectedPreset(preset.value);
    } else {
      setSelectedPreset("custom");
    }
    setCronParts(parseCronExpression(value));
  }, [value, presets]);

  const handlePresetChange = (presetValue: string) => {
    if (presetValue === "custom") {
      setSelectedPreset("custom");
    } else {
      setSelectedPreset(presetValue);
      setCronParts(parseCronExpression(presetValue));
      onChange(presetValue);
    }
  };

  const handlePartChange = (
    field: keyof typeof cronParts,
    newValue: string
  ) => {
    const updatedParts = { ...cronParts, [field]: newValue };
    setCronParts(updatedParts);

    // Update if all parts are valid
    if (Object.values(updatedParts).every(validateCronPart)) {
      const newExpression = buildCronExpression(updatedParts);
      debouncedOnChange(newExpression);
      setSelectedPreset("custom");
    }
  };

  return (
    <div className={cn("p-2 space-y-2", className)}>
      {/* Preset selector */}
      <Select
        value={selectedPreset}
        onValueChange={handlePresetChange}
        disabled={disabled}
      >
        <SelectTrigger className="h-6 text-xs">
          <SelectValue placeholder={t("workflow.widgets.cron.choosePreset")} />
        </SelectTrigger>
        <SelectContent>
          {presets.map((preset) => (
            <SelectItem key={preset.label} value={preset.value}>
              {preset.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Custom cron builder */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground w-20 shrink-0">
            {t("workflow.widgets.cron.minute")}
          </Label>
          <Input
            value={cronParts.minute}
            onChange={(e) => handlePartChange("minute", e.target.value)}
            placeholder="*"
            className="h-6 text-xs px-1.5"
            disabled={disabled}
          />
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground w-20 shrink-0">
            {t("workflow.widgets.cron.hour")}
          </Label>
          <Input
            value={cronParts.hour}
            onChange={(e) => handlePartChange("hour", e.target.value)}
            placeholder="*"
            className="h-6 text-xs px-1.5"
            disabled={disabled}
          />
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground w-20 shrink-0">
            {t("workflow.widgets.cron.day")}
          </Label>
          <Input
            value={cronParts.dayOfMonth}
            onChange={(e) => handlePartChange("dayOfMonth", e.target.value)}
            placeholder="*"
            className="h-6 text-xs px-1.5"
            disabled={disabled}
          />
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground w-20 shrink-0">
            {t("workflow.widgets.cron.month")}
          </Label>
          <Input
            value={cronParts.month}
            onChange={(e) => handlePartChange("month", e.target.value)}
            placeholder="*"
            className="h-6 text-xs px-1.5"
            disabled={disabled}
          />
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground w-20 shrink-0">
            {t("workflow.widgets.cron.dayOfWeek")}
          </Label>
          <Input
            value={cronParts.dayOfWeek}
            onChange={(e) => handlePartChange("dayOfWeek", e.target.value)}
            placeholder="*"
            className="h-6 text-xs px-1.5"
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
}

export const cronInputWidget = createWidget({
  component: CronExpressionWidget,
  nodeTypes: ["receive-scheduled-trigger"],
  inputField: "scheduleExpression",
  extractConfig: (_nodeId, inputs) => ({
    value: getInputValue(inputs, "scheduleExpression", "0 9 * * *"),
  }),
});
