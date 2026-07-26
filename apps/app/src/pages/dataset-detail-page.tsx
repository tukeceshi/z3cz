import { DatasetFile } from "@dafthunk/types";
import { useEffect, useRef } from "react";
import { useParams } from "react-router";
import { useAuth } from "@/components/auth-context";
import { InsetError } from "@/components/inset-error";
import { InsetLoading } from "@/components/inset-loading";
import { InsetLayout } from "@/components/layouts/inset-layout";
import { useTranslation } from "@/components/locale-provider";
import { useOwnerPageGuard } from "@/hooks/use-owner-page-guard";
import { Button } from "@/components/ui/button";
import { useAppToast } from "@/hooks/use-app-toast";
import { useOrgUrl } from "@/hooks/use-org-url";
import { usePageBreadcrumbs } from "@/hooks/use-page";
import {
  deleteDatasetFile,
  downloadDatasetFile,
  uploadDatasetFiles,
  useDataset,
  useDatasetFiles,
} from "@/services/dataset-service";
import { formatDate } from "@/utils/date";

export function DatasetDetailPage() {
  const ownerGuard = useOwnerPageGuard("sidebar.datasets");
  if (ownerGuard.blocked) return ownerGuard.gate;
  return <DatasetDetailPageContent />;
}

function DatasetDetailPageContent() {
  const { t } = useTranslation();
  const appToast = useAppToast();
  const { datasetId } = useParams<{ datasetId: string }>();
  const { setBreadcrumbs } = usePageBreadcrumbs([]);
  const { organization } = useAuth();
  const { getOrgUrl } = useOrgUrl();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { dataset, datasetError, isDatasetLoading } = useDataset(
    datasetId || null
  );

  const { files, filesError, isFilesLoading, mutateFiles } = useDatasetFiles(
    datasetId || null
  );

  useEffect(() => {
    if (datasetId) {
      setBreadcrumbs([
        { label: t("sidebar.datasets"), to: getOrgUrl("datasets") },
        { label: dataset?.name || datasetId },
      ]);
    }
  }, [datasetId, dataset?.name, setBreadcrumbs, getOrgUrl, t]);

  useEffect(() => {
    if (datasetError) {
      appToast.error("pages.datasetDetail.fetchDetailsFailed", {
        message: datasetError.message,
      });
    }
  }, [datasetError, appToast]);

  useEffect(() => {
    if (filesError) {
      appToast.error("pages.datasetDetail.fetchFilesFailed", {
        message: filesError.message,
      });
    }
  }, [filesError, appToast]);

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = event.target.files;
    if (!files || !datasetId || !organization?.id) return;

    const fileArray = Array.from(files);

    try {
      const result = await uploadDatasetFiles(
        datasetId,
        fileArray,
        organization.id
      );

      if (result.success.length > 0) {
        if (result.success.length === 1) {
          appToast.success("pages.datasetDetail.uploadOneSuccess", {
            file: result.success[0],
          });
        } else {
          appToast.success("pages.datasetDetail.uploadManySuccess", {
            count: result.success.length,
          });
        }
      }

      if (result.errors.length > 0) {
        result.errors.forEach(({ file, error }) => {
          appToast.error("pages.datasetDetail.uploadFailed", { file, error });
        });
      }

      mutateFiles();
    } catch (error) {
      appToast.error("pages.datasetDetail.uploadGenericFailed");
      console.error("Upload error:", error);
    }
  };

  const handleFileDelete = async (file: DatasetFile) => {
    if (!datasetId || !organization?.id) return;

    try {
      await deleteDatasetFile(
        datasetId,
        file.key.split("/").pop() || "",
        organization.id
      );
      appToast.success("pages.datasetDetail.deleteFileSuccess");
      mutateFiles();
    } catch (error) {
      appToast.error("pages.datasetDetail.deleteFileFailed");
      console.error("Delete error:", error);
    }
  };

  const handleFileDownload = async (file: DatasetFile) => {
    if (!datasetId || !organization?.id) return;

    try {
      await downloadDatasetFile(
        datasetId,
        file.key.split("/").pop() || "",
        organization.id
      );
    } catch (error) {
      appToast.error("pages.datasetDetail.downloadFailed");
      console.error("Download error:", error);
    }
  };

  if (isDatasetLoading) {
    return <InsetLoading title={t("pages.datasetDetail.title")} />;
  } else if (datasetError) {
    return (
      <InsetError
        title={t("pages.datasetDetail.title")}
        errorMessage={datasetError.message}
      />
    );
  }

  if (!dataset) {
    return (
      <InsetLayout title={t("pages.datasetDetail.notFoundTitle")}>
        <div className="text-center py-10">
          <p className="text-lg">{t("pages.datasetDetail.notFound")}</p>
        </div>
      </InsetLayout>
    );
  }

  return (
    <InsetLayout title={dataset.name}>
      <div className="space-y-6">
        <div className="rounded-lg border bg-card text-card-foreground shadow-xs p-6">
          <h3 className="font-semibold leading-none tracking-tight mb-4">
            {t("pages.datasetDetail.infoTitle")}
          </h3>
          <div className="space-y-4">
            <div>
              <span className="text-sm text-muted-foreground">
                {t("pages.datasetDetail.infoName")}
              </span>
              <p className="font-medium">{dataset.name}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">
                {t("pages.datasetDetail.infoId")}
              </span>
              <p className="font-mono text-sm">{dataset.id}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">
                {t("pages.datasetDetail.infoCreated")}
              </span>
              <p className="font-medium">{formatDate(dataset.createdAt)}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">
                {t("pages.datasetDetail.infoUpdated")}
              </span>
              <p className="font-medium">{formatDate(dataset.updatedAt)}</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-card text-card-foreground shadow-xs p-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="font-semibold leading-none tracking-tight">
                {t("pages.datasetDetail.filesTitle")}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                {t("pages.datasetDetail.filesMultiHint")}
              </p>
            </div>
            <div className="flex gap-2">
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileUpload}
                multiple
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
              >
                {t("pages.datasetDetail.uploadFiles")}
              </Button>
            </div>
          </div>

          {isFilesLoading ? (
            <div className="text-center py-4">
              {t("pages.datasetDetail.filesLoading")}
            </div>
          ) : filesError ? (
            <div className="text-center py-4 text-destructive">
              {t("pages.datasetDetail.filesLoadFailed")}
            </div>
          ) : files.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              <p>{t("pages.datasetDetail.filesEmpty")}</p>
              <p className="text-xs mt-1">
                {t("pages.datasetDetail.filesEmptyHint")}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {files.map((file) => (
                <div
                  key={file.key}
                  className="flex items-center justify-between p-2 rounded-md hover:bg-muted"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {file.key.split("/").pop()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(file.uploaded)} •{" "}
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleFileDownload(file)}
                    >
                      {t("pages.datasetDetail.download")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleFileDelete(file)}
                      className="text-destructive hover:text-destructive"
                    >
                      {t("common.delete")}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </InsetLayout>
  );
}
