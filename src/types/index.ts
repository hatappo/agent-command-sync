// Common command representation
export interface Command {
  name: string;
  description?: string;
  prompt: string;
  metadata?: Record<string, unknown>;
}

// Claude Code format
export interface ClaudeCommand {
  frontmatter: {
    "allowed-tools"?: string;
    "argument-hint"?: string;
    description?: string;
    model?: string;
    [key: string]: unknown;
  };
  content: string;
  filePath: string;
}

// Gemini CLI format
export interface GeminiCommand {
  description?: string;
  prompt: string;
  filePath: string;
  // Extended fields to preserve Claude-specific fields
  [key: string]: unknown;
}

// Codex CLI format
export interface CodexCommand {
  frontmatter?: Record<string, unknown>;
  content: string;
  filePath: string;
}

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

// Command directory configuration
export interface CommandDirectories {
  claude: {
    project: string;
    user: string;
  };
  gemini: {
    project: string;
    user: string;
  };
  codex: {
    project: string;
    user: string;
  };
}

// Re-export intermediate representation types
export type {
  IntermediateRepresentation,
  ProductType,
  ToIntermediateConverter,
  FromIntermediateConverter,
  BidirectionalConverter,
  IntermediateConversionOptions,
} from "./intermediate.js";
export { validateIntermediateRepresentation } from "./intermediate.js";

// Re-export skill types
export type {
  SkillBase,
  SupportFile,
  ClaudeSkill,
  ClaudeSkillHooks,
  GeminiSkill,
  CodexSkill,
  CodexOpenAIConfig,
  ContentType as IRContentType,
  ContentFilter,
} from "./skill.js";
