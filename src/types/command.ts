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

/**
 * OpenCode command format
 */
export interface OpenCodeCommand {
  frontmatter?: Record<string, unknown>;
  content: string;
  filePath: string;
}

/**
 * GitHub Copilot command format (.prompt.md)
 */
export interface CopilotCommand {
  frontmatter: {
    description?: string;
    name?: string;
    "argument-hint"?: string;
    agent?: string;
    model?: string;
    tools?: string[];
    [key: string]: unknown;
  };
  content: string;
  filePath: string;
}

/**
 * Cursor command format (plain Markdown, no frontmatter)
 */
export interface CursorCommand {
  content: string;
  filePath: string;
}

/**
 * Chimera virtual agent command format (Claude-based with _chimera extras)
 */
export interface ChimeraCommand {
  frontmatter: {
    description?: string;
    _chimera?: Record<string, Record<string, unknown>>;
    [key: string]: unknown;
  };
  content: string;
  filePath: string;
}
