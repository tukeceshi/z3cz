import { describe, expect, it, vi } from "vitest";

import {
  extractUpstreamRequestId,
  fetchWithUpstreamLog,
  redactJsonValue,
  redactMediaUrl,
  redactRequestBody,
} from "./upstream-request-log";

describe("redactMediaUrl", () => {
  it("strips query and hash from https URLs", () => {
    expect(
      redactMediaUrl(
        "https://example.com/path/file.png?X-Tos-Signature=abc#frag"
      )
    ).toBe("https://example.com/path/file.png");
  });
});

describe("redactRequestBody", () => {
  it("redacts secrets, signed URLs, and base64 payloads", () => {
    const redacted = redactRequestBody({
      model: "doubao-seedance-2-fast",
      api_key: "secret",
      content: [
        { type: "text", text: "hello" },
        {
          type: "image_url",
          image_url: {
            url: "https://cdn.example.com/a.png?sig=1",
          },
          role: "reference_image",
        },
      ],
      dataBase64: "A".repeat(300),
      ratio: "9:16",
      duration: 15,
    });

    expect(redacted).toEqual({
      model: "doubao-seedance-2-fast",
      api_key: "[redacted]",
      content: [
        { type: "text", text: "hello" },
        {
          type: "image_url",
          image_url: {
            url: "https://cdn.example.com/a.png",
          },
          role: "reference_image",
        },
      ],
      dataBase64: "[redacted]",
      ratio: "9:16",
      duration: 15,
    });
  });
});

describe("extractUpstreamRequestId", () => {
  it("parses Request id from error text", () => {
    expect(
      extractUpstreamRequestId(
        "The request failed. Request id: 0217859952916041f8649ba3601f67aef8adf8b2a414910f3f714",
        {}
      )
    ).toBe("0217859952916041f8649ba3601f67aef8adf8b2a414910f3f714");
  });
});

describe("fetchWithUpstreamLog", () => {
  it("invokes sink with redacted request body", async () => {
    const sink = vi.fn();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "task-1", error: { message: "boom" } }), {
        status: 400,
      })
    );

    const response = await fetchWithUpstreamLog(
      "https://ark.example.com/api/v3/contents/generations/tasks?token=x",
      {
        method: "POST",
        body: JSON.stringify({
          model: "m",
          content: [
            {
              type: "image_url",
              image_url: { url: "https://cdn.example.com/a.png?sig=1" },
            },
          ],
        }),
      },
      sink
    );

    expect(response.status).toBe(400);
    expect(sink).toHaveBeenCalledTimes(1);
    expect(sink.mock.calls[0]?.[0]).toMatchObject({
      method: "POST",
      url: "https://ark.example.com/api/v3/contents/generations/tasks",
      httpStatus: 400,
      upstreamRequestId: "task-1",
      requestBody: {
        model: "m",
        content: [
          {
            type: "image_url",
            image_url: { url: "https://cdn.example.com/a.png" },
          },
        ],
      },
    });

    fetchMock.mockRestore();
  });
});

describe("redactJsonValue", () => {
  it("leaves short non-url strings unchanged", () => {
    expect(redactJsonValue("hello")).toBe("hello");
  });
});
