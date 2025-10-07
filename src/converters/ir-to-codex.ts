import type { CodexCommand, FromIntermediateConverter, IntermediateRepresentation } from "../types/index.js";
import { FILE_EXTENSIONS } from "../utils/constants.js";

/**
 * Intermediate Representation to Codex CLI format converter
 */
export class IRToCodexConverter implements FromIntermediateConverter<CodexCommand> {
  /**
   * Convert intermediate representation to Codex command
   */
  fromIntermediate(ir: IntermediateRepresentation): CodexCommand {
    // Generate file path
    let filePath = ir.meta.sourcePath || "";

    // Convert file extension to .md if necessary
    if (!filePath.endsWith(FILE_EXTENSIONS.CLAUDE)) {
      filePath = filePath.replace(/\.[^.]+$/, FILE_EXTENSIONS.CLAUDE);
    }

    // Check if we should preserve frontmatter (when header has content)
    const shouldPreserveFrontmatter = ir.header && Object.keys(ir.header).length > 0;

    return {
      frontmatter: shouldPreserveFrontmatter ? ir.header : undefined,
      content: ir.body,
      filePath,
    };
  }
}
