/**
 * Gemini Command <-> SemanticIR bidirectional converter
 */

import type { GeminiCommand, SemanticConverter, SemanticIR, ConverterOptions } from "../types/index.js";
import { parseGeminiBody, serializeGeminiBody } from "./gemini-body.js";
import { FILE_EXTENSIONS } from "../utils/constants.js";

/** Claude-specific command fields subject to removeUnsupported */
const CLAUDE_COMMAND_FIELDS = ["allowed-tools", "argument-hint", "model"] as const;

export class GeminiCommandConverter implements SemanticConverter<GeminiCommand> {
  toIR(source: GeminiCommand): SemanticIR {
    const extras: Record<string, unknown> = {};
    let description: string | undefined;

    for (const [key, value] of Object.entries(source)) {
      if (key === "prompt" || key === "filePath") continue;
      if (key === "description") {
        description = String(value);
      } else {
        extras[key] = value;
      }
    }

    return {
      contentType: "command",
      body: parseGeminiBody(source.prompt),
      semantic: { description },
      extras,
      meta: {
        sourcePath: source.filePath,
        sourceType: "gemini",
      },
    };
  }

  fromIR(ir: SemanticIR, options?: ConverterOptions): GeminiCommand {
    const result: GeminiCommand = {
      prompt: serializeGeminiBody(ir.body),
      filePath: "",
    };

    if (ir.semantic.description !== undefined) {
      result.description = ir.semantic.description;
    }

    for (const [key, value] of Object.entries(ir.extras)) {
      if (key === "description") continue;
      if (options?.removeUnsupported && (CLAUDE_COMMAND_FIELDS as readonly string[]).includes(key)) continue;
      result[key] = value;
    }

    let filePath = ir.meta.sourcePath || "";
    if (!filePath.endsWith(FILE_EXTENSIONS.GEMINI)) {
      filePath = filePath.replace(/\.[^.]+$/, FILE_EXTENSIONS.GEMINI);
    }
    result.filePath = filePath;

    return result;
  }
}
