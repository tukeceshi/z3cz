import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type {
  SystemUpdateOperation,
  SystemUpdateSourceChannel,
} from "@dafthunk/types";

const MAX_PACKAGE_BYTES = 512 * 1024 * 1024;
const VERSION_RE = /^v\d+\.\d+\.\d+(?:[.-][0-9A-Za-z.-]+)?$/;

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
  source: SystemUpdateSourceChannel,
  version: string,
  asset: string
): string[] {
  if (
    !VERSION_RE.test(version) ||
    !/^z3cz-v[0-9A-Za-z.-]+-deploy\.tar\.gz$|^SHA256SUMS$/.test(asset)
  ) {
    throw new Error("更新版本或资产名称无效");
  }
  const github = `https://github.com/${repository}/releases/download/${version}/${asset}`;
  if (source === "gitee") {
    throw new Error("Gitee 附件地址必须通过 Release API 解析");
  }
  const mirror = String(
    process.env.Z3CZ_GITHUB_MIRROR || "https://ghfast.top"
  ).replace(/\/$/, "");
  return [github, `${mirror}/${github}`];
}

export async function resolveReleaseAssetUrls(
  repository: string,
  source: SystemUpdateSourceChannel,
  version: string,
  asset: string,
  fetchImpl: typeof fetch = fetch
): Promise<string[]> {
  if (source === "github") {
    return releaseAssetUrls(repository, source, version, asset);
  }
  if (
    !VERSION_RE.test(version) ||
    !/^z3cz-v[0-9A-Za-z.-]+-deploy\.tar\.gz$|^SHA256SUMS$/.test(asset)
  ) {
    throw new Error("更新版本或资产名称无效");
  }
  const api = `https://gitee.com/api/v5/repos/${repository}`;
  const releaseResponse = await fetchImpl(`${api}/releases/tags/${version}`, {
    headers: { "User-Agent": "z3cz-admin-updater" },
  });
  if (!releaseResponse.ok) {
    throw new Error(`Gitee Release 返回 HTTP ${releaseResponse.status}`);
  }
  const release = (await releaseResponse.json()) as { id?: number };
  if (!Number.isInteger(release.id)) throw new Error("Gitee Release 缺少 ID");
  const attachmentsResponse = await fetchImpl(
    `${api}/releases/${release.id}/attach_files`,
    { headers: { "User-Agent": "z3cz-admin-updater" } }
  );
  if (!attachmentsResponse.ok) {
    throw new Error(
      `Gitee Release 附件返回 HTTP ${attachmentsResponse.status}`
    );
  }
  const attachments = (await attachmentsResponse.json()) as Array<{
    id?: number;
    name?: string;
  }>;
  const attachment = attachments.find((entry) => entry.name === asset);
  if (!attachment || !Number.isInteger(attachment.id)) {
    throw new Error(`Gitee Release 缺少附件 ${asset}`);
  }
  return [
    `${api}/releases/${release.id}/attach_files/${attachment.id}/download`,
  ];
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
  onProgress?: (downloaded: number, total?: number) => void
) {
  let failure: Error | undefined;
  for (const url of urls) {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "z3cz-admin-updater" },
      });
      if (!response.ok || !response.body)
        throw new Error(`下载返回 HTTP ${response.status}`);
      const total =
        Number(response.headers.get("content-length") || 0) || undefined;
      if (total && total > MAX_PACKAGE_BYTES)
        throw new Error("更新包超过大小限制");
      let downloaded = 0;
      const digest = crypto.createHash("sha256") as unknown as {
        update(data: Uint8Array): void;
        digest(encoding: "hex"): string;
      };
      const stream = Readable.fromWeb(response.body as never);
      stream.on("data", (chunk: Buffer) => {
        downloaded += chunk.length;
        if (downloaded > MAX_PACKAGE_BYTES)
          stream.destroy(new Error("更新包超过大小限制"));
        digest.update(chunk);
        onProgress?.(downloaded, total);
      });
      const partial = `${destination}.partial`;
      await pipeline(stream, fs.createWriteStream(partial, { mode: 0o600 }));
      fs.renameSync(partial, destination);
      return { checksum: digest.digest("hex"), size: downloaded };
    } catch (error) {
      fs.rmSync(`${destination}.partial`, { force: true });
      failure = error instanceof Error ? error : new Error(String(error));
    }
  }
  throw failure || new Error("下载失败");
}

export async function prepareSystemUpdate(options: {
  repository: string;
  source: SystemUpdateSourceChannel;
  version: string;
  root: string;
  store: PreparationStore;
}): Promise<PreparedUpdate> {
  const { repository, source, version, root, store } = options;
  if (!VERSION_RE.test(version)) throw new Error("目标版本无效");
  const id = crypto.randomUUID();
  const directory = path.join(root, "downloads", version);
  fs.mkdirSync(directory, { recursive: true });
  const asset = `z3cz-${version}-deploy.tar.gz`;
  const archivePath = path.join(directory, asset);
  const sumsPath = path.join(directory, "SHA256SUMS");
  let operation: SystemUpdateOperation = {
    id,
    phase: "downloading",
    fromVersion: process.env.APP_VERSION || "unknown",
    targetVersion: version,
    startedAt: new Date().toISOString(),
    automaticRollback: false,
    progress: 0,
    downloadedBytes: 0,
    logs: [],
  };
  operation = appendLog(
    operation,
    "downloading",
    `从 ${source === "gitee" ? "Gitee" : "GitHub"} 下载 ${version}`
  );
  store.write(operation);
  const sumsUrls = await resolveReleaseAssetUrls(
    repository,
    source,
    version,
    "SHA256SUMS"
  );
  await fetchAsset(sumsUrls, sumsPath);
  let lastPersisted = 0;
  const assetUrls = await resolveReleaseAssetUrls(
    repository,
    source,
    version,
    asset
  );
  const result = await fetchAsset(
    assetUrls,
    archivePath,
    (downloaded, total) => {
      if (downloaded - lastPersisted < 1024 * 1024 && downloaded !== total)
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
      store.write(operation);
    }
  );
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
