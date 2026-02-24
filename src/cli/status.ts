import { join } from "node:path";
import matter from "gray-matter";
import picocolors from "picocolors";
import { version } from "../../package.json" assert { type: "json" };
import { AGENT_REGISTRY } from "../agents/registry.js";
import type { ProductType } from "../types/intermediate.js";
import { PRODUCT_TYPES } from "../types/intermediate.js";
import { type DirResolutionContext, findAgentCommands, findAgentSkills, readFile } from "../utils/file-utils.js";

const CHIMERA_KEY = "_chimera";

/** Chimera agent types to exclude from the "detected agents" list */
const EXCLUDED_AGENTS = new Set<string>(["chimera"]);

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
 * Scan Chimera hub files and collect unique agent names from _chimera sections
 */
interface ChimeraStats {
  agents: Set<string>;
  commandCount: number;
  skillCount: number;
}

export interface StatusOptions {
  customDirs?: Partial<Record<ProductType, string>>;
  gitRoot?: string | null;
  global?: boolean;
}

async function collectChimeraStats(options: StatusOptions): Promise<ChimeraStats> {
  const agents = new Set<string>();
  let commandCount = 0;
  let skillCount = 0;
  const chimeraAgent = AGENT_REGISTRY.chimera;

  const context: DirResolutionContext = {
    customDir: options.customDirs?.chimera,
    gitRoot: options.gitRoot,
    global: options.global,
  };

  // Scan command files
  try {
    const commandFiles = await findAgentCommands(chimeraAgent, undefined, context);
    commandCount = commandFiles.length;
    for (const filePath of commandFiles) {
      try {
        const content = await readFile(filePath);
        const parsed = matter(content);
        const chimeraSection = parsed.data[CHIMERA_KEY];
        if (chimeraSection && typeof chimeraSection === "object") {
          for (const key of Object.keys(chimeraSection)) {
            if (!EXCLUDED_AGENTS.has(key)) {
              agents.add(key);
            }
          }
        }
      } catch {
        // Skip unparseable files
      }
    }
  } catch {
    // No command directory
  }

  // Scan skill files
  try {
    const skillDirs = await findAgentSkills(chimeraAgent, undefined, context);
    skillCount = skillDirs.length;
    for (const dirPath of skillDirs) {
      try {
        const skillFilePath = join(dirPath, "SKILL.md");
        const content = await readFile(skillFilePath);
        const parsed = matter(content);
        const chimeraSection = parsed.data[CHIMERA_KEY];
        if (chimeraSection && typeof chimeraSection === "object") {
          for (const key of Object.keys(chimeraSection)) {
            if (!EXCLUDED_AGENTS.has(key)) {
              agents.add(key);
            }
          }
        }
      } catch {
        // Skip unparseable skills
      }
    }
  } catch {
    // No skill directory
  }

  return { agents, commandCount, skillCount };
}

/**
 * Display the status output
 */
export async function showStatus(options: StatusOptions): Promise<void> {
  const { agents: detectedAgents, commandCount, skillCount } = await collectChimeraStats(options);
  const agentCount = detectedAgents.size;

  console.log();

  // Version and mode
  const modeLabel =
    options.gitRoot && !options.global ? `project: ${options.gitRoot}` : "global";
  console.log(picocolors.dim(`acs v${version} [${modeLabel}]`));
  console.log();

  // Speech bubble with command/skill counts
  const speech = `${commandCount} commands, ${skillCount} skills`;
  const pad = speech.length;
  console.log(picocolors.cyan(`        .${"-".repeat(pad + 2)}.`));
  console.log(picocolors.cyan(`       (  ${speech}  )`));
  console.log(picocolors.cyan(`        '-.${"-".repeat(pad)}'`));
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
    const agentList = [...detectedAgents].sort();
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
