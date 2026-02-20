/**
 * Shared body segment parsing and serialization engine
 *
 * Agent-specific patterns and serializers are defined in:
 * - src/converters/claude-body.ts (Claude/Codex)
 * - src/converters/gemini-body.ts (Gemini)
 */

import { debuglog } from "node:util";
import type { BodySegment, ContentPlaceholder, PatternDef, PlaceholderSerializers } from "../types/body-segment.js";

const debug = debuglog("acsync");

// --- Internal types ---

interface MatchResult {
  start: number;
  end: number;
  placeholder: ContentPlaceholder;
}

// --- Internal helpers ---

function findAllMatches(body: string, patterns: PatternDef[]): MatchResult[] {
  const matches: MatchResult[] = [];

  for (const { regex, handler } of patterns) {
    // Reset regex state and create a fresh copy
    const re = new RegExp(regex.source, regex.flags);
    for (const match of body.matchAll(re)) {
      const start = match.index ?? 0;
      matches.push({
        start,
        end: start + match[0].length,
        placeholder: handler(match),
      });
    }
  }

  return matches;
}

function removeOverlaps(matches: MatchResult[]): MatchResult[] {
  matches.sort((a, b) => a.start - b.start);

  const result: MatchResult[] = [];
  let lastEnd = -1;

  for (const match of matches) {
    if (match.start >= lastEnd) {
      result.push(match);
      lastEnd = match.end;
    }
  }

  return result;
}

function buildSegments(body: string, matches: MatchResult[]): BodySegment[] {
  const segments: BodySegment[] = [];
  let lastIndex = 0;

  for (const match of matches) {
    if (match.start > lastIndex) {
      segments.push(body.slice(lastIndex, match.start));
    }
    segments.push(match.placeholder);
    lastIndex = match.end;
  }

  if (lastIndex < body.length) {
    segments.push(body.slice(lastIndex));
  }

  return segments;
}

// --- Public API ---

/** Parse a body string into BodySegment[] using the given patterns */
export function parseBody(body: string, patterns: PatternDef[]): BodySegment[] {
  if (body.length === 0) return [];

  const matches = findAllMatches(body, patterns);
  const resolved = removeOverlaps(matches);
  return buildSegments(body, resolved);
}

/** Serialize BodySegment[] to a string using the given serializers */
export function serializeBody(
  segments: BodySegment[],
  serializers: PlaceholderSerializers,
  unsupported?: ReadonlySet<ContentPlaceholder["type"]>,
): string {
  return segments
    .map((segment) => {
      if (typeof segment === "string") return segment;
      if (unsupported?.has(segment.type)) {
        debug("Placeholder '%s' is not natively supported by target format (serialized as best-effort)", segment.type);
      }
      const fn = serializers[segment.type] as (placeholder: ContentPlaceholder) => string;
      return fn(segment);
    })
    .join("");
}
