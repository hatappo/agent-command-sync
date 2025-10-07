import matter from "gray-matter";
import type { CodexCommand, Parser } from "../types/index.js";
import { ParseError } from "../types/index.js";
import { readFile } from "../utils/file-utils.js";

/**
 * Codex CLI command parser
 * Handles markdown files with optional frontmatter
 */
export class CodexParser implements Parser<CodexCommand> {
  /**
   * Parse a Codex markdown file with optional frontmatter
   */
  async parse(filePath: string): Promise<CodexCommand> {
    try {
      const fileContent = await readFile(filePath);

      // Parse markdown with frontmatter
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

  /**
   * Validate a Codex command
   * Codex commands are valid if they have content
   */
  validate(data: CodexCommand): boolean {
    return typeof data.content === "string";
  }

  /**
   * Convert a Codex command to string format
   */
  stringify(command: CodexCommand): string {
    // If there's frontmatter, format it with gray-matter
    if (command.frontmatter && Object.keys(command.frontmatter).length > 0) {
      // Remove undefined values to avoid YAML serialization errors
      const cleanFrontmatter: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(command.frontmatter)) {
        if (value !== undefined) {
          cleanFrontmatter[key] = value;
        }
      }

      // Only include frontmatter if there are defined values
      if (Object.keys(cleanFrontmatter).length > 0) {
        return matter.stringify(command.content, cleanFrontmatter);
      }
    }
    // Otherwise return plain content
    return command.content;
  }
}
