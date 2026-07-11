import { describe, expect, it } from "vitest";

import {
  classifyInferenceProbe,
  isVolcanoModelActivationBlocking,
} from "./probe-model-activation";

describe("classifyInferenceProbe", () => {
  it("maps ModelNotOpen to not_open", () => {
    expect(classifyInferenceProbe(404, "ModelNotOpen")).toBe("not_open");
  });

  it("maps OperationDenied.ServiceNotOpen to service_not_open", () => {
    expect(
      classifyInferenceProbe(403, "OperationDenied.ServiceNotOpen")
    ).toBe("service_not_open");
  });

  it("maps InvalidEndpointOrModel.NotFound to invalid_model_id", () => {
    expect(
      classifyInferenceProbe(404, "InvalidEndpointOrModel.NotFound")
    ).toBe("invalid_model_id");
  });

  it("maps AuthenticationError to auth_error", () => {
    expect(classifyInferenceProbe(401, "AuthenticationError")).toBe("auth_error");
  });

  it("maps InvalidParameter to open", () => {
    expect(classifyInferenceProbe(400, "InvalidParameter")).toBe("open");
  });

  it("maps HTTP 200 to open", () => {
    expect(classifyInferenceProbe(200, undefined)).toBe("open");
  });

  it("maps unknown failures to transient_error", () => {
    expect(classifyInferenceProbe(500, undefined)).toBe("transient_error");
  });
});

describe("isVolcanoModelActivationBlocking", () => {
  it("blocks not_open and service_not_open", () => {
    expect(isVolcanoModelActivationBlocking("not_open")).toBe(true);
    expect(isVolcanoModelActivationBlocking("service_not_open")).toBe(true);
    expect(isVolcanoModelActivationBlocking("open")).toBe(false);
    expect(isVolcanoModelActivationBlocking("invalid_model_id")).toBe(false);
  });
});
