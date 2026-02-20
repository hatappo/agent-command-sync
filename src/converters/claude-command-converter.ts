/**
 * Claude Command <-> SemanticIR bidirectional converter
 */

import type { ClaudeCommand, SemanticConverter, SemanticIR, ConverterOptions } from "../types/index.js";
import { parseClaudeBody, serializeClaudeBody } from "./claude-body.js";
import { FILE_EXTENSIONS } from "../utils/constants.js";

export class ClaudeCommandConverter implements SemanticConverter<ClaudeCommand> {
  toIR(source: ClaudeCommand): SemanticIR {
    const extras: Record<string, unknown> = {};
    let description: string | undefined;

    for (const [key, value] of Object.entries(source.frontmatter)) {
      if (key === "description") {
        description = value as string | undefined;
      } else {
        extras[key] = value;
      }
    }

    return {
      contentType: "command",
      body: parseClaudeBody(source.content),
      semantic: { description },
      extras,
      meta: {
        sourcePath: source.filePath,
        sourceType: "claude",
      },
    };
  }

  fromIR(ir: SemanticIR, _options?: ConverterOptions): ClaudeCommand {
    const frontmatter: ClaudeCommand["frontmatter"] = {};

    if (ir.semantic.description !== undefined) {
      frontmatter.description = ir.semantic.description;
    }

    for (const [key, value] of Object.entries(ir.extras)) {
      if (key !== "prompt") {
        frontmatter[key] = value;
      }
    }

    let filePath = ir.meta.sourcePath || "";
    if (!filePath.endsWith(FILE_EXTENSIONS.CLAUDE)) {
      filePath = filePath.replace(/\.[^.]+$/, FILE_EXTENSIONS.CLAUDE);
    }

    return { frontmatter, content: serializeClaudeBody(ir.body), filePath };
  }
}
