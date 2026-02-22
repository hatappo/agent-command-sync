/**
 * Chimera virtual agent — lossless hub for cross-agent conversion
 *
 * File format: Claude-based (YAML frontmatter + Markdown body, Claude placeholder syntax)
 * with a `_chimera` section in frontmatter to store per-agent extras.
 */

import { mkdir, writeFile as fsWriteFile, copyFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import matter from "gray-matter";
import type { BodySegment } from "../types/body-segment.js";
import type { ChimeraCommand } from "../types/command.js";
import type { ChimeraSkill } from "../types/skill.js";
import { ParseError } from "../types/index.js";
import type { ConverterOptions, SemanticIR } from "../types/semantic-ir.js";
import { parseBody, serializeBody } from "../utils/body-segment-utils.js";
import { FILE_EXTENSIONS, SKILL_CONSTANTS } from "../utils/constants.js";
import { readFile, fileExists } from "../utils/file-utils.js";
import { collectSupportFiles, getSkillName, isSkillDirectory } from "../utils/skill-utils.js";
import { CLAUDE_SYNTAX_PATTERNS, CLAUDE_SYNTAX_SERIALIZERS } from "./_claude-syntax-body-patterns.js";
import type { AgentDefinition } from "./agent-definition.js";

const CHIMERA_KEY = "_chimera";
const SEMANTIC_COMMAND_FIELDS = ["description"] as const;
const SEMANTIC_SKILL_FIELDS = ["name", "description", "disable-model-invocation"] as const;

/** Filter out undefined/null values from a record (YAML serializer cannot handle undefined) */
function filterUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined && value !== null) {
      result[key] = value;
    }
  }
  return result;
}

export class ChimeraAgent implements AgentDefinition {
  // ── AgentConfig ───────────────────────────────────────────────────

  readonly displayName = "Chimera";
  readonly dirs = {
    commandSubdir: "commands",
    skillSubdir: "skills",
    projectBase: ".config/acsync",
    userDefault: ".config/acsync",
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

  async parseCommand(filePath: string): Promise<ChimeraCommand> {
    try {
      const content = await readFile(filePath);
      const parsed = matter(content);

      return {
        frontmatter: {
          description: parsed.data.description,
          [CHIMERA_KEY]: parsed.data[CHIMERA_KEY],
          ...parsed.data,
        },
        content: parsed.content,
        filePath,
      };
    } catch (error) {
      throw new ParseError(
        `Failed to parse Chimera command file: ${error instanceof Error ? error.message : String(error)}`,
        filePath,
        error instanceof Error ? error : undefined,
      );
    }
  }

  validateCommand(data: ChimeraCommand): boolean {
    return typeof data.content === "string" && typeof data.filePath === "string";
  }

  stringifyCommand(command: ChimeraCommand): string {
    const { frontmatter, content } = command;

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

  // ── CommandConverter ──────────────────────────────────────────────

  commandToIR(source: ChimeraCommand, options?: ConverterOptions): SemanticIR {
    const extras: Record<string, unknown> = {};
    let description: string | undefined;

    for (const [key, value] of Object.entries(source.frontmatter)) {
      if (key === CHIMERA_KEY) continue;
      if ((SEMANTIC_COMMAND_FIELDS as readonly string[]).includes(key)) {
        if (key === "description") description = value as string | undefined;
      } else {
        extras[key] = value;
      }
    }

    // If destinationType is specified, use that agent's extras from _chimera section
    const chimeraSection = source.frontmatter[CHIMERA_KEY];
    const destType = options?.destinationType;
    let resolvedExtras: Record<string, unknown> = extras;

    if (destType && destType !== "chimera" && chimeraSection?.[destType]) {
      resolvedExtras = { ...extras, ...chimeraSection[destType] };
    }

    return {
      contentType: "command",
      body: this.parseBody(source.content),
      semantic: { description },
      extras: resolvedExtras,
      meta: {
        sourcePath: source.filePath,
        sourceType: "chimera",
      },
    };
  }

  commandFromIR(ir: SemanticIR, options?: ConverterOptions): ChimeraCommand {
    const frontmatter: ChimeraCommand["frontmatter"] = {};

    // Set semantic fields at top level
    if (ir.semantic.description !== undefined) {
      frontmatter.description = ir.semantic.description;
    }

    // Build _chimera section by merging with existing target
    const existingChimera = this.getExistingChimeraSection(options?.existingTarget, "command");
    const sourceType = ir.meta.sourceType;

    if (sourceType && sourceType !== "chimera") {
      const cleanExtras = filterUndefined(ir.extras);
      if (Object.keys(cleanExtras).length > 0) {
        existingChimera[sourceType] = cleanExtras;
      }
    }

    if (Object.keys(existingChimera).length > 0) {
      frontmatter[CHIMERA_KEY] = existingChimera;
    }

    let filePath = ir.meta.sourcePath || "";
    if (!filePath.endsWith(FILE_EXTENSIONS.CHIMERA)) {
      filePath = filePath.replace(/\.[^.]+$/, FILE_EXTENSIONS.CHIMERA);
    }

    return { frontmatter, content: this.serializeBody(ir.body), filePath };
  }

  // ── SkillParser ───────────────────────────────────────────────────

  async parseSkill(dirPath: string): Promise<ChimeraSkill> {
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
          "disable-model-invocation": parsed.data["disable-model-invocation"],
          [CHIMERA_KEY]: parsed.data[CHIMERA_KEY],
          ...parsed.data,
        },
      };
    } catch (error) {
      throw new ParseError(
        `Failed to parse Chimera skill: ${error instanceof Error ? error.message : String(error)}`,
        dirPath,
        error instanceof Error ? error : undefined,
      );
    }
  }

  validateSkill(data: ChimeraSkill): boolean {
    if (!data.content || typeof data.content !== "string") {
      return false;
    }
    if (!data.name || typeof data.name !== "string") {
      return false;
    }
    return true;
  }

  stringifySkill(skill: ChimeraSkill): string {
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

  async writeSkillToDirectory(skill: ChimeraSkill, sourceDirPath: string, targetDir: string): Promise<void> {
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

  skillToIR(source: ChimeraSkill, options?: ConverterOptions): SemanticIR {
    const extras: Record<string, unknown> = {};
    const fm = source.frontmatter;

    for (const [key, value] of Object.entries(fm)) {
      if (key === CHIMERA_KEY) continue;
      if (!(SEMANTIC_SKILL_FIELDS as readonly string[]).includes(key)) {
        extras[key] = value;
      }
    }

    // If destinationType is specified, use that agent's extras from _chimera section
    const chimeraSection = fm[CHIMERA_KEY];
    const destType = options?.destinationType;
    let resolvedExtras: Record<string, unknown> = extras;

    if (destType && destType !== "chimera" && chimeraSection?.[destType]) {
      resolvedExtras = { ...extras, ...chimeraSection[destType] };
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
      extras: resolvedExtras,
      meta: {
        sourcePath: source.dirPath,
        sourceType: "chimera",
        supportFiles: source.supportFiles,
        skillName: source.name,
      },
    };
  }

  skillFromIR(ir: SemanticIR, options?: ConverterOptions): ChimeraSkill {
    const skillName = ir.meta.skillName || "unnamed-skill";
    const supportFiles = ir.meta.supportFiles || [];

    const frontmatter: ChimeraSkill["frontmatter"] = {};

    // Set semantic fields at top level
    if (ir.semantic.name !== undefined) frontmatter.name = ir.semantic.name;
    if (ir.semantic.description !== undefined) frontmatter.description = ir.semantic.description;
    if (ir.semantic.modelInvocationEnabled !== undefined) {
      frontmatter["disable-model-invocation"] = !ir.semantic.modelInvocationEnabled;
    }

    // Build _chimera section by merging with existing target
    const existingChimera = this.getExistingChimeraSection(options?.existingTarget, "skill");
    const sourceType = ir.meta.sourceType;

    if (sourceType && sourceType !== "chimera") {
      const cleanExtras = filterUndefined(ir.extras);
      if (Object.keys(cleanExtras).length > 0) {
        existingChimera[sourceType] = cleanExtras;
      }
    }

    if (Object.keys(existingChimera).length > 0) {
      frontmatter[CHIMERA_KEY] = existingChimera;
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

  // ── Private helpers ───────────────────────────────────────────────

  private getExistingChimeraSection(
    existingTarget: unknown,
    type: "command" | "skill",
  ): Record<string, Record<string, unknown>> {
    if (!existingTarget) return {};

    try {
      if (type === "command") {
        const existing = existingTarget as ChimeraCommand;
        return existing.frontmatter?.[CHIMERA_KEY]
          ? structuredClone(existing.frontmatter[CHIMERA_KEY])
          : {};
      }
      const existing = existingTarget as ChimeraSkill;
      return existing.frontmatter?.[CHIMERA_KEY]
        ? structuredClone(existing.frontmatter[CHIMERA_KEY])
        : {};
    } catch {
      return {};
    }
  }
}

export function createChimeraAgent(): AgentDefinition {
  return new ChimeraAgent();
}
