/**
 * Gemini Skill to Intermediate Representation converter
 */

import type { GeminiSkill, IntermediateRepresentation, ToIntermediateConverter } from "../types/index.js";

export class GeminiSkillToIRConverter implements ToIntermediateConverter<GeminiSkill> {
  /**
   * Convert Gemini skill to intermediate representation
   */
  toIntermediate(source: GeminiSkill): IntermediateRepresentation {
    return {
      contentType: "skill",
      body: source.content,
      header: { ...source.frontmatter },
      meta: {
        sourcePath: source.dirPath,
        sourceType: "gemini",
        supportFiles: source.supportFiles,
        skillName: source.name,
      },
    };
  }
}
