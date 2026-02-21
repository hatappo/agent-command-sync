/**
 * OpenCode Command <-> SemanticIR bidirectional converter
 */

import type { OpenCodeCommand, SemanticConverter, SemanticIR, ConverterOptions } from "../types/index.js";
import { parseOpenCodeBody, serializeOpenCodeBody } from "./opencode-body.js";
import { FILE_EXTENSIONS } from "../utils/constants.js";

/** Claude-specific command fields subject to removeUnsupported (OpenCode supports model and agent) */
const CLAUDE_COMMAND_FIELDS = ["allowed-tools", "argument-hint"] as const;

export class OpenCodeCommandConverter implements SemanticConverter<OpenCodeCommand> {
  toIR(source: OpenCodeCommand): SemanticIR {
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
      body: parseOpenCodeBody(source.content),
      semantic: { description },
      extras,
      meta: {
        sourcePath: source.filePath,
        sourceType: "opencode",
      },
    };
  }

  fromIR(ir: SemanticIR, options?: ConverterOptions): OpenCodeCommand {
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
      content: serializeOpenCodeBody(ir.body),
      filePath,
    };
  }
}
