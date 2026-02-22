import type { BodySegment } from "../types/body-segment.js";
import type { ConverterOptions, SemanticIR } from "../types/semantic-ir.js";

/**
 * Agent configuration: display name, directory layout, file extension.
 */
export interface AgentConfig {
  readonly displayName: string;
  readonly dirs: {
    readonly commandSubdir: string;
    readonly skillSubdir: string;
    readonly projectBase: string;
    readonly userDefault: string;
  };
  readonly fileExtension: string;
}

/**
 * Body segment parsing and serialization for an agent's placeholder syntax.
 */
export interface BodyParser {
  parseBody(body: string): BodySegment[];
  serializeBody(segments: BodySegment[]): string;
}

/**
 * Command file parsing, validation, and serialization.
 */
export interface CommandParser<T> {
  parseCommand(filePath: string): Promise<T>;
  validateCommand(data: T): boolean;
  stringifyCommand(command: T): string;
}

/**
 * Bidirectional command conversion via SemanticIR.
 */
export interface CommandConverter<T> {
  commandToIR(source: T, options?: ConverterOptions): SemanticIR;
  commandFromIR(ir: SemanticIR, options?: ConverterOptions): T;
}

/**
 * Skill directory parsing, validation, serialization, and writing.
 */
export interface SkillParser<T> {
  parseSkill(dirPath: string): Promise<T>;
  validateSkill(data: T): boolean;
  stringifySkill(skill: T): string;
  writeSkillToDirectory(skill: T, sourceDirPath: string, targetDir: string): Promise<void>;
}

/**
 * Bidirectional skill conversion via SemanticIR.
 */
export interface SkillConverter<T> {
  skillToIR(source: T, options?: ConverterOptions): SemanticIR;
  skillFromIR(ir: SemanticIR, options?: ConverterOptions): T;
}

/**
 * Unified agent definition interface (type-erased for registry use).
 * Each agent registers one of these in AGENT_REGISTRY.
 * Adding a new ProductType without a registry entry causes a compile error.
 *
 * TypeScript method syntax is bivariant, so a concrete agent class
 * (e.g. ClaudeAgent with parseCommand returning Promise<ClaudeCommand>)
 * is assignable to AgentDefinition (parseCommand returning Promise<unknown>).
 */
export interface AgentDefinition
  extends AgentConfig,
    BodyParser,
    CommandParser<unknown>,
    CommandConverter<unknown>,
    SkillParser<unknown>,
    SkillConverter<unknown> {}
