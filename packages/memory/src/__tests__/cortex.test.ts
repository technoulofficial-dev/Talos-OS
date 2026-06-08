import { describe, it, expect, vi, beforeEach } from "vitest";
import { Cortex, type CortexSnapshot } from "../cortex.js";

// Mock @talos/db/memory
vi.mock("@talos/db/memory", () => ({
  getOrCreateCortex: vi.fn(),
  updateCortex: vi.fn(),
  appendToThread: vi.fn(),
  updateIdentityCore: vi.fn(),
  addNornirMarker: vi.fn(),
  getNornirMarkers: vi.fn(),
}));

import {
  getOrCreateCortex,
  updateCortex,
  appendToThread,
  updateIdentityCore,
} from "@talos/db/memory";

const mockGetOrCreate = vi.mocked(getOrCreateCortex);
const mockUpdate = vi.mocked(updateCortex);
const mockAppend = vi.mocked(appendToThread);
const mockUpdateIdentity = vi.mocked(updateIdentityCore);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeCortexRecord(overrides: Record<string, unknown> = {}): any {
  return {
    userId: "test-user",
    identityCore: {
      longTermGoals: ["build Talos OS"],
      personality: { style: "technical" },
      decisionHeuristics: ["prefer-local"],
      preferences: { theme: "dark" },
    },
    threadOfFate: {
      verbatim: Array.from({ length: 30 }, (_, i) => ({
        role: "user" as const,
        content: `message ${i}`,
        timestamp: `2026-06-0${(i % 9) + 1}T12:00:00.000Z`,
      })),
      midRange: ["[Block of 20 turns]"],
      distant: ["[1 summaries archived]"],
    },
    threadDigest: "Project Talos OS is an AI agent swarm",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetOrCreate.mockImplementation(async () => makeCortexRecord());
  mockUpdate.mockImplementation(async (cortex) => cortex as ReturnType<typeof makeCortexRecord>);
  mockAppend.mockImplementation(async (_userId, msg) => {
    const record = makeCortexRecord();
    record.threadOfFate.verbatim.push(msg as never);
    return record;
  });
  mockUpdateIdentity.mockImplementation(async (_userId, updates) => {
    const record = makeCortexRecord();
    record.identityCore = { ...record.identityCore, ...updates };
    return record;
  });
});

describe("Cortex — Load & Snapshot", () => {
  it("loads cortex from DB", async () => {
    const cortex = new Cortex("test-user");
    const record = await cortex.load();
    expect(record.userId).toBe("test-user");
    expect(mockGetOrCreate).toHaveBeenCalledWith("test-user");
  });

  it("takes a snapshot with token estimates", async () => {
    const cortex = new Cortex("test-user");
    const snapshot = await cortex.snapshot();
    expect(snapshot.userId).toBe("test-user");
    expect(snapshot.estimatedTokens).toBeGreaterThan(0);
    expect(snapshot.budgetUsedPct).toBeGreaterThan(0);
  });

  it("marks needsConsolidation when verbatim exceeds 80%", async () => {
    const record = makeCortexRecord();
    // >40 (80% of 50) triggers needsConsolidation
    record.threadOfFate.verbatim = Array.from({ length: 41 }, (_, i) => ({
      role: "user" as const,
      content: `msg ${i}`,
      timestamp: new Date().toISOString(),
    }));
    mockGetOrCreate.mockResolvedValue(record as never);

    const cortex = new Cortex("test-user");
    const snapshot = await cortex.snapshot();
    expect(snapshot.needsConsolidation).toBe(true);
  });
});

describe("Cortex — addMessage", () => {
  it("appends message to thread", async () => {
    const cortex = new Cortex("test-user");
    await cortex.addMessage({ role: "user", content: "hello" });
    expect(mockAppend).toHaveBeenCalledWith("test-user", expect.objectContaining({
      role: "user",
      content: "hello",
    }));
  });

  it("adds timestamp when not provided", async () => {
    const cortex = new Cortex("test-user");
    await cortex.addMessage({ role: "assistant", content: "response" });
    const call = mockAppend.mock.calls[0]!;
    const msg = call[1] as { timestamp: string };
    expect(msg.timestamp).toBeDefined();
    expect(new Date(msg.timestamp).getTime()).toBeGreaterThan(0);
  });

  it("uses provided timestamp", async () => {
    const cortex = new Cortex("test-user");
    await cortex.addMessage({ role: "user", content: "test", timestamp: "2026-01-01T00:00:00Z" });
    const call = mockAppend.mock.calls[0]!;
    const msg = call[1] as { timestamp: string };
    expect(msg.timestamp).toBe("2026-01-01T00:00:00Z");
  });
});

describe("Cortex — updateIdentity", () => {
  it("updates identity core fields", async () => {
    const cortex = new Cortex("test-user");
    const snapshot = await cortex.updateIdentity({
      longTermGoals: ["new goal"],
    });
    expect(mockUpdateIdentity).toHaveBeenCalledWith("test-user", { longTermGoals: ["new goal"] });
    expect(snapshot.identityCore.longTermGoals).toEqual(["new goal"]);
  });
});

describe("Cortex — compressVerbatim", () => {
  it("compresses oldest 20 verbatim into midRange summary", async () => {
    const record = makeCortexRecord();
    record.threadOfFate.verbatim = Array.from({ length: 50 }, (_, i) => ({
      role: "user" as const,
      content: `msg ${i}`,
      timestamp: `2026-06-01T${String(i).padStart(2, "0")}:00:00Z`,
    }));
    mockGetOrCreate.mockResolvedValue(record as never);

    const cortex = new Cortex("test-user");
    await cortex.compressVerbatim();

    expect(mockUpdate).toHaveBeenCalled();
    const updated = mockUpdate.mock.calls[0]![0] as ReturnType<typeof makeCortexRecord>;
    // 50 - 20 compressed = 30 remaining
    expect(updated.threadOfFate.verbatim.length).toBe(30);
    // midRange should have the new summary
    expect(updated.threadOfFate.midRange.length).toBe(2); // 1 original + 1 new
  });

  it("does nothing when verbatim <= 20", async () => {
    const record = makeCortexRecord();
    record.threadOfFate.verbatim = Array.from({ length: 10 }, (_, i) => ({
      role: "user" as const,
      content: `msg ${i}`,
      timestamp: new Date().toISOString(),
    }));
    mockGetOrCreate.mockResolvedValue(record as never);

    const cortex = new Cortex("test-user");
    await cortex.compressVerbatim();
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe("Cortex — retrieveContext", () => {
  it("finds matching messages by keyword", async () => {
    const record = makeCortexRecord();
    record.threadOfFate.verbatim = [
      { role: "user", content: "How do I deploy Talos?", timestamp: "2026-06-01T00:00:00Z" },
      { role: "user", content: "Use Docker Compose", timestamp: "2026-06-01T00:01:00Z" },
      { role: "user", content: "What about scaling?", timestamp: "2026-06-01T00:02:00Z" },
    ];
    mockGetOrCreate.mockResolvedValue(record as never);

    const cortex = new Cortex("test-user");
    const results = await cortex.retrieveContext("deploy");
    expect(results.length).toBe(1);
    expect(results[0]).toContain("deploy");
  });

  it("returns empty array when no matches", async () => {
    const record = makeCortexRecord();
    record.threadOfFate.verbatim = [
      { role: "user", content: "Hello", timestamp: "2026-06-01T00:00:00Z" },
    ];
    mockGetOrCreate.mockResolvedValue(record as never);

    const cortex = new Cortex("test-user");
    const results = await cortex.retrieveContext("xyz");
    expect(results).toHaveLength(0);
  });

  it("respects topK parameter", async () => {
    const record = makeCortexRecord();
    record.threadOfFate.verbatim = Array.from({ length: 10 }, (_, i) => ({
      role: "user" as const,
      content: `deploy step ${i}`,
      timestamp: `2026-06-01T00:${String(i).padStart(2, "0")}:00Z`,
    }));
    mockGetOrCreate.mockResolvedValue(record as never);

    const cortex = new Cortex("test-user");
    const results = await cortex.retrieveContext("deploy", 3);
    expect(results.length).toBe(3);
  });
});

describe("Cortex — consolidate", () => {
  it("compresses verbatim beyond 50 into midRange", async () => {
    const record = makeCortexRecord();
    // consolidate() loops while >50, compressing 20 each iteration
    // 80 → 60 (1 block) → 40 (2 blocks, stops since 40 is not >50)
    record.threadOfFate.verbatim = Array.from({ length: 80 }, (_, i) => ({
      role: "user" as const,
      content: `msg ${i}`,
      timestamp: new Date().toISOString(),
    }));
    mockGetOrCreate.mockResolvedValue(record as never);

    const cortex = new Cortex("test-user");
    await cortex.consolidate();

    expect(mockUpdate).toHaveBeenCalled();
    const updated = mockUpdate.mock.calls[0]![0] as ReturnType<typeof makeCortexRecord>;
    expect(updated.threadOfFate.verbatim.length).toBe(40);
  });
});
