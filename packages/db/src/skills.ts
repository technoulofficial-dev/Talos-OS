/**
 * Skills - runtime registry of Talos skills.
 * Mirrors the talos_skills Supabase table (blueprint §12.2).
 * Minimal CRUD: register, get, list, updateSuccessRate, promoteToCached.
 */

import { z } from "zod";
import { getSupabaseClient, type SupabaseClient } from "./client.js";

export const SkillCategorySchema = z.enum([
  "code",
  "research",
  "writing",
  "analysis",
  "automation",
  "communication",
  "memory",
  "workflow",
  "meta",
  "uncategorized",
]);
export type SkillCategory = z.infer<typeof SkillCategorySchema>;

export const SkillSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional().default(""),
  source: z.string().optional().default(""),
  sourceTool: z.string().optional().default(""),
  category: SkillCategorySchema.default("uncategorized"),
  promptTemplate: z.string().optional().default(""),
  triggerPhrases: z.array(z.string()).default([]),
  successRate: z.number().min(0).max(1).default(0),
  isCached: z.boolean().default(false),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type Skill = z.infer<typeof SkillSchema>;

export const RegisterSkillInputSchema = SkillSchema.omit({
  id: true,
  successRate: true,
  isCached: true,
  createdAt: true,
  updatedAt: true,
}).partial({
  description: true,
  source: true,
  sourceTool: true,
  category: true,
  promptTemplate: true,
  triggerPhrases: true,
});
export type RegisterSkillInput = z.input<typeof RegisterSkillInputSchema>;

export interface SkillsClient {
  from: (table: string) => {
    select: (cols?: string) => {
      eq: (col: string, val: unknown) => {
        single: () => Promise<{ data: unknown; error: { message: string } | null }>;
        order: (col: string, opts?: { ascending?: boolean }) => {
          limit: (n: number) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
        };
      };
      order: (col: string, opts?: { ascending?: boolean }) => {
        limit: (n: number) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
      };
    };
    insert: (rows: unknown) => {
      select: () => {
        single: () => Promise<{ data: unknown; error: { message: string } | null }>;
      };
    };
    update: (patch: unknown) => {
      eq: (col: string, val: unknown) => {
        select: () => {
          single: () => Promise<{ data: unknown; error: { message: string } | null }>;
        };
      };
    };
  };
}

const SKILL_COLS =
  "id, name, description, source, source_tool, category, prompt_template, trigger_phrases, success_rate, is_cached, created_at, updated_at";

function mapSkillFromDb(row: Record<string, unknown>): Skill {
  return {
    id: row["id"] as string,
    name: row["name"] as string,
    description: (row["description"] as string) ?? "",
    source: (row["source"] as string) ?? "",
    sourceTool: (row["source_tool"] as string) ?? "",
    category: (row["category"] as SkillCategory) ?? "uncategorized",
    promptTemplate: (row["prompt_template"] as string) ?? "",
    triggerPhrases: (row["trigger_phrases"] as string[]) ?? [],
    successRate: (row["success_rate"] as number) ?? 0,
    isCached: (row["is_cached"] as boolean) ?? false,
    createdAt: row["created_at"] as string | undefined,
    updatedAt: row["updated_at"] as string | undefined,
  };
}

function resolveClient(client?: SupabaseClient | SkillsClient): SkillsClient {
  return (client ?? getSupabaseClient()) as unknown as SkillsClient;
}

export async function registerSkill(
  input: RegisterSkillInput,
  client?: SupabaseClient | SkillsClient
): Promise<Skill> {
  const parsed = RegisterSkillInputSchema.parse(input);
  const c = resolveClient(client);
  const { data, error } = await c
    .from("talos_skills")
    .insert({
      name: parsed.name,
      description: parsed.description,
      source: parsed.source,
      source_tool: parsed.sourceTool,
      category: parsed.category,
      prompt_template: parsed.promptTemplate,
      trigger_phrases: parsed.triggerPhrases,
    })
    .select()
    .single();
  if (error) throw new Error(`Failed to register skill: ${error.message}`);
  return mapSkillFromDb(data as Record<string, unknown>);
}

export async function getSkill(
  name: string,
  client?: SupabaseClient | SkillsClient
): Promise<Skill | null> {
  const c = resolveClient(client);
  const { data, error } = await c
    .from("talos_skills")
    .select(SKILL_COLS)
    .eq("name", name)
    .single();
  if (error) return null;
  if (!data) return null;
  return mapSkillFromDb(data as Record<string, unknown>);
}

export async function listSkills(
  options: { limit?: number; category?: SkillCategory } = {},
  client?: SupabaseClient | SkillsClient
): Promise<Skill[]> {
  const c = resolveClient(client);
  const limit = options.limit ?? 100;
  let query = c.from("talos_skills").select(SKILL_COLS);
  if (options.category) {
    const { data, error } = await query
      .eq("category", options.category)
      .order("success_rate", { ascending: false })
      .limit(limit);
    if (error) throw new Error(`Failed to list skills: ${error.message}`);
    return (data ?? []).map((r) => mapSkillFromDb(r as Record<string, unknown>));
  }
  const { data, error } = await query
    .order("success_rate", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Failed to list skills: ${error.message}`);
  return (data ?? []).map((r) => mapSkillFromDb(r as Record<string, unknown>));
}

export async function updateSuccessRate(
  name: string,
  successRate: number,
  client?: SupabaseClient | SkillsClient
): Promise<Skill> {
  if (successRate < 0 || successRate > 1) {
    throw new Error("successRate must be between 0 and 1");
  }
  const c = resolveClient(client);
  const { data, error } = await c
    .from("talos_skills")
    .update({ success_rate: successRate, updated_at: new Date().toISOString() })
    .eq("name", name)
    .select()
    .single();
  if (error) throw new Error(`Failed to update success rate: ${error.message}`);
  return mapSkillFromDb(data as Record<string, unknown>);
}

export async function promoteToCached(
  name: string,
  client?: SupabaseClient | SkillsClient
): Promise<Skill> {
  const c = resolveClient(client);
  const { data, error } = await c
    .from("talos_skills")
    .update({ is_cached: true, updated_at: new Date().toISOString() })
    .eq("name", name)
    .select()
    .single();
  if (error) throw new Error(`Failed to promote skill: ${error.message}`);
  return mapSkillFromDb(data as Record<string, unknown>);
}
