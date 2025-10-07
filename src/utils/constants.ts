/**
 * Common constant definitions
 */

/**
 * Claude Code specific field names
 */
export const CLAUDE_SPECIFIC_FIELDS = ["allowed-tools", "argument-hint", "model"] as const;
export type ClaudeSpecificField = (typeof CLAUDE_SPECIFIC_FIELDS)[number];

/**
 * Placeholder constants
 */
export const PLACEHOLDERS = {
  // Claude format
  CLAUDE: {
    ARGUMENTS: "$ARGUMENTS",
    SHELL_COMMAND_BACKTICK: /!`([^`]+)`/g,
    SHELL_COMMAND_LINE_START: /^!\s*([^\s{][^\n]*)/gm,
  },
  // Gemini format
  GEMINI: {
    ARGUMENTS: "{{args}}",
    SHELL_COMMAND: /!\{([^}]+)\}/g,
  },
} as const;

/**
 * File extensions
 */
export const FILE_EXTENSIONS = {
  CLAUDE: ".md",
  GEMINI: ".toml",
} as const;

/**
 * Supported models
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
 * Style definitions for each operation type
 */
export interface OperationStyle {
  prefix: string;
  color: (str: string) => string;
}

/**
 * Default directory paths
 */
export const DEFAULT_PATHS = {
  CLAUDE_BASE: ".claude",
  GEMINI_BASE: ".gemini",
  COMMANDS_DIR: "commands",
} as const;

/**
 * Error message templates
 */
export const ERROR_MESSAGES = {
  PARSE_ERROR: "Failed to parse file",
  CONVERSION_ERROR: "Failed to convert command",
  FILE_NOT_FOUND: "File not found",
  INVALID_FORMAT: "Invalid file format",
  PERMISSION_DENIED: "Permission denied",
} as const;

/**
 * Dangerous character patterns
 */
export const DANGEROUS_PATTERNS = ["~", ".."] as const;
