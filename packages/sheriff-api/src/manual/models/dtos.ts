import { z } from 'zod';
import type { PreviewContextResponse } from './manual-preview.models';
import type { TagsByPathRel, ManualConfigOptions } from './manual-config.models';
import type { DepRulesByTag } from '../../core/config-evaluator';

// Request Schemas
export const InitRequestSchema = z.object({
  cwd: z.string().optional(),
  entry: z.string().optional(),
});

export const PreviewRequestSchema = z.object({
  draft: z.string().min(1),
  entry: z.string().min(1),
  cwd: z.string().optional(),
});

export const SaveRequestSchema = z.object({
  draft: z.string().min(1),
  cwd: z.string().optional(),
});

const MutationBaseSchema = z.object({
  draft: z.string().min(1),
  entry: z.string().min(1),
  cwd: z.string().optional(),
});

export const AddTagRequestSchema = MutationBaseSchema.extend({
  pathRel: z.string().min(1),
  tag: z.string().min(1),
});

export const RemoveTagRequestSchema = AddTagRequestSchema;

export const DeleteTagRequestSchema = MutationBaseSchema.extend({
  tag: z.string().min(1),
});

export const ToggleDepRuleRequestSchema = MutationBaseSchema.extend({
  from: z.string().min(1),
  to: z.string().min(1),
});

// Inferred Types from Schemas
export type InitRequestDto = z.infer<typeof InitRequestSchema>;
export type PreviewRequestDto = z.infer<typeof PreviewRequestSchema>;
export type SaveRequestDto = z.infer<typeof SaveRequestSchema>;
export type AddTagRequestDto = z.infer<typeof AddTagRequestSchema>;
export type RemoveTagRequestDto = z.infer<typeof RemoveTagRequestSchema>;
export type DeleteTagRequestDto = z.infer<typeof DeleteTagRequestSchema>;
export type ToggleDepRuleRequestDto = z.infer<typeof ToggleDepRuleRequestSchema>;

export type InitResponseDto = {
  cwd: string;
  entry: string;
  missingConfig: boolean;
  activeConfigContent: string;
  draft: string;
  preview?: PreviewContextResponse;
  availableEntries: string[];
};

export type SaveResponseDto =
  | { ok: true; checksum?: string }
  | { ok: false; errors: string[] };

export type MutationResponseDto = {
  draft: string;
  preview: PreviewContextResponse;
};

export type GenerateRequestDto = {
  baseDraft: string;
  desiredModulesByPathRel: TagsByPathRel;
  inferredModulesByPathRel: TagsByPathRel;
  originalModulesConfig: TagsByPathRel;
  depRules?: Record<string, string[]>;
  depRulesRaw?: DepRulesByTag | null;
  options?: ManualConfigOptions;
};

export type GenerateResponseDto = { draft: string };
