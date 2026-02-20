/**
 * Codex Command <-> SemanticIR bidirectional converter
 */

import type { CodexCommand, SemanticConverter, SemanticIR, ConverterOptions } from "../types/index.js";
import { parseCodexBody, serializeCodexBody } from "./codex-body.js";
import { FILE_EXTENSIONS } from "../utils/constants.js";

/** Claude-specific command fields subject to removeUnsupported */
const CLAUDE_COMMAND_FIELDS = ["allowed-tools", "argument-hint", "model"] as const;

export class CodexCommandConverter implements SemanticConverter<CodexCommand> {
  toIR(source: CodexCommand): SemanticIR {
    const fm = source.frontmatter || {};
    const extras: Record<string, unknown> = {};
    let description: string | undefined;

    for (const [key, value] of Object.entries(fm)) {
      if (key === "description") {
        description = String(value);
      } else {
        extras[key] = value;
      }
    }

    return {
      contentType: "command",
      body: parseCodexBody(source.content),
      semantic: { description },
      extras,
      meta: {
        sourcePath: source.filePath,
        sourceType: "codex",
      },
    };
  }

  fromIR(ir: SemanticIR, options?: ConverterOptions): CodexCommand {
    let filePath = ir.meta.sourcePath || "";
    if (!filePath.endsWith(FILE_EXTENSIONS.CLAUDE)) {
      filePath = filePath.replace(/\.[^.]+$/, FILE_EXTENSIONS.CLAUDE);
    }

    const frontmatter: Record<string, unknown> = {};

    if (ir.semantic.description !== undefined) {
      frontmatter.description = ir.semantic.description;
    }

    for (const [key, value] of Object.entries(ir.extras)) {
      if (options?.removeUnsupported && (CLAUDE_COMMAND_FIELDS as readonly string[]).includes(key)) continue;
      frontmatter[key] = value;
    }

    const shouldPreserveFrontmatter = Object.keys(frontmatter).length > 0;

    return {
      frontmatter: shouldPreserveFrontmatter ? frontmatter : undefined,
      content: serializeCodexBody(ir.body),
      filePath,
    };
  }
}
