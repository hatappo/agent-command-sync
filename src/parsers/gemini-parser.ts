import * as TOML from "@iarna/toml";
import type { GeminiCommand, Parser } from "../types/index.js";
import { ParseError } from "../types/index.js";
import { readFile } from "../utils/file-utils.js";
import { formatValidationErrors, validateGeminiCommand } from "../utils/validation.js";

export class GeminiParser implements Parser<GeminiCommand> {
  /**
   * Parse a TOML file and generate a GeminiCommand object
   */
  async parse(filePath: string): Promise<GeminiCommand> {
    try {
      const content = await readFile(filePath);
      const parsed = TOML.parse(content) as Record<string, unknown>;

      return {
        description: typeof parsed.description === "string" ? parsed.description : undefined,
        prompt: typeof parsed.prompt === "string" ? parsed.prompt : "",
        filePath,
        ...parsed, // Preserve other fields
      };
    } catch (error) {
      throw new ParseError(
        `Failed to parse Gemini command file: ${error instanceof Error ? error.message : String(error)}`,
        filePath,
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Validate a GeminiCommand object
   */
  validate(data: GeminiCommand): boolean {
    const errors = validateGeminiCommand(data);
    return errors.length === 0;
  }

  /**
   * Detailed validation of a GeminiCommand object (with error details)
   */
  validateWithErrors(data: GeminiCommand): {
    isValid: boolean;
    errors: string;
  } {
    const errors = validateGeminiCommand(data);
    return {
      isValid: errors.length === 0,
      errors: formatValidationErrors(errors),
    };
  }

  /**
   * Convert a GeminiCommand object to TOML format
   */
  stringify(command: GeminiCommand): string {
    const tomlData: TOML.JsonMap = {};

    // Add description only if it exists
    if (command.description !== undefined && command.description.trim().length > 0) {
      tomlData.description = command.description;
    }

    // Add other fields (such as Claude-specific fields)
    const excludeFields = new Set(["prompt", "description", "filePath"]);
    for (const [key, value] of Object.entries(command)) {
      if (!excludeFields.has(key) && value !== undefined && value !== null) {
        tomlData[key] = value as TOML.AnyJson;
      }
    }

    // Add prompt field at the end
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
}
