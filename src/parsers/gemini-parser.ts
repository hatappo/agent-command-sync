import * as TOML from "@iarna/toml";
import type { GeminiCommand, Parser } from "../types/index.js";
import { ParseError } from "../types/index.js";
import { readFile } from "../utils/file-utils.js";
import { formatValidationErrors, validateGeminiCommand } from "../utils/validation.js";

export class GeminiParser implements Parser<GeminiCommand> {
  /**
   * TOMLファイルを解析してGeminiCommandオブジェクトを生成
   */
  async parse(filePath: string): Promise<GeminiCommand> {
    try {
      const content = await readFile(filePath);
      const parsed = TOML.parse(content) as Record<string, unknown>;

      return {
        description: typeof parsed.description === "string" ? parsed.description : undefined,
        prompt: typeof parsed.prompt === "string" ? parsed.prompt : "",
        filePath,
        ...parsed, // その他のフィールドも保持
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
   * GeminiCommandオブジェクトの妥当性を検証
   */
  validate(data: GeminiCommand): boolean {
    const errors = validateGeminiCommand(data);
    return errors.length === 0;
  }

  /**
   * GeminiCommandオブジェクトの詳細バリデーション（エラー詳細付き）
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
   * GeminiCommandオブジェクトをTOML形式に変換
   */
  stringify(command: GeminiCommand): string {
    const tomlData: TOML.JsonMap = {};

    // descriptionが存在する場合のみ追加
    if (command.description !== undefined && command.description.trim().length > 0) {
      tomlData.description = command.description;
    }

    // その他のフィールド（Claude固有フィールドなど）を追加
    const excludeFields = new Set(["prompt", "description", "filePath"]);
    for (const [key, value] of Object.entries(command)) {
      if (!excludeFields.has(key) && value !== undefined && value !== null) {
        tomlData[key] = value as TOML.AnyJson;
      }
    }

    // promptフィールドを最後に追加
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
