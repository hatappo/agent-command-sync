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
    FILE_REFERENCE: /@([^\s{}\[\]()<>]+(?:\.[a-zA-Z0-9]+)?)/g,
  },
  // Gemini format
  GEMINI: {
    ARGUMENTS: "{{args}}",
    SHELL_COMMAND: /!\{([^}]+)\}/g,
    FILE_REFERENCE: /@\{([^}]+)\}/g,
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
  CODEX_BASE: ".codex",
  COMMANDS_DIR: "commands",
  SKILLS_DIR: "skills",
  CODEX_PROMPTS_DIR: "prompts",
} as const;

/**
 * Skill file constants
 */
export const SKILL_CONSTANTS = {
  /** Main skill definition file */
  SKILL_FILE_NAME: "SKILL.md",
  /** Codex-specific config file */
  CODEX_CONFIG_DIR: "agents",
  CODEX_CONFIG_FILE: "openai.yaml",
} as const;

/**
 * Binary file extensions (copied as-is, not processed)
 */
export const BINARY_EXTENSIONS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".svg",
  ".pdf",
  ".zip",
  ".tar",
  ".gz",
  ".mp3",
  ".mp4",
  ".wav",
  ".webm",
] as const;

/**
 * Config file names (require special handling)
 */
export const CONFIG_FILES = ["openai.yaml", "config.yaml", "config.json", "config.toml"] as const;

/**
 * Claude-specific skill fields (not supported in other tools)
 */
export const CLAUDE_SKILL_SPECIFIC_FIELDS = [
  "context",
  "agent",
  "hooks",
  "disable-model-invocation",
  "user-invocable",
  ...CLAUDE_SPECIFIC_FIELDS,
] as const;

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
