/**
 * Body segment types for tokenized body representation
 */

/**
 * Content placeholder types in body text
 */
export type ContentPlaceholder =
  | { type: "arguments" }
  | { type: "individual-argument"; index: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 }
  | { type: "shell-command"; command: string }
  | { type: "file-reference"; path: string };

/**
 * A segment of body content: either a plain string or a semantic placeholder
 */
export type BodySegment = string | ContentPlaceholder;

// --- Agent-specific registry types ---

/** Pattern definition for parsing a body string into placeholders */
export interface PatternDef {
  regex: RegExp;
  handler: (match: RegExpMatchArray) => ContentPlaceholder;
}

/**
 * Type-driven serializer registry.
 * Forces exhaustive implementation for every ContentPlaceholder type.
 * Adding a new placeholder type causes a compile error until a serializer is added.
 */
export type PlaceholderSerializers = {
  [K in ContentPlaceholder["type"]]: (placeholder: Extract<ContentPlaceholder, { type: K }>) => string;
};
