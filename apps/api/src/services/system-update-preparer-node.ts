import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { SystemUpdateOperation } from "@dafthunk/types";

const MAX_PACKAGE_BYTES = 512 * 1024 * 1024;
const VERSION_RE = /^v\d+\.\d+\.\d+(?:[.-][0-9A-Za-z.-]+)?$/;
const PROGRESS_PERSIST_BYTES = 1024 * 1024;

export const ABORT_MESSAGE = "已中止更新下载";
export const ABORT_NOT_ALLOWED_MESSAGE = "仅下载过程可以中止";

export interface PreparedUpdate {
  readonly archivePath: string;
  readonly checksum: string;
  readonly version: string;
}

export interface PreparationStore {
  read(): SystemUpdateOperation | undefined;
  write(operation: SystemUpdateOperation): void;
}

export function createPreparationStore(root: string): PreparationStore {
  fs.mkdirSync(root, { recursive: true });
  const statePath = path.join(root, "preparation.json");
  return {
    read() {
      try {
        return JSON.parse(fs.readFileSync(statePath, "utf8"));
      } catch {
        return undefined;
      }
    },
    write(operation) {
      const temporary = `${statePath}.tmp`;
      fs.writeFileSync(temporary, JSON.stringify(operation, null, 2), {
        mode: 0o600,
      });
      fs.renameSync(temporary, statePath);
    },
  };
}

export function releaseAssetUrls(
  repository: string,
  version: string,
  asset: string
): string[] {
  if (
    !/^[\w.-]+\/[\w.-]+$/.test(repository) ||
    !VERSION_RE.test(version) ||
    !/^z3cz-v[0-9A-Za-z.-]+-deploy\.tar\.gz$|^SHA256SUMS$/.test(asset)
  ) {
    throw new Error("更新版本或资产名称无效");
  }
  const github = `https://github.com/${repository}/releases/download/${version}/${asset}`;
  return [github];
}

export function isUpdateAbortError(error: unknown): boolean {
  return (
    (error instanceof Error && error.name === "AbortError") ||
    (error instanceof Error && error.message === ABORT_MESSAGE)
  );
}

export function abortPreparation(
  store: PreparationStore,
  root: string
): SystemUpdateOperation {
  const current = store.read();
  if (current?.phase === "failed" && current.error === ABORT_MESSAGE) {
    return current;
  }
  if (current?.phase !== "downloading") {
    throw new Error(ABORT_NOT_ALLOWED_MESSAGE);
  }
  if (current.targetVersion) {
    fs.rmSync(path.join(root, "downloads", current.targetVersion), {
      recursive: true,
      force: true,
    });
  }
  const next: SystemUpdateOperation = {
    ...current,
    phase: "failed",
    error: ABORT_MESSAGE,
    finishedAt: new Date().toISOString(),
    files: current.files?.map((file) =>
      file.status === "complete" ? file : { ...file, status: "failed" as const }
    ),
    logs: [
      ...current.logs,
      {
        at: new Date().toISOString(),
        phase: "failed" as const,
        message: ABORT_MESSAGE,
      },
    ].slice(-120),
  };
  store.write(next);
  return next;
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new Error(ABORT_MESSAGE);
  }
}

function appendLog(
  operation: SystemUpdateOperation,
  phase: SystemUpdateOperation["phase"],
  message: string
): SystemUpdateOperation {
  return {
    ...operation,
    phase,
    logs: [
      ...operation.logs,
      { at: new Date().toISOString(), phase, message },
    ].slice(-120),
  };
}

async function fetchAsset(
  urls: string[],
  destination: string,
  onProgress?: (downloaded: number, total?: number) => void,
  limitBytes = MAX_PACKAGE_BYTES,
  signal?: AbortSignal
) {
  let failure: Error | undefined;
  for (const url of urls) {
    throwIfAborted(signal);
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "z3cz-admin-updater" },
        signal,
      });
      if (!response.ok || !response.body)
        throw new Error(`下载返回 HTTP ${response.status}`);
      const total =
        Number(response.headers.get("content-length") || 0) || undefined;
      if (total && total > limitBytes) throw new Error("更新包超过大小限制");
      let downloaded = 0;
      const digest = crypto.createHash("sha256") as unknown as {
        update(data: Uint8Array): void;
        digest(encoding: "hex"): string;
      };
      const stream = Readable.fromWeb(response.body as never);
      const onAbort = () => stream.destroy(new Error(ABORT_MESSAGE));
      signal?.addEventListener("abort", onAbort, { once: true });
      stream.on("data", (chunk: Buffer) => {
        downloaded += chunk.length;
        if (downloaded > limitBytes)
          stream.destroy(new Error("更新包超过大小限制"));
        digest.update(chunk);
        try {
          onProgress?.(downloaded, total);
        } catch (error) {
          stream.destroy(
            error instanceof Error ? error : new Error(ABORT_MESSAGE)
          );
        }
      });
      const partial = `${destination}.partial`;
      try {
        await pipeline(stream, fs.createWriteStream(partial, { mode: 0o600 }));
      } finally {
        signal?.removeEventListener("abort", onAbort);
      }
      fs.renameSync(partial, destination);
      return { checksum: digest.digest("hex"), size: downloaded };
    } catch (error) {
      fs.rmSync(`${destination}.partial`, { force: true });
      if (signal?.aborted || isUpdateAbortError(error)) {
        throw new Error(ABORT_MESSAGE);
      }
      failure = error instanceof Error ? error : new Error(String(error));
    }
  }
  throw failure || new Error("下载失败");
}

export async function prepareSystemUpdate(options: {
  repository: string;
  version: string;
  root: string;
  store: PreparationStore;
  signal?: AbortSignal;
}): Promise<PreparedUpdate> {
  const { repository, version, root, store, signal } = options;
  if (!VERSION_RE.test(version)) throw new Error("目标版本无效");
  throwIfAborted(signal);
  const id = crypto.randomUUID();
  const directory = path.join(root, "downloads", version);
  fs.mkdirSync(directory, { recursive: true });
  const asset = `z3cz-${version}-deploy.tar.gz`;
  const archivePath = path.join(directory, asset);
  const sumsPath = path.join(directory, "SHA256SUMS");
  let operation: SystemUpdateOperation = {
    id,
    phase: "downloading",
    downloadMethod: "service",
    fromVersion: process.env.APP_VERSION || "unknown",
    targetVersion: version,
    startedAt: new Date().toISOString(),
    automaticRollback: false,
    progress: 0,
    downloadedBytes: 0,
    files: [
      { name: "SHA256SUMS", downloadedBytes: 0, status: "pending" },
      { name: asset, downloadedBytes: 0, status: "pending" },
    ],
    logs: [],
  };
  operation = appendLog(operation, "downloading", `从 GitHub 下载 ${version}`);
  store.write(operation);
  const setFile = (
    name: string,
    downloadedBytes: number,
    totalBytes: number | undefined,
    status: "pending" | "downloading" | "complete" | "failed"
  ) => {
    throwIfAborted(signal);
    operation = {
      ...operation,
      files: operation.files?.map((file) =>
        file.name === name
          ? { name, downloadedBytes, totalBytes, status }
          : file
      ),
    };
    store.write(operation);
  };
  setFile("SHA256SUMS", 0, undefined, "downloading");
  const sumsResult = await fetchAsset(
    releaseAssetUrls(repository, version, "SHA256SUMS"),
    sumsPath,
    (downloaded, total) =>
      setFile("SHA256SUMS", downloaded, total, "downloading"),
    1024 * 1024,
    signal
  );
  setFile("SHA256SUMS", sumsResult.size, sumsResult.size, "complete");
  let lastPersisted = 0;
  const assetUrls = releaseAssetUrls(repository, version, asset);
  setFile(asset, 0, undefined, "downloading");
  const result = await fetchAsset(
    assetUrls,
    archivePath,
    (downloaded, total) => {
      if (
        downloaded - lastPersisted < PROGRESS_PERSIST_BYTES &&
        downloaded !== total
      )
        return;
      lastPersisted = downloaded;
      operation = {
        ...operation,
        downloadedBytes: downloaded,
        totalBytes: total,
        progress: total
          ? Math.min(99, Math.floor((downloaded * 100) / total))
          : undefined,
      };
      setFile(asset, downloaded, total, "downloading");
    },
    MAX_PACKAGE_BYTES,
    signal
  );
  setFile(asset, result.size, result.size, "complete");
  operation = appendLog(
    {
      ...operation,
      phase: "verifying_download",
      progress: 100,
      packageChecksum: result.checksum,
    },
    "verifying_download",
    "下载完成，正在校验 SHA-256"
  );
  store.write(operation);
  const expected = fs
    .readFileSync(sumsPath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim().split(/\s+/))
    .find((fields) => fields[1] === asset)?.[0];
  if (
    !expected ||
    !/^[a-f0-9]{64}$/.test(expected) ||
    expected !== result.checksum
  ) {
    fs.rmSync(archivePath, { force: true });
    throw new Error("Release SHA-256 校验失败");
  }
  operation = appendLog(
    { ...operation, phase: "preparing" },
    "preparing",
    "更新包已验证，等待宿主机执行切换事务"
  );
  store.write(operation);
  return { archivePath, checksum: result.checksum, version };
}

export async function receiveUploadedAsset(options: {
  version: string;
  name: string;
  root: string;
  body: ReadableStream<Uint8Array>;
  store: PreparationStore;
  totalBytes?: number;
  signal?: AbortSignal;
}): Promise<void> {
  const { version, name, root, body, store, totalBytes, signal } = options;
  throwIfAborted(signal);
  releaseAssetUrls("tukeceshi/z3cz", version, name);
  if (name !== "SHA256SUMS" && name !== `z3cz-${version}-deploy.tar.gz`)
    throw new Error("上传文件名与版本不匹配");
  const directory = path.join(root, "downloads", version);
  fs.mkdirSync(directory, { recursive: true });
  const destination = path.join(directory, name);
  const partial = `${destination}.partial`;
  const persist = (
    downloadedBytes: number,
    status: "downloading" | "complete"
  ) => {
    throwIfAborted(signal);
    const current = store.read();
    if (!current || current.phase !== "downloading") {
      throw new Error(ABORT_MESSAGE);
    }
    store.write({
      ...current,
      files: current.files?.map((file) =>
        file.name === name
          ? {
              name,
              downloadedBytes,
              totalBytes: totalBytes || downloadedBytes,
              status,
            }
          : file
      ),
    });
  };
  persist(0, "downloading");
  let downloadedBytes = 0;
  let lastPersisted = 0;
  try {
    const stream = Readable.fromWeb(body as never);
    const onAbort = () => stream.destroy(new Error(ABORT_MESSAGE));
    signal?.addEventListener("abort", onAbort, { once: true });
    stream.on("data", (chunk: Buffer) => {
      downloadedBytes += chunk.length;
      if (
        downloadedBytes >
        (name === "SHA256SUMS" ? 1024 * 1024 : MAX_PACKAGE_BYTES)
      )
        stream.destroy(new Error("上传文件超过大小限制"));
      if (
        downloadedBytes - lastPersisted < PROGRESS_PERSIST_BYTES &&
        downloadedBytes !== totalBytes
      )
        return;
      lastPersisted = downloadedBytes;
      try {
        persist(downloadedBytes, "downloading");
      } catch (error) {
        stream.destroy(
          error instanceof Error ? error : new Error(ABORT_MESSAGE)
        );
      }
    });
    try {
      await pipeline(stream, fs.createWriteStream(partial, { mode: 0o600 }));
    } finally {
      signal?.removeEventListener("abort", onAbort);
    }
    if (downloadedBytes === 0) throw new Error("上传文件为空");
    fs.renameSync(partial, destination);
    persist(downloadedBytes, "complete");
  } catch (error) {
    fs.rmSync(partial, { force: true });
    throw isUpdateAbortError(error) ? new Error(ABORT_MESSAGE) : error;
  }
}

export async function prepareUploadedUpdate(options: {
  version: string;
  root: string;
  store: PreparationStore;
}): Promise<PreparedUpdate> {
  const { version, root, store } = options;
  if (!VERSION_RE.test(version)) throw new Error("目标版本无效");
  const directory = path.join(root, "downloads", version);
  const asset = `z3cz-${version}-deploy.tar.gz`;
  const archivePath = path.join(directory, asset);
  const sumsPath = path.join(directory, "SHA256SUMS");
  if (!fs.existsSync(archivePath) || !fs.existsSync(sumsPath))
    throw new Error("请先上传部署包和 SHA256SUMS");
  const current = store.read();
  if (current && current.phase === "downloading") {
    store.write(
      appendLog(
        { ...current, phase: "verifying_download" },
        "verifying_download",
        "上传完成，正在校验 SHA-256"
      )
    );
  }
  const sums = fs.readFileSync(sumsPath, "utf8");
  if (Buffer.byteLength(sums) > 1024 * 1024)
    throw new Error("SHA256SUMS 文件过大");
  const expected = sums
    .split(/\r?\n/)
    .map((line) => line.trim().split(/\s+/))
    .find((fields) => fields[1] === asset)?.[0];
  if (!expected || !/^[a-f0-9]{64}$/.test(expected))
    throw new Error("SHA256SUMS 未包含目标部署包");
  const digest = crypto.createHash("sha256");
  for await (const chunk of fs.createReadStream(archivePath))
    digest.update(chunk as Buffer);
  const checksum = digest.digest("hex");
  if (checksum !== expected) throw new Error("Release SHA-256 校验失败");
  const operation = store.read();
  if (operation)
    store.write(
      appendLog(
        { ...operation, phase: "preparing", packageChecksum: checksum },
        "preparing",
        "上传文件已验证，等待宿主机执行切换事务"
      )
    );
  return { archivePath, checksum, version };
}
