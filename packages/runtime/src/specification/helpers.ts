import type { Workflow, WorkflowExecution } from "@dafthunk/types";

import type { RuntimeParams } from "../base-runtime";

/**
 * Default compute credits for test workflows.
 */
const TEST_COMPUTE_CREDITS = 10000;

/**
 * Helper to create unique instance IDs for test workflows
 */
export const createInstanceId = (testName: string): string =>
  `test-${testName}-${Date.now()}-${Math.random().toString(36).substring(7)}`;

interface TestWorkflowInput {
  id: string;
  name: string;
  trigger?: string;
  nodes: readonly unknown[];
  edges: readonly unknown[];
  schemeId?: string;
  description?: string;
  runtime?: Workflow["runtime"];
}

/**
 * Helper to create runtime params for test workflows
 */
export const createParams = (workflow: TestWorkflowInput): RuntimeParams => ({
  workflow: {
    schemeId: "omnipotent",
    trigger: (workflow.trigger ?? "manual") as Workflow["trigger"],
    nodes: workflow.nodes as Workflow["nodes"],
    edges: workflow.edges as Workflow["edges"],
    id: workflow.id,
    name: workflow.name,
    ...(workflow.description !== undefined
      ? { description: workflow.description }
      : {}),
    ...(workflow.runtime !== undefined ? { runtime: workflow.runtime } : {}),
  },
  userId: "test-user",
  organizationId: "test-org",
  computeCredits: TEST_COMPUTE_CREDITS,
});

/**
 * Minimal interface for what specification tests need from a runtime.
 * Avoids generic variance issues when passing concrete Runtime<Bindings> instances.
 */
interface TestableRuntime {
  run(params: RuntimeParams, instanceId: string): Promise<WorkflowExecution>;
}

/**
 * Runtime factory type for creating test runtime instances.
 * Zero-argument factory ??the caller binds env before passing to specs.
 */
export type RuntimeFactory = () => TestableRuntime;
