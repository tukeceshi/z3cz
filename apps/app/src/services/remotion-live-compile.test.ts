import { describe, expect, it } from "vitest";

import { compileRemotionSource, type RemotionCompileSuccess } from "./remotion-live-compile";
import { DEFAULT_REMOTION_SOURCE_CODE } from "./remotion-viewport-staging";

describe("remotion live compile", () => {
  it("compiles the default composition source", () => {
    const result = compileRemotionSource(DEFAULT_REMOTION_SOURCE_CODE);
    expect(result.error).toBeUndefined();
    expect(typeof result.component).toBe("function");
    const compiled = result as unknown as RemotionCompileSuccess;
    expect(compiled.durationInFrames).toBe(90);
    expect(compiled.fps).toBe(30);
    expect(compiled.width).toBe(1280);
    expect(compiled.height).toBe(720);
  });

  it("reads duration from official Composition", () => {
    const result = compileRemotionSource(`function Scene() {
  return <AbsoluteFill />;
}
function RemotionRoot() {
  return (
    <Composition
      id="Main"
      component={Scene}
      durationInFrames={200}
      fps={30}
      width={1280}
      height={720}
    />
  );
}`);
    expect(result.error).toBeUndefined();
    expect((result as unknown as RemotionCompileSuccess).durationInFrames).toBe(200);
    expect(typeof result.component).toBe("function");
  });

  it("returns an error when official Composition is missing", () => {
    const result = compileRemotionSource("function Composition() { return null; }");
    expect(result.component).toBeUndefined();
    expect(result.error).toMatch(/RemotionRoot|Composition/i);
  });
});
