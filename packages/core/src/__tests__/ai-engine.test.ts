import { describe, it, expect } from "vitest";
import { getModelInfo, getFallbackModels, G0DM0D3_FREE_MODELS, OWL_ALPHA_MODEL } from "../g0dm0d3/models.js";
import { scoreCapability } from "../g0dm0d3/score.js";
import { wrapPrompt } from "../g0dm0d3/wrapper.js";
import { buildBudgetState } from "../budget/state.js";
import { isOwlAlphaEnabled } from "../ai-engine/router.js";

describe("G0DM0D3 — Model Registry", () => {
  it("contains free models", () => {
    expect(G0DM0D3_FREE_MODELS.length).toBeGreaterThanOrEqual(11);
    expect(G0DM0D3_FREE_MODELS[0]).toHaveProperty("id");
    expect(G0DM0D3_FREE_MODELS[0]).toHaveProperty("contextLength");
  });

  it("finds model by ID", () => {
    const model = getModelInfo("qwen/qwen3-coder:free");
    expect(model).toBeDefined();
    expect(model.name).toContain("Qwen3");
  });

  it("returns fallback for unknown model", () => {
    const model = getModelInfo("unknown/model");
    expect(model).toBeDefined();
    expect(model.name).toBe("Custom G0DM0D3 Model");
  });

  it("generates fallback lists excluding the failed model", () => {
    const fallbacks = getFallbackModels("qwen/qwen3-coder:free");
    expect(fallbacks.length).toBeGreaterThanOrEqual(10);
    expect(fallbacks).not.toContain("qwen/qwen3-coder:free");
  });
});

describe("G0DM0D3 — Owl Alpha Top Priority", () => {
  it("exposes OWL_ALPHA_MODEL constant", () => {
    expect(OWL_ALPHA_MODEL).toBe("openrouter/owl-alpha");
  });

  it("puts Owl Alpha at index 0 of the model list", () => {
    const owl = G0DM0D3_FREE_MODELS[0]!;
    expect(owl.id).toBe(OWL_ALPHA_MODEL);
    expect(owl.contextLength).toBeGreaterThanOrEqual(1_000_000);
  });

  it("describes the logging caveat in the model description", () => {
    const owl = G0DM0D3_FREE_MODELS[0]!;
    expect(owl.description.toLowerCase()).toContain("logging");
  });

  it("includes Owl Alpha in the fallback list when a different model fails", () => {
    const fallbacks = getFallbackModels("qwen/qwen3-coder:free");
    expect(fallbacks).toContain(OWL_ALPHA_MODEL);
  });

  it("isOwlAlphaEnabled defaults to true (opt-OUT)", () => {
    delete process.env["TALOS_OWL_ALPHA_ENABLED"];
    expect(isOwlAlphaEnabled()).toBe(true);
  });

  it("isOwlAlphaEnabled returns true when explicitly set to 'true'", () => {
    process.env["TALOS_OWL_ALPHA_ENABLED"] = "true";
    expect(isOwlAlphaEnabled()).toBe(true);
    delete process.env["TALOS_OWL_ALPHA_ENABLED"];
  });

  it("isOwlAlphaEnabled returns false only when explicitly set to 'false'", () => {
    process.env["TALOS_OWL_ALPHA_ENABLED"] = "false";
    expect(isOwlAlphaEnabled()).toBe(false);
    delete process.env["TALOS_OWL_ALPHA_ENABLED"];
  });
});

describe("G0DM0D3 — Capability Scoring", () => {
  it("scores a capable device highly", () => {
    const result = scoreCapability({
      modelCount: 10,
      totalVramGb: 24,
      latencyMs: 100,
      uptimeRatio: 0.99,
    });
    expect(result.score).toBeGreaterThan(0.5);
    expect(result.score).toBeLessThanOrEqual(1);
  });

  it("scores a weak device low", () => {
    const result = scoreCapability({
      modelCount: 1,
      totalVramGb: 2,
      latencyMs: 5000,
      uptimeRatio: 0.1,
    });
    expect(result.score).toBeLessThan(0.5);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it("provides breakdown of individual scores", () => {
    const result = scoreCapability({
      modelCount: 5,
      totalVramGb: 12,
      latencyMs: 200,
      uptimeRatio: 0.95,
    });
    expect(result.breakdown).toHaveProperty("modelCount");
    expect(result.breakdown).toHaveProperty("vram");
    expect(result.breakdown).toHaveProperty("latencyInverse");
    expect(result.breakdown).toHaveProperty("uptime");
  });
});

describe("G0DM0D3 — Prompt Wrapper", () => {
  it("wraps prompt with system instructions", () => {
    const result = wrapPrompt("test prompt");
    expect(result.finalPrompt).toBe("test prompt");
    expect(result.finalSystemPrompt).toContain("G0DM0D3 UNLOCKED");
  });

  it("combines custom system prompt with wrapper", () => {
    const result = wrapPrompt("test prompt", "You are helpful.");
    expect(result.finalSystemPrompt).toContain("G0DM0D3 UNLOCKED");
    expect(result.finalSystemPrompt).toContain("You are helpful.");
  });
});

describe("Router — Module exports", () => {
  it("exports route and pickProvider", async () => {
    const router = await import("../router/index.js");
    expect(router.route).toBeDefined();
    expect(typeof router.route).toBe("function");
    expect(router.pickProvider).toBeDefined();
    expect(typeof router.pickProvider).toBe("function");
  });

  it("exports trace functions", async () => {
    const { recordTrace, getRecentTraces, clearTraces } = await import("../router/index.js");
    expect(recordTrace).toBeDefined();
    expect(getRecentTraces).toBeDefined();
    expect(clearTraces).toBeDefined();
  });
});

describe("AI Engine — Canonical Router exports", () => {
  it("exports routeUnlimited and checkProviderHealth", async () => {
    const engine = await import("../ai-engine/index.js");
    expect(engine.routeUnlimited).toBeDefined();
    expect(typeof engine.routeUnlimited).toBe("function");
    expect(engine.checkProviderHealth).toBeDefined();
    expect(typeof engine.checkProviderHealth).toBe("function");
  });
});

describe("Budget — Integration", () => {
  it("budget gate is accessible", async () => {
    const { decide } = await import("../budget/gate.js");
    const result = await decide({
      agentId: "test-agent",
      channel: "cloud",
      estimatedTokens: 1000,
      estimatedCostUsd: 0.001,
      priority: "normal",
    });
    expect(result).toHaveProperty("allow");
  });

  it("budget state builds with defaults", () => {
    const state = buildBudgetState();
    expect(state.enabled).toBe(true);
    expect(state.monthlyCapUsd).toBeGreaterThan(0);
  });
});
