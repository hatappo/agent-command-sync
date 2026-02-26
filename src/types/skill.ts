/**
 * Skill type definitions for Agent Skills standard
 * https://agentskills.io
 */

/**
 * Support file information
 */
export interface SupportFile {
  /** Relative path from skill directory */
  relativePath: string;
  /** File type classification */
  type: "text" | "binary" | "config";
  /** Content for text files (undefined for binary) */
  content?: string;
}

/**
 * Common skill base interface
 */
export interface SkillBase {
  /** Skill name (derived from directory name) */
  name: string;
  /** Skill description */
  description?: string;
  /** Main content/instructions */
  content: string;
  /** Directory path */
  dirPath: string;
  /** Support files in the skill directory */
  supportFiles: SupportFile[];
}

/**
 * Claude Code skill format
 */
export interface ClaudeSkill extends SkillBase {
  frontmatter: {
    name?: string;
    description?: string;
    "argument-hint"?: string;
    "disable-model-invocation"?: boolean;
    "user-invocable"?: boolean;
    "allowed-tools"?: string;
    model?: string;
    /** Fork context for subagent execution */
    context?: "fork" | string;
    /** Agent type when context is fork */
    agent?: string;
    /** Hooks scoped to this skill */
    hooks?: ClaudeSkillHooks;
    [key: string]: unknown;
  };
}

/**
 * Claude skill hooks configuration
 */
export interface ClaudeSkillHooks {
  "pre-tool-execution"?: string;
  "post-tool-execution"?: string;
  "pre-message"?: string;
  "post-message"?: string;
}

/**
 * Gemini CLI skill format (Agent Skills standard)
 */
export interface GeminiSkill extends SkillBase {
  frontmatter: {
    name?: string;
    description?: string;
    [key: string]: unknown;
  };
}

/**
 * Codex CLI skill format
 */
export interface CodexSkill extends SkillBase {
  frontmatter: {
    name?: string;
    description?: string;
    [key: string]: unknown;
  };
  /** Codex-specific openai.yaml configuration */
  openaiConfig?: CodexOpenAIConfig;
}

/**
 * Codex agents/openai.yaml configuration
 */
export interface CodexOpenAIConfig {
  interface?: {
    display_name?: string;
    short_description?: string;
    icon_small?: string;
    icon_large?: string;
    brand_color?: string;
    default_prompt?: string;
  };
  policy?: {
    allow_implicit_invocation?: boolean;
  };
  dependencies?: {
    tools?: Array<{
      type?: string;
      value?: string;
      description?: string;
      transport?: string;
      url?: string;
    }>;
  };
  [key: string]: unknown;
}

/**
 * OpenCode skill format
 */
export interface OpenCodeSkill extends SkillBase {
  frontmatter: {
    name?: string;
    description?: string;
    [key: string]: unknown;
  };
}

/**
 * GitHub Copilot skill format
 */
export interface CopilotSkill extends SkillBase {
  frontmatter: {
    name?: string;
    description?: string;
    "argument-hint"?: string;
    "user-invokable"?: boolean;
    "disable-model-invocation"?: boolean;
    [key: string]: unknown;
  };
}

/**
 * Cursor skill format (agentskills.io standard)
 */
export interface CursorSkill extends SkillBase {
  frontmatter: {
    name?: string;
    description?: string;
    "allowed-tools"?: string;
    "user-invocable"?: boolean;
    "disable-model-invocation"?: boolean;
    [key: string]: unknown;
  };
}

/**
 * Chimera Hub skill format (internally a virtual agent, Claude-based with _chimera extras)
 */
export interface ChimeraSkill extends SkillBase {
  frontmatter: {
    name?: string;
    description?: string;
    "disable-model-invocation"?: boolean;
    _chimera?: Record<string, Record<string, unknown>>;
    [key: string]: unknown;
  };
}

/**
 * Content type for commands and skills
 */
export type ContentType = "command" | "skill";

/**
 * Content filter for CLI options
 */
export type ContentFilter = "commands" | "skills" | "both";
