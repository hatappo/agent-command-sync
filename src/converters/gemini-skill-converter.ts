/**
 * Gemini Skill <-> SemanticIR bidirectional converter
 */

import type { GeminiSkill, SemanticConverter, SemanticIR, ConverterOptions } from "../types/index.js";
import { parseGeminiBody, serializeGeminiBody } from "./gemini-body.js";

/** Claude-specific skill fields (original names, subject to _claude_ prefix) */
const CLAUDE_SKILL_FIELDS = ["user-invocable", "allowed-tools", "argument-hint", "model", "context", "agent", "hooks"];

const CLAUDE_PREFIX = "_claude_";
const CLAUDE_MODEL_INVOCATION_KEY = `${CLAUDE_PREFIX}disable_model_invocation`;

function unprefixClaudeKey(key: string): string {
  return key.slice(CLAUDE_PREFIX.length).replace(/_/g, "-");
}

function prefixClaudeKey(key: string): string {
  return `${CLAUDE_PREFIX}${key.replace(/-/g, "_")}`;
}

export class GeminiSkillConverter implements SemanticConverter<GeminiSkill> {
  toIR(source: GeminiSkill): SemanticIR {
    const extras: Record<string, unknown> = {};
    let modelInvocationEnabled: boolean | undefined;

    for (const [key, value] of Object.entries(source.frontmatter)) {
      if (key === "name" || key === "description") continue;

      if (key === CLAUDE_MODEL_INVOCATION_KEY) {
        modelInvocationEnabled = typeof value === "boolean" ? !value : undefined;
        continue;
      }

      if (key.startsWith(CLAUDE_PREFIX)) {
        extras[unprefixClaudeKey(key)] = value;
      } else {
        extras[key] = value;
      }
    }

    return {
      contentType: "skill",
      body: parseGeminiBody(source.content),
      semantic: {
        name: source.frontmatter.name,
        description: source.frontmatter.description,
        modelInvocationEnabled,
      },
      extras,
      meta: {
        sourcePath: source.dirPath,
        sourceType: "gemini",
        supportFiles: source.supportFiles,
        skillName: source.name,
      },
    };
  }

  fromIR(ir: SemanticIR, options?: ConverterOptions): GeminiSkill {
    const skillName = ir.meta.skillName || "unnamed-skill";
    const supportFiles = ir.meta.supportFiles || [];

    const frontmatter: GeminiSkill["frontmatter"] = {};
    if (ir.semantic.name !== undefined) frontmatter.name = ir.semantic.name;
    if (ir.semantic.description !== undefined) frontmatter.description = ir.semantic.description;

    // modelInvocationEnabled → _claude_disable_model_invocation (inverted)
    if (ir.semantic.modelInvocationEnabled !== undefined && !options?.removeUnsupported) {
      frontmatter[CLAUDE_MODEL_INVOCATION_KEY] = !ir.semantic.modelInvocationEnabled;
    }

    for (const [key, value] of Object.entries(ir.extras)) {
      if (CLAUDE_SKILL_FIELDS.includes(key)) {
        if (options?.removeUnsupported) continue;
        frontmatter[prefixClaudeKey(key)] = value;
      } else {
        frontmatter[key] = value;
      }
    }

    return {
      name: skillName,
      description: frontmatter.description as string | undefined,
      content: serializeGeminiBody(ir.body),
      dirPath: ir.meta.sourcePath || "",
      supportFiles,
      frontmatter,
    };
  }
}
