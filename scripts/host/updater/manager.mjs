import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { spawn } from "node:child_process";

import {
  checkBackupDiskSpace,
  createBackup,
  restoreBackup,
  sha256File,
} from "./backup.mjs";
import { createComposeRunner, runCommand } from "./docker.mjs";
import {
  checksumForAsset,
  downloadReleaseAsset,
  fetchLatestRelease,
  updaterArch,
  updaterAssetName,
} from "./github.mjs";
import { applyHostPack } from "./host-pack.mjs";
import {
  parseAppYml,
  stringifyAppYml,
} from "../../../docker-host/lib/parse-app-yml.mjs";
import {
  apiImageName,
  appImageName,
  appYmlPath,
  composePath,
  defaultBackupDir,
  defaultRepository,
  defaultStateDir,
  envPath,
  hostDir,
  storageDir,
} from "./paths.mjs";
import {
  compareVersions,
  displayVersion,
  dockerImageTag,
  isReleaseVersion,
} from "./version.mjs";

const ACTIVE = new Set([
  "preflight",
  "backing_up",
  "pulling",
  "draining",
  "migrating",
  "switching",
  "verifying",
  "rolling_back",
]);

function emptyOperation() {
  return {
    phase: "idle",
    automaticRollback: false,
    logs: [],
  };
}

function emptyState() {
  return {
    latestRelease: undefined,
    lastBackup: undefined,
    rollbackVersion: "",
    operation: emptyOperation(),
  };
}

export class UpdateManager {
  /**
   * @param {Partial<{
   *   repository: string,
   *   installDir: string,
   *   hostDir: string,
   *   appYmlPath: string,
   *   composePath: string,
   *   envPath: string,
   *   stateDir: string,
   *   backupDir: string,
   *   storageDir: string,
   *   githubToken: string,
   *   stableMs: number,
   *   installDir: string,
   *   binaryPath: string,
   *   serviceName: string,
   *   selfUpdate: boolean,
   *   fetchLatest: typeof fetchLatestRelease,
   *   compose: ReturnType<typeof createComposeRunner>,
   *   runCommand: typeof runCommand,
   *   downloadAsset: typeof downloadReleaseAsset,
   *   applyHostPack: typeof applyHostPack,
   *   replaceBinary: (source: string, dest: string) => void,
   *   restartService: () => void,
   *   sleep: (ms: number) => Promise<void>
   * }>} [options]
   */
  constructor(options = {}) {
    this.repository = options.repository || defaultRepository;
    this.hostDir = options.hostDir || hostDir;
    this.installDir =
      options.installDir || path.dirname(this.hostDir);
    this.appYmlPath = options.appYmlPath || appYmlPath;
    this.composePath = options.composePath || composePath;
    this.envPath = options.envPath || envPath;
    this.stateDir = options.stateDir || defaultStateDir;
    this.backupDir = options.backupDir || defaultBackupDir;
    this.storageDir = options.storageDir || storageDir;
    this.binaryPath =
      options.binaryPath ||
      process.env.Z3CZ_UPDATER_BINARY_PATH ||
      "/usr/local/bin/z3cz-host-updater";
    this.serviceName =
      options.serviceName ||
      process.env.Z3CZ_UPDATER_SERVICE_NAME ||
      "z3cz-updater.service";
    this.selfUpdate =
      options.selfUpdate ?? process.env.Z3CZ_UPDATER_SELF_UPDATE !== "false";
    this.githubToken = options.githubToken || process.env.Z3CZ_UPDATER_GITHUB_TOKEN || "";
    this.stableMs = options.stableMs ?? 30_000;
    this.fetchLatest = options.fetchLatest || fetchLatestRelease;
    this.runCommand = options.runCommand || runCommand;
    this.downloadAsset = options.downloadAsset || downloadReleaseAsset;
    this.applyHostPackFn = options.applyHostPack || applyHostPack;
    this.replaceBinaryFn = options.replaceBinary || replaceFile;
    this.restartService = options.restartService;
    this.compose =
      options.compose ||
      createComposeRunner(
        this.hostDir,
        this.composePath,
        this.envPath,
        this.runCommand
      );
    this.sleep =
      options.sleep ||
      ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    fs.mkdirSync(this.stateDir, { recursive: true });
    fs.mkdirSync(this.backupDir, { recursive: true });
    this.statePath = path.join(this.stateDir, "state.json");
    this.state = this.loadState();
    if (ACTIVE.has(this.state.operation.phase)) {
      this.state.operation.phase = "manual_intervention";
      this.state.operation.error =
        "更新器在操作期间退出，请检查容器与数据库后手动处理";
      this.appendLog("manual_intervention", this.state.operation.error);
      this.saveState();
    }
  }

  loadState() {
    try {
      const raw = JSON.parse(fs.readFileSync(this.statePath, "utf8"));
      return {
        ...emptyState(),
        ...raw,
        operation: { ...emptyOperation(), ...raw.operation },
      };
    } catch {
      return emptyState();
    }
  }

  saveState() {
    const tmp = `${this.statePath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.state, null, 2));
    fs.renameSync(tmp, this.statePath);
  }

  appendLog(phase, message) {
    this.state.operation.logs = [
      ...this.state.operation.logs,
      { at: new Date().toISOString(), phase, message },
    ].slice(-80);
  }

  currentVersion() {
    const config = parseAppYml(fs.readFileSync(this.appYmlPath, "utf8"));
    return displayVersion(config.image_tag || "latest") || "latest";
  }

  writeImageTag(version) {
    const config = parseAppYml(fs.readFileSync(this.appYmlPath, "utf8"));
    config.image_tag = dockerImageTag(version);
    fs.writeFileSync(this.appYmlPath, stringifyAppYml(config));
  }

  snapshot() {
    const currentVersion = (() => {
      try {
        return this.currentVersion();
      } catch {
        return "unknown";
      }
    })();
    const latest = this.state.latestRelease;
    const updateAvailable = Boolean(
      latest && compareVersions(currentVersion, latest.version) < 0
    );
    return {
      supported: true,
      connected: true,
      repository: this.repository,
      deployment: "docker-self-host",
      currentVersion,
      latestRelease: latest,
      updateAvailable,
      checks: this.checksFromState(),
      lastBackup: this.state.lastBackup,
      rollbackVersion: this.state.rollbackVersion || undefined,
      operation: this.state.operation,
    };
  }

  checksFromState() {
    return this.state.checks || [];
  }

  async collectChecks() {
    /** @type {{ key: string, label: string, status: "passed" | "failed", detail?: string, blocking: boolean }[]} */
    const checks = [];
    const push = (key, label, blocking, fn) => {
      try {
        fn();
        checks.push({ key, label, status: "passed", blocking });
      } catch (error) {
        checks.push({
          key,
          label,
          status: "failed",
          blocking,
          detail: error instanceof Error ? error.message : String(error),
        });
      }
    };
    push("app_yml", "部署配置", true, () => {
      if (!fs.existsSync(this.appYmlPath)) {
        throw new Error("未找到 containers/app.yml");
      }
    });
    push("compose", "Compose 文件", true, () => {
      if (!fs.existsSync(this.composePath) || !fs.existsSync(this.envPath)) {
        throw new Error("请先完成首次部署以生成 Compose");
      }
    });
    push("disk", "备份磁盘空间", true, () => {
      checkBackupDiskSpace(this.backupDir);
    });
    const current = this.currentVersion();
    checks.push({
      key: "version",
      label: "当前版本",
      status: "passed",
      blocking: false,
      detail: isReleaseVersion(current)
        ? `运行 ${current}`
        : `当前是 ${current}，不是正式版本号，可以升级到正式版`,
    });
    this.state.checks = checks;
    return checks;
  }

  async check() {
    if (ACTIVE.has(this.state.operation.phase)) {
      throw Object.assign(new Error("更新操作正在进行，暂时不能检查新版本"), {
        status: this.snapshot(),
      });
    }
    this.state.operation = {
      ...emptyOperation(),
      phase: "checking",
      logs: [],
    };
    this.appendLog("checking", "正在读取 GitHub Release");
    this.saveState();
    try {
      const release = await this.fetchLatest(this.repository, {
        token: this.githubToken,
      });
      this.state.latestRelease = release;
      await this.collectChecks();
      const current = this.currentVersion();
      if (compareVersions(current, release.version) < 0) {
        this.state.operation.phase = "ready";
        this.appendLog(
          "ready",
          isReleaseVersion(current)
            ? `发现新版本 ${release.version}`
            : `当前部署为 ${current}，可更新到正式版 ${release.version}`
        );
      } else {
        this.state.operation.phase = "no_update";
        this.appendLog("no_update", "当前已是最新版本");
      }
      this.saveState();
      return this.snapshot();
    } catch (error) {
      this.state.operation.phase = "failed";
      this.state.operation.error =
        error instanceof Error ? error.message : String(error);
      this.appendLog("failed", "检查更新失败");
      this.saveState();
      throw Object.assign(error instanceof Error ? error : new Error(String(error)), {
        status: this.snapshot(),
      });
    }
  }

  startUpdate(targetVersion) {
    const target = displayVersion(String(targetVersion || "").trim());
    if (ACTIVE.has(this.state.operation.phase)) {
      throw Object.assign(new Error("已有更新操作正在进行"), {
        status: this.snapshot(),
      });
    }
    if (!this.state.latestRelease || this.state.latestRelease.version !== target) {
      throw Object.assign(
        new Error("目标版本与最近一次检查结果不一致，请重新检查更新"),
        { status: this.snapshot() }
      );
    }
    const current = this.currentVersion();
    if (compareVersions(current, target) >= 0) {
      throw Object.assign(new Error("目标版本必须高于当前版本"), {
        status: this.snapshot(),
      });
    }
    const blockingFailed = (this.state.checks || []).some(
      (check) => check.blocking && check.status === "failed"
    );
    if (blockingFailed) {
      throw Object.assign(new Error("更新前检查未通过"), {
        status: this.snapshot(),
      });
    }
    this.state.operation = {
      id: randomUUID(),
      phase: "preflight",
      fromVersion: current,
      targetVersion: target,
      startedAt: new Date().toISOString(),
      automaticRollback: false,
      logs: [],
    };
    this.appendLog("preflight", "开始更新前检查");
    this.saveState();
    void this.runUpdate(current, target);
    return this.snapshot();
  }

  startRollback(reason) {
    if (ACTIVE.has(this.state.operation.phase)) {
      throw Object.assign(new Error("已有更新操作正在进行"), {
        status: this.snapshot(),
      });
    }
    if (!this.state.rollbackVersion || !this.state.lastBackup) {
      throw Object.assign(new Error("没有可用的回退版本或已校验备份"), {
        status: this.snapshot(),
      });
    }
    const current = this.currentVersion();
    const target = this.state.rollbackVersion;
    this.state.operation = {
      id: randomUUID(),
      phase: "rolling_back",
      fromVersion: current,
      targetVersion: target,
      startedAt: new Date().toISOString(),
      automaticRollback: false,
      logs: [
        {
          at: new Date().toISOString(),
          phase: "rolling_back",
          message: `管理员发起人工回退：${String(reason || "").trim()}`,
        },
      ],
    };
    this.saveState();
    const backup = this.state.lastBackup;
    void this.runRollback(target, backup, false);
    return this.snapshot();
  }

  setPhase(phase, message) {
    this.state.operation.phase = phase;
    this.appendLog(phase, message);
    this.saveState();
  }

  failWithoutRollback(error) {
    this.state.operation.phase = "failed";
    this.state.operation.error =
      error instanceof Error ? error.message : String(error);
    this.state.operation.finishedAt = new Date().toISOString();
    this.appendLog("failed", this.state.operation.error);
    this.saveState();
  }

  async runUpdate(fromVersion, targetVersion) {
    let startedDrain = false;
    let nextBinaryPath = "";
    try {
      await this.collectChecks();
      const blockingFailed = (this.state.checks || []).some(
        (check) => check.blocking && check.status === "failed"
      );
      if (blockingFailed) {
        throw new Error("更新前检查未通过");
      }
      this.setPhase("backing_up", "创建数据库与上传文件备份");
      const backup = await createBackup({
        backupDir: this.backupDir,
        hostDir: this.hostDir,
        compose: this.compose,
        storageDir: this.storageDir,
        version: fromVersion,
      });
      this.state.lastBackup = backup;
      this.state.rollbackVersion = fromVersion;
      this.saveState();

      const tag = dockerImageTag(targetVersion);
      this.setPhase("pulling", `拉取 ${apiImageName}:${tag} 与 ${appImageName}:${tag}`);
      await this.refreshHostPack(targetVersion);
      nextBinaryPath = await this.prepareUpdaterBinary(targetVersion);
      await this.runCommand(this.hostDir, "docker", [
        "pull",
        `${apiImageName}:${tag}`,
      ]);
      await this.runCommand(this.hostDir, "docker", [
        "pull",
        `${appImageName}:${tag}`,
      ]);
      await this.verifyImages(targetVersion);

      this.setPhase("draining", "停止 api 与 app，数据库保持运行");
      startedDrain = true;
      await this.compose(["stop", "api", "app"]);

      this.setPhase("migrating", "用目标版本镜像执行数据库迁移");
      this.writeImageTag(targetVersion);
      await this.runCommand(this.hostDir, path.join(this.hostDir, "launcher"), [
        "migrate",
      ]);

      this.setPhase("switching", "启动目标版本");
      await this.compose(["up", "-d", "--force-recreate", "--no-deps", "api", "app"]);

      this.setPhase("verifying", "等待服务健康");
      await this.verifyHealth(targetVersion);
      await this.finalizeSuccessfulUpdate(targetVersion, nextBinaryPath);
    } catch (error) {
      if (startedDrain && this.state.lastBackup && this.state.rollbackVersion) {
        await this.runRollback(fromVersion, this.state.lastBackup, true, error);
        return;
      }
      this.failWithoutRollback(error);
    }
  }

  async runRollback(targetVersion, backup, automatic, cause) {
    this.state.operation.automaticRollback = automatic;
    this.setPhase(
      "rolling_back",
      automatic
        ? `更新失败，正在回退到 ${targetVersion}`
        : `正在回退到 ${targetVersion}`
    );
    try {
      await this.compose(["stop", "api", "app"]).catch(() => undefined);
      this.writeImageTag(targetVersion);
      await this.runCommand(this.hostDir, path.join(this.hostDir, "launcher"), [
        "render",
      ]);
      await restoreBackup({
        backup,
        hostDir: this.hostDir,
        storageDir: this.storageDir,
      });
      await this.compose(["up", "-d", "--wait", "postgres"]);
      await this.compose(["up", "-d", "--force-recreate", "--no-deps", "api", "app"]);
      await this.verifyHealth(targetVersion);
      this.state.operation.phase = "rolled_back";
      this.state.operation.finishedAt = new Date().toISOString();
      if (cause) {
        this.state.operation.error =
          cause instanceof Error ? cause.message : String(cause);
      }
      this.appendLog("rolled_back", `已回退到 ${targetVersion}`);
      this.saveState();
    } catch (error) {
      this.state.operation.phase = "manual_intervention";
      this.state.operation.rollbackError =
        error instanceof Error ? error.message : String(error);
      this.state.operation.finishedAt = new Date().toISOString();
      this.appendLog(
        "manual_intervention",
        this.state.operation.rollbackError
      );
      this.saveState();
    }
  }

  async refreshHostPack(targetVersion) {
    const archivePath = path.join(
      this.stateDir,
      `z3cz-deploy-${dockerImageTag(targetVersion)}.tar.gz`
    );
    await this.downloadAsset(
      this.repository,
      targetVersion,
      "z3cz-deploy.tar.gz",
      archivePath,
      { token: this.githubToken }
    );
    this.appendLog("pulling", "正在刷新宿主机部署脚本");
    await this.applyHostPackFn({
      archivePath,
      installDir: this.installDir,
      runCommand: this.runCommand,
    });
  }

  /**
   * @param {string} targetVersion
   */
  async verifyImages(targetVersion) {
    const tag = dockerImageTag(targetVersion);
    const digests = {};
    for (const [key, image] of [
      ["api", `${apiImageName}:${tag}`],
      ["app", `${appImageName}:${tag}`],
    ]) {
      const result = await this.runCommand(this.hostDir, "docker", [
        "image",
        "inspect",
        image,
        "--format",
        "{{json .RepoDigests}}",
      ]);
      const output = String(result.stdout || "");
      if (!output.includes("@sha256:")) {
        throw new Error(`目标镜像 ${image} 未包含仓库摘要`);
      }
      const match = output.match(/[^"\s]+@sha256:[a-f0-9]+/);
      digests[key] = match ? match[0] : output.trim();
    }
    this.state.imageDigests = digests;
    this.saveState();
  }

  /**
   * @param {string} targetVersion
   */
  async prepareUpdaterBinary(targetVersion) {
    if (!this.selfUpdate) {
      return "";
    }
    try {
      const asset = updaterAssetName(updaterArch());
      const sumsPath = path.join(
        this.stateDir,
        `SHA256SUMS-${dockerImageTag(targetVersion)}`
      );
      const binaryPath = path.join(
        this.stateDir,
        `${asset}-${dockerImageTag(targetVersion)}.next`
      );
      await this.downloadAsset(
        this.repository,
        targetVersion,
        "SHA256SUMS",
        sumsPath,
        { token: this.githubToken, limitBytes: 1 << 20 }
      );
      const expected = checksumForAsset(
        fs.readFileSync(sumsPath, "utf8"),
        asset
      );
      if (!/^[a-f0-9]{64}$/.test(expected)) {
        throw new Error(`目标 Release 的 SHA256SUMS 缺少 ${asset}`);
      }
      await this.downloadAsset(this.repository, targetVersion, asset, binaryPath, {
        token: this.githubToken,
      });
      const actual = (await sha256File(binaryPath)).replace(/^sha256:/, "");
      if (actual !== expected) {
        throw new Error(
          `Host Updater 校验失败：期望 ${expected}，实际 ${actual}`
        );
      }
      fs.chmodSync(binaryPath, 0o700);
      return binaryPath;
    } catch (error) {
      this.appendLog(
        "pulling",
        `跳过更新器自更新：${error instanceof Error ? error.message : String(error)}`
      );
      this.saveState();
      return "";
    }
  }

  /**
   * @param {string} targetVersion
   * @param {string} nextBinaryPath
   */
  async finalizeSuccessfulUpdate(targetVersion, nextBinaryPath) {
    this.state.operation.phase = "succeeded";
    this.state.operation.finishedAt = new Date().toISOString();
    this.appendLog("succeeded", `已更新到 ${targetVersion}`);
    this.saveState();
    if (!nextBinaryPath || !this.selfUpdate) {
      return;
    }
    try {
      this.replaceBinaryFn(nextBinaryPath, this.binaryPath);
      this.appendLog("succeeded", "Host Updater 二进制已同步到目标版本");
      this.saveState();
      this.queueRestart();
    } catch (error) {
      this.state.operation.phase = "manual_intervention";
      this.state.operation.error = `应用已更新，但 Host Updater 自更新失败：${
        error instanceof Error ? error.message : String(error)
      }`;
      this.appendLog("manual_intervention", this.state.operation.error);
      this.saveState();
    }
  }

  queueRestart() {
    if (this.restartService) {
      this.restartService();
      return;
    }
    const child = spawn("systemctl", ["restart", this.serviceName], {
      detached: true,
      stdio: "ignore",
    });
    child.unref();
  }

  async verifyHealth(targetVersion) {
    const started = Date.now();
    const windowMs = this.stableMs;
    const timeoutMs = Math.max(windowMs + 60_000, 3 * 60_000);
    let healthySince = 0;
    while (Date.now() - started < timeoutMs) {
      try {
        const result = await this.compose([
          "exec",
          "-T",
          "api",
          "node",
          "-e",
          "fetch('http://127.0.0.1:3102/health').then(async (r)=>{const j=await r.json(); if(!r.ok) process.exit(1); process.stdout.write(JSON.stringify(j));}).catch(()=>process.exit(1))",
        ]);
        const body = JSON.parse(result.stdout || "{}");
        const expected = displayVersion(targetVersion);
        if (
          expected !== "latest" &&
          isReleaseVersion(expected) &&
          displayVersion(body.version) !== expected &&
          String(body.version) !== dockerImageTag(expected)
        ) {
          throw new Error(
            `健康检查版本不一致：期望 ${expected}，实际 ${body.version}`
          );
        }
        if (!healthySince) {
          healthySince = Date.now();
        }
        if (Date.now() - healthySince >= windowMs) {
          return;
        }
      } catch (error) {
        healthySince = 0;
        if (Date.now() - started >= timeoutMs) {
          throw error instanceof Error ? error : new Error(String(error));
        }
      }
      await this.sleep(5000);
    }
    throw new Error("健康验证超时");
  }
}

/**
 * @param {string} source
 * @param {string} dest
 */
function replaceFile(source, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const tmp = `${dest}.tmp`;
  fs.copyFileSync(source, tmp);
  fs.chmodSync(tmp, 0o755);
  fs.renameSync(tmp, dest);
}
