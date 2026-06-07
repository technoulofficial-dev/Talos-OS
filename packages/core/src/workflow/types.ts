import { z } from "zod";

export const WorkflowNodeTypeSchema = z.enum([
  "agent",
  "council",
  "plugin",
  "condition",
  "parallel",
  "loop",
  "http",
  "code",
  "sub_workflow",
  "graphify",
]);
export type WorkflowNodeType = z.infer<typeof WorkflowNodeTypeSchema>;

export const NodeStateSchema = z.enum([
  "pending",
  "running",
  "completed",
  "failed",
  "skipped",
]);
export type NodeState = z.infer<typeof NodeStateSchema>;

export const WorkflowStateSchema = z.enum([
  "draft",
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
]);
export type WorkflowState = z.infer<typeof WorkflowStateSchema>;

export const WorkflowNodeConfigSchema = z
  .object({
    agentId: z.string().optional(),
    prompt: z.string().optional(),
    proposal: z
      .object({
        title: z.string().min(1),
        description: z.string().min(1),
        priority: z.enum(["low", "normal", "high", "critical"]).default("normal"),
        context: z.string().optional(),
      })
      .optional(),
    endpointId: z.string().optional(),
    tool: z.string().optional(),
    args: z.record(z.unknown()).default({}),
    expression: z.string().optional(),
    branches: z.number().int().positive().default(2),
    iterSource: z.string().optional(),
    maxIterations: z.number().int().positive().default(10),
    method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH"]).default("GET"),
    url: z.string().url().optional(),
    headers: z.record(z.string()).default({}),
    body: z.unknown().optional(),
    code: z.string().optional(),
    language: z.string().default("javascript"),
    subWorkflowId: z.string().optional(),
    passThrough: z.record(z.unknown()).default({}),
    graphifyEntity: z.string().optional(),
    graphifyPredicate: z.string().optional(),
    graphifyLimit: z.number().int().positive().default(10),
    graphifyAction: z.enum(["query", "add"]).default("query"),
  })
  .strict();
export type WorkflowNodeConfig = z.infer<typeof WorkflowNodeConfigSchema>;

export const WorkflowNodeSchema = z.object({
  id: z.string().min(1),
  type: WorkflowNodeTypeSchema,
  name: z.string().min(1),
  config: WorkflowNodeConfigSchema,
  dependsOn: z.array(z.string()).default([]),
  timeoutMs: z.number().int().positive().default(30000),
  retryOn: z.array(z.enum(["timeout", "error"])).default(["error"]),
  maxRetries: z.number().int().nonnegative().default(0),
});
export type WorkflowNode = z.infer<typeof WorkflowNodeSchema>;

export const WorkflowDefinitionSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  description: z.string().default(""),
  version: z.string().default("1.0.0"),
  nodes: z.array(WorkflowNodeSchema).min(1),
  variables: z.record(z.unknown()).default({}),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type WorkflowDefinition = z.infer<typeof WorkflowDefinitionSchema>;

export const NodeRunStateSchema = z.object({
  nodeId: z.string(),
  state: NodeStateSchema,
  startedAt: z.date().optional(),
  completedAt: z.date().optional(),
  attempts: z.number().int().nonnegative().default(0),
  output: z.unknown().optional(),
  error: z.string().optional(),
  durationMs: z.number().int().nonnegative().default(0),
});
export type NodeRunState = z.infer<typeof NodeRunStateSchema>;

export const WorkflowRunSchema = z.object({
  runId: z.string(),
  workflowId: z.string(),
  workflowName: z.string(),
  state: WorkflowStateSchema,
  startedAt: z.date(),
  completedAt: z.date().optional(),
  nodes: z.array(NodeRunStateSchema),
  variables: z.record(z.unknown()).default({}),
  error: z.string().optional(),
  triggeredBy: z.string().default("api"),
});
export type WorkflowRun = z.infer<typeof WorkflowRunSchema>;

export const CreateWorkflowInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(""),
  nodes: z.array(WorkflowNodeSchema).min(1),
  variables: z.record(z.unknown()).default({}),
});
export type CreateWorkflowInput = z.infer<typeof CreateWorkflowInputSchema>;

export const RunWorkflowInputSchema = z.object({
  variables: z.record(z.unknown()).default({}),
  triggeredBy: z.string().default("api"),
});
export type RunWorkflowInput = z.infer<typeof RunWorkflowInputSchema>;

export const ValidationIssueSchema = z.object({
  code: z.enum(["duplicate_node_id", "unknown_dependency", "cycle", "missing_required_config", "empty_workflow"]),
  message: z.string(),
  nodeIds: z.array(z.string()).default([]),
});
export type ValidationIssue = z.infer<typeof ValidationIssueSchema>;

export interface WorkflowValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}
