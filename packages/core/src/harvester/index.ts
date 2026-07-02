/**
 * Harvester — Skill Ingestion Module
 *
 * Orchestrates the pipeline: license check → LLM extraction → sandbox test → DB registration.
 * This is the core logic that wires the Harvester agent to the skills DB.
 *
 * ADR-045: Harvester uses registerSkill() from @talos/db (not a stub).
 * ADR-046: Sandbox test is optional — controlled by TALOS_HARVESTER_SANDBOX_ENABLED.
 */

import { routeUnlimited } from "../ai-engine/router.js";
import { registerSkill, getSkill, updateSuccessRate, type RegisterSkillInput, type Skill } from "@talos/db";

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
  category?: string;
}

export interface HarvestResult {
  success: boolean;
  skill: Skill | null;
  extracted: ExtractedSkill | null;
  testPassed: boolean;
  testOutput: string;
  licenseCompliant: boolean;
  output: string;
  model: string;
  latencyMs: number;
  error?: string;
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

const SYSTEM_PROMPT = `You are the Talos OS Harvester (Skill Ingestion Agent).
Your job: extract the core logic of an external AI skill/tool and convert it into a Talos-compatible skill.

The skill must be:
- Self-contained (minimal external dependencies)
- Sandboxed (no system access unless explicitly declared)
- Reproducible (deterministic outputs given same inputs)
- Testable (clear input/output contract)
- License-compliant (MIT, Apache-2.0, BSD, etc.)

Output a JSON object with these fields:
{
  "name": "skill-name-kebab-case",
  "description": "One sentence description",
  "parameters": [{"name": "param", "type": "string", "required": true, "description": "What it does"}],
  "logic": "function code or command",
  "dependencies": ["dep1"],
  "tags": ["tag1"],
  "category": "code|research|writing|analysis|automation|communication|memory|workflow|meta|uncategorized"
}`;

function parseSkillFromOutput(output: string): ExtractedSkill | null {
  try {
    const jsonMatch = output.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
      if (typeof parsed["name"] === "string" && typeof parsed["logic"] === "string") {
        return parsed as unknown as ExtractedSkill;
      }
    }
  } catch {
    // Fall through
  }
  return null;
}

/**
 * Extract skill logic from a source via LLM.
 */
async function extractSkill(source: SkillSource): Promise<{
  output: string;
  model: string;
  latencyMs: number;
  skill: ExtractedSkill | null;
}> {
  const start = Date.now();
  const prompt = `## Source
Type: ${source.type}
Identifier: ${source.identifier}
License: ${source.license}
${source.version ? `Version: ${source.version}` : ""}

Extract the core skill logic and convert it to Talos OS skill format. Output JSON only.`;

  const response = await routeUnlimited({
    agentId: "harvester",
    prompt,
    systemPrompt: SYSTEM_PROMPT,
    maxTokens: 4096,
    temperature: 0.2,
  });

  return {
    output: response.output ?? "",
    model: response.model ?? "unknown",
    latencyMs: Date.now() - start,
    skill: parseSkillFromOutput(response.output ?? ""),
  };
}

/**
 * Validate extracted skill has required fields.
 */
function validateExtractedSkill(skill: ExtractedSkill): string | null {
  if (!skill.name || skill.name.length < 2) return "Skill name too short";
  if (!skill.logic || skill.logic.length < 10) return "Skill logic too short";
  if (skill.name.length > 64) return "Skill name too long";
  if (!/^[a-z0-9-]+$/.test(skill.name)) return "Skill name must be kebab-case";
  return null;
}

/**
 * Harvest a skill from an external source.
 * Pipeline: license check → LLM extraction → validation → DB registration.
 */
export async function harvestSkill(
  source: SkillSource,
  options?: { skipDb?: boolean; client?: unknown },
): Promise<HarvestResult> {
  const start = Date.now();

  // Step 1: License compliance
  if (!LICENSE_ALLOWLIST.includes(source.license)) {
    return {
      success: false,
      skill: null,
      extracted: null,
      testPassed: false,
      testOutput: "",
      licenseCompliant: false,
      output: `License "${source.license}" is not in the allowlist`,
      model: "harvester-policy",
      latencyMs: Date.now() - start,
    };
  }

  // Step 2: Extract via LLM
  const extraction = await extractSkill(source);
  if (!extraction.skill) {
    return {
      success: false,
      skill: null,
      extracted: null,
      testPassed: false,
      testOutput: "Extraction failed — LLM did not return valid JSON",
      licenseCompliant: true,
      output: extraction.output,
      model: extraction.model,
      latencyMs: Date.now() - start,
      error: "Failed to extract skill logic from LLM output",
    };
  }

  // Step 3: Validate extracted skill
  const validationError = validateExtractedSkill(extraction.skill);
  if (validationError) {
    return {
      success: false,
      skill: null,
      extracted: extraction.skill,
      testPassed: false,
      testOutput: "",
      licenseCompliant: true,
      output: extraction.output,
      model: extraction.model,
      latencyMs: Date.now() - start,
      error: validationError,
    };
  }

  // Step 4: Sandbox test (optional, gated by env flag)
  let testPassed = true;
  let testOutput = "Sandbox test disabled (set TALOS_HARVESTER_SANDBOX_ENABLED=true to enable)";
  if (process.env["TALOS_HARVESTER_SANDBOX_ENABLED"] === "true") {
    try {
      const testFn = new Function("params", extraction.skill.logic);
      const testResult = await testFn({ test: true, input: "sandbox-verify" });
      testPassed = true;
      testOutput = `Sandbox test passed: ${JSON.stringify(testResult)}`;
    } catch (err) {
      testPassed = false;
      testOutput = `Sandbox test failed: ${(err as Error).message}`;
    }
  }

  // Step 5: Register in DB (unless skipped)
  if (options?.skipDb) {
    return {
      success: true,
      skill: null,
      extracted: extraction.skill,
      testPassed,
      testOutput,
      licenseCompliant: true,
      output: extraction.output,
      model: extraction.model,
      latencyMs: Date.now() - start,
    };
  }

  try {
    const client = options?.client as Parameters<typeof registerSkill>[1];

    // Step 5a: Deduplication — check if skill already exists
    const existing = await getSkill(extraction.skill.name, client).catch(() => null);
    if (existing) {
      await updateSuccessRate(extraction.skill.name, 0.5, client).catch(() => {});
      return {
        success: true,
        skill: existing,
        extracted: extraction.skill,
        testPassed,
        testOutput: `Skill "${extraction.skill.name}" already exists — updated success rate`,
        licenseCompliant: true,
        output: extraction.output,
        model: extraction.model,
        latencyMs: Date.now() - start,
      };
    }

    const input: RegisterSkillInput = {
      name: extraction.skill.name,
      description: extraction.skill.description,
      source: source.identifier,
      sourceTool: "harvester",
      category: (extraction.skill.category as RegisterSkillInput["category"]) ?? "uncategorized",
      promptTemplate: extraction.skill.logic,
      triggerPhrases: extraction.skill.tags,
    };
    const registered = await registerSkill(input, client);
    return {
      success: true,
      skill: registered,
      extracted: extraction.skill,
      testPassed,
      testOutput,
      licenseCompliant: true,
      output: extraction.output,
      model: extraction.model,
      latencyMs: Date.now() - start,
    };
  } catch (err) {
    return {
      success: false,
      skill: null,
      extracted: extraction.skill,
      testPassed,
      testOutput: `DB registration failed: ${(err as Error).message}`,
      licenseCompliant: true,
      output: extraction.output,
      model: extraction.model,
      latencyMs: Date.now() - start,
      error: (err as Error).message,
    };
  }
}

export { LICENSE_ALLOWLIST };
