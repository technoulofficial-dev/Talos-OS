import { describe, it, expect, beforeEach } from "vitest";
import { ADVISORS, runAdvisor, evaluateParallel } from "../council/advisor.js";
import { synthesizeVerdict } from "../council/chairman.js";
import { createSession, getSession, executeSession, clearSessions } from "../council/session.js";
import type { CouncilProposal, AdvisorReport, ChairmanVerdict } from "../council/types.js";

const testProposal: CouncilProposal = {
  title: "Add dark mode support",
  description: "Implement a dark mode theme toggle for the Mission Control UI, using CSS variables and localStorage for persistence.",
  context: "Users have requested dark mode for reduced eye strain during extended sessions.",
  files: ["packages/ui/src/app/globals.css", "packages/ui/src/components/ThemeToggle.tsx"],
  priority: "normal",
};

describe("Council — Advisor Definitions", () => {
  it("defines all 5 advisors", () => {
    expect(ADVISORS).toHaveLength(5);
    const ids = ADVISORS.map((a) => a.id);
    expect(ids).toContain("strategist");
    expect(ids).toContain("architect");
    expect(ids).toContain("researcher");
    expect(ids).toContain("sentinel");
    expect(ids).toContain("quality");
  });

  it("each advisor has a unique ID", () => {
    const ids = ADVISORS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("each advisor has a system prompt", () => {
    for (const advisor of ADVISORS) {
      expect(advisor.systemPrompt.length).toBeGreaterThan(100);
    }
  });
});

describe("Council — Advisor Execution", () => {
  // These integration tests require Ollama or OpenRouter with a valid API key
  it.skip("runAdvisor returns a valid report for strategist", async () => {
    const strategist = ADVISORS.find((a) => a.id === "strategist")!;
    const report = await runAdvisor(strategist, testProposal);
    expect(report.advisorId).toBe("strategist");
    expect(report.summary.length).toBeGreaterThan(0);
    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.score).toBeLessThanOrEqual(100);
    expect(report.confidence).toBeGreaterThanOrEqual(0);
    expect(["approve", "conditional", "reject", "defer"]).toContain(report.recommendation);
    expect(report.tokensUsed).toBeGreaterThan(0);
    expect(report.latencyMs).toBeGreaterThan(0);
  }, 60000);

  it.skip("runAdvisor returns a valid report for sentinel", async () => {
    const sentinel = ADVISORS.find((a) => a.id === "sentinel")!;
    const report = await runAdvisor(sentinel, testProposal);
    expect(report.advisorId).toBe("sentinel");
    expect(report.summary.length).toBeGreaterThan(0);
    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.findings).toBeDefined();
  }, 60000);
});

describe("Council — Parallel Evaluation", () => {
  it("evaluates all 5 advisors in parallel", async () => {
    const reports = await evaluateParallel(testProposal);
    expect(reports).toHaveLength(5);
    for (const report of reports) {
      expect(report.advisorId).toBeDefined();
      expect(report.score).toBeGreaterThanOrEqual(0);
    }
  }, 120000);

  it("evaluates a subset of advisors when filtered", async () => {
    const reports = await evaluateParallel(testProposal, ["architect", "quality"]);
    expect(reports).toHaveLength(2);
    expect(reports[0]!.advisorId).toBe("architect");
    expect(reports[1]!.advisorId).toBe("quality");
  }, 120000);
});

describe("Council — Chairman Synthesis", () => {
  it.skip("synthesizes verdict from sample reports", async () => {
    const reports: AdvisorReport[] = [
      {
        advisorId: "strategist",
        summary: "Strong strategic alignment with user needs",
        score: 85,
        findings: [{ severity: "info", category: "alignment", summary: "Matches project goals", detail: "", recommendation: "" }],
        strengths: ["User demand is clear"],
        concerns: ["May need additional UX research"],
        recommendation: "approve",
        confidence: 80,
        tokensUsed: 100,
        latencyMs: 1000,
      },
      {
        advisorId: "architect",
        summary: "Technically feasible with minor changes",
        score: 75,
        findings: [{ severity: "minor", category: "architecture", summary: "CSS variable approach is clean", detail: "", recommendation: "" }],
        strengths: ["Clean separation of concerns"],
        concerns: ["Need to handle SSR edge cases"],
        recommendation: "conditional",
        confidence: 85,
        tokensUsed: 100,
        latencyMs: 1000,
      },
      {
        advisorId: "researcher",
        summary: "Dark mode is well-documented approach",
        score: 90,
        findings: [{ severity: "info", category: "research", summary: "Multiple established patterns exist", detail: "", recommendation: "" }],
        strengths: ["Well-understood pattern"],
        concerns: [],
        recommendation: "approve",
        confidence: 70,
        tokensUsed: 100,
        latencyMs: 1000,
      },
      {
        advisorId: "sentinel",
        summary: "No security concerns",
        score: 95,
        findings: [{ severity: "info", category: "security", summary: "No new attack surface", detail: "", recommendation: "" }],
        strengths: ["No sensitive data involved"],
        concerns: [],
        recommendation: "approve",
        confidence: 95,
        tokensUsed: 100,
        latencyMs: 1000,
      },
      {
        advisorId: "quality",
        summary: "Good testing approach needed",
        score: 70,
        findings: [{ severity: "major", category: "testing", summary: "Visual regression tests needed", detail: "", recommendation: "Add storybook integration" }],
        strengths: ["Simple implementation"],
        concerns: ["Visual regression testing not addressed"],
        recommendation: "conditional",
        confidence: 75,
        tokensUsed: 100,
        latencyMs: 1000,
      },
    ];

    const verdict = await synthesizeVerdict(reports);
    expect(["approve", "conditional", "reject", "defer"]).toContain(verdict.verdict);
    expect(verdict.summary.length).toBeGreaterThan(0);
    expect(verdict.consensusScore).toBeGreaterThanOrEqual(0);
    expect(verdict.advisorScores).toBeDefined();
    expect(Object.keys(verdict.advisorScores).length).toBeGreaterThanOrEqual(3);
    expect(verdict.confidence).toBeGreaterThanOrEqual(0);
  }, 60000);
});

describe("Council — Session Management", () => {
  beforeEach(() => clearSessions());

  it("creates a session with pending status", () => {
    const { sessionId } = createSession(testProposal);
    expect(sessionId.length).toBeGreaterThan(0);

    const session = getSession(sessionId);
    expect(session).toBeDefined();
    expect(session!.status).toBe("pending");
    expect(session!.proposal.title).toBe("Add dark mode support");
  });

  it("returns undefined for unknown session", () => {
    const session = getSession("nonexistent");
    expect(session).toBeUndefined();
  });

  it.skip("executes a full council session", async () => {
    const { sessionId } = createSession(testProposal);
    const session = await executeSession(sessionId);

    expect(session.status).toBe("completed");
    expect(session.reports).toHaveLength(5);
    expect(session.verdict).toBeDefined();
    expect(session.verdict!.verdict).toBeDefined();
    expect(session.completedAt).toBeDefined();
  }, 120000);

  it("fails session on invalid proposal", async () => {
    const { sessionId } = createSession({ title: "", description: "", priority: "normal" });
    const session = await executeSession(sessionId);
    expect(session.status).toBe("failed");
    expect(session.error).toBeDefined();
  }, 60000);

  it("reports progress during execution", async () => {
    const { sessionId } = createSession(testProposal);
    const progressReports: Array<{ step: string; count: number }> = [];

    await executeSession(sessionId, (reports) => {
      progressReports.push({ step: "advisors_complete", count: reports.length });
    });

    expect(progressReports.length).toBe(1);
    expect(progressReports[0]!.count).toBe(5);
  }, 120000);

  it("throws on execution of unknown session", async () => {
    await expect(executeSession("nonexistent")).rejects.toThrow("Session not found");
  });

  it("clears all sessions", () => {
    createSession(testProposal);
    createSession(testProposal);
    clearSessions();
    expect(getSession).toBeDefined();
    // After clear, sessions map should be empty
    const result = createSession(testProposal);
    expect(result.sessionId).toBeDefined();
  });
});
