import type { ResolvedOrgAiInterface } from "@dafthunk/types";

export interface AiInterfaceService {
  resolveOrgInterface(params: {
    organizationId: string;
    interfaceId?: string;
    templateId?: string;
  }): Promise<ResolvedOrgAiInterface | undefined>;
}
