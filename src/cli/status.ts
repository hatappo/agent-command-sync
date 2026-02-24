import picocolors from "picocolors";
import { version } from "../../package.json" assert { type: "json" };
import { AGENT_REGISTRY } from "../agents/registry.js";
import type { ProductType } from "../types/intermediate.js";
import { PRODUCT_TYPES } from "../types/intermediate.js";
import { type DirResolutionContext, findAgentCommands, findAgentSkills } from "../utils/file-utils.js";

/** Chimera parts indexed by level: Lv.0 = Ghost, Lv.1 = Cat, ... */
const CHIMERA_PARTS: { name: string; emoji: string; trait?: string }[] = [
  { name: "Ghost", emoji: "👻" },
  { name: "Cat", emoji: "🐱" },
  { name: "Bird", emoji: "🐦", trait: "wings" },
  { name: "Fish", emoji: "🐟", trait: "tail" },
  { name: "Rabbit", emoji: "🐰", trait: "ears" },
  { name: "Dragon", emoji: "🐉", trait: "horns & fire" },
  { name: "Turtle", emoji: "🐢", trait: "shell" },
  { name: "Octopus", emoji: "🐙", trait: "sucker legs" },
  { name: "Deer", emoji: "🦌", trait: "antlers" },
  { name: "Fox", emoji: "🦊", trait: "fluffy tail" },
  { name: "Bee", emoji: "🐝", trait: "stripes & stinger" },
];

/**
 * ASCII art for each chimera evolution stage (0-10)
 */
const CHIMERA_ART: string[] = [
  // 0: Ghost (no agents yet)
  `  .oOo.
 ( >_< )
  ) ~ (
   ~~~`,
  // 1: Cat
  ` /\\_/\\
( o.o )
 > ^ < `,
  // 2: + Bird (wings)
  `  /\\_/\\
 (=^.^=)
  (")(")
 <\\  / > `,
  // 3: + Fish (tail)
  `  /\\_/\\
 (=^.^=)
  (")(")
 <\\  / >==<><`,
  // 4: + Rabbit (ears)
  `  /\\_/\\
 //=^.^=\\\\
  (")(")
 <\\  / >==<><`,
  // 5: + Dragon (horns & fire)
  `   /\\_/\\
  //=^.^=\\\\
  v(")(")v
 <\\  / >==<><
     ~~~>o`,
  // 6: + Turtle (shell)
  `   /\\_/\\
  //=^.^=\\\\
  v(")(")v   ___
 <\\  / >==<><\\_/
     ~~~>o`,
  // 7: + Octopus (sucker legs)
  `   /\\_/\\
  //=^.^=\\\\
  v(")(")v   ___
 <\\  / >==<><\\_/
   (o~o~o~o)
     ~~~>o`,
  // 8: + Deer (antlers)
  `    Y   Y
   /\\_/\\
  //=^.^=\\\\
  v(")(")v   ___
 <\\  / >==<><\\_/
   (o~o~o~o)
     ~~~>o`,
  // 9: + Fox (fluffy tail)
  `    Y   Y
   /\\_/\\
  //=^.^=\\\\
  v(")(")v   ___
 <\\  / >==<><\\_/
   (o~o~o~o)  ))))
     ~~~>o`,
  // 10: + Bee (stripes & stinger)
  `    Y   Y
   /\\_/\\
  //=^.^=\\\\
  v(")(")v   ___
 <\\==/==>==<><\\_/
   (o~o~o~o)  ))))>
     ~~~>o`,
];

/**
 * Aggregated stats across all non-chimera agents
 */
export interface AgentStats {
  commandCount: number;
  skillCount: number;
  agentCount: number;
  /** Names of agents that have at least one command or skill */
  detectedAgents: Set<string>;
}

export interface StatusOptions {
  customDirs?: Partial<Record<ProductType, string>>;
  gitRoot?: string | null;
  global?: boolean;
  /** Override chimera level for art display (hidden option) */
  lv?: number;
}

/**
 * Collect command/skill counts across all non-chimera agents for a given context
 */
export async function collectAgentStats(context: DirResolutionContext): Promise<AgentStats> {
  let commandCount = 0;
  let skillCount = 0;
  let agentCount = 0;
  const detectedAgents = new Set<string>();

  for (const name of PRODUCT_TYPES) {
    if (name === "chimera") continue;
    const agent = AGENT_REGISTRY[name];
    let found = false;

    try {
      const cmds = await findAgentCommands(agent, undefined, context);
      commandCount += cmds.length;
      if (cmds.length > 0) found = true;
    } catch {
      /* no dir */
    }

    try {
      const skills = await findAgentSkills(agent, undefined, context);
      skillCount += skills.length;
      if (skills.length > 0) found = true;
    } catch {
      /* no dir */
    }

    if (found) {
      agentCount++;
      detectedAgents.add(name);
    }
  }

  return { commandCount, skillCount, agentCount, detectedAgents };
}

/**
 * Format a stats line for the speech bubble
 */
export function formatStatsLine(label: string, stats: AgentStats): string {
  return `${label} ${stats.commandCount} commands, ${stats.skillCount} skills (${stats.agentCount} agents)`;
}

/**
 * Display the status output
 */
export async function showStatus(options: StatusOptions): Promise<void> {
  // Hidden --lv option: show only art + Lv + Composition
  if (options.lv != null) {
    showChimeraArt(options.lv);
    return;
  }

  console.log();

  // Version and mode
  const modeLabel = options.gitRoot && !options.global ? `project: ${options.gitRoot}` : "global";
  console.log(picocolors.dim(`acs v${version} [${modeLabel}]`));
  console.log();

  // Collect agent stats for user-level (always) and project-level (if in git repo)
  const userStats = await collectAgentStats({ global: true });
  const projectStats = options.gitRoot ? await collectAgentStats({ gitRoot: options.gitRoot, global: false }) : null;

  // Chimera level is based on distinct agents detected at user level
  const allDetectedAgents = new Set(userStats.detectedAgents);
  if (projectStats) {
    for (const a of projectStats.detectedAgents) {
      allDetectedAgents.add(a);
    }
  }
  const agentCount = allDetectedAgents.size;

  // Build speech bubble lines
  const lines: string[] = [];
  if (projectStats) {
    // 2-line: pad "User:" to match "Project:" width
    const userLine = formatStatsLine("User:   ", userStats);
    const projectLine = formatStatsLine("Project:", projectStats);
    lines.push(userLine, projectLine);
  } else {
    lines.push(formatStatsLine("User:", userStats));
  }

  const maxLen = Math.max(...lines.map((l) => l.length));
  const paddedLines = lines.map((l) => l.padEnd(maxLen));

  console.log(picocolors.cyan(`        .${"\u2500".repeat(maxLen + 2)}.`));
  for (const line of paddedLines) {
    console.log(picocolors.cyan(`       (  ${line}  )`));
  }
  console.log(picocolors.cyan(`        '-.${"\u2500".repeat(maxLen)}'`));
  console.log(picocolors.cyan("          /"));

  // ASCII art: Lv.N = N animals, Lv.0 = Ghost
  const artIndex = Math.min(agentCount, CHIMERA_ART.length - 1);

  // Display the chimera
  console.log(picocolors.cyan(CHIMERA_ART[artIndex]));
  console.log();

  // Agent count and animal composition
  const activeParts = agentCount === 0 ? CHIMERA_PARTS.slice(0, 1) : CHIMERA_PARTS.slice(1, agentCount + 1);
  const animalNames = activeParts
    .map((a) => (a.trait ? `${a.emoji} ${a.name} (${a.trait})` : `${a.emoji} ${a.name}`))
    .join(" + ");

  console.log(picocolors.bold(`Chimera Lv.${agentCount}`));
  console.log(picocolors.dim(`  Composition: ${animalNames}`));
  console.log();

  if (agentCount === 0) {
    console.log(picocolors.dim("  No agents detected yet. Run `acs import <agent>` to start evolving!"));
  } else {
    // List detected agents
    const agentList = [...allDetectedAgents].sort();
    const agentDisplayNames = agentList.map((a) => {
      const pt = a as ProductType;
      return PRODUCT_TYPES.includes(pt) ? AGENT_REGISTRY[pt].displayName : a;
    });
    console.log(`  Agents: ${agentDisplayNames.join(", ")}`);
  }
  console.log();

  // Flavor message
  console.log(picocolors.dim("  Your Chimera grows as you sync more agents. Keep collecting!"));
  console.log();
}

/**
 * Display only chimera ASCII art, Lv, and Composition for a given level
 */
export function showChimeraArt(lv: number): void {
  const level = Math.max(0, Math.min(lv, CHIMERA_ART.length - 1));

  console.log();
  console.log(picocolors.cyan(CHIMERA_ART[level]));
  console.log();

  const activeParts = level === 0 ? CHIMERA_PARTS.slice(0, 1) : CHIMERA_PARTS.slice(1, level + 1);
  const animalNames = activeParts
    .map((a) => (a.trait ? `${a.emoji} ${a.name} (${a.trait})` : `${a.emoji} ${a.name}`))
    .join(" + ");

  console.log(picocolors.bold(`Chimera Lv.${level}`));
  console.log(picocolors.dim(`  Composition: ${animalNames}`));
  console.log();
}
