import {
  isVolcanoAiInterfaceProvider,
  type GetSeedanceVideoCheckResultResponse,
  type ObjectReference,
  type SeedanceVideoCheckApiLog,
} from "@dafthunk/types";
import type { ChangeEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";

import { useAuth } from "@/components/auth-context";
import { InsetLayout } from "@/components/layouts/inset-layout";
import { useTranslation } from "@/components/locale-provider";
import { OrgPermissionGate } from "@/components/org-permission-gate";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppToast } from "@/hooks/use-app-toast";
import { useOrgPermissions } from "@/hooks/use-org-permissions";
import { useOrgUrl } from "@/hooks/use-org-url";
import { usePageBreadcrumbs } from "@/hooks/use-page";
import {
  getCachedMediaBlob,
  listOrganizationCacheEntries,
  type AiMediaCacheEntrySummary,
} from "@/services/ai-media-cache-service";
import { useOrganizationAiInterfaces } from "@/services/organization-ai-interface-service";
import {
  fetchSeedanceVideoCheckResult,
  formatSeedanceVideoCheckErrorDetail,
  readSeedanceVideoCheckErrorLog,
  submitSeedanceVideoCheck,
} from "@/services/seedance-video-check-service";
import {
  CloudObjectUploadFailedError,
  uploadBlobToCloudStorage,
} from "@/services/upload-generative-media-cloud";
import { cn } from "@/utils/utils";

type SourceTab = "upload" | "cached" | "url";

const TOOL_WORKFLOW_ID = "tools/seedance-video-check";

const VIDEO_ACCEPT = "video/mp4,video/quicktime,video/webm,video/x-matroska";

function isVideoCacheEntry(entry: AiMediaCacheEntrySummary): boolean {
  return entry.nodeType === "ai-video";
}

function formatCacheLabel(entry: AiMediaCacheEntrySummary): string {
  const workflow = entry.workflowName.trim() || entry.workflowId;
  return `${workflow} · ${entry.mediaId.slice(0, 8)}`;
}

function formatErrorDetail(error: unknown): string {
  if (error instanceof CloudObjectUploadFailedError) {
    return JSON.stringify({ name: error.name, message: error.message }, null, 2);
  }
  return formatSeedanceVideoCheckErrorDetail(error);
}

export function SeedanceVideoCheckPage() {
  const { t } = useTranslation();
  const perms = useOrgPermissions();

  if (!perms.canViewWorkflows) {
    return (
      <OrgPermissionGate allowed={false} title={t("sidebar.seedanceVideoCheck")}>
        {null}
      </OrgPermissionGate>
    );
  }

  return <SeedanceVideoCheckPageContent />;
}

function SeedanceVideoCheckPageContent() {
  const { t } = useTranslation();
  const { organization } = useAuth();
  const { getOrgUrl } = useOrgUrl();
  const { toast } = useAppToast();
  const orgId = organization?.id;

  const { interfaces, isInterfacesLoading } =
    useOrganizationAiInterfaces(orgId);
  const hasVolcanoInterface = useMemo(
    () => interfaces.some((iface) => isVolcanoAiInterfaceProvider(iface.provider)),
    [interfaces]
  );

  const [sourceTab, setSourceTab] = useState<SourceTab>("upload");
  const [externalUrl, setExternalUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [cachedEntries, setCachedEntries] = useState<
    readonly AiMediaCacheEntrySummary[]
  >([]);
  const [selectedCacheKey, setSelectedCacheKey] = useState<string | null>(null);
  const [isLoadingCache, setIsLoadingCache] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshingResult, setIsRefreshingResult] = useState(false);
  const [queryId, setQueryId] = useState<string | null>(null);
  const [result, setResult] = useState<GetSeedanceVideoCheckResultResponse | null>(
    null
  );
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [submitLog, setSubmitLog] = useState<SeedanceVideoCheckApiLog | null>(
    null
  );
  const [resultLog, setResultLog] = useState<SeedanceVideoCheckApiLog | null>(
    null
  );

  usePageBreadcrumbs([
    { label: t("sidebar.groups.tools"), to: getOrgUrl("/tools/seedance-video-check") },
    { label: t("pages.seedanceVideoCheck.title") },
  ]);

  const loadCachedVideos = useCallback(async () => {
    if (!orgId) return;
    setIsLoadingCache(true);
    try {
      const entries = await listOrganizationCacheEntries(orgId);
      const videos = entries.filter(isVideoCacheEntry);
      setCachedEntries(videos);
      setSelectedCacheKey((current) => {
        if (current && videos.some((entry) => entry.key === current)) {
          return current;
        }
        return videos[0]?.key ?? null;
      });
    } finally {
      setIsLoadingCache(false);
    }
  }, [orgId]);

  useEffect(() => {
    if (sourceTab === "cached") {
      void loadCachedVideos();
    }
  }, [loadCachedVideos, sourceTab]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setQueryId(null);
    setResult(null);
    setErrorDetail(null);
    setSubmitLog(null);
    setResultLog(null);
  };

  const buildSubmitBody = async (): Promise<
    | { readonly source: "url"; readonly url: string }
    | { readonly source: "object"; readonly object: ObjectReference }
  > => {
    if (!orgId) {
      throw new Error(t("common.error"));
    }

    if (sourceTab === "url") {
      const url = externalUrl.trim();
      if (!url) {
        throw new Error(t("pages.seedanceVideoCheck.errors.urlRequired"));
      }
      return { source: "url", url };
    }

    if (sourceTab === "upload") {
      if (!selectedFile) {
        throw new Error(t("pages.seedanceVideoCheck.errors.fileRequired"));
      }
      const uploaded = await uploadBlobToCloudStorage({
        organizationId: orgId,
        workflowId: TOOL_WORKFLOW_ID,
        blob: selectedFile,
        mimeType: selectedFile.type || "video/mp4",
        mediaKind: "reference",
        nodeType: "ai-video",
      });
      return { source: "object", object: uploaded.object };
    }

    const entry = cachedEntries.find((item) => item.key === selectedCacheKey);
    if (!entry) {
      throw new Error(t("pages.seedanceVideoCheck.errors.cachedRequired"));
    }
    const blob = await getCachedMediaBlob({
      organizationId: entry.organizationId,
      workflowId: entry.workflowId,
      mediaId: entry.mediaId,
    });
    if (!blob) {
      throw new Error(t("pages.seedanceVideoCheck.errors.cachedMissing"));
    }
    const uploaded = await uploadBlobToCloudStorage({
      organizationId: orgId,
      workflowId: TOOL_WORKFLOW_ID,
      blob,
      mimeType: entry.mimeType,
      mediaKind: "reference",
      nodeType: "ai-video",
    });
    return { source: "object", object: uploaded.object };
  };

  const handleSubmit = async () => {
    if (!orgId) return;

    setIsSubmitting(true);
    setQueryId(null);
    setResult(null);
    setErrorDetail(null);
    setSubmitLog(null);
    setResultLog(null);

    try {
      const submitBody = await buildSubmitBody();
      const response = await submitSeedanceVideoCheck(orgId, submitBody);
      setQueryId(response.queryId);
      setSubmitLog(response.log);
    } catch (error) {
      setSubmitLog(readSeedanceVideoCheckErrorLog(error));
      setErrorDetail(formatErrorDetail(error));
      toast({
        title: t("pages.seedanceVideoCheck.errors.submitFailed"),
        description: error instanceof Error ? error.message : t("common.error"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRefreshResult = async () => {
    if (!orgId || !queryId) return;

    setIsRefreshingResult(true);
    setErrorDetail(null);

    try {
      const checkResult = await fetchSeedanceVideoCheckResult(orgId, queryId);
      setResult(checkResult);
      setResultLog(checkResult.log);
    } catch (error) {
      setResultLog(readSeedanceVideoCheckErrorLog(error));
      setErrorDetail(formatErrorDetail(error));
      toast({
        title: t("pages.seedanceVideoCheck.errors.resultFailed"),
        description: error instanceof Error ? error.message : t("common.error"),
        variant: "destructive",
      });
    } finally {
      setIsRefreshingResult(false);
    }
  };

  const isBusy = isSubmitting || isRefreshingResult;
  const canSubmit =
    hasVolcanoInterface &&
    !isBusy &&
    ((sourceTab === "url" && externalUrl.trim().length > 0) ||
      (sourceTab === "upload" && selectedFile !== null) ||
      (sourceTab === "cached" && selectedCacheKey !== null));

  return (
    <InsetLayout title={t("pages.seedanceVideoCheck.title")}>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <p className="text-sm text-muted-foreground">
          {t("pages.seedanceVideoCheck.description")}
        </p>

        <Alert variant="destructive">
          <AlertTitle>{t("pages.seedanceVideoCheck.enterpriseAlertTitle")}</AlertTitle>
          <AlertDescription>
            {t("pages.seedanceVideoCheck.enterpriseAlertDescription")}
          </AlertDescription>
        </Alert>

        <Alert>
          <AlertTitle>{t("pages.seedanceVideoCheck.limitationsTitle")}</AlertTitle>
          <AlertDescription className="space-y-1">
            <p>{t("pages.seedanceVideoCheck.limitationsLine1")}</p>
            <p>{t("pages.seedanceVideoCheck.limitationsLine2")}</p>
          </AlertDescription>
        </Alert>

        {!isInterfacesLoading && !hasVolcanoInterface ? (
          <Alert>
            <AlertTitle>{t("pages.seedanceVideoCheck.volcanoRequiredTitle")}</AlertTitle>
            <AlertDescription className="space-y-3">
              <p>{t("pages.seedanceVideoCheck.volcanoRequiredDescription")}</p>
              <Button asChild variant="outline" size="sm">
                <Link to={getOrgUrl("/ai-interfaces")}>
                  {t("pages.seedanceVideoCheck.openAiInterfaces")}
                </Link>
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        <Tabs
          value={sourceTab}
          onValueChange={(value) => setSourceTab(value as SourceTab)}
        >
          <TabsList>
            <TabsTrigger value="upload">
              {t("pages.seedanceVideoCheck.tabs.upload")}
            </TabsTrigger>
            <TabsTrigger value="cached">
              {t("pages.seedanceVideoCheck.tabs.cached")}
            </TabsTrigger>
            <TabsTrigger value="url">
              {t("pages.seedanceVideoCheck.tabs.url")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="seedance_video_file">
                {t("pages.seedanceVideoCheck.uploadLabel")}
              </Label>
              <Input
                id="seedance_video_file"
                type="file"
                accept={VIDEO_ACCEPT}
                onChange={handleFileChange}
                disabled={!hasVolcanoInterface || isBusy}
              />
              <p className="text-xs text-muted-foreground">
                {t("pages.seedanceVideoCheck.uploadHint")}
              </p>
            </div>
          </TabsContent>

          <TabsContent value="cached" className="space-y-3">
            {isLoadingCache ? (
              <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
            ) : cachedEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("pages.seedanceVideoCheck.cachedEmpty")}
              </p>
            ) : (
              <div className="space-y-2">
                {cachedEntries.map((entry) => {
                  const selected = entry.key === selectedCacheKey;
                  return (
                    <button
                      key={entry.key}
                      type="button"
                      className={cn(
                        "flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors",
                        selected
                          ? "border-primary bg-primary/5"
                          : "hover:bg-muted/50"
                      )}
                      onClick={() => setSelectedCacheKey(entry.key)}
                      disabled={!hasVolcanoInterface || isBusy}
                    >
                      <span className="truncate">{formatCacheLabel(entry)}</span>
                      <span className="ml-3 shrink-0 text-xs text-muted-foreground">
                        {entry.mimeType}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="url" className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="seedance_video_url">
                {t("pages.seedanceVideoCheck.urlLabel")}
              </Label>
              <Input
                id="seedance_video_url"
                value={externalUrl}
                onChange={(event) => setExternalUrl(event.target.value)}
                placeholder="https://"
                autoComplete="off"
                disabled={!hasVolcanoInterface || isBusy}
              />
              <p className="text-xs text-muted-foreground">
                {t("pages.seedanceVideoCheck.urlHint")}
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => void handleSubmit()} disabled={!canSubmit}>
            {isSubmitting
              ? t("pages.seedanceVideoCheck.submitting")
              : t("pages.seedanceVideoCheck.checkAction")}
          </Button>
          <Button
            variant="outline"
            onClick={() => void handleRefreshResult()}
            disabled={!queryId || isBusy}
          >
            {isRefreshingResult
              ? t("pages.seedanceVideoCheck.refreshing")
              : t("pages.seedanceVideoCheck.refreshResult")}
          </Button>
        </div>

        {queryId ? (
          <div className="rounded-md border px-3 py-2 text-sm">
            <span className="text-muted-foreground">
              {t("pages.seedanceVideoCheck.queryIdLabel")}:{" "}
            </span>
            <code className="break-all">{queryId}</code>
          </div>
        ) : null}

        {errorDetail ? (
          <Alert variant="destructive">
            <AlertTitle>{t("pages.seedanceVideoCheck.errors.debugTitle")}</AlertTitle>
            <AlertDescription>
              <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-all text-xs">
                {errorDetail}
              </pre>
            </AlertDescription>
          </Alert>
        ) : null}

        {result ? (
          <div className="space-y-3 rounded-md border p-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-medium">
                {t("pages.seedanceVideoCheck.resultTitle")}
              </h2>
              <Badge
                variant={
                  result.status === "completed"
                    ? "default"
                    : result.status === "failed"
                      ? "destructive"
                      : "secondary"
                }
              >
                {t(`pages.seedanceVideoCheck.status.${result.status}`)}
              </Badge>
            </div>

            {result.status === "completed" ? (
              <dl className="grid gap-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">
                    {t("pages.seedanceVideoCheck.fields.isOfficial")}
                  </dt>
                  <dd>
                    {result.isOfficial === true
                      ? t("pages.seedanceVideoCheck.values.yes")
                      : result.isOfficial === false
                        ? t("pages.seedanceVideoCheck.values.no")
                        : t("pages.seedanceVideoCheck.values.unknown")}
                  </dd>
                </div>
                {result.modelVersion ? (
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">
                      {t("pages.seedanceVideoCheck.fields.modelVersion")}
                    </dt>
                    <dd className="truncate">{result.modelVersion}</dd>
                  </div>
                ) : null}
                {result.resolution ? (
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">
                      {t("pages.seedanceVideoCheck.fields.resolution")}
                    </dt>
                    <dd>{result.resolution}</dd>
                  </div>
                ) : null}
              </dl>
            ) : null}

            {result.message ? (
              <p className="text-sm text-muted-foreground">{result.message}</p>
            ) : null}

            {result.status === "pending" ? (
              <p className="text-sm text-muted-foreground">
                {t("pages.seedanceVideoCheck.pendingHint")}
              </p>
            ) : null}
          </div>
        ) : null}

        {submitLog || resultLog ? (
          <div className="space-y-3 rounded-md border p-4">
            <h2 className="text-lg font-medium">
              {t("pages.seedanceVideoCheck.apiLogsTitle")}
            </h2>
            {submitLog ? (
              <div className="space-y-1">
                <h3 className="text-sm font-medium">
                  {t("pages.seedanceVideoCheck.submitLogTitle")}
                </h3>
                <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted p-3 text-xs">
                  {JSON.stringify(submitLog, null, 2)}
                </pre>
              </div>
            ) : null}
            {resultLog ? (
              <div className="space-y-1">
                <h3 className="text-sm font-medium">
                  {t("pages.seedanceVideoCheck.resultLogTitle")}
                </h3>
                <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted p-3 text-xs">
                  {JSON.stringify(resultLog, null, 2)}
                </pre>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </InsetLayout>
  );
}
