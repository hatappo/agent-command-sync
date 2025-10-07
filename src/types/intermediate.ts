/**
 * Intermediate Representation for command conversion between different AI tools
 * This provides a common format for bidirectional conversion
 */

/**
 * Supported product types
 */
export type ProductType = "claude" | "gemini" | "codex";

/**
 * Intermediate representation of a command
 * Used as a common format for conversion between different AI tools
 */
export interface IntermediateRepresentation {
  /**
   * The main content/prompt body
   * - Claude: Markdown content
   * - Gemini: TOML prompt field value
   */
  body: string;

  /**
   * Metadata from the source format
   * - Claude: Frontmatter fields
   * - Gemini: TOML fields except 'prompt'
   */
  header: Record<string, unknown>;

  /**
   * Additional metadata for conversion context
   */
  meta: {
    /** Source file path */
    sourcePath?: string;
    /** Source product type */
    sourceType?: ProductType;
    /** Target product type */
    targetType?: ProductType;
    /** Additional metadata */
    [key: string]: unknown;
  };
}

/**
 * Converter interface from source format to intermediate representation
 */
export interface ToIntermediateConverter<TSource> {
  /**
   * Convert from source format to intermediate representation
   */
  toIntermediate(source: TSource): IntermediateRepresentation;
}

/**
 * Converter interface from intermediate representation to target format
 */
export interface FromIntermediateConverter<TTarget> {
  /**
   * Convert from intermediate representation to target format
   */
  fromIntermediate(ir: IntermediateRepresentation): TTarget;
}

/**
 * Full converter interface supporting bidirectional conversion
 */
export interface BidirectionalConverter<TFormat>
  extends ToIntermediateConverter<TFormat>,
          FromIntermediateConverter<TFormat> {}

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
  /** Convert only specific file */
  file?: string;
  /** Preview changes without applying */
  dryRun: boolean;
  /** Show detailed debug information */
  verbose: boolean;
  /** Claude base directory */
  claudeDir?: string;
  /** Gemini base directory */
  geminiDir?: string;
}

/**
 * Validate intermediate representation
 */
export function validateIntermediateRepresentation(ir: unknown): ir is IntermediateRepresentation {
  if (typeof ir !== "object" || ir === null) {
    return false;
  }

  const obj = ir as Record<string, unknown>;

  return (
    typeof obj.body === "string" &&
    typeof obj.header === "object" &&
    obj.header !== null &&
    typeof obj.meta === "object" &&
    obj.meta !== null
  );
}