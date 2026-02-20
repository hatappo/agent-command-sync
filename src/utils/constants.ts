/**
 * Common constant definitions
 */

/**
 * File extensions
 */
export const FILE_EXTENSIONS = {
  CLAUDE: ".md",
  GEMINI: ".toml",
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
