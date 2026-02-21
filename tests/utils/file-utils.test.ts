import { mkdir, rm, writeFile as fsWriteFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AGENT_REGISTRY } from "../../src/agents/registry.js";
import { SKILL_CONSTANTS } from "../../src/utils/constants.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  autoCompleteExtension,
  deleteFile,
  directoryExists,
  ensureDirectory,
  fileExists,
  findAgentCommands,
  findAgentSkills,
  getBaseName,
  getCommandName,
  getFilePathFromCommandName,
  getSkillNameFromPath,
  getSkillPathFromName,
  readFile,
  writeFile,
} from "../../src/utils/file-utils.js";

describe("FileUtils", () => {
  let testDir: string;
  let testFile: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `test-dir-${Date.now()}`);
    testFile = join(testDir, "test.txt");
    await ensureDirectory(testDir);
  });

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true });
    } catch {
      // Ignore if directory does not exist
    }
  });

  describe("fileExists", () => {
    it("should return true for existing file", async () => {
      await writeFile(testFile, "test content");
      expect(await fileExists(testFile)).toBe(true);
    });

    it("should return false for non-existing file", async () => {
      expect(await fileExists("/non/existent/file.txt")).toBe(false);
    });
  });

  describe("directoryExists", () => {
    it("should return true for existing directory", async () => {
      expect(await directoryExists(testDir)).toBe(true);
    });

    it("should return false for non-existing directory", async () => {
      expect(await directoryExists("/non/existent/directory")).toBe(false);
    });

    it("should return false for file path", async () => {
      await writeFile(testFile, "test");
      expect(await directoryExists(testFile)).toBe(false);
    });
  });

  describe("ensureDirectory", () => {
    it("should create directory if it does not exist", async () => {
      const newDir = join(testDir, "new-dir");
      await ensureDirectory(newDir);
      expect(await directoryExists(newDir)).toBe(true);
    });

    it("should create nested directories", async () => {
      const nestedDir = join(testDir, "level1", "level2", "level3");
      await ensureDirectory(nestedDir);
      expect(await directoryExists(nestedDir)).toBe(true);
    });

    it("should not fail if directory already exists", async () => {
      await expect(ensureDirectory(testDir)).resolves.not.toThrow();
    });
  });

  describe("readFile and writeFile", () => {
    it("should write and read file content", async () => {
      const content = "Hello, World!";
      await writeFile(testFile, content);

      const readContent = await readFile(testFile);
      expect(readContent).toBe(content);
    });

    it("should create directory when writing file", async () => {
      const nestedFile = join(testDir, "nested", "file.txt");
      await writeFile(nestedFile, "content");

      expect(await fileExists(nestedFile)).toBe(true);
      expect(await readFile(nestedFile)).toBe("content");
    });

    it("should throw error when reading non-existent file", async () => {
      await expect(readFile("/non/existent/file.txt")).rejects.toThrow("Failed to read file");
    });
  });

  describe("deleteFile", () => {
    it("should delete existing file", async () => {
      await writeFile(testFile, "content");
      expect(await fileExists(testFile)).toBe(true);

      await deleteFile(testFile);
      expect(await fileExists(testFile)).toBe(false);
    });

    it("should throw error when deleting non-existent file", async () => {
      await expect(deleteFile("/non/existent/file.txt")).rejects.toThrow("Failed to delete file");
    });
  });

  describe("autoCompleteExtension", () => {
    it("should add extension if not present", () => {
      expect(autoCompleteExtension("filename", [".md", ".txt"])).toBe("filename.md");
    });

    it("should not add extension if already present", () => {
      expect(autoCompleteExtension("filename.txt", [".md", ".txt"])).toBe("filename.txt");
    });

    it("should use first extension as default", () => {
      expect(autoCompleteExtension("test", [".toml", ".yaml", ".yml"])).toBe("test.toml");
    });
  });

  describe("getBaseName", () => {
    it("should return filename without extension", () => {
      expect(getBaseName("command.md")).toBe("command");
      expect(getBaseName("path/to/command.toml")).toBe("command");
    });

    it("should return filename if no extension", () => {
      expect(getBaseName("command")).toBe("command");
      expect(getBaseName("path/to/command")).toBe("command");
    });

    it("should handle multiple dots", () => {
      expect(getBaseName("file.name.ext")).toBe("file.name");
    });
  });

  describe("getCommandName", () => {
    it("should generate command name from file path", () => {
      const baseDir = "/base/commands";
      const filePath = "/base/commands/git/commit.md";

      expect(getCommandName(filePath, baseDir)).toBe("git:commit");
    });

    it("should handle single level command", () => {
      const baseDir = "/base/commands";
      const filePath = "/base/commands/test.md";

      expect(getCommandName(filePath, baseDir)).toBe("test");
    });

    it("should handle nested directories", () => {
      const baseDir = "/base/commands";
      const filePath = "/base/commands/frontend/react/component.md";

      expect(getCommandName(filePath, baseDir)).toBe("frontend:react:component");
    });
  });

  describe("getFilePathFromCommandName", () => {
    it("should generate file path from command name", () => {
      const baseDir = "/base/commands";
      const commandName = "git:commit";
      const extension = ".md";

      const result = getFilePathFromCommandName(commandName, baseDir, extension);
      expect(result).toBe("/base/commands/git/commit.md");
    });

    it("should handle single level command", () => {
      const baseDir = "/base/commands";
      const commandName = "test";
      const extension = ".toml";

      const result = getFilePathFromCommandName(commandName, baseDir, extension);
      expect(result).toBe("/base/commands/test.toml");
    });

    it("should handle deeply nested command", () => {
      const baseDir = "/base/commands";
      const commandName = "frontend:react:component";
      const extension = ".md";

      const result = getFilePathFromCommandName(commandName, baseDir, extension);
      expect(result).toBe("/base/commands/frontend/react/component.md");
    });
  });

  describe("findAgentCommands", () => {
    describe("claude", () => {
      it("should find .md files in custom directory", async () => {
        const commandsDir = join(testDir, "commands");
        await mkdir(commandsDir, { recursive: true });
        await fsWriteFile(join(commandsDir, "test.md"), "# Test", "utf-8");
        await fsWriteFile(join(commandsDir, "deploy.md"), "# Deploy", "utf-8");

        const result = await findAgentCommands(AGENT_REGISTRY.claude, undefined, testDir);
        expect(result).toHaveLength(2);
        expect(result).toContain(join(commandsDir, "deploy.md"));
        expect(result).toContain(join(commandsDir, "test.md"));
      });

      it("should return empty array for non-existent directory", async () => {
        const result = await findAgentCommands(AGENT_REGISTRY.claude, undefined, "/non/existent/path");
        expect(result).toEqual([]);
      });

      it("should find specific file by name", async () => {
        const commandsDir = join(testDir, "commands");
        await mkdir(commandsDir, { recursive: true });
        await fsWriteFile(join(commandsDir, "target.md"), "# Target", "utf-8");
        await fsWriteFile(join(commandsDir, "other.md"), "# Other", "utf-8");

        const result = await findAgentCommands(AGENT_REGISTRY.claude, "target", testDir);
        expect(result).toHaveLength(1);
        expect(result[0]).toBe(join(commandsDir, "target.md"));
      });
    });

    describe("gemini", () => {
      it("should find .toml files in custom directory", async () => {
        const commandsDir = join(testDir, "commands");
        await mkdir(commandsDir, { recursive: true });
        await fsWriteFile(join(commandsDir, "test.toml"), "[prompt]\ncontent = 'test'", "utf-8");

        const result = await findAgentCommands(AGENT_REGISTRY.gemini, undefined, testDir);
        expect(result).toHaveLength(1);
        expect(result[0]).toBe(join(commandsDir, "test.toml"));
      });

      it("should return empty array for non-existent directory", async () => {
        const result = await findAgentCommands(AGENT_REGISTRY.gemini, undefined, "/non/existent/path");
        expect(result).toEqual([]);
      });
    });

    describe("codex", () => {
      it("should find .md files in prompts directory", async () => {
        const promptsDir = join(testDir, "prompts");
        await mkdir(promptsDir, { recursive: true });
        await fsWriteFile(join(promptsDir, "review.md"), "# Review", "utf-8");

        const result = await findAgentCommands(AGENT_REGISTRY.codex, undefined, testDir);
        expect(result).toHaveLength(1);
        expect(result[0]).toBe(join(promptsDir, "review.md"));
      });
    });

    describe("opencode", () => {
      it("should find .md files in commands directory", async () => {
        const commandsDir = join(testDir, "commands");
        await mkdir(commandsDir, { recursive: true });
        await fsWriteFile(join(commandsDir, "review.md"), "# Review", "utf-8");

        const result = await findAgentCommands(AGENT_REGISTRY.opencode, undefined, testDir);
        expect(result).toHaveLength(1);
        expect(result[0]).toBe(join(commandsDir, "review.md"));
      });

      it("should return empty array for non-existent directory", async () => {
        const result = await findAgentCommands(AGENT_REGISTRY.opencode, undefined, "/non/existent/path");
        expect(result).toEqual([]);
      });
    });
  });

  describe("findAgentSkills", () => {
    describe("claude", () => {
      it("should find directories containing SKILL.md", async () => {
        const skillsDir = join(testDir, "skills");
        const skillA = join(skillsDir, "skill-a");
        const skillB = join(skillsDir, "skill-b");
        await mkdir(skillA, { recursive: true });
        await mkdir(skillB, { recursive: true });
        await fsWriteFile(join(skillA, SKILL_CONSTANTS.SKILL_FILE_NAME), "# Skill A", "utf-8");
        await fsWriteFile(join(skillB, SKILL_CONSTANTS.SKILL_FILE_NAME), "# Skill B", "utf-8");

        const result = await findAgentSkills(AGENT_REGISTRY.claude, undefined, testDir);
        expect(result).toHaveLength(2);
        expect(result).toContain(skillA);
        expect(result).toContain(skillB);
      });

      it("should find specific skill by name", async () => {
        const skillsDir = join(testDir, "skills");
        const skillA = join(skillsDir, "skill-a");
        await mkdir(skillA, { recursive: true });
        await fsWriteFile(join(skillA, SKILL_CONSTANTS.SKILL_FILE_NAME), "# Skill A", "utf-8");

        const result = await findAgentSkills(AGENT_REGISTRY.claude, "skill-a", testDir);
        expect(result).toHaveLength(1);
        expect(result[0]).toBe(skillA);
      });

      it("should return empty for non-existent specific skill", async () => {
        const skillsDir = join(testDir, "skills");
        await mkdir(skillsDir, { recursive: true });

        const result = await findAgentSkills(AGENT_REGISTRY.claude, "non-existent", testDir);
        expect(result).toEqual([]);
      });

      it("should skip directories without SKILL.md", async () => {
        const skillsDir = join(testDir, "skills");
        const withSkill = join(skillsDir, "with-skill");
        const withoutSkill = join(skillsDir, "without-skill");
        await mkdir(withSkill, { recursive: true });
        await mkdir(withoutSkill, { recursive: true });
        await fsWriteFile(join(withSkill, SKILL_CONSTANTS.SKILL_FILE_NAME), "# Skill", "utf-8");
        await fsWriteFile(join(withoutSkill, "README.md"), "# Not a skill", "utf-8");

        const result = await findAgentSkills(AGENT_REGISTRY.claude, undefined, testDir);
        expect(result).toHaveLength(1);
        expect(result[0]).toBe(withSkill);
      });
    });

    describe("opencode", () => {
      it("should find skill directories in custom directory", async () => {
        const skillsDir = join(testDir, "skills");
        const skill = join(skillsDir, "opencode-skill");
        await mkdir(skill, { recursive: true });
        await fsWriteFile(join(skill, SKILL_CONSTANTS.SKILL_FILE_NAME), "# Skill", "utf-8");

        const result = await findAgentSkills(AGENT_REGISTRY.opencode, undefined, testDir);
        expect(result).toHaveLength(1);
        expect(result[0]).toBe(skill);
      });

      it("should return empty for non-existent specific skill", async () => {
        const skillsDir = join(testDir, "skills");
        await mkdir(skillsDir, { recursive: true });

        const result = await findAgentSkills(AGENT_REGISTRY.opencode, "non-existent", testDir);
        expect(result).toEqual([]);
      });
    });
  });

  describe("getSkillNameFromPath", () => {
    it("should extract skill name from path", () => {
      expect(getSkillNameFromPath("/base/skills/my-skill", "/base/skills")).toBe("my-skill");
    });

    it("should handle nested paths", () => {
      expect(getSkillNameFromPath("/base/skills/category/my-skill", "/base/skills")).toBe("category/my-skill");
    });
  });

  describe("getSkillPathFromName", () => {
    it("should build path from skill name", () => {
      expect(getSkillPathFromName("my-skill", "/base/skills")).toBe("/base/skills/my-skill");
    });

    it("should handle skill name with separators", () => {
      expect(getSkillPathFromName("category/my-skill", "/base/skills")).toBe("/base/skills/category/my-skill");
    });
  });
});
