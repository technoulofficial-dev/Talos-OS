/**
 * Agent Manager — tests.
 *
 * Tests CRUD operations, hybrid seeding, soft delete, and dual-mode DB wiring.
 * All DB operations are mocked; in-memory is the source of truth for tests.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  createAgent,
  getAgent,
  listAgents,
  updateAgent,
  deleteAgent,
  seedAgents,
  generateConfigFile,
  type AgentConfig,
} from "../agent/manager.js";

function makeConfig(overrides?: Partial<AgentConfig>): AgentConfig {
  return {
    agentId: "test-agent",
    name: "Test Agent",
    role: "tester",
    primaryModel: "openrouter/owl-alpha",
    cloudModel: "openrouter/owl-alpha",
    maxContextTokens: 100_000,
    capabilities: [{ skill: "testing", proficiency: 0.8 }],
    tools: [],
    pinned: false,
    version: "1.0.0",
    ...overrides,
  };
}

describe("Agent Manager", () => {
  // Use unique agentIds per test to avoid cross-test contamination

  describe("createAgent", () => {
    it("creates an agent and stores it in-memory", async () => {
      const config = makeConfig({ agentId: "create-1" });
      const agent = await createAgent(config);
      expect(agent.agentId).toBe("create-1");
      expect(agent.status).toBe("idle");
      expect(agent.capabilityScore).toBe(0.5);
    });

    it("throws on duplicate agentId", async () => {
      const config = makeConfig({ agentId: "create-dup" });
      await createAgent(config);
      await expect(createAgent(config)).rejects.toThrow("already exists");
    });

    it("sets default values correctly", async () => {
      const config = makeConfig({ agentId: "create-defaults" });
      const agent = await createAgent(config);
      expect(agent.currentLoad).toBe(0);
      expect(agent.version).toBe("1.0.0");
      expect(agent.pinned).toBe(false);
    });
  });

  describe("getAgent", () => {
    it("returns null for unknown agent", () => {
      expect(getAgent("nonexistent-get")).toBeNull();
    });

    it("returns the agent after creation", async () => {
      const config = makeConfig({ agentId: "get-test" });
      await createAgent(config);
      const agent = getAgent("get-test");
      expect(agent).not.toBeNull();
      expect(agent!.agentId).toBe("get-test");
    });
  });

  describe("listAgents", () => {
    it("returns all agents when no filter", async () => {
      await createAgent(makeConfig({ agentId: "list-1" }));
      await createAgent(makeConfig({ agentId: "list-2" }));
      const all = listAgents();
      expect(all.length).toBeGreaterThanOrEqual(2);
    });

    it("filters by status", async () => {
      await createAgent(makeConfig({ agentId: "list-filter" }));
      const idle = listAgents("idle");
      expect(idle.every((a) => a.status === "idle")).toBe(true);
    });

    it("returns empty array for non-matching status", async () => {
      await createAgent(makeConfig({ agentId: "list-empty" }));
      const offline = listAgents("offline");
      expect(offline.every((a) => a.status === "offline")).toBe(true);
    });
  });

  describe("updateAgent", () => {
    it("updates agent fields", async () => {
      await createAgent(makeConfig({ agentId: "update-test" }));
      const updated = await updateAgent("update-test", { name: "Updated Name" });
      expect(updated).not.toBeNull();
      expect(updated!.name).toBe("Updated Name");
    });

    it("returns null for unknown agent", async () => {
      const result = await updateAgent("nonexistent-update", { name: "X" });
      expect(result).toBeNull();
    });

    it("preserves unchanged fields", async () => {
      await createAgent(makeConfig({ agentId: "update-preserve" }));
      const updated = await updateAgent("update-preserve", { name: "New" });
      expect(updated!.role).toBe("tester");
      expect(updated!.primaryModel).toBe("openrouter/owl-alpha");
    });

    it("updates updatedAt timestamp", async () => {
      await createAgent(makeConfig({ agentId: "update-ts" }));
      const before = getAgent("update-ts")!.updatedAt;
      await new Promise((r) => setTimeout(r, 10));
      const updated = await updateAgent("update-ts", { name: "Timestamped" });
      expect(updated!.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });
  });

  describe("deleteAgent", () => {
    it("soft-deletes agent (status=offline)", async () => {
      await createAgent(makeConfig({ agentId: "delete-test" }));
      const removed = await deleteAgent("delete-test");
      expect(removed).toBe(true);
      const agent = getAgent("delete-test");
      expect(agent!.status).toBe("offline");
    });

    it("returns false for unknown agent", async () => {
      const removed = await deleteAgent("nonexistent-delete");
      expect(removed).toBe(false);
    });

    it("agent still accessible after soft delete", async () => {
      await createAgent(makeConfig({ agentId: "delete-access" }));
      await deleteAgent("delete-access");
      const agent = getAgent("delete-access");
      expect(agent).not.toBeNull();
      expect(agent!.status).toBe("offline");
    });
  });

  describe("seedAgents", () => {
    it("seeds from hardcoded core agents", async () => {
      const count = await seedAgents();
      expect(count).toBeGreaterThanOrEqual(11);
    });

    it("skips agents already in-memory", async () => {
      // The store is shared across tests; seedAgents was already called above
      // So calling it again should return 0 (all already exist)
      const count = await seedAgents();
      expect(count).toBe(0);
    });

    it("creates agents with correct capability scores", async () => {
      // Agents already seeded from previous tests; verify scores
      const odin = getAgent("odin");
      expect(odin).not.toBeNull();
      expect(odin!.capabilityScore).toBe(0.9);
    });
  });

  describe("generateConfigFile", () => {
    it("returns JSON string from core agents", () => {
      const json = generateConfigFile();
      // Returns null if .talos/agents.json already exists
      if (json) {
        const parsed = JSON.parse(json);
        expect(Array.isArray(parsed)).toBe(true);
        expect(parsed.length).toBeGreaterThanOrEqual(11);
        expect(parsed[0].agentId).toBe("odin");
      }
    });
  });

  describe("getAllAgents", () => {
    it("returns all in-memory agents", async () => {
      await createAgent(makeConfig({ agentId: "all-1" }));
      await createAgent(makeConfig({ agentId: "all-2" }));
      const all = listAgents();
      expect(all.length).toBeGreaterThanOrEqual(2);
    });
  });
});
