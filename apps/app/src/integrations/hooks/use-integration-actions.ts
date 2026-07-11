import type {
  CreateIntegrationRequest,
  CreateIntegrationResponse,
  DeleteIntegrationResponse,
  IntegrationProvider,
  UpdateIntegrationResponse,
} from "@dafthunk/types";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-context";
import { useTranslation } from "@/components/locale-provider";
import { getApiBaseUrl } from "@/config/api";
import { makeOrgRequest } from "@/services/utils";

import { getProvider } from "../providers";
import { useIntegrations } from "./use-integrations";

const API_ENDPOINT = "/integrations";

interface IntegrationActionsResult {
  isProcessing: boolean;
  connectOAuth: (provider: IntegrationProvider) => void;
  createManual: (
    provider: IntegrationProvider,
    name: string,
    apiKey: string
  ) => Promise<void>;
  deleteIntegration: (integrationId: string) => Promise<void>;
  updateIntegration: (
    integrationId: string,
    updates: {
      name?: string;
      token?: string;
      refreshToken?: string;
      tokenExpiresAt?: Date;
      metadata?: string;
    }
  ) => Promise<void>;
}

/**
 * Hook for performing integration actions (create, update, delete, OAuth)
 */
export function useIntegrationActions(): IntegrationActionsResult {
  const { organization } = useAuth();
  const { t } = useTranslation();
  const { mutate } = useIntegrations();
  const [isProcessing, setIsProcessing] = useState(false);

  const connectOAuth = useCallback(
    (provider: IntegrationProvider) => {
      const providerConfig = getProvider(provider);
      if (!providerConfig?.oauthEndpoint) {
        toast.error(t("pages.integrations.oauthNotSupported"));
        return;
      }

      if (!organization?.id) {
        toast.error(t("pages.integrations.noOrganization"));
        return;
      }

      const apiBaseUrl = getApiBaseUrl();
      window.location.href = `${apiBaseUrl}${providerConfig.oauthEndpoint}?organizationId=${organization.id}`;
    },
    [organization?.id, t]
  );

  const createManual = useCallback(
    async (
      provider: IntegrationProvider,
      name: string,
      apiKey: string
    ): Promise<void> => {
      if (!organization?.id || !name || !apiKey) {
        return;
      }

      setIsProcessing(true);
      try {
        const request: CreateIntegrationRequest = {
          name,
          provider,
          token: apiKey,
        };

        await makeOrgRequest<CreateIntegrationResponse>(
          organization.id,
          API_ENDPOINT,
          "",
          {
            method: "POST",
            body: JSON.stringify(request),
          }
        );

        toast.success(t("pages.integrations.createSuccess"));
        await mutate();
      } catch (error) {
        toast.error(t("pages.integrations.createFailed"));
        console.error("Create Integration Error:", error);
        throw error;
      } finally {
        setIsProcessing(false);
      }
    },
    [organization?.id, mutate, t]
  );

  const deleteIntegration = useCallback(
    async (integrationId: string): Promise<void> => {
      if (!organization?.id) return;

      setIsProcessing(true);
      try {
        await makeOrgRequest<DeleteIntegrationResponse>(
          organization.id,
          API_ENDPOINT,
          `/${integrationId}`,
          {
            method: "DELETE",
          }
        );

        toast.success(t("pages.integrations.deleteSuccess"));
        await mutate();
      } catch (error) {
        toast.error(t("pages.integrations.deleteFailed"));
        console.error("Delete Integration Error:", error);
        throw error;
      } finally {
        setIsProcessing(false);
      }
    },
    [organization?.id, mutate, t]
  );

  const updateIntegration = useCallback(
    async (
      integrationId: string,
      updates: {
        name?: string;
        token?: string;
        refreshToken?: string;
        tokenExpiresAt?: Date;
        metadata?: string;
      }
    ): Promise<void> => {
      if (!organization?.id) return;

      setIsProcessing(true);
      try {
        await makeOrgRequest<UpdateIntegrationResponse>(
          organization.id,
          API_ENDPOINT,
          `/${integrationId}`,
          {
            method: "PUT",
            body: JSON.stringify(updates),
          }
        );

        toast.success(t("pages.integrations.updateSuccess"));
        await mutate();
      } catch (error) {
        toast.error(t("pages.integrations.updateFailed"));
        console.error("Update Integration Error:", error);
        throw error;
      } finally {
        setIsProcessing(false);
      }
    },
    [organization?.id, mutate, t]
  );

  return {
    isProcessing,
    connectOAuth,
    createManual,
    deleteIntegration,
    updateIntegration,
  };
}
