import { rm } from "node:fs/promises";
import { basename, join } from "node:path";
import picocolors from "picocolors";
import { ClaudeToIRConverter } from "../converters/claude-to-ir.js";
import { CodexToIRConverter } from "../converters/codex-to-ir.js";
import { GeminiToIRConverter } from "../converters/gemini-to-ir.js";
import { IRToClaudeConverter } from "../converters/ir-to-claude.js";
import { IRToCodexConverter } from "../converters/ir-to-codex.js";
import { IRToGeminiConverter } from "../converters/ir-to-gemini.js";
import { ClaudeSkillToIRConverter } from "../converters/claude-skill-to-ir.js";
import { GeminiSkillToIRConverter } from "../converters/gemini-skill-to-ir.js";
import { CodexSkillToIRConverter } from "../converters/codex-skill-to-ir.js";
import { IRToClaudeSkillConverter } from "../converters/ir-to-claude-skill.js";
import { IRToGeminiSkillConverter } from "../converters/ir-to-gemini-skill.js";
import { IRToCodexSkillConverter } from "../converters/ir-to-codex-skill.js";
import { ClaudeParser } from "../parsers/claude-parser.js";
import { CodexParser } from "../parsers/codex-parser.js";
import { GeminiParser } from "../parsers/gemini-parser.js";
import { ClaudeSkillParser } from "../parsers/claude-skill-parser.js";
import { GeminiSkillParser } from "../parsers/gemini-skill-parser.js";
import { CodexSkillParser } from "../parsers/codex-skill-parser.js";
import type { ConversionResult, FileOperation, IntermediateRepresentation } from "../types/index.js";
import { CLAUDE_SPECIFIC_FIELDS, CLAUDE_SKILL_SPECIFIC_FIELDS } from "../utils/constants.js";
import {
  deleteFile,
  directoryExists,
  fileExists,
  findClaudeCommands,
  findCodexCommands,
  findGeminiCommands,
  findClaudeSkills,
  findGeminiSkills,
  findCodexSkills,
  getCommandDirectories,
  getSkillDirectories,
  getCommandName,
  getFilePathFromCommandName,
  getSkillNameFromPath,
  getSkillPathFromName,
  writeFile,
} from "../utils/file-utils.js";
import { convertClaudeToGeminiPlaceholders, convertGeminiToClaudePlaceholders } from "../utils/placeholder-utils.js";
import type { CLIOptions } from "./options.js";
import { cliOptionsToConversionOptions } from "./options.js";

/**
 * Main function for command synchronization
 */
export async function syncCommands(options: CLIOptions): Promise<ConversionResult> {
  const conversionOptions = cliOptionsToConversionOptions(options);
  const operations: FileOperation[] = [];
  const errors: Error[] = [];
  let processed = 0;
  let created = 0;
  let modified = 0;
  let deleted = 0;
  let skipped = 0;

  try {
    console.log(picocolors.cyan(`Starting ${options.source} → ${options.destination} conversion...`));

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
          const result = await convertSingleFile(sourceFile, conversionOptions);
          operations.push(...result.operations);
          errors.push(...result.errors);

          // Update statistics
          for (const op of result.operations) {
            switch (op.type) {
              case "A":
                created++;
                break;
              case "M":
                modified++;
                break;
              case "D":
                deleted++;
                break;
              case "-":
                skipped++;
                break;
            }
          }

          processed++;
        } catch (error) {
          errors.push(error instanceof Error ? error : new Error(String(error)));
        }
      }

      // Handle sync-delete for commands
      if (options.syncDelete) {
        const deleteResult = await handleSyncDelete(options, sourceFiles);
        operations.push(...deleteResult.operations);
        errors.push(...deleteResult.errors);
        deleted += deleteResult.operations.filter((op) => op.type === "D").length;
      }
    }

    // Process skills if contentType includes skills
    if (options.contentType === "skills" || options.contentType === "both") {
      const sourceSkills = await getSourceSkills(options);
      console.log(picocolors.dim(`Found ${sourceSkills.length} source skill(s)`));

      // Convert each skill
      for (const skillDir of sourceSkills) {
        try {
          const result = await convertSingleSkill(skillDir, conversionOptions);
          operations.push(...result.operations);
          errors.push(...result.errors);

          // Update statistics
          for (const op of result.operations) {
            switch (op.type) {
              case "A":
                created++;
                break;
              case "M":
                modified++;
                break;
              case "D":
                deleted++;
                break;
              case "-":
                skipped++;
                break;
            }
          }

          processed++;
        } catch (error) {
          errors.push(error instanceof Error ? error : new Error(String(error)));
        }
      }

      // Handle sync-delete for skills
      if (options.syncDelete) {
        const deleteResult = await handleSkillSyncDelete(options, sourceSkills);
        operations.push(...deleteResult.operations);
        errors.push(...deleteResult.errors);
        deleted += deleteResult.operations.filter((op) => op.type === "D").length;
      }
    }

    if (operations.length === 0 && errors.length === 0) {
      console.log(picocolors.gray("No files to convert."));
      return {
        success: true,
        operations,
        errors,
        summary: { processed, created, modified, deleted, skipped },
      };
    }

    // Display results
    displayResults(operations, errors, options.noop);

    return {
      success: errors.length === 0,
      operations,
      errors,
      summary: { processed, created, modified, deleted, skipped },
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    errors.push(err);
    console.error("Conversion failed:", err.message);

    return {
      success: false,
      operations,
      errors,
      summary: { processed, created, modified, deleted, skipped },
    };
  }
}

/**
 * Get source files
 */
async function getSourceFiles(options: CLIOptions): Promise<string[]> {
  if (options.source === "claude") {
    return await findClaudeCommands(options.file, options.claudeDir);
  }
  if (options.source === "gemini") {
    return await findGeminiCommands(options.file, options.geminiDir);
  }
  return await findCodexCommands(options.file, options.codexDir);
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
    // Convert to intermediate representation
    let ir: IntermediateRepresentation;

    if (options.source === "claude") {
      const parser = new ClaudeParser();
      const toIRConverter = new ClaudeToIRConverter();
      const claudeCommand = await parser.parse(sourceFile);
      ir = toIRConverter.toIntermediate(claudeCommand);
    } else if (options.source === "gemini") {
      const parser = new GeminiParser();
      const toIRConverter = new GeminiToIRConverter();
      const geminiCommand = await parser.parse(sourceFile);
      ir = toIRConverter.toIntermediate(geminiCommand);
    } else {
      const parser = new CodexParser();
      const toIRConverter = new CodexToIRConverter();
      const codexCommand = await parser.parse(sourceFile);
      ir = toIRConverter.toIntermediate(codexCommand);
    }

    // Set target type in metadata
    ir.meta.targetType = options.destination;

    // Placeholder conversion
    if ((options.source === "claude" || options.source === "codex") && options.destination === "gemini") {
      // Claude/Codex → Gemini: $ARGUMENTS → {{args}}
      ir.body = convertClaudeToGeminiPlaceholders(ir.body);
    } else if (options.source === "gemini" && (options.destination === "claude" || options.destination === "codex")) {
      // Gemini → Claude/Codex: {{args}} → $ARGUMENTS
      ir.body = convertGeminiToClaudePlaceholders(ir.body);
    }
    // Note: Claude ↔ Codex both use $ARGUMENTS, so no conversion needed

    // Remove Claude-specific fields (if necessary)
    // When removeUnsupported is specified for conversion to Gemini or Codex
    if (options.removeUnsupported && (options.destination === "gemini" || options.destination === "codex")) {
      for (const field of CLAUDE_SPECIFIC_FIELDS) {
        delete ir.header[field];
      }
    }

    // Convert to target format
    let targetContent: string;
    let targetExt: string;

    if (options.destination === "claude") {
      const fromIRConverter = new IRToClaudeConverter();
      const claudeParser = new ClaudeParser();
      const claudeCommand = fromIRConverter.fromIntermediate(ir);
      targetContent = claudeParser.stringify(claudeCommand);
      targetExt = ".md";
    } else if (options.destination === "gemini") {
      const fromIRConverter = new IRToGeminiConverter();
      const geminiParser = new GeminiParser();
      const geminiCommand = fromIRConverter.fromIntermediate(ir);
      targetContent = geminiParser.stringify(geminiCommand);
      targetExt = ".toml";
    } else {
      const fromIRConverter = new IRToCodexConverter();
      const codexParser = new CodexParser();
      const codexCommand = fromIRConverter.fromIntermediate(ir);
      targetContent = codexParser.stringify(codexCommand);
      targetExt = ".md";
    }

    // Determine target file path (user directory only)
    const directories = getCommandDirectories(options.claudeDir, options.geminiDir, options.codexDir);
    const sourceDir =
      options.source === "claude"
        ? directories.claude.user
        : options.source === "gemini"
          ? directories.gemini.user
          : directories.codex.user;
    const targetDir =
      options.destination === "claude"
        ? directories.claude.user
        : options.destination === "gemini"
          ? directories.gemini.user
          : directories.codex.user;

    if (!sourceFile.startsWith(sourceDir)) {
      throw new Error(`Source file ${sourceFile} is not in the ${options.source} user commands directory`);
    }

    const commandName = getCommandName(sourceFile, sourceDir);
    const targetFile = getFilePathFromCommandName(commandName, targetDir, targetExt);

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
    const targetFiles =
      options.destination === "claude"
        ? await findClaudeCommands(undefined, options.claudeDir)
        : options.destination === "gemini"
          ? await findGeminiCommands(undefined, options.geminiDir)
          : await findCodexCommands(undefined, options.codexDir);

    // Generate target file names corresponding to source (user directory only)
    const directories = getCommandDirectories(options.claudeDir, options.geminiDir, options.codexDir);
    const sourceDir =
      options.source === "claude"
        ? directories.claude.user
        : options.source === "gemini"
          ? directories.gemini.user
          : directories.codex.user;
    const targetDir =
      options.destination === "claude"
        ? directories.claude.user
        : options.destination === "gemini"
          ? directories.gemini.user
          : directories.codex.user;
    const targetExt = options.destination === "claude" || options.destination === "codex" ? ".md" : ".toml";

    const expectedTargetFiles = new Set(
      sourceFiles.map((sourceFile) => {
        const commandName = getCommandName(sourceFile, sourceDir);
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
  if (options.source === "claude") {
    return await findClaudeSkills(options.file, options.claudeDir);
  }
  if (options.source === "gemini") {
    return await findGeminiSkills(options.file, options.geminiDir);
  }
  return await findCodexSkills(options.file, options.codexDir);
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
    // Convert to intermediate representation
    let ir: IntermediateRepresentation;

    if (options.source === "claude") {
      const parser = new ClaudeSkillParser();
      const toIRConverter = new ClaudeSkillToIRConverter();
      const skill = await parser.parse(skillDir);
      ir = toIRConverter.toIntermediate(skill);
    } else if (options.source === "gemini") {
      const parser = new GeminiSkillParser();
      const toIRConverter = new GeminiSkillToIRConverter();
      const skill = await parser.parse(skillDir);
      ir = toIRConverter.toIntermediate(skill);
    } else {
      const parser = new CodexSkillParser();
      const toIRConverter = new CodexSkillToIRConverter();
      const skill = await parser.parse(skillDir);
      ir = toIRConverter.toIntermediate(skill);
    }

    // Set target type in metadata
    ir.meta.targetType = options.destination;

    // Placeholder conversion
    if ((options.source === "claude" || options.source === "codex") && options.destination === "gemini") {
      ir.body = convertClaudeToGeminiPlaceholders(ir.body);
    } else if (options.source === "gemini" && (options.destination === "claude" || options.destination === "codex")) {
      ir.body = convertGeminiToClaudePlaceholders(ir.body);
    }

    // Remove Claude-specific fields (if necessary)
    if (options.removeUnsupported && (options.destination === "gemini" || options.destination === "codex")) {
      for (const field of CLAUDE_SKILL_SPECIFIC_FIELDS) {
        delete ir.header[field];
      }
    }

    // Get skill directories
    const directories = getSkillDirectories(options.claudeDir, options.geminiDir, options.codexDir);
    const sourceDir =
      options.source === "claude"
        ? directories.claude.user
        : options.source === "gemini"
          ? directories.gemini.user
          : directories.codex.user;
    const targetDir =
      options.destination === "claude"
        ? directories.claude.user
        : options.destination === "gemini"
          ? directories.gemini.user
          : directories.codex.user;

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

    // In no-op mode
    if (options.noop) {
      operations.push({
        type: targetExists ? "M" : "A",
        filePath: targetSkillDir,
        description: targetExists ? "Would modify" : "Would create",
      });
      return { operations, errors };
    }

    // Convert to target format and write
    if (options.destination === "claude") {
      const fromIRConverter = new IRToClaudeSkillConverter({ removeUnsupported: options.removeUnsupported });
      const parser = new ClaudeSkillParser();
      const skill = fromIRConverter.fromIntermediate(ir);
      skill.dirPath = skillDir; // Keep source path for copying support files
      await parser.writeToDirectory(skill, targetSkillDir);
    } else if (options.destination === "gemini") {
      const fromIRConverter = new IRToGeminiSkillConverter({ removeUnsupported: options.removeUnsupported });
      const parser = new GeminiSkillParser();
      const skill = fromIRConverter.fromIntermediate(ir);
      skill.dirPath = skillDir;
      await parser.writeToDirectory(skill, targetSkillDir);
    } else {
      const fromIRConverter = new IRToCodexSkillConverter({ removeUnsupported: options.removeUnsupported });
      const parser = new CodexSkillParser();
      const skill = fromIRConverter.fromIntermediate(ir);
      skill.dirPath = skillDir;
      await parser.writeToDirectory(skill, targetSkillDir);
    }

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
    const targetSkills =
      options.destination === "claude"
        ? await findClaudeSkills(undefined, options.claudeDir)
        : options.destination === "gemini"
          ? await findGeminiSkills(undefined, options.geminiDir)
          : await findCodexSkills(undefined, options.codexDir);

    // Generate target skill names corresponding to source
    const directories = getSkillDirectories(options.claudeDir, options.geminiDir, options.codexDir);
    const sourceDir =
      options.source === "claude"
        ? directories.claude.user
        : options.source === "gemini"
          ? directories.gemini.user
          : directories.codex.user;
    const targetDir =
      options.destination === "claude"
        ? directories.claude.user
        : options.destination === "gemini"
          ? directories.gemini.user
          : directories.codex.user;

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
} as const;

/**
 * Display results
 */
function displayResults(operations: FileOperation[], errors: Error[], isNoop: boolean): void {
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
  };

  console.log(picocolors.bold("\nSummary:"));
  if (stats.A > 0) console.log(`  ${picocolors.green("Created:")} ${stats.A}`);
  if (stats.M > 0) console.log(`  ${picocolors.yellow("Modified:")} ${stats.M}`);
  if (stats.D > 0) console.log(`  ${picocolors.red("Deleted:")} ${stats.D}`);
  if (stats["-"] > 0) console.log(`  ${picocolors.gray("Skipped:")} ${stats["-"]}`);

  // Display errors
  if (errors.length > 0) {
    console.log(picocolors.red(picocolors.bold("\nErrors:")));
    errors.forEach((error, index) => {
      console.log(picocolors.red(`  ${index + 1}. ${error.message}`));
    });
  }

  if (isNoop) {
    console.log(picocolors.cyan("\nThis was a no-op run. Use without --noop to apply changes."));
  } else if (errors.length === 0) {
    console.log(picocolors.green("\n✓ Conversion completed successfully!"));
  }
}
