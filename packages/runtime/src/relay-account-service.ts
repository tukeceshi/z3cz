import type { RelayAccountProvider } from "@dafthunk/types";

export interface ResolvedRelayAccount {
  readonly id: string;
  readonly name: string;
  readonly provider: RelayAccountProvider;
  readonly baseUrl: string;
  readonly apiKey: string;
}

export interface RelayAccountService {
  resolve(
    accountId?: string,
    provider?: RelayAccountProvider
  ): Promise<ResolvedRelayAccount | undefined>;
}
