import { BaseNodeRegistry } from "@dafthunk/runtime";
import { AiTextNode } from "@dafthunk/runtime/nodes/ai/ai-text-node";
import { AiImageNode } from "@dafthunk/runtime/nodes/ai/ai-image-node";
import { AiVideoNode } from "@dafthunk/runtime/nodes/ai/ai-video-node";
import { AiAudioNode } from "@dafthunk/runtime/nodes/ai/ai-audio-node";
import type { Bindings } from "../context";

export class CloudflareNodeRegistry extends BaseNodeRegistry<Bindings> {
  protected registerNodes(): void {
    this.registerImplementation(AiTextNode);
    this.registerImplementation(AiImageNode);
    this.registerImplementation(AiVideoNode);
    this.registerImplementation(AiAudioNode);
  }
}

export async function createCloudflareNodeRegistry(
  env: Bindings,
  includeTools: boolean
): Promise<CloudflareNodeRegistry> {
  return new CloudflareNodeRegistry(env, includeTools);
}
