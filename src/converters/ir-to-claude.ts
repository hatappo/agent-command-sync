import type {
  ClaudeCommand,
  FromIntermediateConverter,
  IntermediateRepresentation,
} from "../types/index.js";
import { FILE_EXTENSIONS } from "../utils/constants.js";

/**
 * Intermediate Representation to Claude Code format converter
 */
export class IRToClaudeConverter implements FromIntermediateConverter<ClaudeCommand> {
  /**
   * Convert intermediate representation to Claude command
   */
  fromIntermediate(ir: IntermediateRepresentation): ClaudeCommand {
    // Build frontmatter from header
    const frontmatter: ClaudeCommand["frontmatter"] = {};

    // Map common fields
    if (ir.header.description !== undefined) {
      frontmatter.description = String(ir.header.description);
    }
    if (ir.header["allowed-tools"] !== undefined) {
      frontmatter["allowed-tools"] = String(ir.header["allowed-tools"]);
    }
    if (ir.header["argument-hint"] !== undefined) {
      frontmatter["argument-hint"] = String(ir.header["argument-hint"]);
    }
    if (ir.header.model !== undefined) {
      frontmatter.model = String(ir.header.model);
    }

    // Add any other fields from header
    for (const [key, value] of Object.entries(ir.header)) {
      if (!["description", "allowed-tools", "argument-hint", "model", "prompt"].includes(key)) {
        frontmatter[key] = value;
      }
    }

    // Generate file path
    let filePath = ir.meta.sourcePath || "";

    // Convert file extension to .md if necessary
    if (!filePath.endsWith(FILE_EXTENSIONS.CLAUDE)) {
      filePath = filePath.replace(/\.[^.]+$/, FILE_EXTENSIONS.CLAUDE);
    }

    return {
      frontmatter,
      content: ir.body,
      filePath,
    };
  }
}