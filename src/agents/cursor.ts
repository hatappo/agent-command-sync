/**
 * Cursor agent — unified parser, converter, and body handling
 *
 * Commands: plain Markdown (no frontmatter). File is treated as prompt text.
 * Skills: agentskills.io standard (YAML frontmatter + Markdown body).
 */

import { copyFile, writeFile as fsWriteFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import matter from "gray-matter";
import type { BodySegment, ContentPlaceholder } from "../types/body-segment.js";
import type { CursorCommand, CursorSkill } from "../types/index.js";
import { ParseError } from "../types/index.js";
import type { ConverterOptions, SemanticIR } from "../types/semantic-ir.js";
import { parseBody, serializeBody } from "../utils/body-segment-utils.js";
import { FILE_EXTENSIONS, SKILL_CONSTANTS } from "../utils/constants.js";
import { fileExists, readFile } from "../utils/file-utils.js";
import { collectSupportFiles, getSkillName, isSkillDirectory } from "../utils/skill-utils.js";
import { CLAUDE_SYNTAX_PATTERNS, CLAUDE_SYNTAX_SERIALIZERS } from "./_claude-syntax-body-patterns.js";
import type { AgentDefinition } from "./agent-definition.js";

// ── Cursor-specific constants ────────────────────────────────────

/** Placeholder types not natively supported by Cursor */
const CURSOR_UNSUPPORTED: ReadonlySet<ContentPlaceholder["type"]> = new Set([
  "arguments",
  "individual-argument",
  "shell-command",
  "file-reference",
]);

/** Claude-specific skill fields subject to removeUnsupported */
const CLAUDE_SKILL_FIELDS = ["context", "hooks", "model", "agent", "argument-hint"] as const;

/** Semantic skill fields (not passed to extras) */
const SEMANTIC_SKILL_FIELDS = ["name", "description", "disable-model-invocation", "_from"] as const;

export class CursorAgent implements AgentDefinition {
  // ── AgentConfig ───────────────────────────────────────────────────

  readonly displayName = "Cursor";
  readonly dirs = {
    commandSubdir: "commands",
    skillSubdir: "skills",
    projectBase: ".cursor",
    userDefault: ".cursor",
  };
  readonly fileExtension = ".md";

  // ── BodyParser ────────────────────────────────────────────────────

  parseBody(body: string): BodySegment[] {
    return parseBody(body, CLAUDE_SYNTAX_PATTERNS);
  }

  serializeBody(segments: BodySegment[]): string {
    return serializeBody(segments, CLAUDE_SYNTAX_SERIALIZERS, CURSOR_UNSUPPORTED);
  }

  // ── CommandParser ─────────────────────────────────────────────────

  async parseCommand(filePath: string): Promise<CursorCommand> {
    try {
      const content = await readFile(filePath);
      return { content: content.trim(), filePath };
    } catch (error) {
      throw new ParseError(
        `Failed to parse Cursor command file: ${error instanceof Error ? error.message : String(error)}`,
        filePath,
        error instanceof Error ? error : undefined,
      );
    }
  }

  validateCommand(data: CursorCommand): boolean {
    return typeof data.content === "string";
  }

  stringifyCommand(command: CursorCommand): string {
    return command.content;
  }

  // ── CommandConverter ──────────────────────────────────────────────

  commandToIR(source: CursorCommand, _options?: ConverterOptions): SemanticIR {
    return {
      contentType: "command",
      body: this.parseBody(source.content),
      semantic: {},
      extras: {},
      meta: {
        sourcePath: source.filePath,
        sourceType: "cursor",
      },
    };
  }

  commandFromIR(ir: SemanticIR, _options?: ConverterOptions): CursorCommand {
    let filePath = ir.meta.sourcePath || "";

    // Shorten compound extension: .prompt.md → .md
    if (filePath.endsWith(FILE_EXTENSIONS.COPILOT)) {
      filePath = filePath.slice(0, -FILE_EXTENSIONS.COPILOT.length) + FILE_EXTENSIONS.CURSOR;
    } else if (!filePath.endsWith(FILE_EXTENSIONS.CURSOR)) {
      filePath = filePath.replace(/\.[^.]+$/, FILE_EXTENSIONS.CURSOR);
    }

    return { content: this.serializeBody(ir.body), filePath };
  }

  // ── SkillParser ───────────────────────────────────────────────────

  async parseSkill(dirPath: string): Promise<CursorSkill> {
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
          "allowed-tools": parsed.data["allowed-tools"],
          "user-invocable": parsed.data["user-invocable"],
          "disable-model-invocation": parsed.data["disable-model-invocation"],
          ...parsed.data,
        },
      };
    } catch (error) {
      throw new ParseError(
        `Failed to parse Cursor skill: ${error instanceof Error ? error.message : String(error)}`,
        dirPath,
        error instanceof Error ? error : undefined,
      );
    }
  }

  validateSkill(data: CursorSkill): boolean {
    if (!data.content || typeof data.content !== "string") {
      return false;
    }
    if (!data.name || typeof data.name !== "string") {
      return false;
    }
    return true;
  }

  stringifySkill(skill: CursorSkill): string {
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

  async writeSkillToDirectory(skill: CursorSkill, sourceDirPath: string, targetDir: string): Promise<void> {
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

  skillToIR(source: CursorSkill, _options?: ConverterOptions): SemanticIR {
    const extras: Record<string, unknown> = {};
    const fm = source.frontmatter;

    for (const [key, value] of Object.entries(fm)) {
      if ((SEMANTIC_SKILL_FIELDS as readonly string[]).includes(key)) continue;
      extras[key] = value;
    }

    const fromValue = fm._from;

    return {
      contentType: "skill",
      body: this.parseBody(source.content),
      semantic: {
        name: fm.name,
        description: fm.description,
        modelInvocationEnabled:
          typeof fm["disable-model-invocation"] === "boolean" ? !fm["disable-model-invocation"] : undefined,
        from: Array.isArray(fromValue) ? fromValue : undefined,
      },
      extras,
      meta: {
        sourcePath: source.dirPath,
        sourceType: "cursor",
        supportFiles: source.supportFiles,
        skillName: source.name,
      },
    };
  }

  skillFromIR(ir: SemanticIR, options?: ConverterOptions): CursorSkill {
    const skillName = ir.meta.skillName || "unnamed-skill";
    const supportFiles = ir.meta.supportFiles || [];

    const frontmatter: CursorSkill["frontmatter"] = {};

    if (ir.semantic.name !== undefined) frontmatter.name = ir.semantic.name;
    if (ir.semantic.description !== undefined) frontmatter.description = ir.semantic.description;
    if (ir.semantic.modelInvocationEnabled !== undefined) {
      frontmatter["disable-model-invocation"] = !ir.semantic.modelInvocationEnabled;
    }

    for (const [key, value] of Object.entries(ir.extras)) {
      if (options?.removeUnsupported && (CLAUDE_SKILL_FIELDS as readonly string[]).includes(key)) continue;
      if (!(key in frontmatter)) {
        frontmatter[key] = value;
      }
    }

    if (ir.semantic.from !== undefined && ir.semantic.from.length > 0) {
      frontmatter._from = ir.semantic.from;
    }

    return {
      name: skillName,
      description: frontmatter.description,
      content: this.serializeBody(ir.body),
      dirPath: ir.meta.sourcePath || "",
      supportFiles,
      frontmatter,
    };
  }
}

export function createCursorAgent(): AgentDefinition {
  return new CursorAgent();
}
