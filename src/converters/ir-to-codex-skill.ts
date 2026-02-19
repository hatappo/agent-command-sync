/**
 * Intermediate Representation to Codex Skill converter
 */

import type {
  CodexSkill,
  CodexOpenAIConfig,
  FromIntermediateConverter,
  IntermediateRepresentation,
  SupportFile,
} from "../types/index.js";
import { CLAUDE_SKILL_SPECIFIC_FIELDS } from "../utils/constants.js";

export interface IRToCodexSkillOptions {
  /** Remove fields not supported by Codex */
  removeUnsupported?: boolean;
}

export class IRToCodexSkillConverter implements FromIntermediateConverter<CodexSkill> {
  constructor(private options: IRToCodexSkillOptions = {}) {}

  /**
   * Convert intermediate representation to Codex skill
   */
  fromIntermediate(ir: IntermediateRepresentation): CodexSkill {
    const header = { ...ir.header };
    const skillName = (ir.meta.skillName as string) || "unnamed-skill";
    const supportFiles = (ir.meta.supportFiles as SupportFile[]) || [];

    // Restore openaiConfig from meta if present, or create new one
    let openaiConfig = ir.meta.codexOpenAIConfig as CodexOpenAIConfig | undefined;

    // Convert disable-model-invocation to allow_implicit_invocation (inverted logic)
    // Claude: disable-model-invocation: true → Codex: allow_implicit_invocation: false
    const disableModelInvocation = header["disable-model-invocation"];
    if (typeof disableModelInvocation === "boolean") {
      if (!openaiConfig) {
        openaiConfig = {};
      }
      if (!openaiConfig.policy) {
        openaiConfig.policy = {};
      }
      openaiConfig.policy.allow_implicit_invocation = !disableModelInvocation;
    }

    // Build frontmatter
    const frontmatter: CodexSkill["frontmatter"] = {
      name: header.name as string | undefined,
      description: header.description as string | undefined,
    };

    // Copy remaining fields, optionally removing Claude-specific ones
    for (const [key, value] of Object.entries(header)) {
      if (key === "name" || key === "description") {
        continue; // Already handled
      }

      // Skip Claude-specific fields if removeUnsupported is true
      if (this.options.removeUnsupported && this.isClaudeSpecificField(key)) {
        continue;
      }

      // Preserve Claude-specific fields with prefix if not removing
      if (this.isClaudeSpecificField(key) && !this.options.removeUnsupported) {
        frontmatter[`_claude_${key.replace(/-/g, "_")}`] = value;
      } else {
        frontmatter[key] = value;
      }
    }

    return {
      name: skillName,
      description: frontmatter.description,
      content: ir.body,
      dirPath: (ir.meta.sourcePath as string) || "",
      supportFiles,
      frontmatter,
      openaiConfig,
    };
  }

  /**
   * Check if a field is Claude-specific
   */
  private isClaudeSpecificField(key: string): boolean {
    return CLAUDE_SKILL_SPECIFIC_FIELDS.includes(key as (typeof CLAUDE_SKILL_SPECIFIC_FIELDS)[number]);
  }
}
