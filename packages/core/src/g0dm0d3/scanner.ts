/**
 * SYS-G0DM0D3 G1: SubnetScanner
 * Scans local network for Ollama endpoints (port 11434).
 */

export interface ScanResult {
  ip: string;
  port: number;
  reachable: boolean;
  latencyMs: number;
}

/**
 * Scan a list of subnet CIDRs for Ollama endpoints.
 * Uses TCP connect probe on port 11434.
 * Phase 1: simplified scan using local hostname detection.
 * Phase 2+: real ARP + TCP sweep via child_process.
 */
export async function scanSubnets(
  subnets: string[],
  port: number = 11434,
  concurrency: number = 64,
  timeoutMs: number = 3000
): Promise<ScanResult[]> {
  const results: ScanResult[] = [];

  // Phase 1: scan localhost + common LAN IPs
  const candidates = generateCandidateIPs(subnets);
  const chunks = chunkArray(candidates, concurrency);

  for (const chunk of chunks) {
    const probes = chunk.map((ip) => probePort(ip, port, timeoutMs));
    const settled = await Promise.allSettled(probes);

    for (let i = 0; i < settled.length; i++) {
      const result = settled[i]!;
      const ip = chunk[i]!;
      if (result.status === "fulfilled" && result.value.reachable) {
        results.push(result.value);
      }
    }
  }

  return results;
}

/** Generate candidate IPs from subnet strings */
function generateCandidateIPs(subnets: string[]): string[] {
  const ips: string[] = ["127.0.0.1"]; // Always include localhost

  for (const subnet of subnets) {
    const base = subnet.replace(/\/\d+$/, "");
    const parts = base.split(".");
    if (parts.length !== 4) continue;

    // Generate .1 through .254 for the subnet
    for (let i = 1; i <= 254; i++) {
      const ip = `${parts[0]}.${parts[1]}.${parts[2]}.${i}`;
      if (ip !== "127.0.0.1") ips.push(ip);
    }
  }

  return ips;
}

/** Probe a single IP:port with TCP connect */
async function probePort(
  ip: string,
  port: number,
  timeoutMs: number
): Promise<ScanResult> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(`http://${ip}:${port}/api/tags`, {
      method: "GET",
      signal: controller.signal,
    });
    clearTimeout(timer);

    const latencyMs = Date.now() - start;
    return { ip, port, reachable: response.ok, latencyMs };
  } catch {
    return { ip, port, reachable: false, latencyMs: Date.now() - start };
  }
}

/** Split array into chunks */
function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}