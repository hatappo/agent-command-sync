/**
 * Shared body patterns and serializers for Claude-syntax agents (Claude, Codex, OpenCode)
 *
 * These agents share the same placeholder syntax ($ARGUMENTS, !`cmd`, @path, $1-$9).
 * Agent-specific wrappers call parseBody/serializeBody with these patterns.
 */

import type { PatternDef, PlaceholderSerializers } from "../types/body-segment.js";

export const CLAUDE_SYNTAX_PATTERNS: PatternDef[] = [
  // $ARGUMENTS (highest priority — must precede $1-$9)
  {
    regex: /\$ARGUMENTS/g,
    handler: () => ({ type: "arguments" }),
  },
  // !`command` (backtick shell command)
  {
    regex: /!`([^`]+)`/g,
    handler: (m) => ({ type: "shell-command", command: m[1] }),
  },
  // ! command (line-start shell command)
  {
    regex: /^!\s*([^\s{][^\n]*)/gm,
    handler: (m) => ({ type: "shell-command", command: m[1] }),
  },
  // @path/to/file (file reference)
  {
    regex: /@([^\s{}[\]()<>]+(?:\.[a-zA-Z0-9]+)?)/g,
    handler: (m) => ({ type: "file-reference", path: m[1] }),
  },
  // $1-$9 (individual arguments — lowest priority)
  {
    regex: /\$([1-9])(?!\d)/g,
    handler: (m) => ({ type: "individual-argument", index: Number(m[1]) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 }),
  },
];

export const CLAUDE_SYNTAX_SERIALIZERS: PlaceholderSerializers = {
  arguments: () => "$ARGUMENTS",
  "individual-argument": (p) => `$${p.index}`,
  "shell-command": (p) => `!\`${p.command}\``,
  "file-reference": (p) => `@${p.path}`,
};
