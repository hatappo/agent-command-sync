import type { ClaudeCommand, ConversionOptions, Converter, GeminiCommand } from "../types/index.js";
import { ConversionError } from "../types/index.js";
import { CLAUDE_SPECIFIC_FIELDS, FILE_EXTENSIONS } from "../utils/constants.js";
import { convertGeminiToClaudePlaceholders } from "../utils/placeholder-utils.js";

export class G2CConverter implements Converter<GeminiCommand, ClaudeCommand> {
  /**
   * Gemini CommandをClaude Commandに変換
   */
  convert(source: GeminiCommand, _options: ConversionOptions): ClaudeCommand {
    try {
      // フロントマターの構築
      const frontmatter: ClaudeCommand["frontmatter"] = {};

      // descriptionフィールドのマッピング
      if (source.description) {
        frontmatter.description = source.description;
      }

      // Claude固有フィールドの復元
      this.restoreClaudeSpecificFields(source, frontmatter);

      // 基本フィールドマッピング
      const result: ClaudeCommand = {
        frontmatter,
        content: this.convertPrompt(source.prompt),
        filePath: this.convertFilePath(source.filePath),
      };

      return result;
    } catch (error) {
      throw new ConversionError(
        `Failed to convert Gemini command to Claude format: ${error instanceof Error ? error.message : String(error)}`,
        source.filePath,
        undefined,
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * プロンプト内容を変換（プレースホルダー変換含む）
   */
  private convertPrompt(prompt: string): string {
    return convertGeminiToClaudePlaceholders(prompt);
  }

  /**
   * ファイルパスを変換（.toml → .md）
   */
  private convertFilePath(geminiPath: string): string {
    return geminiPath.replace(/\.toml$/, FILE_EXTENSIONS.CLAUDE);
  }

  /**
   * Claude固有フィールドを復元
   */
  private restoreClaudeSpecificFields(source: GeminiCommand, frontmatter: ClaudeCommand["frontmatter"]): void {
    const claudeSpecificFields = CLAUDE_SPECIFIC_FIELDS;

    // Claude固有フィールドをそのまま復元
    for (const field of claudeSpecificFields) {
      const value = source[field];
      if (value !== undefined) {
        frontmatter[field] = value;
      }
    }
  }
}
