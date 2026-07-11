import type {
  AiInterfaceManifest,
  AiInterfaceRuntimeArtifact,
  AiInterfaceSourceSpec,
  ResolvedOrgAiInterface,
} from "@dafthunk/types";

export interface AiInterfaceService {
  loadManifest(): Promise<AiInterfaceManifest | undefined>;
  loadArtifact(
    templateId: string,
    version?: number
  ): Promise<AiInterfaceRuntimeArtifact | undefined>;
  resolveOrgInterface(params: {
    organizationId: string;
    interfaceId?: string;
    templateId?: string;
  }): Promise<ResolvedOrgAiInterface | undefined>;
}

export interface SaveCompiledTemplateResult {
  readonly templateId: string;
  readonly version: number;
  readonly artifact: AiInterfaceRuntimeArtifact;
  readonly source: AiInterfaceSourceSpec;
}
