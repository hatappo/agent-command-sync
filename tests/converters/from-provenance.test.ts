import { describe, expect, it } from "vitest";
import { ChimeraAgent } from "../../src/agents/chimera.js";
import { ClaudeAgent } from "../../src/agents/claude.js";
import { CodexAgent } from "../../src/agents/codex.js";
import { CopilotAgent } from "../../src/agents/copilot.js";
import { CursorAgent } from "../../src/agents/cursor.js";
import { GeminiAgent } from "../../src/agents/gemini.js";
import { OpenCodeAgent } from "../../src/agents/opencode.js";
import type {
  ChimeraCommand,
  ClaudeCommand,
  CodexCommand,
  CopilotCommand,
  CursorCommand,
  GeminiCommand,
  OpenCodeCommand,
} from "../../src/types/index.js";

describe("_from provenance tracking", () => {
  const fromUrls = ["https://github.com/owner/repo", "https://github.com/other/repo"];

  describe("Command round-trip", () => {
    it("Claude: _from round-trips through IR", () => {
      const claude: ClaudeCommand = {
        frontmatter: { description: "Test", _from: fromUrls },
        content: "body",
        filePath: "/test.md",
      };
      const agent = new ClaudeAgent();
      const ir = agent.commandToIR(claude);
      expect(ir.semantic.from).toEqual(fromUrls);
      expect(ir.extras._from).toBeUndefined();

      const result = agent.commandFromIR(ir);
      expect(result.frontmatter._from).toEqual(fromUrls);
    });

    it("Gemini: _from round-trips through IR (TOML)", () => {
      const gemini: GeminiCommand = {
        description: "Test",
        prompt: "body",
        filePath: "/test.toml",
        _from: fromUrls,
      };
      const agent = new GeminiAgent();
      const ir = agent.commandToIR(gemini);
      expect(ir.semantic.from).toEqual(fromUrls);
      expect(ir.extras._from).toBeUndefined();

      const result = agent.commandFromIR(ir);
      expect(result._from).toEqual(fromUrls);
    });

    it("Codex: _from round-trips through IR", () => {
      const codex: CodexCommand = {
        frontmatter: { description: "Test", _from: fromUrls },
        content: "body",
        filePath: "/test.md",
      };
      const agent = new CodexAgent();
      const ir = agent.commandToIR(codex);
      expect(ir.semantic.from).toEqual(fromUrls);

      const result = agent.commandFromIR(ir);
      expect(result.frontmatter?._from).toEqual(fromUrls);
    });

    it("OpenCode: _from round-trips through IR", () => {
      const opencode: OpenCodeCommand = {
        frontmatter: { description: "Test", _from: fromUrls },
        content: "body",
        filePath: "/test.md",
      };
      const agent = new OpenCodeAgent();
      const ir = agent.commandToIR(opencode);
      expect(ir.semantic.from).toEqual(fromUrls);

      const result = agent.commandFromIR(ir);
      expect(result.frontmatter?._from).toEqual(fromUrls);
    });

    it("Copilot: _from round-trips through IR", () => {
      const copilot: CopilotCommand = {
        frontmatter: { description: "Test", _from: fromUrls },
        content: "body",
        filePath: "/test.prompt.md",
      };
      const agent = new CopilotAgent();
      const ir = agent.commandToIR(copilot);
      expect(ir.semantic.from).toEqual(fromUrls);

      const result = agent.commandFromIR(ir);
      expect(result.frontmatter._from).toEqual(fromUrls);
    });

    it("Cursor: _from is lost for commands (no frontmatter)", () => {
      const agent = new CursorAgent();
      // Cursor commands have no frontmatter, so _from cannot be stored
      const ir = agent.commandToIR({ content: "body", filePath: "/test.md" });
      expect(ir.semantic.from).toBeUndefined();
    });

    it("Chimera: _from round-trips through IR", () => {
      const chimera: ChimeraCommand = {
        frontmatter: { description: "Test", _from: fromUrls },
        content: "body",
        filePath: "/test.md",
      };
      const agent = new ChimeraAgent();
      const ir = agent.commandToIR(chimera);
      expect(ir.semantic.from).toEqual(fromUrls);

      const result = agent.commandFromIR(ir);
      expect(result.frontmatter._from).toEqual(fromUrls);
    });
  });

  describe("Skill round-trip", () => {
    function makeSkill() {
      return {
        name: "test-skill",
        description: "Test",
        content: "body",
        dirPath: "/test/skill",
        supportFiles: [],
        frontmatter: { name: "test-skill", description: "Test", _from: fromUrls } as Record<string, unknown>,
      };
    }

    it("Claude: _from round-trips through skill IR", () => {
      const agent = new ClaudeAgent();
      const ir = agent.skillToIR(makeSkill());
      expect(ir.semantic.from).toEqual(fromUrls);
      expect(ir.extras._from).toBeUndefined();

      const result = agent.skillFromIR(ir);
      expect(result.frontmatter._from).toEqual(fromUrls);
    });

    it("Gemini: _from round-trips through skill IR", () => {
      const agent = new GeminiAgent();
      const ir = agent.skillToIR(makeSkill());
      expect(ir.semantic.from).toEqual(fromUrls);

      const result = agent.skillFromIR(ir);
      expect(result.frontmatter._from).toEqual(fromUrls);
    });

    it("Codex: _from round-trips through skill IR", () => {
      const agent = new CodexAgent();
      const ir = agent.skillToIR(makeSkill());
      expect(ir.semantic.from).toEqual(fromUrls);

      const result = agent.skillFromIR(ir);
      expect(result.frontmatter._from).toEqual(fromUrls);
    });

    it("OpenCode: _from round-trips through skill IR", () => {
      const agent = new OpenCodeAgent();
      const ir = agent.skillToIR(makeSkill());
      expect(ir.semantic.from).toEqual(fromUrls);

      const result = agent.skillFromIR(ir);
      expect(result.frontmatter._from).toEqual(fromUrls);
    });

    it("Copilot: _from round-trips through skill IR", () => {
      const agent = new CopilotAgent();
      const ir = agent.skillToIR(makeSkill());
      expect(ir.semantic.from).toEqual(fromUrls);

      const result = agent.skillFromIR(ir);
      expect(result.frontmatter._from).toEqual(fromUrls);
    });

    it("Cursor: _from round-trips through skill IR", () => {
      const agent = new CursorAgent();
      const ir = agent.skillToIR(makeSkill());
      expect(ir.semantic.from).toEqual(fromUrls);

      const result = agent.skillFromIR(ir);
      expect(result.frontmatter._from).toEqual(fromUrls);
    });

    it("Chimera: _from round-trips through skill IR", () => {
      const agent = new ChimeraAgent();
      const ir = agent.skillToIR(makeSkill());
      expect(ir.semantic.from).toEqual(fromUrls);

      const result = agent.skillFromIR(ir);
      expect(result.frontmatter._from).toEqual(fromUrls);
    });
  });

  describe("Cross-agent conversion preserves _from", () => {
    it("Claude -> Gemini: _from is preserved", () => {
      const claude: ClaudeCommand = {
        frontmatter: { description: "Test", _from: fromUrls },
        content: "body",
        filePath: "/test.md",
      };
      const claudeAgent = new ClaudeAgent();
      const geminiAgent = new GeminiAgent();
      const ir = claudeAgent.commandToIR(claude);
      const gemini = geminiAgent.commandFromIR(ir);
      expect(gemini._from).toEqual(fromUrls);
    });

    it("Gemini -> Claude: _from is preserved", () => {
      const gemini: GeminiCommand = {
        description: "Test",
        prompt: "body",
        filePath: "/test.toml",
        _from: fromUrls,
      };
      const geminiAgent = new GeminiAgent();
      const claudeAgent = new ClaudeAgent();
      const ir = geminiAgent.commandToIR(gemini);
      const claude = claudeAgent.commandFromIR(ir);
      expect(claude.frontmatter._from).toEqual(fromUrls);
    });

    it("Claude -> Cursor: _from is lost for commands (no frontmatter)", () => {
      const claude: ClaudeCommand = {
        frontmatter: { description: "Test", _from: fromUrls },
        content: "body",
        filePath: "/test.md",
      };
      const claudeAgent = new ClaudeAgent();
      const cursorAgent = new CursorAgent();
      const ir = claudeAgent.commandToIR(claude);
      const cursor: CursorCommand = cursorAgent.commandFromIR(ir);
      // Cursor commands have no frontmatter — _from is lost
      // CursorCommand only has { content, filePath }
      expect(Object.keys(cursor)).not.toContain("_from");
      expect(Object.keys(cursor)).not.toContain("frontmatter");
    });
  });

  describe("Empty _from handling", () => {
    it("should not write _from when semantic.from is empty", () => {
      const agent = new ClaudeAgent();
      const ir = agent.commandToIR({
        frontmatter: { description: "Test" },
        content: "body",
        filePath: "/test.md",
      });
      expect(ir.semantic.from).toBeUndefined();

      const result = agent.commandFromIR(ir);
      expect(result.frontmatter._from).toBeUndefined();
    });

    it("should not write _from when semantic.from is empty array", () => {
      const agent = new ClaudeAgent();
      const ir = agent.commandToIR({
        frontmatter: { description: "Test", _from: [] },
        content: "body",
        filePath: "/test.md",
      });
      // Empty array is preserved (Array.isArray([]) === true)
      expect(ir.semantic.from).toEqual([]);

      // But fromIR should not write empty _from to frontmatter
      const result = agent.commandFromIR(ir);
      expect(result.frontmatter._from).toBeUndefined();
    });
  });
});
