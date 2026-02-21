import { ClaudeCommandConverter } from "../converters/claude-command-converter.js";
import { ClaudeSkillConverter } from "../converters/claude-skill-converter.js";
import { ClaudeParser } from "../parsers/claude-parser.js";
import { ClaudeSkillParser } from "../parsers/claude-skill-parser.js";
import type { ClaudeCommand, ClaudeSkill } from "../types/index.js";
import type { AgentDefinition } from "./types.js";

export function createClaudeAgent(): AgentDefinition {
  const parser = new ClaudeParser();
  const skillParser = new ClaudeSkillParser();
  const cmdConverter = new ClaudeCommandConverter();
  const skillConverter = new ClaudeSkillConverter();

  return {
    dirs: {
      commandSubdir: "commands",
      skillSubdir: "skills",
      projectBase: ".claude",
      userDefault: ".claude",
    },
    fileExtension: ".md",
    commands: {
      parse: (f) => parser.parse(f),
      toIR: (cmd) => cmdConverter.toIR(cmd as ClaudeCommand),
      fromIR: (ir, opts) => cmdConverter.fromIR(ir, opts),
      stringify: (cmd) => parser.stringify(cmd as ClaudeCommand),
    },
    skills: {
      parse: (d) => skillParser.parse(d),
      toIR: (s) => skillConverter.toIR(s as ClaudeSkill),
      fromIR: (ir, opts) => skillConverter.fromIR(ir, opts),
      writeToDirectory: async (skill, srcDir, tgtDir) => {
        const s = skill as ClaudeSkill;
        s.dirPath = srcDir;
        await skillParser.writeToDirectory(s, tgtDir);
      },
    },
  };
}
