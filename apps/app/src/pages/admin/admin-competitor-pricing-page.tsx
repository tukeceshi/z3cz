import {
  createLibtvPlanId,
  createVideoPricePromoId,
  formatVideoPricePromoDate,
  formatVideoPricePromoFold,
  isVideoPricePromoDate,
  isVideoPricePromoFold,
  isVideoPricePromoFoldDraft,
  normalizeVideoPricePromoFold,
  LIBTV_RATE_MODEL_IDS,
  LIBTV_RATE_RESOLUTIONS,
  VIDEO_PRICE_PROMO_ANY_RESOLUTION,
  type LibtvComparisonConfig,
  type LibtvPlan,
  type LibtvPricePromo,
  type LibtvRateModelId,
  mergeLibtvComparisonConfig,
} from "@dafthunk/types";
import Plus from "lucide-react/icons/plus";
import Trash2 from "lucide-react/icons/trash-2";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { CredentialPlainInput } from "@/components/credential-secret-input";
import { InsetError } from "@/components/inset-error";
import { InsetLoading } from "@/components/inset-loading";
import { InsetLayout } from "@/components/layouts/inset-layout";
import { useTranslation } from "@/components/locale-provider";
import { useBreadcrumbsSetter } from "@/components/page-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

function FoldField(props: {
  readonly id: string;
  readonly label: string;
  readonly value: number;
  readonly onChange: (next: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <div className="grid gap-1">
      <Label htmlFor={props.id} className="text-xs">
        {props.label}
      </Label>
      <CredentialPlainInput
        id={props.id}
        name={props.id}
        inputMode="decimal"
        value={draft ?? formatVideoPricePromoFold(props.value)}
        onFocus={() => {
          setDraft(formatVideoPricePromoFold(props.value));
        }}
        onChange={(event) => {
          const raw = event.target.value.trim();
          if (!isVideoPricePromoFoldDraft(raw)) {
            return;
          }
          setDraft(raw);
          if (raw === "" || raw.endsWith(".")) {
            return;
          }
          const parsed = Number(raw);
          if (Number.isFinite(parsed) && parsed > 0 && parsed <= 10) {
            props.onChange(normalizeVideoPricePromoFold(parsed));
          }
        }}
        onBlur={() => {
          setDraft(null);
        }}
      />
    </div>
  );
}

const MODEL_TITLE_KEYS: Readonly<Record<LibtvRateModelId, TranslationKey>> = {
  "doubao-seedance-2": "competitorPricing.modelSeedance2",
  "doubao-seedance-2-fast": "competitorPricing.modelSeedance2Fast",
  "doubao-seedance-2-mini": "competitorPricing.modelSeedance2Mini",
  "doubao-seedance-2-5": "competitorPricing.modelSeedance25",
};

function resolutionLabel(resolution: string): string {
  return resolution === "4k" ? "4K" : resolution.toUpperCase();
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
    if (form.plans.some((plan) => !plan.name.trim())) {
      toast.error(t("competitorPricing.planNameRequired"));
      return;
    }
    setIsSaving(true);
    try {
      await updateAdminLibtvComparisonConfig({
        ...form,
        plans: form.plans.map((plan) => ({
          ...plan,
          name: plan.name.trim(),
        })),
        promos: form.promos.filter(
          (promo) =>
            isVideoPricePromoDate(promo.startsAt) &&
            isVideoPricePromoDate(promo.endsAt) &&
            isVideoPricePromoFold(promo.discountFold)
        ).map((promo) => ({
          ...promo,
          discountFold: normalizeVideoPricePromoFold(promo.discountFold),
        })),
      });
      await refreshConfig();
      toast.success(t("competitorPricing.saveSuccess"));
    } catch {
      toast.error(t("competitorPricing.saveError"));
    } finally {
      setIsSaving(false);
    }
  };

  const updatePlan = <K extends keyof LibtvPlan>(
    id: string,
    field: K,
    value: LibtvPlan[K]
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

  const handleAddPlan = () => {
    setForm((current) => {
      if (!current) {
        return current;
      }
      const last = current.plans[current.plans.length - 1];
      return {
        ...current,
        plans: [
          ...current.plans,
          {
            id: createLibtvPlanId(),
            name: "",
            credits: last?.credits ?? 1500,
            priceYuan: last?.priceYuan ?? 59,
          },
        ],
      };
    });
  };

  const handleRemovePlan = (id: string) => {
    setForm((current) => {
      if (!current || current.plans.length <= 1) {
        return current;
      }
      return {
        ...current,
        plans: current.plans.filter((plan) => plan.id !== id),
      };
    });
  };

  const updatePromo = <K extends keyof LibtvPricePromo>(
    id: string,
    field: K,
    value: LibtvPricePromo[K]
  ) => {
    setForm((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        promos: current.promos.map((promo) =>
          promo.id === id ? { ...promo, [field]: value } : promo
        ),
      };
    });
  };

  const handleAddPromo = () => {
    const today = formatVideoPricePromoDate(new Date());
    setForm((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        promos: [
          ...current.promos,
          {
            id: createVideoPricePromoId(),
            canonicalId: "doubao-seedance-2",
            resolution: "720p",
            withReference: false,
            startsAt: today,
            endsAt: today,
            discountFold: 8,
          },
        ],
      };
    });
  };

  const handleRemovePromo = (id: string) => {
    setForm((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        promos: current.promos.filter((promo) => promo.id !== id),
      };
    });
  };

  const updateSeriesFlag = (modelId: LibtvRateModelId, enabled: boolean) => {
    setForm((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        series: {
          ...current.series,
          [modelId]: {
            ...current.series[modelId],
            addReferenceSecondsToOutput: enabled,
          },
        },
      };
    });
  };

  const updateRate = (
    modelId: LibtvRateModelId,
    resolution: string,
    field: "withoutReferencePerSec" | "withReferencePerSec",
    value: number | null
  ) => {
    setForm((current) => {
      if (!current) {
        return current;
      }
      const currentRates = current.series[modelId];
      const currentRate = currentRates.resolutions[resolution];
      if (field === "withoutReferencePerSec" && value == null) {
        const rest = { ...currentRates.resolutions };
        delete rest[resolution];
        return {
          ...current,
          series: {
            ...current.series,
            [modelId]: {
              ...currentRates,
              resolutions: rest,
            },
          },
        };
      }
      if (!currentRate && (value == null || field === "withReferencePerSec")) {
        return current;
      }
      const nextWithout =
        field === "withoutReferencePerSec"
          ? value
          : currentRate?.withoutReferencePerSec;
      if (nextWithout == null) {
        return current;
      }
      return {
        ...current,
        series: {
          ...current.series,
          [modelId]: {
            ...currentRates,
            resolutions: {
              ...currentRates.resolutions,
              [resolution]: {
                withoutReferencePerSec: nextWithout,
                withReferencePerSec:
                  field === "withReferencePerSec"
                    ? value
                    : (currentRate?.withReferencePerSec ?? null),
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
        className="grid max-w-5xl gap-6"
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
          <CardContent className="grid gap-3">
            {form.plans.map((plan) => (
              <div
                key={plan.id}
                className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[minmax(0,1fr)_7rem_7rem_auto] sm:items-end"
              >
                <div className="grid gap-1">
                  <Label
                    htmlFor={`competitor_plan_${plan.id}_name`}
                    className="text-xs"
                  >
                    {t("competitorPricing.planName")}
                  </Label>
                  <CredentialPlainInput
                    id={`competitor_plan_${plan.id}_name`}
                    name={`competitor_plan_${plan.id}_name`}
                    value={plan.name}
                    onChange={(event) =>
                      updatePlan(plan.id, "name", event.target.value)
                    }
                  />
                </div>
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
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="justify-self-end"
                  disabled={form.plans.length <= 1}
                  aria-label={t("competitorPricing.removePlan")}
                  onClick={() => handleRemovePlan(plan.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddPlan}
              >
                <Plus className="h-4 w-4" />
                {t("competitorPricing.addPlan")}
              </Button>
            </div>
          </CardContent>
        </Card>

        {LIBTV_RATE_MODEL_IDS.map((modelId) => {
          const rates = form.series[modelId];
          const showWithReference = !rates.addReferenceSecondsToOutput;
          return (
            <Card key={modelId}>
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
                <CardTitle>{t(MODEL_TITLE_KEYS[modelId])}</CardTitle>
                <div className="flex items-center gap-2">
                  <Label htmlFor={`competitor_series_${modelId}_add_ref`}>
                    {t("competitorPricing.addReferenceSeconds")}
                  </Label>
                  <Switch
                    id={`competitor_series_${modelId}_add_ref`}
                    checked={rates.addReferenceSecondsToOutput}
                    onCheckedChange={(checked) =>
                      updateSeriesFlag(modelId, checked)
                    }
                  />
                </div>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid gap-2">
                  <p className="text-xs font-medium">
                    {t("competitorPricing.withoutReference")}
                  </p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {LIBTV_RATE_RESOLUTIONS.map((resolution) => {
                      const rate = rates.resolutions[resolution];
                      return (
                        <RateField
                          key={`${modelId}-${resolution}-without`}
                          id={`competitor_${modelId}_${resolution}_without`}
                          label={resolutionLabel(resolution)}
                          value={rate?.withoutReferencePerSec ?? null}
                          allowEmpty
                          onChange={(next) =>
                            updateRate(
                              modelId,
                              resolution,
                              "withoutReferencePerSec",
                              next
                            )
                          }
                        />
                      );
                    })}
                  </div>
                </div>
                {showWithReference ? (
                  <div className="grid gap-2">
                    <p className="text-xs font-medium">
                      {t("competitorPricing.withReference")}
                    </p>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {LIBTV_RATE_RESOLUTIONS.map((resolution) => {
                        const rate = rates.resolutions[resolution];
                        return (
                          <RateField
                            key={`${modelId}-${resolution}-with`}
                            id={`competitor_${modelId}_${resolution}_with`}
                            label={resolutionLabel(resolution)}
                            value={rate?.withReferencePerSec ?? null}
                            allowEmpty
                            onChange={(next) =>
                              updateRate(
                                modelId,
                                resolution,
                                "withReferencePerSec",
                                next
                              )
                            }
                          />
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          );
        })}

        <Card>
          <CardHeader>
            <CardTitle>{t("competitorPricing.promosTitle")}</CardTitle>
            <CardDescription>
              {t("competitorPricing.promosDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {form.promos.map((promo) => (
              <div
                key={promo.id}
                className="grid gap-3 rounded-lg border p-3 lg:grid-cols-[minmax(0,1fr)_6rem_auto_7rem_7rem_4.5rem_auto] lg:items-end"
              >
                <div className="grid gap-1">
                  <Label
                    htmlFor={`competitor_promo_${promo.id}_model`}
                    className="text-xs"
                  >
                    {t("competitorPricing.promoModel")}
                  </Label>
                  <select
                    id={`competitor_promo_${promo.id}_model`}
                    name={`competitor_promo_${promo.id}_model`}
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                    value={promo.canonicalId}
                    onChange={(event) =>
                      updatePromo(promo.id, "canonicalId", event.target.value)
                    }
                  >
                    {LIBTV_RATE_MODEL_IDS.map((modelId) => (
                      <option key={modelId} value={modelId}>
                        {t(MODEL_TITLE_KEYS[modelId])}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-1">
                  <Label
                    htmlFor={`competitor_promo_${promo.id}_resolution`}
                    className="text-xs"
                  >
                    {t("competitorPricing.promoResolution")}
                  </Label>
                  <select
                    id={`competitor_promo_${promo.id}_resolution`}
                    name={`competitor_promo_${promo.id}_resolution`}
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                    value={promo.resolution}
                    onChange={(event) =>
                      updatePromo(promo.id, "resolution", event.target.value)
                    }
                  >
                    <option value={VIDEO_PRICE_PROMO_ANY_RESOLUTION}>
                      {t("competitorPricing.promoAnyResolution")}
                    </option>
                    {LIBTV_RATE_RESOLUTIONS.map((resolution) => (
                      <option key={resolution} value={resolution}>
                        {resolutionLabel(resolution)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex h-9 items-center gap-2 lg:mb-0.5">
                  <Switch
                    id={`competitor_promo_${promo.id}_with_ref`}
                    checked={promo.withReference}
                    onCheckedChange={(checked) =>
                      updatePromo(promo.id, "withReference", checked)
                    }
                  />
                  <Label htmlFor={`competitor_promo_${promo.id}_with_ref`}>
                    {t("competitorPricing.promoWithReference")}
                  </Label>
                </div>
                <div className="grid gap-1">
                  <Label
                    htmlFor={`competitor_promo_${promo.id}_starts_at`}
                    className="text-xs"
                  >
                    {t("competitorPricing.promoStartsAt")}
                  </Label>
                  <Input
                    id={`competitor_promo_${promo.id}_starts_at`}
                    name={`competitor_promo_${promo.id}_starts_at`}
                    type="date"
                    autoComplete="off"
                    value={promo.startsAt}
                    onChange={(event) =>
                      updatePromo(promo.id, "startsAt", event.target.value)
                    }
                  />
                </div>
                <div className="grid gap-1">
                  <Label
                    htmlFor={`competitor_promo_${promo.id}_ends_at`}
                    className="text-xs"
                  >
                    {t("competitorPricing.promoEndsAt")}
                  </Label>
                  <Input
                    id={`competitor_promo_${promo.id}_ends_at`}
                    name={`competitor_promo_${promo.id}_ends_at`}
                    type="date"
                    autoComplete="off"
                    value={promo.endsAt}
                    onChange={(event) =>
                      updatePromo(promo.id, "endsAt", event.target.value)
                    }
                  />
                </div>
                <FoldField
                  id={`competitor_promo_${promo.id}_fold`}
                  label={t("competitorPricing.promoFold")}
                  value={promo.discountFold}
                  onChange={(next) => {
                    updatePromo(promo.id, "discountFold", next);
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="justify-self-end"
                  aria-label={t("competitorPricing.removePromo")}
                  onClick={() => handleRemovePromo(promo.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddPromo}
              >
                <Plus className="h-4 w-4" />
                {t("competitorPricing.addPromo")}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? t("common.saving") : t("common.save")}
          </Button>
        </div>
      </form>
    </InsetLayout>
  );
}
