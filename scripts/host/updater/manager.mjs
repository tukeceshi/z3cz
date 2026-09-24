import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { createBackup, restoreBackup, reusableBackup } from "./backup.mjs";
import { createComposeRunner, runCommand } from "./docker.mjs";
import { fetchLatestRelease } from "./github.mjs";
import { prepareSourceRelease } from "./source-release.mjs";
import { runSourceUpdate, rollbackSource } from "./source-update.mjs";
import {
  parseAppYml,
  stringifyAppYml,
} from "../../../docker-host/lib/parse-app-yml.mjs";
import {
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
  clearReleaseRollback,
  describeReleaseRollback,
  isReleaseInstall,
} from "./release-rollback.mjs";
import { isUpdateLogNoise } from "./update-log.mjs";
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
    rollbackDatabaseFingerprint: "",
    operation: emptyOperation(),
  };
}

export class UpdateManager {
  /**
   * @param {Partial<{
   *   prepareSource: typeof prepareSourceRelease,
   *   createBackup: typeof createBackup,
   *   restoreBackup: typeof restoreBackup,
   *   reusableBackup: typeof reusableBackup,
   *   backupMaxAgeMs: number,
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
   *   fetchLatest: typeof fetchLatestRelease,
   *   compose: ReturnType<typeof createComposeRunner>,
   *   runCommand: typeof runCommand,
   *   sleep: (ms: number) => Promise<void>
   * }>} [options]
   */
  constructor(options = {}) {
    this.prepareSource = options.prepareSource || prepareSourceRelease;
    this.progressLogOpen = false;
    this.createBackup = options.createBackup || createBackup;
    this.restoreBackup = options.restoreBackup || restoreBackup;
    this.reusableBackup = options.reusableBackup || reusableBackup;
    this.backupMaxAgeMs =
      options.backupMaxAgeMs ??
      Number(process.env.Z3CZ_BACKUP_MAX_AGE_HOURS || 24) * 60 * 60_000;
    if (!Number.isFinite(this.backupMaxAgeMs) || this.backupMaxAgeMs <= 0)
      throw new Error("备份有效期配置无效");
    this.repository = options.repository || defaultRepository;
    this.hostDir = options.hostDir || hostDir;
    this.installDir = options.installDir || path.dirname(this.hostDir);
    this.appYmlPath = options.appYmlPath || appYmlPath;
    this.composePath = options.composePath || composePath;
    this.envPath = options.envPath || envPath;
    this.stateDir = options.stateDir || defaultStateDir;
    this.backupDir = options.backupDir || defaultBackupDir;
    this.storageDir = options.storageDir || storageDir;
    this.githubToken =
      options.githubToken || process.env.Z3CZ_UPDATER_GITHUB_TOKEN || "";
    this.stableMs = options.stableMs ?? 30_000;
    this.fetchLatest = options.fetchLatest || fetchLatestRelease;
    this.runCommand = options.runCommand || runCommand;
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
    this.spawn = options.spawn || spawn;
    this.releaseBackupDir =
      options.releaseBackupDir ||
      (process.env.Z3CZ_STATE_DIR
        ? path.join(process.env.Z3CZ_STATE_DIR, "backups")
        : "/var/lib/z3cz/backups");
    fs.mkdirSync(this.stateDir, { recursive: true });
    fs.mkdirSync(this.backupDir, { recursive: true });
    this.statePath = path.join(this.stateDir, "state.json");
    this.state = this.loadState();
  }

  recoverInterruptedOperation() {
    const lock = path.join(this.stateDir, "operation.lock");
    if (fs.existsSync(lock)) {
      const pid = Number(fs.readFileSync(lock, "utf8"));
      if (!Number.isInteger(pid) || pid <= 0)
        throw new Error("更新锁损坏，请人工检查");
      try {
        process.kill(pid, 0);
        return; // Another CLI or service still owns the operation.
      } catch (error) {
        if (error.code !== "ESRCH") throw error;
        fs.unlinkSync(lock);
      }
    }
    const maintenance = fs.existsSync(
      path.join(this.hostDir, "shared/maintenance/enabled")
    );
    if (this.state.pendingUpdate || maintenance) {
      this.state.operation.phase = "manual_intervention";
      this.state.operation.error =
        "上次切换未完成，可使用回退恢复旧版本；请勿重复更新";
    } else if (
      ACTIVE.has(this.state.operation.phase) ||
      this.state.operation.phase === "checking"
    ) {
      this.state.operation.phase = "failed";
      this.state.operation.error =
        "更新准备已中断，当前服务未切换，可以重新检查更新";
    } else return;
    this.state.operation.finishedAt = new Date().toISOString();
    this.saveState();
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
    fs.writeFileSync(tmp, JSON.stringify(this.state, null, 2), { mode: 0o600 });
    fs.renameSync(tmp, this.statePath);
  }

  appendLog(phase, message) {
    this.progressLogOpen = false;
    this.state.operation.logs = [
      ...this.state.operation.logs,
      { at: new Date().toISOString(), phase, message },
    ].slice(-80);
  }

  replaceProgress(phase, message) {
    const text = String(message).slice(0, 1000);
    if (!text) return;
    const logs = this.state.operation.logs;
    const last = logs.at(-1);
    if (this.progressLogOpen && last?.phase === phase) {
      this.state.operation.logs = [
        ...logs.slice(0, -1),
        { at: new Date().toISOString(), phase, message: text },
      ];
    } else {
      this.appendLog(phase, text);
      this.progressLogOpen = true;
    }
    this.saveState();
  }

  currentVersion() {
    const releaseVersion = path.join(this.installDir, "current", "VERSION");
    if (fs.existsSync(releaseVersion)) {
      return fs.readFileSync(releaseVersion, "utf8").trim();
    }
    const config = parseAppYml(fs.readFileSync(this.appYmlPath, "utf8"));
    return displayVersion(config.image_tag || "latest") || "latest";
  }

  startPreparedUpdate({ targetVersion, archivePath, checksum }) {
    if (!isReleaseVersion(targetVersion)) throw new Error("目标版本无效");
    const updateRoot = path.resolve(
      process.env.Z3CZ_UPDATE_DIR || "/var/lib/z3cz/update",
      "downloads"
    );
    const archive = path.resolve(archivePath);
    if (
      !archive.startsWith(`${updateRoot}${path.sep}`) ||
      !fs.existsSync(archive)
    ) {
      throw new Error("预备更新包不在允许目录");
    }
    if (!/^[a-f0-9]{64}$/.test(checksum)) throw new Error("更新包校验值无效");
    if (ACTIVE.has(this.state.operation.phase))
      throw new Error("已有更新正在执行");
    const fromVersion = this.currentVersion();
    this.state.operation = {
      id: randomUUID(),
      phase: "preflight",
      fromVersion,
      targetVersion,
      startedAt: new Date().toISOString(),
      automaticRollback: false,
      packageChecksum: checksum,
      logs: [],
    };
    this.appendLog("preflight", "宿主机正在复核后台准备的更新包");
    this.saveState();
    const script = path.join(
      this.installDir,
      "current",
      "scripts",
      "update.sh"
    );
    const child = this.spawn(
      "bash",
      [script, "--prepared", archive, checksum, targetVersion],
      {
        env: { ...process.env, Z3CZ_INSTALL_DIR: this.installDir },
        stdio: ["ignore", "pipe", "pipe"],
      }
    );
    const record = (chunk) => {
      let changed = false;
      for (const line of String(chunk).split(/\r?\n/)) {
        const text = line.trim();
        if (!text || isUpdateLogNoise(text)) continue;
        const lower = text.toLowerCase();
        const phase = lower.includes("自动回退")
          ? "rolled_back"
          : lower.includes("人工") || lower.includes("维护模式已保留")
            ? "manual_intervention"
            : lower.includes("备份")
              ? "backing_up"
              : lower.includes("迁移")
                ? "migrating"
                : lower.includes("切换")
                  ? "switching"
                  : lower.includes("验证")
                    ? "verifying"
                    : this.state.operation.phase;
        this.state.operation.phase = phase;
        this.appendLog(phase, text.slice(0, 1000));
        changed = true;
      }
      if (changed) this.saveState();
    };
    child.stdout.on("data", record);
    child.stderr.on("data", record);
    child.on("error", (error) => this.failWithoutRollback(error));
    child.on("exit", (code) => {
      if (code === 0) {
        this.state.operation.phase = "succeeded";
        this.state.operation.finishedAt = new Date().toISOString();
        this.appendLog("succeeded", `已更新到 ${targetVersion}`);
        this.saveState();
      } else if (
        this.state.operation.phase !== "rolled_back" &&
        this.state.operation.phase !== "manual_intervention"
      ) {
        this.failWithoutRollback(
          new Error(`宿主机更新进程退出，代码 ${code ?? "unknown"}`)
        );
      } else {
        this.state.operation.finishedAt = new Date().toISOString();
        this.saveState();
      }
    });
    return this.snapshot();
  }

  writeImageTag(version) {
    const config = parseAppYml(fs.readFileSync(this.appYmlPath, "utf8"));
    config.image_tag = dockerImageTag(version);
    fs.writeFileSync(this.appYmlPath, stringifyAppYml(config));
  }

  snapshot() {
    const currentVersion =
      this.state.pendingUpdate?.version ||
      (() => {
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
    const rollback = this.releaseRollbackFields();
    return {
      supported: true,
      connected: true,
      repository: this.repository,
      deployment: "docker-self-host",
      currentVersion,
      latestRelease: latest,
      updateAvailable,
      checkedAt: this.state.checkedAt,
      checkError: this.state.checkError,
      stale:
        !Number.isFinite(Date.parse(this.state.checkedAt)) ||
        Date.now() - Date.parse(this.state.checkedAt) > 24 * 60 * 60_000,
      checks: this.checksFromState(),
      lastBackup: rollback.lastBackup,
      rollbackVersion: rollback.rollbackVersion,
      rollbackRequiresRestore: rollback.rollbackRequiresRestore,
      rollbackBackup: rollback.rollbackBackup,
      operation: this.state.operation,
    };
  }

  checksFromState() {
    return this.state.checks || [];
  }

  releaseRollbackFields() {
    const pendingVersion =
      this.state.pendingUpdate && !this.state.pendingUpdate.fresh
        ? this.state.pendingUpdate.version
        : "";
    const pendingRestore = this.state.pendingUpdate
      ? Boolean(
          this.state.pendingUpdate.migrationStarted &&
            (!this.state.pendingUpdate.migrationCompleted ||
              !this.state.pendingUpdate.rollbackCompatible)
        )
      : null;
    if (pendingVersion || pendingRestore !== null) {
      return {
        lastBackup: this.state.lastBackup,
        rollbackVersion: pendingVersion || this.state.rollbackVersion || undefined,
        rollbackRequiresRestore: pendingRestore === true,
        rollbackBackup:
          this.state.pendingUpdate?.backup ||
          this.state.rollbackBackup ||
          undefined,
      };
    }
    if (isReleaseInstall(this.installDir)) {
      const release = describeReleaseRollback(
        this.installDir,
        this.stateDir,
        this.releaseBackupDir
      );
      return {
        lastBackup: release?.backup,
        rollbackVersion: release?.version,
        rollbackRequiresRestore: release?.requiresRestore === true,
        rollbackBackup: release?.requiresRestore ? release.backup : undefined,
      };
    }
    return {
      lastBackup: this.state.lastBackup,
      rollbackVersion: this.state.rollbackVersion || undefined,
      rollbackRequiresRestore: this.state.rollbackRequiresRestore !== false,
      rollbackBackup: this.state.rollbackBackup || undefined,
    };
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
    push("compose", "Compose 文件", false, () => {
      if (!fs.existsSync(this.composePath) || !fs.existsSync(this.envPath)) {
        throw new Error("尚未生成 Compose，将按首次部署继续");
      }
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
    if (
      this.state.pendingUpdate ||
      this.state.operation.phase === "manual_intervention"
    )
      throw new Error("请先恢复上次中断的更新");
    if (fs.existsSync(path.join(this.stateDir, "operation.lock"))) {
      throw new Error("存在更新锁，请等待当前操作完成或检查中断的更新");
    }
    if (
      ACTIVE.has(this.state.operation.phase) ||
      this.state.operation.phase === "checking"
    ) {
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
    this.state.checkError = undefined;
    this.saveState();
    try {
      const release = await this.fetchLatest(this.repository, {
        token: this.githubToken,
      });
      this.state.latestRelease = release;
      this.state.checkedAt = new Date().toISOString();
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
      this.state.checkError = this.state.operation.error;
      this.appendLog("failed", "检查更新失败");
      this.saveState();
      throw Object.assign(
        error instanceof Error ? error : new Error(String(error)),
        {
          status: this.snapshot(),
        }
      );
    }
  }

  startUpdate(targetVersion) {
    if (
      this.state.pendingUpdate ||
      this.state.operation.phase === "manual_intervention"
    )
      throw new Error("请先恢复上次中断的更新");
    if (this.snapshot().stale || this.state.checkError)
      throw new Error("请重新检查更新后再开始");
    if (fs.existsSync(path.join(this.stateDir, "operation.lock")))
      throw new Error("已有更新操作，请先检查其状态");
    const target = displayVersion(String(targetVersion || "").trim());
    if (
      ACTIVE.has(this.state.operation.phase) ||
      this.state.operation.phase === "checking"
    ) {
      throw Object.assign(new Error("已有更新操作正在进行"), {
        status: this.snapshot(),
      });
    }
    if (
      !this.state.latestRelease ||
      this.state.latestRelease.version !== target
    ) {
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
    if (fs.existsSync(path.join(this.stateDir, "operation.lock"))) {
      const pid = Number(
        fs.readFileSync(path.join(this.stateDir, "operation.lock"), "utf8")
      );
      if (!Number.isInteger(pid) || pid <= 0)
        throw new Error("更新锁无效，请人工检查");
      try {
        process.kill(pid, 0);
        throw new Error("更新进程仍在运行");
      } catch (error) {
        if (error.code !== "ESRCH") throw error;
      }
    }
    if (
      ACTIVE.has(this.state.operation.phase) ||
      this.state.operation.phase === "checking"
    ) {
      throw Object.assign(new Error("已有更新操作正在进行"), {
        status: this.snapshot(),
      });
    }
    const releaseInstall =
      !this.state.pendingUpdate && isReleaseInstall(this.installDir);
    const release = releaseInstall
      ? describeReleaseRollback(
          this.installDir,
          this.stateDir,
          this.releaseBackupDir
        )
      : null;
    if (releaseInstall) {
      if (
        !release?.version ||
        (release.requiresRestore && !release.backup?.checksum)
      ) {
        throw Object.assign(new Error("没有可用的回退版本或已校验备份"), {
          status: this.snapshot(),
        });
      }
    } else if (
      !this.state.pendingUpdate &&
      (!this.state.rollbackVersion ||
        !this.state.rollbackDeployment ||
        (this.state.rollbackRequiresRestore !== false &&
          !this.state.rollbackBackup &&
          !this.state.lastBackup))
    ) {
      throw Object.assign(new Error("没有可用的回退版本或已校验备份"), {
        status: this.snapshot(),
      });
    }
    const current = this.currentVersion();
    const target = release?.version || this.state.pendingUpdate?.version || this.state.rollbackVersion;
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
    if (release) void this.runReleaseRollback(release);
    else void this.runRollback(target, this.state.lastBackup, false);
    return this.snapshot();
  }

  runReleaseRollback(release) {
    const script = path.join(this.installDir, "current", "scripts", "rollback.sh");
    if (!fs.existsSync(script)) {
      this.state.operation.phase = "manual_intervention";
      this.state.operation.rollbackError = "当前版本缺少回退脚本";
      this.appendLog("manual_intervention", "当前版本缺少回退脚本");
      this.saveState();
      return;
    }
    const args = [script];
    if (release.requiresRestore) args.push("--restore", release.backup.path);
    const child = this.spawn("bash", args, {
      env: { ...process.env, Z3CZ_INSTALL_DIR: this.installDir },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const record = (chunk) => {
      for (const line of String(chunk).split(/\r?\n/)) {
        const text = line.trim();
        if (!text || isUpdateLogNoise(text)) continue;
        this.appendLog("rolling_back", text.slice(0, 1000));
      }
    };
    child.stdout?.on("data", record);
    child.stderr?.on("data", record);
    child.on("error", (error) => {
      this.state.operation.phase = "manual_intervention";
      this.state.operation.rollbackError = error.message;
      this.appendLog("manual_intervention", error.message);
      this.saveState();
    });
    child.on("exit", (code) => {
      if (code === 0) {
        clearReleaseRollback(this.stateDir);
        this.state.rollbackVersion = "";
        this.state.rollbackDeployment = null;
        this.state.rollbackBackup = null;
        this.state.rollbackRequiresRestore = false;
        this.state.lastBackup = undefined;
        this.state.operation.phase = "rolled_back";
        this.state.operation.finishedAt = new Date().toISOString();
        this.appendLog("rolled_back", `已恢复 ${release.version}`);
        this.saveState();
        return;
      }
      this.state.operation.phase = "manual_intervention";
      this.state.operation.rollbackError = `回退进程退出，代码 ${code ?? "unknown"}`;
      this.appendLog(
        "manual_intervention",
        this.state.operation.rollbackError
      );
      this.saveState();
    });
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

  async runUpdate(fromVersion, targetVersion, ref = targetVersion) {
    return runSourceUpdate(this, fromVersion, targetVersion, ref);
  }

  async runRollback(targetVersion, backup, automatic, cause) {
    return rollbackSource(this, targetVersion, backup, automatic, cause);
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
          "fetch('http://127.0.0.1:3001/health').then(async (r)=>{const j=await r.json(); if(!r.ok) process.exit(1); process.stdout.write(JSON.stringify(j));}).catch(()=>process.exit(1))",
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
