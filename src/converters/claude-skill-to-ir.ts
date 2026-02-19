/**
 * Claude Skill to Intermediate Representation converter
 */

import type { ClaudeSkill, IntermediateRepresentation, ToIntermediateConverter } from "../types/index.js";

export class ClaudeSkillToIRConverter implements ToIntermediateConverter<ClaudeSkill> {
  /**
   * Convert Claude skill to intermediate representation
   */
  toIntermediate(source: ClaudeSkill): IntermediateRepresentation {
    return {
      contentType: "skill",
      body: source.content,
      header: { ...source.frontmatter },
      meta: {
        sourcePath: source.dirPath,
        sourceType: "claude",
        supportFiles: source.supportFiles,
        skillName: source.name,
      },
    };
  }
}
