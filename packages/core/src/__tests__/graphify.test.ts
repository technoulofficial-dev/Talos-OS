import { describe, it, expect, beforeEach } from "vitest";
import { addTriple, queryTriples, getStats, deleteTriple, clearGraph, searchByEntity, searchByPredicate, findPath } from "../graphify/store.js";

describe("Graphify — Core", () => {
  beforeEach(async () => {
    await clearGraph();
  });

  it("adds a triple and returns it with an id and date", async () => {
    const t = await addTriple("OdinAgent", "depends_on", "AiEngine");
    expect(t.id).toBeDefined();
    expect(t.subject).toBe("OdinAgent");
    expect(t.predicate).toBe("depends_on");
    expect(t.object).toBe("AiEngine");
    expect(t.createdAt).toBeInstanceOf(Date);
    expect(t.weight).toBe(1);
  });

  it("adds a triple with context and custom weight", async () => {
    const t = await addTriple("Mimir", "provides", "Memory", "Context store for agents", 0.8);
    expect(t.context).toBe("Context store for agents");
    expect(t.weight).toBe(0.8);
  });

  it("queries all triples", async () => {
    await addTriple("A", "rel", "B");
    await addTriple("C", "rel", "D");
    const results = await queryTriples({});
    expect(results).toHaveLength(2);
  });

  it("filters by entity (subject or object)", async () => {
    await addTriple("OdinAgent", "depends_on", "AiEngine");
    await addTriple("Brokkr", "depends_on", "AiEngine");
    await addTriple("OdinAgent", "uses", "Memory");
    const results = await queryTriples({ entity: "OdinAgent" });
    expect(results).toHaveLength(2);
  });

  it("filters by predicate", async () => {
    await addTriple("A", "depends_on", "B");
    await addTriple("C", "provides", "D");
    const results = await queryTriples({ predicate: "depends_on" });
    expect(results).toHaveLength(1);
    expect(results[0]!.subject).toBe("A");
  });

  it("filters by subject", async () => {
    await addTriple("OdinAgent", "depends_on", "AiEngine");
    await addTriple("Brokkr", "depends_on", "AiEngine");
    const results = await queryTriples({ subject: "OdinAgent" });
    expect(results).toHaveLength(1);
  });

  it("filters by object", async () => {
    await addTriple("A", "uses", "Memory");
    await addTriple("B", "uses", "Storage");
    const results = await queryTriples({ object: "Memory" });
    expect(results).toHaveLength(1);
  });

  it("supports pagination with limit and offset", async () => {
    for (let i = 0; i < 10; i++) {
      await addTriple(`Subject${i}`, "rel", `Object${i}`);
    }
    const page1 = await queryTriples({ limit: 3, offset: 0 });
    const page2 = await queryTriples({ limit: 3, offset: 3 });
    expect(page1).toHaveLength(3);
    expect(page2).toHaveLength(3);
    expect(page1[0]!.subject).toBe("Subject0");
    expect(page2[0]!.subject).toBe("Subject3");
  });

  it("deletes a triple by id", async () => {
    const t = await addTriple("A", "rel", "B");
    expect(await deleteTriple(t.id)).toBe(true);
    expect(await queryTriples({})).toHaveLength(0);
  });

  it("returns false when deleting nonexistent triple", async () => {
    expect(await deleteTriple("nonexistent")).toBe(false);
  });

  it("clears the entire graph", async () => {
    await addTriple("A", "rel", "B");
    await addTriple("C", "rel", "D");
    await clearGraph();
    expect(await queryTriples({})).toHaveLength(0);
  });

  it("searchByEntity finds triples by subject or object", async () => {
    await addTriple("OdinAgent", "depends_on", "AiEngine");
    await addTriple("OdinAgent", "depends_on", "BudgetGate");
    const results = await searchByEntity("OdinAgent");
    expect(results).toHaveLength(2);
  });

  it("searchByPredicate filters by relation", async () => {
    await addTriple("Mimir", "provides", "Cortex");
    const results = await searchByPredicate("provides");
    expect(results).toHaveLength(1);
    expect(results[0]!.subject).toBe("Mimir");
  });
});

describe("Graphify — Statistics", () => {
  beforeEach(async () => {
    await clearGraph();
  });

  it("returns empty stats for empty graph", async () => {
    const stats = await getStats();
    expect(stats.totalTriples).toBe(0);
    expect(stats.uniqueSubjects).toBe(0);
    expect(stats.uniquePredicates).toBe(0);
    expect(stats.uniqueObjects).toBe(0);
    expect(stats.totalWeight).toBe(0);
  });

  it("computes correct stats", async () => {
    await addTriple("OdinAgent", "depends_on", "AiEngine");
    await addTriple("OdinAgent", "depends_on", "BudgetGate");
    await addTriple("Brokkr", "depends_on", "AiEngine");
    await addTriple("Mimir", "provides", "Cortex", "memory context", 0.5);

    const stats = await getStats();
    expect(stats.totalTriples).toBe(4);
    expect(stats.uniqueSubjects).toBe(3);
    expect(stats.uniquePredicates).toBe(2);
    expect(stats.uniqueObjects).toBe(3);
    expect(stats.totalWeight).toBeCloseTo(3.5);
    expect(stats.byPredicate["depends_on"]).toBe(3);
    expect(stats.byPredicate["provides"]).toBe(1);
  });
});

describe("Graphify — Path Finding", () => {
  beforeEach(async () => {
    await clearGraph();
  });

  it("finds direct path between two entities", async () => {
    await addTriple("OdinAgent", "depends_on", "AiEngine");
    const paths = await findPath("OdinAgent", "AiEngine");
    expect(paths.length).toBeGreaterThanOrEqual(1);
    expect(paths[0]![0]!.predicate).toBe("depends_on");
  });

  it("finds multi-hop paths", async () => {
    await addTriple("OdinAgent", "depends_on", "AiEngine");
    await addTriple("AiEngine", "uses", "BudgetGate");
    const paths = await findPath("OdinAgent", "BudgetGate");
    expect(paths.length).toBeGreaterThanOrEqual(1);
    expect(paths[0]!.length).toBe(2);
  });

  it("returns empty for unreachable entities", async () => {
    await addTriple("A", "rel", "B");
    const paths = await findPath("A", "Z");
    expect(paths).toHaveLength(0);
  });

  it("respects maxDepth", async () => {
    await addTriple("A", "rel", "B");
    await addTriple("B", "rel", "C");
    await addTriple("C", "rel", "D");
    const paths = await findPath("A", "D", 2);
    expect(paths).toHaveLength(0);
  });
});
