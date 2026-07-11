import {
  VOLCANO_AI_MODEL_CATALOG,
  VOLCANO_TEMPLATE_ID,
  type OrganizationAiInterface,
  type VolcanoActivationProbeResult,
  type VolcanoSnapshotResponse,
} from "@dafthunk/types";
import RefreshCw from "lucide-react/icons/refresh-cw";
import Search from "lucide-react/icons/search";
import Trash2 from "lucide-react/icons/trash-2";
import { useMemo, useState } from "react";

import { useTranslation } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppToast } from "@/hooks/use-app-toast";
import {
  fetchVolcanoSnapshot,
  probeVolcanoActivation,
  updateVolcanoModelEnabled,
} from "@/services/organization-ai-interface-service";
import { isVolcanoModelActivationBlocking } from "@/utils/volcano-activation";

import { VolcanoModelRow } from "./volcano-model-row";

const PRICING_DOC_URL =
  "https://docs.volcengine.com/docs/82379/1544106?lang=zh";

interface VolcanoInterfacePanelProps {
  organizationId: string;
  iface: OrganizationAiInterface;
  onUpdated: () => Promise<void>;
  onDelete: () => void;
}

function isVolcanoInterface(iface: OrganizationAiInterface): boolean {
  return iface.templateId === VOLCANO_TEMPLATE_ID;
}

function mergeActivationIntoSnapshot(
  snapshot: VolcanoSnapshotResponse,
  results: readonly VolcanoActivationProbeResult[]
): VolcanoSnapshotResponse {
  const byId = new Map(results.map((result) => [result.canonicalId, result]));
  return {
    ...snapshot,
    models: snapshot.models.map((row) => {
      const probe = byId.get(row.canonicalId);
      if (!probe) return row;
      return {
        ...row,
        activation: {
          status: probe.status,
          probedAt: probe.probedAt,
          errorCode: probe.errorCode,
          message: probe.message,
        },
      };
    }),
  };
}

function formatBalance(amount: string): string {
  const parsed = Number(amount);
  if (!Number.isFinite(parsed)) return amount;
  return parsed.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function VolcanoInterfacePanel({
  organizationId,
  iface,
  onUpdated,
  onDelete,
}: VolcanoInterfacePanelProps) {
  const { t } = useTranslation();
  const appToast = useAppToast();
  const [snapshot, setSnapshot] = useState<VolcanoSnapshotResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isProbing, setIsProbing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const pricingByCanonicalId = useMemo(() => {
    if (!snapshot?.pricing.rows) return new Map();
    return new Map(
      snapshot.pricing.rows.map((row) => [row.canonicalId, row])
    );
  }, [snapshot?.pricing.rows]);

  if (!isVolcanoInterface(iface)) {
    return null;
  }

  const loadSnapshot = async () => {
    setIsLoading(true);
    try {
      const next = await fetchVolcanoSnapshot(organizationId, iface.id);
      setSnapshot(next);
    } catch (error) {
      appToast.errorRaw(
        error instanceof Error ? error.message : t("pages.aiInterfaces.volcano.loadFailed")
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleExpand = async () => {
    const nextExpanded = !expanded;
    setExpanded(nextExpanded);
    if (nextExpanded && !snapshot && !isLoading) {
      await loadSnapshot();
    }
  };

  const handleProbeActivation = async () => {
    setIsProbing(true);
    try {
      const { results } = await probeVolcanoActivation(organizationId, iface.id);
      if (snapshot) {
        setSnapshot(mergeActivationIntoSnapshot(snapshot, results));
      }
      await onUpdated();
      appToast.success("pages.aiInterfaces.volcano.activation.probeDone");
    } catch (error) {
      appToast.errorRaw(
        error instanceof Error
          ? error.message
          : t("pages.aiInterfaces.volcano.activation.probeFailed")
      );
    } finally {
      setIsProbing(false);
    }
  };

  const handleToggle = async (canonicalId: string, enabled: boolean) => {
    if (enabled) {
      setTogglingId(canonicalId);
      try {
        const { results } = await probeVolcanoActivation(organizationId, iface.id, [
          canonicalId,
        ]);
        const probe = results[0];
        const row = snapshot?.models.find(
          (model) => model.canonicalId === canonicalId
        );
        if (
          probe &&
          isVolcanoModelActivationBlocking({
            activation: {
              status: probe.status,
              probedAt: probe.probedAt,
              errorCode: probe.errorCode,
              message: probe.message,
            },
            package: row?.package ?? null,
            canonicalId,
          })
        ) {
          appToast.error("pages.aiInterfaces.volcano.activation.blockedEnable");
          if (snapshot) {
            setSnapshot(mergeActivationIntoSnapshot(snapshot, results));
          }
          return;
        }
      } catch (error) {
        appToast.errorRaw(
          error instanceof Error
            ? error.message
            : t("pages.aiInterfaces.volcano.activation.probeFailed")
        );
        return;
      } finally {
        setTogglingId(null);
      }
    }

    setTogglingId(canonicalId);
    try {
      await updateVolcanoModelEnabled(organizationId, iface.id, {
        [canonicalId]: enabled,
      });
      await onUpdated();
      if (snapshot) {
        setSnapshot({
          ...snapshot,
          models: snapshot.models.map((row) =>
            row.canonicalId === canonicalId ? { ...row, enabled } : row
          ),
        });
      }
    } catch {
      appToast.error("pages.aiInterfaces.volcano.toggleFailed");
    } finally {
      setTogglingId(null);
    }
  };

  const rows =
    snapshot?.models ??
    VOLCANO_AI_MODEL_CATALOG.map((entry) => ({
      canonicalId: entry.canonicalId,
      alias: entry.alias,
      modality: entry.modality,
      providerModelId: entry.providerModelId,
      enabled: true,
      usage: null,
      activation: null,
      package: null,
    }));

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate font-medium" title={iface.name}>
            {iface.name}
          </p>
          {snapshot ? (
            <div className="space-y-0.5">
              {snapshot.balance ? (
                <>
                  <p className="text-lg font-semibold tabular-nums tracking-tight">
                    ¥ {formatBalance(snapshot.balance.available)}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {t("pages.aiInterfaces.volcano.accountBalance")}
                  </p>
                </>
              ) : (
                <p className="text-muted-foreground text-sm">
                  {t("pages.aiInterfaces.volcano.balanceUnavailable")}
                </p>
              )}
              {snapshot.balanceError ? (
                <p className="text-destructive text-xs">{snapshot.balanceError}</p>
              ) : null}
            </div>
          ) : null}
          <p className="text-muted-foreground text-sm">
            {t("pages.aiInterfaces.volcano.billingOverageHint")}
          </p>
          <p className="text-muted-foreground text-sm">
            {t("pages.aiInterfaces.volcano.resourcePackHint")}{" "}
            <a
              href={PRICING_DOC_URL}
              target="_blank"
              rel="noreferrer"
              className="text-primary underline-offset-4 hover:underline"
            >
              {t("pages.aiInterfaces.volcano.pricingDoc")}
            </a>
          </p>
          {!expanded ? (
            <p className="text-muted-foreground text-xs">
              {t("pages.aiInterfaces.volcano.expandHint")}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleExpand}>
            {expanded
              ? t("pages.aiInterfaces.volcano.collapse")
              : t("pages.aiInterfaces.volcano.expand")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onDelete}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="mr-2 size-4" />
            {t("pages.aiInterfaces.deleteButton")}
          </Button>
          {expanded ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleProbeActivation}
                disabled={isProbing}
              >
                <Search
                  className={`mr-2 size-4 ${isProbing ? "animate-pulse" : ""}`}
                />
                {t("pages.aiInterfaces.volcano.activation.probeButton")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={loadSnapshot}
                disabled={isLoading}
              >
                <RefreshCw
                  className={`mr-2 size-4 ${isLoading ? "animate-spin" : ""}`}
                />
                {t("pages.aiInterfaces.volcano.refresh")}
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {expanded ? (
        <div className="space-y-3">
          {isLoading && !snapshot ? (
            <div className="columns-1 gap-3 md:columns-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="mb-3 h-28 w-full rounded-lg" />
              ))}
            </div>
          ) : (
            <>
              {snapshot?.usageError ? (
                <p className="text-destructive text-sm">{snapshot.usageError}</p>
              ) : null}

              <div className="columns-1 gap-3 md:columns-2">
                {rows.map((row) => (
                  <div key={row.canonicalId} className="mb-3 break-inside-avoid">
                    <VolcanoModelRow
                      row={row}
                      showUsage={Boolean(snapshot)}
                      disabled={togglingId === row.canonicalId}
                      pricingRow={pricingByCanonicalId.get(row.canonicalId) ?? null}
                      pricingDocUrl={
                        snapshot?.pricing.docUrl ?? PRICING_DOC_URL
                      }
                      onEnabledChange={(enabled) =>
                        handleToggle(row.canonicalId, enabled)
                      }
                    />
                  </div>
                ))}
              </div>

              {snapshot?.fetchedAt ? (
                <p className="text-muted-foreground text-xs">
                  {t("pages.aiInterfaces.volcano.updatedAt", {
                    time: new Date(snapshot.fetchedAt).toLocaleString(),
                  })}
                </p>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
