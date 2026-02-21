import matter from "gray-matter";
import type { OpenCodeCommand, Parser } from "../types/index.js";
import { ParseError } from "../types/index.js";
import { readFile } from "../utils/file-utils.js";

/**
 * OpenCode command parser
 * Handles markdown files with optional YAML frontmatter
 */
export class OpenCodeParser implements Parser<OpenCodeCommand> {
  /**
   * Parse an OpenCode markdown file with optional frontmatter
   */
  async parse(filePath: string): Promise<OpenCodeCommand> {
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
        `Failed to parse OpenCode command file: ${error instanceof Error ? error.message : String(error)}`,
        filePath,
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Validate an OpenCode command
   * OpenCode commands are valid if they have content
   */
  validate(data: OpenCodeCommand): boolean {
    return typeof data.content === "string";
  }

  /**
   * Convert an OpenCode command to string format
   */
  stringify(command: OpenCodeCommand): string {
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
