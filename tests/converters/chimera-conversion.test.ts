import { describe, expect, it } from "vitest";
import { ChimeraAgent } from "../../src/agents/chimera.js";
import { ClaudeAgent } from "../../src/agents/claude.js";
import { GeminiAgent } from "../../src/agents/gemini.js";
import type { ChimeraCommand } from "../../src/types/command.js";
import type { ChimeraSkill } from "../../src/types/skill.js";
import type { ClaudeCommand } from "../../src/types/index.js";

describe("Chimera Conversion", () => {
  const chimera = new ChimeraAgent();
  const claude = new ClaudeAgent();
  const gemini = new GeminiAgent();

  describe("Import: Claude -> Chimera", () => {
    it("should store Claude extras in _chimera.claude", () => {
      const source: ClaudeCommand = {
        frontmatter: {
          description: "Test command",
          "allowed-tools": "Read,Write",
          model: "opus-4",
          "argument-hint": "file path",
        },
        content: "Review $ARGUMENTS",
        filePath: "/test/review.md",
      };

      const ir = claude.commandToIR(source);
      const result = chimera.commandFromIR(ir);

      expect(result.frontmatter.description).toBe("Test command");
      expect(result.frontmatter._chimera?.claude?.["allowed-tools"]).toBe("Read,Write");
      expect(result.frontmatter._chimera?.claude?.model).toBe("opus-4");
      expect(result.frontmatter._chimera?.claude?.["argument-hint"]).toBe("file path");
      // Extras should NOT leak to top-level
      expect(result.frontmatter["allowed-tools"]).toBeUndefined();
      expect(result.frontmatter.model).toBeUndefined();
    });

    it("should preserve body with Claude placeholders", () => {
      const source: ClaudeCommand = {
        frontmatter: { description: "Test" },
        content: "Run !`git diff` with $ARGUMENTS and @config.json",
        filePath: "/test/cmd.md",
      };

      const ir = claude.commandToIR(source);
      const result = chimera.commandFromIR(ir);

      expect(result.content).toBe("Run !`git diff` with $ARGUMENTS and @config.json");
    });
  });

  describe("Import merge: preserves other agents", () => {
    it("should merge Claude extras while preserving existing Gemini extras", () => {
      const source: ClaudeCommand = {
        frontmatter: {
          description: "Updated desc",
          "allowed-tools": "Read",
          model: "sonnet",
        },
        content: "Body",
        filePath: "/test/cmd.md",
      };

      const existingTarget: ChimeraCommand = {
        frontmatter: {
          description: "Old desc",
          _chimera: {
            gemini: { "custom-field": "preserved-value" },
            claude: { "allowed-tools": "old-tools", model: "old-model" },
          },
        },
        content: "Old body",
        filePath: "/test/cmd.md",
      };

      const ir = claude.commandToIR(source);
      const result = chimera.commandFromIR(ir, { existingTarget });

      // Claude section should be overwritten
      expect(result.frontmatter._chimera?.claude?.["allowed-tools"]).toBe("Read");
      expect(result.frontmatter._chimera?.claude?.model).toBe("sonnet");
      // Gemini section should be preserved
      expect(result.frontmatter._chimera?.gemini?.["custom-field"]).toBe("preserved-value");
    });
  });

  describe("Apply: Chimera -> Gemini (with destinationType)", () => {
    it("should use _chimera.gemini extras when applying to Gemini", () => {
      const source: ChimeraCommand = {
        frontmatter: {
          description: "Review code",
          _chimera: {
            claude: { "allowed-tools": "Read,Write", model: "opus-4" },
            gemini: { "custom-gemini-field": "gemini-value" },
          },
        },
        content: "Review $ARGUMENTS",
        filePath: "/test/review.md",
      };

      const ir = chimera.commandToIR(source, { destinationType: "gemini" });
      const result = gemini.commandFromIR(ir);

      expect(result.description).toBe("Review code");
      expect(result["custom-gemini-field"]).toBe("gemini-value");
      // Claude extras should NOT be in the output
      expect(result["allowed-tools"]).toBeUndefined();
    });

    it("should use _chimera.claude extras when applying to Claude", () => {
      const source: ChimeraCommand = {
        frontmatter: {
          description: "Review code",
          _chimera: {
            claude: { "allowed-tools": "Read,Write", model: "opus-4" },
            gemini: { "custom-gemini-field": "gemini-value" },
          },
        },
        content: "Review $ARGUMENTS",
        filePath: "/test/review.md",
      };

      const ir = chimera.commandToIR(source, { destinationType: "claude" });
      const result = claude.commandFromIR(ir);

      expect(result.frontmatter.description).toBe("Review code");
      expect(result.frontmatter["allowed-tools"]).toBe("Read,Write");
      expect(result.frontmatter.model).toBe("opus-4");
      // Gemini extras should NOT be in the output
      expect(result.frontmatter["custom-gemini-field"]).toBeUndefined();
    });
  });

  describe("Apply fallback: _chimera.{target} absent", () => {
    it("should return empty extras when target section is absent", () => {
      const source: ChimeraCommand = {
        frontmatter: {
          description: "Simple command",
          _chimera: {
            claude: { model: "opus-4" },
          },
        },
        content: "Body",
        filePath: "/test/cmd.md",
      };

      const ir = chimera.commandToIR(source, { destinationType: "gemini" });

      // No gemini section, so extras should be empty
      expect(ir.extras).toEqual({});
      expect(ir.semantic.description).toBe("Simple command");
    });
  });

  describe("_chimera leak prevention", () => {
    it("should never include _chimera in IR extras", () => {
      const source: ChimeraCommand = {
        frontmatter: {
          description: "Test",
          _chimera: {
            claude: { model: "opus-4" },
          },
        },
        content: "Body",
        filePath: "/test/cmd.md",
      };

      // Without destinationType
      const ir1 = chimera.commandToIR(source);
      expect(ir1.extras._chimera).toBeUndefined();

      // With destinationType
      const ir2 = chimera.commandToIR(source, { destinationType: "claude" });
      expect(ir2.extras._chimera).toBeUndefined();
    });
  });

  describe("Body round-trip through Chimera", () => {
    it("should preserve Claude syntax through chimera", () => {
      const original: ClaudeCommand = {
        frontmatter: { description: "Test" },
        content: "Run !`git status` with $ARGUMENTS and load @config.json",
        filePath: "/test/cmd.md",
      };

      const ir1 = claude.commandToIR(original);
      const chimeraCmd = chimera.commandFromIR(ir1);
      const ir2 = chimera.commandToIR(chimeraCmd, { destinationType: "claude" });
      const result = claude.commandFromIR(ir2);

      expect(result.content).toBe("Run !`git status` with $ARGUMENTS and load @config.json");
    });
  });

  describe("Cross-agent round-trip: Claude -> Chimera -> Gemini", () => {
    it("should convert accurately with extras", () => {
      const source: ClaudeCommand = {
        frontmatter: {
          description: "Cross-agent test",
          "allowed-tools": "Read",
          model: "sonnet",
        },
        content: "Run !`npm test` with $ARGUMENTS",
        filePath: "/test/cmd.md",
      };

      // Import: Claude -> Chimera
      const ir1 = claude.commandToIR(source);
      const chimeraCmd = chimera.commandFromIR(ir1);

      expect(chimeraCmd.frontmatter.description).toBe("Cross-agent test");
      expect(chimeraCmd.frontmatter._chimera?.claude?.model).toBe("sonnet");

      // Apply: Chimera -> Gemini
      const ir2 = chimera.commandToIR(chimeraCmd, { destinationType: "gemini" });
      const geminiCmd = gemini.commandFromIR(ir2);

      expect(geminiCmd.description).toBe("Cross-agent test");
      expect(geminiCmd.prompt).toBe("Run !{npm test} with {{args}}");
      // No gemini section in chimera, so no extras
      expect(geminiCmd["allowed-tools"]).toBeUndefined();
    });
  });

  describe("Skill conversion", () => {
    it("should import Claude skill into chimera with extras in _chimera.claude", () => {
      const claudeAgent = new ClaudeAgent();
      const skill = {
        name: "test-skill",
        description: "Test skill",
        content: "Skill body with $ARGUMENTS",
        dirPath: "/test/skill",
        supportFiles: [],
        frontmatter: {
          name: "test-skill",
          description: "Test skill",
          "allowed-tools": "Read,Write",
          model: "opus-4",
          "user-invocable": true,
        },
      };

      const ir = claudeAgent.skillToIR(skill);
      const result = chimera.skillFromIR(ir);

      expect(result.frontmatter.name).toBe("test-skill");
      expect(result.frontmatter.description).toBe("Test skill");
      expect(result.frontmatter._chimera?.claude?.["allowed-tools"]).toBe("Read,Write");
      expect(result.frontmatter._chimera?.claude?.model).toBe("opus-4");
      expect(result.frontmatter._chimera?.claude?.["user-invocable"]).toBe(true);
    });

    it("should apply chimera skill with _chimera.claude extras to Claude", () => {
      const claudeAgent = new ClaudeAgent();
      const source: ChimeraSkill = {
        name: "test-skill",
        description: "Test skill",
        content: "Skill body with $ARGUMENTS",
        dirPath: "/test/skill",
        supportFiles: [],
        frontmatter: {
          name: "test-skill",
          description: "Test skill",
          "disable-model-invocation": false,
          _chimera: {
            claude: { "allowed-tools": "Read,Write", model: "opus-4" },
          },
        },
      };

      const ir = chimera.skillToIR(source, { destinationType: "claude" });
      const result = claudeAgent.skillFromIR(ir);

      expect(result.frontmatter.name).toBe("test-skill");
      expect(result.frontmatter.description).toBe("Test skill");
      expect(result.frontmatter["allowed-tools"]).toBe("Read,Write");
      expect(result.frontmatter.model).toBe("opus-4");
      expect(result.frontmatter["disable-model-invocation"]).toBe(false);
    });

    it("should merge skill extras preserving other agents", () => {
      const claudeAgent = new ClaudeAgent();
      const skill = {
        name: "merge-skill",
        description: "Merge test",
        content: "Body",
        dirPath: "/test/skill",
        supportFiles: [],
        frontmatter: {
          name: "merge-skill",
          description: "Merge test",
          "allowed-tools": "Read",
        },
      };

      const existingTarget: ChimeraSkill = {
        name: "merge-skill",
        description: "Old",
        content: "Old body",
        dirPath: "/test/skill",
        supportFiles: [],
        frontmatter: {
          name: "merge-skill",
          description: "Old",
          _chimera: {
            gemini: { "custom-field": "preserved" },
          },
        },
      };

      const ir = claudeAgent.skillToIR(skill);
      const result = chimera.skillFromIR(ir, { existingTarget });

      expect(result.frontmatter._chimera?.claude?.["allowed-tools"]).toBe("Read");
      expect(result.frontmatter._chimera?.gemini?.["custom-field"]).toBe("preserved");
    });
  });
});
