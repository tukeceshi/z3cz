import { aiImageWidget } from "./ai/ai-image-widget";
import { aiTextWidget } from "./ai/ai-text-widget";
import { aiVideoWidget } from "./ai/ai-video-widget";
import type { WidgetDescriptor } from "./widget";

interface WidgetRegistryLike {
  register(descriptor: WidgetDescriptor): void;
}

const coreWidgets: readonly WidgetDescriptor[] = [
  aiTextWidget,
  aiImageWidget,
  aiVideoWidget,
];

export function registerCoreWidgets(registry: WidgetRegistryLike): void {
  for (const widget of coreWidgets) {
    registry.register(widget);
  }
}
