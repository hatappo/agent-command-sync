#!/usr/bin/env node

import { Command } from "commander";
import picocolors from "picocolors";
import { version } from "../../package.json" assert { type: "json" };
import { AGENT_REGISTRY } from "../agents/registry.js";
import { PRODUCT_TYPES } from "../types/intermediate.js";
import type { ProductType } from "../types/intermediate.js";
import { validateCLIOptions } from "./options.js";
import { syncCommands } from "./sync.js";

// Dynamically generated from PRODUCT_TYPES / AGENT_REGISTRY
const displayNames = PRODUCT_TYPES.map((p) => AGENT_REGISTRY[p].displayName).join(", ");
const productList = PRODUCT_TYPES.join(", ");

const program = new Command();

program
  .name("agent-command-sync")
  .description(`Convert Custom Slash Commands and Skills between ${displayNames}`)
  .version(version);

program
  .requiredOption("-s, --src <product>", `Source product: ${productList}`)
  .requiredOption("-d, --dest <product>", `Destination product: ${productList}`)
  .option("-t, --type <type>", "Content type: commands, skills, or both", "both")
  .option("--remove-unsupported", "Remove keys that are not supported in the target format", false)
  .option("--no-overwrite", "Skip conversion if a command with the same name exists in the target")
  .option("--sync-delete", "Delete commands in the target that don't exist in the source", false)
  .option("-f, --file <filename>", "Convert only the specified command/skill (without extension)")
  .option("-n, --noop", "Display a list of changes without applying them", false)
  .option("-v, --verbose", "Show detailed debug information", false);

// Register --xxx-dir options dynamically
for (const name of PRODUCT_TYPES) {
  const agent = AGENT_REGISTRY[name];
  program.option(`--${name}-dir <path>`, `${agent.displayName} base directory (default: ~/${agent.dirs.userDefault})`);
}

program.action(async (options) => {
  try {
    // Check if source and destination are the same
    if (options.src === options.dest) {
      console.error(
        picocolors.red(picocolors.bold("Error:")),
        picocolors.red("Source and destination must be different"),
      );
      process.exit(1);
    }

    // Build customDirs dynamically
    const customDirs: Partial<Record<ProductType, string>> = {};
    for (const name of PRODUCT_TYPES) {
      const dirKey = `${name}Dir`;
      if (options[dirKey]) {
        customDirs[name] = options[dirKey];
      }
    }

    // Organize options
    const syncOptions = {
      source: options.src as ProductType,
      destination: options.dest as ProductType,
      contentType: options.type as "commands" | "skills" | "both",
      removeUnsupported: options.removeUnsupported,
      noOverwrite: !options.overwrite, // commander.js no-prefix reverses the value
      syncDelete: options.syncDelete,
      file: options.file,
      noop: options.noop,
      verbose: options.verbose,
      customDirs,
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
  console.log("  $ acsync -s claude -d gemini               # Convert all (commands + skills)");
  console.log("  $ acsync -s claude -d gemini -t commands   # Convert only commands");
  console.log("  $ acsync -s claude -d gemini -t skills     # Convert only skills");
  console.log("  $ acsync -s gemini -d claude -n            # Preview Gemini to Claude conversion");
  console.log("  $ acsync -s codex -d claude                # Convert Codex to Claude");
  console.log("  $ acsync -s claude -d gemini -f mycommand  # Convert specific command/skill");
  console.log("  $ acsync -s claude -d gemini --remove-unsupported # Remove unsupported fields");
  console.log("  $ acsync -s gemini -d claude --no-overwrite     # Skip existing files");
  console.log("  $ acsync -s claude -d gemini --sync-delete      # Delete orphaned files");
  console.log("  $ acsync -s claude -d gemini --verbose          # Show detailed debug information");
  console.log("  $ acsync -s claude -d gemini --claude-dir ~/my-claude # Use custom Claude base directory");
  console.log("  $ acsync -s gemini -d claude --gemini-dir ~/my-gemini # Use custom Gemini base directory");
  console.log("  $ acsync -s codex -d gemini --codex-dir ~/my-codex   # Use custom Codex base directory");
  console.log("  $ acsync -s opencode -d claude                      # Convert OpenCode to Claude");
  console.log("  $ acsync -s claude -d opencode --opencode-dir ~/my-opencode # Use custom OpenCode base directory");
});

program.parse();
