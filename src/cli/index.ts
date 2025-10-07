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
  .requiredOption("-s, --src <product>", "Source product: claude, gemini, or codex")
  .requiredOption("-d, --dest <product>", "Destination product: claude, gemini, or codex")
  .option("--remove-unsupported", "Remove keys that are not supported in the target format", false)
  .option("--no-overwrite", "Skip conversion if a command with the same name exists in the target")
  .option("--sync-delete", "Delete commands in the target that don't exist in the source", false)
  .option("-f, --file <filename>", "Convert only the specified command file (without extension)")
  .option("-n, --noop", "Display a list of changes without applying them", false)
  .option("-v, --verbose", "Show detailed debug information", false)
  .option("--claude-dir <path>", "Claude base directory (default: ~/.claude)")
  .option("--gemini-dir <path>", "Gemini base directory (default: ~/.gemini)")
  .option("--codex-dir <path>", "Codex base directory (default: ~/.codex)")
  .action(async (options) => {
    try {
      // Check if source and destination are the same
      if (options.src === options.dest) {
        console.error(
          picocolors.red(picocolors.bold("Error:")),
          picocolors.red("Source and destination must be different"),
        );
        process.exit(1);
      }

      // Organize options
      const syncOptions = {
        source: options.src as "claude" | "gemini" | "codex",
        destination: options.dest as "claude" | "gemini" | "codex",
        removeUnsupported: options.removeUnsupported,
        noOverwrite: !options.overwrite, // commander.js no-prefix reverses the value
        syncDelete: options.syncDelete,
        file: options.file,
        noop: options.noop,
        verbose: options.verbose,
        claudeDir: options.claudeDir,
        geminiDir: options.geminiDir,
        codexDir: options.codexDir,
      };

      // Display debug information in verbose mode
      if (options.verbose) {
        console.log("DEBUG: Raw options:", options);
        console.log("DEBUG: Processed options:", syncOptions);
      }

      // Validate options
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

        // Display debug information (during development)
        if (process.env.NODE_ENV === "development") {
          console.error(picocolors.gray("Stack trace:"), error.stack);
        }
      } else {
        console.error(picocolors.red(picocolors.bold("Unknown error:")), picocolors.red(String(error)));
      }
      process.exit(1);
    }
  });

// Improve help display
program.on("--help", () => {
  console.log("");
  console.log("Examples:");
  console.log("  $ assync -s claude -d gemini               # Convert all Claude commands to Gemini");
  console.log("  $ assync -s gemini -d claude -n            # Preview Gemini to Claude conversion");
  console.log("  $ assync -s codex -d claude                # Convert Codex commands to Claude");
  console.log("  $ assync -s claude -d gemini --file mycommand   # Convert specific file");
  console.log("  $ assync -s claude -d gemini --remove-unsupported # Remove unsupported fields");
  console.log("  $ assync -s gemini -d claude --no-overwrite     # Skip existing files");
  console.log("  $ assync -s claude -d gemini --sync-delete      # Delete orphaned files");
  console.log("  $ assync -s claude -d gemini --verbose          # Show detailed debug information");
  console.log("  $ assync -s claude -d gemini --claude-dir ~/my-claude # Use custom Claude base directory");
  console.log("  $ assync -s gemini -d claude --gemini-dir ~/my-gemini # Use custom Gemini base directory");
  console.log("  $ assync -s codex -d gemini --codex-dir ~/my-codex   # Use custom Codex base directory");
});

program.parse();
