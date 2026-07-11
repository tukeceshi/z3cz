import type {
  AiInterfaceManifest,
  AiInterfaceRuntimeArtifact,
  AiInterfaceSourceSpec,
  AiInterfaceTemplateDetail,
  AiInterfaceTemplateIndex,
} from "@dafthunk/types";
import {
  buildAiInterfaceManifest,
  compileAiInterfaceSourceSpec,
} from "@dafthunk/runtime/ai-interface/compile";

import type { Bindings } from "../context";
import { createDatabase } from "../db";
import {
  deleteAiInterfaceTemplateRow,
  getAiInterfaceTemplateRow,
  listAiInterfaceTemplateRows,
  listEnabledAiInterfaceTemplateRows,
  upsertAiInterfaceTemplateIndex,
} from "../db/ai-interface-queries";

const MANIFEST_KEY = "ai-interface-templates/_manifest/latest.json";
const MANIFEST_POINTER_KEY = "ai-interface-manifest:latest";

interface ManifestPointer {
  checksum: string;
  manifestVersion: number;
  key: string;
}

function sourceKey(templateId: string, version: number): string {
  return `ai-interface-templates/${templateId}/v${version}/source.spec.json`;
}

function artifactKey(templateId: string, version: number): string {
  return `ai-interface-templates/${templateId}/v${version}/runtime.v1.json`;
}

export class AiInterfaceTemplateStore {
  private memoryManifest?: AiInterfaceManifest;
  private memoryArtifacts = new Map<string, AiInterfaceRuntimeArtifact>();

  constructor(private readonly env: Bindings) {}

  private get bucket(): R2Bucket {
    if (!this.env.RESSOURCES) {
      throw new Error("Object storage is not initialized");
    }
    return this.env.RESSOURCES;
  }

  async listTemplates(): Promise<AiInterfaceTemplateIndex[]> {
    const db = createDatabase(this.env);
    const rows = await listAiInterfaceTemplateRows(db);
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description ?? "",
      provider: row.provider as AiInterfaceTemplateIndex["provider"],
      executionMode: "sync",
      enabled: row.enabled,
      isSystem: row.isSystem,
      isDefault: row.isDefault,
      sortOrder: row.sortOrder,
      specVersion: row.specVersion,
      artifactChecksum: row.artifactChecksum,
      updatedAt: row.updatedAt.toISOString(),
      updatedBy: row.updatedBy,
    }));
  }

  async getTemplateDetail(id: string): Promise<AiInterfaceTemplateDetail | undefined> {
    const db = createDatabase(this.env);
    const row = await getAiInterfaceTemplateRow(db, id);
    if (!row) return undefined;

    const sourceSpec = await this.readJson<AiInterfaceSourceSpec>(row.sourceKey);
    if (!sourceSpec) return undefined;

    return {
      id: row.id,
      name: row.name,
      description: row.description ?? "",
      provider: row.provider as AiInterfaceTemplateIndex["provider"],
      executionMode: "sync",
      enabled: row.enabled,
      isSystem: row.isSystem,
      isDefault: row.isDefault,
      sortOrder: row.sortOrder,
      specVersion: row.specVersion,
      artifactChecksum: row.artifactChecksum,
      updatedAt: row.updatedAt.toISOString(),
      updatedBy: row.updatedBy,
      sourceSpec,
    };
  }

  async saveTemplate(params: {
    source: AiInterfaceSourceSpec;
    updatedBy?: string;
    changeNote?: string;
  }): Promise<AiInterfaceTemplateDetail> {
    const db = createDatabase(this.env);
    const existing = await getAiInterfaceTemplateRow(db, params.source.meta.id);
    const version = (existing?.specVersion ?? 0) + 1;

    const artifact = compileAiInterfaceSourceSpec({
      source: params.source,
      version,
    });

    const srcKey = sourceKey(params.source.meta.id, version);
    const artKey = artifactKey(params.source.meta.id, version);

    await this.writeJson(srcKey, params.source);
    await this.writeJson(artKey, artifact);

    await upsertAiInterfaceTemplateIndex(db, {
      source: params.source,
      version,
      artifactChecksum: artifact.checksum,
      artifactKey: artKey,
      sourceKey: srcKey,
      updatedBy: params.updatedBy,
    });

    await this.rebuildManifest();

    this.memoryArtifacts.set(`${params.source.meta.id}:${version}`, artifact);
    this.memoryArtifacts.set(`${params.source.meta.id}:latest`, artifact);

    const detail = await this.getTemplateDetail(params.source.meta.id);
    if (!detail) {
      throw new Error("Failed to load saved template");
    }
    return detail;
  }

  async deleteTemplate(id: string): Promise<void> {
    const db = createDatabase(this.env);
    const row = await getAiInterfaceTemplateRow(db, id);
    if (!row) {
      throw new Error("Template not found");
    }
    if (row.isSystem) {
      throw new Error("System templates cannot be deleted");
    }

    await deleteAiInterfaceTemplateRow(db, id);
    await this.rebuildManifest();
  }

  async loadArtifact(
    templateId: string,
    version?: number
  ): Promise<AiInterfaceRuntimeArtifact | undefined> {
    const cacheKey = `${templateId}:${version ?? "latest"}`;
    const cached = this.memoryArtifacts.get(cacheKey);
    if (cached) return cached;

    const db = createDatabase(this.env);
    const row = await getAiInterfaceTemplateRow(db, templateId);
    if (!row) return undefined;

    const targetVersion = version ?? row.specVersion;
    const key =
      targetVersion === row.specVersion
        ? row.artifactKey
        : artifactKey(templateId, targetVersion);

    const artifact = await this.readJson<AiInterfaceRuntimeArtifact>(key);
    if (artifact) {
      this.memoryArtifacts.set(`${templateId}:${targetVersion}`, artifact);
      if (!version || version === row.specVersion) {
        this.memoryArtifacts.set(`${templateId}:latest`, artifact);
      }
    }
    return artifact;
  }

  async loadManifest(): Promise<AiInterfaceManifest | undefined> {
    if (this.memoryManifest) {
      return this.memoryManifest;
    }

    const pointer = await this.readKvPointer();
    if (pointer) {
      const manifest = await this.readJson<AiInterfaceManifest>(pointer.key);
      if (manifest) {
        this.memoryManifest = manifest;
        return manifest;
      }
    }

    const manifest = await this.readJson<AiInterfaceManifest>(MANIFEST_KEY);
    if (manifest) {
      this.memoryManifest = manifest;
    }
    return manifest;
  }

  private async rebuildManifest(): Promise<AiInterfaceManifest> {
    const db = createDatabase(this.env);
    const rows = await listEnabledAiInterfaceTemplateRows(db);
    const artifacts: AiInterfaceRuntimeArtifact[] = [];

    for (const row of rows) {
      const artifact = await this.readJson<AiInterfaceRuntimeArtifact>(
        row.artifactKey
      );
      if (artifact) {
        artifacts.push(artifact);
        this.memoryArtifacts.set(`${row.id}:${row.specVersion}`, artifact);
        this.memoryArtifacts.set(`${row.id}:latest`, artifact);
      }
    }

    const previous = await this.readJson<AiInterfaceManifest>(MANIFEST_KEY);
    const manifest = buildAiInterfaceManifest({
      manifestVersion: (previous?.manifestVersion ?? 0) + 1,
      artifacts,
    });

    await this.writeJson(MANIFEST_KEY, manifest);
    await this.writeKvPointer({
      checksum: manifest.checksum,
      manifestVersion: manifest.manifestVersion,
      key: MANIFEST_KEY,
    });

    this.memoryManifest = manifest;
    return manifest;
  }

  private async readKvPointer(): Promise<ManifestPointer | undefined> {
    if (!this.env.KV) return undefined;
    return this.env.KV.get(MANIFEST_POINTER_KEY, "json") as Promise<
      ManifestPointer | undefined
    >;
  }

  private async writeKvPointer(pointer: ManifestPointer): Promise<void> {
    if (!this.env.KV) return;
    await this.env.KV.put(MANIFEST_POINTER_KEY, JSON.stringify(pointer));
  }

  private async writeJson(key: string, value: unknown): Promise<void> {
    await this.bucket.put(key, JSON.stringify(value), {
      httpMetadata: {
        contentType: "application/json",
        cacheControl: "no-cache",
      },
    });
  }

  private async readJson<T>(key: string): Promise<T | undefined> {
    const object = await this.bucket.get(key);
    if (!object) return undefined;
    const text = await object.text();
    return JSON.parse(text) as T;
  }
}

export async function bootstrapAiInterfaceTemplates(
  env: Bindings,
  seeds: readonly AiInterfaceSourceSpec[]
): Promise<void> {
  const store = new AiInterfaceTemplateStore(env);
  for (const seed of seeds) {
    const existing = await store.getTemplateDetail(seed.meta.id);
    if (existing) continue;
    await store.saveTemplate({ source: seed });
  }
}
