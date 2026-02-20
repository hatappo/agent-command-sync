/**
 * Codex Skill <-> SemanticIR bidirectional converter
 */

import type {
  CodexSkill,
  CodexOpenAIConfig,
  SemanticConverter,
  SemanticIR,
  ConverterOptions,
} from "../types/index.js";
import { parseCodexBody, serializeCodexBody } from "./codex-body.js";

/** Claude-specific skill fields (original names, subject to _claude_ prefix) */
const CLAUDE_SKILL_FIELDS = ["user-invocable", "allowed-tools", "argument-hint", "model", "context", "agent", "hooks"];

/** openai.yaml top-level keys that should be routed to openaiConfig */
const OPENAI_YAML_KEYS = ["interface", "dependencies"] as const;

const CLAUDE_PREFIX = "_claude_";
const CLAUDE_MODEL_INVOCATION_KEY = `${CLAUDE_PREFIX}disable_model_invocation`;

function unprefixClaudeKey(key: string): string {
  return key.slice(CLAUDE_PREFIX.length).replace(/_/g, "-");
}

function prefixClaudeKey(key: string): string {
  return `${CLAUDE_PREFIX}${key.replace(/-/g, "_")}`;
}

export class CodexSkillConverter implements SemanticConverter<CodexSkill> {
  toIR(source: CodexSkill): SemanticIR {
    const extras: Record<string, unknown> = {};
    let modelInvocationEnabled: boolean | undefined;

    // Process frontmatter
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

    // Process openaiConfig
    if (source.openaiConfig) {
      for (const [key, value] of Object.entries(source.openaiConfig)) {
        if (key === "policy") continue;
        extras[key] = value;
      }

      if (source.openaiConfig.policy?.allow_implicit_invocation !== undefined) {
        modelInvocationEnabled = source.openaiConfig.policy.allow_implicit_invocation;
      }
    }

    return {
      contentType: "skill",
      body: parseCodexBody(source.content),
      semantic: {
        name: source.frontmatter.name,
        description: source.frontmatter.description,
        modelInvocationEnabled,
      },
      extras,
      meta: {
        sourcePath: source.dirPath,
        sourceType: "codex",
        supportFiles: source.supportFiles,
        skillName: source.name,
      },
    };
  }

  fromIR(ir: SemanticIR, options?: ConverterOptions): CodexSkill {
    const skillName = ir.meta.skillName || "unnamed-skill";
    const supportFiles = ir.meta.supportFiles || [];

    // Build openaiConfig from semantic + extras
    let openaiConfig: CodexOpenAIConfig | undefined;

    if (ir.semantic.modelInvocationEnabled !== undefined) {
      openaiConfig = { policy: { allow_implicit_invocation: ir.semantic.modelInvocationEnabled } };
    }

    for (const key of OPENAI_YAML_KEYS) {
      if (ir.extras[key] !== undefined) {
        if (!openaiConfig) openaiConfig = {};
        (openaiConfig as Record<string, unknown>)[key] = ir.extras[key];
      }
    }

    // Build frontmatter
    const frontmatter: CodexSkill["frontmatter"] = {};
    if (ir.semantic.name !== undefined) frontmatter.name = ir.semantic.name;
    if (ir.semantic.description !== undefined) frontmatter.description = ir.semantic.description;

    // modelInvocationEnabled → _claude_disable_model_invocation (inverted)
    if (ir.semantic.modelInvocationEnabled !== undefined && !options?.removeUnsupported) {
      frontmatter[CLAUDE_MODEL_INVOCATION_KEY] = !ir.semantic.modelInvocationEnabled;
    }

    for (const [key, value] of Object.entries(ir.extras)) {
      // Skip openai.yaml keys (already routed to openaiConfig)
      if ((OPENAI_YAML_KEYS as readonly string[]).includes(key)) continue;

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
      content: serializeCodexBody(ir.body),
      dirPath: ir.meta.sourcePath || "",
      supportFiles,
      frontmatter,
      openaiConfig,
    };
  }
}
