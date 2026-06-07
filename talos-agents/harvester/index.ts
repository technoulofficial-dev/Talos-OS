/**
 * Harvester — Skill Ingestion Agent
 *
 * The Harvester copies/cracks external AI skills and tools (OpenCode,
 * Hermes skills, Git Surgeon, Claude commands, etc.), extracts their logic,
 * tests them in a sandbox, and converts them into Talos skills that can be
 * reused by all agents. Respects open-source licenses.
 *
 * Implements the "Skill Ingestion (Harvester)" specification from the
 * Agentic OS Extension section of the blueprint.
 */

import { route } from "@talos/core/router";
import { executeSandbox } from "@talos/core/sandbox";

export interface SkillSource {
  type: "github" | "local" | "url" | "npm" | "pypi";
  identifier: string;
  license: string;
  version?: string;
}

export interface ExtractedSkill {
  name: string;
  description: string;
  parameters: Array<{
    name: string;
    type: string;
    required: boolean;
    description: string;
  }>;
  logic: string;
  dependencies: string[];
  tags: string[];
}

export interface IngestionResult {
  output: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  skill: ExtractedSkill | null;
  testPassed: boolean;
  testOutput: string;
  licenseCompliant: boolean;
  registeredSkillId?: string;
}

const LICENSE_ALLOWLIST = [
  "MIT",
  "Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "ISC",
  "MPL-2.0",
  "LGPL-2.1",
  "LGPL-3.0",
  "GPL-2.0",
  "GPL-3.0",
  "Unlicense",
  "CC0-1.0",
  "CC-BY-4.0",
  "CC-BY-SA-4.0",
];

/**
 * Ingest an external skill into the Talos OS skill registry.
 * Steps: clone/fetch → extract logic → test in sandbox → register if passed.
 */
export async function runSkillIngestion(source: SkillSource): Promise<IngestionResult> {
  const start = Date.now();

  // Step 1: License compliance check
  if (!LICENSE_ALLOWLIST.includes(source.license)) {
    return {
      output: `License "${source.license}" is not in the allowlist. Skipping ingestion.`,
      model: "harvester-policy",
      tokensIn: 0,
      tokensOut: 0,
      latencyMs: Date.now() - start,
      skill: null,
      testPassed: false,
      testOutput: "License not compliant with Talos OS policy",
      licenseCompliant: false,
    };
  }

  // Step 2: Extract skill logic via LLM
  const extraction = await extractSkillLogic(source);
  if (!extraction.skill) {
    return {
      output: "Failed to extract skill logic",
      model: extraction.model,
      tokensIn: extraction.tokensIn,
      tokensOut: extraction.tokensOut,
      latencyMs: extraction.latencyMs,
      skill: null,
      testPassed: false,
      testOutput: "Extraction failed",
      licenseCompliant: true,
    };
  }

  // Step 3: Test in sandbox
  const testResult = await testSkillInSandbox(extraction.skill);

  // Step 4: Register if tests passed
  let registeredSkillId: string | undefined;
  if (testResult.passed) {
    registeredSkillId = await registerSkill(extraction.skill, source);
  }

  return {
    output: extraction.output,
    model: extraction.model,
    tokensIn: extraction.tokensIn,
    tokensOut: extraction.tokensOut,
    latencyMs: Date.now() - start,
    skill: extraction.skill,
    testPassed: testResult.passed,
    testOutput: testResult.output,
    licenseCompliant: true,
    registeredSkillId,
  };
}

async function extractSkillLogic(source: SkillSource): Promise<{
  output: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  skill: ExtractedSkill | null;
}> {
  const start = Date.now();
  const systemPrompt = `You are the Talos OS Harvester (Skill Ingestion Agent).
Your job: extract the core logic of an external AI skill/tool and convert it into a Talos-compatible skill.

The skill must be:
- Self-contained (minimal external dependencies)
- Sandboxed (no system access unless explicitly declared)
- Reproducible (deterministic outputs given same inputs)
- Testable (clear input/output contract)
- License-compliant (MIT, Apache-2.0, BSD, etc.)

Output a JSON skill definition with: name, description, parameters, logic, dependencies, tags.`;

  const prompt = `## Source
Type: ${source.type}
Identifier: ${source.identifier}
License: ${source.license}
${source.version ? `Version: ${source.version}` : ""}

Please extract the core skill logic and convert it to Talos OS skill format.`;

  const decision = await route({
    agentId: "harvester",
    maxTokens: 8000,
    temperature: 0.2,
    preferLocal: true,
    priority: "normal",
    requiredSkills: ["code-analysis", "skill-extraction", "abstraction"],
    modelHints: ["deepseek-ai/deepseek-v4-pro", "nvidia/nemotron-3-super-120b-a12b"],
    requiresTools: true,
    systemPrompt,
    prompt,
    messages: [],
  });

  // In production, parse the JSON from decision.output
  return {
    output: decision.output ?? "",
    model: decision.model ?? "deepseek-ai/deepseek-v4-pro",
    tokensIn: decision.tokensIn ?? 0,
    tokensOut: decision.tokensOut ?? 0,
    latencyMs: decision.latencyMs ?? Date.now() - start,
    skill: parseSkillFromOutput(decision.output ?? ""),
  };
}

async function testSkillInSandbox(skill: ExtractedSkill): Promise<{
  passed: boolean;
  output: string;
}> {
  try {
    const result = await executeSandbox({
      code: skill.logic,
      dependencies: skill.dependencies,
      timeoutMs: 30_000,
      networkAccess: false,
    });
    return {
      passed: result.exitCode === 0,
      output: result.stdout + (result.stderr ? `\n${result.stderr}` : ""),
    };
  } catch (err) {
    return {
      passed: false,
      output: `Sandbox execution failed: ${(err as Error).message}`,
    };
  }
}

async function registerSkill(skill: ExtractedSkill, source: SkillSource): Promise<string> {
  const skillId = `skill-${skill.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
  console.log(`[harvester] Registered skill: ${skillId}`);
  // In production, this would insert into the talos_plugins or talos_skills table
  return skillId;
}

function parseSkillFromOutput(output: string): ExtractedSkill | null {
  try {
    // Try to find JSON in the output
    const jsonMatch = output.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as ExtractedSkill;
    }
  } catch {
    // Fall through
  }
  return null;
}