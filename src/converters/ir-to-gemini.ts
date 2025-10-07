import type {
  FromIntermediateConverter,
  GeminiCommand,
  IntermediateRepresentation,
} from "../types/index.js";
import { FILE_EXTENSIONS } from "../utils/constants.js";

/**
 * Intermediate Representation to Gemini CLI format converter
 */
export class IRToGeminiConverter implements FromIntermediateConverter<GeminiCommand> {
  /**
   * Convert intermediate representation to Gemini command
   */
  fromIntermediate(ir: IntermediateRepresentation): GeminiCommand {
    // Build Gemini command with prompt
    const result: GeminiCommand = {
      prompt: ir.body,
      filePath: "",
    };

    // Map description if exists
    if (ir.header.description !== undefined) {
      result.description = String(ir.header.description);
    }

    // Add other fields from header (excluding Claude-specific ones if needed)
    for (const [key, value] of Object.entries(ir.header)) {
      if (key !== "description") {
        // Gemini doesn't support some Claude-specific fields
        // But we can keep them as additional fields unless removeUnsupported is true
        result[key] = value;
      }
    }

    // Generate file path
    let filePath = ir.meta.sourcePath || "";

    // Convert file extension to .toml if necessary
    if (!filePath.endsWith(FILE_EXTENSIONS.GEMINI)) {
      filePath = filePath.replace(/\.[^.]+$/, FILE_EXTENSIONS.GEMINI);
    }

    result.filePath = filePath;

    return result;
  }
}