/**
 * Codex CLI Skill Parser
 * Parses SKILL.md files with optional agents/openai.yaml
 */

import { mkdir, writeFile as fsWriteFile, copyFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import matter from "gray-matter";
import YAML from "yaml";
import type { CodexSkill, CodexOpenAIConfig, Parser, SupportFile } from "../types/index.js";
import { ParseError } from "../types/index.js";
import { SKILL_CONSTANTS } from "../utils/constants.js";
import { readFile, fileExists } from "../utils/file-utils.js";
import { collectSupportFiles, getSkillName, isSkillDirectory } from "../utils/skill-utils.js";

export class CodexSkillParser implements Parser<CodexSkill> {
  /**
   * Parse a skill directory and generate a CodexSkill object
   */
  async parse(dirPath: string): Promise<CodexSkill> {
    try {
      // Verify this is a valid skill directory
      if (!(await isSkillDirectory(dirPath))) {
        throw new Error(`Not a valid skill directory: missing ${SKILL_CONSTANTS.SKILL_FILE_NAME}`);
      }

      const skillFilePath = join(dirPath, SKILL_CONSTANTS.SKILL_FILE_NAME);
      const content = await readFile(skillFilePath);
      const parsed = matter(content);

      // Try to parse openai.yaml if it exists
      const openaiConfig = await this.parseOpenAIConfig(dirPath);

      // Collect support files (exclude openai.yaml from processing)
      const supportFiles = await collectSupportFiles(dirPath, [
        SKILL_CONSTANTS.SKILL_FILE_NAME,
        join(SKILL_CONSTANTS.CODEX_CONFIG_DIR, SKILL_CONSTANTS.CODEX_CONFIG_FILE),
      ]);

      // Load text content for text files
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
          ...parsed.data, // Preserve other fields
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

  /**
   * Parse agents/openai.yaml configuration
   */
  private async parseOpenAIConfig(dirPath: string): Promise<CodexOpenAIConfig | undefined> {
    const configPath = join(dirPath, SKILL_CONSTANTS.CODEX_CONFIG_DIR, SKILL_CONSTANTS.CODEX_CONFIG_FILE);

    if (!(await fileExists(configPath))) {
      return undefined;
    }

    try {
      const content = await readFile(configPath);
      return YAML.parse(content) as CodexOpenAIConfig;
    } catch {
      // Return undefined if YAML parsing fails
      return undefined;
    }
  }

  /**
   * Validate a CodexSkill object
   */
  validate(data: CodexSkill): boolean {
    // Basic validation: must have content
    if (!data.content || typeof data.content !== "string") {
      return false;
    }
    // Must have a name
    if (!data.name || typeof data.name !== "string") {
      return false;
    }
    return true;
  }

  /**
   * Convert a CodexSkill object to SKILL.md format
   */
  stringify(skill: CodexSkill): string {
    const { frontmatter, content } = skill;

    // Filter out undefined/null values from frontmatter
    const cleanFrontmatter: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(frontmatter)) {
      if (value !== undefined && value !== null) {
        cleanFrontmatter[key] = value;
      }
    }

    // Output without frontmatter if empty
    const hasValidFrontmatter = Object.keys(cleanFrontmatter).length > 0;

    if (!hasValidFrontmatter) {
      return content;
    }

    return matter.stringify(content, cleanFrontmatter);
  }

  /**
   * Stringify openai.yaml configuration
   */
  stringifyOpenAIConfig(config: CodexOpenAIConfig): string {
    return YAML.stringify(config);
  }

  /**
   * Write a skill to a directory
   */
  async writeToDirectory(skill: CodexSkill, targetDir: string): Promise<void> {
    // Ensure directory exists
    await mkdir(targetDir, { recursive: true });

    // Write SKILL.md
    const skillContent = this.stringify(skill);
    await fsWriteFile(join(targetDir, SKILL_CONSTANTS.SKILL_FILE_NAME), skillContent, "utf-8");

    // Write openai.yaml if present
    if (skill.openaiConfig) {
      const configDir = join(targetDir, SKILL_CONSTANTS.CODEX_CONFIG_DIR);
      await mkdir(configDir, { recursive: true });
      const configContent = this.stringifyOpenAIConfig(skill.openaiConfig);
      await fsWriteFile(join(configDir, SKILL_CONSTANTS.CODEX_CONFIG_FILE), configContent, "utf-8");
    }

    // Copy support files
    for (const file of skill.supportFiles) {
      const targetPath = join(targetDir, file.relativePath);
      await mkdir(dirname(targetPath), { recursive: true });

      if (file.type === "binary") {
        // For binary files, copy from source
        const sourcePath = join(skill.dirPath, file.relativePath);
        if (await fileExists(sourcePath)) {
          await copyFile(sourcePath, targetPath);
        }
      } else if (file.content !== undefined) {
        // For text files, write content
        await fsWriteFile(targetPath, file.content, "utf-8");
      }
    }
  }
}
