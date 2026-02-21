import { describe, expect, it } from "vitest";
import { ClaudeAgent } from "../../src/agents/claude.js";
import { CodexAgent } from "../../src/agents/codex.js";
import { GeminiAgent } from "../../src/agents/gemini.js";
import { OpenCodeAgent } from "../../src/agents/opencode.js";

const claude = new ClaudeAgent();
const gemini = new GeminiAgent();
const codex = new CodexAgent();
const opencode = new OpenCodeAgent();

describe("Body Segment Utils", () => {
  describe("parseBody (Claude)", () => {
    it("should return empty array for empty string", () => {
      expect(claude.parseBody("")).toEqual([]);
    });

    it("should return plain text as single string segment", () => {
      expect(claude.parseBody("Hello world")).toEqual(["Hello world"]);
    });

    it("should parse $ARGUMENTS", () => {
      expect(claude.parseBody("Run with $ARGUMENTS")).toEqual(["Run with ", { type: "arguments" }]);
    });

    it("should parse $1-$9 individual arguments", () => {
      expect(claude.parseBody("First: $1, Second: $2")).toEqual([
        "First: ",
        { type: "individual-argument", index: 1 },
        ", Second: ",
        { type: "individual-argument", index: 2 },
      ]);
    });

    it("should not match $10 as individual argument", () => {
      const result = claude.parseBody("Value: $10");
      // $10 is not matched as individual argument due to negative lookahead
      expect(result).toEqual(["Value: $10"]);
    });

    it("should parse backtick shell commands", () => {
      expect(claude.parseBody("Run !`git status` now")).toEqual([
        "Run ",
        { type: "shell-command", command: "git status" },
        " now",
      ]);
    });

    it("should parse line-start shell commands", () => {
      expect(claude.parseBody("! git status")).toEqual([{ type: "shell-command", command: "git status" }]);
    });

    it("should prefer backtick over line-start when both match", () => {
      expect(claude.parseBody("!`git status`")).toEqual([{ type: "shell-command", command: "git status" }]);
    });

    it("should parse file references", () => {
      expect(claude.parseBody("Load @config.json")).toEqual(["Load ", { type: "file-reference", path: "config.json" }]);
    });

    it("should parse file references with paths", () => {
      expect(claude.parseBody("See @src/main.ts")).toEqual(["See ", { type: "file-reference", path: "src/main.ts" }]);
    });

    it("should handle mixed placeholders", () => {
      const result = claude.parseBody("Run !`git status` with $ARGUMENTS and load @config.json for user $1");
      expect(result).toEqual([
        "Run ",
        { type: "shell-command", command: "git status" },
        " with ",
        { type: "arguments" },
        " and load ",
        { type: "file-reference", path: "config.json" },
        " for user ",
        { type: "individual-argument", index: 1 },
      ]);
    });

    it("should not match @ followed by space", () => {
      expect(claude.parseBody("Send @ mention")).toEqual(["Send @ mention"]);
    });

    it("should handle multiple $ARGUMENTS", () => {
      expect(claude.parseBody("$ARGUMENTS and $ARGUMENTS")).toEqual([
        { type: "arguments" },
        " and ",
        { type: "arguments" },
      ]);
    });

    it("should handle multiline with line-start shell commands", () => {
      const body = "First line\n! git status\nLast line";
      expect(claude.parseBody(body)).toEqual([
        "First line\n",
        { type: "shell-command", command: "git status" },
        "\nLast line",
      ]);
    });
  });

  describe("parseBody (Gemini)", () => {
    it("should return empty array for empty string", () => {
      expect(gemini.parseBody("")).toEqual([]);
    });

    it("should return plain text as single string segment", () => {
      expect(gemini.parseBody("Hello world")).toEqual(["Hello world"]);
    });

    it("should parse {{args}}", () => {
      expect(gemini.parseBody("Run with {{args}}")).toEqual(["Run with ", { type: "arguments" }]);
    });

    it("should parse !{command}", () => {
      expect(gemini.parseBody("Run !{git status} now")).toEqual([
        "Run ",
        { type: "shell-command", command: "git status" },
        " now",
      ]);
    });

    it("should parse @{path}", () => {
      expect(gemini.parseBody("Load @{config.json}")).toEqual([
        "Load ",
        { type: "file-reference", path: "config.json" },
      ]);
    });

    it("should recognize $1-$9 for round-trip fidelity", () => {
      expect(gemini.parseBody("First: $1, All: {{args}}")).toEqual([
        "First: ",
        { type: "individual-argument", index: 1 },
        ", All: ",
        { type: "arguments" },
      ]);
    });

    it("should handle mixed Gemini placeholders", () => {
      const result = gemini.parseBody("Execute !{npm test} with {{args}} and @{package.json}");
      expect(result).toEqual([
        "Execute ",
        { type: "shell-command", command: "npm test" },
        " with ",
        { type: "arguments" },
        " and ",
        { type: "file-reference", path: "package.json" },
      ]);
    });
  });

  describe("serializeBody (Claude)", () => {
    it("should serialize empty array to empty string", () => {
      expect(claude.serializeBody([])).toBe("");
    });

    it("should serialize plain text", () => {
      expect(claude.serializeBody(["Hello world"])).toBe("Hello world");
    });

    it("should serialize arguments", () => {
      expect(claude.serializeBody([{ type: "arguments" }])).toBe("$ARGUMENTS");
    });

    it("should serialize individual arguments", () => {
      expect(claude.serializeBody([{ type: "individual-argument", index: 3 }])).toBe("$3");
    });

    it("should serialize shell commands with backticks", () => {
      expect(claude.serializeBody([{ type: "shell-command", command: "git status" }])).toBe("!`git status`");
    });

    it("should serialize file references", () => {
      expect(claude.serializeBody([{ type: "file-reference", path: "config.json" }])).toBe("@config.json");
    });

    it("should serialize mixed segments", () => {
      const result = claude.serializeBody([
        "Run ",
        { type: "shell-command", command: "git status" },
        " with ",
        { type: "arguments" },
      ]);
      expect(result).toBe("Run !`git status` with $ARGUMENTS");
    });
  });

  describe("serializeBody (Gemini)", () => {
    it("should serialize empty array to empty string", () => {
      expect(gemini.serializeBody([])).toBe("");
    });

    it("should serialize arguments", () => {
      expect(gemini.serializeBody([{ type: "arguments" }])).toBe("{{args}}");
    });

    it("should serialize individual arguments as literal", () => {
      expect(gemini.serializeBody([{ type: "individual-argument", index: 1 }])).toBe("$1");
    });

    it("should serialize shell commands", () => {
      expect(gemini.serializeBody([{ type: "shell-command", command: "npm test" }])).toBe("!{npm test}");
    });

    it("should serialize file references", () => {
      expect(gemini.serializeBody([{ type: "file-reference", path: "config.json" }])).toBe("@{config.json}");
    });

    it("should serialize mixed segments", () => {
      const result = gemini.serializeBody([
        "Execute ",
        { type: "shell-command", command: "npm test" },
        " with ",
        { type: "arguments" },
        " and ",
        { type: "file-reference", path: "package.json" },
      ]);
      expect(result).toBe("Execute !{npm test} with {{args}} and @{package.json}");
    });
  });

  describe("Round-trip", () => {
    it("should round-trip Claude body through parse and serialize", () => {
      const original = "Run !`git status` with $ARGUMENTS and load @config.json for user $1";
      const segments = claude.parseBody(original);
      const result = claude.serializeBody(segments);
      expect(result).toBe("Run !`git status` with $ARGUMENTS and load @config.json for user $1");
    });

    it("should round-trip Gemini body through parse and serialize", () => {
      const original = "Execute !{npm test} with {{args}} and @{package.json}";
      const segments = gemini.parseBody(original);
      const result = gemini.serializeBody(segments);
      expect(result).toBe(original);
    });

    it("should convert Claude to Gemini via segments", () => {
      const claudeBody = "Run !`git status` with $ARGUMENTS and load @config.json for user $1";
      const segments = claude.parseBody(claudeBody);
      const geminiBody = gemini.serializeBody(segments);
      expect(geminiBody).toBe("Run !{git status} with {{args}} and load @{config.json} for user $1");
    });

    it("should convert Gemini to Claude via segments", () => {
      const geminiBody = "Execute !{npm test} with {{args}} and @{package.json}";
      const segments = gemini.parseBody(geminiBody);
      const claudeBody = claude.serializeBody(segments);
      expect(claudeBody).toBe("Execute !`npm test` with $ARGUMENTS and @package.json");
    });

    it("should preserve individual arguments through Claude → Gemini → Claude", () => {
      const original = "First: $1, Second: $2, All: $ARGUMENTS";
      const segments1 = claude.parseBody(original);
      const geminiBody = gemini.serializeBody(segments1);
      expect(geminiBody).toBe("First: $1, Second: $2, All: {{args}}");

      const segments2 = gemini.parseBody(geminiBody);
      const back = claude.serializeBody(segments2);
      expect(back).toBe("First: $1, Second: $2, All: $ARGUMENTS");
    });

    it("should handle plain text without placeholders", () => {
      const text = "Just a plain command with no special syntax";
      expect(gemini.serializeBody(claude.parseBody(text))).toBe(text);
      expect(claude.serializeBody(gemini.parseBody(text))).toBe(text);
    });
  });

  describe("parseBody (Codex)", () => {
    it("should produce same result as Claude parseBody (shared patterns)", () => {
      const input = "Run !`git status` with $ARGUMENTS and load @config.json for user $1";
      expect(codex.parseBody(input)).toEqual(claude.parseBody(input));
    });
  });

  describe("serializeBody (Codex)", () => {
    it("should serialize shell-command as best-effort (unsupported by Codex)", () => {
      const result = codex.serializeBody([{ type: "shell-command", command: "git status" }]);
      expect(result).toBe("!`git status`");
    });

    it("should serialize file-reference as best-effort (unsupported by Codex)", () => {
      const result = codex.serializeBody([{ type: "file-reference", path: "config.json" }]);
      expect(result).toBe("@config.json");
    });
  });

  describe("Codex round-trip", () => {
    it("should round-trip Codex body through parse and serialize", () => {
      const original = "Run $ARGUMENTS for user $1";
      const segments = codex.parseBody(original);
      const result = codex.serializeBody(segments);
      expect(result).toBe(original);
    });

    it("should convert Codex to Gemini and back via segments", () => {
      const codexBody = "Run $ARGUMENTS for user $1";
      const segments = codex.parseBody(codexBody);
      const geminiBody = gemini.serializeBody(segments);
      expect(geminiBody).toBe("Run {{args}} for user $1");

      const back = codex.serializeBody(gemini.parseBody(geminiBody));
      expect(back).toBe(codexBody);
    });
  });

  describe("parseBody (OpenCode)", () => {
    it("should produce same result as Claude parseBody (shared patterns)", () => {
      const input = "Run !`git status` with $ARGUMENTS and load @config.json for user $1";
      expect(opencode.parseBody(input)).toEqual(claude.parseBody(input));
    });
  });

  describe("serializeBody (OpenCode)", () => {
    it("should produce same output as Claude serializeBody", () => {
      const segments = claude.parseBody("Run !`git status` with $ARGUMENTS and load @config.json for user $1");
      expect(opencode.serializeBody(segments)).toBe(claude.serializeBody(segments));
    });
  });

  describe("OpenCode round-trip", () => {
    it("should round-trip OpenCode body through parse and serialize", () => {
      const original = "Run !`git status` with $ARGUMENTS and load @config.json for user $1";
      const segments = opencode.parseBody(original);
      const result = opencode.serializeBody(segments);
      expect(result).toBe(original);
    });
  });
});
