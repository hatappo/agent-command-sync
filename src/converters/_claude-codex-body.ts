/**
 * Shared body patterns and serializers for Claude and Codex
 *
 * Claude and Codex share the same placeholder syntax.
 * Agent-specific wrappers: claude-body.ts, codex-body.ts
 */

import type { PatternDef, PlaceholderSerializers } from "../types/body-segment.js";

export const CLAUDE_CODEX_PATTERNS: PatternDef[] = [
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

export const CLAUDE_CODEX_SERIALIZERS: PlaceholderSerializers = {
  arguments: () => "$ARGUMENTS",
  "individual-argument": (p) => `$${p.index}`,
  "shell-command": (p) => `!\`${p.command}\``,
  "file-reference": (p) => `@${p.path}`,
};
