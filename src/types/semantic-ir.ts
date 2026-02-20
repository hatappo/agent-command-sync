/**
 * Semantic Intermediate Representation for command/skill conversion
 * Only properties shared across 2+ agents are semantic properties.
 * Agent-specific and other non-semantic properties go to extras.
 */

import type { BodySegment } from "./body-segment.js";
import type { ContentType, SupportFile } from "./skill.js";
import type { ProductType } from "./intermediate.js";

/**
 * Semantic properties shared across 2+ agents
 */
export interface SemanticProperties {
  /** Shared by all agents */
  description?: string;
  /** Shared by all agents (skills only) */
  name?: string;
  /** Claude: !disable-model-invocation, Codex: allow_implicit_invocation */
  modelInvocationEnabled?: boolean;
}

/**
 * Conversion context metadata (not content data)
 */
export interface SemanticMeta {
  sourcePath?: string;
  sourceType?: ProductType;
  supportFiles?: SupportFile[];
  skillName?: string;
}

/**
 * Semantic Intermediate Representation
 */
export interface SemanticIR {
  contentType: ContentType;
  body: BodySegment[];
  semantic: SemanticProperties;
  extras: Record<string, unknown>;
  meta: SemanticMeta;
}

/**
 * Options for fromIR conversion
 */
export interface ConverterOptions {
  removeUnsupported?: boolean;
}

/**
 * Bidirectional converter interface using SemanticIR
 */
export interface SemanticConverter<TFormat> {
  toIR(source: TFormat): SemanticIR;
  fromIR(ir: SemanticIR, options?: ConverterOptions): TFormat;
}
