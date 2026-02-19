import { describe, expect, it } from "vitest";
import { CodexSkillToIRConverter } from "../../src/converters/codex-skill-to-ir.js";
import { ClaudeSkillToIRConverter } from "../../src/converters/claude-skill-to-ir.js";
import { IRToCodexSkillConverter } from "../../src/converters/ir-to-codex-skill.js";
import { IRToClaudeSkillConverter } from "../../src/converters/ir-to-claude-skill.js";
import type { CodexSkill, ClaudeSkill } from "../../src/types/index.js";

describe("Skill Conversion", () => {
  describe("allow_implicit_invocation ↔ disable-model-invocation conversion", () => {
    describe("Codex → Claude (via IR)", () => {
      const codexToIR = new CodexSkillToIRConverter();
      const irToClaude = new IRToClaudeSkillConverter();

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

        const ir = codexToIR.toIntermediate(codexSkill);
        expect(ir.header["disable-model-invocation"]).toBe(true);

        const claudeSkill = irToClaude.fromIntermediate(ir);
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

        const ir = codexToIR.toIntermediate(codexSkill);
        expect(ir.header["disable-model-invocation"]).toBe(false);

        const claudeSkill = irToClaude.fromIntermediate(ir);
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

        const ir = codexToIR.toIntermediate(codexSkill);
        expect(ir.header["disable-model-invocation"]).toBeUndefined();
      });
    });

    describe("Claude → Codex (via IR)", () => {
      const claudeToIR = new ClaudeSkillToIRConverter();
      const irToCodex = new IRToCodexSkillConverter();

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

        const ir = claudeToIR.toIntermediate(claudeSkill);
        const codexSkill = irToCodex.fromIntermediate(ir);

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

        const ir = claudeToIR.toIntermediate(claudeSkill);
        const codexSkill = irToCodex.fromIntermediate(ir);

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

        const ir = claudeToIR.toIntermediate(claudeSkill);
        const codexSkill = irToCodex.fromIntermediate(ir);

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

        // Simulate IR with existing codexOpenAIConfig in meta
        const ir = claudeToIR.toIntermediate(claudeSkill);
        ir.meta.codexOpenAIConfig = {
          interface: {
            display_name: "Test Skill",
          },
        };

        const codexSkill = irToCodex.fromIntermediate(ir);

        expect(codexSkill.openaiConfig?.interface?.display_name).toBe("Test Skill");
        expect(codexSkill.openaiConfig?.policy?.allow_implicit_invocation).toBe(false);
      });
    });

    describe("Round-trip conversion", () => {
      const claudeToIR = new ClaudeSkillToIRConverter();
      const irToCodex = new IRToCodexSkillConverter();
      const codexToIR = new CodexSkillToIRConverter();
      const irToClaude = new IRToClaudeSkillConverter();

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
        const ir1 = claudeToIR.toIntermediate(originalClaude);
        const codexSkill = irToCodex.fromIntermediate(ir1);

        // Codex → Claude
        const ir2 = codexToIR.toIntermediate(codexSkill);
        const finalClaude = irToClaude.fromIntermediate(ir2);

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
        const ir1 = codexToIR.toIntermediate(originalCodex);
        const claudeSkill = irToClaude.fromIntermediate(ir1);

        // Claude → Codex
        const ir2 = claudeToIR.toIntermediate(claudeSkill);
        const finalCodex = irToCodex.fromIntermediate(ir2);

        expect(finalCodex.openaiConfig?.policy?.allow_implicit_invocation).toBe(false);
      });
    });
  });
});
