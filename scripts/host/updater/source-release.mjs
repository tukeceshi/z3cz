import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { databaseFingerprint, readUpdatePolicy } from "./update-policy.mjs";

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

export function sourceRemote(repository) {
  return `https://github.com/${repository}.git`;
}

export function installationId(hostDir) {
  return createHash("sha256")
    .update(path.resolve(hostDir))
    .digest("hex")
    .slice(0, 16);
}

// Only this owned checkout is mutable; running containers use immutable images.
export async function prepareSourceRelease({
  hostDir,
  repository,
  ref,
  version,
  run,
  log,
  progress,
}) {
  validateSourceRef(ref);
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository))
    throw new Error("源码仓库地址无效");
  const shared = path.resolve(hostDir, "shared");
  const cache = path.join(shared, "source.git");
  const buildDir = path.join(shared, "build");
  const sourceDir = path.join(buildDir, "source");
  for (const dir of [shared, buildDir, sourceDir]) {
    if (fs.existsSync(dir) && fs.lstatSync(dir).isSymbolicLink())
      throw new Error("构建目录不能使用符号链接");
  }
  fs.mkdirSync(buildDir, { recursive: true });
  const ownerFile = path.join(buildDir, "owner.json");
  const owner = installationId(hostDir);
  const existing = fs.existsSync(sourceDir);
  if (
    existing &&
    (!fs.existsSync(ownerFile) || fs.readFileSync(ownerFile, "utf8") !== owner)
  ) {
    throw new Error("构建目录不是更新器创建的，请检查 shared/build");
  }
  await run(hostDir, "git", ["--version"]);
  if (!fs.existsSync(cache))
    await run(hostDir, "git", ["init", "--bare", cache]);
  log("从 GitHub 增量获取目标版本");
  await run(
    hostDir,
    "git",
    [
      "--git-dir",
      cache,
      "fetch",
      "--no-tags",
      sourceRemote(repository),
      ref.startsWith("v") ? `refs/tags/${ref}` : ref,
    ],
    { timeoutMs: 10 * 60_000 }
  );
  const commit = (
    await run(hostDir, "git", [
      "--git-dir",
      cache,
      "rev-parse",
      "FETCH_HEAD^{commit}",
    ])
  ).stdout.trim();
  if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error("无法确认目标提交");
  if (existing) {
    const root = (
      await run(hostDir, "git", [
        "-C",
        sourceDir,
        "rev-parse",
        "--show-toplevel",
      ])
    ).stdout.trim();
    if (path.resolve(root) !== sourceDir)
      throw new Error("构建目录不是独立工作区");
    const changes = (
      await run(hostDir, "git", [
        "-C",
        sourceDir,
        "status",
        "--porcelain",
        "--untracked-files=all",
      ])
    ).stdout.trim();
    if (changes)
      throw new Error("构建目录存在本地修改，已停止更新以保留这些文件");
    await run(hostDir, "git", [
      "-C",
      sourceDir,
      "checkout",
      "--detach",
      commit,
    ]);
  } else {
    await run(hostDir, "git", [
      "--git-dir",
      cache,
      "worktree",
      "add",
      "--detach",
      sourceDir,
      commit,
    ]);
    fs.writeFileSync(ownerFile, owner, { mode: 0o600 });
  }
  if (
    ref.startsWith("v") &&
    fs.readFileSync(path.join(sourceDir, "VERSION"), "utf8").trim() !== ref
  )
    throw new Error("源码 VERSION 与正式版本标签不一致");
  if (
    fs
      .readFileSync(path.join(sourceDir, "docker/source-protocol"), "utf8")
      .trim() !== "2"
  )
    throw new Error("目标版本与镜像构建协议不一致，请使用配套部署包");
  const policy = readUpdatePolicy(sourceDir);
  if (!policy || policy.format !== 2)
    throw new Error("目标版本缺少新版更新说明");
  const fingerprint = databaseFingerprint(sourceDir);
  const runtime = runtimeImage(
    fs.readFileSync(path.join(sourceDir, "docker/Dockerfile.source"), "utf8")
  );
  for (const image of [
    runtime,
    "nginx:1.27-alpine",
    "postgres:16-alpine",
    "caddy:2.9-alpine",
  ]) {
    try {
      await run(hostDir, "docker", ["image", "inspect", image]);
    } catch {
      log(`下载基础环境：${image}`);
      await run(hostDir, "docker", ["pull", image]);
    }
  }
  const ids = [];
  for (const target of ["api", "app"]) {
    const tag = `z3cz-local-${owner}/${target}:${commit}`;
    log(
      `构建 ${target === "api" ? "后端" : "前端"}镜像，复用已有依赖与构建缓存`
    );
    await run(
      hostDir,
      "docker",
      [
        "build",
        "--file",
        path.join(sourceDir, "docker/Dockerfile.update"),
        "--target",
        target,
        "--build-arg",
        `RUNTIME_IMAGE=${runtime}`,
        "--label",
        `org.z3cz.installation=${owner}`,
        "--label",
        `org.opencontainers.image.revision=${commit}`,
        "--tag",
        tag,
        sourceDir,
      ],
      {
        timeoutMs: 60 * 60_000,
        env: { DOCKER_BUILDKIT: "1" },
        onOutput: (chunk) => {
          if (typeof progress !== "function") return;
          const line = chunk
            .trim()
            .split(/[\r\n]+/)
            .at(-1);
          if (line) progress(line.slice(-500));
        },
      }
    );
    const id = (
      await run(hostDir, "docker", [
        "image",
        "inspect",
        tag,
        "--format",
        "{{.Id}}",
      ])
    ).stdout.trim();
    if (!/^sha256:[a-f0-9]{64}$/.test(id)) throw new Error("无法锁定应用镜像");
    ids.push(id);
  }
  return {
    kind: "image",
    commit,
    version,
    runtimeImage: ids[0],
    appImage: ids[1],
    runtimeTag: runtime,
    databaseFingerprint: fingerprint,
    updatePolicy: policy,
  };
}

export async function cleanupReleases(manager) {
  const active = JSON.parse(
    fs.readFileSync(
      path.join(manager.hostDir, "source-deployment.json"),
      "utf8"
    )
  );
  if (active.kind !== "image") return;
  const keep = new Set([active.runtimeImage, active.appImage]);
  const rollback =
    manager.state.rollbackDeployment?.["docker-compose.generated.yml"];
  if (rollback) {
    const services = JSON.parse(rollback).services;
    keep.add(services.api.image);
    keep.add(services.app.image);
  }
  const found = await manager.runCommand(manager.hostDir, "docker", [
    "image",
    "ls",
    "--no-trunc",
    "--filter",
    `label=org.z3cz.installation=${installationId(manager.hostDir)}`,
    "--format",
    "{{.ID}}",
  ]);
  for (const id of new Set(found.stdout.trim().split(/\r?\n/))) {
    if (!/^sha256:[a-f0-9]{64}$/.test(id) || keep.has(id)) continue;
    // No force: Docker refuses to remove images still referenced by any container.
    await manager
      .runCommand(manager.hostDir, "docker", ["image", "rm", id])
      .catch(() => {});
  }
}
