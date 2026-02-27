/**
 * Semantic Intermediate Representation for command/skill conversion
 * Only properties shared across 2+ agents are semantic properties.
 * Agent-specific and other non-semantic properties go to extras.
 */

import type { BodySegment } from "./body-segment.js";
import type { ProductType } from "./intermediate.js";
import type { ContentType, SupportFile } from "./skill.js";

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
  /** Provenance tracking: most recent source origin (owner/repo) */
  from?: string;
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
 * Options for toIR/fromIR conversion
 */
export interface ConverterOptions {
  removeUnsupported?: boolean;
  /** toIR: destination agent type (chimera uses this to select _chimera.{target} extras) */
  destinationType?: ProductType;
  /** fromIR: existing target data for merge (chimera uses this to preserve other agents' extras) */
  existingTarget?: unknown;
}
