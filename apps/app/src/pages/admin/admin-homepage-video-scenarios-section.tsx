import {
  createHomepageVideoScenarioId,
  formatHomepageVideoScenarioParamsSummary,
  type HomepageVideoScenario,
  isVideoModelParameterRules,
  isVideoPriceEstimateEnabled,
  VIDEO_RATIO_OPTIONS,
} from "@dafthunk/types";
import Pencil from "lucide-react/icons/pencil";
import Plus from "lucide-react/icons/plus";
import Trash2 from "lucide-react/icons/trash-2";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CredentialPlainInput } from "@/components/credential-secret-input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAdminPlatformAiModels } from "@/services/admin-ai-model-service";
import { updateAdminHomepageVideoScenarios } from "@/services/competitor-video-pricing-service";
import { cn } from "@/utils/utils";

const RATIO_OPTIONS = VIDEO_RATIO_OPTIONS.filter(
  (ratio) => ratio !== "adaptive"
);
const RESOLUTION_OPTIONS = ["480p", "720p", "1080p", "4k"] as const;
const LANDING_TIME_MAX_SEC = 24 * 60 * 60;
type TimeUnit = "sec" | "min";

const DURATION_INPUT_CLASS = cn(
  "h-9 w-20 rounded-md border border-input bg-background px-2 text-sm",
  "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
);

function cloneScenario(scenario: HomepageVideoScenario): HomepageVideoScenario {
  return {
    ...scenario,
    params: { ...scenario.params },
  };
}

function createEmptyScenario(sortOrder: number): HomepageVideoScenario {
  return {
    id: createHomepageVideoScenarioId(),
    name: "",
    description: "",
    sortOrder,
    params: {
      canonicalId: "doubao-seedance-2",
      ratio: "16:9",
      resolution: "720p",
      durationSec: 60,
      gachaCount: 1,
      referencedClipCount: 0,
      avgReferenceSec: 0,
    },
  };
}

function readPositiveInt(raw: string, fallback: number): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0 || !Number.isInteger(parsed)) {
    return fallback;
  }
  return parsed;
}

function clampSeconds(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function scenarioTimeUnit(durationSec: number): TimeUnit {
  return durationSec >= 60 ? "min" : "sec";
}

function secondsToInputValue(seconds: number, unit: TimeUnit): string {
  if (unit === "sec") {
    return String(Math.round(seconds));
  }
  const minutes = seconds / 60;
  if (Number.isInteger(minutes)) {
    return String(minutes);
  }
  return String(Number(minutes.toFixed(2)));
}

function parseTimeInput(raw: string, unit: TimeUnit): number | null {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return unit === "sec" ? parsed : parsed * 60;
}

function mergeScenarioIntoList(
  scenarios: readonly HomepageVideoScenario[],
  scenario: HomepageVideoScenario
): HomepageVideoScenario[] {
  const exists = scenarios.some((entry) => entry.id === scenario.id);
  const merged = exists
    ? scenarios.map((entry) => (entry.id === scenario.id ? scenario : entry))
    : [...scenarios, scenario];
  return merged.map((entry, index) => ({
    ...entry,
    sortOrder: index,
  }));
}

function ScenarioDurationControl(props: {
  readonly seconds: number;
  readonly unit: TimeUnit;
  readonly onSecondsChange: (next: number) => void;
  readonly onUnitChange: (next: TimeUnit) => void;
  readonly onDraftChange?: (draft: string | null) => void;
}) {
  const [inputDraft, setInputDraft] = useState<string | null>(null);
  const isInputFocusedRef = useRef(false);

  useEffect(() => {
    if (!isInputFocusedRef.current) {
      setInputDraft(null);
      props.onDraftChange?.(null);
    }
  }, [props.onDraftChange, props.seconds, props.unit]);

  const commitSeconds = useCallback(
    (next: number) => {
      props.onSecondsChange(
        clampSeconds(next, 1, LANDING_TIME_MAX_SEC)
      );
    },
    [props.onSecondsChange]
  );

  const displayValue =
    inputDraft ?? secondsToInputValue(props.seconds, props.unit);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        type="text"
        inputMode="decimal"
        id="homepage_scenario_duration"
        name="homepage_scenario_duration"
        value={displayValue}
        className={DURATION_INPUT_CLASS}
        autoComplete="off"
        onFocus={() => {
          isInputFocusedRef.current = true;
          const draft = secondsToInputValue(props.seconds, props.unit);
          setInputDraft(draft);
          props.onDraftChange?.(draft);
        }}
        onChange={(event) => {
          setInputDraft(event.target.value);
          props.onDraftChange?.(event.target.value);
        }}
        onBlur={(event) => {
          isInputFocusedRef.current = false;
          setInputDraft(null);
          props.onDraftChange?.(null);
          const parsed = parseTimeInput(event.target.value, props.unit);
          if (parsed != null) {
            commitSeconds(parsed);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          }
        }}
      />
      <div className="flex rounded-md border border-border/70 bg-muted/20 p-0.5">
        {(["sec", "min"] as const).map((unit) => (
          <button
            key={unit}
            type="button"
            className={cn(
              "rounded px-2 py-1 text-xs transition-colors",
              props.unit === unit
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => props.onUnitChange(unit)}
          >
            {unit === "sec" ? "秒" : "分钟"}
          </button>
        ))}
      </div>
    </div>
  );
}

interface AdminHomepageVideoScenariosSectionProps {
  readonly scenarios: readonly HomepageVideoScenario[];
  readonly onSaved: () => Promise<unknown>;
}

export function AdminHomepageVideoScenariosSection(
  props: AdminHomepageVideoScenariosSectionProps
) {
  const { models, isLoading: isModelsLoading } =
    useAdminPlatformAiModels("video");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editorDraft, setEditorDraft] = useState<HomepageVideoScenario | null>(
    null
  );
  const [durationUnit, setDurationUnit] = useState<TimeUnit>("sec");
  const [durationInputDraft, setDurationInputDraft] = useState<string | null>(
    null
  );
  const [isSaving, setIsSaving] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const priceVideoModels = useMemo(
    () =>
      models.filter(
        (model) =>
          model.platformEnabled &&
          isVideoModelParameterRules(model.parameterRules) &&
          isVideoPriceEstimateEnabled(model.parameterRules)
      ),
    [models]
  );
  const modelOptions = useMemo(() => {
    const options = priceVideoModels.map((model) => ({
      canonicalId: model.canonicalId,
      label: model.displayName,
    }));
    const selectedId = editorDraft?.params.canonicalId;
    if (
      selectedId &&
      !options.some((entry) => entry.canonicalId === selectedId)
    ) {
      options.unshift({ canonicalId: selectedId, label: selectedId });
    }
    return options;
  }, [editorDraft?.params.canonicalId, priceVideoModels]);

  const sortedScenarios = useMemo(
    () =>
      [...props.scenarios].sort((left, right) => left.sortOrder - right.sortOrder),
    [props.scenarios]
  );

  const modelLabelById = useMemo(() => {
    const labels = new Map<string, string>();
    for (const model of priceVideoModels) {
      labels.set(model.canonicalId, model.displayName);
    }
    return labels;
  }, [priceVideoModels]);

  const persistScenarios = async (
    nextScenarios: readonly HomepageVideoScenario[]
  ) => {
    if (nextScenarios.length === 0) {
      toast.error("至少保留一个场景");
      return false;
    }
    if (nextScenarios.some((entry) => !entry.name.trim())) {
      toast.error("每个场景都需要名称");
      return false;
    }
    setIsSaving(true);
    try {
      await updateAdminHomepageVideoScenarios(
        nextScenarios.map((entry, index) => ({
          ...entry,
          sortOrder: index,
        }))
      );
      await props.onSaved();
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存失败");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const openEditor = (scenario: HomepageVideoScenario) => {
    setEditingId(scenario.id);
    setEditorDraft(cloneScenario(scenario));
    setDurationUnit(scenarioTimeUnit(scenario.params.durationSec));
    setDurationInputDraft(null);
  };

  const closeEditor = () => {
    setEditingId(null);
    setEditorDraft(null);
    setDurationInputDraft(null);
  };

  const handleAdd = () => {
    const next = createEmptyScenario(sortedScenarios.length);
    setEditingId(next.id);
    setEditorDraft(next);
    setDurationUnit(scenarioTimeUnit(next.params.durationSec));
    setDurationInputDraft(null);
  };

  const resolveEditorDraft = (): HomepageVideoScenario | null => {
    if (!editorDraft) {
      return null;
    }
    if (durationInputDraft == null) {
      return editorDraft;
    }
    const parsed = parseTimeInput(durationInputDraft, durationUnit);
    if (parsed == null) {
      return editorDraft;
    }
    return {
      ...editorDraft,
      params: {
        ...editorDraft.params,
        durationSec: clampSeconds(parsed, 1, LANDING_TIME_MAX_SEC),
      },
    };
  };

  const handleEditorSave = async () => {
    const resolved = resolveEditorDraft();
    if (!resolved || !resolved.name.trim()) {
      toast.error("请填写场景名称");
      return;
    }
    const saved = await persistScenarios(
      mergeScenarioIntoList(sortedScenarios, resolved)
    );
    if (saved) {
      toast.success("场景已保存");
      closeEditor();
    }
  };

  const handleConfirmDelete = async () => {
    if (!pendingDeleteId) {
      return;
    }
    const next = sortedScenarios.filter(
      (entry) => entry.id !== pendingDeleteId
    );
    const saved = await persistScenarios(next);
    if (saved) {
      toast.success("场景已删除");
    }
    setPendingDeleteId(null);
  };

  const formatRowParamsSummary = (scenario: HomepageVideoScenario): string => {
    const modelLabel =
      modelLabelById.get(scenario.params.canonicalId) ??
      scenario.params.canonicalId;
    return `${modelLabel} · ${formatHomepageVideoScenarioParamsSummary(scenario)}`;
  };

  return (
    <>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>首页场景预设</CardTitle>
          <CardDescription>
            配置首页成本测算的场景名称、参数与说明。保存后需点击「刷新平台缓存」才会在首页生效。
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-40">名称</TableHead>
                  <TableHead className="w-64">参数</TableHead>
                  <TableHead>说明</TableHead>
                  <TableHead className="w-28 text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedScenarios.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center text-muted-foreground"
                    >
                      暂无场景
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedScenarios.map((scenario) => (
                    <TableRow key={scenario.id}>
                      <TableCell className="align-top font-medium">
                        {scenario.name}
                      </TableCell>
                      <TableCell className="align-top text-sm text-muted-foreground">
                        {formatRowParamsSummary(scenario)}
                      </TableCell>
                      <TableCell className="align-top text-sm">
                        {scenario.description}
                      </TableCell>
                      <TableCell className="align-top text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label="编辑场景"
                            disabled={isSaving}
                            onClick={() => openEditor(scenario)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label="删除场景"
                            disabled={isSaving || sortedScenarios.length <= 1}
                            onClick={() => setPendingDeleteId(scenario.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isSaving}
            onClick={handleAdd}
          >
            <Plus className="h-4 w-4" />
            添加场景
          </Button>
        </CardContent>
      </Card>

      <Dialog
        open={editingId != null && editorDraft != null}
        onOpenChange={(open) => {
          if (!open && !isSaving) {
            closeEditor();
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {sortedScenarios.some((entry) => entry.id === editingId)
                ? "编辑场景"
                : "添加场景"}
            </DialogTitle>
          </DialogHeader>
          {editorDraft ? (
            <form
              autoComplete="off"
              className="grid gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                void handleEditorSave();
              }}
            >
              <div className="grid gap-1">
                <Label htmlFor="homepage_scenario_name">名称</Label>
                <Input
                  id="homepage_scenario_name"
                  name="homepage_scenario_name"
                  autoComplete="off"
                  value={editorDraft.name}
                  onChange={(event) =>
                    setEditorDraft({ ...editorDraft, name: event.target.value })
                  }
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="homepage_scenario_description">说明</Label>
                <Textarea
                  id="homepage_scenario_description"
                  name="homepage_scenario_description"
                  autoComplete="off"
                  rows={4}
                  value={editorDraft.description}
                  onChange={(event) =>
                    setEditorDraft({
                      ...editorDraft,
                      description: event.target.value,
                    })
                  }
                />
              </div>
              <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
                <div className="grid gap-1 sm:col-span-2">
                  <Label htmlFor="homepage_scenario_model">模型</Label>
                  <select
                    id="homepage_scenario_model"
                    name="homepage_scenario_model"
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                    disabled={isModelsLoading || modelOptions.length === 0}
                    value={editorDraft.params.canonicalId}
                    onChange={(event) =>
                      setEditorDraft({
                        ...editorDraft,
                        params: {
                          ...editorDraft.params,
                          canonicalId: event.target.value,
                        },
                      })
                    }
                  >
                    {modelOptions.map((model) => (
                      <option key={model.canonicalId} value={model.canonicalId}>
                        {model.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="homepage_scenario_ratio">比例</Label>
                  <select
                    id="homepage_scenario_ratio"
                    name="homepage_scenario_ratio"
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                    value={editorDraft.params.ratio}
                    onChange={(event) =>
                      setEditorDraft({
                        ...editorDraft,
                        params: {
                          ...editorDraft.params,
                          ratio: event.target.value,
                        },
                      })
                    }
                  >
                    {RATIO_OPTIONS.map((ratio) => (
                      <option key={ratio} value={ratio}>
                        {ratio}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="homepage_scenario_resolution">分辨率</Label>
                  <select
                    id="homepage_scenario_resolution"
                    name="homepage_scenario_resolution"
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                    value={editorDraft.params.resolution}
                    onChange={(event) =>
                      setEditorDraft({
                        ...editorDraft,
                        params: {
                          ...editorDraft.params,
                          resolution: event.target.value,
                        },
                      })
                    }
                  >
                    {RESOLUTION_OPTIONS.map((resolution) => (
                      <option key={resolution} value={resolution}>
                        {resolution}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-1 sm:col-span-2">
                  <Label htmlFor="homepage_scenario_duration">时长</Label>
                  <ScenarioDurationControl
                    seconds={editorDraft.params.durationSec}
                    unit={durationUnit}
                    onDraftChange={setDurationInputDraft}
                    onSecondsChange={(next) =>
                      setEditorDraft({
                        ...editorDraft,
                        params: {
                          ...editorDraft.params,
                          durationSec: next,
                        },
                      })
                    }
                    onUnitChange={setDurationUnit}
                  />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="homepage_scenario_ref_count">带参考段数</Label>
                  <CredentialPlainInput
                    id="homepage_scenario_ref_count"
                    name="homepage_scenario_ref_count"
                    inputMode="numeric"
                    autoComplete="off"
                    value={String(editorDraft.params.referencedClipCount)}
                    onChange={(event) =>
                      setEditorDraft({
                        ...editorDraft,
                        params: {
                          ...editorDraft.params,
                          referencedClipCount: readPositiveInt(
                            event.target.value,
                            editorDraft.params.referencedClipCount
                          ),
                        },
                      })
                    }
                  />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="homepage_scenario_ref_sec">平均参考秒数</Label>
                  <CredentialPlainInput
                    id="homepage_scenario_ref_sec"
                    name="homepage_scenario_ref_sec"
                    inputMode="numeric"
                    autoComplete="off"
                    value={String(editorDraft.params.avgReferenceSec)}
                    onChange={(event) =>
                      setEditorDraft({
                        ...editorDraft,
                        params: {
                          ...editorDraft.params,
                          avgReferenceSec: readPositiveInt(
                            event.target.value,
                            editorDraft.params.avgReferenceSec
                          ),
                        },
                      })
                    }
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSaving}
                  onClick={closeEditor}
                >
                  取消
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? "保存中…" : "保存"}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={pendingDeleteId != null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDeleteId(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除场景</AlertDialogTitle>
            <AlertDialogDescription>
              删除后立即保存，且至少需保留一个场景。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={isSaving}
              onClick={() => {
                void handleConfirmDelete();
              }}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
