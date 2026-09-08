export const AGENT_REMOTION_SKILL = `这套视口已经注入 remotion。不要建项目、不要 import remotion、不要拆文件。
写场景函数，再用 RemotionRoot 返回官方 <Composition> 定片：id、component、durationInFrames、fps、width、height。时长写在 Composition 上，播放器跟着走。
已经有、直接用：Composition、useCurrentFrame、useVideoConfig、AbsoluteFill、interpolate、spring、Sequence、Series、Img、Video、OffthreadVideo、Audio。不要 export。write 整段替换。先判断是改还是重做。改：先读再写。重做：先 clear 清空，不要读旧源码，再按新要求整段 write。不要用 close 来重做。close 只关窗口。报错按报错改，不要重复声明已有的名字。
画面随帧变。第一帧是 0，最后一帧是总帧数减 1。
useCurrentFrame() 取当前帧。套在 Sequence 里时，帧从该段开始重新从 0 计。
useVideoConfig() 取宽、高、帧率、总帧数，和 Composition 上写的一致。
铺满用 AbsoluteFill。后写的盖在上面。
数值变化用 interpolate(当前值, [从, 到], [结果从, 结果到], { extrapolateRight: "clamp" })。
弹入用 spring({ frame, fps })，默认带一点回弹；推迟写 frame - 若干。
分段出场用 Sequence 的 from / durationInFrames。一段接一段用 Series + Series.Sequence。
动效用当前帧算，不要用 CSS 动画。
要查具体方法看官方：
总目录 https://www.remotion.dev/docs
怎么动 https://www.remotion.dev/docs/the-fundamentals
https://www.remotion.dev/docs/animating-properties
帧 https://www.remotion.dev/docs/use-current-frame
画面信息 https://www.remotion.dev/docs/use-video-config
插值 https://www.remotion.dev/docs/interpolate
弹簧 https://www.remotion.dev/docs/spring
铺满 https://www.remotion.dev/docs/absolute-fill
分段 https://www.remotion.dev/docs/sequence
接段 https://www.remotion.dev/docs/series
图 https://www.remotion.dev/docs/img
视频 https://www.remotion.dev/docs/video
https://www.remotion.dev/docs/offthreadvideo
声音 https://www.remotion.dev/docs/audio
缺的方法先查总目录。查到的写法仍要符合视口规矩。`;

export function wrapAgentRemotionSkill(
  skill: string = AGENT_REMOTION_SKILL
): string {
  return `<canvas_skill>\n${skill}\n</canvas_skill>`;
}

export function shouldAttachAnimationSkill(params?: {
  readonly remotionViewportOpen?: boolean;
  readonly consentedCapabilities?: readonly string[];
}): boolean {
  if (params?.remotionViewportOpen) {
    return true;
  }
  return Boolean(params?.consentedCapabilities?.includes("simple-animation"));
}
