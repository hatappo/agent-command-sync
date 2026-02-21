import { describe, expect, it } from "vitest";
import { AGENT_REGISTRY } from "../../src/agents/registry.js";
import { PRODUCT_TYPES } from "../../src/types/intermediate.js";

describe("Agent Registry", () => {
  it("should have an entry for every product type", () => {
    for (const product of PRODUCT_TYPES) {
      expect(AGENT_REGISTRY[product]).toBeDefined();
    }
  });

  it("should have correct directory configuration for each agent", () => {
    expect(AGENT_REGISTRY.claude.dirs.projectBase).toBe(".claude");
    expect(AGENT_REGISTRY.claude.dirs.commandSubdir).toBe("commands");
    expect(AGENT_REGISTRY.claude.dirs.skillSubdir).toBe("skills");
    expect(AGENT_REGISTRY.claude.dirs.userDefault).toBe(".claude");
    expect(AGENT_REGISTRY.claude.fileExtension).toBe(".md");

    expect(AGENT_REGISTRY.gemini.dirs.projectBase).toBe(".gemini");
    expect(AGENT_REGISTRY.gemini.dirs.commandSubdir).toBe("commands");
    expect(AGENT_REGISTRY.gemini.dirs.skillSubdir).toBe("skills");
    expect(AGENT_REGISTRY.gemini.dirs.userDefault).toBe(".gemini");
    expect(AGENT_REGISTRY.gemini.fileExtension).toBe(".toml");

    expect(AGENT_REGISTRY.codex.dirs.projectBase).toBe(".codex");
    expect(AGENT_REGISTRY.codex.dirs.commandSubdir).toBe("prompts");
    expect(AGENT_REGISTRY.codex.dirs.skillSubdir).toBe("skills");
    expect(AGENT_REGISTRY.codex.dirs.userDefault).toBe(".codex");
    expect(AGENT_REGISTRY.codex.fileExtension).toBe(".md");

    expect(AGENT_REGISTRY.opencode.dirs.projectBase).toBe(".opencode");
    expect(AGENT_REGISTRY.opencode.dirs.commandSubdir).toBe("commands");
    expect(AGENT_REGISTRY.opencode.dirs.skillSubdir).toBe("skills");
    expect(AGENT_REGISTRY.opencode.dirs.userDefault).toBe(".config/opencode");
    expect(AGENT_REGISTRY.opencode.fileExtension).toBe(".md");
  });

  it("should have all required handler functions", () => {
    for (const product of PRODUCT_TYPES) {
      const agent = AGENT_REGISTRY[product];
      expect(typeof agent.commands.parse).toBe("function");
      expect(typeof agent.commands.toIR).toBe("function");
      expect(typeof agent.commands.fromIR).toBe("function");
      expect(typeof agent.commands.stringify).toBe("function");
      expect(typeof agent.skills.parse).toBe("function");
      expect(typeof agent.skills.toIR).toBe("function");
      expect(typeof agent.skills.fromIR).toBe("function");
      expect(typeof agent.skills.writeToDirectory).toBe("function");
    }
  });
});
