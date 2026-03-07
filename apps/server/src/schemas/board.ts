import { z } from "zod";

// --- BoardColumn ---

export const BoardColumnSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  status_filter: z.array(z.string()).min(1),
  assignee_filter: z.array(z.string()).optional(),
  color: z.string().optional(),
  wip_limit: z.number().int().positive().optional(),
});

export type BoardColumn = z.infer<typeof BoardColumnSchema>;

// --- RoutingRule ---

export const RoutingRuleSchema = z.object({
  condition: z.string().min(1),
  assignee: z.enum(["agent", "human", "pending", "paused"]),
});

export type RoutingRule = z.infer<typeof RoutingRuleSchema>;

// --- BoardConfig ---

export const BoardConfigSchema = z.object({
  project_id: z.string(),
  sprint: z.number().int().positive(),
  columns: z.array(BoardColumnSchema),
  routing_rules: z.array(RoutingRuleSchema),
  updated_at: z.string(),
});

export type BoardConfig = z.infer<typeof BoardConfigSchema>;

export const PatchBoardConfigBody = z.object({
  columns: z.array(BoardColumnSchema).optional(),
  routing_rules: z.array(RoutingRuleSchema).optional(),
});

export type PatchBoardConfigBody = z.infer<typeof PatchBoardConfigBody>;

// --- Default columns (in evaluation order) ---

export const DEFAULT_COLUMNS: BoardColumn[] = [
  {
    id: "a-fazer",
    label: "A fazer",
    status_filter: ["pending"],
    color: "#e0f2fe",
  },
  {
    id: "backlog",
    label: "Backlog",
    status_filter: ["pending", "blocked"],
    color: "#f3f4f6",
  },
  {
    id: "em-progresso",
    label: "Em progresso",
    status_filter: ["in_progress"],
    color: "#fef9c3",
  },
  {
    id: "revisao",
    label: "Revisão",
    status_filter: ["failing"],
    color: "#fee2e2",
  },
  {
    id: "concluido",
    label: "Concluído",
    status_filter: ["passing"],
    color: "#dcfce7",
  },
  {
    id: "pulado",
    label: "Pulado",
    status_filter: ["skipped"],
    color: "#f5f5f5",
  },
];

// --- FeatureBoardMeta ---

export const AssigneeEnum = z.enum(["agent", "human", "pending", "paused"]);
export const PriorityEnum = z.enum(["critical", "high", "medium", "low"]);

export const FeatureBoardMetaSchema = z.object({
  assignee: AssigneeEnum.default("pending"),
  priority: PriorityEnum.default("medium"),
  labels: z.array(z.string()).default([]),
  estimated_cost_usd: z.number().optional(),
  actual_cost_usd: z.number().optional(),
  sprint_column: z.string().optional(),
  linked_handoff_id: z.string().uuid().nullable().optional(),
});

export type FeatureBoardMeta = z.infer<typeof FeatureBoardMetaSchema>;

export const PatchFeatureBoardMetaBody = z.object({
  assignee: AssigneeEnum.optional(),
  priority: PriorityEnum.optional(),
  labels: z.array(z.string()).optional(),
  estimated_cost_usd: z.number().optional(),
  actual_cost_usd: z.number().optional(),
  sprint_column: z.string().optional(),
  linked_handoff_id: z.string().uuid().nullable().optional(),
});

export type PatchFeatureBoardMetaBody = z.infer<typeof PatchFeatureBoardMetaBody>;

// Dict: featureId -> FeatureBoardMeta
export type BoardMetaDict = Record<string, FeatureBoardMeta>;

// --- Board view response types ---

export const PRIORITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export interface FeatureWithMeta {
  id: string;
  name: string;
  description: string;
  status: string;
  priority: number;
  agent: string;
  task: string;
  dependencies: string[];
  tests: string[];
  prp_path?: string;
  completed_at?: string;
  board_meta: FeatureBoardMeta;
}

export interface BoardColumnView extends BoardColumn {
  features: FeatureWithMeta[];
}

export interface BoardView {
  config: BoardConfig;
  columns: BoardColumnView[];
}
