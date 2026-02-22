#!/usr/bin/env node

import { Command } from "commander";
import picocolors from "picocolors";
import { version } from "../../package.json" assert { type: "json" };
import { AGENT_REGISTRY } from "../agents/registry.js";
import { PRODUCT_TYPES } from "../types/intermediate.js";
import type { ProductType } from "../types/intermediate.js";
import type { ContentFilter } from "../types/skill.js";
import { validateCLIOptions } from "./options.js";
import { syncCommands } from "./sync.js";
import type { CLIOptions } from "./options.js";

// Dynamically generated from PRODUCT_TYPES / AGENT_REGISTRY
const displayNames = PRODUCT_TYPES.map((p) => AGENT_REGISTRY[p].displayName).join(", ");
const productList = PRODUCT_TYPES.join(", ");

const program = new Command();

program
  .name("acs")
  .description(`Convert Custom Slash Commands and Skills between ${displayNames}`)
  .version(version);

// ── Helpers ───────────────────────────────────────────────────────

/** Build customDirs from commander options */
function buildCustomDirs(options: Record<string, unknown>): Partial<Record<ProductType, string>> {
  const customDirs: Partial<Record<ProductType, string>> = {};
  for (const name of PRODUCT_TYPES) {
    const dirKey = `${name}Dir`;
    if (options[dirKey]) {
      customDirs[name] = options[dirKey] as string;
    }
  }
  return customDirs;
}

/** Validate and run sync */
async function runSync(syncOptions: CLIOptions, verbose: boolean, rawOptions?: Record<string, unknown>): Promise<void> {
  if (verbose) {
    if (rawOptions) console.log("DEBUG: Raw options:", rawOptions);
    console.log("DEBUG: Processed options:", syncOptions);
  }

  const validationErrors = validateCLIOptions(syncOptions);
  if (validationErrors.length > 0) {
    console.error(picocolors.red(picocolors.bold("Validation errors:")));
    for (const error of validationErrors) {
      console.error(picocolors.red(`  \u2717 ${error}`));
    }
    console.error(picocolors.dim("\nUse --help for usage information."));
    process.exit(1);
  }

  await syncCommands(syncOptions);
}

/** Handle errors consistently */
function handleError(error: unknown): never {
  if (error instanceof Error) {
    console.error(picocolors.red(picocolors.bold("Error:")), picocolors.red(error.message));
    if (process.env.NODE_ENV === "development") {
      console.error(picocolors.gray("Stack trace:"), error.stack);
    }
  } else {
    console.error(picocolors.red(picocolors.bold("Unknown error:")), picocolors.red(String(error)));
  }
  process.exit(1);
}

/** Register --xxx-dir options on a command */
function registerDirOptions(cmd: Command): Command {
  for (const name of PRODUCT_TYPES) {
    const agent = AGENT_REGISTRY[name];
    cmd.option(`--${name}-dir <path>`, `${agent.displayName} base directory (default: ~/${agent.dirs.userDefault})`);
  }
  return cmd;
}

// ── sync subcommand ─────────────────────────────────────────────

const syncCmd = program
  .command("sync")
  .description("Directly convert between two agents")
  .requiredOption("-s, --src <product>", `Source product: ${productList}`)
  .requiredOption("-d, --dest <product>", `Destination product: ${productList}`)
  .option("-t, --type <type>", "Content type: commands, skills, or both", "both")
  .option("--remove-unsupported", "Remove keys that are not supported in the target format", false)
  .option("--no-overwrite", "Skip conversion if a command with the same name exists in the target")
  .option("--sync-delete", "Delete commands in the target that don't exist in the source", false)
  .option("-f, --file <filename>", "Convert only the specified command/skill (without extension)")
  .option("-n, --noop", "Display a list of changes without applying them", false)
  .option("-v, --verbose", "Show detailed debug information", false);

registerDirOptions(syncCmd);

syncCmd.action(async (options) => {
  try {
    if (options.src === options.dest) {
      console.error(picocolors.red(picocolors.bold("Error:")), picocolors.red("Source and destination must be different"));
      process.exit(1);
    }

    const syncOptions: CLIOptions = {
      source: options.src as ProductType,
      destination: options.dest as ProductType,
      contentType: options.type as ContentFilter,
      removeUnsupported: options.removeUnsupported,
      noOverwrite: !options.overwrite,
      syncDelete: options.syncDelete,
      file: options.file,
      noop: options.noop,
      verbose: options.verbose,
      customDirs: buildCustomDirs(options),
      rawSubCommand: "sync",
    };

    await runSync(syncOptions, options.verbose, options);
  } catch (error) {
    handleError(error);
  }
});

// ── import subcommand (= sync -s <agent> -d chimera) ────────────

const importCmd = program
  .command("import <agent>")
  .description("Import commands/skills from an agent into Chimera hub")
  .option("-t, --type <type>", "Content type: commands, skills, or both", "both")
  .option("-f, --file <filename>", "Convert only the specified command/skill (without extension)")
  .option("-v, --verbose", "Show detailed debug information", false);

registerDirOptions(importCmd);

importCmd.action(async (agent: string, options) => {
  try {
    const syncOptions: CLIOptions = {
      source: agent as ProductType,
      destination: "chimera",
      contentType: (options.type || "both") as ContentFilter,
      removeUnsupported: false,
      noOverwrite: false,
      syncDelete: false,
      file: options.file,
      noop: false,
      verbose: options.verbose,
      customDirs: buildCustomDirs(options),
      rawSubCommand: "import",
    };

    await runSync(syncOptions, options.verbose);
  } catch (error) {
    handleError(error);
  }
});

// ── drift subcommand (= sync -s <agent> -d chimera --noop) ──────

const driftCmd = program
  .command("drift <agent>")
  .description("Preview what would change when importing from an agent (dry run)")
  .option("-t, --type <type>", "Content type: commands, skills, or both", "both")
  .option("-f, --file <filename>", "Convert only the specified command/skill (without extension)")
  .option("-v, --verbose", "Show detailed debug information", false);

registerDirOptions(driftCmd);

driftCmd.action(async (agent: string, options) => {
  try {
    const syncOptions: CLIOptions = {
      source: agent as ProductType,
      destination: "chimera",
      contentType: (options.type || "both") as ContentFilter,
      removeUnsupported: false,
      noOverwrite: false,
      syncDelete: false,
      file: options.file,
      noop: true,
      verbose: options.verbose,
      customDirs: buildCustomDirs(options),
      rawSubCommand: "drift",
    };

    await runSync(syncOptions, options.verbose);
  } catch (error) {
    handleError(error);
  }
});

// ── apply subcommand (= sync -s chimera -d <agent>) ─────────────

const applyCmd = program
  .command("apply <agent>")
  .description("Apply Chimera hub commands/skills to an agent")
  .option("-t, --type <type>", "Content type: commands, skills, or both", "both")
  .option("--remove-unsupported", "Remove keys that are not supported in the target format", false)
  .option("--no-overwrite", "Skip conversion if a command with the same name exists in the target")
  .option("--sync-delete", "Delete commands in the target that don't exist in the source", false)
  .option("-f, --file <filename>", "Convert only the specified command/skill (without extension)")
  .option("-v, --verbose", "Show detailed debug information", false);

registerDirOptions(applyCmd);

applyCmd.action(async (agent: string, options) => {
  try {
    const syncOptions: CLIOptions = {
      source: "chimera",
      destination: agent as ProductType,
      contentType: (options.type || "both") as ContentFilter,
      removeUnsupported: options.removeUnsupported,
      noOverwrite: !options.overwrite,
      syncDelete: options.syncDelete,
      file: options.file,
      noop: false,
      verbose: options.verbose,
      customDirs: buildCustomDirs(options),
      rawSubCommand: "apply",
    };

    await runSync(syncOptions, options.verbose);
  } catch (error) {
    handleError(error);
  }
});

// ── plan subcommand (= sync -s chimera -d <agent> --noop) ───────

const planCmd = program
  .command("plan <agent>")
  .description("Preview what would change when applying Chimera hub to an agent (dry run)")
  .option("-t, --type <type>", "Content type: commands, skills, or both", "both")
  .option("--remove-unsupported", "Remove keys that are not supported in the target format", false)
  .option("-f, --file <filename>", "Convert only the specified command/skill (without extension)")
  .option("-v, --verbose", "Show detailed debug information", false);

registerDirOptions(planCmd);

planCmd.action(async (agent: string, options) => {
  try {
    const syncOptions: CLIOptions = {
      source: "chimera",
      destination: agent as ProductType,
      contentType: (options.type || "both") as ContentFilter,
      removeUnsupported: options.removeUnsupported,
      noOverwrite: false,
      syncDelete: false,
      file: options.file,
      noop: true,
      verbose: options.verbose,
      customDirs: buildCustomDirs(options),
      rawSubCommand: "plan",
    };

    await runSync(syncOptions, options.verbose);
  } catch (error) {
    handleError(error);
  }
});

// ── Help ────────────────────────────────────────────────────────

program.on("--help", () => {
  console.log("");
  console.log("Examples:");
  console.log("  $ acs sync -s claude -d gemini               # Direct conversion");
  console.log("  $ acs sync -s claude -d gemini -t commands   # Convert only commands");
  console.log("  $ acs import claude                          # Import into Chimera hub    (shorthand for: acs sync -s claude -d chimera)");
  console.log("  $ acs drift claude                           # Preview import             (shorthand for: acs sync -s claude -d chimera -n)");
  console.log("  $ acs apply gemini                           # Apply Chimera hub to agent (shorthand for: acs sync -s chimera -d gemini)");
  console.log("  $ acs plan gemini                            # Preview apply              (shorthand for: acs sync -s chimera -d gemini -n)");
  console.log("  $ acs sync -s claude -d gemini --remove-unsupported # Remove unsupported fields");
  console.log("  $ acs sync -s gemini -d claude --no-overwrite     # Skip existing files");
  console.log("  $ acs sync -s claude -d gemini --sync-delete      # Delete orphaned files");
  console.log("  $ acs sync -s claude -d gemini --verbose          # Show detailed debug information");
});

program.parse();
