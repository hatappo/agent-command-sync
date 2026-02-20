import { describe, expect, it } from "vitest";
import { ClaudeSkillConverter } from "../../src/converters/claude-skill-converter.js";
import { GeminiSkillConverter } from "../../src/converters/gemini-skill-converter.js";
import { CodexSkillConverter } from "../../src/converters/codex-skill-converter.js";
import type { ClaudeSkill } from "../../src/types/index.js";

describe("Skill Conversion (Safety Net)", () => {
  describe("Claude -> Gemini (removeUnsupported=false)", () => {
    it("should preserve Claude-specific fields with _claude_ prefix", () => {
      const claude: ClaudeSkill = {
        name: "test-skill",
        description: "Test description",
        content: "Test content",
        dirPath: "/test/skills/test-skill",
        supportFiles: [],
        frontmatter: {
          name: "test-skill",
          description: "Test description",
          "disable-model-invocation": true,
          "user-invocable": false,
          "allowed-tools": "bash",
          model: "sonnet",
          context: "fork",
          agent: "task",
          hooks: { "pre-tool-execution": "echo test" },
        },
      };

      const claudeConverter = new ClaudeSkillConverter();
      const geminiConverter = new GeminiSkillConverter();
      const ir = claudeConverter.toIR(claude);
      const gemini = geminiConverter.fromIR(ir, { removeUnsupported: false });

      expect(gemini.frontmatter.name).toBe("test-skill");
      expect(gemini.frontmatter.description).toBe("Test description");
      expect(gemini.frontmatter._claude_disable_model_invocation).toBe(true);
      expect(gemini.frontmatter._claude_user_invocable).toBe(false);
      expect(gemini.frontmatter._claude_allowed_tools).toBe("bash");
      expect(gemini.frontmatter._claude_model).toBe("sonnet");
      expect(gemini.frontmatter._claude_context).toBe("fork");
      expect(gemini.frontmatter._claude_agent).toBe("task");
      expect(gemini.frontmatter._claude_hooks).toEqual({ "pre-tool-execution": "echo test" });
      expect(gemini.content).toBe("Test content");
    });
  });

  describe("Claude -> Gemini (removeUnsupported=true)", () => {
    it("should remove Claude-specific fields", () => {
      const claude: ClaudeSkill = {
        name: "test-skill",
        content: "Test content",
        dirPath: "/test",
        supportFiles: [],
        frontmatter: {
          name: "test-skill",
          description: "Test description",
          "disable-model-invocation": true,
          "user-invocable": false,
          "allowed-tools": "bash",
          model: "sonnet",
          context: "fork",
          agent: "task",
        },
      };

      const claudeConverter = new ClaudeSkillConverter();
      const geminiConverter = new GeminiSkillConverter();
      const ir = claudeConverter.toIR(claude);
      const gemini = geminiConverter.fromIR(ir, { removeUnsupported: true });

      expect(gemini.frontmatter.name).toBe("test-skill");
      expect(gemini.frontmatter.description).toBe("Test description");
      expect(gemini.frontmatter._claude_disable_model_invocation).toBeUndefined();
      expect(gemini.frontmatter._claude_user_invocable).toBeUndefined();
      expect(gemini.frontmatter._claude_allowed_tools).toBeUndefined();
      expect(gemini.frontmatter._claude_model).toBeUndefined();
      expect(gemini.frontmatter._claude_context).toBeUndefined();
      expect(gemini.frontmatter._claude_agent).toBeUndefined();
    });
  });

  describe("Claude -> Codex (removeUnsupported=false)", () => {
    it("should convert disable-model-invocation and preserve Claude fields with prefix", () => {
      const claude: ClaudeSkill = {
        name: "test-skill",
        content: "Test content",
        dirPath: "/test",
        supportFiles: [],
        frontmatter: {
          name: "test-skill",
          description: "Test description",
          "disable-model-invocation": true,
          "user-invocable": false,
          "allowed-tools": "bash",
          context: "fork",
        },
      };

      const claudeConverter = new ClaudeSkillConverter();
      const codexConverter = new CodexSkillConverter();
      const ir = claudeConverter.toIR(claude);
      const codex = codexConverter.fromIR(ir, { removeUnsupported: false });

      expect(codex.openaiConfig?.policy?.allow_implicit_invocation).toBe(false);
      expect(codex.frontmatter._claude_disable_model_invocation).toBe(true);
      expect(codex.frontmatter._claude_user_invocable).toBe(false);
      expect(codex.frontmatter._claude_allowed_tools).toBe("bash");
      expect(codex.frontmatter._claude_context).toBe("fork");
    });
  });

  describe("Claude -> Codex (removeUnsupported=true)", () => {
    it("should remove Claude-specific fields but keep model invocation conversion", () => {
      const claude: ClaudeSkill = {
        name: "test-skill",
        content: "Test content",
        dirPath: "/test",
        supportFiles: [],
        frontmatter: {
          name: "test-skill",
          description: "Test description",
          "disable-model-invocation": true,
          "user-invocable": false,
          "allowed-tools": "bash",
          context: "fork",
        },
      };

      const claudeConverter = new ClaudeSkillConverter();
      const codexConverter = new CodexSkillConverter();
      const ir = claudeConverter.toIR(claude);
      const codex = codexConverter.fromIR(ir, { removeUnsupported: true });

      // model invocation conversion should always work
      expect(codex.openaiConfig?.policy?.allow_implicit_invocation).toBe(false);
      // Claude-specific fields should be removed
      expect(codex.frontmatter._claude_disable_model_invocation).toBeUndefined();
      expect(codex.frontmatter._claude_user_invocable).toBeUndefined();
      expect(codex.frontmatter._claude_allowed_tools).toBeUndefined();
      expect(codex.frontmatter._claude_context).toBeUndefined();
    });
  });
});
