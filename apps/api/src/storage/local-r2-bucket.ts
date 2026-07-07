import fs from "node:fs/promises";
import path from "node:path";

interface StoredObjectMeta {
  httpMetadata?: R2HTTPMetadata;
  customMetadata?: Record<string, string>;
}

function toBuffer(data: string | ArrayBuffer | Uint8Array): Buffer {
  if (typeof data === "string") {
    return Buffer.from(data);
  }
  return Buffer.from(data);
}

function metaPath(filePath: string): string {
  return `${filePath}.meta.json`;
}

async function readMeta(filePath: string): Promise<StoredObjectMeta> {
  try {
    const raw = await fs.readFile(metaPath(filePath), "utf8");
    return JSON.parse(raw) as StoredObjectMeta;
  } catch {
    return {};
  }
}

async function writeMeta(
  filePath: string,
  meta: StoredObjectMeta
): Promise<void> {
  await fs.writeFile(metaPath(filePath), JSON.stringify(meta));
}

function createObjectBody(
  filePath: string,
  data: Buffer,
  meta: StoredObjectMeta
): R2ObjectBody {
  return {
    key: filePath,
    version: "local",
    size: data.byteLength,
    etag: `"${data.byteLength}"`,
    httpEtag: `"${data.byteLength}"`,
    checksums: {},
    uploaded: new Date(),
    httpMetadata: meta.httpMetadata ?? {},
    customMetadata: meta.customMetadata ?? {},
    range: undefined,
    arrayBuffer: async () =>
      data.buffer.slice(
        data.byteOffset,
        data.byteOffset + data.byteLength
      ) as ArrayBuffer,
    text: async () => data.toString("utf8"),
    json: async () => JSON.parse(data.toString("utf8")) as object,
    blob: async () =>
      new Blob([data], { type: meta.httpMetadata?.contentType }),
  } as R2ObjectBody;
}

async function walkFiles(
  rootDir: string,
  prefix: string
): Promise<R2Object[]> {
  const targetDir = path.join(rootDir, prefix);
  const objects: R2Object[] = [];

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
        version: "local",
        size: stat.size,
        etag: `"${stat.size}"`,
        httpEtag: `"${stat.size}"`,
        checksums: {},
        uploaded: stat.mtime,
        httpMetadata: meta.httpMetadata ?? {},
        customMetadata: meta.customMetadata ?? {},
      });
    }
  }

  await walk(targetDir, prefix.replace(/\/$/, ""));
  return objects;
}

export class LocalR2Bucket implements R2Bucket {
  constructor(private readonly rootDir: string) {}

  async head(_key: string): Promise<R2Object | null> {
    return null;
  }

  async get(key: string): Promise<R2ObjectBody | null> {
    const filePath = path.join(this.rootDir, key);
    try {
      const data = await fs.readFile(filePath);
      const meta = await readMeta(filePath);
      return createObjectBody(key, data, meta);
    } catch {
      return null;
    }
  }

  async put(
    key: string,
    data: string | ArrayBuffer | Uint8Array | ReadableStream | Blob | null,
    options?: R2PutOptions
  ): Promise<R2Object | null> {
    if (data === null) {
      await this.delete(key);
      return null;
    }
    if (data instanceof ReadableStream || data instanceof Blob) {
      throw new Error("LocalR2Bucket does not support stream uploads yet");
    }

    const filePath = path.join(this.rootDir, key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, toBuffer(data));
    await writeMeta(filePath, {
      httpMetadata: options?.httpMetadata,
      customMetadata: options?.customMetadata,
    });

    const stat = await fs.stat(filePath);
    return {
      key,
      version: "local",
      size: stat.size,
      etag: `"${stat.size}"`,
      httpEtag: `"${stat.size}"`,
      checksums: {},
      uploaded: stat.mtime,
      httpMetadata: options?.httpMetadata ?? {},
      customMetadata: options?.customMetadata ?? {},
    };
  }

  async delete(keys: string | string[]): Promise<void> {
    const keyList = Array.isArray(keys) ? keys : [keys];
    await Promise.all(
      keyList.map(async (key) => {
        const filePath = path.join(this.rootDir, key);
        await fs.rm(filePath, { force: true });
        await fs.rm(metaPath(filePath), { force: true });
      })
    );
  }

  async list(options?: R2ListOptions): Promise<R2Objects> {
    const prefix = options?.prefix ?? "";
    const objects = await walkFiles(this.rootDir, prefix);
    return {
      objects,
      truncated: false,
      delimitedPrefixes: [],
    };
  }
}

export async function ensureLocalStorageRoot(rootDir: string): Promise<void> {
  await fs.mkdir(rootDir, { recursive: true });
}
