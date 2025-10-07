import type {
  GeminiCommand,
  IntermediateRepresentation,
  ToIntermediateConverter,
} from "../types/index.js";

/**
 * Gemini CLI format to Intermediate Representation converter
 */
export class GeminiToIRConverter implements ToIntermediateConverter<GeminiCommand> {
  /**
   * Convert Gemini command to intermediate representation
   */
  toIntermediate(source: GeminiCommand): IntermediateRepresentation {
    // Extract body content (prompt field)
    const body = source.prompt;

    // Extract header metadata (all fields except prompt)
    const header: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(source)) {
      if (key !== "prompt" && key !== "filePath") {
        header[key] = value;
      }
    }

    // Build meta information
    const meta = {
      sourcePath: source.filePath,
      sourceType: "gemini" as const,
    };

    return {
      body,
      header,
      meta,
    };
  }
}