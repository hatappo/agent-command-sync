import { rm } from "node:fs/promises";
import picocolors from "picocolors";
import { assertNever } from "../utils/assert-never.js";
import { ClaudeCommandConverter } from "../converters/claude-command-converter.js";
import { CodexCommandConverter } from "../converters/codex-command-converter.js";
import { GeminiCommandConverter } from "../converters/gemini-command-converter.js";
import { OpenCodeCommandConverter } from "../converters/opencode-command-converter.js";
import { ClaudeSkillConverter } from "../converters/claude-skill-converter.js";
import { GeminiSkillConverter } from "../converters/gemini-skill-converter.js";
import { CodexSkillConverter } from "../converters/codex-skill-converter.js";
import { OpenCodeSkillConverter } from "../converters/opencode-skill-converter.js";
import { ClaudeParser } from "../parsers/claude-parser.js";
import { CodexParser } from "../parsers/codex-parser.js";
import { GeminiParser } from "../parsers/gemini-parser.js";
import { OpenCodeParser } from "../parsers/opencode-parser.js";
import { ClaudeSkillParser } from "../parsers/claude-skill-parser.js";
import { GeminiSkillParser } from "../parsers/gemini-skill-parser.js";
import { CodexSkillParser } from "../parsers/codex-skill-parser.js";
import { OpenCodeSkillParser } from "../parsers/opencode-skill-parser.js";
import type { ConversionResult, FileOperation, SemanticIR } from "../types/index.js";
import {
  deleteFile,
  directoryExists,
  fileExists,
  findClaudeCommands,
  findCodexCommands,
  findGeminiCommands,
  findOpenCodeCommands,
  findClaudeSkills,
  findGeminiSkills,
  findCodexSkills,
  findOpenCodeSkills,
  getCommandDirectories,
  getSkillDirectories,
  getCommandName,
  getFilePathFromCommandName,
  getSkillNameFromPath,
  getSkillPathFromName,
  writeFile,
} from "../utils/file-utils.js";

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
              default:
                assertNever(op.type);
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
              default:
                assertNever(op.type);
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
  switch (options.source) {
    case "claude":
      return await findClaudeCommands(options.file, options.claudeDir);
    case "gemini":
      return await findGeminiCommands(options.file, options.geminiDir);
    case "opencode":
      return await findOpenCodeCommands(options.file, options.opencodeDir);
    case "codex":
      return await findCodexCommands(options.file, options.codexDir);
    default:
      assertNever(options.source);
  }
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
    let ir: SemanticIR;

    switch (options.source) {
      case "claude": {
        const parser = new ClaudeParser();
        const converter = new ClaudeCommandConverter();
        const command = await parser.parse(sourceFile);
        ir = converter.toIR(command);
        break;
      }
      case "gemini": {
        const parser = new GeminiParser();
        const converter = new GeminiCommandConverter();
        const command = await parser.parse(sourceFile);
        ir = converter.toIR(command);
        break;
      }
      case "opencode": {
        const parser = new OpenCodeParser();
        const converter = new OpenCodeCommandConverter();
        const command = await parser.parse(sourceFile);
        ir = converter.toIR(command);
        break;
      }
      case "codex": {
        const parser = new CodexParser();
        const converter = new CodexCommandConverter();
        const command = await parser.parse(sourceFile);
        ir = converter.toIR(command);
        break;
      }
      default:
        assertNever(options.source);
    }

    // Step 2: Convert from SemanticIR to target format
    const converterOptions = { removeUnsupported: options.removeUnsupported };
    let targetContent: string;
    let targetExt: string;

    switch (options.destination) {
      case "claude": {
        const converter = new ClaudeCommandConverter();
        const claudeParser = new ClaudeParser();
        const command = converter.fromIR(ir, converterOptions);
        targetContent = claudeParser.stringify(command);
        targetExt = ".md";
        break;
      }
      case "gemini": {
        const converter = new GeminiCommandConverter();
        const geminiParser = new GeminiParser();
        const command = converter.fromIR(ir, converterOptions);
        targetContent = geminiParser.stringify(command);
        targetExt = ".toml";
        break;
      }
      case "opencode": {
        const converter = new OpenCodeCommandConverter();
        const opencodeParser = new OpenCodeParser();
        const command = converter.fromIR(ir, converterOptions);
        targetContent = opencodeParser.stringify(command);
        targetExt = ".md";
        break;
      }
      case "codex": {
        const converter = new CodexCommandConverter();
        const codexParser = new CodexParser();
        const command = converter.fromIR(ir, converterOptions);
        targetContent = codexParser.stringify(command);
        targetExt = ".md";
        break;
      }
      default:
        assertNever(options.destination);
    }

    // Determine target file path (user directory only)
    const directories = getCommandDirectories(options.claudeDir, options.geminiDir, options.codexDir, options.opencodeDir);
    const sourceDir = directories[options.source].user;
    const targetDir = directories[options.destination].user;

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
    let targetFiles: string[];
    switch (options.destination) {
      case "claude":
        targetFiles = await findClaudeCommands(undefined, options.claudeDir);
        break;
      case "gemini":
        targetFiles = await findGeminiCommands(undefined, options.geminiDir);
        break;
      case "opencode":
        targetFiles = await findOpenCodeCommands(undefined, options.opencodeDir);
        break;
      case "codex":
        targetFiles = await findCodexCommands(undefined, options.codexDir);
        break;
      default:
        assertNever(options.destination);
    }

    // Generate target file names corresponding to source (user directory only)
    const directories = getCommandDirectories(options.claudeDir, options.geminiDir, options.codexDir, options.opencodeDir);
    const sourceDir = directories[options.source].user;
    const targetDir = directories[options.destination].user;
    const targetExt = options.destination === "gemini" ? ".toml" : ".md";

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
  switch (options.source) {
    case "claude":
      return await findClaudeSkills(options.file, options.claudeDir);
    case "gemini":
      return await findGeminiSkills(options.file, options.geminiDir);
    case "opencode":
      return await findOpenCodeSkills(options.file, options.opencodeDir);
    case "codex":
      return await findCodexSkills(options.file, options.codexDir);
    default:
      assertNever(options.source);
  }
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
    let ir: SemanticIR;

    switch (options.source) {
      case "claude": {
        const parser = new ClaudeSkillParser();
        const converter = new ClaudeSkillConverter();
        const skill = await parser.parse(skillDir);
        ir = converter.toIR(skill);
        break;
      }
      case "gemini": {
        const parser = new GeminiSkillParser();
        const converter = new GeminiSkillConverter();
        const skill = await parser.parse(skillDir);
        ir = converter.toIR(skill);
        break;
      }
      case "opencode": {
        const parser = new OpenCodeSkillParser();
        const converter = new OpenCodeSkillConverter();
        const skill = await parser.parse(skillDir);
        ir = converter.toIR(skill);
        break;
      }
      case "codex": {
        const parser = new CodexSkillParser();
        const converter = new CodexSkillConverter();
        const skill = await parser.parse(skillDir);
        ir = converter.toIR(skill);
        break;
      }
      default:
        assertNever(options.source);
    }

    // Get skill directories
    const directories = getSkillDirectories(options.claudeDir, options.geminiDir, options.codexDir, options.opencodeDir);
    const sourceDir = directories[options.source].user;
    const targetDir = directories[options.destination].user;

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

    // Step 3: Convert from SemanticIR to target format and write
    const converterOptions = { removeUnsupported: options.removeUnsupported };

    switch (options.destination) {
      case "claude": {
        const converter = new ClaudeSkillConverter();
        const parser = new ClaudeSkillParser();
        const skill = converter.fromIR(ir, converterOptions);
        skill.dirPath = skillDir; // Keep source path for copying support files
        await parser.writeToDirectory(skill, targetSkillDir);
        break;
      }
      case "gemini": {
        const converter = new GeminiSkillConverter();
        const parser = new GeminiSkillParser();
        const skill = converter.fromIR(ir, converterOptions);
        skill.dirPath = skillDir;
        await parser.writeToDirectory(skill, targetSkillDir);
        break;
      }
      case "opencode": {
        const converter = new OpenCodeSkillConverter();
        const parser = new OpenCodeSkillParser();
        const skill = converter.fromIR(ir, converterOptions);
        skill.dirPath = skillDir;
        await parser.writeToDirectory(skill, targetSkillDir);
        break;
      }
      case "codex": {
        const converter = new CodexSkillConverter();
        const parser = new CodexSkillParser();
        const skill = converter.fromIR(ir, converterOptions);
        skill.dirPath = skillDir;
        await parser.writeToDirectory(skill, targetSkillDir);
        break;
      }
      default:
        assertNever(options.destination);
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
    let targetSkills: string[];
    switch (options.destination) {
      case "claude":
        targetSkills = await findClaudeSkills(undefined, options.claudeDir);
        break;
      case "gemini":
        targetSkills = await findGeminiSkills(undefined, options.geminiDir);
        break;
      case "opencode":
        targetSkills = await findOpenCodeSkills(undefined, options.opencodeDir);
        break;
      case "codex":
        targetSkills = await findCodexSkills(undefined, options.codexDir);
        break;
      default:
        assertNever(options.destination);
    }

    // Generate target skill names corresponding to source
    const directories = getSkillDirectories(options.claudeDir, options.geminiDir, options.codexDir, options.opencodeDir);
    const sourceDir = directories[options.source].user;
    const targetDir = directories[options.destination].user;

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
