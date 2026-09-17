import type { NodeExecution, NodeType } from "@dafthunk/types";

import {
  ExecutableNode,
  type NodeContext,
  type ParameterValue,
} from "../node-types";

function numberPair(
  context: NodeContext
): { ok: true; a: number; b: number } | { ok: false; error: string } {
  if (context.inputs.a === undefined || context.inputs.a === null) {
    return { ok: false, error: "Input 'a' is required" };
  }
  if (context.inputs.b === undefined || context.inputs.b === null) {
    return { ok: false, error: "Input 'b' is required" };
  }
  const a = Number(context.inputs.a);
  const b = Number(context.inputs.b);
  if (Number.isNaN(a) || Number.isNaN(b)) {
    return { ok: false, error: "Both inputs must be numbers" };
  }
  return { ok: true, a, b };
}

const numberBinaryInputs: NodeType["inputs"] = [
  { name: "a", type: "number", required: true },
  { name: "b", type: "number", required: true },
];

function binaryMathNodeType(
  type: string,
  name: string,
  description: string
): NodeType {
  return {
    id: type,
    name,
    type,
    description,
    tags: ["Math", "Test"],
    icon: "hash",
    inputs: numberBinaryInputs,
    outputs: [{ name: "result", type: "number" }],
  };
}

/** Test-only number widget used by runtime specification suites. */
export class NumberInputNode extends ExecutableNode {
  public static readonly nodeType: NodeType = {
    id: "number-input",
    name: "Number Input",
    type: "number-input",
    description: "Test number input",
    tags: ["Math", "Test"],
    icon: "hash",
    inputs: [{ name: "value", type: "number", hidden: true, value: 0 }],
    outputs: [{ name: "value", type: "number" }],
  };

  async execute(context: NodeContext): Promise<NodeExecution> {
    return this.createSuccessResult({
      value: Number(context.inputs.value),
    });
  }
}

/** Test-only addition used by runtime specification suites. */
export class AdditionNode extends ExecutableNode {
  public static readonly nodeType: NodeType = binaryMathNodeType(
    "addition",
    "Addition",
    "Adds two numbers"
  );

  async execute(context: NodeContext): Promise<NodeExecution> {
    const pair = numberPair(context);
    if (!pair.ok) {
      return this.createErrorResult(pair.error);
    }
    return this.createSuccessResult({ result: pair.a + pair.b });
  }
}

/** Test-only subtraction used by runtime specification suites. */
export class SubtractionNode extends ExecutableNode {
  public static readonly nodeType: NodeType = binaryMathNodeType(
    "subtraction",
    "Subtraction",
    "Subtracts two numbers"
  );

  async execute(context: NodeContext): Promise<NodeExecution> {
    const pair = numberPair(context);
    if (!pair.ok) {
      return this.createErrorResult(pair.error);
    }
    return this.createSuccessResult({ result: pair.a - pair.b });
  }
}

/** Test-only multiplication used by runtime specification suites. */
export class MultiplicationNode extends ExecutableNode {
  public static readonly nodeType: NodeType = binaryMathNodeType(
    "multiplication",
    "Multiplication",
    "Multiplies two numbers"
  );

  async execute(context: NodeContext): Promise<NodeExecution> {
    const pair = numberPair(context);
    if (!pair.ok) {
      return this.createErrorResult(pair.error);
    }
    return this.createSuccessResult({ result: pair.a * pair.b });
  }
}

/** Test-only division used by runtime specification suites. */
export class DivisionNode extends ExecutableNode {
  public static readonly nodeType: NodeType = binaryMathNodeType(
    "division",
    "Division",
    "Divides two numbers"
  );

  async execute(context: NodeContext): Promise<NodeExecution> {
    const pair = numberPair(context);
    if (!pair.ok) {
      return this.createErrorResult(pair.error);
    }
    if (pair.b === 0) {
      return this.createErrorResult("Division by zero is not allowed");
    }
    return this.createSuccessResult({ result: pair.a / pair.b });
  }
}

/** Test-only fork used by runtime specification suites. */
export class ConditionalForkNode extends ExecutableNode {
  public static readonly nodeType: NodeType = {
    id: "conditional-fork",
    name: "Conditional Fork",
    type: "conditional-fork",
    description: "Test conditional fork",
    tags: ["Logic", "Test"],
    icon: "git-branch",
    inputs: [
      { name: "condition", type: "boolean", required: true },
      { name: "value", type: "any", required: true },
    ],
    outputs: [
      { name: "true", type: "any" },
      { name: "false", type: "any" },
    ],
  };

  async execute(context: NodeContext): Promise<NodeExecution> {
    const { condition, value } = context.inputs;
    if (typeof condition !== "boolean") {
      return this.createErrorResult("Condition must be a boolean.");
    }
    if (value === undefined) {
      return this.createErrorResult("Value input is required.");
    }
    const outputs: Record<string, ParameterValue> = {};
    if (condition) {
      outputs.true = value as ParameterValue;
    } else {
      outputs.false = value as ParameterValue;
    }
    return this.createSuccessResult(outputs);
  }
}

/** Test-only join used by runtime specification suites. */
export class ConditionalJoinNode extends ExecutableNode {
  public static readonly nodeType: NodeType = {
    id: "conditional-join",
    name: "Conditional Join",
    type: "conditional-join",
    description: "Test conditional join",
    tags: ["Logic", "Test"],
    icon: "git-merge",
    inputs: [
      { name: "true", type: "any", required: false },
      { name: "false", type: "any", required: false },
    ],
    outputs: [{ name: "result", type: "any" }],
  };

  async execute(context: NodeContext): Promise<NodeExecution> {
    const hasTrue = context.inputs.true !== undefined;
    const hasFalse = context.inputs.false !== undefined;
    if (!hasTrue && !hasFalse) {
      return this.createErrorResult(
        "ConditionalJoin node requires exactly one input, but neither 'true' nor 'false' was provided."
      );
    }
    if (hasTrue && hasFalse) {
      return this.createErrorResult(
        "ConditionalJoin node requires exactly one input, but both 'true' and 'false' were provided."
      );
    }
    return this.createSuccessResult({
      result: hasTrue ? context.inputs.true : context.inputs.false,
    });
  }
}
