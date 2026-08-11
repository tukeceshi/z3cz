import {

  buildVolcanoSnapshotFromMetadata,

  canClientTriggerRealPackageRefresh,

  hasVolcanoPackageListCache,

  isVolcanoAiInterfaceProvider,

  readPackageListCache,

  resolveVolcanoInterfaceDisplayName,

  shouldAutoRefreshPackageListOnExpand,

  defaultVolcanoTosRegionForLocale,

  type OrganizationAiInterface,

  type VolcanoActivationProbeResult,

  type VolcanoInterfaceMetadata,

  type VolcanoSnapshotResponse,

  type VolcanoTosServiceStatus,

} from "@dafthunk/types";

import RefreshCw from "lucide-react/icons/refresh-cw";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";



import { useTranslation } from "@/components/locale-provider";

import { Button } from "@/components/ui/button";

import { Skeleton } from "@/components/ui/skeleton";

import { useAppToast } from "@/hooks/use-app-toast";

import {

  fetchVolcanoSnapshot,

  listVolcanoTosBuckets,

  probeVolcanoActivation,

  updateVolcanoModelEnabled,
  updateVolcanoModelAlias,
  VOLCANO_ARK_NOT_OPENED_CODE,

} from "@/services/organization-ai-interface-service";

import { ApiRequestError } from "@/services/utils";
import { useVolcanoAggregateCatalog } from "@/services/platform-ai-model-service";

import {
  getVolcanoEffectiveActivationStatus,
  isVolcanoModelActivationBlocking,
} from "@/utils/volcano-activation";



import { VolcanoModelRow } from "./volcano-model-row";

import {
  countNotOpenModelsFromMetadata,
  isTosStorageEnabled,
} from "./volcano-panel-utils";

import { VolcanoStorageRow } from "./volcano-storage-row";

import { VolcanoPanelSetupBanners } from "./volcano-setup-banners";
import { InterfaceCardShell, AggregateChannelBadge } from "./interface-card-shell";



const CREDENTIALS_DECRYPT_FAILED = "CREDENTIALS_DECRYPT_FAILED";

const PRICING_DOC_URL =

  "https://docs.volcengine.com/docs/82379/1544106?lang=zh";

const REFRESH_BUTTON_MIN_ANIMATION_MS = 900;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}



interface VolcanoInterfacePanelProps {

  organizationId: string;

  iface: OrganizationAiInterface;

  onUpdated: () => Promise<void>;

  onDelete: () => void;

}



function isVolcanoInterface(iface: OrganizationAiInterface): boolean {

  return isVolcanoAiInterfaceProvider(iface.provider);

}



function readVolcanoPackageListCache(iface: OrganizationAiInterface) {

  const metadata = iface.metadata;

  if (

    !metadata ||

    typeof metadata !== "object" ||

    !("credentialMode" in metadata) ||

    metadata.credentialMode !== "volcengine_iam"

  ) {

    return null;

  }

  return readPackageListCache(metadata as VolcanoInterfaceMetadata);

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



function snapshotNeedsActivationProbe(snapshot: VolcanoSnapshotResponse): boolean {

  return snapshot.models.some(

    (row) => !row.activation || row.activation.status === "unknown"

  );

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

  const { t, locale } = useTranslation();

  const appToast = useAppToast();
  const { catalog: aggregateCatalog } = useVolcanoAggregateCatalog(organizationId);

  const [snapshot, setSnapshot] = useState<VolcanoSnapshotResponse | null>(null);

  const [isLoading, setIsLoading] = useState(false);

  const [isRefreshAnimating, setIsRefreshAnimating] = useState(false);

  const [expanded, setExpanded] = useState(false);

  const [arkNotOpened, setArkNotOpened] = useState(false);

  const [tosServiceStatus, setTosServiceStatus] =
    useState<VolcanoTosServiceStatus | null>(null);

  const [isProbingTos, setIsProbingTos] = useState(false);

  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [aliasSavingId, setAliasSavingId] = useState<string | null>(null);

  const loadInFlightRef = useRef(false);

  const lastRealPackageRefreshAtRef = useRef<number | null>(null);

  const tosProbeInFlightRef = useRef(false);

  const tosProbedForIfaceRef = useRef<string | null>(null);



  const skipTosHints = isTosStorageEnabled(iface, snapshot);



  const pricingByCanonicalId = useMemo(() => {

    if (!snapshot?.pricing.rows) return new Map();

    return new Map(

      snapshot.pricing.rows.map((row) => [row.canonicalId, row])

    );

  }, [snapshot?.pricing.rows]);



  const notOpenModelCount = useMemo(() => {
    if (snapshot) {
      return snapshot.models.filter((row) => {
        const status = getVolcanoEffectiveActivationStatus(row);
        return status === "not_open" || status === "service_not_open";
      }).length;
    }
    return countNotOpenModelsFromMetadata(iface);
  }, [iface, snapshot]);



  const probeTosService = useCallback(
    async (
      region: string,
      snapshotForCheck: VolcanoSnapshotResponse | null = null
    ) => {
      if (isTosStorageEnabled(iface, snapshotForCheck)) {
        return;
      }
      if (tosProbeInFlightRef.current) {
        return;
      }
      tosProbeInFlightRef.current = true;
      setIsProbingTos(true);
      try {
        const result = await listVolcanoTosBuckets(
          organizationId,
          iface.id,
          region
        );
        setTosServiceStatus(result.status);
        tosProbedForIfaceRef.current = iface.id;
      } catch {
        setTosServiceStatus("transient_error");
      } finally {
        setIsProbingTos(false);
        tosProbeInFlightRef.current = false;
      }
    },
    [iface, organizationId]
  );



  const loadSnapshot = useCallback(

    async (options?: {
      readonly refreshTos?: boolean;
      readonly refreshPackages?: boolean;
      readonly showRefreshLimitedToast?: boolean;
    }) => {

      if (loadInFlightRef.current) {

        return;

      }

      loadInFlightRef.current = true;

      setIsLoading(true);

      setArkNotOpened(false);

      try {

        const response = await fetchVolcanoSnapshot(organizationId, iface.id, {

          refreshPackages: options?.refreshPackages === true,

        });

        let syncParent = false;

        if (response.refreshLimited) {

          if (options?.showRefreshLimitedToast) {

            toast(t("pages.aiInterfaces.volcano.refreshTooFrequent"));

          }

          const local = buildVolcanoSnapshotFromMetadata(iface, aggregateCatalog);

          if (local) {

            setSnapshot((previous) => {

              if (previous?.balance && !local.balance) {

                return {

                  ...local,

                  balance: previous.balance,

                  balanceError: previous.balanceError,

                };

              }

              return local;

            });

          }

          return;

        }

        syncParent = true;

        let merged = response.snapshot;

        if (snapshotNeedsActivationProbe(response.snapshot)) {

          try {

            const { results } = await probeVolcanoActivation(

              organizationId,

              iface.id

            );

            merged = mergeActivationIntoSnapshot(response.snapshot, results);

            syncParent = true;

          } catch (probeError) {

            if (

              probeError instanceof ApiRequestError &&

              probeError.code === VOLCANO_ARK_NOT_OPENED_CODE

            ) {

              setArkNotOpened(true);

            } else {

              throw probeError;

            }

          }

        }

        setSnapshot(merged);

        if (syncParent) {

          await onUpdated();

        }

        const shouldProbeTos =

          options?.refreshTos !== false &&

          !isTosStorageEnabled(iface, merged) &&

          (options?.refreshTos === true ||

            tosProbedForIfaceRef.current !== iface.id);

        if (shouldProbeTos) {

          const tosRegion =

            merged.tosStorage?.region ||

            defaultVolcanoTosRegionForLocale(locale);

          await probeTosService(tosRegion, merged);

        }

      } catch (error) {

        if (

          error instanceof ApiRequestError &&

          error.code === CREDENTIALS_DECRYPT_FAILED

        ) {

          appToast.error("pages.aiInterfaces.volcano.credentialsDecryptFailed");

          return;

        }

        if (

          error instanceof ApiRequestError &&

          error.code === VOLCANO_ARK_NOT_OPENED_CODE

        ) {

          setArkNotOpened(true);

          setExpanded(true);

          return;

        }

        appToast.errorRaw(

          error instanceof Error

            ? error.message

            : t("pages.aiInterfaces.volcano.loadFailed")

        );

      } finally {

        setIsLoading(false);

        loadInFlightRef.current = false;

      }

    },

    [aggregateCatalog, appToast, iface, locale, onUpdated, organizationId, probeTosService, t]

  );



  useEffect(() => {

    if (!expanded || loadInFlightRef.current) {

      return;

    }

    if (!hasVolcanoPackageListCache(iface)) {

      return;

    }

    const local = buildVolcanoSnapshotFromMetadata(iface, aggregateCatalog);

    if (!local) {

      return;

    }

    setSnapshot((previous) => {

      if (previous?.balance && !local.balance) {

        return {

          ...local,

          balance: previous.balance,

          balanceError: previous.balanceError,

        };

      }

      return local;

    });

  }, [aggregateCatalog, expanded, iface]);



  useEffect(() => {
    tosProbedForIfaceRef.current = null;
    lastRealPackageRefreshAtRef.current = null;
    setTosServiceStatus(null);
    setSnapshot(null);
    setExpanded(false);
    setArkNotOpened(false);
  }, [iface.id]);

  useEffect(() => {
    if (skipTosHints) {
      setTosServiceStatus(null);
      setIsProbingTos(false);
      tosProbedForIfaceRef.current = iface.id;
      return;
    }
    if (tosProbedForIfaceRef.current === iface.id) {
      return;
    }
    const region = defaultVolcanoTosRegionForLocale(locale);
    void probeTosService(region);
  }, [iface.id, locale, probeTosService, skipTosHints]);



  const handleRetryTosProbe = useCallback(async () => {
    const region =
      snapshot?.tosStorage?.region || defaultVolcanoTosRegionForLocale(locale);
    await probeTosService(region, snapshot);
  }, [locale, probeTosService, snapshot]);



  const enabledModelChips = useMemo(() => {
    const source = snapshot ?? buildVolcanoSnapshotFromMetadata(iface, aggregateCatalog);
    if (!source) {
      return [];
    }
    return source.models
      .filter((row) => row.enabled)
      .map((row) => ({
        canonicalId: row.canonicalId,
        alias: row.alias,
        modality: row.modality,
      }));
  }, [aggregateCatalog, iface, snapshot]);

  const panelBannerProps = {
    arkNotOpened,
    notOpenModelCount,
    tosServiceStatus,
    isProbingTos,
    skipTosHints,
    onRetryTos: skipTosHints ? undefined : () => void handleRetryTosProbe(),
  };



  if (!isVolcanoInterface(iface)) {

    return null;

  }



  const handleExpand = async () => {

    const nextExpanded = !expanded;

    setExpanded(nextExpanded);

    if (!nextExpanded) {

      return;

    }

    if (hasVolcanoPackageListCache(iface)) {

      const cache = readVolcanoPackageListCache(iface);

      if (

        cache &&

        shouldAutoRefreshPackageListOnExpand(cache) &&

        !loadInFlightRef.current &&

        canClientTriggerRealPackageRefresh(lastRealPackageRefreshAtRef.current)

      ) {

        lastRealPackageRefreshAtRef.current = Date.now();

        await loadSnapshot({ refreshTos: false, refreshPackages: true });

        return;

      }

      const local = buildVolcanoSnapshotFromMetadata(iface, aggregateCatalog);

      if (local) {

        setSnapshot((previous) => {

          if (previous?.balance && !local.balance) {

            return {

              ...local,

              balance: previous.balance,

              balanceError: previous.balanceError,

            };

          }

          return local;

        });

        if (

          !isTosStorageEnabled(iface, local) &&

          tosProbedForIfaceRef.current !== iface.id

        ) {

          const tosRegion =

            local.tosStorage?.region ||

            defaultVolcanoTosRegionForLocale(locale);

          await probeTosService(tosRegion, local);

        }

        return;

      }

    }

    if (!snapshot && !loadInFlightRef.current) {

      if (canClientTriggerRealPackageRefresh(lastRealPackageRefreshAtRef.current)) {

        lastRealPackageRefreshAtRef.current = Date.now();

        await loadSnapshot({ refreshTos: false, refreshPackages: true });

      }

    }

  };



  const handleRefresh = async () => {

    setIsRefreshAnimating(true);

    const startedAt = Date.now();

    try {

      if (!canClientTriggerRealPackageRefresh(lastRealPackageRefreshAtRef.current)) {

        return;

      }

      lastRealPackageRefreshAtRef.current = Date.now();

      await loadSnapshot({

        refreshTos: true,

        refreshPackages: true,

        showRefreshLimitedToast: true,

      });

    } finally {

      const elapsed = Date.now() - startedAt;

      const remaining = REFRESH_BUTTON_MIN_ANIMATION_MS - elapsed;

      if (remaining > 0) {

        await delay(remaining);

      }

      setIsRefreshAnimating(false);

    }

  };



  const handleToggle = async (canonicalId: string, enabled: boolean) => {
    const row = snapshot?.models.find(
      (model) => model.canonicalId === canonicalId
    );

    if (enabled && row) {
      if (isVolcanoModelActivationBlocking(row)) {
        return;
      }

      const alreadyOpen = getVolcanoEffectiveActivationStatus(row) === "open";
      if (!alreadyOpen) {
        setTogglingId(canonicalId);
        try {
          const { results } = await probeVolcanoActivation(
            organizationId,
            iface.id,
            [canonicalId]
          );
          const probe = results[0];

          if (
            probe &&
            isVolcanoModelActivationBlocking({
              activation: {
                status: probe.status,
                probedAt: probe.probedAt,
                errorCode: probe.errorCode,
                message: probe.message,
              },
              package: row.package ?? null,
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
          if (
            error instanceof ApiRequestError &&
            error.code === CREDENTIALS_DECRYPT_FAILED
          ) {
            appToast.error("pages.aiInterfaces.volcano.credentialsDecryptFailed");
            return;
          }

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
          models: snapshot.models.map((modelRow) =>
            modelRow.canonicalId === canonicalId
              ? { ...modelRow, enabled }
              : modelRow
          ),
        });
      }
    } catch {
      appToast.error("pages.aiInterfaces.volcano.toggleFailed");
    } finally {
      setTogglingId(null);
    }
  };



  const handleAliasChange = async (canonicalId: string, alias: string) => {
    setAliasSavingId(canonicalId);
    try {
      await updateVolcanoModelAlias(organizationId, iface.id, {
        [canonicalId]: alias,
      });
      await onUpdated();
      if (snapshot) {
        setSnapshot({
          ...snapshot,
          models: snapshot.models.map((modelRow) =>
            modelRow.canonicalId === canonicalId
              ? { ...modelRow, alias }
              : modelRow
          ),
        });
      }
    } catch {
      appToast.error("pages.aiInterfaces.volcano.aliasSaveFailed");
    } finally {
      setAliasSavingId(null);
    }
  };



  const displayName = resolveVolcanoInterfaceDisplayName(iface.name);



  const tosSnapshot = snapshot?.tosStorage ?? {

    enabled: false,

    configured: false,

    region: "",

    bucket: "",

    prefix: "z3cz",

    storageUsage: null,

    trafficUsage: null,

  };



  const panelBanners = (

    <VolcanoPanelSetupBanners {...panelBannerProps} />

  );



  return (
    <InterfaceCardShell
      title={displayName}
      titleBadge={<AggregateChannelBadge />}
      enabledModelChips={enabledModelChips}
      expanded={expanded}
      onExpandToggle={() => void handleExpand()}
      onDelete={onDelete}
      collapsedHint={<VolcanoPanelSetupBanners compact {...panelBannerProps} />}
      leadingActions={
        <Button
          variant="outline"
          size="sm"
          onClick={() => void handleRefresh()}
        >
          <RefreshCw
            className={`mr-2 size-4 ${isRefreshAnimating ? "animate-spin" : ""}`}
          />
          {t("pages.aiInterfaces.volcano.refresh")}
        </Button>
      }
    >
      <div className="space-y-3">
        <div className="space-y-0.5">
          {snapshot?.balance ? (
            <>
              <p className="text-lg font-semibold tabular-nums tracking-tight">
                ¥ {formatBalance(snapshot.balance.available)}
              </p>
              <p className="text-muted-foreground text-xs">
                {t("pages.aiInterfaces.volcano.accountBalance")}
              </p>
            </>
          ) : snapshot ? (
            <p className="text-muted-foreground text-sm">
              {t("pages.aiInterfaces.volcano.balanceUnavailable")}
            </p>
          ) : null}
          {snapshot?.balanceError ? (
            <p className="text-destructive text-xs">{snapshot.balanceError}</p>
          ) : null}
        </div>

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

        {panelBanners}

        {isLoading && !snapshot ? (

            <div className="columns-1 gap-3 md:columns-2">

              {Array.from({ length: 4 }).map((_, index) => (

                <Skeleton key={index} className="mb-3 h-28 w-full rounded-lg" />

              ))}

            </div>

          ) : snapshot ? (

            <>

              {snapshot.usageError ? (

                <p className="text-destructive text-sm">{snapshot.usageError}</p>

              ) : null}



              <div className="columns-1 gap-3 md:columns-2">

                <div className="mb-3 break-inside-avoid">

                  <VolcanoStorageRow

                    organizationId={organizationId}

                    interfaceId={iface.id}

                    snapshot={tosSnapshot}

                    tosServiceStatus={tosServiceStatus}

                    onUpdated={onUpdated}

                    onRefreshSnapshot={handleRefresh}

                  />

                </div>

                {snapshot.models.map((row) => (

                  <div key={row.canonicalId} className="mb-3 break-inside-avoid">

                    <VolcanoModelRow

                      row={row}

                      showUsage

                      disabled={
                        togglingId === row.canonicalId ||
                        aliasSavingId === row.canonicalId
                      }

                      pricingRow={pricingByCanonicalId.get(row.canonicalId) ?? null}

                      pricingDocUrl={

                        snapshot.pricing.docUrl ?? PRICING_DOC_URL

                      }

                      onEnabledChange={(enabled) =>

                        void handleToggle(row.canonicalId, enabled)

                      }

                      onAliasChange={(alias) =>

                        void handleAliasChange(row.canonicalId, alias)

                      }

                    />

                  </div>

                ))}

              </div>



              {snapshot.packageListCachedAt ? (

                <p className="text-muted-foreground text-xs">

                  {t("pages.aiInterfaces.volcano.updatedAt", {

                    time: new Date(snapshot.packageListCachedAt).toLocaleString(),

                  })}

                </p>

              ) : null}

            </>

          ) : null}
      </div>
    </InterfaceCardShell>
  );
}
