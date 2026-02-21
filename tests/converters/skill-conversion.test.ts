import { describe, expect, it } from "vitest";
import { CodexAgent } from "../../src/agents/codex.js";
import { ClaudeAgent } from "../../src/agents/claude.js";
import { OpenCodeAgent } from "../../src/agents/opencode.js";
import type { CodexSkill, ClaudeSkill, OpenCodeSkill } from "../../src/types/index.js";

describe("Skill Conversion", () => {
  describe("allow_implicit_invocation ↔ disable-model-invocation conversion", () => {
    describe("Codex → Claude (via IR)", () => {
      const codexAgent = new CodexAgent();
      const claudeAgent = new ClaudeAgent();

      it("should convert allow_implicit_invocation: false to disable-model-invocation: true", () => {
        const codexSkill: CodexSkill = {
          name: "test-skill",
          content: "Test content",
          dirPath: "/test",
          supportFiles: [],
          frontmatter: { name: "test-skill" },
          openaiConfig: {
            policy: {
              allow_implicit_invocation: false,
            },
          },
        };

        const ir = codexAgent.skillToIR(codexSkill);
        expect(ir.semantic.modelInvocationEnabled).toBe(false);

        const claudeSkill = claudeAgent.skillFromIR(ir);
        expect(claudeSkill.frontmatter["disable-model-invocation"]).toBe(true);
      });

      it("should convert allow_implicit_invocation: true to disable-model-invocation: false", () => {
        const codexSkill: CodexSkill = {
          name: "test-skill",
          content: "Test content",
          dirPath: "/test",
          supportFiles: [],
          frontmatter: { name: "test-skill" },
          openaiConfig: {
            policy: {
              allow_implicit_invocation: true,
            },
          },
        };

        const ir = codexAgent.skillToIR(codexSkill);
        expect(ir.semantic.modelInvocationEnabled).toBe(true);

        const claudeSkill = claudeAgent.skillFromIR(ir);
        expect(claudeSkill.frontmatter["disable-model-invocation"]).toBe(false);
      });

      it("should not set disable-model-invocation when openaiConfig is absent", () => {
        const codexSkill: CodexSkill = {
          name: "test-skill",
          content: "Test content",
          dirPath: "/test",
          supportFiles: [],
          frontmatter: { name: "test-skill" },
        };

        const ir = codexAgent.skillToIR(codexSkill);
        expect(ir.semantic.modelInvocationEnabled).toBeUndefined();
      });
    });

    describe("Claude → Codex (via IR)", () => {
      const claudeAgent = new ClaudeAgent();
      const codexAgent = new CodexAgent();

      it("should convert disable-model-invocation: true to allow_implicit_invocation: false", () => {
        const claudeSkill: ClaudeSkill = {
          name: "test-skill",
          content: "Test content",
          dirPath: "/test",
          supportFiles: [],
          frontmatter: {
            name: "test-skill",
            "disable-model-invocation": true,
          },
        };

        const ir = claudeAgent.skillToIR(claudeSkill);
        const codexSkill = codexAgent.skillFromIR(ir);

        expect(codexSkill.openaiConfig).toBeDefined();
        expect(codexSkill.openaiConfig?.policy?.allow_implicit_invocation).toBe(false);
      });

      it("should convert disable-model-invocation: false to allow_implicit_invocation: true", () => {
        const claudeSkill: ClaudeSkill = {
          name: "test-skill",
          content: "Test content",
          dirPath: "/test",
          supportFiles: [],
          frontmatter: {
            name: "test-skill",
            "disable-model-invocation": false,
          },
        };

        const ir = claudeAgent.skillToIR(claudeSkill);
        const codexSkill = codexAgent.skillFromIR(ir);

        expect(codexSkill.openaiConfig).toBeDefined();
        expect(codexSkill.openaiConfig?.policy?.allow_implicit_invocation).toBe(true);
      });

      it("should not create openaiConfig when disable-model-invocation is absent", () => {
        const claudeSkill: ClaudeSkill = {
          name: "test-skill",
          content: "Test content",
          dirPath: "/test",
          supportFiles: [],
          frontmatter: {
            name: "test-skill",
          },
        };

        const ir = claudeAgent.skillToIR(claudeSkill);
        const codexSkill = codexAgent.skillFromIR(ir);

        expect(codexSkill.openaiConfig).toBeUndefined();
      });

      it("should merge with existing openaiConfig", () => {
        const claudeSkill: ClaudeSkill = {
          name: "test-skill",
          content: "Test content",
          dirPath: "/test",
          supportFiles: [],
          frontmatter: {
            name: "test-skill",
            "disable-model-invocation": true,
          },
        };

        // Simulate IR with existing openaiConfig fields in extras
        const ir = claudeAgent.skillToIR(claudeSkill);
        ir.extras.interface = {
          display_name: "Test Skill",
        };

        const codexSkill = codexAgent.skillFromIR(ir);

        expect(codexSkill.openaiConfig?.interface?.display_name).toBe("Test Skill");
        expect(codexSkill.openaiConfig?.policy?.allow_implicit_invocation).toBe(false);
      });
    });

    describe("Round-trip conversion", () => {
      const claudeAgent = new ClaudeAgent();
      const codexAgent = new CodexAgent();

      it("should preserve disable-model-invocation: true through Claude → Codex → Claude", () => {
        const originalClaude: ClaudeSkill = {
          name: "test-skill",
          content: "Test content",
          dirPath: "/test",
          supportFiles: [],
          frontmatter: {
            name: "test-skill",
            "disable-model-invocation": true,
          },
        };

        // Claude → Codex
        const ir1 = claudeAgent.skillToIR(originalClaude);
        const codexSkill = codexAgent.skillFromIR(ir1);

        // Codex → Claude
        const ir2 = codexAgent.skillToIR(codexSkill);
        const finalClaude = claudeAgent.skillFromIR(ir2);

        expect(finalClaude.frontmatter["disable-model-invocation"]).toBe(true);
      });

      it("should preserve allow_implicit_invocation: false through Codex → Claude → Codex", () => {
        const originalCodex: CodexSkill = {
          name: "test-skill",
          content: "Test content",
          dirPath: "/test",
          supportFiles: [],
          frontmatter: { name: "test-skill" },
          openaiConfig: {
            policy: {
              allow_implicit_invocation: false,
            },
          },
        };

        // Codex → Claude
        const ir1 = codexAgent.skillToIR(originalCodex);
        const claudeSkill = claudeAgent.skillFromIR(ir1);

        // Claude → Codex
        const ir2 = claudeAgent.skillToIR(claudeSkill);
        const finalCodex = codexAgent.skillFromIR(ir2);

        expect(finalCodex.openaiConfig?.policy?.allow_implicit_invocation).toBe(false);
      });
    });
  });

  describe("OpenCode Skill Conversion", () => {
    describe("Claude → OpenCode (via IR)", () => {
      const claudeAgent = new ClaudeAgent();
      const opencodeAgent = new OpenCodeAgent();

      it("should convert Claude skill to OpenCode preserving model and agent", () => {
        const claudeSkill: ClaudeSkill = {
          name: "test-skill",
          content: "Test content with $ARGUMENTS",
          dirPath: "/test",
          supportFiles: [],
          frontmatter: {
            name: "test-skill",
            description: "Test",
            model: "sonnet",
            agent: "task",
            "allowed-tools": "bash",
          },
        };

        const ir = claudeAgent.skillToIR(claudeSkill);
        const opencodeSkill = opencodeAgent.skillFromIR(ir);

        expect(opencodeSkill.frontmatter.name).toBe("test-skill");
        expect(opencodeSkill.frontmatter.description).toBe("Test");
        expect(opencodeSkill.frontmatter.model).toBe("sonnet");
        expect(opencodeSkill.frontmatter.agent).toBe("task");
        // allowed-tools is Claude-specific, should be prefixed
        expect(opencodeSkill.frontmatter._claude_allowed_tools).toBe("bash");
      });

      it("should remove Claude-specific fields with removeUnsupported", () => {
        const claudeSkill: ClaudeSkill = {
          name: "test-skill",
          content: "Test",
          dirPath: "/test",
          supportFiles: [],
          frontmatter: {
            name: "test-skill",
            "user-invocable": true,
            "allowed-tools": "bash",
            context: "fork",
          },
        };

        const ir = claudeAgent.skillToIR(claudeSkill);
        const opencodeSkill = opencodeAgent.skillFromIR(ir, { removeUnsupported: true });

        expect(opencodeSkill.frontmatter._claude_user_invocable).toBeUndefined();
        expect(opencodeSkill.frontmatter._claude_allowed_tools).toBeUndefined();
        expect(opencodeSkill.frontmatter._claude_context).toBeUndefined();
      });
    });

    describe("OpenCode → Claude (via IR)", () => {
      const opencodeAgent = new OpenCodeAgent();
      const claudeAgent = new ClaudeAgent();

      it("should convert OpenCode skill to Claude preserving all fields", () => {
        const opencodeSkill: OpenCodeSkill = {
          name: "test-skill",
          content: "Test content",
          dirPath: "/test",
          supportFiles: [],
          frontmatter: {
            name: "test-skill",
            description: "Test",
            model: "sonnet",
            subtask: true,
          },
        };

        const ir = opencodeAgent.skillToIR(opencodeSkill);
        const claudeSkill = claudeAgent.skillFromIR(ir);

        expect(claudeSkill.frontmatter.name).toBe("test-skill");
        expect(claudeSkill.frontmatter.description).toBe("Test");
        expect(claudeSkill.frontmatter.model).toBe("sonnet");
        expect(claudeSkill.frontmatter.subtask).toBe(true);
      });
    });

    describe("Round-trip: Claude → OpenCode → Claude", () => {
      const claudeAgent = new ClaudeAgent();
      const opencodeAgent = new OpenCodeAgent();

      it("should preserve disable-model-invocation through round-trip", () => {
        const original: ClaudeSkill = {
          name: "test-skill",
          content: "Test content with !`git status` and @config.json",
          dirPath: "/test",
          supportFiles: [],
          frontmatter: {
            name: "test-skill",
            description: "Test",
            "disable-model-invocation": true,
          },
        };

        const ir1 = claudeAgent.skillToIR(original);
        const opencode = opencodeAgent.skillFromIR(ir1);
        const ir2 = opencodeAgent.skillToIR(opencode);
        const result = claudeAgent.skillFromIR(ir2);

        expect(result.frontmatter["disable-model-invocation"]).toBe(true);
        expect(result.content).toBe("Test content with !`git status` and @config.json");
      });
    });
  });
});
