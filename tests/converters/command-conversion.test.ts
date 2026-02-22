import { describe, expect, it } from "vitest";
import { ClaudeAgent } from "../../src/agents/claude.js";
import { CopilotAgent } from "../../src/agents/copilot.js";
import { CursorAgent } from "../../src/agents/cursor.js";
import { GeminiAgent } from "../../src/agents/gemini.js";
import { CodexAgent } from "../../src/agents/codex.js";
import { OpenCodeAgent } from "../../src/agents/opencode.js";
import type {
  ClaudeCommand,
  CopilotCommand,
  CursorCommand,
  GeminiCommand,
  CodexCommand,
  OpenCodeCommand,
} from "../../src/types/index.js";

describe("Command Conversion (Safety Net)", () => {
  describe("Claude -> Gemini", () => {
    it("should convert description and body", () => {
      const claude: ClaudeCommand = {
        frontmatter: { description: "Test description" },
        content: "Test body content",
        filePath: "/test/command.md",
      };

      const claudeAgent = new ClaudeAgent();
      const geminiAgent = new GeminiAgent();
      const ir = claudeAgent.commandToIR(claude);
      const gemini = geminiAgent.commandFromIR(ir);

      expect(gemini.description).toBe("Test description");
      expect(gemini.prompt).toBe("Test body content");
    });

    it("should pass through Claude-specific fields", () => {
      const claude: ClaudeCommand = {
        frontmatter: {
          description: "Test",
          "allowed-tools": "bash,read",
          "argument-hint": "Enter filename",
          model: "sonnet",
        },
        content: "Body",
        filePath: "/test/command.md",
      };

      const claudeAgent = new ClaudeAgent();
      const geminiAgent = new GeminiAgent();
      const ir = claudeAgent.commandToIR(claude);
      const gemini = geminiAgent.commandFromIR(ir);

      expect(gemini["allowed-tools"]).toBe("bash,read");
      expect(gemini["argument-hint"]).toBe("Enter filename");
      expect(gemini.model).toBe("sonnet");
    });
  });

  describe("Gemini -> Claude", () => {
    it("should convert description and prompt to content", () => {
      const gemini: GeminiCommand = {
        description: "Gemini description",
        prompt: "Gemini prompt content",
        filePath: "/test/command.toml",
      };

      const geminiAgent = new GeminiAgent();
      const claudeAgent = new ClaudeAgent();
      const ir = geminiAgent.commandToIR(gemini);
      const claude = claudeAgent.commandFromIR(ir);

      expect(claude.frontmatter.description).toBe("Gemini description");
      expect(claude.content).toBe("Gemini prompt content");
    });

    it("should put extra fields into frontmatter", () => {
      const gemini: GeminiCommand = {
        description: "Test",
        prompt: "Body",
        filePath: "/test/command.toml",
        "custom-field": "custom-value",
      };

      const geminiAgent = new GeminiAgent();
      const claudeAgent = new ClaudeAgent();
      const ir = geminiAgent.commandToIR(gemini);
      const claude = claudeAgent.commandFromIR(ir);

      expect(claude.frontmatter["custom-field"]).toBe("custom-value");
    });
  });

  describe("Claude -> Codex", () => {
    it("should preserve frontmatter", () => {
      const claude: ClaudeCommand = {
        frontmatter: {
          description: "Test description",
          "allowed-tools": "bash",
          model: "opus",
        },
        content: "Test content",
        filePath: "/test/command.md",
      };

      const claudeAgent = new ClaudeAgent();
      const codexAgent = new CodexAgent();
      const ir = claudeAgent.commandToIR(claude);
      const codex = codexAgent.commandFromIR(ir);

      expect(codex.content).toBe("Test content");
      expect(codex.frontmatter?.description).toBe("Test description");
      expect(codex.frontmatter?.["allowed-tools"]).toBe("bash");
      expect(codex.frontmatter?.model).toBe("opus");
    });
  });

  describe("Codex -> Claude", () => {
    it("should restore frontmatter", () => {
      const codex: CodexCommand = {
        frontmatter: {
          description: "Codex desc",
          "allowed-tools": "bash",
        },
        content: "Codex content",
        filePath: "/test/command.md",
      };

      const codexAgent = new CodexAgent();
      const claudeAgent = new ClaudeAgent();
      const ir = codexAgent.commandToIR(codex);
      const claude = claudeAgent.commandFromIR(ir);

      expect(claude.frontmatter.description).toBe("Codex desc");
      expect(claude.frontmatter["allowed-tools"]).toBe("bash");
      expect(claude.content).toBe("Codex content");
    });
  });

  describe("Gemini -> Codex", () => {
    it("should convert prompt to content and preserve description", () => {
      const gemini: GeminiCommand = {
        description: "Gemini desc",
        prompt: "Gemini prompt",
        filePath: "/test/command.toml",
      };

      const geminiAgent = new GeminiAgent();
      const codexAgent = new CodexAgent();
      const ir = geminiAgent.commandToIR(gemini);
      const codex = codexAgent.commandFromIR(ir);

      expect(codex.content).toBe("Gemini prompt");
      expect(codex.frontmatter?.description).toBe("Gemini desc");
    });
  });

  describe("Codex -> Gemini", () => {
    it("should convert content to prompt", () => {
      const codex: CodexCommand = {
        frontmatter: { description: "Codex desc" },
        content: "Codex content",
        filePath: "/test/command.md",
      };

      const codexAgent = new CodexAgent();
      const geminiAgent = new GeminiAgent();
      const ir = codexAgent.commandToIR(codex);
      const gemini = geminiAgent.commandFromIR(ir);

      expect(gemini.prompt).toBe("Codex content");
      expect(gemini.description).toBe("Codex desc");
    });
  });

  describe("Round-trip: Claude -> Gemini -> Claude", () => {
    it("should preserve description and body", () => {
      const original: ClaudeCommand = {
        frontmatter: { description: "Round-trip test" },
        content: "Round-trip body",
        filePath: "/test/command.md",
      };

      const claudeAgent = new ClaudeAgent();
      const geminiAgent = new GeminiAgent();

      const ir1 = claudeAgent.commandToIR(original);
      const gemini = geminiAgent.commandFromIR(ir1);
      const ir2 = geminiAgent.commandToIR(gemini);
      const result = claudeAgent.commandFromIR(ir2);

      expect(result.frontmatter.description).toBe("Round-trip test");
      expect(result.content).toBe("Round-trip body");
    });
  });

  describe("Round-trip: Claude -> Codex -> Claude", () => {
    it("should preserve all fields", () => {
      const original: ClaudeCommand = {
        frontmatter: {
          description: "Full round-trip",
          "allowed-tools": "bash,read",
          "argument-hint": "Enter path",
          model: "sonnet",
        },
        content: "Full body content",
        filePath: "/test/command.md",
      };

      const claudeAgent = new ClaudeAgent();
      const codexAgent = new CodexAgent();

      const ir1 = claudeAgent.commandToIR(original);
      const codex = codexAgent.commandFromIR(ir1);
      const ir2 = codexAgent.commandToIR(codex);
      const result = claudeAgent.commandFromIR(ir2);

      expect(result.frontmatter.description).toBe("Full round-trip");
      expect(result.frontmatter["allowed-tools"]).toBe("bash,read");
      expect(result.frontmatter["argument-hint"]).toBe("Enter path");
      expect(result.frontmatter.model).toBe("sonnet");
      expect(result.content).toBe("Full body content");
    });
  });

  describe("Claude -> OpenCode", () => {
    it("should preserve frontmatter including model and agent", () => {
      const claude: ClaudeCommand = {
        frontmatter: {
          description: "Test description",
          "allowed-tools": "bash",
          model: "opus",
          agent: "task",
        },
        content: "Test content with !`git status` and @config.json",
        filePath: "/test/command.md",
      };

      const claudeAgent = new ClaudeAgent();
      const opencodeAgent = new OpenCodeAgent();
      const ir = claudeAgent.commandToIR(claude);
      const opencode = opencodeAgent.commandFromIR(ir);

      expect(opencode.content).toBe("Test content with !`git status` and @config.json");
      expect(opencode.frontmatter?.description).toBe("Test description");
      expect(opencode.frontmatter?.["allowed-tools"]).toBe("bash");
      expect(opencode.frontmatter?.model).toBe("opus");
      expect(opencode.frontmatter?.agent).toBe("task");
    });

    it("should remove only allowed-tools and argument-hint with removeUnsupported", () => {
      const claude: ClaudeCommand = {
        frontmatter: {
          description: "Test",
          "allowed-tools": "bash",
          "argument-hint": "Enter path",
          model: "sonnet",
        },
        content: "Body",
        filePath: "/test/command.md",
      };

      const claudeAgent = new ClaudeAgent();
      const opencodeAgent = new OpenCodeAgent();
      const ir = claudeAgent.commandToIR(claude);
      const opencode = opencodeAgent.commandFromIR(ir, { removeUnsupported: true });

      expect(opencode.frontmatter?.description).toBe("Test");
      expect(opencode.frontmatter?.model).toBe("sonnet");
      expect(opencode.frontmatter?.["allowed-tools"]).toBeUndefined();
      expect(opencode.frontmatter?.["argument-hint"]).toBeUndefined();
    });
  });

  describe("OpenCode -> Claude", () => {
    it("should restore all fields", () => {
      const opencode: OpenCodeCommand = {
        frontmatter: {
          description: "OpenCode desc",
          model: "sonnet",
          subtask: true,
        },
        content: "OpenCode content with $ARGUMENTS",
        filePath: "/test/command.md",
      };

      const opencodeAgent = new OpenCodeAgent();
      const claudeAgent = new ClaudeAgent();
      const ir = opencodeAgent.commandToIR(opencode);
      const claude = claudeAgent.commandFromIR(ir);

      expect(claude.frontmatter.description).toBe("OpenCode desc");
      expect(claude.frontmatter.model).toBe("sonnet");
      expect(claude.frontmatter.subtask).toBe(true);
      expect(claude.content).toBe("OpenCode content with $ARGUMENTS");
    });
  });

  describe("Round-trip: Claude -> OpenCode -> Claude", () => {
    it("should preserve all fields", () => {
      const original: ClaudeCommand = {
        frontmatter: {
          description: "Full round-trip",
          "allowed-tools": "bash,read",
          "argument-hint": "Enter path",
          model: "sonnet",
        },
        content: "Run !`git status` with $ARGUMENTS and @config.json",
        filePath: "/test/command.md",
      };

      const claudeAgent = new ClaudeAgent();
      const opencodeAgent = new OpenCodeAgent();

      const ir1 = claudeAgent.commandToIR(original);
      const opencode = opencodeAgent.commandFromIR(ir1);
      const ir2 = opencodeAgent.commandToIR(opencode);
      const result = claudeAgent.commandFromIR(ir2);

      expect(result.frontmatter.description).toBe("Full round-trip");
      expect(result.frontmatter["allowed-tools"]).toBe("bash,read");
      expect(result.frontmatter["argument-hint"]).toBe("Enter path");
      expect(result.frontmatter.model).toBe("sonnet");
      expect(result.content).toBe("Run !`git status` with $ARGUMENTS and @config.json");
    });
  });

  describe("Claude -> Copilot", () => {
    it("should convert description and body", () => {
      const claude: ClaudeCommand = {
        frontmatter: { description: "Test description", "allowed-tools": "bash", model: "sonnet" },
        content: "Test body content",
        filePath: "/test/command.md",
      };

      const claudeAgent = new ClaudeAgent();
      const copilotAgent = new CopilotAgent();
      const ir = claudeAgent.commandToIR(claude);
      const copilot = copilotAgent.commandFromIR(ir);

      expect(copilot.frontmatter.description).toBe("Test description");
      expect(copilot.content).toBe("Test body content");
      expect(copilot.frontmatter["allowed-tools"]).toBe("bash");
      expect(copilot.frontmatter.model).toBe("sonnet");
    });

    it("should remove allowed-tools with removeUnsupported", () => {
      const claude: ClaudeCommand = {
        frontmatter: {
          description: "Test",
          "allowed-tools": "bash",
          "argument-hint": "Enter path",
          model: "sonnet",
        },
        content: "Body",
        filePath: "/test/command.md",
      };

      const claudeAgent = new ClaudeAgent();
      const copilotAgent = new CopilotAgent();
      const ir = claudeAgent.commandToIR(claude);
      const copilot = copilotAgent.commandFromIR(ir, { removeUnsupported: true });

      expect(copilot.frontmatter.description).toBe("Test");
      expect(copilot.frontmatter.model).toBe("sonnet");
      expect(copilot.frontmatter["argument-hint"]).toBe("Enter path");
      expect(copilot.frontmatter["allowed-tools"]).toBeUndefined();
    });

    it("should change file extension to .prompt.md", () => {
      const claude: ClaudeCommand = {
        frontmatter: { description: "Test" },
        content: "Body",
        filePath: "/test/command.md",
      };

      const claudeAgent = new ClaudeAgent();
      const copilotAgent = new CopilotAgent();
      const ir = claudeAgent.commandToIR(claude);
      const copilot = copilotAgent.commandFromIR(ir);

      expect(copilot.filePath).toBe("/test/command.prompt.md");
    });
  });

  describe("Copilot -> Claude", () => {
    it("should convert description and content", () => {
      const copilot: CopilotCommand = {
        frontmatter: { description: "Copilot desc", tools: ["bash", "codeEditor"], agent: "copilot" },
        content: "Copilot content",
        filePath: "/test/command.prompt.md",
      };

      const copilotAgent = new CopilotAgent();
      const claudeAgent = new ClaudeAgent();
      const ir = copilotAgent.commandToIR(copilot);
      const claude = claudeAgent.commandFromIR(ir);

      expect(claude.frontmatter.description).toBe("Copilot desc");
      expect(claude.content).toBe("Copilot content");
      expect(claude.frontmatter.tools).toEqual(["bash", "codeEditor"]);
      expect(claude.frontmatter.agent).toBe("copilot");
    });
  });

  describe("Gemini -> Copilot", () => {
    it("should convert prompt to content and preserve description", () => {
      const gemini: GeminiCommand = {
        description: "Gemini desc",
        prompt: "Gemini prompt with {{args}}",
        filePath: "/test/command.toml",
      };

      const geminiAgent = new GeminiAgent();
      const copilotAgent = new CopilotAgent();
      const ir = geminiAgent.commandToIR(gemini);
      const copilot = copilotAgent.commandFromIR(ir);

      expect(copilot.frontmatter.description).toBe("Gemini desc");
      expect(copilot.content).toBe("Gemini prompt with $ARGUMENTS");
    });
  });

  describe("Round-trip: Claude -> Copilot -> Claude", () => {
    it("should preserve description and body", () => {
      const original: ClaudeCommand = {
        frontmatter: { description: "Round-trip test", model: "sonnet" },
        content: "Round-trip body content",
        filePath: "/test/command.md",
      };

      const claudeAgent = new ClaudeAgent();
      const copilotAgent = new CopilotAgent();

      const ir1 = claudeAgent.commandToIR(original);
      const copilot = copilotAgent.commandFromIR(ir1);
      const ir2 = copilotAgent.commandToIR(copilot);
      const result = claudeAgent.commandFromIR(ir2);

      expect(result.frontmatter.description).toBe("Round-trip test");
      expect(result.frontmatter.model).toBe("sonnet");
      expect(result.content).toBe("Round-trip body content");
    });
  });

  describe("Placeholder conversion through IR", () => {
    it("should convert Claude placeholders to Gemini format", () => {
      const claude: ClaudeCommand = {
        frontmatter: { description: "Test" },
        content: "Run !`git status` with $ARGUMENTS and load @config.json",
        filePath: "/test/command.md",
      };

      const claudeAgent = new ClaudeAgent();
      const geminiAgent = new GeminiAgent();
      const ir = claudeAgent.commandToIR(claude);
      const gemini = geminiAgent.commandFromIR(ir);

      expect(gemini.prompt).toBe("Run !{git status} with {{args}} and load @{config.json}");
    });

    it("should convert Gemini placeholders to Claude format", () => {
      const gemini: GeminiCommand = {
        description: "Test",
        prompt: "Execute !{npm test} with {{args}} and @{package.json}",
        filePath: "/test/command.toml",
      };

      const geminiAgent = new GeminiAgent();
      const claudeAgent = new ClaudeAgent();
      const ir = geminiAgent.commandToIR(gemini);
      const claude = claudeAgent.commandFromIR(ir);

      expect(claude.content).toBe("Execute !`npm test` with $ARGUMENTS and @package.json");
    });

    it("should preserve individual arguments through Claude → Gemini → Claude", () => {
      const original: ClaudeCommand = {
        frontmatter: {},
        content: "First: $1, Second: $2, All: $ARGUMENTS",
        filePath: "/test/command.md",
      };

      const claudeAgent = new ClaudeAgent();
      const geminiAgent = new GeminiAgent();

      const ir1 = claudeAgent.commandToIR(original);
      const gemini = geminiAgent.commandFromIR(ir1);
      expect(gemini.prompt).toBe("First: $1, Second: $2, All: {{args}}");

      const ir2 = geminiAgent.commandToIR(gemini);
      const result = claudeAgent.commandFromIR(ir2);
      expect(result.content).toBe("First: $1, Second: $2, All: $ARGUMENTS");
    });
  });

  describe("Claude -> Cursor", () => {
    it("should convert body but lose description (lossy)", () => {
      const claude: ClaudeCommand = {
        frontmatter: { description: "Test description", "allowed-tools": "bash", model: "sonnet" },
        content: "Test body content",
        filePath: "/test/command.md",
      };

      const claudeAgent = new ClaudeAgent();
      const cursorAgent = new CursorAgent();
      const ir = claudeAgent.commandToIR(claude);
      const cursor = cursorAgent.commandFromIR(ir);

      expect(cursor.content).toBe("Test body content");
      // Cursor has no frontmatter, so description is lost
      expect("frontmatter" in cursor).toBe(false);
    });

    it("should keep .md extension unchanged", () => {
      const claude: ClaudeCommand = {
        frontmatter: { description: "Test" },
        content: "Body",
        filePath: "/test/command.md",
      };

      const claudeAgent = new ClaudeAgent();
      const cursorAgent = new CursorAgent();
      const ir = claudeAgent.commandToIR(claude);
      const cursor = cursorAgent.commandFromIR(ir);

      expect(cursor.filePath).toBe("/test/command.md");
    });
  });

  describe("Cursor -> Claude", () => {
    it("should convert body without description", () => {
      const cursor: CursorCommand = {
        content: "Cursor content",
        filePath: "/test/command.md",
      };

      const cursorAgent = new CursorAgent();
      const claudeAgent = new ClaudeAgent();
      const ir = cursorAgent.commandToIR(cursor);
      const claude = claudeAgent.commandFromIR(ir);

      expect(claude.content).toBe("Cursor content");
      expect(claude.frontmatter.description).toBeUndefined();
    });
  });

  describe("Gemini -> Cursor", () => {
    it("should convert prompt to content and lose description", () => {
      const gemini: GeminiCommand = {
        description: "Gemini desc",
        prompt: "Gemini prompt with {{args}}",
        filePath: "/test/command.toml",
      };

      const geminiAgent = new GeminiAgent();
      const cursorAgent = new CursorAgent();
      const ir = geminiAgent.commandToIR(gemini);
      const cursor = cursorAgent.commandFromIR(ir);

      // Placeholders are serialized as best-effort (Cursor unsupported)
      expect(cursor.content).toBe("Gemini prompt with $ARGUMENTS");
      expect(cursor.filePath).toBe("/test/command.md");
    });
  });

  describe("Copilot -> Cursor", () => {
    it("should shorten .prompt.md to .md", () => {
      const copilot: CopilotCommand = {
        frontmatter: { description: "Copilot desc" },
        content: "Copilot content",
        filePath: "/test/command.prompt.md",
      };

      const copilotAgent = new CopilotAgent();
      const cursorAgent = new CursorAgent();
      const ir = copilotAgent.commandToIR(copilot);
      const cursor = cursorAgent.commandFromIR(ir);

      expect(cursor.content).toBe("Copilot content");
      expect(cursor.filePath).toBe("/test/command.md");
    });
  });

  describe("Round-trip: Cursor -> Claude -> Cursor", () => {
    it("should preserve body content", () => {
      const original: CursorCommand = {
        content: "Round-trip body content",
        filePath: "/test/command.md",
      };

      const cursorAgent = new CursorAgent();
      const claudeAgent = new ClaudeAgent();

      const ir1 = cursorAgent.commandToIR(original);
      const claude = claudeAgent.commandFromIR(ir1);
      const ir2 = claudeAgent.commandToIR(claude);
      const result = cursorAgent.commandFromIR(ir2);

      expect(result.content).toBe("Round-trip body content");
    });
  });
});
