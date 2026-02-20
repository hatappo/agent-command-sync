import { describe, expect, it } from "vitest";
import { CodexSkillConverter } from "../../src/converters/codex-skill-converter.js";
import { ClaudeSkillConverter } from "../../src/converters/claude-skill-converter.js";
import type { CodexSkill, ClaudeSkill } from "../../src/types/index.js";

describe("Skill Conversion", () => {
  describe("allow_implicit_invocation ↔ disable-model-invocation conversion", () => {
    describe("Codex → Claude (via IR)", () => {
      const codexConverter = new CodexSkillConverter();
      const claudeConverter = new ClaudeSkillConverter();

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

        const ir = codexConverter.toIR(codexSkill);
        expect(ir.semantic.modelInvocationEnabled).toBe(false);

        const claudeSkill = claudeConverter.fromIR(ir);
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

        const ir = codexConverter.toIR(codexSkill);
        expect(ir.semantic.modelInvocationEnabled).toBe(true);

        const claudeSkill = claudeConverter.fromIR(ir);
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

        const ir = codexConverter.toIR(codexSkill);
        expect(ir.semantic.modelInvocationEnabled).toBeUndefined();
      });
    });

    describe("Claude → Codex (via IR)", () => {
      const claudeConverter = new ClaudeSkillConverter();
      const codexConverter = new CodexSkillConverter();

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

        const ir = claudeConverter.toIR(claudeSkill);
        const codexSkill = codexConverter.fromIR(ir);

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

        const ir = claudeConverter.toIR(claudeSkill);
        const codexSkill = codexConverter.fromIR(ir);

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

        const ir = claudeConverter.toIR(claudeSkill);
        const codexSkill = codexConverter.fromIR(ir);

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
        const ir = claudeConverter.toIR(claudeSkill);
        ir.extras.interface = {
          display_name: "Test Skill",
        };

        const codexSkill = codexConverter.fromIR(ir);

        expect(codexSkill.openaiConfig?.interface?.display_name).toBe("Test Skill");
        expect(codexSkill.openaiConfig?.policy?.allow_implicit_invocation).toBe(false);
      });
    });

    describe("Round-trip conversion", () => {
      const claudeConverter = new ClaudeSkillConverter();
      const codexConverter = new CodexSkillConverter();

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
        const ir1 = claudeConverter.toIR(originalClaude);
        const codexSkill = codexConverter.fromIR(ir1);

        // Codex → Claude
        const ir2 = codexConverter.toIR(codexSkill);
        const finalClaude = claudeConverter.fromIR(ir2);

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
        const ir1 = codexConverter.toIR(originalCodex);
        const claudeSkill = claudeConverter.fromIR(ir1);

        // Claude → Codex
        const ir2 = claudeConverter.toIR(claudeSkill);
        const finalCodex = codexConverter.fromIR(ir2);

        expect(finalCodex.openaiConfig?.policy?.allow_implicit_invocation).toBe(false);
      });
    });
  });
});
