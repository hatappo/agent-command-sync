import type { ConverterOptions, SemanticIR } from "../types/semantic-ir.js";

/**
 * Unified agent definition interface.
 * Each agent registers one of these in AGENT_REGISTRY.
 * Adding a new ProductType without a registry entry causes a compile error.
 */
export interface AgentDefinition {
  readonly dirs: {
    /** Subdirectory for commands: "commands" or "prompts" */
    readonly commandSubdir: string;
    /** Subdirectory for skills: "skills" */
    readonly skillSubdir: string;
    /** Project-level base directory: ".claude", ".codex", etc. */
    readonly projectBase: string;
    /** User-level base directory relative to homedir: ".claude", ".config/opencode", etc. */
    readonly userDefault: string;
  };
  /** File extension for command files: ".md" or ".toml" */
  readonly fileExtension: string;

  /** Type-erased command operations */
  readonly commands: {
    parse(filePath: string): Promise<unknown>;
    toIR(command: unknown): SemanticIR;
    fromIR(ir: SemanticIR, options?: ConverterOptions): unknown;
    stringify(command: unknown): string;
  };

  /** Type-erased skill operations */
  readonly skills: {
    parse(dirPath: string): Promise<unknown>;
    toIR(skill: unknown): SemanticIR;
    fromIR(ir: SemanticIR, options?: ConverterOptions): unknown;
    writeToDirectory(skill: unknown, sourceDirPath: string, targetDir: string): Promise<void>;
  };
}
