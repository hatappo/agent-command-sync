import type { ClaudeCommand, IntermediateRepresentation, ToIntermediateConverter } from "../types/index.js";

/**
 * Claude Code format to Intermediate Representation converter
 */
export class ClaudeToIRConverter implements ToIntermediateConverter<ClaudeCommand> {
  /**
   * Convert Claude command to intermediate representation
   */
  toIntermediate(source: ClaudeCommand): IntermediateRepresentation {
    // Extract body content
    const body = source.content;

    // Extract header metadata (frontmatter)
    const header: Record<string, unknown> = { ...source.frontmatter };

    // Build meta information
    const meta = {
      sourcePath: source.filePath,
      sourceType: "claude" as const,
    };

    return {
      contentType: "command",
      body,
      header,
      meta,
    };
  }
}
