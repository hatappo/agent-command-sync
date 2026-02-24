import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AGENT_REGISTRY } from "../../src/agents/registry.js";
import { type AgentStats, collectAgentStats, formatStatsLine, showChimeraArt } from "../../src/cli/status.js";

describe("collectAgentStats", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `status-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("returns zero counts when no agent directories exist", async () => {
    const stats = await collectAgentStats({ gitRoot: tempDir, global: false });
    expect(stats).toEqual({ commandCount: 0, skillCount: 0, agentCount: 0, detectedAgents: new Set() });
  });

  it("counts commands from a single agent", async () => {
    // Create Claude commands directory with files
    const claudeAgent = AGENT_REGISTRY.claude;
    const cmdDir = join(tempDir, claudeAgent.dirs.projectBase, claudeAgent.dirs.commandSubdir);
    await mkdir(cmdDir, { recursive: true });
    await writeFile(join(cmdDir, "test1.md"), "# Test command 1");
    await writeFile(join(cmdDir, "test2.md"), "# Test command 2");

    const stats = await collectAgentStats({ gitRoot: tempDir, global: false });
    expect(stats.commandCount).toBe(2);
    expect(stats.agentCount).toBe(1);
    expect(stats.detectedAgents).toEqual(new Set(["claude"]));
  });

  it("counts skills from a single agent", async () => {
    // Create Gemini skills directory with skill subdirs
    const geminiAgent = AGENT_REGISTRY.gemini;
    const skillDir = join(tempDir, geminiAgent.dirs.projectBase, geminiAgent.dirs.skillSubdir);
    const skill1 = join(skillDir, "my-skill");
    await mkdir(skill1, { recursive: true });
    await writeFile(join(skill1, "SKILL.md"), "# My Skill");

    const stats = await collectAgentStats({ gitRoot: tempDir, global: false });
    expect(stats.skillCount).toBe(1);
    expect(stats.agentCount).toBe(1);
    expect(stats.detectedAgents).toEqual(new Set(["gemini"]));
  });

  it("counts commands and skills from multiple agents", async () => {
    // Claude: 2 commands
    const claudeAgent = AGENT_REGISTRY.claude;
    const claudeCmdDir = join(tempDir, claudeAgent.dirs.projectBase, claudeAgent.dirs.commandSubdir);
    await mkdir(claudeCmdDir, { recursive: true });
    await writeFile(join(claudeCmdDir, "cmd1.md"), "# Cmd 1");
    await writeFile(join(claudeCmdDir, "cmd2.md"), "# Cmd 2");

    // Gemini: 1 command
    const geminiAgent = AGENT_REGISTRY.gemini;
    const geminiCmdDir = join(tempDir, geminiAgent.dirs.projectBase, geminiAgent.dirs.commandSubdir);
    await mkdir(geminiCmdDir, { recursive: true });
    await writeFile(join(geminiCmdDir, "cmd1.toml"), 'description = "test"');

    // Codex: 1 skill
    const codexAgent = AGENT_REGISTRY.codex;
    const codexSkillDir = join(tempDir, codexAgent.dirs.projectBase, codexAgent.dirs.skillSubdir, "my-skill");
    await mkdir(codexSkillDir, { recursive: true });
    await writeFile(join(codexSkillDir, "SKILL.md"), "# My Skill");

    const stats = await collectAgentStats({ gitRoot: tempDir, global: false });
    expect(stats.commandCount).toBe(3);
    expect(stats.skillCount).toBe(1);
    expect(stats.agentCount).toBe(3);
    expect(stats.detectedAgents).toEqual(new Set(["claude", "gemini", "codex"]));
  });

  it("excludes chimera agent from counts", async () => {
    // Create chimera commands directory
    const chimeraAgent = AGENT_REGISTRY.chimera;
    const chimeraCmdDir = join(tempDir, chimeraAgent.dirs.projectBase, chimeraAgent.dirs.commandSubdir);
    await mkdir(chimeraCmdDir, { recursive: true });
    await writeFile(join(chimeraCmdDir, "cmd.md"), "# Chimera cmd");

    const stats = await collectAgentStats({ gitRoot: tempDir, global: false });
    // chimera should be excluded
    expect(stats.commandCount).toBe(0);
    expect(stats.agentCount).toBe(0);
  });
});

describe("formatStatsLine", () => {
  it("formats a stats line with label", () => {
    const stats: AgentStats = { commandCount: 3, skillCount: 2, agentCount: 2, detectedAgents: new Set(["claude", "gemini"]) };
    expect(formatStatsLine("User:", stats)).toBe("User: 3 commands, 2 skills (2 agents)");
  });

  it("formats with padded label", () => {
    const stats: AgentStats = { commandCount: 8, skillCount: 5, agentCount: 4, detectedAgents: new Set() };
    expect(formatStatsLine("Project:", stats)).toBe("Project: 8 commands, 5 skills (4 agents)");
  });

  it("formats with zero counts", () => {
    const stats: AgentStats = { commandCount: 0, skillCount: 0, agentCount: 0, detectedAgents: new Set() };
    expect(formatStatsLine("User:", stats)).toBe("User: 0 commands, 0 skills (0 agents)");
  });
});

describe("showChimeraArt", () => {
  let logs: string[];
  const origLog = console.log;

  beforeEach(() => {
    logs = [];
    vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows Ghost for level 0", () => {
    showChimeraArt(0);
    const output = logs.join("\n");
    expect(output).toContain("Lv.0");
    expect(output).toContain("Ghost");
    expect(output).toContain(">_<");
  });

  it("shows Cat for level 1", () => {
    showChimeraArt(1);
    const output = logs.join("\n");
    expect(output).toContain("Lv.1");
    expect(output).toContain("Cat");
    expect(output).toContain("o.o");
  });

  it("shows Dragon for level 5", () => {
    showChimeraArt(5);
    const output = logs.join("\n");
    expect(output).toContain("Lv.5");
    expect(output).toContain("Dragon");
    expect(output).toContain("~~~>o");
  });

  it("clamps to max level for values exceeding art count", () => {
    showChimeraArt(999);
    const output = logs.join("\n");
    expect(output).toContain("Lv.10");
    expect(output).toContain("Bee");
  });

  it("clamps negative values to 0", () => {
    showChimeraArt(-5);
    const output = logs.join("\n");
    expect(output).toContain("Lv.0");
    expect(output).toContain("Ghost");
  });

  it("does not include speech bubble or stats", () => {
    showChimeraArt(3);
    const output = logs.join("\n");
    expect(output).not.toContain("commands");
    expect(output).not.toContain("skills");
    expect(output).not.toContain("User:");
  });
});
