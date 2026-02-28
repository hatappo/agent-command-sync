#!/usr/bin/env node

import { Command } from "commander";
import picocolors from "picocolors";
import { version } from "../../package.json" assert { type: "json" };
import { AGENT_REGISTRY } from "../agents/registry.js";
import { PRODUCT_TYPES } from "../types/intermediate.js";
import type { ProductType } from "../types/intermediate.js";
import type { ContentFilter } from "../types/skill.js";
import { findGitRoot } from "../utils/git-utils.js";
import { downloadSkill } from "./download.js";
import { runInfo } from "./info.js";
import type { CLIOptions } from "./options.js";
import { validateCLIOptions } from "./options.js";
import { showStatus } from "./status.js";
import { syncCommands } from "./sync.js";
import { updateSkills } from "./update.js";

// Dynamically generated from PRODUCT_TYPES / AGENT_REGISTRY
const displayNames = PRODUCT_TYPES.filter((p) => p !== "chimera")
  .map((p) => AGENT_REGISTRY[p].displayName)
  .join(", ");

const program = new Command();

program.name("acs").description(`Download, update, and sync AI agent skills across ${displayNames}`).version(version);

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

/** Register -g/--global option on a command */
function registerGlobalOption(cmd: Command): Command {
  cmd.option("-g, --global", "Use user-level (global) directories instead of project-level", false);
  return cmd;
}

/** Register common directory-related options (--global + --xxx-dir) on a command */
function registerCommonDirOptions(cmd: Command): Command {
  registerGlobalOption(cmd);
  registerDirOptions(cmd);
  return cmd;
}

/** Print help text. Concise when detailed=false, full when detailed=true. */
function printHelp(detailed: boolean): void {
  const desc = `Download, update, and sync AI agent skills across ${displayNames}`;
  console.log("Usage: acs [command] [options]\n");
  console.log(desc);

  if (detailed) {
    console.log("\nOptions:");
    console.log("  -h                       Show concise help");
    console.log("  --help                   Show detailed help (this output)");
  }

  console.log("\nCommands:");
  console.log("  download <url> [to]      Download skill(s) from GitHub");
  if (detailed) {
    console.log("  dl <url> [to]            Alias for download");
  }
  console.log("  update [skill-path]      Check for and apply upstream updates");
  console.log("  info [skill-path]        Show skill information and source links");
  console.log("  sync <from> <to>         Convert commands/skills between agents");
  console.log("  status                   Show Chimera hub status");
  console.log("  version                  Show version");

  if (detailed) {
    console.log("\nAdvanced Commands:");
    console.log("  import <agent>           Import into Chimera hub    (shorthand for: sync <agent> chimera)");
    console.log("  drift <agent>            Preview import             (shorthand for: sync <agent> chimera -n)");
    console.log("  apply <agent>            Apply Chimera hub to agent (shorthand for: sync chimera <agent>)");
    console.log("  plan <agent>             Preview apply              (shorthand for: sync chimera <agent> -n)");
  }

  console.log("\nExamples:");
  console.log("  $ acs download <github-url>          # Download a skill from GitHub");
  console.log("  $ acs download <github-url> gemini   # Download into Gemini skill directory");
  console.log("  $ acs download <github-repo-url>     # Bulk download all skills from a repo");
  console.log("  $ acs update                         # Update all downloaded skills");
  console.log("  $ acs update .claude/skills/my-skill  # Update a specific skill");
  console.log("  $ acs info                            # Interactively select and view a skill");
  console.log("  $ acs info .claude/skills/my-skill    # Show skill information");
  console.log("  $ acs sync claude gemini             # Convert skills between agents");
  console.log("  $ acs sync claude gemini -g          # Use global (user-level) directories");
  console.log("  $ acs status                         # Show Chimera hub status");

  if (detailed) {
    console.log("\nAdvanced Examples:");
    console.log("  $ acs import claude                            # Import into Chimera hub");
    console.log("  $ acs drift claude                             # Preview import (dry run)");
    console.log("  $ acs apply gemini                             # Apply Chimera hub to agent");
    console.log("  $ acs plan gemini                              # Preview apply (dry run)");
    console.log("  $ acs sync claude gemini --remove-unsupported  # Remove unsupported fields");
    console.log("  $ acs sync gemini claude --no-overwrite        # Skip existing files");
    console.log("  $ acs sync claude gemini --sync-delete         # Delete orphaned files");
  }

  if (!detailed) {
    console.log(`\nRun 'acs --help' for all commands and advanced usage.`);
  }
}

// ── Main (async entry point for git root detection) ──────────────

async function main(): Promise<void> {
  // ── Top-level help interception (before Commander parses) ────────
  const rawArgs = process.argv.slice(2);
  if (rawArgs.length === 0 || (rawArgs.length === 1 && rawArgs[0] === "-h")) {
    printHelp(false);
    process.exit(0);
  }
  if (rawArgs.length === 1 && (rawArgs[0] === "--help" || rawArgs[0] === "help")) {
    printHelp(true);
    process.exit(0);
  }

  // Disable Commander's built-in help subcommand (top-level help is handled above)
  program.addHelpCommand(false);

  const gitRoot = await findGitRoot();

  // ── download subcommand ──────────────────────────────────────────

  const downloadCmd = program
    .command("download <url> [to]")
    .alias("dl")
    .description("Download skill(s) from GitHub (supports repo-level bulk download)")
    .option("-n, --noop", "Preview files without downloading", false)
    .option("-v, --verbose", "Show detailed debug information", false)
    .option("--no-provenance", "Do not record source URL in _from frontmatter property");

  registerCommonDirOptions(downloadCmd);

  downloadCmd.action(async (url: string, to: string | undefined, options) => {
    try {
      await downloadSkill({
        url,
        destination: to as ProductType | undefined,
        global: options.global,
        githubToken: process.env.GITHUB_TOKEN,
        noop: options.noop,
        verbose: options.verbose,
        gitRoot,
        customDirs: buildCustomDirs(options),
        noProvenance: !options.provenance,
      });
    } catch (error) {
      handleError(error);
    }
  });

  // ── update subcommand ────────────────────────────────────────────

  const updateCmd = program
    .command("update [skill-path]")
    .description("Check for and apply upstream updates to downloaded skills")
    .option("-n, --noop", "Check for updates without applying them", false)
    .option("-v, --verbose", "Show detailed debug information", false);

  registerCommonDirOptions(updateCmd);

  updateCmd.action(async (skillPath: string | undefined, options) => {
    try {
      await updateSkills({
        skillPath,
        noop: options.noop,
        verbose: options.verbose,
        gitRoot,
        global: options.global,
        customDirs: buildCustomDirs(options),
      });
    } catch (error) {
      handleError(error);
    }
  });

  // ── info subcommand ──────────────────────────────────────────────

  const infoCmd = program
    .command("info [skill-path]")
    .description("Show skill information and source links")
    .option("-v, --verbose", "Show detailed debug information", false);

  registerCommonDirOptions(infoCmd);

  infoCmd.action(async (skillPath: string | undefined, options) => {
    try {
      await runInfo({
        skillPath,
        verbose: options.verbose,
        gitRoot,
        global: options.global,
        customDirs: buildCustomDirs(options),
      });
    } catch (error) {
      handleError(error);
    }
  });

  // ── sync subcommand ─────────────────────────────────────────────

  const syncCmd = program
    .command("sync <from> <to>")
    .description("Convert commands/skills between two agents")
    .option("-t, --type <type>", "Content type: skills, commands, or both", "skills")
    .option("--remove-unsupported", "Remove keys that are not supported in the target format", false)
    .option("--no-overwrite", "Skip conversion if a command with the same name exists in the target")
    .option("--sync-delete", "Delete commands in the target that don't exist in the source", false)
    .option("-f, --file <filename>", "Convert only the specified command/skill (without extension)")
    .option("-n, --noop", "Display a list of changes without applying them", false)
    .option("-v, --verbose", "Show detailed debug information", false)
    .option("--no-provenance", "Do not record source URL in _from frontmatter property");

  registerCommonDirOptions(syncCmd);

  syncCmd.action(async (from: string, to: string, options) => {
    try {
      if (from === to) {
        console.error(
          picocolors.red(picocolors.bold("Error:")),
          picocolors.red("Source and destination must be different"),
        );
        process.exit(1);
      }

      const syncOptions: CLIOptions = {
        source: from as ProductType,
        destination: to as ProductType,
        contentType: options.type as ContentFilter,
        removeUnsupported: options.removeUnsupported,
        noOverwrite: !options.overwrite,
        syncDelete: options.syncDelete,
        file: options.file,
        noop: options.noop,
        verbose: options.verbose,
        global: options.global,
        gitRoot,
        customDirs: buildCustomDirs(options),
        noProvenance: !options.provenance,
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
    .option("-t, --type <type>", "Content type: skills, commands, or both", "skills")
    .option("-f, --file <filename>", "Convert only the specified command/skill (without extension)")
    .option("-v, --verbose", "Show detailed debug information", false)
    .option("--no-provenance", "Do not record source URL in _from frontmatter property");

  registerCommonDirOptions(importCmd);

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
        global: options.global,
        gitRoot,
        customDirs: buildCustomDirs(options),
        noProvenance: !options.provenance,
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
    .option("-t, --type <type>", "Content type: skills, commands, or both", "skills")
    .option("-f, --file <filename>", "Convert only the specified command/skill (without extension)")
    .option("-v, --verbose", "Show detailed debug information", false)
    .option("--no-provenance", "Do not record source URL in _from frontmatter property");

  registerCommonDirOptions(driftCmd);

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
        global: options.global,
        gitRoot,
        customDirs: buildCustomDirs(options),
        noProvenance: !options.provenance,
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
    .option("-t, --type <type>", "Content type: skills, commands, or both", "skills")
    .option("--remove-unsupported", "Remove keys that are not supported in the target format", false)
    .option("--no-overwrite", "Skip conversion if a command with the same name exists in the target")
    .option("--sync-delete", "Delete commands in the target that don't exist in the source", false)
    .option("-f, --file <filename>", "Convert only the specified command/skill (without extension)")
    .option("-v, --verbose", "Show detailed debug information", false)
    .option("--no-provenance", "Do not record source URL in _from frontmatter property");

  registerCommonDirOptions(applyCmd);

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
        global: options.global,
        gitRoot,
        customDirs: buildCustomDirs(options),
        noProvenance: !options.provenance,
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
    .option("-t, --type <type>", "Content type: skills, commands, or both", "skills")
    .option("--remove-unsupported", "Remove keys that are not supported in the target format", false)
    .option("-f, --file <filename>", "Convert only the specified command/skill (without extension)")
    .option("-v, --verbose", "Show detailed debug information", false)
    .option("--no-provenance", "Do not record source URL in _from frontmatter property");

  registerCommonDirOptions(planCmd);

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
        global: options.global,
        gitRoot,
        customDirs: buildCustomDirs(options),
        noProvenance: !options.provenance,
        rawSubCommand: "plan",
      };

      await runSync(syncOptions, options.verbose);
    } catch (error) {
      handleError(error);
    }
  });

  // ── status subcommand ────────────────────────────────────────────

  const statusCmd = program.command("status").description("Show Chimera status and detected agents");

  registerCommonDirOptions(statusCmd);
  statusCmd.option("--lv <level>", undefined /* hidden */);

  statusCmd.action(async (options) => {
    try {
      const lv = options.lv != null ? Number.parseInt(options.lv, 10) : undefined;
      if (lv != null && (Number.isNaN(lv) || lv < 0)) {
        console.error("Error: --lv must be a non-negative integer");
        process.exitCode = 1;
        return;
      }
      await showStatus({
        customDirs: buildCustomDirs(options),
        gitRoot,
        global: options.global,
        lv,
      });
    } catch (error) {
      handleError(error);
    }
  });

  // ── version subcommand ───────────────────────────────────────────

  program
    .command("version")
    .description("Show version")
    .action(() => {
      console.log(version);
    });

  program.parse();
}

main();
