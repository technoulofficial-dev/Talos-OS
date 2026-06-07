import { routeUnlimited } from "../ai-engine/router.js";
import type { AdvisorId, AdvisorReport, CouncilProposal } from "./types.js";

export interface AdvisorDef {
  id: AdvisorId;
  name: string;
  role: string;
  systemPrompt: string;
}

const STRATEGIST_PROMPT = `You are the STRATEGIST advisor on the Talos Council. Your role is to evaluate proposals for strategic alignment, long-term impact, and project fit.

Evaluate the proposal on these dimensions:
1. **Strategic Alignment** — Does this align with the project's overall goals and vision?
2. **Long-term Impact** — What are the second-order effects in 3-6 months?
3. **Opportunity Cost** — What are we not building by building this?
4. **Stakeholder Value** — Who benefits and how?
5. **Timeline Realism** — Is the proposed timeline achievable?

Output a structured evaluation with:
- A 1-2 sentence summary
- A score from 0-100
- Specific findings (with severity: critical/major/minor/info)
- Key strengths and concerns
- A recommendation (approve/conditional/reject/defer)
- Confidence in your assessment (0-100)`;

const ARCHITECT_PROMPT = `You are the ARCHITECT advisor on the Talos Council. Your role is to evaluate proposals for technical soundness, scalability, and maintainability.

Evaluate the proposal on these dimensions:
1. **Technical Feasibility** — Can this be built with the current architecture?
2. **Scalability** — Will this design scale to production loads?
3. **Dependency Analysis** — What new dependencies are introduced?
4. **Maintainability** — How easy will this be to maintain and extend?
5. **Integration Risk** — How well does this integrate with existing systems?

Output a structured evaluation with:
- A 1-2 sentence summary
- A score from 0-100
- Specific findings (with severity: critical/major/minor/info)
- Key strengths and concerns
- A recommendation (approve/conditional/reject/defer)
- Confidence in your assessment (0-100)`;

const RESEARCHER_PROMPT = `You are the RESEARCHER advisor on the Talos Council. Your role is to fact-check claims, validate assumptions, and gather evidence.

Evaluate the proposal on these dimensions:
1. **Claim Validation** — Are the factual claims in the proposal accurate?
2. **Assumption Testing** — Are the underlying assumptions sound?
3. **Evidence Quality** — Is sufficient evidence provided to support the proposal?
4. **Alternative Approaches** — Are there better approaches not considered?
5. **Risk Data** — Is there historical data suggesting risks?

Output a structured evaluation with:
- A 1-2 sentence summary
- A score from 0-100
- Specific findings (with severity: critical/major/minor/info)
- Key strengths and concerns
- A recommendation (approve/conditional/reject/defer)
- Confidence in your assessment (0-100)`;

const SENTINEL_PROMPT = `You are the SENTINEL advisor on the Talos Council. Your role is to evaluate proposals for security vulnerabilities, risk factors, and edge cases.

Evaluate the proposal on these dimensions:
1. **Security Impact** — Does this introduce new attack surfaces?
2. **Data Privacy** — How does this handle sensitive data?
3. **Error Handling** — What happens when things go wrong?
4. **Edge Cases** — What uncommon scenarios are not handled?
5. **Compliance** — Does this meet relevant standards and practices?

Output a structured evaluation with:
- A 1-2 sentence summary
- A score from 0-100
- Specific findings (with severity: critical/major/minor/info)
- Key strengths and concerns
- A recommendation (approve/conditional/reject/defer)
- Confidence in your assessment (0-100)`;

const QUALITY_PROMPT = `You are the QUALITY advisor on the Talos Council. Your role is to evaluate proposals for code quality, test coverage, and convention adherence.

Evaluate the proposal on these dimensions:
1. **Code Quality** — Does the proposed approach produce clean, maintainable code?
2. **Test Coverage** — Is there a clear testing strategy?
3. **Convention Adherence** — Does this follow project conventions and patterns?
4. **Documentation** — Is sufficient documentation planned?
5. **Technical Debt** — Does this introduce new technical debt?

Output a structured evaluation with:
- A 1-2 sentence summary
- A score from 0-100
- Specific findings (with severity: critical/major/minor/info)
- Key strengths and concerns
- A recommendation (approve/conditional/reject/defer)
- Confidence in your assessment (0-100)`;

export const ADVISORS: AdvisorDef[] = [
  { id: "strategist", name: "Strategist", role: "Strategic Alignment", systemPrompt: STRATEGIST_PROMPT },
  { id: "architect", name: "Architect", role: "Technical Soundness", systemPrompt: ARCHITECT_PROMPT },
  { id: "researcher", name: "Researcher", role: "Fact-Checking & Evidence", systemPrompt: RESEARCHER_PROMPT },
  { id: "sentinel", name: "Sentinel", role: "Security & Risk", systemPrompt: SENTINEL_PROMPT },
  { id: "quality", name: "Quality", role: "Code Quality & Testing", systemPrompt: QUALITY_PROMPT },
];

function buildAdvisorPrompt(advisor: AdvisorDef, proposal: CouncilProposal): string {
  return `${advisor.systemPrompt}

## Proposal to Evaluate

**Title:** ${proposal.title}
**Description:** ${proposal.description}
${proposal.context ? `**Context:** ${proposal.context}\n` : ""}${proposal.files && proposal.files.length > 0 ? `**Related Files:**\n${proposal.files.map((f) => `  - ${f}`).join("\n")}\n` : ""}
**Priority:** ${proposal.priority}

## Output Format

Respond with ONLY a valid JSON object (no markdown, no code fences) matching this structure:
{
  "summary": "string",
  "score": 0-100,
  "findings": [{ "severity": "critical|major|minor|info", "category": "string", "summary": "string", "detail": "string", "recommendation": "string" }],
  "strengths": ["string"],
  "concerns": ["string"],
  "recommendation": "approve|conditional|reject|defer",
  "confidence": 0-100
}`;
}

function parseAdvisorJson(raw: string): Omit<AdvisorReport, "advisorId" | "tokensUsed" | "latencyMs"> {
  const cleaned = raw.replace(/```(?:json)?\s*/g, "").trim();
  const parsed = JSON.parse(cleaned) as Record<string, unknown>;

  const summary = parsed["summary"];
  const score = parsed["score"];
  const confidence = parsed["confidence"];
  const recommendation = parsed["recommendation"];

  if (typeof summary !== "string") throw new Error("Missing summary in advisor response");
  if (typeof score !== "number") throw new Error("Missing score in advisor response");
  if (typeof confidence !== "number") throw new Error("Missing confidence in advisor response");

  return {
    summary,
    score,
    findings: Array.isArray(parsed["findings"]) ? parsed["findings"] : [],
    strengths: Array.isArray(parsed["strengths"]) ? parsed["strengths"] : [],
    concerns: Array.isArray(parsed["concerns"]) ? parsed["concerns"] : [],
    recommendation: ["approve", "conditional", "reject", "defer"].includes(recommendation as string)
      ? (recommendation as AdvisorReport["recommendation"])
      : "defer",
    confidence,
  };
}

export async function runAdvisor(
  advisor: AdvisorDef,
  proposal: CouncilProposal
): Promise<AdvisorReport> {
  const start = Date.now();
  const prompt = buildAdvisorPrompt(advisor, proposal);

  const response = await routeUnlimited({
    prompt,
    agentId: `council-${advisor.id}`,
    maxTokens: 2048,
    temperature: 0.3,
    preferLocal: true,
  });

  const parsed = parseAdvisorJson(response.output);

  return {
    advisorId: advisor.id,
    ...parsed,
    tokensUsed: response.tokensIn + response.tokensOut,
    latencyMs: Date.now() - start,
  };
}

export async function evaluateParallel(proposal: CouncilProposal, advisorFilter?: AdvisorId[]): Promise<AdvisorReport[]> {
  const advisors = advisorFilter
    ? ADVISORS.filter((a) => advisorFilter.includes(a.id))
    : ADVISORS;

  const results = await Promise.allSettled(
    advisors.map((advisor) => runAdvisor(advisor, proposal))
  );

  const reports: AdvisorReport[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      reports.push(result.value);
    } else {
      const idx = Math.min(reports.length, advisors.length - 1);
      const failedId = advisors[idx]?.id ?? "strategist";
      console.error(`[council] Advisor ${failedId} failed:`, result.reason);
      reports.push({
        advisorId: failedId as AdvisorReport["advisorId"],
        summary: `Evaluation failed: ${(result.reason as Error).message}`,
        score: 0,
        findings: [],
        strengths: [],
        concerns: [],
        recommendation: "defer",
        confidence: 0,
        tokensUsed: 0,
        latencyMs: 0,
      });
    }
  }

  return reports;
}
