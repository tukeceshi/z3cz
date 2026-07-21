import { BaseNodeRegistry } from "@dafthunk/runtime";
import { AiTextNode } from "@dafthunk/runtime/nodes/ai/ai-text-node";
import { AiImageNode } from "@dafthunk/runtime/nodes/ai/ai-image-node";
import { AiVideoNode } from "@dafthunk/runtime/nodes/ai/ai-video-node";
import {
  FailingMultiStepNode,
  MultiStepAdditionNode,
} from "@dafthunk/runtime/specification/test-nodes";
import type { Bindings } from "../context";

/** Minimal registry for tests: core generative nodes + runtime test nodes. */
export class MockNodeRegistry extends BaseNodeRegistry<Bindings> {
  protected registerNodes(): void {
    this.registerImplementation(AiTextNode);
    this.registerImplementation(AiImageNode);
    this.registerImplementation(AiVideoNode);
    this.registerImplementation(MultiStepAdditionNode);
    this.registerImplementation(FailingMultiStepNode);
  }
}
