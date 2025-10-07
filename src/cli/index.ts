#!/usr/bin/env node

import { Command } from "commander";
import picocolors from "picocolors";
import { version } from "../../package.json" assert { type: "json" };
import { validateCLIOptions } from "./options.js";
import { syncCommands } from "./sync.js";

const program = new Command();

program
  .name("agent-slash-sync")
  .description("Convert Custom Slash Commands between Claude Code and Gemini CLI")
  .version(version);

program
  .requiredOption("-s, --src <product>", "Source product: claude or gemini")
  .requiredOption("-d, --dest <product>", "Destination product: claude or gemini")
  .option("--remove-unsupported", "Remove keys that are not supported in the target format", false)
  .option("--no-overwrite", "Skip conversion if a command with the same name exists in the target")
  .option("--sync-delete", "Delete commands in the target that don't exist in the source", false)
  .option("-f, --file <filename>", "Convert only the specified command file (without extension)")
  .option("--dry-run", "Display a list of changes without applying them", false)
  .option("-v, --verbose", "Show detailed debug information", false)
  .option("--claude-dir <path>", "Claude base directory (default: ~/.claude)")
  .option("--gemini-dir <path>", "Gemini base directory (default: ~/.gemini)")
  .action(async (options) => {
    try {
      // Check if source and destination are the same
      if (options.src === options.dest) {
        console.error(picocolors.red(picocolors.bold("Error:")), picocolors.red("Source and destination must be different"));
        process.exit(1);
      }

      // オプションを整理
      const syncOptions = {
        source: options.src as "claude" | "gemini",
        destination: options.dest as "claude" | "gemini",
        removeUnsupported: options.removeUnsupported,
        noOverwrite: !options.overwrite, // commander.jsのno-prefixは逆転する
        syncDelete: options.syncDelete,
        file: options.file,
        dryRun: options.dryRun,
        verbose: options.verbose,
        claudeDir: options.claudeDir,
        geminiDir: options.geminiDir,
      };

      // Verboseモードでデバッグ情報を表示
      if (options.verbose) {
        console.log("DEBUG: Raw options:", options);
        console.log("DEBUG: Processed options:", syncOptions);
      }

      // オプションの検証
      const validationErrors = validateCLIOptions(syncOptions);
      if (validationErrors.length > 0) {
        console.error(picocolors.red(picocolors.bold("Validation errors:")));
        for (const error of validationErrors) {
          console.error(picocolors.red(`  ✗ ${error}`));
        }
        console.error(picocolors.dim("\nUse --help for usage information."));
        process.exit(1);
      }

      await syncCommands(syncOptions);
    } catch (error) {
      if (error instanceof Error) {
        console.error(picocolors.red(picocolors.bold("Error:")), picocolors.red(error.message));

        // デバッグ情報を表示（開発時）
        if (process.env.NODE_ENV === "development") {
          console.error(picocolors.gray("Stack trace:"), error.stack);
        }
      } else {
        console.error(picocolors.red(picocolors.bold("Unknown error:")), picocolors.red(String(error)));
      }
      process.exit(1);
    }
  });

// ヘルプの改善
program.on("--help", () => {
  console.log("");
  console.log("Examples:");
  console.log("  $ agent-slash-sync -s claude -d gemini               # Convert all Claude commands to Gemini");
  console.log("  $ agent-slash-sync -s gemini -d claude --dry-run     # Preview Gemini to Claude conversion");
  console.log("  $ agent-slash-sync -s claude -d gemini --file mycommand   # Convert specific file");
  console.log("  $ agent-slash-sync -s claude -d gemini --remove-unsupported # Remove unsupported fields");
  console.log("  $ agent-slash-sync -s gemini -d claude --no-overwrite     # Skip existing files");
  console.log("  $ agent-slash-sync -s claude -d gemini --sync-delete      # Delete orphaned files");
  console.log("  $ agent-slash-sync -s claude -d gemini --verbose          # Show detailed debug information");
  console.log("  $ agent-slash-sync -s claude -d gemini --claude-dir ~/my-claude # Use custom Claude base directory");
  console.log("  $ agent-slash-sync -s gemini -d claude --gemini-dir ~/my-gemini # Use custom Gemini base directory");
});

program.parse();
