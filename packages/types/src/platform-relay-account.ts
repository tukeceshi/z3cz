export type RelayAccountProvider = "newapi";

export const ALL_RELAY_ACCOUNT_PROVIDERS: readonly RelayAccountProvider[] = [
  "newapi",
] as const;

export interface PlatformRelayAccount {
  id: string;
  name: string;
  provider: RelayAccountProvider;
  baseUrl: string;
  enabled: boolean;
  isDefault: boolean;
  hasApiKey: boolean;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string | null;
}

export interface ListPlatformRelayAccountsResponse {
  accounts: PlatformRelayAccount[];
}

export interface GetPlatformRelayAccountResponse {
  account: PlatformRelayAccount;
}

export interface CreatePlatformRelayAccountRequest {
  id?: string;
  name: string;
  provider: RelayAccountProvider;
  baseUrl: string;
  apiKey: string;
  enabled?: boolean;
  isDefault?: boolean;
}

export interface UpdatePlatformRelayAccountRequest {
  name?: string;
  baseUrl?: string;
  apiKey?: string;
  enabled?: boolean;
  isDefault?: boolean;
}
