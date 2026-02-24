import { rm } from "node:fs/promises";
import { join } from "node:path";
import picocolors from "picocolors";
import { AGENT_REGISTRY } from "../agents/registry.js";
import type { ConversionResult, FileOperation, SemanticIR } from "../types/index.js";
import type { ProductType } from "../types/intermediate.js";
import { assertNever } from "../utils/assert-never.js";
import { SKILL_CONSTANTS } from "../utils/constants.js";

const { SKILL_FILE_NAME } = SKILL_CONSTANTS;
import {
  type DirResolutionContext,
  deleteFile,
  directoryExists,
  fileExists,
  findAgentCommands,
  findAgentSkills,
  getCommandName,
  getFilePathFromCommandName,
  getSkillNameFromPath,
  getSkillPathFromName,
  readFile,
  resolveCommandDir,
  resolveSkillDir,
  writeFile,
} from "../utils/file-utils.js";

import type { CLIOptions } from "./options.js";

/**
 * Build a DirResolutionContext for a specific agent from CLIOptions.
 */
function buildContext(options: CLIOptions, agent: ProductType): DirResolutionContext {
  return {
    customDir: options.customDirs?.[agent],
    gitRoot: options.gitRoot,
    global: options.global,
  };
}

/**
 * Main function for command synchronization
 */
export async function syncCommands(options: CLIOptions): Promise<ConversionResult> {
  const operations: FileOperation[] = [];
  const errors: Error[] = [];
  const stats = { processed: 0, created: 0, modified: 0, deleted: 0, skipped: 0, unchanged: 0 };

  try {
    const modeLabel =
      options.gitRoot && !options.global ? `project: ${options.gitRoot}` : "global";
    console.log(picocolors.cyan(`Starting ${options.source} → ${options.destination} conversion... [${modeLabel}]`));

    if (options.noop) {
      console.log(picocolors.yellow("NOOP MODE - No files will be modified"));
    }

    // Process commands if contentType includes commands
    if (options.contentType === "commands" || options.contentType === "both") {
      const sourceFiles = await getSourceFiles(options);
      console.log(picocolors.dim(`Found ${sourceFiles.length} source command(s)`));

      // Convert each command file
      for (const sourceFile of sourceFiles) {
        try {
          const result = await convertSingleFile(sourceFile, options);
          operations.push(...result.operations);
          errors.push(...result.errors);
          countStats(result.operations, stats);
          stats.processed++;
        } catch (error) {
          errors.push(error instanceof Error ? error : new Error(String(error)));
        }
      }

      // Handle sync-delete for commands
      if (options.syncDelete) {
        const deleteResult = await handleSyncDelete(options, sourceFiles);
        operations.push(...deleteResult.operations);
        errors.push(...deleteResult.errors);
        stats.deleted += deleteResult.operations.filter((op) => op.type === "D").length;
      }
    }

    // Process skills if contentType includes skills
    if (options.contentType === "skills" || options.contentType === "both") {
      const sourceSkills = await getSourceSkills(options);
      console.log(picocolors.dim(`Found ${sourceSkills.length} source skill(s)`));

      // Convert each skill
      for (const skillDir of sourceSkills) {
        try {
          const result = await convertSingleSkill(skillDir, options);
          operations.push(...result.operations);
          errors.push(...result.errors);
          countStats(result.operations, stats);
          stats.processed++;
        } catch (error) {
          errors.push(error instanceof Error ? error : new Error(String(error)));
        }
      }

      // Handle sync-delete for skills
      if (options.syncDelete) {
        const deleteResult = await handleSkillSyncDelete(options, sourceSkills);
        operations.push(...deleteResult.operations);
        errors.push(...deleteResult.errors);
        stats.deleted += deleteResult.operations.filter((op) => op.type === "D").length;
      }
    }

    if (operations.length === 0 && errors.length === 0) {
      console.log(picocolors.gray("No files to convert."));
      return {
        success: true,
        operations,
        errors,
        summary: stats,
      };
    }

    // Display results
    displayResults(operations, errors, options);

    return {
      success: errors.length === 0,
      operations,
      errors,
      summary: stats,
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    errors.push(err);
    console.error("Conversion failed:", err.message);

    return {
      success: false,
      operations,
      errors,
      summary: stats,
    };
  }
}

/**
 * Count operation statistics
 */
function countStats(
  operations: FileOperation[],
  stats: { created: number; modified: number; deleted: number; skipped: number; unchanged: number },
): void {
  for (const op of operations) {
    switch (op.type) {
      case "A":
        stats.created++;
        break;
      case "M":
        stats.modified++;
        break;
      case "D":
        stats.deleted++;
        break;
      case "-":
        stats.skipped++;
        break;
      case "=":
        stats.unchanged++;
        break;
      default:
        assertNever(op.type);
    }
  }
}

/**
 * Get source files
 */
async function getSourceFiles(options: CLIOptions): Promise<string[]> {
  const agent = AGENT_REGISTRY[options.source];
  return findAgentCommands(agent, options.file, buildContext(options, options.source));
}

/**
 * Convert a single file
 */
async function convertSingleFile(
  sourceFile: string,
  options: CLIOptions,
): Promise<{ operations: FileOperation[]; errors: Error[] }> {
  const operations: FileOperation[] = [];
  const errors: Error[] = [];

  try {
    // Step 1: Parse and convert to SemanticIR
    const src = AGENT_REGISTRY[options.source];
    const dst = AGENT_REGISTRY[options.destination];
    const command = await src.parseCommand(sourceFile);
    const ir: SemanticIR = src.commandToIR(command, { destinationType: options.destination });

    // Determine target file path
    const sourceDir = resolveCommandDir(src, buildContext(options, options.source));
    const targetDir = resolveCommandDir(dst, buildContext(options, options.destination));

    if (!sourceFile.startsWith(sourceDir)) {
      throw new Error(`Source file ${sourceFile} is not in the ${options.source} commands directory`);
    }

    const commandName = getCommandName(sourceFile, sourceDir, src.fileExtension);
    const targetExt = dst.fileExtension;
    const targetFile = getFilePathFromCommandName(commandName, targetDir, targetExt);

    // Step 2: Read existing target for merge (used by chimera, ignored by others)
    let existingTarget: unknown;
    if (await fileExists(targetFile)) {
      try {
        existingTarget = await dst.parseCommand(targetFile);
      } catch {
        /* ignore parse errors on existing target */
      }
    }

    // Step 3: Convert from SemanticIR to target format
    const targetCommand = dst.commandFromIR(ir, {
      removeUnsupported: options.removeUnsupported,
      existingTarget,
    });
    const targetContent = dst.stringifyCommand(targetCommand);

    // Execute file operation
    const operation = await handleFileOperation(targetFile, targetContent, options);
    operations.push(operation);
  } catch (error) {
    errors.push(error instanceof Error ? error : new Error(String(error)));
  }

  return { operations, errors };
}

/**
 * Handle file operation
 */
async function handleFileOperation(targetFile: string, content: string, options: CLIOptions): Promise<FileOperation> {
  const exists = await fileExists(targetFile);

  // Check no-overwrite option
  if (exists && options.noOverwrite) {
    return {
      type: "-",
      filePath: targetFile,
      description: "Skipped (file exists and --no-overwrite specified)",
    };
  }

  // Check if content is unchanged
  if (exists) {
    const existingContent = await readFile(targetFile);
    if (existingContent === content) {
      return {
        type: "=",
        filePath: targetFile,
        description: "Unchanged",
      };
    }
  }

  // In no-op mode
  if (options.noop) {
    return {
      type: exists ? "M" : "A",
      filePath: targetFile,
      description: exists ? "Would modify" : "Would create",
    };
  }

  // Actual file operation
  await writeFile(targetFile, content);

  return {
    type: exists ? "M" : "A",
    filePath: targetFile,
    description: exists ? "Modified" : "Created",
  };
}

/**
 * Handle sync-delete option
 */
async function handleSyncDelete(
  options: CLIOptions,
  sourceFiles: string[],
): Promise<{ operations: FileOperation[]; errors: Error[] }> {
  const operations: FileOperation[] = [];
  const errors: Error[] = [];

  try {
    // Get target files
    const dst = AGENT_REGISTRY[options.destination];
    const targetFiles = await findAgentCommands(dst, undefined, buildContext(options, options.destination));

    // Generate target file names corresponding to source
    const src = AGENT_REGISTRY[options.source];
    const sourceDir = resolveCommandDir(src, buildContext(options, options.source));
    const targetDir = resolveCommandDir(dst, buildContext(options, options.destination));
    const targetExt = dst.fileExtension;

    const expectedTargetFiles = new Set(
      sourceFiles.map((sourceFile) => {
        const commandName = getCommandName(sourceFile, sourceDir, src.fileExtension);
        return getFilePathFromCommandName(commandName, targetDir, targetExt);
      }),
    );

    // Delete unnecessary target files
    for (const targetFile of targetFiles) {
      if (!expectedTargetFiles.has(targetFile)) {
        if (options.noop) {
          operations.push({
            type: "D",
            filePath: targetFile,
            description: "Would delete (orphaned)",
          });
        } else {
          await deleteFile(targetFile);
          operations.push({
            type: "D",
            filePath: targetFile,
            description: "Deleted (orphaned)",
          });
        }
      }
    }
  } catch (error) {
    errors.push(error instanceof Error ? error : new Error(String(error)));
  }

  return { operations, errors };
}

/**
 * Get source skill directories
 */
async function getSourceSkills(options: CLIOptions): Promise<string[]> {
  const agent = AGENT_REGISTRY[options.source];
  return findAgentSkills(agent, options.file, buildContext(options, options.source));
}

/**
 * Convert a single skill
 */
async function convertSingleSkill(
  skillDir: string,
  options: CLIOptions,
): Promise<{ operations: FileOperation[]; errors: Error[] }> {
  const operations: FileOperation[] = [];
  const errors: Error[] = [];

  try {
    // Step 1: Parse and convert to SemanticIR
    const src = AGENT_REGISTRY[options.source];
    const dst = AGENT_REGISTRY[options.destination];
    const skill = await src.parseSkill(skillDir);
    const ir: SemanticIR = src.skillToIR(skill, { destinationType: options.destination });

    // Get skill directories
    const sourceDir = resolveSkillDir(src, buildContext(options, options.source));
    const targetDir = resolveSkillDir(dst, buildContext(options, options.destination));

    const skillName = getSkillNameFromPath(skillDir, sourceDir);
    const targetSkillDir = getSkillPathFromName(skillName, targetDir);

    // Check if target exists
    const targetExists = await directoryExists(targetSkillDir);

    // Check no-overwrite option
    if (targetExists && options.noOverwrite) {
      operations.push({
        type: "-",
        filePath: targetSkillDir,
        description: "Skipped (skill exists and --no-overwrite specified)",
      });
      return { operations, errors };
    }

    // Read existing target for merge (used by chimera, ignored by others)
    let existingTarget: unknown;
    if (targetExists) {
      try {
        existingTarget = await dst.parseSkill(targetSkillDir);
      } catch {
        /* ignore parse errors on existing target */
      }
    }

    // Step 3: Convert from SemanticIR to target format
    const targetSkill = dst.skillFromIR(ir, {
      removeUnsupported: options.removeUnsupported,
      existingTarget,
    });

    // Check if skill content is unchanged (compare SKILL.md)
    if (targetExists) {
      const newSkillContent = dst.stringifySkill(targetSkill);
      const existingSkillMdPath = join(targetSkillDir, SKILL_FILE_NAME);
      if (await fileExists(existingSkillMdPath)) {
        const existingSkillContent = await readFile(existingSkillMdPath);
        if (existingSkillContent === newSkillContent) {
          operations.push({
            type: "=",
            filePath: targetSkillDir,
            description: "Unchanged",
          });
          return { operations, errors };
        }
      }
    }

    // In no-op mode
    if (options.noop) {
      operations.push({
        type: targetExists ? "M" : "A",
        filePath: targetSkillDir,
        description: targetExists ? "Would modify" : "Would create",
      });
      return { operations, errors };
    }

    // Write skill to directory
    await dst.writeSkillToDirectory(targetSkill, skillDir, targetSkillDir);

    operations.push({
      type: targetExists ? "M" : "A",
      filePath: targetSkillDir,
      description: targetExists ? "Modified" : "Created",
    });
  } catch (error) {
    errors.push(error instanceof Error ? error : new Error(String(error)));
  }

  return { operations, errors };
}

/**
 * Handle sync-delete for skills
 */
async function handleSkillSyncDelete(
  options: CLIOptions,
  sourceSkills: string[],
): Promise<{ operations: FileOperation[]; errors: Error[] }> {
  const operations: FileOperation[] = [];
  const errors: Error[] = [];

  try {
    // Get target skills
    const dst = AGENT_REGISTRY[options.destination];
    const targetSkills = await findAgentSkills(dst, undefined, buildContext(options, options.destination));

    // Generate target skill names corresponding to source
    const src = AGENT_REGISTRY[options.source];
    const sourceDir = resolveSkillDir(src, buildContext(options, options.source));
    const targetDir = resolveSkillDir(dst, buildContext(options, options.destination));

    const expectedTargetSkills = new Set(
      sourceSkills.map((sourceSkill) => {
        const skillName = getSkillNameFromPath(sourceSkill, sourceDir);
        return getSkillPathFromName(skillName, targetDir);
      }),
    );

    // Delete orphaned target skills
    for (const targetSkill of targetSkills) {
      if (!expectedTargetSkills.has(targetSkill)) {
        if (options.noop) {
          operations.push({
            type: "D",
            filePath: targetSkill,
            description: "Would delete (orphaned)",
          });
        } else {
          await rm(targetSkill, { recursive: true });
          operations.push({
            type: "D",
            filePath: targetSkill,
            description: "Deleted (orphaned)",
          });
        }
      }
    }
  } catch (error) {
    errors.push(error instanceof Error ? error : new Error(String(error)));
  }

  return { operations, errors };
}

/**
 * Style definition for each operation type
 */
const operationStyles = {
  A: { prefix: picocolors.green("[A]"), color: picocolors.green },
  M: { prefix: picocolors.yellow("[M]"), color: picocolors.yellow },
  D: { prefix: picocolors.red("[D]"), color: picocolors.red },
  "-": { prefix: picocolors.gray("[-]"), color: picocolors.gray },
  "=": { prefix: picocolors.blue("[=]"), color: picocolors.blue },
} as const;

/**
 * Display results
 */
function getNoopMessage(rawSubCommand?: string): string {
  switch (rawSubCommand) {
    case "drift":
      return "This was a dry run. Use `acs import` to apply changes.";
    case "plan":
      return "This was a dry run. Use `acs apply` to apply changes.";
    default:
      return "This was a dry run. Use without --noop to apply changes.";
  }
}

function displayResults(operations: FileOperation[], errors: Error[], options: CLIOptions): void {
  console.log(picocolors.bold("\nResults:"));

  if (operations.length === 0) {
    console.log(picocolors.gray("No operations performed."));
    return;
  }

  // Display operations
  for (const op of operations) {
    const style = operationStyles[op.type] || {
      prefix: `[${op.type}]`,
      color: (s: string) => s,
    };

    console.log(`${style.prefix} ${op.filePath} - ${style.color(op.description)}`);
  }

  // Display statistics
  const stats = {
    A: operations.filter((op) => op.type === "A").length,
    M: operations.filter((op) => op.type === "M").length,
    D: operations.filter((op) => op.type === "D").length,
    "-": operations.filter((op) => op.type === "-").length,
    "=": operations.filter((op) => op.type === "=").length,
  };

  console.log(picocolors.bold("\nSummary:"));
  if (stats.A > 0) console.log(`  ${picocolors.green("Created:")} ${stats.A}`);
  if (stats.M > 0) console.log(`  ${picocolors.yellow("Modified:")} ${stats.M}`);
  if (stats.D > 0) console.log(`  ${picocolors.red("Deleted:")} ${stats.D}`);
  if (stats["-"] > 0) console.log(`  ${picocolors.gray("Skipped:")} ${stats["-"]}`);
  if (stats["="] > 0) console.log(`  ${picocolors.blue("Unchanged:")} ${stats["="]}`);

  // Display errors
  if (errors.length > 0) {
    console.log(picocolors.red(picocolors.bold("\nErrors:")));
    errors.forEach((error, index) => {
      console.log(picocolors.red(`  ${index + 1}. ${error.message}`));
    });
  }

  if (options.noop) {
    console.log(picocolors.cyan(`\n${getNoopMessage(options.rawSubCommand)}`));
  } else if (errors.length === 0) {
    console.log(picocolors.green("\n✓ Conversion completed successfully!"));
  }
}
