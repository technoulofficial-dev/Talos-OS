/**
 * AI Capacity Hardening — circuit breaker, force-local, provider budget tracker
 *
 * - Circuit breaker: if a provider fails N times within a window, skip it for M minutes
 * - Force-local mode: TALOS_FORCE_LOCAL=true routes everything to Ollama
 * - Provider budget tracker: per-provider spending limits per period
 */

import type { ProviderId } from "./router.js";

// ---------------------------------------------------------------------------
// Circuit Breaker
// ---------------------------------------------------------------------------

interface CircuitState {
  failures: number;
  lastFailure: number;
  openUntil: number;
}

const circuits: Map<ProviderId, CircuitState> = new Map();

const CIRCUIT_THRESHOLD = 3;       // failures before opening
const CIRCUIT_WINDOW_MS = 60_000;  // 1-minute rolling window
const CIRCUIT_OPEN_MS = 300_000;   // 5-minute cooldown

export function recordProviderFailure(providerId: ProviderId): void {
  const now = Date.now();
  const state = circuits.get(providerId) ?? { failures: 0, lastFailure: 0, openUntil: 0 };

  // Reset count if outside rolling window
  if (now - state.lastFailure > CIRCUIT_WINDOW_MS) {
    state.failures = 0;
  }

  state.failures++;
  state.lastFailure = now;

  if (state.failures >= CIRCUIT_THRESHOLD) {
    state.openUntil = now + CIRCUIT_OPEN_MS;
    console.warn(`[capacity] Circuit OPEN for ${providerId} — ${state.failures} failures, cooldown ${CIRCUIT_OPEN_MS / 1000}s`);
  }

  circuits.set(providerId, state);
}

export function recordProviderSuccess(providerId: ProviderId): void {
  const state = circuits.get(providerId);
  if (state) {
    state.failures = 0;
    state.openUntil = 0;
    circuits.set(providerId, state);
  }
}

export function isCircuitOpen(providerId: ProviderId): boolean {
  const state = circuits.get(providerId);
  if (!state) return false;
  if (Date.now() < state.openUntil) return true;
  // Cooldown expired — reset
  if (state.openUntil > 0) {
    state.failures = 0;
    state.openUntil = 0;
    circuits.set(providerId, state);
  }
  return false;
}

export function getCircuitState(providerId: ProviderId): {
  failures: number;
  open: boolean;
  openUntil: number;
} {
  const state = circuits.get(providerId) ?? { failures: 0, lastFailure: 0, openUntil: 0 };
  return {
    failures: state.failures,
    open: Date.now() < state.openUntil,
    openUntil: state.openUntil,
  };
}

export function resetCircuit(providerId: ProviderId): void {
  circuits.delete(providerId);
}

// ---------------------------------------------------------------------------
// Force-Local Mode
// ---------------------------------------------------------------------------

/**
 * When TALOS_FORCE_LOCAL=true, ALL requests route to local Ollama only.
 * No cloud providers are attempted. Useful for:
 * - Offline/airgapped deployments
 * - Zero-cost operation
 * - Privacy-sensitive workloads
 */
export function isForceLocal(): boolean {
  return process.env["TALOS_FORCE_LOCAL"] === "true";
}

// ---------------------------------------------------------------------------
// Provider Budget Tracker (per-provider daily limits)
// ---------------------------------------------------------------------------

interface ProviderBudget {
  dailyTokens: number;
  dailyCostUsd: number;
  dailyRequests: number;
  lastReset: string; // YYYY-MM-DD
}

const providerBudgets: Map<ProviderId, ProviderBudget> = new Map();

const DEFAULT_DAILY_TOKEN_LIMIT = 500_000;   // 500K tokens/day per provider
const DEFAULT_DAILY_COST_LIMIT = 0;           // $0 for free providers
const DEFAULT_DAILY_REQUEST_LIMIT = 500;      // 500 requests/day per provider

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function getProviderBudget(providerId: ProviderId): ProviderBudget {
  const today = todayString();
  let budget = providerBudgets.get(providerId);
  if (!budget || budget.lastReset !== today) {
    budget = { dailyTokens: 0, dailyCostUsd: 0, dailyRequests: 0, lastReset: today };
    providerBudgets.set(providerId, budget);
  }
  return budget;
}

export function trackProviderUsage(
  providerId: ProviderId,
  tokens: number,
  costUsd: number
): void {
  const budget = getProviderBudget(providerId);
  budget.dailyTokens += tokens;
  budget.dailyCostUsd += costUsd;
  budget.dailyRequests++;
}

export function isProviderBudgetExceeded(providerId: ProviderId): boolean {
  const budget = getProviderBudget(providerId);
  if (budget.dailyTokens >= DEFAULT_DAILY_TOKEN_LIMIT) return true;
  if (budget.dailyRequests >= DEFAULT_DAILY_REQUEST_LIMIT) return true;
  return false;
}

export function getProviderUsage(providerId: ProviderId): {
  dailyTokens: number;
  dailyCostUsd: number;
  dailyRequests: number;
  tokenLimit: number;
  requestLimit: number;
} {
  const budget = getProviderBudget(providerId);
  return {
    dailyTokens: budget.dailyTokens,
    dailyCostUsd: budget.dailyCostUsd,
    dailyRequests: budget.dailyRequests,
    tokenLimit: DEFAULT_DAILY_TOKEN_LIMIT,
    requestLimit: DEFAULT_DAILY_REQUEST_LIMIT,
  };
}

export function getAllProviderUsage(): Record<string, ReturnType<typeof getProviderUsage>> {
  const result: Record<string, ReturnType<typeof getProviderUsage>> = {};
  const providers: ProviderId[] = [
    "g0dm0d3", "keylessai", "freetheai", "free-ai-router", "puter", "ollama", "cloud",
  ];
  for (const p of providers) {
    result[p] = getProviderUsage(p);
  }
  return result;
}
