/**
 * Intermediate Representation to Gemini Skill converter
 */

import type { GeminiSkill, FromIntermediateConverter, IntermediateRepresentation, SupportFile } from "../types/index.js";
import { CLAUDE_SKILL_SPECIFIC_FIELDS } from "../utils/constants.js";

export interface IRToGeminiSkillOptions {
  /** Remove fields not supported by Gemini */
  removeUnsupported?: boolean;
}

export class IRToGeminiSkillConverter implements FromIntermediateConverter<GeminiSkill> {
  constructor(private options: IRToGeminiSkillOptions = {}) {}

  /**
   * Convert intermediate representation to Gemini skill
   */
  fromIntermediate(ir: IntermediateRepresentation): GeminiSkill {
    const header = { ...ir.header };
    const skillName = (ir.meta.skillName as string) || "unnamed-skill";
    const supportFiles = (ir.meta.supportFiles as SupportFile[]) || [];

    // Build frontmatter
    const frontmatter: GeminiSkill["frontmatter"] = {
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
    };
  }

  /**
   * Check if a field is Claude-specific
   */
  private isClaudeSpecificField(key: string): boolean {
    return CLAUDE_SKILL_SPECIFIC_FIELDS.includes(key as (typeof CLAUDE_SKILL_SPECIFIC_FIELDS)[number]);
  }
}
