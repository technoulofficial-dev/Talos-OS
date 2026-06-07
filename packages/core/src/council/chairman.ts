import { routeUnlimited } from "../ai-engine/router.js";
import type { AdvisorReport, ChairmanVerdict } from "./types.js";

const CHAIRMAN_PROMPT = `You are the CHAIRMAN of the Talos Council. You have received independent evaluation reports from all 5 advisors (Strategist, Architect, Researcher, Sentinel, Quality).

Your role is to synthesize these reports into a single, coherent final verdict. You must:

1. **Weight each advisor** by their confidence score and the severity of their findings
2. **Identify consensus** — Where do most advisors agree?
3. **Surface dissenting opinions** — Where do advisors disagree and why?
4. **Resolve conflicts** — When advisors give contradictory recommendations, decide which reasoning is stronger
5. **Produce actionable output** — Specific action items that the team can execute

Rules:
- You are NOT another advisor. Do not add your own evaluation. Synthesize the given reports.
- If most advisors approve, lean toward approve with conditions.
- If any advisor flags a critical finding, explain why it is or isn't a blocker.
- Be decisive. "Defer" is for when critical information is missing.

Output ONLY valid JSON with this structure:
{
  "verdict": "approve|conditional|reject|defer",
  "summary": "string — 2-3 sentence synthesis",
  "consensusScore": 0-100,
  "advisorScores": { "strategist": 0-100, "architect": 0-100, "researcher": 0-100, "sentinel": 0-100, "quality": 0-100 },
  "keyStrengths": ["string"],
  "keyConcerns": ["string"],
  "actionItems": ["string"],
  "dissentingOpinions": [{ "advisorId": "strategist|architect|researcher|sentinel|quality", "reason": "string" }],
  "confidence": 0-100
}`;

function buildChairmanPrompt(reports: AdvisorReport[]): string {
  const reportsSection = reports
    .map(
      (r) => `--- ${r.advisorId.toUpperCase()} ---
Summary: ${r.summary}
Score: ${r.score}/100
Confidence: ${r.confidence}%
Recommendation: ${r.recommendation}
Findings: ${r.findings.map((f) => `[${f.severity}] ${f.category}: ${f.summary}`).join("\n         ")}
Strengths: ${r.strengths.join(", ")}
Concerns: ${r.concerns.join(", ")}`
    )
    .join("\n\n");

  return `${CHAIRMAN_PROMPT}

## Advisor Reports

${reportsSection}`;
}

function parseChairmanJson(raw: string): ChairmanVerdict {
  const cleaned = raw.replace(/```(?:json)?\s*/g, "").trim();
  const parsed = JSON.parse(cleaned) as Record<string, unknown>;

  const verdict = parsed["verdict"];
  const summary = parsed["summary"];
  const consensusScore = parsed["consensusScore"];

  if (typeof verdict !== "string") throw new Error("Missing verdict in chairman response");
  if (typeof summary !== "string") throw new Error("Missing summary in chairman response");
  if (typeof consensusScore !== "number") throw new Error("Missing consensusScore in chairman response");

  return {
    verdict: ["approve", "conditional", "reject", "defer"].includes(verdict as string)
      ? (verdict as ChairmanVerdict["verdict"])
      : "defer",
    summary,
    consensusScore,
    advisorScores: (parsed["advisorScores"] ?? {}) as ChairmanVerdict["advisorScores"],
    keyStrengths: Array.isArray(parsed["keyStrengths"]) ? parsed["keyStrengths"] : [],
    keyConcerns: Array.isArray(parsed["keyConcerns"]) ? parsed["keyConcerns"] : [],
    actionItems: Array.isArray(parsed["actionItems"]) ? parsed["actionItems"] : [],
    dissentingOpinions: Array.isArray(parsed["dissentingOpinions"]) ? parsed["dissentingOpinions"] : [],
    confidence: typeof parsed["confidence"] === "number" ? parsed["confidence"] : 0,
  };
}

export async function synthesizeVerdict(reports: AdvisorReport[]): Promise<ChairmanVerdict> {
  const prompt = buildChairmanPrompt(reports);

  const response = await routeUnlimited({
    prompt,
    agentId: "council-chairman",
    maxTokens: 2048,
    temperature: 0.2,
    preferLocal: true,
  });

  return parseChairmanJson(response.output);
}
