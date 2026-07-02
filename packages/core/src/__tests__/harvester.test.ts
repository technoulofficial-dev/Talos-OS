import { describe, it, expect, vi, beforeEach } from "vitest";
import { harvestSkill, LICENSE_ALLOWLIST, type SkillSource } from "../harvester/index.js";

// Mock the router (internal module)
vi.mock("../ai-engine/router.js", () => ({
  routeUnlimited: vi.fn(),
}));

// Mock @talos/db (external package)
const { mockGetSkill, mockUpdateRate } = vi.hoisted(() => ({
  mockGetSkill: vi.fn(),
  mockUpdateRate: vi.fn(),
}));
vi.mock("@talos/db", () => ({
  registerSkill: vi.fn(),
  getSkill: mockGetSkill,
  updateSuccessRate: mockUpdateRate,
}));

import { routeUnlimited } from "../ai-engine/router.js";
import { registerSkill } from "@talos/db";

const mockRoute = vi.mocked(routeUnlimited);
const mockRegister = vi.mocked(registerSkill);

function makeSource(overrides: Partial<SkillSource> = {}): SkillSource {
  return {
    type: "github",
    identifier: "https://github.com/example/skill",
    license: "MIT",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Harvester — License Compliance", () => {
  it("allows MIT license", async () => {
    mockRoute.mockResolvedValue({ output: '{"name":"test","description":"d","logic":"function x() { return 1; }","parameters":[],"dependencies":[],"tags":[]}', model: "mock", provider: "mock" } as never);
    mockRegister.mockResolvedValue({ id: "1", name: "test", description: "d", source: "", sourceTool: "", category: "uncategorized", promptTemplate: "", triggerPhrases: [], successRate: 0, isCached: false });

    const result = await harvestSkill(makeSource({ license: "MIT" }), { skipDb: true });
    expect(result.licenseCompliant).toBe(true);
  });

  it("rejects unknown license", async () => {
    const result = await harvestSkill(makeSource({ license: "Proprietary" }));
    expect(result.licenseCompliant).toBe(false);
    expect(result.success).toBe(false);
    expect(result.output).toContain("not in the allowlist");
  });

  it("rejects empty license", async () => {
    const result = await harvestSkill(makeSource({ license: "" }));
    expect(result.licenseCompliant).toBe(false);
  });
});

describe("Harvester — Skill Extraction", () => {
  it("returns error when LLM fails to extract", async () => {
    mockRoute.mockResolvedValue({ output: "I don't understand", model: "mock", provider: "mock" } as never);

    const result = await harvestSkill(makeSource(), { skipDb: true });
    expect(result.success).toBe(false);
    expect(result.extracted).toBeNull();
    expect(result.error).toContain("Failed to extract");
  });

  it("parses valid JSON from LLM output", async () => {
    const skillJson = JSON.stringify({
      name: "my-skill",
      description: "A test skill",
      parameters: [],
      logic: "function run(input) { return input; }",
      dependencies: [],
      tags: ["test"],
    });
    mockRoute.mockResolvedValue({ output: `Here is the skill:\n${skillJson}`, model: "mock", provider: "mock" } as never);

    const result = await harvestSkill(makeSource(), { skipDb: true });
    expect(result.success).toBe(true);
    expect(result.extracted?.name).toBe("my-skill");
    expect(result.extracted?.logic).toContain("function run");
  });

  it("validates skill name format", async () => {
    const skillJson = JSON.stringify({
      name: "UPPERCASE BAD",
      description: "d",
      logic: "function x() { return true; }",
      dependencies: [],
      tags: [],
    });
    mockRoute.mockResolvedValue({ output: skillJson, model: "mock", provider: "mock" } as never);

    const result = await harvestSkill(makeSource(), { skipDb: true });
    expect(result.success).toBe(false);
    expect(result.error).toContain("kebab-case");
  });

  it("validates skill logic minimum length", async () => {
    const skillJson = JSON.stringify({
      name: "tiny",
      description: "d",
      logic: "short",
      dependencies: [],
      tags: [],
    });
    mockRoute.mockResolvedValue({ output: skillJson, model: "mock", provider: "mock" } as never);

    const result = await harvestSkill(makeSource(), { skipDb: true });
    expect(result.success).toBe(false);
    expect(result.error).toContain("too short");
  });
});

describe("Harvester — DB Registration", () => {
  it("registers skill in DB with correct input", async () => {
    const skillJson = JSON.stringify({
      name: "reg-test",
      description: "Registration test",
      parameters: [{ name: "url", type: "string", required: true, description: "URL to fetch" }],
      logic: "async function run(params) { return fetch(params.url); }",
      dependencies: [],
      tags: ["fetch", "http"],
      category: "automation",
    });
    mockRoute.mockResolvedValue({ output: skillJson, model: "mock", provider: "mock" } as never);
    mockRegister.mockResolvedValue({
      id: "uuid-123", name: "reg-test", description: "Registration test",
      source: "https://example.com", sourceTool: "harvester", category: "automation",
      promptTemplate: "async function run(params) { return fetch(params.url); }",
      triggerPhrases: ["fetch", "http"], successRate: 0, isCached: false,
    });

    const result = await harvestSkill(makeSource());
    expect(result.success).toBe(true);
    expect(result.skill?.name).toBe("reg-test");
    expect(mockRegister).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "reg-test",
        source: "https://github.com/example/skill",
        sourceTool: "harvester",
        category: "automation",
        triggerPhrases: ["fetch", "http"],
      }),
      undefined,
    );
  });

  it("returns error when DB registration fails", async () => {
    const skillJson = JSON.stringify({
      name: "fail-db",
      description: "d",
      logic: "function x() { return 1; }",
      dependencies: [],
      tags: [],
    });
    mockRoute.mockResolvedValue({ output: skillJson, model: "mock", provider: "mock" } as never);
    mockRegister.mockRejectedValue(new Error("duplicate key"));

    const result = await harvestSkill(makeSource());
    expect(result.success).toBe(false);
    expect(result.error).toContain("duplicate key");
    expect(result.extracted?.name).toBe("fail-db");
  });

  it("passes client to registerSkill", async () => {
    const skillJson = JSON.stringify({
      name: "client-test",
      description: "d",
      logic: "function x() { return 1; }",
      dependencies: [],
      tags: [],
    });
    mockRoute.mockResolvedValue({ output: skillJson, model: "mock", provider: "mock" } as never);
    mockRegister.mockResolvedValue({
      id: "1", name: "client-test", description: "d", source: "", sourceTool: "",
      category: "uncategorized", promptTemplate: "", triggerPhrases: [],
      successRate: 0, isCached: false,
    });
    const fakeClient = { from: vi.fn() };

    await harvestSkill(makeSource(), { client: fakeClient });
    expect(mockRegister).toHaveBeenCalledWith(expect.anything(), fakeClient);
  });
});

describe("Harvester — Skip DB Mode", () => {
  it("skips DB registration when skipDb is true", async () => {
    const skillJson = JSON.stringify({
      name: "no-db",
      description: "d",
      logic: "function x() { return 1; }",
      dependencies: [],
      tags: [],
    });
    mockRoute.mockResolvedValue({ output: skillJson, model: "mock", provider: "mock" } as never);

    const result = await harvestSkill(makeSource(), { skipDb: true });
    expect(result.success).toBe(true);
    expect(result.skill).toBeNull();
    expect(mockRegister).not.toHaveBeenCalled();
  });
});

describe("Harvester — Deduplication", () => {
  beforeEach(() => {
    mockGetSkill.mockReset();
    mockUpdateRate.mockReset();
  });

  it("skips registration if skill already exists", async () => {
    const skillJson = JSON.stringify({
      name: "already-exists",
      description: "Existing skill",
      logic: "function run(p) { return p.x; }",
      dependencies: [],
      tags: [],
    });
    mockRoute.mockResolvedValue({ output: skillJson, model: "mock", provider: "mock" } as never);
    mockGetSkill.mockResolvedValue({
      id: "existing-uuid", name: "already-exists", description: "Existing skill",
      source: "prev", sourceTool: "harvester", category: "uncategorized",
      promptTemplate: "", triggerPhrases: [], successRate: 0.3, isCached: false,
    });

    const result = await harvestSkill(makeSource());
    expect(result.success).toBe(true);
    expect(result.skill?.name).toBe("already-exists");
    expect(mockRegister).not.toHaveBeenCalled();
    expect(mockUpdateRate).toHaveBeenCalledWith("already-exists", 0.5, undefined);
  });

  it("registers normally when skill does not exist", async () => {
    const skillJson = JSON.stringify({
      name: "fresh-skill",
      description: "New skill",
      logic: "function run(p) { return p.x; }",
      dependencies: [],
      tags: [],
    });
    mockRoute.mockResolvedValue({ output: skillJson, model: "mock", provider: "mock" } as never);
    mockGetSkill.mockResolvedValue(null);
    mockRegister.mockResolvedValue({
      id: "fresh-uuid", name: "fresh-skill", description: "New skill",
      source: "https://github.com/example/skill", sourceTool: "harvester", category: "uncategorized",
      promptTemplate: "", triggerPhrases: [], successRate: 0, isCached: false,
    });

    const result = await harvestSkill(makeSource());
    expect(result.success).toBe(true);
    expect(result.skill?.name).toBe("fresh-skill");
    expect(mockRegister).toHaveBeenCalled();
    expect(mockUpdateRate).not.toHaveBeenCalled();
  });
});

describe("Harvester — Sandbox Test", () => {
  const origEnv = process.env["TALOS_HARVESTER_SANDBOX_ENABLED"];

  afterEach(() => {
    if (origEnv === undefined) {
      delete process.env["TALOS_HARVESTER_SANDBOX_ENABLED"];
    } else {
      process.env["TALOS_HARVESTER_SANDBOX_ENABLED"] = origEnv;
    }
  });

  it("skips sandbox test by default", async () => {
    const skillJson = JSON.stringify({
      name: "no-sandbox",
      description: "d",
      logic: "function run(p) { return p.x; }",
      dependencies: [],
      tags: [],
    });
    mockRoute.mockResolvedValue({ output: skillJson, model: "mock", provider: "mock" } as never);

    const result = await harvestSkill(makeSource(), { skipDb: true });
    expect(result.testOutput).toContain("Sandbox test disabled");
    expect(result.testPassed).toBe(true);
  });

  it("runs sandbox test when enabled", async () => {
    process.env["TALOS_HARVESTER_SANDBOX_ENABLED"] = "true";
    const skillJson = JSON.stringify({
      name: "sandbox-me",
      description: "d",
      logic: "function run(p) { return 'ok-' + p.input; }",
      dependencies: [],
      tags: [],
    });
    mockRoute.mockResolvedValue({ output: skillJson, model: "mock", provider: "mock" } as never);

    const result = await harvestSkill(makeSource(), { skipDb: true });
    expect(result.testPassed).toBe(true);
    expect(result.testOutput).toContain("sandbox-verify");
  });
});

describe("Harvester — LICENSE_ALLOWLIST", () => {
  it("contains common open-source licenses", () => {
    expect(LICENSE_ALLOWLIST).toContain("MIT");
    expect(LICENSE_ALLOWLIST).toContain("Apache-2.0");
    expect(LICENSE_ALLOWLIST).toContain("GPL-3.0");
    expect(LICENSE_ALLOWLIST.length).toBeGreaterThanOrEqual(10);
  });
});
