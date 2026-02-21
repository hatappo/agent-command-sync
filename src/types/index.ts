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

// Validation function type
export type ValidationFunction<T> = (data: T) => ValidationError[];

// File search options
export interface FileSearchOptions {
  extensions: string[];
  directories: string[];
  recursive: boolean;
  excludePatterns?: string[];
}

// Wildcard re-exports (new types are automatically included)
export * from "./body-segment.js";
export * from "./command.js";
export * from "./intermediate.js";
export * from "./skill.js";
export * from "./semantic-ir.js";

// Backward-compatible alias
export type { ContentType as IRContentType } from "./skill.js";
