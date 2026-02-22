/**
 * GitHub Copilot agent — unified parser, converter, and body handling
 */

import { mkdir, writeFile as fsWriteFile, copyFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import matter from "gray-matter";
import type { BodySegment, ContentPlaceholder } from "../types/body-segment.js";
import type { CopilotCommand, CopilotSkill } from "../types/index.js";
import { ParseError } from "../types/index.js";
import type { ConverterOptions, SemanticIR } from "../types/semantic-ir.js";
import { parseBody, serializeBody } from "../utils/body-segment-utils.js";
import { FILE_EXTENSIONS, SKILL_CONSTANTS } from "../utils/constants.js";
import { readFile, fileExists } from "../utils/file-utils.js";
import { collectSupportFiles, getSkillName, isSkillDirectory } from "../utils/skill-utils.js";
import { CLAUDE_SYNTAX_PATTERNS, CLAUDE_SYNTAX_SERIALIZERS } from "./_claude-syntax-body-patterns.js";
import type { AgentDefinition } from "./agent-definition.js";

// ── Copilot-specific constants ────────────────────────────────────

/** Placeholder types not natively supported by Copilot */
const COPILOT_UNSUPPORTED: ReadonlySet<ContentPlaceholder["type"]> = new Set([
  "arguments",
  "individual-argument",
  "shell-command",
  "file-reference",
]);

/** Claude-specific command fields subject to removeUnsupported */
const CLAUDE_COMMAND_FIELDS = ["allowed-tools"] as const;

/** Claude-specific skill fields subject to removeUnsupported */
const CLAUDE_SKILL_FIELDS = ["context", "hooks", "allowed-tools", "user-invocable"] as const;

/** Semantic skill fields (not passed to extras) */
const SEMANTIC_SKILL_FIELDS = ["name", "description", "disable-model-invocation"] as const;

export class CopilotAgent implements AgentDefinition {
  // ── AgentConfig ───────────────────────────────────────────────────

  readonly displayName = "GitHub Copilot";
  readonly dirs = {
    commandSubdir: "prompts",
    skillSubdir: "skills",
    projectBase: ".github",
    userDefault: ".copilot",
  };
  readonly fileExtension = ".prompt.md";

  // ── BodyParser ────────────────────────────────────────────────────

  parseBody(body: string): BodySegment[] {
    return parseBody(body, CLAUDE_SYNTAX_PATTERNS);
  }

  serializeBody(segments: BodySegment[]): string {
    return serializeBody(segments, CLAUDE_SYNTAX_SERIALIZERS, COPILOT_UNSUPPORTED);
  }

  // ── CommandParser ─────────────────────────────────────────────────

  async parseCommand(filePath: string): Promise<CopilotCommand> {
    try {
      const content = await readFile(filePath);
      const parsed = matter(content);

      return {
        frontmatter: {
          description: parsed.data.description,
          name: parsed.data.name,
          "argument-hint": parsed.data["argument-hint"],
          agent: parsed.data.agent,
          model: parsed.data.model,
          tools: parsed.data.tools,
          ...parsed.data,
        },
        content: parsed.content,
        filePath,
      };
    } catch (error) {
      throw new ParseError(
        `Failed to parse Copilot command file: ${error instanceof Error ? error.message : String(error)}`,
        filePath,
        error instanceof Error ? error : undefined,
      );
    }
  }

  validateCommand(data: CopilotCommand): boolean {
    return typeof data.content === "string";
  }

  stringifyCommand(command: CopilotCommand): string {
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

  commandToIR(source: CopilotCommand, _options?: ConverterOptions): SemanticIR {
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
        sourceType: "copilot",
      },
    };
  }

  commandFromIR(ir: SemanticIR, options?: ConverterOptions): CopilotCommand {
    const frontmatter: CopilotCommand["frontmatter"] = {};

    if (ir.semantic.description !== undefined) {
      frontmatter.description = ir.semantic.description;
    }

    for (const [key, value] of Object.entries(ir.extras)) {
      if (key === "prompt") continue;
      if (options?.removeUnsupported && (CLAUDE_COMMAND_FIELDS as readonly string[]).includes(key)) continue;
      frontmatter[key] = value;
    }

    let filePath = ir.meta.sourcePath || "";
    if (!filePath.endsWith(FILE_EXTENSIONS.COPILOT)) {
      // Replace single extension (e.g. .md, .toml) with .prompt.md
      filePath = filePath.replace(/\.[^.]+$/, FILE_EXTENSIONS.COPILOT);
    }

    return { frontmatter, content: this.serializeBody(ir.body), filePath };
  }

  // ── SkillParser ───────────────────────────────────────────────────

  async parseSkill(dirPath: string): Promise<CopilotSkill> {
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
          "user-invokable": parsed.data["user-invokable"],
          "disable-model-invocation": parsed.data["disable-model-invocation"],
          ...parsed.data,
        },
      };
    } catch (error) {
      throw new ParseError(
        `Failed to parse Copilot skill: ${error instanceof Error ? error.message : String(error)}`,
        dirPath,
        error instanceof Error ? error : undefined,
      );
    }
  }

  validateSkill(data: CopilotSkill): boolean {
    if (!data.content || typeof data.content !== "string") {
      return false;
    }
    if (!data.name || typeof data.name !== "string") {
      return false;
    }
    return true;
  }

  stringifySkill(skill: CopilotSkill): string {
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

  async writeSkillToDirectory(skill: CopilotSkill, sourceDirPath: string, targetDir: string): Promise<void> {
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

  skillToIR(source: CopilotSkill, _options?: ConverterOptions): SemanticIR {
    const extras: Record<string, unknown> = {};
    const fm = source.frontmatter;

    for (const [key, value] of Object.entries(fm)) {
      if ((SEMANTIC_SKILL_FIELDS as readonly string[]).includes(key)) continue;

      // Normalize Copilot's "user-invokable" (k) to Claude's "user-invocable" (c) in extras
      if (key === "user-invokable") {
        extras["user-invocable"] = value;
      } else {
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
        sourceType: "copilot",
        supportFiles: source.supportFiles,
        skillName: source.name,
      },
    };
  }

  skillFromIR(ir: SemanticIR, options?: ConverterOptions): CopilotSkill {
    const skillName = ir.meta.skillName || "unnamed-skill";
    const supportFiles = ir.meta.supportFiles || [];

    const frontmatter: CopilotSkill["frontmatter"] = {};

    if (ir.semantic.name !== undefined) frontmatter.name = ir.semantic.name;
    if (ir.semantic.description !== undefined) frontmatter.description = ir.semantic.description;
    if (ir.semantic.modelInvocationEnabled !== undefined) {
      frontmatter["disable-model-invocation"] = !ir.semantic.modelInvocationEnabled;
    }

    for (const [key, value] of Object.entries(ir.extras)) {
      if (options?.removeUnsupported && (CLAUDE_SKILL_FIELDS as readonly string[]).includes(key)) continue;

      // Normalize Claude's "user-invocable" (c) to Copilot's "user-invokable" (k)
      if (key === "user-invocable") {
        if (options?.removeUnsupported) continue;
        frontmatter["user-invokable"] = value as boolean;
      } else if (!(key in frontmatter)) {
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

export function createCopilotAgent(): AgentDefinition {
  return new CopilotAgent();
}
