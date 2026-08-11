import fs from "node:fs/promises";
import path from "node:path";

import type {
  BlobGetResult,
  BlobListResult,
  BlobPutOptions,
  BlobStore,
} from "./blob-store";

interface StoredMeta {
  readonly httpMetadata?: {
    readonly contentType?: string;
    readonly cacheControl?: string;
  };
  readonly customMetadata?: Readonly<Record<string, string>>;
}

function toBuffer(data: string | Uint8Array): Buffer {
  if (typeof data === "string") {
    return Buffer.from(data);
  }
  return Buffer.from(data);
}

function metaPath(filePath: string): string {
  return `${filePath}.meta.json`;
}

async function readMeta(filePath: string): Promise<StoredMeta> {
  try {
    const raw = await fs.readFile(metaPath(filePath), "utf8");
    return JSON.parse(raw) as StoredMeta;
  } catch {
    return {};
  }
}

async function writeMeta(filePath: string, meta: StoredMeta): Promise<void> {
  await fs.writeFile(metaPath(filePath), JSON.stringify(meta));
}

async function walkFiles(
  rootDir: string,
  prefix: string
): Promise<BlobListResult["objects"]> {
  const targetDir = path.join(rootDir, prefix);
  const objects: BlobListResult["objects"][number][] = [];

  async function walk(currentDir: string, relativePrefix: string): Promise<void> {
    let entries: string[];
    try {
      entries = await fs.readdir(currentDir);
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.endsWith(".meta.json")) {
        continue;
      }
      const absolutePath = path.join(currentDir, entry);
      const stat = await fs.stat(absolutePath);
      const relativePath = path.join(relativePrefix, entry).replace(/\\/g, "/");
      if (stat.isDirectory()) {
        await walk(absolutePath, relativePath);
        continue;
      }
      const meta = await readMeta(absolutePath);
      objects.push({
        key: relativePath,
        size: stat.size,
        uploaded: stat.mtime,
        contentType: meta.httpMetadata?.contentType,
        customMetadata: meta.customMetadata,
      });
    }
  }

  await walk(targetDir, prefix.replace(/\/$/, ""));
  return objects;
}

export class LocalFileBlobStore implements BlobStore {
  constructor(private readonly rootDir: string) {}

  async get(key: string): Promise<BlobGetResult | null> {
    const filePath = path.join(this.rootDir, key);
    try {
      const data = await fs.readFile(filePath);
      const meta = await readMeta(filePath);
      return {
        body: new Uint8Array(data),
        contentType: meta.httpMetadata?.contentType,
        customMetadata: meta.customMetadata,
      };
    } catch {
      return null;
    }
  }

  async put(
    key: string,
    body: Uint8Array | string,
    options?: BlobPutOptions
  ): Promise<void> {
    const filePath = path.join(this.rootDir, key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, toBuffer(body));
    await writeMeta(filePath, {
      httpMetadata: {
        contentType: options?.contentType,
        cacheControl: options?.cacheControl,
      },
      customMetadata: options?.customMetadata,
    });
  }

  async delete(keys: string | readonly string[]): Promise<void> {
    const keyList = Array.isArray(keys) ? keys : [keys];
    await Promise.all(
      keyList.map(async (key) => {
        const filePath = path.join(this.rootDir, key);
        await fs.rm(filePath, { force: true });
        await fs.rm(metaPath(filePath), { force: true });
      })
    );
  }

  async list(prefix: string): Promise<BlobListResult> {
    const objects = await walkFiles(this.rootDir, prefix);
    return { objects };
  }
}

export async function ensureLocalStorageRoot(rootDir: string): Promise<void> {
  await fs.mkdir(rootDir, { recursive: true });
}
