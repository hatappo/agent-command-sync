import { describe, expect, it } from "vitest";
import { parseClaudeBody, serializeClaudeBody } from "../../src/converters/claude-body.js";
import { parseCodexBody, serializeCodexBody } from "../../src/converters/codex-body.js";
import { parseGeminiBody, serializeGeminiBody } from "../../src/converters/gemini-body.js";

describe("Body Segment Utils", () => {
  describe("parseClaudeBody", () => {
    it("should return empty array for empty string", () => {
      expect(parseClaudeBody("")).toEqual([]);
    });

    it("should return plain text as single string segment", () => {
      expect(parseClaudeBody("Hello world")).toEqual(["Hello world"]);
    });

    it("should parse $ARGUMENTS", () => {
      expect(parseClaudeBody("Run with $ARGUMENTS")).toEqual([
        "Run with ",
        { type: "arguments" },
      ]);
    });

    it("should parse $1-$9 individual arguments", () => {
      expect(parseClaudeBody("First: $1, Second: $2")).toEqual([
        "First: ",
        { type: "individual-argument", index: 1 },
        ", Second: ",
        { type: "individual-argument", index: 2 },
      ]);
    });

    it("should not match $10 as individual argument", () => {
      const result = parseClaudeBody("Value: $10");
      // $10 is not matched as individual argument due to negative lookahead
      expect(result).toEqual(["Value: $10"]);
    });

    it("should parse backtick shell commands", () => {
      expect(parseClaudeBody("Run !`git status` now")).toEqual([
        "Run ",
        { type: "shell-command", command: "git status" },
        " now",
      ]);
    });

    it("should parse line-start shell commands", () => {
      expect(parseClaudeBody("! git status")).toEqual([
        { type: "shell-command", command: "git status" },
      ]);
    });

    it("should prefer backtick over line-start when both match", () => {
      expect(parseClaudeBody("!`git status`")).toEqual([
        { type: "shell-command", command: "git status" },
      ]);
    });

    it("should parse file references", () => {
      expect(parseClaudeBody("Load @config.json")).toEqual([
        "Load ",
        { type: "file-reference", path: "config.json" },
      ]);
    });

    it("should parse file references with paths", () => {
      expect(parseClaudeBody("See @src/main.ts")).toEqual([
        "See ",
        { type: "file-reference", path: "src/main.ts" },
      ]);
    });

    it("should handle mixed placeholders", () => {
      const result = parseClaudeBody("Run !`git status` with $ARGUMENTS and load @config.json for user $1");
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
      expect(parseClaudeBody("Send @ mention")).toEqual(["Send @ mention"]);
    });

    it("should handle multiple $ARGUMENTS", () => {
      expect(parseClaudeBody("$ARGUMENTS and $ARGUMENTS")).toEqual([
        { type: "arguments" },
        " and ",
        { type: "arguments" },
      ]);
    });

    it("should handle multiline with line-start shell commands", () => {
      const body = "First line\n! git status\nLast line";
      expect(parseClaudeBody(body)).toEqual([
        "First line\n",
        { type: "shell-command", command: "git status" },
        "\nLast line",
      ]);
    });
  });

  describe("parseGeminiBody", () => {
    it("should return empty array for empty string", () => {
      expect(parseGeminiBody("")).toEqual([]);
    });

    it("should return plain text as single string segment", () => {
      expect(parseGeminiBody("Hello world")).toEqual(["Hello world"]);
    });

    it("should parse {{args}}", () => {
      expect(parseGeminiBody("Run with {{args}}")).toEqual([
        "Run with ",
        { type: "arguments" },
      ]);
    });

    it("should parse !{command}", () => {
      expect(parseGeminiBody("Run !{git status} now")).toEqual([
        "Run ",
        { type: "shell-command", command: "git status" },
        " now",
      ]);
    });

    it("should parse @{path}", () => {
      expect(parseGeminiBody("Load @{config.json}")).toEqual([
        "Load ",
        { type: "file-reference", path: "config.json" },
      ]);
    });

    it("should recognize $1-$9 for round-trip fidelity", () => {
      expect(parseGeminiBody("First: $1, All: {{args}}")).toEqual([
        "First: ",
        { type: "individual-argument", index: 1 },
        ", All: ",
        { type: "arguments" },
      ]);
    });

    it("should handle mixed Gemini placeholders", () => {
      const result = parseGeminiBody("Execute !{npm test} with {{args}} and @{package.json}");
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

  describe("serializeClaudeBody", () => {
    it("should serialize empty array to empty string", () => {
      expect(serializeClaudeBody([])).toBe("");
    });

    it("should serialize plain text", () => {
      expect(serializeClaudeBody(["Hello world"])).toBe("Hello world");
    });

    it("should serialize arguments", () => {
      expect(serializeClaudeBody([{ type: "arguments" }])).toBe("$ARGUMENTS");
    });

    it("should serialize individual arguments", () => {
      expect(serializeClaudeBody([{ type: "individual-argument", index: 3 }])).toBe("$3");
    });

    it("should serialize shell commands with backticks", () => {
      expect(serializeClaudeBody([{ type: "shell-command", command: "git status" }])).toBe("!`git status`");
    });

    it("should serialize file references", () => {
      expect(serializeClaudeBody([{ type: "file-reference", path: "config.json" }])).toBe("@config.json");
    });

    it("should serialize mixed segments", () => {
      const result = serializeClaudeBody([
        "Run ",
        { type: "shell-command", command: "git status" },
        " with ",
        { type: "arguments" },
      ]);
      expect(result).toBe("Run !`git status` with $ARGUMENTS");
    });
  });

  describe("serializeGeminiBody", () => {
    it("should serialize empty array to empty string", () => {
      expect(serializeGeminiBody([])).toBe("");
    });

    it("should serialize arguments", () => {
      expect(serializeGeminiBody([{ type: "arguments" }])).toBe("{{args}}");
    });

    it("should serialize individual arguments as literal", () => {
      expect(serializeGeminiBody([{ type: "individual-argument", index: 1 }])).toBe("$1");
    });

    it("should serialize shell commands", () => {
      expect(serializeGeminiBody([{ type: "shell-command", command: "npm test" }])).toBe("!{npm test}");
    });

    it("should serialize file references", () => {
      expect(serializeGeminiBody([{ type: "file-reference", path: "config.json" }])).toBe("@{config.json}");
    });

    it("should serialize mixed segments", () => {
      const result = serializeGeminiBody([
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
      const segments = parseClaudeBody(original);
      const result = serializeClaudeBody(segments);
      expect(result).toBe("Run !`git status` with $ARGUMENTS and load @config.json for user $1");
    });

    it("should round-trip Gemini body through parse and serialize", () => {
      const original = "Execute !{npm test} with {{args}} and @{package.json}";
      const segments = parseGeminiBody(original);
      const result = serializeGeminiBody(segments);
      expect(result).toBe(original);
    });

    it("should convert Claude to Gemini via segments", () => {
      const claude = "Run !`git status` with $ARGUMENTS and load @config.json for user $1";
      const segments = parseClaudeBody(claude);
      const gemini = serializeGeminiBody(segments);
      expect(gemini).toBe("Run !{git status} with {{args}} and load @{config.json} for user $1");
    });

    it("should convert Gemini to Claude via segments", () => {
      const gemini = "Execute !{npm test} with {{args}} and @{package.json}";
      const segments = parseGeminiBody(gemini);
      const claude = serializeClaudeBody(segments);
      expect(claude).toBe("Execute !`npm test` with $ARGUMENTS and @package.json");
    });

    it("should preserve individual arguments through Claude → Gemini → Claude", () => {
      const original = "First: $1, Second: $2, All: $ARGUMENTS";
      const segments1 = parseClaudeBody(original);
      const gemini = serializeGeminiBody(segments1);
      expect(gemini).toBe("First: $1, Second: $2, All: {{args}}");

      const segments2 = parseGeminiBody(gemini);
      const back = serializeClaudeBody(segments2);
      expect(back).toBe("First: $1, Second: $2, All: $ARGUMENTS");
    });

    it("should handle plain text without placeholders", () => {
      const text = "Just a plain command with no special syntax";
      expect(serializeGeminiBody(parseClaudeBody(text))).toBe(text);
      expect(serializeClaudeBody(parseGeminiBody(text))).toBe(text);
    });
  });

  describe("parseCodexBody", () => {
    it("should return empty array for empty string", () => {
      expect(parseCodexBody("")).toEqual([]);
    });

    it("should parse $ARGUMENTS", () => {
      expect(parseCodexBody("Run with $ARGUMENTS")).toEqual(["Run with ", { type: "arguments" }]);
    });

    it("should produce same result as parseClaudeBody (shared patterns)", () => {
      const input = "Run !`git status` with $ARGUMENTS and load @config.json for user $1";
      expect(parseCodexBody(input)).toEqual(parseClaudeBody(input));
    });
  });

  describe("serializeCodexBody", () => {
    it("should serialize empty array to empty string", () => {
      expect(serializeCodexBody([])).toBe("");
    });

    it("should serialize arguments", () => {
      expect(serializeCodexBody([{ type: "arguments" }])).toBe("$ARGUMENTS");
    });

    it("should serialize individual arguments", () => {
      expect(serializeCodexBody([{ type: "individual-argument", index: 3 }])).toBe("$3");
    });

    it("should serialize shell-command as best-effort (unsupported by Codex)", () => {
      const result = serializeCodexBody([{ type: "shell-command", command: "git status" }]);
      expect(result).toBe("!`git status`");
    });

    it("should serialize file-reference as best-effort (unsupported by Codex)", () => {
      const result = serializeCodexBody([{ type: "file-reference", path: "config.json" }]);
      expect(result).toBe("@config.json");
    });

    it("should serialize mixed segments including unsupported types", () => {
      const result = serializeCodexBody([
        "Run ",
        { type: "shell-command", command: "git status" },
        " with ",
        { type: "arguments" },
        " and ",
        { type: "file-reference", path: "config.json" },
      ]);
      expect(result).toBe("Run !`git status` with $ARGUMENTS and @config.json");
    });
  });

  describe("Codex round-trip", () => {
    it("should round-trip Codex body through parse and serialize", () => {
      const original = "Run $ARGUMENTS for user $1";
      const segments = parseCodexBody(original);
      const result = serializeCodexBody(segments);
      expect(result).toBe(original);
    });

    it("should convert Codex to Gemini and back via segments", () => {
      const codex = "Run $ARGUMENTS for user $1";
      const segments = parseCodexBody(codex);
      const gemini = serializeGeminiBody(segments);
      expect(gemini).toBe("Run {{args}} for user $1");

      const back = serializeCodexBody(parseGeminiBody(gemini));
      expect(back).toBe(codex);
    });
  });
});
