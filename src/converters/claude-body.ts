/**
 * Claude body parser and serializer
 */

import type { BodySegment } from "../types/body-segment.js";
import { parseBody, serializeBody } from "../utils/body-segment-utils.js";
import { CLAUDE_CODEX_PATTERNS, CLAUDE_CODEX_SERIALIZERS } from "./_claude-codex-body.js";

/** Parse a Claude format body string into BodySegment[] */
export function parseClaudeBody(body: string): BodySegment[] {
  return parseBody(body, CLAUDE_CODEX_PATTERNS);
}

/** Serialize BodySegment[] to a Claude format body string */
export function serializeClaudeBody(segments: BodySegment[]): string {
  return serializeBody(segments, CLAUDE_CODEX_SERIALIZERS);
}
