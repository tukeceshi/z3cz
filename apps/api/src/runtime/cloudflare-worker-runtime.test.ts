/**
 * Complete specification test suite for Worker Runtime (direct execution)
 *
 * This file runs all runtime specification tests against WorkerRuntime with
 * the same mock dependencies as workflow-runtime tests (no Postgres, spec
 * harness math nodes). Production createWorkerRuntime is covered elsewhere.
 */
import { env } from "cloudflare:test";
import { WorkerRuntime } from "@dafthunk/runtime";
import {
  type RuntimeFactory,
  testConcurrentErrors,
  testConditionalBranching,
  testEdgeCases,
  testFailingExecution,
  testInputCollection,
  testMonitoringUpdates,
  testMultiStepExecution,
  testNodeExecutionErrors,
  testOutputHandling,
  testParallelExecution,
  testSkipLogic,
  testStateConsistency,
  testStatusComputation,
  testSuccessfulExecution,
  testTopologicalOrdering,
  testWorkflowValidation,
} from "@dafthunk/runtime/specification";
import type { Bindings } from "../context";
import { createMockRuntimeDependencies } from "../mocks/runtime";

const runtimeName = "WorkerRuntime";
const factory: RuntimeFactory = () => {
  const runtime = new WorkerRuntime(
    env as Bindings,
    createMockRuntimeDependencies(env as Bindings)
  );
  return {
    run: (params, instanceId) => runtime.run(params, instanceId),
  };
};

testSuccessfulExecution(runtimeName, factory);
testFailingExecution(runtimeName, factory);
testEdgeCases(runtimeName, factory);
testConcurrentErrors(runtimeName, factory);
testConditionalBranching(runtimeName, factory);
testInputCollection(runtimeName, factory);
testMonitoringUpdates(runtimeName, factory);
testNodeExecutionErrors(runtimeName, factory);
testOutputHandling(runtimeName, factory);
testParallelExecution(runtimeName, factory);
testSkipLogic(runtimeName, factory);
testStateConsistency(runtimeName, factory);
testStatusComputation(runtimeName, factory);
testTopologicalOrdering(runtimeName, factory);
testWorkflowValidation(runtimeName, factory);
testMultiStepExecution(runtimeName, factory);
