/**
 * Worker Runtime
 *
 * Factory for creating a WorkerRuntime wired with Cloudflare production
 * dependencies. Used for synchronous (non-durable) workflow execution
 * where results are returned inline to the caller.
 */

import { WorkerRuntime } from "@dafthunk/runtime";

import type { Bindings } from "../context";
import { buildDependencies } from "./cloudflare-runtime-dependencies";

export { WorkerRuntime } from "@dafthunk/runtime";

export async function createWorkerRuntime(env: Bindings): Promise<WorkerRuntime<Bindings>> {
  const noopMonitoring = { async sendUpdate() {} };
  return new WorkerRuntime(env, await buildDependencies(env, noopMonitoring));
}
