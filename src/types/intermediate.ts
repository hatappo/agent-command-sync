/**
 * Intermediate Representation types
 * Retains ProductType and IntermediateConversionOptions used by CLI
 */

import type { ContentFilter } from "./skill.js";

/**
 * Supported product types (single source of truth)
 */
export const PRODUCT_TYPES = ["claude", "gemini", "codex", "opencode", "copilot"] as const;
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
  /** Content type filter: commands, skills, or both (default: both) */
  contentType: ContentFilter;
}
