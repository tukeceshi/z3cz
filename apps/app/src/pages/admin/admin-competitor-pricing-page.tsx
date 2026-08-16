import type {
  LibtvComparisonConfig,
  LibtvPlanId,
  SeedanceSeries,
} from "@dafthunk/types";
import { mergeLibtvComparisonConfig } from "@dafthunk/types";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { CredentialPlainInput } from "@/components/credential-secret-input";
import { InsetError } from "@/components/inset-error";
import { InsetLoading } from "@/components/inset-loading";
import { InsetLayout } from "@/components/layouts/inset-layout";
import { useTranslation } from "@/components/locale-provider";
import { useBreadcrumbsSetter } from "@/components/page-context";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { TranslationKey } from "@/i18n";
import {
  updateAdminLibtvComparisonConfig,
  useAdminLibtvComparisonConfig,
} from "@/services/competitor-video-pricing-service";

const PLAN_LABEL_KEYS: Readonly<Record<LibtvPlanId, TranslationKey>> = {
  "standard-monthly": "competitorPricing.planStandard",
  "supreme-monthly": "competitorPricing.planSupreme",
};

function RateField(props: {
  readonly id: string;
  readonly label: string;
  readonly value: number | null;
  readonly allowEmpty?: boolean;
  readonly onChange: (next: number | null) => void;
}) {
  return (
    <div className="grid gap-1">
      <Label htmlFor={props.id} className="text-xs">
        {props.label}
      </Label>
      <CredentialPlainInput
        id={props.id}
        name={props.id}
        inputMode="decimal"
        value={props.value == null ? "" : String(props.value)}
        onChange={(event) => {
          const raw = event.target.value.trim();
          if (raw === "") {
            if (props.allowEmpty) {
              props.onChange(null);
            }
            return;
          }
          const parsed = Number(raw);
          if (Number.isFinite(parsed) && parsed > 0) {
            props.onChange(parsed);
          }
        }}
      />
    </div>
  );
}

export function AdminCompetitorPricingPage() {
  const { t } = useTranslation();
  const setBreadcrumbs = useBreadcrumbsSetter();
  const { config, configError, isConfigLoading, refreshConfig } =
    useAdminLibtvComparisonConfig();
  const [form, setForm] = useState<LibtvComparisonConfig | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setBreadcrumbs([{ label: t("competitorPricing.title") }]);
    return () => setBreadcrumbs([]);
  }, [setBreadcrumbs, t]);

  useEffect(() => {
    if (config) {
      setForm(mergeLibtvComparisonConfig(config));
    }
  }, [config]);

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form) {
      return;
    }
    setIsSaving(true);
    try {
      await updateAdminLibtvComparisonConfig(form);
      await refreshConfig();
      toast.success(t("competitorPricing.saveSuccess"));
    } catch {
      toast.error(t("competitorPricing.saveError"));
    } finally {
      setIsSaving(false);
    }
  };

  const updatePlan = (
    id: LibtvPlanId,
    field: "credits" | "priceYuan",
    value: number
  ) => {
    setForm((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        plans: current.plans.map((plan) =>
          plan.id === id ? { ...plan, [field]: value } : plan
        ),
      };
    });
  };

  const updateSeriesFlag = (series: SeedanceSeries, enabled: boolean) => {
    setForm((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        series: {
          ...current.series,
          [series]: {
            ...current.series[series],
            addReferenceSecondsToOutput: enabled,
          },
        },
      };
    });
  };

  const updateRate = (
    series: SeedanceSeries,
    resolution: string,
    field: "withoutReferencePerSec" | "withReferencePerSec",
    value: number | null
  ) => {
    setForm((current) => {
      if (!current) {
        return current;
      }
      const currentRate = current.series[series].resolutions[resolution];
      if (!currentRate) {
        return current;
      }
      return {
        ...current,
        series: {
          ...current.series,
          [series]: {
            ...current.series[series],
            resolutions: {
              ...current.series[series].resolutions,
              [resolution]: {
                ...currentRate,
                [field]: value,
              },
            },
          },
        },
      };
    });
  };

  if (isConfigLoading) {
    return <InsetLoading title={t("competitorPricing.title")} />;
  }

  if (configError) {
    return (
      <InsetError
        title={t("competitorPricing.title")}
        errorMessage={configError.message}
      />
    );
  }

  if (!form) {
    return <InsetLoading title={t("competitorPricing.title")} />;
  }

  return (
    <InsetLayout title={t("competitorPricing.title")}>
      <form
        autoComplete="off"
        className="grid max-w-4xl gap-6"
        onSubmit={(event) => {
          void handleSave(event);
        }}
      >
        <Card>
          <CardHeader>
            <CardTitle>{t("competitorPricing.plansTitle")}</CardTitle>
            <CardDescription>
              {t("competitorPricing.plansDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {form.plans.map((plan) => (
              <div key={plan.id} className="grid gap-3 rounded-lg border p-3">
                <p className="text-sm font-medium">{t(PLAN_LABEL_KEYS[plan.id])}</p>
                <RateField
                  id={`competitor_plan_${plan.id}_credits`}
                  label={t("competitorPricing.credits")}
                  value={plan.credits}
                  onChange={(next) => {
                    if (next != null) {
                      updatePlan(plan.id, "credits", next);
                    }
                  }}
                />
                <RateField
                  id={`competitor_plan_${plan.id}_price`}
                  label={t("competitorPricing.priceYuan")}
                  value={plan.priceYuan}
                  onChange={(next) => {
                    if (next != null) {
                      updatePlan(plan.id, "priceYuan", next);
                    }
                  }}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {(["2.0", "2.5"] as const).map((series) => (
          <Card key={series}>
            <CardHeader>
              <CardTitle>
                {t("competitorPricing.seriesTitle", { series })}
              </CardTitle>
              <CardDescription>
                {series === "2.5"
                  ? t("competitorPricing.series25Hint")
                  : t("competitorPricing.series20Hint")}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                <Label htmlFor={`competitor_series_${series}_add_ref`}>
                  {t("competitorPricing.addReferenceSeconds")}
                </Label>
                <Switch
                  id={`competitor_series_${series}_add_ref`}
                  checked={form.series[series].addReferenceSecondsToOutput}
                  onCheckedChange={(checked) =>
                    updateSeriesFlag(series, checked)
                  }
                />
              </div>
              {Object.keys(form.series[series].resolutions).map((resolution) => {
                const rate = form.series[series].resolutions[resolution];
                if (!rate) {
                  return null;
                }
                return (
                  <div
                    key={`${series}-${resolution}`}
                    className="grid gap-3 rounded-lg border p-3 sm:grid-cols-3"
                  >
                    <p className="text-sm font-medium sm:col-span-3">
                      {resolution.toUpperCase()}
                    </p>
                    <RateField
                      id={`competitor_${series}_${resolution}_without`}
                      label={t("competitorPricing.withoutReference")}
                      value={rate.withoutReferencePerSec}
                      onChange={(next) => {
                        if (next != null) {
                          updateRate(
                            series,
                            resolution,
                            "withoutReferencePerSec",
                            next
                          );
                        }
                      }}
                    />
                    <RateField
                      id={`competitor_${series}_${resolution}_with`}
                      label={t("competitorPricing.withReference")}
                      value={rate.withReferencePerSec}
                      allowEmpty
                      onChange={(next) =>
                        updateRate(
                          series,
                          resolution,
                          "withReferencePerSec",
                          next
                        )
                      }
                    />
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))}

        <div>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? t("common.saving") : t("common.save")}
          </Button>
        </div>
      </form>
    </InsetLayout>
  );
}
