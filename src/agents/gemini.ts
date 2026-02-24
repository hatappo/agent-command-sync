/**
 * Gemini CLI agent — unified parser, converter, and body handling
 */

import { copyFile, writeFile as fsWriteFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import * as TOML from "@iarna/toml";
import matter from "gray-matter";
import type { BodySegment, ContentPlaceholder, PatternDef, PlaceholderSerializers } from "../types/body-segment.js";
import type { GeminiCommand, GeminiSkill } from "../types/index.js";
import { ParseError } from "../types/index.js";
import type { ConverterOptions, SemanticIR } from "../types/semantic-ir.js";
import { parseBody, serializeBody } from "../utils/body-segment-utils.js";
import { FILE_EXTENSIONS, SKILL_CONSTANTS } from "../utils/constants.js";
import { fileExists, readFile } from "../utils/file-utils.js";
import { collectSupportFiles, getSkillName, isSkillDirectory } from "../utils/skill-utils.js";
import { validateGeminiCommand } from "../utils/validation.js";
import type { AgentDefinition } from "./agent-definition.js";

// ── Gemini-specific body patterns ─────────────────────────────────

const GEMINI_PATTERNS: PatternDef[] = [
  { regex: /\{\{args\}\}/g, handler: () => ({ type: "arguments" }) },
  { regex: /!\{([^}]+)\}/g, handler: (m) => ({ type: "shell-command", command: m[1] }) },
  { regex: /@\{([^}]+)\}/g, handler: (m) => ({ type: "file-reference", path: m[1] }) },
  {
    regex: /\$([1-9])(?!\d)/g,
    handler: (m) => ({ type: "individual-argument", index: Number(m[1]) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 }),
  },
];

const GEMINI_SERIALIZERS: PlaceholderSerializers = {
  arguments: () => "{{args}}",
  "individual-argument": (p) => `$${p.index}`,
  "shell-command": (p) => `!{${p.command}}`,
  "file-reference": (p) => `@{${p.path}}`,
};

/** Placeholder types not natively supported by Gemini CLI */
const GEMINI_UNSUPPORTED: ReadonlySet<ContentPlaceholder["type"]> = new Set(["individual-argument"]);

// ── Converter constants ───────────────────────────────────────────

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

export class GeminiAgent implements AgentDefinition {
  // ── AgentConfig ───────────────────────────────────────────────────

  readonly displayName = "Gemini CLI";
  readonly dirs = {
    commandSubdir: "commands",
    skillSubdir: "skills",
    projectBase: ".gemini",
    userDefault: ".gemini",
  };
  readonly fileExtension = ".toml";

  // ── BodyParser ────────────────────────────────────────────────────

  parseBody(body: string): BodySegment[] {
    return parseBody(body, GEMINI_PATTERNS);
  }

  serializeBody(segments: BodySegment[]): string {
    return serializeBody(segments, GEMINI_SERIALIZERS, GEMINI_UNSUPPORTED);
  }

  // ── CommandParser ─────────────────────────────────────────────────

  async parseCommand(filePath: string): Promise<GeminiCommand> {
    try {
      const content = await readFile(filePath);
      const parsed = TOML.parse(content) as Record<string, unknown>;

      return {
        description: typeof parsed.description === "string" ? parsed.description : undefined,
        prompt: typeof parsed.prompt === "string" ? parsed.prompt : "",
        filePath,
        ...parsed,
      };
    } catch (error) {
      throw new ParseError(
        `Failed to parse Gemini command file: ${error instanceof Error ? error.message : String(error)}`,
        filePath,
        error instanceof Error ? error : undefined,
      );
    }
  }

  validateCommand(data: GeminiCommand): boolean {
    const errors = validateGeminiCommand(data);
    return errors.length === 0;
  }

  stringifyCommand(command: GeminiCommand): string {
    const tomlData: TOML.JsonMap = {};

    if (command.description !== undefined && command.description.trim().length > 0) {
      tomlData.description = command.description;
    }

    const excludeFields = new Set(["prompt", "description", "filePath"]);
    for (const [key, value] of Object.entries(command)) {
      if (!excludeFields.has(key) && value !== undefined && value !== null) {
        tomlData[key] = value as TOML.AnyJson;
      }
    }

    tomlData.prompt = command.prompt;

    try {
      return TOML.stringify(tomlData);
    } catch (error) {
      throw new ParseError(
        `Failed to stringify Gemini command: ${error instanceof Error ? error.message : String(error)}`,
        command.filePath,
        error instanceof Error ? error : undefined,
      );
    }
  }

  // ── CommandConverter ──────────────────────────────────────────────

  commandToIR(source: GeminiCommand, _options?: ConverterOptions): SemanticIR {
    const extras: Record<string, unknown> = {};
    let description: string | undefined;
    let from: string[] | undefined;

    for (const [key, value] of Object.entries(source)) {
      if (key === "prompt" || key === "filePath") continue;
      if (key === "description") {
        description = String(value);
      } else if (key === "_from") {
        from = Array.isArray(value) ? value : undefined;
      } else {
        extras[key] = value;
      }
    }

    return {
      contentType: "command",
      body: this.parseBody(source.prompt),
      semantic: { description, from },
      extras,
      meta: {
        sourcePath: source.filePath,
        sourceType: "gemini",
      },
    };
  }

  commandFromIR(ir: SemanticIR, options?: ConverterOptions): GeminiCommand {
    const result: GeminiCommand = {
      prompt: this.serializeBody(ir.body),
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

    if (ir.semantic.from !== undefined && ir.semantic.from.length > 0) {
      result._from = ir.semantic.from;
    }

    let filePath = ir.meta.sourcePath || "";
    if (!filePath.endsWith(FILE_EXTENSIONS.GEMINI)) {
      filePath = filePath.replace(/\.[^.]+$/, FILE_EXTENSIONS.GEMINI);
    }
    result.filePath = filePath;

    return result;
  }

  // ── SkillParser ───────────────────────────────────────────────────

  async parseSkill(dirPath: string): Promise<GeminiSkill> {
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
        `Failed to parse Gemini skill: ${error instanceof Error ? error.message : String(error)}`,
        dirPath,
        error instanceof Error ? error : undefined,
      );
    }
  }

  validateSkill(data: GeminiSkill): boolean {
    if (!data.content || typeof data.content !== "string") {
      return false;
    }
    if (!data.name || typeof data.name !== "string") {
      return false;
    }
    return true;
  }

  stringifySkill(skill: GeminiSkill): string {
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

  async writeSkillToDirectory(skill: GeminiSkill, sourceDirPath: string, targetDir: string): Promise<void> {
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

  skillToIR(source: GeminiSkill, _options?: ConverterOptions): SemanticIR {
    const extras: Record<string, unknown> = {};
    let modelInvocationEnabled: boolean | undefined;
    let from: string[] | undefined;

    for (const [key, value] of Object.entries(source.frontmatter)) {
      if (key === "name" || key === "description") continue;

      if (key === "disable-model-invocation") {
        modelInvocationEnabled = typeof value === "boolean" ? !value : undefined;
        continue;
      }

      if (key === "_from") {
        from = Array.isArray(value) ? value : undefined;
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
        sourceType: "gemini",
        supportFiles: source.supportFiles,
        skillName: source.name,
      },
    };
  }

  skillFromIR(ir: SemanticIR, options?: ConverterOptions): GeminiSkill {
    const skillName = ir.meta.skillName || "unnamed-skill";
    const supportFiles = ir.meta.supportFiles || [];

    const frontmatter: GeminiSkill["frontmatter"] = {};
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

    if (ir.semantic.from !== undefined && ir.semantic.from.length > 0) {
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

export function createGeminiAgent(): AgentDefinition {
  return new GeminiAgent();
}
