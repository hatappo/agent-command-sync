/**
 * Claude Code agent — unified parser, converter, and body handling
 */

import { copyFile, writeFile as fsWriteFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import matter from "gray-matter";
import type { BodySegment } from "../types/body-segment.js";
import type { ClaudeCommand, ClaudeSkill } from "../types/index.js";
import { ParseError } from "../types/index.js";
import type { ConverterOptions, SemanticIR } from "../types/semantic-ir.js";
import { parseBody, serializeBody } from "../utils/body-segment-utils.js";
import { FILE_EXTENSIONS, SKILL_CONSTANTS } from "../utils/constants.js";
import { fileExists, readFile } from "../utils/file-utils.js";
import { collectSupportFiles, getSkillName, isSkillDirectory } from "../utils/skill-utils.js";
import { validateClaudeCommand } from "../utils/validation.js";
import { CLAUDE_SYNTAX_PATTERNS, CLAUDE_SYNTAX_SERIALIZERS } from "./_claude-syntax-body-patterns.js";
import type { AgentDefinition } from "./agent-definition.js";

/** Fields that map to semantic properties (shared across 2+ agents) */
const SEMANTIC_SKILL_FIELDS = ["name", "description", "disable-model-invocation"] as const;

export class ClaudeAgent implements AgentDefinition {
  // ── AgentConfig ───────────────────────────────────────────────────

  readonly displayName = "Claude Code";
  readonly dirs = {
    commandSubdir: "commands",
    skillSubdir: "skills",
    projectBase: ".claude",
    userDefault: ".claude",
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

  async parseCommand(filePath: string): Promise<ClaudeCommand> {
    try {
      const content = await readFile(filePath);
      const parsed = matter(content);

      return {
        frontmatter: {
          "allowed-tools": parsed.data["allowed-tools"],
          "argument-hint": parsed.data["argument-hint"],
          description: parsed.data.description,
          model: parsed.data.model,
          ...parsed.data,
        },
        content: parsed.content,
        filePath,
      };
    } catch (error) {
      throw new ParseError(
        `Failed to parse Claude command file: ${error instanceof Error ? error.message : String(error)}`,
        filePath,
        error instanceof Error ? error : undefined,
      );
    }
  }

  validateCommand(data: ClaudeCommand): boolean {
    const errors = validateClaudeCommand(data);
    return errors.length === 0;
  }

  stringifyCommand(command: ClaudeCommand): string {
    const { frontmatter, content } = command;

    const hasValidFrontmatter = Object.keys(frontmatter).some(
      (key) => frontmatter[key] !== undefined && frontmatter[key] !== null,
    );

    if (!hasValidFrontmatter) {
      return content;
    }

    const cleanFrontmatter: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(frontmatter)) {
      if (value !== undefined && value !== null) {
        cleanFrontmatter[key] = value;
      }
    }

    return matter.stringify(content, cleanFrontmatter);
  }

  // ── CommandConverter ──────────────────────────────────────────────

  commandToIR(source: ClaudeCommand, _options?: ConverterOptions): SemanticIR {
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
      body: this.parseBody(source.content),
      semantic: { description },
      extras,
      meta: {
        sourcePath: source.filePath,
        sourceType: "claude",
      },
    };
  }

  commandFromIR(ir: SemanticIR, _options?: ConverterOptions): ClaudeCommand {
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

    return { frontmatter, content: this.serializeBody(ir.body), filePath };
  }

  // ── SkillParser ───────────────────────────────────────────────────

  async parseSkill(dirPath: string): Promise<ClaudeSkill> {
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
          "argument-hint": parsed.data["argument-hint"],
          "disable-model-invocation": parsed.data["disable-model-invocation"],
          "user-invocable": parsed.data["user-invocable"],
          "allowed-tools": parsed.data["allowed-tools"],
          model: parsed.data.model,
          context: parsed.data.context,
          agent: parsed.data.agent,
          hooks: parsed.data.hooks,
          ...parsed.data,
        },
      };
    } catch (error) {
      throw new ParseError(
        `Failed to parse Claude skill: ${error instanceof Error ? error.message : String(error)}`,
        dirPath,
        error instanceof Error ? error : undefined,
      );
    }
  }

  validateSkill(data: ClaudeSkill): boolean {
    if (!data.content || typeof data.content !== "string") {
      return false;
    }
    if (!data.name || typeof data.name !== "string") {
      return false;
    }
    return true;
  }

  stringifySkill(skill: ClaudeSkill): string {
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

  async writeSkillToDirectory(skill: ClaudeSkill, sourceDirPath: string, targetDir: string): Promise<void> {
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

  skillToIR(source: ClaudeSkill, _options?: ConverterOptions): SemanticIR {
    const extras: Record<string, unknown> = {};
    const fm = source.frontmatter;

    for (const [key, value] of Object.entries(fm)) {
      if (!(SEMANTIC_SKILL_FIELDS as readonly string[]).includes(key)) {
        extras[key] = value;
      }
    }

    return {
      contentType: "skill",
      body: this.parseBody(source.content),
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

  skillFromIR(ir: SemanticIR, _options?: ConverterOptions): ClaudeSkill {
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
      content: this.serializeBody(ir.body),
      dirPath: ir.meta.sourcePath || "",
      supportFiles,
      frontmatter,
    };
  }
}

export function createClaudeAgent(): AgentDefinition {
  return new ClaudeAgent();
}
