import { z } from "zod";
import { AnyAgentIdSchema } from "./agent.js";

export const AuctionStatusSchema = z.enum([
  "announced", "bidding", "settled", "executing", "completed", "failed", "timeout",
]);
export type AuctionStatus = z.infer<typeof AuctionStatusSchema>;

export const TaskAnnouncementSchema = z.object({
  taskId: z.string().uuid(),
  requiredSkills: z.array(z.string()),
  maxBudgetTokens: z.number().int().positive(),
  deadlineMs: z.number().int().positive(),
  originAgent: AnyAgentIdSchema,
  priority: z.enum(["low", "normal", "high", "critical"]),
  maxCostUsd: z.number().nonnegative().default(10),
});
export type TaskAnnouncement = z.infer<typeof TaskAnnouncementSchema>;

export const BidSchema = z.object({
  bidId: z.string().uuid().optional(),
  taskId: z.string().uuid(),
  agentId: AnyAgentIdSchema,
  capabilityScore: z.number().min(0).max(1),
  load: z.number().min(0).max(1),
  estimatedCost: z.number().int().positive(),
  submittedAt: z.date().optional(),
});
export type Bid = z.infer<typeof BidSchema>;

export const AuctionAwardSchema = z.object({
  taskId: z.string().uuid(),
  winner: AnyAgentIdSchema,
  bidId: z.string().uuid().optional(),
  winningScore: z.number().min(0).max(1),
  totalBids: z.number().int().nonnegative(),
  expiresAt: z.date(),
});
export type AuctionAward = z.infer<typeof AuctionAwardSchema>;

export const AuctionRecordSchema = z.object({
  id: z.string().uuid(),
  taskId: z.string().uuid(),
  announcement: TaskAnnouncementSchema,
  bids: z.array(BidSchema),
  winnerAgentId: AnyAgentIdSchema.nullable(),
  settledAt: z.date().nullable(),
  performanceScore: z.number().min(0).max(1).nullable(),
  status: AuctionStatusSchema,
  createdAt: z.date(),
});
export type AuctionRecord = z.infer<typeof AuctionRecordSchema>;

export const LoomScoreWeightsSchema = z.object({
  capability: z.number().min(0).max(1).default(0.5),
  loadInverse: z.number().min(0).max(1).default(0.3),
  costInverse: z.number().min(0).max(1).default(0.2),
});
export type LoomScoreWeights = z.infer<typeof LoomScoreWeightsSchema>;

export const LoomConfigSchema = z.object({
  bidding_window_ms: z.number().int().positive().default(2000),
  epsilon_greedy: z.number().min(0).max(1).default(0.1),
  re_auction_timeout_ms: z.number().int().positive().default(300000),
  score_weights: LoomScoreWeightsSchema,
});
export type LoomConfig = z.infer<typeof LoomConfigSchema>;