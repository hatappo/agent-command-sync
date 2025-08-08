/**
 * 共通定数の定義
 */

/**
 * Claude Code固有のフィールド名
 */
export const CLAUDE_SPECIFIC_FIELDS = ["allowed-tools", "argument-hint", "model"] as const;
export type ClaudeSpecificField = (typeof CLAUDE_SPECIFIC_FIELDS)[number];

/**
 * プレースホルダー定数
 */
export const PLACEHOLDERS = {
  // Claude形式
  CLAUDE: {
    ARGUMENTS: "$ARGUMENTS",
    SHELL_COMMAND_BACKTICK: /!`([^`]+)`/g,
    SHELL_COMMAND_LINE_START: /^!\s*([^\s{][^\n]*)/gm,
  },
  // Gemini形式
  GEMINI: {
    ARGUMENTS: "{{args}}",
    SHELL_COMMAND: /!\{([^}]+)\}/g,
  },
} as const;

/**
 * ファイル拡張子
 */
export const FILE_EXTENSIONS = {
  CLAUDE: ".md",
  GEMINI: ".toml",
} as const;

/**
 * サポートされるモデル
 */
export const SUPPORTED_MODELS = [
  "sonnet",
  "haiku",
  "opus",
  "claude-3-sonnet",
  "claude-3-haiku",
  "claude-3-opus",
  "claude-2.1",
  "claude-2.0",
  "claude-instant",
] as const;
export type SupportedModel = (typeof SUPPORTED_MODELS)[number];

/**
 * 操作タイプごとのスタイル定義
 */
export interface OperationStyle {
  prefix: string;
  color: (str: string) => string;
}

/**
 * デフォルトのディレクトリパス
 */
export const DEFAULT_PATHS = {
  CLAUDE_BASE: ".claude",
  GEMINI_BASE: ".gemini",
  COMMANDS_DIR: "commands",
} as const;

/**
 * エラーメッセージテンプレート
 */
export const ERROR_MESSAGES = {
  PARSE_ERROR: "Failed to parse file",
  CONVERSION_ERROR: "Failed to convert command",
  FILE_NOT_FOUND: "File not found",
  INVALID_FORMAT: "Invalid file format",
  PERMISSION_DENIED: "Permission denied",
} as const;

/**
 * 危険な文字パターン
 */
export const DANGEROUS_PATTERNS = ["~", ".."] as const;
