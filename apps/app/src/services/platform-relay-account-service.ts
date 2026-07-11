import type {
  CreatePlatformRelayAccountRequest,
  ListPlatformRelayAccountsResponse,
  PlatformRelayAccount,
  UpdatePlatformRelayAccountRequest,
} from "@dafthunk/types";
import useSWR from "swr";

import { makeRequest } from "./utils";

const ADMIN_ENDPOINT = "/admin/platform-relay-accounts";

export function useAdminPlatformRelayAccounts() {
  const { data, error, isLoading, mutate } = useSWR(ADMIN_ENDPOINT, async () => {
    const response = await makeRequest<ListPlatformRelayAccountsResponse>(
      ADMIN_ENDPOINT
    );
    return response.accounts;
  });

  return {
    accounts: data ?? [],
    accountsError: error,
    isAccountsLoading: isLoading,
    refreshAccounts: mutate,
  };
}

export async function createAdminPlatformRelayAccount(
  input: CreatePlatformRelayAccountRequest
): Promise<PlatformRelayAccount> {
  const response = await makeRequest<{ account: PlatformRelayAccount }>(
    ADMIN_ENDPOINT,
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );
  return response.account;
}

export async function updateAdminPlatformRelayAccount(
  id: string,
  input: UpdatePlatformRelayAccountRequest
): Promise<PlatformRelayAccount> {
  const response = await makeRequest<{ account: PlatformRelayAccount }>(
    `${ADMIN_ENDPOINT}/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    }
  );
  return response.account;
}

export async function deleteAdminPlatformRelayAccount(id: string): Promise<void> {
  await makeRequest(`${ADMIN_ENDPOINT}/${id}`, {
    method: "DELETE",
  });
}

export type { PlatformRelayAccount };
