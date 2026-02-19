import type { CodexCommand, IntermediateRepresentation, ToIntermediateConverter } from "../types/index.js";

/**
 * Codex CLI to Intermediate Representation converter
 */
export class CodexToIRConverter implements ToIntermediateConverter<CodexCommand> {
  /**
   * Convert Codex command to intermediate representation
   */
  toIntermediate(source: CodexCommand): IntermediateRepresentation {
    return {
      contentType: "command",
      body: source.content,
      header: source.frontmatter || {}, // Extract frontmatter if present
      meta: {
        sourcePath: source.filePath,
        sourceType: "codex",
      },
    };
  }
}
