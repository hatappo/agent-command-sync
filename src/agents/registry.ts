import type { ProductType } from "../types/intermediate.js";
import { createClaudeAgent } from "./claude.js";
import { createCodexAgent } from "./codex.js";
import { createCopilotAgent } from "./copilot.js";
import { createGeminiAgent } from "./gemini.js";
import { createOpenCodeAgent } from "./opencode.js";
import type { AgentDefinition } from "./agent-definition.js";

/**
 * Agent registry: maps each ProductType to its AgentDefinition.
 * Adding a new value to PRODUCT_TYPES without an entry here causes a compile error.
 */
export const AGENT_REGISTRY: Record<ProductType, AgentDefinition> = {
  claude: createClaudeAgent(),
  gemini: createGeminiAgent(),
  codex: createCodexAgent(),
  opencode: createOpenCodeAgent(),
  copilot: createCopilotAgent(),
};
