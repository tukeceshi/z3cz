import fs from "node:fs";
import path from "node:path";
import { parseAppYml } from "../../../docker-host/lib/parse-app-yml.mjs";
import {
  publicOrigin,
  renderCompose,
  renderCaddyfile,
  renderEnvFile,
} from "../../../docker-host/lib/render.mjs";

const FILES = [
  "containers/app.yml",
  "docker-compose.generated.yml",
  ".env.generated",
  "Caddyfile.generated",
  "source-deployment.json",
];

export function captureDeployment(hostDir) {
  return Object.fromEntries(
    FILES.map((file) => {
      const full = path.join(hostDir, file);
      return [file, fs.existsSync(full) ? fs.readFileSync(full, "utf8") : null];
    })
  );
}

export function restoreDeployment(hostDir, snapshot) {
  if (!snapshot) throw new Error("缺少旧版本部署配置，不能自动回退");
  for (const file of FILES) {
    const full = path.join(hostDir, file);
    if (snapshot[file] === null) fs.rmSync(full, { force: true });
    else if (typeof snapshot[file] === "string")
      fs.writeFileSync(full, snapshot[file], { mode: 0o600 });
    else throw new Error(`旧版本配置不完整：${file}`);
  }
}

export function setMaintenance(hostDir, enabled) {
  const dir = path.join(hostDir, "shared", "maintenance");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "enabled");
  if (enabled) fs.writeFileSync(file, "updating\n");
  else fs.rmSync(file, { force: true });
}

export function writeSourceDeployment(manager, source) {
  const config = parseAppYml(fs.readFileSync(manager.appYmlPath, "utf8"));
  config.origin =
    config.env.WEB_HOST?.trim() ||
    publicOrigin(
      config.hostname,
      config.https,
      config.http_port,
      config.https_port
    );
  fs.writeFileSync(
    path.join(manager.hostDir, "source-deployment.json"),
    JSON.stringify(source, null, 2)
  );
  fs.writeFileSync(manager.composePath, renderCompose(config, source));
  fs.writeFileSync(manager.envPath, renderEnvFile(config), { mode: 0o600 });
  fs.writeFileSync(
    path.join(manager.hostDir, "Caddyfile.generated"),
    renderCaddyfile(config)
  );
}

async function validateCandidate(manager, source, targetVersion) {
  const config = parseAppYml(fs.readFileSync(manager.appYmlPath, "utf8"));
  config.image_tag = targetVersion.replace(/^v/, "");
  config.origin =
    config.env.WEB_HOST?.trim() ||
    publicOrigin(
      config.hostname,
      config.https,
      config.http_port,
      config.https_port
    );
  const compose = path.join(manager.hostDir, ".source-candidate.yml");
  const env = path.join(manager.hostDir, ".source-candidate.env");
  try {
    fs.writeFileSync(compose, renderCompose(config, source), { mode: 0o600 });
    fs.writeFileSync(env, renderEnvFile(config), { mode: 0o600 });
    await manager.runCommand(manager.hostDir, "docker", [
      "compose",
      "--env-file",
      env,
      "-f",
      compose,
      "config",
      "--quiet",
    ]);
  } finally {
    fs.rmSync(compose, { force: true });
    fs.rmSync(env, { force: true });
  }
}

export function acquireUpdateLock(stateDir) {
  const file = path.join(stateDir, "operation.lock");
  if (fs.existsSync(file)) {
    const pid = Number(fs.readFileSync(file, "utf8"));
    if (!Number.isInteger(pid) || pid <= 0)
      throw new Error("更新锁无效，请人工检查");
    try {
      process.kill(pid, 0);
    } catch (error) {
      if (error.code !== "ESRCH") throw new Error("无法确认现有更新进程");
      fs.unlinkSync(file);
    }
  }
  try {
    fs.writeFileSync(file, String(process.pid), { flag: "wx", mode: 0o600 });
  } catch {
    throw new Error("已有更新进程正在运行");
  }
  return () => fs.unlinkSync(file);
}

export async function runSourceUpdate(
  manager,
  fromVersion,
  targetVersion,
  ref = targetVersion
) {
  let releaseLock;
  let stopped = false;
  let migrated = false;
  let snapshot;
  let backup;
  let fresh = false;
  try {
    releaseLock = acquireUpdateLock(manager.stateDir);
    if (!fs.existsSync(manager.appYmlPath)) throw new Error("请先完成部署配置");
    const maintenance = path.join(
      manager.hostDir,
      "shared/maintenance/enabled"
    );
    if (fs.existsSync(maintenance))
      throw new Error("上次更新仍处于维护状态，请先处理后再更新");
    manager.setPhase("pulling", "准备源码与构建环境");
    const source = await manager.prepareSource({
      hostDir: manager.hostDir,
      repository: manager.repository,
      ref,
      version: targetVersion,
      run: manager.runCommand,
      log: (message) => manager.setPhase("pulling", message),
    });
    await validateCandidate(manager, source, targetVersion);
    snapshot = captureDeployment(manager.hostDir);
    fresh = snapshot["docker-compose.generated.yml"] === null;
    if (!fresh) {
      const existing = await manager.compose(["ps", "-a", "-q", "api"]);
      fresh = !existing.stdout.trim();
      if (!fresh) {
        const resolved = JSON.parse(
          (await manager.compose(["config", "--format", "json"])).stdout
        );
        for (const name of ["api", "app"]) {
          const id = (
            await manager.compose(["ps", "-a", "-q", name])
          ).stdout.trim();
          if (!id || id.includes("\n"))
            throw new Error(`无法确认旧版本 ${name} 容器`);
          const image = (
            await manager.runCommand(manager.hostDir, "docker", [
              "inspect",
              id,
              "--format",
              "{{.Image}}",
            ])
          ).stdout.trim();
          if (!/^sha256:[a-f0-9]{64}$/.test(image))
            throw new Error("无法锁定旧版本镜像");
          resolved.services[name].image = image;
          resolved.services[name].pull_policy = "never";
        }
        snapshot["docker-compose.generated.yml"] = JSON.stringify(
          resolved,
          null,
          2
        );
      }
    }
    manager.state.pendingUpdate = { deployment: snapshot, version: fromVersion, backup: null, migrationStarted: false, fresh };
    manager.saveState();
    manager.setPhase("draining", "进入维护模式，停止应用写入");
    setMaintenance(manager.hostDir, true);
    stopped = true;
    if (fs.existsSync(manager.composePath)) {
      // Stopping the old ingress also covers legacy deployments without the maintenance mount.
      await manager.compose(["stop", "caddy", "api", "app"]);
    }
    manager.writeImageTag(targetVersion);
    writeSourceDeployment(manager, source);
    await manager.compose(["config", "--quiet"]);
    await manager.compose([
      "up",
      "-d",
      "--wait",
      "--pull",
      "never",
      "postgres",
    ]);
    await manager.compose([
      "up",
      "-d",
      "--no-deps",
      "--force-recreate",
      "--pull",
      "never",
      "caddy",
    ]);
    if (!fresh) {
      manager.setPhase("backing_up", "应用已停止，备份数据库与上传文件");
      backup = await manager.createBackup({
        backupDir: manager.backupDir,
        hostDir: manager.hostDir,
        compose: manager.compose,
        storageDir: manager.storageDir,
        version: fromVersion,
      });
      manager.state.lastBackup = backup;
      manager.state.rollbackVersion = fromVersion;
      manager.state.rollbackDeployment = snapshot;
      manager.state.pendingUpdate.backup = backup;
      manager.saveState();
    }
    manager.setPhase("migrating", "执行目标版本数据库迁移");
    migrated = true;
    manager.state.pendingUpdate.migrationStarted = true;
    manager.saveState();
    await manager.compose([
      "run",
      "--rm",
      "--no-deps",
      "--pull",
      "never",
      "api",
      "pnpm",
      "db:migrate",
    ]);
    manager.setPhase("switching", "启动目标版本，继续保持维护模式");
    await manager.compose([
      "up",
      "-d",
      "--force-recreate",
      "--no-deps",
      "--pull",
      "never",
      "api",
      "app",
    ]);
    manager.setPhase("verifying", "检查 API 和前端服务");
    await manager.verifyHealth(targetVersion);
    await manager.compose([
      "exec",
      "-T",
      "app",
      "wget",
      "-q",
      "-O",
      "/dev/null",
      "http://127.0.0.1/",
    ]);
    setMaintenance(manager.hostDir, false);
    // No fallible migration/restore work after reopening writes.
    manager.state.operation.phase = "succeeded";
    manager.state.pendingUpdate = null;
    manager.state.operation.finishedAt = new Date().toISOString();
    manager.appendLog("succeeded", `已更新到 ${targetVersion}，恢复访问`);
    try {
      manager.saveState();
    } catch (error) {
      console.error("保存更新结果失败", error);
    }
  } catch (error) {
    if (stopped && !fresh) {
      try {
        await manager.compose(["stop", "caddy", "api", "app"]);
        restoreDeployment(manager.hostDir, snapshot);
        if (migrated) {
          if (!backup) throw new Error("缺少本次更新备份，保持维护状态");
          await manager.restoreBackup({
            backup,
            hostDir: manager.hostDir,
            storageDir: manager.storageDir,
          });
        }
        await manager.compose([
          "up",
          "-d",
          "--force-recreate",
          "--no-deps",
          "--pull",
          "never",
          "api",
          "app",
        ]);
        await manager.verifyHealth(fromVersion);
        await manager.compose([
          "up",
          "-d",
          "--no-deps",
          "--force-recreate",
          "--pull",
          "never",
          "caddy",
        ]);
        setMaintenance(manager.hostDir, false);
        manager.state.operation.phase = "rolled_back";
        manager.state.pendingUpdate = null;
        manager.state.operation.automaticRollback = true;
        manager.state.operation.error = error.message;
        manager.state.operation.finishedAt = new Date().toISOString();
        manager.appendLog("rolled_back", `更新失败，已恢复 ${fromVersion}`);
        manager.saveState();
      } catch (rollbackError) {
        manager.state.operation.phase = "manual_intervention";
        manager.state.operation.error = error.message;
        manager.state.operation.rollbackError = rollbackError.message;
        manager.appendLog("manual_intervention", `恢复失败：${rollbackError.message}`);
        manager.saveState();
      }
    } else if (stopped) {
      manager.state.operation.phase = "manual_intervention";
      manager.state.operation.error = error.message;
      manager.appendLog("manual_intervention", error.message);
      manager.saveState();
    } else manager.failWithoutRollback(error);
  } finally {
    releaseLock?.();
  }
}

export async function rollbackSource(
  manager,
  targetVersion,
  backup,
  automatic,
  cause
) {
  let releaseLock;
  try {
    releaseLock = acquireUpdateLock(manager.stateDir);
    const pending = manager.state.pendingUpdate;
    const deployment = pending?.deployment || manager.state.rollbackDeployment;
    if (pending?.fresh) throw new Error("首次安装中断，没有可回退的旧版本，请人工检查");
    if (!deployment)
      throw new Error("缺少旧部署配置，请人工恢复");
    setMaintenance(manager.hostDir, true);
    manager.setPhase("rolling_back", `恢复备份与版本 ${targetVersion}`);
    await manager.compose(["stop", "caddy", "api", "app"]);
    restoreDeployment(manager.hostDir, deployment);
    await manager.compose([
      "up",
      "-d",
      "--wait",
      "--pull",
      "never",
      "postgres",
    ]);
    if (!pending || pending.migrationStarted) {
      const restore = pending ? pending.backup : backup;
      if (!restore) throw new Error("缺少本次迁移前备份，不能恢复数据库");
      await manager.restoreBackup({ backup: restore, hostDir: manager.hostDir, storageDir: manager.storageDir });
    }
    await manager.compose([
      "up",
      "-d",
      "--force-recreate",
      "--no-deps",
      "--pull",
      "never",
      "api",
      "app",
    ]);
    await manager.verifyHealth(targetVersion);
    await manager.compose([
      "up",
      "-d",
      "--no-deps",
      "--force-recreate",
      "--pull",
      "never",
      "caddy",
    ]);
    setMaintenance(manager.hostDir, false);
    manager.state.operation.phase = "rolled_back";
    manager.state.pendingUpdate = null;
    manager.state.operation.automaticRollback = automatic;
    manager.state.operation.finishedAt = new Date().toISOString();
    manager.state.operation.error = cause?.message;
    manager.appendLog("rolled_back", `已恢复 ${targetVersion}`);
    manager.saveState();
  } catch (error) {
    manager.state.operation.phase = "manual_intervention";
    manager.state.operation.rollbackError = error.message;
    manager.appendLog("manual_intervention", error.message);
    manager.saveState();
  } finally {
    releaseLock?.();
  }
}
