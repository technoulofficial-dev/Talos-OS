import { describe, it, expect, beforeEach } from "vitest";
import { decide } from "../budget/gate.js";
import { buildBudgetState, getCurrentMonthPeriod, getCurrentHourPeriod } from "../budget/state.js";
import { recordSpend, getLedgerSummary, clearLedger, getMonthlyRecords, getHourlyRecords } from "../budget/ledger.js";
import { estimateTokens, estimateCost, buildEstimate } from "../budget/tokens.js";
import { checkRateLimit, clearRateLimits } from "../budget/rate.js";
import { emitBudgetAlert, getRecentAlerts, clearAlerts } from "../budget/alert.js";

describe("Budget Gate", () => {
  it("allows local tasks without checking budget", async () => {
    const result = await decide({
      agentId: "odin",
      channel: "local",
      estimatedTokens: 1000,
      estimatedCostUsd: 0,
      priority: "normal",
    });
    expect(result.allow).toBe(true);
    expect(result.reason).toBe("local_task");
  });

  it("allows cloud tasks under budget", async () => {
    const result = await decide({
      agentId: "odin",
      channel: "cloud",
      estimatedTokens: 100,
      estimatedCostUsd: 0.01,
      priority: "normal",
    });
    expect(result.allow).toBe(true);
  });

  it("rejects when task exceeds per-task token cap", async () => {
    const result = await decide({
      agentId: "odin",
      channel: "cloud",
      estimatedTokens: 200_000,
      estimatedCostUsd: 0.01,
      priority: "normal",
    });
    expect(result.allow).toBe(false);
    expect(result.reason).toBe("task_too_large");
  });
});

describe("Budget State", () => {
  it("loads defaults", () => {
    const state = buildBudgetState();
    expect(state.monthlyCapUsd).toBe(50);
    expect(state.hourlyCapUsd).toBe(5);
    expect(state.perTaskTokenCap).toBe(100000);
    expect(state.perMinuteRequests).toBe(30);
    expect(state.hardKillAt).toBe(0.95);
    expect(state.enabled).toBe(true);
  });

  it("accepts custom config", () => {
    const state = buildBudgetState({
      monthly_usd: 100,
      hourly_usd: 10,
      per_task_tokens: 50000,
      per_minute_requests: 60,
      hard_kill_at: 0.9,
    });
    expect(state.monthlyCapUsd).toBe(100);
    expect(state.hourlyCapUsd).toBe(10);
    expect(state.perTaskTokenCap).toBe(50000);
  });

  it("generates valid period IDs", () => {
    const month = getCurrentMonthPeriod();
    expect(month).toMatch(/^\d{4}-\d{2}$/);
    const hour = getCurrentHourPeriod();
    expect(hour).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}$/);
  });
});

describe("Budget Ledger", () => {
  beforeEach(() => {
    clearLedger();
  });

  it("records and retrieves spend", async () => {
    await recordSpend({
      agentId: "odin",
      providerId: "nvidia-nim",
      tokensIn: 500,
      tokensOut: 200,
      costUsd: 0.001,
      timestamp: new Date(),
    });

    const summary = await getLedgerSummary();
    expect(summary.monthlyUsd).toBe(0.001);
    expect(summary.records.length).toBe(1);
  });

  it("records multiple entries", async () => {
    for (let i = 0; i < 3; i++) {
      await recordSpend({
        agentId: "odin",
        providerId: "openrouter",
        tokensIn: 100,
        tokensOut: 50,
        costUsd: 0.0005,
        timestamp: new Date(),
      });
    }

    const summary = await getLedgerSummary();
    expect(summary.monthlyUsd).toBeCloseTo(0.0015, 6);
    expect(summary.records.length).toBe(3);
  });

  it("creates separate monthly and hourly records", async () => {
    await recordSpend({
      agentId: "odin",
      providerId: "openrouter",
      tokensIn: 100,
      tokensOut: 50,
      costUsd: 0.0005,
      timestamp: new Date(),
    });

    const monthly = await getMonthlyRecords();
    expect(monthly.length).toBeGreaterThanOrEqual(1);

    const hourly = await getHourlyRecords();
    expect(hourly.length).toBeGreaterThanOrEqual(1);
  });
});

describe("Budget Token Estimation", () => {
  it("estimates tokens from text length", () => {
    const tokens = estimateTokens("Hello, world!");
    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBeLessThan(10);
  });

  it("estimates cost for known providers", () => {
    const cost = estimateCost("nvidia-nim", 1000, 500);
    expect(cost).toBeGreaterThan(0);
  });

  it("returns zero cost for unknown providers", () => {
    const cost = estimateCost("unknown", 1000, 500);
    expect(cost).toBe(0);
  });

  it("builds complete estimate", () => {
    const estimate = buildEstimate({
      systemPrompt: "You are a helpful assistant.",
      messages: [{ role: "user", content: "Hello" }],
      expectedOutputTokens: 200,
      providerId: "nvidia-nim",
    });
    expect(estimate.inputTokens).toBeGreaterThan(0);
    expect(estimate.outputTokens).toBe(200);
    expect(estimate.totalTokens).toBe(estimate.inputTokens + 200);
    expect(estimate.providerId).toBe("nvidia-nim");
  });
});

describe("Budget Rate Limiting", () => {
  beforeEach(() => {
    clearRateLimits();
  });

  it("allows requests under the limit", async () => {
    const result = await checkRateLimit("odin", 30);
    expect(result.allowed).toBe(true);
  });

  it("allows requests at the limit boundary", async () => {
    for (let i = 0; i < 30; i++) {
      const result = await checkRateLimit("odin", 30);
      expect(result.allowed).toBe(true);
    }
  });
});

describe("Budget Alerts", () => {
  beforeEach(() => {
    clearAlerts();
  });

  it("emits alert on denied decision", () => {
    emitBudgetAlert({ allow: false, reason: "monthly_cap_hit" });

    const alerts = getRecentAlerts();
    expect(alerts.length).toBe(1);
    expect(alerts[0]!.level).toBe("critical");
    expect(alerts[0]!.reason).toBe("monthly_cap_hit");
  });

  it("emits multiple alerts in order", () => {
    emitBudgetAlert({ allow: false, reason: "hourly_cap_hit" });
    emitBudgetAlert({ allow: false, reason: "rate_limited" });

    const alerts = getRecentAlerts();
    expect(alerts.length).toBe(2);
    expect(alerts[0]!.reason).toBe("hourly_cap_hit");
    expect(alerts[1]!.reason).toBe("rate_limited");
  });

  it("does not emit alert on allowed decision", () => {
    emitBudgetAlert({ allow: true, reason: "under_budget" });

    const alerts = getRecentAlerts();
    expect(alerts.length).toBe(0);
  });
});
