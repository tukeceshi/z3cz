import {
  createLibtvPlanId,
  createVideoPricePromoId,
  formatVideoPricePromoDate,
  formatVideoPricePromoFold,
  isVideoPriceCompetitorHttpUrl,
  isVideoPricePromoDate,
  isVideoPricePromoFold,
  isVideoPricePromoFoldDraft,
  LIBTV_RATE_MODEL_IDS,
  LIBTV_RATE_RESOLUTIONS,
  type LibtvComparisonConfig,
  type LibtvPlan,
  type LibtvPricePromo,
  type LibtvRateModelId,
  mergeLibtvComparisonConfig,
  normalizeVideoPricePromoFold,
  VIDEO_PRICE_PROMO_ANY_RESOLUTION,
} from "@dafthunk/types";
import Plus from "lucide-react/icons/plus";
import Trash2 from "lucide-react/icons/trash-2";
import { type ReactNode, useEffect, useState } from "react";
import { toast } from "sonner";

import { CredentialPlainInput } from "@/components/credential-secret-input";
import { InsetError } from "@/components/inset-error";
import { InsetLoading } from "@/components/inset-loading";
import { InsetLayout } from "@/components/layouts/inset-layout";
import { useTranslation } from "@/components/locale-provider";
import { useBreadcrumbsSetter } from "@/components/page-context";
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
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { TranslationKey } from "@/i18n";
import {
  addAdminVideoPriceCompetitor,
  cacheAdminHomepageVideoPrices,
  deleteAdminVideoPriceCompetitor,
  updateAdminVideoPriceCompetitor,
  useAdminVideoPriceCompetitors,
} from "@/services/competitor-video-pricing-service";
import { cn } from "@/utils/utils";

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

function CompetitorLinkFields(props: {
  readonly showUrl: boolean;
  readonly url: string;
  readonly onShowUrlChange: (next: boolean) => void;
  readonly onUrlChange: (next: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <div className="flex items-center gap-2">
        <Switch
          id="competitor_show_url"
          checked={props.showUrl}
          onCheckedChange={(checked) => props.onShowUrlChange(checked === true)}
        />
        <Label htmlFor="competitor_show_url">
          {t("competitorPricing.showUrl")}
        </Label>
      </div>
      {props.showUrl ? (
        <div className="grid max-w-xl gap-1">
          <Label htmlFor="competitor_link_url" className="text-xs">
            {t("competitorPricing.url")}
          </Label>
          <CredentialPlainInput
            id="competitor_link_url"
            name="competitor_link_url"
            value={props.url}
            onChange={(event) => props.onUrlChange(event.target.value)}
          />
        </div>
      ) : null}
    </>
  );
}

type CompetitorEditorKind = "compare" | "promoNote";

type PendingDelete =
  | { readonly kind: "competitor"; readonly id: string }
  | { readonly kind: "plan"; readonly id: string }
  | { readonly kind: "promo"; readonly id: string };

export function AdminCompetitorPricingPage() {
  const { t } = useTranslation();
  const setBreadcrumbs = useBreadcrumbsSetter();
  const {
    competitors,
    competitorsError,
    isCompetitorsLoading,
    refreshCompetitors,
  } = useAdminVideoPriceCompetitors();
  const [isCreating, setIsCreating] = useState(false);
  const [createKind, setCreateKind] = useState<CompetitorEditorKind>("compare");
  const [selectedCompetitorId, setSelectedCompetitorId] = useState<
    string | null
  >(null);
  const [competitorName, setCompetitorName] = useState("");
  const [showUrl, setShowUrl] = useState(false);
  const [competitorUrl, setCompetitorUrl] = useState("");
  const [noteText, setNoteText] = useState("");
  const [showDates, setShowDates] = useState(false);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [form, setForm] = useState<LibtvComparisonConfig | null>(null);
  const [hasQuarterPrice, setHasQuarterPrice] = useState(false);
  const [hasYearPrice, setHasYearPrice] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCaching, setIsCaching] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(
    null
  );
  const selectedCompetitor =
    competitors.find((entry) => entry.id === selectedCompetitorId) ?? null;
  const isEditorOpen = isCreating || selectedCompetitorId != null;
  const editorKind: CompetitorEditorKind = isCreating
    ? createKind
    : selectedCompetitor?.kind === "promoNote"
      ? "promoNote"
      : "compare";
  const selectedTitle = isCreating
    ? editorKind === "promoNote"
      ? t("competitorPricing.addPromoNote")
      : t("competitorPricing.add")
    : selectedCompetitor?.name || t("competitorPricing.title");

  useEffect(() => {
    if (isCreating) {
      setBreadcrumbs([
        {
          label: t("competitorPricing.title"),
          onClick: () => {
            setIsCreating(false);
            setCreateKind("compare");
            setSelectedCompetitorId(null);
          },
        },
        {
          label:
            createKind === "promoNote"
              ? t("competitorPricing.addPromoNote")
              : t("competitorPricing.add"),
        },
      ]);
    } else if (selectedCompetitor) {
      setBreadcrumbs([
        {
          label: t("competitorPricing.title"),
          onClick: () => setSelectedCompetitorId(null),
        },
        { label: selectedCompetitor.name },
      ]);
    } else {
      setBreadcrumbs([{ label: t("competitorPricing.title") }]);
    }
    return () => setBreadcrumbs([]);
  }, [createKind, isCreating, selectedCompetitor, setBreadcrumbs, t]);

  useEffect(() => {
    if (isCreating) {
      return;
    }
    if (!selectedCompetitorId) {
      setForm(null);
      setCompetitorName("");
      setShowUrl(false);
      setCompetitorUrl("");
      setNoteText("");
      setShowDates(false);
      setStartsAt("");
      setEndsAt("");
      setHasQuarterPrice(false);
      setHasYearPrice(false);
      return;
    }
    const competitor = competitors.find(
      (entry) => entry.id === selectedCompetitorId
    );
    if (!competitor) {
      return;
    }
    setCompetitorName(competitor.name);
    setShowUrl(competitor.showUrl);
    setCompetitorUrl(competitor.url);
    if (competitor.kind === "promoNote") {
      setForm(null);
      setNoteText(competitor.text);
      setShowDates(competitor.showDates);
      setStartsAt(competitor.startsAt);
      setEndsAt(competitor.endsAt);
      setHasQuarterPrice(false);
      setHasYearPrice(false);
      return;
    }
    const next = mergeLibtvComparisonConfig(competitor.config);
    setForm(next);
    setHasQuarterPrice(
      next.plans.some((plan) => plan.quarterPriceYuan != null)
    );
    setHasYearPrice(next.plans.some((plan) => plan.yearPriceYuan != null));
  }, [competitors, isCreating, selectedCompetitorId]);

  const handleBack = () => {
    setIsCreating(false);
    setCreateKind("compare");
    setSelectedCompetitorId(null);
  };

  const handleStartCreate = () => {
    setIsCreating(true);
    setCreateKind("compare");
    setSelectedCompetitorId(null);
    setCompetitorName("");
    setShowUrl(false);
    setCompetitorUrl("");
    setHasQuarterPrice(false);
    setHasYearPrice(false);
    setForm({
      series: {
        "doubao-seedance-2": {
          addReferenceSecondsToOutput: false,
          independentReferencePrice: false,
          resolutions: {},
        },
        "doubao-seedance-2-fast": {
          addReferenceSecondsToOutput: false,
          independentReferencePrice: false,
          resolutions: {},
        },
        "doubao-seedance-2-mini": {
          addReferenceSecondsToOutput: false,
          independentReferencePrice: false,
          resolutions: {},
        },
        "doubao-seedance-2-5": {
          addReferenceSecondsToOutput: true,
          independentReferencePrice: false,
          resolutions: {},
        },
      },
      plans: [],
      promos: [],
    });
  };

  const handleStartCreateNote = () => {
    const today = formatVideoPricePromoDate(new Date());
    setIsCreating(true);
    setCreateKind("promoNote");
    setSelectedCompetitorId(null);
    setCompetitorName("");
    setShowUrl(false);
    setCompetitorUrl("");
    setNoteText("");
    setShowDates(false);
    setStartsAt(today);
    setEndsAt(today);
    setForm(null);
  };

  const handleCache = async () => {
    setIsCaching(true);
    try {
      await cacheAdminHomepageVideoPrices();
      toast.success(t("competitorPricing.cacheSuccess"));
    } catch {
      toast.error(t("competitorPricing.cacheError"));
    } finally {
      setIsCaching(false);
    }
  };

  const handleDeleteCompetitor = async (competitorId: string) => {
    try {
      await deleteAdminVideoPriceCompetitor(competitorId);
      await refreshCompetitors();
      toast.success(t("competitorPricing.deleteSuccess"));
    } catch {
      toast.error(t("competitorPricing.deleteError"));
    }
  };

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = competitorName.trim();
    if (!name) {
      toast.error(t("competitorPricing.competitorNameRequired"));
      return;
    }
    if (showUrl && !isVideoPriceCompetitorHttpUrl(competitorUrl)) {
      toast.error(t("competitorPricing.urlRequired"));
      return;
    }
    const link = {
      showUrl,
      url: competitorUrl.trim(),
    };
    if (editorKind === "promoNote") {
      const text = noteText.trim();
      if (!text) {
        toast.error(t("competitorPricing.promoNoteTextRequired"));
        return;
      }
      if (
        showDates &&
        (!isVideoPricePromoDate(startsAt) || !isVideoPricePromoDate(endsAt))
      ) {
        toast.error(t("competitorPricing.promoNoteDatesRequired"));
        return;
      }
      setIsSaving(true);
      try {
        if (isCreating) {
          const created = await addAdminVideoPriceCompetitor({
            kind: "promoNote",
            name,
            ...link,
            text,
            showDates,
            startsAt,
            endsAt,
          });
          await refreshCompetitors();
          setIsCreating(false);
          setCreateKind("compare");
          setSelectedCompetitorId(created.competitor.id);
          toast.success(t("competitorPricing.saveSuccess"));
        } else if (selectedCompetitorId) {
          await updateAdminVideoPriceCompetitor({
            competitorId: selectedCompetitorId,
            name,
            ...link,
            text,
            showDates,
            startsAt,
            endsAt,
          });
          await refreshCompetitors();
          toast.success(t("competitorPricing.saveSuccess"));
        }
      } catch {
        toast.error(
          isCreating
            ? t("competitorPricing.addError")
            : t("competitorPricing.saveError")
        );
      } finally {
        setIsSaving(false);
      }
      return;
    }
    if (!form) {
      return;
    }
    if (form.plans.length === 0) {
      toast.error(t("competitorPricing.plansRequired"));
      return;
    }
    if (
      form.plans.some(
        (plan) => !plan.name.trim() || plan.credits <= 0 || plan.priceYuan <= 0
      )
    ) {
      toast.error(t("competitorPricing.planNameRequired"));
      return;
    }
    const config = {
      ...form,
      plans: form.plans.map((plan) => ({
        ...plan,
        name: plan.name.trim(),
        quarterPriceYuan: hasQuarterPrice ? plan.quarterPriceYuan : null,
        yearPriceYuan: hasYearPrice ? plan.yearPriceYuan : null,
      })),
      promos: form.promos
        .filter(
          (promo) =>
            isVideoPricePromoDate(promo.startsAt) &&
            isVideoPricePromoDate(promo.endsAt) &&
            isVideoPricePromoFold(promo.discountFold)
        )
        .map((promo) => ({
          ...promo,
          discountFold: normalizeVideoPricePromoFold(promo.discountFold),
        })),
    };
    setIsSaving(true);
    try {
      if (isCreating) {
        const created = await addAdminVideoPriceCompetitor({
          kind: "compare",
          name,
          ...link,
          config,
        });
        await refreshCompetitors();
        setIsCreating(false);
        setSelectedCompetitorId(created.competitor.id);
        toast.success(t("competitorPricing.saveSuccess"));
      } else if (selectedCompetitorId) {
        await updateAdminVideoPriceCompetitor({
          competitorId: selectedCompetitorId,
          name,
          ...link,
          config,
        });
        await refreshCompetitors();
        toast.success(t("competitorPricing.saveSuccess"));
      }
    } catch {
      toast.error(
        isCreating
          ? t("competitorPricing.addError")
          : t("competitorPricing.saveError")
      );
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
      return {
        ...current,
        plans: [
          ...current.plans,
          {
            id: createLibtvPlanId(),
            name: "",
            credits: 0,
            priceYuan: 0,
            quarterPriceYuan: null,
            yearPriceYuan: null,
          },
        ],
      };
    });
  };

  const handleRemovePlan = (id: string) => {
    setForm((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        plans: current.plans.filter((plan) => plan.id !== id),
      };
    });
  };

  const handleQuarterEnabled = (enabled: boolean) => {
    setHasQuarterPrice(enabled);
    if (enabled) {
      return;
    }
    setForm((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        plans: current.plans.map((plan) => ({
          ...plan,
          quarterPriceYuan: null,
        })),
      };
    });
  };

  const handleYearEnabled = (enabled: boolean) => {
    setHasYearPrice(enabled);
    if (enabled) {
      return;
    }
    setForm((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        plans: current.plans.map((plan) => ({
          ...plan,
          yearPriceYuan: null,
        })),
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

  const handleConfirmDelete = async () => {
    if (!pendingDelete) {
      return;
    }
    if (pendingDelete.kind === "competitor") {
      await handleDeleteCompetitor(pendingDelete.id);
      setPendingDelete(null);
      return;
    }
    if (pendingDelete.kind === "plan") {
      handleRemovePlan(pendingDelete.id);
      setPendingDelete(null);
      return;
    }
    handleRemovePromo(pendingDelete.id);
    setPendingDelete(null);
  };

  const pendingDeleteMessage =
    pendingDelete?.kind === "competitor"
      ? t("competitorPricing.deleteConfirm")
      : pendingDelete?.kind === "plan"
        ? t("competitorPricing.removePlanConfirm")
        : pendingDelete?.kind === "promo"
          ? t("competitorPricing.removePromoConfirm")
          : "";

  const deleteConfirmDialog = (
    <AlertDialog
      open={pendingDelete != null}
      onOpenChange={(open) => {
        if (!open) {
          setPendingDelete(null);
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("competitorPricing.deleteTitle")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {pendingDeleteMessage}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              void handleConfirmDelete();
            }}
          >
            {t("common.delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  const wrapPage = (content: ReactNode) => (
    <>
      {content}
      {deleteConfirmDialog}
    </>
  );

  const updateSeriesFlag = (
    modelId: LibtvRateModelId,
    field: "addReferenceSecondsToOutput" | "independentReferencePrice",
    enabled: boolean
  ) => {
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
            [field]: enabled,
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

  if (isCompetitorsLoading && !isEditorOpen) {
    return wrapPage(<InsetLoading title={t("competitorPricing.title")} />);
  }

  if (competitorsError) {
    return wrapPage(
      <InsetError
        title={t("competitorPricing.title")}
        errorMessage={competitorsError.message}
      />
    );
  }

  if (!isEditorOpen) {
    return wrapPage(
      <InsetLayout
        title={t("competitorPricing.title")}
        titleRight={
          <div className="flex items-center gap-2">
            <Button type="button" onClick={handleStartCreate}>
              {t("competitorPricing.add")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleStartCreateNote}
            >
              {t("competitorPricing.addPromoNote")}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isCaching}
              onClick={() => {
                void handleCache();
              }}
            >
              {isCaching ? t("common.saving") : t("competitorPricing.cache")}
            </Button>
          </div>
        }
      >
        <div className="max-w-5xl rounded-lg border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("common.name")}</TableHead>
                <TableHead className="text-right">
                  {t("common.actions")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {competitors.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={2}
                    className="text-center text-muted-foreground"
                  >
                    {t("competitorPricing.empty")}
                  </TableCell>
                </TableRow>
              ) : (
                competitors.map((competitor) => (
                  <TableRow key={competitor.id}>
                    <TableCell className="font-medium">
                      {competitor.name}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedCompetitorId(competitor.id)}
                        >
                          {t("common.edit")}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setPendingDelete({
                              kind: "competitor",
                              id: competitor.id,
                            });
                          }}
                        >
                          {t("common.delete")}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </InsetLayout>
    );
  }

  if (editorKind === "promoNote") {
    return wrapPage(
      <InsetLayout
        title={selectedTitle}
        titleRight={
          <Button type="button" variant="outline" onClick={handleBack}>
            {t("common.back")}
          </Button>
        }
      >
        <form
          autoComplete="off"
          className="grid max-w-5xl gap-6"
          onSubmit={(event) => {
            void handleSave(event);
          }}
        >
          <div className="grid max-w-sm gap-1">
            <Label htmlFor="competitor_name" className="text-xs">
              {t("competitorPricing.competitorName")}
            </Label>
            <CredentialPlainInput
              id="competitor_name"
              name="competitor_name"
              value={competitorName}
              onChange={(event) => setCompetitorName(event.target.value)}
            />
          </div>
          <CompetitorLinkFields
            showUrl={showUrl}
            url={competitorUrl}
            onShowUrlChange={setShowUrl}
            onUrlChange={setCompetitorUrl}
          />
          <div className="grid max-w-xl gap-1">
            <Label htmlFor="competitor_promo_note_text" className="text-xs">
              {t("competitorPricing.promoNoteText")}
            </Label>
            <Textarea
              id="competitor_promo_note_text"
              name="competitor_promo_note_text"
              autoComplete="off"
              data-1p-ignore
              data-lpignore="true"
              value={noteText}
              onChange={(event) => setNoteText(event.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="competitor_promo_note_show_dates"
              checked={showDates}
              onCheckedChange={(checked) => setShowDates(checked)}
            />
            <Label htmlFor="competitor_promo_note_show_dates">
              {t("competitorPricing.promoNoteShowDates")}
            </Label>
          </div>
          {showDates ? (
            <div className="grid max-w-sm grid-cols-2 gap-3">
              <div className="grid gap-1">
                <Label
                  htmlFor="competitor_promo_note_starts_at"
                  className="text-xs"
                >
                  {t("competitorPricing.promoStartsAt")}
                </Label>
                <Input
                  id="competitor_promo_note_starts_at"
                  name="competitor_promo_note_starts_at"
                  type="date"
                  autoComplete="off"
                  value={startsAt}
                  onChange={(event) => setStartsAt(event.target.value)}
                />
              </div>
              <div className="grid gap-1">
                <Label
                  htmlFor="competitor_promo_note_ends_at"
                  className="text-xs"
                >
                  {t("competitorPricing.promoEndsAt")}
                </Label>
                <Input
                  id="competitor_promo_note_ends_at"
                  name="competitor_promo_note_ends_at"
                  type="date"
                  autoComplete="off"
                  value={endsAt}
                  onChange={(event) => setEndsAt(event.target.value)}
                />
              </div>
            </div>
          ) : null}
          <div>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? t("common.saving") : t("common.save")}
            </Button>
          </div>
        </form>
      </InsetLayout>
    );
  }

  if (!form) {
    return wrapPage(<InsetLoading title={selectedTitle} />);
  }

  return wrapPage(
    <InsetLayout
      title={selectedTitle}
      titleRight={
        <Button type="button" variant="outline" onClick={handleBack}>
          {t("common.back")}
        </Button>
      }
    >
      <form
        autoComplete="off"
        className="grid max-w-5xl gap-6"
        onSubmit={(event) => {
          void handleSave(event);
        }}
      >
        <div className="grid max-w-sm gap-1">
          <Label htmlFor="competitor_name" className="text-xs">
            {t("competitorPricing.competitorName")}
          </Label>
          <CredentialPlainInput
            id="competitor_name"
            name="competitor_name"
            value={competitorName}
            onChange={(event) => setCompetitorName(event.target.value)}
          />
        </div>
        <CompetitorLinkFields
          showUrl={showUrl}
          url={competitorUrl}
          onShowUrlChange={setShowUrl}
          onUrlChange={setCompetitorUrl}
        />
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
            <div className="grid gap-1.5">
              <CardTitle>{t("competitorPricing.plansTitle")}</CardTitle>
              <CardDescription>
                {t("competitorPricing.plansDescription")}
              </CardDescription>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  id="competitor_plans_quarter"
                  checked={hasQuarterPrice}
                  onCheckedChange={handleQuarterEnabled}
                />
                <Label htmlFor="competitor_plans_quarter">
                  {t("competitorPricing.quarterEnabled")}
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="competitor_plans_year"
                  checked={hasYearPrice}
                  onCheckedChange={handleYearEnabled}
                />
                <Label htmlFor="competitor_plans_year">
                  {t("competitorPricing.yearEnabled")}
                </Label>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3">
            {form.plans.map((plan) => (
              <div
                key={plan.id}
                className={cn(
                  "grid gap-3 rounded-lg border p-3 sm:items-end",
                  hasQuarterPrice && hasYearPrice
                    ? "sm:grid-cols-[minmax(0,1fr)_6rem_6rem_6rem_6rem_auto]"
                    : hasQuarterPrice || hasYearPrice
                      ? "sm:grid-cols-[minmax(0,1fr)_6rem_6rem_6rem_auto]"
                      : "sm:grid-cols-[minmax(0,1fr)_6rem_6rem_auto]"
                )}
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
                  value={plan.credits > 0 ? plan.credits : null}
                  allowEmpty
                  onChange={(next) => {
                    updatePlan(plan.id, "credits", next ?? 0);
                  }}
                />
                <RateField
                  id={`competitor_plan_${plan.id}_price`}
                  label={t("competitorPricing.priceYuan")}
                  value={plan.priceYuan > 0 ? plan.priceYuan : null}
                  allowEmpty
                  onChange={(next) => {
                    updatePlan(plan.id, "priceYuan", next ?? 0);
                  }}
                />
                {hasQuarterPrice ? (
                  <RateField
                    id={`competitor_plan_${plan.id}_quarter`}
                    label={t("competitorPricing.quarterPriceYuan")}
                    value={plan.quarterPriceYuan}
                    allowEmpty
                    onChange={(next) =>
                      updatePlan(plan.id, "quarterPriceYuan", next)
                    }
                  />
                ) : null}
                {hasYearPrice ? (
                  <RateField
                    id={`competitor_plan_${plan.id}_year`}
                    label={t("competitorPricing.yearPriceYuan")}
                    value={plan.yearPriceYuan}
                    allowEmpty
                    onChange={(next) =>
                      updatePlan(plan.id, "yearPriceYuan", next)
                    }
                  />
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="justify-self-end"
                  aria-label={t("competitorPricing.removePlan")}
                  onClick={() => {
                    setPendingDelete({ kind: "plan", id: plan.id });
                  }}
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
          const showWithReference = rates.independentReferencePrice;
          return (
            <Card key={modelId}>
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
                <CardTitle>{t(MODEL_TITLE_KEYS[modelId])}</CardTitle>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      id={`competitor_series_${modelId}_add_ref`}
                      checked={rates.addReferenceSecondsToOutput}
                      onCheckedChange={(checked) =>
                        updateSeriesFlag(
                          modelId,
                          "addReferenceSecondsToOutput",
                          checked
                        )
                      }
                    />
                    <Label htmlFor={`competitor_series_${modelId}_add_ref`}>
                      {t("competitorPricing.addReferenceSeconds")}
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id={`competitor_series_${modelId}_independent_ref`}
                      checked={rates.independentReferencePrice}
                      onCheckedChange={(checked) =>
                        updateSeriesFlag(
                          modelId,
                          "independentReferencePrice",
                          checked
                        )
                      }
                    />
                    <Label
                      htmlFor={`competitor_series_${modelId}_independent_ref`}
                    >
                      {t("competitorPricing.independentReferencePrice")}
                    </Label>
                  </div>
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
                  onClick={() => {
                    setPendingDelete({ kind: "promo", id: promo.id });
                  }}
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
