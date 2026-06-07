import { z } from "zod";

export const TripleSchema = z.object({
  id: z.string(),
  subject: z.string().min(1),
  predicate: z.string().min(1),
  object: z.string().min(1),
  context: z.string().optional(),
  createdAt: z.date(),
  weight: z.number().min(0).max(1).default(1),
});
export type Triple = z.infer<typeof TripleSchema>;

export const GraphQuerySchema = z.object({
  entity: z.string().optional(),
  predicate: z.string().optional(),
  subject: z.string().optional(),
  object: z.string().optional(),
  limit: z.number().int().positive().default(100),
  offset: z.number().int().nonnegative().default(0),
});
export type GraphQuery = z.infer<typeof GraphQuerySchema>;
export type GraphQueryInput = z.input<typeof GraphQuerySchema>;

export const GraphStatsSchema = z.object({
  totalTriples: z.number().int().nonnegative(),
  uniqueSubjects: z.number().int().nonnegative(),
  uniquePredicates: z.number().int().nonnegative(),
  uniqueObjects: z.number().int().nonnegative(),
  totalWeight: z.number().nonnegative(),
  byPredicate: z.record(z.number().int().nonnegative()),
});
export type GraphStats = z.infer<typeof GraphStatsSchema>;
