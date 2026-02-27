/**
 * OpenCode agent — unified parser, converter, and body handling
 */

import { copyFile, writeFile as fsWriteFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import matter from "gray-matter";
import type { BodySegment } from "../types/body-segment.js";
import type { OpenCodeCommand, OpenCodeSkill } from "../types/index.js";
import { ParseError } from "../types/index.js";
import type { ConverterOptions, SemanticIR } from "../types/semantic-ir.js";
import { parseBody, serializeBody } from "../utils/body-segment-utils.js";
import { FILE_EXTENSIONS, SKILL_CONSTANTS } from "../utils/constants.js";
import { fileExists, readFile } from "../utils/file-utils.js";
import { collectSupportFiles, getSkillName, isSkillDirectory } from "../utils/skill-utils.js";
import { CLAUDE_SYNTAX_PATTERNS, CLAUDE_SYNTAX_SERIALIZERS } from "./_claude-syntax-body-patterns.js";
import type { AgentDefinition } from "./agent-definition.js";

// ── OpenCode-specific constants ───────────────────────────────────

/** Claude-specific command fields subject to removeUnsupported (OpenCode supports model and agent) */
const CLAUDE_COMMAND_FIELDS = ["allowed-tools", "argument-hint"] as const;

/** Claude-specific skill fields subject to removeUnsupported */
const CLAUDE_SKILL_FIELDS = [
  "disable-model-invocation",
  "user-invocable",
  "allowed-tools",
  "argument-hint",
  "context",
  "hooks",
];

export class OpenCodeAgent implements AgentDefinition {
  // ── AgentConfig ───────────────────────────────────────────────────

  readonly displayName = "OpenCode";
  readonly dirs = {
    commandSubdir: "commands",
    skillSubdir: "skills",
    projectBase: ".opencode",
    userDefault: ".config/opencode",
  };
  readonly fileExtension = ".md";

  // ── BodyParser ────────────────────────────────────────────────────

  parseBody(body: string): BodySegment[] {
    return parseBody(body, CLAUDE_SYNTAX_PATTERNS);
  }

  serializeBody(segments: BodySegment[]): string {
    return serializeBody(segments, CLAUDE_SYNTAX_SERIALIZERS);
  }

  // ── CommandParser ─────────────────────────────────────────────────

  async parseCommand(filePath: string): Promise<OpenCodeCommand> {
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
        `Failed to parse OpenCode command file: ${error instanceof Error ? error.message : String(error)}`,
        filePath,
        error instanceof Error ? error : undefined,
      );
    }
  }

  validateCommand(data: OpenCodeCommand): boolean {
    return typeof data.content === "string";
  }

  stringifyCommand(command: OpenCodeCommand): string {
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

  commandToIR(source: OpenCodeCommand, _options?: ConverterOptions): SemanticIR {
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
        sourceType: "opencode",
      },
    };
  }

  commandFromIR(ir: SemanticIR, options?: ConverterOptions): OpenCodeCommand {
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

  async parseSkill(dirPath: string): Promise<OpenCodeSkill> {
    try {
      if (!(await isSkillDirectory(dirPath))) {
        throw new Error(`Not a valid skill directory: missing ${SKILL_CONSTANTS.SKILL_FILE_NAME}`);
      }

      const skillFilePath = join(dirPath, SKILL_CONSTANTS.SKILL_FILE_NAME);
      const content = await readFile(skillFilePath);
      const parsed = matter(content);

      const supportFiles = await collectSupportFiles(dirPath);

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
      };
    } catch (error) {
      throw new ParseError(
        `Failed to parse OpenCode skill: ${error instanceof Error ? error.message : String(error)}`,
        dirPath,
        error instanceof Error ? error : undefined,
      );
    }
  }

  validateSkill(data: OpenCodeSkill): boolean {
    if (!data.content || typeof data.content !== "string") {
      return false;
    }
    if (!data.name || typeof data.name !== "string") {
      return false;
    }
    return true;
  }

  stringifySkill(skill: OpenCodeSkill): string {
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

  async writeSkillToDirectory(skill: OpenCodeSkill, sourceDirPath: string, targetDir: string): Promise<void> {
    skill.dirPath = sourceDirPath;

    await mkdir(targetDir, { recursive: true });

    const skillContent = this.stringifySkill(skill);
    await fsWriteFile(join(targetDir, SKILL_CONSTANTS.SKILL_FILE_NAME), skillContent, "utf-8");

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

  skillToIR(source: OpenCodeSkill, _options?: ConverterOptions): SemanticIR {
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
        sourceType: "opencode",
        supportFiles: source.supportFiles,
        skillName: source.name,
      },
    };
  }

  skillFromIR(ir: SemanticIR, options?: ConverterOptions): OpenCodeSkill {
    const skillName = ir.meta.skillName || "unnamed-skill";
    const supportFiles = ir.meta.supportFiles || [];

    const frontmatter: OpenCodeSkill["frontmatter"] = {};
    if (ir.semantic.name !== undefined) frontmatter.name = ir.semantic.name;
    if (ir.semantic.description !== undefined) frontmatter.description = ir.semantic.description;

    if (ir.semantic.modelInvocationEnabled !== undefined && !options?.removeUnsupported) {
      frontmatter["disable-model-invocation"] = !ir.semantic.modelInvocationEnabled;
    }

    for (const [key, value] of Object.entries(ir.extras)) {
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
    };
  }
}

export function createOpenCodeAgent(): AgentDefinition {
  return new OpenCodeAgent();
}
