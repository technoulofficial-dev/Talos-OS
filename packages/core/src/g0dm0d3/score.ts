/**
 * SYS-G0DM0D3 G3: CapabilityScorer
 * Scores a discovered device's AI capability for Loom bidding.
 */

export interface DeviceCapabilityInput {
  modelCount: number;
  totalVramGb: number;
  latencyMs: number;
  uptimeRatio: number; // 0-1, ratio of successful heartbeats
}

export interface CapabilityScore {
  score: number; // 0-1
  breakdown: {
    modelCount: number;
    vram: number;
    latencyInverse: number;
    uptime: number;
  };
}

/**
 * Score a device's capability.
 * Formula: 0.4*model_count + 0.3*vram + 0.2*latency_inv + 0.1*uptime
 * All components normalized to 0-1.
 */
export function scoreCapability(input: DeviceCapabilityInput): CapabilityScore {
  const modelScore = normalize(input.modelCount, 0, 20);
  const vramScore = normalize(input.totalVramGb, 0, 48);
  const latencyScore = 1 - normalize(input.latencyMs, 0, 5000);
  const uptimeScore = input.uptimeRatio;

  const score =
    0.4 * modelScore +
    0.3 * vramScore +
    0.2 * latencyScore +
    0.1 * uptimeScore;

  return {
    score: Math.max(0, Math.min(1, score)),
    breakdown: {
      modelCount: modelScore,
      vram: vramScore,
      latencyInverse: latencyScore,
      uptime: uptimeScore,
    },
  };
}

/** Normalize a value to 0-1 range */
function normalize(value: number, min: number, max: number): number {
  if (max === min) return 0.5;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}