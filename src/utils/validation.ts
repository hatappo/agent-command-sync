import type { ClaudeCommand, GeminiCommand, ValidationFunction } from "../types/index.js";
import { ValidationError } from "../types/index.js";

/**
 * Claude Commandの詳細バリデーション
 */
export const validateClaudeCommand: ValidationFunction<ClaudeCommand> = (data) => {
  const errors: ValidationError[] = [];

  // ファイルパスの検証
  if (!data.filePath || typeof data.filePath !== "string") {
    errors.push(new ValidationError("File path is required and must be a string", "filePath", data.filePath));
  }

  // フロントマターの検証
  if (!data.frontmatter || typeof data.frontmatter !== "object") {
    errors.push(new ValidationError("Frontmatter is required and must be an object", "frontmatter", data.frontmatter));
  } else {
    const { frontmatter } = data;

    // allowed-tools フィールドの検証
    if (frontmatter["allowed-tools"] !== undefined) {
      if (typeof frontmatter["allowed-tools"] !== "string") {
        errors.push(
          new ValidationError(
            "allowed-tools must be a string",
            "frontmatter.allowed-tools",
            frontmatter["allowed-tools"],
          ),
        );
      }
    }

    // argument-hint フィールドの検証
    if (frontmatter["argument-hint"] !== undefined) {
      if (typeof frontmatter["argument-hint"] !== "string") {
        errors.push(
          new ValidationError(
            "argument-hint must be a string",
            "frontmatter.argument-hint",
            frontmatter["argument-hint"],
          ),
        );
      }
    }

    // description フィールドの検証
    if (frontmatter.description !== undefined) {
      if (typeof frontmatter.description !== "string") {
        errors.push(
          new ValidationError("description must be a string", "frontmatter.description", frontmatter.description),
        );
      } else if (frontmatter.description.trim().length === 0) {
        errors.push(
          new ValidationError("description cannot be empty", "frontmatter.description", frontmatter.description),
        );
      }
    }

    // model フィールドの検証
    if (frontmatter.model !== undefined) {
      if (typeof frontmatter.model !== "string") {
        errors.push(new ValidationError("model must be a string", "frontmatter.model", frontmatter.model));
      } else {
        const validModels = ["opus", "sonnet", "haiku"];
        if (!validModels.includes(frontmatter.model) && !frontmatter.model.includes("-")) {
          // 特定のモデル文字列も許可するため、ハイフンを含む場合は通す
          errors.push(
            new ValidationError(
              `model must be one of: ${validModels.join(", ")} or a specific model string`,
              "frontmatter.model",
              frontmatter.model,
            ),
          );
        }
      }
    }
  }

  // コンテンツの検証
  if (typeof data.content !== "string") {
    errors.push(new ValidationError("Content must be a string", "content", data.content));
  }

  return errors;
};

/**
 * Gemini Commandの詳細バリデーション
 */
export const validateGeminiCommand: ValidationFunction<GeminiCommand> = (data) => {
  const errors: ValidationError[] = [];

  // ファイルパスの検証
  if (!data.filePath || typeof data.filePath !== "string") {
    errors.push(new ValidationError("File path is required and must be a string", "filePath", data.filePath));
  }

  // prompt フィールドの検証（必須）
  if (!data.prompt) {
    errors.push(new ValidationError("prompt is required", "prompt", data.prompt));
  } else if (typeof data.prompt !== "string") {
    errors.push(new ValidationError("prompt must be a string", "prompt", data.prompt));
  } else if (data.prompt.trim().length === 0) {
    errors.push(new ValidationError("prompt cannot be empty", "prompt", data.prompt));
  }

  // description フィールドの検証（オプション）
  if (data.description !== undefined) {
    if (typeof data.description !== "string") {
      errors.push(new ValidationError("description must be a string", "description", data.description));
    } else if (data.description.trim().length === 0) {
      errors.push(new ValidationError("description cannot be empty", "description", data.description));
    }
  }

  return errors;
};

/**
 * ファイルパスの妥当性を検証
 */
export function validateFilePath(filePath: string): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!filePath || typeof filePath !== "string") {
    errors.push(new ValidationError("File path must be a non-empty string", "filePath", filePath));
    return errors;
  }

  // 危険な文字をチェック
  const dangerousChars = ["..", "<", ">", "|", "?", "*"];
  for (const char of dangerousChars) {
    if (filePath.includes(char)) {
      errors.push(new ValidationError(`File path contains dangerous character: ${char}`, "filePath", filePath));
    }
  }

  // 絶対パスかどうかをチェック（セキュリティ上の理由）
  if (filePath.startsWith("/") && !filePath.startsWith(process.cwd()) && !filePath.startsWith(process.env.HOME || "")) {
    errors.push(
      new ValidationError(
        "Absolute paths outside of current directory or home directory are not allowed",
        "filePath",
        filePath,
      ),
    );
  }

  return errors;
}

/**
 * バリデーションエラーを人間が読みやすい形式でフォーマット
 */
export function formatValidationErrors(errors: ValidationError[]): string {
  if (errors.length === 0) {
    return "No validation errors";
  }

  const errorMessages = errors.map(
    (error, index) =>
      `${index + 1}. ${error.field}: ${error.message}${error.value !== undefined ? ` (got: ${JSON.stringify(error.value)})` : ""}`,
  );

  return `Validation failed with ${errors.length} error(s):\n${errorMessages.join("\n")}`;
}
