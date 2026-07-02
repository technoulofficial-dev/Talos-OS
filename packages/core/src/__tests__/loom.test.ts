/**
 * Simple Loom tests for development phase
 * Tests basic auction system functionality
 */

import { describe, it, expect, beforeEach } from "vitest";

import {
  initializeLoom,
  registerAgent,
  getRegisteredAgents,
  announceTask,
  getAuctionStatus,
  calculateLoomScore,
  type TaskAnnouncement,
  type Bid,
} from "../../../../talos-agents/loom/index.ts";

function makeTaskAnnouncement(overrides?: Partial<TaskAnnouncement>): TaskAnnouncement {
  return {
    taskId: "test-task-123",
    description: "Test task description",
    requiredSkills: ["coding", "testing"],
    maxBudgetTokens: 100_000,
    deadlineMs: 3_600_000,
    originAgent: "test-agent",
    priority: "normal",
    maxCostUsd: 10,
    ...overrides,
  };
}

describe("Simple Loom Tests", () => {
  beforeEach(() => {
    initializeLoom();
  });

  it("Registers new agent", () => {
    registerAgent("test-agent", 0.8);
    const agents = getRegisteredAgents();
    expect(agents).toContainEqual({ agentId: "test-agent", capabilityScore: 0.8, currentLoad: 0, status: "idle", lastHeartbeat: expect.any(Date) });
  });

  it("Announces task", async () => {
    const announcement = makeTaskAnnouncement();
    const auctionId = await announceTask(announcement);
    expect(auctionId).toMatch(/^auc-\d+-[a-z0-9]+$/);
  });

  it("Calculates score", () => {
    const bid: Bid = {
      bidId: "test",
      taskId: "task",
      agentId: "agent",
      capabilityScore: 0.8,
      load: 0.1,
      estimatedCost: 2.0,
      submittedAt: new Date(),
    };
    const score = calculateLoomScore(bid, 10);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});
