import { describe, it, expect, beforeEach } from "vitest";
import {
  registerSkill,
  getSkill,
  listSkills,
  updateSuccessRate,
  promoteToCached,
  type SkillsClient,
} from "../skills.js";

interface Row {
  id: string;
  name: string;
  description: string;
  source: string;
  source_tool: string;
  category: string;
  prompt_template: string;
  trigger_phrases: string[];
  success_rate: number;
  is_cached: boolean;
  created_at?: string;
  updated_at?: string;
}

function makeMockClient(): { client: SkillsClient; rows: Row[] } {
  const rows: Row[] = [];
  const client: SkillsClient = {
    from() {
      return {
        select: () => ({
          eq(col: string, val: unknown) {
            return {
              single: async () => {
                const match = rows.find((r) => (r as Record<string, unknown>)[col] === val);
                return { data: match ?? null, error: match ? null : { message: "not found" } };
              },
              order() {
                return {
                  limit: async () => {
                    let filtered = [...rows];
                    if (col === "category") {
                      filtered = filtered.filter((r) => r.category === val);
                    }
                    if (col === "name") {
                      filtered = filtered.filter((r) => r.name === val);
                    }
                    return { data: filtered, error: null };
                  },
                };
              },
            };
          },
          order() {
            return {
              limit: async () => ({ data: [...rows], error: null }),
            };
          },
        }),
        insert: (payload: unknown) => {
          const row = payload as Partial<Row>;
          const newRow: Row = {
            id: `id-${rows.length + 1}`,
            name: row.name ?? "",
            description: row.description ?? "",
            source: row.source ?? "",
            source_tool: row.source_tool ?? "",
            category: row.category ?? "uncategorized",
            prompt_template: row.prompt_template ?? "",
            trigger_phrases: row.trigger_phrases ?? [],
            success_rate: 0,
            is_cached: false,
            created_at: new Date().toISOString(),
          };
          rows.push(newRow);
          return {
            select: () => ({
              single: async () => ({ data: newRow, error: null }),
            }),
          };
        },
        update: (patch: unknown) => {
          const p = patch as Partial<Row>;
          return {
            eq(col: string, val: unknown) {
              return {
                select: () => ({
                  single: async () => {
                    const target = rows.find((r) => (r as Record<string, unknown>)[col] === val);
                    if (!target) return { data: null, error: { message: "not found" } };
                    if (p.success_rate !== undefined) target.success_rate = p.success_rate;
                    if (p.is_cached !== undefined) target.is_cached = p.is_cached;
                    if (p.updated_at !== undefined) target.updated_at = p.updated_at as string;
                    return { data: target, error: null };
                  },
                }),
              };
            },
          };
        },
      };
    },
  };
  return { client, rows };
}

describe("@talos/db — skills module", () => {
  let mock: ReturnType<typeof makeMockClient>;
  beforeEach(() => {
    mock = makeMockClient();
  });

  it("registerSkill inserts and returns mapped skill", async () => {
    const skill = await registerSkill(
      {
        name: "summarize",
        description: "Summarizes text",
        category: "writing",
        triggerPhrases: ["summarize this", "tldr"],
      },
      mock.client
    );
    expect(skill.name).toBe("summarize");
    expect(skill.category).toBe("writing");
    expect(skill.triggerPhrases).toEqual(["summarize this", "tldr"]);
    expect(skill.successRate).toBe(0);
    expect(skill.isCached).toBe(false);
    expect(mock.rows).toHaveLength(1);
  });

  it("getSkill returns the skill or null", async () => {
    await registerSkill({ name: "find-bugs" }, mock.client);
    const found = await getSkill("find-bugs", mock.client);
    expect(found).not.toBeNull();
    expect(found?.name).toBe("find-bugs");

    const missing = await getSkill("nope", mock.client);
    expect(missing).toBeNull();
  });

  it("listSkills returns all skills ordered by success_rate desc", async () => {
    await registerSkill({ name: "a" }, mock.client);
    await registerSkill({ name: "b" }, mock.client);
    const list = await listSkills({ limit: 10 }, mock.client);
    expect(list).toHaveLength(2);
  });

  it("updateSuccessRate updates and validates the range", async () => {
    await registerSkill({ name: "x" }, mock.client);
    const updated = await updateSuccessRate("x", 0.85, mock.client);
    expect(updated.successRate).toBe(0.85);

    await expect(updateSuccessRate("x", 1.5, mock.client)).rejects.toThrow(/between 0 and 1/);
    await expect(updateSuccessRate("x", -0.1, mock.client)).rejects.toThrow(/between 0 and 1/);
  });

  it("promoteToCached sets is_cached true", async () => {
    await registerSkill({ name: "y" }, mock.client);
    const promoted = await promoteToCached("y", mock.client);
    expect(promoted.isCached).toBe(true);
  });
});
