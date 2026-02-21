// Conversion options
export interface ConversionOptions {
  direction: "c2g" | "g2c";
  removeUnsupported: boolean;
  noOverwrite: boolean;
  syncDelete: boolean;
  file?: string;
  noop: boolean;
  verbose: boolean;
  claudeDir?: string;
  geminiDir?: string;
}

// File operation result
export interface FileOperation {
  type: "A" | "M" | "D" | "-";
  filePath: string;
  description: string;
}

// Error types
export class ParseError extends Error {
  constructor(
    message: string,
    public filePath: string,
    public cause?: Error,
  ) {
    super(message);
    this.name = "ParseError";
  }
}

export class ConversionError extends Error {
  constructor(
    message: string,
    public sourceFile: string,
    public targetFile?: string,
    public cause?: Error,
  ) {
    super(message);
    this.name = "ConversionError";
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public field: string,
    public value?: unknown,
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

// Conversion result
export interface ConversionResult {
  success: boolean;
  operations: FileOperation[];
  errors: Error[];
  summary: {
    processed: number;
    created: number;
    modified: number;
    deleted: number;
    skipped: number;
  };
}

// Parser interface
export interface Parser<T> {
  parse(filePath: string): Promise<T>;
  validate(data: T): boolean;
}

// Converter interface
export interface Converter<TSource, TTarget> {
  convert(source: TSource, options: ConversionOptions): TTarget;
}

// Validation function type
export type ValidationFunction<T> = (data: T) => ValidationError[];

// File search options
export interface FileSearchOptions {
  extensions: string[];
  directories: string[];
  recursive: boolean;
  excludePatterns?: string[];
}

// Re-export body segment types
export type { BodySegment, ContentPlaceholder, PatternDef, PlaceholderSerializers } from "./body-segment.js";

// Re-export command types
export type { ClaudeCommand, GeminiCommand, CodexCommand, OpenCodeCommand } from "./command.js";

// Re-export intermediate representation types
export { PRODUCT_TYPES } from "./intermediate.js";
export type {
  ProductType,
  IntermediateConversionOptions,
} from "./intermediate.js";

// Re-export skill types
export type {
  SkillBase,
  SupportFile,
  ClaudeSkill,
  ClaudeSkillHooks,
  GeminiSkill,
  CodexSkill,
  CodexOpenAIConfig,
  OpenCodeSkill,
  ContentType as IRContentType,
  ContentFilter,
} from "./skill.js";

// Re-export semantic IR types
export type {
  SemanticIR,
  SemanticProperties,
  SemanticMeta,
  ConverterOptions,
  SemanticConverter,
} from "./semantic-ir.js";
