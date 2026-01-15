import { z } from 'zod/v4';

/** Zod schema for RegExpLiteral AST node */
export const RegExpLiteralSchema = z.object({
  kind: z.literal('regex'),
  pattern: z.string(),
  flags: z.string(),
});

export type RegExpLiteral = z.infer<typeof RegExpLiteralSchema>;

export const EncapsulationPatternSchema = z.union([z.string(), RegExpLiteralSchema]);

export type EncapsulationPattern = z.infer<typeof EncapsulationPatternSchema>;

/** Zod schema for FunctionDepRule-like structure in config options */
export const FunctionDepRuleLikeSchema = z.object({ kind: z.literal('function'), source: z.string() });

export const IgnoreFileExtensionsSchema = z.union([
  z.array(z.string()),
  FunctionDepRuleLikeSchema,
]);

export type IgnoreFileExtensions = z.infer<typeof IgnoreFileExtensionsSchema>;

export const ManualConfigOptionsSchema = z.object({
  version: z.number().optional(),
  autoTagging: z.boolean().optional(),
  excludeRoot: z.boolean().optional(),
  barrelFileName: z.string().optional(),
  enableBarrelLess: z.boolean().optional(),
  encapsulationPattern: EncapsulationPatternSchema.optional(),
  log: z.boolean().optional(),
  entryFile: z.string().optional(),
  entryPoints: z.record(z.string(), z.string()).optional(),
  ignoreFileExtensions: IgnoreFileExtensionsSchema.optional(),
});

export type ManualConfigOptions = z.infer<typeof ManualConfigOptionsSchema>;

export type TagsByPathRel = Record<string, string[]>;
