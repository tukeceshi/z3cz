/** 节点展示层中文（type/id 不变，仅 UI 文案） */
export const nodeLabelsZh: Record<
  string,
  {
    name?: string;
    description?: string;
    inputs?: Record<string, string>;
    outputs?: Record<string, string>;
  }
> = {
  "ai-text": {
    name: "文字",
    description: "使用组织配置的 AI 接口生成文本。",
    inputs: {
      model: "模型覆盖（如 gpt-4o）",
      prompt: "发送给模型的提示词",
      manual_text: "直接返回此文本，跳过 AI 调用（测试用）",
      ai_interface_id: "AI 接口实例 ID，留空使用组织默认",
    },
    outputs: {
      text: "生成的文本",
    },
  },
  "ai-image": {
    name: "图片",
    description: "使用组织配置的 AI 接口生成图片。",
    inputs: {
      prompt: "图片描述提示词",
      model: "模型覆盖",
    },
    outputs: {
      image: "生成的图片",
    },
  },
  "ai-video": {
    name: "视频",
    description: "使用组织配置的 AI 接口生成视频。",
    inputs: {
      prompt: "视频描述提示词",
      model: "模型覆盖",
    },
    outputs: {
      video: "生成的视频",
    },
  },
  "ai-audio": {
    name: "音频",
    description: "使用组织配置的 AI 接口生成音频。",
    inputs: {
      prompt: "音频描述提示词",
      model: "模型覆盖",
    },
    outputs: {
      audio: "生成的音频",
    },
  },
};
