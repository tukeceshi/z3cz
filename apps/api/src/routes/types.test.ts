import type { GetNodeTypesResponse, NodeType } from "@dafthunk/types";
import { AI_GENERATIVE_NODE_TYPES } from "@dafthunk/types";
import { env } from "cloudflare:test";
import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Bindings } from "../context";
import { ApiContext } from "../context";

vi.mock("../auth", () => ({
  optionalJwtMiddleware: async (
    _c: unknown,
    next: () => Promise<void>
  ): Promise<void> => {
    await next();
  },
}));

vi.mock("../utils/workflow-scheme", () => ({
  filterNodeTypesForScheme: vi.fn(
    (nodeTypes: NodeType[]) => nodeTypes
  ),
}));

const { defaultTypesCatalog, generativeNodeTypes, getAllNodeTypesMock } =
  vi.hoisted(() => {
    const generativeNodeTypes = ["ai-text", "ai-image", "ai-video"] as const;

    function createCatalogNodeType(type: string): NodeType {
      return {
        id: type,
        name: type,
        type,
        tags: [],
        icon: "box",
        inputs: [],
        outputs: [],
      };
    }

    const defaultTypesCatalog = [
      ...generativeNodeTypes.map((type) => createCatalogNodeType(type)),
      createCatalogNodeType("http-request"),
    ] satisfies NodeType[];

    return {
      generativeNodeTypes,
      defaultTypesCatalog,
      getAllNodeTypesMock: vi.fn(async () => defaultTypesCatalog),
    };
  });

vi.mock("../utils/node-types", () => ({
  getAllNodeTypes: getAllNodeTypesMock,
}));

const mockExecutionCtx = {
  waitUntil: () => {},
  passThroughOnException: () => {},
} satisfies ExecutionContext;

describe("Types Route Tests", () => {
  let app: Hono<ApiContext>;
  let typeRoutes: typeof import("./types").default;

  function requestTypes(path = "/types", init?: RequestInit) {
    return app.request(
      path,
      init ?? { method: "GET" },
      env as Bindings,
      mockExecutionCtx
    );
  }

  beforeEach(async () => {
    getAllNodeTypesMock.mockResolvedValue(defaultTypesCatalog);
    typeRoutes = (await import("./types")).default;
    app = new Hono<ApiContext>();
    app.route("/types", typeRoutes);
  });

  describe("Basic Functionality", () => {
    it("should handle GET requests to /types", async () => {
      const response = await requestTypes();

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain(
        "application/json"
      );
    });

    it("should return valid GetNodeTypesResponse structure", async () => {
      const response = await requestTypes();

      const data = (await response.json()) as GetNodeTypesResponse;

      expect(data).toHaveProperty("nodeTypes");
      expect(Array.isArray(data.nodeTypes)).toBe(true);
      expect(data.nodeTypes.length).toBeGreaterThan(0);
    });

    it("should return node types with correct structure", async () => {
      const response = await requestTypes();

      const data = (await response.json()) as GetNodeTypesResponse;
      const nodeType = data.nodeTypes[0];

      expect(nodeType).toHaveProperty("id");
      expect(nodeType).toHaveProperty("name");
      expect(nodeType).toHaveProperty("type");
      expect(nodeType).toHaveProperty("tags");
      expect(nodeType).toHaveProperty("icon");
      expect(nodeType).toHaveProperty("inputs");
      expect(nodeType).toHaveProperty("outputs");

      expect(typeof nodeType.id).toBe("string");
      expect(typeof nodeType.name).toBe("string");
      expect(typeof nodeType.type).toBe("string");
      expect(Array.isArray(nodeType.tags)).toBe(true);
      expect(typeof nodeType.icon).toBe("string");
      expect(Array.isArray(nodeType.inputs)).toBe(true);
      expect(Array.isArray(nodeType.outputs)).toBe(true);
    });
  });

  describe("Node Types", () => {
    it("should return all node types", async () => {
      const response = await requestTypes();

      expect(response.status).toBe(200);

      const data = (await response.json()) as GetNodeTypesResponse;
      expect(data).toHaveProperty("nodeTypes");
      expect(Array.isArray(data.nodeTypes)).toBe(true);
      expect(data.nodeTypes.length).toBeGreaterThan(0);
    });
  });

  describe("Error Handling", () => {
    it("should handle OPTIONS requests (CORS preflight)", async () => {
      const response = await requestTypes("/types", {
        method: "OPTIONS",
      });

      expect(response.status).not.toBe(500);
    });

    it("should handle POST requests with method not allowed", async () => {
      const response = await requestTypes("/types", {
        method: "POST",
        body: JSON.stringify({ test: "data" }),
        headers: {
          "Content-Type": "application/json",
        },
      });

      expect(response.status).not.toBe(500);
    });

    it("should handle malformed query parameters", async () => {
      const response = await requestTypes("/types?workflowType=");

      expect(response.status).toBe(200);
      const data = (await response.json()) as GetNodeTypesResponse;
      expect(data).toHaveProperty("nodeTypes");
    });
  });

  describe("Response Validation", () => {
    it("should return consistent response format", async () => {
      const response = await requestTypes();

      const data = (await response.json()) as GetNodeTypesResponse;

      expect(Object.keys(data)).toEqual(["nodeTypes"]);
      expect(data.nodeTypes).toBeDefined();
      expect(Array.isArray(data.nodeTypes)).toBe(true);
    });

    it("should return node types with required fields", async () => {
      const response = await requestTypes();

      const data = (await response.json()) as GetNodeTypesResponse;

      data.nodeTypes.forEach((nodeType) => {
        expect(nodeType.id).toBeDefined();
        expect(nodeType.name).toBeDefined();
        expect(nodeType.type).toBeDefined();
        expect(nodeType.tags).toBeDefined();
        expect(nodeType.icon).toBeDefined();
        expect(nodeType.inputs).toBeDefined();
        expect(nodeType.outputs).toBeDefined();

        expect(typeof nodeType.id).toBe("string");
        expect(typeof nodeType.name).toBe("string");
        expect(typeof nodeType.type).toBe("string");
        expect(Array.isArray(nodeType.tags)).toBe(true);
        expect(typeof nodeType.icon).toBe("string");
        expect(Array.isArray(nodeType.inputs)).toBe(true);
        expect(Array.isArray(nodeType.outputs)).toBe(true);

        if (nodeType.description !== undefined) {
          expect(typeof nodeType.description).toBe("string");
        }
        if (nodeType.usage !== undefined) {
          expect(typeof nodeType.usage).toBe("number");
        }
        if (nodeType.trigger !== undefined) {
          expect(typeof nodeType.trigger).toBe("boolean");
        }
      });
    });

    it("should return node types with valid parameters", async () => {
      const response = await requestTypes();

      const data = (await response.json()) as GetNodeTypesResponse;

      data.nodeTypes.forEach((nodeType) => {
        nodeType.inputs.forEach((input) => {
          expect(input.name).toBeDefined();
          expect(input.type).toBeDefined();
          expect(typeof input.name).toBe("string");
          expect(typeof input.type).toBe("string");

          expect([
            "string",
            "number",
            "boolean",
            "image",
            "json",
            "document",
            "audio",
            "schema",
            "any",
          ]).toContain(input.type);
        });

        nodeType.outputs.forEach((output) => {
          expect(output.name).toBeDefined();
          expect(output.type).toBeDefined();
          expect(typeof output.name).toBe("string");
          expect(typeof output.type).toBe("string");

          expect([
            "string",
            "number",
            "boolean",
            "image",
            "json",
            "document",
            "audio",
            "any",
          ]).toContain(output.type);
        });
      });
    });
  });

  describe("Performance and Reliability", () => {
    it("should respond quickly", async () => {
      const startTime = Date.now();

      const response = await requestTypes();

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(1000);
    });

    it("should handle multiple concurrent requests", async () => {
      const requests = Array.from({ length: 5 }, () => requestTypes());

      const responses = await Promise.all(requests);

      responses.forEach((response) => {
        expect(response.status).toBe(200);
      });
    });

    it("should return consistent results across multiple calls", async () => {
      const response1 = await requestTypes();
      const response2 = await requestTypes();

      const data1 = (await response1.json()) as GetNodeTypesResponse;
      const data2 = (await response2.json()) as GetNodeTypesResponse;

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      expect(data1.nodeTypes.length).toBe(data2.nodeTypes.length);

      expect(data1.nodeTypes.map((n) => n.id)).toEqual(
        data2.nodeTypes.map((n) => n.id)
      );
    });
  });

  describe("Core catalog", () => {
    it("returns only core generative types", async () => {
      getAllNodeTypesMock.mockResolvedValueOnce(
        defaultTypesCatalog.filter((entry) =>
          generativeNodeTypes.includes(
            entry.type as (typeof generativeNodeTypes)[number]
          )
        )
      );

      const response = await requestTypes();
      expect(response.status).toBe(200);

      const data = (await response.json()) as GetNodeTypesResponse;
      expect(data.nodeTypes.map((entry) => entry.type)).toEqual([
        ...AI_GENERATIVE_NODE_TYPES,
      ]);
    });
  });
});
