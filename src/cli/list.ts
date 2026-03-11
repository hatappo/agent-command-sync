import { basename, relative } from "node:path";
import picocolors from "picocolors";
import { AGENT_REGISTRY } from "../agents/registry.js";
import type { ProductType } from "../types/intermediate.js";
import { PRODUCT_TYPES } from "../types/intermediate.js";
import { type DirResolutionContext, findAgentSkills, resolveSkillDir } from "../utils/file-utils.js";

// ── Types ───────────────────────────────────────────────────────

export interface ListOptions {
  global: boolean;
  gitRoot?: string | null;
  customDirs?: Partial<Record<ProductType, string>>;
}

export interface DiscoveredSkillEntry {
  name: string;
  relativePath: string;
}

export interface AgentSkillGroup {
  agentName: ProductType;
  displayName: string;
  skillSubdir: string;
  skills: DiscoveredSkillEntry[];
}

// ── Skill discovery by agent ────────────────────────────────────

/**
 * Discover skills grouped by agent.
 * Returns only agents that have at least one skill.
 */
export async function discoverSkillsByAgent(options: {
  global: boolean;
  gitRoot?: string | null;
  customDirs?: Partial<Record<ProductType, string>>;
}): Promise<AgentSkillGroup[]> {
  const baseDir = options.gitRoot ?? process.cwd();
  const results: AgentSkillGroup[] = [];

  for (const agentName of PRODUCT_TYPES) {
    if (agentName === "chimera") continue;

    const agent = AGENT_REGISTRY[agentName];
    const context: DirResolutionContext = {
      customDir: options.customDirs?.[agentName],
      gitRoot: options.gitRoot,
      global: options.global,
    };

    const skillDirs = await findAgentSkills(agent, undefined, context);
    if (skillDirs.length === 0) continue;

    const skillDir = resolveSkillDir(agent, context);
    const relativeSkillDir = relative(baseDir, skillDir);

    const skills: DiscoveredSkillEntry[] = skillDirs.map((dir) => ({
      name: basename(dir),
      relativePath: relative(baseDir, dir),
    }));

    results.push({
      agentName,
      displayName: agent.displayName,
      skillSubdir: relativeSkillDir,
      skills,
    });
  }

  return results;
}

// ── List display ────────────────────────────────────────────────

export async function showList(options: ListOptions): Promise<void> {
  const groups = await discoverSkillsByAgent(options);

  if (groups.length === 0) {
    console.log(picocolors.yellow("No skills found."));
    return;
  }

  const modeLabel = options.gitRoot && !options.global ? `project: ${options.gitRoot}` : "global";
  console.log(`\nSkills ${picocolors.dim(`[${modeLabel}]`)}`);

  let totalSkills = 0;
  const uniqueNames = new Set<string>();

  for (const group of groups) {
    const dirLabel = `${group.skillSubdir}/`;
    console.log(`\n  ${picocolors.bold(group.displayName)} ${picocolors.dim(`(${dirLabel})`)}`);

    const maxNameLen = Math.max(...group.skills.map((s) => s.name.length));

    for (const skill of group.skills) {
      const paddedName = skill.name.padEnd(maxNameLen + 2);
      console.log(`    ${paddedName}${picocolors.dim(skill.relativePath)}`);
      totalSkills++;
      uniqueNames.add(skill.name);
    }
  }

  console.log(
    `\n  ${totalSkills} skill${totalSkills !== 1 ? "s" : ""} across ${groups.length} agent${groups.length !== 1 ? "s" : ""} (${uniqueNames.size} unique)`,
  );
  console.log();
}
