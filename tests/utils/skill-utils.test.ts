import { writeFile as fsWriteFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SKILL_CONSTANTS } from "../../src/utils/constants.js";
import {
  classifySupportFile,
  collectSupportFiles,
  findSkillDirectories,
  getSkillName,
  isSkillDirectory,
} from "../../src/utils/skill-utils.js";

describe("skill-utils", () => {
  describe("classifySupportFile", () => {
    it("should classify .png as binary", () => {
      expect(classifySupportFile("icon.png")).toBe("binary");
    });

    it("should classify .pdf as binary", () => {
      expect(classifySupportFile("doc.pdf")).toBe("binary");
    });

    it("should classify .jpg as binary", () => {
      expect(classifySupportFile("photo.jpg")).toBe("binary");
    });

    it("should classify openai.yaml as config", () => {
      expect(classifySupportFile("openai.yaml")).toBe("config");
    });

    it("should classify config.json as config", () => {
      expect(classifySupportFile("config.json")).toBe("config");
    });

    it("should classify .ts as text", () => {
      expect(classifySupportFile("helper.ts")).toBe("text");
    });

    it("should classify .md as text", () => {
      expect(classifySupportFile("README.md")).toBe("text");
    });

    it("should classify nested path based on filename", () => {
      expect(classifySupportFile("subdir/images/icon.png")).toBe("binary");
    });
  });

  describe("getSkillName", () => {
    it("should extract skill name from directory path", () => {
      expect(getSkillName("/home/user/.claude/skills/my-skill")).toBe("my-skill");
    });

    it("should handle simple directory name", () => {
      expect(getSkillName("/skills/test")).toBe("test");
    });
  });

  // File I/O tests use tmpdir
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `skill-utils-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true });
    } catch {
      // Ignore
    }
  });

  describe("isSkillDirectory", () => {
    it("should return true for directory with SKILL.md", async () => {
      await fsWriteFile(join(testDir, SKILL_CONSTANTS.SKILL_FILE_NAME), "content");
      expect(await isSkillDirectory(testDir)).toBe(true);
    });

    it("should return false for directory without SKILL.md", async () => {
      await fsWriteFile(join(testDir, "other.md"), "content");
      expect(await isSkillDirectory(testDir)).toBe(false);
    });

    it("should return false for non-existent directory", async () => {
      expect(await isSkillDirectory(join(testDir, "nonexistent"))).toBe(false);
    });
  });

  describe("collectSupportFiles", () => {
    it("should collect text files excluding SKILL.md", async () => {
      await fsWriteFile(join(testDir, SKILL_CONSTANTS.SKILL_FILE_NAME), "skill content");
      await fsWriteFile(join(testDir, "helper.ts"), "export const x = 1;");
      await fsWriteFile(join(testDir, "README.md"), "readme");

      const files = await collectSupportFiles(testDir);
      expect(files).toHaveLength(2);
      expect(files.find((f) => f.relativePath === "helper.ts")).toBeDefined();
      expect(files.find((f) => f.relativePath === "README.md")).toBeDefined();
      expect(files.find((f) => f.relativePath === SKILL_CONSTANTS.SKILL_FILE_NAME)).toBeUndefined();
    });

    it("should collect files from nested directories", async () => {
      await fsWriteFile(join(testDir, SKILL_CONSTANTS.SKILL_FILE_NAME), "skill");
      await mkdir(join(testDir, "lib", "utils"), { recursive: true });
      await fsWriteFile(join(testDir, "lib", "utils", "deep.ts"), "deep");

      const files = await collectSupportFiles(testDir);
      expect(files).toHaveLength(1);
      expect(files[0].relativePath).toBe(join("lib", "utils", "deep.ts"));
      expect(files[0].type).toBe("text");
    });

    it("should respect custom exclude patterns", async () => {
      await fsWriteFile(join(testDir, SKILL_CONSTANTS.SKILL_FILE_NAME), "skill");
      await fsWriteFile(join(testDir, "keep.ts"), "keep");
      await fsWriteFile(join(testDir, "exclude-me.ts"), "exclude");

      const files = await collectSupportFiles(testDir, [SKILL_CONSTANTS.SKILL_FILE_NAME, "exclude-me.ts"]);
      expect(files).toHaveLength(1);
      expect(files[0].relativePath).toBe("keep.ts");
    });

    it("should return empty array for directory with only SKILL.md", async () => {
      await fsWriteFile(join(testDir, SKILL_CONSTANTS.SKILL_FILE_NAME), "skill");

      const files = await collectSupportFiles(testDir);
      expect(files).toEqual([]);
    });

    it("should classify binary files correctly", async () => {
      await fsWriteFile(join(testDir, SKILL_CONSTANTS.SKILL_FILE_NAME), "skill");
      await fsWriteFile(join(testDir, "image.png"), Buffer.from([0x89, 0x50]));

      const files = await collectSupportFiles(testDir);
      expect(files).toHaveLength(1);
      expect(files[0].type).toBe("binary");
    });
  });

  describe("findSkillDirectories", () => {
    it("should find multiple skill directories", async () => {
      const skill1 = join(testDir, "skill-a");
      const skill2 = join(testDir, "skill-b");
      await mkdir(skill1);
      await mkdir(skill2);
      await fsWriteFile(join(skill1, SKILL_CONSTANTS.SKILL_FILE_NAME), "a");
      await fsWriteFile(join(skill2, SKILL_CONSTANTS.SKILL_FILE_NAME), "b");

      const dirs = await findSkillDirectories(testDir);
      expect(dirs).toHaveLength(2);
    });

    it("should skip directories without SKILL.md", async () => {
      const valid = join(testDir, "valid-skill");
      const invalid = join(testDir, "not-a-skill");
      await mkdir(valid);
      await mkdir(invalid);
      await fsWriteFile(join(valid, SKILL_CONSTANTS.SKILL_FILE_NAME), "skill");
      await fsWriteFile(join(invalid, "random.txt"), "text");

      const dirs = await findSkillDirectories(testDir);
      expect(dirs).toHaveLength(1);
      expect(dirs[0]).toContain("valid-skill");
    });

    it("should return empty array for non-existent path", async () => {
      const dirs = await findSkillDirectories(join(testDir, "nonexistent"));
      expect(dirs).toEqual([]);
    });
  });
});
