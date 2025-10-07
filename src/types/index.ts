// 共通のコマンド表現
export interface Command {
  name: string;
  description?: string;
  prompt: string;
  metadata?: Record<string, unknown>;
}

// Claude Code形式
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

// Gemini CLI形式
export interface GeminiCommand {
  description?: string;
  prompt: string;
  filePath: string;
  // Claude固有フィールドを保持するための拡張フィールド
  [key: string]: unknown;
}

// 変換オプション
export interface ConversionOptions {
  direction: "c2g" | "g2c";
  removeUnsupported: boolean;
  noOverwrite: boolean;
  syncDelete: boolean;
  file?: string;
  dryRun: boolean;
  verbose: boolean;
  claudeDir?: string;
  geminiDir?: string;
}

// ファイル操作結果
export interface FileOperation {
  type: "A" | "M" | "D" | "-";
  filePath: string;
  description: string;
}

// エラー型
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

// 変換結果
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

// パーサーインターフェース
export interface Parser<T> {
  parse(filePath: string): Promise<T>;
  validate(data: T): boolean;
}

// コンバーターインターフェース
export interface Converter<TSource, TTarget> {
  convert(source: TSource, options: ConversionOptions): TTarget;
}

// バリデーション関数の型
export type ValidationFunction<T> = (data: T) => ValidationError[];

// ファイル検索オプション
export interface FileSearchOptions {
  extensions: string[];
  directories: string[];
  recursive: boolean;
  excludePatterns?: string[];
}

// コマンドディレクトリの設定
export interface CommandDirectories {
  claude: {
    project: string;
    user: string;
  };
  gemini: {
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
