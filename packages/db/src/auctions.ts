/**
 * Auctions - manages The Loom's auction system in Supabase.
 * Records task announcements, bids, and settlement results.
 */

import { getSupabaseClient } from "./client.js";

export type AuctionStatus = "announced" | "bidding" | "settled" | "expired" | "cancelled";

export interface BidRecord {
  agentId: string;
  capabilityScore: number;
  load: number;
  estimatedCost: number;
  submittedAt: string;
}

export interface AuctionRecord {
  id?: string;
  taskId: string;
  announcement: Record<string, unknown>;
  bids: BidRecord[];
  winnerAgentId?: string;
  status: AuctionStatus;
  performanceScore?: number;
  settledAt?: string;
}

export interface AuctionCreateInput {
  taskId: string;
  announcement: Record<string, unknown>;
  initialBids?: BidRecord[];
}

/**
 * Create a new auction for a task.
 */
export async function createAuction(input: AuctionCreateInput): Promise<AuctionRecord> {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from("talos_auctions")
    .insert({
      task_id: input.taskId,
      announcement: input.announcement,
      bids: input.initialBids ?? [],
      status: "bidding" as AuctionStatus,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create auction: ${error.message}`);

  return mapAuctionFromDb(data);
}

/**
 * Get an auction by ID.
 */
export async function getAuction(auctionId: string): Promise<AuctionRecord | null> {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from("talos_auctions")
    .select("*")
    .eq("id", auctionId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Failed to get auction: ${error.message}`);
  }

  return mapAuctionFromDb(data);
}

/**
 * Add a bid to an active auction.
 */
export async function addBid(auctionId: string, bid: BidRecord): Promise<AuctionRecord> {
  const client = getSupabaseClient();

  const auction = await getAuction(auctionId);
  if (!auction) throw new Error(`Auction ${auctionId} not found`);
  if (auction.status !== "bidding") {
    throw new Error(`Auction ${auctionId} is not accepting bids (status: ${auction.status})`);
  }

  const newBids = [...auction.bids, bid];

  const { data, error } = await client
    .from("talos_auctions")
    .update({ bids: newBids })
    .eq("id", auctionId)
    .select()
    .single();

  if (error) throw new Error(`Failed to add bid: ${error.message}`);

  return mapAuctionFromDb(data);
}

/**
 * Settle an auction with the winning agent.
 */
export async function settleAuction(
  auctionId: string,
  winnerAgentId: string,
  performanceScore?: number
): Promise<AuctionRecord> {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from("talos_auctions")
    .update({
      winner_agent_id: winnerAgentId,
      status: "settled" as AuctionStatus,
      settled_at: new Date().toISOString(),
      performance_score: performanceScore,
    })
    .eq("id", auctionId)
    .eq("status", "bidding")
    .select()
    .single();

  if (error) throw new Error(`Failed to settle auction: ${error.message}`);

  return mapAuctionFromDb(data);
}

/**
 * Expire an auction that received no valid bids.
 */
export async function expireAuction(auctionId: string): Promise<void> {
  const client = getSupabaseClient();

  const { error } = await client
    .from("talos_auctions")
    .update({
      status: "expired" as AuctionStatus,
      settled_at: new Date().toISOString(),
    })
    .eq("id", auctionId)
    .eq("status", "bidding");

  if (error) throw new Error(`Failed to expire auction: ${error.message}`);
}

function mapAuctionFromDb(row: Record<string, unknown>): AuctionRecord {
  return {
    id: row.id as string,
    taskId: row.task_id as string,
    announcement: (row.announcement as Record<string, unknown>) ?? {},
    bids: (row.bids as BidRecord[]) ?? [],
    winnerAgentId: row.winner_agent_id as string | undefined,
    status: row.status as AuctionStatus,
    performanceScore: row.performance_score as number | undefined,
    settledAt: row.settled_at as string | undefined,
  };
}