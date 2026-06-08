import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  runUrdMaintenance,
  runVerdandiSummarization,
  runSkuldPreFetch,
  runNightlyConsolidation,
  recordNornirMarker,
} from "../nornir.js";

// Mock dependencies
vi.mock("@talos/db/memory", () => ({
  getOrCreateCortex: vi.fn(),
  updateCortex: vi.fn(),
  appendToThread: vi.fn(),
  updateIdentityCore: vi.fn(),
  addNornirMarker: vi.fn(),
  getNornirMarkers: vi.fn(),
}));

vi.mock("@talos/db/tasks", () => ({
  listTasks: vi.fn(),
}));

vi.mock("@talos/core/ai-engine", () => ({
  routeUnlimited: vi.fn(),
}));

import { getOrCreateCortex, updateCortex, addNornirMarker, getNornirMarkers } from "@talos/db/memory";
import { listTasks } from "@talos/db/tasks";
import { routeUnlimited } from "@talos/core/ai-engine";

const mockGetOrCreate = vi.mocked(getOrCreateCortex);
const mockUpdate = vi.mocked(updateCortex);
const mockAddMarker = vi.mocked(addNornirMarker);
const mockGetMarkers = vi.mocked(getNornirMarkers);
const mockListTasks = vi.mocked(listTasks);
const mockRoute = vi.mocked(routeUnlimited);

beforeEach(() => {
  vi.clearAllMocks();
  mockGetOrCreate.mockResolvedValue({
    userId: "test-user",
    identityCore: { longTermGoals: [], personality: {}, decisionHeuristics: [], preferences: {} },
    threadOfFate: { verbatim: [], midRange: [], distant: [] },
    threadDigest: "",
  } as never);
  mockUpdate.mockImplementation(async (c) => c as never);
  mockAddMarker.mockImplementation(async (m) => m as never);
  mockGetMarkers.mockResolvedValue([]);
  mockListTasks.mockResolvedValue([]);
  mockRoute.mockResolvedValue({ output: "digest summary", model: "mock", provider: "mock" } as never);
});

describe("Nornir — Urd Maintenance", () => {
  it("returns no updates when no patterns detected", async () => {
    mockGetMarkers.mockResolvedValue([]);
    const result = await runUrdMaintenance("test-user");
    expect(result.updated).toBe(false);
    expect(result.markersAdded).toBe(0);
  });

  it("adds marker when goal patterns detected", async () => {
    mockGetMarkers.mockResolvedValue([
      { userId: "test-user", timestamp: "2026-06-01", eventType: "goal-stated", summary: "test", entities: [], importanceScore: 0.8 },
    ] as never);
    const result = await runUrdMaintenance("test-user");
    expect(result.updated).toBe(true);
    expect(result.markersAdded).toBe(1);
    expect(mockAddMarker).toHaveBeenCalled();
  });
});

describe("Nornir — Verdandi Summarization", () => {
  it("skips when no consolidation needed", async () => {
    mockGetOrCreate.mockResolvedValue({
      userId: "test-user",
      identityCore: { longTermGoals: [], personality: {}, decisionHeuristics: [], preferences: {} },
      threadOfFate: { verbatim: Array.from({ length: 5 }, (_, i) => ({ role: "user", content: `msg ${i}`, timestamp: "2026-06-01" })), midRange: [], distant: [] },
      threadDigest: "",
    } as never);
    const result = await runVerdandiSummarization("test-user");
    expect(result.compressed).toBe(false);
  });

  it("compresses when verbatim exceeds threshold", async () => {
    mockGetOrCreate.mockResolvedValue({
      userId: "test-user",
      identityCore: { longTermGoals: [], personality: {}, decisionHeuristics: [], preferences: {} },
      threadOfFate: {
        verbatim: Array.from({ length: 45 }, (_, i) => ({ role: "user", content: `msg ${i}`, timestamp: "2026-06-01" })),
        midRange: [],
        distant: [],
      },
      threadDigest: "",
    } as never);
    const result = await runVerdandiSummarization("test-user");
    expect(result.compressed).toBe(true);
  });
});

describe("Nornir — Skuld Pre-fetch", () => {
  it("returns 0 when no upcoming tasks", async () => {
    mockListTasks.mockResolvedValue([]);
    const result = await runSkuldPreFetch("test-user");
    expect(result.preFetched).toBe(0);
    expect(result.tasksAnalyzed).toBe(0);
  });

  it("pre-fetches context for upcoming tasks", async () => {
    mockListTasks.mockResolvedValue([
      { id: "task-1", description: "Deploy Talos", deadline: "2099-01-01T00:00:00Z" },
    ] as never);
    mockGetOrCreate.mockResolvedValue({
      userId: "test-user",
      identityCore: { longTermGoals: [], personality: {}, decisionHeuristics: [], preferences: {} },
      threadOfFate: {
        verbatim: [{ role: "user", content: "Deploy instructions for Talos", timestamp: "2026-06-01" }],
        midRange: [],
        distant: [],
      },
      threadDigest: "",
    } as never);
    const result = await runSkuldPreFetch("test-user");
    expect(result.tasksAnalyzed).toBe(1);
  });
});

describe("Nornir — Nightly Consolidation", () => {
  it("runs all stages and returns result", async () => {
    mockGetMarkers.mockResolvedValue([]);
    mockListTasks.mockResolvedValue([]);
    const result = await runNightlyConsolidation("test-user");
    expect(result.userId).toBe("test-user");
    expect(result.stages.urd).toBeDefined();
    expect(result.stages.verdandi).toBeDefined();
    expect(result.stages.skuld).toBeDefined();
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.errors).toHaveLength(0);
  });

  it("collects errors from individual stages", async () => {
    mockGetMarkers.mockRejectedValue(new Error("Urd failed"));
    const result = await runNightlyConsolidation("test-user");
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain("Urd failed");
  });
});

describe("Nornir — recordNornirMarker", () => {
  it("records a marker and returns it", async () => {
    const marker = {
      userId: "test-user",
      timestamp: "2026-06-01T00:00:00Z",
      eventType: "session-start",
      summary: "Session started",
      entities: ["TalosOS"],
      importanceScore: 0.7,
    };
    const result = await recordNornirMarker(marker);
    expect(result).toEqual(marker);
    expect(mockAddMarker).toHaveBeenCalledWith(marker);
  });
});
