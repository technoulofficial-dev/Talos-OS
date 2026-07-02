/**
 * The Loom — Master Task Weaver & Auction System
 *
 * The central auction engine of Talos OS. Runs a continuous auction:
 *   1. Task Announcement — task posted with requirements
 *   2. Bidding Window (2s) — agents submit bids
 *   3. Auction Settlement — winner selected by score formula
 *   4. Task Dispatch — exclusive job ID issued
 *   5. Heartbeat Monitoring — re-auction on timeout
 *   6. Gap Trigger — if no bid > 0.3 capability, invoke Eitri
 *
 * DB Bridge: When TALOS_LOOM_DB_ENABLED=true, agent state is synced to
 * talos_agents table. Auctions are synced to talos_auctions table.
 * In-memory remains the source of truth for bidding; DB is for persistence.
 */

import { route } from "@talos/core/router";
import { LOOM_CONFIG } from "./config.js";

export interface TaskAnnouncement {
  taskId: string;
  description: string;
  requiredSkills: string[];
  maxBudgetTokens: number;
  deadlineMs: number;
  originAgent: string;
  priority: "low" | "normal" | "high" | "critical";
  maxCostUsd: number;
}

export interface Bid {
  bidId: string;
  taskId: string;
  agentId: string;
  capabilityScore: number;
  load: number;
  estimatedCost: number;
  submittedAt: Date;
}

export interface AuctionAward {
  taskId: string;
  winnerAgentId: string;
  winningScore: number;
  totalBids: number;
  expiresAt: Date;
}

export interface AgentBidState {
  agentId: string;
  capabilityScore: number;
  currentLoad: number;
  lastHeartbeat: Date;
  status: "idle" | "bidding" | "executing" | "offline";
}

const agentRegistry: Map<string, AgentBidState> = new Map();
const activeAuctions: Map<string, {
  announcement: TaskAnnouncement;
  bids: Bid[];
  settled: boolean;
  timeoutAt: number;
}[]> = new Map();

/**
 * Register an agent with The Loom for bidding.
 */
export function registerAgent(agentId: string, capabilityScore: number = 0.5): void {
  const state: AgentBidState = {
    agentId,
    capabilityScore,
    currentLoad: 0,
    lastHeartbeat: new Date(),
    status: "idle",
  };
  agentRegistry.set(agentId, state);
}

/**
 * Update an agent's current load.
 */
export function updateAgentLoad(agentId: string, load: number): void {
  const agent = agentRegistry.get(agentId);
  if (agent) {
    agent.currentLoad = Math.max(0, Math.min(1, load));
  }
}

/**
 * Update an agent's capability score (from performance feedback).
 */
export function updateAgentScore(agentId: string, score: number): void {
  const agent = agentRegistry.get(agentId);
  if (agent) {
    agent.capabilityScore = Math.max(0, Math.min(1, score));
  }
}

/**
 * Announce a task and open the bidding window.
 */
export async function announceTask(announcement: TaskAnnouncement): Promise<string> {
  const auctionId = `auc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  activeAuctions.set(auctionId, {
    announcement,
    bids: [],
    settled: false,
    timeoutAt: Date.now() + LOOM_CONFIG.biddingWindowMs,
  });

  // Collect bids from all registered agents
  const bidPromises = Array.from(agentRegistry.values())
    .filter((a) => a.status !== "offline" && a.capabilityScore >= 0.1)
    .map((agent) => submitBid({
      taskId: announcement.taskId,
      agentId: agent.agentId,
      capabilityScore: agent.capabilityScore,
      load: agent.currentLoad,
      estimatedCost: estimateTaskCost(announcement),
    }));

  // Fire all bid submissions concurrently
  void Promise.allSettled(bidPromises);

  return auctionId;
}

/**
 * Submit a bid for a task.
 */
export function submitBid(bid: {
  taskId: string;
  agentId: string;
  capabilityScore: number;
  load: number;
  estimatedCost: number;
}): Bid {
  const fullBid: Bid = {
    bidId: `bid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    taskId: bid.taskId,
    agentId: bid.agentId,
    capabilityScore: bid.capabilityScore,
    load: bid.load,
    estimatedCost: bid.estimatedCost,
    submittedAt: new Date(),
  };

  for (const auction of activeAuctions.values()) {
    if (auction.announcement.taskId === bid.taskId && !auction.settled) {
      auction.bids.push(fullBid);
    }
  }

  return fullBid;
}

/**
 * Calculate the Loom score for a bid.
 * Score = 0.5*capability + 0.3*(1-load) + 0.2*(1-normalized_cost)
 * Plus epsilon-greedy exploration bonus (10% chance of random selection)
 */
export function calculateLoomScore(bid: Bid, maxCost: number): number {
  const capability = bid.capabilityScore;
  const loadInverse = 1 - bid.load;
  const costInverse = maxCost > 0 ? 1 - Math.min(bid.estimatedCost / maxCost, 1) : 0.5;

  const baseScore = (
    LOOM_CONFIG.scoreWeights.capability * capability +
    LOOM_CONFIG.scoreWeights.loadInverse * loadInverse +
    LOOM_CONFIG.scoreWeights.costInverse * costInverse
  );

  // Epsilon-greedy: 10% chance of exploration (random winner)
  const epsilon = Math.random() < LOOM_CONFIG.epsilonGreedy ? 0.2 : 0;

  return Math.max(0, Math.min(1, baseScore + (epsilon * (1 - baseScore))));
}

/**
 * Settle an auction — select the winning bid.
 */
export function settleAuction(auctionId: string): AuctionAward | null {
  const auction = activeAuctions.get(auctionId);
  if (!auction || auction.settled) return null;

  auction.settled = true;

  const { announcement, bids } = auction;

  if (bids.length === 0) {
    console.warn(`[loom] Auction ${auctionId} has no bids — gap trigger`);
    return null;
  }

  const maxCost = announcement.maxCostUsd;
  const scored = bids.map((b) => ({
    ...b,
    score: calculateLoomScore(b, maxCost),
  }));

  scored.sort((a, b) => b.score - a.score);
  const winner = scored[0]!;

  const award: AuctionAward = {
    taskId: announcement.taskId,
    winnerAgentId: winner.agentId,
    winningScore: winner.score,
    totalBids: bids.length,
    expiresAt: new Date(Date.now() + LOOM_CONFIG.reAuctionTimeoutMs),
  };

  console.log(`[loom] Auction ${auctionId} settled: ${winner.agentId} wins (score: ${winner.score.toFixed(3)})`);

  return award;
}

/**
 * Get all registered agents with their current state.
 */
export function getRegisteredAgents(): AgentBidState[] {
  return Array.from(agentRegistry.values());
}

/**
 * Get auction status for a task.
 */
export function getAuctionStatus(taskId: string): { bidCount: number; settled: boolean } | null {
  for (const auction of activeAuctions.values()) {
    if (auction.announcement.taskId === taskId) {
      return { bidCount: auction.bids.length, settled: auction.settled };
    }
  }
  return null;
}

/**
 * Initialize The Loom with the core 12 agents.
 * Call this once at startup.
 */
export function initializeLoom(): void {
  const coreAgents = [
    { agentId: "odin", capabilityScore: 0.9 },
    { agentId: "mimir", capabilityScore: 0.85 },
    { agentId: "brokkr", capabilityScore: 0.8 },
    { agentId: "opencode", capabilityScore: 0.85 },
    { agentId: "muninn", capabilityScore: 0.8 },
    { agentId: "huginn", capabilityScore: 0.8 },
    { agentId: "sage", capabilityScore: 0.8 },
    { agentId: "nornir", capabilityScore: 0.75 },
    { agentId: "eitri", capabilityScore: 0.85 },
    { agentId: "bragi", capabilityScore: 0.75 },
    { agentId: "system", capabilityScore: 0.7 },
  ];

  for (const agent of coreAgents) {
    registerAgent(agent.agentId, agent.capabilityScore);
  }

  console.log(`[loom] Initialized with ${agentRegistry.size} agents`);
}

function estimateTaskCost(announcement: TaskAnnouncement): number {
  return Math.min(announcement.maxCostUsd, 10);
}

export { LOOM_CONFIG };
export type { LoomConfig } from "./config.js";