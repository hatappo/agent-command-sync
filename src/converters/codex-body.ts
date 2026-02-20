/**
 * Codex body parser and serializer
 */

import type { BodySegment, ContentPlaceholder } from "../types/body-segment.js";
import { parseBody, serializeBody } from "../utils/body-segment-utils.js";
import { CLAUDE_CODEX_PATTERNS, CLAUDE_CODEX_SERIALIZERS } from "./_claude-codex-body.js";

/** Placeholder types not natively supported by Codex CLI */
const CODEX_UNSUPPORTED: ReadonlySet<ContentPlaceholder["type"]> = new Set(["shell-command", "file-reference"]);

/** Parse a Codex format body string into BodySegment[] */
export function parseCodexBody(body: string): BodySegment[] {
  return parseBody(body, CLAUDE_CODEX_PATTERNS);
}

/** Serialize BodySegment[] to a Codex format body string (warns for unsupported placeholders via NODE_DEBUG=acsync) */
export function serializeCodexBody(segments: BodySegment[]): string {
  return serializeBody(segments, CLAUDE_CODEX_SERIALIZERS, CODEX_UNSUPPORTED);
}
