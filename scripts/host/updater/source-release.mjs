import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";

export function runtimeImage(dockerfile) {
  const hash = createHash("sha256")
    .update(dockerfile.replaceAll("\r\n", "\n"))
    .digest("hex");
  return `tukeceshi/z3cz-runtime:env-${hash.slice(0, 20)}`;
}

export function validateSourceRef(ref) {
  if (!/^(?:v\d+\.\d+\.\d+|[a-f0-9]{40})$/.test(ref)) {
    throw new Error("源码更新只接受正式版本标签或完整提交编号");
  }
}

// Keep the repository cache separate from built releases. Never reset a running checkout.
export async function prepareSourceRelease({
  hostDir,
  repository,
  ref,
  version,
  run,
  log,
}) {
  validateSourceRef(ref);
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository))
    throw new Error("源码仓库地址无效");
  const shared = path.join(hostDir, "shared");
  const cache = path.join(shared, "source.git");
  const releases = path.join(shared, "releases");
  const store = path.join(shared, "pnpm-store");
  fs.mkdirSync(releases, { recursive: true });
  fs.mkdirSync(store, { recursive: true });
  await run(hostDir, "git", ["--version"]);
  if (!fs.existsSync(cache))
    await run(hostDir, "git", ["init", "--bare", cache]);
  log("获取目标版本代码（复用已有 Git 对象）");
  const remote =
    process.env.Z3CZ_SOURCE_REMOTE || `https://github.com/${repository}.git`;
  if (!remote.startsWith("https://"))
    throw new Error("源码远程地址必须使用 HTTPS");
  await run(
    hostDir,
    "git",
    [
      "--git-dir",
      cache,
      "fetch",
      "--no-tags",
      remote,
      ref.startsWith("v") ? `refs/tags/${ref}` : ref,
    ],
    { timeoutMs: 10 * 60_000 }
  );
  const result = await run(hostDir, "git", [
    "--git-dir",
    cache,
    "rev-parse",
    "FETCH_HEAD^{commit}",
  ]);
  const commit = result.stdout.trim();
  if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error("无法确认目标提交");
  const sourceDir = path.join(
    releases,
    `${commit}-${randomUUID().slice(0, 8)}`
  );
  await run(hostDir, "git", [
    "--git-dir",
    cache,
    "worktree",
    "add",
    "--detach",
    sourceDir,
    commit,
  ]);
  if (
    ref.startsWith("v") &&
    fs.readFileSync(path.join(sourceDir, "VERSION"), "utf8").trim() !== ref
  ) {
    throw new Error("源码 VERSION 与正式版本标签不一致");
  }
  const runtime = runtimeImage(
    fs.readFileSync(path.join(sourceDir, "docker", "Dockerfile.source"), "utf8")
  );
  const protocol = fs
    .readFileSync(path.join(sourceDir, "docker/source-protocol"), "utf8")
    .trim();
  if (protocol !== "1")
    throw new Error("此版本需要先更新宿主机更新器，请安装目标版本部署包");
  const appImage = "nginx:1.27-alpine";
  for (const image of [
    runtime,
    appImage,
    "postgres:16-alpine",
    "caddy:2.9-alpine",
  ]) {
    try {
      await run(hostDir, "docker", ["image", "inspect", image]);
    } catch {
      log(`基础环境需要下载：${image}`);
      await run(hostDir, "docker", ["pull", image]);
    }
  }
  log("安装依赖并构建前端；当前服务继续运行");
  const container = `z3cz-build-${randomUUID()}`;
  let lastLog = 0;
  try {
    await run(
      hostDir,
      "docker",
      [
        "run",
        "--rm",
        "--name",
        container,
        "--pull=never",
        "--mount",
        `type=bind,source=${sourceDir},target=/app`,
        "--mount",
        `type=bind,source=${store},target=/pnpm-store`,
        "-w",
        "/app",
        "-e",
        "NODE_OPTIONS=--max-old-space-size=2048",
        "-e",
        "VITE_API_HOST=/api",
        "-e",
        "VITE_WS_VIA_PROXY=1",
        runtime,
        "sh",
        "-ec",
        "pnpm install --frozen-lockfile --store-dir /pnpm-store --package-import-method copy && pnpm --filter @dafthunk/types build && pnpm --filter @dafthunk/app build:docker-prod",
      ],
      {
        timeoutMs: 60 * 60_000,
        onOutput: (chunk) => {
          if (Date.now() - lastLog < 2000) return;
          lastLog = Date.now();
          const line = chunk
            .trim()
            .split(/[\r\n]+/)
            .at(-1);
          if (line) log(line.slice(-500));
        },
      }
    );
  } finally {
    await run(hostDir, "docker", ["rm", "-f", container]).catch(() => {});
  }
  if (!fs.existsSync(path.join(sourceDir, "apps/app/dist/index.html"))) {
    throw new Error("前端构建结果缺少 index.html");
  }
  fs.mkdirSync(path.join(sourceDir, "data/storage"), { recursive: true });
  // Pin both runtime images locally. A rollback never resolves a mutable registry tag.
  const ids = [];
  for (const image of [runtime, appImage]) {
    const inspected = await run(hostDir, "docker", [
      "image",
      "inspect",
      image,
      "--format",
      "{{.Id}}",
    ]);
    const id = inspected.stdout.trim();
    if (!/^sha256:[a-f0-9]{64}$/.test(id))
      throw new Error("无法锁定基础环境镜像");
    ids.push(id);
  }
  return {
    sourceDir,
    commit,
    version,
    runtimeImage: ids[0],
    appImage: ids[1],
    runtimeTag: runtime,
  };
}
