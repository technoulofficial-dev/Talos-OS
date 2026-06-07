import { z } from "zod";

export const AdvisorIdSchema = z.enum([
  "strategist",
  "architect",
  "researcher",
  "sentinel",
  "quality",
]);
export type AdvisorId = z.infer<typeof AdvisorIdSchema>;

export const VerdictSchema = z.enum(["approve", "conditional", "reject", "defer"]);
export type Verdict = z.infer<typeof VerdictSchema>;

export const SeveritySchema = z.enum(["critical", "major", "minor", "info"]);
export type Severity = z.infer<typeof SeveritySchema>;

export const CouncilProposalSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  context: z.string().optional(),
  files: z.array(z.string()).optional(),
  priority: z.enum(["low", "normal", "high", "critical"]).default("normal"),
});
export type CouncilProposal = z.infer<typeof CouncilProposalSchema>;

export const AdvisorFindingSchema = z.object({
  severity: SeveritySchema,
  category: z.string(),
  summary: z.string(),
  detail: z.string(),
  recommendation: z.string(),
});
export type AdvisorFinding = z.infer<typeof AdvisorFindingSchema>;

export const AdvisorReportSchema = z.object({
  advisorId: AdvisorIdSchema,
  summary: z.string(),
  score: z.number().min(0).max(100),
  findings: z.array(AdvisorFindingSchema),
  strengths: z.array(z.string()),
  concerns: z.array(z.string()),
  recommendation: z.enum(["approve", "conditional", "reject", "defer"]),
  confidence: z.number().min(0).max(100),
  tokensUsed: z.number().int().default(0),
  latencyMs: z.number().int().default(0),
});
export type AdvisorReport = z.infer<typeof AdvisorReportSchema>;

export const ChairmanVerdictSchema = z.object({
  verdict: VerdictSchema,
  summary: z.string(),
  consensusScore: z.number().min(0).max(100),
  advisorScores: z.record(AdvisorIdSchema, z.number().min(0).max(100)),
  keyStrengths: z.array(z.string()),
  keyConcerns: z.array(z.string()),
  actionItems: z.array(z.string()),
  dissentingOpinions: z.array(z.object({
    advisorId: AdvisorIdSchema,
    reason: z.string(),
  })),
  confidence: z.number().min(0).max(100),
});
export type ChairmanVerdict = z.infer<typeof ChairmanVerdictSchema>;

export const CouncilSessionStatusSchema = z.enum([
  "pending",
  "in_progress",
  "completed",
  "failed",
]);
export type CouncilSessionStatus = z.infer<typeof CouncilSessionStatusSchema>;

export const CouncilSessionSchema = z.object({
  sessionId: z.string().uuid(),
  proposal: CouncilProposalSchema,
  status: CouncilSessionStatusSchema,
  reports: z.array(AdvisorReportSchema).default([]),
  verdict: ChairmanVerdictSchema.optional(),
  createdAt: z.date(),
  completedAt: z.date().optional(),
  error: z.string().optional(),
});
export type CouncilSession = z.infer<typeof CouncilSessionSchema>;
