/**
 * Command type definitions for each agent format
 */

/**
 * Claude Code command format
 */
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

/**
 * Gemini CLI command format
 */
export interface GeminiCommand {
  description?: string;
  prompt: string;
  filePath: string;
  /** Extended fields to preserve Claude-specific fields */
  [key: string]: unknown;
}

/**
 * Codex CLI command format
 */
export interface CodexCommand {
  frontmatter?: Record<string, unknown>;
  content: string;
  filePath: string;
}
