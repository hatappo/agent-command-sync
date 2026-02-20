/**
 * Gemini body parser and serializer
 */

import type { BodySegment, ContentPlaceholder, PatternDef, PlaceholderSerializers } from "../types/body-segment.js";
import { parseBody, serializeBody } from "../utils/body-segment-utils.js";

const GEMINI_PATTERNS: PatternDef[] = [
  // {{args}}
  {
    regex: /\{\{args\}\}/g,
    handler: () => ({ type: "arguments" }),
  },
  // !{command}
  {
    regex: /!\{([^}]+)\}/g,
    handler: (m) => ({ type: "shell-command", command: m[1] }),
  },
  // @{path/to/file}
  {
    regex: /@\{([^}]+)\}/g,
    handler: (m) => ({ type: "file-reference", path: m[1] }),
  },
  // $1-$9 (recognized for round-trip fidelity)
  {
    regex: /\$([1-9])(?!\d)/g,
    handler: (m) => ({ type: "individual-argument", index: Number(m[1]) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 }),
  },
];

const GEMINI_SERIALIZERS: PlaceholderSerializers = {
  arguments: () => "{{args}}",
  "individual-argument": (p) => `$${p.index}`,
  "shell-command": (p) => `!{${p.command}}`,
  "file-reference": (p) => `@{${p.path}}`,
};

/** Parse a Gemini format body string into BodySegment[] */
export function parseGeminiBody(body: string): BodySegment[] {
  return parseBody(body, GEMINI_PATTERNS);
}

/** Placeholder types not natively supported by Gemini CLI */
const GEMINI_UNSUPPORTED: ReadonlySet<ContentPlaceholder["type"]> = new Set(["individual-argument"]);

/** Serialize BodySegment[] to a Gemini format body string (warns for unsupported placeholders via NODE_DEBUG=acsync) */
export function serializeGeminiBody(segments: BodySegment[]): string {
  return serializeBody(segments, GEMINI_SERIALIZERS, GEMINI_UNSUPPORTED);
}
