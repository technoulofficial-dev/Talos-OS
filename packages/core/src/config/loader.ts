/**
 * Talos OS v8.0 — Config Loader
 * Single source of truth. Reads talos.config.yaml + environment variables.
 * Environment variables override YAML values.
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const env = (key: string, fallback: string): string =>
  (process.env as Record<string, string | undefined>)[key] ?? fallback;

const envNum = (key: string, fallback: number): number => {
  const v = (process.env as Record<string, string | undefined>)[key];
  return v !== undefined ? parseFloat(v) : fallback;
};

const envBool = (key: string, fallback: boolean): boolean => {
  const v = (process.env as Record<string, string | undefined>)[key];
  return v !== undefined ? (v === "true" || v === "1" || v === "yes") : fallback;
};

export interface G0dm0d3Config {
  enabled: boolean;
  scan_interval_ms: number;
  capability_threshold: number;
  scan_subnets: string[];
  ollama_port: number;
}

export interface CloudBudget {
  monthly_usd: number;
  hourly_usd: number;
  per_task_tokens: number;
  per_minute_requests: number;
  hard_kill_at: number;
}

export interface CloudConfig {
  enabled: boolean;
  providers: string[];
  budget: CloudBudget;
}

export interface HermesConfig {
  agent_id: string;
  primary_model: string;
  fallback_model: string;
  pinned: boolean;
  max_context_tokens: number;
  temperature: number;
}

export interface CortexConfig {
  max_injection_tokens: number;
  verbatim_window: number;
  mid_range_block: number;
  distant_threshold: number;
}

export interface LoomScoreWeights {
  capability: number;
  load_inverse: number;
  cost_inverse: number;
}

export interface LoomConfig {
  bidding_window_ms: number;
  epsilon_greedy: number;
  re_auction_timeout_ms: number;
  score_weights: LoomScoreWeights;
}

export interface AgentConfig {
  model: string;
  context: number;
}

export interface TalosConfig {
  version: string;
  mode: string;
  hermes_anchor: string;
  g0dm0d3: G0dm0d3Config;
  cloud: CloudConfig;
  hermes: HermesConfig;
  cortex: CortexConfig;
  loom: LoomConfig;
  agents: Record<string, AgentConfig>;
}

const DEFAULT_CONFIG: TalosConfig = {
  version: "8.0.0",
  mode: "local-first",
  hermes_anchor: "odin",
  g0dm0d3: {
    enabled: true,
    scan_interval_ms: 30_000,
    capability_threshold: 0.3,
    scan_subnets: ["192.168.0.0/24", "10.0.0.0/24"],
    ollama_port: 11_434,
  },
  cloud: {
    enabled: true,
    providers: ["nvidia-nim"],
    budget: {
      monthly_usd: 50,
      hourly_usd: 5,
      per_task_tokens: 100_000,
      per_minute_requests: 30,
      hard_kill_at: 0.95,
    },
  },
  hermes: {
    agent_id: "odin",
    primary_model: "nvidia/nemotron-3-super-120b-a12b",
    fallback_model: "moonshotai/kimi-k2.6",
    pinned: true,
    max_context_tokens: 262_000,
    temperature: 0.4,
  },
  cortex: {
    max_injection_tokens: 12_000,
    verbatim_window: 50,
    mid_range_block: 20,
    distant_threshold: 200,
  },
  loom: {
    bidding_window_ms: 2_000,
    epsilon_greedy: 0.1,
    re_auction_timeout_ms: 300_000,
    score_weights: {
      capability: 0.5,
      load_inverse: 0.3,
      cost_inverse: 0.2,
    },
  },
  agents: {},
};

let cachedConfig: TalosConfig | null = null;

function parseYamlValue(raw: string): unknown {
  const trimmed = raw.trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed === "null" || trimmed === "~") return null;
  const num = Number(trimmed);
  if (!isNaN(num) && isFinite(num)) return num;
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseYamlSimple(content: string): Record<string, unknown> {
  const lines = content.split("\n");
  const result: Record<string, unknown> = {};
  let currentSection: string | null = null;
  let sectionObj: Record<string, unknown> = {};

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line || line.startsWith("#")) continue;

    if (line.startsWith("  ")) {
      const colonIdx = line.indexOf(":");
      if (colonIdx === -1) continue;
      const key = line.slice(0, colonIdx).trim();
      const rest = line.slice(colonIdx + 1).trim();
      const value = parseYamlValue(rest);
      if (currentSection) {
        sectionObj[key] = value;
      }
    } else {
      if (currentSection && Object.keys(sectionObj).length > 0) {
        result[currentSection] = { ...sectionObj };
      }
      const colonIdx = line.indexOf(":");
      if (colonIdx === -1) continue;
      const key = line.slice(0, colonIdx).trim();
      const rest = line.slice(colonIdx + 1).trim();

      if (!rest) {
        currentSection = key;
        sectionObj = {};
      } else {
        result[key] = parseYamlValue(rest);
      }
    }
  }

  if (currentSection && Object.keys(sectionObj).length > 0) {
    result[currentSection] = { ...sectionObj };
  }

  return result;
}

function safeGet<T>(obj: unknown, path: string[]): T | undefined {
  let cur: unknown = obj;
  for (const key of path) {
    if (cur === null || cur === undefined || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur as T | undefined;
}

export function loadTalosConfig(): TalosConfig {
  if (cachedConfig) return cachedConfig;

  const searchPaths = [
    join(process.cwd(), "talos.config.yaml"),
    join(process.cwd(), "..", "talos.config.yaml"),
    join(process.cwd(), "..", "..", "talos.config.yaml"),
  ];

  let yamlData: Record<string, unknown> = {};
  for (const path of searchPaths) {
    try {
      if (existsSync(path)) {
        const raw = readFileSync(path, "utf-8");
        yamlData = parseYamlSimple(raw);
        break;
      }
    } catch {
      // Try next path
    }
  }

  const g0d = safeGet<Record<string, unknown>>(yamlData, ["g0dm0d3"]) ?? {};
  const cloudData = safeGet<Record<string, unknown>>(yamlData, ["cloud"]) ?? {};
  const budgetData = safeGet<Record<string, unknown>>(cloudData, ["budget"]) ?? {};
  const hermesData = safeGet<Record<string, unknown>>(yamlData, ["hermes"]) ?? {};
  const cortexData = safeGet<Record<string, unknown>>(yamlData, ["cortex"]) ?? {};
  const loomData = safeGet<Record<string, unknown>>(yamlData, ["loom"]) ?? {};
  const loomWeightsData = safeGet<Record<string, unknown>>(loomData, ["score_weights"]) ?? {};
  const agentsData = safeGet<Record<string, Record<string, unknown>>>(yamlData, ["agents"]) ?? {};

  const config: TalosConfig = {
    version: safeGet<string>(yamlData, ["version"]) ?? DEFAULT_CONFIG.version,
    mode: safeGet<string>(yamlData, ["mode"]) ?? DEFAULT_CONFIG.mode,
    hermes_anchor: safeGet<string>(yamlData, ["hermes_anchor"]) ?? DEFAULT_CONFIG.hermes_anchor,
    g0dm0d3: {
      enabled: envBool("G0DM0D3_ENABLED", safeGet<boolean>(g0d, ["enabled"]) ?? DEFAULT_CONFIG.g0dm0d3.enabled),
      scan_interval_ms: envNum("G0DM0D3_SCAN_INTERVAL_MS", safeGet<number>(g0d, ["scan_interval_ms"]) ?? DEFAULT_CONFIG.g0dm0d3.scan_interval_ms),
      capability_threshold: envNum("G0DM0D3_CAPABILITY_THRESHOLD", safeGet<number>(g0d, ["capability_threshold"]) ?? DEFAULT_CONFIG.g0dm0d3.capability_threshold),
      scan_subnets: (() => {
        const envVal = (process.env as Record<string, string | undefined>)["G0DM0D3_SCAN_SUBNETS"];
        if (envVal) return envVal.split(",").map((s) => s.trim());
        const yamlVal = safeGet<unknown[]>(g0d, ["scan_subnets"]);
        if (yamlVal) return yamlVal.filter((v): v is string => typeof v === "string");
        return DEFAULT_CONFIG.g0dm0d3.scan_subnets;
      })(),
      ollama_port: envNum("G0DM0D3_OLLAMA_PORT", safeGet<number>(g0d, ["ollama_port"]) ?? DEFAULT_CONFIG.g0dm0d3.ollama_port),
    },
    cloud: {
      enabled: envBool("CLOUD_ENABLED", safeGet<boolean>(cloudData, ["enabled"]) ?? DEFAULT_CONFIG.cloud.enabled),
      providers: (() => {
        const yamlVal = safeGet<string[]>(cloudData, ["providers"]);
        return yamlVal ?? DEFAULT_CONFIG.cloud.providers;
      })(),
      budget: {
        monthly_usd: envNum("BUDGET_MONTHLY_USD", safeGet<number>(budgetData, ["monthly_usd"]) ?? DEFAULT_CONFIG.cloud.budget.monthly_usd),
        hourly_usd: envNum("BUDGET_HOURLY_USD", safeGet<number>(budgetData, ["hourly_usd"]) ?? DEFAULT_CONFIG.cloud.budget.hourly_usd),
        per_task_tokens: envNum("BUDGET_PER_TASK_TOKENS", safeGet<number>(budgetData, ["per_task_tokens"]) ?? DEFAULT_CONFIG.cloud.budget.per_task_tokens),
        per_minute_requests: envNum("BUDGET_PER_MINUTE_REQUESTS", safeGet<number>(budgetData, ["per_minute_requests"]) ?? DEFAULT_CONFIG.cloud.budget.per_minute_requests),
        hard_kill_at: envNum("BUDGET_HARD_KILL_AT", safeGet<number>(budgetData, ["hard_kill_at"]) ?? DEFAULT_CONFIG.cloud.budget.hard_kill_at),
      },
    },
    hermes: {
      agent_id: env("HERMES_AGENT_ID", safeGet<string>(hermesData, ["agent_id"]) ?? DEFAULT_CONFIG.hermes.agent_id),
      primary_model: env("HERMES_PRIMARY_MODEL", safeGet<string>(hermesData, ["primary_model"]) ?? DEFAULT_CONFIG.hermes.primary_model),
      fallback_model: env("HERMES_FALLBACK_MODEL", safeGet<string>(hermesData, ["fallback_model"]) ?? DEFAULT_CONFIG.hermes.fallback_model),
      pinned: safeGet<boolean>(hermesData, ["pinned"]) ?? DEFAULT_CONFIG.hermes.pinned,
      max_context_tokens: envNum("HERMES_MAX_CONTEXT_TOKENS", safeGet<number>(hermesData, ["max_context_tokens"]) ?? DEFAULT_CONFIG.hermes.max_context_tokens),
      temperature: envNum("HERMES_TEMPERATURE", safeGet<number>(hermesData, ["temperature"]) ?? DEFAULT_CONFIG.hermes.temperature),
    },
    cortex: {
      max_injection_tokens: envNum("CORTEX_MAX_INJECTION_TOKENS", safeGet<number>(cortexData, ["max_injection_tokens"]) ?? DEFAULT_CONFIG.cortex.max_injection_tokens),
      verbatim_window: envNum("CORTEX_VERBATIM_WINDOW", safeGet<number>(cortexData, ["verbatim_window"]) ?? DEFAULT_CONFIG.cortex.verbatim_window),
      mid_range_block: envNum("CORTEX_MID_RANGE_BLOCK", safeGet<number>(cortexData, ["mid_range_block"]) ?? DEFAULT_CONFIG.cortex.mid_range_block),
      distant_threshold: envNum("CORTEX_DISTANT_THRESHOLD", safeGet<number>(cortexData, ["distant_threshold"]) ?? DEFAULT_CONFIG.cortex.distant_threshold),
    },
    loom: {
      bidding_window_ms: envNum("LOOM_BIDDING_WINDOW_MS", safeGet<number>(loomData, ["bidding_window_ms"]) ?? DEFAULT_CONFIG.loom.bidding_window_ms),
      epsilon_greedy: envNum("LOOM_EPSILON_GREEDY", safeGet<number>(loomData, ["epsilon_greedy"]) ?? DEFAULT_CONFIG.loom.epsilon_greedy),
      re_auction_timeout_ms: envNum("LOOM_RE_AUCTION_TIMEOUT_MS", safeGet<number>(loomData, ["re_auction_timeout_ms"]) ?? DEFAULT_CONFIG.loom.re_auction_timeout_ms),
      score_weights: {
        capability: envNum("LOOM_SCORE_CAPABILITY", safeGet<number>(loomWeightsData, ["capability"]) ?? DEFAULT_CONFIG.loom.score_weights.capability),
        load_inverse: envNum("LOOM_SCORE_LOAD_INVERSE", safeGet<number>(loomWeightsData, ["load_inverse"]) ?? DEFAULT_CONFIG.loom.score_weights.load_inverse),
        cost_inverse: envNum("LOOM_SCORE_COST_INVERSE", safeGet<number>(loomWeightsData, ["cost_inverse"]) ?? DEFAULT_CONFIG.loom.score_weights.cost_inverse),
      },
    },
    agents: Object.fromEntries(
      Object.entries(agentsData).map(([key, val]) => [
        key,
        {
          model: typeof (val as Record<string, unknown>)?.["model"] === "string" ? String((val as Record<string, unknown>)["model"]) : "",
          context: typeof (val as Record<string, unknown>)?.["context"] === "number" ? Number((val as Record<string, unknown>)["context"]) : 0,
        },
      ])
    ) as Record<string, AgentConfig>,
  };

  cachedConfig = config;
  return config;
}

export function getConfig(): TalosConfig {
  return loadTalosConfig();
}

export function clearConfigCache(): void {
  cachedConfig = null;
}