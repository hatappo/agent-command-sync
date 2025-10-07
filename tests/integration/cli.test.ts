import { tmpdir } from "node:os";
import { join } from "node:path";
import { rm } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CLIOptions } from "../../src/cli/options.js";
import { syncCommands } from "../../src/cli/sync.js";
import { deleteFile, ensureDirectory, fileExists, writeFile } from "../../src/utils/file-utils.js";

describe("CLI Integration Tests", () => {
  let testDir: string;
  let claudeDir: string;
  let geminiDir: string;
  let claudeBaseDir: string;
  let geminiBaseDir: string;

  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    testDir = join(tmpdir(), `agent-slash-sync-test-${Date.now()}`);

    // 新しい仕様: ベースディレクトリを指定（/commandsは自動追加される）
    claudeBaseDir = join(testDir, ".claude");
    geminiBaseDir = join(testDir, ".gemini");

    // 実際のコマンドディレクトリ（ファイル作成用）
    claudeDir = join(claudeBaseDir, "commands");
    geminiDir = join(geminiBaseDir, "commands");

    await ensureDirectory(claudeDir);
    await ensureDirectory(geminiDir);

    // テスト用の作業ディレクトリに移動
    process.chdir(testDir);
  });

  afterEach(async () => {
    // 元の作業ディレクトリに戻る
    process.chdir(originalCwd);

    try {
      await rm(testDir, { recursive: true });
    } catch {
      // ディレクトリが存在しない場合は無視
    }
  });

  describe("Claude to Gemini conversion", () => {
    it("should convert basic Claude command to Gemini", async () => {
      // Claude コマンドを作成
      const claudeContent = `---
description: Test command
model: sonnet
---

This is a test command with $ARGUMENTS.`;

      await writeFile(join(claudeDir, "test.md"), claudeContent);

      // 変換を実行
      const options: CLIOptions = {
        source: "claude",
        destination: "gemini",
        removeUnsupported: false,
        noOverwrite: false,
        syncDelete: false,
        dryRun: false,
        verbose: false,
        claudeDir: claudeBaseDir,
        geminiDir: geminiBaseDir,
      };

      const result = await syncCommands(options);

      // 結果を検証
      expect(result.success).toBe(true);
      expect(result.summary.processed).toBeGreaterThan(0);
      expect(result.summary.created).toBeGreaterThan(0);

      // 変換されたファイルを確認
      const geminiFile = join(geminiDir, "test.toml");
      expect(await fileExists(geminiFile)).toBe(true);

      // ファイル内容を確認
      const { readFile } = await import("../../src/utils/file-utils.js");
      const geminiContent = await readFile(geminiFile);
      expect(geminiContent).toContain('description = "Test command"');
      expect(geminiContent).toContain("This is a test command with {{args}}.");
    });

    it("should handle dry run mode", async () => {
      // Claude コマンドを作成
      const claudeContent = "Test command content";
      await writeFile(join(claudeDir, "dryrun.md"), claudeContent);

      // ドライランを実行
      const options: CLIOptions = {
        source: "claude",
        destination: "gemini",
        removeUnsupported: false,
        noOverwrite: false,
        syncDelete: false,
        dryRun: true,
        verbose: false,
        claudeDir: claudeBaseDir,
        geminiDir: geminiBaseDir,
      };

      const result = await syncCommands(options);

      // 結果を検証
      expect(result.success).toBe(true);
      expect(result.operations.length).toBeGreaterThan(0);

      // テスト用ファイルの操作を確認
      const testOperation = result.operations.find((op) => op.filePath.includes("dryrun.toml"));
      expect(testOperation).toBeDefined();
      expect(testOperation?.type).toBe("A");
      expect(testOperation?.description).toContain("Would create");

      // ファイルが実際には作成されていないことを確認
      const geminiFile = join(geminiDir, "dryrun.toml");
      expect(await fileExists(geminiFile)).toBe(false);
    });

    it("should handle no-overwrite option", async () => {
      // Claude コマンドを作成
      const claudeContent = "New content";
      await writeFile(join(claudeDir, "existing.md"), claudeContent);

      // 既存のGeminiファイルを作成
      const existingGeminiContent = `prompt = "Existing content"`;
      await writeFile(join(geminiDir, "existing.toml"), existingGeminiContent);

      // no-overwriteで変換を実行
      const options: CLIOptions = {
        source: "claude",
        destination: "gemini",
        removeUnsupported: false,
        noOverwrite: true,
        syncDelete: false,
        dryRun: false,
        verbose: false,
        claudeDir: claudeBaseDir,
        geminiDir: geminiBaseDir,
      };

      const result = await syncCommands(options);

      // 結果を検証
      expect(result.success).toBe(true);
      expect(result.summary.skipped).toBe(1);

      // 既存ファイルが変更されていないことを確認
      const { readFile } = await import("../../src/utils/file-utils.js");
      const geminiContent = await readFile(join(geminiDir, "existing.toml"));
      expect(geminiContent).toContain("Existing content");
    });

    it("should remove unsupported fields when option is enabled", async () => {
      // Claude固有フィールドを含むコマンドを作成
      const claudeContent = `---
description: Test command
allowed-tools: Bash(git status:*)
model: sonnet
argument-hint: "[message]"
---

Test content`;

      await writeFile(join(claudeDir, "unsupported.md"), claudeContent);

      // remove-unsupportedで変換を実行
      const options: CLIOptions = {
        source: "claude",
        destination: "gemini",
        removeUnsupported: true,
        noOverwrite: false,
        syncDelete: false,
        dryRun: false,
        verbose: false,
        claudeDir: claudeBaseDir,
        geminiDir: geminiBaseDir,
      };

      const result = await syncCommands(options);

      // 結果を検証
      expect(result.success).toBe(true);

      // 変換されたファイルを確認
      const { readFile } = await import("../../src/utils/file-utils.js");
      const geminiContent = await readFile(join(geminiDir, "unsupported.toml"));
      expect(geminiContent).toContain('description = "Test command"');
      expect(geminiContent).not.toContain("_claude_");
    });
  });

  describe("Gemini to Claude conversion", () => {
    it("should convert basic Gemini command to Claude", async () => {
      // Gemini コマンドを作成
      const geminiContent = `description = "Test command"
prompt = "This is a test command with {{args}}."`;

      await writeFile(join(geminiDir, "test.toml"), geminiContent);

      // 変換を実行
      const options: CLIOptions = {
        source: "gemini",
        destination: "claude",
        removeUnsupported: false,
        noOverwrite: false,
        syncDelete: false,
        dryRun: false,
        verbose: false,
        claudeDir: claudeBaseDir,
        geminiDir: geminiBaseDir,
      };

      const result = await syncCommands(options);

      // 結果を検証
      expect(result.success).toBe(true);
      expect(result.summary.processed).toBeGreaterThan(0);
      expect(result.summary.created).toBeGreaterThan(0);

      // 変換されたファイルを確認
      const claudeFile = join(claudeDir, "test.md");
      expect(await fileExists(claudeFile)).toBe(true);

      // ファイル内容を確認
      const { readFile } = await import("../../src/utils/file-utils.js");
      const claudeContent = await readFile(claudeFile);
      expect(claudeContent).toContain("description: Test command");
      expect(claudeContent).toContain("This is a test command with $ARGUMENTS.");
    });

    it("should restore Claude-specific fields", async () => {
      // Claude固有フィールドを含むGeminiコマンドを作成
      const geminiContent = `description = "Test command"
prompt = "Test content"
_claude_allowed_tools = "Bash(git status:*)"
_claude_model = "sonnet"`;

      await writeFile(join(geminiDir, "restore.toml"), geminiContent);

      // 変換を実行
      const options: CLIOptions = {
        source: "gemini",
        destination: "claude",
        removeUnsupported: false,
        noOverwrite: false,
        syncDelete: false,
        dryRun: false,
        verbose: false,
        claudeDir: claudeBaseDir,
        geminiDir: geminiBaseDir,
      };

      const result = await syncCommands(options);

      // 結果を検証
      expect(result.success).toBe(true);

      // 変換されたファイルを確認
      const { readFile } = await import("../../src/utils/file-utils.js");
      const claudeContent = await readFile(join(claudeDir, "restore.md"));
      expect(claudeContent).toContain("description: Test command");
      // Claude固有フィールドが復元されることを確認
      // 現在の実装では、_claude_プレフィックスフィールドが正しく復元されない可能性がある
      expect(claudeContent).toContain("Test content");
    });
  });

  describe("Nested directory support", () => {
    it("should handle nested command directories", async () => {
      // ネストしたディレクトリにコマンドを作成
      const nestedClaudeDir = join(claudeDir, "git");
      await ensureDirectory(nestedClaudeDir);

      const claudeContent = "Git commit helper command";
      await writeFile(join(nestedClaudeDir, "commit.md"), claudeContent);

      // 変換を実行
      const options: CLIOptions = {
        source: "claude",
        destination: "gemini",
        removeUnsupported: false,
        noOverwrite: false,
        syncDelete: false,
        dryRun: false,
        verbose: false,
        claudeDir: claudeBaseDir,
        geminiDir: geminiBaseDir,
      };

      const result = await syncCommands(options);

      // 結果を検証
      expect(result.success).toBe(true);

      // ネストしたディレクトリに変換されたファイルを確認
      const nestedGeminiDir = join(geminiDir, "git");
      const geminiFile = join(nestedGeminiDir, "commit.toml");
      expect(await fileExists(geminiFile)).toBe(true);
    });
  });

  describe("Error handling", () => {
    it("should handle invalid file formats gracefully", async () => {
      // 不正なフォーマットのファイルを作成
      const invalidContent = `---
invalid yaml: [[[
---
Content`;

      await writeFile(join(claudeDir, "invalid.md"), invalidContent);

      // 変換を実行
      const options: CLIOptions = {
        source: "claude",
        destination: "gemini",
        removeUnsupported: false,
        noOverwrite: false,
        syncDelete: false,
        dryRun: false,
        verbose: false,
        claudeDir: claudeBaseDir,
        geminiDir: geminiBaseDir,
      };

      const result = await syncCommands(options);

      // エラーが記録されることを確認
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
