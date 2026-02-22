import { describe, expect, it } from "vitest";
import { CodexAgent } from "../../src/agents/codex.js";
import { ClaudeAgent } from "../../src/agents/claude.js";
import { CopilotAgent } from "../../src/agents/copilot.js";
import { CursorAgent } from "../../src/agents/cursor.js";
import { OpenCodeAgent } from "../../src/agents/opencode.js";
import type { CodexSkill, ClaudeSkill, CopilotSkill, CursorSkill, OpenCodeSkill } from "../../src/types/index.js";

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

  describe("Copilot Skill Conversion", () => {
    describe("Claude → Copilot (via IR)", () => {
      const claudeAgent = new ClaudeAgent();
      const copilotAgent = new CopilotAgent();

      it("should convert Claude skill to Copilot with user-invokable spelling", () => {
        const claudeSkill: ClaudeSkill = {
          name: "test-skill",
          content: "Test content",
          dirPath: "/test",
          supportFiles: [],
          frontmatter: {
            name: "test-skill",
            description: "Test",
            "user-invocable": true,
            "disable-model-invocation": true,
          },
        };

        const ir = claudeAgent.skillToIR(claudeSkill);
        const copilotSkill = copilotAgent.skillFromIR(ir);

        expect(copilotSkill.frontmatter.name).toBe("test-skill");
        expect(copilotSkill.frontmatter.description).toBe("Test");
        expect(copilotSkill.frontmatter["user-invokable"]).toBe(true);
        expect(copilotSkill.frontmatter["disable-model-invocation"]).toBe(true);
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
            hooks: { "pre-tool-execution": "echo test" },
          },
        };

        const ir = claudeAgent.skillToIR(claudeSkill);
        const copilotSkill = copilotAgent.skillFromIR(ir, { removeUnsupported: true });

        expect(copilotSkill.frontmatter["user-invokable"]).toBeUndefined();
        expect(copilotSkill.frontmatter["allowed-tools"]).toBeUndefined();
        expect(copilotSkill.frontmatter.context).toBeUndefined();
        expect(copilotSkill.frontmatter.hooks).toBeUndefined();
      });
    });

    describe("Copilot → Claude (via IR)", () => {
      const copilotAgent = new CopilotAgent();
      const claudeAgent = new ClaudeAgent();

      it("should convert Copilot skill to Claude with user-invocable spelling", () => {
        const copilotSkill: CopilotSkill = {
          name: "test-skill",
          content: "Test content",
          dirPath: "/test",
          supportFiles: [],
          frontmatter: {
            name: "test-skill",
            description: "Test",
            "user-invokable": true,
            "disable-model-invocation": false,
          },
        };

        const ir = copilotAgent.skillToIR(copilotSkill);
        const claudeSkill = claudeAgent.skillFromIR(ir);

        expect(claudeSkill.frontmatter.name).toBe("test-skill");
        expect(claudeSkill.frontmatter.description).toBe("Test");
        expect(claudeSkill.frontmatter["user-invocable"]).toBe(true);
        expect(claudeSkill.frontmatter["disable-model-invocation"]).toBe(false);
      });
    });

    describe("Round-trip: Claude → Copilot → Claude", () => {
      const claudeAgent = new ClaudeAgent();
      const copilotAgent = new CopilotAgent();

      it("should preserve disable-model-invocation through round-trip", () => {
        const original: ClaudeSkill = {
          name: "test-skill",
          content: "Test content",
          dirPath: "/test",
          supportFiles: [],
          frontmatter: {
            name: "test-skill",
            description: "Test",
            "disable-model-invocation": true,
          },
        };

        const ir1 = claudeAgent.skillToIR(original);
        const copilot = copilotAgent.skillFromIR(ir1);
        const ir2 = copilotAgent.skillToIR(copilot);
        const result = claudeAgent.skillFromIR(ir2);

        expect(result.frontmatter["disable-model-invocation"]).toBe(true);
      });

      it("should preserve user-invocable through round-trip", () => {
        const original: ClaudeSkill = {
          name: "test-skill",
          content: "Test content",
          dirPath: "/test",
          supportFiles: [],
          frontmatter: {
            name: "test-skill",
            "user-invocable": true,
          },
        };

        const ir1 = claudeAgent.skillToIR(original);
        const copilot = copilotAgent.skillFromIR(ir1);

        // Copilot uses "user-invokable" (k)
        expect(copilot.frontmatter["user-invokable"]).toBe(true);

        const ir2 = copilotAgent.skillToIR(copilot);
        const result = claudeAgent.skillFromIR(ir2);

        // Back to Claude "user-invocable" (c)
        expect(result.frontmatter["user-invocable"]).toBe(true);
      });
    });
  });

  describe("Cursor Skill Conversion", () => {
    describe("Claude → Cursor (via IR)", () => {
      const claudeAgent = new ClaudeAgent();
      const cursorAgent = new CursorAgent();

      it("should convert Claude skill to Cursor preserving agentskills.io fields", () => {
        const claudeSkill: ClaudeSkill = {
          name: "test-skill",
          content: "Test content",
          dirPath: "/test",
          supportFiles: [],
          frontmatter: {
            name: "test-skill",
            description: "Test",
            "disable-model-invocation": true,
            "user-invocable": true,
            "allowed-tools": "bash",
          },
        };

        const ir = claudeAgent.skillToIR(claudeSkill);
        const cursorSkill = cursorAgent.skillFromIR(ir);

        expect(cursorSkill.frontmatter.name).toBe("test-skill");
        expect(cursorSkill.frontmatter.description).toBe("Test");
        expect(cursorSkill.frontmatter["disable-model-invocation"]).toBe(true);
        // user-invocable uses same spelling as Claude (no normalization needed)
        expect(cursorSkill.frontmatter["user-invocable"]).toBe(true);
        // allowed-tools is supported by Cursor (agentskills.io standard)
        expect(cursorSkill.frontmatter["allowed-tools"]).toBe("bash");
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
            hooks: { "pre-tool-execution": "echo test" },
            model: "sonnet",
            agent: "task",
            "argument-hint": "Enter path",
          },
        };

        const ir = claudeAgent.skillToIR(claudeSkill);
        const cursorSkill = cursorAgent.skillFromIR(ir, { removeUnsupported: true });

        // These should be removed (CLAUDE_SKILL_FIELDS)
        expect(cursorSkill.frontmatter.context).toBeUndefined();
        expect(cursorSkill.frontmatter.hooks).toBeUndefined();
        expect(cursorSkill.frontmatter.model).toBeUndefined();
        expect(cursorSkill.frontmatter.agent).toBeUndefined();
        expect(cursorSkill.frontmatter["argument-hint"]).toBeUndefined();
        // These should be preserved (supported by Cursor)
        expect(cursorSkill.frontmatter["user-invocable"]).toBe(true);
        expect(cursorSkill.frontmatter["allowed-tools"]).toBe("bash");
      });
    });

    describe("Cursor → Claude (via IR)", () => {
      const cursorAgent = new CursorAgent();
      const claudeAgent = new ClaudeAgent();

      it("should convert Cursor skill to Claude with user-invocable same spelling", () => {
        const cursorSkill: CursorSkill = {
          name: "test-skill",
          content: "Test content",
          dirPath: "/test",
          supportFiles: [],
          frontmatter: {
            name: "test-skill",
            description: "Test",
            "user-invocable": true,
            "disable-model-invocation": false,
            "allowed-tools": "bash",
          },
        };

        const ir = cursorAgent.skillToIR(cursorSkill);
        const claudeSkill = claudeAgent.skillFromIR(ir);

        expect(claudeSkill.frontmatter.name).toBe("test-skill");
        expect(claudeSkill.frontmatter.description).toBe("Test");
        expect(claudeSkill.frontmatter["user-invocable"]).toBe(true);
        expect(claudeSkill.frontmatter["disable-model-invocation"]).toBe(false);
        expect(claudeSkill.frontmatter["allowed-tools"]).toBe("bash");
      });
    });

    describe("Round-trip: Claude → Cursor → Claude", () => {
      const claudeAgent = new ClaudeAgent();
      const cursorAgent = new CursorAgent();

      it("should preserve disable-model-invocation through round-trip", () => {
        const original: ClaudeSkill = {
          name: "test-skill",
          content: "Test content",
          dirPath: "/test",
          supportFiles: [],
          frontmatter: {
            name: "test-skill",
            description: "Test",
            "disable-model-invocation": true,
          },
        };

        const ir1 = claudeAgent.skillToIR(original);
        const cursor = cursorAgent.skillFromIR(ir1);
        const ir2 = cursorAgent.skillToIR(cursor);
        const result = claudeAgent.skillFromIR(ir2);

        expect(result.frontmatter["disable-model-invocation"]).toBe(true);
      });

      it("should preserve user-invocable through round-trip (same spelling)", () => {
        const original: ClaudeSkill = {
          name: "test-skill",
          content: "Test content",
          dirPath: "/test",
          supportFiles: [],
          frontmatter: {
            name: "test-skill",
            "user-invocable": true,
          },
        };

        const ir1 = claudeAgent.skillToIR(original);
        const cursor = cursorAgent.skillFromIR(ir1);

        // Cursor uses same "user-invocable" spelling as Claude
        expect(cursor.frontmatter["user-invocable"]).toBe(true);

        const ir2 = cursorAgent.skillToIR(cursor);
        const result = claudeAgent.skillFromIR(ir2);

        expect(result.frontmatter["user-invocable"]).toBe(true);
      });
    });
  });
});
