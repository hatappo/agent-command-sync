/**
 * OpenCode body parser and serializer
 * OpenCode shares the same placeholder syntax as Claude/Codex with no unsupported types.
 */

import type { BodySegment } from "../types/body-segment.js";
import { parseBody, serializeBody } from "../utils/body-segment-utils.js";
import { CLAUDE_CODEX_PATTERNS, CLAUDE_CODEX_SERIALIZERS } from "./_claude-codex-body.js";

/** Parse an OpenCode format body string into BodySegment[] */
export function parseOpenCodeBody(body: string): BodySegment[] {
  return parseBody(body, CLAUDE_CODEX_PATTERNS);
}

/** Serialize BodySegment[] to an OpenCode format body string */
export function serializeOpenCodeBody(segments: BodySegment[]): string {
  return serializeBody(segments, CLAUDE_CODEX_SERIALIZERS);
}
