import { describe, expect, it } from "vitest";
import { CodexAgent } from "../../src/agents/codex.js";
import { ClaudeAgent } from "../../src/agents/claude.js";
import { CopilotAgent } from "../../src/agents/copilot.js";
import { GeminiAgent } from "../../src/agents/gemini.js";
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

      const claudeAgent = new ClaudeAgent();
      const geminiAgent = new GeminiAgent();
      const ir = claudeAgent.skillToIR(claude);
      const gemini = geminiAgent.skillFromIR(ir, { removeUnsupported: false });

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

      const claudeAgent = new ClaudeAgent();
      const geminiAgent = new GeminiAgent();
      const ir = claudeAgent.skillToIR(claude);
      const gemini = geminiAgent.skillFromIR(ir, { removeUnsupported: true });

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

      const claudeAgent = new ClaudeAgent();
      const codexAgent = new CodexAgent();
      const ir = claudeAgent.skillToIR(claude);
      const codex = codexAgent.skillFromIR(ir, { removeUnsupported: false });

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

      const claudeAgent = new ClaudeAgent();
      const codexAgent = new CodexAgent();
      const ir = claudeAgent.skillToIR(claude);
      const codex = codexAgent.skillFromIR(ir, { removeUnsupported: true });

      // model invocation conversion should always work
      expect(codex.openaiConfig?.policy?.allow_implicit_invocation).toBe(false);
      // Claude-specific fields should be removed
      expect(codex.frontmatter._claude_disable_model_invocation).toBeUndefined();
      expect(codex.frontmatter._claude_user_invocable).toBeUndefined();
      expect(codex.frontmatter._claude_allowed_tools).toBeUndefined();
      expect(codex.frontmatter._claude_context).toBeUndefined();
    });
  });

  describe("Claude -> Copilot (removeUnsupported=false)", () => {
    it("should preserve Claude-specific fields directly", () => {
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
          hooks: { "pre-tool-execution": "echo test" },
        },
      };

      const claudeAgent = new ClaudeAgent();
      const copilotAgent = new CopilotAgent();
      const ir = claudeAgent.skillToIR(claude);
      const copilot = copilotAgent.skillFromIR(ir, { removeUnsupported: false });

      expect(copilot.frontmatter.name).toBe("test-skill");
      expect(copilot.frontmatter.description).toBe("Test description");
      expect(copilot.frontmatter["disable-model-invocation"]).toBe(true);
      expect(copilot.frontmatter["user-invokable"]).toBe(false);
      expect(copilot.frontmatter["allowed-tools"]).toBe("bash");
      expect(copilot.frontmatter.model).toBe("sonnet");
      expect(copilot.frontmatter.context).toBe("fork");
      expect(copilot.frontmatter.hooks).toEqual({ "pre-tool-execution": "echo test" });
    });
  });

  describe("Claude -> Copilot (removeUnsupported=true)", () => {
    it("should remove Claude-specific fields but keep semantic ones", () => {
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
          hooks: { "pre-tool-execution": "echo test" },
        },
      };

      const claudeAgent = new ClaudeAgent();
      const copilotAgent = new CopilotAgent();
      const ir = claudeAgent.skillToIR(claude);
      const copilot = copilotAgent.skillFromIR(ir, { removeUnsupported: true });

      expect(copilot.frontmatter.name).toBe("test-skill");
      expect(copilot.frontmatter.description).toBe("Test description");
      // disable-model-invocation is semantic, should be preserved
      expect(copilot.frontmatter["disable-model-invocation"]).toBe(true);
      // model is not in CLAUDE_SKILL_FIELDS, so it's preserved
      expect(copilot.frontmatter.model).toBe("sonnet");
      // These Claude-specific fields should be removed
      expect(copilot.frontmatter["user-invokable"]).toBeUndefined();
      expect(copilot.frontmatter["allowed-tools"]).toBeUndefined();
      expect(copilot.frontmatter.context).toBeUndefined();
      expect(copilot.frontmatter.hooks).toBeUndefined();
    });
  });
});
