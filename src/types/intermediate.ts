/**
 * Intermediate Representation types
 * Retains ProductType and IntermediateConversionOptions used by CLI
 */

import type { ContentFilter } from "./skill.js";

/**
 * Supported product types (single source of truth)
 */
export const PRODUCT_TYPES = ["claude", "gemini", "codex", "opencode", "copilot", "cursor", "chimera"] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

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
  /** Custom base directories per product type */
  customDirs?: Partial<Record<ProductType, string>>;
  /** Content type filter: skills, commands, or both (default: skills) */
  contentType: ContentFilter;
  /** Force user-level (global) directories instead of project-level */
  global: boolean;
  /** Git repository root path (null if not in a git repo). Resolved at CLI startup. */
  gitRoot?: string | null;
}
