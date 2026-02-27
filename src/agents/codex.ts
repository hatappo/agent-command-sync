/**
 * Codex CLI agent — unified parser, converter, and body handling
 */

import { copyFile, writeFile as fsWriteFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import matter from "gray-matter";
import YAML from "yaml";
import type { BodySegment, ContentPlaceholder } from "../types/body-segment.js";
import type { CodexCommand, CodexOpenAIConfig, CodexSkill } from "../types/index.js";
import { ParseError } from "../types/index.js";
import type { ConverterOptions, SemanticIR } from "../types/semantic-ir.js";
import { parseBody, serializeBody } from "../utils/body-segment-utils.js";
import { FILE_EXTENSIONS, SKILL_CONSTANTS } from "../utils/constants.js";
import { fileExists, readFile } from "../utils/file-utils.js";
import { collectSupportFiles, getSkillName, isSkillDirectory } from "../utils/skill-utils.js";
import { CLAUDE_SYNTAX_PATTERNS, CLAUDE_SYNTAX_SERIALIZERS } from "./_claude-syntax-body-patterns.js";
import type { AgentDefinition } from "./agent-definition.js";

// ── Codex-specific constants ──────────────────────────────────────

/** Placeholder types not natively supported by Codex CLI */
const CODEX_UNSUPPORTED: ReadonlySet<ContentPlaceholder["type"]> = new Set(["shell-command", "file-reference"]);

/** Claude-specific command fields subject to removeUnsupported */
const CLAUDE_COMMAND_FIELDS = ["allowed-tools", "argument-hint", "model"] as const;

/** Claude-specific skill fields subject to removeUnsupported */
const CLAUDE_SKILL_FIELDS = [
  "disable-model-invocation",
  "user-invocable",
  "allowed-tools",
  "argument-hint",
  "model",
  "context",
  "agent",
  "hooks",
];

/** openai.yaml top-level keys that should be routed to openaiConfig */
const OPENAI_YAML_KEYS = ["interface", "dependencies"] as const;

export class CodexAgent implements AgentDefinition {
  // ── AgentConfig ───────────────────────────────────────────────────

  readonly displayName = "Codex CLI";
  readonly dirs = {
    commandSubdir: "prompts",
    skillSubdir: "skills",
    projectBase: ".codex",
    userDefault: ".codex",
  };
  readonly fileExtension = ".md";

  // ── BodyParser ────────────────────────────────────────────────────

  parseBody(body: string): BodySegment[] {
    return parseBody(body, CLAUDE_SYNTAX_PATTERNS);
  }

  serializeBody(segments: BodySegment[]): string {
    return serializeBody(segments, CLAUDE_SYNTAX_SERIALIZERS, CODEX_UNSUPPORTED);
  }

  // ── CommandParser ─────────────────────────────────────────────────

  async parseCommand(filePath: string): Promise<CodexCommand> {
    try {
      const fileContent = await readFile(filePath);
      const { data, content } = matter(fileContent);

      return {
        frontmatter: Object.keys(data).length > 0 ? data : undefined,
        content: content.trim(),
        filePath,
      };
    } catch (error) {
      throw new ParseError(
        `Failed to parse Codex command file: ${error instanceof Error ? error.message : String(error)}`,
        filePath,
        error instanceof Error ? error : undefined,
      );
    }
  }

  validateCommand(data: CodexCommand): boolean {
    return typeof data.content === "string";
  }

  stringifyCommand(command: CodexCommand): string {
    if (command.frontmatter && Object.keys(command.frontmatter).length > 0) {
      const cleanFrontmatter: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(command.frontmatter)) {
        if (value !== undefined) {
          cleanFrontmatter[key] = value;
        }
      }

      if (Object.keys(cleanFrontmatter).length > 0) {
        return matter.stringify(command.content, cleanFrontmatter);
      }
    }
    return command.content;
  }

  // ── CommandConverter ──────────────────────────────────────────────

  commandToIR(source: CodexCommand, _options?: ConverterOptions): SemanticIR {
    const fm = source.frontmatter || {};
    const extras: Record<string, unknown> = {};
    let description: string | undefined;
    let from: string | undefined;

    for (const [key, value] of Object.entries(fm)) {
      if (key === "description") {
        description = String(value);
      } else if (key === "_from") {
        from = typeof value === "string" ? value : Array.isArray(value) && value.length > 0 ? value[0] : undefined;
      } else {
        extras[key] = value;
      }
    }

    return {
      contentType: "command",
      body: this.parseBody(source.content),
      semantic: { description, from },
      extras,
      meta: {
        sourcePath: source.filePath,
        sourceType: "codex",
      },
    };
  }

  commandFromIR(ir: SemanticIR, options?: ConverterOptions): CodexCommand {
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

    if (ir.semantic.from !== undefined) {
      frontmatter._from = ir.semantic.from;
    }

    const shouldPreserveFrontmatter = Object.keys(frontmatter).length > 0;

    return {
      frontmatter: shouldPreserveFrontmatter ? frontmatter : undefined,
      content: this.serializeBody(ir.body),
      filePath,
    };
  }

  // ── SkillParser ───────────────────────────────────────────────────

  async parseSkill(dirPath: string): Promise<CodexSkill> {
    try {
      if (!(await isSkillDirectory(dirPath))) {
        throw new Error(`Not a valid skill directory: missing ${SKILL_CONSTANTS.SKILL_FILE_NAME}`);
      }

      const skillFilePath = join(dirPath, SKILL_CONSTANTS.SKILL_FILE_NAME);
      const content = await readFile(skillFilePath);
      const parsed = matter(content);

      const openaiConfig = await this.parseOpenAIConfig(dirPath);

      const supportFiles = await collectSupportFiles(dirPath, [
        SKILL_CONSTANTS.SKILL_FILE_NAME,
        join(SKILL_CONSTANTS.CODEX_CONFIG_DIR, SKILL_CONSTANTS.CODEX_CONFIG_FILE),
      ]);

      for (const file of supportFiles) {
        if (file.type === "text" || file.type === "config") {
          try {
            const filePath = join(dirPath, file.relativePath);
            file.content = await readFile(filePath);
          } catch {
            // Ignore read errors for support files
          }
        }
      }

      const name = parsed.data.name || getSkillName(dirPath);

      return {
        name,
        description: parsed.data.description,
        content: parsed.content,
        dirPath,
        supportFiles,
        frontmatter: {
          name: parsed.data.name,
          description: parsed.data.description,
          ...parsed.data,
        },
        openaiConfig,
      };
    } catch (error) {
      throw new ParseError(
        `Failed to parse Codex skill: ${error instanceof Error ? error.message : String(error)}`,
        dirPath,
        error instanceof Error ? error : undefined,
      );
    }
  }

  validateSkill(data: CodexSkill): boolean {
    if (!data.content || typeof data.content !== "string") {
      return false;
    }
    if (!data.name || typeof data.name !== "string") {
      return false;
    }
    return true;
  }

  stringifySkill(skill: CodexSkill): string {
    const { frontmatter, content } = skill;

    const cleanFrontmatter: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(frontmatter)) {
      if (value !== undefined && value !== null) {
        cleanFrontmatter[key] = value;
      }
    }

    const hasValidFrontmatter = Object.keys(cleanFrontmatter).length > 0;

    if (!hasValidFrontmatter) {
      return content;
    }

    return matter.stringify(content, cleanFrontmatter);
  }

  async writeSkillToDirectory(skill: CodexSkill, sourceDirPath: string, targetDir: string): Promise<void> {
    skill.dirPath = sourceDirPath;

    await mkdir(targetDir, { recursive: true });

    const skillContent = this.stringifySkill(skill);
    await fsWriteFile(join(targetDir, SKILL_CONSTANTS.SKILL_FILE_NAME), skillContent, "utf-8");

    if (skill.openaiConfig) {
      const configDir = join(targetDir, SKILL_CONSTANTS.CODEX_CONFIG_DIR);
      await mkdir(configDir, { recursive: true });
      const configContent = this.stringifyOpenAIConfig(skill.openaiConfig);
      await fsWriteFile(join(configDir, SKILL_CONSTANTS.CODEX_CONFIG_FILE), configContent, "utf-8");
    }

    for (const file of skill.supportFiles) {
      const targetPath = join(targetDir, file.relativePath);
      await mkdir(dirname(targetPath), { recursive: true });

      if (file.type === "binary") {
        const sourcePath = join(skill.dirPath, file.relativePath);
        if (await fileExists(sourcePath)) {
          await copyFile(sourcePath, targetPath);
        }
      } else if (file.content !== undefined) {
        await fsWriteFile(targetPath, file.content, "utf-8");
      }
    }
  }

  // ── SkillConverter ────────────────────────────────────────────────

  skillToIR(source: CodexSkill, _options?: ConverterOptions): SemanticIR {
    const extras: Record<string, unknown> = {};
    let modelInvocationEnabled: boolean | undefined;
    let from: string | undefined;

    for (const [key, value] of Object.entries(source.frontmatter)) {
      if (key === "name" || key === "description") continue;

      if (key === "disable-model-invocation") {
        modelInvocationEnabled = typeof value === "boolean" ? !value : undefined;
        continue;
      }

      if (key === "_from") {
        from = typeof value === "string" ? value : Array.isArray(value) && value.length > 0 ? value[0] : undefined;
        continue;
      }

      extras[key] = value;
    }

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
      body: this.parseBody(source.content),
      semantic: {
        name: source.frontmatter.name,
        description: source.frontmatter.description,
        modelInvocationEnabled,
        from,
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

  skillFromIR(ir: SemanticIR, options?: ConverterOptions): CodexSkill {
    const skillName = ir.meta.skillName || "unnamed-skill";
    const supportFiles = ir.meta.supportFiles || [];

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

    const frontmatter: CodexSkill["frontmatter"] = {};
    if (ir.semantic.name !== undefined) frontmatter.name = ir.semantic.name;
    if (ir.semantic.description !== undefined) frontmatter.description = ir.semantic.description;

    if (ir.semantic.modelInvocationEnabled !== undefined && !options?.removeUnsupported) {
      frontmatter["disable-model-invocation"] = !ir.semantic.modelInvocationEnabled;
    }

    for (const [key, value] of Object.entries(ir.extras)) {
      if ((OPENAI_YAML_KEYS as readonly string[]).includes(key)) continue;
      if (options?.removeUnsupported && CLAUDE_SKILL_FIELDS.includes(key)) continue;
      if (!(key in frontmatter)) {
        frontmatter[key] = value;
      }
    }

    if (ir.semantic.from !== undefined) {
      frontmatter._from = ir.semantic.from;
    }

    return {
      name: skillName,
      description: frontmatter.description as string | undefined,
      content: this.serializeBody(ir.body),
      dirPath: ir.meta.sourcePath || "",
      supportFiles,
      frontmatter,
      openaiConfig,
    };
  }

  // ── Private helpers ───────────────────────────────────────────────

  private async parseOpenAIConfig(dirPath: string): Promise<CodexOpenAIConfig | undefined> {
    const configPath = join(dirPath, SKILL_CONSTANTS.CODEX_CONFIG_DIR, SKILL_CONSTANTS.CODEX_CONFIG_FILE);

    if (!(await fileExists(configPath))) {
      return undefined;
    }

    try {
      const content = await readFile(configPath);
      return YAML.parse(content) as CodexOpenAIConfig;
    } catch {
      return undefined;
    }
  }

  private stringifyOpenAIConfig(config: CodexOpenAIConfig): string {
    return YAML.stringify(config);
  }
}

export function createCodexAgent(): AgentDefinition {
  return new CodexAgent();
}
