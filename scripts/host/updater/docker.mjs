import { spawn } from "node:child_process";

/**
 * @param {string} cwd
 * @param {string} command
 * @param {string[]} args
 * @param {{ timeoutMs?: number, input?: import("node:stream").Readable, env?: Record<string, string>, onOutput?: (chunk: string) => void }} [options]
 * @returns {Promise<{ stdout: string, stderr: string }>}
 */
export function runCommand(cwd, command, args, options = {}) {
  const timeoutMs = options.timeoutMs ?? 20 * 60 * 1000;
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...options.env },
      stdio: options.input ? ["pipe", "pipe", "pipe"] : ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`${command} ${args.join(" ")} 超时`));
    }, timeoutMs);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      options.onOutput?.(chunk);
      stdout += chunk;
      if (stdout.length > 200_000) {
        stdout = stdout.slice(-100_000);
      }
    });
    child.stderr.on("data", (chunk) => {
      options.onOutput?.(chunk);
      stderr += chunk;
      if (stderr.length > 200_000) {
        stderr = stderr.slice(-100_000);
      }
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      const detail = (stderr || stdout).trim().slice(-1000);
      reject(
        new Error(
          detail
            ? `${command} ${args.join(" ")}：${detail}`
            : `${command} ${args.join(" ")} 退出码 ${code}`
        )
      );
    });
    if (options.input) {
      options.input.pipe(child.stdin);
    }
  });
}

/**
 * @param {string} hostDir
 * @param {string} composePath
 * @param {string} envPath
 */
export function createComposeRunner(hostDir, composePath, envPath, run = runCommand) {
  return (args, options = {}) =>
    run(
      hostDir,
      "docker",
      ["compose", "--env-file", envPath, "-f", composePath, ...args],
      options
    );
}
