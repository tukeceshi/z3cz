import {

  AI_AUDIO_NODE_TYPE,

  AI_IMAGE_NODE_TYPE,

  AI_TEXT_NODE_TYPE,

  AI_VIDEO_NODE_TYPE,

} from "@dafthunk/types";



import { AiAudioConfigPanel } from "./ai-audio-config-panel";

import { AiImageConfigPanel } from "./ai-image-config-panel";

import { AiTextConfigPanel } from "./ai-text-config-panel";

import { AiVideoConfigPanel } from "./ai-video-config-panel";

import type { GenerativeConfigPanelLayout } from "./generative-config-panel-shell";

import type { WorkflowNodeType } from "./workflow-types";



export interface GenerativeStudioConfigPanelProps {

  readonly nodeId: string;

  readonly data: WorkflowNodeType;

  readonly layout?: GenerativeConfigPanelLayout;

}



export function GenerativeStudioConfigPanel({

  nodeId,

  data,

  layout = "studio-dock",

}: GenerativeStudioConfigPanelProps) {

  if (data.nodeType === AI_TEXT_NODE_TYPE) {

    return <AiTextConfigPanel nodeId={nodeId} data={data} layout={layout} />;

  }

  if (data.nodeType === AI_IMAGE_NODE_TYPE) {

    return <AiImageConfigPanel nodeId={nodeId} data={data} layout={layout} />;

  }

  if (data.nodeType === AI_VIDEO_NODE_TYPE) {

    return <AiVideoConfigPanel nodeId={nodeId} data={data} layout={layout} />;

  }

  if (data.nodeType === AI_AUDIO_NODE_TYPE) {

    return <AiAudioConfigPanel nodeId={nodeId} data={data} layout={layout} />;

  }

  return null;

}


