/**
 * Codex Skill to Intermediate Representation converter
 */

import type { CodexSkill, IntermediateRepresentation, ToIntermediateConverter } from "../types/index.js";

export class CodexSkillToIRConverter implements ToIntermediateConverter<CodexSkill> {
  /**
   * Convert Codex skill to intermediate representation
   */
  toIntermediate(source: CodexSkill): IntermediateRepresentation {
    const header: Record<string, unknown> = { ...source.frontmatter };

    // Convert allow_implicit_invocation to disable-model-invocation (inverted logic)
    // Codex: allow_implicit_invocation: false → Claude: disable-model-invocation: true
    if (source.openaiConfig?.policy?.allow_implicit_invocation === false) {
      header["disable-model-invocation"] = true;
    } else if (source.openaiConfig?.policy?.allow_implicit_invocation === true) {
      header["disable-model-invocation"] = false;
    }

    return {
      contentType: "skill",
      body: source.content,
      header,
      meta: {
        sourcePath: source.dirPath,
        sourceType: "codex",
        supportFiles: source.supportFiles,
        skillName: source.name,
        // Store openaiConfig in meta for potential restoration
        codexOpenAIConfig: source.openaiConfig,
      },
    };
  }
}
