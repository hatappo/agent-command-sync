/**
 * Intermediate Representation types
 * Retains ProductType and IntermediateConversionOptions used by CLI
 */

import type { ContentFilter } from "./skill.js";

/**
 * Supported product types
 */
export type ProductType = "claude" | "gemini" | "codex" | "opencode";

/**
 * Options for conversion via intermediate representation
 */
export interface IntermediateConversionOptions {
  /** Source product type */
  source: ProductType;
  /** Destination product type */
  destination: ProductType;
  /** Remove fields not supported by target format */
  removeUnsupported: boolean;
  /** Skip existing files in target directory */
  noOverwrite: boolean;
  /** Delete orphaned files in target directory */
  syncDelete: boolean;
  /** Convert only specific file or skill */
  file?: string;
  /** Preview changes without applying */
  noop: boolean;
  /** Show detailed debug information */
  verbose: boolean;
  /** Claude base directory */
  claudeDir?: string;
  /** Gemini base directory */
  geminiDir?: string;
  /** Codex base directory */
  codexDir?: string;
  /** OpenCode base directory */
  opencodeDir?: string;
  /** Content type filter: commands, skills, or both (default: both) */
  contentType: ContentFilter;
}
