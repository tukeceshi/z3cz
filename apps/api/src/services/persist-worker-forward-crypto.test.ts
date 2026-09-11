import { describe, expect, it } from "vitest";

import {
  derivePersistWorkerForwardHmacKey,
  isPersistWorkerForwardSignatureValid,
  signPersistWorkerForwardRequest,
} from "./persist-worker-forward-crypto";

describe("persist-worker-forward-crypto", () => {
  it("accepts a matching signature within the time window", () => {
    const hmacKey = derivePersistWorkerForwardHmacKey("jwt-secret");
    const timestampMs = Date.now();
    const signature = signPersistWorkerForwardRequest({
      hmacKey,
      timestampMs,
      method: "POST",
      url: "https://api.example.com/v1/chat",
    });

    expect(
      isPersistWorkerForwardSignatureValid({
        hmacKey,
        timestampMs,
        method: "POST",
        url: "https://api.example.com/v1/chat",
        signature,
      })
    ).toBe(true);
  });

  it("rejects a stale timestamp", () => {
    const hmacKey = derivePersistWorkerForwardHmacKey("jwt-secret");
    const timestampMs = Date.now() - 10 * 60 * 1000;
    const signature = signPersistWorkerForwardRequest({
      hmacKey,
      timestampMs,
      method: "GET",
      url: "https://api.example.com/v1/models",
    });

    expect(
      isPersistWorkerForwardSignatureValid({
        hmacKey,
        timestampMs,
        method: "GET",
        url: "https://api.example.com/v1/models",
        signature,
      })
    ).toBe(false);
  });
});
