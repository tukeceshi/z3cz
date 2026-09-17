import { BaseNodeRegistry } from "@dafthunk/runtime";
import { AiAudioNode } from "@dafthunk/runtime/nodes/ai/ai-audio-node";
import { AiImageNode } from "@dafthunk/runtime/nodes/ai/ai-image-node";
import { AiTextNode } from "@dafthunk/runtime/nodes/ai/ai-text-node";
import { AiVideoNode } from "@dafthunk/runtime/nodes/ai/ai-video-node";
import {
  AdditionNode,
  ConditionalForkNode,
  ConditionalJoinNode,
  DivisionNode,
  MultiplicationNode,
  NumberInputNode,
  SubtractionNode,
} from "@dafthunk/runtime/specification/spec-harness-nodes";
import {
  FailingMultiStepNode,
  MultiStepAdditionNode,
} from "@dafthunk/runtime/specification/test-nodes";
import type { Bindings } from "../context";

/** Minimal registry for tests: core generative nodes + specification harness nodes. */
export class MockNodeRegistry extends BaseNodeRegistry<Bindings> {
  protected registerNodes(): void {
    this.registerImplementation(AiTextNode);
    this.registerImplementation(AiImageNode);
    this.registerImplementation(AiVideoNode);
    this.registerImplementation(AiAudioNode);
    this.registerImplementation(NumberInputNode);
    this.registerImplementation(AdditionNode);
    this.registerImplementation(SubtractionNode);
    this.registerImplementation(MultiplicationNode);
    this.registerImplementation(DivisionNode);
    this.registerImplementation(ConditionalForkNode);
    this.registerImplementation(ConditionalJoinNode);
    this.registerImplementation(MultiStepAdditionNode);
    this.registerImplementation(FailingMultiStepNode);
  }
}
