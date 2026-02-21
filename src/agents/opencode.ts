import { OpenCodeCommandConverter } from "../converters/opencode-command-converter.js";
import { OpenCodeSkillConverter } from "../converters/opencode-skill-converter.js";
import { OpenCodeParser } from "../parsers/opencode-parser.js";
import { OpenCodeSkillParser } from "../parsers/opencode-skill-parser.js";
import type { OpenCodeCommand, OpenCodeSkill } from "../types/index.js";
import type { AgentDefinition } from "./types.js";

export function createOpenCodeAgent(): AgentDefinition {
  const parser = new OpenCodeParser();
  const skillParser = new OpenCodeSkillParser();
  const cmdConverter = new OpenCodeCommandConverter();
  const skillConverter = new OpenCodeSkillConverter();

  return {
    displayName: "OpenCode",
    dirs: {
      commandSubdir: "commands",
      skillSubdir: "skills",
      projectBase: ".opencode",
      userDefault: ".config/opencode",
    },
    fileExtension: ".md",
    commands: {
      parse: (f) => parser.parse(f),
      toIR: (cmd) => cmdConverter.toIR(cmd as OpenCodeCommand),
      fromIR: (ir, opts) => cmdConverter.fromIR(ir, opts),
      stringify: (cmd) => parser.stringify(cmd as OpenCodeCommand),
    },
    skills: {
      parse: (d) => skillParser.parse(d),
      toIR: (s) => skillConverter.toIR(s as OpenCodeSkill),
      fromIR: (ir, opts) => skillConverter.fromIR(ir, opts),
      writeToDirectory: async (skill, srcDir, tgtDir) => {
        const s = skill as OpenCodeSkill;
        s.dirPath = srcDir;
        await skillParser.writeToDirectory(s, tgtDir);
      },
    },
  };
}
