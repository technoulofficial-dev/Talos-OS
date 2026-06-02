/**
 * SYS-G0DM0D3 G2: OllamaProbe
 * Probes a discovered Ollama endpoint for available models.
 */

export interface OllamaModel {
  name: string;
  size: number;
  parameterSize: string;
  quantization: string;
}

export interface ProbeResult {
  ip: string;
  port: number;
  models: OllamaModel[];
  latencyMs: number;
  totalVramGb: number;
  probeTime: Date;
}

export async function probeOllama(
  ip: string,
  port: number = 11434,
  timeoutMs: number = 5000
): Promise<ProbeResult | null> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(`http://${ip}:${port}/api/tags`, {
      method: "GET",
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!response.ok) return null;

    const data = await response.json() as {
      models?: Array<{
        name: string;
        size: number;
        parameter_size?: string;
        quantization_level?: string;
      }>;
    };

    const models: OllamaModel[] = (data.models ?? []).map((m) => ({
      name: m.name,
      size: m.size,
      parameterSize: m.parameter_size ?? "unknown",
      quantization: m.quantization_level ?? "unknown",
    }));

    const totalVramGb = models.reduce((sum, m) => sum + m.size, 0) * 1.2 / (1024 ** 3);
    return { ip, port, models, latencyMs: Date.now() - start, totalVramGb, probeTime: new Date() };
  } catch {
    return null;
  }
}

export async function isAlive(endpoint: string, timeoutMs: number = 3000): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(endpoint, { method: "HEAD", signal: controller.signal });
    clearTimeout(timer);
    return response.ok;
  } catch {
    return false;
  }
}