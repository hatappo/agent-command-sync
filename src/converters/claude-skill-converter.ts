/**
 * Claude Skill <-> SemanticIR bidirectional converter
 */

import type { ClaudeSkill, SemanticConverter, SemanticIR, ConverterOptions } from "../types/index.js";
import { parseClaudeBody, serializeClaudeBody } from "./claude-body.js";

/** Fields that map to semantic properties (shared across 2+ agents) */
const SEMANTIC_FIELDS = ["name", "description", "disable-model-invocation"] as const;

export class ClaudeSkillConverter implements SemanticConverter<ClaudeSkill> {
  toIR(source: ClaudeSkill): SemanticIR {
    const extras: Record<string, unknown> = {};
    const fm = source.frontmatter;

    for (const [key, value] of Object.entries(fm)) {
      if (!(SEMANTIC_FIELDS as readonly string[]).includes(key)) {
        extras[key] = value;
      }
    }

    return {
      contentType: "skill",
      body: parseClaudeBody(source.content),
      semantic: {
        name: fm.name,
        description: fm.description,
        modelInvocationEnabled:
          typeof fm["disable-model-invocation"] === "boolean" ? !fm["disable-model-invocation"] : undefined,
      },
      extras,
      meta: {
        sourcePath: source.dirPath,
        sourceType: "claude",
        supportFiles: source.supportFiles,
        skillName: source.name,
      },
    };
  }

  fromIR(ir: SemanticIR, _options?: ConverterOptions): ClaudeSkill {
    const skillName = ir.meta.skillName || "unnamed-skill";
    const supportFiles = ir.meta.supportFiles || [];

    const frontmatter: ClaudeSkill["frontmatter"] = {};

    if (ir.semantic.name !== undefined) frontmatter.name = ir.semantic.name;
    if (ir.semantic.description !== undefined) frontmatter.description = ir.semantic.description;
    if (ir.semantic.modelInvocationEnabled !== undefined) {
      frontmatter["disable-model-invocation"] = !ir.semantic.modelInvocationEnabled;
    }

    for (const [key, value] of Object.entries(ir.extras)) {
      if (!(key in frontmatter)) {
        frontmatter[key] = value;
      }
    }

    return {
      name: skillName,
      description: frontmatter.description,
      content: serializeClaudeBody(ir.body),
      dirPath: ir.meta.sourcePath || "",
      supportFiles,
      frontmatter,
    };
  }
}
