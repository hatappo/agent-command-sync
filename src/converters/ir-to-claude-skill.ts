/**
 * Intermediate Representation to Claude Skill converter
 */

import type { ClaudeSkill, FromIntermediateConverter, IntermediateRepresentation, SupportFile } from "../types/index.js";
import { CLAUDE_SKILL_SPECIFIC_FIELDS } from "../utils/constants.js";

export interface IRToClaudeSkillOptions {
  /** Remove fields not supported by Claude */
  removeUnsupported?: boolean;
}

export class IRToClaudeSkillConverter implements FromIntermediateConverter<ClaudeSkill> {
  constructor(private options: IRToClaudeSkillOptions = {}) {}

  /**
   * Convert intermediate representation to Claude skill
   */
  fromIntermediate(ir: IntermediateRepresentation): ClaudeSkill {
    const header = { ...ir.header };
    const skillName = (ir.meta.skillName as string) || "unnamed-skill";
    const supportFiles = (ir.meta.supportFiles as SupportFile[]) || [];

    // Build frontmatter with Claude-specific fields
    const frontmatter: ClaudeSkill["frontmatter"] = {
      name: header.name as string | undefined,
      description: header.description as string | undefined,
      "argument-hint": header["argument-hint"] as string | undefined,
      "disable-model-invocation": header["disable-model-invocation"] as boolean | undefined,
      "user-invocable": header["user-invocable"] as boolean | undefined,
      "allowed-tools": header["allowed-tools"] as string | undefined,
      model: header.model as string | undefined,
      context: header.context as "fork" | string | undefined,
      agent: header.agent as string | undefined,
      hooks: header.hooks as ClaudeSkill["frontmatter"]["hooks"],
    };

    // Copy remaining fields
    for (const [key, value] of Object.entries(header)) {
      if (!(key in frontmatter)) {
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
}
