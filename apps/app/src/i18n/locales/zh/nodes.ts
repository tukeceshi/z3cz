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
    name: "AI 文本",
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
    name: "AI 图片",
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
    name: "AI 视频",
    description: "使用组织配置的 AI 接口生成视频。",
    inputs: {
      prompt: "视频描述提示词",
      model: "模型覆盖",
    },
    outputs: {
      video: "生成的视频",
    },
  },
  "input-text": {
    name: "文本输入",
    description: "在工作流中提供文本输入。",
  },
  "text-output": {
    name: "文本输出",
    description: "输出文本结果。",
  },
  "image-output": {
    name: "图片输出",
    description: "输出图片结果。",
  },
  "manual-trigger": {
    name: "手动触发",
    description: "通过编辑器或 API 手动启动工作流。",
  },
};
