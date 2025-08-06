import type { ClaudeCommand, ConversionOptions, Converter, GeminiCommand } from "../types/index.js";
import { ConversionError } from "../types/index.js";

export class G2CConverter implements Converter<GeminiCommand, ClaudeCommand> {
  /**
   * Gemini CommandをClaude Commandに変換
   */
  convert(source: GeminiCommand, options: ConversionOptions): ClaudeCommand {
    try {
      // フロントマターの構築
      const frontmatter: ClaudeCommand["frontmatter"] = {};

      // descriptionフィールドのマッピング
      if (source.description) {
        frontmatter.description = source.description;
      }

      // Claude固有フィールドの復元
      this.restoreClaudeSpecificFields(source, frontmatter, options);

      // 基本フィールドマッピング
      const result: ClaudeCommand = {
        frontmatter,
        content: this.convertPrompt(source.prompt, options),
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
  private convertPrompt(prompt: string, options: ConversionOptions): string {
    let convertedContent = prompt;

    // {{args}} → $ARGUMENTS の変換
    convertedContent = this.convertArgumentPlaceholder(convertedContent);

    // !{command} → !command の変換
    convertedContent = this.convertShellCommands(convertedContent);

    return convertedContent;
  }

  /**
   * 引数プレースホルダーを変換
   */
  private convertArgumentPlaceholder(content: string): string {
    return content.replace(/\{\{args\}\}/g, "$ARGUMENTS");
  }

  /**
   * シェルコマンド構文を変換
   */
  private convertShellCommands(content: string): string {
    // !{command} → !`command` の変換
    return content.replace(/!\{([^}]+)\}/g, "!`$1`");
  }

  /**
   * ファイルパスを変換（.toml → .md）
   */
  private convertFilePath(geminiPath: string): string {
    return geminiPath.replace(/\.toml$/, ".md");
  }

  /**
   * Claude固有フィールドを復元
   */
  private restoreClaudeSpecificFields(
    source: GeminiCommand,
    frontmatter: ClaudeCommand["frontmatter"],
    options: ConversionOptions,
  ): void {
    const claudeSpecificFields = ["allowed-tools", "argument-hint", "model"];

    // Claude固有フィールドをそのまま復元
    for (const field of claudeSpecificFields) {
      const value = source[field];
      if (value !== undefined) {
        frontmatter[field] = value;
      }
    }
  }
}
